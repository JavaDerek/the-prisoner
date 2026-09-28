# P7 -- results (2026-09-28 06:43-07:08 UTC, `c2118e8` clean, `--omit=prisoner:2`, one driver, Shep quiet)

40 rulings (20 half-rounds of the owner's 2026-09-28 game, each in both orders, one block per arm), 0 errors.

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | intent-last takes at least 20% off the median ruling time | 14.3% (31.3 s -> 26.8 s) | DEAD |
| KILL | less than 10% off | 14.3% | not fired |
| HOLD | rulings identical in both orders on all 20 | **10 of 20 differ** | **FIRED** |

**The order is held**, as PREDICTION.md said it would be on any difference. It saves real time, but it is not free:
Muse reads a request with the intent last differently. Six of the ten differences are magnitude only
(moderate <-> slight). Four prisoner rows change their **target** from `window` to `bar` on an `open` (r4, r5, r6,
r9), which is the §19 part/way-out pair and resolves through the same mechanic, but it is a different reading all
the same. Per the pre-registered rule, a request order is a batch boundary and is not adopted.

For #35: the referee side of the wait can lose about 14% only by accepting different rulings. The warden's
side (`checkpoints/2026-09-28-warden-wits-time/RESULTS.md`) is hidden reasoning. Neither is a free saving on this
model; the floor is model choice.
