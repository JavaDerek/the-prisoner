# P5 -- the contest batch: how to run it

Scaffolding written 2026-09-27; no game has run. `PREDICTION.md` is a DRAFT until the owner commits it unchanged
before the first game -- including its one decision (the prisoner's chair).

## Files

- `run-batch.sh` -- the ONE driver: preconditions, then each game serially with every variable set explicitly,
  transcripts moved into `A/` and `B/`, logs into `logs/<arm>-<n>.txt`, the scoreboard after every game.
- `env-check.mts` -- run before every game: reads its environment through the game's own `read*Mode` functions and
  refuses to start a game that is not its arm.
- `scoreboard.mts` -- so-far / projected at N=6 / DEAD-OPEN per prediction, over the transcripts' structural lines.

## Preconditions

1. **Pin the commit**: `git worktree add /tmp/prisoner-p5 <sha of the committed PREDICTION.md>`, `npm install` (or
   symlink `node_modules`), and run from there. The driver refuses tracked changes (`ALLOW_DIRTY=1` overrides; say
   so in RESULTS). Every transcript prints `Code revision:`; the scoreboard stops on more than one.
2. **Check the card first**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` resident for Shep is our model
   and stays loaded; the driver refuses to start a game if anything else is loaded. Shep's production calls share
   the runner's two slots: schedule the batch when Shep is quiet, or accept that noise and say so (CLAUDE.md,
   OPEN-VARIANT §75.2). Check `ollama --version` names `+pr18687` (P9).
3. **One driver**: no probe, no other game. The driver takes `/tmp/the-prisoner-one-driver.lock` and refuses if a
   `src/checkpoint.ts` process is already running.
4. **Detached, not in a Bash tool's background mode**: `nohup ./run-batch.sh > logs/driver.txt 2>&1 & disown`.

## Command

```bash
cd /tmp/prisoner-p5
bash checkpoints/2026-09-28-contest-batch/run-batch.sh --dry-run          # every env, checked; no network
nohup bash checkpoints/2026-09-28-contest-batch/run-batch.sh \
  > checkpoints/2026-09-28-contest-batch/logs/driver.txt 2>&1 & disown     # A1 B1 A2 B2 ... A6 B6
npx tsx checkpoints/2026-09-28-contest-batch/scoreboard.mts               # any time
```

`PRISONER_MODEL_URL` defaults to `http://doris:11434/v1`. Only if the owner's decision says so:
`P5_PRISONER_CHAIR=<hosted model> bash .../run-batch.sh ...` (and the router, per CLAUDE.md "A model that is not on
doris goes through the model router"). A stopped batch resumes: a token whose game already ran is skipped.

Twelve games of ten rounds, three Muse calls or so per half-round: expect about six hours.

## What NOT to do

- Do not run two drivers, or a probe beside the batch (b6: six of its refusals were the second driver).
- Do not export an arm variable around the driver "to try something": the driver sets every one, and
  `env-check.mts` will refuse the game.
- Do not merge anything into the pinned worktree mid-batch; do not edit `PREDICTION.md` after the first game.
- Do not pool a human game with these (the scoreboard quarantines a header with a person in a chair).
