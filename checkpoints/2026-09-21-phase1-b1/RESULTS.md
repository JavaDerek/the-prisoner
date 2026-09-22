# Phase 1, batch 1: Opus 4.6 in both chairs for ten rounds, and what the world could not answer

Run 2026-09-21, 17:08-19:30 CDT, from a worktree pinned at `1a66459` (Phase 0 landed), `claude-opus-4-6`
both chairs, ten rounds, voice on, presence modelled, referee `qwen3:14b` on doris at thinking ON, through
`npm run model-router`. Predictions in `PREDICTION.md`, committed before the first game (`0b2ae1d`).
Counts by `npm run measures -- checkpoints/2026-09-21-phase1-b1 --arms O`, saved verbatim as
`MEASURES.md`, whose **refusal audit list is the product of this batch**: sixty-five rows with an empty
`label` column for the owner (genuine / unbuilt / unclear), per OPUS-FIRST-DESIGN §2. Ten counted
transcripts under `O/`, one quarantined under `discarded/` with its README, every launch under `logs/`.
Every header names `1a66459 (clean)`; doris showed exactly `qwen3:14b` before and after all eleven
launches; zero silences in 198 counted half-rounds.

## The verdict, against the prediction

| prediction | result | status |
|---|---|---|
| lost rulings 0 | **1** of 198 (bug 1, a new malformed shape) | missed by one |
| noise refusals 0; a noise reaches the other chair in ≥ 3 games | 0 refusals; noise ruled in **2** of 10 games | half held |
| refusals 20-35 of 200 | **65** of 198 | missed by about 2x |
| at least half of refusals on the custody residue | 25 of 65 (spoon 20, tray 4, key ring 1) | missed |
| at most 2 new unbuilt classes beyond custody and §68.7 | the owner's labels decide; my reading below finds 4 | open |
| door found in ≥ 5 of 10 games | **8** of 10 | held |
| escapes through the door ≥ 3 | **0**; the door opened 9 times, on round 9 or 10 every time | missed, with a mechanism |
| warden reaches suspicion 40 in ≥ 4 of 10 | **7** of 10 (57, 40, 57, 40, 60, 40, 75) | held |
| catches 1-3 | **2**, both at round 10 through the open door | held |
| every refusal names effect and reason | held; no reader-produced `(none)` table in any counted game | held |

The two refusal predictions were wrong in the same direction and for the same reason: ten rounds of
Opus press on the world about twice as often as I guessed, and not mainly through custody. The scoreboard
above was kept live during the run and each death was announced at the poll where it became impossible
(refusals at seven games, door escapes at eight).

## Per chair (from `MEASURES.md`)

| chair | intents | distinct targets (pooled) | distinct effects (pooled) | grounded | refused | route finding |
|---|---|---|---|---|---|---|
| warden | 100 | 11: bar, blanket, cot, door, lock, loose_tile, meal_tray, prisoner, spoon, window, wire | 3: close, derive, reveal | 70 | 30 | 5 |
| prisoner | 98 | 12: bar, blanket, cot, door, key_ring, loose_tile, meal_tray, spoon, warden, window, wire, wire_2 | 8: conceal, derive, expose, leave, noise, open, reveal, wear | 63 | 35 | 14 |

Competence family: the warden replanned 14 of 90 planned turns, the prisoner 45 of 88; citations verified
92% and 91%; 25 rulings carry a citation of three letters or fewer. Against §69's two-round Opus arm
(prisoner 7 targets, warden 4), ten rounds nearly doubled the warden's spread and the prisoner **derived**
wire from the cot in seven games, twice over in one (`wire_2`).

## What the batch found about the world

**1. The free door is a trap at ten rounds, and Opus wardens read the catch rule.** The prisoner opened
the door nine times in eight games, every time on round 9 or 10, after eight rounds of concealing the
spoon, deriving wire, and working the bar behind her body. She never walked through it: the compound
last-turn intent (*"throw the blanket over her head ... slide the wire into the gap ... go through"*) is
ruled as one effect, `open`, and there is no next turn (bug 3). Both catches are the warden doing what the
rule says: *"Step into the doorway to block Voss's exit, then closely examine the open door -- a way out
standing open -- to trigger the catch while my suspicion is at 60."* Two more wardens shut it (`close`,
twice). At two rounds the same door was an escape (§69); at ten it is the warden's win condition.

**2. The warden cannot act, only look.** Every preventive act she tried was refused: standing in front of
the window (`window`/`none`, `bar`/`none`), standing against the door (`none`/`none`), a pat-down search
(`prisoner`/`reveal`, `prisoner`/`none`), confiscating the wire (`wire`/`derive` x4), collecting the tray
(`meal_tray`/`none`). Her only grounded effects are `reveal`, two `close`, and one `derive`. This is the
custody residue and a second class, **position as an act**, together, and it is why nine open doors and
suspicion at 75 produced two catches.

**3. Idleness and compliance have no key.** `cot`/`none` six times, `bar`/`none`, `blanket`/`none`: *sit on
the cot and eat*, *stand exactly where I am, palms flat on the wall, total compliance*, *lean against the
wall looking weary*. The prisoner's cover acts are refused as acts, which means the warden is never told
she was being compliant.

**4. Sharpening is unrepresentable in the prompt's vocabulary.** *"Scrape the spoon's flat edge against
the cot's rough crossbar to sharpen it"* rules `cot`/`wear` (impossible twice, possible three times, the
cot losing nothing it has) or `spoon`/`wear` (which would lower `edge`, not raise it). The spoon's `edge`
property exists to be raised; nothing in the effect question says how.

**5. `reveal` on the spoon is unstable:** the warden's *"pick up the spoon and examine its edge"* was
ruled possible 7 times and impossible 12 -- `property: none` or an unverified citation on an object whose
only property is `edge`. That is a referee reading, not a world gap, and it is the largest single row in
the audit list (bug 2).

My reading of the unbuilt classes, for the owner's labels to confirm or overrule: custody and search;
position as an act; idleness and compliance as acts; raising a tool's property. Beyond the queued
custody and §68.7 that is four, not two.

## Ten quotes, chosen for range

Verbatim `Intent` lines with the ruling.

1. **The cover act** (`O/...22-08-27` r2 prisoner): *"Sit down on the cot, pull the blanket across my lap as
   if cold, and while talking casually to Croft about the spoon being old junk, quietly work one wire
   twist free from the cot springs beneath the blanket using my fingers."* -> `cot`/`derive`, possible; she
   had a wire.
2. **The lie** (`O/...22-08-27` r4 prisoner): *"Show Croft the spoon and claim that's what I was hiding
   behind my back -- I was using it to scratch an itch on my back and felt stupid about it. While presenting
   the spoon with one hand, keep the wire tucked securely in my waistband."* -> `spoon`/`conceal`, impossible.
3. **The search** (`O/...22-08-27` r6 warden): *"Tell Voss to face the wall and lift the back of her shirt so
   I can see the supposed rash, then conduct a thorough pat-down search of her entire person -- clothing
   seams, waistband, hems, socks, hair."* -> `prisoner`/`reveal`, impossible.
4. **Compliance as cover** (`O/...23-52-46` r5 prisoner): *"I stand exactly where I am, press my palms flat
   against the stone wall at shoulder height with fingers spread wide, and hold completely still -- not a
   twitch, not a glance toward the bar or the spoon. Total compliance."* -> `bar`/`none`, impossible.
5. **The decoy wire** (`O/...23-25-19` r6 prisoner): *"Walk to the cot, pull a small twist of wire from the
   springs in plain view of Croft, and hand it to her with a show of reluctant compliance. Say it came loose
   and I was fidgeting with it. Keep the actual working wire hidden under the loose tile."* ->
   `wire`/`derive`, impossible.
6. **The warden's guard** (`O/...22-57-53` r10 warden): *"Move to stand directly in front of the window with
   my back to the bars, positioning myself between Voss and the window, and hold that position for the
   remainder of my shift until the transfer escort arrives."* -> `window`/`none`, impossible.
7. **The last turn** (`O/...23-19-29` r10 prisoner): *"While Croft is facing the window examining the bar,
   move quietly to the door. Insert the kinked end of one stiff iron wire into the finger-width gap between
   door and frame where the bolt edge is visible. Use the kink to catch the bolt edge and ..."* ->
   `door`/`open`, possible; the door opened; the game ended.
8. **The catch** (`O/...23-40-03` r10 warden): *"Step into the doorway to block Voss's exit, then closely
   examine the open door -- a way out standing open -- to trigger the catch while my suspicion is at 60."*
   -> `door`/`reveal`, possible. **The warden caught the prisoner, at round 10.**
9. **The bucket** (`O/...00-03-38` r10 prisoner): *"Grab the slop bucket and fling its contents directly
   into Croft's face to blind and disorient her, then immediately rush to the window, grab the rusted bar
   with both hands, plant my feet flat against the stone wall ..."* -> `window`/`open`, possible; the bar
   held at 70.
10. **The feint** (`O/...23-13-31` r9 prisoner): *"Fake a sudden, violent medical episode -- I clutch my
    throat, gasp that I can't breathe, stagger sideways and drop to the floor shaking ... The goal is to
    make Croft rush over; then I spring up, grab the spoon from where it's hidden, and attack the cracked
    mortar at the base of the window bar."* -> `bar`/`open`, possible, the second half of the intent
    ruled and the first half unread.

## The routing, and what went wrong with it

Two routers served the batch; `logs/ROUTER-SWAP.md` and `logs/router-swap-at.txt` say which games ran on
which. The router at `1a66459` (`logs/router.log`) had no per-attempt timeout on its doris path; two
referee requests in game `O:4` hung for ~301s and failed at undici's own headers timeout while doris
answered every other call in under 53s (110 calls, median 11s). Game `O:4` is quarantined and replaced by
`O:11`. The fix, a 150s per-attempt timeout and one retry on the doris path, landed as `1021cdb` with five
tests, and the new router was started on the IPv6 loopback at 23:24:29Z so that games already running
kept their old instance; games `O:7`, `O:8`, `O:9`, `O:10` ran through it (106 doris calls, median 10s, max
45s, zero retries needed, zero errors). Opus calls: 218, none failed, median 56s. Games ran 23-30 minutes
each, median 27, two or three at a time.

## Bugs found, left alone

1. **A new malformed referee reply shape loses a ruling.** `O/2026-09-21T23-13-31-489Z.md` round 10
   warden: the referee answered with **several JSON arrays, one per question, each holding two answers**
   (it had read two targets, bar and window). The reader kept the first array only, so `effect` fell to
   `none` and *"position myself in front of the window ... closely examine the bar"* was ruled impossible
   where the model had answered `reveal`. §3.1's rebalancing does not cover a list of arrays; a reader
   that concatenates top-level arrays would. 1 of 198; the other 19 lenient reads recovered correctly.
2. **`reveal` on the spoon rules impossible 12 of 19 times** on `property: none` or an unverified citation
   (finding 5). The same act, the same object, the same referee.
3. **A compound intent is ruled as its first effect.** Every last-turn *open the door and go through it*
   became `open` alone; §69's escape needed a separate `leave` turn. Not new (the-prisoner's one-effect
   rule is by design) but at ten rounds it decides games.
4. **`derive` from a derived object is refused** (`wire`/`derive` x4: the warden taking the wire, the
   prisoner making a hook). Whether a derived thing may be derived from is an authoring decision.

## What this does not establish

Whether any refusal is "unbuilt" rather than "genuine": that is the owner's label in `MEASURES.md`,
and D4's two-source rule then decides what is built. Whether a human at the terminal would reach for
the same things (the blind-play rule, §4.4, has not yet been exercised on this batch). Anything about
Qwen. Whether Opus 5 would differ; its framing probe is still owed before batch 2.
