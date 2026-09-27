# P4 -- the 2x2, list x line: how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call, including its round-6 decision.

## Preconditions

1. **Pin the commit** (a worktree at the commit holding the committed `PREDICTION.md`); the probe refuses a dirty tree.
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any other
   model stops the probe. Note Shep's traffic in RESULTS.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`.
4. **No arm variables**: leave every `PRISONER_*` arm unset. The shape is set per cell by the probe itself (never by
   `PRISONER_CONDITIONS`), and recorded in every meta line.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --dry-run [--with-round6] [--omit=prisoner:2]
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --live [--with-round6] [--omit=prisoner:2]
npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --labels-template > /tmp/p4-labels.json
#   fill notesSayOpened / planKeepsSuspicionLow by hand (true/false), save as LABELS.json beside this file
npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --score
```

40 samples (60 with round 6), each a warden wits call plus a ruling and its one-act call: about an hour (1.5 with
round 6).

## What NOT to do

- Do not label with a script, a regex or a model: the labels are the owner's reading, and CLAUDE.md forbids code
  reading English to decide anything. Label blind to the cell if you can (the template is keyed by sample id, which
  names the cell -- sort it by something else first if that matters to you).
- Do not change `PRISONER_CONDITIONS` to "get the other shape"; the probe builds both shapes itself.
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
