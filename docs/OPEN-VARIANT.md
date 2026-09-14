# The Prisoner, open variant — design

*Status: proposal, written 2026-09-14, before any code. Nothing here is built. The owner reviews this
before implementation starts.*

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
keys and citations, never their reasoning. Consistency is measured, not assumed (§5.2).

---

## 4. The world: objects and generic effects

### 4.1 Objects

The scenario authors a small set of objects, each with an id, a holder or location, perceptibility,
and a **physical description**. A starting set for the cell: the bar, the lock, the spoon, the loose
tile, an iron-framed cot with a wool blanket frayed at the hem, a tin bucket, the meal tray the warden
brings each round, and the warden's key ring (on the warden's belt). Descriptions are content, in the
scenario file, and never in engine or seam code.

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

## 8. Decisions for the owner before O1

1. **Referee model.** It runs at temperature 0 and is a third model role on a one-model GPU. Use the
   wits model (fewer swaps, but it rules on the same model's ideas), or a separate model (more swaps,
   more independence)?
2. **Starting objects.** The list in §4.1, or a different cell?
3. **Who writes object descriptions.** Hand-written for O1 is assumed. A later option is a model
   drafting them for review, which would scale scenarios but puts a model upstream of the grounding
   guard.
