# Results: decomposing the hard questions on qwen3:14b (six rows, 2026-09-22)

Prediction `PREDICTION.md`, committed before any call. N = 3, thinking ON. `log.txt`, `results.json`.

| row | accept | qwen3 as-is (capacity run) | decomposed | property | applicable |
|---|---|---|---|---|---|
| `b1#34` sharpen on the crossbar | spoon/restore | spoon/wear 3/3 | **spoon/restore (raise) 3/3** | edge | yes -- **RIGHT** |
| `b2#5` sharpen on the tile | spoon/restore | spoon/wear 3/3 | **spoon/restore (raise) 3/3** | edge | **no** -- refused by the gate |
| `b1#25` sweep the spoon into the hollow | spoon/conceal | tile 2/3 | spoon/conceal 3/3 | concealment/none | **no** -- refused by the gate |
| `b1#13` slide the wire under the tile | wire/conceal | wire/derive 3/3 | wire/derive 3/3 | integrity | yes, wrong act |
| `b1#16` blanket, charge, wrench open, go through | door/* or warden/wear | blanket/open 3/3 | blanket/open 3/3 | passage | no |
| `b1#50` examine the lock (control) | lock/reveal | lock/reveal 3/3 | lock/reveal 3/3 | integrity | yes -- control held |

**Scoreboard.** 1 **DEAD**: 1 of 5 wrong rows fixed, needed 3. 2 held: the control is unharmed. 3: 11-28 s per ruling,
about Sonnet's cost. **The sweep of the other 37 rows is not run.**

**But the six rows separate three causes, which the single score hides.**

1. **The direction call works.** Asked alone -- "does this aim to RAISE or LOWER the edge of the spoon?" -- qwen3 answers
   `raise` on 4 of 4 sharpening rulings, 3/3 each, where the same model in the main request scored **0 of 8**. The
   decomposition lever is real for this class; it is the same finding as the one-act call (8/8 chains alone).
2. **Two right rulings are then refused by OUR gate, not by the model.** `b2#5` is `spoon/restore/edge` and `b1#25` is
   `spoon/conceal/concealment` -- both correct -- and both inapplicable, because a property citation must be quoted from
   the TARGET'S DESCRIPTION, and the spoon's description never names an edge ("One side of the bowl is worn flat..."). This
   is the same rule `52ae7de` waived for `reveal` this morning on the same argument: the declared-property check already
   proves the property exists. Whether to extend that waiver is the owner's call (OPEN-VARIANT §3.2's grounding principle).
3. **Two are genuine model failures:** a chain still keyed on the blanket, and a hide still read as `derive`. Sonnet gets
   both right; no decomposition tried here touches them.

**Reading.** Decomposition is not a general rescue -- at Sonnet's cost for a fraction of its accuracy -- but the direction
question is worth keeping as its own call whatever referee runs, and two of the six failures were never the model's at all.
