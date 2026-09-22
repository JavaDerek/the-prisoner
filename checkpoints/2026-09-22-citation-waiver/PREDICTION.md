# Pre-committed: extend the property-citation waiver to every effect (2026-09-22, before any call)

`52ae7de` let a **reveal** cite its property from the actor's intent, because a reveal changes nothing and the
declared-property check already proves the property exists. `../2026-09-22-decomposition/RESULTS.md` found the same rule
refusing two CORRECT rulings of other kinds: `spoon/restore/edge` (sharpening, read right at last) and
`spoon/conceal/concealment` -- the spoon's authored description never names an edge, so no quote from it exists. The
owner's decision (2026-09-22): extend the waiver to every effect.

**The change.** In `computeRuling`, a property answer may cite the actor's intent OR the target's own description, for any
effect. **Unchanged:** the property must be one the target DECLARES (`propertyNamedWhenRequired`); the target and effect
citations must still come from the intent; a citation naming some OTHER object's description still fails; a `derive` still
needs its product cited. Planted violations for each, test first.

**Measurement.** The 43-row benchmark (`../2026-09-22-referee-capacity/`), qwen3:14b, N = 3, same answer key, before and
after -- the model's replies are unaffected by a gate change, so any movement is the gate's.

**Predictions:**
1. qwen3 right rises from 21 to at least 25 of 43.
2. **No row that was right becomes wrong** (the waiver only relaxes; this is a check on my own reasoning).
3. Rows that are applicable-but-WRONG rise by at most 3. This is the cost of the change: rulings the gate used to refuse
   for the wrong reason now land, and some of them are wrong. Over 3 and the waiver trades one failure class for another.

**Ship rule:** 1 and 3 both hold, and the suite stays green.
