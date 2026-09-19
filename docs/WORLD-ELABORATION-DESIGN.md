# World elaboration — the cross-repo design

**Written 2026-09-19 from `WORLD-ELABORATION-BRIEF.md`, for the owner to decide on and for a building
session to execute.** The brief is the vision and the evidence; this is what to build, where, in what
order, and what to measure first. Every claim about code below was checked against the tree on the day;
file references are to that state and may drift.

**Revised 2026-09-19, same day, after review.** Four changes: the price band is read at *build*, from
each description alone, never at play (§4.2a) — so the actor's words cannot reach the pricing model at
all; the measurement is a pre-committed band **sweep**, not one band (D5, §4.8); a property's `reads`
line at its start value is empty, so only wear is ever narrated (§4.3); and §3.2 records why the engine's
transaction layer has no race to close. The review's five points and the assessment of each are in the
session record; the first two collapsed into one structural fix, the fourth yielded an authoring rule,
the fifth was inapplicable and is now documented as such.

Read order for a building session: root `~/rpg/CLAUDE.md`, then this file, then the brief, then
`OPEN-VARIANT.md` §64 for the measurements and §65 for the vision. Each repository's own `CLAUDE.md`
governs inside it and nothing here overrides one.

**Why this file lives here and not in `run-dmcp`.** It names DEFCON and prestige, because it has to
say how brink maps onto the mechanism, and the engine's `engineVocabulary.test.ts` scans every file in
that tree, tracked and untracked, with `docs/DESIGN.md` as its only exclusion. The engine's share of this
design is stated in neutral words in Appendix A, which is the text to file as a `run-dmcp` issue.

---

## 0. The decisions, up front

**All five decided by the owner on 2026-09-19, each as recommended.** D1 The Prisoner first, Tier 1.
D2 the engine change is filed and lands first as 0.9.0. D3 existing currencies, chosen by band. D4 Tier 2
designed now, built only after Tier 1 has a number. D5 the prediction is pre-committed and the result
accepted; no band is retuned after seeing results — and, after review the same day, the pre-committed
design is a *sweep* across bands so that "not pursued" can be read as elasticity rather than as a verdict
on the mind (§4.8). The text below is kept as written so the alternatives and their costs stay on the
record.

Five decisions only the owner can make. Each says what a *yes* and a *no* commit you to. The
recommendation is first in each.

**D1 — First caller: The Prisoner, not brink.** The brief chose brink because it has both halves as
*game content*: a closed set of rejection codes and an enforced price. Inspection of the trees reverses
it (§1.2): brink is not on the engine's resolve protocol or timeline substrate at all. It pins
`run-dmcp@0.5.0`, three minors behind `create`/`set`/`destroy`, runs its own 2,889-line resolver, and
its Phase 3 (adopting `entities`/`facts`/`events`) is unexecuted. An elaboration built in brink first is
brink-private code that exercises none of the engine mechanism. The Prisoner is on 0.8.0, calls
`resolver.resolve()` for every consequential write, already brings entities into existence mid-game
through `derive`, has the reader seam, the replay sidecar, and the welded-window instrument §64.3 built.
Its missing "pricing capability" turns out to be the pattern it already uses (§1.3).
*Yes* → §4 is the first build, brink follows the shape later. *No, brink first* → §5.2's brink-private
mechanic is the first build, the engine gets no caller from it, and the measurement in §4.8 waits.

**D2 — One engine change, small and optional: a `create` leg may carry constraint declarations.**
`IntendedCreate` cannot declare `bounded`/`resolve_only` on the entity it makes, so The Prisoner's
`adoptDerivedObject` declares them *after* `resolve()` returns — a second write path, which the engine's
own hard rule 7 exists to forbid, tolerated today and recorded at `src/open/world.ts` ("the one thing
that happens after `resolve()` returns"). Elaboration doubles the callers of that wart. Tier 1 (§4)
works without the change by inheriting it. *Yes* → Appendix A is filed (run-dmcp#42, 2026-09-19) and lands first as 0.9.0. *No* →
the wart stays, noted in both places.

**D3 — The price is denominated in currencies the game already enforces, chosen by band.** In The
Prisoner: work (the acquired property's starting value and wear table) and attention (the suspicion bump
the attempt already earns). In brink: the prestige rail and DEFCON steps. The elaboration step picks a
closed band cited from authored text; a code table turns the band into numbers, exactly as `magnitude`
works today. No new currency anywhere. *Yes* → §4.3's table is content for you to set. *No, a single
new "elaboration cost"* → a fourth enforced rule in brink and a new resource in The Prisoner; resist.

**D4 — Tier 2 (the world acquires a new *object*, with a model-written description) is designed here
and not built until Tier 1 has a number.** Tier 1 (an existing object acquires a declared property kind)
needs no model-written prose at all: closed keys, cited, replayable. Tier 2 puts a model upstream of the
grounding guard, which §8.3 deferred for that reason, and it is where exploitation actually lives.
*Yes* → §4.8 runs before any Tier 2 code. *No* → §4.9 is built alongside, behind its own arm.

**D5 — The measurement is designed to fail honestly.** §50.7 measured that *any* price removed the door
from the prisoner's plans; §64.5 measured that an available alternative is declined while the obvious
route is open. The pre-committed prediction (§4.8) therefore says elaborations will be *acquired and not
pursued* with the window open, and pursued only when it is welded. "No retuning after seeing results"
guards against fitting the table to the batch; it is not a ban on learning what the table does. So the
pre-committed design sweeps the band — the same welded scenario at `trivial`, `hard` and `ruinous` — and
the prediction names what each outcome means: pursued at `trivial` only is a price-elasticity curve and a
tuning input; pursued at none, `trivial` included, is a finding about the mind, and the honest price
defeats the vision for this mind. `ruinous` is the control that is designed to be declined.

---

## 1. What changed between the brief and this design

### 1.1 The engine already stores what the vision asks for

`run-dmcp@0.8.0`'s `IntendedChange` is five kinds — `write`, `transfer`, `set`, `create`, `destroy`
(`src/timeline/resolve.ts:181-239`) — applied by `resolve()` inside one `withTransaction`, rolling
back together on any constraint violation, and recorded as a `resolution.recorded` event whose
`causes` carries `{ source: "resolve", resolution_id, mechanic, change_count }`. A later leg names an
entity an earlier `create` leg made by `{ ref }`. Every fact a resolution opens is stamped with the
event that opened it (`facts.opened_by_event_id`, DESIGN §5.2c).

So "the world acquires a fact, at a stated cost, recorded as state" is expressible today as one
resolution: a `create` (the fact), a `write` (the price), and the attempt's own effect, atomic, with
provenance. The engine's share of this design is therefore mostly *already shipped*. What remains is the
one wart in D2 and a documentation lesson.

### 1.2 brink is not on the protocol

`brink-workshop/src/tools/resolve.ts` is brink's own resolver with its own 24-code rejection union.
`docs/RUN-DMCP-PHASE-3.md` records that six engine files are vendored *because* brink has none of
`entities`/`facts`/`events`, and that Phase 3 and the file swap are one commit not yet made. It pins
`run-dmcp@0.5.0` and `mind-seam@0.2.0`. Its four flashpoints are a static literal
(`src/tools/greatPowers.ts:125-151`), and the one machinery that can name "a flashpoint no board has
ever had" — `world_proposals` — has no `game_id` column *by design* (§9.3: live injection is forbidden).

None of that is a defect. It means brink's contribution to this design is the *pattern* — trigger, decide,
price, narrate from the payload — proven in a game with an enforced price, in brink's own code, and it
means the engine mechanism's real caller under hard rule 1 is The Prisoner.

### 1.3 The Prisoner's "cannot invent a magnitude" is the pattern, not a gap

The brief reads §3.5's referee as lacking a pricing capability. It is the reverse: the referee never
invents a number *today* either. It answers `magnitude: slight | moderate | substantial` from a closed
set, cited, and `OpenObjectProperty.wear` (`src/open/scenarioObjects.ts:53-88`) turns the band into a
number. Pricing an elaboration is one more closed question (`difficulty`), asked once at build time from
each description alone (§4.2a), and one more table. The capability the brief thought was new is the one
the game is built on.

### 1.4 The trigger already exists as a silent code path

`src/open/loop.ts` returns a null half-round in two places: when the referee's ruling is not
`applicable`, and when it is applicable but names an `(object, property)` pair the scenario does not
declare (the comment there reads *"no invented world" (invariant 6). Do nothing.*). The property question's
own prompt (`src/open/referee.ts`, `id: "property"`) tells the referee *"Name only a property the target
has; if it has none that fits, answer none."* And `src/open/perception.ts` records (issue #16) that a
`target: "none"` ruling cannot distinguish "names nothing the world models" from "names something the
world models but this principal cannot reach". Elaboration attaches to these paths; it does not need a
new one.

### 1.5 The price may kill the route, and that is measured

§50.7: eleven games with the door free, eight escapes through it; eleven games with the door priced at
either gate, zero attempts on it. §64.5: with the window open, the wire enters the candidate set 9/10 and
is taken 0/10, and she is right. This design does not argue with either. It predicts them (§4.8) and
builds the arm that lets the effect show, which is the welded window.

### 1.6 mind-seam 0.5.0 is published

The brief listed it as built and unpublished. As of today `mind-seam@0.5.0` is on npm, tagged, and on
`origin/main` (`459d7ac`). What remains is the two downstream pins: The Prisoner at 0.4.0, brink at
0.2.0. Neither is a dependency of Tier 1 (§7).

---

## 2. The mechanism, generically

> An attempt may require a fact the world does not hold. The world may acquire that fact, at a stated
> cost, recorded as state rather than narrated as prose.

Six steps, each with an owner. The engine owns two and calls no model in either.

| step | what happens | who owns it |
|---|---|---|
| 0 | **At build, before any play:** every `(object, property kind)` the world could acquire is read from that object's description *alone* and given a **band** of cost, replayed for agreement, reviewed by the author, stored as data | caller's reader questions on the engine's `createTurnReader`, run once; a model outside the engine; the author's review |
| 1 | The attempt is ruled, and the ruling names a **gap**: a perceived thing the attempt targets, and a kind of fact it would need that thing to have | caller's reader questions; closed keys, cited verbatim |
| 2 | A **separate, logged** decision: does the world acquire that fact — the kind it *needs*, cited from the thing's *authored* text, never from the actor's words; the band is a lookup from step 0 | caller's second question set; a model outside the engine; safe default is *no* |
| 3 | Band → numbers | caller's table, code |
| 4 | Acquisition, price and the attempt's own effect in **one resolution**, atomic, with one-hop provenance | engine: `create` + `write` legs through `resolve()` |
| 5 | Who learns it, when | caller's fog layer; the engine is omniscient by decision (#18) |
| 6 | Log and replay | caller's sidecar, the same file its rulings already go to |

**Two tiers.** *Tier 1, property elaboration*: an existing, perceived object acquires a property kind the
scenario already knows how to model, which it did not have. No prose is written by any model; the
object's description is unchanged; the acquired state reads through the same `reads` lines as any
property. *Tier 2, object elaboration*: a thing the intent names that the world does not contain comes
into existence, which needs a description, which needs a model to write it and a second model to audit
it (the-prisoner#3's shape). Tier 1 first; Tier 2 designed in §4.9 and not built before §4.8 has a
number.

**The authoring principle that makes this neither hand-authoring nor hallucination.** The author
declares the *space* of acquirable facts: which property kinds exist, what a band of each costs, and,
for a route, where it could lead. A model's reading of the authored physical description, at build,
decides which band each acquirable fact sits in, and the author reviews that reading. Play decides
*which* are acquired and *when*. Nothing about the price is decided while an actor is speaking. §46 stated a second route in the mind's own condition
list; this states nothing to the mind. The route is not on the page, not in any condition, and not
promised. It is discoverable by attempting it, and the price is learned from the world's answer.

**Vocabulary.** The brief's three stay distinct — *described* (on the page), *actionable* (properties
imply a use), *ratified* (something promises it leads somewhere) — and elaboration adds a fourth:
**acquirable** (the world may come to hold it). Tier 1 makes acquirable facts *actionable* on first
contact; whether they become *ratified* is what §4.8 measures.

**What elaboration never does (structural, not lexical).**
- Never contradicts a standing fact, and never reopens an `irreversible` one. It *adds* facts; DESIGN
  §5.2b's derived prohibition already holds every assertion against what is true at `t`. A closed exit
  stays closed (§5.2 on brink's `OFF_RAMP_CLOSED`).
- Never acquires a kind the scenario cannot model. The `need` key set is the scenario's declared
  property vocabulary and nothing else.
- Never acquires anything from an intent that names nothing perceived. A target of `none` has no
  description to cite a `need` from, and no build-time band exists for it, so there is no source for
  the decision — a helicopter is refused by construction, not by a word list.
- Never prices anything in the presence of the actor's words. The band was read from the description
  alone before the game began; at play the actor's eloquence can reach only `need`, and the worst it can
  do there is make the world acquire a property at the price it was always going to cost.
- Never acquires the same `(object, property)` twice. Once acquired it is a fact like any other.
- Never a person as the target. §55's person-as-target and belief-writing effects (#22) are their own
  design; a principal's state is not elaborable here.
- Never free. The attempt earns its ordinary attention price whether or not the world elaborates, and
  the acquired property's band is its own price in work.

---

## 3. `run-dmcp` — the engine's share

### 3.1 What it already does, and the design leans on

- **Atomic multi-leg resolution** with `create`, `write`, `transfer`, `set`, `destroy` and `{ ref }`
  naming across legs. `IntendedWrite.bounds` lets a write leg on a just-created entity carry its bounds
  inline, which is what keeps Tier 1's first-scrape leg honest before any constraint is declared.
- **Provenance without a new field.** An elaboration is its own mechanic name in the caller
  (`OPEN_ACQUIRE` in §4.4). `events.causes.mechanic` therefore already distinguishes an elaborated fact
  from an authored one, and `changes_within(t0, t1)` returns them as ordinary transitions. "Which
  elaborations fired" is a query, not a log format.
- **The reader.** `createTurnReader` takes any closed-key question set with cited sources and injected
  transports. The elaboration decision (§4.2) is a second request through the same reader, so it
  inherits verbatim citation, safe defaults, the fallback ladder, and the raw-reply sidecar.
- **Replay and export.** `replay(t)` shows the world with or without the acquired fact at any `t`; the
  timeline export carries it. Nothing here is prose.

### 3.2 The one change: constraints declared by the leg that creates (D2)

`IntendedCreate` gains an optional `constraints` field, applied inside the same transaction as the
create, in the constraint family's existing vocabulary:

```ts
export interface IntendedCreate {
  kind: "create";
  ref: string;
  entityKind: EntityKind;
  columns: Readonly<Record<string, string | number | null | { ref: string }>>;
  /** Declared on the new entity inside this resolution's transaction, so a
   *  later leg of the same resolution is already held to them and nothing
   *  has to be declared after `resolve()` returns. */
  constraints?: readonly (
    | { kind: "bounded"; key: string; minValue: number | null; maxValue: number | null }
    | { kind: "resolve_only"; key: string }
    | { kind: "monotonic"; key: string; direction: "up" | "down" }
  )[];
}
```

Real caller today: The Prisoner's `adoptDerivedObject`, which makes exactly these two declarations after
the fact. Second caller on landing: `OPEN_ACQUIRE`. `conserved` is deliberately not in the list — a
conserved set has members that already exist, and declaring one is a statement about several entities,
not about the one being created.

Tests first, neutral fixture (grain, treasury, population), against a fresh database and an existing
one:
- A resolution creates a resource with `bounded` and `resolve_only`, and a later leg of the same
  resolution that would exceed the bound rolls the whole resolution back, including the create.
- After the resolution, a direct write to the created resource is refused by the `resolve_only` trigger,
  with no library call having been made after `resolve()` returned.
- A `constraints` entry naming a `key` not among the created entity's live columns is refused before
  dispatch, naming the key.
- `listConstraints` shows the declarations with the resolution's event as their cause.

Minor, additive: 0.9.0. Filed as run-dmcp#42 on 2026-09-19; the text is Appendix A.

**Why there is no race to close, recorded so no reviewer chases it.** The concern is that a constraint
declared inside the create's transaction could be seen, or written against, by a concurrent reader before
the transaction commits. It cannot, for three reasons in the tree: `resolve(proposal): Outcome`
(`src/timeline/resolve.ts:343`) is synchronous, and the file contains no `async`; `withTransaction`
(`src/db/connection.ts:135`) is a synchronous better-sqlite3 transaction on the process's one connection,
so JavaScript cannot interleave a fog audit or any other read inside it; and the database is opened in
WAL mode (`connection.ts:105`), so a *second process* reading the same file sees the last committed
snapshot and never an uncommitted create, while a second writer gets `SQLITE_BUSY` — which is the
situation for every resolution today and nothing this change adds. The Prisoner's loop is likewise one
half-round at a time.

### 3.3 What the engine must not acquire from this

- **No `unsupported` refusal reason.** Hard rule 2: the engine records decisions and never makes them.
  "The world lacks what your attempt needs" is a *ruling*, made by a caller's reader questions, and the
  caller's mechanic reports it in `Adjudication.result`. A sixth `ResolveRefusalReason` would be the
  first caller's policy in the core.
- **No pricing.** A band table is content. The engine's only price is the constraint family refusing a
  write that cannot be paid.
- **No model call, no plausibility check, no fog.** #18 stays deferred; the caller's belief layer does
  the work (§4.5).

### 3.4 Documentation, in five homes

Root `CLAUDE.md` names the catalogue (`run-dmcp/docs/AUTHORING-GUIDE.md`) and four pointers that move
together. Two lessons are due, and only one is ready.

- **Ready with Tier 1:** *Declare the space of what an object may come to be; describe what it is.*
  The property vocabulary a referee can name, the bands each costs, and where a route could lead are the
  author's; whether an object acquires them is play's. In the guide's own words, with a grain/treasury
  fixture, never a cell's.
- **Not yet ready:** §64.8a's rule — *description controls whether an act is considered; utility
  controls whether it is taken; naming a manipulation is the reliable lever, physical properties alone
  depend on the material* — is confirmed on two objects, and §64.8a itself says a third is worth having
  before anything propagates. Land it when the third object exists. §4.8's runs can supply it for free
  (the tile's grit, at L1 and L2).

### 3.5 Relation to the open engine issues

- **#39 (intent in, ruling out, as a verb):** the elaboration request is a second question set the
  same verb would carry. Nothing here needs #39 first; #39 gains a second real question set from it.
- **#41 (mechanics and gates as data):** if it lands, §4.3's band table is data a stock server loads.
  Until then it is the caller's TypeScript, like every other table in that game.
- **#37 (preflight over a declared world):** its second kind — prose that claims what the world does
  not model — is the failure elaboration is *for*. A preflight that lists "described features an author
  clearly intends to matter, with no declared property behind them" is a list of Tier 1 candidates.
- **#30/#31:** provenance and two-proposer contention are unchanged by this; `OPEN_ACQUIRE` is one more
  mechanic under the same pinned behaviour.

---

## 4. The Prisoner — first caller, Tier 1

### 4.1 Trigger

An elaboration is *considered* when, on a principal's half-round, the base ruling did not apply, and:

1. `ruling.targetObjectId` is a perceived **object** (not `"none"`, not a principal — §55);
2. the target does not already hold the property the elaboration would acquire (checked in code from
   `declaredPropertyKeys`, which is data the world already owns);
3. the arm is on (§4.7).

Both of §1.4's null paths route here. When the referee has already named a property the target lacks
(the `plan === null` path), the elaboration request is still asked in full; agreement between its `need`
and the base ruling's `property` is a free consistency measurement, recorded, never used to decide.

The base referee request is **byte-identical** to today's. Adding questions to it would change every
recorded batch's request shape (the-prisoner#17 makes the same point for the instrument question); a
second request that fires only on a failed half-round changes nothing that has been measured.

### 4.2 The elaboration request, at play

Built on `createTurnReader` exactly as `referee.ts` builds the base request. Sources: `intent`, and
`desc:<target>` only — the one object whose text can ground the decision. Precedent record shown as
§3.5 shows it, temperature 0, the referee role's model (`PRISONER_REFEREE_MODEL`, default `qwen3:14b`).
**One question.** The price is not asked here; it was read at build (§4.2a) and is a lookup.

| id | answer keys | safe default | cited from | the question, in substance |
|---|---|---|---|---|
| `need` | `integrity`, `edge`, `concealment`, `passage`, `none` | `none` | `desc:<target>` | The target has none of the properties this attempt needs. Which property kind, if the target had it, would make the attempt physically possible — grounded in the target's own description. Cite the words that make that property real for this object (a hollow of dry grit for `passage` or the soundness of what fills it; a hinge or a fixing for `integrity`). `none` if nothing in the description supports any. |

The safe default is *no*. The world elaborates only when a model, reading authored text, cites the words
that make the property real *and* the build-time table holds a band for that `(target, need)` other than
`impossible`. The actor's own words reach `need` and nothing else. The worst a loaded intent can do is
make the world acquire a property at the price it was always going to cost — which is §3.3's guard
applied to the decision as well as the ruling, and the answer to the review's first point (the-prisoner#17
is the precedent: a verified citation proves presence, never that the quote justifies the ruling, so
the thing that must not be in the pricing prompt is the actor's voice).

The request and its raw replies are logged as a second entry per half-round in the existing
`.referee.json` sidecar (`refereeRequestsFor`, `src/open/checkpointTranscript.ts`), labelled
`round N, <principal>, elaboration: <intent>`. `npm run referee-replay` replays it with no change,
and the §5.3 agreement bar (≥ 80% per key over N=5) applies to `need` as to any key.

### 4.2a Pricing at build: the band is data before round 1

A build-time step, run once per scenario revision by `npm run price-world` (new script), before any
game and with no intent in existence:

- For every object in `OPEN_OBJECTS` and every property kind in the `need` vocabulary the object does
  not already declare, one reader request with a **single source**, `desc:<object>`, and one question:

  | id | answer keys | safe default | cited from | the question, in substance |
  |---|---|---|---|---|
  | `difficulty` | `trivial`, `hard`, `ruinous`, `impossible` | `impossible` | `desc:<object>` | From this description alone, if a person with ordinary means set out to wear through this thing's `<kind>`, how much work is it: `trivial` (a turn or two), `hard` (many turns), `ruinous` (real, and longer than a game), `impossible` (material, fixing or position rule it out). Cite the words. |

- Each request is replayed **N=5** on the spot. A key with **full agreement** (5/5) is written to
  `src/open/elaborationBands.ts` as data, with its citation, the model, and the scenario revision. A key
  below full agreement is written as `review` with all five answers and citations, and the arm refuses
  to start a game while any `review` entry stands: the author sets it by hand, in the same file, with a
  comment saying so. **The stochastic decision happens once, before play, and is auditable in a file**;
  hardware or quantisation drift at play time can reach nothing, because nothing is decided at play.
- The file is committed with the scenario. A change to any description invalidates its rows (the row
  carries a hash of the description it was read from), and the arm refuses to start until they are
  re-read. So the price can never silently belong to an older sentence than the one the referee grounds
  `need` against.
- The same sidecar and replay tooling records and re-checks the build run, so a batch can say which
  bands were model-read and which were author-set.

What this costs: one reader call per `(object, kind)` pair, replayed five times — for twelve objects and
four kinds, at most 240 calls, most of which are `impossible` on the first read; about fifteen minutes
once per scenario revision, thinking off. What it buys: the review's second point is closed as well as
its first. A band is a larger lever than a magnitude, and it is now the one lever that is never pulled
during a game.

`impossible` needs no citation review by the author unless a game's `need` answer lands on it, which the
transcript records as a refusal with the description as its positive reason (§4.6).

### 4.3 Band → numbers (content, the owner's to set)

A scenario table keyed by property kind and band. Proposed defaults for `integrity` acquired on a
thing to be worn through; the shape is `OpenObjectProperty` minus `key`:

| band | initial | wear (slight / moderate / substantial) | turns to zero, at moderate | reads, at the start value | reads, once worn |
|---|---|---|---|---|---|
| `trivial` | 20 | 10 / 20 / 30 | 1 | *(none)* | "the grit beneath lifts at a touch" |
| `hard` | 100 | 5 / 10 / 15 | 10 | *(none)* | "the packed grit beneath is scraped, and gives slowly" |
| `ruinous` | 100 | 1 / 2 / 3 | 50 | *(none)* | "the packed grit beneath is scratched, a grain at a time" |

The postcard on the 75th birthday is the `ruinous` row: real, honest, and longer than a thirty-round
game. `restore` tables mirror the closed variant's (a warden can fill a hollow back in). `reads` lines
are positive nouns, per DESIGN §7, and are the *only* way the actor learns the price — as state, in the
description, on the next turn.

**Authoring rule: the `reads` line at a band's start value is empty.** `OpenObjectProperty.reads` already
says a value with no reading adds nothing (say what is, never what is absent), and this rule makes that
mandatory for an acquired property's initial value. The world never narrates that a thing *could* be
worn through; it narrates only that it *has been*. So the other principal, perceiving the object on a
later turn, sees scrape marks — evidence of an attempt, which is what the game's suspicion mechanics
exist to react to — and never a pristine, un-acted-on elaboration. In Tier 1 the property is created in
the same resolution as the first scrape (§4.4), so a start-value reading would never be shown anyway;
the rule exists so a `restore` that fills the hollow back to its start value reads as nothing too, and
so Tier 2 inherits it.

**Routes.** A property acquired on a way-out object is already a route (§17's exits map:
`{ passageResourceId, integrityResourceId, destinationId, part, openWhenPartAtMost }`). A property
acquired on any other object becomes a route only if the scenario's table declares where it could lead:

```ts
// content: which objects a dug or forced route could open, and to where. Declared, never stated
// to a mind, and not in any condition list. Play decides whether it is ever acquired.
export const ELABORABLE_EXITS: Readonly<Record<string, { destination: "corridor"; openWhenIntegrityAtMost: number }>> = {
  loose_tile: { destination: "corridor", openWhenIntegrityAtMost: 0 },
};
```

(`buildOpenWorld` creates the corridor location and hands its id to the door's exit; the table names
the destination the same way and `buildOpenWorld` resolves it, so no location id is content.)

This is the one content decision with a topological consequence: it is what makes the cell have the
second live route §46 wanted, at a price §50.7 says she will not pay while the window is open. It is
also the honest form of "hand-author more routes": the author declares where the floor *could* go, not
that it does.

### 4.4 The resolution: one mechanic, `OPEN_ACQUIRE`

Registered beside `OPEN_WEAR` and the others in `src/open/mechanics.ts`. Its `adjudicate` returns, in
one resolution:

1. `create` — a resource entity under `ref: "property:<need>"`, owner the target's location as every
   §4.1 property's is, `value` at the band's initial. Under D2 it carries `constraints: [bounded,
   resolve_only]`; until then, inline `bounds` on leg 2 and `adoptAcquiredProperty` after (the
   `adoptDerivedObject` wart, inherited and noted).
2. `write` — the attempt's own effect on the new resource: `mode: "delta"`, the band's wear at the
   ruled magnitude. The first scrape counts; *"the floor is dirt, go ahead"* is an outcome, not a permit.
3. `write` — `warden_suspicion` by the ordinary magnitude bump (`SUSPICION_BUMP_FOR_MAGNITUDE`), when
   the perceptibility rules make it eligible, exactly as `OPEN_WEAR` does. No elaboration-specific bump.

`result: { acquired: true, need, band, bandSource: "model" | "author", startValue }`. The engine records
`causes.mechanic = "OPEN_ACQUIRE"`, which is the provenance. If any leg violates a constraint the
whole resolution rolls back and nothing was acquired.

**Invariant 6 amended, not broken.** "No invented world" becomes: *the world may acquire a declared
property kind on an existing object through one audited resolution whose cause is recorded; never an
undeclared kind, never a new object (Tier 1), never prose.* The referee still cannot invent anything; it
can only say which of the author's kinds the author's words support.

### 4.5 Fog and belief

The template is `adoptDerivedObject` and the derive path in `loop.ts`:

- The actor's belief in the new resource is stamped `as of round N` at the post-scrape value
  (`setBelief`), so the standing world (§59) shows the property next turn with its `reads` line. That
  line *is* the price, told once as news and then as state.
- The other principal learns of it through the attempt's ruled perceptibility, as today. The property
  itself is perceptible to whoever perceives the object, from the next turn they perceive it, through
  the same `reads` mechanism; their belief is stamped when it is perceived, never before.
- The fog audit (`fogAudit`) needs no new rule: a resource is a resource.

### 4.6 What the actor is told

Positive, from state, never a number the game does not already show. On the acquiring turn:

> Your last attempt (…) found the loose tile as it is: <its description>. Beneath it, the packed grit
> gives to a scraping edge, slowly.

The second sentence is the band's `reads` line at the current value, rendered by code, never by a model.
On a refusal (`need: none`, or a build-time band of `impossible` for that pair) the actor is told what
today's refusal tells them — the description — which is the positive reason §5.3 item 2 requires. The
build run's citation for `impossible` is in `elaborationBands.ts` for a human to audit, and the
transcript names which it was.

### 4.7 The arm, and comparability

`PRISONER_ELABORATE=off | property` (later `object` for Tier 2), default `off`. Off is byte-identical to
today: no second request, no mechanic reachable, no header line. The transcript header prints
`Elaboration: property` when on; pooled batch tooling refuses to mix values, as it does for every arm.
The benchmark keeps `off` (the-prisoner#5's rule, the owner's decision 2026-09-14), and if #3's
`PRISONER_MODE` lands, `enjoyable` may default this on and `benchmark` never does.

Two arms interact and should be on together for measurement: `PRISONER_INSTRUMENT=checked` (#17), so an
elaborated route cannot be dug with a tool the actor does not hold; and `PRISONER_DOOR` as the run needs.

### 4.8 Measurement, pre-committed

Write `checkpoints/<date>-elaboration/PREDICTION.md` before the first call, in the shape of
`checkpoints/2026-09-19-condition-and-affordance/PREDICTION.md`. Metrics are mechanical, from the
sidecar and the transcript summary: *fired* (an elaboration request was asked), *acquired* (`need ≠ none`
and the band for that pair is not `impossible`, resolution applied), *pursued* (a later half-round by
the same principal targets the acquired property), *ratified* (a game ends through an elaborated route).

**Instrument.** The welded-window scenario from §64.3 is the control that removes the dominant route;
the open window is the baseline. `qwen3:14b` everywhere; thinking OFF for the round-1 cells (§64.7:
candidacy does not need it, and 4.4s beats 20s); thinking ON for full games unless §4.10's one game says
OFF is coherent across rounds, in which case OFF, because the sweep below is fifteen games.

**The build run comes first, and is reported before any cell runs.** `npm run price-world` (§4.2a) is
executed against the pinned scenario revision and its result committed: how many `(object, kind)` pairs
were model-read at 5/5, how many went to author review, and — the number that decides whether cells B–D
can run at all — the band the build read for the pair the welded scenario is meant to open. If that
band is `impossible`, the author decides before B runs, and the transcript of that decision is part of
the batch. Nothing in the sweep is a prediction about the build run; it is data.

**The sweep.** Cells C force the band for that one pair through `PRISONER_ELABORATE_BAND` (Appendix C),
recorded in the header, so the three cells differ in exactly one integer table and nothing else.

| cell | n | band | what is counted | prediction | falsifier |
|---|---|---|---|---|---|
| A. open window, round 1 | 10 | as built | fired, acquired | fired ≤ 2/10 (she attacks the bar; nothing fails) | — |
| B. welded window, round 1 | 10 | as built | fired, acquired | fired ≥ 6/10; acquired ≥ 3/10 | acquired 0/10 with a non-`impossible` band → `need` never lands on the pair; read the citations before touching the prompt |
| C1. welded, 30 rounds | 5 | `trivial` | pursued, ratified, final suspicion | pursued ≥ 3/5; ratified 1–3/5 | **pursued 0/5 → the mind, not the table (D5): a route that costs one turn is still declined** |
| C2. welded, 30 rounds | 5 | `hard` | as C1 | pursued 1–3/5; ratified 0–1/5 | — |
| C3. welded, 30 rounds | 5 | `ruinous` | as C1 | pursued ≤ 1/5; ratified 0/5 (the control, designed to be declined) | pursued(C3) ≥ pursued(C1) → the band is not what she is reading; the price is not the operative variable, and the whole D3 pricing story needs re-reading, not retuning |
| D. open, 30 rounds | 3 | as built | pursued | 0/3 (she takes the window) | pursued ≥ 2/3 → acquisition itself redirects her, against §64.5 |
| E. replay of every play-time request in B and C | N=5 | — | per-key agreement on `need` | ≥ 80% | below 80% → `need` is not groundable from these descriptions; an authoring finding for §3.4 |

**The elasticity reading, pre-committed.** The ordering `pursued(C1) > pursued(C2) ≥ pursued(C3)` is
the prediction, and it is what turns "not pursued" into a curve instead of a verdict. §50.7 says
elasticity may be near zero (gates of 30 and 60 both killed the door), so the prediction also names
that shape in advance: **if C1 and C2 are both pursued rarely and C3 never, the curve is flat and the
finding is §50.7 generalised — she declines priced routes at any price — which is a finding about the
mind, and D5's sentence applies.** If C1 is pursued and C2 is not, the finding is a price the mind will
pay, and §4.3's `hard` row is the tuning input, tuned *after* the batch and re-run as a new batch.

Cost at 2026-09-19 rates: build run ≈ 15 minutes once; A+B ≈ 2 minutes; C1–C3 + D are eighteen
30-round games — at thinking ON ≈ 12 hours on the one GPU, at thinking OFF ≈ 2.7 hours, which is why
§4.10's one game runs before any of them. One model resident at a time; check `/api/ps` first; launch
detached.

**The refusal confound (brief Q6) stays out of this batch.** Every act here is aimed at a thing.
Before any person-as-target arm is read as disinterest, a human reads its raw replies for refusal
language; no lexical scan.

### 4.9 Tier 2, designed, not built

A new object the intent names and the world lacks. The target is `none`, so nothing can be cited from a
description, and the decision needs prose that does not yet exist. The only admissible shape, from
the-prisoner#3's questions and §13.2's rule that every citable text is one a human wrote:

1. A `gap` question on the base ruling's failure: `names-missing-object | names-missing-place | none`,
   cited from the intent — the span naming the thing.
2. A **proposer** (a model, free text, the-prisoner's narrator or voice role) writes a physical
   description for the named thing in the cell, held to §4.1's rule: material, size, wear, fixing; never
   a use.
3. An **auditor** (the referee role, the §63 pattern) answers closed keys over the draft: `states-a-use`,
   `contradicts-standing-fact` (against the standing world rendered by code), `physical-only`; any
   offending span is cited; a failing draft is regenerated once, then refused.
4. The object is created through `OPEN_ACQUIRE` with a kind from a declared **elaborable-kind table**
   (the derivable-kind table's shape: which property kinds a new thing of this sort has, at which bands),
   so its *state* is still the author's even though its *description* is the model's.
5. The description is stored on the entity (a `set` leg), marked as elaborated in the transcript, and
   the game refuses to promote it into the benchmark scenario without human review (#3's question 5).

Exploitation lives here — a mind that learns the world writes objects will name convenient ones — and
the defences are step 3's `contradicts-standing-fact`, the kind table bounding what a new thing can *do*,
and the band pricing what it costs. It is not built until §4.8 says Tier 1 changes what a mind does.

### 4.10 One cheap game first

The brief's highest-leverage single run is independent of everything above and should go first: one
30-round game with thinking OFF, read for incoherence across rounds (stale stamps, plan continuity, the
budget), against the same scenario at thinking ON. About nine minutes. It decides whether cells C and D
above can run at thinking OFF, which is the difference between an evening and a week of GPU time.

---

## 5. brink — the second caller

### 5.1 What it proves, and what it cannot

brink has the trigger as a closed set (`ResolveRejectionReasonCode`, 24 codes) and the price enforced
at a write choke point (prestige conserved, DEFCON bounded, crises ticking). It cannot exercise the
engine's `create`/`write` resolution until Phase 3 lands (§1.2). Its elaboration is therefore a
brink-private mechanic in `src/tools/resolve.ts`, following §2's six steps, that becomes an engine
mechanic when brink adopts the protocol. It proves the *pattern* in a game whose price is not
negotiable, which is the half of the vision The Prisoner cannot test.

### 5.2 Mapping the codes to tiers

| code | tier | reading |
|---|---|---|
| `NO_PRESENCE_AT_FLASHPOINT` | 1 | *"You are not there."* Presence is a fact the world can acquire at a price. Today the price is a separate turn (`SHOW_OF_FORCE` adds presence, add-only). Elaboration lets a seizure attempt *establish and act* in one resolution at a combined price: a DEFCON step and the prestige rail, chosen by band from the turn reader's reading of how the player framed it. The GM narrates the deployment as fiction (Pillar 0). This may turn out to be "already a mechanic wearing a different door"; that is brink's call, and it is the cheapest first brink build. |
| `OFF_RAMP_CLOSED` | none | *"That exit does not exist any more."* Irreversible by design (DESIGN §5.3's island). Not elaborable: the honest world answer is the refusal, and this row is the reason §2 says elaboration never reopens an irreversible fact. |
| `INVALID_VERB` | none | The closed mechanic set is the game's rules, not a world fact. Refusal is honest. |
| `UNKNOWN_FLASHPOINT` | 2 | *"You named a place the world does not have."* The board is a four-entry literal; every flashpoint check validates against it; crises, presence, spheres and off-ramps key on it. A mid-game flashpoint is the most expensive elaboration in either game. Shape: the turn reader reports the named place with a citation; a proposer supplies key (under `FLASHPOINT_KEY_SHAPE`), name and region; the acquisition is priced in the prestige rail and a DEFCON step; the crisis engine may then erupt there and ticks regardless. Provenance is the player's own attempt, not the refresh pipeline, so §9.3's `world_proposals` stays as it is — this is a different path with a different authority, and it should say so in its own header. Not before Tier 1 has a number anywhere. |

### 5.3 The turn reader carries the question

Hard rule 5: one call per turn; add the question, never a second call. `TurnReading` gains a field —
in substance *does the player's action name a place or a presence the board does not have?* — answered
in keys with a citation from the player's own words, `UNREAD_TURN`'s value being *no*. It is
consequential, so it routes to the Haiku rung under `splitByStakes`. The AUTHORING-GUIDE checklist
applies: the words the citation needs must be groundable in the player's turn, and the instruction must
be in this question's own prompt.

### 5.4 The model constants, separately

Three `qwen2.5:14b` defaults move to `qwen3:14b` in their own commit, unrelated to elaboration:
`src/gm/turnReader/ollamaTurnReader.ts:50`, `src/refresh/adapters/localModel.ts:41`, and
`src/gm/local/index.ts` through the first. The pinning tests and two docs pages named in the brink map
move with them. The #49 threshold placing Haiku above the local rung was measured on 2.5 and needs
re-measuring after, not assuming.

### 5.5 Sequencing for brink

Nothing in brink before §4.8 has a number, unless the owner wants brink to move now (D1's *no*). The
result that decides it: if The Prisoner's mind acquires routes and pursues them when the obvious route
is closed, brink's presence elaboration is worth a playtest; if it never pursues a priced route, a
brink playtest would spend an evening learning the same thing.

---

## 6. `mother-of-invention` — the generative half

### 6.1 A third mechanism, `propose`

The brief's measured asymmetry: `ancient-awakening:12b` on an *ungrounded* prompt produced ten multi-hop
options in four seconds, several routed through other agents; handed the grounded wits prompt it
converged on the single route like everything else. The breadth is the prompt's. A mechanism that
exploits that has to hold the two prompts apart by construction:

```ts
export interface Proposed<C> { readonly candidates: readonly C[]; readonly broad: readonly string[]; readonly grounded: readonly { readonly from: string; readonly to: C | null }[] }
export async function propose<C>(
  view: { readonly broad: string; readonly grounded: string },
  { broaden, ground }: { broaden: (broadView: string) => Promise<readonly string[]>; ground: (idea: string, groundedView: string) => Promise<C | null> }
): Promise<Proposed<C>>
```

`broaden` is given the *less grounded* view and returns free-text ideas; `ground` is given each idea and
the grounded view and returns a candidate in the world's terms, or `null`. Both are injected exactly as
`recognise` and `regenerate` are, so the package keeps its no-I/O and zero-dependency guards without a
deliberate change. The rule the mechanism encodes, and the only thing it decides in code: **grounding is
a translation, never a filter.** A `null` from `ground` is recorded in `grounded` as a failed
translation, never dropped silently, because the brief's warning is that a filter rejects eight of ten
ideas for not being instantiated, which is the problem restated.

Real caller: The Prisoner's candidates step (`OpenProposal.candidates`, §20's shape). Measure by the
package's own bar: free turns only, in an elaborated world, against the same ledger. Not before §4.8:
§64.4's order is fix the instrument, then test a mechanism in it.

### 6.2 Hop count (brief Q5)

Elaboration lowers the hop count of the *world*: a fact that had to be authored in advance becomes one
the first attempt acquires. `propose` raises the hop count of the *mind*: multi-hop plans arrive from the
broad view. Hops that pass through another mind — the heart-attack plan's four — need #22's three
mechanisms (presence, a person as target, an effect that writes a belief) and are out of scope for both.

### 6.3 Nothing is deleted

Precedent and pick stay; 0.1.2 stays pinned. §64.4: they were never fairly tested, and the fair test
is a world with a non-dominant obvious route, which Tier 1 is for.

---

## 7. `mind-seam` — released; two pins remain

`mind-seam@0.5.0` is on npm with the provider facade (`Provider`, `createHttpProvider`,
`createCliProvider`, `roles.ts`). Untouched by the vision in both directions: it holds no context and is
indifferent to the world elaborating or not.

What the release unblocks, and when to use it: the play-time `need` question (§4.2) and the build-time
`difficulty` read (§4.2a) are each a *role*. When the build run sends a pair the author believes is
groundable to `review`, or reads `impossible` for it, the question "was the model too weak or is the
description ungroundable" is answered by binding that one role to a stronger backend through
`parseBinding` and re-running the build — fifteen minutes, no game — which is the experiment the facade
was built for. Two downstream commits, each its own PR in its own
repository, neither a dependency of Tier 1:

- The Prisoner: `mind-seam` 0.4.0 → 0.5.0, `PRISONER_*_MODEL` accepting a role binding string.
- brink: 0.2.0 → 0.5.0 (three minors; read the release notes for the `responseFormat` and `onSilence`
  detail changes in 0.3.0 and 0.4.0 first).

---

## 8. The brief's open questions, answered

1. **What triggers elaboration?** A failed ruling that named a perceived thing (§4.1). brink's codes are
   that signal in brink's vocabulary; The Prisoner's two null paths are it in its own. General, because
   both reduce to *the attempt targeted something the world holds, and needs something it does not*.
2. **Who prices it, in what currency?** A model reading each authored description *alone*, at build,
   picks a closed band per `(object, kind)`, replayed for agreement and reviewed by the author; a code
   table converts it into the currencies the game already enforces (D3). At play the band is a lookup.
   The referee still never invents a number, and no price is ever decided while an actor is speaking.
3. **What stops exploitation?** Structure (§2's list): no source to cite from for an unperceived
   target; a closed `need` vocabulary; a price fixed before the game from the description with
   `impossible` as its default, which the actor's words cannot reach; bounded, resolve-only state at a
   price; one acquisition per pair; provenance for every acquired fact; Tier 2 behind an audit and not
   built yet.
4. **Fog.** The caller's belief layer, stamped as of round N, the derived-object template (§4.5). The
   engine stays omniscient by decision.
5. **Hop count.** §6.2.
6. **The refusal confound.** Out of this batch; a human reads raw replies before any person-target arm is
   interpreted (§4.8).

---

## 9. Landing order — N commits, engine first

Each commit names the ones it depends on in its own message. Tests first in every repository.

| # | repo | commit | tests that go red first |
|---|---|---|---|
| E1 | run-dmcp | `IntendedCreate.constraints` (D2, run-dmcp#42), 0.9.0 | §3.2's four |
| E2 | run-dmcp | AUTHORING-GUIDE: the acquirable-space lesson + the four pointers (§3.4, first lesson only) | the pointer files exist and name the section |
| P0 | the-prisoner | the one thinking-OFF 30-round game (§4.10); a §-note, no code | — |
| P1 | the-prisoner | `npm run price-world` (§4.2a): the build-time `difficulty` read, N=5 on the spot, `elaborationBands.ts` written as data with citations, description hashes, `review` entries; the arm refuses to start on any `review` or stale hash | scripted reader with disagreeing replies → `review`; agreeing → data with citation; a changed description → stale, refuses; an author-set row carries its comment; the build run is logged in the sidecar shape |
| P1b | the-prisoner | the play-time elaboration request (`need` only) + sidecar entry + `PRISONER_ELABORATE` arm, no mechanic yet: fires, logs, applies nothing | scripted referee returns `need`; sidecar carries the second entry; replay reads it; header line; `off` is byte-identical (a prompt snapshot test) |
| P2 | the-prisoner | `OPEN_ACQUIRE`, the band table with empty start-value `reads`, `ELABORABLE_EXITS`, `adoptAcquiredProperty`, belief stamping, the outcome line, `PRISONER_ELABORATE_BAND` override recorded in the header | atomic rollback when the suspicion leg violates a bound; provenance on the event; band comes from the table never from a ruling; second acquisition of the same pair refused in code; fog audit clean; start value renders nothing, a worn value renders its line; a route opens through `leave` when integrity reaches the declared threshold |
| P3 | the-prisoner | the build run committed, `PREDICTION.md`, then cells A, B, C1–C3, D, E of §4.8, committed unedited | — |
| P4 | the-prisoner | OPEN-VARIANT §66 with the numbers, and D5's verdict | — |
| S1 | the-prisoner | pin `mind-seam@0.5.0` | `packageInfo.test.ts` |
| B0 | brink | three model constants to `qwen3:14b`; #49 re-measured | the pinning tests named in §5.4 |
| B1 | brink | pin `mind-seam@0.5.0` | seam conformance unchanged |
| B2 | brink | the turn-reader question (§5.3) behind an arm, then presence elaboration (§5.2 row 1) — after P4 | `coerceTurnReading` filters; Pillar 0 on the new `mustHonor` labels; nuclear lockout covers the new path |
| M1 | mother-of-invention | `propose` (§6.1), 0.2.0 — after P4 | the no-I/O guard still green with model functions injected; a `null` grounding is recorded, never dropped |

E1 is optional under D2; P2 works without it by inheriting derive's post-resolve declaration. P0 needs
no code and can run tonight.

---

## 10. What this design deliberately does not do

- No `unsupported` verdict, no pricing, no model, no fog in the engine (§3.3).
- No change to any recorded batch's referee request; the arm is off by default and the benchmark keeps
  it off.
- No Tier 2 code before Tier 1 has a number (D4).
- No brink build before The Prisoner's measurement unless the owner says so (D1, §5.5).
- No plausibility word list, no negation scan, no lexical anything. Every "no" above is a missing source,
  a closed key, or a constraint.
- No wiring between repositories. brink and The Prisoner share a shape, not code; the engine's change is
  published before either consumes it.

---

## Appendix A — the `run-dmcp` issue, in the engine's own words

**Filed as run-dmcp#42 on 2026-09-19**, with a synchronous-proof paragraph added. Written to pass
`engineVocabulary.test.ts` as filed. Do not add a consumer's name to it.

> **title:** A `create` leg may declare constraints on the entity it makes, inside the same resolution
>
> **The caller.** A consumer whose resolutions bring entities into existence (issue #34) needs each new
> numeric fact held `bounded` and `resolve_only` from the moment it exists. Today the only way is two
> library calls *after* `resolve()` returns — a second write path outside the resolution's transaction,
> which hard rule 7 and §5.2a's "every write goes through the audited path" were written against. The
> consumer records the workaround in its own tree. A second mechanic in the same consumer is about to
> need the identical pair of declarations.
>
> **What is asked.** An optional `constraints` field on `IntendedCreate`, in the constraint family's
> existing vocabulary (`bounded`, `resolve_only`, `monotonic`), applied by `resolve()` step 5 inside the
> same `withTransaction`, so a later leg of the same resolution is already held to them and the whole
> resolution rolls back together. `conserved` is not asked for: it is a statement about several existing
> entities, not about one being created. What is not asked: any interpretation of the key or the bounds.
>
> **Tests first, neutral fixture,** against a fresh database and an existing one: a create with
> `bounded` + a later leg exceeding the bound rolls back the create too; a direct write after the
> resolution is refused by the existing trigger with no post-resolution call made; a `constraints.key`
> not among the entity's live columns is refused before dispatch, naming the key; `listConstraints`
> shows the declaration with the resolution's event as cause.
>
> Minor, additive: 0.9.0.

## Appendix B — `PREDICTION.md` skeleton for P3

```
# Pre-committed before the elaboration batch ran (§4.8's discipline)
Written <date>, before the first call. Code revision: <sha> (clean). Scenario revision <sha>;
elaborationBands.ts committed at <sha>: <n> pairs model-read 5/5, <m> author-set, band as built for
(loose_tile, integrity) = <band>. Arms: PRISONER_ELABORATE=property, PRISONER_INSTRUMENT=checked,
PRISONER_DOOR=<value>, thinking <on|off> per cell (P0's game said <...>).

Metrics (mechanical, from the sidecar and summary): fired, acquired, pursued, ratified, agreement.
Predictions: A fired ≤ 2/10. B fired ≥ 6/10, acquired ≥ 3/10.
C1 (trivial) pursued ≥ 3/5, ratified 1–3/5. C2 (hard) pursued 1–3/5, ratified 0–1/5.
C3 (ruinous) pursued ≤ 1/5, ratified 0/5. Ordering pursued(C1) > pursued(C2) ≥ pursued(C3).
D pursued 0/3. E ≥ 80% on need.
Falsified if: C1 pursued 0/5 — a one-turn route is still declined; that is the mind, not the table, and
D5 says what it means. Look at that first. Also falsified if pursued(C3) ≥ pursued(C1): the band is not
what she reads, and the pricing story needs re-reading, not retuning.
Pre-named flat curve: C1 and C2 rarely, C3 never → §50.7 generalised; a finding about the mind.
Not predicted, genuinely open: whether any game in C1 is ratified through the elaborated route at all;
and whether B's acquired count moves with the as-built band.
```

## Appendix C — the arm, in one place

| env | values | default | header line | on `off` |
|---|---|---|---|---|
| `PRISONER_ELABORATE` | `off`, `property`, (later) `object` | `off` | `Elaboration: property` | byte-identical prompts, no second request, mechanic unregistered |
| `PRISONER_ELABORATE_BAND` | unset, or `trivial` / `hard` / `ruinous` / `impossible` | unset (the built table) | `Elaboration band: forced <band> (built: <band>)` | ignored |

Both refuse to pool with a batch at a different value; both are recorded beside `PRISONER_INSTRUMENT` and
`PRISONER_DOOR` in the transcript header; benchmark mode never turns either on. The override exists for
the sweep in §4.8 and for nothing else: a game with it set says so in its header, and the built table's
own band is printed beside it so the override can never be mistaken for the world's reading.
