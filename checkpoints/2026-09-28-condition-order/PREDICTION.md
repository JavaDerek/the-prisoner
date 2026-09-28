# the-prisoner#23 -- condition order: predictions

**Pre-registered 2026-09-27 (night) by Claude under the owner's overnight delegation** ("the owner is asleep and
has delegated every decision"). Scaffolded against the tree that adds `PRISONER_CONDITION_ORDER`
(`src/open/conditions.ts`, `src/checkpoint.ts`) on top of the 2026-09-27 defaults (D1-D16). No game has run:
`run-batch.sh --dry-run` printed every game's environment and `env-check.mts` confirmed, through the game's own
readers, that each arm reads what this file says; `scoreboard.mts --dry-run` scored an existing transcript
(`checkpoints/2026-09-28T01-09-16-356Z.md`) as a fixture to exercise the parser (its header is not this batch's
arm on purpose -- a human seat, presence-off game -- so its own mismatch report is expected, not a bug).

## What is asked (the-prisoner#23, filed at OPEN-VARIANT.md §50.7)

Twenty-two games across three door-price arms (§50.5, §50.7) all shared one thing nothing tested for: **condition
1 is always the window.** She plans the window from round 1 in all twenty-two of them, whatever the door costs --
free, priced at a threshold of 30, priced at margin (60). §50.7's own reading is that she takes the door only when
it costs nothing, and prices it out of her plans at any gate at all -- "distance, not danger", her own words. But
because the window has always been named first, that reading is confounded with a simpler one: **the route named
FIRST in her list is the route she plans**, and the door's price may be doing none of the work.

This batch tests it the way §50.7 itself proposed: hold `margin` fixed (the door gated on the lock at or below 60,
today's default, D6') and state the door's own condition BEFORE the window's -- change nothing else.

## Arms (N = 4 each, ten rounds, all-Muse, `PRISONER_SKIP_VOICE=1`, ONE driver, serial, from one pinned commit)

| | arm A (control) | arm B |
|---|---|---|
| `PRISONER_CONDITION_ORDER` | `window-first` (the default -- byte-identical to every batch before this arm) | `door-first` -- the only difference |
| everything else | today's defaults (2026-09-27, D1-D16): presence modelled, absence cadence, conditions both, door stated, door price margin, block on, one act first, person instrument off | identical |

All three chairs `muse-glimmer:30b` (CLAUDE.md, local play is all-Muse), thinking off both roles, voice SKIPPED
(`PRISONER_SKIP_VOICE=1` -- this batch's measures are process measures: rulings and a plan read by a human, never
a transcript meant to be read for its own sake, so the voice call buys nothing here, CLAUDE.md "Test runs skip
the voice model for reasoning-only work"). `run-batch.sh` sets every variable a game reads, explicitly, per game,
and alternates the arms (A1 B1 A2 B2 A3 B3 A4 B4) on the one driver. `env-check.mts` refuses to start a game whose
environment is not its arm; `scoreboard.mts` reports (not silently trusts) a game whose transcript header is not
its arm.

**N = 4, not 22 or 6.** The issue asks for four games an arm, matching §50.7's own per-arm N and its own
"testable at one line's cost" framing. §46.6's own lesson about this exact kind of screen -- a control cell moved
from 3/24 to 9/24 with nothing changed between two runs -- means a null or a marginal result here is NOT strong
evidence either way; it would take several times this N to resolve a modest effect. This batch is built to answer
the sharp question the issue actually poses (does the FIRST-named route dominate, cleanly), not to produce a
publishable effect size.

## Predictions (the issue's own, verbatim)

Per game, read the referee's own closed `target` key for every prisoner half-round (never English: CLAUDE.md
"never pattern-match meaning"), classified as:

- **door route**: `target` is `door`, `lock`, or **`key_ring`** -- D15 (2026-09-27, landed after §50.7's batch)
  made a held key ring a third way to open the door (`OPEN_PASSAGE` reads its own `owner_id`), so a game that
  takes the ring and then opens the door on it is a door-route game exactly as one that wears the lock down is.
  §50.7's own 22 games predate D15 and never had this route available at all -- one more reason this is a
  near-replication of that corpus's WORLD, not a byte-identical one (see "What this is not", below).
- **window route**: `target` is `window` or `bar`.
- **other**: anything else (spoon, cot, loose_tile, blanket, bucket, meal_tray, warden, prisoner, ...), reported,
  no weight.

1. **Order decides** if door-first moves her FIRST route ruling to the door in **at least 3 of 4** games, and
   window-first's first route ruling stays at the door in **at most 1 of 4**.
2. **Price decides after all** (§50.7's own reading holds) if **both** arms stay at the door in at most 1 of 4 --
   i.e. door-first does NOT move her, and the confound §23 raised turns out not to have been operative.
3. Anything between those two readings (e.g. door-first moves her in 2 of 4) is reported as neither confirmed nor
   refuted, per §46.6's own caution about a screen at this N.

Reported, no weight, never used to call the verdict above:

- The round of her first ruling on each route, per game (not just whether it happened) -- `scoreboard.mts` prints
  both, so a reader can see how close a "never" was to a "very late".
- The count of her rulings on each route, per game -- a game that reaches the door once late is a different
  result from one that reaches it and stays.
- **Her round-1 plan, printed verbatim by `scoreboard.mts`, for a human to read.** This is deliberately NOT
  classified by code: CLAUDE.md's "never pattern-match meaning" is about the referee's own closed keys, and a
  plan's route is a judgement about prose the referee never ruled on. The issue's own §46.2/§45 lesson ("score the
  plan, not the intent") is honoured by SHOWING the plan, not by writing a second, unaudited classifier for it.

## What this is not

**Not a replication of §50.5/§50.7's 22-game corpus.** Those games ran before 2026-09-27: no `block`, no modelled
presence, no absence cadence, `PRISONER_ONE_ACT` off, no `sight`, no key ring gate at all. This batch runs under
every 2026-09-27 default (D1-D16) with `margin` held fixed and only the order changed -- a near-replication of
§50.7's WORLD under a different, later ruleset, per OPEN-VARIANT.md §80.3's own rule that anything after that date
is a near-replication and says so. In particular `block` stays ON (today's default) in both arms here, which
§50.7's corpus never had to contend with: a warden who blocks the window could suppress her first route ruling on
it independently of order, muddying a "never touched the window" reading. This is reported if it happens
(`scoreboard.mts`'s per-game line shows every route's ruling count, so a reader can see whether a blocked window
correlates with a route switch) but it is not controlled for -- the issue's own build instructions ask for "all
today's defaults otherwise", not a `block=off` arm, and a second factor is exactly what N=4 cannot resolve anyway.

## Stopping rules

- A game whose header does not name this batch's arm, or that names no single clean revision, is reported by
  `scoreboard.mts` under "HEADER MISMATCH" and does not count toward either prediction; the batch reruns that
  token after the cause is fixed.
- More than one revision among the games kept stops the batch (CLAUDE.md "run a batch from a pinned commit").
- The driver's watchdog (`run-batch.sh`, `STALL_SECONDS`, default 1800) kills a game silent for 30 minutes; it is
  quarantined the same way `2026-09-28-contest-batch` quarantines one.

## The live command

```bash
cd checkpoints/2026-09-28-condition-order
./run-batch.sh --dry-run          # verify preconditions and both arms' environments first, no network
./run-batch.sh                    # the batch: A1 B1 A2 B2 A3 B3 A4 B4, one driver, serial
```

Run from a pinned commit (a worktree is cheapest, CLAUDE.md), with the model router or doris quiet (no other
`src/checkpoint.ts`, no probe sharing the lock at `/tmp/the-prisoner-one-driver.lock`). After the batch:

```bash
npx tsx checkpoints/2026-09-28-condition-order/scoreboard.mts checkpoints/2026-09-28-condition-order
```
