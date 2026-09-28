# the-prisoner#35 -- warden wits call timing: how to run it

Scaffolding written 2026-09-27/28; nothing here has called a model. `PREDICTION.md` is written before the first
call and records what the dry run already found (prompt sizes, old-arm replay divergences on rounds 6/7/9).

## Preconditions

1. **Pin the commit**: a worktree at the commit holding the committed `PREDICTION.md`. The probe refuses a dirty
   tree (`--allow-dirty` overrides; say so in a RESULTS file if used).
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine (it is
   our model); any other model stops the probe (`assertNoForeignModel`). Shep's calls share the runner: note it if
   he was busy.
3. **One driver**: nothing else on doris. The probe takes `/tmp/the-prisoner-one-driver.lock`
   (CLAUDE.md "One driver at a time, or the referee is not deterministic" -- this probe makes no referee calls at
   all, but the lock is shared discipline with every other 2026-09-28 probe and `run-batch.sh`, so it still takes
   it).
4. **No arm variables in the shell** beyond `PRISONER_MODEL_URL`/`PRISONER_OLLAMA_RESIDENT_MODELS`/the timeouts
   below: the probe reads `new` and `old` arms itself from `OLD_PROMPT_ARMS` in `probe.mts`, not from the
   environment, so a stray `PRISONER_BLOCK=off` left set in the shell would double-apply to the `old` arm (no
   effect) but silently corrupt the `new` arm's baseline. The first two lines of every run print exactly what each
   arm resolved to.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --dry-run   # confirms 28 requests, prints divergences

PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --live

npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --score
```

28 samples (7 rounds x 2 arms x N=2), each one warden wits call only -- no referee ruling, so each sample costs
roughly one wits call's own wall time (~15-35s going by the two recorded transcripts): about 10-15 minutes total.
`results.jsonl` keeps every sample's `ms`, raw `usage` (`prompt_tokens`/`completion_tokens`/`total_tokens` exactly
as Ollama's `/v1/chat/completions` returned them), `visibleChars`, and the replay's own divergences/warnings for
that context; `logs/run-<stamp>.txt` the log. A crashed or interrupted run resumes from `results.jsonl` rather
than repeating finished samples (`--live` again, same command).

`--only=old:6,old:9` restricts to specific `arm:round` cells (matching the sibling probes' `--only` convention),
useful for rerunning just the diverged rounds or just one arm.

## What `--score` prints

Medians per arm of `ms`, `usage.prompt_tokens`, `usage.completion_tokens`, and `visibleChars`
(thoughts+candidates(JSON)+intent+line+plan+notes, defined once in `probe.mts`'s `visibleChars`), plus the
new/old ratios and which of PREDICTION.md's two bands (if either) the ratios meet. It does not compute an
"implied hidden token count" by subtracting a tokenizer estimate from `completion_tokens` -- the issue explicitly
rules that out (no tokenizer is available here, and estimating one would be exactly the kind of inference this
repository does not make from partial evidence) -- it reports `completion_tokens` beside `visibleChars` and lets
the ratio between arms speak for itself.

## What NOT to do

- Do not build a context by hand or copy a briefing out of the transcript: `--only=new:5` rebuilds one cell from
  `checkpoints/2026-09-28T01-09-16-356Z.md` through the game's own `runOpenGame` loop.
- Do not call the referee on the mind's live proposal to "check" it -- this probe measures the wits call only,
  and the referee's own call is already measured unchanged by the coordinator.
- Do not treat the `old` arm's rounds 6, 7 and 9 as the recorded game's own belief state -- `PREDICTION.md` names
  exactly why they diverge (the recorded game used `block` and D13's sight/posture mechanics that do not exist
  under the old arms) and what that does and does not mean for the comparison.
- Do not run beside a batch or another probe; do not edit `PREDICTION.md` or `results.jsonl` after the first live
  call.
