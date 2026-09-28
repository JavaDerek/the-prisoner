# The referee's test cases and training data (the-prisoner#10)

`docs/OPEN-VARIANT.md` §33.16 showed that whether this game plays correctly depends partly on
**which model referees it**, not only on the world and the prompt: eight rewordings of the effect
question could not get `qwen2.5:14b` to rule *"Remove the bar"* as `open` without pulling climb-outs
to `open` too, while the unchanged prompt on `qwen3:14b` scored 24 of 26 on the same intents. A
person running this game on other hardware, or with another model, previously had no way to tell
whether their referee is good enough, and rewording is the only fix rewording alone can measure.

The owner's direction (2026-09-16): games should be shareable, and each one ships what a person needs
to **train a LoRA for whatever base model they run**. This ships *training data*, never a trained
adapter — an adapter only works on the exact base model and quantization it was trained and checked
against (see the-prisoner#10's own research note for candidate public datasets and why this repository
does not mix any of them in, below).

## Scope: the referee only

This ships labels for the referee's own closed-key rulings — never the prisoner or warden minds.
Training on their PLAY would make the README's proposed benchmark measure the dataset instead of the
model (the-prisoner#10, "Decisions for whoever picks this up": "Rule-applying roles only"). The
README's benchmark numbers stay clean because nothing here touches a mind's own reasoning; the voice
role is out of scope for the same reason, one layer down.

**No public dataset is mixed in.** the-prisoner#10's own research-note comment lists candidates
(ALFWorld/TextWorld/ScienceWorld, PIQA, ATOMIC 2020/COMET, Jericho) as things a *later* effort could
look at for the referee's own precondition-logic overlap — but each carries its own licence and
redistribution terms that were never checked (the note says so explicitly: "Unverified as written").
A public dataset shipped in a `train` split ships WITH this game, so its terms would need checking
before anything is mixed, never after. That check has not happened, so nothing from that list is in
`data/referee/`. This is a decision, not an oversight: recorded here so it does not need to be
re-decided the next time someone reads that research note.

## The labels file

`data/referee/labels.jsonl` — one JSON object per line, `RefereeLabel` (`src/open/refereeData/types.ts`):

| field | what it is |
|---|---|
| `id` | stable, unique across the file |
| `split` | `"test"` or `"train"` |
| `scene` | where the perceived objects and their descriptions come from — see below, never a copy of the text |
| `refereeArms` | the `createReferee` arms (elision/container-clause/instrument/derive-wording) this label is scored or rendered against |
| `intentText` | the actor's free-text intent |
| `expected` | the answer to each of the referee's six questions (`target`/`effect`/`product`/`property`/`magnitude`/`perceptibility`), plus `acts` for OPEN-VARIANT.md §74.1's separate one-act reading — any of these may be `null`, meaning "not known" |
| `citations` | the expected citation for each answered question, `{sourceId, quote}` and/or `{sourceId, from, to}` (a word range, `run-dmcp`'s own `sourceWords` numbering) |
| `provenance` | `{labeller, audited, source, note?}` |

**A `null` answer or citation is an honest gap, never invented.** The scorer skips a question with no
expected answer; the renderer refuses to render a `train`-split label that has one (every question a
real request asks needs a real answer to teach a model).

### `scene`: two kinds, never a copy of perceived text

- **`static`** (`{kind: "static", perceivedObjectIds: [...]}`) — a fixed list of `scenarioObjects.ts`
  ids, looked up **at render/score time**, against **today's** authored text. This is deliberately not
  the text a checkpoint recorded historically — the-prisoner#26's plural fix ("Iron bars cross it")
  landed after §33.16 was recorded, and storing that stale prose would silently re-teach a bug this
  project already fixed. `src/open/refereeData/scene.ts`'s `resolveScene` does the lookup.
- **`replay`** (`{kind: "replay", sourceFile, round, chair}`) — a D11-corpus row. The scene is rebuilt
  by REPLAYING every earlier half-round of the named transcript (both chairs, in file order, up to but
  excluding this row's own turn) through the real `planEffect`/`resolver.resolve()` path — the same
  mechanism `checkpoints/2026-09-26-human-intents/probe.mts` already used to build this corpus's own
  `dry-run.jsonl`, ported into `scene.ts` and checked against that exact file
  (`src/open/refereeData/__tests__/scene.test.ts`). `sourceFile: null` means no transcript survives for
  that game and the scene is the game's own round-1 default state — `docs/HUMAN-INTENTS-DESIGN.md`
  §7.2's own documented exception.

### The two seed corpora

1. **§33.16's 26 intents** (`checkpoints/2026-09-16-referee-removal-s33-16/`,
   `src/open/refereeData/seedS3316.ts`), all `split: "test"`. Provenance is split honestly:
   - `effect` is §33.16's own pre-registered expectation.
   - `target`/`product`/`property`/`magnitude`/`perceptibility` are read off `qwen3:14b`'s own
     RECORDED, KNOWN-CORRECT ruling (`out-qwen3-base-N3.txt`) for the 24 of 26 rows it got right; the 2
     it missed carry the DESIGN's intended answer instead of the model's own wrong one (each row's own
     `provenance.note` says which).
   - Every citation is freshly authored against today's scenario text and marked `audited: false` —
     nobody has reviewed them by hand; they are only mechanically valid (every one of the 26 passes
     `run-dmcp`'s own `createTurnReader` check via `renderLabel`, exercised in this task's own tests).
2. **D11's 95-row human-intents corpus** (`checkpoints/2026-09-26-human-intents/corpus.json`,
   `LABELS.md`, `src/open/refereeData/seedD11.ts`), all `split: "test"`. That corpus's own four-way
   `expectedLabelPostD5D9` class (`correct`/`misread`/`ambiguous`/`unmodelled`, `LABELS.md`) decides
   what counts as ground truth here, per `docs/HUMAN-INTENTS-DESIGN.md`'s own "only a misread counts
   against the referee": `target`/`effect`/`property` are kept ONLY for `correct`/`misread` rows, and
   dropped (all three, per row) for `ambiguous`/`unmodelled` ones and the two mixed-label rows
   (`I25-6`/`I25-7`), which the corpus itself already records with `expectedKeys: null`. A field whose
   own value is compound (`"wear-or-derive"`, `"none-or-refused"`) is dropped even on an otherwise
   scoreable row — 16 of the 95 D11 rows end up with nothing to score, all for one of these reasons
   (`labelsFile.test.ts` pins the count). `product`, `magnitude`, `perceptibility` and every citation
   are `null` throughout — D11 never recorded them. **This transform reads only `corpus.json`'s own
   `expectedKeys` field, never `LABELS.md`'s prose table** — a handful of rows (`I25-4`, `I25-1`,
   `I25-2`) have a clear answer written in that table's prose but `null` in the data file itself;
   backfilling from prose would be a second, hand-copied source of truth that can silently drift from
   the file, so this task leaves those rows unlabelled rather than inventing from a paragraph.

Regenerate the file (deterministic, offline, no model call) with:

```bash
npm run build-referee-labels
```

## The renderer

`src/open/refereeData/render.ts` (CLI: `npm run render-referee-data -- <labels.jsonl> <out.jsonl>`)
turns every `train`-split label into one (or, when `expected.acts` is set, two) chat-messages examples,
`{"messages": [{"role": "user", ...}, {"role": "assistant", ...}]}` per line — the format Unsloth and
most other LoRA trainers read. A sidecar `<out>.meta.jsonl` (same line order) carries each example's
`labelId`, which `part` it is (`main`/`acts`) and a `sha256:` hash of the exact prompt text it used,
kept out of the primary file so a trainer reading it literally never sees an unexpected key.

- **Built through the real code, never a copy of the text.** The user turn is `refereeTransport.ts`'s
  own `buildPrompt`, over the real `ReadRequest` `createReferee(...).rule()` would build for that
  label's scene — captured with a scripted transport, the same technique
  `checkpoints/2026-09-16-referee-removal-s33-16/build-requests.mts` already used.
- **`test`-split labels are never written.** Not by throwing — a labels file mixing both splits is
  normal — but by never appearing in the rendered output, even when handed to the renderer alongside
  `train` rows (`render.test.ts`'s own test mixes them and checks the `test` row never appears).
- **Every rendered assistant answer is checked by `run-dmcp`'s own `createTurnReader`** (closed keys,
  verbatim citations) before it is written. **A label that fails this is an error, not a skipped
  line** — a bad citation in training data teaches a model to cite wrongly, which is worse than
  shipping nothing (`render.test.ts` exercises this with a deliberately bad citation and a deliberately
  illegal answer key).

## The scorer

`src/open/refereeData/scorer.ts` (CLI: `npm run score-referee -- <labels.jsonl> [--dry-run]`) rules
every `test`-split label through a real referee (`createReferee` + `createRefereeTransport`) and
reports X of N per question, with every disagreement listed (`labelId`, `questionId`, `expected`,
`got`). A label with nothing to score (every expected answer `null`) is skipped, counted, never guessed.

```bash
# Build every request and send nothing -- no network, no lock, no model.
npm run score-referee -- data/referee/labels.jsonl --dry-run

# Live: goes through the same swapper/foreign-model guard as npm run checkpoint.
PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_MODEL=qwen3:14b \
  npm run score-referee -- data/referee/labels.jsonl
```

Live mode takes `/tmp/the-prisoner-one-driver.lock` (CLAUDE.md "One driver at a time, or the referee
is not deterministic") and refuses if another driver holds it; `--dry-run` never touches the lock or
the network.

### Reproducing §33.16

The exact command the-prisoner#10 asks be reported, against the current default referee and against
the model §33.16 itself measured:

```bash
# Current default referee (muse-glimmer:30b, per CLAUDE.md "Local play is all-Muse").
PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_MODEL=muse-glimmer:30b \
  npm run score-referee -- data/referee/labels.jsonl

# §33.16's own referee.
PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_MODEL=qwen3:14b \
  npm run score-referee -- data/referee/labels.jsonl
```

Both commands score the FULL 121-row file (both seed corpora); to reproduce only §33.16's own 26-row
result, filter `data/referee/labels.jsonl` to `id` starting `s33.16-` first (`jq 'select(.id |
startswith("s33.16-"))'` or equivalent) and score that file instead. Neither command has been run by
this task — the-prisoner#10's own scope excludes any live model call from the coding pass that ships
this file; the coordinating session runs it.

## Training

Not in scope for this task (the-prisoner#10's own "Not in scope": "Training or shipping any LoRA;
choosing a trainer"). Once a `train` split exists (this ships none — see "Scope" above; both seed
corpora are `test`), `npm run render-referee-data` produces the chat-messages JSONL most trainers
(Unsloth and similar) read directly.
