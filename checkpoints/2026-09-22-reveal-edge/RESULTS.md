# Results: the reveal-property sentence names edge (2026-09-22, overnight)

Prediction: `PREDICTION.md`, committed before any call. Instrument: `build.mts` (requests from `buildOpenWorld`,
warden's seat, presence modelled, batch 1's arms) and `replay.mts`, referee `qwen3:14b` on doris, thinking ON,
N = 5 per intent per arm. Logs `BASE.log`, `VARIANT.log`; per-reply tallies in `results-*.json`.

| intent | expect | BASE | VARIANT |
|---|---|---|---|
| FIX #15 spoon edge/rim/bowl for sharpening | spoon/reveal/edge | edge 4, integrity 1 | edge 5 |
| FIX #19 spoon edge/bowl/handle for sharpening | spoon/reveal/edge | edge 4, integrity 1 | edge 5 |
| FIX #35 spoon worn-flat side for sharpening | spoon/reveal/edge | edge 4, integrity 1 | edge 5 |
| FIX #43 spoon worn-flat edge, then confiscate | spoon/reveal/edge | edge 5 | edge 5 |
| CTRL bar, mortar, filing marks | bar/reveal/integrity | 5/5 | 5/5 |
| CTRL bar base, tool marks | bar/reveal/integrity | 5/5 | 5/5 |
| CTRL lock, scratch marks | lock/reveal/integrity | 5/5 | 5/5 |
| CTRL tile hollow | loose_tile/reveal/concealment | 5/5 | 5/5 |
| CTRL scrape mortar | bar/wear/integrity | 5/5 | 5/5 |
| CTRL sharpen spoon on cot (record only) | -- | cot/wear/integrity 4, cot/noise/integrity 1 | cot/wear/integrity 4, cot/none/none 1 |

**Scoreboard.** 1 (baseline reproduces the batch's integrity) **DEAD**: integrity 3 of 20, where the batch keyed it
4 of 4. 2 (variant keys edge) **held**, 20 of 20. 3 (no control moves) **held**: every control's majority is
identical in both arms.

**Ship rule met, evidence weak.** By the pre-committed rule the variant ships. What it shows is 3 of 20 wrong to
0 of 20 wrong -- a direction, not a proof. The instrument did not reproduce the batch's own rate, and I could not
explain why: the four recorded batch requests were checked byte-identical to the built ones (all six questions,
answer keys and every source), and the batch's reply took ~10 s, the same as these, so thinking was on in both.
The live batch ran two game drivers plus the §5.0 probe against the same resident model through the router; this
ran alone and direct. Recorded as open, not explained.

Doris left as found (`qwen3:14b` resident).
