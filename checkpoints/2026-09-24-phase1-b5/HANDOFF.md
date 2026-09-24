# Handoff: the 6-hour run, and what to build before or after it

Written 2026-09-24 at the end of the session that produced batch 4, the prose seat and the prose lab.
`PREDICTION.md` beside this file is **superseded in its arms and its central prediction** -- see below.
Read `../2026-09-24-prose-lab/RESULTS.md` first; it carries the corrections.

## The state, in one paragraph

Two of the game's three seats are established locally at batch strength: the **referee**
(`meta-models/Muse-Glimmer-30B` Q4_K_M, two batches) and the **warden** (batch 4, N=10,
indistinguishable from Opus on catches, spoon-check rate, suspicion, silences and refusals). The
**prisoner's** seat is the gap: it has a 3-round probe and round-1 lab samples, never a batch. The
prose seat (`src/open/proseMind.ts`) is what makes a local prisoner credible and it is one day old.

## The run to do: the SEAT comparison, not the model comparison

**`PREDICTION.md`'s arms are wrong now and its prediction 1 is already dead.** It pitted
`ancient-awakening` against Muse on the assumption AA had 2.5 bits of approach spread against Muse's
1.0. The owner's output-discipline block closed most of that gap (Muse 0.99 -> 1.94, and 2.51 under
exemplars alone), and prediction 1 forecast arm M at "at most 4 distinct approaches" when Muse reaches
6-7 in the lab. **Do not run it as written.**

The run worth six hours is **Muse prose prisoner vs Muse schema prisoner**, same model both arms, same
Muse warden and referee, the SEAT as the only variable. It costs no second model, no VRAM spill and no
Opus. Priced from batch 4's measured throughput (50 GPU calls per game at 17.4 s effective): **~5.8 h
for N=10 per arm, ~2.9 h for N=5.** More drivers do not help -- llama-server serves one slot, so the
total GPU work is the floor.

**Why that comparison and not another:** the prose seat took `barIntegrity` to 85 in a 3-round probe,
and nineteen of twenty schema-seat games across batches 3 and 4 left it at 100. That is the single
most promising unexplained result of the day and it rests on an N of 1.

**Measure novel (object, effect) pairs, not entropy.** Entropy counts distinct tool->target pairs and
is diversification, not innovation; menu use is how the game is played (the owner, 2026-09-24). The
transcripts already report novel pairs with no closed-variant equivalent, and that only exists once
games run.

## Build, probably: memory for the prose seat

**The owner's hypothesis, 2026-09-24: innovation will need memory.** The prose seat carries no plan
and no notes -- that is how it bought its compliance, by not asking for eight fields -- so nothing
crosses a turn but the briefing. Over three rounds the cost is invisible. Over ten she may repeat
herself or re-try what already failed, because she cannot remember that it did.

**The sharp edge on that hypothesis: memory is not sufficient.** Batch 4's Opus prisoner carried plan
AND notes for twenty games and never once damaged the bar. So the interesting build is getting notes
back **without** reintroducing the schema that caused the pre-classification problem -- a second cheap
call that asks only "what do you want to remember?", or the briefing carrying forward what the referee
already recorded, rather than a `notes` field in the proposal. Decide this AFTER the seat comparison,
because that run is what shows whether the memoryless seat actually degrades over ten rounds.

## Build, definitely: widen the outside audit

An all-local game **cannot validate its own rulings** -- prisoner, warden and referee are one model, so
every intent is graded by the weights that wrote it. No number of games fixes that; only an outside
opinion does. `../2026-09-24-phase1-b4/escalate.mts` is that opinion: it re-asks a recorded ruling of
Opus from the committed `referee.json`, so nothing runs live, nothing touches the GPU and it is
re-runnable later against a different model.

**Keep it post-hoc and out of the loop, permanently.** The referee's ruling IS the game's decision; a
second opinion inline needs a tie-break rule, and that is a new mechanic rather than an audit.

**Its hole, and the fix for this run:** it only sees REFUSALS -- 5 of 192 rulings in batch 4. The other
187 were grounded and nothing ever checked them. A ruling that is confidently wrong but well-formed is
invisible to it: the referee names an effect, cites a quote, the world changes, and no one asks whether
it was right. **For the 6-hour run, escalate every refusal PLUS a random sample of ~30 grounded
rulings.** That is about 35 Opus calls for the whole batch and it would be the first outside opinion on
the rulings that actually moved the world. Sampled, not exhaustive; a standing practice, not a fixture.

## Serving, and what no header records

- Muse on llama-server (doris:11435) **with `--chat-template-kwargs '{"reasoning_strength":"none"}'`**.
  **Check the live process, not the docs**: batch 4's first launch was void because a restart had
  dropped that flag, tripling generation until it blew the slot context. `../2026-09-24-phase1-b4/SETUP.md`
  has the full account.
- The model router on 8799 with `SHIM_LOCAL_URL`/`SHIM_LOCAL_MODELS`. If a second model is ever served
  from Ollama alongside it, hide BOTH with `SHIM_HIDE_MODELS`: two servers each holding a model
  permanently is not what the one-model-at-a-time swapper is for, and its unload is a no-op through the
  router, so it times out instead.
- `ancient-awakening:12b-ctx4k` is a `num_ctx 4096` variant created on doris 2026-09-24 because the
  stock model's runtime footprint is 13.8 GB against Muse's 16.4 on a 24.5 GB card. Only needed if AA
  is revisited.

## Open and unattributed

- **~25 of the 47-point prompt gap.** The owner's scene beats the game's by 47 points on AA; second
  person recovers 22 and the warden-side conditions are load-bearing. The rest is unexplained, and it
  is an AA-only finding -- Muse is at 100% clean under every scene tested and has no headroom to show it.
- **Whether reaching wider produces an escape.** Entirely unknown. The prose seat damaged the bar once.
