# Results: extending the property-citation waiver -- measured, dead, reverted (2026-09-22)

Prediction `PREDICTION.md`, committed before any call. The change was written test-first (with the owner's §55 grounding
rule preserved: the waiver for OBJECTS only, a person's property still held to her own description), the suite went green
at 1115 tests, and then it was measured on the 43-row benchmark before shipping.

| measure | before | after |
|---|---|---|
| qwen3:14b right | 21 of 43 | **21 of 43** |
| applicable but WRONG | 10 | 11 |
| rows newly right | -- | none |
| rows lost | -- | none |

**Scoreboard.** 1 **DEAD** (21, needed >= 25). 2 held (nothing that was right became wrong). 3 held (+1 wrong, allowance 3).
**Ship rule fails; reverted** (`src/` restored; `52ae7de`'s reveal-only waiver stands).

**Why the prediction was dead, and what it says about the instrument.** A gate that refuses CORRECT rulings can only help
a referee that produces correct keys. On these rows plain qwen3 mostly does not: the two rows that proved the problem
(`b2#5` sharpening, `b1#25` hiding) only became right-keyed under the DECOMPOSED calls
(`../2026-09-22-decomposition/`), and Sonnet was already 42 of 43 under the old gate. So the benchmark as run could not
show the change's value either way; the measure was wrong for the question, not just unfavourable.

**What would justify revisiting it:** a referee configuration that produces right keys often enough for the gate to be
the binding constraint -- a stronger referee in play, or decomposition shipped. The evidence that the gate refuses
correct rulings is unchanged: the spoon declares an `edge` its authored description never names.

**One incidental gap found and also reverted:** `referee.ts`'s default property lookup (`scenarioProperties`) knows the
§4.1 objects but not `OPEN_PERSONS`, so a caller relying on the default cannot tell a person from a thing. The game
always passes its own `propertiesOf` (from the world), so nothing in play is affected; a future change that turns on
person-ness in the default path needs this fixed first.
