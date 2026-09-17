# Overnight 2026-09-16 → 2026-09-17: morning report

Written for: Derek, reading it first thing. Updated as the night goes; the newest state of each item is
what's below. Evidence lives in `checkpoints/2026-09-17-overnight/` and in OPEN-VARIANT.md §34 onward.

## Status at a glance

| Item | State |
|---|---|
| 1. §5.3 on a fixed batch (≥4 games, model warden, qwen3:14b referee) + a passive game | **DONE.** §5.3 holds on batch F (4 games): 0 fog leaks in 82 contexts, all effects cited, novelty in all 4, 7 impossible rulings with reasons, replay 99.5/99.4/97.6/98.2%. Passive game escaped r6. OPEN-VARIANT §35. |
| 2. Condition list as a generic mechanism, A/B in real games | **DONE, positive.** Built generic (`1c1bb58`, `467f101`, `0f7ad18`), open items 2 and 3 fixed. Probe first (§34.1), then real games: **batch G (list) escaped 4/4 (r7, r7, r6, r6); batch F (same config, rule sentences) was caught 4/4.** She acted on the unlock 4/4 vs 1/6; one premature removal in 18 turns above the line. §34.2. Warden half (`PRISONER_CONDITIONS=both`) built, probe queued |
| 3. mother-of-invention produces a measured change | running. Idea 1 = regenerate once when nothing unseen (`1166b88`). The first pair ran with precedent OFF, where pick almost never lacks an unseen candidate (H1 stuck 0/6, I1 1/6), so it cannot measure regeneration. Rerunning as batch J with precedent ON (§32's 22-episode ledger, fresh copy per game), 3 vs 3. Port to the package is ready on a local branch (`c76591d`), unreleased |
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

- 22:07-22:40. Probe (§34.1). The whose-marking works (9 of 9 references read a warden condition as a
  threat). v1's unlock wording "the window can be opened" was read as "is open" 3/10 times, giving
  premature climbs; v2 "Mara Voss can open the window" fixed it (10/10, none premature). Two variations of
  one idea, inside the stop rule.
- 22:42. Queue 2 launched: batch G = 4 games with `PRISONER_CONDITIONS=list`, otherwise identical to F;
  then H (pick=even) and I (pick=even-regenerate) alternating, 4 games each.

- 23:13. Batch G done: **4 of 4 escaped** with the list, against batch F's 4 of 4 caught (§34.2).
  Every G prisoner opened the window at her first chance and left on her next turn. The warden, whose
  prompt was unchanged, perceived "Mara Voss opens the window." and then examined the tile or the bar's
  mortar. Built `PRISONER_CONDITIONS=both` (warden gets its own reading) on the dev branch, and queued a
  warden probe on those exact turns to run after the pick batches.

- 23:13-23:55. H1 (pick=even, precedent off): escaped r12; forced 6, overridden 4, nothing unseen 0.
  I1 (pick=even-regenerate, precedent off): caught r14; forced 6, overridden 6, nothing unseen 1,
  regenerated once and found 2 unseen. My mistake: §32's bottleneck was measured with the precedent
  ledger on, and without it "seen" is only this game's few sightings. Stopped the precedent-off series
  after H2 (it finishes and is committed like every run) and queued batch J with the ledger.

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
