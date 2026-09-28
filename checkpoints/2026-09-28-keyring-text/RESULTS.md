# the-prisoner#31 key ring text replay -- results (2026-09-28 06:15-06:31 UTC)

Run from `7662a4b` (clean, the #31 branch before merge), one driver, `muse-glimmer:30b` on doris's patched Ollama,
the card given to this session alone. 24 rulings, 0 errors. `PREDICTION.md` was committed in that same commit
before the first call. The log is `logs/run-2026-09-28-keyring.txt` (a copy of the runner's log).

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | rows whose target or effect changes: 0 | 1 of 4 | **DEAD** |
| 2 | rows whose property (only) changes: at most 2 | 0 of 4 | MET |
| KILL | 3 or more rows change target or effect | 1 of 4 | **not fired** |

Per item, old -> new (majority of 3):
- T28-r7 "grab the warden's keys": key_ring/take -> key_ring/take (old sample 1 was `none/take`, inapplicable)
- G27-r3 "take the warden's keys while he's stuck under the blanket": key_ring/take -> key_ring/take
- **B7-P14** (the D11 corpus's take on the key ring): **blanket/none, inapplicable (3 of 3)** -> **key_ring/take
  (2 of 3; sample 1 blanket/conceal)**
- B7-P27 (the corpus's take on the spoon): spoon/take -> spoon/take

## Reading

The kill did not fire, so **the holder-by-code change lands**. The one row that moved moved *toward* its pre-registered
expected keys (`key_ring/take`): under the old text the referee could not place the act on the key ring at all. That
is consistent with a description that located the ring "on Croft's belt" while the context said otherwise, though
N=3 cannot show the cause. Prediction 1 is dead as scored and reported as such. The change it records is a
correction.

The same cold-first-call pattern P6 found shows up here as well. In both cells that disagree internally (old T28-r7,
new B7-P14), sample 1 is the odd one out (`checkpoints/2026-09-28-texture-replay/RESULTS.md`).

Numbering note: this directory's PREDICTION.md and probe.mts say "OPEN-VARIANT.md §81"; the section landed as **§88** when the branch was merged, after §81-§87 had been taken the same night. Both files are left as they were run.
