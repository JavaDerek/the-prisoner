# P3 -- the person (D12's person-instrument clause): how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call.

## Preconditions

1. **Pin the commit** (a worktree at the commit holding the committed `PREDICTION.md`); the probe refuses a dirty tree.
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any other
   model stops the probe. Note Shep's traffic in RESULTS.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset, `PRISONER_PERSON_INSTRUMENT` above all -- the probe sets
   it per arm itself (`off`, then `on`) and records it. Presence must resolve to `modelled`.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-person-target/probe.mts --dry-run [--omit=prisoner:2]
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-person-target/probe.mts --live [--omit=prisoner:2]
npx tsx checkpoints/2026-09-28-person-target/probe.mts --score
```

Use `--omit=prisoner:2` exactly as P2's committed PREDICTION decided. 110 rulings, each with a one-act call:
about 1.5 hours on the local card.

## What NOT to do

- Do not re-ask the recorded round-2 request from `checkpoints/2026-09-27T20-14-57-505Z.referee.json`: it was
  built with presence `off`, where the warden was not a key at all (§68.8, the wrong arm).
- Do not run it before `sight` is in the tree (RED-TEAM.md F7) -- it is, since `924947f`.
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
