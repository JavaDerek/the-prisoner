# The prose-seat lab, 2026-09-24 -- what a prompt can and cannot buy

Round 1 of the open scenario, the prisoner's seat, N asks of the identical prompt, scored by
`probe.mts` (committed here, so a later run is comparable rather than remembered). Raw per-ask JSON
beside this file. Nothing here played a game: **every number is a single turn, asked repeatedly.**

## The corrections this file exists to make

**`1496183`'s commit message is wrong and this supersedes it.** It claims the owner's
output-discipline block took `ancient-awakening:12b` from 45% to 80% usable intents. Those two
numbers came from two DIFFERENT PROMPTS: 45% was the game's own scene with the seat's weak
instructions, 80% was the owner's entire hand-written prompt -- his scene layout, his conditions, his
block. Measured properly, the game's scene WITH the block scores **38%** (n=60), which is
indistinguishable from the 45% it was supposed to beat. The block is not what bought the 80%.

**What did:** the scene rendering. Same model, same block, same exemplar, n=60 each:

| prompt | clean | approaches | entropy | parrot |
|---|---|---|---|---|
| the game's scene (`renderSeatSituation`) | 22/60 (38%) | 9 | 2.22 b | 2/60 |
| **the owner's scene** | **51/60 (85%)** | **12** | 2.55 b | 1/60 |

**A 47-point gap from the scene rendering alone**, and the owner's 9-in-10 reproduced at triple the
sample. The motive is NOT the cause: both prompts carry the same motive line, verbatim.

## What the block's two halves actually do, and for which model

Both halves, each half alone, and neither. 20 asks per cell, the game's scene throughout.

| model | block | clean | approaches | entropy | parrot |
|---|---|---|---|---|---|
| AA | neither | 9/20 | 8 | 2.60 b | 0/20 |
| AA | rules only | 15/20 | 6 | 2.26 b | 0/20 |
| AA | exemplars only | **7/20** | 6 | 1.72 b | **4/20** |
| AA | both | 16/20 | 8 | 2.52 b | 1/20 |
| Muse | neither | 20/20 | **3** | **0.99 b** | 0/20 |
| Muse | rules only | 20/20 | 4 | 1.02 b | 0/20 |
| Muse | **exemplars only** | 20/20 | **7** | **2.51 b** | 0/20 |
| Muse | both | 20/20 | 6 | 1.94 b | 0/20 |

**The two models want opposite halves.** For AA the named rules carry the compliance (45% -> 75%) and
the exemplars ALONE are its worst cell on every measure. For Muse the exemplars carry the approach
spread (0.99 -> 2.51 bits) and the rules do nothing at all. Only "both" is good for both models, which
is what ships. Shipping "exemplars only" off Muse's numbers -- which was proposed in this session --
would have been a regression for AA.

**Parroting is not a constant.** An intent that reproduces the worked example is a lost turn. It runs
at 4/20 when the exemplar stands alone, 1/20 with the named rules beside it, and 0/60 when the example
points at an object no win condition names. One AA reply reproduced the BAD example, wrote
"Correction:", and then reproduced the GOOD one -- it did the exercise instead of playing the turn.

## The exemplar's target: the owner's idea, measured

Identical prompt, identical rules, only the GOOD example's target moved -- from the rusted bar to
pulling a thread off the blanket, which no win condition names. n=60 per cell:

| exemplar target | clean | approaches | entropy | parrot |
|---|---|---|---|---|
| the bar (on the escape route) | 22/60 | 9 | 2.22 b | 2/60 |
| **the blanket's thread** | **29/60** | **12** | **2.62 b** | **0/60** |

Better on all four. **Shipped.** Muse never parroted under either, so the reliable model pays nothing
for it.

## Third person: half the gap for one model, nothing for the other

The game's scene states its rules about the prisoner in the THIRD person -- "Mara Voss can open the
window", "Whenever Mara Voss audibly or visibly damages" -- and third-person self-reference is AA's
most frequent failure. Changing only the pronouns, no fact or threshold touched:

| AA, n=60 | clean | entropy |
|---|---|---|
| the game's scene | 38% | 2.22 b |
| the same, second person | **60%** | **2.86 b** |
| the same, second person MINUS the four warden-side conditions | 50% | 2.39 b |

| Muse, n=40 | clean | approaches | entropy |
|---|---|---|---|
| third person | 40/40 | 8 | 1.67 b |
| second person | 40/40 | 7 | 1.78 b |

**Second person recovers 22 of the 47 points for AA and does nothing measurable for Muse** (0.11 bits
apart, one approach fewer -- noise). So this is an AA finding, and it does **not** justify changing
`renderSeatSituation`, which every model in every seat reads. No code change was made.

**And the warden-side conditions earn their place**: removing the four `CONDITION (for Warden Croft)`
clauses -- ~900 characters about how she gets caught -- cost AA 10 points and 0.47 bits. The prisoner
plays better knowing how the warden catches her. That kills the second hypothesis for the remaining
gap, which stays **unattributed**. Roughly 25 of the 47 points are unexplained.

## What entropy is, and is not

`approaches` and `entropy` count distinct tool->target pairs. That is **diversification**, not
innovation: every object a mind can name is one the prompt already lists, because the referee can only
ground an act on an authored object. Menu use is the game, not a failure of it (the owner's point,
2026-09-24). Entropy cannot tell "tried the tile instead of the bar" from "turned the cot into a
lockpick". The measure for the second is the transcripts' own **novel (object, effect) pairs with no
closed-variant equivalent**, and it only exists once games run.

A crude repurposing count was run for contrast and did not move with entropy: Muse's exemplars-only
cell doubled its entropy while its repurposing hits stayed at 6/20, five of them "picked up the bucket
or tray". AA is the only model showing a different KIND of reach -- wire out of the cot frame, a
spoon reshaped, fingernails and a toe as tools, the blanket as an abrasive -- at 9/20, on one scene,
by regex. A hint, not a finding.
