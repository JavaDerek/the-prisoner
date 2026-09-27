# P2 -- block reach (D4', D4b): how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call -- including its one decision (`--omit=prisoner:2` or not).

## Preconditions

1. **Pin the commit**: a worktree at the commit holding the committed `PREDICTION.md`. The probe refuses a dirty
   tree (`--allow-dirty` overrides; RESULTS must say so).
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine (it is
   our model); any other model stops the probe. Shep's calls share the runner: note in RESULTS if he was busy.
3. **One driver**: nothing else on doris. The probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset; the first line of the log prints what was read.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-block-reach/probe.mts --dry-run --omit=prisoner:2   # read the three prompts
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-block-reach/probe.mts --live --omit=prisoner:2
npx tsx checkpoints/2026-09-28-block-reach/probe.mts --score
```

(Drop `--omit=prisoner:2` from both lines if the owner answers the PREDICTION's decision "no".)

30 samples, each one warden wits call (~50 s) plus a ruling and its one-act call (~35 s): about 45 minutes.
`results.jsonl` keeps every sample's intent, candidates, plan, notes and keys; `logs/run-<stamp>.txt` the log.

## What NOT to do

- Do not build a context by hand or copy a briefing out of the transcript: `--only=r5` rebuilds one cell.
- Do not count candidates by reading them in code; they are there for a person to read.
- Do not run beside a batch or another probe; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
