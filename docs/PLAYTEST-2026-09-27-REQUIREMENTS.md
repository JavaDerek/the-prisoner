# Playtest 2026-09-27: seven requirements, for a design and then a red team

**Status:** requirements only. Nothing here is designed, decided or built.
**Written:** 2026-09-27, from the owner's human game that afternoon.
**For:** a designing model (pass 1) and then a red-teaming model (pass 2). The owner decides
between the passes and after them. Nobody builds anything until the owner has answered.

## 0. How to use this document

**Pass 1, the design.** Write `docs/PLAYTEST-2026-09-27-DESIGN.md`. For each requirement R1–R7 below:

- **Confirm or refute the diagnosis from the code** before you design against it. Two of the
  diagnoses in the chat that produced this document were wrong on first reading, and §2 records
  both. Assume a third is waiting to be found.
- Say what you would change, in which file, and in which **jurisdiction** (§3). Use one bucket per
  requirement and name it in its row, not only in prose.
- Give the **measurement** that would show the change worked, as a pre-committed prediction with a
  kill condition, the way `checkpoints/*/PREDICTION.md` files already do. **For anything a model mind
  is meant to use, include a measure of whether the model reaches for it at all.** Three mechanisms
  in a row were built, reached for by the owner within four rounds, and never touched by the models
  (OPEN-VARIANT.md §57.3). The same failure appears again in this game at R2.
- End with a numbered list of **decisions for the owner** (D1, D2, …). Put one question in each,
  with your recommendation first and a line on what each answer would decide. Do not ask the owner
  to diagnose anything. Ask what they saw or want.
- Give a **landing order**. Engine-side changes land first and in their own repository (root
  CLAUDE.md rule 3).

**Pass 2, the red team.** Write `docs/PLAYTEST-2026-09-27-RED-TEAM.md` against the design, not
against this document. Its brief is in §6.

**Neither pass edits code, runs a model, or touches doris.** Reading code, tests, transcripts and
docs is the whole job.

## 1. The evidence

- **The game:** `checkpoints/2026-09-27T20-14-57-505Z.md`, plus its `.referee.json` and
  `.rows.jsonl`. The owner played the prisoner; the model played the warden. Muse
  (`muse-glimmer:30b`) was in all three chairs on doris. It used `PRISONER_VIEW=play` with every
  other setting at its default, including `PRISONER_PRESENCE` **off**. The prisoner escaped at
  round 10.
- **What the owner saw** is the prisoner half of that transcript (the "Briefing given, verbatim"
  blocks). **What the owner could not see** is the warden half. Two of the seven findings are
  only visible there. Read both halves.
- **The owner's verdict:** "this game sucks." Treat that as the requirement behind all seven. The
  test is not whether each fix is correct in isolation. It is whether the next human game is one
  the owner would want to play.
- The `.rows.jsonl` rows carry `label: null` on purpose. They are waiting for the owner to label
  them for run-dmcp#43. **Do not label them.**

## 2. Two corrections to the first reading

Both were claimed in chat and are wrong. They are recorded here so neither pass inherits them.

1. **"The warden's catch on the bar can never fire" is true, but it is not a bug.** The window opens
   with the bar at 50 or below (`OPEN_WINDOW_BAR_MAX`, `src/open/world.ts:124`). The warden catches
   on the bar only at 30 or below (`OPEN_CATCH_BAR_MAX`, `:131`). The bar wears 100, 85, 70, 55, 40,
   so the prisoner never has to pass through the catch band. That margin is the owner's own
   decision (§33.5), and `OPEN_DOOR_LOCK_MARGIN`'s header explains why it matters. **The warden
   still had a catch available.** Condition 4 (`src/open/conditions.ts:60`) catches on examining a
   way out and finding it standing open. In round 10 the window stood open and the warden examined
   the bar instead. That is R4, a reasoning failure, not a rules hole.
2. **"Brink has the same attempt-as-outcome bug" is unverified and probably false.** Brink's rival
   leaders read `buildBriefing(gameId, { seatId })` (`brink-workshop/src/session/briefing.ts`),
   which is built live from the database, not from a description of what anyone attempted. See R1's
   Brink note.

## 3. Jurisdiction buckets

Use the owner's four-way split: **this game** (the-prisoner) / **run-dmcp** (generic engine
mechanism, subject to its own admission test: generic, with at least one real caller) /
**authoring guidance** (`run-dmcp/docs/AUTHORING-GUIDE.md` and its four pointers) / **model
choice**. the-prisoner is a harness for NPC-intelligence infrastructure. **Fix bad reasoning
generically, never with a prisoner-only prompt hint.** A fix that would not also help Brink's rival
leaders needs an argument for why it belongs here at all.

## 4. The requirements

### R1. The other side is told the attempt as if it were the outcome

**Observed.** On all four of the prisoner's failed digging turns (rounds 4–7), the warden's
briefing said **"Mara Voss opens the window."** The window stayed shut every time. The warden's
own reasoning caught the contradiction (transcript line 501: "Voss just opened the window, which
is odd because the bar is still at integrity 100"). It then wrote the false fact into its notes and
spoke it aloud in round 8: "You opened the window." That is the line the owner saw.

**Where.** `src/open/loop.ts` around lines 400–450, the per-effect "other perceives" sentence.
Several cases already follow the right principle and say so in their comments: `leave` renders
"makes for", `take` renders "reaches for", "because what a bystander sees is the reach." **`open`
and `close` do not.** They render the accomplished verb ("opens", "shuts") whatever the outcome.
Check every case (`wear`, `restore`, `conceal`, `expose`, `derive`, `give`) against the same
principle.

**Requirement.** Nothing a principal perceives of the other principal's act may state an outcome
that did not happen. Say which of two rules the design adopts, and argue for it:
- **(a)** every sentence describes the attempt; or
- **(b)** the sentence describes the outcome, rendered from the resolved result.

Either way, a test must pin it for every effect kind, for both a success and a refusal.

**Measure.** Re-render this game's warden briefings under the fix and count false outcome
statements (4 today). Also give the design's answer to this: does the warden's behaviour change
when it is not being lied to?

**Bucket:** this game.

**Brink.** Probably already safe (§2). Verify it: find every channel through which a Brink rival or
the game-master learns what the player did, and confirm each one reads a resolve outcome, not an
intent. The lesson is Brink's own hard rule 2, "resolve, then narrate", applied to what AI
characters are told as well as to what the player is told.

### R2. The opponent's only winning move is to look

**Observed.** Over ten rounds the warden examined something in every turn but one. The prisoner dug
at the bar in plain sight for five turns, and the warden answered with lines ("Don't touch that
bar, Voss") that had no consequence. **The one time it tried something physical** (round 4: "Grip
the key ring tightly against my belt and step back a pace so Voss cannot reach it"), **the referee
ruled it impossible**. In round 10, with the window open and suspicion at 95, its candidates
included "Move to stand between Voss and the window to block access." It chose to examine the bar.

**Where.** The warden's win conditions (`src/open/conditions.ts:37–60`) all require an
examination. No effect kind expresses interposing, restraining or blocking. Also read
`docs/CUSTODY-DESIGN.md`: "a holder on her feet keeps it" is the one physical capability the
warden has, and it is passive. Explain why round 4's act was ruled impossible, from the
`.referee.json`.

**Requirement.** The warden must have at least one way to **prevent** an escape, not only detect
one, that a model in the warden's chair will actually use. The game must still be winnable by the
prisoner. State what the prisoner can do about the new warden act, or the fix has only moved the
problem to the other chair.

**Measure.** Both halves: whether the mechanism works when the warden uses it, and **how often a
model warden reaches for it** unprompted. Predict both numbers before any run. A result of zero on
the second means the mechanism failed, not the model.

**Bucket:** this game for the scenario and its conditions. Say whether any new effect kind needs
run-dmcp. If it does, it goes through run-dmcp's admission test on its own merits.

**Brink.** The most directly applicable of the seven. A rival leader whose only rewarded move is to
observe gives commentary, not opposition. Name what in Brink's rival design (`src/rivals/`,
`src/gm/local/rivalMind.ts`) corresponds, and whether the same mind-seam context would carry the
fix.

### R3. A person cannot be the target of an act, so the player's intent is silently rewritten

**Observed.** "throw the blanket over croft, so he can't see" was ruled `conceal` on the
**blanket**. The blanket's concealment went from 0 to 50 and it "lies humped, as if something is
under it". The warden was untouched. The next turn, "take the warden's keys while he's stuck under
the blanket" failed because the warden was on her feet. This was the most inventive move of the
game, and the game could not express it. It also did not refuse it. It turned it into a different
act.

**Where.** `src/open/referee.ts:470`: `targetKeys` is the perceived objects plus `none`. Persons
enter that list only under `PRISONER_PRESENCE=modelled` (OPEN-VARIANT.md §55–§56), which was off,
the default. With presence on, §56 records that models never targeted a person in four games,
while the owner did in their first human game under it. HUMAN-INTENTS-DESIGN.md D9 (hiding a
person) and the one-act prompt's own "blinding someone" example are related prior work.

**Requirement.**
- A human's intent aimed at a person present in the room must be ruled against that person, or
  refused, and **never quietly moved onto an object** named in the same sentence.
- Say whether presence should become the default, and what that costs: it is a batch boundary.
- Separately, specify the act the owner actually attempted: impairing someone's perception with an
  object. Is that an effect, a property on a person, or out of scope?

**Measure.** Replay this game's round 2 and the §56 human game's person-aimed intents through the
changed referee request. Report how many land on the person, on an object, or on `none`. Say how
the design would detect a silent rewrite in future transcripts; today nothing flags it.

**Bucket:** this game (the presence default, the scenario). Possibly run-dmcp, if a person-as-target
is a gap in the resolve protocol rather than in this game. The design must say which.

**Brink.** High. Nearly every Brink action is aimed at a person, but through the game-master's
classification, not this referee. The transferable lesson is about Brink's turn reader: when an
intent does not fit the closed key set, the answer must be a visible refusal or `none`, never the
nearest key. Check whether Brink's turn reader can snap to the nearest key.

### R4. The warden cannot see, or does not use, its own win conditions

**Observed.**
- In round 10 the window stood open and suspicion was 95. Condition 4 would have caught the
  prisoner on a close look at the window. The warden examined the bar, for the third turn running.
- Its plans also inverted its own incentive: "Keep suspicion below 40" (line 509). Suspicion is the
  warden's grounds to search, so it wants it **high**.

**Where.** The warden's wits prompt and condition list (`src/open/conditionList.ts`,
`conditions.ts`). The warden also inherited R1's false "opens the window" four times, which may
have taught it that "window opened" was noise. Separate the two causes before designing against
either.

**Requirement.** A model in the warden's chair, handed the state of round 10, must choose an
available catch when one exists. Its written plan must not contradict the direction of its own
incentives. Fix this generically, not with a prisoner-only hint (§3).

**Measure.** A probe on round 10's recorded warden context, rebuilt through `buildOpenWorld`, never
from the recorded request (see the measurement-fidelity rule in OPEN-VARIANT.md). Report how often
it examines the window, repeated serially with one driver at a time. Do the same for R1-corrected
briefings, to separate R1's effect from R4's.

**Bucket:** this game (the prompt's rendering of conditions). Also **model choice**, if the design
concludes a 30B cannot read a seven-condition list. Say which.

**Brink.** High, as a lesson. A rival leader has goals stated to it too. A mind that misreads which
direction its own number should go plays the wrong game politely.

### R5. A two-act intent attempts the later act

**Observed.** "Pull the bar out of the window and leave" was flagged `several`. The effect ruled was
**`leave`**, the second act, which could not succeed, so the turn was wasted. The next turn, "pull
the bar out of the window" alone worked.

**Where.** The one-act check (OPEN-VARIANT.md §74.1; `src/open/referee.ts` around line 182). It
flags `several` and never refuses. Which act is attempted is left to the target and effect
questions, which answered independently.

**Requirement.** When an intent attempts several acts, which one is attempted must be **defined**
(first named? first possible?), not left to the referee's independent answers. The player must be
told which act was tried, in words that name it.

**Measure.** The D11 corpus (`checkpoints/2026-09-26-human-intents/`) plus this game's round 8.
Report how often the attempted act is the one the rule says.

**Bucket:** this game, unless the design argues the one-act ruling belongs to run-dmcp's resolve
protocol.

**Brink.** Medium. It applies when a player types a compound order ("sanction them and call the
UN"). Check how Brink's turn reader handles one today.

### R6. A player's own results do not update what they are told they know

**Observed.** Every turn from round 5 to 10, the owner's screen said "Your last word on the bar
integrity was 100, as of round 0". The same screen's news said the bar had gone to 85, 70, 55, then
40. The two lines on one screen contradict each other.

**Where.** `updateActorBelief` (`src/open/loop.ts:~495`) writes a belief only for the
**ruling's own resource**. These turns were ruled `open window.passage`, and the bar's integrity
changed as a side effect of the window's gate. That transition is in `outcome.transitions` but is
not read. The warden, examining the bar directly, kept an accurate belief.

**Requirement.** Every resource the actor's own outcome changed, and that the actor was told about
in the same turn, must update that actor's belief. Say whether a reported side effect counts as
"told". It is also the mind's context, so this changes what a model prisoner reads: a batch
boundary.

**Measure.** A unit test from this game's round 4 outcome. Count contradictory briefings across the
last batch's transcripts before and after.

**Bucket:** this game.

**Brink.** Low as a bug, since Brink's player never sees raw values (Brink hard rule 1). It is
medium as a lesson: a rival leader's memory of the consequences of its own acts must include side
effects.

### R7. The turn itself is not fun

These are several small findings. Group them as the design sees fit. Each is **this game** unless
argued otherwise.

- **Grind.** Four identical turns, word for word ("use the spoon to dig the bar out of the window"),
  each answered with the same sentence and a flat −15. The owner decided on 2026-09-26: a magnitude
  ladder, no dice. So variety cannot come from randomness. Where can texture come from without it?
- **Boilerplate.** "At the end of round 30 you are transferred…" is repeated every turn, and the
  six-line "Your last word on…" block is repeated every turn under `play`, the view designed
  (2026-09-25) to put what just happened first.
- **A raw number on the player's screen:** "Your last word on the window passage was 1". Say what
  the `play` view should render a boolean-like property as.
- **"It stands open now: the bar is out of its widest gap."** The derived description reads oddly.
- **Waiting.** Each warden half-round took about 50 seconds (transcript "Half-round timings"). The
  player waits roughly a minute between typing and seeing the result, on top of the referee. Say
  what the owner can be shown while waiting, or what can run earlier.

**Brink.** Low. Brink's game-master (Claude) writes the narration and handles texture. The waiting
point is the exception: Brink's turn reader already starts early for exactly this reason (Brink
CLAUDE.md hard rule 5).

## 5. Applicability to Brink, ranked

This replaces the ranking given in chat, which put R1 first before §2's correction.

| rank | req | why |
|---|---|---|
| 1 | R2 | Rival leaders are the product. An opponent who only watches is not one. |
| 2 | R4 | A mind that misreads its own goals plays the wrong game politely. |
| 3 | R3 | Brink's actions are aimed at people. A closed classifier must refuse, not snap to the nearest key. |
| 4 | R1 | Brink's rule 2 already covers it. Probably structurally safe (§2), but verify. |
| 5 | R5 | Only for compound orders. |
| 6 | R6 | Pillar 0 hides values. The side-effect memory lesson still stands. |
| 7 | R7 | The Prisoner's own presentation, apart from waiting. |

The design pass should confirm or reorder this from Brink's code. Do not accept it from this
document.

## 6. The red team's brief

Attack the design, not this document. At minimum:

1. **Did the design check the diagnoses?** For each requirement, find the claim it took on trust and
   test it against the code or the transcript. §2 shows two claims in this document were already
   wrong.
2. **Does any fix break the prisoner's game?** In particular: does R2's warden act, combined with
   R4's better warden, leave any route that a model prisoner or a human can still win? Show the
   turn arithmetic, the way `world.ts`'s `OPEN_DOOR_LOCK_MARGIN` header does.
3. **Will the model actually use it?** For every new affordance: what in the design makes a model
   reach for it, given §57.3's record? What is the measured bar, and is the kill condition real?
4. **Is anything a prisoner-only prompt hint in disguise?** Flag any fix that would not survive being
   moved to Brink's rival leaders unchanged.
5. **Batch boundaries.** List every default the design changes. Say which past batches each one
   separates from future ones, and whether any committed PREDICTION.md is invalidated.
6. **Jurisdiction.** Anything proposed for run-dmcp must pass its admission test as a generic
   mechanism with a real caller. Anything that names this game's vocabulary in the engine fails
   `engineVocabulary.test.ts`. Check both.
7. **The owner's decisions.** Is each one question, answerable without homework, with a stated
   recommendation? Rewrite any that are not.

Rank findings most-severe first. Mark each as **confirmed** (you checked it against code or data)
or **plausible** (reasoned, not checked).

## 7. Constraints both passes inherit

- Read the-prisoner's `CLAUDE.md` and the root `~/rpg/CLAUDE.md` first. Each repository's own
  CLAUDE.md governs inside it.
- Tests come first in every change the design proposes.
- **Local play is Muse in all three chairs**, and that is the code default since 2026-09-27
  (`DEFAULT_MIND_MODEL`, `src/modelRoles.ts`). doris's one 4090 is shared with another production
  tenant. Any measurement the design proposes runs one driver at a time, and loads no other model.
- A transcript with a person in it is never pooled with a model batch.
- Do not edit `.rows.jsonl` labels, committed results or committed predictions.
