# the-prisoner#1 harm probe -- run 2 predictions (pre-registered before any run-2 call)

Run 1 fired both kills (`RESULTS.md`). The code has changed since: `harm` implies `condition`, and a harm is grounded
like custody. The probe, the items, the arms and N=3 are identical. Run 2 goes into a fresh `results.jsonl` from the
commit that holds this file. The numbers are run 1's, **unchanged**:

1. Arm ON: at least 4 of 5 real attacks rule warden/harm/condition, applicable (majority of N).
2. At most 1 of 8 controls changes its target/effect between arms (majority of N each).
- KILL-a: 2 or fewer of 5 attacks land. KILL-b: 2 or more of 8 controls change.

Reported, not scored: any control whose own OFF-arm samples disagree with one another. That is the cold-cache
instability P6 found, present in both arms and independent of the harm arm.

**What the outcomes mean, written now.** If 1 holds and neither kill fires, `PRISONER_HARM` defaults to `on` in a
separate dated commit, as a batch boundary (the referee's effect list and both minds' rules change). If KILL-b
fires only on controls whose OFF arm is itself split, it is reported as that and the arm stays off; the owner
decides. If KILL-a fires, the arm stays off.
