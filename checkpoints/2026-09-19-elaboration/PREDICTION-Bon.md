# Pre-committed before cell B-on ran (n=10)

Written 2026-09-19, **before the first call**, after seeing cell B (thinking OFF, fired 0/10) and a
single n=1 probe at thinking ON that fired 1/1. **This is post-hoc exploration, not part of §4.8's
pre-committed sweep**, and must never be pooled with cell B: it differs from it in exactly one arm,
`PRISONER_THINKING=on`. Code revision identical to B's (`afeada2`), same worktree, same everything else
(`PRISONER_WINDOW=welded`, `PRISONER_ELABORATE=property`, `PRISONER_INSTRUMENT=checked`,
`PRISONER_DOOR_PRICE=margin`, `PRISONER_ROUNDS=1`, `qwen3:14b`, `PRISONER_SKIP_VOICE=1`).

**What it is for.** §66.4 concluded that "the round-1 cells are structurally near-blind to this
mechanism." That conclusion was drawn entirely from thinking-OFF games. §4.8 chose OFF for the round-1
cells on §64.7's authority, but §64.7 measured *candidacy*, not *failure*, and P0 (§66.1) showed
thinking changes what she attempts. So the claim may be an artifact of the mind that was measured.

**Prediction: fired ≥ 6/10.** The mechanism, from the n=1: at OFF she picks an act that works (pry the
tile, bend the spoon); at ON she attacks the welded bar, which cannot work, and a failed ruling is the
trigger.

**Falsifier, named in advance: fired ≤ 2/10.** Then the n=1 was a fluke, cell B's 0/10 stands as a fact
about the trigger rather than about the mind, and §66.4 needs no amendment.

**Acquired: genuinely open, 0-3/10, and I expect the low end.** Acquisition needs `need: integrity` on
an object that does *not* already declare it and that the build table priced. The two firings seen so
far could not have acquired for structural reasons: on the welded bar `need` is correctly `none` ("It
does not move"), and on the lock the referee answered `integrity`, which the lock **already holds**, so
the never-twice guard refused. A high `fired` with a zero `acquired` would say the trigger is reachable
but the `need` question is spending itself on targets that cannot yield.

**Not predicted:** which object she attacks second, and whether any firing lands on the loose tile,
whose `(loose_tile, integrity)` = `trivial` is the one pair the whole design was aimed at.
