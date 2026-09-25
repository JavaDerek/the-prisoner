# Results: the grounded replay and the capture rate (2026-09-25)

Predictions: `PREDICTION-3.md` and `PREDICTION-4.md`, both committed before their first call.
Serial, one process, `muse-glimmer-30b-q4_k_m`, temperature 0, direct to `doris:11435`, server's own
`reasoning_strength: none` flag (what ships).

## PREDICTION-3, the 255 grounded rulings

| band | bar | result | |
|---|---|---|---|
| 1 primary | >=80% identical keys | **220/255 = 86.3%** | HELD |
| 2 alarming | <=5% become refused | **6/255 = 2.4%** | HELD |
| 3 shape | >=50% of disagreements are `reveal`/`none` | 11/35 = 31% | **FAILED** |
| 4 instrument | median 25-45s | 28.9s | HELD |

**Band 2 holding is the result that matters: b6's events are real.** 97.6% of the rulings that moved the
world would move it again.

**Band 3 failed, as called at 113 rows.** Its pre-written meaning was "the instability is broader than
borderline cases". That stands, with a post-hoc qualifier: of the 35 disagreements, **12 are cosmetic** --
`bar`<->`window` with `open` on both sides, which `effects.ts` normalises to the same mechanic, the same
resource and the same gate by design -- and **23 are substantive**. So the rate that changes the world is
**23/255 = 9.0%**, not 13.7%. The cosmetic/substantive split was not pre-registered and is labelled here as
post-hoc.

## PREDICTION-4, the capture rate (the matrix's bottom row)

| band | bar | result | |
|---|---|---|---|
| 1 primary | <=8 escape-route captures of 29 | **1/29** | HELD |
| 2 tier-1 ceiling | <=15 resolve at all | 11/29 | HELD |
| 3 control (kill) | >=3/4 OBJECT intents land | **4/4** | HELD |
| 4 determinism | repeat 6/6 | 6/6 | HELD |

**SS68.5's alarming number does not transfer.** `qwen3:14b` at thinking off captured **19 of 29**; Muse-Glimmer
run serially captures **1 of 29** -- the same as qwen3 at thinking ON, at none of the cost.

**And the one capture is harmless.** *"is the door locked?"* read `door/reveal/passage`. SS68.5's game-ending
case was the same intent read `door/`**`open`**`/passage` against an ungated door. A reveal looks; an open
ends the game. It meets the pre-registered tier-2 definition and is counted, but its harm is nil.

**A correction to the denominator.** The committed labels distinguish: `BODY` expects target `prisoner` and
`SPEECH` expects `warden`/`none` -- those 11 are legitimately resolvable, not invalid. Only `QUESTION`,
`WAIT`, `META` and `STAGE` (18 rows) expect `none`. Against the true invalids: **16 of 18 correctly refused**,
2 resolved (the door reveal, and "count to one hundred" as a noise), **0 fabricated a world-changing act**.
SS68.5's 19/29 uses the broad denominator, so 1/29 is the comparable figure; 18 is the better matrix input.

By group: `META` 0/4 resolved, `STAGE` 0/5, `WAIT` 1/4, `QUESTION` 1/5. `BODY` 4/6 as `prisoner/wear/posture`
and `SPEECH` 5/5 as a noise -- both correct under SS68.3.

## The confusion matrix, measured

Sensitivity 255/263 = **97.0%**; specificity 16/18 = **88.9%**. At a 50/50 mix:

| | resolves | refuses |
|---|---|---|
| **valid (50)** | TP **48** | FN **2** |
| **invalid (50)** | FP **6** | TN **44** |

Precision **90%**. Counting only *harmful* false positives -- a non-action fabricated into a world-changing
act -- FP is **0 of 18 measured**, and precision approaches 100%.

Caveats: specificity rests on 18 rows of one kind of invalid (names no object). It says nothing about an
intent naming an instrument that does not exist (issue #17) or an effect an object does not declare. Those
are stage 2's A/B/C design and remain unmeasured.

## A note on the rebuilt request set

`capture-requests-rebuilt.json` here is the 33 capture requests built against **today's** world, and is
what PREDICTION-4's numbers were measured on. `checkpoints/2026-09-20-capture/D-SWEEP.json` is left at
its own 2026-09-20 build: `build-default.mts` writes to that path, so the run overwrote it and it was
restored. Results are not rewritten in this repository, including the inputs a result was measured on.
