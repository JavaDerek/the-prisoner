# The human-shaped-intent corpus (D11, `docs/HUMAN-INTENTS-DESIGN.md` §7.1)

95 rows in `corpus.json`, machine-readable, this file is the readable index. Built by an agent for the
orchestrator's review; **no model call was made** to build it. The object/property text below (D5's
window/bar rewrite, D9's blanket/cot `concealment`) has since landed in `src/` byte-identical to what
was proposed here, and D6's elision clause landed as the game's default while D9's container clause was
measured and stays off -- see `PREDICTION.md`'s "The four open questions, resolved before any model
call" for the finalization pass that checked this against the live tree before any row here was run
against a model.

## Row counts by source

| source | rows | what it is | transcript to replay from |
|---|---|---|---|
| `game1` | 4 | first human game, 2026-09-18T02-40-27-834Z, prisoner seat, presence OFF, no posture | `checkpoints/2026-09-18T02-40-27-834Z.md` |
| `game2` | 3 | second human game, 2026-09-18T20-16-42-703Z, narrated view, presence modelled, derive wording SHARPENED | `checkpoints/2026-09-18T20-16-42-703Z.md` |
| `human-blind` | 7 | 2026-09-22T01-23-51-344Z, prisoner human vs Opus warden, thinking ON (this game predates §75.5's flip to OFF) | `checkpoints/2026-09-21-human-blind/2026-09-22T01-23-51-344Z.md` |
| `issue25` | 7 | the abandoned serial human game the-prisoner#25 itself reports; **no transcript survives** (D2's own gap) | none -- reconstructed from the issue's own narrative table |
| `watch` | 4 | constructed paraphrases of §4's audit's two "watch" rows (cot `crossbar`, bucket `wire handle`) | none -- not drawn from a recorded game |
| `batch7` | 70 | terse paraphrases of batch 7's own resolved intents (61 prisoner + 9 warden, capped at 70 per the brief) | `checkpoints/2026-09-25-phase1-b7/T/*.md` (7 games) |

**21 vs the design doc's own "~23":** the design doc's §7.1 table estimates row counts per source before
counting them (`~5` for `game2`, `~23` total for the four real-human sources). Counting the actual
transcripts: `game1` has exactly 4 prisoner turns, `game2` has exactly 3 (not ~5 -- the game ended in 3
rounds, escape), `human-blind` has exactly 7 matching the design doc's own quoted list (§1.3) -- the same
transcript actually has 10 prisoner turns; rounds 7-9 (`throw the floor tile as the door`,
`dig a tunnel out under the tile`, `do the hippy hippy shake`) are NOT included as their own corpus rows,
matching what §7.1's own row count and §1.3's own quoted list already implied, but they DO belong in the
replay sequence for `HB-r10` since they happened in between -- see that row's `stateNote`. `issue25` has
exactly 7 (the issue's own table). Total real-human rows: **21**, not ~23; the design doc's estimate was
close, not exact, and this file corrects it against the actual sources rather than silently keeping the
approximate number.

## Batch 7: which 61+9 were selected, and why not more

Batch 7 ran 7 games x 10 rounds x 2 chairs = 140 half-rounds. Of those, **61 prisoner and 69 warden
turns resolved** (`applicable: true` in the referee's own table) -- 130 combined, well above "~70." Per
the brief ("if there are more than ~70, take all resolved ones up to 70"): **all 61 resolved prisoner
turns** are included (the prisoner's phrasing is #25's own subject), plus the **first 9 resolved warden
turns** (game 1's own examine-bar/examine-lock cycle, in transcript order) to reach 70 -- a warden
population is included per the brief's "resolved prisoner OR warden intent," capped rather than sampled
across all 7 games, and stated plainly here so the selection is auditable rather than silent.

**The limit stated as asked:** every `batch7` and `watch` paraphrase is still not a person's. It is this
agent's best terse, method-first rewrite of either an already-terse model intent (batch 7) or a
constructed probe (watch rows) -- written without looking at the row's own recorded keys, but written by
the same kind of process (a language model) that produced the very intents #25 is about. Only the 21
real-human rows and the-prisoner#25's own 7 are actual person phrasing.

## Label counts (post-D5/D9, as pre-registered -- see `LABELS.md` for the class-by-class reasoning)

Batch 7's 70 paraphrase rows are pre-registered `correct` **except the 2 the replay harness caught as
silently inert in the ORIGINAL batch-7 data itself** (`B7-P05`, `B7-P56` -- see "A discovery..." below;
labelled `unmodelled`) -- 68 `correct`, 2 `unmodelled`. That is the null hypothesis Band 1 in
`PREDICTION.md` tests, not a claim that none of the 68 will actually misread. The 25 real-human + watch
rows, where the whole point is that some things genuinely have nowhere to land, are listed individually:

| label | count (of 25 non-batch7 rows) | rows |
|---|---|---|
| `correct` | 8 | `G1-r3`, `G1-r4`, `G2-r2`, `G2-r3`, `HB-r2`, `HB-r5`, `HB-r6`, `I25-4` |
| `misread` | 6 | `G1-r1`, `HB-r4`, `I25-1`, `I25-2`, `W-cot-1`, `W-cot-2` |
| `unmodelled` | 4 | `I25-3`, `I25-5`, `W-bucket-1`, `W-bucket-2` |
| `ambiguous` | 5 | `G1-r2`, `G2-r1`, `HB-r1`, `HB-r3`, `HB-r10` |
| `ambiguous on target and misread on effect` (compound, §7.2's own wording) | 2 | `I25-6`, `I25-7` |

Note `I25-2`'s label moved from §7.2's own pre-committed `unmodelled` (pre-D9 world) to `misread`
post-D9, because D9 lands `concealment` on the blanket itself -- see that row's
`labelReasoningPostD5D9` and `labelPreD5D9` in `corpus.json`, and `PREDICTION.md`'s open-question 2
about whether the referee-prompt ARM (as opposed to the object property) is actually on when this runs.

(Exact per-row labels and reasoning are in `corpus.json`'s `expectedLabelPostD5D9` /
`labelReasoningPostD5D9` fields and in `LABELS.md`; the table above is counted mechanically from
`corpus.json` and is the source of truth over any hand-summary.)

## A discovery made while building the replay harness, not while designing the corpus

Running `probe.mts --dry` (which replays every prior half-round of a row's own transcript through the
real `planEffect`/`resolver.resolve()`, never the model) surfaced that **2 of the 70 selected batch-7
rows were never real resolutions in the first place**: `2026-09-25T05-26-30-915Z.md` round 5 and
`2026-09-25T06-58-52-807Z.md` round 10 both name the intent's aim as making "cordage"/a "cord", and the
referee answered `target=blanket, effect=derive, product=cord` -- every citation verified, and batch 7
counted both among its "70 resolved" turns. But `cord`'s declared parent (`src/open/derivedObjects.ts`)
is the KIND `strip`, not `blanket` -- `cord` can only be derived from an already-derived strip, never
directly from the blanket -- so `planEffect`'s own "no invented world" check (`effects.ts`'s
`planDerive`) would have silently refused both, producing **no game effect at all** despite a ruling
that looked, and was counted, as a success. `B7-P05` and `B7-P56` are these two rows; both are labelled
`unmodelled` rather than the shape-group default `correct`, and their `corpus.json` entries carry
`inertOriginal: true`. This is not something D11's design doc anticipated and is reported here rather
than quietly corrected, because it means **the referee's own "70 resolved" denominator in batch 7, and
by extension anywhere else `derive` chains through a kind-of-a-kind parent, may already be inflated by
at least this shape** -- worth a look independent of this corpus's own purpose.

## What could not be recovered

- **`issue25`'s exact referee keys.** The abandoned game wrote no transcript (D2's own finding: "The
  2026-09-25 game left no file in `checkpoints/`"). This corpus's 7 `issue25` rows carry
  `recordedRulingConfidence: "reconstructed-from-issue-narrative"` and `recordedRuling: null` --
  the issue's own table gives outcomes in prose ("refused, target unread"), not the closed-key table
  every other source has. `expectedKeys` for these rows is this agent's own reconstruction from that
  prose, not a verbatim citation.
- **`issue25`'s intervening warden state.** The issue's table records only the prisoner's 7 turns. If
  the warden did anything consequential between them (wore the bar, opened anything), this corpus's
  round-1-default rebuild would not reflect it -- see each `issue25` row's `stateNote`.
- **A verified "correct" baseline for anything outside batch 7.** Only batch 7's originals were
  independently confirmed resolved-as-intended by the batch's own measurement; the real-human rows have
  no such baseline (that absence is the whole reason D11 exists).
