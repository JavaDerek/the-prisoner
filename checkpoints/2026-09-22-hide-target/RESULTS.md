# Results: an act of hiding names the thing hidden (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. N = 3, thinking ON, timeout 120 s. Logs `BASE.log`,
`VARIANT.log`; tallies in `results-*.json`. BASE is the request before custody merged (the clause is tested alone).

| intent | BASE | VARIANT |
|---|---|---|
| #8 show the spoon, keep the wire tucked | spoon/reveal 3 | spoon/conceal 2, spoon/expose 1 |
| #11 twist the wire back onto the cot frame | cot/conceal 3 | **wire/conceal 3** |
| #13 slide the wire under the tile | wire/derive 3 | wire/derive 3 |
| #17 palm the spoon under the blanket | meal_tray/none 1, TIMEOUT 2 | **spoon/conceal 3** |
| #24 tuck the spoon in the blanket fold | spoon/conceal 3 | spoon/conceal 3 |
| #30 bundle the wire in the blanket | blanket/derive 3 | blanket/none 2, blanket/derive 1 |
| tuck the spoon under the loose tile | tile 2, spoon 1 | **spoon/conceal 3** |
| hide the spoon in the blanket folds | blanket 2, spoon 1 | **spoon/conceal 3** |
| slip the spoon into the hollow, tile over it | loose_tile/conceal 3 | **spoon/conceal 2**, tile 1 |
| 6 controls (tile expose/reveal, grit derive, bar wear, spoon reveal, wire derive) | -- | identical majority |

**Scoreboard.** 1 held, 7 of 9 name the thing hidden. 2 held, 6 of 9 `conceal` on it. 3 held, 6 of 6 controls
unchanged. **Ships.** What it does not fix: hiding still read as *making* something (#13, #30), which is the effect
question's, and #8's thing hidden is the wire, not the spoon it names first. (The "lift the tile to uncover" control
reads `reveal`, not `expose`, in both arms -- unchanged, and not this clause's.)
