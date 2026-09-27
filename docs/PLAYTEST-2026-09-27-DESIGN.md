# Playtest 2026-09-27: the design (pass 1)

**Status:** design only. Nothing here is built, and nothing was run. No model was called and doris was
not touched.
**Written:** 2026-09-27, against `dbc4d71` (the game's own revision) from
`docs/PLAYTEST-2026-09-27-REQUIREMENTS.md`, the transcript
`checkpoints/2026-09-27T20-14-57-505Z.md`, its `.referee.json`, the code, and OPEN-VARIANT.md.
**For:** the owner, who decides D1–D10 (§7) before anything is built; then the red team (§6 of the
requirements), which attacks this document, not the requirements.

## 0. How to read this

§1 records where the requirements' own diagnoses were wrong or incomplete, because the requirements
said to assume a third wrong one was waiting. There were three, and one of them (R4) changes the shape
of the whole design: **the fix R4 asks for already exists, was measured on 2026-09-17, and was kept off
because it makes the prisoner lose every game.** So R2, R3 and R4 cannot be designed one at a time.
§2 lays the contest out as turn arithmetic first, and the per-requirement sections in §3 then say what
each change is, where it lives, and how it is measured. §4 re-ranks the Brink applicability from Brink's
code. §5 lists every default and pin the design changes. §6 is the measurement plan as one
`PREDICTION.md`-shaped block per probe. §7 is the owner's decisions. §8 is the landing order.

Every jurisdiction bucket is named in its requirement's own row, per the owner's four-way split: **this
game** / **run-dmcp** / **authoring guidance** / **model choice**.

## 1. Three corrections to the requirements, and two smaller ones

1. **R4: the warden can see condition 4. It is a rule sentence, not a condition, and that is the
   measured difference.** `src/open/mind.ts:186-189` states the catch rule to the warden as one
   60-word sentence with four `or` branches ("...or a way out and finding it standing open"), placed at
   the very bottom of its prompt (`renderSeatSituation`, `mind.ts:264-275` puts `ruleLines` last). The
   prisoner used to be told her thresholds the same way, and §33.15/§34 measured what it costs: a mind
   told rule sentences keeps preparing; told a numbered condition list at the top, it acts (11/12). The
   arm that gives the warden the list from its own side is `PRISONER_CONDITIONS=both`, and **§34.3
   already measured exactly this game's round 10**: on batch G's recorded "she opened the window last
   turn" contexts the baseline warden looked at the window **0 of 20** times and the list warden **20 of
   20**, "often reasoning from the list by number". Batch K (§34.4) then played it: **caught at round 6,
   4 of 4**. The transcript header of this game says so in its own words: "the warden's prompt is
   unchanged (§34)". R4's fix is a switch that exists. Why it is not the default is the real finding: with
   it on, "the contest is now decided at the unlock itself" (§34.4) and no prisoner has ever won a game
   against it. R4 is therefore not a reasoning failure to be fixed generically; it is a deliberate
   handicap that was standing in for the counter-moves the prisoner does not have. §2 designs the
   counter-moves; D3 asks the owner to turn the list on.

2. **R1: the count is five, not four, and the ledger lies as well as the warden.** The four "Mara Voss
   opens the window." lines (rounds 4–7) are confirmed. Round 2's "Mara Voss hides the blanket from
   view." is a fifth: the blanket's concealment went 0 → 50 and the same turn's scene rendered it "It
   lies humped, as if something is under it" (`scenarioObjects.ts:355-358`), in plain sight. `conceal`
   and `expose` state outcomes exactly as `open`/`close` do (`loop.ts:405-410`). Round 9's "opens the
   window" was true, so 5 of 6 outcome-verb sentences in this game were false. And `describeAttempt` is
   computed **before** `resolve()` (`loop.ts:676`) and handed in as the resolution's own `description`
   (`effects.ts` every plan's `description` parameter), so the engine's ledger records "Mara Voss opens
   the window." against a resolution whose result was `opened: false`. The precedent ledger's texts
   (`precedentTextFor`, `loop.ts:152-156`, `checkpoints/precedent-ledger.json`) are built from the same
   sentence. R1's fix must therefore reach three consumers, not one.

3. **R3: presence `off` is the odd one out, not the norm.** Every Phase 1 batch since 2026-09-23 ran
   `PRISONER_PRESENCE=modelled` (`checkpoints/2026-09-24-phase1-b5/PREDICTION.md`: "presence
   modelled"), and so did the owner's 2026-09-25 game that filed #28. Only the code default is `off`
   (`briefing.ts:95-99`), and only a run that sets nothing gets it, which is what this game was. Under
   `modelled`, person-aimed intents **do** land on the person: #28's "throw the spoon at the warden"
   ruled `warden/noise` twice, and §68.3 measured `warden/wear/posture` 5/5. So R3's "silent rewrite"
   has a structural cause (no person in the answer keys) that a default change removes, and a residual
   reading question (does "throw the blanket over Croft" land on Croft or the blanket once both are
   keys?) that nobody has measured. §3.3 separates the two.

Two smaller ones:

4. **R2: the model warden reached for the blocking move on its own, twice.** Round 9's candidates
   include "Step between Voss and the window to block access" and round 10's "Move to stand between
   Voss and the window to block access", with no mechanism behind either and no rule saying it would
   work. §57.3's record is that models never touch a new affordance; this is the first affordance a model
   asked for before it existed. It still chose the examination both times, which is the right choice at
   suspicion 90–95 if condition 4 is read (a catch ends the game; a block only delays). The reach measure
   for R2 (§6, probe P2) is therefore taken at a **low-suspicion** context, where the catch is not
   available and blocking is the only prevention there is.

5. **R6: the contradiction is two days old.** The side effect that the belief store misses (the bar
   wearing under a refused `open`) is D7a, landed 2026-09-26 (`mechanics.ts:251-269`, §76.2). Batch 7
   (2026-09-25) predates it and has zero such contradictions; this game has six (rounds 5–10). The
   "before" count in R6's measure is 0, not something to go and count.

## 2. The contest, as turn arithmetic

The owner's verdict was about the whole game, so this is the frame every change below is judged in.
Constants: suspicion threshold 40 (`SEARCH_SUSPICION_THRESHOLD`), a visible moderate act +10
(`FILE_SUSPICION_BUMP`), the bar wears 15 a dig and opens the window at ≤ 50 (`OPEN_WINDOW_BAR_MAX`),
the bar catches at ≤ 30 (`OPEN_CATCH_BAR_MAX`), an open way out catches on sight (condition 4,
`gameEnd.ts:43`), evidence adds (drop ÷ 2) when an examination finds unexplained wear
(`loop.ts:850-855`). The warden acts first in every round (`game.ts:89`).

**Today, list on the prisoner's side only (this game):** four digs (bar 100 → 40, suspicion 0 → 40),
open (+10, suspicion 50, window stands open), leave. The warden could have caught at round 10 by
examining the window and did not, because it read a rule sentence. **She wins only if he misreads.**

**With the warden's list (§34.4, batch K):** same four digs, open; his very next turn examines the
window at suspicion ≥ 40 and catches. **He wins every time.** The margin §33.5 built between the window
(50) and the bar catch (30) is real but irrelevant once condition 4 exists, because the open itself is
the evidence.

For the prisoner to have any line against a warden who reads, one of four things must be true at the
moment she opens a way out: (i) his suspicion is under 40; (ii) he is not in the cell; (iii) he cannot
look (down, or blinded); (iv) he is looking at the wrong exit. Today only (i) is reachable, and only if
the referee rules her digs `silent` (no bump, `loop.ts:839`), which is a phrasing lottery.

**The design gives her all four, and gives him a way to prevent rather than only detect:**

| lever | who | what it is | exists today? |
|---|---|---|---|
| presence rhythm | both | the warden is out of the cell on a fixed, stated cadence (rounds 4, 8, 12, …); the closed variant's own "the warden is AWAY ... hears nothing" rule (`world/mechanics.ts:613-616`), which O1 dropped (§9.3) | closed variant only |
| `block` | warden | stand in a way out; nobody leaves through it while she stands there on her feet; released when she blocks elsewhere, leaves, or her posture drops (custody's C1 gate, `mechanics.ts:381`) | no |
| `restore` | warden | mend the bar or the lock (+50 moderate); already an effect, never stated to him | yes, unstated |
| `sight` on a person | prisoner | cover his head with the blanket: he perceives nothing that turn, keeps nothing (C1 extended), and cannot examine until he clears it | no |
| `posture` on a person | prisoner | put him on the floor; he keeps nothing (C1) and cannot block | yes, under presence |
| the door at `margin` | prisoner | the second exit, priced so it is not a free two-turn win during his absence (§50.5–§50.7) | arm |

The lines that result, warden reading his list, one absence in every four rounds, door at `margin`:

- **Window, patient:** dig r1–r3 (bar 55, suspicion 30, plus whatever evidence he gathers by examining:
  each look at a worn bar adds 7). If he examines the bar at all, suspicion reaches 40 by r3 and the
  open at r5 is caught on his return. If he does not, she digs a fourth time in his absence at r4 (bar
  40, suspicion 30, nobody saw it), opens at r5 in his presence (+10, suspicion 40): **caught at r6**.
  So she must open in an absence and leave the next round; with a one-round absence, the open is
  visible on his return and catches at ≥ 40. Her line is therefore: keep suspicion under 40 by his r8
  return (three visible digs, one unseen), open during r8, leave r9 before his examination at r9 — he
  acts first at r9, examines the open window at suspicion 30: **no catch (under 40), she leaves.** He
  can still `block` the window at r9 instead of examining; then she goes for the door.
- **Door, at `margin`:** two lock wears (100 → 60, +20), open in an absence, leave: four turns, suspicion
  20 plus evidence. His counters are the same: examine the lock early (80 → +10 evidence), block the
  door, restore the lock.
- **Blind him:** blanket over his head (one turn, no suspicion: an act on a person raises none,
  `loop.ts:191-194`), then open and leave while he clears it (his own turn, a `restore` on his own
  sight). Two turns of his blindness cover one open and one leave only if clearing costs him a turn;
  it does, so this is a real line and the one the owner tried.
- **His prevention:** at any round he may `restore` the bar (+50) instead of looking, which costs her
  three digs; or `block` the exit she has been working, which forces her onto the other; or examine to
  accumulate evidence so that the open is caught wherever it happens.

This is a contest with decisions on both sides, and a numeric knife-edge (40) that both can read. It
is not proven balanced here; §6's P5 is the batch that measures it, with a kill condition on either
side winning everything. The red team's item 2 should attack these lines.

## 3. The requirements

### R1. The other side is told the attempt as if it were the outcome

**Diagnosis, confirmed and widened (§1.2).** `describeAttempt` (`loop.ts:390-457`) is one sentence per
effect kind, built before resolution, used as the resolution's own description, as the perception sent
to the other principal (`loop.ts:831`), and as the precedent ledger's text. Six cases already describe
the attempt (`wear`, `restore`, `reveal`, `noise`, `leave`, `take`, `give`); five describe an outcome
(`open`, `close`, `conceal`, `expose`, `derive`'s "works a piece loose", which is also false when
`made: false`). A refused resolution sends nothing at all (`loop.ts:862`, `perceptionForOther: null`),
so a visible attempt the world refused vanishes from the other side, which is the same defect in the
other direction.

**Rule adopted: (a), every sentence describes the attempt.** Three reasons, in order of weight:

1. The sentence is built before `resolve()` and doubles as the ledger description and the precedent
   text. Rule (b) would need a second sentence built after the outcome, and the ledger, the perception
   and the precedent text would no longer be one string. The precedent ledger matches on exact string
   equality (`loop.ts:148-156`), so splitting them breaks the arm.
2. The outcome already reaches the other side through the world, not through the sentence: the window's
   own `reads` line ("It stands open now...") appeared in the warden's perceived list at round 10, the
   turn after it opened, and the blanket's `readRanges` line said "humped" the turn after the conceal.
   That is this repository's own principle (say what is, from state), and it means (a) loses no
   information that a bystander could actually have.
3. Under (b) the sentence must also be true when the outcome is partial: "hides the blanket" at
   concealment 50 is not hidden (the perception gate is ≥ 50, `briefing.ts:240`). (a) has no such edge.

**The change (`loop.ts`, `describeAttempt`):**

| kind | today | proposed |
|---|---|---|
| open | `X opens the Y.` | `X works to open the Y.` |
| close | `X shuts the Y.` | `X works to shut the Y.` |
| conceal | `X hides the Y from view.` | `X works to hide the Y.` |
| expose | `X brings the Y into view.` | `X works to uncover the Y.` |
| derive | `X works a piece loose from the Y.` | `X works to free a piece of the Y.` |

Plus: a **refused** resolution relays the same sentence when perceptible (`loop.ts:862` currently
returns `null`), because the bystander saw the reach whether or not the world let it land. The
`precedent-ledger.json` texts are rewritten once in the same commit, with a test that every ledger text
is producible by `precedentTextFor`.

**Test, first.** A table test over every `EffectKind` except `none`: run one half-round where the mechanic
resolves and one where it refuses (a gate, a holder on her feet, an already-stripped parent), and assert
`perceptionForOther` is the identical string in both. That pins rule (a) structurally for every kind
including future ones (the `Record` device `SET_ABOUT_PHRASE` already uses fails to typecheck a new
kind without an entry). `leaving.test.ts:324` ("Mara Voss opens the door.") changes on purpose.

**Measure.** M1 (offline, a test): re-render this game's 20 half-rounds through the new sentence and
count sentences that assert an outcome that did not occur: **5 → 0**. M2 (probe P4 in §6, shared with
R4): does the warden behave differently when it is not lied to? Prediction: with the false line the
warden's `notes` record "Voss opened the window" or equivalent in ≥ 8 of 10 samples of round 6's
context (this game's round 6 did); with the true line ≤ 2 of 10. What it **chooses** to examine is
predicted to move by at most 2 of 10, because §34.3 measured the list turning 0/20 into 20/20 with the
false line present: the lie corrupts his notes, the sentence shape decides his act.

| bucket | this game (`src/open/loop.ts`, `checkpoints/precedent-ledger.json`) |
|---|---|

**Brink, verified safe.** A rival's context is `buildBriefing(gameId, { seatId })` with no
`recentEvents` (`src/rivals/turn.ts:130`), which renders resolved state only (alignment, presence,
demands, accords, cohesion through fog). The player's own "since you were last at this desk" lines come
from `summarizeOutcome` over a resolve outcome's `narrationConstraint.mustHonor` facts
(`src/session/briefing.ts:390-470`), never from an intent. Rival proposals reach the game-master
labelled "what that seat WANTS ... not a fact of the world" (`src/persona/systemPrompt.ts:743-745`).
There is no channel through which a rival learns what the player attempted. Nothing to do.

### R2. The opponent's only winning move is to look

**Diagnosis, confirmed.** All four catch conditions require an examination (`conditions.ts:57-60`,
`gameEnd.ts:34-53`). Round 4's "Grip the key ring tightly against my belt and step back a pace" was
ruled `key_ring` / `conceal` / property `none` (the `.referee.json` entry cites desc:key_ring words 1–8
for the property): the key ring declares no properties at all (`scenarioObjects.ts:380-388`), so
`propertyNamedWhenRequired` fails (`referee.ts:727`), the ruling is inapplicable, and D8's
declared-space sentence told him "The key ring has nothing to hide. It can be struck, or handed over."
The act he wanted, keeping a thing from someone's reach, is not `conceal` and is not any effect kind:
custody's only protection is passive ("a holder on her feet keeps it", C1). Also unstated to him:
`restore` on the bar or lock, which he could have done at any round and which would have cost her three
digs at a stroke.

**The change.** One new effect kind, `block`, and one stated existing one:

- **`block`** (target: a way out; "stand in it, so nobody passes"). Resolves as one `set` of the way
  out's `blocked_by` to the actor's character id, inside `resolve()` — the same change kind `OPEN_LEAVE`
  uses for `location_id` and `OPEN_TAKE` for `owner_id` (`mechanics.ts:353-358`), so nothing new enters
  the engine. `OPEN_LEAVE` reads `blocked_by` beside `passage`: the way is passable and unblocked, where
  "unblocked" is no blocker, or a blocker whose posture is at or below `POSTURE_ON_HER_FEET_ABOVE` (75,
  C1's own line, `mechanics.ts:381`), or a blocker not in this location. A `block` on another way out
  clears the first in the same resolution (one body, one doorway); `leave` by the blocker clears it;
  posture does not need clearing because `OPEN_LEAVE` reads it live. The blocker may do anything else
  (examine, restore, speak) and stays in the doorway: a block is a position, not an occupation.
- **Told to both sides as conditions**, in the flat list the mechanism already has
  (`conditions.ts`, `conditionList.ts`): "If Warden Croft stands in a way out, and Warden Croft is on her
  feet, then Mara Voss cannot leave through it" (for Croft, read from either side), and "If the bar's
  integrity is below 100, then Warden Croft can mend it" (for Croft) and the same for the lock. These are
  claims `world.ts`/`effects.ts` enforce, asserted against the world by test the way the door condition
  already is (`conditions.ts:15-21`).
- **What the prisoner can do about it** (the requirement's own test): the other exit (he blocks one);
  act while he is out (the rhythm, D5); put him down or blind him (R3, presence); and the block does not
  stop her working, only leaving, so the digging line continues and the decision moves to which exit he
  guards at the moment she is ready. §2's table is the arithmetic.

| bucket | this game for the effect, its conditions and mechanics (`src/open/effects.ts`, `mechanics.ts`, `conditions.ts`, `scenarioObjects.ts`). **run-dmcp: nothing** — the write is a `set` on an entity's own column, which 0.7.0 already provides; a "guarded exit" is one game's idea and fails the admission test until a second real caller has one. |
|---|---|

**Measure (both halves, §6 P2 and P5).** Mechanism: unit tests (a leave through a blocked way out
refuses while the blocker stands; succeeds once she is crouched, has blocked elsewhere, or has left; a
second block clears the first). Reach: P2 asks a Muse warden, list on, at a **low-suspicion** context
(this game's round 5: "works to open the door" would be the news under R1; suspicion 10; no catch
available) 10 times serially: **prediction: `block` chosen ≥ 4 of 10**; the game's own round 9–10
contexts (suspicion 90–95, window open) are the control where the catch should dominate: window
examination ≥ 6 of 10, block ≤ 3. **Kill: block 0 of 10 at the low-suspicion context** means the
mechanism failed, not the model, and it is pulled before any batch. P5 (the batch) counts games in which
the warden rules `block` at least once: prediction ≥ 4 of 6; kill ≤ 1 of 6.

**Brink, the most direct of the seven (rank 1 confirmed).** A rival mind's proposal is *material for the
game-master* (`src/rivals/turn.ts` header: "a proposal is CONTEXT for the game-master ... never text
spliced directly"), and the game-master is told it is "not a fact of the world and not a script" and may
"let it pass unused" (`systemPrompt.ts:749-753`). The rival moves that have consequence — a show of
force, a seizure raising a demand — come from `src/tools/rivalEngine.ts`, which rolls on a cadence and
calls `resolveClassifiedAction` for the seat with no mind involved. So Brink's rival mind can want; only
its dice can act. That is the warden who can only look, one abstraction up. The mind-seam context carries
what the fix needs (the seat's own briefing is already the fog-correct input, and an intent is already
the output); what is missing is the caller that rules a rival's intent into a mechanic the way it rules
the player's — the resolve tool's classifier run for a rival seat. Brink's own note is that this needs a
delivery surface (`turn.ts` header, speaker tags), which is the same reason `block` here needs a
condition line: an affordance the mind is never told about is decoration.

### R3. A person cannot be the target of an act

**Diagnosis, confirmed and split (§1.3).** With presence `off`, `targetKeys` is the eleven objects plus
`none` (this game's `.referee.json`, round 2's `answerKeys`); Croft is not a key, so "throw the blanket
over croft" could only land on the blanket. That is structural, and it is the default's fault. With
presence `modelled`, the person is a key, the person clauses fire (`referee.ts:442-458`), and #28's two
"throw the spoon at the warden" landed on `warden`. What is *not* known is whether an act done to a
person **with** an object lands on the person or the object once both are keys; the target question's
own rule for hiding ("names the thing hidden, never the place") pulls toward the object, and D9's
container clause ("getting under or beneath a thing names that thing") pulls the same way.

**Three changes.**

1. **Presence `modelled` becomes the default** (`readPresenceMode`, `briefing.ts:95`). Cost: a batch
   boundary for runs that set nothing — but every Phase 1 batch already ran `modelled` (§1.3), so the
   boundary is between this game and the batches it should be comparable to, in the right direction.
   `off` stays as the arm for a run that wants the pre-§55 request fingerprint.
2. **A reading rule for the target question, under presence only:** "An act done to a person with a
   thing — striking, covering, blinding, restraining, tying — names the person; the thing is only what it
   is done with." Generic, conditional on a person in view like every person clause, an arm
   (`PRISONER_PERSON_INSTRUMENT`, off until P3 lands it), never a prisoner-only hint: it is the same
   sentence for any two people in any room.
3. **The act itself, specified: impairing someone's perception is a `wear` on a person's `sight`.**
   A second person property beside `posture` (`scenarioObjects.ts:475-490`'s own shape): 100 clear,
   ≤ 25 "Something covers her head; she cannot see." (`readRanges`, the §56 device), worn by a
   substantial act to 0 and a moderate one to 50, restored by her own act (a `restore` on her own
   `sight`, which is reflexive exactly as posture's D6 elision clause already handles). Consequences, all
   through existing reads: while `sight` ≤ 25 the other's acts reach her as nothing (`perceptionForOther`
   gated the way absence gates it, `loop.ts:553`), `OPEN_TAKE`'s keep gate reads posture **or** sight
   (a blinded holder keeps nothing), `OPEN_REVEAL` by her refuses ("you cannot see it"), and `block`
   does not hold (read live, like posture). Her description gains the words the citation needs: "Her
   eyes are on the cell." An act on a person raises no suspicion (existing rule). **Property on a
   person, in scope**, not an effect kind and not out of scope: the owner tried it on turn two of a
   ten-turn game.

| bucket | this game for the default, the person property and the clause (`briefing.ts`, `scenarioObjects.ts`, `referee.ts`, `mechanics.ts`). **run-dmcp: nothing** — a person's bounded property is `createResource` with `ownerType: "character"`, which §56 already used; the reading rule is prompt text, which is the caller's by design. |
|---|---|

**Silent-rewrite detection.** Two parts. (a) Structural: under `off`, every person-aimed human intent is
a rewrite by construction; with `modelled` the default, that class is gone. (b) Measured: the `.rows.jsonl`
row (D11 §8.2, run-dmcp#43's first caller) gains one field the seat already knows, `personsInView`
(the ids), so a later audit can tell "no person was a key" from "a person was a key and the referee
chose the object". The owner's per-row label set (§7.2) gains `rewritten` for the second case. No code
reads meaning: the row carries data, the label is the owner's.

**Measure (§6 P3).** Replay through requests **rebuilt from `buildOpenWorld` at presence `modelled`**
(never the recorded round-2 request, which is the wrong arm, §68.8): this game's rounds 2 and 3, the
2026-09-25 game's `I25-3`/`I25-5`, the blind game's `HB-r1`/`HB-r3`, `G1-r1`, and four controls that
must stay on the object (`take the blanket`, `hide the spoon under the tile`, `hide under the blanket`
→ blanket per D9, `pull a wire out of the cot`). N=5 each, serial, clause off then on. **Prediction:**
round 2 lands on `warden` ≤ 1/5 with the clause off and ≥ 3/5 on; the controls move 0/20. **Kill:** the
clause on lands round 2 on `warden` ≤ 1/5 (the clause failed), or any control moves ≥ 2/5 (it captures).
Reach by a model: P5 counts model-prisoner intents ruled against `warden`; prediction 0–1 of 6 games,
reported and carrying no weight — §57.2 already measured that models do not aim at people, and R3 is a
requirement about a person in the seat.

**Brink, lower than ranked (§4).** Brink's reader (`src/gm/turnReader/turnReading.ts:157-234`)
cannot snap to the nearest key: its engagement answers are *lists* filtered to board keys with a quote
that must appear in the player's words, so "none" is the empty list and needs no key of its own, and the
prompt says outright that association is not engagement (`prompt.ts:56-63`). The classification of the
player's *action* into a mechanic is the game-master's, over nine mechanics with no `NONE`
(`src/register/resolveDescription.ts:23-33`), and its measured failure is the opposite direction:
**under**-firing (issue #52, PRESTIGE_CONTEST never chosen). The transferable lesson survives — a closed
classifier needs a visible refusal — but Brink's reader already has one, and its classifier's evidence
points the other way.

### R4. The warden cannot see, or does not use, its own win conditions

**Diagnosis, corrected (§1.1).** It can see them, as a sentence; the list is the measured fix
(§34.3: 0/20 → 20/20; §34.4: 4/4 catches). The inverted plan ("Keep suspicion below 40", round 6) has
the same cause: the rule sentences tell him suspicion *rises* when she damages things and that he has
*grounds* at 40, and nothing tells him which direction he wants it to go; in English a warden keeping
suspicion low sounds like calm. The list from his side says "If warden suspicion is at or above 40, and
you closely examine the bar, and you find its integrity at or below 30, then you catch Voss", which
makes the direction of his own number explicit without any sentence about wanting.

**The change.** `PRISONER_CONDITIONS` default `list` → `both` (`conditions.ts:75-79`). No new
mechanism, no prompt hint: the identical generic module (`conditionList.ts`, "nothing in this module
names this game") read from the other chair, which is what D4 (§40.3) kept here until Brink has one.
The R1 false line and the rule-sentence shape are separated by P4's 2×2 (below); the design's own
prediction is that the shape decides the act and the lie corrupts the notes.

**Model choice, answered by P4.** §34.3/§34.4 were measured on `qwen3:14b`; this game's warden is Muse
30B, which "never lost a prisoner" while reading a sentence. P4 at round 10's context: **prediction:
Muse with the list examines the window ≥ 8 of 10** (qwen did 20/20 in the same shape). **Kill: < 5 of
10**, and the bucket becomes model choice: a 30B that cannot read a seven-line list from its own side is
the wrong warden, and the referee-model finding (§72, Sonnet 42/43 vs a 14B 21/43) has a warden-side
twin. The inversion is measured on the same samples by hand-reading `plan` for a direction on suspicion:
prediction "keep it low" in ≥ 5 of 10 with sentences, ≤ 1 of 10 with the list.

| bucket | this game (the default in `src/open/conditions.ts`); **model choice** if P4's kill fires. |
|---|---|

**Brink, rank 2 confirmed, and sharper.** `buildRivalPrompt` (`src/gm/local/rivalMind.ts:95-118`) gives
a rival its archetype, its backstory and its briefing, and asks what it wants. **No condition of its own
is stated to it at all**: nothing says what a seat's win looks like, what a demand's ignore clock does to
it, what standing it loses by conceding. A rival that misreads its incentive here is not a bug in
Brink; it is a mind that was never told. The generic list (`conditionList.ts`) is the export D4 was
waiting on a caller for, and this is the caller.

### R5. A two-act intent attempts the later act

**Diagnosis, confirmed.** The one-act reading is its own call after the main ruling
(`referee.ts:816-829`, `:892`) and only flags. Which act was attempted is whatever the six independent
questions answered: round 8's `effect` cited words 8–9 ("and leave"), the one-act `several` cited the
same span. The owner's §74 decision 1 was to refuse; the code flags instead because the detector counts a
preparatory step as a second act about one time in four (§74.1's own comment), and this game had one
such false positive (warden round 7, "check its concealment and the hollow beneath it"). A refusal would
have spent that turn too.

**The change: the first act is attempted, and the player is told which, in their own words.** When the
one-act answer is `several` with a verified citation, that citation is the span of the *second* act (the
question asks for "the words that show the second act", `referee.ts:189`). Truncate the intent to the
words before that span and rule the truncated text as a fresh intent (one extra referee call, only when
`several` fires, served from the cache on an exact repeat). Tell the actor: `A turn does one thing. This
turn: "Pull the bar out of the window". "and leave" waits.` — both quotes verbatim from the player's
text, composed by code from word ranges (`sourceWords`, run-dmcp 0.10.0), never paraphrased. **A false
positive costs nothing:** if the truncated ruling is inapplicable (the "second act" was really the
noun the act needed), the full ruling stands exactly as today. That is why this beats refusal.

| bucket | this game (`src/open/referee.ts`, `perception.ts`). Not run-dmcp: the reader knows questions and sources, not acts; which of two acts a turn takes is a game rule, and the engine has no turn. |
|---|---|

**Measure (§6 P1).** The D11 corpus's three compounds — `HB-r2` "open the door and leave" (expected
`door/open`), `HB-r10` (expected `warden/wear/posture`, the strike), this game's round 8 (expected
`window/open`) — plus the eleven corpus rows that read as compound and are one act (`B7-P18`, `P23`,
`P36`, `P48`, `P58`–`P61`, `W04`, `W07`, and this game's warden round 7). **Prediction: 3 of 3
compounds rule the first act after truncation; ≤ 1 of 12 controls is flagged `several` and changes
its ruling.** Kill: ≥ 3 controls change.

**Brink, low, confirmed.** The game-master calls the resolve tool as many times as a turn needs (issue
#52 records three classifications in one turn), and the reader's answers are sets. A compound order is
its normal case. Nothing to do.

### R6. A player's own results do not update what they are told they know

**Diagnosis, confirmed.** `updateActorBelief` (`loop.ts:495-502`) reads one transition, the plan's own
resource (`window_passage`). D7a's wear on the part lands in `outcome.transitions` as a second
`setResource` (`mechanics.ts:261`) and is rendered into the actor's own sentence
(`perception.ts:430`: "the bar's integrity went from 100 to 85") and never into her belief.

**The change.** Every transition in the actor's own outcome whose entity is a named resource
(`resourceNameById`) updates that actor's belief at this round. "Told" is answered by construction: the
actor's own outcome sentence is rendered from the same `outcome.result`, and the closed variant's rule
(`ownMoveFeedback`: the actor learns the exact number it moved) already applies to what her own hands
did. The suspicion bump is a separate resolution (`bumpWardenSuspicion`) and is not in her outcome, so it
correctly stays unknown to her. Test first: round 4's outcome (an `OPEN_PASSAGE` open with the gate
refused and `wearOnRefusal` applied) leaves `bar_integrity` = 85 as of round 4 in the prisoner's beliefs.

**Land as a fix, not an arm (D8).** It changes the model prisoner's briefing line, so it is a batch
boundary; but the alternative keeps a line that is false, and an arm whose "off" is a lie has nothing to
compare against. Recorded with its date the way §76's scenario change was. Count: this game 6
contradictory briefings, batch 7 zero (§1.5), after the fix zero by the test.

| bucket | this game (`src/open/loop.ts`) |
|---|---|

**Brink, low as a bug, medium as a lesson, confirmed.** The player never sees a value (Pillar 0), and a
rival has no memory of its own beyond the state it is rebuilt from each turn — which is also why the
side-effect lesson does not bite there yet: a rival that remembers nothing cannot remember wrongly. It
will bite the day a rival keeps notes.

### R7. The turn itself is not fun

Grouped as: **texture** (world), **the screen** (seat only), **waiting** (seat and serving).

**Texture without dice (world; this game, authoring).** The magnitude ladder is fixed, so the
variety has to come from the *object* changing under the act, which the world already knows how to do
and does for the cot and the blanket (`readRanges`, `scenarioObjects.ts:321-324`, `:355-358`) but not
for the bar. Three bands on `bar.integrity`, silent above 70 (say what is, never what is absent):

| at or below | reads |
|---|---|
| 70 | Bright metal shows through the rust where it meets the mortar. |
| 55 | The mortar at its foot has crumbled away in places. |
| 40 | It shifts in its socket. |

Digs 1 and 2 change nothing visible (the first cut is not texture, it is arithmetic); digs 3, 4 and 5
each change the bar's line in the scene, and the delta view shows exactly the changed item. This
reaches both principals (the warden sees "shifts in its socket" without looking closely), which is a
real gameplay change and a correct one: visible damage is visible. The catch is unchanged (a close look
finding ≤ 30). Because desc:bar's text grows, the recorded citations (words 16–22) survive (appended at
the end) but the referee's reading may not: **scenario change recorded like §27, with a replay probe
(§6 P6) of the D11 corpus's `bar-open`/`bar-wear`/`window-open`/`warden-bar-reveal` rows** before it
lands. This is the authoring guide's own "declare the space of what an object may come to be" lesson
applied to its reading, so the lesson goes to the guide (§8 step 1) in neutral words: a property a mind
is meant to work on across several turns should read differently as it moves, or every turn reads the
same.

**The screen (seat only, no batch impact, `PRISONER_VIEW=play`):**

- **Stakes once.** `buildOpenBriefing` renders the stakes line every turn for the model
  (`briefing.ts:338`), and the play view keeps it because `parseBriefing` files it under `other` (news,
  always shown). Recognise this repository's own template (`scenario.ts:50-56`, a literal check on our own
  output) as a `stakes` block, STANDING in the delta view (`deltaView.ts:34`), shown once and again in
  the last five rounds. The model prompt is untouched.
- **Beliefs by item.** The knowledge block becomes a list block like the scene (one `ProseItem` per
  belief, keyed by resource), so the delta holds back unchanged beliefs with the same "held back" notice
  and a `known` no-turn command prints them all. The stamp argument in `deltaView.ts:89-97` (a stale
  belief needs its stamp in front of the player) is honoured the other way: an unchanged belief was in
  front of them last turn, and the notice says it is unchanged.
- **A boolean reads as words.** `beliefSentence` (`proseView.ts:152-154`) renders a property that
  declares `reads`/`readRanges` by its words: "Your last word on the window, as of round 9, was that it
  stands open." The raw view and the model's "window passage: 1 (as of round 9)" are untouched.
- **The window's open line.** "the bar is out of its widest gap" is a leftover from the plural-bar era
  (§27/§28); §76 removed "widest gap" from the bar's lead-in and not from the window's `reads`
  (`scenarioObjects.ts:133`). Proposed: "It stands open now: the bar is out, and the gap is wide
  enough to climb through." The cited span "stands open now:" (words 41–43, round 10's `leave`)
  survives; §33.7 says the referee could not rule a climb-out as `leave` without this line, so the
  reword is replayed on round 10 and §33.7's nine climb-outs in P6 before it lands. Scenario change.

**Waiting.** Measured from the transcript: a warden half-round is ~50 s and a prisoner's ruling is
~33 s plus ~6 s for the one-act call (`.referee.json` `ms`), so between typing and reading the result
the player waits ~40 s for their own ruling and then ~50 s for the warden's whole turn, and sees
everything at once because `game.ts:124-126` files the outcome into the *next* briefing. Two changes,
seat only:

1. **Show the player's own outcome the moment it resolves.** `onHalfRound` (`checkpoint.ts:1392`)
   already has `half` and the seat's `notify`; write `renderOwnOutcome(half)` there for the seat's own
   half-round, then "(Warden Croft is thinking.)", and hold the identical line back from the next play
   view (exact string equality, the delta's own discipline; the raw view still carries it). The wait to
   *know* drops from ~90 s to ~40 s; the round is no faster.
2. **What can run earlier: nothing of the warden's.** Its briefing depends on the prisoner's resolution,
   and both referee calls are serial on one card. The only lever on the ~33 s itself is the request:
   the intent is the *first* source (`refereeTransport.ts:97`), so the server's prefix cache is
   defeated on every call by design. Putting the stable sources first and the intent last is a
   hypothesis worth one probe (P7: predict ≥ 20 % off the ruling's `ms`; kill < 10 %), and it changes
   the request bytes, so it is an arm behind a fingerprint, not a fix. **Model choice** is the honest
   floor: a 30B at temperature 0 on this card rules in ~30 s, and a 14B that rules in 10 s was measured
   worse (§72).

| bucket | texture and the window line: this game, scenario content; the lesson: **authoring guidance**. The screen and the early outcome: this game, seat only. The request order: this game, an arm; the floor: **model choice**. |
|---|---|

**Brink.** Low, confirmed; the reader starting before the game-master (CLAUDE.md rule 5) is exactly
change 1 done earlier.

## 4. Applicability to Brink, re-ranked from Brink's code

| rank | req | was | why |
|---|---|---|---|
| 1 | R2 | 1 | A rival's mind can only want; its consequences are dice (`rivalEngine.ts`). Confirmed. |
| 2 | R4 | 2 | A rival is told no condition of its own at all (`rivalMind.ts:95-118`). Sharper than "misreads". |
| 3 | R3 | 3 | The reader cannot snap (lists, quotes, empty is none); the classifier under-fires (#52). Lesson only. |
| 4 | R5 | 5 | The game-master already resolves several acts a turn. |
| 5 | R6 | 6 | A rival keeps no notes yet; the lesson waits for the day it does. |
| 6 | R1 | 4 | **Verified structurally safe** (`turn.ts:130`, `briefing.ts:390-470`); nothing to carry. |
| 7 | R7 | 7 | Presentation is the game-master's; the early read exists. |

R1 drops because the verification the requirements asked for came back clean; R3 stays third on the
strength of the lesson, not of a found defect.

## 5. Every default and pin this design changes

| change | default | batches it separates | pins that change |
|---|---|---|---|
| R1 attempt-only sentences | wording | every batch since §12 (the other mind's briefing text) | `leaving.test.ts:324`, transcript pins for `open`/`conceal`/`expose`/`derive` perceptions, `precedent-ledger.json` texts |
| R3 presence | `off` → `modelled` | a default-run batch from every default-run batch before it; **aligns** with b3–b7 which already ran `modelled` | `referee.test.ts:1124` fingerprint PIN is unaffected (it is taken with objects only) |
| R4 conditions | `list` → `both` | batches F/G/H… (warden on sentences) from everything after | none in code; the transcript header line |
| R2 `block`, `restore` stated | new conditions | both prompts change: a boundary for both chairs | `conditions.test.ts`; the seat's `conditions` output |
| R3 `sight`, the person clause | arm, off until P3 | none until landed | `PERSON_PROPERTY_KEYS` tests |
| presence rhythm (D5) | new rule line in both briefings | both chairs | briefing pins |
| door price (D6) | `free` → `margin` | every batch under `free` | `world.test.ts` door gate |
| R6 belief from every transition | fix | the prisoner's belief line from D7a (2026-09-26) onward | `loop.test.ts` belief assertions |
| R7 bar bands, window line | scenario text | every batch: the referee's desc:bar and desc:window sources | `scenarioObjects.test.ts`, the `Objects as authored` header |
| R5 first act | behaviour | only turns flagged `several` | `perception.test.ts:76` (the flag sentence) |
| R7 seat changes | view only | none | `humanSeat.test.ts`, `deltaView.test.ts` |

Committed predictions: none is invalidated. b5–b7's `PREDICTION.md` files describe their own arms and
were scored; a new batch after these boundaries is a new batch, not a rescoring. The one standing
prediction that this design **reads differently** is §34.4's implicit one ("the contest is decided at
the unlock"): it was true of a room with no counter-moves, and P5 re-asks it in a room with them.

## 6. Measurement plan

Every probe: one driver, serial, Muse (`muse-glimmer:30b`) in the chair it measures, thinking as the
game ships (off), no other model loaded, requests rebuilt from `buildOpenWorld` +
`computePerceivedObjects` at the arm under test, never a recorded request (§68.8). Each gets its own
`checkpoints/<date>-<name>/PREDICTION.md` committed before the first call, with the numbers below
copied in; results committed unedited. A person's transcript is never pooled with any of these.

**P1 — R5, the first act.** 3 compounds + 12 controls, N=3 each. Predictions in R5. Stop: if the
truncated ruling is inapplicable on ≥ 2 of 3 compounds, the citation is not reliably the second act's
span and the rule needs a different cut, not a different threshold.

**P2 — R2, reach.** Warden contexts: this game's round 5 under R1's true line (suspicion 10), round 9
(suspicion 90, window shut, bar 40), round 10 (suspicion 95, window open). List on, block and restore
conditions present. N=10 each. Predictions: round 5 `block` ≥ 4/10 (restore ≥ 1/10, reported); round 10
window examination ≥ 6/10, block ≤ 3/10. Kill: round 5 block 0/10.

**P3 — R3, the person.** As in R3. Clause off then on. Kill as stated.

**P4 — R4 × R1, the 2×2.** Round 10's warden context rebuilt four ways: {rule sentences, list} ×
{false line "opens the window" in rounds 4–7's news history, true line "works to open the window"}.
N=10 per cell. Predictions: list cells examine the window ≥ 8/10 each; sentence cells ≤ 2/10 each; the
line changes examination by ≤ 2/10 within a shape; the false line puts "opened" in `notes` ≥ 8/10, the
true line ≤ 2/10. Kill (model choice): list cells < 5/10. Note the round-10 context carries the window's
own "stands open" line in both arms, so the false line's remaining effect is on notes and plan, not on
what is in view.

**P5 — the batch, N=6 per arm, ten rounds, all-Muse, serial.** Arm A: every default in §5 landed. Arm
B: identical with `block` off (the R2 kill's control). Predictions, pre-committed:
- Arm A: prisoner escapes **2–4 of 6**, catches **2–4 of 6**, timeouts ≤ 2. **Kill either way:** 0
  escapes (unwinnable, back to §2) or 6 escapes (the warden's tools are inert).
- Arm A: the warden rules `block` in ≥ 4 of 6 games and `restore` in ≥ 2 of 6; ≥ 4 of 6 games have a
  warden examination of an open way out on the turn after it opens (R4 in play).
- Arm A vs B: escapes in B exceed A by ≥ 1; if B ≤ A, `block` changed nothing and is reported as such.
- Model prisoner intents ruled against `warden`: 0–1 of 6 games (reported, no weight).
- The prisoner's first act in an absence round is on a way out in ≥ 3 of 6 games (she reads the rhythm).
- Scoreboard convention: so-far, projected at N=6, dead/open, every check-in; a dead number is announced
  at the poll it dies.

**P6 — R7 texture and the window line, replay.** The D11 rows named in R7 plus §33.7's nine climb-outs
and this game's round 10, against the new desc:bar and desc:window. Prediction: 0 of those rows changes
its `target`/`effect`; ≤ 2 change `property`. Kill: ≥ 3 change target or effect, and the bands are
reworded before landing.

**P7 — the request order (optional, last).** 20 identical rulings each way; predict ≥ 20 % off `ms`;
kill < 10 %. Rulings must be identical in both orders on all 20 or the arm is a batch boundary and is
held.

## 7. Decisions for the owner

Each is one question; the recommendation is first; the last line says what each answer decides.

**D1. R1: attempt-only sentences, and relay a refused attempt too?** Recommended: yes to both. *Yes*
lands R1 as designed; *no to relaying refusals* keeps a refused visible act invisible to the other
side, which the design thinks is the same defect.

**D2. Make presence `modelled` the default?** Recommended: yes. *Yes* removes R3's structural cause and
aligns the default with the batches; *no* keeps every default run in a room where a person cannot be
acted on, and R3 becomes "always set the flag".

**D3. Give the warden the condition list by default (`both`)?** Recommended: yes. *Yes* is R4, and it
is why D4–D6 exist; *no* keeps the warden's handicap and this game repeats.

**D4. Add `block`, and state `block` and `restore` as the warden's conditions?** Recommended: yes.
*Yes* is R2; *no* leaves a warden who can only look and a prisoner who, under D3, cannot win.

**D5. A presence rhythm, the warden out of the cell one round in four, stated to both?** Recommended:
yes, one round (not two: §2 shows two rounds hand her open-and-leave uncontested). *Yes* gives the
prisoner a window a reading warden cannot close; *no* means her only line is silent digging, a phrasing
lottery. The cadence number is yours; the design's arithmetic used rounds 4, 8, 12.

**D6. The door at `margin` (lock ≤ 60) by default?** Recommended: yes, because D5 makes a free door a
guaranteed two-turn escape. *Yes* is §50.5's arm as the default; *no* keeps `free`, and then D5 must be
dropped or the warden must be able to lock the door behind him, which is a further mechanism.

**D7. R5: the first named act is attempted and told, rather than the turn refused?** Recommended: the
first act. *First act* is P1's design; *refuse* is your §74 decision 1, which the one-in-four false
positive would turn into a lost turn on a single act.

**D8. R6 lands as a plain fix with a dated boundary, not an arm?** Recommended: fix. *Fix* changes the
prisoner's belief line from now on; *arm* keeps a knowingly false line as the comparison baseline.

**D9. The bar's three bands and the window's new open line, as worded in R7?** Recommended: yes, with
your wording if you prefer it; the numbers (70/55/40) are what matter. *Yes* is a scenario change gated
on P6; *no* leaves the grind as it is.

**D10. Which of the seat-only R7 changes: stakes once, beliefs by item, booleans as words, the outcome
shown at once?** Recommended: all four. Each is view-only and lands without a probe; leave out any you
did not miss.

Not asked, decided here as routine: the `sight` property's numbers copy posture's; the person clause is
an arm behind P3; the request-order probe is last and optional.

## 8. Landing order

N commits, each saying what it depends on. Engine-side first, in its own repository.

1. **run-dmcp, docs only:** two lessons in `docs/AUTHORING-GUIDE.md`, neutral vocabulary, guarded by
   `engineVocabulary.test.ts`: *what one principal perceives of another's act describes the attempt;
   the outcome reaches it through the object's own state* (R1), and *a property a mind works on over
   several turns should read differently as it moves* (R7). Then the four `CLAUDE.md` pointers, one
   commit each. Nothing in run-dmcp code: every candidate failed the admission test (§3, each bucket
   row).
2. **the-prisoner, fixes with tests, no batch impact:** R7's seat-only changes (D10); R5's first act
   after P1.
3. **the-prisoner, one dated boundary for text:** R6 (D8) and R1 (D1) in one commit, ledger texts
   rewritten, pins changed on purpose.
4. **the-prisoner, scenario content, after P6:** the bar's bands and the window's line (D9), one commit,
   recorded like §27/§76.
5. **the-prisoner, mechanics with tests, no defaults changed yet:** `block` and its release rules;
   `sight` and its reads and gates; the presence rhythm as an audited resolution between rounds;
   `OPEN_LEAVE` reading `blocked_by`. Each its own commit; each arm off.
6. **the-prisoner, the contest boundary, one commit:** the defaults of D2, D3, D4, D5, D6 together, so
   there is one boundary and one `Conditions:`/`Presence:`/`Door price:` header change, after P2, P3
   and P4 have landed their arms.
7. **P5, the batch,** from a pinned commit, serial, with its `PREDICTION.md` committed first.
8. **The owner's next human game,** `PRISONER_VIEW=play`, defaults only, which is the requirement
   behind all seven. If it is still not a game you would want to play, this document was wrong about
   which of the seven mattered, and that is the finding to write down.
