# Pre-registered bands for the human-shaped-intent corpus (2026-09-26)

Finalized against the tree at `d912c80` (post-D5, post-D9-mechanics, post-D6-arm-landing,
post-D9-container-clause-measured-off, post-D7a). Written originally as a draft per
`docs/HUMAN-INTENTS-DESIGN.md` D11, before §76/§77 landed; every bar number and the four open
questions below are now resolved against the tree AS IT STANDS, not against the design doc's proposed
text. No model call has been made yet under this finalized file -- `probe.mts` has been run in `--dry`
mode only (build the request, never call the transport), confirming all 95 rows still rebuild against
the live scenario text.

## What is being asked

§75.4 measured the shipped referee at **97.0% sensitivity / 88.9% specificity**, entirely on intents a
model wrote after reading the referee's own answer keys. the-prisoner#25 showed that population is not
what a person types: batch 7's own 70 prisoner intents attacking the bar are 8/8 `bar` and 0/70 `bars`,
long and physically explicit; a person typed `dig at the bars with the spoon` -- terse, plural, using
the WINDOW's word for the BAR's object -- and 6 of 7 resolved turns in the one serial human game were
misread or had nowhere to land. §7.2's four-way label (correct/misread/unmodelled/ambiguous) exists so a
confusion matrix does not send every one of those six turns to "the referee is wrong," when only some of
them are.

This corpus (`corpus.json`, 95 rows) has three populations that answer different questions and are
**never pooled into one number**:

1. **70 batch-7 paraphrases** (`source: "batch7"`) -- the direct analog of §75.4's sensitivity
   measurement: each row's `originalIntent` was ALREADY resolved correctly by the shipped referee
   (batch 7's own recorded ruling, `recordedRuling`), and `intentTested` is a terse, method-first,
   person-style paraphrase of the identical act, written without looking at the recorded keys. This is
   the only population with a clean "should still match" baseline, and it is what the primary band below
   is scored against.
2. **25 real human intents** (`game1`, `game2`, `human-blind`, `issue25`) -- no baseline to match
   against; these are the new evidence itself, in the same sense the-prisoner#25's own 7 rows were.
   Reported as label counts, not a pass/fail band.
3. **4 constructed watch-row probes** (`source: "watch"`) -- `docs/HUMAN-INTENTS-DESIGN.md` §4's audit
   named `cot`'s "crossbar" and `bucket`'s "wire handle" as **watch**, not **load-bearing**: nobody has
   measured whether a small referee actually takes the substring bait. Reported as a capture count out
   of 4, the same shape as §75.4's own tier-2 "escape-route capture" measure, not a sensitivity band.

**Denominator note:** the replay harness itself (not the design) found 2 of the 70 selected rows'
ORIGINAL rulings were silently inert (`B7-P05`, `B7-P56` -- a `derive` naming `product=cord` off a
target the world can't actually make `cord` from; see `CORPUS.md`). Those two are pre-registered
`unmodelled`, not `correct`, so the "should still match" pool this band is really about is **68 of 70**;
the two inert rows stay in the 70-row denominator below (they are still real rows a live referee will
rule on) but are excluded from what counts as a `correct`-vs-`misread` divergence.

| | bar | why |
|---|---|---|
| **primary** | **>= 87.0%** of 70 paraphrases rule `correct`-or-pre-registered-label (61 or more: 68 possible `correct` at 90% retention, plus the 2 pre-registered `unmodelled`) | 10 points below §75.4's 97.0%, the same margin §75.4 itself used against §68.5's `qwen3:14b` number when the population changed. A terser, structurally identical population moving the number at all is the finding; moving it by more than 10 points is the alarming version. |
| **kill** | **misread rows above 10% of the 70 paraphrases** (8 or more) | Per §7.2: only `misread` counts against the referee itself. `unmodelled` and `ambiguous` rows are content/world gaps this measurement is not testing (D5/D6/D7/D9 are), and the 2 pre-registered-`unmodelled` rows are EXPECTED to land there, not counted as a referee failure if they do. If misread alone clears 10%, the referee's READING is what moved, not the population's shape, and D3/D6/D7's arms -- not this corpus -- are the next step. |
| **secondary** | `ambiguous` rows **<= 15%** (10 or fewer) | `LABELS.md`'s own pre-registration expects most `wear`-vs-`derive` and `bar`-vs-`window` disagreements to be genuinely ambiguous by SS75.3's own cosmetic-fold finding, not misreads. If ambiguous rows run far above this, the label scheme itself (not the referee) needs revisiting before the primary band means anything. |

**What the outcomes mean, written before any call:**

- **Band 1 holds, kill does not fire** -> the referee's own reading survives terser, person-shaped
  phrasing about as well as it survives model phrasing; #25's finding is content and prompt text (D5-D9),
  not the referee's closed-key machinery, and the fixes already scheduled ahead of D11 in §9's landing
  order are sufficient without a new reading arm.
- **Kill fires (misread > 10%)** -> the referee itself reads worse against terse, method-first phrasing
  even when the object, effect and property are all in principle expressible -- a genuinely new finding
  that would justify D6/D7b-style reading arms beyond what D3-D9 already schedule, and the orchestrator
  should treat this corpus's own `shapeGroup` breakdown (in `LABELS.md`) as the first place to look for
  which SHAPE of act the misreads cluster on.
- **Band 1 fails but kill does not fire (unmodelled/ambiguous absorb the drop)** -> confirms #25's own
  thesis exactly: the population differs, but the failure is downstream of the referee (world/content),
  which is what D5-D9 already target. No new reading work is implied.

## Band 2 (secondary, reported not gated): the 25 real human intents

No baseline exists for these rows (there is no "already resolved correctly" version of an abandoned
game or a first serial human game to diff against), so this band is **descriptive, not pass/fail**:
report the count in each of the four labels, split by source (`game1`/`game2`/`human-blind`/`issue25`),
and flag by name any row whose `expectedLabelPostD5D9` is `correct` or `ambiguous` but whose live ruling
comes back `unmodelled`-shaped (applicable=false with no expressible property) -- that combination would
mean a NEW gap D5-D9 does not already cover, which is the one result from this band worth interrupting
the batch for.

One condition recorded per row already, per §7.3: `outcomeWordingCondition` is `pre-D1` for every row in
this corpus (every source predates D1's "You set about..." framing), which the design doc itself flags
as a population condition, not a defect -- D1 teaches the player the game's verbs, and a corpus typed
under D1 would read closer to the model's own than this one does.

## Band 3 (secondary, reported not gated): the 4 watch-row captures

Report as a raw count out of 4 (matching §75.4's own tier-2 capture-count style), split by object
(`cot`/`bucket`). **Not a kill and not a pass** at N=4 -- SS4's own audit called both rows "watch," not
"load-bearing," precisely because nobody had measured them yet. A capture here (target=`bar` for the
cot rows, or a silently-inert `derive`/`wire` ruling for the bucket rows -- see each row's
`labelReasoningPostD5D9` in `corpus.json` for the exact mechanism) is the finding this band exists to
surface, to be weighed by the orchestrator, not scored against a pre-committed bar this small a sample
cannot support.

## The four open questions, resolved before any model call (2026-09-26, finalization pass)

1. **D5/D9's landing state, checked against `src/open/scenarioObjects.ts` as it stands at `d912c80`.**
   The window's text (`"A small window set in the wall at shoulder height, a little wider than a
   person's shoulders. One rusted iron bar, set into the mortar across its middle, closes it: with that
   bar gone, a person could climb through."`) and the bar's own lead-in are **byte-identical** to
   HUMAN-INTENTS-DESIGN.md §4's proposed text, per OPEN-VARIANT.md §76's own write-up. The blanket and
   cot each carry `concealment` (0/100, 20/50/100 wear-restore, non-empty `readRanges` both bands),
   also byte-identical to §6.2/§76's proposed shape. **No row's `expectedLabelPostD5D9` changes.**
   Checked by hand against all 9 flagged rows (`G1-r1`, `I25-1`, `I25-2`, `I25-6`, `I25-7`, `W-cot-1`,
   `W-cot-2`, `W-bucket-1`, `W-bucket-2`): every one of their `labelReasoningPostD5D9` blocks already
   describes the mechanism now actually in `src/`, not a hypothetical.
2. **The D6/D9 referee-prompt arms, at their actual default as of `d912c80`.** OPEN-VARIANT.md §77
   (`checkpoints/2026-09-26-arms/RESULTS.md`): **D6 (elision) LANDS, `PRISONER_ELISION` defaults to
   `on`. D9's container clause stays OFF, `PRISONER_CONTAINER_CLAUSE` defaults to `off`.** This run
   uses both at their shipped default (D6 on, container clause off) -- the actual config a real game
   gets today, never a hand-picked arm. Consequence for the two flagged rows: §77's own measured C1 row
   ("hide under the blanket") under the D6-only arm (elision on, container clause off -- **exactly this
   run's configuration**) still reads `prisoner/conceal/none`, unchanged from OFF -- the elision clause
   only redirects a BARE elided act ("hide", "hide myself") onto the actor; it does not redirect an act
   that already names a container ("under the blanket") anywhere, because the existing "never the place
   it is hidden in" clause already claims that noun first. So **`I25-1` and `I25-2` are unaffected by
   D6 being on**: both still have nowhere to land on the container (the container clause that would
   send them there is off), and both stay `misread` exactly as pre-registered -- the object property
   exists (D9's mechanic), the arm that would let the referee reach for it does not. Confirmed, not
   changed.
3. **The wear-vs-derive ambiguity (`G1-r2`, `G2-r1`) is scored against today's DEFAULT (baseline) derive
   wording.** `probe.mts` now passes `deriveWording: readDeriveWordingMode(process.env.
   PRISONER_DERIVE_WORDING)` explicitly (previously implicit via the bare constructor default, which
   happens to be the same value, `"baseline"`, but was not being asserted) -- this run sets no env
   override, so it is `baseline`, matching every row's own pre-registered reasoning.
4. **`B7-P05`/`B7-P56`'s inert-original discovery stays outside this corpus's scope, recorded as its own
   item, not chased here.** Both rows keep their pre-registered `unmodelled` label regardless of what
   the live ruling returns (§7.2: their ORIGINAL rulings were never real resolutions, so there is no
   "correct" baseline to test a paraphrase against) and are excluded from the 68-row correct/misread
   pool exactly as this file already specified. Whether batch 7's own "70 resolved" count needs
   correcting elsewhere, and whether any other kind-of-a-kind derive chain (`cord`-from-`strip`,
   `hook`-from-`wire` are the only two declared today) has the same silent-refusal shape, is a separate
   audit this checkpoint does not run -- flagged here, in `CORPUS.md`, and again in `RESULTS.md`, so it
   is not lost between the three files.

**Instrument fidelity, fixed at finalization.** `probe.mts`'s `buildRequestFor` previously called
`createReferee` with no `elisionMode`/`containerClauseMode`/`instrumentMode`/`deriveWording`, which
falls back to `createReferee`'s own BARE constructor defaults (`elisionMode: "off"`) rather than the
GAME's own env-reader defaults (`readElisionMode(undefined)` = `"on"`) -- exactly the
`prisoner-measurement-fidelity` failure mode named in root CLAUDE.md ("a copied harness (wrong
instrument mode)"). Fixed: `probe.mts` now imports `readElisionMode`, `readContainerClauseMode`,
`readInstrumentMode`, `readDeriveWordingMode` from `referee.js` and passes each explicitly, reading the
same env vars `checkpoint.ts` reads (all unset for this run, so all four are at their shipped default:
elision on, container clause off, instrument off, derive wording baseline). `oneAct` stays explicit
`"off"`, matching `checkpoints/2026-09-26-arms/probe.mts`'s own precedent for a targeted referee probe
(a second reader call this measurement does not also need to prove, and no row's label depends on the
one-act flag).
