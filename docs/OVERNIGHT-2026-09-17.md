# Overnight 2026-09-16 → 2026-09-17: morning report

Written for: Derek, reading it first thing. Updated as the night goes; the newest state of each item is
what's below. Evidence lives in `checkpoints/2026-09-17-overnight/` and in OPEN-VARIANT.md §34 onward.

## Status at a glance

| Item | State |
|---|---|
| 1. §5.3 on a fixed batch (≥4 games, model warden, qwen3:14b referee) + a passive game | running (batch F) |
| 2. Condition list as a generic mechanism, A/B in real games | code built behind a switch (`1c1bb58`); pre-game controls next |
| 3. mother-of-invention produces a measured change | not started |
| 4. Libraries released and consumed | nothing needed yet |

## Log

- 20:19 CDT. doris empty. Pushed the-prisoner's two pending commits (`abd04f1`, `c5b0d83`). 628 tests green.
- 20:20. First launch of batch F died at round 1: my driver script left out `PRISONER_THINK_TIMEOUT_MS`,
  so every call hit the package's 12 s default and went silent. Killed within a minute, before it wrote a
  transcript (nothing to commit), unloaded the `qwen3:14b` it had loaded, relaunched with batch E's 180 s
  timeouts at 20:21.
- 20:40. `1c1bb58`: condition list code (item 2). The running batch executes `tsx` from the working tree,
  so games 2-4 of batch F run this commit. With the switch unset, all four prompt paths are byte-identical
  to the commit before (dumped and compared), so the baseline is unchanged; the only difference is one
  extra "Conditions: OFF" line in the transcript header.

## Decisions for Derek

(filled in as they come up)

## Versions published

None yet.
