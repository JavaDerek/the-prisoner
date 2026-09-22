# Results: the separate one-act call, second version (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. N = 3, thinking ON, timeout 120 s. `S.log`, `results-S.json`.

| set | chains `several` | single acts `one` |
|---|---|---|
| HOLDOUT (22, written after the first result) | **8/8** | plain 4/4; with a preparatory step **7/10** |
| EARLIER (the first version's 27) | 8/8 | 13/16 ONE, 2/3 HIDE |

Misses (all `several` 3/3): walk over to the window, take hold of the bar and twist it; pick up the bucket and bang
it; sit on the cot and tuck the spoon into the hem; grip the bar, brace my feet and wrench it (was `one` in the first
version); kneel, lift the tile and examine the hollow; slip the spoon under the tile and press it flat; scoop the grit
out and keep it (was `one` in the first version). Zero timeouts; 6.4 s per call.

**Scoreboard.** 1 held, 8 of 8. 2 **DEAD**: 7 of 10 with a preparatory step (needed 9); plain single acts 4 of 4.
3 (secondary) chains 8/8 held, single acts 15/19 missed its 17. **Does not ship.**

**Reading.** The preparation clause did not move the reading and cost two acts the first version read correctly:
`qwen3:14b` asked this question alone counts the physical steps in the sentence. Across both separate-call versions,
chains are caught 16 of 16 with no loop, which is the part that works; separating a real second act from getting
ready is the part no wording tried here achieves. Per the pre-registered rule the decision returns to the owner, with
option B (flag rather than refuse) as the fallback.
