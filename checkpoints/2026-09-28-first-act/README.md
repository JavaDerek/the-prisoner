# P1 -- the first act (D7): how to run it

Scaffolding written 2026-09-27; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner
commits it unchanged before the first call.

## Preconditions

1. **Pin the commit.** Run from a worktree checked out at the commit that holds this directory's committed
   `PREDICTION.md` (`git worktree add /tmp/prisoner-p1 <sha>`, then `npm install` there or symlink
   `node_modules`). The probe refuses to start on a dirty tree (`--allow-dirty` overrides, and RESULTS must say so).
2. **Check the card first.** `curl -s http://doris:11434/api/ps` -- `muse-glimmer:30b` may already be resident for
   Shep's production bridge; that is our model, so nothing needs swapping. Any OTHER model loaded stops the
   probe (`assertNoForeignModel`). Shep's calls share the runner's slots: note in RESULTS whether Shep was busy.
3. **One driver.** No batch, no other probe, no `npm run checkpoint` running. The probe takes
   `/tmp/the-prisoner-one-driver.lock` and refuses to start if another driver holds it.
4. **No arm variables.** Leave every `PRISONER_*` arm unset: the probe reads the game's defaults through the
   game's own readers and prints them as its first line. `PRISONER_ONE_ACT` must resolve to `first`.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-first-act/probe.mts --dry-run      # read the requests; no network
PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-first-act/probe.mts --live
npx tsx checkpoints/2026-09-28-first-act/probe.mts --score        # every check-in
```

42 rulings (14 items x N=3), each with a one-act call, plus a third call on every cut: expect roughly 45-75
minutes on the local card. `results.jsonl` is appended one sample at a time (a rerun resumes); the run log goes to
`logs/run-<stamp>.txt`.

## What NOT to do

- Do not run it beside anything else on doris (OPEN-VARIANT §75.2).
- Do not set `PRISONER_ONE_ACT`, or any other arm, to "see what happens": the probe measures the defaults.
- Do not edit `PREDICTION.md` after the first call, and do not edit `results.jsonl`. Write `RESULTS.md` beside
  them from `--score` and the rows.
- Do not copy a request out of `results.jsonl` or a `.referee.json` to re-ask it: rebuild (`--only=ID`).
