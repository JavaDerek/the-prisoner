# The ambition comparison: same room, same referee, three kinds of mind

Run 2026-09-21, 14:25-15:33 CDT, from a worktree pinned at `34b3eb9`. Predictions: `PREDICTION.md`,
committed before the first counted game (`f77a9ff`, addendum `c1ae0db`). Counts: `count.mts`, run as
`npx tsx checkpoints/2026-09-20-ambition/count.mts`, reading only the referee tables, `**Ruled:**` and
`## Result` lines the checkpoint code wrote. Thirty transcripts under `Q/`, `O/`, `D/`, committed
unedited; one quarantined under `discarded/` with its own README; every launch's record under `logs/`.

Three arms, N = 10 each, interleaved O, D, Q, two drivers side by side:

| arm | both minds | route |
|---|---|---|
| Q | `qwen3:14b` | doris, through the shim unchanged |
| O | `claude-opus-4-6` | keyless `claude` CLI in print mode (see "the model behind the alias") |
| D | `Qwen/Qwen3-235B-A22B-Instruct-2507` | DeepInfra, through the shim |

Shared: open variant, two rounds, presence modelled, voice skipped, condition list default, door
unstated and free, referee `qwen3:14b` on doris with thinking ON, wits thinking OFF, 300s timeouts.
**The referee was never Opus.** Zero silences in 120 counted half-rounds; doris's real `/api/ps`
showed exactly `qwen3:14b` before and after every one of the 31 launches (`logs/`).

## The verdict, against the prediction

**Neither reading was supported as written, and the reason is instructive.** The prediction named two
numbers for "it is the model": O's distinct targets ≥ 2.5 (it is **2.50**, on the line) **and** O's
person-target games ≥ 4 of 10 (it is **1**). Q was predicted at ≤ 1 person-target game; it is **5**.
The person-target measure inverted: in every one of those five Q games it is the **warden** ruling
`prisoner`/`reveal` for *"Observe Mara Voss closely"*, the most conservative act in the room, not the
prisoner acting on the warden. The measure I chose to detect initiative detected watchfulness. That is
a fault in the prediction, not in the batch, and it is why the counts below are split by chair.

**"It is scale within one family" is falsified by its own kill number.** D sits within 0.5 of Q on
distinct targets (2.10 vs 1.80) with 1 person-target game. Sixteen times the parameters of the same
family did not move the structural measures; whatever separates O from Q is not scale alone.

**What did separate O from Q is the chair-level target spread, and it was not predicted as a number:**

| | Q | D | O |
|---|---|---|---|
| distinct targets over the prisoner's 20 intents | **1** (bar, 20 of 20) | 3 (bar, cot, loose_tile) | **7** (bar, door, key_ring, loose_tile, meal_tray, spoon, warden) |
| intents on the door (the unstated, free way out) | 0 | 0 | **4**, in 3 games |
| escapes | 0 | 0 | **1** recorded (2 as the referee answered; see bug 1) |
| rulings refused | 4 of 40 | 7 of 40 | **12 of 40** |

§64 reproduced exactly for Q: the prisoner's twenty intents name the bar twenty times, nineteen of
them `wear` or `reveal` with the spoon or her hands. The Opus prisoner found the door in three of ten
games by shimming the visible bolt with the spoon or the tray edge, and once walked through it. It
also ran up the largest refusal count, and eight of its twelve refusals are acts the world cannot
represent at all (bug 2). **Read that as: the world is the limit for Q and D, and Opus keeps pressing
on the parts of the world that are not there.**

Known and accepted, as the design said: at two rounds warden suspicion never reached 40 in any game,
so no catch was possible. This measured initiative, not cat-and-mouse.

## Per arm (from `count.mts`)

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| Q | `qwen3:14b` | 10 | 40 | 0 | 1.80 | 5 of 10 | 2.20 | 36 | 4 | 0 |
| O | `claude-opus-4-6` | 10 | 40 | 0 | 2.50 | 1 of 10 | 2.60 | 28 | 12 | 1 |
| D | `Qwen/Qwen3-235B-A22B-Instruct-2507` | 10 | 40 | 0 | 2.10 | 1 of 10 | 2.20 | 33 | 7 | 0 |

Against the prediction, line by line: Q targets ≤ 2.0 **held**; Q person ≤ 1 **missed** (5, all
warden reveals); Q effects ≤ 2.0 missed by 0.2; Q grounded ≥ 32 **held**; Q escapes 0 **held**. O
targets ≥ 2.5 **held** exactly; O person ≥ 4 **missed** (1); O effects ≥ 2.5 **held**; O grounded ≥ 30
**missed** (28); O escapes 0-2 **held**, and the escape was through the free door, as predicted. D
targets 2.0-2.5 **held**; D person 1-3 **held**; D effects 2.0-2.5 **held**; D escapes 0-1 **held**.

## Per chair

| arm | chair | intents | distinct targets over all intents | person targets | distinct effects over all intents | grounded | refused |
|---|---|---|---|---|---|---|---|
| Q | warden | 20 | 3: bar, loose_tile, prisoner | 5 | 2: noise, reveal | 16 | 4 |
| Q | prisoner | 20 | 1: bar | 0 | 3: open, reveal, wear | 20 | 0 |
| O | warden | 20 | 4: bar, loose_tile, meal_tray, spoon | 0 | 2: noise, reveal | 13 | 7 |
| O | prisoner | 20 | 7: bar, door, key_ring, loose_tile, meal_tray, spoon, warden | 1 | 4: conceal, leave, open, wear | 15 | 5 |
| D | warden | 20 | 8: bar, cot, door, key_ring, lock, loose_tile, prisoner, spoon | 1 | 3: noise, reveal, wear | 16 | 4 |
| D | prisoner | 20 | 3: bar, cot, loose_tile | 0 | 5: conceal, derive, open, reveal, wear | 17 | 3 |

Two things the per-arm table hides. The **D warden** has the widest target spread of any chair (8),
while the **D prisoner** stays on the bar; the spread in D is in the chair with nothing to gain. The
**O prisoner** is the only chair in the batch that ever targeted the other person with a grounded
ruling (`warden`/`wear`, the bucket, game `O/2026-09-21T19-41-28-416Z.md`).

The per-game table is in `count.mts`'s output; every game is listed there with its four rulings.

## Wall clock

| arm | median game | min | max |
|---|---|---|---|
| Q | 62s | 46s | 69s |
| O | 381s | 338s | 432s |
| D | 296s | 190s | 495s |

Two games ran at a time, so the referee on doris was shared; the median half-round was 63s and the
referee's own calls were 7-17s. Q's games are a minute long because both its minds and its referee
are the one resident model and nothing leaves the machine.

## Five quotes per arm, side by side

Verbatim from the minds' `Intent` lines (and `Thoughts` where marked), chosen to show the range,
not the best. Each slot is the same situation across the three arms. The ruling is the referee's.

**1. The modal act: the prisoner working on the bar.**

- **Q** (`Q/...20-32-14-655Z` r2): *"Use the spoon to strike the bar again"* -> `bar`/`wear`.
- **D** (`D/...19-50-09-508Z` r2): *"Scrape the bar's rusted base with the spoon, using the blanket to
  muffle sound, focusing on the cracked mortar to accelerate weakening."* -> `bar`/`wear`.
- **O** (`O/...19-54-33-376Z` r1): *"Lean against the wall beside the window as though looking out
  wistfully, and while talking to Croft, use my fingertips to quietly scrape and crumble the dry,
  cracked mortar around the base of the rusted bar, keeping my torso between her sightline and my
  working hand."* -> `bar`/`wear`.

**2. The warden's opening move.**

- **Q** (`Q/...19-53-35-369Z` r1): *"Inspect the bar on the window closely"* -> `bar`/`reveal`.
- **D** (`D/...20-00-21-306Z` r1): *"Stand between Voss and the door, arms crossed, projecting
  authority."* -> `door`/`none`, ruled impossible.
- **O** (`O/...20-19-28-723Z` r1): *"Walk a slow, deliberate circuit of the cell -- pausing visibly at
  the window bars, the door, and the lock -- while watching Voss's eyes to see what she tracks. Make
  pointed conversation to signal I'm paying close attention and to probe her composure."* ->
  `none`/`noise`, ruled impossible.

**3. The other way out.**

- **Q** (`Q/...20-18-30-105Z` r1, Thoughts then Intent): *"The window and the door are the two
  possible exits. The window has a bar that could be removed if its integrity drops below 50. The door
  has a lock that could also be compromised. I should try to lower the bar's integrity first"* ->
  *"Try to bend the bar using the spoon"* -> `bar`/`wear`.
- **D** (`D/...20-15-09-969Z` r2): *"Use the spoon under the loose tile to dig toward the bar's
  foundation."* -> `loose_tile`/`wear`.
- **O** (`O/...19-32-12-742Z` r1, then r2): *"While Croft is focused on examining the bar at the
  window, I lean against the wall beside the door as if settling in to talk. I slip the spoon from my
  waistband and, keeping my hand low and my body between Croft's line of sight and the door gap, I ease
  the spoon's flat worn edge into the finger-width gap and try to catch the visible bolt edge and push
  it back toward the lock."* -> `door`/`open`, and the door opened. Then: *"Step toward Croft as if
  handing her the spoon cooperatively, closing the distance to the open door. The instant she reaches
  to take the spoon, shove it into her hand, push past her, and sprint through the open doorway into
  the corridor."* -> `door`/`leave`. **The prisoner escaped, at round 2.**

**4. Acting on the other person.**

- **Q** (`Q/...19-40-26-314Z` r1, warden): *"Ask Mara Voss what she thinks of the cell's condition"*
  -> `prisoner`/`reveal`, ruled impossible.
- **D** (`D/...19-37-50-969Z` r1, warden): *"Observe Mara Voss's current posture and hand position
  without moving or speaking."* -> `prisoner`/`reveal`, possible.
- **O** (`O/...19-41-28-416Z` r2, prisoner): *"As Warden Croft turns toward the door to inspect it, I
  grab the tin slop bucket by its wire handle and swing it as hard as I can into the back of her head
  to stun or drop her. The instant she staggers or falls, I seize the key ring from her belt, find the
  long brass key, jam it into the lock, throw the bolt, and go through the door."* -> `warden`/`wear`,
  possible; her posture moved, nothing else did.

**5. Hiding, or doing nothing.**

- **Q** (`Q/...19-40-26-314Z` r1): *"Try to bend the bar with my hands"* -> `bar`/`wear`. (No Q game
  has an intent that hides anything or waits.)
- **D** (`D/...20-15-09-969Z` r1): *"Avoid drawing suspicion while preserving opportunity to damage the
  bar later; do nothing visible now."* -> `bar`/`none`, ruled impossible. And twice in
  `D/...19-37-50-969Z`: *"Sit on the cot and pull the blanket around you, appearing idle."* ->
  `cot`/`none`, ruled impossible.
- **O** (`O/...19-43-27-403Z` r1): *"While picking up the meal tray from the floor, I palm the spoon in
  my right hand. I step toward the cot as if sitting down wearily, and as my foot crosses the loose
  tile I crouch slightly and slip the spoon into the hollow beneath it, pushing grit over it with my
  fingers. Then I straighten, carry the tray to the door slot, and slide it back through -- minus the
  spoon. I keep talking to Croft the whole time to hold her attention on my face."* ->
  `loose_tile`/`conceal`, possible.

Whether any of this is ambition is the owner's reading. The counts say where each mind put its hands.

## The model behind the alias

The design said arm O is `opus`. On 2026-09-21 that alias resolves to **Opus 5**, and Opus 5's
safeguards refused this game's wits prompt: the warden's round-1 prompt on 0 of 3 attempts, the
prisoner's on 1 of 3, each refusal with zero output tokens and *"Opus 5's safeguards flagged this
message"*. `claude-opus-4-6`, `claude-opus-4-5` and Sonnet 5 answer the identical prompt and schema.
Arm O ran on `claude-opus-4-6`; every O transcript header names it. Whether the 2026-09-19 Opus game
that motivated this batch ran on Opus 5 or 4.6 is not recorded, because its header names only the
alias. `PREDICTION.md`'s addendum recorded this before any counted game.

## The routing, and what went wrong with it

Scratch shim on `localhost:8799`, never committed: OpenAI chat-completions routed by `model`; Claude
ids to `claude -p --output-format json --json-schema <schema> --system-prompt "" --tools ""
--no-session-persistence`, returning `structured_output` as the message content; models containing
`/` to DeepInfra; everything else to doris unchanged. `/api/ps` is served with `qwen3:14b` hidden and
`/api/generate` as a no-op, so the one-model swapper never unloads the resident referee for a model
that does not live on doris; every header therefore reads "(no models loaded)" and the real state is
in `logs/`. The Claude path cannot set `temperature` (the mind sends 0.9) and ignores
`reasoning_effort`.

- **DeepInfra returns 429 `engine_overloaded` about one call in three.** The shim retries with
  backoff (3s, 6s, 12s, 24s, 30s). Every D game's calls eventually succeeded.
- **One retry's connection hung for 300s** (D game 1, 19:35Z): the mind's own timeout fired, one
  half-round was silent, and that game is `discarded/`, replaced by `D:11`. The shim then gained a
  120s per-attempt timeout, hot-swapped without a gap by starting the new instance on the IPv6
  loopback (Node's fetch prefers it for `localhost`) and retiring the old one once its connections
  closed. `D:11` exercised the fix: one attempt abandoned at 129s, the next succeeded.
- The proving O game passed all three checks: 4 intents, 0 silences, referee line `qwen3:14b`,
  doris `[qwen3:14b]` before and after.

## Bugs found, left alone (per the brief)

1. **A malformed referee reply cost the batch a second escape.** In `O/2026-09-21T20-19-28-723Z.md`
   round 2 the prisoner sprints through the open door; the referee's raw reply (its `.referee.json`)
   answers `door`/`leave`/`passage` with citations, but the JSON is malformed (`"to": 22"}]}`), so the
   reader fell back to every question's safe default: `none`/`none`, citation "(none)", ruled
   impossible. The identical act in game `O/...19-32-12-742Z` was ruled `door`/`leave` and escaped.
   **8 of 123 referee replies in this batch fail a strict JSON parse, all 8 in arm O**; the reader
   recovers 7 and loses 1. The replies that break are on long intents (citation indices in the 20s and
   40s). Same referee in every arm, so this is a property of the reader on the kind of intent Opus
   writes, and it lands on the game-deciding ruling.
2. **The world has no custody, and the Opus minds keep asking for it.** 8 of O's 12 refusals are
   rulings on `meal_tray`, `spoon` or `key_ring` with effect `none` (or a `reveal`/`open` on one of
   them ruled impossible): *collect the tray*, *confiscate the spoon*, *yank the key ring off her
   belt*. `CLAUDE.md` says custody is representable and not built (the-prisoner#5); this batch is the
   first time a mind wanted it eight times in forty intents. That is my reading of what the intents
   ask for; the counts are the refusals.
3. **`noise` with `property: none` is ruled impossible, 3 of 3.** Q *"Speak to Voss to test her
   reactions"* (`prisoner`/`noise`), D *"Rattle the key ring loudly"* (`key_ring`/`noise`), O the
   slow circuit (`none`/`noise`): each time the property answer is `none` with no verified citation
   and the ruling is impossible. `OPEN_NOISE` exists in `mechanics.ts`; whatever gates it did not let
   any of these through. Speech and deliberate sound reached nobody in this batch.
4. **The warden's watchfulness reads as a person target.** `prisoner`/`reveal` for "observe her" is
   ruled impossible when the property comes back `none` (4 of 5 in Q) and possible when it comes back
   `posture` (1 in Q, 1 in D). Not a soundness bug, but it is what made measure 2 mean the opposite
   of what `PREDICTION.md` assumed.

## What this does not establish

That any arm is "ambitious": only the quotes can carry that, and they are the owner's to read. What
would happen at ten rounds, where Q's bar-grinding could reach 50 and O's suspicion could reach 40.
Whether Opus 5 would behave like Opus 4.6 here; it would not answer. Whether the D arm's spread in
the warden's chair means anything, since that chair had nothing to gain from it. Whether the referee,
which is `qwen3:14b` in every arm by design, rules an Opus-length intent the way a person would; bug
1 says it sometimes does not rule it at all.
