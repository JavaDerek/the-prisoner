# Pre-committed: do batch 6's GROUNDED rulings survive a serial replay? (2026-09-25, before any call)

`RESULTS.md` showed batch 6 ran two drivers against one llama-server and that the referee is not
deterministic under that load. That was measured on its 22 **refusals**. The other **255 rulings resolved**,
changed the world, and have never been re-read. This asks how many of them a serial referee rules the same
way.

## Design

Every entry in batch 6's committed `*.referee.json` that carries a `target` question and whose RECORDED
reply computes to `applicable: true` -- 255 expected. Each recorded request replayed byte-identically,
**one process, strictly sequential, nothing else against the server**, direct to `doris:11435`,
`muse-glimmer-30b-q4_k_m`, temperature 0, no `chat_template_kwargs` (the server's own `none` flag, which is
b6's wire). N=1. Scored through the real `computeRuling`.

The comparison is **serial replay vs b6's recorded ruling**, on `target/effect/property` and on
`applicable`. Measured at 33.1s mean per call on the 22-row refusal run, so ~2.3 h expected.

**An agreement rate is not a correctness rate.** A changed ruling is not automatically a corrected one --
two competent readings can differ, as `escalate-grounded.mts`'s own header says. This sizes the problem; it
does not judge the disagreements.

## Predictions

1. **PRIMARY.** **At least 80%** of the 255 return identical `target/effect/property` keys.

2. **THE ALARMING ONE.** **At most 5%** flip from `applicable: true` to `applicable: false` -- a ruling that
   moved the world in the batch becoming a refusal on replay. This is the one that would mean the batch's
   *events*, not just its refusals, are draws.

3. **SHAPE.** Among the rows that disagree, **at least half** involve a `reveal` effect or a `none` answer
   on target, effect or property -- i.e. the same borderline shapes the refusal run moved. If disagreement
   is spread uniformly across ordinary `wear`/`open` rulings instead, the instability is broader than
   "borderline cases" and the refusal work understated it.

4. **INSTRUMENT.** Median seconds per call falls between 25 and 45, matching the refusal run (31.6 median).
   Outside that band, something about the machine changed mid-run and the comparison is suspect.

## Stopping rule

If disagreement on keys exceeds **30%** across the first 100 scored rows, **stop and report**. At that rate
batch 6 is not salvageable by analysis and finishing the remaining 155 buys nothing.

## What the outcomes mean, written before the numbers exist

- **1 and 2 both hold** -> the concurrency bug is confined to borderline rulings. `RESULTS.md`'s refusal
  correction stands as the whole story, and b6's grounded results survive.
- **1 fails, 2 holds** -> the keys wander but the world still moves; b6's *narrative* is unstable while its
  event counts roughly stand.
- **2 fails** -> b6's events are draws. Its results file, and the strategy step's adherence numbers measured
  on the same concurrent harness, are all measuring a distribution rather than a reading.
