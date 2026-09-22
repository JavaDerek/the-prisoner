# Results: the referee asked "one act or several?" (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. N = 3, thinking ON, timeout 120 s. Logs `BASE.log`,
`VARIANT.log`; tallies in `results-*.json` (each reply as target/effect/property/acts, or TIMEOUT).

| intent | BASE keys | VARIANT acts | VARIANT keys |
|---|---|---|---|
| MULTI #4 examine spoon, then tile | TIMEOUT 3 | several 1, TIMEOUT 2 | spoon/reveal/edge |
| MULTI #16 blanket, charge, wrench open, go through | door/open 3 | several 3 | blanket/open 2, door/open 1 |
| MULTI #27 blanket, keys, unlock, escape | key_ring/open 1, door/open 2 | several 3 | key_ring/open 3 |
| MULTI #33 tray, wait, shove through | door/leave 3 | several 1, TIMEOUT 2 | meal_tray/leave |
| MULTI #62 examine lock, sweep for spoon | TIMEOUT 3 | several 3 | lock/reveal/integrity 3 |
| MULTI #64 blanket, shove, attack bar | TIMEOUT 3 (+) | several 3 | -- |
| MULTI owner r2 "open the door and leave" | door/open 3 | several 3 | door/open 3 |
| MULTI owner r10 hit, keys, open, leave | warden/wear 2, TIMEOUT 1 | several 3 | -- |
| ONE control "examine the bar ... while watching Voss's eyes" | bar/reveal/integrity 3 | **one 1, several 2** | unchanged |
| ONE control "Tuck the spoon under the loose tile" | **spoon**/conceal 3 | one 3 | **loose_tile**/conceal 3 |
| the other 10 ONE controls | -- | one 3 each | unchanged |

**Scoreboard.** 1 held at its floor, 6 of 8 (the two misses are the timeouts). 2 held at its floor, 11 of 12.
**3 DEAD: 11 of 12** -- "Tuck the spoon under the loose tile" moved from the spoon to the tile, 3/3 each way.
By the ship rule it **does not ship** as tested.

**What it did show.** A legal "several" breaks most of §39's loop: MULTI timeouts 10 -> 4 of 24, and #62, which
timed out 3/3 here and last night, answered 3/3 in under a minute. The costliest near-miss is the warden's
most common act: an examination "while watching Voss's eyes" answered several 2 of 3, despite "watching" being
named as not counting -- it would have refused her examination most of the time. And the moved control is exactly
§74.3's territory (the target of hiding), which the separate hiding probe tests.

Next: a second version, pre-registered separately -- the acts question naming "examining while watching or
speaking" as one act, together with §74.3's hiding clause -- on the same controls.
