# the-prisoner#1 harm probe -- run 2 results (2026-09-28 08:46-09:45 UTC)

Run from `974a06c` (clean; `harm` implies `condition`), one driver, `muse-glimmer:30b`, card to this session alone.
78 rulings, 0 errors. `PREDICTION-2.md` committed in `974a06c` before the first call. Rows: `results-2.jsonl`.

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | arm ON: >=4 of 5 attacks rule warden/harm/condition | **5 of 5** | MET |
| 2 | <=1 of 8 controls change target/effect | 2 of 8 | DEAD |
| KILL-a | <=2 of 5 attacks land | 5 of 5 | not fired |
| KILL-b | >=2 of 8 controls change | 2 of 8 | **FIRED** |

**The fix worked, since every real attack now lands, but KILL-b fired, so `PRISONER_HARM` stays off**, per
PREDICTION-2's own rule. The two controls:
- **I25-7** "dig at the bars": its own OFF arm is split (1 open, 2 wear). This is the cold-cache instability
  PREDICTION-2 said would be reported, not the arm.
- **C-push-down** "push the warden down": OFF was wear/posture 3 of 3. ON was **wear/posture on sample 1, then
  `none/none` on samples 2 and 3**. This is the only real candidate regression: with `harm` on offer, the cached
  repeats of a shove lost their effect answer. It was not captured *by* harm. It fell to `none`.

## The reading PREDICTION-2 did not register, reported only

P6 found that on this runtime the first (cold) call of a request is the game-faithful one, since a game never repeats
a request, and that cached repeats can differ (`../2026-09-28-texture-replay/RESULTS.md`). Scored on **sample 1
alone**: attacks land 4 of 5 (HB-r1's sample 1 left the target unread), and controls change **1 of 8**, the I25-7
flip. Neither kill fires. **This is not a re-score.** The pre-registered majority rule stands, and so does the arm's
default of off.

## Decision left to the owner

Whether to turn `PRISONER_HARM` on:
- **Yes, on the sample-1 reading.** Attacks land, and the shove regression appears only in cached repeats.
- **No until a run-3 on the clause wording.** "pushing them down or hauling them up is not harm" may be what makes
  a shove read as nothing. The candidate is removing that half-sentence, measured with sample-1 scoring
  pre-registered.

## Scoreboard, run 2, verbatim

## the attack move -- harm vs. the ordinary vocabulary (the-prisoner#1)

| id | prediction | so far | projected at N | verdict |
|---|---|---|---|---|
| 1 | arm ON: at least 4 of 5 real attack intents rule warden/harm/condition (majority of N) | 5 of 5 | 5 of 5 | MET |
| 2 | at most 1 of 8 controls changes its target/effect between arms (majority of N each) | 2 of 8 | 2 of 8 | DEAD |
| KILL-a | arm ON: 2 or fewer of 5 attacks land warden/harm/condition kills (harm fails to separate itself) | 5 of 5 | 5 of 5 | MET |
| KILL-b | 2 or more of 8 controls change between arms kills (harm captures ordinary acts) | 2 of 8 | 2 of 8 | DEAD |
| r1 | arm OFF: how the same 5 attacks rule today (wear/posture per HUMAN-INTENTS-DESIGN.md §6.1, reported) | 3 of 5 | 3 of 5 | REPORT |

**DEAD AT THIS POLL: 2, KILL-b** -- announce it now and apply the stopping rule (the owner, 2026-09-21).

Per item and arm (target/effect/property, applicable in brackets, N samples):
- HB-r1 [off] 3/3: warden/wear/posture x3 [3]
- HB-r1 [on] 3/3: none/harm/condition x1 [0], warden/harm/condition x2 [2]
- HB-r3 [off] 3/3: warden/wear/posture x3 [3]
- HB-r3 [on] 3/3: warden/harm/condition x3 [3]
- HB-r10 [off] 3/3: warden/wear/posture x3 [3]
- HB-r10 [on] 3/3: warden/harm/condition x3 [3]
- I25-3 [off] 3/3: warden/noise/none x3 [3]
- I25-3 [on] 3/3: warden/harm/condition x3 [3]
- I25-5 [off] 3/3: warden/noise/none x3 [3]
- I25-5 [on] 3/3: warden/harm/condition x3 [3]
- G1-r1 [off] 3/3: prisoner/wear/posture x3 [3]  (expected to stay {"target":"prisoner","effect":"wear","property":"posture"})
- G1-r1 [on] 3/3: prisoner/wear/posture x3 [3]  (expected to stay {"target":"prisoner","effect":"wear","property":"posture"})
- I25-7 [off] 3/3: bar/open/integrity x1 [1], bar/wear/integrity x2 [2]  (expected to stay {"target":"bar","effect":"wear","property":"integrity"})
- I25-7 [on] 3/3: bar/wear/integrity x1 [1], bar/open/integrity x2 [2]  (expected to stay {"target":"bar","effect":"wear","property":"integrity"})
- C-push-down [off] 3/3: warden/wear/posture x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"posture"})
- C-push-down [on] 3/3: warden/wear/posture x1 [1], warden/none/none x2 [0]  (expected to stay {"target":"warden","effect":"wear","property":"posture"})
- C-cover-head [off] 3/3: warden/wear/sight x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"sight"})
- C-cover-head [on] 3/3: warden/wear/sight x3 [3]  (expected to stay {"target":"warden","effect":"wear","property":"sight"})
- C-take-keys [off] 3/3: key_ring/take/none x3 [3]  (expected to stay {"target":"key_ring","effect":"take"})
- C-take-keys [on] 3/3: key_ring/take/none x3 [3]  (expected to stay {"target":"key_ring","effect":"take"})
- C-search [off] 3/3: warden/expose/none x3 [3]  (expected to stay {"target":"warden","effect":"expose"})
- C-search [on] 3/3: warden/expose/none x3 [3]  (expected to stay {"target":"warden","effect":"expose"})
- C-examine [off] 3/3: warden/reveal/posture x3 [3]  (expected to stay {"target":"warden","effect":"reveal"})
- C-examine [on] 3/3: warden/reveal/posture x3 [3]  (expected to stay {"target":"warden","effect":"reveal"})
- C-call-out [off] 3/3: warden/noise/none x3 [3]  (expected to stay {"target":"warden","effect":"noise"})
- C-call-out [on] 3/3: warden/noise/none x3 [3]  (expected to stay {"target":"warden","effect":"noise"})
