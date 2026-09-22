# Results: one-act question, second version (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. BASE = `cdb3d37`'s request; VARIANT = plus the revised `acts`
question. N = 3, thinking ON, timeout 120 s. Tallies in `results-*.json`, logs `BASE.log`/`VARIANT.log`.

**Scoreboard.** 1 **DEAD**: MULTI several in the majority on 4 of 8 (needed 6); the owner's r10 and #64 fell to one
several each, #33 read one 2 of 3, #4 timed out 3/3. 2 held: ONE one on 16 of 16, all 3 examine-while-watching/
talking intents one 3/3. 3 **DEAD**: 18 of 19 -- "sit on the cot ... drag the spoon along the crossbar" moved
cot/wear -> spoon/wear 3/3. MULTI timeouts 9 (BASE) -> 7 (VARIANT). **Does not ship.**

**Reading across both versions.** v1 caught chained intents (6/8) and refused the warden's examine-while-watching
2 of 3; v2's wording fixed that (3/3 one) and stopped catching chained ones (4/8). And each version moved one unrelated
ruling in the main request (v1 the tuck, v2 the crossbar). Tuning a third wording on these 27 intents is the
prompt-fitting §33 warns against. The project's own finding for readings is that they work as a **separate, small
call** (WORLD-ELABORATION-DESIGN-2, form S). Asked that way the main request stays byte-identical, so no control can
move by construction. That is the next probe, pre-registered separately (`../2026-09-22-one-act-s/`).
