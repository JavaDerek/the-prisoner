# Results: the thinking probe is VOID, and the reason is worth more than the probe

Prediction: `PREDICTION.md`, committed before any scored call. Ran 2026-09-25 ~06:55-07:20 CDT while the
owner was away, on `muse-glimmer-30b-q4_k_m` at the recorded requests of batch 6's 22 refusals.

## Prediction 1 (instrument check) is DEAD: 2 of 4, the bar was 3 of 4

Replaying batch 6's own recorded requests, byte-identically, at the same reasoning strength the batch ran
at, **does not reproduce the batch's rulings**:

| row | b6 recorded (live) | direct replay | |
|---|---|---|---|
| #4 | `loose_tile/reveal/none` (refused) | `loose_tile/reveal/concealment` (**resolves**) | not reproduced |
| #8 | `prisoner/none/none` | `none/none/none` | not reproduced |
| #11 | `cot/none/none` | `cot/none/none` | reproduced |
| #1 | `loose_tile/reveal/none` | `loose_tile/reveal/none` | reproduced |

Per the pre-committed rule, **predictions 2, 3 and 4 are void and the `high` arm was not run**. A baseline
that moves on its own cannot support an arm: any difference at `high` would have been unattributable.

**This is the second occurrence.** `checkpoints/2026-09-22-reveal-edge/RESULTS.md` recorded the identical
failure and left it open: *"The instrument did not reproduce the batch's own rate, and I could not explain
why."* Twice is a pattern, and it is a measurement problem that sits underneath every referee number.

## What was eliminated, one variable at a time

Each condition is the same four rows, same recorded requests, scored through the real `computeRuling`.

| condition | #4 | #8 | #11 | #1 |
|---|---|---|---|---|
| **b6 recorded (live batch)** | `reveal/none` | `prisoner/none/none` | `cot/none/none` | `reveal/none` |
| direct, qwen resident, run 1 | `reveal/concealment` | `none/none/none` | same | `reveal/none` |
| direct, qwen resident, run 2 | `reveal/concealment` | `none/none/none` | same | `reveal/none` |
| direct, **card freed** | `reveal/concealment` | `none/none/none` | same | `reveal/`**`integrity`** |
| direct, **server flag only** (b6's exact wire) | `reveal/concealment` | `none/none/none` | same | `reveal/integrity` |
| **through the router** (b6's path) | `reveal/concealment` | `none/none/none` | same | `reveal/`**`concealment`** |

- **Replay is deterministic** within a fixed machine state: runs 1 and 2 are identical on all four rows.
- **The per-request `reasoning_strength` override is not the confound.** Sending nothing and relying on the
  server's own start flag -- byte-identical to what batch 6 sent -- gives the same answers.
- **The router is not the confound.** If anything it moves further from b6, resolving #1.
- **Freeing VRAM moved a ruling.** #1 went `none` -> `integrity` when `qwen3:14b` was unloaded, with nothing
  else changed. Neither answer is declared on the tile so the verdict held, but the keys moved on GPU state
  alone, which nothing in this project had measured before.
- **Row #1 is not a stable ruling at all.** Across conditions it answered `none`, `integrity` and
  `concealment` -- refused, refused, resolved. It was counted as one of b6's 22 refusals and audited as a
  correct one.

## THE FINDING: concurrent load breaks the referee's determinism at temperature 0

Two probe processes, launched together against the one llama-server, each replaying the SAME four recorded
requests -- which is what batch 6 did with its two game drivers:

| row | process A | process B | agree? |
|---|---|---|---|
| #4 | `loose_tile/reveal/`**`integrity`** -- refused | `loose_tile/reveal/`**`concealment`** -- **resolved** | **NO, and the verdict flips** |
| #1 | `loose_tile/reveal/`**`concealment`** -- **resolved** | `loose_tile/reveal/`**`integrity`** -- refused | **NO, and the verdict flips** |
| #8 | `none/none/none` | `none/none/none` | yes |
| #11 | `cot/none/none` | `cot/none/none` | yes |

**The same request, at temperature 0, answered at the same instant, returns different rulings** -- and on
both disagreeing rows the difference is not cosmetic: one process rules the act possible and the other
refuses it. Solo, the identical request is perfectly reproducible across repeats (above). So the referee is
deterministic alone and is not deterministic under load.

OPEN-VARIANT.md §3.5's premise -- *"The referee runs at temperature 0"*, stated for its consistency property
-- does not hold when two drivers share a server. Batch 6 ran two drivers. **Its rulings are draws from a
distribution, not readings**, and its refusal audit sampled that distribution once.

That also closes `checkpoints/2026-09-22-reveal-edge/RESULTS.md`'s open item, which guessed at exactly this
without testing it: *"The live batch ran two game drivers plus the §5.0 probe against the same resident
model through the router; this ran alone and direct."*

Not everything moves: #8 and #11 were stable in both processes. What moves is the borderline rulings -- and
a borderline ruling is precisely what lands in a refusal audit.

## The wire fact, confirmed and useful regardless

A per-request `chat_template_kwargs.reasoning_strength` **overrides** the server's
`--chat-template-kwargs '{"reasoning_strength":"none"}'` start flag (none 44 tokens / low 48 / high 87, on
the trivial prompt). So `docs/issues/prisoner-P8-...` can be fixed without restarting llama-server, and a
thinking arm needs no change to how the machine is run.

Cost, measured on real referee requests: **`none` 56.5s, `high` 163.5s** (~2.9x, not the 10x §68.5 saw on
`qwen3:14b`). A 10-round two-chair game makes ~40 referee calls.

## The pilot, disclosed in the prediction

Row #10 (`spoon`/`conceal`/`none`) was run at both strengths before the prediction was written: `none`
reproduced b6's `property: none`; `high` answered `concealment`. **One already-seen observation, on the one
row whose baseline did reproduce.** It is the only evidence here that touches the original question, and it
is n=1.

## What this says to do next

1. **Nothing about the referee's failure rate can be trusted until this is explained.** b6's "14 of 22
   refusals overturned" was read as a property of the referee. At least two of the four rows checked here
   do not refuse at all on replay, and a third is unstable across machine states.
2. The live/replay gap is not the router, not the wire field and not sampling noise. It is concurrency.
3. **Decide whether batches run one driver at a time.** Serialising costs wall clock and buys back the
   determinism every pre-registered band is scored against. The alternative is to keep two drivers and stop
   treating a single ruling as a reading -- which means N>1 on anything a band depends on, and is more
   expensive than serialising.
4. **Re-run batch 6's refusal audit serially before believing "14 of 22".** On this evidence some of those
   22 are not refusals the referee makes, they are refusals it sometimes makes.
5. The thinking probe is still unrun and is now runnable: with a serial baseline that reproduces,
   `PREDICTION.md`'s arm can be executed as written.
