# The Prisoner — Claude Context

## What this is

A model-driven prisoner and a model-driven warden play a two-principal, one-room, physical game
through `run-dmcp`'s resolve protocol — the resolve protocol's first production caller, and the
second consumer of the extracted `mind-seam` rival-mind seam. `docs/DESIGN.md` is the authority;
section numbers in comments here refer to it. Draft issues for each landing-order step are in
`docs/issues/`.

## TypeScript only

Depends on the published `run-dmcp` and the published `mind-seam`, each at an **exact pin** (no
caret) — never linked, never `file:`. Import `run-dmcp` and `run-dmcp/rpg` (mechanism), never
`run-dmcp/server` or `run-dmcp/rpg/server` (assembly). `~/rpg` is not a monorepo (root `CLAUDE.md`):
nothing here is wired into `run-dmcp`, `mind-seam`, or `brink-workshop` by anything but a version
number in `package.json`.

## TDD is mandatory

Write the failing test first, confirm it fails for the right reason, then implement. The
conformance harness (once `mind-seam` is published) exists before any mind or world does, red with
"not implemented"; a guard is validated by planting a violation and watching it go red before it is
trusted.

## The mind cannot write

Not a rule to remember: `PrisonerContext`/`WardenContext` are `type` aliases over `mind-seam`'s
`InertRecord`, `assertInert` runs at the seam, and the loop's only write path is
`resolver.resolve()`. If you find yourself adding a field that could reach storage, `tsc` will
refuse it (`C extends InertRecord`), and if you cast past `tsc`, the conformance suite's check 2
will.

## Two variants, one switch

`PRISONER_VARIANT=closed|open`, default `closed`. **closed**: each mind picks `plan[0]` from an enum of
moves with fully stated rules (`src/world/`, `src/mind/`, `src/loop.ts`). **open**: each mind proposes a
free-text intent and a referee rules on it (`src/open/`), designed in `docs/OPEN-VARIANT.md`, which is
the authority for that variant. Everything except the action layer is shared: cell, characters,
beliefs, clock, presence, thoughts/notes, wits/voice model roles, swapper, engine, seam. Keep it that
way; if the two variants diverge anywhere else, a comparison between them stops meaning anything.

## Real games use one model at a time

Model roles are configured by `PRISONER_WITS_MODEL`, `PRISONER_VOICE_MODEL` and (open variant)
`PRISONER_REFEREE_MODEL`, against `PRISONER_MODEL_URL`. On a single consumer GPU only one model fits,
so every call goes through `src/ollamaSwap.ts`, which unloads before loading and never lets two calls
overlap. `PRISONER_OLLAMA_RESIDENT_MODELS` lists models a run may unload and must restore afterwards;
**any other model found loaded stops the run** (it belongs to someone else). Do not infer "pinned"
from Ollama's `expires_at`: some servers keep every model loaded indefinitely. Transcripts go to
`checkpoints/`, committed unedited, including bad runs.

## Test runs skip the voice model for reasoning-only work

The voice role exists to write one line of in-character dialogue for a human reading the transcript
afterward, and nothing else: `open/mind.ts`'s own comment records that "the wits call's `intent` is
always what reaches the referee," so voice never touches the world, the referee, or anything a test
asserts on. A run whose purpose is testing reasoning -- the wits decision, the world, the referee --
rather than producing a transcript meant to be read should set `PRISONER_SKIP_VOICE=1`
(`src/modelRoles.ts`): it collapses the voice model onto the wits model, the same single-call path
`createOpenMind` already gives two equal model names, skipping a whole model call and GPU swap per
half-round. Leave it unset (the default) for a run whose transcript IS the point -- a checkpoint
meant to be read, a demonstration, or anything going into `docs/OPEN-VARIANT.md` as evidence of what
a game looked like to a person.

## A person can take one of the two chairs

`PRISONER_HUMAN=prisoner|warden` replaces that principal's model mind with a terminal
(`src/open/humanSeat.ts`, OPEN-VARIANT.md §47): the player is shown exactly what the model in that
chair would have been shown, types a free-text intent, and the referee rules it like any other. Open
variant only, and it **needs a real terminal** -- with stdin piped or redirected the run refuses to
start, because `readline` would close before the first question and every turn would silently pass.
It is the one real run you do NOT detach with `nohup`.

```bash
PRISONER_VARIANT=open PRISONER_HUMAN=prisoner \
  PRISONER_MODEL_URL=http://doris:11434/v1 \
  PRISONER_WITS_MODEL=qwen3:14b PRISONER_VOICE_MODEL=ancient-awakening:12b \
  PRISONER_REFEREE_TIMEOUT_MS=180000 \
  PRISONER_THINK_TIMEOUT_MS=180000 PRISONER_ROUNDS=30 PRISONER_OLLAMA_RESIDENT_MODELS= \
  npm run checkpoint
```

Leave it unset for anything measured. A transcript with a person in it says so in its own header and
must never be pooled with a model batch, because a batch means identical conditions.

**Do not pin `PRISONER_REFEREE_MODEL=qwen2.5:14b` here or anywhere else.** This example used to, long
after `DEFAULT_REFEREE_MODEL` became `qwen3:14b` (§33.16), and a human game on 2026-09-18
copied the stale pin and spent five rounds under a referee the project had already replaced for
exactly the failure it then hit (§62). Leave the referee unset and let `modelRoles.ts` supply the
default -- that constant carries the evidence for its own value, and an example that overrides it
silently un-fixes a fixed bug.

`PRISONER_VIEW=raw|prose|narrated` (the-prisoner#21) chooses *how* the seat's own situation is shown,
never *what*: `raw` (unset, the default) is the labelled-block view the model itself reads,
byte-identical to its prompt; `prose` is deterministic prose composed by code from the identical
context (`src/open/proseView.ts`) -- no model call, and pinned by a completeness test so a future
edit cannot quietly drop a belief's stamp or an object's description while the prose still reads
fine. `narrated` (D3, 2026-09-18, OPEN-VARIANT.md's own narrator section) asks a model
(`PRISONER_NARRATOR_MODEL`, `src/open/narrator.ts`) for prose over the SAME data and shows it only
once `verifyNarration` finds nothing wrong with it; a narration that fails falls back to `prose`,
silently to the player, with the failure counted and recorded in the transcript. Every mode: typing
`raw` at the intent prompt reprints the raw NPC view on demand and asks again.

`prose` and the `narrated` fallback show the **standing world once** (`src/open/deltaView.ts`,
OPEN-VARIANT.md §59): conditions, identity, the cell and the state-based rules are held back on a
later turn when the player has already been shown that exact text and it is still true, so the
turn's own news is not buried under twenty-odd identical lines. The turn's state -- the clock, the
news, notes and plan, and every belief WITH its "as of round N" stamp -- is shown every turn
regardless, and any render that holds something back says what and points at `raw`. **The raw view
never goes through it**, as the default view or as the on-demand escape hatch: it stays byte-identical
to the model's prompt, which is what every measured run reads and what §47's like-for-like seat
depends on.

Under `narrated`, **code renders state and the model renders the room** (§61): the seat itself shows
the conditions, the identity, the clock and news, notes and plan, and every belief WITH its stamp,
through that same delta -- the narration replaces the SCENE block alone. That is why
`verifyNarration` discards only the lying kinds (`invented-*`, `contradicts-*`, `speaks-for-other`,
`narrates-outcome`) and merely counts the `dropped-*` ones: a narrator is never asked to carry a
number, so it is never discarded for failing to recite one. **Read §61 before moving a kind between
those two sets** -- the split is two different claims about a narration, not a strictness dial.

**`PRISONER_NARRATOR_MODEL` wants the most obedient model available, not the best writer available**
(§61.1). This is measured, not taste: with completeness no longer holding a narration to the
catalogue, `ancient-awakening:12b` filled the room with invented moonlight, smells, stars and "no
guards on this side this late at night" -- fabricated tactical information a player would act on,
which `verifyNarration` structurally cannot catch (§54's own documented limit). Tightening the
prompt made that model worse. `qwen3:14b` on the identical prompt stays inside the data. The
residual is only catchable by a second verifier model, which is a cost decision (§61.1), still open.

## Never run `npm run format` on this repository

`prettier` is a dependency and `format`/`format:check` exist, but **this code is not
prettier-formatted** -- `npx prettier --check src/` fails on files nobody has touched in weeks, at
every print width. Running `--write` reformats whole files to 80 columns and buries a two-line change
in several hundred lines of rewrapping; it happened once, on 2026-09-17, and had to be reverted.
Match the surrounding style by hand instead: wide lines, comments that say *why*, `§` references into
`docs/DESIGN.md` or `docs/OPEN-VARIANT.md`. `npm run lint` and `npm run typecheck` are the checks that
mean something here, plus `npx vitest run`.

## Run a batch from a pinned commit, not from live `main`

A batch means identical conditions (§31), and `npm run checkpoint` executes whatever the working tree
says at the moment each game starts. On 2026-09-17 a ten-game batch ran while branches were being
merged into `main`; the merges happened to be arms defaulting to off and byte-identical prompts, and
the round-1 briefings were compared across the batch afterwards to confirm nothing moved -- but that
was luck, not method. Check out the commit the batch is for (a worktree is cheapest) and run from
there, so the batch's own transcripts name a single revision. Every transcript now prints
`Code revision: <sha> (clean)` -- or says plainly that the tree had uncommitted changes and names no
single revision (`src/runRevision.ts`) -- so a reader can check that a batch was pinned instead of
taking the runner's word for it.

## Never pattern-match meaning

In the closed variant, a move is validated by literal membership (after ASCII uppercasing) in a list
this repository wrote, inside this repository's own `coerce`. In the open variant, free text is ruled
on only by the referee through the engine's turn reader (`createTurnReader`): closed answer keys, each
answer cited verbatim against a named source (the actor's intent, or the target object's authored
description) — never a regex, never code deciding what prose means. Code can verify that a citation
is verbatim and from the right source; it cannot verify that the quote justifies the ruling, so that
judgement is audited by humans in transcripts, never approximated by a lexical check.

**Before declaring a new object or effect, check run-dmcp's `docs/AUTHORING-GUIDE.md`.** OPEN-VARIANT
§19 is in there, generalised: an object your referee targets and the object whose property actually
changes can silently diverge when one interaction spans two objects, because an instruction that lives
in only one reader question's prompt does not reach another question's answer. If you find a new
authoring lesson here, generalise it into that guide (its own neutral vocabulary, never this
repository's words) rather than leaving it only in this game's own docs.

## Never run against a real database

`DMCP_DB_PATH=:memory:` is set process-wide in `src/test-setup.ts`, exactly as brink-workshop's own
tests do. No test in this repository touches a file on disk. The one exception is `npm run
checkpoint` (Phase B), which uses a fresh scratch file under `/tmp` or `:memory:` — never a default
path — per root `CLAUDE.md`'s hard rule 2 for this whole workspace.

## Vocabulary

This repository's words — warden, prisoner, cell, bar, file, spoon, custody — are its own and must
never reach `run-dmcp` or `mind-seam`. An engine or seam issue filed from here describes the game
structurally ("two principals, one location, contended physical state"), never in this game's own
terms.

## Custody is out, for now

`run-dmcp`'s `IntendedChange` is numeric-only until engine issue E3 lands. SEARCH, CONFISCATE, and
any mechanic that would move an item's owner are out of scope. Do not move ownership outside
`resolver.resolve()` to work around this — that is a second write path, and the engine records
decisions, it does not make them anywhere but at that one choke point.
