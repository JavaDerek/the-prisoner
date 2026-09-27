# P7 -- the request order (optional, last): how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call. Run it after P1-P6, or not at all.

## Preconditions

1. **Pin the commit** (a worktree at the commit holding the committed `PREDICTION.md`); the probe refuses a dirty tree.
2. **Check the card, and Shep**: `curl -s http://doris:11434/api/ps` -- `muse-glimmer:30b` resident is fine, any
   other model stops the probe. This probe measures TIME: run it when Shep's bridge is quiet, and say in RESULTS
   whether it was.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-request-order/probe.mts --dry-run [--omit=prisoner:2]
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-request-order/probe.mts --live [--omit=prisoner:2]
npx tsx checkpoints/2026-09-28-request-order/probe.mts --score
```

40 rulings, each with a one-act call: about 40 minutes.

## What NOT to do

- Do not interleave the arms or run two orders in two processes: the prefix cache is the thing measured, and two
  drivers also make the referee non-deterministic (OPEN-VARIANT §75.2).
- Do not edit `referee.ts` to get the other order; the wrapper is the arm, and nothing else differs.
- Do not edit `PREDICTION.md` or `results.jsonl` after the first call.
