# Results: the referee rules custody (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. N = 3, thinking ON, timeout 120 s. `BASE.log`, `VARIANT.log`,
`results-*.json`.

| intent | expect | BASE (no custody wording) | VARIANT |
|---|---|---|---|
| #10 face the wall, pat-down search | prisoner/expose | prisoner/reveal | prisoner/expose 3 |
| #12 hand the spoon over | spoon/give | spoon/reveal | spoon/give 3 |
| #31 hand wire_2 to Croft | wire_2/give | wire_2/none | wire_2/give 3 |
| #36 pick up the loose wire, pocket it | wire/take | wire/derive | wire/take 3 |
| #39 pick the wire from the gap, hand it over | wire/give | wire/reveal | wire/give 3 |
| #41 collect the meal tray | meal_tray/take | meal_tray/none | meal_tray/take 3 |
| #47 hand the spoon to Croft | spoon/give | spoon/none | spoon/give 3 |
| #54 pat down Mara Voss | prisoner/expose | prisoner/reveal | prisoner/expose 3 |
| owner: "steal the key ring" | key_ring/take | key_ring/none | key_ring/take 3 |
| "Pull the key ring off Croft's belt." | key_ring/take | key_ring/noise | key_ring/take 3 |
| record: #37 confiscate the wire, or search | -- | prisoner/none | prisoner/take 3 |
| record: #38 pull a wire and hand it over (two acts) | -- | wire/conceal | wire/give 3 |
| record: #51 inspect the tray for the spoon | -- | meal_tray/reveal | meal_tray/reveal 3 |
| record: #18 keep the spoon back from the tray | -- | cot/none | cot/none 2, spoon/none 1 |
| 7 controls: take a wire out of the cot (derive), scoop grit, examine the spoon, hide the spoon, scrape the bar, lift the tile and examine, attack the warden | -- | -- | identical majority, 7 of 7 |

**Scoreboard.** 1 held: 10 of 10 clear custody intents, target and effect, every one 3/3. 2 held: 7 of 7 controls unchanged -- the word "take" in "take a wire out of the cot" stays a derive. Batch 2
runs on custody as built. Record row #37 names the PERSON as what is taken -- a take whose target is a person plans
nothing (`planCustody`), so a confiscation phrased at her rather than the wire will still do nothing; worth watching in
batch 2.
