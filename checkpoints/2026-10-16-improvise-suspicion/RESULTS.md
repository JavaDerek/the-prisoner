# PRISONER_IMPROVISE=suspicion -- the suspicion reading: results

Run 2026-10-16, `22:32:20Z` to `23:02:40Z` (one driver, serial, every call awaited), from commit `aaab1d1` (clean), which
pre-registered `PREDICTION.md` and `items.json` unchanged. Model `muse-glimmer:30b` on doris's Ollama, thinking `off`,
temperature 0; `/api/ps` at start `['muse-glimmer:30b']` and the per-call guard never fired. Arms: presence `modelled`,
absence `cadence`, everything else at its default (`results.jsonl` meta line). 0 errored samples. The prompt was not
touched. Raw rows: `results.jsonl` (every phase-G ruling with its trace and HTTP bodies; every phase-R reading and
confirmation with its request, reply content, citation and verification, tier, amount and suspicion before/after).
Log: `logs/run-2026-10-16T22-32-20-763Z.txt`.

## Scoreboard

| id | prediction | so far (after pass 1 / 2) | predicted | final | verdict |
|---|---|---|---|---|---|
| 1 | exact-key agreement, reading vs label (>= 36 of 60) | 16 of 20 / 32 of 40 | 38 of 60 | **48 of 60** | MET |
| 2 | direction agreement, none vs any rise (>= 48 of 60) | 20 of 20 / 40 of 40 | 50 of 60 | **60 of 60** | MET |
| 3 | imperceptible setups never asked (9 of 9) | 3 of 3 / 6 of 6 | 9 of 9 | **9 of 9** | MET (see caveat) |
| KILL-a | exact below 30 of 60 | -- | -- | 48 | not fired |
| KILL-b | any I16-I20 read serious/outrage by majority | 0 / 0 | 0 | **0 of 5** | not fired |
| r1 | reach: perceivable items the real main referee rules onto a null path | 3 of 13 seen at the first look | guessed 9 of 20 | **7 of 20** (only **3** with the gate open) | reported |
| r2 | effective exact (what the game ruled) | | | 48 of 60 | reported |
| r3 | effective direction | | | 60 of 60 | reported |

No prediction died at any poll. All three predictions beat their bands; the reach guess was too high.

## Confusion (reading's own answer; rows = label), 20 perceivable items x 3

| label \ read | none | minor | serious | outrage |
|---|---|---|---|---|
| none (8) | **24** | 0 | 0 | 0 |
| minor (4) | 0 | **6** | 6 | 0 |
| serious (6) | 0 | 3 | **12** | 3 |
| outrage (2) | 0 | 0 | 0 | **6** |

Every miss is one tier off; none crosses the none / rise line.

## The finding that matters most: the reading is rarely reached (phase G)

Phase G ruled each intent once through the real loop with the real main referee. **13 of the 20 perceivable acts are
ruled `noise`** -- applicable, with a plan -- so they take neither null path and are never offered to the reading.
`noise` is not suspicion-eligible on the success path either (and an act targeting the warden is excluded from it), so
**in today's game these acts move suspicion by nothing at all, with the arm on or off**. That includes both
outrage-labelled acts ("I tell the warden I will kill him the moment he turns his back", "I shout at the warden that I
will be out of this cell before morning"), shouting every insult, spitting at him, mocking him and the screaming fit.

| reached a null path, gate open (the reading was asked in-game) | P07 smear (`none/none/visible`), P10 stare (`warden/none/visible`), P12 guard shift (`warden/reveal`, no plan) |
|---|---|
| reached, gate closed by the referee's `silent` | P14 rest, I16 decide to escape, I17 daughter, I18 silent plan |
| ruled `noise`, never offered | P01-P06, P08, P09, P11, P13, P15, I19, I20 (and all four G items) |

So the 13 non-reaching items were scored in phase R on a **counterfactual** (their own G ruling with target and effect
set to `none`, i.e. what the loop does had the referee ruled them onto nothing). The reading numbers above are what the
reading would do if offered; the effective change to the game's suspicion across all 24 items, as wired today, is
+5 on three items (P07, P10, P12) and nothing else.

Caveat on prediction 3: the real referee ruled G21-G24 `noise` too, so in-game the perceive gate was never reached for
them; the 9 of 9 is the gate measured on the counterfactual (it closes on presence for G21/G22 and on sight 0 for G23,
with no model call, in 0.1-0.2 s). G24 ("too low to carry") was ruled `noise/silent`, the expected `silent`.

## Disagreements, by the layer that would fix them

| item | label | read (3/3) | layer | note |
|---|---|---|---|---|
| P02 mock, mimicking his voice and walk | minor | serious | **label / reading prompt** | "petty insult" (minor) and "deliberate provocation" (serious) both fit mimicry; the tier text overlaps. I would accept serious. |
| P10 stare without blinking | minor | serious | **reading prompt** | "an odd gesture" vs "testing him"; a long fixed stare read as intimidation. Defensible, but it is the one miss that moved suspicion in-game (+5 rather than +2). |
| P06 staged screaming fit, thrashing | serious | outrage, **confirmed 3/3** | **label** (flagged "outrage defensible" before the run) / reading prompt | "a violent outburst" is outrage's own example and the fit matches it word for word. The confirmation did not catch it: same model, same tier wording, so it is not independent on a definition question. |
| P11 pace, counting steps, glancing at the door | serious | minor | **reading prompt** | the only under-read: "preparing something" was not applied to visible casing of the exit. Harmless direction (+2 not +5). |

None is a perceive-gate or tier-cap issue: every ruled amount was the tier's cap (2 / 5 / 10, suspicion started at 0),
every resolution succeeded, the engine refused nothing.

What it got right that the probe was built to catch: **all five inner-state and self-claim items read `none`, 15 of
15**, including "I quietly decide to escape tonight" and "I silently plan how to get the key ring off the warden's belt"
(the word-trap items), and both self-claims cited "I tell the warden" and ruled none. In-game the inner states are
doubly protected: the main referee rules them `silent`, so the gate closes before the reading is asked.

## Confirmation behaviour

9 confirmation calls (P06, P08, P09, each pass); **9 of 9 confirmed outrage**, all citations verified. Two of the three
confirmed items are labelled outrage; P06 is the third (above). The confirmation never disagreed with the first reading,
so in this sample it added cost (median 7.9 s) and no filtering. It is a check against a reading that wanders, not
against a tier definition both calls share.

## Stability

**20 of 20 perceivable items gave the same answer on all 3 passes** (pass-major order, so repeats were never adjacent).
The only run-to-run variation was a citation: I18 cited "silently" on pass 1 and an empty quote (unverified) on passes 2
and 3 -- answer `none` every time, so nothing changed. Shep shared the card throughout; no instability was seen that would
need it as an explanation.

## Latency

- Suspicion reading: 60 calls, **median 9.2 s** (min 5.3 s, max 18.3 s).
- Outrage confirmation: 9 calls, median 7.9 s.
- For scale, the main referee on the same card: 48 calls (the six-question ruling plus the one-act call), median 19.2 s
  per call, median 45.7 s per prisoner half-round. Under the arm a reached act adds about 9 s, an outrage about 17 s.

## Recommendation

**Adopt the reading as is; rethink where it is wired before the arm can do its job.** The reading is good enough to move
a capped value: direction 60 of 60, exact 48 of 60, every miss one tier, deterministic, and it does not judge thoughts.
No prompt change is needed for adoption. The two optional prompt edits below are tier-boundary polish, and they should
be measured in a later probe, not applied on this evidence.

The problem is reach. As wired (`loop.ts` `improviseUnlisted`, on the two null paths only), the arm never sees the acts
it exists for: talk, shouting, threats and spitting are ruled `noise` and fall through with no suspicion at all.
Candidate fix, not built: also offer a prisoner's applicable `noise` act (any target, gate unchanged) to the reading
when the success path charged it nothing. Then re-run this probe's phase G with that wiring (same items.json) so reach
is measured on the real referee, not on a counterfactual. That is a design call for the owner (it widens the arm from
"acts no listed mechanic covers" to "acts no listed mechanic charges"), which is why it is a recommendation only.

Optional prompt polish for a later probe:

1. Under minor, name mockery and staring explicitly ("a petty insult, mockery, a long stare") and keep "deliberate
   provocation" for acts aimed at provoking a reaction (spitting, shouting abuse) -- P02 and P10.
2. Under outrage, make the outburst one aimed at a person ("violence toward him"), so a staged fit stays serious -- P06,
   if the owner agrees with the label. Under serious, add "visibly sizing up the door or the cell" -- P11.

The confirmation question shares the tier definition, so it will keep agreeing with the reading on borderline items. If
it is meant to filter more than mistakes, it needs a different criterion (for example: "does the act state or show harm
to him or leaving the cell?"), not the same one asked again.
