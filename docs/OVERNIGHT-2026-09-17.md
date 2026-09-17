# Overnight 2026-09-16 → 2026-09-17: morning report

Written for: Derek, reading it first thing. Updated as the night goes; the newest state of each item is
what's below. Evidence lives in `checkpoints/2026-09-17-overnight/` and in OPEN-VARIANT.md §34 onward.

## Status at a glance

| Item | State |
|---|---|
| 1. §5.3 on a fixed batch (≥4 games, model warden, qwen3:14b referee) + a passive game | **DONE.** §5.3 holds on batch F (4 games): 0 fog leaks in 82 contexts, all effects cited, novelty in all 4, 7 impossible rulings with reasons, replay 99.5/99.4/97.6/98.2%. Passive game escaped r6. OPEN-VARIANT §35. |
| 2. Condition list as a generic mechanism, A/B in real games | code built behind a switch (`1c1bb58`); pre-game controls next |
| 3. mother-of-invention produces a measured change | idea 1 (regenerate when nothing unseen) built on branch `overnight-dev` (`4d46490`); games pending |
| 4. Libraries released and consumed | nothing needed yet |

## Log

- 20:19 CDT. doris empty. Pushed the-prisoner's two pending commits (`abd04f1`, `c5b0d83`). 628 tests green.
- 20:20. First launch of batch F died at round 1: my driver script left out `PRISONER_THINK_TIMEOUT_MS`,
  so every call hit the package's 12 s default and went silent. Killed within a minute, before it wrote a
  transcript (nothing to commit), unloaded the `qwen3:14b` it had loaded, relaunched with batch E's 180 s
  timeouts at 20:21.
- 20:40. `1c1bb58`: condition list code (item 2). The running batch executes `tsx` from the working tree,
  so games 2-4 of batch F run this commit. With the switch unset, all four prompt paths are byte-identical
  to the commit before (dumped and compared), so the baseline is unchanged; the only difference is one
  extra "Conditions: OFF" line in the transcript header.

- 21:28. Batch F game 1 (`checkpoints/2026-09-17T01-21-32-000Z.md`): caught r7, 13 intents, 0 impossible,
  13/13 cited, 0 fog leaks. She had one turn with the bar at 40 and scraped it to 25 ("Attempt to pry the
  bar out" was her own 5th candidate). Batch E's failure again. The driver then stopped the batch on
  purpose: the checkpoint leaves its last model loaded and the driver refuses a non-empty card. Fixed the
  driver to unload the batch's own two models after each game and wait for an empty card; relaunched
  games 2-4 + passive.
- `analyze.mts` reads transcripts for the §34 measure (prisoner turns with the bar at or below 50 by her
  own belief and nothing open yet, classified by the referee's effect key). On batch E it reproduces
  §33.9's hand count exactly: 1, 1, 2 such turns, 0 attempts.

- 21:06-22:07. Batch F done (§35): caught r7, r6, r18, r6; passive escaped r6. Replays N=5 done.
  F3 is the interesting one: she **opened the window** at r15 and then pried the bar for two turns instead
  of leaving, and was caught at r18. Added "an open way out unlocks leaving" to the condition list
  (`467f101`) before any game used it. Merged `overnight-dev` into main (all off by default, 644 tests).

## Decisions for Derek

**D1. Where condition-list generation lives. Chosen for tonight: the caller (the-prisoner), as a generic
file.** `src/open/conditionList.ts` holds the renderer and the `Condition` type, and a test keeps game
words out of it, the same way `pick.ts` is held. `src/open/conditions.ts` is the game side: it builds the
conditions from the constants the game already enforces.
- *Why this one:* it is the easiest to undo. Nothing is published, and moving the file later is one
  commit here plus a release there. mind-seam was extracted only once two real callers needed the same
  seam, and its CLAUDE.md keeps prompt text with the caller. run-dmcp never calls a mind, and these
  thresholds live in the game's code, not in the engine's declared constraints.
- *Alternatives:* (a) mind-seam, as an optional pure export `renderConditionList`, a patch release;
  (b) run-dmcp, generating conditions from declared constraints/gates, which would need the engine to
  hold "unlocks" and "ends" as data, which it does not today; (c) a new small package.
- *What would change it:* a second caller. If brink's rival minds get the same list, (a) is the move.
  If the list turns out to be worth generating from engine-declared gates (so every run-dmcp game gets it
  for free), that argues for (b) and an engine issue.

(more below as they come up)

## Versions published

None yet.
