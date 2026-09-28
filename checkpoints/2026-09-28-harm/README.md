# the-prisoner#1 -- the attack move: how to run it

Scaffolding written 2026-09-28; nothing here has called a model. `PREDICTION.md` is a DRAFT until the owner (or
the coordinating session, under his delegation) commits it unchanged before the first `--live` call.

## Preconditions

1. **Pin the commit** (a worktree at the commit landing `docs/ISSUE-1-DESIGN.md` and `src/open/__tests__/harm.test.ts`);
   the probe refuses a dirty tree (`--allow-dirty` overrides, and says so in RESULTS).
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any
   other model stops the probe. Note Shep's traffic in RESULTS.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`
   (CLAUDE.md, "One driver at a time" -- OPEN-VARIANT.md §75 measured the referee non-deterministic under two).
4. **No arm variables set**: leave every `PRISONER_*` arm unset, `PRISONER_HARM` above all -- the probe sets it
   per arm itself (`off`, then `on`) and records it. Presence must resolve to `modelled` (the default since
   2026-09-27); the probe refuses to run otherwise, since a person is never a legal referee target under `off`.

## Command

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-harm/probe.mts --dry-run

PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_THINK_TIMEOUT_MS=300000 PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-harm/probe.mts --live

npx tsx checkpoints/2026-09-28-harm/probe.mts --score
```

13 items x 2 arms x N=3 = 78 rulings, most with one one-act call on top (`PRISONER_ONE_ACT=first`, the default):
roughly 20-30 minutes on the local card, most of it `HB-r10`'s nine-half-round replay (no model calls -- replay
answers from the recorded transcript, never a fresh ruling) plus the live rulings themselves.

## What NOT to do

- Do not build a referee with `createReferee`'s bare defaults for this measurement (the D11 fidelity bug,
  OPEN-VARIANT.md §68.8): every request here goes through `../2026-09-28-probe-kit/kit.mts`'s `refereeOptions`,
  which reads the SAME env-driven arms `src/checkpoint.ts` does, `harm` included.
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first
  `--live` call (append-only; a rerun resumes from `results.jsonl`'s own `sampleId`s).
- Do not read a control's "changed" prediction as a property change -- `wear`/`posture` and `wear`/`sight` are
  both legitimate non-harm rulings; the prediction is about the `target`/`effect` pair only. The per-item table
  in `--score`'s own output reports property (and applicability) beside it.
