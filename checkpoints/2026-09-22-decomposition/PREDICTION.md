# Pre-committed: does decomposing the hard questions rescue qwen3:14b? (2026-09-22, before any call)

The one lever measured to work on this model is **asking a hard question as its own small call**: the one-act reading
scored 8/8 on chains alone where every in-request wording failed (`../2026-09-22-one-act-s2/`). Never tried for the
other failures. Six rows first, at the owner's call, before spending on all 43.

**Arm D (decomposed).** Per row: (1) today's main request, unchanged; (2) a **target-only** call -- one question, the
same closed object list, the intent as the only source; (3) when the main effect is `wear` or `restore`, a
**direction-only** call: "does the act aim to RAISE or LOWER the <property> of the <target>?", keys `raise`/`lower`,
cited from the intent, mapped to `restore`/`wear`. The target and effect answers replace the main call's, citations and
all, and the ruling then goes through today's `computeRuling` unchanged.

**Rows** (from `../2026-09-22-referee-capacity/`, same answer key): five qwen3 got wrong 3/3 -- `b2#5` and `b1#34`
(sharpening read as wear), `b1#13` and `b1#25` (a hide keyed on the container or as a derive), `b1#16` (a chain keyed
on the blanket) -- plus `b1#50` (a lock examination it gets right 3/3), as a control.

N = 3, thinking ON, referee `qwen3:14b` on doris.

**Predictions:**
1. At least 3 of the 5 wrong rows are right in the majority under arm D.
2. The control stays right.
3. Recorded: seconds per ruling (decomposition must not cost more than Sonnet's 28 s to be worth anything).

**Stopping rule:** if 1 or 2 fails, decomposition is not the answer for these classes and the remaining 37 rows are not
run. If both hold, run all 43.
