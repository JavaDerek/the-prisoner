# The Prisoner, open variant — design

*Status (2026-09-14): design approved, §8 decided, §4.1 descriptions approved by the owner. O1 is
**playable** (`PRISONER_VARIANT=open npm run checkpoint`) and has run its first two real games; §10
evaluates them against §5.3. **§5.3 does not hold yet** (§10.2).*

The closed variant proved that two local models can outwit each other **inside a fully specified
game**: ten enumerated moves, every effect and threshold stated in the prompt. That is a board game,
and a deterministic planner would beat any language model at it. The open variant is the game the
owner actually wants to support, for The Prisoner and beyond it: **a character can attempt something
nobody wrote down, and the world answers honestly.**

This document fixes three things before anything is built, in this order: what the open variant must
**never** do, how the **referee** is constrained, and what **a good open game** means, so the
criteria do not quietly shape the game the way they did in the closed variant.

---

## 1. One variable changes

Everything the closed variant built stays: the cell, Voss and Croft, their identities, motives and
stakes, the clock, the belief store, private thoughts and persisted notes, warden presence, the
voice/wits model roles, the engine and the seam. **Only the action layer changes**:

| | Closed | Open |
|---|---|---|
| What a mind proposes | `plan[0]` from an enum of moves | a free-text **intent**, plus `thoughts` / `notes` / `line` as today |
| What the world is made of | ten hand-written mechanics | **objects with authored physical descriptions**, and a small vocabulary of generic **effects** |
| Who decides what an intent does | the mechanic, by construction | a **referee**, constrained by §3, whose every ruling is recorded with citations |
| What stays checkable | everything | the invariants in §2, plus the engine's refusals |

If the two variants disagree about a result, the action layer is the only explanation. That is the
point of running both.

---

## 2. What the open variant must never do

These are invariants, each enforced by a test that is planted with a violation and watched go red
before it is trusted. None of them is a guideline.

1. **No write outside the resolve protocol.** Every state change is an engine resolution. The
   referee proposes; the engine disposes. A referee cannot write, the same way a mind cannot.
2. **A mind never learns what it could not perceive.** The fog guarantees from the closed variant
   hold for every new field: a principal's context is assembled from its own view, beliefs and
   perceptions, never filtered after the fact. **Referee reasoning never reaches a principal.** What
   an actor learns from a ruling is rendered from the effects it can perceive, by code, in positive
   nouns, never from referee prose.
3. **No ruling without grounds in text.** Every effect the referee rules must cite a verbatim span of
   the actor's own intent *and* a verbatim span of an authored description of the object it acts on
   (§3.3). A ruling that cannot cite both is not a ruling; the intent does nothing.
4. **No mind control.** Nothing a principal does can choose the other principal's action, set its
   beliefs, or write its notes. Speech is delivered; persuasion works only if the other mind, on its
   own turn, is persuaded.
5. **No invented world.** The referee cannot create objects, properties or rules that are not in the
   scenario (until §7's later phase, and then only by generic, cited derivation).
6. **No pattern-matching meaning.** Code never decides anything by reading prose. The referee is a
   model, answering in closed keys with citations; citations are checked by literal substring
   presence, exactly as run-dmcp's turn reader already does.
7. **Say what is, never what is absent.** Unchanged from the closed variant, and it now applies to
   ruling outcomes: "nothing happens" is rendered as the positive state that made it so.

---

## 3. The referee

### 3.1 What it is

A model call, separate from both minds, made once per intent. It sees the **true** state (it must, to
rule) and exactly one actor's intent. It does not see either mind's thoughts or notes, the other
principal's intent, or any earlier ruling's reasoning beyond the precedent record in §3.5. It is
**not** a `Mind`: it has no principal and no fog, and it does not belong in mind-seam.

It is built on run-dmcp's **turn reader** (`createTurnReader`), which already owns the hard parts:
a closed set of answer keys per question, a verbatim-citation rule, coercion, a caller-declared safe
default, and a fallback ladder. The referee asks the reader a short, fixed sequence of questions about
the intent, and the answers are keys, never prose.

### 3.2 What it rules, as closed keys

For one intent, the referee answers:

1. **Target object:** one of the object ids the actor can currently reach or perceive (caller-computed
   from the actor's own view), or `none`. Citation: the intent span naming it.
2. **Effect kind:** one of a small generic vocabulary (§4). Citation: the intent span describing the
   action.
3. **Grounding:** the verbatim span of the target object's authored description that makes this
   effect physically possible (e.g. `"iron frame"` for grinding an edge), or `none`, which rules the
   intent impossible. Citation: that description.
4. **Magnitude:** `slight` / `moderate` / `substantial`, mapped to numbers by the scenario, never by
   the referee, and capped by the engine's declared bounds.
5. **Perceptibility:** `silent` / `audible` / `visible`, with the warden-presence rule from the closed
   variant still deciding whether the other principal is there to perceive it.

An intent may resolve to more than one effect (up to a small cap), each answered and cited
separately. **Safe default for every question: the intent does nothing.** A referee that is
unreachable, uncertain, or unable to cite is a prisoner whose attempt fails, never an attempt that
succeeds.

### 3.3 Why two citations

A single citation (the actor's words) makes the referee the real player: a persuasive intent would
succeed on eloquence. The second citation, from the **world's authored text**, is the guard: the
blanket can be torn because its description says it is `"frayed at the hem"`, not because the
prisoner described tearing it well. Objects are therefore written as **physical descriptions, never
affordance lists**. "A wool blanket, frayed at the hem" leaves room for ideas; "can be torn into
strips" is a move list wearing a costume, and would quietly rebuild the closed variant.

### 3.4 What the referee cannot do

- Choose or suggest actions. It sees one intent and rules on it.
- Reveal hidden state to the actor. An effect of kind `reveal` is the only way an actor learns
  something, and it is rendered by code from the revealed values.
- Rule on the other principal's mind (§2.4).
- Exceed engine constraints: bounded, `resolve_only`, irreversible and conserved values still refuse,
  with the one hop, exactly as today.

### 3.5 Consistency: precedent

The same intent in the same state should get the same ruling. The referee runs at temperature 0, and
each question is shown the **precedent record** for the same `(object, effect kind)`: earlier rulings'
keys and citations, never their reasoning. Only rulings that **applied** enter it (owner's decision,
2026-09-14, after §11.2): a failed ruling shown as an example gets copied. Consistency is measured, not assumed (§5.2).

---

## 4. The world: objects and generic effects

### 4.1 Objects

The scenario authors a small set of objects, each with an id, a holder or location, perceptibility,
and a **physical description**. A starting set for the cell: the bar, the lock, the spoon, the loose
tile, an iron-framed cot with a wool blanket frayed at the hem, a tin bucket, the meal tray the warden
brings each round, and the warden's key ring (on the warden's belt). Descriptions are content, in the
scenario file, and never in engine or seam code.

**Descriptions for O1 — approved by the owner, 2026-09-14.** Each says what
a thing *is*: material, size, wear, how it is fixed. None says what it is *for*. Every phrase here is
something a referee may quote, so a phrase that implies a use is a use the referee can grant.

| Object | Held by | Description |
|---|---|---|
| bar | the window | One of five vertical iron bars in the cell's small window, about as thick as a thumb. Rust has pitted it near the bottom, where it is set into old mortar that is dry and cracked. |
| lock | the cell door | A steel lock set in the cell door, its keyhole on the corridor side. The door hangs a finger's width short of its frame, and the edge of the bolt shows in the gap. |
| spoon | Voss | A dented aluminium spoon, thin enough to bend by hand. One side of the bowl is worn flat from being scraped along the floor. |
| loose tile | the floor | A square clay floor tile beside the cot, cracked across one corner. It rocks underfoot, and beneath it is a shallow hollow of dry grit about the size of a hand. |
| cot | the wall | A narrow cot whose iron frame is bolted to the wall at the head and stands on two legs at the foot. The crossbar is rough with flaking paint, and the springs are held to the frame by twists of wire. |
| blanket | the cot | A heavy grey wool blanket, thick and coarse, frayed along the hem, with a loose thread running down one edge. |
| bucket | the floor | A tin slop bucket with a wire handle and a dented rim. It rings sharply when anything strikes it. |
| meal tray | passes through the door slot each round | A shallow steel tray pushed through a slot at the bottom of the door, holding a tin cup and a bowl, and collected at the next round. |
| key ring | Croft's belt | A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks. |

Review notes for the owner: the cot's wire, the blanket's thread and the door's gap each open ideas
nobody has written a move for. That is the intent, but each is also a line you may want to cut.

### 4.2 Effects (generic, and the only way the world changes)

| Effect | What it does | Engine need |
|---|---|---|
| `wear` | lower a bounded numeric property of the target | today |
| `restore` | raise or reset a bounded numeric property | today |
| `reveal` | the actor learns the true value of a property it can inspect | today (belief store) |
| `conceal` / `expose` | change the target's perceptibility | today (numeric flag) |
| `noise` | create a perceptible event with no state change (a distraction) | today |
| `move` | change an object's holder or location | **run-dmcp non-numeric changes** (withdrawn #32) |
| `derive` | create a new object from cited parents | later phase, engine entity creation through resolve |

Numbers stay in the scenario: which properties exist, their bounds, what each magnitude key means per
property. Escape and search remain **conditions on state**, not moves: the prisoner is out when the
cell's authored exit conditions hold, however it got there.

---

## 5. What "a good open game" means, decided now

### 5.1 Must hold in every game (pass/fail)

- Every invariant in §2, by test, and a fog audit of the transcript: no string leaf of a principal's
  context contains another principal's private text.
- Every applied effect has both citations, and each citation is a verbatim substring of its source.
- No silence or referee failure turns into a success.

### 5.2 What we measure (reported, not gated)

- **Novelty:** the share of attempts whose `(object, effect)` pair has no closed-variant move
  equivalent. An open game where every attempt is "file the bar" has proven the models don't invent,
  and that is a finding, not a bug.
- **Grounded rate:** the share of attempts ruled possible vs impossible, and a human spot-check of a
  sample against a written plausibility rubric.
- **Referee consistency:** replay a recorded state and intent N times; report agreement on each key.
- **Contest:** win rate by side, refusals followed by a changed approach, as in the closed variant.
- **Voice:** character consistency and descriptiveness, by rubric.

### 5.3 "The open variant is working" means

Across a fixed batch of games on one model configuration:

1. zero §2 violations;
2. at least one attempt, in at least two different games, that the closed move list could not
   express, ruled **possible** with valid citations, and at least one ruled **impossible**, with the
   positive reason rendered to the actor;
3. referee key agreement of at least 80% on replayed rulings;
4. both endings still reachable.

The attack move (issue #1) waits until these hold.

---

## 6. What this pushes on the libraries

- **run-dmcp:** the open variant is a real caller for **non-numeric changes inside a resolution**
  (`move`), the engine change withdrawn as #32 and also wanted by brink's Phase 4. The re-file happens
  when the open variant's `move` test is the next failing test, not before. The turn reader gets its
  first adversarial, per-turn caller. Entity creation through resolve (`derive`) is a later, separate
  question.
- **mind-seam:** no change expected. Minds still propose inert data. The referee is a different
  seam, and belongs in this repository until a second caller (plausibly brink's game-master
  classification) makes a shared shape concrete.

---

## 7. Phases

- **O1, grounding first:** intents, the referee over the turn reader, and `wear` / `restore` /
  `reveal` / `conceal` / `expose` / `noise` on authored objects, with the §2 invariant tests and the
  §5 measurements. No engine change.
- **O2, custody:** `move` (confiscating the spoon, lifting keys, hiding things in the tray), after
  run-dmcp lands non-numeric changes.
- **O3, derivation:** `derive` (strips from a blanket, a tool from parts), after a cited, generic
  creation path exists.
- **Then** issue #1, the attack move.

## 8. Decisions (made by the owner, 2026-09-14)

1. **Referee model: a separate model, `qwen2.5:14b`, by default** (configurable). Independence from
   the wits model means the referee is not ruling on ideas its own weights produced; it does not
   think aloud, so a ruling is fast. The cost is a third model per half-round, handled by the
   existing one-model-at-a-time swapper.
2. **Starting objects: the full list in §4.1.**
3. **Descriptions: Claude drafts, the owner reviews** before any real game runs (drafts in §4.1). A
   model drafting descriptions at scenario-build time is deferred until the hand-written version is
   proven, because it would put a model upstream of the grounding guard.

## 9. Revision notes (O1 implementation, 2026-09-14)

**9.1 The property and magnitude table.** §4.1's objects need bounded numeric properties before any
generic effect can act on them, and this was not authored above. `src/open/scenarioObjects.ts` adds,
per object: which properties it has (a closed set across the whole scenario: `integrity`, `edge`,
`concealment`), each one's `min`/`max`/starting value, and a `slight`/`moderate`/`substantial` table
for both `wear` and `restore`. The closed variant's own numbers are carried over as the `moderate`
(and, where the closed variant already had a "set to max" move, `substantial`) entries, cited inline
against the constant they come from: bar integrity wear moderate=15/substantial=25 (`FILE_AMOUNT`/
`FILE_AMOUNT_SHARP`), restore substantial=100 (`REPLACE_BAR`); lock integrity wear moderate=20
(`SHIM_AMOUNT`), restore substantial=100 (`SERVICE_LOCK`); spoon edge restore moderate=10
(`HONE_AMOUNT`). `slight` and every number with no closed-variant original (the cot's wire, the
blanket's thread, the spoon's own `concealment` scale, and every `wear` direction the closed variant
never modelled, since it only ever raised or reset) are new content, authored in the same proportion
as their nearest carried-over sibling, never invented in isolation. `concealment` is a NEW bounded
0-100 property replacing the closed variant's binary `concealed` flag (0/1 survive as this property's
own `min`/`max`), so `conceal`/`expose` can be ruled at a magnitude like every other effect, per §4.2's
own "today (numeric flag)" framing. `bucket`, `meal_tray`, `key_ring` and `loose_tile` carry NO
numeric property in O1 -- `bucket` exists only for `noise`; `meal_tray`/`key_ring` are custody-shaped
(`move`, out of scope); `loose_tile`'s own hiding function is carried by the spoon's `concealment`,
mirroring the closed variant's own choice (`world/vocabulary.ts`'s header).

`guard_attention` and `warden_suspicion` are **not** objects in §4.1's table and so are never
referee-targetable properties -- they are carried over as fixed side-effect magnitudes instead (see
9.3), using the closed variant's own constants (`HONE_SUSPICION_BUMP`=5, `FILE_SUSPICION_BUMP`=10,
`FAILED_ESCAPE_SUSPICION_BUMP`=30, `EVIDENCE_SUSPICION_DIVISOR`=2), never a property in the scenario
table. This is the one place §1's "Carry over the closed variant's numbers... (bar integrity, lock
integrity, spoon edge, concealment, guard attention, warden suspicion)" instruction could not be
satisfied literally as a *scenario property*, because the two are game-state resources, not physical
objects a referee can cite a description against -- recorded here as the ambiguity it was, and the
decision taken.

**9.2 Reconciling this task's brief with §3.2's five questions.** §3.2 names a "grounding" question --
a verbatim span of the target's description, or `none`, which rules the intent impossible -- as its
third question; the engineering brief that commissioned O1 instead names "the property" as the third
question. `src/open/referee.ts` treats these as the same question under one name: the answer key is a
property name (or `none`), and the REQUIRED CITATION on that answer -- a verbatim span of the TARGET's
own description -- is what actually carries §3.2's grounding requirement, independent of which key was
chosen. This lets `noise` (which has no property at all) still be held to the "cite the object's own
description" discipline: its `property` answer is legitimately `none`, but it still needs a verified
description citation to count as grounded. See `referee.ts`'s own header comment for the full
reasoning.

**9.3 Game end, mapped to open-mode state, before implementation (this task's brief requires this be
written down first).**

- **Escape** stays exactly what §1 promises: a condition on state, not a move. The loop checks, after
  every half-round (never as an effect a referee rules on, since O1 has no `move` to relocate the
  prisoner): the bar's `integrity` has reached 0 *or* the lock's `integrity` has reached 0 (the closed
  variant's own "opening" condition -- a cut bar or a bottomed-out lock), **and** `guard_attention` is
  below `ESCAPE_GUARD_MAX` (50, unchanged). Both numbers are read live off the shared resources the
  open world reuses from the closed variant's own `World` -- no new resource, no new mechanic.
- **Catch** stays tied to the warden's own `reveal` effects, mirroring SEARCH/OBSERVE/CHECK_LOCK: a
  catch is checked only immediately after a WARDEN's `reveal` resolves, and only when two things both
  hold -- (a) *grounds*: `warden_suspicion` (live) is at or above `SEARCH_SUSPICION_THRESHOLD` (40,
  unchanged), and (b) the just-revealed value crosses the closed variant's own per-property catch
  threshold (bar integrity <= `SEARCH_CATCH_BAR_MAX` 50; lock integrity <= `SEARCH_CATCH_LOCK_MAX` 40;
  spoon edge >= `SEARCH_CATCH_SPOON_MIN` 20 while its own `concealment` is below 50). All four
  thresholds are the closed variant's own constants, imported, never retyped.
- **Grounds accrue** (`warden_suspicion` rises) exactly as the closed variant's own "evidence becomes
  grounds" rule, generalised past FILE/HONE/CHECK_LOCK/OBSERVE to any effect: a PRISONER's non-`silent`
  `wear`/`restore`/`expose` bumps `warden_suspicion` by a magnitude-scaled amount
  (slight=`HONE_SUSPICION_BUMP`, moderate=`FILE_SUSPICION_BUMP`, substantial=`FAILED_ESCAPE_SUSPICION_BUMP`);
  a WARDEN's `reveal` that finds a property lower than the warden's own prior belief of it bumps
  suspicion by the unexplained drop divided by `EVIDENCE_SUSPICION_DIVISOR`, rounded down -- the
  identical rule, the identical constant, applied generically instead of per named move. Each bump is
  its own `resolve()` call (`OPEN_RESTORE` against `warden_suspicion`), so it is still an audited
  resolution, never a side channel outside the resolve protocol (invariant 1).
- What this deliberately leaves out of O1: the closed variant's warden-presence rule (whether the
  warden is physically in the cell to notice a prisoner act at all) is not modelled for the open
  variant's suspicion bump -- every non-silent prisoner effect is treated as potentially noticed. This
  is a real simplification, not an oversight: presence in the open variant would need the warden's own
  `reveal`/`noise` targets to carry a location the way `WARDEN_PRESENCE` does for named moves, and nothing
  in §4.1's object table currently says where the warden physically is. Left for a later phase.

## 10. First real games (issue #2, 2026-09-14)

Two games, `PRISONER_ROUNDS=8`: `qwen3:14b` wits, `ancient-awakening:12b` voice, `qwen2.5:14b` referee,
on one GPU through the swapper. Transcripts, unedited: `checkpoints/2026-09-14T16-08-26-355Z.md` and
`checkpoints/2026-09-14T16-19-01-447Z.md`, each with its `.referee.json`; the replay output is
`checkpoints/2026-09-14-open-referee-replay-N5.txt`.

### 10.1 What the wiring added beyond O1's mechanism

A half-round is not a game. Playing one needed: the round loop (`src/open/game.ts`); notes persisted in
the open half-round; code-rendered news (`src/open/perception.ts`) telling the actor the exact number
it moved or revealed, or for an impossible ruling the target's authored description, and telling the
other principal a non-silent attempt and the spoken line; beliefs and the warden's live suspicion in the
open briefing; open minds behind the swapper; time decay as a generic `OPEN_WEAR`. Two defects were
found and fixed: the open world created a second `lock_integrity` that the escape check never read, and
the open prompt carried the closed `WARDEN_PRESENCE_RULE`/`EVIDENCE_RULE`, which name closed moves and
describe presence O1 does not model.

### 10.2 Against §5.3

| | Criterion | Result |
|---|---|---|
| 1 | Zero §2 violations | **Held where measured.** Fog audit 0 leaks in 32 contexts; all 19 applied effects carry every required citation, verified; no silence or referee failure became a success. |
| 2 | A closed-inexpressible attempt ruled possible in ≥ 2 games, and one ruled impossible with its positive reason | **Not met.** Novelty 0 in both games by §5.2's `(object, effect)` table. 13 impossible rulings, each rendered with a positive reason. |
| 3 | Referee key agreement ≥ 80% on replay | **Met as measured, 99.0% and 97.5%, but see 10.4.** |
| 4 | Both endings reachable | **Not shown in real games.** Both timed out. Scripted integration tests reach escape, catch and timeout. |

### 10.3 Novelty is zero, and the ideas were not

The minds did invent: grit from under the loose tile as an abrasive (game 1, rounds 2–4, 7), chipping
the cracked mortar rather than the metal (game 1, round 6), and scraping the lock's bolt through the gap
in the door (game 2, round 8). Each resolved to a pair that has a closed equivalent: `bar`/`wear` (FILE)
or `lock`/`wear` (SHIM). §5.2 measures novel *effects on objects*, and O1's six generic effects over
three meaningful properties leave almost nothing a closed move cannot also express. That is a finding
about the measure as much as about the models: until `move` (O2) or `derive` (O3) exist, novelty by
this table is close to unreachable.

### 10.4 Impossible rulings are mostly citation mechanics, not physics

Of the 13 impossible rulings, the tables show near-duplicates of attempts ruled possible a round
earlier ("scrape the rusted section of the bar with the spoon"). The causes are the reader rejecting
the referee's offer, not the referee judging the act impossible:

- the right quote with the wrong source label (game 1, round 1: the bar's description cited as
  `precedent:bar`, where it also appears verbatim, instead of `desc:bar`);
- a target cited from the description rather than the intent (game 2, round 2), leaving target `none`;
- a property answer offered and discarded, or never offered (game 1 prisoner rounds 5, 6, 8; game 2 warden round 6, prisoner round 7, warden round 8;
  game 1 warden round 8 had no offer accepted for any question).
  The transcript from these games cannot say which; it now renders every rejected offer with the
  reader's reason and names questions never offered (commit after game 1).

The effect on play is large. The warden's attempts were ruled impossible in 8 of 16 warden turns across the two
games, so suspicion rarely accrued and catch was never in reach; the prisoner lost 5 of 16 turns to the
same mechanics and never approached escape. **This is fail-safe behaviour doing its
job, and it is the main thing standing between O1 and a contested game.**

### 10.5 What the replay number does and does not mean

Replay re-asks the identical recorded request and measures per-key agreement across replays. At
temperature 0 that is closer to determinism than to §3.5's consistency, and it misses two things:

- **Replayed keys vs the keys actually ruled in-game** agree on 145 of 160 (90.6%). Four of the differing keys decide applicability (game 1 warden rounds 1 and 6, prisoner round 8;
  game 2 warden round 4); three would turn an in-game possible ruling impossible.
- **Keys are not rulings.** Game 1 round 1's prisoner property key replays as `integrity` 5/5, the same
  key it got in-game, yet in-game the ruling was impossible because the citation named the wrong source.
  Agreement on keys says nothing about citation validity.
- **Similar intents in different states** are not replayed at all, and that is where the inconsistency
  in 10.4 lives.

### 10.6 Grounding quality (spot-check, by reading)

The code verifies a grounding quote is verbatim and from the target's description; it cannot verify
that the quote justifies the effect, and no lexical check was added. Read by hand:

- **Sensible:** `wear lock.integrity` grounded on *"The door hangs a finger's width short of its frame,
  and the edge of the bolt shows in the gap."* That is exactly what makes a spoon reach the bolt.
- **Sensible but coarse:** every `bar` ruling in both games, wear and reveal alike, cites the whole
  sentence *"Rust has pitted it near the bottom, where it is set into old mortar that is dry and
  cracked."* It justifies wear; for `reveal` it is merely true of the object.
- **Lazy:** game 2 round 7 warden cites the loose tile's *entire description* for `concealment`, a
  property the tile does not have (ruled impossible for that reason, by code).
- Magnitude was `slight` in all 19 applied effects, whatever the intent said ("aggressively scrape",
  "strike repeatedly"). The referee under-rules size, which alone makes escape in 8 rounds unreachable
  (bar wear slight = 8; from 100 that is 13 successful turns).

### 10.7 Open questions for the owner

1. Is §5.2's novelty table the right measure while O1 has no `move`/`derive`, or should O1 report
   *novel means* (an attempt citing a description span no closed move uses) instead?
2. The citation mechanics in 10.4 are the bottleneck. Options include prompting the referee with the
   required source per question, or accepting a verbatim quote found in the required source whatever
   label the referee gave. The second is a change to what counts as a citation, so it is a design
   decision, not a fix.
3. Should §5.3 item 3 replay near-duplicate intents across states, not only identical requests?

## 11. The precedent condition (2026-09-14)

The owner's hypothesis: novelty is absent because nothing makes it necessary. First mechanism, from the
new `mother-of-invention` package: `PRISONER_PRECEDENT_LEDGER` shows both minds, every turn, what Croft
has already perceived prisoners try in earlier games, as Croft's eleven years of experience that Voss
knows about. The ledger was seeded from the two baseline games (§10), then grew with each game.
Transcripts: `checkpoints/2026-09-14T17-46-34-096Z.md`, `checkpoints/2026-09-14T17-56-55-870Z.md`.

### 11.1 Result: no effect on the prisoner

| | Baseline (§10) | Precedent |
|---|---|---|
| Prisoner attempts on the bar | 15 of 16 | 16 of 16 |
| Novel (object, effect) pairs | 0 | 0 |
| Prisoner thoughts that mention Croft knowing an approach | — | 0 of 16 |
| New *means* | tile grit as abrasive; bolt through the door gap | tile grit again; the tile as a wedge to pry the bar |

The briefing said Croft knows "works at the bar" on sight (seen 9, then 13 times). The prisoner's
reasoning never engaged with it. Its thoughts reason entirely from the stated rules and numbers
(integrity, guard attention, the suspicion bumps), and nothing in those rules makes a known approach
fail or cost more. **Precedent that carries no consequence is flavour text.** Necessity has to live in
the rules the minds actually reason from, or be stated as a demand.

### 11.2 Confound: the referee copies its own failed rulings

The warden's attempts were ruled impossible in all 16 turns (8 of 16 in the baseline), so these games
did not test the warden side at all. The rejected offers now in the transcript show why:
`PrecedentStore` (§3.5, the referee's own precedent, unrelated to the ledger above) records every
ruling with a target, including inapplicable ones. Once `effect=none property=concealment` for the bar
entered it, later questions quoted that line back (game 2 rounds 4–6), and a referee that is shown a
failed ruling as precedent repeats it. Two further causes appear: a citation labelled `lock` instead of
`desc:lock`, and an effect quote copied from an earlier intent rather than the current one.

### 11.3 Precedent with a consequence (owner's decision, 2026-09-14)

§11.1's lesson: the minds reason from rules, so necessity has to be a rule. The owner chose a blend
that states a consequence rather than a prohibition, to stay open to serendipity: a prisoner attempt
whose perceived sentence matches one Croft knows on sight (`precedentTextFor`, exact equality on this
repository's own generated sentence) is **noticed however quietly it is done** and raises warden
suspicion by `KNOWN_APPROACH_SUSPICION_BUMP` (30, the closed variant's failed-escape bump) on top of any
ordinary bump. The briefing says exactly that, and nothing about avoiding anything. Old approaches stay
open and cost what they cost.

Two variables changed at once for the next games, and the comparison must say so: this consequence,
and the referee's precedent keeping only applicable rulings (§3.5, §11.2). The second mostly affects
the warden; the prisoner's novelty is what the first is meant to move.

### 11.4 Result with the consequence: the cost landed, the threat did not

Transcripts: `checkpoints/2026-09-14T18-21-01-298Z.md`, `checkpoints/2026-09-14T18-31-08-658Z.md`.

- **The prisoner still worked the bar every turn** (16 of 16), novelty 0. Once, it weighed the rule
  explicitly and paid it: *"even though it's a known move that raises suspicion... Warden Croft's
  suspicion is already high from prior attempts"* (game 1, round 7).
- **The consequence worked mechanically.** Warden suspicion reached 100 in both games.
- **The warden could not act on it.** Its examinations were ruled impossible in 15 of 16 turns, so a
  catch never came within reach, and paying the cost was rational. The one that got through (round 8,
  both games) was ruled `wear` on the bar, an examination read as damage: a misruling the code cannot
  catch (§10.6). **Necessity needs a threat that can land, and the warden is the missing half.**
- The rejected offers now say why the examinations fail, and none of it is physics: quotes the
  referee lowercased (`"closely examine the bar..."` against "Closely examine"), quotes elided with
  `...`, empty quotes, and source ids written `[desc:bar]` -- the transport prompt itself renders
  sources as `[id] text`, which invites exactly that.
