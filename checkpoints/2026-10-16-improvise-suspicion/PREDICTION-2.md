# Addendum: noise routed to the reading -- predictions

**Pre-registered 2026-10-16, before any model call for this addendum.** Code under test: commit `3033712` (on top of
`b9e06a9`), which under `PRISONER_IMPROVISE=suspicion` also offers a prisoner's act ruled `noise` to the suspicion
reading when nothing else charged suspicion for it that half-round -- same perceive gate, same 2 / 5 / 10 tiers, same
outrage confirmation, raise only. The reading's questions are byte-identical to the first run's. **Same `items.json`,
no relabelling, no prompt change.**

## Instrument

`probe.mts --live --phase=g2`: each of the 24 items **once**, through the real `runOpenGame` loop, with the REAL main
referee (as in phase G) and the REAL improviser (as `checkpoint.ts` builds it) -- so whether an act reaches the reading
is decided by real rulings and the reading is asked in-game, with no stand-in or counterfactual anywhere. Same setups
(present / absent / blind), same in-memory database, same model and guard, one driver, serial. N = 1 per item: the main
referee is about 45 s a half-round on this card, and the first run found the reading identical on all 3 passes for all
20 items, so repeats buy nothing here and cost 30 minutes each.

## Predictions

The prediction follows from phase G's real rulings (the main referee's request is unchanged by `3033712`, at temperature 0):
13 perceivable acts were ruled `noise` and audible/visible (P01-P06, P08, P09, P11, P13, P15, I19, I20) and now reach the
reading; 3 already reached it (P07, P10, P12); 4 are ruled `silent` (P14, I16, I17, I18) and must still not.

- **A1 -- reach: 16 of the 20 perceivable acts are asked in-game; holds at >= 14.**
- **A2 -- exact agreement on the acts asked: 12 of 16 predicted** (the first run's misses P02, P06, P10, P11 repeat);
  **holds at >= 11** (of however many are asked).
- **A3 -- direction agreement on the acts asked: 16 of 16 predicted; holds at >= 15.** P13 (hum), P15 (greeting), I19 and
  I20 (self-claims) are the four none-labelled acts that now reach it -- a rise on any of them is the new risk the
  routing creates: ordinary talk is now read.
- **A4 -- G21-G24 never asked, 4 of 4.** G21/G22 (warden away) and G23 (blind) were ruled `noise` in phase G, so they
  are now offered and the gate itself must close (this time on real rulings, not the counterfactual). G24 was ruled
  `noise/silent` and must close on perceptibility.
- Reported: which acts do not reach it and why (the ruling that kept them out), confirmations, latency, and whether any
  phase-G ruling changed (it should not; if one does, that is the referee's determinism, reported as such).

## Stopping rule

As in PREDICTION.md: the prompt is not changed; the run stops at once if `/api/ps` ever shows anything but
`muse-glimmer:30b` alone, or after three errors in a row (resumable). A dead prediction is announced at the poll it dies
(a scoreboard is logged every 8 items) and in RESULTS.md; the pass still finishes (it is one pass, and the per-item record
is owed), and is never extended, re-run or re-scored to rescue a number.

---
**Not run (2026-10-16).** The owner stopped this phase before it ran: it used a local referee, and the NPC work
moved to proving the pattern on generic puzzles first, in a separate game-independent repository (see
`docs/NPC-MINDS.md`). No results exist for this prediction.
