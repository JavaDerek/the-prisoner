# P5 -- the contest batch: predictions

**DRAFT -- not pre-registered until committed unchanged before the first call, by the owner.** Scaffolded
2026-09-27 against the tree at `ac47293`, the commit that made every default the build landed (D1-D12, the spec's
decisions) the game's default. No game has run: `run-batch.sh --dry-run` printed every game's environment and
`env-check.mts` confirmed, through the game's own readers, that each arm reads what this file says;
`scoreboard.mts --dry-run` scored the owner's playtest as a fixture to exercise the parser. Change a number here
only before the first game.

## What is asked

Whether the design's contest is a contest: with the warden reading his own list (D3), able to prevent as well as
detect (`block` as an occupation, D4'; his restores stated, D4b), a `close` that a spent part refuses (D11), a
person's `sight` (D12, band at 60), the warden out of the cell every fourth round (D5, the fixed cadence the owner
chose over RED-TEAM.md F10's cost-of-an-act), and the door at `margin`, stated (D6'). And, against arm B, whether
`block` changes anything.

## Arms (N = 6 each, ten rounds, all-Muse, ONE driver, serial, from one pinned commit)

| | arm A | arm B |
|---|---|---|
| every default since 2026-09-27 | yes | yes |
| `PRISONER_BLOCK` | `on` (the default) | `off` -- the only difference |

All three chairs `muse-glimmer:30b` on doris's Ollama, thinking off, voice on (`PRISONER_SKIP_VOICE` unset),
timeouts 300000 ms. `run-batch.sh` sets every variable a game reads, explicitly, per game, and alternates the arms
(A1 B1 A2 B2 ... A6 B6) on the one driver. `env-check.mts` refuses to start a game whose environment is not its arm;
`scoreboard.mts` quarantines a game whose transcript header is not its arm.

## Predictions (the design's, verbatim, with the corrections below)

Arm A:
1. **The prisoner escapes in 2 to 4 of 6.**
2. **The warden catches in 2 to 4 of 6.**
3. **Timeouts at most 2 of 6.**
- **Kill either way: 0 escapes** (unwinnable, back to the design's §2) **or 6 escapes** (the warden's tools are inert).
4. **The warden rules `block` in at least 4 of 6 games** -- **kill: 1 or fewer** (design R2's P5 kill).
5. **The warden rules `restore` in at least 2 of 6 games.**
6. **At least 4 of 6 games have the warden examine an open way out on his next turn after it opens** (R4 in play) --
   "next turn" is his next half-round that the cadence did not skip.
7. **Arm A vs B: escapes in B exceed A by at least 1.** If B does not exceed A, `block` changed nothing, and RESULTS
   says so in those words.
8. Model prisoner intents ruled against `warden`: **0-1 of 6 games** (reported, no weight; §57.2).
9. **The prisoner's act in the first absence round (round 4, where the transcript shows his half skipped) is on a
   way out -- `window` or `door` -- in at least 3 of 6 games** (she reads the rhythm).

Reported, no weight: 9 widened to the ways' parts (`bar`, `lock`); games where the prisoner acts on the door or the
lock at all (RED-TEAM.md §4: §50.7 found a model never aims at a priced door, so the design's silence here is a
prediction of 0); arm B's escapes and catches.

Counts are over the referee's keys and the transcript's own structural lines: an escape or a catch is the `## Result`
line; a way out opening is its outcome line `- window_passage: 0 -> 1` (or `door_passage`); an examination is the
referee's `reveal` on that way out.

## Corrections, and what the scaffolding decided

- **RED-TEAM.md F1 said the design's own kill fires by construction** when `block` is a free, permanent position.
  The spec landed F11's occupation (D4') and F3's refused `close` (D11), which are the levers F1 named, and the
  cadence rather than F10's cost-of-an-act (the owner's call, after external review). So the kill on 0 escapes is
  kept verbatim and now measures the arithmetic as built, not an arithmetic known to be unwinnable.
- **RED-TEAM.md §4: 9's measure is confounded** by who blocks where; it is kept, and read beside 4.
- **The D12 band is 60** (the spec, after external review), not the design's 25; the batch uses whatever the tree
  says, and the header line `Presence: MODELLED` names it.
- **Decision for the owner (one question): the prisoner's chair.** CLAUDE.md "Local play is all-Muse": b6's 14
  all-Muse games were 14 timeouts, 0 escapes -- "outcome measures have no variance locally ... put a hosted model in
  the PRISONER's chair when an outcome is the dependent variable." Predictions 1, 2, 7 and the 0-escape kill are
  outcomes. **Run the batch all-Muse, as the spec says?** Recommended: yes, as the spec says, reading a 0-escape
  result as "the Muse prisoner, or the arithmetic" and not as the arithmetic alone. *Yes*: the batch as scaffolded.
  *No*: set `P5_PRISONER_CHAIR` to the hosted model's name for every game (`run-batch.sh` names it in every log and
  the transcript's header names the chair); the warden and referee stay Muse, and this file says which in its arms
  table before the first game. Either way, comparing this batch with a llama-server batch (b3-b7) is a runtime
  change, not a replication (CLAUDE.md).
- **Arms alternate on one driver**: b6's two drivers are why CLAUDE.md forbids interleaving drivers; alternating
  games on ONE serial driver is not that, and it spreads Shep's traffic and the card's drift over both arms.

## Stopping rules

- A game whose header is not its arm, or that names no single clean revision, or that has no `## Result` line, is
  quarantined by `scoreboard.mts` and does not count; the batch reruns that token after the cause is fixed.
- The driver's watchdog kills a game silent for 30 minutes; it is quarantined.
- **A dead prediction is announced at the poll it dies** (the scoreboard prints after every game). A KILL that fires
  in arm A is announced the same way; the batch still finishes arm B (the kill's control) unless the owner stops it.
- More than one revision among kept games stops the batch.

## Scoreboard convention

`scoreboard.mts` after every game (run-batch.sh prints it): so-far, projected at N = 6 (linear), DEAD/OPEN; for a
KILL row, DEAD means the kill fired.

## What the outcomes mean, written before any call

- **1-3 and 7 hold** -- a contest: both sides win sometimes, and prevention matters. The owner's next human game
  (design §8 step 8) is the real test.
- **KILL-0** -- no line wins against this warden in ten rounds on this card; with an all-Muse prisoner, check the
  prisoner's chair before the arithmetic (the decision above).
- **KILL-6** -- the warden's tools are inert; P2's reach numbers say which.
- **7 fails** -- `block` changed nothing; it stays in the game only if P2 shows the warden reaching for it.
