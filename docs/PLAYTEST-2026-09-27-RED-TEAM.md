# Playtest 2026-09-27: the red team (pass 2)

**Status:** review only. No code was edited, no model was called, doris was not touched, no test was run.
**Written:** 2026-09-27, against `docs/PLAYTEST-2026-09-27-DESIGN.md` (untracked, at `a7f566f`), the code at
that revision, `checkpoints/2026-09-27T20-14-57-505Z.{md,referee.json,rows.jsonl}`, OPEN-VARIANT.md,
the D11 corpus, run-dmcp 0.10.0's `dist`, and Brink's source.
**For:** the owner, who decides after reading the design and this.

Every finding is marked **confirmed** (checked against a file, a line, or a transcript round named beside
it) or **plausible** (reasoned, not checked). Findings are ranked most severe first. §1 is the list; §2 is
the turn arithmetic the brief asked for; §3–§8 are the seven items of the brief in order; §9 is the
rewritten decisions; §10 is what the design got right that was checked.

## 1. Findings, most severe first

### F1. The contest in the design's §2 is not winnable by the prisoner against a warden who does what his own list tells him — **confirmed**

**The design's claim.** §2: with the warden's list on, a one-round absence every four rounds, `block`,
`restore` and the door at `margin`, "this is a contest with decisions on both sides." Its "Window,
patient" line escapes at r9 with suspicion 30.

**What I found.** That line holds only if the warden never closely examines the bar after she starts
digging. The design's own D3 gives him a list whose condition 4 is "examine the bar", and this game's
warden examined it five times in ten rounds under the weaker rule sentence. The evidence rule
(`loop.ts:850-855`: `floor((prior − revealed) / 2)`) fires from his **round-0 belief** — his round-1
briefing already reads "bar integrity: 100 (as of round 0)" — so one look at a bar worn to 40 is +30
grounds on its own. This game shows it: round 8's look (belief 100 as of r3, found 40) took suspicion
from 50 to 90 by round 9 (transcript, rounds 8–9). With grounds, condition 7 catches on any open way out
he examines, and he acts first in every round (`game.ts:89`), so a window she opens on his last absent
round is examined before she can leave through it.

Her best line under the design is therefore to dig **only** in his absences: r4, r8, r12, r16 (bar 40,
suspicion 0 plus evidence), open at r20 (absent), and stand at r21 with the window open and suspicion
at most 28 (four looks at +7 each; a single look after r16 is +30 and ends it). At r21 he cannot catch
(under 40), but the design's `block` is free once placed and persists while he examines (§3 R2: "a block
is a position, not an occupation"), so he blocks the window and she needs the door: two lock wears and
an open, each of which is either visible (+10, and at 40 he examines the open window and catches) or
waits for r24, r28, r32 — past round 30. A warden who blocks the window at round 1, which condition
"If Warden Croft stands in a way out..." invites, makes the door her only exit and the window's five acts
impossible in 30 rounds. **No line I can construct wins against a warden who examines the bar and
places one block.** §2 below shows the arithmetic.

**What it changes.** P5's own kill condition ("0 escapes — unwinnable, back to §2") fires by
construction whenever the warden uses `block` at all, and if he never does, `block` is inert and R2 is
unmet. P5 would measure whether a Muse warden reaches for `block`, not whether the game is balanced.
The design must fix the arithmetic before P5, not after. The levers that would change it are named in
F2, F3 and F10: a block that costs him his examination (an occupation), a `close` that a spent part
refuses, and an absence he chooses rather than one the clock imposes.

### F2. The impairment levers (`sight`, `posture`) are cleared before she can use them, because he acts first — **confirmed** (arithmetic on the design's own numbers)

**The design's claim.** §2 lever table and the "Blind him" line: blanket over his head, "then open and
leave while he clears it... Two turns of his blindness cover one open and one leave only if clearing
costs him a turn; it does, so this is a real line and the one the owner tried." And `posture`: "put him
on the floor; he keeps nothing (C1) and cannot block."

**What I found.** The prisoner acts second in every round (`game.ts:89`). Whatever she does to his body
on her turn, he answers on his turn, and then she acts. So the impairment covers **none** of her acts
unless his one-turn recovery leaves him still impaired. On the design's numbers:

| her act (magnitude) | his sight/posture after | his `restore` (magnitude) | after | is he still impaired at her next turn? |
|---|---|---|---|---|
| sight, moderate (−50) | 50 | any | ≥ 60 | no — and 50 was never blind (blind is ≤ 25) |
| sight, substantial (−100) | 0 | moderate (+50) | 50 | no |
| sight, substantial | 0 | slight (+10) | 10 | yes |
| posture, moderate (−50) | 50 | moderate (+50) | 100 | no |
| posture, substantial (−100) | 0 | moderate (+50) | 50 | **yes** (≤ 75: block does not hold, C1 opens) |
| posture, substantial | 0 | substantial (+100) | 100 | no |

Posture's tables are `{10, 50, 100}` both ways (`scenarioObjects.ts:475-490`); the design copies them for
`sight`. So she is only ever ahead when the referee rules her act one magnitude larger than his. This
game's referee ruled "throw" moderate and "pull" slight (rounds 2, 9). **The owner's own move — throw the
blanket over Croft so he can't see — at moderate leaves sight at 50, which is not blind under the design's
band, and he clears it to 100 next turn.** The design would rule the move real and make it do nothing,
which is the outcome R3 exists to prevent, by a different route.

**What it changes.** Either the blind band moves to ≤ 50 (a moderate act blinds, as a moderate act
crouches), or recovery is made slower than infliction (restore on one's own `sight` is slight only), or
the design says plainly that these levers are magnitude lotteries and does not count them as lines. The
"Blind him" paragraph should be struck or rewritten with the table above.

### F3. `close` already exists, is stronger than `block`, and works on a window whose bar is out — **confirmed**

**The design's claim.** R2: "No effect kind expresses interposing, restraining or blocking." §2's
arithmetic never mentions `close`.

**What I found.** `planEffect`'s open/close branch (`effects.ts`, the `if (effectKind === "open" ||
effectKind === "close")` block) builds a gate only for `open`; `OPEN_PASSAGE` (`mechanics.ts:246-280`)
applies the gate only when `p.open`. A `close` on the window therefore sets `passage` to 0 whatever the
bar's integrity — including 40, with the bar already out. It costs nothing, is available to the warden
today, and every re-open costs her a turn and +10 suspicion (`open` is suspicion-eligible,
`loop.ts:174-178`). Since he acts first, a warden who closes every turn holds both exits shut for ever and
walks her suspicion to 40 in two cycles, after which he examines the open way out on the turn she
re-opens it and catches. No warden has ever used it: zero `OPEN_PASSAGE (close` resolutions by a warden
across every committed transcript (grep over `checkpoints/`).

**What it changes.** Two things. The R2 diagnosis is incomplete: the warden already had a prevention
move that he was never told about, exactly `restore`'s situation. And the mechanic is wrong: a window
whose bar is out has nothing to shut. `close` on a way out whose part is at or under its open threshold
(or spent to 0) should refuse, and the refusal should be told. Until that lands, any P2/P5 warden who
happens to say "shut the window" wins by a rule nobody designed. This belongs in D4.

### F4. `blocked_by` as a `set` on the way out is not expressible in run-dmcp 0.10.0 — **confirmed**

**The design's claim.** R2: `block` "resolves as one `set` of the way out's `blocked_by` to the actor's
character id... the same change kind `OPEN_LEAVE` uses for `location_id` and `OPEN_TAKE` for
`owner_id`, so nothing new enters the engine."

**What I found.** `node_modules/run-dmcp/dist/timeline/constrained.js:29-50` (`resolveProjection`)
refuses a `set` whose key is not a live column of the entity's projected table ("`'${key}' is not a live
column of '${table}'`"). The window and door are `items` (`world.ts:258-263`, `createItem`), and the
`items` table (`dist/db/schema.js:191-200`) has `id, game_id, owner_id, owner_type, name, properties,
image_gen`. `location_id` and `owner_id` work because they are columns; `blocked_by` is not one.

**What it changes.** The mechanism is still buildable without touching the engine, but not as written.
The pattern already in this repository is a bounded resource on the **character** indexed over a closed
list — `prisoner_held_in` / `warden_held_in` over `PERSON_CONTAINERS` (`world.ts:324-333`). A
`warden_blocking` resource valued 0 (none), 1 (door), 2 (window), written by `write`, read live by
`OPEN_LEAVE` from the constraint it is handed, gives "one body, one doorway" for free and needs no new
column. The design's admission-test row for R2 should be restated on that basis; its present sentence
claims a capability 0.7.0 does not have.

### F5. D6 prices the door without telling her the price — **confirmed**

**The design's claim.** §5: door price `free → margin`; §2's "Door, at `margin`" line has her wearing
the lock to 60 and opening.

**What I found.** `openConditions` (`conditions.ts:35-56`) adds the door's condition only when
`options.door === "stated"`; `doorPrice` decides what that condition says, and under the default
`unstated` no condition names the door at all. `PRISONER_DOOR` is a separate reader
(`conditions.ts:85`) and is not in the design's §5 table. §50.5–§50.7's batches all ran
`PRISONER_DOOR=stated`. Under the design as written, the door is gated at 60 and nobody is told.

Also worth restating from the source the design cites: §50.7 measured that a model prisoner takes the
door when free and **never aims at it at any price** (0 of 11 priced games). The design's arithmetic
gives her the door as a live route; the measured record says a model will not use it. That is fine
for the owner's human game and is a known zero for P5.

**What it changes.** D6 needs `PRISONER_DOOR=stated` as a default too (a second batch boundary), or the
door condition should be stated whenever a price is set. §5's table gains a row.

### F6. §34.3 did not measure the list "with the false line present"; the design's P4 prediction leans on evidence that does not transfer — **confirmed**

**The design's claim.** R1's measure: "§34.3 measured the list turning 0/20 into 20/20 with the false
line present: the lie corrupts his notes, the sentence shape decides his act." P4 predicts list cells
examine the window ≥ 8/10 under the true line.

**What I found.** §34.3's contexts are "she opened the window on her previous turn" (G1 r7, G2 r7, G3
r6, G4 r6): the window had actually opened, so "Mara Voss opens the window." was **true** there. No
measurement exists of the list under a false line, nor under the design's replacement "works to open the
window". Under rule (a), the sentence that told the §34.3 warden the window had opened is gone from the
news on the one turn it was true, and he must read the window's own "It stands open now" line in the
perceived list instead (this game's round 10 shows that line present). That is a weaker stimulus than
anything §34.3 or §34.4 measured.

**What it changes.** P4's 2×2 is the right probe and must run before D1 and D3 land together, but its
prediction is borrowed, not measured; the design should say so and lower its confidence. Note also that
this game's round 10 is exactly §34.3's baseline context with the line true — Muse on rule sentences did
what qwen did (0/20), which is consistent with the design's reading of R4.

### F7. P3 measures the target and not the effect; a person-aimed act that lands as `noise` is still a rewrite — **confirmed**

**The design's claim.** §1.3: "person-aimed intents do land on the person: #28's 'throw the spoon at the
warden' ruled `warden/noise` twice." P3 predicts "round 2 lands on `warden` ≥ 3/5."

**What I found.** The D11 corpus rows `I25-3`/`I25-5` are exactly those two, ruled `warden/noise/none`
and labelled **unmodelled** ("no injury vocabulary exists", `checkpoints/2026-09-26-human-intents/
RESULTS.md:137`). A thrown spoon became a shout. That is R3's "silently rewritten" in effect-space rather
than target-space. P3 as written would count "throw the blanket over Croft" → `warden/noise` as a pass.

Also a sequencing gap: the landing order puts `sight` in step 5 and P3 before step 6, so P3 may run in
a world where the only person property is `posture`, in which case the best available ruling for the
blanket is `warden/wear/posture` — also wrong.

**What it changes.** P3's prediction must name target **and** effect/property (`warden/wear/sight`),
and P3 must run after `sight` lands. The `rewritten` label should cover "right person, wrong effect."

### F8. `engineVocabulary.test.ts` does not guard this game's words — **confirmed**

**The design's claim.** §8 step 1 and R7: the two doc lessons are "guarded by
`engineVocabulary.test.ts`."

**What I found.** The test's `FORBIDDEN` list (`run-dmcp/src/__tests__/engineVocabulary.test.ts:95-160`)
holds only the two signatories' terms (DEFCON, prestige, flashpoint, cohesion, accord, seat, crisis,
lyrics, chorus, chunk_id, shot_id, geopolitical, brink, "video client"). "warden", "prisoner", "cell",
"bar", "spoon", "custody" all pass. The-prisoner's own CLAUDE.md vocabulary rule is a remembered rule
in the engine, not an enforced one. HUMAN-INTENTS-DESIGN.md §8 made the same claim on 2026-09-26.

**What it changes.** The proposed lessons' wording ("what one principal perceives of another's act",
"a property a mind works on over several turns") is neutral and would pass a guard that existed; the
check has to be by hand until one does. The honest fix is an engine commit adding this consumer's terms
to `FORBIDDEN` in the test's own style (described structurally: "a two-principal, one-location
consumer's roles and props"), which is exactly the kind of thing the test's header says it is for. Not
in the design's landing order; it should be step 0.

### F9. R6's gap can refuse a correct turn today, which the design did not notice and which settles D8 — **confirmed by reading, not run**

**The design's claim.** R6 is a briefing contradiction; D8 asks whether to land it as a fix or an arm.

**What I found.** `loop.ts:785`: `expects = plan.isWearType && plan.resourceId ? wearExpectation(...)`,
and `wearExpectation` (`loop.ts:466-475`) builds the expectation from the actor's **belief by name**. After
this game's round 4 the prisoner's belief of `bar_integrity` is 100 (as of round 0) while the fact is 85.
Had the owner typed "scrape the bar with the spoon" (a `wear bar.integrity`, which is `isWearType`), the
resolution would have carried `expects: bar_integrity = 100`, the engine would have thrown
`ResolveProtocolError("expectation-contradicted")` (`dist/timeline/resolve.js:13-31`), and the loop's
catch (`loop.ts:860-862`) would have filed it as a refusal, corrected her belief, and cost the turn. The
same holds for any `expose` after a `conceal` reported as a side effect. The game can refuse an act for
a belief the game itself made stale.

**What it changes.** D8 is not a choice: an arm whose "off" state refuses correct turns is not a
baseline. Land R6 as a fix. The test the design proposes (round 4's outcome leaves `bar_integrity = 85`
as of round 4) should be joined by one that a `wear bar` on the following turn resolves rather than
refuses.

### F10. D5's "presence rhythm" is not the closed variant's rule, and the closed variant's rule is the better design — **confirmed**

**The design's claim.** §2's lever table: "the closed variant's own 'the warden is AWAY ... hears
nothing' rule (`world/mechanics.ts:613-616`), which O1 dropped (§9.3)."

**What I found.** `WARDEN_PRESENCE` (`world/mechanics.ts:567-574`) makes absence the consequence of the
warden's **own move**: `CHECK_LOCK` and `SERVICE_LOCK` put him in the corridor, `REPLACE_BAR` in the
yard; `OBSERVE`, `SEARCH`, `WAIT` keep him in the cell. Nothing there is a cadence. The closed variant's
warden buys a mended bar with a round of not watching. The design's rhythm is a clock the warden does
not control, which means the one thing that gives the prisoner a line is something neither chair
decides — the opposite of R2's "opposition, not commentary", and unlike anything a Brink rival would
carry.

**What it changes.** D5 should be re-asked with the closed variant's shape as the recommendation:
`restore` on a way out's part (and perhaps any act on the corridor side of the door) costs the warden
his presence that round, told to both as a rule ("mending the bar means leaving the cell; while Croft is
out, nothing Voss does is seen"). It gives him a real choice each time the bar wears — mend it and give
her an unseen act, or watch and let the wear stand — and gives her a reason to make the bar look worth
mending. A fixed cadence can stay as an arm for measurement.

Two consequences either way that the design does not state: (i) under presence, an absent warden's
half-round still costs a wits call (~50 s, `loop.ts:555` calls `mind.consider` regardless) against an
empty perceived list, so R7's waiting gets worse unless the absent half-round is skipped
(`passiveWarden.ts` is the pattern); (ii) a warden who **leaves** by his own act never comes back:
`world.ts:344-356` keys every exit on a cell object, there is no exit from the corridor, and a warden in
the corridor perceives nothing he could act on (`briefing.ts:234-237`). The rhythm's return must be a
location `set` by the game, and the design should say the door is not opened for it.

### F11. `block` as "a position, not an occupation" makes it dominant and free; as an occupation it is the contest the design wants — **plausible**

R2's rule that the blocker "may do anything else (examine, restore, speak) and stays in the doorway"
is what turns F1's arithmetic into a lock-out: once placed, a block costs him nothing and he goes on
examining. If a block is instead his act for the turn and lapses when his next act is anything else,
then every turn with grounds he chooses between preventing (block) and detecting (examine the way
out), and she gains a turn whenever he chooses wrong. That is the "decisions on both sides" §2 claims
and does not deliver. It is also the Brink-shaped version: a rival that guards cannot also probe.

### F12. The key ring is mechanically inert, so the "he keeps nothing (C1)" lever buys her nothing — **confirmed**

The `open` branch of `planEffect` gates the door on the lock's integrity alone; nothing anywhere reads
who holds the key ring. Under `free` the door needs no key; under `margin` the key does not lift the
gate. The owner's round 3 "take the warden's keys" would have gained nothing had it resolved. If custody
of the keys is to be a line — and the design's posture lever presents it as one — the door needs a rule
that a held key ring satisfies the gate; otherwise the design should stop citing C1 as a counter.

### F13. Smaller confirmed errors in the design's own text

| where | the design says | what the code or record says |
|---|---|---|
| R1 reason 3 | "hides the blanket" at 50 "is not hidden (the perception gate is ≥ 50, `briefing.ts:240`)" | 240 is `value < 50`, so 50 **is** at the gate; the blanket stays visible because it is a container (`briefing.ts:238`, `CONTAINERS` includes `PERSON_CONTAINERS`). Right conclusion, wrong reason. |
| R1 | "Six cases already describe the attempt (wear, restore, reveal, noise, leave, take, give)" | seven listed |
| P2 | round 5's context has "suspicion 10" and news "works to open the door" | round 5's warden briefing has suspicion **20** (round 4 is 10) and she dug at the **window** |
| §1.3 | "Every Phase 1 batch since 2026-09-23 ran modelled" | b1 (09-21) and b2 (09-22) did too: every batch directory's transcripts read `Presence: MODELLED`; b5 has no transcripts |
| §5 | "b5–b7's PREDICTION.md files ... were scored" | b5 never ran; its `HANDOFF.md` says its prediction is superseded |
| §1.5 / R6 | "this game has six [contradictions] (rounds 5–10)" | rounds 5–8 carry both numbers on one screen; rounds 9–10 carry the stale line with no contradicting number beside it. The count depends on the definition, and the after-count test should fix one. |
| R7 texture | bands listed 70 / 55 / 40 | `describedAsItStands` picks the **first** `readRanges` entry with `value <= atOrBelow` (`briefing.ts:186`), so they must be authored ascending (40, 55, 70) or 70 always wins |
| R7 screen | the stakes line is filed "under `other`" | `ProseBlockKind` (`proseView.ts:230`) has no `other`; the design's new `stakes` kind must be added to `PLAY_BLOCK_POLICY`'s `Record`, which is the discipline it cites |
| R5 | "one extra referee call, only when `several` fires" — presented as free | ~30 s per fire; §74.1 says a preparatory step trips it about one time in four (this game: warden round 7). R7's waiting gets worse on those turns; say so. |

## 2. The turn arithmetic (brief item 2)

Constants, all confirmed: threshold 40 (`SEARCH_SUSPICION_THRESHOLD`); a visible moderate act +10,
slight +5, substantial +30 (`SUSPICION_BUMP_FOR_MAGNITUDE`, `loop.ts:129-133`); `take` and `leave` bump
too (`suspicionEligible`, `loop.ts:174-178` — this game's round 1 `take blanket` was the +5 to 5, and the
failed round 8 `leave` was +10 of the 50→90); bar wears 8/15/25 and restores 20/50/100
(`scenarioObjects.ts:157-164`, under `id: "bar"` at 138); lock wears 10/20/35, restores 20/50/100; the window opens at bar ≤ 50,
catches at ≤ 30; the door at `margin` opens at lock ≤ 60, catches at ≤ 40; evidence on a warden `reveal`
is `floor(drop/2)` against his prior belief, which exists from round 0; an act on a person bumps nothing
(`loop.ts:191-194`). Order: warden, then prisoner, every round (`game.ts:89`); escape is checked after
every half-round, the catch only after the warden's and only against what that reveal returned
(`gameEnd.ts:63-66`); the suspicion bump is applied **before** the catch check in the same half-round
(`loop.ts:839-855` then `game.ts:130`), which §33.6 decision 2 kept on purpose.

**Line A — the design's "patient" window line, warden examines the bar each present turn.**

| round | her act | bar | his act next round | suspicion after | note |
|---|---|---|---|---|---|
| 1 | dig (visible) | 85 | examine bar: 100→85 | 10 + 7 = 17 | |
| 2 | dig | 70 | examine bar | 20 + 14 = 34 | |
| 3 | dig | 55 | (absent r4) | 30 + 14 = 44 | **grounds at r3** |
| 4 | dig, unseen | 40 | r5 examine bar: 55→40 | 44 + 7 = 51 | |
| 8 | open, unseen | open | r9 examine window: open, grounds | — | **caught r9** |

**Line B — all digs unseen, he examines the bar every present turn.**

| round | her act | bar | evidence | suspicion |
|---|---|---|---|---|
| 4, 8, 12, 16 | dig ×4, unseen | 40 | +7 each | 28 |
| 20 | open, unseen | open | — | 28 |
| 21 | — | — | he examines window: open, **no grounds** | 28 |

At r21 he cannot catch. He can `block` (design) or `close` (today, F3). If he does neither she leaves
at her r21 turn: **escape at r21 after sixteen turns of doing nothing visible.** If he blocks, the door
needs three more unseen acts (r24, r28, r32): out of rounds. If he closes, her re-open is +10 (38), his
close again, her re-open +10 (48), and he examines the re-opened window at 48: caught. **Line B is the
prisoner's best line and it is decided entirely by whether the warden prevents at r21.**

**Line C — door at `margin`, unseen.** Wear r4, r8 (lock 60), open r12, r13 he examines the door: open,
suspicion 0 + evidence (a lock look after r8 is +20): under 40, no catch; block or close as above. Window
then needs five unseen acts: out of rounds.

**Line D — he blocks the window at round 1.** Only the door remains; Line C with the window's five acts
never available. Zero risk to him.

**Line E — the person levers.** See F2's table: she gains a turn only when the referee rules her act a
magnitude above his recovery. Posture at substantial vs his moderate is the one cell that wins (block
does not hold at ≤ 75, C1 opens at ≤ 75), and it hands her the key ring, which does nothing (F12), or a
turn to leave through a blocked exit, which is real.

**Checks the brief asked for, line by line.** Suspicion bumps: as tabled; the design's "each look at a
worn bar adds 7" is only true if he looks after every single dig — one look after four digs is +30.
Who acts first: warden. When the catch is checked: after his half-round, against his own reveal, after
the evidence bump. What `close` does to an open window: shuts it with no gate, bar out or not (F3).
Whether a blocker can also examine: yes as designed (F11). A block when the blocker is out of the cell:
released by the "not in this location" read, but the rhythm must move him by `set`, and a warden who
leaves by his own act never returns (F10).

## 3. Did the design check the diagnoses? (brief item 1)

| req | the claim the design took on trust | checked against | verdict |
|---|---|---|---|
| R1 | that the count was 4 and the sentence reached one consumer | rounds 2, 4–7, 9 of the transcript; `loop.ts:676` (built before `resolve()`), `:831`, `:152-156` | design's widening to 5 of 6 and three consumers is **right**; reason 3 for rule (a) is wrong in its reason (F13) |
| R2 | that no prevention exists | `mechanics.ts:246-280`, `effects.ts` open/close branch; every transcript | **wrong**: `close` exists, is ungated, and beats `block` (F3). Round 4's ruling (`key_ring/conceal/none`, `referee.ts:727` inapplicable) confirmed. |
| R3 | that `off` is the odd one out and `modelled` makes the person a key | batch dirs' `Presence:` headers; `referee.ts:470`; corpus `I25-3/5` | headers **confirmed** (all seven batches modelled); "lands on the person" is true for the target and false for the act (F7) |
| R4 | that §34.3/§34.4 measured this game's round 10 and the list fixes it | OPEN-VARIANT §34.3 (0/20 → 20/20), §34.4 (4/4 caught r6), batch K headers (`qwen3:14b` wits, referee, presence off, door free) | numbers **confirmed**; the "false line present" claim is **wrong** (F6); "no prisoner has ever won against it" rests on four qwen3 games from 2026-09-17 in a different world (pre-D7a, presence off) |
| R5 | that the one-act citation is the second act's span | `referee.ts:189` (question text); `.referee.json` entries 25 and 31: warden r7 cited words 9–13 "and the hollow beneath it", prisoner r8 cited 8–9 "and leave" | **confirmed** on both rows this game has; no data for `HB-r2`/`HB-r10` (ran with `oneAct: "off"`, RESULTS.md:145). P1's stop rule is the right guard. |
| R6 | that `updateActorBelief` reads one transition | `loop.ts:495-502`; `mechanics.ts:261`; `perception.ts:430`; D7a landed 2026-09-26 (`6a6544f`) | **confirmed**, and worse than stated (F9) |
| R7 | timings and the request layout | transcript timings; `.referee.json` `ms`; `referee.ts:629-635` (intent is the first source), `refereeTransport.ts:101-107` (one preamble line, then sources, then questions) | **confirmed**: the prefix cache covers one line. P7 is worth running. |

## 4. Will the model actually use it? (brief item 3)

| affordance | what makes a model reach for it | measured bar | is the kill real? |
|---|---|---|---|
| `block` | a condition line on his side. §57.3's record is three affordances the models never touched; the design's counter-evidence (rounds 9–10 candidates named blocking unprompted) is real and is the first such case in the record. | P2: ≥ 4/10 at a low-suspicion context | Yes, but it measures the wrong thing under F1: if he reaches for it the prisoner cannot win; if he does not, R2 is unmet. P2 needs F11's shape first. Also the context spec is wrong (F13). |
| `restore` stated | a condition line that is an affordance, not a threshold (§5 below) | P2: ≥ 1/10, reported | reported, no kill — fine |
| `sight` on a person | the person-instrument clause (an arm) | P3: round 2 on `warden` ≥ 3/5 | not real as written (F7: target only; runs before `sight` exists) |
| the rhythm | nothing: it is imposed, so there is no reach to measure. P5's "first act in an absence round is on a way out ≥ 3/6" measures whether she reads it. | ≥ 3/6 | P5's kill is on escapes, which F1 says is decided by his block use, so the rhythm's own measure is confounded |
| the list on the warden's side | the list itself; §34.3 is the reach measurement, on qwen3 with a true line | P4: ≥ 8/10, kill < 5/10 → model choice | real, but the prediction is borrowed from a stronger stimulus (F6) |
| the first-act rule | not an affordance; a ruling rule | P1: 3/3 compounds, ≤ 1/12 controls | real; stop rule is right |
| the door at `margin` | §50.7: a model never aims at a priced door | P5 reports door intents | no prediction stated for door use; §50.7 predicts 0 for a model and the design should say so |

The design's own §1.4 makes a point that survives everything above: this game's warden asked for a
blocking move twice before it existed. That is the strongest reach evidence in the repository's record
and P2 should quote it as the prior.

## 5. Is anything a prisoner-only prompt hint in disguise? (brief item 4)

- **Not hints:** R1's attempt sentences (rendering rule), the list on the warden's side (the generic
  module, unchanged), the `block` condition (a true world claim, asserted by test), `sight` as a bounded
  property, the bar bands (world content), the first-act rule (a ruling rule), R6 (a belief fix).
- **Borderline, worth saying:** "If the bar's integrity is below 100, then Warden Croft can mend it" is
  not a threshold that unlocks an act; `restore` is legal at 100 too (a no-op). It is an affordance
  advertisement in the list's clothing, which is the "move list by another route" §9 avoided. It is
  not prisoner-only — it would move to a Brink rival unchanged as "you can reinforce X" — but the design
  should name it as a step back toward a move list and measure it separately (P2 does).
- **Borderline:** the person-instrument clause names "striking, covering, blinding, restraining, tying".
  Generic in form, conditional on a person in view; the verb list is tuned to this game's blanket.
  Brink's reader has no target question, so "would it survive unchanged" does not apply; as a referee
  clause it is the same shape as `PERSON_TARGET_CLAUSE` and is acceptable as an arm.
- **Not a hint but not transferable either:** the fixed cadence (F10). A Brink rival has no clock that
  removes it from the board; the closed variant's shape (an act that costs presence) would.

## 6. Batch boundaries (brief item 5)

Env readers in `src/` (grep `process.env.PRISONER_` and `read*Mode(`): `CHECKPOINT_DB, MODEL_URL, MODEL,
WITS_MODEL, VOICE_MODEL, SKIP_VOICE, PRISONER_MODEL, WARDEN_MODEL, PROSE_SEAT, STRATEGY,
STRATEGY_STRENGTH, THINK_TIMEOUT_MS, ROUNDS, OLLAMA_NATIVE_URL, OLLAMA_RESIDENT_MODELS, REFEREE_MODEL,
REFEREE_TIMEOUT_MS, PRECEDENT_LEDGER, PICK, WARDEN, CONDITIONS, DOOR, DOOR_PRICE, WINDOW,
REFEREE_THINKING, WITS_THINKING, THINKING, INSTRUMENT, ONE_ACT, ELABORATE, ELABORATE_BAND, PRESENCE,
DERIVE_WORDING, ELISION, CONTAINER_CLAUSE, DERIVE_REPEAT, HUMAN, VIEW, NARRATOR_MODEL, PRECEDENT_PRICE,
NARRATION_AUDIT, NARRATION_AUDIT_MODEL, VARIANT`.

| default the design changes | in §5? | separates | note |
|---|---|---|---|
| `PRESENCE` off → modelled | yes | every default-run batch before 2026-09-21 (A–K, door-price, derive-wording, elaboration) from what follows; aligns with b1–b7 | b1/b2 ran modelled too (F13) |
| `CONDITIONS` list → both | yes | **everything except K1–K4** (four games, 2026-09-17, qwen3, presence off, pre-D7a) | the largest boundary here |
| `DOOR_PRICE` free → margin | yes | everything except §50.7's four `margin` games | |
| `DOOR` unstated → stated | **no** | everything except the §50 batches | required by F5 |
| R6 fix | yes | only runs after D7a (2026-09-26): this game and 09-26/27 probes | fix, not arm (F9) |
| R1 sentences and ledger texts | yes | every batch's other-side text; precedent batches (A–J era) match on the rewritten ledger | |
| `block` (new) | yes | both chairs | needs an env name for P5 arm B; none given |
| rhythm (new) | yes | both chairs | needs an env name; none given |
| `sight` + person clause (arm) | yes | none until landed | `PRISONER_PERSON_INSTRUMENT` named |
| R7 bands, window line | yes | every batch's `desc:bar`/`desc:window` sources | |
| R5 first act | yes | flagged turns only; adds a call | |
| request order (P7) | yes, as an arm | none | needs an env name |
| R7 seat changes | yes | none | |

**Committed predictions.** None is invalidated: every scored `PREDICTION.md` describes its own arms.
Two corrections to the design's sentence: b5 was never scored (superseded, `HANDOFF.md`), and the
derive-repeat arm's prediction (`checkpoints/2026-09-26-derive-arm/`) has a `RESULTS.md`, so it is
closed. A future run of any past arm must now set `CONDITIONS=list DOOR_PRICE=free DOOR=unstated
PRESENCE=modelled` explicitly to be that arm; the transcript header names all four, so a mis-set run
is self-describing.

## 7. Jurisdiction (brief item 6)

- **"Nothing enters run-dmcp code."** Confirmed for every candidate the design names, and F4 does not
  change it: `block` is expressible with a bounded resource the engine already provides. The design's
  stated mechanism (`set` of `blocked_by`) would have needed an engine change — a new column or a
  free-form fact key — which would fail the admission test as one game's idea. The correct statement is
  "a `write` to a bounded resource, which every property here already is."
- **The two doc lessons.** Both are generic with one real caller (this game), which is the admission
  test's actual wording (`run-dmcp/CLAUDE.md:52`). The R7 lesson overlaps the guide's existing "declare
  the space of what an object may come to be; describe what it is" (`AUTHORING-GUIDE.md:85`) and should
  be written as an extension of it rather than a new heading, the way §8 of HUMAN-INTENTS-DESIGN
  extended "descriptions say what the world models". The R1 lesson is new to the guide.
- **The vocabulary guard.** It would not trip on this game's words (F8). The lessons as phrased use
  "principal", "attempt", "way out", "property" — none forbidden, and none of this game's. Check by hand
  until the guard is extended; the extension is an engine commit and should go first.
- **The `.rows.jsonl` `personsInView` field** is data the seat already holds and stays in this
  repository; the shape goes to run-dmcp#43 after an audit, as HUMAN-INTENTS §8.2 already says. Fine.

## 8. Citation spot-check

Thirty-two file:line citations were checked against the working tree; all resolve to the code the
design describes. A selection: `loop.ts:148-156, 191-194, 390-457, 405-410, 495-502, 553, 676, 831,
839, 850-855, 862`; `mechanics.ts:251-269, 261, 353-358, 381`; `referee.ts:189, 442-458, 470, 727,
816-829, 892`; `briefing.ts:95-99, 240, 338`; `mind.ts:186-189, 264-275`; `gameEnd.ts:43`; `game.ts:89,
124-126`; `checkpoint.ts:1392`; `refereeTransport.ts:97`; `scenarioObjects.ts:133, 321-324, 355-358,
380-388, 475-490`; `perception.ts:430`; `proseView.ts:152-154`; `deltaView.ts:34, 89-97`;
`conditions.ts:15-21, 57-60, 75-79`; `scenario.ts:50-56`; `world/mechanics.ts:613-616`;
`leaving.test.ts:324`; `referee.test.ts:1124`; `perception.test.ts:76`; Brink `turn.ts:130`,
`rivalMind.ts:95-118`, `systemPrompt.ts:743-753`, `turnReading.ts:157-234`, `prompt.ts:56-63`,
`resolveDescription.ts:23-33`, `briefing.ts:390-470`. Brink issue #52's content was not verified.

## 9. The owner's decisions, rewritten (brief item 7)

The design's D2, D7, D8, D9 and D10 are one question each with a recommendation and a consequence line;
they stand, with D8's recommendation now settled by F9. D1, D3, D4, D5 and D6 are rewritten below, and
two decisions the findings force are added. Each is one question, answerable from what you saw.

**D1. Should the other side be told the attempt, never the outcome ("Mara Voss works to open the
window"), with the outcome reaching it through the object's own line ("It stands open now")?**
Recommended: yes. *Yes* lands R1 as rule (a) and rewrites the ledger texts; *no* means rule (b), a
second sentence built after the outcome, and the precedent ledger splits from the perception text.

**D1b. When the world refuses a visible act (a stale expectation, a bound), should the other side still
be told the attempt?** Recommended: yes. *Yes* closes the same gap from the other side; *no* keeps a
refused reach invisible.

**D3. Should the warden read his own condition list (`both`) — knowing that, as the design stands, the
prisoner then has no winning line (F1) until D4', D5' and D11 are settled?** Recommended: yes, landed in
the same commit as those three, never alone. *Yes alone* is batch K: caught every game. *No* keeps the
warden who misses an open window.

**D4'. Should `block` be an occupation (his act that turn, lapsing when his next act is anything else)
rather than a position he keeps while examining?** Recommended: occupation. *Occupation* makes each
turn with grounds a choice between preventing and detecting, which is the contest §2 describes;
*position* is a free permanent guard and Line D in §2 (unwinnable).

**D4b. State `restore` to the warden as a condition, knowing it advertises a move rather than a
threshold?** Recommended: yes, measured separately in P2. *Yes* tells him the one repair he has; *no*
leaves it unstated as it has been.

**D5'. Should the warden's absence be the cost of an act of his own (mending the bar or lock takes him
out of the cell that round, told to both), or a fixed cadence he does not control (rounds 4, 8, 12)?**
Recommended: the cost of an act, with the cadence kept as an arm. *Cost of an act* is the closed
variant's own shape and gives him the decision; *cadence* gives her a window nobody chose. Either way
the absent half-round is skipped, not asked.

**D6'. Price the door at `margin` and state its condition (`DOOR=stated`) by default?** Recommended:
yes, both. *Yes* makes the door a route she is told about; *price without stating* is a hidden gate;
*free* plus any absence is a two-turn escape.

**D11 (new). Should `close` refuse on a way out whose part is at or under its open threshold (a window
whose bar is out cannot be shut)?** Recommended: yes, told as a refusal. *Yes* removes a free reset the
warden already has (F3); *no* means the warden's best move is one nobody designed and the arithmetic in
the design is wrong in his favour.

**D12 (new). For a person's `sight`, should a moderate act blind (band ≤ 50, like posture's crouch at
≤ 75), so that "throw the blanket over Croft" does what you meant?** Recommended: yes, and his own
`restore` of it slight-only, so clearing it costs two turns. *Yes* makes the lever real against a
warden who acts first (F2); *no* leaves it a magnitude lottery you lose on ties.

**D2, D7, D9, D10:** as the design wrote them. **D8:** fix, not arm — F9 removes the choice.

## 10. What the design got right that was checked

- R1's widened count (5 of 6 outcome sentences false) and its three consumers (perception, ledger
  description, precedent text): confirmed at the transcript and `loop.ts:152-156, 676, 831`.
- R4's central correction: the warden can see condition 4 as a rule sentence (`mind.ts:186-189`, last
  in the prompt, `mind.ts:264-275`); the list on his side is a switch that exists; §34.3/§34.4's numbers
  are as quoted; batch K was qwen3:14b in both model chairs; this game's header says the warden's prompt
  is unchanged.
- R2's reading of round 4: `key_ring/conceal/none`, inapplicable at `referee.ts:727` because the key
  ring declares no properties; D8's declared-space sentence is what he was told. And the two
  unprompted "block" candidates in rounds 9 and 10 are real.
- R3's structural half: with presence off, `targetKeys` is the eleven objects plus `none`; every Phase 1
  batch ran modelled; #28's rows land on `warden` (as `noise`).
- R5's mechanics: the one-act reading is its own call after the main ruling (`referee.ts:892`), flags
  only, and this game's two `several` citations are the second act's span.
- R6's cause: one transition read, the D7a wear unread.
- R7's waiting: the intent is the first source and the prompt's only cacheable prefix is one line.
- Brink: every claim checked against Brink's source holds — rivals read `buildBriefing` with no
  intent channel; a rival's proposal is material the game-master may drop; consequences come from
  `rivalEngine.ts` on a cadence; `buildRivalPrompt` states no condition of the rival's own; the turn
  reader's engagement answers are cited lists that cannot snap; the classifier is the game-master's over
  nine mechanics with no `NONE`. The re-ranking (R1 down to sixth) follows.
- Jurisdiction: no engine code is needed, and the design says so in every bucket row.
- Method: every probe is one driver, serial, rebuilt from `buildOpenWorld`, prediction committed first,
  with kill conditions and a scoreboard convention. The instrument is right; F1 says what it would
  measure.
