# P1 -- results (2026-09-28 07:59-08:46 UTC, `c2118e8` clean, one driver, card to this session alone)

42 rulings (14 items x N=3), each with its one-act call and a third call on every cut, 0 errors.

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | compounds rule the first act after truncation: 3 of 3 | 2 of 3 | DEAD |
| 2 | controls flagged `several` AND ruling changed: at most 1 of 11 | 1 of 11 | MET |
| KILL | 3 or more controls changed | 1 of 11 | not fired |
| STOP | 2 or more compounds' truncated ruling inapplicable | 0 of 3 | not fired |

**D7 (`PRISONER_ONE_ACT=first`) stands.** All three compounds were cut at their second act and their first act was
ruled. The one miss is G27-P8, "Pull the bar out of the window and leave". It was cut correctly to "Pull the bar out
of the window" and ruled `bar/open` (2 of 3) where the prediction named `window/open`. That is the §19 part/way-out
pair: an `open` on the bar resolves through the window, the same mechanic. Scored as written, it is a miss.
Mechanically, the first act was attempted.

The one changed control, B7-P48, is another instance of P6's cold-first-call pattern (sample 1 `strip/wear`,
samples 2-3 `strip/none`). r2: 7 of 11 controls drew a `several` flag. Every one was harmless, because a cut whose
first act is inapplicable leaves the full ruling standing (R5's design), so a false flag costs nothing.

## Scoreboard, verbatim

## P1 -- the first act (item verdict = majority of its N=3 samples)

| id | prediction | so far | projected at N | verdict |
|---|---|---|---|---|
| 1 | compounds rule the first act after truncation: 3 of 3 | 2 of 3 | 2 of 3 | DEAD |
| 2 | controls flagged `several` AND the ruling changed: at most 1 (design: of 12; 11 named) | 1 of 11 | 1 of 11 | MET |
| KILL | controls changed: 3 or more kills (i.e. at most 2 survive) | 1 of 11 | 1 of 11 | MET |
| STOP | compounds whose truncated ruling was inapplicable: 2 or more stops (at most 1) | 0 of 3 | 0 of 3 | MET |
| r1 | compounds with no split at all (the reader said one, or cited from word 1) -- reported | 0 of 3 | 0 of 3 | REPORT |
| r2 | controls flagged `several` whatever happened next -- reported (§74.1's one-in-four) | 7 of 11 | 7 of 11 | REPORT |

**DEAD AT THIS POLL: 1** -- announce it now and apply the stopping rule (the owner, 2026-09-21).

Per item (samples in; first-act keys / truncated text):
- HB-r2 (compound): 3/3 -- door/open/passage [first: "open the door"]; door/open/passage [first: "open the door and"]; door/open/passage [first: "open the door and"]
- HB-r10 (compound): 3/3 -- warden/wear/posture [first: "hit the warden with the meal tray,"]; warden/wear/posture [first: "hit the warden with the meal tray,"]; warden/wear/posture [first: "hit the warden with the meal tray,"]
- G27-P8 (compound): 3/3 -- window/open/passage [first: "Pull the bar out of the window"]; bar/open/integrity [first: "Pull the bar out of the window"]; bar/open/integrity [first: "Pull the bar out of the window"]
- B7-P18 (control): 3/3 -- door/reveal/passage [first: "study the door's gap"]; door/reveal/passage [first: "study the door's gap"]; door/reveal/passage [first: "study the door's gap"]
- B7-P23 (control): 3/3 -- door/reveal/passage [first: "look at the door gap"]; door/reveal/passage [first: "look at the door gap"]; door/reveal/passage [first: "look at the door gap"]
- B7-P36 (control): 3/3 -- bar/wear/integrity; bar/wear/integrity; bar/wear/integrity
- B7-P48 (control): 3/3 -- strip/wear/integrity; strip/none/none; strip/none/none
- B7-P58 (control): 3/3 -- loose_tile/reveal/concealment [first: "look at the tile,"]; loose_tile/reveal/concealment [first: "look at the tile,"]; loose_tile/reveal/concealment [first: "look at the tile,"]
- B7-P59 (control): 3/3 -- prisoner/wear/posture; prisoner/wear/posture; prisoner/wear/posture
- B7-P60 (control): 3/3 -- prisoner/wear/posture; prisoner/wear/posture; prisoner/wear/posture
- B7-P61 (control): 3/3 -- spoon/take/none [first: "take the spoon and"]; spoon/take/none [first: "take the spoon and"]; spoon/take/none [first: "take the spoon and"]
- B7-W04 (control): 3/3 -- bar/reveal/integrity [first: "check the bar,"]; bar/reveal/integrity [first: "check the bar,"]; bar/reveal/integrity [first: "check the bar,"]
- B7-W07 (control): 3/3 -- bar/reveal/integrity; bar/reveal/integrity [first: "check the bar's"]; bar/reveal/integrity [first: "check the bar's"]
- G27-W7 (control): 3/3 -- loose_tile/reveal/concealment [first: "Closely examine the loose_tile to check its concealment"]; loose_tile/reveal/concealment [first: "Closely examine the loose_tile to check its concealment"]; loose_tile/reveal/concealment [first: "Closely examine the loose_tile to check its concealment"]
