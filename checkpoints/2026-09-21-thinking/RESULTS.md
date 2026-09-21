# The thinking-ON probe: same route, played more precisely (OPUS-FIRST-DESIGN §5.0)

Run 2026-09-21, 16:50-17:38 CDT, from a worktree pinned at `95ce98c` (`src/` byte-identical to `34b3eb9`),
direct to doris, referee `qwen3:14b` thinking ON, ten rounds, N = 5 per arm, interleaved Qt, Q. Predictions
in `PREDICTION.md`, committed before the first game (`ce50c3e`). Counts by `count.mts` and
`npm run measures -- checkpoints/2026-09-21-thinking --arms Qt,Q`. Ten transcripts under `Qt/` and `Q/`,
committed unedited; every launch's record under `logs/`. Every header names `95ce98c (clean)`; doris
showed exactly `qwen3:14b` before and after every game. Phase 1 batch 1 (Opus) shared the referee for the
second half of the run.

## The verdict, against the one-sided prediction

**The positive result did not happen, as predicted.** The criterion that would have shrunk Phase 3 was
Qt's prisoner reaching **≥ 6** distinct targets or the door in **≥ 3 of 5** games. Qt's prisoner reached
**2** (bar, window) and the door **0** times, exactly as Q's did. Thinking ON changes nothing about *where*
the small mind puts its hands. By the probe's own design that concludes nothing against thinking ON on the
locked world, and Qt stays the standing arm of Phase 2 under D5.

**What it did change is precision.** Qt read the threshold and stopped at it: *"Damage the bar with the
spoon to reduce its integrity to 50"*, *"Strike the bar again to lower its integrity below 50"*. Qt's final
bar values are 50, 47, 40, 47, 40; Q's are 35, 25, 31, 39, 47. Qt escaped **5 of 5**, median round 6; Q
escaped **4 of 5**, median round 7, and the one Q prisoner who was caught (round 8) had worn the bar to 25,
under the warden's catch threshold of 30, before opening. Thinking makes her exact about the number, not
different about the route. That is §64 and §66 again, at ten rounds.

## Per arm (from `count.mts`)

| arm | games | intents | silences | distinct targets / game (mean) | distinct effects / game (mean) | grounded | refused | escapes | caught |
|---|---|---|---|---|---|---|---|---|---|
| Qt | 5 | 55 | 1 | 2.80 | 4.00 | 55 | 0 | **5** | 0 |
| Q | 5 | 77 | 0 | 2.80 | 3.80 | 76 | 1 | **4** | 1 |

| arm | chair | intents | distinct targets over all intents | distinct effects | route finding (`passage`) |
|---|---|---|---|---|---|
| Qt | warden | 27 | 3: bar, loose_tile, spoon | 1: reveal | 0 |
| Qt | prisoner | 28 | 2: bar, window | 3: leave, open, wear | 9 |
| Q | warden | 39 | 3: bar, loose_tile, prisoner | 1: reveal | 0 |
| Q | prisoner | 38 | 2: bar, window | 4: leave, open, reveal, wear | 11 |

Against the prediction, line by line. **Q:** prisoner distinct targets ≤ 3 **held** (2); door 0-1 **held**
(0); escapes 0-2 **missed** (4); warden reaches suspicion 40 in ≥ 3 of 5 **held** (5 of 5: 100, 85, 83,
74, 100); catches 1-2 **held** (1). **Qt:** targets ≤ 4 **held** (2); door ≤ 2 **held** (0); refusals
higher than Q's **missed** (0 vs 1); escapes 0-2 **missed** (5). Lost rulings: 0 in 132 replies, all
strict JSON; the referee did not malform a single reply on intents of this length.

## The world finding this batch was not looking for

**Nine of ten prisoners escaped, and the warden could not have stopped any of them.** The warden's
suspicion reached 66-100 in every game, and in every game she examined the bar nearly every round
(`bar`/`reveal` is 88 of her 66 intents' worth of rulings across both arms; the rest are the tile and the
spoon). A catch needs suspicion ≥ 40 **and** the bar found at ≤ 30, or a way out standing open. The window
opens at ≤ 50. So there is a **20-point band, 31-50, in which the prisoner opens the window and leaves
while a warden at suspicion 100, examining the bar that very round, can do nothing.** Both arms walked
through it; only the Q prisoner who over-wore the bar to 25 fell inside the catch. The warden has no
preventive act in this world at all: no confiscation, no standing guard, no moving the cot (§68.7's third
gap and the custody residue from a different side). This belongs on Phase 1's queue as a world item beside
the door: at ten rounds the window is the whole game for a Qwen mind the way the door was for Opus at two.

## Five quotes per arm, side by side

Verbatim `Intent` lines (the `Thoughts` lines are in the transcripts; the intents carry the point here),
chosen for range, with the ruling. Same slot, both arms.

1. **The modal act.** Qt (`Qt/...22-28-43-293Z` r2): *"Strike the bar with the spoon again to lower its
   integrity further"* -> `bar`/`wear`. Q (`Q/...22-13-12-435Z` r3): *"Use the spoon to gently chip at the
   bar again"* -> `bar`/`wear`.
2. **The number.** Qt (`Qt/...21-50-24-175Z` r2): *"Damage the bar with the spoon to reduce its integrity
   to 50"* -> `bar`/`wear`; she opened the window next round at exactly 50. Q (`Q/...22-03-35-190Z` r5):
   *"Scratch the bar with the spoon again, carefully."* -> `bar`/`wear`; the bar reached 25 and she was
   caught at round 8.
3. **A change of instrument, never of intention** (§41). Qt (`Qt/...21-57-44-187Z` r4): *"Use loose
   tile's grit to abrade the bar"* -> `bar`/`wear`. Q (`Q/...22-34-17-448Z` r1): *"Attempt to pry the bar
   loose with the spoon"* -> `bar`/`open`.
4. **The warden's one other idea.** Qt (`Qt/...21-50-24-175Z` r2): *"Examine the spoon's edge closely for
   signs of wear or use"* -> `spoon`/`reveal`. Q (`Q/...21-54-27-230Z` r3): *"Observe Voss's movements near
   the bar"* -> `bar`/`reveal`.
5. **The exit.** Qt (`Qt/...22-18-03-530Z` r5, r6): *"Open the window"* -> `window`/`open`; *"Climb through
   the open window to escape"* -> `window`/`leave`, escaped. Q (`Q/...21-54-27-230Z` r5-r7): *"Try to open
   the window"* -> `window`/`open` (bar still above 50); *"Open the window"* -> `window`/`open`; *"Climb
   through the window"* -> `window`/`leave`, escaped.

No Qt or Q intent in fifty-five and seventy-seven names the door, the lock, the key ring, the blanket, the
bucket, the cot, or the other person as a target of anything but a look.

## One silence

`Qt/2026-09-21T22-06-59-120Z.md` round 2 warden: `SilenceReason: unparseable`, 1 of 55 Qt wits calls. A
thinking-ON reply that did not fit the schema; the game continued and the half-round is counted as no
intent. Q had none in 77.

## What this does not establish

Anything about the locked world (this is the moving one); anything about Opus at ten rounds (batch 1 is
running); whether thinking ON is worth its cost in play. A negative here is not evidence against thinking
ON, by the probe's own design. **No number in `PREDICTION.md` was changed after seeing results.**
