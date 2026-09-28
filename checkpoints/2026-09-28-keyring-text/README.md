# the-prisoner#31 -- the key ring text replay: how to run it

Scaffolding written 2026-09-28; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call.

## Preconditions

1. **Pin the commit** (a worktree at the commit holding the committed `PREDICTION.md`); the probe refuses a dirty tree.
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any other
   model stops the probe. Note Shep's traffic in RESULTS.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset. The two arms are the probe's own edits of the
   perceived text, not a game configuration.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --dry-run
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --live
npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --score
```

24 rulings (4 items x 2 arms x N=3), each with a one-act call under the shipped `PRISONER_ONE_ACT=first`
default: a few minutes.

## What NOT to do

- Do not edit `scenarioObjects.ts` in a worktree to get the `old` arm: the arm is the same tree with the
  perceived list's own text edited after the fact, so nothing else can differ between the arms.
- Do not replay a recorded `.referee.json` request: it was built with other arms (§68.8).
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
