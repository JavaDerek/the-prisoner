# Batch 6 scoreboard -- 2026-09-25T04:11:14.943Z

Arm P (prose seat): **7 of 10** games. Arm S (schema seat): **7 of 10**.

## Per arm, so far

| | arm P (prose) | arm S (schema) |
|---|---|---|
| games | 7 | 7 |
| prisoner intents (incl. refused) | 70 | 68 |
| prisoner silences | 1 | 2 |
| grounded (pooled) | 134 | 121 |
| refusals, BOTH chairs (ruled impossible) | 5 | 17 |
| novel RULINGS (the transcript's own line) | 49 | 42 |
| **distinct novel PAIRS (pooled) -- 6a** | 8 | 9 |
| **distinct novel pairs, blanket dropped -- 6b** | 8 | 9 |
| blanket-targeted turns | 0 | 0 |
| games targeting blanket | 0 | 0 |
| intents at the 600-char cap | 0 | 0 |
| distinct effect kinds (pooled) | 8 | 8 |
| distinct targets / game (mean) | 4.29 | 3.14 |
| **final barIntegrity (mean)** | 95.43 | 83.86 |
| **games with bar damaged (<100)** | 4 | 4 |
| **prisoner refusals** (= turns with no keys) | 2 of 70 (2.9%) | 10 of 68 (14.7%) |
| warden refusals (remainder) | 3 | 7 |
| repeat rate (any re-use of a pair) | 41.4% | 50.0% |
| distinct targets rounds 1-5 vs 6-10 (7b) | 6 vs 9 | 6 vs 7 |
| re-try rate | 1.4% | 0.0% |
| median game minutes | 20 | 22 |

Reported and NOT predicted on (batch 4: they cannot separate arms at N=10):
escapes P 0 / S 0; catches P 0 / S 0.

## Pre-committed predictions

| prediction | so far | projected at 10 | verdict |
|---|---|---|---|
| 1. P silences at most 8 of ~100 | 1 of 7 games | 1.4 | open |
| 1. S silences at most 3 of ~100 | 2 of 7 games | 2.9 | open |
| 2. P intents at cap, 1 to 25 | 0 of 7 games | 0.0 | open |
| 2. S intents at cap = 0 | 0 of 7 games | 0.0 | open |
| 5. P games with bar damaged, at least 4 | 4 of 7 games | 5.7 | held |
| 5. S games with bar damaged, at most 2 | 4 of 7 games | 5.7 | **DEAD** |
| 6a. P distinct novel pairs at least 6 | 8 of 7 games | -- | held |
| 6a. S distinct novel pairs at most 5 | 9 of 7 games | -- | **DEAD** |
| 6b. P games targeting blanket, at least 3 | 0 of 7 games | 0.0 | open |
| 6b. S games targeting blanket, at most 1 | 0 of 7 games | 0.0 | open |
| 9. new unbuilt classes at most 3 (pooled) | 0 of 14 games | 0.0 | open |

Predictions 3, 4, 7, 8 and 10 are ratios or bands over the finished arms and are read from the
per-arm table above; they are scored in RESULTS.md, not called dead mid-batch.

Prediction 5 power note, pre-committed: at 4-vs-0 this is suggestive, NOT significant.
Only a split of 5 or more against 0 is a result at this N (Fisher exact, 5v0 -> p~0.033).
