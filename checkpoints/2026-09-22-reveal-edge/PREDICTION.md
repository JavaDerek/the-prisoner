# Pre-committed: the reveal-property sentence names edge (2026-09-22, overnight, before any call)

Phase 1 batch 1's owner labels (`../2026-09-21-phase1-b1/refusal-audit.csv`) put four warden spoon examinations
(rows #15, #19, #35, #43) at `misruled`: each asks about the spoon's EDGE and sharpening, and the referee keyed
`integrity`, which the spoon does not declare. The property question's reveal sentence names only integrity
("integrity for damage, wear, rust or tampering"), so it points every examination for wear at integrity.

**Variant:** that sentence gains one clause naming edge: "For reveal, name the property being learned: edge for how
sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the
intent calls it hidden." Nothing else in the request changes.

**Instrument:** 10 intents (4 FIX, verbatim from the batch; 6 controls), requests built from `buildOpenWorld` +
`computePerceivedObjects` from the WARDEN's seat, presence modelled, defaults otherwise (instrument unasked,
derive wording baseline) -- the batch's arms. Referee `qwen3:14b` on doris, thinking ON (the batch's setting),
N = 5 per intent per arm, baseline then variant.

**Predictions:**
1. Baseline: FIX rows key `integrity` in the majority (>= 3/5) on at least 3 of 4 (reproduces the batch).
2. Variant: FIX rows key `edge` in the majority on at least 3 of 4.
3. Controls: every control's majority target/effect/property is the same in both arms (bar/lock integrity,
   tile concealment, bar wear integrity). The sharpening control is recorded only.

**Ship rule (§33.14):** the variant ships only if 2 and 3 both hold. If any control moves, it does not ship,
whatever it does for FIX.
