# the-prisoner#23 -- condition order: how to run it

Scaffolding written 2026-09-27; no game has run. `PREDICTION.md` is the pre-registered prediction, written before
any game and not to be edited after the first one.

## Files

- `run-batch.sh` -- the ONE driver: preconditions, then each game serially with every variable set explicitly,
  transcripts moved into `A/` and `B/`, logs into `logs/<arm>-<n>.txt`, the scoreboard after every game.
- `env-check.mts` -- run before every game: reads its environment through the game's own `read*Mode` functions
  (including the new `readConditionOrder`) and refuses to start a game that is not its arm. Self-contained --
  does not depend on `../2026-09-28-probe-kit/kit.mts`'s `GameArms`, which predates `PRISONER_CONDITION_ORDER`.
- `scoreboard.mts` -- per game, the round of her first ruling on each route (door: `door`/`lock`/`key_ring`;
  window: `window`/`bar`), the count of rulings on each, and her round-1 plan printed verbatim (never classified
  by code). Reuses `parseRecordedText` from the probe kit read-only.

## Preconditions

1. **Pin the commit**: check out the commit this scaffolding landed on (a worktree is cheapest), `npm install` (or
   symlink `node_modules`), and run from there. The driver refuses tracked changes (`ALLOW_DIRTY=1` overrides; say
   so in RESULTS). Every transcript prints `Code revision:`; the scoreboard flags more than one.
2. **Check the card first**: `curl -s http://doris:11434/api/ps`. `muse-glimmer:30b` is our model and Shep's; the
   driver refuses to start a game if anything else is loaded. Shep's production calls share the runner's two
   slots: schedule the batch when Shep is quiet, or accept that noise and say so (CLAUDE.md, OPEN-VARIANT §75.2).
   Check `ollama --version` names `+pr18687` (P9).
3. **One driver**: no probe, no other game, at the same time. The driver takes
   `/tmp/the-prisoner-one-driver.lock` (the same lock every 2026-09-28 probe takes) and refuses if a
   `src/checkpoint.ts` process is already running.
4. **Detached, not in a Bash tool's background mode**: `nohup ./run-batch.sh > logs/driver.txt 2>&1 & disown`.

## Command

```bash
cd checkpoints/2026-09-28-condition-order
./run-batch.sh --dry-run                                           # every env, checked; no network
nohup ./run-batch.sh > logs/driver.txt 2>&1 & disown                # A1 B1 A2 B2 A3 B3 A4 B4
npx tsx checkpoints/2026-09-28-condition-order/scoreboard.mts       # any time; final read after the batch
```

`PRISONER_MODEL_URL` defaults to `http://doris:11434/v1`. A stopped batch resumes: a token whose game already ran
(marked by `A/.game-N` / `B/.game-N`) is skipped.

Eight games of ten rounds, `PRISONER_SKIP_VOICE=1` (one fewer model call per half-round than a voiced batch):
expect a few hours, not the contest batch's six.

## Verifying the scaffolding without a live model

```bash
./run-batch.sh --dry-run                                                   # env-check against both arms
npx tsx checkpoints/2026-09-28-condition-order/scoreboard.mts --dry-run    # parses an existing transcript
```
The dry-run fixture (`checkpoints/2026-09-28T01-09-16-356Z.md`) is a human-seat, presence-off game -- not this
batch's arm -- so its own header-mismatch report is expected; it exists only to show the parser finds the right
`target` rows and the right plan line, which it does (first door-route ruling at round 7 via `key_ring`, first
window-route ruling at round 1 via `bar`, in that transcript).

## What NOT to do

- Do not run two drivers, or a probe beside the batch (CLAUDE.md, b6: six of its refusals were the second driver).
- Do not export an arm variable around the driver "to try something": the driver sets every one, and
  `env-check.mts` will refuse the game.
- Do not vary anything but `PRISONER_CONDITION_ORDER` between arms A and B -- the issue's own test is one line's
  cost, and a second changed variable makes the result unreadable at N=4.
- Do not edit `PREDICTION.md` after the first game.
- Do not pool a human game, or a pre-2026-09-27 game, with these (the header names the arm and the batch
  boundary; §50.5/§50.7's 22 games are a different world, see PREDICTION.md "What this is not").
