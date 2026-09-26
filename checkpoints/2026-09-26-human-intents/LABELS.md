# Labels, pre-registered before any run (D11, HUMAN-INTENTS-DESIGN.md §7.2)

Every row in `corpus.json` carries, before any model call:

- `expectedKeys` -- what `target`/`effect`/`property` (as applicable) a correct ruling would answer,
  read from `src/open/referee.ts`'s `buildQuestions` (the five closed-key questions) and
  `src/open/effects.ts` (`EFFECT_KINDS`, `PROPERTY_KEYS`, `PERSON_PROPERTY_KEYS`) /
  `src/open/scenarioObjects.ts` (per-object declared properties) as they stand at the time this file was
  written.
- `expectedLabelPostD5D9` / `labelReasoningPostD5D9` -- the §7.2 four-way class
  (**correct** / **misread** / **unmodelled** / **ambiguous**) that would apply if the live ruling
  differs from `expectedKeys`, against the world **after** D5 (window text loses the plural "bars") and
  D9 (blanket and cot gain `concealment`) land.
- `labelDiffersPreD5D9` / `labelPreD5D9` / `labelReasoningPreD5D9` -- set only on the rows where the
  pre-D5/D9 world would have labelled the same divergence differently. Only `I25-1` and `I25-2` differ:
  see below.

**"Post-D5/D9" means the object/text changes only, not the referee-prompt arms.** D9's own design
(§6.2) is explicit that the property change and the reading arm are separate: *"It is a prompt arm as
well as a mechanic... Prediction first, same discipline as D6."* This file's `expectedLabelPostD5D9`
assumes the PROPERTY exists (the mechanic) and does **not** assume the arm that would make the referee
actually reach for it (D6/D9's target-question clause) is switched on. `PREDICTION.md`'s open question 2
says this again for the orchestrator, because it changes what `I25-1`/`I25-2` actually measure.

## The four labels, as this corpus applies them

| label | meaning (§7.2, verbatim) | how this corpus decides it |
|---|---|---|
| **correct** | keys match the label | the row's `expectedKeys` names an object/effect/property that is unambiguously the single best reading of the tested intent's own words, against text currently in `scenarioObjects.ts`/`effects.ts` |
| **misread** | keys differ and the label is expressible in today's vocabulary against today's text | the correct answer already has a home (a declared property, a legal answer key, a citable word), and a wrong ruling would be the referee's own miss, not a missing feature |
| **unmodelled** | the label itself has no key or no declared property to land on | the actor's plain aim has nowhere to go even in principle -- no property, no legal effect, or (the bucket rows' subtler case) a legal-looking route that a downstream check silently refuses |
| **ambiguous** | both the ruled keys and the label are literally supported by the cited text | two readings are each defensible from the object/effect vocabulary as it stands (the `wear`/`derive` instability, the `bar`/`window` fold, the missing-injury-vocabulary stretch onto `posture`) -- a divergence here is not evidence the referee erred |

## Batch 7's 70 rows: labelled by shape, not individually

61 prisoner + 9 warden paraphrases fall into 17 recurring **shapes** (same target/effect/property triple
in the original, resolved correctly by batch 7's own referee). Writing 70 bespoke essays would bury the
17 actual judgment calls under repetition, so each shape gets one reasoning block in `corpus.json`'s
`labelReasoningPostD5D9` (copied verbatim onto every row of that shape, referenced by `shapeGroup`), and
this table indexes them:

| `shapeGroup` | recorded keys | rows | expected label | one-line why |
|---|---|---|---|---|
| `wool-derive` | `blanket/derive/integrity` | 20 | correct (18) / **unmodelled (2)** | thread/strip/blanket all named in the paraphrase's own words -- EXCEPT `B7-P05`/`B7-P56`, whose original ruling named `product=cord`, a kind derivable only from `strip`, never directly from `blanket`; `planEffect` would silently refuse both (see CORPUS.md's "A discovery..." section), so these two are labelled `unmodelled`, overriding the shape's own default |
| `blanket-wear` | `blanket/wear/integrity` | 1 | correct | same object/property; wear vs derive is a genuine close call already resolved once each way in this same batch |
| `strip-conceal` | `strip(_N)/conceal/concealment` | 9 | correct | "the strip"/"the tile" both kept explicit; a miss naming the tile instead is `ambiguous`, not wrong |
| `door-reveal` | `door/reveal/passage` | 8 | correct | "the gap"/"the bolt" are the door's own words |
| `tile-reveal` | `loose_tile/reveal/concealment` | 2 | correct | "the tile" explicit, `reveal` is the only sense of "lift and feel" |
| `posture-wear` | `prisoner/wear/posture` | 4 | correct | compliance cues ("hands visible", "sit down") kept in the paraphrase |
| `window-open` | `window/open/passage` | 3 | correct | the effect question's own clause covers scraping with no way-out word |
| `bar-open` | `bar/open/integrity` | 3 | correct | same as `window-open`; this pair is SS75.3's own cosmetic fold |
| `bar-wear` | `bar/wear/integrity` | 1 | correct | method word only, no stated aim -- D7's own finding, flagged as the row most likely to flip to `misread` if the referee reaches for `open` instead |
| `spoon-conceal` | `spoon/conceal/concealment` | 6 | correct | "under the tile" explicit; miss naming `loose_tile` is `ambiguous` |
| `spoon-take` | `spoon/take/none` | 1 | correct | unambiguous |
| `key-noise` | `key_ring/noise/none` | 1 | correct | reaching toward, not taking |
| `key-take` | `key_ring/take/none` | 1 | correct | "steal" explicit |
| `noise-none` | `none/noise/none` | 1 | correct | spoken line, no object -- OPUS-FIRST §3.2's own fix |
| `warden-noise` | `warden/noise/none` | 1 | correct | line addressed to him by name |
| `warden-bar-reveal` | `bar/reveal/integrity` | 5 | correct | "the bar" explicit; door/lock fold does not apply to `reveal` |
| `warden-lock-reveal` | `lock/reveal/integrity` | 4 | correct | "the lock" explicit, not folded with `door` for `reveal` |

(17 groups, 70 rows -- counts above sum to 70.) **68 of 70 rows' pre-registered label is `correct`; 2
(`B7-P05`, `B7-P56`) are `unmodelled`** because the replay harness itself found their ORIGINAL rulings
silently inert (see CORPUS.md). `correct` is Band 1's null hypothesis for the other 68, not a claim that
none will misread in practice -- scoring the actual run against this table is the whole point of the
batch.

## The 25 non-batch-7 rows, individually

| id | tested | expected keys | label (post-D5/D9) | differs pre-D5/D9? |
|---|---|---|---|---|
| `G1-r1` | drop to the ground and pretend to be having a heart attack | `prisoner/wear/posture` | misread | no (posture existed at authoring time; this row is about the referee, not the world) |
| `G1-r2` | pull a wire out of the cot | `cot/wear-or-derive/integrity` | ambiguous | no |
| `G1-r3` | pick the lock using the wire | `lock/open/passage` | correct | no |
| `G1-r4` | leave the cell through the door | `door/leave/passage` | correct | no |
| `G2-r1` | pull a wire out of the cot | `cot/wear-or-derive/integrity` | ambiguous | no |
| `G2-r2` | use the wire to pick the lock on the door | `lock/open/passage` | correct | no |
| `G2-r3` | leave | `door/leave/passage` | correct | no |
| `HB-r1` | attack warden croft | `warden/wear/posture` | ambiguous | no |
| `HB-r2` | open the door and leave | `door/open/passage` | correct | no |
| `HB-r3` | stab the warden with the spoon | `warden/wear/posture` | ambiguous | no |
| `HB-r4` | dig an escape tunnel out of the cell with the spoon | `spoon/wear/edge` (aim unmodelled) | misread | no |
| `HB-r5` | take a wire out of the cot | `cot/derive/integrity` | correct | no |
| `HB-r6` | use the wire to pick the lock | `lock/open/passage` | correct | no |
| `HB-r10` | hit the warden with the meal tray, steal the key ring, open the door and leave | `warden/wear/posture` (first act only) | ambiguous | no |
| `I25-1` | hide under the blanket | `prisoner/conceal/?` -> becomes expressible via `blanket` | misread | **yes** -- pre-D9: unmodelled (SS7.2 verbatim) |
| `I25-2` | hide the prisoner under the blanket | `blanket/conceal/concealment` | misread | **yes** -- pre-D9: unmodelled (SS7.2 verbatim) |
| `I25-3` | throw the spoon at the warden | `warden/noise/none` (no injury key) | unmodelled | no |
| `I25-4` | take the dinner tray | `meal_tray/take/none` | correct | no |
| `I25-5` | throw the spoon at the warden | `warden/noise/none` | unmodelled | no |
| `I25-6` | use the spoon to dig at the bars | `bar-or-window/wear-or-open/integrity` | ambiguous on target, misread on effect | no (D5 removes the plural that CAUSED the original miss, but does not change what the correct answer is; D7a's mechanics fix is what actually changes this row's outcome) |
| `I25-7` | dig at the bars with the spoon | same | ambiguous on target, misread on effect | no |
| `W-cot-1` | pry at the crossbar | `cot/wear/integrity` | misread | no |
| `W-cot-2` | work the crossbar loose | `cot/wear-or-derive/integrity` | misread | no |
| `W-bucket-1` | pull the wire handle off the bucket | (no property; downstream refusal even if `ruling.applicable` is true) | unmodelled | no |
| `W-bucket-2` | twist the bucket's wire handle free | same | unmodelled | no |

Full reasoning for each row is in `corpus.json`'s `labelReasoningPostD5D9` (and `labelReasoningPreD5D9`
for the two that differ) -- this table is the index, not the argument.
