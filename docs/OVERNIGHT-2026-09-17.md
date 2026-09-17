# Overnight 2026-09-16 → 2026-09-17: morning report

Written for: Derek, reading it first thing. Updated as the night goes; the newest state of each item is
what's below. Evidence lives in `checkpoints/2026-09-17-overnight/` and in OPEN-VARIANT.md §34 onward.

## Status at a glance

| Item | State |
|---|---|
| 1. §5.3 on a fixed batch (≥4 games, model warden, qwen3:14b referee) + a passive game | **DONE.** §5.3 holds on batch F (4 games): 0 fog leaks in 82 contexts, all effects cited, novelty in all 4, 7 impossible rulings with reasons, replay 99.5/99.4/97.6/98.2%. Passive game escaped r6. OPEN-VARIANT §35. |
| 2. Condition list as a generic mechanism, A/B in real games | **DONE, positive, both sides.** Generic renderer + game data (`1c1bb58`, `467f101`, `0f7ad18`, `1274ab6`); open items 2 and 3 fixed. Prisoner: probe first (§34.1), then **with the list she escaped 6 of 6; with rule sentences 2 of 6** (same config, alternating for the last 2+2); she tried at her first removable turn 6/6 vs 2/6 (§34.2, §34.5). Warden: probe 0/20 → 20/20 looks at the open window, controls unmoved (§34.3); **batch K (both) caught 4/4, every one by a look at the window she had just opened** (§34.4). |
| 3. mother-of-invention produces a measured change | **DONE, qualified positive.** Idea 1 (regenerate once when nothing unseen) fixes the failure §32 named: with the ledger on, forced turns that did something unseen went **23% → 65%** (3/13 → 13/20). Regeneration turned 6 of 11 stuck turns into the mind's own new ideas (door bolt, wire hook, sharper spoon). **Free turns unchanged** (3 novel of 15 vs 3 of 22) and outcomes no better, so the mind still doesn't choose new things unforced. OPEN-VARIANT §36 |
| 4. Libraries released and consumed | **DONE.** mother-of-invention **0.1.2** (pick + regenerate as mechanism 2) published by tag through release.yml (CI and Release green); the-prisoner pins it exactly and its local `pick.ts` is gone (`b9b0390`). The condition list stays in the-prisoner by decision D1, so no mind-seam or run-dmcp release was needed |

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

- 00:05-02:14. Batch J (§36.2): pick=even escaped r10, r9, caught r10; pick=even-regenerate caught r18,
  r14, escaped r12. Measures above.
- 02:10. Ported pick+regenerate to mother-of-invention (tests moved with it, vocabulary guard green,
  README and CLAUDE.md say what it was measured to do, including the free-turn caveat), released 0.1.2 by
  tag, consumed in the-prisoner test-first (tests pointed at the package, red on 0.1.0, green on 0.1.2).

- 02:32-03:01. Warden probe (§34.3): 0/20 → 20/20. Batch K (list for both): 4 catches at r6, each the
  turn after she opened the window, each by `reveal window.passage`. K4's audit reported 1 leak; it was a
  false positive (the other side's text inside the warden's own earlier plan), fixed test-first
  (`20e8776`), transcript left as recorded.
- 03:02. Queued 2 more baseline and 2 more list-for-prisoner games, alternating, to add power to F vs G.

- 03:02-03:31. Two more games a side (§34.5): baseline F5 escaped r8, F6 escaped r6; list G5, G6 escaped
  r6. Final: list 6/6, baseline 2/6. F5 lost a turn to a reproducible referee miss (a pry wording ruled
  target none, 3/3 on replay).
- 03:35. doris left empty (`/api/ps` → no models). Handoff memory updated to point here.

## What stopped, and why

- **Nothing hit the stop rule.** The one idea that needed variations (the unlock's wording) worked on its
  second variation. Regeneration was idea 1 for candidate generation, and it worked on its own measure.
- **The precedent-off pick pair (H1, I1, H2) was stopped by me, not by a result.** It could not measure
  regeneration (pick was almost never stuck without the ledger), so it was rerun as batch J with the
  ledger. Its three transcripts are committed.
- **Not attempted tonight:** a mechanism that changes free-turn novelty (D2); giving brink the list (D4);
  whether a prisoner who reads the warden's condition 6 plans around it (§34.4). run-dmcp and mind-seam
  were not changed. No release failed.
- **Two mistakes of mine, both caught within minutes:** the first batch launch left out the 180 s think
  timeout (every call silent, killed before a transcript), and the driver first refused to start game 2
  because the checkpoint leaves its last model loaded. Both are fixed in `run-batch.sh`.

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

**D2. Should pick (now mother-of-invention 0.1.2) be judged by forced turns or free turns?** I released
it because it does what it claims against a real caller, and the README states that free turns did not
change. If you hold the §21 line that only free-turn behaviour counts, the honest label is "a working
force, not yet a novelty mechanism", and the next idea is something that changes free turns (e.g. carry a
forced turn's result into the plan). If forced-turn novelty counts, item 3 is simply done.

**D3. Does the condition list become the default?** Batch G escaped 4/4 where F was caught 4/4, with one
premature removal attempt. Making `PRISONER_CONDITIONS=list` the default changes every future baseline
(and every earlier batch stops being comparable). I left it a switch. Yes = new baseline from here; no =
it stays an arm.

**D4. Is the condition list a mind-seam export now?** Tonight it has one caller (this game) and two
readers (both minds), and it changed both minds' behaviour in real games. mind-seam was extracted at
two callers, so by that precedent the answer is "not until brink uses it". If you'd rather brink's
rival minds try it straight from the package, it's a pure function plus a type (a patch release) and
moves as a file.

**D5. The referee miss on "Attempt to pry the bar out of the mortar using the spoon"** (§34.5): ruled
target/effect `none` 3 of 3 on qwen3:14b, while other pry wordings rule `open`. Answering "capture the raw
replies and fix it like §33.16" means a referee session with the 26-intent controls. Answering "leave it"
means that wording keeps costing a turn in some games, which slightly favours the list arm (its intents
echo "Open the window", which always ruled cleanly).

## Versions published

- **mother-of-invention 0.1.2** (2026-09-17 ~02:10 CDT), tag `v0.1.2`, via the trusted-publisher workflow.
  Adds `pick` (with optional `regenerate`) and its types. the-prisoner pins `0.1.2` exactly.
- mind-seam, run-dmcp: nothing released.
