# P6 -- R7's texture and the window line, replayed: predictions

**DRAFT -- not pre-registered until committed unchanged before the first call, by the owner.** Scaffolded
2026-09-27 against the tree at `ac47293`. D9 (`6995117`) landed with this replay PENDING -- the design's landing
order had it gate D9, and the build spec landed D9 first and left P6 to be run. No model has been called:
`probe.mts --dry-run --with-at-band` rebuilt all 34 contexts (0 replay divergences) and built 136 requests.

## What is asked

D9 changed two texts the referee cites: the bar's `integrity` now reads three bands (at or below 70: "Bright metal
shows through the rust where it meets the mortar."; 55: "The mortar at its foot has crumbled away in places."; 40:
"It shifts in its socket."), appended to `desc:bar`; and the window's open line became "It stands open now: the bar
is out, and the gap is wide enough to climb through." (was "...the bar is out of its widest gap."). A reading that
moves when a description grows is a scenario change's known risk (§27, §76). P6 asks whether any ruling moved.

## Items and arms (N = 3 per item per arm, serial, one driver)

Each item is ruled twice on its own rebuilt context (`../2026-09-28-probe-kit/kit.mts`):

- **`pre-D9`**: the perceived descriptions as they read before `6995117` -- the band sentence removed from the end
  of the bar's description and the window's open line put back. Literal edits of this repository's own two
  strings, the D9 ones read from `scenarioObjects.ts`, so the probe cannot test stale text.
- **`D9`**: the descriptions as the game builds them today.

| group | items | context |
|---|---|---|
| R7's D11 rows | `bar-open` B7-P33, P36, P61; `bar-wear` B7-P31; `window-open` B7-P26, P28, P29; `warden-bar-reveal` B7-W01, W04, W06, W07, W09 | each row's own batch-7 game, rebuilt |
| §33.7's nine climb-outs | D1 r7, r8, r9; D2 r10; D3 r19-r23 (OPEN-VARIANT §33.4's batch D) | each game's own context, rebuilt: the window stands open in all nine |
| this game's round 10 | "climb out through the window" | the playtest, rebuilt: the window stands open |

## Predictions (the design's numbers, verbatim)

1. **0 of those rows change their `target` or `effect`.**
2. **At most 2 change `property`** (and not target or effect).
- **Kill: 3 or more change target or effect** -- the bands are reworded. D9 has already landed, so the kill now
  means **reword or revert D9** (a dated scenario commit), not "hold it back".

An item's keys are the majority (2 or 3 of 3) of its samples in an arm; an arm with no majority counts as a
change (reported separately, r1). Reported: the climb-outs ruled `leave` under D9 (§33.7 had 9 of 9 with the old
line).

## What the scaffolding found, and decided

- **Ten of the twelve D11 rows cannot move.** On their own rebuilt contexts the bar is above 70 (or the row never
  sees the window open), so D9 adds nothing and both arms send byte-identical requests: B7-P61, P31, P26, P28, P29
  and all five `warden-bar-reveal` rows. Only B7-P33 and B7-P36 see a band. Prediction 1 is therefore about 12
  requests that differ (2 D11 rows, 9 climbs, round 10), not 22; the 10 identical pairs are still run (they measure
  serial reproducibility, which OPEN-VARIANT §75 says is exact for one driver).
- **The scaffolding adds, reported only, `--with-at-band`**: the same twelve D11 texts ruled where the bar reads its
  40 band -- this game's round 9, prisoner or warden context by the row's chair, window shut. **Decision for the
  owner (one question): pre-register the at-band rows under predictions 1 and 2?** Recommended: yes, as separate
  numbers (0 change target or effect; at most 2 change property) -- they are the only rows where the design's named
  phrasings meet the bands at all. *Yes*: add `--with-at-band` to the command and copy the two numbers here as 1b
  and 2b. *No*: they stay unrun, and prediction 1 is read over the 12 differing requests.
- **The climb contexts are the batch-D games' own**, rebuilt at today's defaults: 0 divergences; the recorded
  property quote for their earlier window turns is no longer in `desc:window` (the line changed) and is cited as the
  whole description, recorded as a replay warning, never hidden.
- **This game's history**: round 10's context and the at-band rows follow P2's PREDICTION decision on
  `--omit=prisoner:2`; pass the same flag here.

## Stopping rules

- Three errored samples in a row stop the run (rerun resumes).
- The KILL is announced at the poll it fires; the run finishes (every item's pair is the evidence for the reword).
- A second driver, or Shep's traffic, is named in RESULTS.

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected, DEAD/OPEN; a dead number announced at the poll it dies.
For the KILL row, DEAD means the kill fired.

## What the outcomes mean, written before any call

- **1 and 2 hold** -- D9's texts are safe for the referee; P6 closes and D9's "PENDING" notes in
  `scenarioObjects.ts` can say so (a later commit, not this probe's).
- **2 fails, 1 holds** -- the bands pull the property question (likely toward `integrity` on the bar); read which
  rows before rewording anything.
- **KILL** -- a band or the new window line moves what the referee thinks an act IS; reword the offending text, or
  revert D9's line, in a dated scenario commit, and rerun P6.
