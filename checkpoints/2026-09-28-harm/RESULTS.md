# the-prisoner#1 harm probe -- run 1 results (2026-09-28 07:08-08:03 UTC)

Run from `e07890d` (clean), one driver, `muse-glimmer:30b`, card to this session alone. 78 rulings, 0 errors. Rows:
`results-1.jsonl`; log: `logs/run-1-2026-09-28.txt`; the scoreboard, verbatim, is below.

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | arm ON: >=4 of 5 attacks rule warden/harm/condition | 2 of 5 | DEAD |
| 2 | <=1 of 8 controls change target/effect | 2 of 8 | DEAD |
| KILL-a | <=2 of 5 attacks land | 2 of 5 | **FIRED** |
| KILL-b | >=2 of 8 controls change | 2 of 8 | **FIRED** |

**Both kills fired, so `PRISONER_HARM` stays off**, as pre-registered.

## Why, read from the rows (not re-scored)

- **The effect question worked on every attack.** With the arm on, all 5 real attacks were ruled `effect: harm` on
  the warden, in every sample. The failure was the **property** answer: 3 of 5 attacks (HB-r3 2 of 3, I25-3,
  I25-5 all 3) answered `property: none`. That made each ruling inapplicable, because `harm` required a declared
  property. `harm` has only one property, so this is a contract defect rather than a reading one.
- **No control was captured by `harm`.** The two controls that "changed" did so without `harm` in either arm:
  - I25-7 ("dig at the bars"): the known wear/open flip. Its own OFF arm was split 1 open to 2 wear.
  - C-take-keys: OFF was `none/take` 2 of 3 against `key_ring/take` 1 of 3; ON was `key_ring/take` 3 of 3.
  Both are the instability P6 documented (`../2026-09-28-texture-replay/RESULTS.md`), not the arm.

## What followed

The fix is structural: the effect key `harm` now implies property `condition` (a closed key from a closed key, never
prose), and a harm is grounded the way custody is, by target and effect cited from the intent. Test-first, in
`harm.test.ts`, including a planted violation. `PREDICTION-2.md` was committed before run 2.

## Scoreboard, run 1, verbatim

## the attack move -- harm vs. the ordinary vocabulary (the-prisoner#1)

| id | prediction | so far | projected at N | verdict |
|---|---|---|---|---|
| 1 | arm ON: at least 4 of 5 real attack intents rule warden/harm/condition (majority of N) | 2 of 5 | 2 of 5 | DEAD |
| 2 | at most 1 of 8 controls changes its target/effect between arms (majority of N each) | 2 of 8 | 2 of 8 | DEAD |
| KILL-a | arm ON: 2 or fewer of 5 attacks land warden/harm/condition kills (harm fails to separate itself) | 2 of 5 | 2 of 5 | DEAD |
| KILL-b | 2 or more of 8 controls change between arms kills (harm captures ordinary acts) | 2 of 8 | 2 of 8 | DEAD |
| r1 | arm OFF: how the same 5 attacks rule today (wear/posture per HUMAN-INTENTS-DESIGN.md §6.1, reported) | 3 of 5 | 3 of 5 | REPORT |

**DEAD AT THIS POLL: 1, 2, KILL-a, KILL-b** -- announce it now and apply the stopping rule (the owner, 2026-09-21).

Per item and arm (target/effect/property, applicable in brackets, N samples):
- HB-r1 [off] 3/3: warden/wear/posture x3 [3]
- HB-r1 [on] 3/3: warden/harm/condition x3 [3]
- HB-r3 [off] 3/3: warden/wear/posture x3 [3]
- HB-r3 [on] 3/3: warden/harm/condition x1 [1], warden/harm/none x2 [0]
- HB-r10 [off] 3/3: warden/wear/posture x3 [3]
- HB-r10 [on] 3/3: warden/harm/condition x3 [3]
- I25-3 [off] 3/3: warden/noise/none x3 [3]
- I25-3 [on] 3/3: warden/harm/none x3 [0]
- I25-5 [off] 3/3: warden/noise/none x3 [3]
- I25-5 [on] 3/3: warden/harm/none x3 [0]
- G1-r1 [off] 3/3: prisoner/wear/posture x3 [3]  (expected to stay {"target":"prisoner","effect":"wear","property":"posture"})
- G1-r1 [on] 3/3: prisoner/wear/posture x3 [3]  (expected to stay {"target":"prisoner","effect":"wear","property":"posture"})
- I25-7 [off] 3/3: window/open/passage x1 [1], bar/wear/integrity x2 [2]  (expected to stay {"target":"bar","effect":"wear","property":"integrity"})
- I25-7 [on] 3/3: bar/wear/integrity x1 [1], bar/open/integrity x2 [2]  (expected to stay {"target":"bar","effect":"wear","property":"integrity"})
- C-push-down [off] 3/3: warden/wear/posture x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"posture"})
- C-push-down [on] 3/3: warden/wear/posture x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"posture"})
- C-cover-head [off] 3/3: warden/wear/sight x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"sight"})
- C-cover-head [on] 3/3: warden/wear/sight x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"sight"})
- C-take-keys [off] 3/3: key_ring/take/none x1 [1], none/take/none x2 [0]  (expected to stay {"target":"key_ring","effect":"take"})
- C-take-keys [on] 3/3: key_ring/take/none x3 [3]  (expected to stay {"target":"key_ring","effect":"take"})
- C-search [off] 3/3: warden/expose/none x3 [3]  (expected to stay {"target":"warden","effect":"expose"})
- C-search [on] 3/3: warden/expose/none x3 [3]  (expected to stay {"target":"warden","effect":"expose"})
- C-examine [off] 3/3: warden/reveal/posture x3 [3]  (expected to stay {"target":"warden","effect":"reveal"})
- C-examine [on] 3/3: warden/reveal/posture x3 [3]  (expected to stay {"target":"warden","effect":"reveal"})
- C-call-out [off] 3/3: warden/noise/none x3 [3]  (expected to stay {"target":"warden","effect":"noise"})
- C-call-out [on] 3/3: warden/noise/none x3 [3]  (expected to stay {"target":"warden","effect":"noise"})
