# P6 -- the texture replay (D9): how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call, including its `--with-at-band` decision.

## Preconditions

1. **Pin the commit** (a worktree at the commit holding the committed `PREDICTION.md`); the probe refuses a dirty tree.
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any other
   model stops the probe. Note Shep's traffic in RESULTS.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset. The two arms are the probe's own edits of two texts.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --dry-run [--with-at-band] [--omit=prisoner:2]
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --live [--with-at-band] [--omit=prisoner:2]
npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --score
```

132 rulings (204 with the at-band rows), each with a one-act call: about 2 hours (3 with the at-band rows).

## What NOT to do

- Do not revert D9 in a worktree to get the `pre-D9` arm: the arm is the same tree with two strings edited in the
  request, so nothing else can differ between the arms.
- Do not replay a recorded `.referee.json` request: they were built with other arms (§68.8).
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
