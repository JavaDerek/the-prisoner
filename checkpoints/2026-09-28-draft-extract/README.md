# P-DE -- draft-then-extract vs one-pass: how to run it

Scaffolding written 2026-09-28; no model has been called. This checkpoint answers `the-prisoner#9` SS1's own
proposed measurement: "same intents, one-pass vs draft-then-extract, compare rulings," against the D11 corpus
(`checkpoints/2026-09-26-human-intents/corpus.json`, 95 rows).

## Preconditions

1. **Pin the commit** (a worktree at the commit holding this checkpoint's committed files); the probe refuses a
   dirty tree (`--allow-dirty` overrides it, and RESULTS.md must say so if used).
2. **Check the card**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is fine; any other
   model stops the probe (`assertNoForeignModel`). Note Shep's traffic in RESULTS.md if there is any.
3. **One driver**: nothing else on doris; the probe takes `/tmp/the-prisoner-one-driver.lock`
   (CLAUDE.md "one driver at a time, or the referee is not deterministic").
4. **No arm variables**: leave every `PRISONER_*` arm unset except the ones the command below sets. `oneAct` is
   already overridden to `"off"` inside the probe itself (see `PREDICTION.md`); setting `PRISONER_ONE_ACT` on the
   command line has no effect on this probe's own two arms.

## Commands

```bash
cd <pinned worktree>
npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --dry-run

PRISONER_MODEL_URL=http://doris:11434/v1 \
PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
PRISONER_REFEREE_TIMEOUT_MS=300000 \
  npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --live

npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --score
```

`--live` resumes from `results.jsonl` if interrupted (`checkpoints/2026-09-28-probe-kit/kit.mts`'s own
`resultsFile`, matching `checkpoints/2026-09-26-human-intents/probe.mts`'s discipline). `--only=ID,ID` restricts
either mode to a subset of the 95 corpus rows, by id (`corpus.json`).

**Estimated time**: ~2.75-3 hours total, serially -- `one-pass` (95 calls, ~55 min, matching D11's own measured
rate) then `draft-extract` (190 calls: a draft call plus an extraction call per row, ~110 min). See
`PREDICTION.md`'s "Time cost" section for the estimate's basis; `--score` reports the real median per arm once
`results.jsonl` has rows.

**PRISONER_REFEREE_MODEL** is read by the probe's own `draftText` function (via `resolveRefereeModel`) for the
draft call, so it stays the SAME model the extraction call uses by default; set it explicitly only to test the
draft call against a different model than the extraction call, which is not what this probe's own prediction
measures and would need its own PREDICTION.md note if done.

## What NOT to do

- Do not replay a recorded `.referee.json` or `results.jsonl` request from a DIFFERENT checkpoint: this probe
  rebuilds every context fresh from the corpus's own `sourceFile`/`round` (`corpusItems`, `rebuildContext`), per
  `prisoner-measurement-fidelity`.
- Do not run beside anything else on doris; do not edit `PREDICTION.md` or `results.jsonl` after the first call.
- Do not add a `PRISONER_*` env var to turn `draft-extract` into a real game arm as part of running this probe --
  that is a `src/` change with its own TDD, own default-off arm, and own transcript-header line, and is out of
  this checkpoint's scope (a probe, not a game change) regardless of what the probe finds.
- Do not conflate this measurement with P1's one-act call (`checkpoints/2026-09-28-first-act/`): both arms here
  run with `oneAct: "off"`, deliberately, so nothing here says anything about the one-act reading.
