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
`PRISONER_REFEREE_MODEL`, against `PRISONER_MODEL_URL`. Those are the *run's* pair;
`PRISONER_PRISONER_MODEL` and `PRISONER_WARDEN_MODEL` (`src/modelRoles.ts`) override one *chair's*,
falling back to that pair when unset, so every batch recorded before they existed is byte-identical.
A chair's model takes the whole chair, wits and voice both — a warden thinking on the local card and
speaking through a paid oracle is not "one model in that seat", and the voice line never reaches the
referee anyway. **The transcript header names both chairs whenever they differ** and prints the old
single `Wits model:` line whenever they do not; that byte-identity is pinned by
`src/__tests__/modelRoles.test.ts` against recorded headers, because a header that drifts silently
makes every earlier batch un-poolable for a reason nobody can see. Two chairs on two models still go
through the one swapper, so pointed straight at doris this would cost a swap per half-round; through
the model router it costs nothing, because `/api/generate` there is a no-op and only the chair whose
model is local ever occupies the card. On a single consumer GPU only one model fits,
so every call goes through `src/ollamaSwap.ts`, which unloads before loading and never lets two calls
overlap. `PRISONER_OLLAMA_RESIDENT_MODELS` lists models a run may unload and must restore afterwards;
**any other model found loaded stops the run** (it belongs to someone else). Do not infer "pinned"
from Ollama's `expires_at`: some servers keep every model loaded indefinitely. Transcripts go to
`checkpoints/`, committed unedited, including bad runs.

## A model that is not on doris goes through the model router

A Claude-minds or DeepInfra batch (OPUS-FIRST-DESIGN.md, D2) changes no code in the minds: it points
`PRISONER_MODEL_URL` at `npm run model-router` (`src/tools/modelRouter.ts`, `localhost:8799`), which
speaks OpenAI chat-completions and routes by `model` -- `opus`/`sonnet`/`haiku` or any `claude-*` id
to the keyless `claude` CLI in print mode (subscription auth only: `ANTHROPIC_API_KEY` and
`ANTHROPIC_AUTH_TOKEN` are deleted from the child's env, the same rule brink's `claudeCli/backend.ts`
enforces for the same money-safety reason), any `org/model` id to DeepInfra with `DEEPINFRA_API_KEY`
from env and retry-with-backoff on its one-in-three `engine_overloaded`, and everything else to doris
unchanged. Start it in its own detached terminal first, then run the batch against it:

```bash
DEEPINFRA_API_KEY=... SHIM_CLAUDE_CWD=/tmp/empty npm run model-router   # one JSON line per request on stdout
PRISONER_VARIANT=open PRISONER_MODEL_URL=http://localhost:8799/v1 \
  PRISONER_WITS_MODEL=claude-opus-4-6 PRISONER_SKIP_VOICE=1 PRISONER_ROUNDS=10 \
  PRISONER_OLLAMA_RESIDENT_MODELS= npm run checkpoint
```

**The resident referee is hidden from `/api/ps` on purpose** (`SHIM_HIDE_MODELS`, default `qwen3:14b`).
The one-model swapper above runs on every real run, and before the wits call it would see `qwen3:14b`
loaded, decide it was in the way of `claude-opus-4-6`, and unload it -- to make room on a GPU the
Opus call never touches -- then the referee's own next call would reload it, once per half-round. So
the router serves doris's real `/api/ps` with the residents removed and `/api/generate` as a no-op,
and doris's pin is left exactly as found. Every OTHER loaded model still shows, so the foreign-model
guard fires exactly as it would without the router. The cost is that such a transcript's header reads
"(no models loaded)"; the real state is in the router's own log, which is why a batch keeps it under
its checkpoint's `logs/`. Pin the oracle by id, never by alias (`opus` is whatever the CLI's alias
resolves to that day), and read the `cliModel` field of each `route: "claude"` log line to check it.

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

`PRISONER_VIEW=raw|prose|narrated|play` (the-prisoner#21) chooses *how* the seat's own situation is
shown, never *what*: `raw` (unset, the default) is the labelled-block view the model itself reads,
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

**`play` is the view to hand a person (2026-09-25).** The other three are answers to "what does this
chair know?"; `play` is the answer to "what just happened?". It takes the same blocks `prose`
composes, through the same delta, and puts them in Infocom's order -- the news, notes and plan, the
beliefs with their stamps, then the room -- holding three of them behind no-turn commands that
print the identical text on demand: the condition list (`conditions`), the standing rules (`rules`,
new) and identity/motive (`me`, new). The how-to-play instructions are said on the first turn only.

The reason it is a fourth view rather than a fix to `prose`: the owner's first live game under
`prose` opened with ~70 lines in which the one thing that had happened sat fourth of eight blocks,
under the warden's own win conditions stated as thresholds. `prose` was behaving exactly as #21
specifies -- the ORDER was the failure -- and `prose` is also what a rejected `narrated` turn falls
back to, so its completeness test stays the guard it was. **Nothing is withheld from the player**,
which is the half of #21's constraint that still binds: `PLAY_BLOCK_POLICY` (`humanSeat.ts`) is a
`Record` over every `ProseBlockKind`, with no "dropped" value to give one, so a block kind added
later cannot reach this view without a decision about whether a player sees it. A `play` transcript
is a person's game and is not byte-comparable to a model's prompt the way `raw` is; the header says
so itself.

**`PRISONER_NARRATOR_MODEL` wants the most obedient model available, not the best writer available**
(§61.1). This is measured, not taste: with completeness no longer holding a narration to the
catalogue, `ancient-awakening:12b` filled the room with invented moonlight, smells, stars and "no
guards on this side this late at night" -- fabricated tactical information a player would act on,
which `verifyNarration` structurally cannot catch (§54's own documented limit). Tightening the
prompt made that model worse. `qwen3:14b` on the identical prompt stays inside the data. The
residual is what the second verifier now catches (§63).

**The second verifier is ON whenever a narrator runs** (§63, `src/open/narrationAudit.ts`): a model
is given the facts and the narration split into sentences, and any sentence it calls unsupported is
**cut**, with the rest shown. Cut rather than reject, because measured rejection rates make
all-or-nothing identical to §58.1 -- it would discard every `ancient-awakening:12b` narration and two
thirds of `qwen3:14b`'s. Cutting can only make prose say LESS, and §61 already renders every belief
and the clock above it. Its model defaults to the REFEREE's, never the narrator's (a narrator
auditing itself agrees with itself), and `PRISONER_NARRATION_AUDIT=off` restores the old behaviour.
**An auditor is not a licence to put a fabulist in the narrator chair** -- with it attached,
`ancient-awakening:12b` still loses about half its turns wholesale, and `qwen3:14b` loses none.

## Never run `npm run format` on this repository

`prettier` is a dependency and `format`/`format:check` exist, but **this code is not
prettier-formatted** -- `npx prettier --check src/` fails on files nobody has touched in weeks, at
every print width. Running `--write` reformats whole files to 80 columns and buries a two-line change
in several hundred lines of rewrapping; it happened once, on 2026-09-17, and had to be reverted.
Match the surrounding style by hand instead: wide lines, comments that say *why*, `§` references into
`docs/DESIGN.md` or `docs/OPEN-VARIANT.md`. `npm run lint` and `npm run typecheck` are the checks that
mean something here, plus `npx vitest run`.

## One driver at a time, or the referee is not deterministic

**A batch runs ONE game driver against the server, never two** (OPEN-VARIANT.md §75, decided
2026-09-25). This is measured, not caution: two processes replaying the *same* recorded request
simultaneously returned **different rulings on 2 of 4 rows, flipping the verdict both times**, while
the identical request run alone is bit-reproducible across repeats. §3.5's "the referee runs at
temperature 0" is stated for its consistency property, and that property does not survive a shared
server.

Batch 6 ran two drivers (`launcher-a.sh`/`launcher-b.sh`, interleaving arms on purpose) and **six of
its 22 refusals are that artifact** -- they resolve correctly on a serial replay, and they are the
whole `reveal`-property cluster. Read b6's refusal numbers through §75.3, not through its own
RESULTS. Batch 7 ran a single sequential `run-batch.sh` and is unaffected.

The cost is wall clock and nothing else. Do not "recover" it by interleaving: a batch whose rulings
are draws cannot support a pre-registered band, which is what every PREDICTION.md here is made of.
The same applies to a probe running beside a batch -- `checkpoints/2026-09-22-reveal-edge/` hit this
first and recorded it as unexplained.

## Local play is all-Muse, and thinking is OFF everywhere

**Owner's decision, 2026-09-25: playing locally uses `muse-glimmer-30b-q4_k_m` in all three chairs** --
prisoner, warden and referee. Not a per-run choice to relitigate.

Why the alternatives lost. The **referee** is measured good serially (OPEN-VARIANT §75.4: 97%
sensitivity, 89% specificity, 1 of 29 escape-route captures, 0 harmful false positives); a hosted
referee buys ~6 points (36/43 vs Sonnet's 42/43) and is not worth the dependency. The **warden** was
measured indistinguishable from Opus in batch 4. The **prisoner** is where it costs: b6's **14
all-Muse games were 14 timeouts, 0 escapes**, deepest bar 59 against a window gated at 50, where batch
4's Opus prisoner escaped 3 of 10. **So outcome measures -- escape, ambition, the door probes -- have
no variance locally.** Use process measures (grounding, adherence, rulings, refusals, warden
behaviour) for all-Muse runs, and put a hosted model in the PRISONER's chair when an outcome is the
dependent variable. That chair costs no VRAM, which is why it is the exception worth making.

**Thinking is OFF for both roles and both defaults now say so.** For the referee this is not "no
benefit" but *harm*: serially over 22 rows, `none` gave 6 correct resolutions and 0 false ones while
`high` gave 3 correct and 1 false, and broke 4 of the 6 rows `none` gets right, at 3-5x the cost
(§75.5). §68.1/§68.5's "referee thinking must stay ON" was measured on `qwen3:14b` and **does not
transfer**. For the wits it is the weaker claim -- no measured difference on two separate calls,
never shown harmful.

**The switch used to be a no-op and now is not** (P8, §75.6). `withThinking` sent `reasoning_effort`,
which this llama-server ignores; what actually held reasoning off was the server's start flag. It now
sends `chat_template_kwargs: { reasoning_strength: "none" }`, which **overrides** that flag, and the
transcript header names the field and value actually sent. `ON` sends no field at all, so the served
model's configuration decides -- the header says exactly that, and a transcript reading `ON` is
therefore not evidence that anything reasoned.

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
repository's words) rather than leaving it only in this game's own docs. The guide's declared-space
lesson is the one to read before the next elaborable thing is authored: what an object may ever come
to acquire is declared up front and separately from what its description says it is right now, and
collapsing the two is what turns an acquired fact into narration nothing can audit. The guide's
surfaces lesson is this game's own §66.6 and §67.5 generalised: the packed earth under the loose tile
was prose and not an object, so a dig had nowhere to land and every reading filed it as lifting the
tile or scraping it. A physical scenario declares its floor, ceiling and walls as objects wherever a
character could act on them. The first such row belongs in the measurement fixture
(`docs/WORLD-ELABORATION-DESIGN-2.md` §6.7), never in the benchmark scenario, which keeps every
recorded batch comparable. **Half of that lesson was then measured away and the guide now says so**
(`checkpoints/2026-09-19-floor/`): declaring the surface moved every dig that NAMED the floor and not
one that named the tile on top of it, and authoring the containment in words moved nothing at all. The
referee's `target` question is answered from the words of the intent, so no description reaches an act
whose words name something else -- which is the same conclusion `checkpoints/2026-09-19-selftarget/`
and `checkpoints/2026-09-20-person-target/` reached from the other direction, and it is the standing
reason to be suspicious of any fix that hopes a description will redirect a ruling.

**Two more lessons went to the guide from this game on 2026-09-26** (`docs/HUMAN-INTENTS-DESIGN.md` §8,
D12). One: measure the referee on the population that will write to it. Every referee number before
then was measured on intents a model typed with the answer keys in its prompt, which is an upper bound;
a person states methods, elides the reflexive object and writes toward the room's prose, so a human-shaped
row is labelled correct / misread / unmodelled / ambiguous before the run (§7.2), and only a misread
counts against the referee. Two: no description carries another object's name, least of all in the
plural when one is modelled. The window's "Iron bars cross it" was that failure (#26, fixed at §76);
before authoring a description, list its nouns and ask of each whether it is another object's id or a
plural of one.

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

## Custody is not built, though the engine no longer blocks it

`run-dmcp`'s `IntendedChange` (`src/timeline/resolve.ts`, this repo pinned at `run-dmcp@0.8.0`) is no
longer numeric-only. Alongside `write` (a numeric fact key, delta or set) and `transfer` (a conserved
numeric amount moved between two entities), `set`, `create` and `destroy` shipped in 0.7.0 and 0.8.0
(engine issues #32, #34): `set` changes a non-numeric column on an entity's own projected row, and the
engine's own doc comment gives this exact case as its example — "a thing changing owner, a character
changing place." `create`/`destroy` bring an entity into or out of existence. the-prisoner#5 names
this directly: what used to be blocked at the protocol is now only blocked by this game's own
referee, which still proposes one of eleven fixed effects (`src/open/effects.ts`) rather than the
engine's five change kinds directly.

That makes an item's owner representable, not built. `mechanics.ts` already writes an item's
`owner_id`/`owner_type` (the engine's own `items` columns) once, at creation (`derive`'s `create` leg,
`src/open/mechanics.ts:227`) — the same columns a `{ kind: "set", entityId: <item>, key: "owner_id",
value: <new owner's EntityRef> }` could change afterward. Nothing in this game emits that today: no
effect moves an item's owner, `transfer` is unused here (it only ever carries a numeric resource,
never an item), and there is no SEARCH, CONFISCATE, or any other custody move in either variant.
Loosening the referee toward the engine's own five kinds is the-prisoner#5's step 1, and a custody
mechanic is downstream of that step, not shipped by this paragraph.

What does not change: ownership must never move outside `resolver.resolve()`. That would be a second
write path, and the engine records decisions, it does not make them anywhere but at that one choke
point — true when this section described a numeric-only protocol, and still true now that the part of
the protocol that used to block custody is gone.
