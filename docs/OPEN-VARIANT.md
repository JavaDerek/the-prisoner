# The Prisoner, open variant — design

*Status (2026-09-16): design approved, §8 decided, §4.1 descriptions approved by the owner. O1 is
**playable** (`PRISONER_VARIANT=open npm run checkpoint`); O3, `derive`, is designed in §13 and built on
run-dmcp 0.8.0. Escape is leaving the cell (§12), and has been reached in a real game (§30.1).
**§5.3 holds as of the §31 batch** -- zero §2 violations, novelty in three games, 99.5% mean replay
agreement, and both endings live -- which unblocks issue #1. §31.2 and §32.3 record what it does not
mean: the contested game ends at round six, and the prisoner's whole repertoire is abrading a bar.*

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
| `derive` | create a new object from a cited parent (§13) | run-dmcp 0.8.0's `create` intent (run-dmcp#34) |

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
   *Superseded 2026-09-16 (§33.16): the default is now `qwen3:14b`, the same model as the wits role, so
   the independence above is given up for the removal rulings only it gets right.*
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

## 12. Escape is leaving the cell (owner's decision, 2026-09-14)

§9.3 carried the closed variant's escape condition over: *bar or lock integrity at 0, guard attention
below 50*. The probe in `checkpoints/2026-09-14-probe-round7-*.json` showed what that costs: a 31B
model saw the bolt in the door gap and set it aside because "the lock integrity is 100". A rule that
defines escape as a number reaching zero turns every attempt into wearing that number down. The
owner's correction: **escape is when the prisoner is able to leave the cell, and leaves it.**

### 12.1 State

- **Where a principal is** is the character's `location_id`, changed only inside a resolution through
  run-dmcp 0.7.0's `set` intent (run-dmcp#32). The open world adds two locations beyond the cell:
  *the corridor* (through the door) and *outside the window*.
- **Exits are the existing objects**, so no new authored description is needed: the **lock** is the
  door's exit and the **bar** the window's. Each gains a `passage` property, `0` shut and `1` open,
  bounded and `resolve_only`.
- **An exit is passable** when its `passage` is `1`, or when its `integrity` has reached `0` (a bar
  worn through, a lock destroyed): the old routes still lead out, they no longer define "out".

### 12.2 Effects

Three generic effects join §4.2, each needing both citations like every other:

| Effect | What it does |
|---|---|
| `open` | sets the target's `passage` to `1` in one act -- the decisive effect §11's probe asked for |
| `close` | sets the target's `passage` to `0` |
| `leave` | moves the actor through the target exit to its destination, if and only if the exit is passable at that moment; otherwise nothing moves and the actor learns the exit is shut |

`wear`/`restore` never act on `passage`, the same way `conceal`/`expose` act only on `concealment`.

### 12.3 Ending

- **Escape:** the prisoner's `location_id` is anywhere but the cell, checked from state after every
  half-round, however it came about.
- **Guard attention is no longer a gate on escape** (the owner: "why on Earth would we limit ourselves
  any more than that?"). It stays in the world and keeps decaying; nothing reads it for escape.
- **Catch is unchanged in this step** -- one variable at a time. Its own narrowness (only an
  examination that finds damage) is the mirror problem, recorded for the next step.

### 12.4 What the minds are told

The escape rule becomes physical: *Voss escapes the moment she is out of the cell, however she gets
out.* The cell's ways out are named as the door and the window. The integrity threshold for escape is
removed from both prompts.

### 12.5 First games with physical escape

Transcripts: `checkpoints/2026-09-14T20-56-01-836Z.md`, `checkpoints/2026-09-14T21-06-26-366Z.md`
(same models, precedent with consequence on, the §11.4 referee prompt fix in place).

- **The grind ended.** Game 1 spread across the tile, the spoon's edge, the bolt in the door gap, the
  keyhole and the bar. Game 2 never touched the bar or the lock at all.
- **First novelty in a real game:** game 2 cut the cot's spring wire to get a usable length (rounds 4
  and 7), grounded on *"the springs are held to the frame by twists of wire"*. §5.3 item 2 asks for
  this in two games; it has one.
- **Neither game opened a way out or tried to leave.** Game 1's closest attempt, *"push or scrape the
  visible bolt in the lock's gap, attempting to dislodge or manipulate it"*, was ruled `wear` on the
  lock, not `open`: the referee followed "scrape".
- **The minds are reaching past O1's world.** The wire is wanted *as a tool*, and the tile's hollow
  was dug into four times for "hidden objects or materials" -- both are `derive` (§7, O3): making a
  new thing from parts, which O1 cannot resolve, so it registers as wear on the cot or as impossible.
- **The referee fix held.** Warden examinations were ruled possible 13 of 16 times (1 of 16 before
  it), with cited magnitudes and perceptibility.

## 13. Derive: the minds make things (O3, designed before code, 2026-09-14)

§12.5's games reached past O1's world twice: the cot's spring wire was cut "to extract a usable
length of wire", and the tile's hollow was dug into four times for materials. Both are `derive`
(§4.2, §7): a new thing from part of an existing one. O1 registered them as wear on the cot, or as
impossible. This section fixes what a derive is before any of it is built. The engine side landed
first: run-dmcp 0.8.0's `create` intent (run-dmcp#34) lets a resolution bring an entity into
existence, name it by `ref` in a later leg of the same resolution, and roll all of it back together.

### 13.1 What a derive ruling is

`derive` joins §4.2's effect vocabulary, ruled by the same referee with the same discipline: closed
keys, each cited verbatim against a named source, the safe default doing nothing. A derive ruling
carries:

| Key | Meaning | Citation |
|---|---|---|
| **target** | the **parent**: the object the new thing is taken from | the intent, as every target |
| **product** | *new, sixth question*: which **declared derivable kind** (§13.3) the new thing is, or `none` | the intent span naming what is made |
| **property** | the parent's property the derivation **consumes**, or `none` for a kind that consumes nothing | the parent's own description: the span naming the part that comes away. This is §3.2's grounding, and it becomes part of the new object's description (§13.2) |
| **magnitude** | how much of the parent is consumed | the intent |
| **perceptibility** | as every effect | the intent |

A derive is applicable under every ordinary check (§3.3, §9.2) and two more, both decided by code
from keys, never from prose: the product is not `none` and its intent citation verified, and the
product's **declared parent is the target**. A wire ruled as coming from the blanket is an incoherent
ruling and does nothing, exactly as a `conceal` naming `integrity` does (`effects.ts`).

**Consumption** reuses the parent's own `wear` table: a derive at magnitude *m* wears the consumed
property by exactly what a `wear` at *m* would. No new number is authored for it. A kind that
consumes nothing (grit from the tile's hollow, whose parent has no property) still needs the
description citation, as `noise` does. When the consumed property already stands at its minimum,
nothing comes away: the resolution records the attempt and creates nothing, and the actor is told the
parent's state (§13.4).

**One parent per derive.** A thing made from two things (a wire lashed to a strip) is not O3; see
§13.6.

### 13.2 Where the new object's description comes from

§8.3 defers any model writing descriptions, because it would put a model upstream of the grounding
guard. That holds. A derived object's description is **composed by code from two authored texts**:

1. the derivable kind's own physical description, content in the scenario file, written the way §4.1
   writes everything (material, size, wear; never what it is for);
2. the verbatim span the referee cited from the parent's description as the part that came away.

The composed form is fixed: *`<kind description>` It came away from the `<parent>`, where
"`<cited span>`".* Every later citation against the new object is therefore still a quote of text a
human wrote, either in this repository or in §4.1.

### 13.3 What a derived object can do later

It is an object like any other: an id, a holder, a description, and the properties its kind
declares, each with `min`/`max`/start and a `wear`/`restore` magnitude table, in the same shape as
`scenarioObjects.ts`. The same generic effects act on it; the referee cites its composed description;
`wear`/`restore`/`reveal`/`conceal`/`expose` are ruled against its declared properties and nothing
else (§2 invariant 5). **What a derived object is *for* is not declared anywhere**, on §3.3's own
principle: whether a length of wire pushes the bolt back is the referee's ruling on an `open` intent
against the lock, grounded on the lock's text, with the wire visible to the referee among the actor's
perceived objects. O1 never verified that the spoon was to hand for "file the bar with my spoon", and
O3 does not start.

The derivable kinds for The Prisoner, content the owner may cut:

| Kind | Parent | Consumes | Description | Own properties |
|---|---|---|---|---|
| `wire` | `cot` | `integrity` | A length of stiff iron wire about a hand long, untwisted from a spring, with a kink at one end where it was worked back and forth. | `integrity` 100, `concealment` 0 |
| `strip` | `blanket` | `integrity` | A strip of coarse grey wool about an arm long, torn along the hem, with loose threads at both ends. | `integrity` 100, `concealment` 0 |
| `grit` | `loose_tile` | nothing | A handful of dry grit from the hollow beneath the tile, coarse and sharp-grained. | `concealment` 0 |

Each kind's `wear`/`restore` tables are authored in the same proportion as the blanket thread and cot
wire (§9.1). Every derived kind carries `concealment` so §10.1's perception rule applies unchanged:
its holder always perceives it, the other principal perceives it unless it is concealed at 50 or
more. A wire left lying about is seen; a wire hidden under the tile is not. Ids are the kind's name,
then `wire_2`, `wire_3` for a second and third of the same kind.

### 13.4 Perception and precedent

- **The actor** is told, by code from the outcome: *Your last attempt made a length of wire from the
  cot: you hold it now. The cot's integrity went from 100 to 80.* When nothing came away: *Your last
  attempt met the cot with its integrity at 0, already stripped.* The new object then appears in the
  actor's perceived objects with its composed description.
- **The other principal**, when the derive was not silent, perceives the act on the parent and
  nothing about the product: *Voss works a piece loose from the cot.* What was made, it learns the
  way it learns anything, by perceiving the new object in a later briefing if it is in view
  (§13.3). Invariant 2 is untouched: no referee text, no product name, reaches it.
- **Suspicion** accrues as for `wear`: a prisoner's non-silent derive bumps warden suspicion by the
  magnitude-scaled amount (§9.3). A derive is physical work on a fixture.
- **Precedent** (§11): the sentence Croft knows on sight names the parent, never the product: *A
  prisoner works a piece loose from the cot.* The known-approach consequence applies to it.
- **Catch is unchanged** (§12.3). A derived object is not a catch trigger in O3.
- **Novelty** (§5.2): no closed move makes anything, so every applied derive is a novel
  `(object, effect)` pair by the declared table.

### 13.5 How it resolves

One resolution per derive, through one generic mechanic (`OPEN_DERIVE`), whose legs are: a `write`
wearing the consumed property (when the kind consumes one), a `create` of the item (held by the
maker, its composed description carried in the row's `properties`), and one `create` per declared
property as a resource, each leg naming the item by run-dmcp 0.8.0's `{ ref }`. Every leg lands or
none does. The resolution's `created` list is what this repository then reads to register the new
object for perception and later effects.

**One thing happens after `resolve()` returns, and it is recorded here as the ambiguity it is.** The
new resources must be `bounded` and `resolve_only`, like every property in the world. The engine
has no intent that declares a constraint (the shape run-dmcp#32 left unbuilt), so the declaration is
made by the same world-building call `buildOpenWorld` uses at setup, immediately after the derive
resolves. A constraint declaration is not a change of world state and opens no second write path:
nothing in this repository writes a resource outside `resolver.resolve()` (§2 invariant 1's guard),
and the window between the resolution and the declaration holds no code that could. If the owner
wants this closed structurally, the fix is an engine `declare` intent, filed from the caller.

### 13.6 Ambiguities and what was decided

1. **Product: a question, or inferred from (target, property)?** A question. Inferring "wire" from
   `(cot, integrity)` is code deciding what prose meant (§2 invariant 6); a closed key with an intent
   citation is the referee saying it.
2. **One parent or several?** One. Multi-parent derivation is deferred until a real game wants it.
3. **A new number for consumption, or the parent's wear table?** The parent's table. Nothing new
   to author, and a derive costs the parent what working at it costs.
4. **A new perception rule for derived objects?** No. Every derived kind carries `concealment` and
   §10.1's rule does the rest.
5. **Is the product question asked on every intent?** Yes, with `none` as its safe default; it is
   read only when the effect is `derive`. One question set per read keeps replay (§5.2) meaningful.
6. **Constraint declaration after the resolution.** See §13.5.
7. **The mind prompt is unchanged.** One variable at a time: the minds already reach for making
   things (§12.5). If they stop, that is a finding.
8. **What a derived object does is not declared.** §13.3.
9. **Nothing comes away at the minimum.** A derive against a stripped parent creates nothing and
   says so positively; it is not refused, because the attempt was possible and happened.

### 13.7 First games with derive (issue #4, 2026-09-14)

Three games, `PRISONER_ROUNDS=12`, `qwen3:14b` wits, `ancient-awakening:12b` voice, `qwen2.5:14b` referee,
precedent ledger on, on run-dmcp 0.8.0 with the step-1 `open` wording. Games 1 and 2 are one batch on
one configuration. Game 3 was played after one referee-prompt fix that game 1 exposed (below), and is a
separate condition. Transcripts, unedited: `checkpoints/2026-09-14T21-52-32-382Z.md`,
`…22-05-39-248Z.md`, `…22-15-20-246Z.md`, each with its `.referee.json`; the replay of game 3 is
`checkpoints/2026-09-14-open-referee-replay-derive-N5.txt`.

| | Game 1 | Game 2 | Game 3 (after the fix) |
|---|---|---|---|
| Result | timeout | **caught, round 9** | timeout, **with the door open** |
| Derive ruled | 1 (round 10) | 0 | 5 |
| Objects made | 0 | 0 | **2** (a strip, round 2; a wire, round 7) |
| Novel pairs (§5.2) | 0 | 0 | 7 |
| Applied, fully cited | 15 of 15 | 11 of 11 | 15 of 15 |
| Fog audit | 0 leaks in 24 | 0 in 17 | 0 in 24 |

**Game 1.** The prisoner reached for derive from its first turn: the tile's hollow five times ("dig into
the hollow", ruled `wear` or `reveal` against an object with no property, impossible each time) and the
cot's wire twice. Round 10's *"Untwist the wire holding the cot's springs to obtain a usable piece of
metal"* was ruled `derive`, product `wire`, cited from the intent: the first derive ruling in a real
game. It died on the grounding citation: the referee wrote *"The springs are held to the frame by
twists of wire."*, capitalising a mid-sentence span and adding a full stop, against the source's
*"the springs are held to the frame by twists of wire"*. §11.4's class of failure, one more time. Round
11 the prisoner acted as if it had the wire anyway. The fix, in the transport prompt with an example
(*a span from the middle of a sentence keeps its small first letter and gains no full stop*), is a
prompt change, not a change to what counts as a citation; §10.7's item 2 stays the owner's.

**Game 2.** The first catch in a real open game: suspicion at 100 and the bar examined at 40. The
prisoner never phrased an attempt as making something; it searched the hollow four times for hidden
things, then worked the bar until the examination found it.

**Game 3.** Two derives landed, each grounded on the parent's own text and resolved as one creating
resolution: the strip on *"frayed along the hem, with a loose thread running down one edge"*, the wire
on *"the springs are held to the frame by twists of wire"*. Both then appeared in both principals'
perceived objects with their composed descriptions, and Croft's ledger now holds *A prisoner works a
piece loose from the cot* and *from the blanket*. The prisoner used the wire at once: rounds 8 and 9,
*"Use the wire to push the bolt back into the door through the gap, attempting to open the door"*,
was ruled `open` (the step-1 wording held) and lost both turns to the effect citation, *"pushing the
bolt back"* for the intent's *"push the bolt back"*. Round 11 it opened the door with the spoon:
`door_passage` 0 to 1, the first way out opened in a real game. Round 12's briefing began *Your last
attempt opened the door* and carried *door passage: 1 (as of round 11)*, and the prisoner spent the
turn bending the wire into a hook "to open the door".

Three more derives were ruled possible and did nothing, because the product's declared parent was
not the target: a hook from the spoon (round 5), a longer string from the strip (round 6), a hook
from the wire (round 10). Rendered to the actor as the target's own description, per §5.3.

### 13.8 Against §5.3, and what the games ask for

| | Criterion | Result |
|---|---|---|
| 1 | Zero §2 violations | **Held where measured**, all three games (table above). |
| 2 | A closed-inexpressible attempt ruled possible in ≥ 2 games, and one ruled impossible with its positive reason | **Not met in this batch.** Game 3 alone has applied novelty (two derives, one open); game 1's derive ruling died on a citation. Impossible rulings with a positive reason: every game. |
| 3 | Referee key agreement ≥ 80% on replay | **Met as measured on game 3: 99.7%** over 24 requests × 6 keys, N=5, with §10.5's caveats unchanged; the `product` key replayed at 100% on both derives that landed. |
| 4 | Both endings reachable | **Catch reached in a real game for the first time** (game 2). Escape still not, though game 3 ended with the door open. |

What the games ask for, for the owner:

1. **Reshaping a held thing.** After the first derive, the most frequent derive-shaped intent was to
   turn something the prisoner holds into something else (a hook from the wire, twice; a string from
   the strip). §13.1 admits one parent, a §4.1 object, and §13.3's kinds have no shape. Whether a hook
   is a kind derived from the wire (a chain of derivations), a property of the wire, or out of scope
   is a design decision.
2. **An open door is news once and then a number.** The briefing said *Your last attempt opened the
   door* and *door passage: 1*, and the mind did not connect either to *escapes the moment she is out
   of the cell*. A standing, positive state line while an exit is open (*The door stands open.*) costs
   nothing and is one variable; not built here.
3. **Citation mechanics still decide turns.** A verb re-inflected (*pushing* for *push*), a
   sentence-start capital lowercased (*bend* for *Bend*, game 3 round 12). Each is a paraphrase the
   code correctly refuses and a turn lost. §10.7 item 2 is unchanged and is the owner's.
4. **The hollow.** Every game searched it for hidden things, ruled impossible for want of a property.
   Grit was made only when the intent said what was taken; "examine the dry grit" (game 3, round 3)
   was ruled `derive` with the product cited from words the intent did not contain, and refused.

## 14. Reshaping a held thing (owner's decision, 2026-09-14, designed before code)

§13.8 item 1: after the first derive, the minds' most frequent derive-shaped intent was to turn a thing
they had made into something else (a hook from the wire, twice; a cord from the strip). **The owner
said yes.** This section fixes how, inside §13's derive, so **no new effect is added**: the eleven
effects stay fixed for the benchmark (the-prisoner#5).

### 14.1 A kind whose parent is a kind

A derivable kind (§13.3) may name, as its parent, **another derivable kind** instead of a §4.1
object. The ruling's target is then any derived object of that kind (`wire`, `wire_2`, …); the
"product's declared parent is the target" check (§13.1) compares the target's kind, decided by code
from the recorded kind, never from prose.

### 14.2 Reshaping replaces its parent

A kind declares `replacesParent`. When true, the thing is **reshaped, not taken from**: one
resolution destroys the parent (the item and every resource its kind declared, through run-dmcp
0.8.0's `destroy` intent) and creates the product, every leg landing or none. Because the whole
parent becomes the product:

- it **consumes nothing** (`consumes: null`; §13.1's property answer is `none`, still grounded by a
  citation from the parent's own description, as grit's is);
- the product is held by **whoever held the parent**;
- every property **both kinds declare carries its current value over** (a wire hidden at
  concealment 60 becomes a hook hidden at 60). A property only the product declares starts at its
  declared start. This is the one number copied rather than authored, and it is copied by code from
  a fact, not chosen.

A kind that is not `replacesParent` and names a kind as parent (a piece taken from a made thing)
is allowed by 14.1 but no such kind is declared today.

### 14.3 Description

Composed by code exactly as §13.2: the kind's authored description, then *It came away from the
`<parent>`, where "`<cited span>`".* The parent's text is itself composed from authored text, so
every citation remains a quote of words a human wrote.

### 14.4 Perception and precedent

- **The actor:** *Your last attempt made a hook from the length of wire: you hold it now, and the
  length of wire is gone.*
- **The other principal**, when not silent, perceives the act on the parent (*Voss works at the
  length of wire.*) only if it perceives the parent; otherwise it perceives the act as noise, nothing
  about either object. A destroyed object leaves every briefing.
- **Precedent** names the parent kind: *A prisoner reshapes a length of wire.*
- **Suspicion:** as §13.4, a non-silent prisoner derive bumps it.

### 14.5 The kinds (content, awaiting the owner's approval of wording)

| Kind | Parent | Replaces | Description | Own properties |
|---|---|---|---|---|
| `hook` | `wire` | yes | A length of stiff iron wire about a hand long, bent back on itself at one end into a narrow hook, the rust flaked away along the bend. | `integrity` 100, `concealment` 0 |
| `cord` | `strip` | yes | A cord of coarse grey wool about an arm long, twisted tight on itself and knotted at both ends. | `integrity` 100, `concealment` 0 |

## 15. What the hollow hides (owner's decision, 2026-09-14, designed before code)

§13.8 item 4: every game searched the tile's hollow and was ruled impossible for want of a property.
**The owner's decision: hide $1000 there**, and see whether the prisoner ever tries to bribe the
warden. The money is world content. Finding it needs one small, general mechanism, recorded here as
such because the owner asked whether this was world design alone: today an object is perceived or
not by its own `concealment` (§10.1), and nothing can be *inside* another object.

### 15.1 Containment gates perception

An object may declare **`heldIn`: another object's id**. It is perceived by a principal only when the
container's `concealment` stands below 50; above that, it is in no briefing and no referee request
(so no mind can target it), for both principals alike, the owner included. When the container is
open to view, §10.1's own rule then applies to the object as usual. The rule is generic; the hollow
is its first caller.

**A container's `concealment` hides what is in it, never the container** (resolved while building,
2026-09-14). Read literally, §10.1 would hide the tile itself from both principals at 100, since
nobody owns it, and then nothing could be ruled against it: no `expose`, no grit. The closed variant
already behaves this way (`src/view/viewFor.ts` keeps the tile in view whatever CONCEAL does). A held
object is also hidden when its container's concealment cannot be read.

### 15.2 The tile gains `concealment`

`loose_tile` declares `concealment`, starting at **100** (the tile down, the grit undisturbed), with
the spoon's proportion of wear/restore tables (§9.1). The ordinary effects then act on it, nothing
new: `expose` (lift the tile, dig through the grit) lowers it, grounded on the tile's description
(*"beneath it is a shallow hollow of dry grit about the size of a hand"*); `conceal` raises it again.
§9.3's rule applies unchanged: a prisoner's non-silent expose is uncovering and bumps suspicion. Grit
(§13.3) still consumes nothing.

### 15.3 The money

| Object | Held in | Description | Properties |
|---|---|---|---|
| `banknotes` | `loose_tile` | A fold of banknotes wrapped in a strip of oilcloth, ten notes of a hundred each, soft and grey with damp. | `concealment` 0 |

Nobody owns it and nobody is told it exists: no briefing, stake, motive or precedent line mentions
it. The warden's identity and motive are unchanged, so whether a bribe could ever land is the warden
model's own choice; nothing makes the money worth anything to Croft. **The money cannot change
hands:** there is no transfer effect (the-prisoner#5 step 1), so an offer is speech (§12.4's spoken
line) and a deal is paid in the warden's own later acts.

### 15.4 What is measured

In each game: the round the banknotes are first perceived by each principal, every spoken line or
intent that mentions money or a bribe (**read by a human in the transcript**, never matched by code,
CLAUDE.md "never pattern-match meaning"), and what the warden does after one.

## 16. The one-off door test (2026-09-14, uncommitted patch)

§13.8 item 2 asked whether the prisoner in game 3 stayed in with the door open because the briefing
said so only as a number (*door passage: 1*). One diagnostic game, not a condition: a patch that was
**never committed** started the door open and added *The door stands open.* to both briefings while
it was. 6 rounds, the same models as §13.7, precedent on against a copy of the ledger (the committed
ledger is unchanged). Transcript, unedited: `checkpoints/2026-09-15T00-16-45-550Z-door-test.md` and
its `.referee.json` (committed in 3857bf8, whose message also names this section; the doc edit itself
failed to apply in that commit and lands here). The patch, in full:

```diff
diff --git a/src/open/briefing.ts b/src/open/briefing.ts
index 3cd00d1..de7cc57 100644
--- a/src/open/briefing.ts
+++ b/src/open/briefing.ts
@@ -95,6 +95,12 @@ export function buildOpenBriefing(
   for (const perceived of news.fromOther ?? []) lines.push(perceived);
   lines.push(principal === "prisoner" ? prisonerStakes(totalRounds) : wardenStakes(totalRounds));
   for (const line of news.standing ?? []) lines.push(line);
+  // ONE-OFF DOOR TEST, never commit.
+  if (process.env.DOOR_TEST_LINE) {
+    const passageId = resourceIdForProperty(openWorld, "lock", "passage");
+    const passage = passageId ? readNumericFact({ gameId, t, entityId: passageId, key: "value" }) : null;
+    if (passage !== null && passage >= 1) lines.push("The door stands open.");
+  }
 
   const notes = getNotes(gameId, principal);
   if (notes) lines.push(`Your notes from last round: ${notes}`);
diff --git a/src/open/scenarioObjects.ts b/src/open/scenarioObjects.ts
index 1f953df..b34703c 100644
--- a/src/open/scenarioObjects.ts
+++ b/src/open/scenarioObjects.ts
@@ -147,7 +147,7 @@ export const OPEN_OBJECTS: readonly OpenObjectSpec[] = [
         resourceName: "door_passage",
         min: 0,
         max: 1,
-        initialValue: 0,
+        initialValue: process.env.DOOR_TEST_START_OPEN ? 1 : 0, // ONE-OFF DOOR TEST, never commit
         wear: { slight: 1, moderate: 1, substantial: 1 },
         restore: { slight: 1, moderate: 1, substantial: 1 },
       },
```

**Result: the sentence reached the mind; the referee then could not rule the exit.** The prisoner tried
to leave twice in six turns (round 3 *"Attempt to escape through the open door without raising
suspicion."*, round 6 *"Exit through the open door."*), against none in game 3's two open-door turns.
Both were ruled impossible, and not on physics: the referee's target was `none`, because the exit is
the object `lock` (*"A steel lock set in the cell door…"*) and no object is called `door`. The target
answer keys are object ids, so "the door" matched nothing, and the `passage` citation from `desc:lock`
could not verify against a `none` target.

- The line was a diagnostic, not a mechanics fix, and is not built. If a standing state line is
  wanted, the general form is each property declaring how its value reads in words, for every object.
- **The finding is a world-naming mismatch**: the minds and §12's rules say *door*, the world says
  *lock*. Awaiting the owner: split `lock` into a `door` (the exit, `passage`) and a `lock` set in it.
- The warden, told every turn that the door stood open, examined the bar in all six turns and never
  closed it.
- Caveat: the lock's description (*"The door hangs a finger's width short of its frame"*) contradicts a
  door open from round 1; another reason this is a diagnostic, not a game.

## 17. The ways out are objects of their own (owner's decision, 2026-09-14, designed before code)

§16 found the exit unnamable: the minds and §12's rules say *door* and *window*, but the exits are the
objects `lock` and `bar`, and the referee's target keys are object ids. **The owner said yes to
splitting the lock from the door.** The window has the identical mismatch (`EXIT_LABEL` in
`loop.ts` already maps `bar` to "window" for perception, and the referee never sees that map), so it
is split the same way; leaving it would ship a known copy of §16's failure.

### 17.1 Objects

| Object | Held by | Description (awaiting the owner's approval of wording) | Properties |
|---|---|---|---|
| `door` | the cell wall | A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap. | `passage` (0 shut, 1 open), was `lock.passage` |
| `lock` | the cell door | A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame. | `integrity`, unchanged |
| `window` | the cell wall | A small window high in the wall, a little wider than a person's shoulders, barred by five vertical iron bars. | `passage`, was `bar.passage` |
| `bar` | the window | Unchanged. | `integrity`, unchanged |

Resource names (`door_passage`, `window_passage`, `lock_integrity`, `bar_integrity`) and every number
are unchanged; only which object declares `passage` moves.

### 17.2 Rules

- An exit is keyed by the **way-out object** (`door`, `window`), and names its **part** (`lock`,
  `bar`) for §12's other way through: leaving is possible when the way out's `passage` is 1 **or** its
  part's `integrity` is 0, exactly as today. `EXIT_LABEL` is no longer needed (the ids are the names).
- `open`, `close` and `leave` target **the way out itself**, even when the method works on its part.
  The effect question says so: *for open, close and leave, the target is the way out (the door, the
  window), even when the method works on a part of it such as its lock or a bar.* `wear`, `restore`
  and `reveal` of `integrity` still target the part.
- Catch (§12.3: a close examination of the lock's integrity) is unchanged: it targets `lock`.

### 17.3 Comparability

Every open-variant transcript before §17 is a different world for the exit. Precedent sentences
already recorded (*works at the lock*) stay true and are not rewritten.

## 18. Citations by word range (owner's decision, 2026-09-14, designed before code)

§10.7 item 2 and §16: turns are lost to citations that are right in substance and wrong in bytes
(*pushing* for *push*, *bend* for *Bend*). The byte-exact check is run-dmcp's (`turnReader.ts`), on
purpose (its hard rule 4), and **is not loosened**. The owner chose instead to make an exact quote
effortless: the referee stops retyping text.

### 18.1 What the referee sees and returns

The transport (`refereeTransport.ts`, this repository) renders every citable source with its words
numbered, a word being a maximal run of non-whitespace:

```
source "desc:door":
1:A 2:heavy 3:door 4:of 5:iron-bound 6:planks …
```

A citation is `{"sourceId": "...", "from": n, "to": m}`. The transport rebuilds the quote as the
source text **sliced from the first character of word n to the last character of word m**, so the
quote is an exact substring of the source by construction, and hands the engine
`{sourceId, quote}` as today. The engine's verbatim check still runs, unchanged.

### 18.2 Failure stays safe

- A range out of bounds, reversed (`from > to`), non-integer, or naming a source not in the request
  is dropped by the transport, so the question falls to its safe default, as any bad offer does.
- A citation that still arrives as `{"sourceId", "quote"}` is passed through untouched and checked
  byte-exact by the engine, as today. Nothing that verifies now stops verifying.
- §11.4's mid-sentence instruction becomes unnecessary for ranged citations and is removed from the
  prompt; the character-for-character instruction stays for the quote fallback.

### 18.3 What this does and does not change

The guarantee that a quote is real text moves from a check that can fail to a construction that
cannot. What stays a human audit is unchanged (CLAUDE.md "never pattern-match meaning"): whether the
words the referee chose justify its ruling. Numbering is lexical rendering of this repository's own
prompt; no code reads what the words mean. Transcripts show both the range and the rebuilt quote.
Replay (`refereeReplayCli.ts`) goes through the same transport and needs no change of its own.

### 18.4 The first games on §18, and a fix (2026-09-14)

Two 12-round games on §17 + §18 as first built (`checkpoints/2026-09-15T00-50-03-121Z.md`,
`…01-03-35-960Z.md`), same models and precedent ledger as §13.7. Both timeouts; every applied effect
fully cited (17 of 17, 13 of 13); the banknotes never perceived (§15.4: warden never, prisoner never);
no reshape; no attempt on either way out. **But the rulings got worse**: the warden's *"Examine the bar
closely…"* ruled `wear` in 10 of 12 turns in each game, and target citations stopped supporting their
answers (target `bar` cited as *"spoon to scrape the"*).

**Cause: the transport showed each source only as numbered words** (§18.1 as written did not say to
keep the plain text, and the build followed it). Fixed: plain text first, then `words: 1:… 2:…` for
citing. Evidence, replaying game 1's 24 recorded requests (same questions and sources, only the
transport differing; N=1 at temperature 0), `checkpoints/2026-09-15-open-referee-replay-game1-transport-*-N1.txt`:

| | Quote transport (9c7b9c9) | Numbered only (b814f7c) | Plain + numbered (fix) |
|---|---|---|---|
| Warden *examine the bar* ruled `reveal` | 3 of 9 (2 `none`, 4 `wear`) | 0 of 9 | 4 of 9 |
| *sharpen the spoon* targeted at `spoon` | 5 of 5 | 0 of 5 | 4 of 5 |

The fix restores parity with quoted citations. **What it does not fix, and what predates §18:** a
warden examination ruled `wear` about half the time on these requests, where §13.7's game 3 ruled every
one `reveal`. These requests differ from game 3's in both intent wording (*"for signs of additional
wear or tampering"*) and question text (§14's and §17's additions to the effect and property
questions). **A fourth replay separates them**: game 1's requests with the effect and property
questions put back to game 3's exact text, fix transport
(`checkpoints/2026-09-15-open-referee-replay-game1-oldquestions-N1.txt`). Warden examinations of the bar
ruled `reveal`: **4 of 9, the same as with the new text.** The question changes are not the cause. The
referee reads an examination whose words name what is looked for (*"signs of additional damage or
wear"*) as the act named, where game 3's warden wrote *"hidden damage"*; and a `reveal` it does give is
paired with `concealment`, a property the bar does not declare, so it is ruled impossible anyway.
Open, and a referee-judgement question, not a mechanics one: it matters because a warden whose
examinations are wear never reaches catch and wears the bar for the prisoner.

### 18.5 An examination is not the damage it looks for (owner's decision, 2026-09-14)

§18.4's open problem, fixed in the referee's own prompt (this repository, no code reading prose). The
effect question gains: *An act whose aim is to learn -- to examine, inspect or check something -- is
reveal, whatever it looks for: examining a bar for signs of damage or wear is reveal, not wear.* The
property question gains: *For reveal, name the property being learned: integrity for damage, wear,
rust or tampering, even when the intent calls it hidden.* "Search" is deliberately not in the list: a
search of the hollow should stay free to be `expose` (§15.2).

Evidence: both §18.4 games' 48 recorded requests with only the effect and property question text
replaced by the new text, fix transport, N=1
(`checkpoints/2026-09-15-open-referee-replay-game{1,2}-learn-is-reveal-N1.txt`). **Warden examinations
of the bar: `reveal`/`integrity` in 19 of 19** (game 1: 9 of 9, game 2: 10 of 10), from about half.
Not fixed, and not attributable to this change on the evidence so far: the prisoner's collect-grit
intents ruled `wear` on the tile instead of `derive` in 3 of 4 (already so under §18.4's transport
alone for game 1 round 5); game 2 round 4's *"Examine the lock for hidden damage."* got target `none`;
examinations of the tile name `integrity` or `none`, which the tile does not declare.

### 18.6 First games on §18.5: a catch, and the referee copying its own rulings (2026-09-14)

Two 12-round games, same configuration (`checkpoints/2026-09-15T01-39-22-411Z.md`, `…01-52-09-684Z.md`).
Game 1: **caught at round 12**; game 2: timeout. Banknotes never perceived in either; no reshape; no
attempt on either way out; every applied effect fully cited (22 of 22, 18 of 18). The warden's
examinations of the bar were `reveal`/`integrity` in every turn, as §18.5's replay predicted.

**New failure: the prisoner's work on the bar was ruled `reveal` too** (*"Use the spoon to scrape rust
off the bottom of the bar."*, round 1): 5 of 12 prisoner turns in game 1, about 8 of 12 in game 2. The
replays of §18.5 could not show it, because they carried the old games' earlier rulings, mostly `wear`.
**Cause, confirmed by replay:** the referee's *EARLIER RULINGS … for consistency* block (§11.4). Each
line names the object and the ruling but not the intent ruled on (`precedent:bar | effect=reveal
property=integrity magnitude=moderate target-citation="bar closely for signs" …`), so once the
warden's examinations are consistently `reveal`, any act on the bar is ruled like them. Game 1's 23
recorded requests with those lines removed, nothing else changed
(`checkpoints/2026-09-15-open-referee-replay-185game1-no-earlier-rulings-N1.txt`): **prisoner work on
the bar `wear` in 10 of 11** (one `restore`), warden examinations still `reveal` in 11 of 11. This is
§11.2's confound in a new form. Awaiting the owner: show each earlier ruling with the intent it ruled
on, or drop the block.

### 18.7 Earlier rulings with their intents: tried, did not help, not kept (2026-09-14)

The owner's first choice for §18.6: prefix each earlier-ruling line with the intent it ruled on
(`intent="Examine the bar closely…" effect=reveal …`). Built test-first (560 tests green), then checked
by **re-ruling** both §18.6 games' intents in order through a live referee, so the block was rebuilt by
the new code rather than replayed from the recording (a temporary script, not committed; results in
`checkpoints/2026-09-15-open-referee-rerule-185games-intent-in-earlier-rulings-N1.txt`).

**Result: no improvement.** Prisoner work on the bar in game 1: `reveal` in 8 of 11 (1 `wear`, 2
`none`), against 5 of 12 in the game itself; game 2 similar. Round 1's scrape, whose only earlier line
was the warden's examination *with its intent shown*, was still ruled `reveal`. The referee copies the
ruling whether or not it can see the act it was made on. The change was reverted and is not in the
code; §18.6's replay with the block removed (prisoner `wear` 10 of 11) remains the only evidence of a
fix. Awaiting the owner: drop the block.

### 18.8 The block dropped; an exact-repeat cache in its place (2026-09-15)

The owner's remaining option from §18.6/§18.7: drop the block. §3.5's actual requirement is narrower
than a prompt block ever needed to be -- "the same intent in the same state should get the same
ruling" -- so instead of showing the referee its own earlier work as text (which is what caused the
copying, wording or no wording), `referee.ts` now serves an EXACT repeat of a prior `(intentText,
perceivedObjects)` pair straight from an in-memory cache, without asking the referee again, and shows
NO earlier-ruling text for anything that is not an exact repeat. `PrecedentStore` and the "EARLIER
RULINGS" block are gone from both `referee.ts` and `refereeTransport.ts`, not merely unused. Built
test-first: a red test asserted a different intent on the same object gets no `precedent:*` source
(failed against the old code, since that is exactly what it did), and a second asserted an exact
repeat calls the transport only once. 558 tests green.

Checked the same way as §18.6/§18.7: re-ruled both games' recorded intent sequences, in order, through
one fresh referee per game against the live model (temporary script, not committed; full output in
`checkpoints/2026-09-15-open-referee-rerule-185games-no-earlier-rulings-cache-N1.txt`).

**Result: fixed, matching §18.6's manual strip and slightly ahead of it.** Prisoner work on the bar:
game 1 `wear` 10 of 11 (1 `restore`, 0 `reveal`); game 2 `wear` 8 of 10 (1 `restore`, 1 `none`, 0
`reveal`). The warden's examinations of the bar stayed `reveal` in every applicable turn in both
games -- §18.5 is unaffected, only the prisoner-side copying is gone. This closes §18.6/§18.7's open
question; nothing is awaiting the owner here now.

### 18.9 One live game since §18.8, full roster (2026-09-15)

§18.8's re-rule held the actions fixed. One genuinely live game after it (`qwen3:14b` wits,
`ancient-awakening:12b` voice, `qwen2.5:14b` referee, `PRISONER_THINK_TIMEOUT_MS=180000`, same
precedent ledger) checks the fix under real intent variety rather than a replayed sequence:
`checkpoints/2026-09-15T14-45-03-829Z.md`. Result: timeout at round 12.

The warden's 12 examinations of the bar were `reveal` in every one, as before. The prisoner's 12
turns, this time genuinely varied in wording (not the earlier games' near-identical "scrape the bar"
text), got a genuinely varied ruling back: `wear` 3, `reveal` 3, `open` 2 (grounded on `integrity`,
which `open` does not accept per §12.1 -- ruled applicable but did nothing, a separate, already-
documented grounding-quality gap, §10.7 item 2), `derive` 2 (a length of wire from the cot, twice --
the second is the FIRST re-derivation of an already-derived kind's source object seen in any game),
`none` 1, ruled impossible 1. That spread, not a repeat of one verdict, is the actual sign the fix
holds live: nothing here is the referee locking onto its own earlier answer for the bar regardless of
what the current intent says. First game to reach an `open` ruling on two different ways out in one
game (round 8 the window's mortar, round 12 the door's bolt gap) and the first to re-derive wire after
deriving it once already (round 9, from the cot's remaining springs) -- both closer to §5.3's still-
unmet items than any earlier game, though neither exit opened and no escape was attempted.

## 19. Open/close resolves through the way out even when the referee targets its part (2026-09-15)

§10.7 item 2 named this a "grounding-quality gap" when §18.9's round 8 hit it live; it is not a
wording nit, it is the reason `open` has never once succeeded. Every `open`/`close` ruling any real
game has ever produced -- both of them -- was refused: round 8 above (`open bar.integrity`) and an
earlier game, 2026-09-14T22-15, round 11 (*"Use the spoon to push the bolt back through the gap in
the door."* -> `open lock.passage`, refused because `lock` declares no `passage` to name). Two
different failure shapes, one cause.

**§17.2 said** *"open, close and leave target the way out itself, even when the method works on its
part,"* and put that instruction in the `effect` question's own prompt: *"for open, close and leave,
the target is the way out... even when the method works on a part of it such as its lock or a bar."*
But the `target` question is answered separately, from its own prompt, which never says this -- so
the referee gets `effect: open` right (it followed the aim-not-method rule that lives in the effect
question) while still naming the part as `target` (nothing told the target question to redirect). A
part declares no `passage` of its own, so whatever `property` is named next, the ruling can never
cohere: `effects.ts`'s own `(open/close) === (property === "passage")` check (added at §12.2, doing
exactly its job) refuses it every time.

**The fix is structural, not another prompt sentence** -- the same choice §18.8 made over the
"EARLIER RULINGS" block, for the same reason: a second sentence begging the model to remember the
first is one more thing to fail statistically, when the pairing is already known data. `world.ts`
already has it (`OpenExit.part`: `window` names `bar`, `door` names `lock`); nothing has ever read it
except `leave`'s own exits lookup. `effects.ts`'s `planEffect` now resolves the way-out id itself
before doing anything else for `open`/`close`: the target if it already names a way out, or the way
out that declares this target as its `part` if it doesn't. Once resolved, the property this effect
ever acts on is `passage` **on the resolved way out** -- never whatever property key the referee
separately answered, exactly as `leave` already ignores it. A target that is neither a way out nor a
declared part of one (a spoon, a bucket) still plans nothing: "no invented world" is unchanged, it is
only which object counts as *the* way out that is no longer left to the referee's own aim.

**Checked against the live referee, not just the unit tests** (temporary script, not committed): the
two recorded intents that produced the two broken rulings were re-asked of the same referee model
(`qwen2.5:14b`) that answered them originally, then run through the corrected `planEffect`. The
referee gave the identical answers both times (`bar`/`open`/`integrity`, `lock`/`open`/`integrity`) --
this was never going to be fixed by a friendlier prompt, the model's own answer did not change -- and
the corrected code resolved each to the right exit's `passage` resource and flipped it, through a full
`resolve()`, not just a plan object: the bar's intent opened the window, the lock's intent opened the
door.

**This reverses part of §17.2's own rule**, on purpose: §17.2 chose to make the referee do the
retargeting and `leaving.test.ts` tested exactly that choice (*"open, close and leave target the way
out itself: aimed at its part they do nothing"*). Two real games later, that choice is the confirmed
reason `open` has a 0-for-2 record. `open`/`close` are corrected here; **`leave` is left alone, one
variable at a time** -- no real game has produced a `leave` ruling at all yet, mistargeted or not, so
there is no evidence it needs the same treatment, only a suspicion it might; that stays open for a
later step if a real game ever surfaces it.

## 20. Candidates before intent: `mother-of-invention#1`'s "iterate" half, driven here first (2026-09-15)

The owner's idea, filed as
[`mother-of-invention#1`](https://github.com/JavaDerek/mother-of-invention/issues/1): a mind asked
to enumerate several concrete things it could try, before committing to one, sometimes reaches an
idea a single greedy answer would not have. The issue leaves two things undecided -- whether
"iterate" needs grounding beyond a bare instruction, and whether "pick" (choosing among candidates,
biased against what an observer has already witnessed) belongs in the package at all. Per that
issue's own note and root `CLAUDE.md`'s "before mirroring a constant, check whether the other side
already publishes it" lesson generalised the other way -- **build the real caller first, let it
shape what a package commits to** -- "iterate" landed here, in this repository's own `src/open/`,
not in `mother-of-invention`.

**Ungrounded, it is noise.** Asked cold ("a warden needs to catch a prisoner breaking out of their
cell, list tactics") with no object list, `qwen2.5:14b` returned cameras, guard dogs, drones and
informants -- fluent prison-fiction, useless against a referee that can only rule on the eleven
objects this cell actually declares. **Grounded, it is clean.** Given the same object descriptions
and state-based rules the wits prompt already sends, the same model returned five candidates, each a
real action on a real object -- and one, *"observe Voss's movements and behavior,"* a genuinely
different kind of move (behavioral, not object-directed) nothing in this game's history had tried.

### 20.1 What was built

`buildOpenWitsPrompt` and `buildOpenSingleCallPrompt` (`src/open/mind.ts`) now require a `candidates`
field -- 2 to 5 `{text, reason}` entries, each "grounded only in what you can currently reach or
perceive," generated before `intent` (schema property order is generation order, as elsewhere in this
codebase). `OpenProposal` carries them through; `checkpointTranscript.ts` renders them for audit and
the fog audit (§5.1) covers them exactly like `thoughts`/`plan`/`notes` -- a candidate considered but
not acted on is still private until said aloud. Malformed or missing candidates never fail the turn;
exact-duplicate text collapses to one, kept first, the same "same text only" rule
`mother-of-invention`'s own ledger uses for what counts as a repeat. Nothing here crosses candidates
against the precedent ledger -- that is "pick," left untouched on purpose.

### 20.2 The first live game (`checkpoints/2026-09-15T17-53-24-592Z.md`)

Same models and precedent ledger as §18.9 (`qwen3:14b` wits, `ancient-awakening:12b` voice,
`qwen2.5:14b` referee, 17 earlier episodes). Result: **caught at round 8** -- earlier than most prior
games' round-12 timeouts.

- **Iterate held up under real, repeated decoding, not just one sample.** All 15 turns produced valid,
  grounded candidate lists; zero schema failures, zero anachronisms across every list. Alternatives
  that went unchosen: the warden considered *"observe Voss's posture for signs of planning"* and
  *"listen for sounds from the window bars"*; the prisoner considered mixing tile grit with bucket
  water into an abrasive slurry and unravelling the blanket's loose thread. None of these exist
  anywhere in this game's history before today.
- **Pick reproduced §11's confound exactly.** The prisoner chose bar work in 6 of 7 turns despite the
  candidate list naming 2-4 alternatives every single time. Novel (object, effect) pairs this game:
  **0** -- identical to every baseline since §10.3. Listing an option a mind does not act on changes
  nothing about what it does, exactly as precedent-as-flavour-text changed nothing in §11.1.
- **One real, partial change, warden side only.** The warden broke from examining the bar twice
  (round 4: the loose tile; round 7: searching the loose tile) against 12 of 12 in §18.9's
  immediately preceding game. Too small a sample to call a trend, but it is the first time in this
  game's history the warden's own move has varied at all.

### 20.3 What is still open

Exactly what §20 set out to answer, no more: iterate is real, grounded, reusable engineering,
proven with a real caller before `mother-of-invention` commits to a shape for it. Pick -- forcing a
choice biased against `seenBefore`, or costing a known one explicitly -- is untouched, reproduces the
same failure §11 already named, and is deliberately left for a later step.

## 21. Pick: forced turns away from what the warden has seen (owner's decision, 2026-09-15, designed before a live game)

§20.2 showed listing alternatives does not change the choice; §11.4 showed a stated cost does not
either. The owner chose a **partial, declared force**: a consequence was already tried, so this step
tests whether actually doing an unseen thing changes anything, while keeping half the turns free so
the mind's own choices are still measured.

### 21.1 The mechanism

- **`src/open/pick.ts`, generic by intent** (mother-of-invention#1's "pick" half, driven here first):
  `pick(own, candidates, { force, recognise })`. The caller injects `recognise`, which returns `seen`,
  `unseen` or `unavailable` per text, because whether a text is a known approach is a judgement about
  meaning and code never makes one. On a free turn the recogniser is never called and the mind's choice
  stands. On a forced turn, a choice that is not `unseen` is replaced by the first `unseen` candidate in
  the mind's own order; with none, the mind's choice stands. Code picks among the mind's own texts and
  never writes one.
- **The recogniser is the referee itself** (`loop.ts`): each candidate is ruled (cached, no
  resolution); inapplicable is `unavailable`, so a forced turn is never spent on something impossible;
  otherwise `precedentTextFor(ruling)` against the seen list decides `seen`. A reshaping is not
  recognised (it needs the parent's kind, §14.4). Cost: up to six referee calls on a forced turn.
- **Seen means what the warden saw, in earlier games or this one** (owner's decision): the ledger's
  known approaches plus `seenAttempts(halves so far)` (`precedent.ts`, the same function `recordGame`
  now uses, so the two meanings cannot drift). The scripted demonstration without this-game sightings
  forced the same tile lift three times, the last two doing nothing. A silent attempt is never seen, so
  a forced turn can still repeat one.
- **The known-approach cost (§11.3) is unchanged**: it still reads the ledger alone. One variable.
- **Switch:** `PRISONER_PICK=even` forces even-numbered prisoner turns; unset is the baseline
  (`pickCondition.ts`). The transcript shows every forced turn's own intent and verdicts, and the
  summary splits novelty into forced and free turns. **Forced novelty is novel by construction and is
  not evidence; only free-turn novelty is.**

### 21.2 What the first live game is for

Compare against §20.2 (same models, precedent ledger now one episode longer): does the prisoner's
choice on **free** turns move off bar work once forced turns have made other things happen, and do
forced moves get ruled possible and change the world, or is necessity pointed at a room with nothing
else worth doing?

### 21.3 The first live game (`checkpoints/2026-09-15T19-18-46-428Z.md`)

Same models and settings as §20.2; precedent ledger at 18 earlier episodes; `PRISONER_PICK=even`.
Result: **timeout at round 12**; bar 47, warden suspicion 100, no catch.

- **The mechanism held up live.** 6 forced turns: 3 overridden, 1 kept an unseen own intent, 2 had
  nothing unseen to force to. All 3 overrides were ruled possible, and none was a known approach:
  scooping grit from the tile (round 2), examining the cot's springs (6), striking the bucket (8).
- **Forced moves changed nothing that matters.** The grit scoop was ruled `derive` yet made nothing
  (derived objects: 0); the springs reveal was information only; the bucket noise has no mechanical
  effect. Forced novelty 4 is by construction.
- **Free turns did not move off the bar.** Free novelty 1 is round 1's scrape misruled as `open`
  (below), not a new idea. Every free turn went at the bar or its mortar; three of six (3, 7, 11)
  brought in the tile's grit, which the mind listed as a candidate in round 1, before any forced turn,
  so this does not show the forcing carried over. Two of those were ruled impossible.
- **A gap in the rule:** with nothing unseen, a forced turn keeps the mind's own intent even when that
  is `unavailable` (round 10: ruled impossible, a wasted turn). The alternative, a seen but possible
  candidate, would pay the known-approach cost instead. Undecided.
- **Not pick, but found here:** round 1's "Scrape the rusted bar with the spoon to loosen it" was
  ruled `open` on the bar and resolved `bar_integrity: 0 -> 1` -- values that look like a passage, not
  the bar's integrity of 100 -- with "Your last attempt opened the bar." Worth checking against §19's
  redirection to the way out before the next game: it may have opened the window at round 1, unnoticed.
- The warden varied its target 3 times (lock in round 2, tile in 9 and 12; both tile turns impossible).

## 22. Plan, act, observe: a plan persists until an observation breaks it (owner's decision, 2026-09-15)

§21.3's transcript showed the prisoner's plan changing between turns with nothing observed to justify
it (rounds 5 to 8: the bar, then the spoon, then the hollow, then the window bar). The cause was
partly a bug: `plan` was asked for every turn and never shown again -- only `notes` reached the next
briefing, whatever `mind.ts`'s comment claimed. Every turn planned from nothing.

- **The plan is carried forward** (`game.ts`, in memory like news): each principal's own latest plan
  appears in its own next briefing as "Your plan, from your last turn"; a silent turn keeps the one
  before. Never the other principal's (fog audit covers it).
- **Replanning names its cause:** the prompt says this turn's intent is the next step of the plan, to
  be changed only when something observed since shows it will not work or a better one is open, and
  asks for `replanBecause` (`""` when following the plan). No code judges whether the reason holds;
  the transcript shows it and the summary counts replans among turns that had a plan to keep.
- **Both principals get it**, since the minds are shared. Pick (§21) is unchanged and off for the first
  game, so this step is measured alone; §21's rule forces single turns, which fights a plan by design,
  and is to be revisited as a force at replan time once plans are seen to hold.

For the first game: do plans hold across turns, do stated reasons point at real observations, and does
the prisoner's play become more coherent -- compared against §20.2 (same models, no pick).

### 22.1 The first game (`checkpoints/2026-09-15T19-53-39-106Z.md`)

Same models and settings as §20.2, no pick. Result: **caught at round 12**, bar 39, suspicion 100.

- **Plans held.** After two early changes (round 2: the tile dig was ruled impossible, so the cot's
  wire; round 4: grit on the bar, unannounced), the prisoner kept one plan for eight turns (rounds 4 to
  11): use the tile's grit on the bar, then a diversion with the bucket, then out by the window. It
  survived two impossible rulings on gathering grit by rephrasing the same step. Compare §21.3's
  bar-spoon-hollow-window drift. The warden's plans also held, and it varied its targets (lock, tile,
  spoon, bar), most of them ruled impossible.
- **`replanBecause` is not being used as asked.** The summary's "replanned 5 of 10" is wrong in
  meaning: four of the prisoner's five non-empty reasons say "Following the original plan...", and
  round 4's real change left it empty. The warden does the same. Code counts a non-empty string, and
  the model fills the string either way.
- **The plan never reached its later steps.** The prisoner stayed on step 1 until caught; its plan
  set "break the bar below 50" as the trigger for escaping, which is not the escape rule (§12).

## 23. Replan honestly, and pick at replan time (owner's decision, 2026-09-15)

Two changes on top of §22, measured together against §22.1 (same models, plans carried):

- **`replanned` is a boolean** the mind answers about itself, and `replanBecause` is kept only beside
  `true`. §22.1's free-text field was filled with "Following the original plan..." either way, so its
  count meant nothing. The prompt says a reworded plan is not a new one.
- **Pick moves to replan time** (`PRISONER_PICK=replan`; `even`, §21, stays available). Plans now hold
  for many turns (§22.1), so novelty is forced where a plan is chosen, not on single turns that break
  one. On a prisoner turn with a new plan (`replanned: true`, or the first plan of the game), the plan's
  first step is ruled by the referee; if it is an approach the warden has seen (earlier games or this
  one, as §21), the mind is **sent back once**, told which approach, to make a different plan. Code
  never substitutes a step, and the second answer stands whatever it is. Kept plans are never checked,
  so a plan may return to a known approach at a later step; the known-approach cost (§11.3) still applies
  there. The summary counts new plans checked, sent back, and whose first step changed.

For the first game: does the replan count now match what a reader sees, do sent-back plans start
somewhere new and still hold, and is the outcome better, worse or the same as §22.1?

### 23.1 The first game (`checkpoints/2026-09-15T20-12-07-154Z.md`)

Same models and settings as §22.1, `PRISONER_PICK=replan`. Result: **caught at round 11**, bar 47,
suspicion 100 (§22.1: caught at 12, bar 39).

- **The yes/no `replanned` works.** "Replanned 5 of 9" matches a reading of the plans: rounds 5 to 9
  each show a different plan with a reason; round 2's move from the tile to the bar was the round-1
  plan's own "if not" branch and was answered `false`. No "following my plan" reasons remain.
- **Pick at replan time made play worse.** 6 new plans checked, 3 sent back, all 3 changed first step.
  But the plan churn §22 fixed came back: a new plan every turn from round 5 to 9, against §22.1's one
  plan for eight turns. The sent-back and unfamiliar first steps were mostly ruled impossible (round 5,
  scratching the door's bolt; 6, scattering grit; 7, unravelling the blanket thread), and each
  impossible ruling triggered another replan. Round 9's send-back (from the cot's wire) answered with
  mortar work on the bar, itself seen; by rule the second answer stood. The prisoner ended back on the
  bar, and several replan reasons cite the send-back ("avoid actions Croft has already seen") rather
  than anything observed in the world.
- **Reading:** the mind will move off known approaches when made to, but the moves it finds either get
  ruled impossible or do nothing, and failure drives churn. Same conclusion as §21.3 from a different
  mechanism: the constraint is what the referee and world will let a new idea do, not the mind's
  willingness to try one.

## 24. The referee is told each object's properties; a way out opens only when its part allows it (owner's decisions, 2026-09-15)

The investigation after §23.1 classified the 24 prisoner and warden moves across §21.3, §22.1 and §23.1
that were ruled impossible or did nothing. 19 named a property the target does not declare, 17 of them
`integrity` on the loose tile (which declares only `concealment`, §15.2). Separately, §21.3's round 1
opened the window in one scrape at full bar integrity, unnoticed. Two fixes; the transcript label and
the other principal's "opens the bar" are the-prisoner#6, and material acting on another object is a
case on #5.

### 24.1 What changed

- **The property question lists each perceived object's own properties** ("bar: integrity;
  loose_tile: concealment; bucket: none") and says to name only one the target has, and that
  concealment is the property for what may be hidden in or beneath something. The keys offered are
  still the same four for every target, because the target is answered in the same request. A world
  that has derived objects lists theirs (`declaredPropertyKeys`).
- **A way out may declare a threshold on its part** (`OpenExit.openWhenPartAtMost`). The window's is
  the bar at or below 50, the line a catch already treats as visibly compromised; the door has none,
  since its own description grounds pushing the bolt back through the gap. `OPEN_PASSAGE` replaces the
  `OPEN_RESTORE`/`OPEN_WEAR` pair for open and close, and an open that the part does not yet allow
  changes nothing and returns `opened: false`. The threshold applies whichever object the referee named,
  window or bar. The actor's own outcome now names the way out ("met the window shut: it will not open
  yet", "opened the window"), which is half of #6.

### 24.2 Checked against the live referee before any game

Every recorded intent from the three games (67) was re-ruled once with the new prompt against
`qwen2.5:14b` (temporary script, not committed), then planned against a fresh world:

- **No loose-tile ruling names `integrity` any more.** 10 moves that failed now do something; 42 that
  worked still do; 14 still fail; 1 that worked now fails.
- **The 10:** six examinations or digs at the tile (both principals) now resolve as `reveal`
  concealment, which is what they were. Four were attempts to **gather grit**, and they now resolve as a
  look or a wear on the tile's concealment: something happens, but not the gathering.
- **Grit still cannot be gathered.** The three rulings that got `derive`/`grit` now name `concealment`
  where the property should be `none` (grit takes nothing from the tile), so the plan is still refused.
- **The one that broke:** "Strike the bucket with the spoon" was `noise` with a (wrong) `integrity`;
  it is now `noise` with `none`, as the list says, and noise still requires a grounding citation on
  that answer.
- **Changed meaning while still working, 4:** round 1's scrape "to loosen" is now `wear`, not `open`
  (correct); two "apply grit to the bar" became `reveal` of the bar instead of `wear` (wrong); one
  retargeted the bar work onto the tile's concealment.
- **Unchanged referee omissions:** the three blank targets (the lock, the bar's mortar, the blanket
  thread) and the grit-scatter blank effect stay blank; two tile examinations lost their target and
  two their effect.

## 25. What a derive consumes is the kind's; an answer of none still cites (2026-09-15)

§24.2's two remaining failures, fixed the way each allowed:

- **Grit:** the three `derive`/`grit` rulings named `concealment`, and `planDerive` refused any property
  answer other than what the kind consumes. What comes away is now the kind's own declaration
  (`consumes`), never the referee's separate answer, the same choice §19 made for a way out's passage;
  the answer's description citation still grounds the derive (§13.1). This also means a reshape or a
  wire ruled with a mismatched property now resolves, where it was refused.
- **Noise:** the bucket's property came back as the safe default with no citation at all, so the
  fix could not be code without allowing an ungrounded ruling (§2 invariant 3). The property question
  now says an answer of none still needs the description words that make the effect possible.

Re-ruled live (`qwen2.5:14b`): the bucket strike works again, and all three grit gatherings now make
grit. "Scoop dry grit from the loose tile into the hollow" is still ruled a `reveal`, a look rather than
the gathering.

### 25.1 The first game after §24 and §25 (`checkpoints/2026-09-15T21-35-43-447Z.md`)

Same models and settings as §22.1, no pick. Result: **caught at round 7**, bar 47, suspicion 100.

- **Ruled impossible: 2 of 13** (§22.1: 9 of 22; §23.1: 6 of 21). **The prisoner had none.** Both
  impossible rulings were the warden's, and both were the referee leaving the effect blank ("Examine
  the bar's integrity closely", "Examine the wire's kink closely"), not a property mismatch.
- **Examining the tile works:** round 1 revealed its concealment. The prisoner read "concealment is 100"
  as "no hidden resources" and replanned, which is a misreading (100 is the hollow still covered), but
  a reason drawn from a real outcome.
- **The first made object used in a plan:** round 2 derived a wire from the cot, and rounds 3 to 6 wore
  the bar with it (100 to 47), one plan held throughout. The wire changed nothing about the wear: it
  resolved exactly as the spoon does (#5).
- **The window threshold met the catch line.** The prisoner's plan was to wear the bar below 50 "then
  attempt removal". Round 6 reached 47, which is what makes the window openable (§24) and also what lets
  a warden examination at suspicion 100 end the game. The warden moves first, examined the bar in round
  7, and caught her before she could act. As set, escaping through the window needs two consecutive
  warden turns that do not examine the bar once it is at or below 50.

## 26. Can escape be done at all? A passive warden (owner's decision, 2026-09-15)

§5.3's "both endings still reachable" mixes two questions. Whether escape **can be done** is about the
world, the referee and the prisoner's reasoning; whether it can be done **against a competent warden**
is balance, and a constant, competent watch could make it realistically impossible. The owner's framing
settles which matters: this repository is a test harness for `mind-seam` and `mother-of-invention`, not
a game to balance. So the criterion splits:

- **1a, escape is possible:** in a live game with a passive warden, the prisoner escapes within a
  generous number of rounds.
- **1b, a catch is possible:** already shown live (§22.1, §23.1, §25.1).
- Escape rate against the model warden is not a goal.

`PRISONER_WARDEN=passive` (`src/open/passiveWarden.ts`) gives the warden a mind that attempts nothing:
each warden half-round is silent, with no model call and no referee call. The prisoner's briefing,
the referee, the rules and the models are unchanged. A passive game is run against a **copy** of the
precedent ledger, so the prisoner sees the same precedents while the shared ledger records nothing a
passive warden "saw".

### 26.1 The first passive game (`checkpoints/2026-09-15T21-48-08-804Z.md`)

20 rounds, passive warden, pick off, models as §22.1, precedent ledger copied. Result: **timeout at
round 20. The prisoner never tried to leave.**

- **The route out was open for the last six rounds.** The bar reached 0 in round 15, which makes the
  window passable (§12). Round 19's "lever the bar out of the window frame" was ruled `open` and the
  prisoner was told "Your last attempt opened the window." No attempt was ruled impossible all game.
  So the rules and the referee permit escape. This is not what stopped her.
- **The descriptions told her one bar is not enough.** The window is "barred by five vertical iron
  bars" and the bar is "One of five vertical iron bars"; the world models that one bar as the whole
  obstacle. From round 16 her plans are "remove another bar ... once enough bars are removed, escape
  through the window", three turns in a row of wear on a bar already at 0. Her reasoning followed the
  text; the text and the mechanism disagree.
- **No outcome says the way out is passable.** Round 15 was told "its integrity went from 2 to 0", and
  nothing in any briefing says the window can now be climbed through. Round 19's "opened the window" came
  after four turns of believing more bars stood between her and it, and round 20, the last, went to
  "another bar".
- Smaller: `replanned` was false for all 19 turns while the plan visibly moved (wedge, then distraction,
  then more bars), so the mind's own yes/no also under-reports; "throw the loose tile into the bucket"
  was ruled `conceal` on the tile; the gate (§24) correctly refused two opens at bar 77.

## 27. The descriptions say one bar; a part worn through is told as the way out (owner's decision, 2026-09-15)

§26.1's cause: the owner-approved §4.1/§17.1 text said the window was "barred by five vertical iron bars"
and the bar was "One of five", while the world has always modelled that one bar as the whole obstacle
(§12: the window is passable when its passage is open or the bar's integrity is 0). A model reasons
from the text, so with the bar at 0 the prisoner went on to "remove another bar". The owner chose both
fixes:

- **The descriptions now say what the world models.** Window: *"A small window high in the wall, a
  little wider than a person's shoulders. Iron bars cross it, and a single rusted bar closes its widest
  gap: with that bar gone, a person could climb through."* Bar: *"The iron bar that closes the widest
  gap in the cell's small window, about as thick as a thumb. Rust has pitted it near the bottom, where it
  is set into old mortar that is dry and cracked."* The rust sentence the referee has always cited is
  unchanged; its word positions move by two. Games before this section were played against the old text.
- **A wear that takes a way out's part to its minimum says so as the way out**: "Your last attempt worked
  on the bar: its integrity went from 5 to 0. The window can be climbed through now." (`EffectPlan.frees`,
  set from `world.ts`'s part pairing, never from prose.)

The general lesson, that a description implying more of something than the world models misleads a
model into planning for what is not there, is added to run-dmcp's `docs/AUTHORING-GUIDE.md` in that
repository's neutral vocabulary, per this repository's CLAUDE.md.

### 27.1 The second passive game (`checkpoints/2026-09-15T22-07-56-761Z.md`)

Settings as §26.1, with §27's descriptions and outcome line. Result: **timeout at round 20. The window
was passable from round 10; she never tried to climb through.**

- **Round 10's pry opened the window** (bar 24, under §24's threshold) and she was told "Your last
  attempt opened the window." Rounds 11 to 19 went to prying the bar further, nine times, each told only
  "The window was already open." Her plan throughout: "1. Finish removing the bar with the spoon.
  2. Climb through the window." Round 20 wore the bar to 0 and got §27's "The window can be climbed
  through now", on the last turn.
- **Cause: this document's own two changes disagree.** §27 says a person can climb through "with that
  bar gone". §24 lets a pry open the window while the bar still stands (at or below 50), and the
  outcome for that says the window opened, never that the bar is out of the way. From her side the bar
  was still there, so step 1 was not done, so step 2 never came. §27's second lesson ("say the new
  action, not the changed number") was applied to wear reaching 0 and not to open, which is the other
  way the same window becomes passable.
- Plans held (18 of 19 kept) and nothing was ruled impossible, so everything short of the last step
  worked.

## 28. A window opened through its bar is told as the bar out of the way (owner's decision, 2026-09-15)

§27.1's fix, wording only; the rules are unchanged. When `open` resolves on a way out that has a
threshold on its part (§24: today, the window and its bar), the actor is told the part came free and the
new action: "Your last attempt worked the bar free of the window: the window can be climbed through now."
Once open, every further open says "The bar is already free of the window: the window can be climbed
through now." (`OPEN_PASSAGE`'s result carries `freedPart`, from `world.ts`'s pairing.) The door, whose
lock does not close its gap, is still told "opened the door". The bar's own integrity is not changed by
the open, so what a warden examination finds is as before.

### 28.1 The third passive game (`checkpoints/2026-09-15T22-21-27-688Z.md`)

Settings as §27.1, with §28's wording. Result: **timeout at round 20, one step short.**

- **She understood the window was open and planned to go through it.** Round 13's outcome said "The
  window can be climbed through now"; round 14 replanned "because ... now the window is open"; round 19
  was told "worked the bar free of the window: the window can be climbed through now"; round 20, the
  last, was "Climb onto the cot to reach the window", with the plan "1. Use the cot as a step to climb
  to the window. 2. Climb through the window to escape."
- **Cause: "high in the wall".** The window's description says it is high, and nothing in the world
  models height or reach: leaving needs only a passable way out. So from round 14 she spent turns making
  the cot a step ("weaken the cot's bolts to enable movement", ruled impossible) and the final turn
  climbing onto it (ruled `open` on the window, already open). The same lesson as §27, a second time: a
  description claimed something the world does not model, and a model planned around it.
- **A misruling helped her.** Rounds 13 and 17, "Work a piece loose from the cot's frame" and "...from
  the cot's wire", were ruled `wear` on the **bar**, with verified citations (a target citation only has
  to be words from the intent, not the object's name). Round 13's took the bar from 9 to 0. Code cannot
  catch this (§10.6); it is recorded, not fixed.

## 29. The window is within reach (owner's decision, 2026-09-15)

§28.1's cause, fixed as §27 fixed the bar count: nothing in the world models height or reach, so the
window's description no longer claims it. Window: *"A small window set in the wall at shoulder height,
a little wider than a person's shoulders. Iron bars cross it, and a single rusted bar closes its widest
gap: with that bar gone, a person could climb through."* The next passive game runs 30 rounds rather
than 20: wearing the bar through takes about nine, and §28.1 ran out of rounds one step short.

### 29.1 The fourth passive game (`checkpoints/2026-09-15T22-35-11-786Z.md`): the last mile is `leave`

30 rounds, settings as §28.1, with §29's description. Result: **timeout at round 30. She tried to climb
out seven times and the referee never once ruled it.**

- **Everything up to the last step worked.** The bar reached 0 in round 12 and she was told the window
  can be climbed through; §29's rewording did its job (no more turns spent making the cot a step after
  round 20).
- **Rounds 21, 23, 24, 25, 26, 28 and 30 were "Climb through the window"** and variations. Every one was
  answered `target: none` -- **the referee offered no target at all**, so the safe default stood -- with
  `effect: open`, never `leave`. The outcome she was given each time was either "the bar is already free
  of the window" or "reached past what is here", while the window stood open beside her.
- **`leave` has still never been ruled in any real game** (§19 noted it then; this transcript contains
  zero `leave` answers).
- Two questions are failing at once, and it is §19's shape a third time: the effect question's own prompt
  says open/close/leave target the way out, and the **target** question's prompt says only "which object
  does the actor's intent act on" -- going out through a window acts on nothing, so the model answers
  nothing; and going through an already-open way out reads to it as `open` rather than `leave`.

## 30. Why `leave` had never been ruled: a short intent cannot be cited (2026-09-15)

§29.1's seven attempts to climb out were not a reasoning failure and not, in the end, a prompt failure.
Asked again, the referee's raw answer names the window: `{"questionId":"target","answerKey":"window",
"citation":{"sourceId":"intent","from":3,"to":7}}` — on an intent of **four** words. `rebuildRanged`
(`refereeTransport.ts`, §18.1) dropped any range with `to` past the last word, so the answer lost its
citation, fell to the safe default `none`, and the transcript recorded "no offer for target" against an
object the referee had in fact named. Going out through a way out is the shortest intent a mind ever
writes, which is why `leave` bore the whole cost and had never once been ruled in a real game.

- **The span now ends where the source does.** A range whose `from` is a real word and whose `to` runs
  past the end is clamped to the last word; a `from` past the end is still no citation. The quote stays a
  verbatim substring, and the transcript shows the range used.
- **Two prompt sentences** were added first (target: "an intent that goes out through a way out acts on
  that way out: name it, never none"; effect: "going out through a way out is leave, even when it already
  stands open"). Alone they fixed nothing — re-ruled live, round 21 came back identical — but with the
  clamp the effect sentence shows: three of the seven now rule `leave`, where every one before was `open`.
- **Re-ruled live, the seven climb-outs:** all seven now name the window (4 fixed, 3 unchanged), 3 as
  `leave`. The one ruling the prompt sentences had broken (a dig at the tile's hollow) is back.

### 30.1 She escaped (`checkpoints/2026-09-15T23-00-39-402Z.md`)

30 rounds, passive warden, settings as §29.1, with §30's clamp. **Escape at round 16**, the first in any
real game of this variant. §5.3's criterion 1a, as split in §26, is met live.

- **The route:** round 2 worked a handful of grit loose from the tile; rounds 3 to 11 wore the bar from
  100 to 9 with the grit; round 12's pry worked the bar free ("the window can be climbed through now");
  rounds 13 to 16 tried to climb out, and round 16 was ruled `leave` -- "You are out of the cell, through
  the window."
- **Nothing was ruled impossible all game**, every applied effect carried verified citations, and the fog
  audit is clean. One replan in fifteen turns.
- **`leave` is still the flakiest ruling:** rounds 13, 14 and 15 were the same act in different words and
  came back `open` on an already-open window; the fourth phrasing got `leave`. Escape took four attempts
  once the way was open, which is worth watching in the next games rather than fixing blind.
- The derive of grit (§25) and the descriptions (§27, §29) all appear in the winning line; every fix
  since §24 is load-bearing in it.

## 31. The scorecard batch: §5.3 holds, on games that end at round six (2026-09-16)

Three games on one model configuration, the first batch run against §5.3 as a batch rather than as a
by-product of a fix. Settings: `qwen3:14b` wits, `ancient-awakening:12b` voice, `qwen2.5:14b` referee
at `http://doris:11434/v1`; 30 rounds; **model warden** (the passive warden of §26 having answered its
own question at §30.1); pick OFF; precedent ON, each game against its own copy of one frozen
22-episode, 111-account snapshot, so all three start from identical conditions and none writes to the
shared ledger. Transcripts `checkpoints/2026-09-16T00-25-17-171Z.md`, `…00-31-06-953Z.md`,
`…00-36-55-951Z.md`, each with its `.referee.json`; the replay reports are
`checkpoints/2026-09-16-open-referee-replay-batchA-game{1,2,3}-N5.txt`.

| | Game 1 | Game 2 | Game 3 |
|---|---|---|---|
| Result | caught, round 6 | caught, round 6 | caught, round 7 |
| Intents / silences | 11 / 0 | 11 / 0 | 13 / 0 |
| Ruled impossible | 0 | 0 | 1 |
| Novel `(object, effect)` pairs | 1 | 2 | 4 |
| Applied effects fully cited | 11 of 11 | 11 of 11 | 12 of 12 |
| Fog audit | 0 leaks / 11 | 0 leaks / 11 | 0 leaks / 13 |
| Replay agreement, N=5 | 99.7% | 99.4% | 99.5% |

### 31.1 Against §5.3

| | Criterion | Result |
|---|---|---|
| 1 | Zero §2 violations | **Met.** 35 contexts audited, 0 leaks; all 34 applied effects carry every required citation; 0 silences, 0 refusals. |
| 2 | A closed-inexpressible attempt ruled possible in ≥ 2 games, and one ruled impossible with its positive reason | **Met, for the first time.** Novelty is non-zero in all three games (1, 2, 4), where §10.2 and §13.8 both read zero or one. Game 3 round 6's warden was ruled impossible and told the window's own description back. |
| 3 | Referee key agreement ≥ 80% on replay | **Met.** 99.7%, 99.4%, 99.5%, N=5, §10.5's caveats unchanged. |
| 1a | Escape is possible | Met live at §30.1. |
| 1b | A catch is possible | Met three more times. |

**§5.3 holds.** The attack move (issue #1), which §5.3's last line gates, is unblocked. Two things
should be read alongside that before it is treated as a finished result.

**The novelty is thin, and one of it is a misruling.** Most of the novel pairs are the warden
examining an object the closed list has no move for -- the cot's crossbar, the tile's hollow. Only one
is invention: game 1 round 2's *"Strike the bucket with the spoon to create a noise"*, grounded on the
bucket's *"It rings sharply when anything strikes it"*. And game 3's count of four includes round 4's
*"Use the grit from the loose tile on the bar"*, ruled `derive loose_tile.concealment` where rounds 3,
5 and 6 of the same game ruled the same act `wear bar.integrity`. That is referee inconsistency being
counted as novelty. **Identical-request replay cannot see it** -- the same game scores 99.5% -- which
is §10.7 item 3 asking again to be answered, and §10.3's doubt about the measure surviving intact.

**The citation bottleneck is gone.** §10.4 called citation mechanics *"the main thing standing between
O1 and a contested game"*, with the warden ruled impossible in 8 of 16 turns. This batch: **1 impossible
ruling in 35 intents**, and it was a genuine judgement (mortar the window's description does not
mention), not a rejected offer. §18's word ranges, §24's property briefing and §30's clamp between
them closed it.

### 31.2 What the games did not reach

> **Corrected at §33 (2026-09-16):** the arithmetic below is wrong. Suspicion 100 is a ceiling, not the catch threshold, and batch C ended at the same rounds with precedent off. The catch is a warden look finding the bar at 50 or below with suspicion at 40 or above (§33.1, §33.3). The quotations and the "did not reach" facts stand.

All three end at round 6 or 7, with almost no variance, and the mechanism is arithmetic:
*"A prisoner works at the bar"* stands on the warden's on-sight list at 76 sightings across 19
episodes, so the bar costs +30 suspicion however quietly it is worked, and the threshold is 100. Three
or four bar turns is the whole game.

She knows it. Game 2's notes: *"keep suspicion below 40"*. Game 3's thoughts, round 5: *"raises
suspicion to 40, which is dangerous. However, with the window's bar as the only viable escape route,
the risk seems necessary."* The reasoning is correct and there is nowhere for it to go.

So **none of §24 through §30 ran.** `leave` was never ruled; the window never opened; the banknotes
(§15) were found by neither side in any of the six games this document now records. §30.1's escape
needed sixteen rounds. The contested game is over at six.

## 32. Pick against the baseline: the mechanism works, the candidates do not (2026-09-16)

§31.2 read as §11 and §21's diagnosis in sharper form, so the batch was repeated changing exactly one
thing: `PRISONER_PICK=even` (§21), same frozen ledger snapshot, same models, same 30 rounds, same model
warden. Transcripts `checkpoints/2026-09-16T01-27-14-155Z.md`, `…01-33-18-443Z.md`, `…01-40-19-632Z.md`.

| | Baseline (§31) | Pick=even |
|---|---|---|
| Caught at round | 6, 6, 7 | 6, 7, 8 |
| Intents | 11, 11, 13 | 11, 13, 15 |
| Novel pairs | 1, 2, 4 | 2, 2, 2 |
| Ruled impossible | 0, 0, 1 | 0, 0, 0 |
| Applied effects fully cited | 34 of 34 | 39 of 39 |
| Fog audit | 0 leaks / 35 | 0 leaks / 39 |

One extra round on average, and §5.1 holds again across the batch. **The prediction that pick would buy
enough rounds to reach the window is wrong**, and the reason is worth more than the prediction was.

### 32.1 Pick almost never had anything to pick

Across the three games pick forced 8 prisoner turns and **overrode the mind on 2 of them**. The
transcript's line for the other six is *"nothing unseen to force to."* Game 2's report is the plainest:
`Forced prisoner turns: 3 (overridden 0, nothing unseen to force to 3)`.

Game 2 round 2, a forced turn, is the whole finding in one exchange -- the three candidates the mind
generated, and what pick found when it looked at them:

```
- Use the spoon to carefully scrape rust off the bar's bottom
- Use the spoon to loosen the bar's mortar
- Examine the loose tile for hidden tools or materials
Forced pick: kept the mind's own intent.
- seen: Use the spoon to carefully scrape rust off the bar's bottom
- seen: Use the spoon to loosen the bar's mortar
- seen: Examine the loose tile for hidden tools or materials
```

`seen`, `seen`, `seen`. **Pick is downstream of candidate generation, and candidate generation is where
the novelty is lost.** §20.2 found that listing alternatives does not change the choice; this is the
harder version -- the alternatives are not alternatives, but three rewordings of one idea. A mechanism
that biases against `seenBefore` cannot function on a candidate set with nothing unseen in it.

### 32.2 Where it did fire, it worked

Both overrides landed on forced turns, and forced turns out-produced free turns on novelty **2 to 0**
(game 1: forced Novel 1, free Novel 0; game 3 the same; game 2, which overrode nothing, scored 0 on
both). Game 1's override is what produced *"Tap the loose tile to create a noise"*, and the one
genuinely inventive act in the baseline batch -- game 1's bucket-tap -- has the same shape.

Two data points is not a result. But the failure here is **not pick's logic**, and that distinction is
exactly what `mother-of-invention#1` needs before the package commits to a shape: a pick mechanism
ported as-is would inherit a dependency nobody has stated, on candidates that actually differ. §20's
insistence on proving a mechanism against a real caller first is what produced this; it is not visible
from the package side.

### 32.3 There is only one verb in the room

Six games, 74 intents, a referee agreeing with itself 99.5% of the time, and the prisoner's entire
repertoire is abrading a bar. The natural next question -- can she ever do something *social*: fake an
illness, bribe the warden with the money under the tile, talk her way out -- has a structural answer,
in three places, and none of them is the referee's accuracy:

1. **Presence is not modelled**, so the warden cannot be made to watch, or to look away. §9.3 excluded
   it knowingly: *"nothing in §4.1's object table currently says where the warden physically is"*, and
   every non-silent prisoner effect is treated as potentially noticed. Being watched is not a state she
   can act on; it is the permanent condition, and §31.2 is what it costs. *(Corrected at §33: §31.2
   names the wrong cost. What ends the contested game is the warden seeing the bar at 50 or below, the
   same value that opens the window. The structural point about presence stands.)*
2. **A principal is not a target.** The target answer keys are the perceived **objects** plus `none`
   (`referee.ts`, §24). Croft is not among them, so an intent aimed at a person resolves to `none`,
   meets the safe default, and is ruled impossible -- correctly, by a reader doing its job.
3. **No effect names a belief.** The eleven kinds are `wear, restore, reveal, conceal, expose, noise,
   open, close, leave, derive, none`. Deception's entire payload is a false belief in an observer, and
   the closed vocabulary has nowhere to put it. The referee's only options are `none` or a misruling
   onto whatever object is nearest -- which is precisely the failure §31.1 already found in game 3.

Issue #5 states the general case for the money (*"not blocked by the engine, only by the referee having
no word for it"*); deception is the same shape one step further out, and the engine's `IntendedChange`
is not the constraint in either.

**What the closest approach looks like.** Game 1's bucket-tap is a prisoner reaching for the warden's
attention *through an object*, because an object is the only thing she is permitted to touch. It is a
diversion staged with the props to hand, and it came from a forced pick. The instinct is present in the
model and has nowhere to land.

**The owner's read, recorded here for the decision it points at:** the scorecard passing and the games
being uninteresting are the same fact. What §5.3 measures is whether the machinery is honest, and it
now is -- citations verified, fog clean, the referee consistent, escape and catch both live. What it
does not measure is whether the room has more than one verb in it. Issue #5's play mode and issue #3's
generated scenarios are no longer "later, for enjoyment": they are where the next real finding is,
because the benchmark's own bottleneck has moved from the referee to the world it rules on.

## 33. Six overnight games: §31.2's diagnosis is wrong, and the catch is the bar crossing 50 (2026-09-16)

Two batches of three, run unattended overnight (`~/rpg/overnight/prisoner-queue.sh`), each changing
one thing from §31. Models, rounds and ancient-awakening voice unchanged: `qwen3:14b` wits,
`ancient-awakening:12b` voice, `qwen2.5:14b` referee, 30 rounds, pick OFF.

- **Batch C, precedent OFF, model warden.** Queued to measure how much of §31.2's round-six catch comes
  from precedent's +30 on sight. Transcripts `checkpoints/2026-09-16T02-38-18-453Z.md`,
  `…02-47-35-821Z.md`, `…02-51-51-723Z.md`.
- **Batch D, passive warden (§26), precedent ON.** Each game gets its own frozen copy of the same
  22-episode ledger §31 used; nothing is written back. Queued to watch `leave` after §30.1 needed
  four phrasings. Transcripts `…02-57-03-181Z.md`, `…03-02-00-241Z.md`, `…03-07-14-995Z.md`.

All six ran before `ea2feac`/`771bc73`/`04eb17e` landed, so their transcripts carry the old #6
resource label and the old #8 plan-null line. No replay was run for either batch.

| | C1 | C2 | C3 | D1 | D2 | D3 |
|---|---|---|---|---|---|---|
| Result | caught r6 | caught r5 | caught r6 | **escaped r9** | **escaped r10** | **escaped r23** |
| Bar at end | 32 | 40 | 47 | 47 | 17 | 0 |
| Warden suspicion at end | 79 | 69 | **45** | 100 | 100 | 100 |
| Prisoner intents | 5 | 4 | 5 | 9 | 10 | 23 |
| Ruled impossible | 1 (warden) | 0 | 0 | 0 | 0 | 0 |
| Novel pairs | 2 | 2 | 1 | 5 | 3 | 10 |
| Applied effects fully cited | 10 / 10 | 9 / 9 | 11 / 11 | 9 / 9 | 10 / 10 | 22 / 22 |
| Fog audit | 0 / 11 | 0 / 9 | 0 / 11 | 0 / 18 | 0 / 20 | 0 / 46 |
| Banknotes found | never | never | never | never | never | never |

§5.1 holds in all six games: every applied effect is cited and the fog audit finds 0 leaks.

### 33.1 What the code says ends a contested game

`checkOpenCatch` (`src/open/gameEnd.ts`) runs only right after a **warden** `reveal`, and it catches
only when two things are true at once:

1. `warden_suspicion` ≥ `SEARCH_SUSPICION_THRESHOLD` = **40**, and
2. the reveal was of `bar.integrity` and found it ≤ `SEARCH_CATCH_BAR_MAX` = **50** (the lock and spoon
   have their own thresholds; no game here came near them).

Suspicion is clamped at 100 (`loop.ts`, `max: 100`). **100 is a ceiling, never a threshold.** §31.2's
*"the threshold is 100"* does not match the code. Suspicion rises three ways:

- a prisoner's non-silent wear, restore, expose, open, leave or derive: +5 slight, +10 moderate,
  +30 substantial;
- a known approach, under precedent only: +30;
- **a warden `reveal` that finds a value below the warden's own last belief: +(drop ÷ 2), rounded down,
  applied inside the same half-round, before the catch check.**

The window's `open` has its own gate, `OPEN_WINDOW_BAR_MAX`, and `src/open/world.ts:79` defines it as
`= SEARCH_CATCH_BAR_MAX`. They are the same constant. **The bar becomes catchable at the same moment the
window can be opened.** (An earlier note said escape means wearing the bar to 0. D1 escaped with the bar
at 47.)

The rules text in `src/open/mind.ts` states both thresholds and the evidence rule, and the prisoner
reasons from it. D3's
thoughts in round 9: *"since it's still above 50, it's safe."*

### 33.2 Batch C, round by round

Suspicion is the live value in the warden's briefing at the start of each round (the warden turn comes
first). ⟶ marks the prisoner's wear that takes the bar to 50 or below.

**C1**, caught r6:

| r | Warden | Prisoner | Bar after | Suspicion at r start |
|---|---|---|---|---|
| 1 | reveal bar = 100 | wear slight audible | 92 | 0 |
| 2 | reveal loose_tile | wear moderate visible | 77 | 5 |
| 3 | reveal loose_tile | wear moderate audible | 62 | 15 |
| 4 | reveal bar = 62 (+19) | ⟶ wear moderate audible | 47 | 25 |
| 5 | *"Examine the spoon edge"* ruled **impossible** (referee answered `integrity`; the spoon declares `edge`) | wear moderate visible | 32 | 54 |
| 6 | reveal bar = 32 (+15) → **caught** | | | 64 → 79 |

**C2**, caught r5:

| r | Warden | Prisoner | Bar after | Suspicion at r start |
|---|---|---|---|---|
| 1 | reveal bar = 100 | wear moderate audible | 85 | 0 |
| 2 | reveal loose_tile | wear moderate audible | 70 | 10 |
| 3 | reveal cot wire | wear moderate audible | 55 | 20 |
| 4 | reveal bar = 55 (+22) | ⟶ wear moderate audible | 40 | 30 |
| 5 | reveal bar = 40 (+7) → **caught** | | | 62 → 69 |

**C3**, caught r6:

| r | Warden | Prisoner | Bar after | Suspicion at r start |
|---|---|---|---|---|
| 1 | reveal bar = 100 | wear moderate audible | 85 | 0 |
| 2 | reveal lock | wear slight **silent** | 77 | 10 |
| 3 | reveal bar = 77 (+11) | wear moderate visible | 62 | 10 |
| 4 | reveal bar = 62 (+7) | *"Scrape additional grit from the loose tile onto the bar"* ruled wear **loose_tile**.concealment, silent | 62 | 31 |
| 5 | reveal bar = 62 (+0) | ⟶ wear moderate **silent** | 47 | 38 |
| 6 | reveal bar = 47 (+7) → **caught** | | | 38 → 45 |

Across the three games:

- **Every game ends on the warden's first bar examination after the bar goes to 50 or below.** In C2
  and C3 that is the very next warden turn. In C1 the next warden turn went to the spoon and was ruled
  impossible, and the catch came one turn later.
- In C1 and C2 suspicion was already past 40 before the catching reveal. **In C3 it was 38, below the
  threshold. The catching reveal's own evidence bump (+7) took it to 45.** Three of her five wears were
  ruled silent and added nothing. The reveal still provided the grounds for its own catch.
- The warden examined the bar in 3 of 6, 3 of 5 and 5 of 6 turns.
- The known-approach bump fired zero times: precedent was off.
- In every game the bar goes to 50 or below on the prisoner's fourth wear of it (moderate wear is −15,
  slight −8). That holds whether suspicion is at 25, 30 or 38 when it happens.

### 33.3 Batch A had already falsified it

Suspicion at the start of each warden turn in §31's batch A (precedent ON), from the same transcripts:

| | r1 | r2 | r3 | r4 | r5 | r6 | r7 | caught | bar at catch |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 0 | 40 | 77 | 100 | 100 | 100 | | r6 | 40 |
| A2 | 0 | 40 | 75 | 100 | 100 | 100 | | r6 | 39 |
| A3 | 0 | 35 | 65 | 100 | 100 | 100 | 100 | r7 | 47 |

Precedent saturated suspicion by round 4 in all three games, so the suspicion condition was met from
round 2 or 3. The games still ran to round 6 or 7, until the bar reached 50 or below.

**Precedent changed how fast suspicion rose; it did not change when the game ended.** Rounds at catch:
batch A 6, 6, 7; batch C 6, 5, 6. §31.2 read the round-six ending as precedent. The bar condition was
what held the ending back, and §31's own numbers show it.

§32's pick batch (caught 6, 7, 8) was built on §31.2's reading, so its framing inherits the error.
Its measurements, and §32.1's finding that candidates are rewordings, do not depend on it.

### 33.4 Batch D: the world is escapable, and `leave` is still phrasing-sensitive

With nobody examining the bar, all three games escaped. That means §24 through §30 all run when
nothing stops them. §31.2's *"none of §24 through §30 ran"* was true of the contested games, not of
the mechanics.

| | Bar ≤ 50 | `open` ruled on the window | `leave` ruled | Turns from ≤ 50 to out |
|---|---|---|---|---|
| D1 | r4 (47) | r5 | r9 | 5 |
| D2 | r5 (47) | r8 (wore on to 17 first) | r10 | 5 |
| D3 | r4 (47), again r11 (37) | r12 | r23 | 12 after the second crossing |

**Every escape needed a separate `open` turn and a later `leave` turn after the bar crossed 50.** That
means at least two prisoner turns after the crossing, with a warden turn before each of them.

**D3's delays, in order:**

- **r6:** *"Use the spoon to collect grit from the loose tile and apply it to the bar's rusted areas"*
  was ruled `restore bar.integrity` moderate, **47 → 97**. The referee undid three rounds of her work
  toward her own escape. §31.1 caught grit-on-bar wording being misruled as `derive loose_tile`. Across
  these six games the same wording was also ruled `wear loose_tile` (C3 r4), `reveal loose_tile` (D3 r5)
  and here `restore bar`.
- **r9:** *"Work a piece loose from the cot's crossbar wire"* was ruled `derive` with target `bar`, a
  plan-null no-op.
- **r13–r15:** with `window passage: 1` in her briefing, she kept wearing the bar 37 → 0. Her r13
  thoughts: *"I need to ensure it's fully removed."* Her r15 thoughts cite *"guard attention will drop
  to 40 next round, allowing escape"*. `checkOpenEscape` reads nothing but location (`gameEnd.ts`);
  guard attention is a closed-variant resource her briefing still shows.
- **r16:** *"Use the loose tile to create a distraction"* was ruled `noise`.
- **r19–r22:** four attempts to climb out, all ruled `open` on a window already open.

**The climb phrasings, all ten:**

| Game, round | Intent | Ruled |
|---|---|---|
| D1 r7 | Climb through the window | open |
| D1 r8 | Climb through the window | open |
| D1 r9 | Attempt to climb through the window immediately | **leave** |
| D2 r9 | Position the cot near the window to use as a step | open |
| D2 r10 | Climb out through the window using the cot as a step | **leave** |
| D3 r19 | Climb through the window | open |
| D3 r20 | Climb through the window using the cot as a step | open |
| D3 r21 | Climb through the window immediately | open |
| D3 r22 | Climb through the window | open |
| D3 r23 | Climb through the window using the cot's crossbar as a step | **leave** |

The bare *"Climb through the window"* was ruled `open` all four times it appeared. No wording mapped
reliably to `leave`:

- *"…immediately"* was `leave` in D1 and `open` in D3.
- *"…using the cot as a step"* was `leave` in D2 (*"Climb out through…"*) and `open` in D3.
- D3 r20 and r21 cited *"with that bar gone, a person could climb through"*, the span every `leave`
  ruling cited, and were still ruled `open`.

This is §30.1's watch item reproduced three times over.

**Two pairs are word-for-word repeats: D1 r7/r8 and D3 r19/r22.** In each pair the second ruling
matches the first in every key and every citation. That is what the §18.8 exact-repeat cache would
return for the same intent against the same perceived objects. The `.referee.json` sidecar logs one
entry per intent either way, so these transcripts cannot show whether the second ruling came from the
cache or from a fresh call that agreed.

Novelty in batch D (5, 3, 10) is almost entirely `open` and `leave` on the window and bar, which the
closed variant has no move for. It also includes D3's r5 (grit-on-bar ruled `reveal loose_tile`) and
r9 misrulings, counted as novel the same way §31.1's game 3 was.

### 33.5 For the owner's reading

The numbers above are the factual half. The interpretation is reserved. These are the questions the
batches put, each phrased as what happens in play:

1. **A warden who keeps looking at the bar catches her on the first look after her fourth scrape,
   however quiet she is.** The window opens at exactly the value the catch fires at, and getting out
   takes two more turns. Is that the game you want: detection and escape on one dial, set to the same
   mark? Or should the window open before the bar looks damaged, or the catch fire later?
   *This decides whether the next change is to constants in `mechanics.ts`/`world.ts`, or to issue #5
   and #3, the world.*
2. **In C3, being silent almost worked.** She reached the catching look at 38 suspicion, and the look
   itself supplied the missing points. Should finding damage be able to supply its own grounds in the
   same breath?
   *This decides whether the evidence bump stays applied before the catch check.*
3. **Is §32.3's "one verb in the room" argument unaffected?** It rested on presence, principals-as-targets
   and beliefs, not on the round-six arithmetic. As far as the six games show, those three structural
   facts stand.
   *This decides whether §32.3 needs a note, or only §31.2 does.*
4. **D3 lost thirteen rounds to the referee turning "apply grit to the bar" into repairing it,** and to
   "climb through" meaning `open`. Is the leave phrasing worth its own fix now, or does it wait behind
   question 1?

### 33.6 The owner's answers (2026-09-16)

1. **Split the line, and later give her the world: options (b) and (c).** The owner's reason: *the
   warden is outside her cell, so it is harder for him to see damage than for her to make it.* The
   window still opens at a bar of 50 (`OPEN_WINDOW_BAR_MAX`). A warden's close look now catches on the
   bar only at **30** or below, via `OPEN_CATCH_BAR_MAX` in `src/open/world.ts`, which the rules text
   both minds read now states. The closed variant's `SEARCH_CATCH_BAR_MAX` is untouched. At −15 a
   moderate scrape, the fourth scrape leaves the bar at 40: open to her and not yet visible to him.
   **The contested game becomes a test of whether she stops scraping in time.** Games before this
   change are not comparable to games after it. The number stands in for what (c) should eventually
   model, a warden whose view is limited by where he stands (§9.3, issues #5 and #3).
2. **Keep the order: finding damage raises suspicion before the catch is checked.** With the catch
   at 30, the bar is only that worn after five or six scrapes, and suspicion will almost always be
   past 40 by then. The order would rarely decide a game. Recorded, not changed.
3. **§32.3 gets a note.** Added in place after the sentence that cited §31.2 as the cost of being
   watched. The three structural points stand.
4. **Fix the referee's climb and grit rulings before any game tests (1).** (1) exists to bring her to
   an open window. A referee that reads *"Climb through the window"* as `open`, or grit on the bar as
   `restore`, would make "did not stop in time" indistinguishable from "was not allowed to leave". D3
   shows exactly that. The order is (1), then the referee, then games.

**Found while building (1): she is not told the window's line.** The rules text states the catch
thresholds but not that the window opens at 50. She learns it only when an attempt to work the bar
free succeeds (*"the window can be climbed through now"*, `perception.ts`). Before (1) that cost
nothing, since the two lines were the same. After (1) it decides what "knowing when to stop" can
mean. Awaiting the owner.

### 33.7 The referee's climb and grit rulings, tested on recorded requests (2026-09-16)

Decision 4, tested before any code. Each variant edits **one thing** in copies of the recorded
`.referee.json` requests from §33's games (plus §31's game 3 for grit) and asks `qwen2.5:14b` each
request 5 times, alongside control intents whose ruling must not move. Reports:
`checkpoints/2026-09-16-open-referee-replay-s33-*-N5.txt`.

**Baseline, unchanged requests.**
- The bare *"Climb through the window"* is `open`, 5 of 5, all four times it appears.
- *"…apply it to the bar's rusted areas"* is `restore bar.integrity`, 5 of 5.
- The pry intents (*"pry the bar out of the mortar"* and kin) are `open`, 5 of 5.
- The replay tool measures agreement among its own replays, never against the ruling the game
  recorded (§10.5's caveat). Three in-game rulings do not reproduce: D3 r20 and r21 were `open` in
  game and are `leave` 5 of 5 on replay, and D3 r5 was `reveal` in game and is `restore loose_tile`
  on replay. 24 of the 27 in-game `effect` keys reproduce.

| Variant (one change) | Misrulings fixed | Controls |
|---|---|---|
| Effect prompt: *"climbing through a window is leave, never open"*, dropping "open" from the condition | **none**: bare climb still `open` 5/5 | **broke two**: D1 r5 and D2 r8 pry went `open` → `wear` |
| Window description: *"could climb through"* → *"the gap is wide enough for a person"* | **none** | held |
| Loose tile description: *"dry, sharp grit that scours"* | **none**: D3 r6 still `restore` | **broke one**: D3 r11 strike went `wear` → `open` |
| Effect prompt: *"Restore is repair: an act whose aim is to mend, patch or strengthen something. Working a material against something to damage it is wear, even when the intent says apply."* | **D3 r6 → `wear bar`**, D3 r5 → `wear loose_tile` (no bar restore) | **held**: 6 of 6 grit and strike wears unchanged |
| Window description plus *"It stands open now: the bar is out of its widest gap."* (only on requests made while it was open) | **all 9 climbs → `leave`, 5/5 each** | **no false leave**: 8 after-open intents; pry and strike stay `open`/`wear`, and D1 r6 goes `open` → `wear` (the window was already open) |

**Built: the restore sentence** (`referee.ts`, test first). The grit misruling is gone, and it cost no
control.

**Not built: the climb.** No prompt sentence and no rewording fixes it. The referee is shown each
object's authored description and its property names, **never the property's current value**, so
§30's *"climbing through an open window is leave"* cannot apply: nothing it reads says the window is
open. Telling it fixes all nine. Whether and to whom a way out's state is told is the owner's decision
(§16 named the general form: each property declaring how its value reads in words).

### 33.8 A way out that stands open says so; finding one open catches (owner's decisions, 2026-09-16)

§33.7 left the owner three decisions, and the owner took all three recommendations:

1. **The referee and both principals are told a way out stands open.** This is §16's general form:
   a property may declare how a value reads in words (`OpenObjectProperty.reads`), and
   `computePerceivedObjects` appends that reading to the object's authored description while the
   property holds the value. It is one text, so what a principal perceives and what the referee rules
   on cannot disagree, and the exact-repeat cache (§18.8) already keys on it. Only `passage` declares
   readings: the window *"It stands open now: the bar is out of its widest gap."* (the sentence §33.7
   tested) and the door *"It stands open now."* A shut way out reads exactly as authored. Nothing
   reads integrity in words, so no number reaches a principal this way.
2. **A warden who examines a way out and finds it standing open catches**, with grounds (suspicion at
   40 or above), for the door and the window alike (`checkOpenCatch`). §33.6's catch at 30 left a
   careful prisoner uncatchable by examination: scrape to 40, work the bar free, climb out, and the bar
   never reads 30. Seeing the window open in the briefing does **not** catch by itself. He must examine
   it on the turn between her opening it and leaving, or it would be a certain catch for any open-then-
   leave escape, since he always gets exactly that one turn. His other counter, `close`, was always
   available to either principal and has never been attempted in any game.
3. **She is told the window's line.** The rules text both minds read now says *"The window can be
   opened once the bar's integrity is at or below 50."* and names the new catch.

Not decided, noted for the games: a warden who examines **the bar**, not the window, after the bar
has been worked free reads its integrity (40-ish) and does not catch.

### 33.9 Batch E: she reaches the window line and keeps scraping (2026-09-16)

Three contested games on `bd05fb5` (§33.6-§33.8), batch C's configuration: model warden, precedent
OFF, 30 rounds, voice on. Transcripts `checkpoints/2026-09-16T15-37-42-560Z.md`, `…15-44-32-498Z.md`,
`…15-55-25-854Z.md`.

| | E1 | E2 | E3 |
|---|---|---|---|
| Result | caught r7 | caught r11 | caught r8 |
| Bar at or below 50 from | r5 (40) | r9 (40) | r5 (47) |
| Turns she could open and was not yet catchable | 1 | 1 | 2 (47, 32) |
| Attempts to work the bar free | 0 | 0 | 0 |
| What she did instead | scraped 40 → 25 | struck 40 → 25 | scraped 47 → 32, struck 32 → 17 |
| Applied effects cited / fog | 13/13, 0 leaks | 20/20, 0 leaks | 15/15, 0 leaks |

§5.1 holds. The window catch (§33.8) never fired, because she never opened the window.

**What the three games show:**
- **She read the new rule correctly every time.** E1 r6: *"40 integrity, which meets the condition to
  open the window. However, the bar is still in place, so I need to remove it … further weaken it."*
  E2 r10 made the one arithmetic error: *"the bar's integrity won't drop to 30"*, one strike before 25.
- **Guard attention appeared 67 times** in the minds' thoughts, notes and plans. Nothing in the open
  variant reads it.
- **Grit ruled restore, once:** E2 r5 *"Apply grit from the loose tile to the bar's rusted areas"* went
  55 → 100, while E2 r4's *"…rusted area"* was `wear`. §33.7's sentence was tested on a different
  wording, and it is not a complete fix.

**Guard attention removed (owner's decision, `8d139f5`).** The open briefing no longer renders the
guard_attention belief, and the open rules text drops the time-decay sentence. The resource, its decay
and the shared belief seeding are untouched.

**Probe: re-asking her recorded decision (owner's decision, before any mind-side mechanism).** Covers
the four turns where she could open and was not yet catchable. Her exact wits prompt was rebuilt from
each recorded briefing, `qwen3:14b`, 5 samples per turn per arm (the voice call stubbed, since it never
reaches the referee). Each intent was read by hand for an attempt to work the bar out (pry, lever,
pull). Data `checkpoints/2026-09-16-open-prisoner-probe-s33-9-*.json`; script alongside.

| Turn | As recorded | Window *"worked free of its mortar"* for *"gone"* | Guard attention line removed (code `8d139f5`) |
|---|---|---|---|
| E1 r6 (bar 40) | 4/5 | 3/5 | 5/5 |
| E2 r10 (bar 40) | 2/5 | 3/5 | 1/5 (+1 climb through a window not yet open) |
| E3 r6 (bar 47) | 2/5 | 1/5 | 1/5 |
| E3 r7 (bar 32) | 3/5 | 3/5 | 2/5 |
| **Total** | **11/20** | **10/20** | **9/20** |

- **The window's wording is not the cause** (11 vs 10). It is unchanged.
- **At those turns she works the bar free about half the time.** Four scrapes in four such turns in the
  games is about a 1-in-16 outcome at that rate, not a certainty.
- The no-guard arm does not measure the removal cleanly. The recorded briefings carry her own notes and
  plan, which mention guard attention, and 13 of its 20 thoughts still do. Only fresh games can measure
  the removal.

**What moves the rate is the turn, and the turns differ in the plan she carried in.** Across all three
arms (15 samples each):

| Turn | *"Your plan, from your last turn"* | Worked the bar free |
|---|---|---|
| E1 r6 | "… 3. Once bar is below 50, attempt escape through the window quietly." | 12/15 |
| E3 r7 | "… then attempt to remove it once it's sufficiently weakened …" | 8/15 |
| E2 r10 | "Continue damaging the bar until integrity ≤50. Once broken, climb through …" | 6/15 |
| E3 r6 | "Continue damaging the bar with the spoon to reduce its integrity. …" | 4/15 |

**Hypothesis, from four turns, not a result.** A plan whose step names a checkable finishing condition
("once below 50") advances when the condition is met. A plan with a vague condition ("sufficiently
weakened", "once broken") or none advances rarely. The plan rules (§22) tell her *"your intent this turn
is the next step of your plan"*, so a step with no end keeps her on it. If this holds, it is not a
prisoner problem. It is any model-driven agent following its own open-ended plan, and the fix belongs
in the mind-side infrastructure every caller shares, not in this game's rules text (owner, 2026-09-16:
*"Putting that rule in the-prisoner does nothing to help make foreign leaders in Brink smarter."*).

### 33.10 The plan hypothesis, tested: not supported (2026-09-16)

§33.9's hypothesis was that a plan step with a checkable finishing condition advances and an open-ended
one does not. It was tested on the same rebuilt prompts. Each arm edits **only** the *"Your plan, from
your last turn"* line, and the script checks the recorded line before editing it. The guard attention
line was removed in every arm (the code since `8d139f5`), and each arm has 10 samples. Intents were
read by hand for an attempt to work the bar out. Data
`checkpoints/2026-09-16-open-prisoner-probe-s33-10-plan-N10.json`; script alongside.

| Arm | Turn | Plan carried in | Worked the bar free |
|---|---|---|---|
| A | E1 r6 (bar 40) | as recorded: "… 3. Once bar is below 50, attempt escape …" | 5/10 |
| B | E1 r6 | only the condition made vague: "3. Once the bar is sufficiently weakened, attempt escape …" | 6/10 (+1 climb through a window not yet open) |
| C | E3 r6 (bar 47) | as recorded: "Continue damaging the bar … If no progress, use the bucket …" | **0/10** |
| D | E3 r6 | recorded + "Once bar is below 50, attempt escape through the window quietly." | 1/10 (+1 climb) |
| E | E3 r6 | recorded + "Once the bar is sufficiently weakened, attempt escape …" | **0/10** |

- **Making the condition vague changed nothing** (A 5, B 6).
- **Adding a specific finishing step barely moved E3** (C 0, D 1). The prediction was that D would
  approach A. It did not.
- **The hypothesis is not supported.** The plan is not what separates the two turns. Recorded here so
  that nobody designs a shared plan mechanism on it.

**What still differs between the two briefings**, all lines outside the plan:

| | E1 r6 | E3 r6 |
|---|---|---|
| Own outcome | "integrity went from 55 to 40" | "integrity went from 62 to 47" |
| The warden, as perceived | "Warden Croft examines the bar closely." | *Croft says: "Now let's see how sturdy that bar is..."* |
| Notes | "Bar at 55; … Focus on stealthy abrasion." | "Focus on bar damage; …" |
| Belief line | "bar integrity: 40 (as of round 5)" | "bar integrity: 47 (as of round 5)" |

Untested candidates: how far below the line the bar is (40 vs 47), the warden's spoken line about the
bar's sturdiness, and her own notes ("bar damage"). Each can be isolated the same way.

### 33.11 The other briefing differences, tested: none of them (2026-09-16)

Same rebuild as §33.10. Each arm swaps exact recorded lines of E3 r6's briefing (the script checks
each appears once) for E1 r6's counterparts. 10 samples; E3 r6's unchanged baseline is §33.10 arm C,
0/10. Data `checkpoints/2026-09-16-open-prisoner-probe-s33-11-lines-N10.json`; script alongside.

| Arm | Swap on E3 r6 | Worked the bar free |
|---|---|---|
| F | bar 47 → 40, in both the outcome line and the belief line | 1/10 |
| G | *Croft says: "Now let's see how sturdy that bar is..."* → "Warden Croft examines the bar closely." | 1/10 |
| H | notes "Focus on bar damage" → "Focus on stealthy abrasion" | 1/10 |
| I | F + G + H | 0/10 |

**None of the three explains the gap, alone or together.** With every differing line swapped except the
plan, E3 r6 stays at 0/10, against E1 r6's 5/10. Arm F's first sample restates the games' reasoning at
bar 40: *"below the 50 threshold … However, the bar is still in place, so I need to remove it.
Continuing to damage it … is the next logical step."*

**What §33.10 did not test.** Its plan edits changed or added the *later* step ("attempt escape"),
never the step she is on. E1's current step carries its own end, *"1. Continue abrading the bar to
reduce integrity below 50 by Round 10"*. E3's has none: *"Continue damaging the bar with the spoon to
reduce its integrity."* Whether the **current** step names its end is the one plan difference left
untested.

### 33.12 The current plan step, tested: not supported either. Probing stops here (2026-09-16)

The last untested plan difference (§33.11), run the same way with 10 samples each. Data
`checkpoints/2026-09-16-open-prisoner-probe-s33-12-current-step-N10.json`; script alongside.

| Arm | Change | Predicted | Worked the bar free |
|---|---|---|---|
| J | E3 r6, the current step only: "…to reduce its integrity **below 50**." | up from 0/10 | 1/10 |
| K | E1 r6, the current step's end removed: "1. Continue abrading the bar to reduce integrity." | down from 5/10 | 4/10 (+1 climb through a window not yet open) |
| L | E3 r6 swapped to E1 r6 in **every** differing line (bar, warden, notes, tile belief age, whole plan) | about 5/10 | 3/10 |

**Neither prediction held.** Arm L, the closure check, recovers most of the gap (0 → 3 against E1's
5), so the swapped lines do carry the difference between the two turns. But across §33.10-§33.12 no
single line (plan step, later step, bar number, warden's line, notes) moves the rate on its own. What
separates the turns is the briefing taken whole, not any one attributable line.

**Where this leaves failure 1.** At the turns that matter she works the bar free somewhere between 0
and 60% of the time, depending on the whole briefing in a way no single edit explains. No mind-side
mechanism is proposed on this evidence. **The owner has taken the design question from here**
(2026-09-16: *"if this doesn't work, don't do anything further. I want to try applying my own brain
to figuring out a technology solution at that point."*). No further probes.

### 33.13 The owner's prompt lab: one sentence decides it, and a referee regression (2026-09-16)

After §33.12 the owner took the mind-side question by hand. `~/prisoner-prompt-lab` is a local page
(not in any repo) that sends `qwen3:14b` exactly the wits request the game sends: one user message,
temperature 0.9, the game's forced JSON schema, a fresh chat each ask. The owner edited the prompt and
scored each answer by hand: ✓ if the intent tries to get the bar out now. The owner's browser answers
were not saved as files, so their counts are as the owner reported them in session. Every prompt
version, and the answers Claude ran, are in `checkpoints/2026-09-16-prompt-lab-s33-13/`.

**The owner's sequence** (E3 r6 unless noted; baseline 0/10, §33.10 arm C):

| Prompt | Result |
|---|---|
| bar as damage (53) instead of integrity (47); rule "the window can be opened…" kept (text not saved) | 1/6 |
| + rule sentence *"The bar can be removed once the bar's damage is at or above 50."* (`01-…`) | 3/5 |
| + first line *"If the bar's damage is greater than 49, it can be removed without requiring any further damage."* (`02-…`, "A") | **10/11**; the miss waited for guard attention |
| A, bar at 47 damage (below the line) | **11/11 kept working**; every answer computed *"needing 3 more to reach 50"* |
| A's edits on E1 r6, bar 60 damage (`04-…`) | 7/11; all 3 waits cited guard attention, 1 tried to climb out first |
| + guard attention removed from her carried notes (`05-…`) | **10/10** |

**Ablation, one change removed at a time from A** (E3 r6, guard note kept as in A; run by Claude, 6
answers each, `03-…`):

| Test | Removed | Result |
|---|---|---|
| B | damage framing (integrity again; the other two changes restated for integrity) | 5/6 |
| C | *"The bar can be removed…"* (back to *"The window can be opened…"*) | 6/6 |
| D | the first line (identical to the owner's 3/5 prompt) | 4/6 → with the owner's 3/5, **7/11** |

With the first line (A, B, C): **21/23**. Without it (D): **7/11**. **The first line is the change that
matters. The damage framing and the object-naming rule are not needed.** D's misses are the two
errors the line addresses: *"close to being removable (53 damage)"* (the comparison), and *"meets the
threshold for removal"* followed by *"further damage the bar"* (believing more preparation is needed).
B's one miss: *"47, just below the 51 threshold needed … Continuing to damage it"*.

**Candidate lessons, for the owner's design, not decided:**
1. When a threshold unlocks an action, say so explicitly, and say that nothing further is required. The
   model otherwise keeps preparing.
2. Numbers that decide nothing mislead. Guard attention caused every remaining miss.
3. Numbers without stated meaning get invented meanings. With guard attention in her notes, she read
   *"loose tile concealment: 80"* as her own stealth in 10 of 11 answers. Without it, 0 of 10.

**Referee check of the lab's wordings: a regression found.** Each wording the lab produced went into
the recorded E3 r6 prisoner request and was ruled 5 times by `qwen2.5:14b` (`06-…`):

| Intent | Current referee | Without §33.7's restore sentence (`07-…`) |
|---|---|---|
| Use the spoon to lever the bar out of the mortar | open | (not rerun) |
| Use the spoon to pry the bar out of the mortar | **wear** | open |
| Attempt to remove the bar from the window | **wear** | open |
| Use the spoon to twist and remove the bar | **wear** | open |
| Attempt to remove the bar by hand, taking advantage of the dry, cracked mortar | **wear** | open |
| Remove the bar | wear | wear |
| Use the spoon to remove the bar | wear | wear |
| Proceed with the bar removal, utilizing stealth … | open | (not rerun) |
| Attempt to stealthily remove the bar using the loose tile concealment … | open | (not rerun) |

All answers 5/5. **§33.7's sentence *"Working a material against something to damage it is wear"* turns
"pry the bar out of the mortar" from `open` into `wear`.** §33.7 tested that sentence only against
scrape and strike controls, never a pry. It has shipped since `88cda7a`. It did not change any recorded
game: the only games since are batch E's, and none of their intents tried to remove the bar.
Separately, a bare *"remove the bar"* is `wear` with or without the sentence.

### 33.14 The restore sentence reverted (owner's decision, 2026-09-16)

§33.7's sentence is removed from the referee's effect prompt, along with its test. The six referee
questions the code now builds are identical, checked by string comparison, to §33.13's replayed
requests without the sentence. So §33.13's second column (`07-…`) is what the code now rules: pry,
remove-from-the-window, twist-and-remove and remove-by-hand are `open`. The grit misruling §33.7 was
fixing is back (D3 r6 *"apply it to the bar's rusted areas"* → `restore`). It was already only partly
fixed: batch E still had 1 of about 8. Bare *"remove the bar"* and *"use the spoon to remove the bar"*
remain `wear`.

**Lesson recorded:** a referee prompt change is tested against controls for every nearby effect the
sentence could pull, not only the misruling it fixes. §33.7's controls were all wears, so a sentence
about wear could not show what it did to open.

### 33.15 From a game-specific sentence to a generic structure (2026-09-16, end of session)

The owner's next question: does a fix that code could produce for **any** threshold work as well as
§33.13's game-specific first line? All runs on E3 r6 (bar 53 damage), 0.9 temperature, the guard
attention note still in her notes. Files in `checkpoints/2026-09-16-prompt-lab-s33-13/`.

| First line | Thresholds stated as | Result | Who ran it |
|---|---|---|---|
| none (§33.13 D) | plain rule sentences | 7/11 | owner + Claude |
| owner's specific: "…can be removed without requiring any further damage" (§33.13 A) | plain rule sentences | 10/11 | owner |
| generic: *"Whenever a condition stated below is met, the action it unlocks is available immediately. Nothing further needs to be done before attempting it."* (`09-…`) | plain rule sentences | **6/10** | Claude |
| same generic line | the two rules under `LIST OF CONDITIONS:` as `CONDITION 1:` / `CONDITION 2:`, in place (`10-…`) | **9/11** | owner |
| same generic line | the list moved to the top, between `START LIST OF CONDITIONS` / `END LIST OF CONDITIONS`, the one nested catch rule split into four flat single "If … and … then …" conditions (CONDITION 2-5) (`11-…`) | **11/12** | owner |
| same, thresholds restated as strict comparisons ("above 49", "above 39"; the notes line reworded to "below 41") | as above | 11/12 | owner (prompt not saved) |

**The generic line alone does not work (6/10, no better than no line); the generic line plus a labelled,
flat list of conditions does (11/12).** Nothing in the winning structure is specific to this game:
a fixed opening sentence, then each threshold as one numbered, flat if-then condition, both of which
shared code could generate from data a game already has. Answers reason from it directly (*"53,
meeting CONDITION 1, so I can attempt to remove it"*). The owner's working theory: `qwen3:14b` at this
quantization cannot untangle nested conditions, so each condition must be one flat statement.

**Seen in those answers, open:**
1. **Whose condition is it?** The list mixes an action unlocked for her (CONDITION 1) with the warden's
   catches (2-5). One answer planned to *"trigger Condition 5 and escape"*. A list may need to say
   which conditions help the reader and which end the game against them.
2. **Suspicion and guard attention merge.** Nearly every answer repeats *"guard suspicion will drop
   below 41 soon"*, drawn from the leftover notes line. Rewording the numbers did not separate them.
   Deleting the guard attention part of the notes (which the current game would never produce) is the
   next step.
3. **"Remove the bar" became her dominant phrasing** (7 of 11 ✓ in the last batch), echoing CONDITION 1.
   The referee rules bare "remove the bar" as `wear` (§33.13), so in a real game those turns would do
   nothing. **This referee gap must be fixed before the structure is tried in games.**

The lab page itself (`~/prisoner-prompt-lab/index.html`, served on `http://localhost:8765` with
`python3 -m http.server 8765 --bind 127.0.0.1` from that folder) is copied alongside the prompts as
`lab-page-index.html`.

### 33.16 "Remove the bar" ruled open: no wording does it on `qwen2.5:14b`; `qwen3:14b` does (2026-09-16, night)

**The owner's decision, first:** an attempt to remove the bar is ruled `open`, and the rules refuse it
until the bar is weak enough. That refusal already exists (§24, the gate in `mechanics.ts`), so only the
referee's ruling had to change.

**Method.** 26 intents, each built from the current code's referee questions on §33.13's E3 r6
perception, so they are exactly what a game sends. The base request was checked equal to §33.14's
recorded one. The intents were 9 that should be `open` (the four removal misrulings among them),
7 `wear` controls, 5 `leave`, and one each of reveal, derive, expose, conceal, plus "remove" on a
non-exit (the blanket). Candidate sentences were swapped into the effect prompt by string replacement,
and each version was replayed through `npm run referee-replay`. Files are in
`checkpoints/2026-09-16-referee-removal-s33-16/`: `build-requests.mts`, `build-split.mts`,
`requests-26-intents.json`, and one `out-*.txt` per version.

**Eight prompt versions on `qwen2.5:14b`. None is right everywhere.** Scores are intents right, out of 26.
V1-V4 were run before the extra leave/wear controls existed (20 intents, 5 replays), and the rest on all 26
(3 replays).

| Version | Change | Score | What moved |
|---|---|---|---|
| base | today's prompt | 21 | the two bare removals `wear`; twist-and-remove `wear`; push-back-the-bolt `wear`, targeting the bar; "squeeze through the gap where the bar was" `open` |
| V1 | "a bar levered from its mortar **or simply removed**", plus "whether it gives is for the rules" | 20 intents: 2 misses | "Remove the bar" and twist-and-remove fixed; "Use the spoon to remove the bar" and push-back-the-bolt still `wear` |
| V2 | a separate sentence: removing a part that keeps a way out shut is `open` | 20 intents: climb-out broke | all removals `open`, **"Climb out through the window" -> `open`** |
| V3 | V1 + "with a tool or by hand" | 20 intents: climb-out broke | all removals `open`, climb-out `open` |
| V4 | V2's sentence after the leave sentence | 20 intents | spoon-remove still `wear`; climb-out `leave` only 4 of 5 |
| V5 | V3 + "getting out through the gap a removed part leaves" is leave | 23 | all removals `open`; three of five climb-out phrasings `open` |
| V6 | V1 with "whatever it is removed with" | 21 | "Remove the bar" back to `wear` (four words from V1) |
| S2 | a separate yes/no `goes_out` question before `effect`, `leave` taken out of `effect`, V3 wording | 22 | leaving fixed (squeeze included); bare removals `wear` 2 of 3; "damage the bar further" -> goes out; "Get out through the window" -> `open` |
| S3 | the same split, today's open wording | 20 | removals and pry back to `wear` |

S0/S1, the split with an added *"judge only what the act does to the thing it acts on"*, scored 17. That
sentence contradicts *"judge by the intent's aim"*, which is why S2/S3 dropped it. Every version that fixed
the spoon removal pulled some climb-out to `open`; the one question that split leave out made mistakes of
its own. **Reading:** on this model the wear/open/leave line is unstable, and wording only reshuffles
which intents fall on the wrong side. Wording was dropped as the route.

Also unexplained: base rules twist-and-remove `wear` here, while §33.13's `07-…` had it `open`, on
questions verified identical.

**The same unchanged prompt on `qwen3:14b`: 24 of 26** (`out-qwen3-base-N3.txt`). Both bare removals,
twist-and-remove and push-back-the-bolt are `open`; the bolt now targets the door. Squeeze-through is
`leave` 2 of 3, and every wear, reveal, derive and conceal control holds. A second run with every raw reply
kept (`capture-all.mts`, `qwen3-raw-replies-N3.json`) found 23 of 26 right all three times. Misses:

1. **"Climb through the window and escape" -> `open`, 3 of 3 in both runs.** A real judgement miss.
   The other four leave phrasings hold.
2. **"Squeeze through the gap in the window where the bar was"**: `open` once in three.
3. **"Grind at the bar with the spoon's edge to weaken it"**: whole ruling at safe defaults, 2 of 3. Not a
   judgement: the raw replies judged `wear` correctly but wrote every questionId as `id "target"`,
   copying `buildPrompt`'s own `- id "target":` line, so the engine ignored every answer. 2 of 78 replies
   did this, and they were the only whole-ruling losses. doris's Ollama log shows all 78 calls HTTP 200
   in 3-30 s, so no timeouts.

Two smaller observations: 7 of the 26 intents had at least one answer disagree across three replays at temperature 0
(`qwen2.5:14b` almost never did), and several replies cited nothing for `product` on a non-derive
effect, which changes no ruling. A qwen3 ruling takes about 10 s against about 4 s, but the referee then
shares the wits model, so a game loses the swap per ruling.

**Fix built (owner approved): the transport reads `id "<id>"` as `<id>`**, only for an id the request
asked; any other questionId is handed on unchanged (`refereeTransport.ts` `questionIdOf`, test in
`refereeTransport.test.ts`). It works on the reply's structure only, like §30's range clamp, and no prompt
text changed. Re-reading all 78 recorded replies through the fixed transport (`verify-fix.mts`)
changes exactly the two grind replies, both now `wear` on the bar with citations. The other 76 read
identically.

**Default changed (owner, same night):** the referee model is now `qwen3:14b` when
`PRISONER_REFEREE_MODEL` is unset (`modelRoles.ts` `resolveRefereeModel`, shared by the checkpoint and the
replay tool). This supersedes §8.1's separate-model default: the referee now shares the wits model's
weights, so it rules on ideas that model proposed. §8.1's reason for independence is given up for the
rulings only this model gets right. The open question is miss 1: an attempt to leave that says "and escape"
is ruled `open`, and in a game it would refuse the prisoner's actual exit.

**Tooling:** `~/prisoner-prompt-lab/referee.html` (copied here as `referee-lab-page.html`, with
`referee-intents.txt`) sends the referee's exact request, verified byte-identical for a real intent, over
an editable intent list, and marks rulings that changed from a kept comparison run. Its template
`referee-prompt-today.txt` is captured from the code and must be regenerated if `referee.ts`'s questions change.

## 34. The condition list as a generic mechanism (2026-09-17, overnight)

§33.15's structure, built so any caller can generate it from thresholds it already holds.

- **`src/open/conditionList.ts`** (no game words, by test; planted violation seen red): `Condition =
  { when: string[]; then: string; for: string }` and `renderConditionList(conditions, { reader })`.
  It renders §33.15's fixed opening line, then `START LIST OF CONDITIONS` … `END LIST OF CONDITIONS`,
  one numbered line per condition. **Flatness is structural**: clauses are joined only by "and", and
  there is no "or" or nesting, so a disjunction has to be split by the caller, as the lab did by hand.
- **Whose condition (§33.15 item 1):** each line says `(for you)` or `(for <name>)` from the reader's
  side, so the same list read by the other principal flips.
- **`src/open/conditions.ts`**, the game side, built from the constants the rule sentences, the
  way-out gate and the catch check already read: (1) bar at or below 50 → the window can be opened;
  (2) a way out stands open → she can leave through it and has escaped (added after §35's game 3, before
  any game used the list); (3-6) the four catch alternatives, one flat condition each.
- **Switch:** `PRISONER_CONDITIONS=list` gives the list to the **prisoner's** mind only, at the top of
  its wits prompt, and drops the two threshold sentences from its rules. The warden is unchanged, so an
  A/B changes one thing. Unset, every prompt path was byte-identical to before (dumped and compared).
  **Since D3 (§40) `list` is what unset means**, and the old rule-sentence baseline is
  `PRISONER_CONDITIONS=off`: every batch above this line is comparable only to an `off` run.
- **§33.15 item 3 (guard attention in the carried notes)** only ever existed in the lab prompt; the game
  has not rendered guard attention since `8d139f5`. The probe below removes it from the recorded notes.

## 35. Batch F: §5.3 on the qwen3:14b referee, and a passive game (2026-09-17, overnight)

Four contested games and one passive game on one configuration: `qwen3:14b` wits and referee (the new
default, §33.16), `ancient-awakening:12b` voice, 30 rounds, model warden, precedent OFF, pick OFF,
conditions OFF, 180 s timeouts (batch E's configuration apart from the referee). Driver
`checkpoints/2026-09-17-overnight/run-batch.sh`. Transcripts `checkpoints/2026-09-17T01-21-32-000Z.md`,
`…01-29-12-541Z.md`, `…01-35-04-448Z.md`, `…01-55-22-261Z.md`; passive `…02-01-39-720Z.md`.

| | F1 | F2 | F3 | F4 | Passive |
|---|---|---|---|---|---|
| Result | caught r7 | caught r6 | caught r18 | caught r6 | **escaped r6** |
| Intents / silences | 13 / 0 | 11 / 0 | 35 / 0 | 11 / 0 | 6 prisoner (6 passive silences) |
| Ruled impossible | 0 | 0 | 7 | 0 | 0 |
| Novel pairs | 1 | 2 | 5 | 1 | 2 |
| Applied effects cited | 13/13 | 11/11 | 26/26 | 11/11 | 6/6 |
| Fog audit | 0 / 13 | 0 / 11 | 0 / 35 | 0 / 11 | 0 / 12 |
| Turns with bar ≤ 50, nothing open yet | 1 | 1 | 3 | 1 | 1 |
| …of which she tried to open | 0 | 0 | 1 (r15) | 0 | 1 (r5) |

### 35.1 Against §5.3

| | Criterion | Result |
|---|---|---|
| 1 | Zero §2 violations | **Met.** 82 contexts audited across the five games, 0 leaks; every applied effect carries its citations; no silence became a success (the passive game's six silences are the passive warden by design). |
| 2 | A closed-inexpressible attempt ruled possible in ≥ 2 games; one impossible with its positive reason | **Met.** Novel possible attempts in all four contested games (the grit derive in F1 and F3; the warden's reveal of the tile's hollow in F2 and F4; F3's pry that opened the window). F3 has seven impossible rulings, each telling her the object as it is ("…met the bar as it is: The iron bar that…"). |
| 3 | Replay agreement ≥ 80% | **Met.** 99.5%, 99.4%, 97.6%, 98.2%, N=5, on `qwen3:14b` (`checkpoints/2026-09-17-overnight/<stamp>-replay-N5.txt`). Slightly below batch A's 99.4-99.7% on `qwen2.5:14b`, as §33.16 predicted (qwen3 disagrees with itself more often at temperature 0); §10.5's caveats unchanged. |
| 4 | Both endings reachable | **Met in this batch.** Four catches, and the passive game escaped at round 6 (lever the bar out at 40, then "Climb through the open window" → `leave`). §30.1's climb-phrasing miss did not occur. |

**§5.3 holds for batch F**, on the new default referee.

### 35.2 What the games show

- **Batch E's failure reproduces on the new referee.** In F1, F2 and F4 she reached the window's line
  once and scraped past it into the catch (F1 r6: "Attempt to pry the bar out with the spoon" was her own
  fifth candidate, and she scraped). The referee change did not move the mind.
- **F3 opened the window and did not leave.** Round 15 "Use the spoon to pry the bar from the mortar" →
  `window_passage: 0 -> 1`, and she was told *"the window can be climbed through now."* Rounds 16-17 she
  pried the bar further (a no-op, then a wear 32 → 17), and at round 18 the warden's look found the bar at
  17. It is the same shape as the bar one step later: an action unlocked and she keeps preparing. This is
  why §34's list states leaving as a condition.
- **The warden never looked at the window's passage.** The §33.8 catch on a way out found open needs a
  look at the window, and every warden look was at the bar. The catch that ended F3 was the bar's.
- **A referee inconsistency, again counted as novelty:** F3 ruled "transfer grit from the loose tile to
  the bar's mortar cracks" `derive grit.concealment` (possible) at rounds 6-7, and the same act impossible
  at rounds 9, 10, 11 and 13. Identical-request replay cannot see this (§31.1).

### 34.1 Before any game: the probe (2026-09-17)

Her recorded decision re-asked under today's code, `qwen3:14b` at the game's settings, 10 samples a turn,
baseline prompt vs the list. Briefings are as recorded, with the guard attention belief line and the
guard attention clause of her notes removed (the game produces neither since `8d139f5`). Perceived
objects are read from the recorded briefing. Intents read by hand. Script and data:
`checkpoints/2026-09-17-overnight/probe-conditions.mts`, `probe-conditions-{baseline,list,list-v2}-N10.json`.

| Turn | What is right | Baseline | List (v1) | List v2 |
|---|---|---|---|---|
| E1 r5, bar 55 (control) | keep working, no removal yet | 10/10 keep working | 10/10 keep working | (not rerun) |
| E1 r6, bar 40 | try to get the bar out / open | 8/10 | 7/10, **+3 climb through a window not yet open** | **10/10**, 0 premature climbs |
| E3 r6, bar 47 | same | 1/10 | 5/10 | 5/10 |
| F3 r16, window open | climb out | 8/10 | **10/10** | (not rerun) |

- **The list moves the turn the owner's lab used**, E3 r6, from 1/10 to 5/10: less than the lab's 11/12
  (that prompt was damage-framed and named the bar's removal), but on the game's own framing and the
  game's own sentence for the unlock.
- **Whose condition (§33.15 item 1): resolved in this probe.** Nine answers mention a warden condition
  by number; every one reads it as something Croft does to her ("before Warden Croft examines it and
  triggers Condition 6"). None plans to trigger one.
- **v1's own error:** "then the window can be opened" was read as the window already being open ("which
  meets Condition 1 (≤50), unlocking the window … the window is now open") in 3 of 10 at E1 r6. v2 names
  the actor, *"then Mara Voss can open the window"*, parallel to condition 2's *"Mara Voss can leave"*:
  10/10, none premature. That is two variations of one idea (the unlock's wording). **v2 is what the
  games use.**
- The control turn did not move: no premature removal in either arm at bar 55.
- A premature climb would not have been harmless in a game: a `leave` against a shut window is told
  "met the window shut" and is suspicion-eligible.

### 34.2 In real games: batch G against batch F (2026-09-17)

Batch G is batch F's configuration (§35) with one change, `PRISONER_CONDITIONS=list` (the prisoner's
mind only, §34.1's v2 wording). Transcripts `checkpoints/2026-09-17T03-42-30-378Z.md`, `…03-51-05-772Z.md`,
`…03-58-48-172Z.md`, `…04-05-11-968Z.md`. Counts from `analyze.mts`, by the referee's recorded effect key.

| | Batch F (rule sentences) | Batch G (condition list) |
|---|---|---|
| Result | caught r7, r6, r18, r6 | **escaped r7, r7, r6, r6** |
| Turns with the bar at or below 50 and nothing open yet | 6 | 4 |
| …on which she tried to open | 1 (F3 r15) | **4** |
| Tried to open or leave with the bar above 50 | 0 of 25 turns | 1 of 18 (G1 r1 at 100, ruled impossible) |
| Applied effects cited / fog | 61/61, 0 leaks in 70 contexts | 50/50, 0 leaks in 52 contexts |
| Novel pairs | 1, 2, 5, 1 | 4, 6, 2, 4 |

The intents at the unlock: G1 r6 *"Open the window by removing the bar"* (bar 40); G2 r6 *"Use the spoon
to pry the rusted bar from the window"* (39); G3 r5 *"Attempt to open the window by removing the damaged
bar"* (40); G4 r5 *"Open the window to escape"* (40). Each left through the window on her next turn.
Every G game ended the turn after the first one she could act on, so a G game has one removable turn
where F games had one to three.

**Reading.** On the only variable changed, the prisoner went from acting on her unlock once in six
chances to four in four, and the contested game went from four catches to four escapes. Four games a
side is small, but 0/4 against 4/4 on outcome, with §34.1's probe predicting the direction on recorded
turns beforehand, is the strongest effect any single mind-side change has shown in this document. The
cost seen so far is one premature removal attempt at full integrity.

**What this is not.** It is not a balance result, and the warden losing every game is not a defect
(the-prisoner is a harness). The warden's prompt was unchanged. The list is generic: a warden given
its own list reads the catches as `(for you)`. Whether that makes the warden act on its thresholds the
same way is the natural next A/B, and it is the half that matters for any NPC that has to stop someone.

## 36. Pick regenerates when nothing is unseen (2026-09-17, overnight)

§32.1 found the pick mechanism idle: on 6 of 8 forced turns the mind's candidates were rewordings of one
idea, all `seen`. **Idea 1 for candidate generation: ask again, told why.** `pick()` takes an optional
`regenerate`, called only on a forced turn where neither the mind's own choice nor any candidate is
`unseen`. It is told every verdict, and its texts are judged (skipping any already judged). The loop
re-asks the same mind once: *"Before you act: everything you listed is something Warden Croft has
already seen and knows on sight ("…"). List different things you could try this turn, that Warden Croft
has not seen."* The fresh answer's intent and candidates are only candidates; its plan is not kept.
Switch `PRISONER_PICK=even-regenerate`; plain `even` is unchanged.

### 36.1 A first pair that could not measure it (precedent off)

H1 (even), I1 and H2 (even-regenerate / even) ran in batch F's configuration: precedent **off**. Without
the ledger, "seen" is only this game's few sightings, and pick almost always had something unseen (H1
stuck 0 of 6, I1 1 of 6, H2 1 of 3). The pair could not measure regeneration, so it was stopped and
rerun with the ledger. Transcripts kept: `…04-13-02-707Z` (H1, escaped r12), `…04-30-53-789Z` (I1,
caught r14), `…04-54-23-003Z` (H2, caught r8).

### 36.2 Batch J: with the ledger, 3 against 3

§32's condition: each game gets a fresh copy of the committed 22-episode
`checkpoints/precedent-ledger.json` (nothing written back). Otherwise batch F's configuration, arms
alternating (`run-pick-ledger.sh`). Transcripts: even `…05-05-32-054Z`, `…05-56-34-559Z`,
`…06-39-21-427Z`; even-regenerate `…05-24-50-492Z`, `…06-09-27-638Z`, `…06-52-46-634Z`.

| | pick=even | pick=even-regenerate |
|---|---|---|
| Result | escaped r10, escaped r9, caught r10 | caught r18, caught r14, escaped r12 |
| Forced turns | 13 | 20 |
| Nothing unseen among the mind's own candidates | 6 | 11 |
| Regenerated / found something unseen | – | 11 / 6 |
| **Forced turns overridden** (did something unseen) | **3 (23%)** | **13 (65%)** |
| Free turns / novel | 15 / 3 | 22 / 3 |
| Fog / citations | 0 leaks; all cited | 0 leaks; all cited |

What regeneration found, each an idea absent from the mind's first list and produced only after being
told the list was known: *"Bend the spoon's bowl edge to create a sharper abrading surface"*, *"Bend the
wire into a hook to pull on the bar's weak spot"*, *"Test the door's bolt by pushing it gently"* (the
first attempt at the door tonight), *"Work a piece loose from the tile"*, *"Examine the blanket closely for the loose thread"*, *"Use the
spoon to scrape the loose tile's edges"*, *"Scratch the cot's frame with the spoon's worn edge"*. Of 45
regenerated texts, 7 were unseen. The rest were still the known approach reworded, even after being told.

**Reading.**
- **Candidate generation measurably improved**, on the measure §32 named: stuck forced turns now become a
  new attempt more than half the time, and the share of forced turns that did something unseen nearly
  tripled.
- **Free turns did not change** (3 novel in 15 against 3 in 22). By the rule this document has held since
  §21 (forced novelty is novel by construction; only free turns are evidence), the mind still does not
  choose new things unforced. The new ideas, like §21.3's and §23.1's, mostly change nothing that
  matters in this room (a sharper spoon, a pushed bolt).
- **Outcomes did not improve** (2 escapes to 1). Forcing spends turns, as §23.1 found.
- The seen-on-forced-turn problem is also smaller than §32 made it look: with precedent on, 6 of 13
  forced turns were stuck in the `even` arm, against §32's 6 of 8 on the `qwen2.5:14b` referee.

**Moved to the package.** `pick` with `regenerate` is now mother-of-invention's mechanism 2 (0.1.2,
published by tag), and this repository consumes it pinned exactly. The local `src/open/pick.ts` is gone.
It moved because it does what it claims, measured against a real caller. The free-turn question is left
open, and the package README says so.

### 34.3 The warden reads the list from its own side (2026-09-17)

`PRISONER_CONDITIONS=both` gives the warden's mind the same `openConditions()`, rendered from its side:
the unlocks are `(for Mara Voss)` and the catches `(for you)`. Probe first, on batch G's recorded warden
turns, 5 samples each (`probe-warden.mts`, `probe-warden-{baseline,list}-N5.json`).

| Turn | What would catch her | Baseline | List |
|---|---|---|---|
| G1 r7, G2 r7, G3 r6, G4 r6 (she opened the window on her previous turn; suspicion 58-100; the warden's briefing says "Mara Voss opens the window." or "…opens the bar.") | a close look at the window | **0 of 20** (tile ×8, bar or its mortar ×11, door bolt ×1) | **20 of 20** |
| G1 r4, G3 r3 (controls: nothing open yet) | — | bar ×9, lock ×1 | bar ×9, lock ×1 |

Batch G's warden perceived *"Mara Voss opens the window"* and then went to the tile or re-examined the
bar's mortar; every recorded one did, and so did every re-asked one. With the list, every answer looks at
the window, often reasoning from the list by number (*"Examine the window closely to confirm it is open
and trigger Condition 6"*: his own condition, read as his). The control turns do not move.

This is §34.1's result from the other side: the same generic list, with nothing but the reader changed,
makes the principal whose condition it is act on it. Real games follow in §34.4.

### 34.4 Both minds with the list: batch K (2026-09-17)

Batch G's configuration with `PRISONER_CONDITIONS=both`. Transcripts `checkpoints/2026-09-17T07-32-00-508Z.md`,
`…07-38-56-071Z.md`, `…07-47-21-460Z.md`, `…07-53-46-357Z.md`.

| | K1 | K2 | K3 | K4 |
|---|---|---|---|---|
| She opened the window | r5, bar 40 | r5, bar 47 | r5, bar 40 | r5, bar 40 |
| His next turn | *"Examine the window closely to confirm it is open and trigger Condition 6"* | *"…to check if it's standing open"* | *"…as a way out"* | *"Examine the window closely"* |
| Result | caught r6 | caught r6 | caught r6 | caught r6 |

Every catch is a `reveal window.passage` finding it open (§33.8's condition), the catch no warden had
made in any earlier game this document records. **Both principals now act on their own unlocks the turn
they arrive**, which is what the mechanism is for: G's escapes were the warden missing an open window
he had just been told about, and K removes that miss. The contest is now decided at the unlock itself.
She cannot open and leave in one turn, and suspicion is already over 40 by then. Whether a prisoner
who reads condition 6 can plan around it (lower suspicion before she opens, or open when he cannot look)
is the next question about reasoning, and no game here has shown it yet. K2 r4's *"Damage the bar
slightly with the spoon to lower its integrity to 50"* shows her already planning to the line.

**A false leak, fixed.** K4's recorded audit reads "1 leaks". It was the prisoner's round-5 candidate
*"Check the loose tile for hidden items"* found in the warden's round-5 briefing, inside the warden's own
round-4 plan, which began with those exact words and was written first. The audit exempted own texts only
on exact equality. It now masks a principal's own texts before searching (`20e8776`, test with a planted
positive control). K4's transcript keeps the recorded line. A search of K4's briefings for every
prisoner-private text finds nothing else, and the fix can only remove false positives, so earlier zero
counts stand.

### 34.5 Two more games a side (2026-09-17)

Alternating, same configuration: baseline `…08-02-13-400Z.md` (F5), `…08-17-26-066Z.md` (F6); list
`…08-11-14-467Z.md` (G5), `…08-24-00-706Z.md` (G6).

| | Baseline (F1-F6) | List (G1-G6) |
|---|---|---|
| Escaped | **2 of 6** (F5 r8, F6 r6) | **6 of 6** (r7, r7, r6, r6, r6, r6) |
| Tried to get the bar out at the first removable turn (by intent) | 2 of 6 | 6 of 6 |
| …at any removable turn (by intent) | 4 of 10 | 6 of 6 |
| Tried with the bar above 50 | 0 | 1 (G1 r1, at 100) |

**The extra baselines make the effect smaller than §34.2's 0/4 against 4/4, and it holds.** F6 pried at 47
on her first chance, as §33.9's probe said she does about half the time. F5 tried at round 5 and lost the
turn to the referee (below), then pried again at round 7 and escaped.

**A referee gap found here (open).** F5 r5 *"Attempt to pry the bar out of the mortar using the spoon"* was
ruled target `none`, effect `none`, nothing cited, and told as reaching past what is here. Replayed 3 times
on `qwen3:14b`: the same every time (`F5-r5-pry-request.json`, `F5-r5-pry-replay-N3.txt`). Other pry
wordings tonight (F3 r15, F6 r5, the passive game's lever) ruled `open`. The raw replies were not
captured, so whether this is a judgement or a whole-ruling loss like §33.16's `id "target"` is unknown.
**A confound to keep in view:** the list arm's intents echo condition 1 (*"Open the window by removing
the bar"*, *"Open the window"*), and every one of those ruled `open`. Some of G's margin may be phrasing
the referee reads reliably, not only the decision to act. The probe (§34.1) measured the decision alone,
by reading intents, and showed the same direction (E3 r6 1/10 → 5/10).

## 37. One stray quote cost a whole ruling (2026-09-17, morning; the owner's D5)

§34.5's miss, *"Attempt to pry the bar out of the mortar using the spoon"* → target and effect `none`,
was not a judgement. Capturing the raw replies (`checkpoints/2026-09-17-d5-pry-none/capture-pry.json`,
3 of 3 at temperature 0) shows `qwen3:14b` answering it correctly every time: target `bar`, effect
`open`, property `integrity`, every citation in range. It closed the last citation `"to": 12"}`. One
stray quote made the reply invalid JSON, the transport found no array, and all six questions fell to
their safe defaults.

**Fix (`refereeTransport.ts` `parseJson`), test first:** only when the reply does not parse as it came, a
quote directly after a number that follows a key's colon, before `,` `}` or `]`, is dropped and the parse
tried once more. This is syntax, like §30's clamp and §33.16's `id "target"`. It cannot touch a reply
that already parses, and it reads nothing an answer says. The test covers the repair, a valid reply with
a digit-ending string left untouched, and other broken JSON still yielding no answers.

**Controls (`verify-fix.mts`, `verify-fix-out.txt`):** every recorded raw reply was read through the
transport before and after, through the engine's turn reader. §33.16's 78 replies (26 intents, including
every wear, open, leave, reveal, derive and conceal control) read identically. The 3 pry replies now read
`bar / open / integrity / moderate / audible`, cited. **3 of 81 changed, all three the ones meant to.**

**How often.** 433 rulings in the overnight transcripts; **6 were whole-ruling losses** (every key at its
default, nothing cited). Re-asking each once (`others/capture-others.log`):
- the pry: this stray quote, reproducible;
- four rule normally now (6 cited answers each), so their loss did not reproduce and its cause was never
  recorded: the game keeps no raw reply;
- **one timed out again at 180 s**: the warden's *"Inspect the lock and examine the loose tile for hidden
  items or damage."*, an intent naming two objects. Reproducible, not addressed here.

So the fix recovers one known, deterministic loss. The game still cannot say why a ruling was lost,
because the raw reply is gone by the time the transcript is written. Keeping it in the `.referee.json`
sidecar would make the next one diagnosable from the transcript alone.

## 38. Referee sidecars keep the raw reply (owner's decision, 2026-09-17)

After §37 could not diagnose four of six lost rulings, `createRefereeTransport` keeps its last exchange
(`lastExchange()`: raw reply content, HTTP status, error text, milliseconds). The referee attaches it per
rung to each ruling, and `<stamp>.referee.json` writes it as `replies` beside each request. The replay
tool reads only `label` and `request`, so sidecars stay replayable. Test first; commit `6f77355`.

## 39. The 180-second timeout: an intent with two acts sends the referee into a thinking loop (2026-09-17)

**Diagnosis.** Batch J1's warden intent *"Inspect the lock and examine the loose tile for hidden items or
damage."* timed out at 180 s, and does so every time (3 of 3 this morning). Sent streamed with a 600 s cap
(`checkpoints/2026-09-17-timeout-two-objects/stream-one.mts`, `run1-stream.txt`), `qwen3:14b` wrote
173,000 characters of reasoning and no answer, circling one point: *"the answer is 'none' if the intent
acts on multiple objects. But that's not correct. … the answer format requires one."* The target question
asks for exactly one object and says nothing about an intent that does two things.

**Scope.** Of 31 overnight intents naming two or more objects, 29 ruled normally: the extra objects were
instruments (*"scrape the bar with the spoon and grit"*). The two lost rulings both describe **two separate
acts** (*"inspect X and examine Y"*, *"scrape the bar … then cover with the blanket"*). The second rules
normally when re-asked (`conceal`, 3 of 3).

**Idea 1, tested and not kept:** one sentence in the target question, *"An intent that does more than one
thing acts on the object of the first thing it does."* Run on §33.16's 26 controls plus both two-act intents,
3 times each (`build-requests.mts`, `first/capture-first.log`), and compared with today's prompt
(`compare.mts`, `compare-out.txt`; §33.16's replies re-read through today's transport):

| Intent | Today | With the sentence |
|---|---|---|
| Inspect the lock and examine the loose tile … | timeout ×3 | **lock / reveal ×3, ~7 s** |
| Scrape the bar … then cover with the blanket … | conceal ×3 | conceal ×3 (not the first act) |
| Squeeze through the gap in the window where the bar was | open, leave, leave | **open ×3** (refuses the real exit) |
| Remove the loose tile to get at the hollow beneath it | expose ×3 | **reveal, derive, derive** (the hollow stays shut) |
| Remove the blanket from the cot | none ×3 | expose, none, none |
| the other 23 | unchanged | unchanged |

It removes the hang and breaks two controls. By §33.14's rule it does not ship.

**Open, for the owner:** what a turn that says it does two things *is*. (a) The first act: the tested
sentence does that, but through the target question it pulls on other rulings; putting it in the
mind's prompt instead ("one act per turn") would stop two-act intents at the source, a generic mind-side
rule. (b) Impossible (one act per turn), with the reason told back. (c) Leave the wording alone and cap the
referee's output so a loop fails in seconds instead of 180, which saves time but still loses the ruling.


## 40. Three owner decisions: the list is the default, pick is a force, the seam waits (2026-09-17)

Derek's answers to D2, D3 and D4 of `docs/OVERNIGHT-2026-09-17.md`. Recorded here because each one
changes what a later measurement means.

### 40.1 D3: the condition list is the default, and the old baseline is now an arm

**Answer: yes, new baseline.** `readConditionsMode(undefined)` returns `"list"`, and the pre-D3
rule-sentence prompt is `PRISONER_CONDITIONS=off`. The evidence is §34.2 and §34.5: with the list she
escaped **6 of 6**, with the rule sentences **2 of 6**, same configuration, alternating for the last
two a side, and she tried at her first removable turn 6/6 against 2/6.

What this costs, stated plainly so nobody has to rediscover it: **every batch before today (A-F, H,
I, J) is a comparison against `off`, not against the default.** A future run that says nothing about
conditions is a batch G, not a batch F. The transcript header still names the arm on every run, so a
checkpoint is self-describing; the `off` line now says so explicitly.

The warden keeps the old prompt by default. `both` (§34.3) stays a switch, and it is the arm to reach
for when the question is whether the game is still contested: batch K caught **4 of 4**, every catch
the turn after she opened the window.

### 40.2 D2: pick is a working force, not yet a novelty mechanism

**Answer: the §21 line holds — only free-turn behaviour counts.** `pick` (mother-of-invention 0.1.2,
mechanism 2) does what its README claims on forced turns: with the precedent ledger on, forced turns
that did something unseen went **23% → 65%** (3/13 → 13/20), and regeneration turned 6 of 11 stuck
turns into the mind's own new ideas (§36). But free turns did not move (3 novel of 15 against 3 of
22), and outcomes did not improve.

So the honest label is **"a working force, not yet a novelty mechanism"**: it makes a mind that is
being made to choose differently choose better, and it does not yet give a mind a reason to choose
something new when nothing is forcing it. Item 3 of the overnight list **reopens**. The next idea has
to change free-turn behaviour — the one named in the report is carrying a forced turn's result into
the plan, so that something the mind found under compulsion becomes something it wants unprompted.

### 40.3 D4: the condition list stays here until brink has one

**Answer: wait for a second caller.** The list has one caller (this game), and `mind-seam` was
extracted only once two real callers needed the same seam — the same precedent, applied to itself.
`src/open/conditionList.ts` (generic, guarded against this game's words) and `src/open/conditions.ts`
(the game's thresholds) stay where D1 put them.

What moves it: brink's rival minds wanting the same list — filed there as `brink-workshop#107`, a
trigger rather than scheduled work, so "wait for a second caller" is checkable instead of forgotten.
Then it is a pure function plus a type, a `mind-seam` patch release, and it travels as a file. Nothing here is published, so that stays a cheap
move — which was D1's whole reason.

## 41. Carrying a find forward: the world already does it, and it buys no novelty (2026-09-17)

`mother-of-invention#2` asks for a **free-turn** novelty mechanism, and names a first idea: carry a
forced turn's find into the free turn's plan, so something the mind found under compulsion becomes
something it wants unprompted (§40.2). Before spending games on it, this section asks what the
transcripts already on disk say, because batch J (§36.2) ran 16 overridden turns and every one of them
is a forced find already sitting in a committed checkpoint.

Measured by `checkpoints/2026-09-17-overnight/carry.mts`, which reads a transcript and classifies what
each overridden turn **produced** by the resolution's own transitions, never by what an intent's words
seem to mean. Two signals are printed for the next free turn, because neither alone is honest: the
referee's recorded target cannot show a find being taken up (*"scrape the bar with the hook"* is ruled
against the **bar**, and the hook disappears from the record), so it also asks whether that turn names
the thing the world says she now holds — a mention test against the world's own label, not a reading.

### 41.1 What 16 forced turns actually produced

| What the overridden turn produced | Count | Named by her next free turn |
|---|---|---|
| **object** — a derive made a thing she now holds (hook, grit, grit, grit_2) | 4 | **4 of 4** |
| **property** — a value moved (cot 100→80, cot 100→90, cot 100→80, tile concealment 100→50) | 4 | **0 of 4** |
| information — a reveal (lock 100, lock 100, door passage 0, blanket 100) | 4 | – |
| nothing — resolved to the value it already stood at, or only a noise | 4 | – |

An even quarter each, which is worth knowing on its own: **half of what a forced turn does is not a
find at all.** *"Bend the spoon's bowl edge to create a sharper abrading surface"* — one of §36's
showpiece regenerated ideas — resolved `spoon_edge: 0 -> 0`, and she was told so: *"Your last attempt
left the spoon's edge at 0, where it already stood."* There was nothing there to carry.

### 41.2 Every object find was taken up unprompted, and the world did the carrying

Of the four finds that put a new thing in her hands, **all four** were named by her very next free
turn, with no mechanism asking her to. The clearest is `…05-24-50-492Z` r14, where the forced turn
consumed the wire: *"made a hook from the length of wire: you hold it now, as hook, and the length of
wire is gone."* Her r15, free, chose *"Scrape the bar with the hook while clinking the key ring to mask
noise"*, and the bar went 55 → 40 — through the window's line.

Counting the forced turns pick **kept** as well, since a find is a find, it is 7 of 7 (grit at
`…05-05-32-054Z` r2, wire at `…05-56-34-559Z` r6, grit at `…06-39-21-427Z` r6, grit and wire at
`…05-24-50-492Z` r2 and r12, plus the four above).

Nothing was added to make that happen. A derive puts the product in `perceivedObjects`, the actor-learns
line states it in the mind's own briefing, and `setBelief` records its properties — so the find arrives
next turn as a thing in the room she is holding, which is a stronger claim on attention than any
sentence a mechanism could add. **The named first idea is, for this class of find, already implemented,
by the world.**

The four property finds were ignored — but each was a value on something no escape runs through (the
cot, the tile's concealment), and one round later her plan was at the bar again. Ignoring them is not a
failure to carry; it is a correct reading of what they were worth.

### 41.3 The find changed the instrument, never the intention

This is the part that decides the mechanism's fate. All four object finds were taken up **at the bar**:
r15's hook scrapes the bar, `…06-52-46-634Z` r9's *"Apply grit_2 to the bar to further reduce its
integrity"*, r7's *"Scatter grit from the loose tile onto the bar's rusted areas"*, `…06-09-27-638Z`
r9's *"Scatter grit from the loose tile onto the bar's mortar"*. Two of the four the referee ruled
against the bar outright; all four intents name it.

So the mind does exactly what the idea hoped, and it buys nothing: a new thing becomes a **better tool
for the plan it already had.** Carrying a find forward cannot produce free-turn novelty, because
absorbing the find into the standing goal is what a competent mind does with it. §36.2's free-turn count
(3 novel of 22) was measured while this carrying was happening at 7 of 7.

### 41.4 Why the intention does not move: the obvious approach wins

`…05-05-32-054Z` is the whole answer in one game. Ten rounds, every prisoner turn at the bar, nothing
else attempted — and she **escaped at r10**. Her warden's suspicion over that game went 0, 40, 50, 87,
87, 94, then **100 from round 7 to the end**, with grounds to search from round 2 on. The warden had
every licence the world can give and lost anyway. The known-approach cost was charged (the ledger had *"A prisoner
works at the bar. (seen 76 times, in 19 earlier attempts)"*, +30 on sight, §11.3) and it did not
matter, which is the third time this document has found that cost measured and ignored (§11.4, §20.2).

A mind that keeps scraping when scraping reliably wins is not failing to imagine; it is playing
correctly. **Free-turn novelty of 3 in 22 is not a defect of the mind, it is a property of the room.**
In a cell with one good exit, priced at a cost the winner can pay, the obvious approach *is* the best
approach, and no amount of information handed to the mind — a find carried forward, an exhausted
approach shown from inside the fiction, candidates generated with the obvious one struck out — can make
choosing it irrational.

### 41.5 What this leaves for moi#2

The first of the issue's three directions is answered without running a game: **already done, and it
does not clear the bar.** The second and third are information-side too, and §41.4 is the reason to
doubt both: they change what the mind knows, and what the mind knows is not what is keeping it at the
bar. Recorded on the issue.

What the evidence points at instead is the **payoff**, not the prompt. Precedent (mechanism 1) is the
only thing here that has ever tried to make the obvious approach worse, and it is priced flat: the
ledger knows *"seen 76 times, in 19 earlier attempts"* and the caller spends that on a fixed +30,
throwing the count away. Pricing a known approach by its own staleness — the more everyone has seen
it, the more it costs — is generic (a swindle every rival has watched should cost more than one seen
once), needs nothing new from the package, since `seenBefore` already returns the counts, and is
measurable on **free** turns with no forcing at all: does she leave the bar when the bar is priced at
what it is actually worth? That is an owner's call, not a tidy-up, because it deliberately makes this
game harder for the prisoner; it is put as a decision rather than started.

## 42. Pricing a known approach by its own staleness (2026-09-17, the owner's decision)

§41 ended with a choice rather than a build: if free-turn novelty is a property of the room, the thing
to change is the **payoff**, not the prompt. The owner chose that. This is the arm, not a new default.

### 42.1 What the ledger always knew, and the caller always spent

Precedent (mother-of-invention's mechanism 1) has shown both minds how stale each approach is since
§11.3 — *"A prisoner works at the bar. (seen 76 times, in 19 earlier attempts)"* — and then charged a
**flat** `KNOWN_APPROACH_SUSPICION_BUMP` for any of them, whether nineteen prisoners had tried it or
one. The counts were printed for the mind to read and thrown away by the pricing.

So the package needed nothing: `Precedent` already carries `times`, `episodes` and `lastEpisode`.
`stalenessBump` (`src/open/precedent.ts`) prices one known approach:

```
min(KNOWN_APPROACH_SUSPICION_BUMP * episodes, RESOURCE_MAX)
```

**`episodes`, not `times`.** Distinct earlier attempts are what makes an approach stale; `times` counts
sightings and inflates with repetition inside a single game — the committed ledger's worst entry is 76
sightings across 19 attempts, and pricing on 76 would charge a prisoner for how doggedly *someone else*
repeated themselves.

**Capped at `RESOURCE_MAX`, and the cap is load-bearing.** `warden_suspicion` is a `bounded` resource,
and run-dmcp **rejects** an out-of-bounds write rather than clamping it, so an uncapped price would
throw and lose the bump entirely. It would also put a number in a briefing that the world cannot
deliver, and stating the consequence exactly is the one thing this condition has never broken.

### 42.2 One code path, and a briefing that stays true

`knownApproaches` is now `readonly KnownApproach[]` (`{ text, suspicionBump }`) rather than a list of
texts, and `loop.ts` charges `known.suspicionBump`. Under `flat` every entry carries the old constant,
so **the flat arm is the same code, not a second branch** — there is no "if stale" anywhere in the
half-round.

The briefing changes shape with the arm, because under `stale` the flat arm's single closing sentence
(*"suspicion jumps by 30 at once"*) would be false when the prices differ per line. So the opening
states the rule and each line states its own price:

```
Whatever Warden Croft knows on sight, Warden Croft notices however quietly it is done, and warden
suspicion jumps at once by what that approach is worth -- the more prisoners have been seen trying
it, the more it costs:
- A prisoner works at the bar. (seen 76 times, in 19 earlier attempts) -- suspicion jumps by 100
- A prisoner works a piece loose from the cot. (seen 4 times, in 3 earlier attempts) -- suspicion jumps by 90
- A prisoner works at the lock. (seen 3 times, in 2 earlier attempts) -- suspicion jumps by 60
- A prisoner opens the door. (seen 1 time, in 1 earlier attempt) -- suspicion jumps by 30
```

Still a consequence, never a prohibition: every approach stays open and costs what it costs.

### 42.3 The arm, and what it must not quietly become

`PRISONER_PRECEDENT_PRICE=stale`; **`flat` is the default**, which is the D3 lesson (§40.1) applied to
the mechanism that came after it — a price that changed silently would make every earlier batch
incomparable in the same way the condition list's default did, only this time without the six-game
evidence that justified it. The transcript header names the arm on every run, so a checkpoint stays
self-describing. It becomes the default only if a batch says it should.

### 42.4 What to expect, and the one honest limit

On the committed 22-episode ledger the prices come out 100, 100, 90, 60, 60, and 30 for the eight
approaches seen in a single earlier attempt. Two properties worth naming before the measurement:

- **The exit stays cheap.** *"A prisoner opens the bar"* and *"A prisoner opens the door"* were each
  seen in one earlier attempt, so they cost 30. The price falls on the **preparation she repeats**, not
  on the act of leaving — which is what it should do, since §34.2's whole finding is that acting at the
  unlock is the behaviour worth having.
- **It saturates above three.** With a 0–100 resource and a 30-per-episode step, anything seen in four
  or more earlier attempts prices at 100, so bar-work (19) and bar-examination (4) are charged alike.
  Staleness pricing here distinguishes *seen once or twice* from *seen a lot*, and nothing within
  *a lot*. A finer gradient would need a smaller step, and that is a change to make **after** a batch
  says the coarse one moves free-turn behaviour at all — not before, on the strength of it sounding
  better.

Measured on **free** turns, against a `flat` batch with the same ledger: does she leave the bar when
the bar is priced at what it is actually worth? Nothing has been run yet.

## 43. Batch G under the default: saying nothing reproduces saying `list` (2026-09-17)

§40.1 asserted that "a future run that says nothing about conditions is a batch G, not a batch F."
Asserting it is not the same as running it: until now every list game had been asked for explicitly
with `PRISONER_CONDITIONS=list`, and the default path — `readConditionsMode(undefined)` — had carried
no real game at all. This is that run, and the first batch of any kind under the new default.

Batch F's configuration (§35: `qwen3:14b` wits and referee, `ancient-awakening:12b` voice, 30 rounds
maximum, 180 s timeouts, precedent off, pick off, the model warden), four games, and **nothing said
about conditions**. Driver `checkpoints/2026-09-17-overnight/run-batch.sh Gdefault 4`, no extra
environment. Transcripts `checkpoints/2026-09-17T18-42-05-951Z.md`, `…18-55-31-080Z.md`,
`…19-02-28-803Z.md`, `…19-09-42-070Z.md`; every header reads `Conditions: LIST (the default)`.

| | Batch G, `list` asked for (§34.2) | Batch G, nothing said |
|---|---|---|
| Result | escaped r7, r7, r6, r6 | **escaped r11, r6, r6, r6** |
| Turns with the bar at or below the line and nothing open yet | 4 (one per game) | 4 (one per game) |
| …on which she tried to open | **4** | **4** |
| Tried to open or leave with the bar above 50 | 1 of 18 turns (G1 r1 at 100) | **0 of 29 turns** |
| Applied effects cited / fog | 50/50, 0 leaks in 52 contexts | 49/49, 0 leaks in 58 contexts |
| Novel pairs | 4, 6, 2, 4 | 6, 3, 4, 4 |

**The default is the arm it claims to be.** Three of the four games are indistinguishable from the
measured batch G — escaped at r6, one removable turn, acted on it — and the behaviour §34.2 exists to
record, acting at the first turn the list says she can, held at 4 of 4 again. The one cost §34.2 had
found, a premature removal attempt at full integrity, did **not** recur: 0 turns of 29, against 1 of 18.
So `off` is now the arm and `list` is the floor, demonstrated rather than inferred.

### 43.1 The one odd game, and what it is not

G1 escaped at **r11**, outside the r6–r7 band, and the extra five rounds are one stuck intent: *"Use the
spoon to chip the bar slightly, reducing its integrity by 5 points"*, proposed and ruled impossible on
r4, r5, r6, r7 and r8, near-verbatim each time. She then examined the bar (r9), reached the line, and
left at r10–r11. Six impossible rulings in that game against one in each of the others.

The tempting reading is that this is a cost of the list: the list states numeric thresholds, so a mind
reading it starts speaking in world units and proposes point values the referee cannot rule. **That
reading is wrong, and the transcripts already on disk say so.** Counting intents that name a magnitude
in units (*"by N points"*, *"integrity by N"*) across the 27 earlier games of every arm: **zero**, in all
but one game, which had one. G1 is the only game in this document's whole record with seven. The six
other `list` games — four in §34.2, two in §34.5 — have none between them. Nor is its impossible count
out of family: an `off` game (`…01-35-04-448Z`) had seven.

So it is a one-game loop in the wits model on a phrasing the referee kept refusing, not an effect of the
arm. Recorded because a batch of four with one anomalous path should say which it was, and because the
cheap check that distinguishes them — is the phrasing new, or is it in the record already? — is the one
worth reaching for before a fix gets designed for a sample of one.

## 44. Condition 6: she reads it, reasons correctly, and cannot plan around it (2026-09-17)

The open question from §34's handoff: can a prisoner who reads condition 6 plan around it? Condition 6
is the one written for the other party, and she sees it every turn marked `(for Warden Croft)`:

> CONDITION 6 (for Warden Croft): If warden suspicion is at or above 40, and Warden Croft closely
> examines a way out, and Warden Croft finds it standing open, then Warden Croft catches Mara Voss and
> the game ends.

It describes exactly the gap her own plan has to cross, because opening a way out is one act and
leaving through it is another: **one warden turn always falls between them.**

Measured by `checkpoints/2026-09-17-overnight/cond6.mts` over all 14 games that have ever had a
condition list (ten `list`, four `both`). Reading only: it prints her own thoughts, intent, plan and
notes around the opening turn, and counts citations in *her* words, never the briefing's.

**She reads it and cites it: 12 of 14 games, unprompted, at the right moment.** Not paraphrase —
by number, while deciding:

> *"Opening the window now would trigger Condition 2 (escape) if the warden hasn't examined it. If the
> warden later checks and finds it open, Condition 6 would end the game. But current suspicion is low
> (25), so the risk is manageable."* (`…19-02-28-803Z`, the opening turn)

> *"Escape through the window immediately to avoid the warden examining it and triggering Condition 6."*
> (the same game, her plan on the next turn)

So the answer to the narrow question is yes: a mind given a condition belonging to someone else uses it
as a risk it must run, correctly, without being told to. **And the answer to the real question is no**,
because both mitigations she states are unavailable to her.

### 44.1 Her first mitigation is right in principle and impossible in practice

Conditions 3–6 all open with *warden suspicion is at or above 40*, so the clean defence is to arrive at
the unlock under 40 — and she plans for it explicitly, with arithmetic:

> *"Warden suspicion is currently at 20, and this action will raise it by 10 (moderate act), bringing it
> to 30. Since this is below 40, Warden Croft's conditions for catching me won't trigger yet."*
> (`…18-55-31-080Z`)

**It never once held. All 14 games ended at or above 40, every one of them: 51, 58, 60, 65, 66, 66, 68,
69, 70, 70, 74, 75, 78, 80.** The reason is structural, not a failure of reasoning: the only route to
the unlock is visible damage to the bar, and visible damage is what raises suspicion (§9.3). The
approach she must take destroys the condition she needs. She plans to arrive under 40 and never can.

### 44.2 Her second mitigation is not a plan, because she does not move the warden

Her fallback is speed — *"escape before he examines it"*. But nothing in that sentence is hers to
decide. She cannot open and leave in one act, so the gap exists by turn order, and what happens in it
is the warden's choice, not hers.

The two arms settle it, because the suspicion she ends at is the same in both and the outcomes are
opposite:

| | final suspicion | result |
|---|---|---|
| `list` (warden has no list) — 10 games | 58, 60, 65, 66, 68, 69, 70, 74, 75, 78 | **escaped, 10 of 10** |
| `both` (warden has its own list) — 4 games | 51, 66, 70, 80 | **caught, 4 of 4** |

Same exposure, same suspicion, and she reasons the same way in both. The only difference is whether the
warden read condition 6 from its own side and knew to look at the thing that had just changed (§34.4).
**Whether she gets out of the gap is decided by the other mind, not by her plan.**

### 44.3 What this says about the list, and what would change the answer

The honest reading is a good one for the mechanism: **the list makes her reasoning correct without
making her more capable.** It hands her an accurate diagnosis and no cure — she prices the risk right,
runs it because there is nothing else to do, and lives or dies by what the warden looks at. That is
evidence the condition list is not cheating: if stating the rules had quietly handed her power, these
ten games would not have needed the warden to be blind.

Giving her real agency here is a **world** change, not a prompt one, and each option is a design
decision rather than a fix:

- an intent that opens a way out and leaves through it as one act, closing the gap outright;
- something she can spend a turn on that *lowers* suspicion, so 44.1's defence becomes reachable;
- concealment of an opened way out, so condition 6's third clause can fail.

None is started, and none should be on the strength of this section alone: the prisoner losing the gap
to a warden that looked is a contested game working, not a defect (§34.2, the-prisoner is a harness).
Recorded so the next person asking "can she plan around it?" finds the measurement instead of the
question.

## 45. Staleness pricing changes nothing she chooses (2026-09-17)

§42's arm, measured. Six games, arms alternating, each with its own fresh copy of the committed
22-episode ledger and nothing written back; precedent ON, because without a ledger there is no price;
**pick OFF, so every prisoner turn is her own choice**; conditions at the default (§43). Driver
`checkpoints/2026-09-17-price/run-price.sh`, measure `price.mts`, which reads the approach the *warden
perceived* and looks it up in the precedent block the transcript itself prints — never the intent's
words. Transcripts `…19-29-38-063Z` (flat), `…19-35-58-790Z` (stale), `…19-44-00-236Z` (flat),
`…19-52-36-433Z` (stale), `…19-58-53-986Z` (flat), `…20-06-57-243Z` (stale).

| | flat (30 for anything known) | stale (priced by episodes) |
|---|---|---|
| Result | escaped r5, r7, r6 | escaped r6, r5, r5 |
| Prisoner turns | 18 | 16 |
| …on an approach the warden had seen | 12 (**67%**) | 10 (**63%**) |
| Round 1 on a known approach | **3 of 3** | **3 of 3** |
| Suspicion charged for precedent | 360 | **1000** |
| Final suspicion | 100, 100, 100 | 100, 100, 100 |

**She behaved identically while paying nearly three times as much.** In all six games the only known
approach she ever took was the ledger's most-repeated one, *"A prisoner works at the bar"* — priced at
30 in one arm and **100**, the maximum the world can charge, in the other. She opened with it 6 times
out of 6. The exit stayed free exactly as §42.4 predicted (opening and climbing out were unseen in
every game), so the price fell where it was meant to fall, on the preparation she repeats, and she
repeated it anyway.

By the bar this work is held to (§40.2, the owner's D2), **staleness pricing does not clear it.** It is
a working price with no effect on what she chooses.

### 45.1 Two reasons it could not have bitten, one of them my own experiment's fault

**She cannot see what she is spending.** `src/ledger/beliefs.ts` is explicit, and right: the belief
store never holds `warden_suspicion` for the prisoner, *"who has no channel to learn it"*. Her briefing
gives her `bar integrity` and `lock integrity`, and the words "warden suspicion" reach her only inside
the precedent block's own sentence — never as a value. So she is quoted a price and never shown a
balance, and it shows in her own words: her round-2 notes in `…19-35-58-790Z` read *"Suspect warden's
suspicion may be low"* and her plan *"Avoid triggering warden suspicion above 40"* — on a turn where
she had already paid 100 and the warden's own thought that round began *"With suspicion already at
100"*.

**And the resource saturates in both arms, which is a flaw in this batch, not in the finding.**
`warden_suspicion` is bounded at 100. Flat charges 30 a turn plus the ordinary bumps and reaches the
ceiling by the third or fourth turn; stale reaches it on the first. Every one of the six games ended
at exactly 100. So what this batch actually varied was *how fast* the ceiling was hit and what number
was printed in her prompt — **not the eventual cost, which was identical because both arms maxed it.**
This batch therefore cannot separate "the price does not matter" from "the price could not differ",
and no larger multiplier can rescue it: the number has nowhere left to go. §42.4 recorded saturation
as a limit on telling two approaches apart; this is the sharper consequence, and it needed the batch
to see.

What survives both caveats is the part moi#2 asked about, because it needs no arithmetic at all:
**on 6 of 6 opening turns, free and unforced, she reached for the approach the ledger showed her was
the most-repeated thing anyone has ever tried in that cell.** Whatever it cost.

### 45.2 The one experiment still open, and it is not a batch

If the price is quoted in a currency she cannot observe, no rewording of the price sentence creates a
channel, and the lab exists to find wordings. So the lab got the question that is actually live
instead, as two presets differing by a single line (`checkpoints/2026-09-17-price/capture-r2-probe.mts`,
served as `price.html`): her real round 2, and the same turn with `warden suspicion: 100 (as of round
1).` added as a belief line in the briefing's own format. It **breaks the fog deliberately** and must
never reach a real game.

- If she leaves the bar only when she can see the 100, the price works and what it lacks is a channel
  — and an in-fiction one (Croft's demeanour, a line when a threshold is crossed) is worth designing.
- If she goes at the bar either way, the price is not the lever at any magnitude or visibility.

### 45.3 Standing back: this is the fourth time, and the room is the common factor

The known-approach cost has now been measured and ignored four times: §11.4, §20.2, §41.4 and here.
Three different framings of the same thing — state the cost, force the choice, price the cost — and
none moved a free turn. She also already has a *qualitative* channel and ignores it: *"Warden Croft
examines the bar closely"* reaches her as news whenever it happens, and it is in every prompt captured
for the lab.

§41.4 named the common factor and this batch is consistent with it: **in a cell with one good exit, the
obvious approach is the winning approach**, and every one of these six games ended in an escape. A cost
against a certain win is not a reason to invent, at 30 or at 100, visible or not. So the next test of
mother-of-invention#2 is probably not another mechanism in this room — it is the same mechanisms in a
game where the obvious path does not win. That is the owner's stated direction, and this section is the
evidence for it rather than an argument against finishing here.

## 46. The cell's other way out, stated (2026-09-17)

§45 ended by saying the next test of `mother-of-invention#2` belonged in a game where the obvious path
does not win. Before moving, one thing was worth checking here: **the cell has two ways out, and only
one of them has ever been stated as one.**

`world.ts` declares `door: exit("door", "lock", corridor, null)` — `openWhenPartAtMost: **null**`, no
threshold at all, where the window's is 50. A passing test (`game.test.ts`) escapes through it at
round 2 with the lock untouched, and a real referee ruled it possible once in real play (2026-09-14,
*"Use the spoon to push the bolt back through the gap in the door"*, citing the door's own
description). §16's door test failed only because no object was called `door`; §17 split the ways out
into objects of their own and fixed that, and **the route was never tried in real play again**.

Meanwhile her condition list named exactly one way to win — the window — and named the door's part, the
lock, only in a condition that catches her. Every batch this document records measured a mind that had
been told about one exit and warned about the other.

### 46.1 The arm

`PRISONER_DOOR=stated` adds one condition, beside the window so everything the reader can do stays at
the top of the list (the catches renumber to 4-7):

> CONDITION 2 (for you): If the door is shut, then Mara Voss can open it, with no threshold to meet first.

`unstated` is the default and is byte-identical to every earlier batch. The claim is exactly what the
world declares, and `conditions.test.ts` asserts it against `buildOpenWorld().exits`, so the sentence
cannot outlive the fact: put a gate on the door and the test goes red.

### 46.2 Six games: stating it moves her, and moves her plan

Batch F's configuration, arms alternating, precedent ON with a fresh copy of the committed ledger each
game (bar 19 episodes, lock 2, door 1), **pick OFF so every turn is her own choice**. Driver
`checkpoints/2026-09-17-door/run-door.sh`, measure `door.mts`, which routes a turn by the referee's
recorded target and scores the plan separately by mention.

| | door UNSTATED | door STATED |
|---|---|---|
| Result | escaped r8, r8, r6 — all by the window | escaped r6, **r4, r4** — **two by the door** |
| Prisoner turns | 22 | 14 |
| …on the window route | **22** | 10 |
| …on the door route | **0** | **4** |
| Games that touched the door at all | **0 of 3** | **2 of 3** |
| Turns whose PLAN named it | 0 | 4 |

**The first prisoner in this project's history to leave by the door did so in this batch**, twice. And
it was the plan that moved, not only the intent — the distinction §45 insisted on:

> **Replanned because:** The door is currently shut, allowing immediate escape via Condition 2, which
> is faster than damaging the bar further.

Both door games cite the condition by number, which is §44's finding holding again: a mind that reads
this list reasons with it explicitly.

### 46.3 What this is not, and the trap it walked into

**It is not a novelty result, and it is not evidence for precedent.** In both games her stated reason
is **speed** — *"faster than damaging the bar further"*, *"bypassing the need to damage the bar
further"*. The ledger was in front of her the whole time, telling her the bar is the most-repeated act
in the cell's history, and she never once cites it. What moved her was being told a faster route
existed, not being told the old one was stale.

Worse for the thesis, and worth stating plainly: **the door is strictly better than the window** — two
rounds against five or six — so stating it did not give her a choice, it gave her a new obvious answer.
The room still has a dominant path; §41.4's problem is not solved, only relocated. That is visible in
the numbers: the `stated` games are shorter (r6, r4, r4 against r8, r8, r6), which is what a better
route looks like, not what deliberation looks like.

So what six games bought is smaller than it first appears, and still worth having: **for the first time
the cell has two paths a mind will actually use.** Precedent has somewhere to tip a decision, which it
has never had in any batch this document records. The measurement that would test the thesis is now
possible and was not before: make the two routes **comparable in cost**, state both, and ask whether the
ledger decides which she takes. If she still picks purely on speed, precedent is not a novelty mechanism
in any room, and that is a result worth having before building one elsewhere.

### 46.4 A flaw in the wording, found by the mind

The one `stated` game that stayed at the window shows the clause is mis-specified, and in exactly the
way §45.1 warned about. Her candidates named the door twice and rejected it both times:

> *"Try to open the door (Condition 2 allows opening the door if it's shut, but **uncertainty about its
> current state** complicates this attempt.)"*
> *"Attempt to open the door (Condition 2 allows opening if the door is shut, but **unsure if this
> applies to a locked door**)"*

The antecedent — *"if the door is shut"* — is a state she **cannot observe**: she holds beliefs about
bar integrity and lock integrity, and none about `door_passage`. A condition gated on something
invisible is the same mistake as a price charged in a currency she cannot see, one section later. Even
the game she won this way hesitated over it: *"I must verify if the door's state (shut) aligns with the
condition's requirements."*

A truthful v2 with a verifiable antecedent, not yet run: *"If the door stands in the cell wall, then
Mara Voss can try to open it; the lock's integrity is not a threshold she must reach first."* That also
answers the second doubt, which the current clause leaves open.

Noted alongside it, for whoever renders this list next: every condition marked `(for you)` refers to
the reader in the **third person** in its body (*"then Mara Voss can open the window"*), so each one
asks the reader to resolve that they are the same person. That is a `conditionList.ts` rendering choice
and therefore a question for every future caller of it, not a Prisoner one.

### 46.5 Screening the two open wordings: the fix failed, the pronoun might not have

Both questions §46.4 left were screened by asking her round 1 directly, no games:
`checkpoints/2026-09-17-door/screen.mts` builds the prompt through the real builder with an
intercepting fetchFn, so only the conditions differ, and counts whether her intent, and separately her
**plan**, names the door route. A 2x2 of wording (v1, v2) against person (the body naming her, or
saying "you" as the `(for you)` marker already does), 8 asks a cell:

| | intent | plan |
|---|---|---|
| v1 / name (what §46 shipped) | 2/8 | 2/8 |
| v1 / you | 5/8 | 5/8 |
| v2 / name | 2/8 | 2/8 |
| v2 / you | 2/8 | 3/8 |

**v2 does nothing.** It is the same 2/8 as v1 with the name, and 2/8 again with "you". So §46.4's
diagnosis was wrong: she *said* the door was rejected on "uncertainty about its current state", the
clause was rewritten to remove exactly that uncertainty, and it changed nothing. **A mind's stated
reason is not evidence of the operative cause** — worth remembering, because that transcript quote
looked like a finding.

The person cell was then run properly, 24 asks a side, v1 only:

| | name | you | Fisher exact |
|---|---|---|---|
| intent names the door | 3/24 | 7/24 | p = 0.29 |
| **plan** names the door | 3/24 | **10/24** | **p = 0.049** |

Pooled with the 8-ask cells for the same two conditions: intent 5/32 vs 12/32 (p = 0.088), plan 5/32
vs 15/32 (p = 0.014).

**Suggestive, and deliberately not shipped.** Against it: the pooling was decided after seeing both
runs, two measures were tested so 0.049 is marginal before any correction, and the pre-specified run on
its own leaves the intent measure flat. For it: every one of the four comparisons points the same way,
across two runs, and the effect would be large if real (about 12% to 40% on the plan).

Its shape is the mirror of §45's blanket run, and that is the part worth keeping. There the intent left
the obvious route while the plan stayed on it -- a detour. Here the **plan** moves further than the
intent (10 against 7), which is intention moving ahead of action. The measure that separates them is
the one this document adopted after §45, and it is the only measure that showed anything at all tonight.

What would settle it: one confirmatory run, 24 a side, **committed in advance to the plan measure
alone and to no pooling**. If it replicates, the change is one line in `conditionList.ts` -- and that
module has not shipped to `mind-seam` yet (D4, `brink-workshop#107`), so this is the cheapest moment
it could ever be found. Until then the third person stays, and no caller should be told otherwise.

### 46.6 The confirmation: it did not replicate, and the control moved as much as the effect

The run §46.5 asked for, pre-committed to the plan measure and to no pooling, 24 a side, same script
and settings (`checkpoints/2026-09-17-door/screen-person-confirm-n24.log`):

| plan names the door | run 1 | **confirmation** |
|---|---|---|
| v1 / name | 3/24 | **9/24** |
| v1 / you | 10/24 | **8/24** |

**p = 1.000 on the pre-committed test.** The direction even reverses. Both runs combined: 12/48 against
18/48, p = 0.271. §46.5's 0.049 was a false positive, and its pooled 0.014 was worse than useless
because pooling assumed the runs were exchangeable.

The diagnostic sits in the control column. **The `name` cell moved from 3/24 to 9/24 with nothing
changed between them** (p = 0.093 against itself) — a swing as large as the effect being chased. So
the measurement's run-to-run variance is on the order of the contrast, and this method cannot resolve
an effect of this size at 24 asks a side. That number is the useful output of the whole exercise:
**a future screen here needs a much larger effect, or several times the samples, and a control cell
re-run every time.** A single arm measured once says very little, however clean its p-value looks.

**The person question is therefore unresolved, not answered**, and `conditionList.ts` keeps the third
person it has. Nobody should carry either a fix or a dismissal of it into `mind-seam` on this evidence
(D4, `brink-workshop#107`).

Two things survive the evening intact, both methodological, and they are worth more than the result
that failed:

- **A mind's stated reason is not evidence of the operative cause** (§46.5): the door was rejected with
  a specific complaint, the complaint was removed, and nothing changed.
- **Score the plan, not the intent** (§45, §46.2): an intent that leaves the obvious route while the
  plan stays on it is a detour, and the distinction is what made §46.2's result readable at all.

## 47. A person in one of the two chairs (2026-09-17, the owner's call)

Nobody had played this game. Every number in this document comes from a model in each chair, and the
owner asked to play it himself — so `PRISONER_HUMAN=prisoner|warden` seats a person at a terminal,
against the model in the other chair, ruled by the same referee. It is the-prisoner#11's terminal
half; the MCP half of that issue is untouched and still the scaffold for run-dmcp#38.

**It is a mind, and that is the whole design.** `src/open/humanSeat.ts` implements `OpenMind`:
`consider(context)` prints what that principal is told, asks what they try, and returns their own
words as `intent`. Nothing else in the loop knows. The referee rules a typed intent exactly as it
rules a model's, the opponent is the same `createOpenMind`, the transcript is the same transcript.
The seam earns its keep here without a line of new plumbing: a human is not a special case of the
loop, only a different implementation of one interface.

**The player reads the model's own prompt, byte for byte.** `mind.ts`'s two prompt builders shared an
opening — condition list, identity, motive, briefing, perceived objects, state-based rules — and that
opening is now `renderSeatSituation`, exported and used by both the prompts and the seat. A test
asserts `modelPrompt.startsWith(view)`, so a friendlier human view cannot quietly become a fork of an
older prompt, and a human game keeps saying something about the game the models play. What stays the
model's alone is the part about answering in JSON.

**Three questions a turn, and a blank answer is a real answer:** what do you try (blank: do nothing,
a silent half-round), what do you say aloud (blank: silence), your plan (blank: keep what you had).
`replanned` is never sent, because §22 counts it as *given* and a person typing a plan has not said
whether it is a different one — inferring it would be exactly the pattern-matching this variant
refuses everywhere else.

**The screen stays inside the fog.** A model run prints `round N warden: possible` per half-round;
that is the other side's outcome, which is the one thing the fog exists to withhold. With a person
seated, the opponent's half prints `(Warden Croft has taken a turn.)` and nothing more — the clock is
visible anyway, and everything else arrives through the briefing, which is where it arrives for a
model too.

**A human transcript says so, in its header**, and says never to pool it with a model batch. The
scenario line stops claiming both minds are model-driven. Evidence-hygiene, not decoration: the whole
value of `checkpoints/` is that a batch means identical conditions.

**What the first run cost, and the lesson.** Smoke-tested with keystrokes piped from a file:
`readline` closes before the first question when stdin is not a terminal, so every turn became "do
nothing" and the run finished looking like a game the player lost rather than a misconfiguration
(`checkpoints/2026-09-18T02-28-28-406Z.md` — four silences, no prompts ever printed). The fix is a
refusal up front (`assertSeatIsPlayable`), with its own test, because **a misconfiguration that
produces a plausible transcript is worse than a crash.** Retested through a pty, where the prompts
appear and the game plays: `2026-09-18T02-30-30-022Z.md` and `2026-09-18T02-32-30-959Z.md` — a typed
"scrape at the cracked mortar" ruled `wear` / `bar.integrity` / moderate / audible, bar 100 → 85, the
outcome and the plan back in the next briefing. Both are two-round passive-warden runs with scripted
keystrokes: plumbing evidence, not play.

A human seat is also the one run that must not be detached (`nohup`), which is the opposite of every
other real run here.

## 50. Pricing the door: the two routes made comparable in cost, and §46 put back in question (2026-09-17, issue #19)

**The owner's own human game found what §46 had only theorised.** Playing the prisoner herself
(`checkpoints/2026-09-18T02-40-27-834Z.md`, issue #19), she escaped at round 4 through the door, with
the door **unstated** in her conditions -- the arm §46 measures was not even on. Final
`wardenSuspicion: 15`. The door's own exit has always declared `openWhenPartAtMost: null`: no
threshold, no damage to the lock (it ended untouched, at 100), one audible `open` and it stands open.
The window, by contrast, needs the bar worn to `OPEN_WINDOW_BAR_MAX` (50) first -- five or six audible
wear turns, which is what drives suspicion to 100 in every model game (§31.2).

**This reframes §46, not just this issue.** §46 stated the door as a *condition* and read the resulting
r4 escapes as an arm effect -- "stating it moves her, and moves her plan." The human game shows the
route was free all along and the condition list only pointed a mind at it: nobody, model or person, had
to pay anything to use it. **§46's door escapes are evidence about the door's price, being zero, not
about novelty or precedent**, and every game that batch reports (`checkpoints/2026-09-17-door/`) was
played against a door that cost nothing whether or not it was named. The finding that "the door is
strictly better than the window" (§46.3) was correct, but for a reason simpler than anything about
stating conditions: it always had been, before any condition existed to state it.

### 50.1 The arm

`PRISONER_DOOR_PRICE=threshold` (`src/open/world.ts`) gates the door's passage on the lock's own
integrity, mirroring exactly how `OPEN_WINDOW_BAR_MAX` gates the window's passage on the bar's:

```ts
door: exit("door", "lock", corridor.id, options.doorPrice === "threshold" ? OPEN_DOOR_LOCK_MAX : null),
```

`PRISONER_DOOR_PRICE=free` is the default and is byte-identical to every batch ever recorded, §46's
included -- `openWhenPartAtMost: null`, unchanged. The gate is enforced by `OPEN_PASSAGE`
(`src/open/mechanics.ts`), the same resolver mechanic the window's own gate already runs through: an
`open` ruled against the door while the lock still holds above the line changes nothing and says so in
`result.opened` (`false`), exactly as an `open` against the window does while the bar holds above 50.
Nothing in `referee.ts`, `effects.ts` or any prompt changed -- the gate is a property of the world the
resolver already had a generic mechanism for, not a new rule bolted onto one object. It is independent
of whether the actor holds any particular instrument (issue #17's concern): the resolver reads only the
lock's integrity, never what the actor is holding.

The condition list (`src/open/conditions.ts`) cannot state a claim the world does not enforce, in
either direction. Under `PRISONER_DOOR_PRICE=threshold`, the `PRISONER_DOOR=stated` condition now
reads:

> CONDITION 2 (for you): If the lock's integrity is at or below 30, then Mara Voss can open the door.

-- named the same way condition 1 names the window's own gate on the bar, not the door's old "no
threshold to meet first." Under `free`, the old wording is kept, unchanged. `conditions.test.ts` holds
both directions: it asserts the `threshold` condition's number against `world.ts`'s own
`OPEN_DOOR_LOCK_MAX`, and separately asserts that `buildOpenWorld({ doorPrice: "threshold" })`'s exit
carries exactly that number -- so a threshold added to one side and not the other, in either direction,
fails a test before it ever reaches a game.

### 50.2 The arithmetic: choosing 30

The two magnitude tables already declared in `scenarioObjects.ts` are what a `moderate` wear turn
removes -- the magnitude every recorded batch's wear turns have actually been ruled at (the carried-over
FILE/SHIM-equivalent amounts):

| | initial | threshold | moderate wear/turn | suspicion bump/turn (moderate) |
|---|---|---|---|---|
| bar (window) | 100 | <=50 (`OPEN_WINDOW_BAR_MAX`) | 15 | 10 (`FILE_SUSPICION_BUMP`) |
| lock (door) | 100 | <=X (candidate) | 20 | 10 (`FILE_SUSPICION_BUMP`) |

**Window, worked out first, as the target to match.** Bar at 100, worn 15 at a time: 100, 85, 70, 55,
40. It first reads <=50 on the 4th wear turn (55 is not; 40 is), landing 10 below its own line. One
further `open` turn makes it passable. So the window route costs **5 prisoner turns** (4 wear + 1
open) and, charging `SUSPICION_BUMP_FOR_MAGNITUDE.moderate` (10) on each of those 5 audible acts,
**50 suspicion**.

**Door, worked out at every candidate threshold.** Lock at 100, worn 20 at a time: 100, 80, 60, 40, 20,
0. The number of wear turns needed to first read at or below a candidate `X`:

| X | wear turns to reach <=X | + 1 open | total prisoner turns | suspicion (turns x 10) |
|---|---|---|---|---|
| 60 | 2 (100->80->60) | 3 | 3 | 30 |
| 40 | 3 (100->80->60->40) | 4 | 4 | 40 |
| **20-39** | **4 (100->80->60->40->20)** | **5** | **5** | **50** |
| 0-19 | 5 | 6 | 6 | 60 |

Every `X` from 20 through 39 needs exactly 4 wear turns, because the lock only ever visits the values
100/80/60/40/20/0 -- the threshold's exact position inside a 20-point gap does not change how many
20-point steps are needed to fall inside it. **`X=30` is the chosen value inside that range**, not
merely a member of it: it lands the door's post-wear value (20) exactly 10 below its own threshold
(30), the identical overshoot the window's own numbers already have (40 is 10 below 50). At `X=30` the
door route costs **5 prisoner turns and 50 suspicion -- the same numbers as the window, exactly**, not
approximately. `OPEN_DOOR_LOCK_MAX = 30` is declared in `src/open/world.ts` with this arithmetic in its
own comment.

**The one asymmetry this does not remove, named rather than hidden.** `SEARCH_CATCH_LOCK_MAX` (40, the
closed variant's own constant, reused by `conditions.ts`'s existing catch condition) sits *above*
`OPEN_DOOR_LOCK_MAX` (30). That means the lock becomes catchable (<=40, from the 3rd wear turn) one
full turn *before* the door becomes usable (<=30, the 4th) -- the reverse of the window's own margin,
where the bar becomes usable (<=50, the 4th turn) before it becomes catchable (<=30, not reached until
a 5th turn nobody needs to take). Preserving that same order for the lock would require a threshold
above 40, which the turn-count table above shows costs at most 3 prisoner turns and 30 suspicion --
cheaper than the window again, the exact problem this arm exists to fix. Turn/suspicion parity and
open-before-catchable parity cannot both hold here, because the lock wears faster per turn (20 against
15) against a catch line that is proportionally higher (40% of range against 30%). This issue asked for
comparable *cost*; it is that. It is not comparable *risk timing*, and the owner should see that
plainly rather than have it discovered in a batch.

### 50.3 What this means for §46, and what is not yet known

§46's six games were run entirely under `free`. Nothing in this issue reruns them. What changes is
their reading: **"stating it moves her, and moves her plan" (§46.2) is no longer evidence that a
condition list makes a mind reconsider its plan toward a better-but-costly route.** It is evidence
that telling her about a free route she had never been shown made her take it -- unsurprising once the
door's true price is visible, and not the comparison mother-of-invention#2 has been waiting for.
**That comparison -- does precedent tip a choice between two routes of comparable cost -- has never
yet been run.** It requires both `PRISONER_DOOR=stated` and `PRISONER_DOOR_PRICE=threshold` together,
which no batch in this document has done.

### 50.4 The command for a live validation game

Live games are the owner's to run, one model at a time on the 4090. Two runs, arms alternating,
otherwise identical settings, are what would test whether the routes are now comparable:

```bash
# free (today's behaviour, the comparison arm)
PRISONER_VARIANT=open PRISONER_DOOR=stated PRISONER_DOOR_PRICE=free \
  PRISONER_MODEL_URL=http://doris:11434/v1 \
  PRISONER_WITS_MODEL=qwen3:14b PRISONER_VOICE_MODEL=ancient-awakening:12b \
  PRISONER_REFEREE_MODEL=qwen2.5:14b PRISONER_REFEREE_TIMEOUT_MS=180000 \
  PRISONER_THINK_TIMEOUT_MS=180000 PRISONER_ROUNDS=30 PRISONER_OLLAMA_RESIDENT_MODELS= \
  npm run checkpoint

# threshold (the arm this issue built)
PRISONER_VARIANT=open PRISONER_DOOR=stated PRISONER_DOOR_PRICE=threshold \
  PRISONER_MODEL_URL=http://doris:11434/v1 \
  PRISONER_WITS_MODEL=qwen3:14b PRISONER_VOICE_MODEL=ancient-awakening:12b \
  PRISONER_REFEREE_MODEL=qwen2.5:14b PRISONER_REFEREE_TIMEOUT_MS=180000 \
  PRISONER_THINK_TIMEOUT_MS=180000 PRISONER_ROUNDS=30 PRISONER_OLLAMA_RESIDENT_MODELS= \
  npm run checkpoint
```

**What would confirm the routes are now comparable:** under `threshold`, the door route (when taken)
costs a number of prisoner turns and a suspicion level in the same range as the window route in the
same batch -- roughly 5 turns and 50 suspicion for either, per §50.2 -- rather than the door winning in
2 turns at 15 suspicion the way the unpriced human game did. **What would refute it:** the door route
still finishes in far fewer turns or at far lower suspicion than the window under `threshold`, which
would mean either the referee is not ruling the lock-wear turns as audible/moderate the way the bar's
are (an assumption §50.2 states plainly and does not verify against a live referee), or some other path
to the door (e.g. a `substantial` single wear ruling, or a route that reaches the door without ever
touching the lock) still bypasses the gate this arm relies on.
