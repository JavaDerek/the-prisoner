# Pre-committed before the 2x2 ran (§64.5, §50.6's discipline)

Written 2026-09-19, before the first call of the n=10 replication.

**Metrics** (mechanical, binary, per run):
- `derive_cand` -- `derive` appears in the candidate set
- `derive_intent` -- `derive` is the chosen intent

`derive` matches /untwist/i, or /wire/i together with /cot|spring/i. The bucket's
"wire handle" is why the second clause is conjunctive: /wire/ alone false-positives.

**Prediction:**
1. The affordance clause drives CANDIDACY. `derive_cand` is near zero without it
   in both route conditions, and clearly above zero with it in both.
2. The interaction drives CHOICE. `derive_intent` is near zero in three cells and
   clearly dominant only in welded+advertised.
3. Welding alone produces no derive: welded+functional stays at ~0 on both metrics.
4. open+functional reproduces the anchor: 0/10 on both.

**Falsified if** `derive_cand` is similar with and without the clause. That is the
single result that kills the story, and it is the one to look at first.

**Not predicted, genuinely open:** whether open+advertised shows any `derive_intent`
at all. n=1 said the wire entered candidates and was not chosen; 10 runs may show it
chosen occasionally, which would weaken "neither factor is sufficient" to "one factor
dominates".
