# The Prisoner — design

*The rival-mind seam, extracted; its second caller; and what the engine learns from being called
adversarially.*

Written 2026-09-12 against `run-dmcp@0.5.0`, `brink-workshop` at 65861a3, and the engine's open
issues #18 and #30. **Revised 2026-09-13** after the owner decided the seam is extracted: brink
migrates onto it and The Prisoner is its second consumer. Section numbers prefixed `§` refer to
`run-dmcp/docs/DESIGN.md`; `#` numbers are that repository's issues unless a repo name is given.
This document is meant to become this repository's own authority the way §-DESIGN is the engine's;
until the repository exists it is a proposal.

---

## 0. The decisions, up front

| # | Decision | Why, in one line | Where argued |
|---|---|---|---|
| 1 | **The seam is extracted into a new zero-dependency package, `mind-seam`, a fifth repository beside the four root `CLAUDE.md` lists.** Not the engine, not the RPG layer. It carries the types, the wire, and the conformance suite. | The engine owns no code path that would ever call a mind, and the wire is network code the engine is built never to hold. One home, or the seam splits. | §2 |
| 2 | **The package is generic over the context.** `Mind<C, P>` with `C extends InertRecord`; each caller declares its own fields as a type alias, and the property — inert in, inert out, nothing callable, no path to storage — is enforced at runtime by `assertInert()` and checked by the conformance suite, not only by `tsc`. | The two callers *should* differ in fields, and a getter defeats both the type and `typeof`. | §3 |
| 3 | **Plan memory belongs to the caller**, as an attempt ledger in The Prisoner's own table, with the engine's `Contradiction` stored verbatim as the "why". It does not move into the package either. | A plan is belief, not truth; and the ledger's evidence is an engine type, which the package must never import. | §4 |
| 4 | **Private views are built in the caller, positively.** §8 is not pushed now; The Prisoner becomes #18's first caller with a `character` principal and reports a measurement. | Unchanged. | §5 |
| 5 | **Every consequential change goes through the engine's resolve protocol**, for both principals. The Prisoner is that protocol's *first* production caller. | Unchanged. | §6 |
| 6 | The mind is the package's wire over a local OpenAI-compatible endpoint with `tools: []`, keyless, silent on failure. **No MCP server, no game-master model.** The *loudness* — repeated silence surfaces — is The Prisoner's, over a reason the wire reports. | Unchanged in substance; the wire moved, the policy did not. | §7 |
| 7 | **brink migrates** in three commits against the published package at an exact pin. Archetypes, seat identity, wake, the turn pass, the prompt text and the coercer stay in brink; the types, the wire and the property move out. | What moves is exactly what a second caller would otherwise copy; what stays is content and brink's tables. | §8 |
| 8 | **Acceptance is one executable conformance suite, exported by the package and run by both callers** against their own context builder and their own mind. | "The same six tests in each repo" was a cross-repo invariant nothing checked. | §9 |
| 9 | Engine issues, in landing order: **#30** (record the hop), **#31** (adversarial neutral-fixture resolve test), and **a non-numeric intended change** — the last *withdrawn* until P3 is green and custody is the next failing test. | Nothing enters the core against an imagined client, and a filed issue is the mild form of that. | §6.3, §10 |

---

## 1. Premises the tree corrected

The brief was written from the design documents. Five things in the code differ from it, and each
one moved a decision below. Extraction changes none of them.

**1.1 brink does not call the engine's resolve protocol.** `grep -rl createResolver brink-workshop/src`
returns nothing. brink's referee is its own `src/tools/resolve.ts`, 2,889 lines, and its
`CLAUDE.md` lists six files vendored "until Phase 3"; `docs/RUN-DMCP-PHASE-3.md` records that Phase 3
has not been executed, and §11's Phase 4 (brink's resolver shrinks to eight registered mechanics)
comes after it. What brink imports from the package today is the spine and the tooling — `createGame`,
`validateGameExists`, the world/character/narrative tools, `LIMITS`, `ANNOTATIONS`, the logger — and
one write to `modifySecretVisibility`. **The resolve protocol, the narration constraint, `replay`,
`writeConstrainedValue`: no production caller anywhere.** The brief's "exactly one caller and no
adversarial one" is generous by one. This is the single most consequential fact in this document,
because it means The Prisoner would be the first thing to ever call `resolver.resolve()` in anger.

**1.2 The generic part of the rival system is smaller than a module — but it is not zero behaviour.**
Counted, not estimated:

| brink module | lines | generic residue |
|---|---|---|
| `rivals/mind.ts` | 90 | `Mind`, a context shape, a proposal shape, `SILENT_MIND`, `scriptedMind` — about 30 lines |
| `rivals/wake.ts` | 64 | none as code; one sentence as a property (§3.4) |
| `rivals/seatAgent.ts` | 102 | none — a brink table with a foreign key onto brink's `seats` |
| `rivals/archetypes.ts` | 162 | none — content |
| `rivals/turn.ts` | 162 | none as code; the *shape* of the pass generalises as prose (§3.5) |
| `gm/local/rivalMind.ts` | ~220 | **about 70 lines of wire**: the POST with `tools: []` and `stream: false`, no credential, the think timeout, JSON-or-nothing parsing, base coercion (intent required, optional line, length cap), every failure to `null`. The prompt text, the capital names and the archetype lookup are brink's. |

The first draft of this document counted the wire as "reproduced" and therefore outside the
extraction. Under extraction it is the part that matters most: it is the only *behaviour* in the
seam, it is what a second caller would otherwise copy line for line, and it is network code — which
decides where the seam cannot live (§2).

**1.3 The resolve protocol's write vocabulary is numeric.** `IntendedChange` is `IntendedWrite |
IntendedTransfer` (`src/timeline/resolve.ts`), both over `number`, applied through
`writeConstrainedValue` / `transferConstrainedValue`. A mechanic cannot move an item between owners,
set a string-valued fact, or declare a fact irreversible as part of its adjudication. brink has not
noticed because brink's referee never calls it — but brink's flashpoint alignment is a string written
through `greatPowers.ts`, so Phase 4 would hit the same wall. The Prisoner hits it at its first
`SEARCH` that confiscates something.

**1.4 The RPG layer's quests are the nearest thing to a plan, and do not fit.** `QuestObjective` is
`{ id, description, completed: boolean, optional? }`; a quest's status can be `failed` but an
objective cannot, and nothing carries evidence. It is the right *place* for "objectives that fail
with a reason" if a second caller ever wants that; it is not built, and building it for one caller
would be building The Prisoner's plan table inside the engine (§4).

**1.5 `expects` is silent about an entity that has no fact at `t`.** `contradictions()`'s own
comment: *"A claim naming an entity/key with no fact in `mustHonor` yields NOTHING: the engine is
silent about what it does not know."* So an expectation cannot say "this entity still exists" — a
proposal that expects a destroyed bar dispatches. That fixes how The Prisoner models a replaced bar:
the same entity with its value reset (which *does* contradict), never a new entity (§6.2, Appendix A).

Two smaller ones. **#30** (the one hop of causality is derived, can be null, and breaks ties by
random hex) is a live dependency of plan memory, since the "why" is that hop. And brink's
`getSecretsVisibleToSeat` passes a seat *label* where the engine's `listSecrets({ knownBy })` expects
a character id — the engine holds a caller's vocabulary as opaque data there, which is fine, and is
also evidence for §5: brink's principal never resolved to an engine entity in that call; The
Prisoner's does.

---

## 2. Decision 1 — where the extracted seam lives: a fifth repository

### 2.1 The two objections to an engine home, answered

The first draft listed three homes for a shared seam — **A** a new package, **B** the engine core,
**C** the RPG layer — and argued against B and C with one sentence: a `Mind` would be "a type the
engine never calls." The revision brief asked that the sentence be either backed by a code path the
engine *would* own, or accepted as the reason B/C lose. It is the reason they lose, and here is the
check that was run.

**There is no engine-owned code path.** The engine already hosts two injected interfaces, and both
come with engine code that *dispatches* them: `Mechanic.adjudicate` is called by `resolve()` inside
its transaction, after `expects` and before the constrained writes; `ReaderTransport` is called by
`runLadder()` rung by rung, with citation and rejection reasons around it. Each interface exists
because the engine has something to do on both sides of the call. For a mind there is nothing on
either side. Deciding *who* thinks is the caller's (§3.4 — brink reuses a turn-reader answer The
Prisoner cannot produce). Deciding what to *do* with a proposal is the caller's (brink: narrator
material; The Prisoner: a move for the referee). The only engine function that could host a
`consider()` call would be a "principal pass" that takes a roster, a view builder and a disposition
policy as parameters — that is, a function whose every input and output is caller-owned, which is
the definition of a function that does not belong where it is. So B/C would export a `.d.ts` with no
`.js` behind it, and the engine would become the arbiter of a contract it never executes.

**The wire is extracted, and that settles the rest.** §1.2 corrects the first draft's count: the
seam's only behaviour is the ~70 lines of `rivalMind.ts` that every caller would otherwise duplicate.
Those lines are a `fetch`, a base URL, a timeout, a request body with `tools: []`, and a deliberate
absence of an `Authorization` header. `run-dmcp/src/reader/__tests__/noVendorTransports.test.ts`
forbids every one of those tokens under `src/reader/`; the rule it enforces is the engine's, not that
directory's — the turn reader's header calls a transport "a plain async function the CALLER wrote",
and `CLAUDE.md` says the library entries import nothing that starts, opens or connects anything.
Placing the wire in some other engine directory to stay outside the test's scan would be routing
around a rule, which that repository's vocabulary guard already treats as editing the assertion that
says you may not. So even if B/C had found a code path for the types, the wire would have needed a
second home, and a seam with two homes is two seams.

**A**, then — and A's own objection from the first draft ("it makes the two callers' contexts the
same type") is answered by making the package generic over the context (§3). The objection was real
against a package that exported one `Context`. It is not an objection to a package that exports
`Mind<C, P>`.

### 2.2 The package: `mind-seam`

A new repository at `~/rpg/mind-seam`, GitHub `JavaDerek/mind-seam`, published to npm as `mind-seam`
(the name was free on 2026-09-13; it is the owner's to change and nothing below depends on it).
A fifth sibling under `~/rpg` beside the four root `CLAUDE.md` lists, and The Prisoner is the sixth.

What it contains, and nothing else:

| entry | what | why it is here and not in a caller |
|---|---|---|
| `mind-seam` | `Inert`, `InertRecord`, `Proposal`, `Mind<C, P>`, `assertInert()`, `SILENT_MIND`, `scriptedMind()` | the contract, declared once, checked by `tsc` in both callers |
| `mind-seam` | `createLocalMind()`, `coerceProposal()`, `firstJsonObject()`, `SilenceReason` | the wire (§7): the only behaviour in the seam, and the part two callers would otherwise copy |
| `mind-seam/conformance` | `seamConformance(harness)` — six executable checks | the property, stated once and executed in every caller (§9) |

What it does **not** contain: a context. The package has no opinion about fields. It does not
contain wake, identity, archetypes, a ledger, a prompt, a view builder, or a default base URL —
"a hostname is configuration", and the package knows where nobody's box is.

**Zero runtime dependencies, enforced by test.** `package.json`'s `dependencies` is `{}` and a test
reads it and says so. In particular the package does not depend on `run-dmcp`. This is not hygiene;
it is the "no path to storage" half of the property made structural at package level: nothing in
`mind-seam` *can* import a database, so a mind the package builds cannot write state by import any
more than by capability. A caller-written mind (a scripted stub in a test) is the caller's, and the
caller's own engine-side test — a direct write to a `resolve_only` value is refused — covers it.

### 2.3 What a fifth repository costs, honestly

- **A `CLAUDE.md`** — Appendix C lists what it must say. Thin, because the package is small, and
  because a rule stated there is a rule for exactly one repository.
- **CI** on the same four gates as the neighbours: `lint`, `typecheck`, `test:run`, `build`. Its
  own vocabulary guard (both consumers' words forbidden — §C), its own no-network-outside-`src/wire/`
  guard, the zero-dependency test.
- **A publish flow.** run-dmcp's `release.yml` is the template: tag-triggered, npm trusted publisher
  over OIDC, no token anywhere. One-time human step on npmjs.com to register the publisher for the
  new package. The tag must equal `package.json`'s version or the run fails before the registry.
- **Two exact pins** (`mind-seam@0.1.0`, no caret) and a bump in each consumer per package release,
  as N commits naming each other. This is the recurring cost. It is bounded by design: *a field on a
  caller's context never needs a package release* — that is what the generics buy — so the package
  changes only when the wire or the conformance suite does, and its `CLAUDE.md` says that adding a
  caller's field to the package is a stop sign.
- **Root `CLAUDE.md`** gains two tree lines and one jurisdiction line (§10, step R1). It does not
  gain a rule: the package's rules are true for one repository.
- **Never linked.** No `npm link`, no `file:`. brink's migration (§8) builds against the published
  `0.1.0`, which is the only evidence the published package works.

---

## 3. Decision 2 — what is generic, revisited under extraction

### 3.1 The shape: generic over the context, inert by construction

The core finding stands: the two callers' contexts should have different fields. brink's rival needs
a seat, an archetype, a backstory and a briefing; The Prisoner's needs a principal id, an authored
identity and motive, a briefing that includes ledger prose, and a closed set of moves. What must be
the same is the property, and the property is about *kind*, not *fields*: every value is data, no
value is callable, no value reaches storage.

```ts
// mind-seam — src/types.ts

/** Data and nothing else. No function, no symbol, no class instance, no getter. */
export type Inert =
  | string | number | boolean | null | undefined
  | readonly Inert[]
  | InertRecord;
export type InertRecord = { readonly [field: string]: Inert };

/** The least a proposal is. A caller may add fields; whatever it adds is Inert. */
export type Proposal = InertRecord & { readonly intent: string; readonly line?: string };

/** The seam. One method, by design: a mind is asked; it never polls (§3.4). */
export interface Mind<C extends InertRecord, P extends Proposal = Proposal> {
  consider(context: C): Promise<P | null>;
}

/** Throws unless `value` is Inert at runtime — see §3.2 for what the type cannot catch. */
export function assertInert(value: unknown, path?: string): asserts value is Inert;

export const SILENT_MIND: Mind<InertRecord, never>;          // assignable to any Mind<C, P>
export function scriptedMind<C extends InertRecord, P extends Proposal>(
  script: P | null | ((context: C) => P | null)
): Mind<C, P>;
```

Both callers, expressed in it:

```ts
// brink-workshop — src/rivals/mind.ts, after migration (§8)
import type { Mind, Proposal } from "mind-seam";
export type RivalContext = {
  seatId: SeatId;                       // brink's three-seat roster
  archetype: RivalArchetypeId;          // brink's five archetypes
  backstory: string;                    // generated once, remembered (seat_agents)
  briefing: string;                     // buildBriefing(gameId, { seatId }) — that seat's own view
};
export type RivalProposal = Proposal;   // { intent, line? } — material for the narrator
export type RivalMind = Mind<RivalContext, RivalProposal>;

// the-prisoner — src/mind/mind.ts
import type { Mind, Proposal } from "mind-seam";
export type PrisonerContext = {
  principalId: string;                  // the prisoner's character id
  identity: string;                     // authored
  motive: string;                       // authored
  briefing: string;                     // viewFor(prisoner) rendered, plus the ledger's prose
  moves: readonly string[];             // the registered prisoner mechanics — a closed set
};
export type PrisonerProposal = Proposal & { readonly choice?: string };   // a move for the referee
export type PrisonerMind = Mind<PrisonerContext, PrisonerProposal>;
```

Four fields against five, one of them an array; one proposal with two fields against one with three;
the same `Mind`. Adding a field to either context is a one-repository change with no release. Adding
a field whose type is not `Inert` — a database handle, a resolver, a function — is a `tsc` error in
that repository, because `C extends InertRecord`.

**Contexts are declared as `type` aliases, not `interface`s.** TypeScript gives an object type
literal an implicit index signature and an interface none, so an `interface RivalContext` is not
assignable to `InertRecord` even when every field is a string. brink's two declarations are
interfaces today; converting them is the first, non-behavioural commit of the migration (§8.2), and
it is also the first *red* test of the migration — the harness does not compile until it is done.

### 3.2 What the type system cannot keep, and how the property is enforced instead

Two holes, both closed at runtime by the package, both exercised by the conformance suite (§9):

1. **A cast.** `context as unknown as RivalContext` admits anything. Nothing static survives that.
2. **A getter.** `{ get briefing() { return readTheDatabase(); } }` type-checks as `{ briefing:
   string }`, passes `typeof value === "string"`, and is a live path to storage. brink's existing
   "nothing callable" test (`Object.values(...).every(typeof === "string")`) would not see it.

`assertInert()` walks the value and requires, at every level: a primitive from the `Inert` set, or
an array whose prototype is `Array.prototype`, or an object whose prototype is `Object.prototype` or
`null` — and for every own property, a **data** descriptor (`get` and `set` both `undefined`). No
function, no symbol key, no class instance, no accessor. It throws naming the offending path.

Where it runs: inside `createLocalMind()` before a prompt is built (a non-inert context is a
programming error and throws; it is not model silence), inside `scriptedMind()` when a function
script captures a context, and as conformance check 2 over the *real* context each caller's loop
built. The property is therefore held by type at authoring time, by runtime assertion at the seam,
and by an executable check in CI — none of which is policing, because none of them reads the mind's
code.

### 3.3 Identity: brink-private

`seat_agents` exists because brink's rivals are *generated* and must not be re-cast next session
(#33's lesson). The Prisoner's principal is authored — one prisoner, a hand-written motive per
scenario. Nothing to generate, nothing to remember. The package has no identity concept; "who is
this" is whatever strings the caller puts in its context.

### 3.4 Wake: stays prose, and the interface's shape is the structural half

`wakeRivals(reading, seats, playerSeatId)` is a pure filter over brink's turn reading. Its value is
the *input*, a cited answer to "who did the player address" that The Prisoner has no way to produce
and no need for. A generic `Wake<Principal>` type in the package would be a function type over
caller-specific inputs that nobody would import.

The generic statement — **the caller decides who thinks; a mind is asked and never polls; the
decision is pure, bounded by the roster, and fails toward silence** — goes into the package's README
as prose. Half of it is already structural: `Mind` has exactly one method and it takes a context. A
mind has no `start()`, `subscribe()` or `tick()` to be handed; nothing in the type gives it a way to
run unasked. That is the "never polls" clause enforced by shape, and it is why the interface stays
one method. The other clauses are the caller's policy and stay in the caller's code.

### 3.5 Orchestration: the shape generalises as prose

`runRivalTurnPass` is: decide who is awake → ensure identity → build each one's *own* view →
`consider()` → collect → record. The Prisoner's round (§6.1) has the same skeleton with "decide who
is awake" deleted and "record" replaced by the resolve call. The conformance suite (§9) asks each
caller for exactly one thing here: a `pass(mind)` function that runs its own loop once with an
injected mind. The loop stays the caller's.

### 3.6 The rest

Archetypes are content. Fog of war and the briefing are brink's own view builders; The Prisoner
writes its own (§5) and they share nothing but the discipline. The ledger is The Prisoner's (§4).

---

## 4. Decision 3 — plan memory is the caller's, and not the package's either

### 4.1 The requirement

The prisoner executes a multi-step plan across rounds and must know where it is in it, including
which steps failed and why. Nothing in either repository stores that: `seat_agents` remembers who an
agent *is*; nothing remembers what it is in the middle of.

### 4.2 Against the core

Hard rule 1 asks "generic, with at least one real caller." One real caller: yes. Generic: no, on
three grounds.

1. **It is not world truth.** The engine's thesis is that the server owns what is true, including
   when. A plan is what a principal intends, and an intention is not a fact about the world. Stored
   as facts on the prisoner entity it would appear in `narrationConstraintAt(...).mustHonor` — a
   narrator would be *bound* to honour "the prisoner intends to file the bar" — and in `replay(t)`
   and the export, which is where the warden's view is built from.
2. **The engine has no principal model.** That is #18's whole finding: there is no "visible to whom",
   by decision. Plan memory in the timeline is private state in an omniscient store, and the only
   thing that keeps it out of the warden's payload is a subtraction in the caller — the exact leak
   #18's §4 calls the medium signal. Putting it in the engine before a principal model exists is the
   wrong order, and the principal model is the expensive half nobody has asked for yet.
3. **The shape is this caller's.** Sequence, per-step status, evidence per failure — brink's rivals
   propose an intent per turn and forget it, and have no use for any of it. A second caller for
   "objectives that fail with evidence" would land it in the RPG layer's quests (1.4), which is the
   right place and is recorded here as where it goes, not as something to build.

### 4.3 Against the package

The brief left open whether the ledger's *shape* moves into `mind-seam`. It does not, for one
decisive reason: the ledger's evidence column is the engine's `Contradiction[]` and
`ConstraintViolationError`'s fields, stored verbatim. A ledger type in the package would either
import those types — making `mind-seam` depend on `run-dmcp`, which §2.2 forbids because it is the
"no path to storage" guarantee — or redeclare them, which is the mirrored-constant mistake root
`CLAUDE.md` closed on 2026-09-05. And it has one caller. It stays here.

### 4.4 The design

An **attempt ledger** in The Prisoner's own schema, brought up through the engine's
`initializeSchema({ migrations })` hook so it lives in the same database under the same rules:

```
plans        (id, game_id, character_id, created_t)
plan_steps   (plan_id, step_index, move, description, status, evidence, attempted_at_t)
               status   ∈ pending | active | done | failed | abandoned
               move     = a mechanic name The Prisoner registered (never interpreted; matched by equality)
               evidence = JSON: the engine's Contradiction[] verbatim, or a ConstraintViolationError's
                          { constraintKind, resourceId, contradictedFact? } — the one hop, never a sentence
```

The plan skeleton is authored per scenario (content). The ledger is mechanism. When the mind's chosen
move (§6.1) equals the active step's `move` — a literal check of a token we defined — the attempt is
recorded against that step; otherwise it is recorded as an off-plan attempt. On
`ResolveProtocolError("expectation-contradicted")` the contradictions are stored as evidence and the
step is marked `failed`; on `ConstraintViolationError` likewise; on an outcome, `done` or still
`active` per the mechanic's own `result`.

**The "why" is the engine's one hop, stored verbatim.** This is the finding worth the most: the
brief's "which steps failed and why" needs no engine feature, because §5.2c already returns exactly
that — the contradicted fact, its `validFromT`, the event that opened it — and the caller only has to
keep it. It also makes **#30 a real dependency**: today that hop can be `null`, and a ledger entry
reading "failed, reason unknown" is precisely the check-that-cannot-be-argued-with §5.2c was written
against. The Prisoner tolerates `null` (and tests the null path) so it can be built before #30 lands,
and becomes #30's adversarial caller the day it does.

**Rendering memory into the context** is caller prose and free, built from the ledger in positive
form: *"Round 7: you filed the bar (integrity 40). Round 9: filing was refused — the bar's integrity
was 100, set by the warden's replacement at round 8."* Not a diff, not "no longer". The ledger
carries `t` per attempt, so "what was the plan at t" is reconstructible without the plan being in the
timeline. The rendering lands in `briefing`, which is a string, which is `Inert`; the package never
learns a ledger exists.

---

## 5. Decision 4 — private views, built in the caller, and what that does to §8

### 5.1 The Prisoner's visibility relation

One room. What a principal can see is two predicates, both positive:

- **The room and its contents** — every item owned by the cell location whose `concealed_by` fact
  is absent, plus the other principal's presence (a character with `location_id` = the cell).
- **Its own things and its own knowledge** — items it owns (including concealed ones), and facts on
  its own character entity of the form `knows_<key>` (e.g. `knows_rotation_changed`), which are
  ordinary facts written by mechanics like `INSPECT` and `OBSERVE`.

`viewFor(gameId, characterId)` **selects** those entities and renders them with
`createStateRenderer` under The Prisoner's vocabulary. There is no "replay minus hidden" step; a fact
that does not hold produces nothing, and a fact on an entity that was not selected is never read. The
mind's `briefing` is that rendering plus the ledger prose (§4.4). That is brink's guarantee — the
rival "was never in the room" — arrived at without a fog module, because a one-room game's fog is
about concealment and knowledge, not about who holds which map square.

### 5.2 Does this push §8?

Read against #18's three signal shapes:

1. **Principal resolves to an entity the engine already has.** Yes, and more cleanly than any caller
   so far: both principals *are* `character` entities. (brink's seats resolve to factions via
   `factionId`, which also satisfies "resolves to", but brink passes seat labels where the engine
   expects character ids — 1.5 — and never asked.) **The erratum's first half is satisfied, by two
   callers.**
2. **A check stated structurally.** It can be: *if fact F is on an entity not selected for principal
   P at `t`, a claim asserting F in a payload built for P is prohibited.* But note what that sentence
   contains — "selected for P" — which is the caller's relation. The engine could hold the check only
   if it held the relation, and the relation is two game-specific predicates.
3. **An answer for export.** The omniscient file, plus this projection in the client. Owned.

So The Prisoner *can* arrive with all three, and the recommendation is still **not to build**, for
#18's own reason: the requirement is not concrete until the view builder exists and its shape is
measured. The commit that lands `viewFor` should post to #18 with two numbers — lines in the
selection, and whether any of them subtract — and the decision belongs to the engine at that point.
If the answer is "two positive predicates and a render call", the engine has nothing to add. If the
warden's and prisoner's builders ever share a subtraction, that is the medium signal, with its size.

**What this does say now:** #18's milestone description ("needs a real caller") has one, of the
kind the second correction on that issue hoped for — a character, not a label. Recorded there, not
built here.

**What the conformance suite adds (§9, check 4):** the fog property becomes an executable assertion
both callers run — the other principal's private act, carrying a token the test planted, is absent
from the context the mind was actually handed. In brink that is what the player said to a different
seat; here it is the warden's concealed order. Same check, different private act, supplied by each
caller's harness.

---

## 6. Decision 5 — the resolve protocol is the referee, for both principals

### 6.1 The round

`t` is a **half-round counter** on a `counter` axis via `declareTimeAxis`: the warden acts at `2n`,
the prisoner at `2n+1`. Two principals writing at the same `t` would leave their order to event id,
which is random hex (#30's tiebreak, made worse); a half-round is an axis the game never re-cuts, so
§14's invariance property holds — trivially, as it does for brink, and correctly.

```
warden's half-round (t = 2n)
  command from a closed set  →  Proposal{ mechanic, parameters, expects? }  →  resolver.resolve()
  outcome.description + viewFor(warden) rendered to the terminal

prisoner's half-round (t = 2n+1)
  viewFor(prisoner) + ledger prose  →  PrisonerContext  →  mind.consider()  →  PrisonerProposal | null
  choice ∈ moves? (literal membership, done by the coercer; else null)
  Proposal{ mechanic: choice, expects: active step's declared expectations }  →  resolver.resolve()
  outcome | refusal  →  ledger (status, evidence)
  the warden is told only what viewFor(warden) shows at 2n+2
```

The mind never sees the resolver; the referee does, on both sides. Everything with consequence —
filing, honing, shimming, inspecting, replacing a bar, rotating a guard, searching — is a registered
mechanic returning `IntendedChange`s over values declared `resolve_only`. A direct write to any of
them is refused by the engine's own trigger, which is the test brink's #97 wrote for its local GM,
here written once for a human and once for a model.

### 6.2 What it proves

- **The protocol carries a second, physical, two-principal game with no engine change for numeric
  state.** Bars, edges, alertness, integrity are bounded numbers; `resolve_only` keeps both hands off
  them; `irreversible` on the `cut` fact is §5.3's island — a cut bar cannot quietly be whole again,
  and a `REPLACE_BAR` after the cut is refused with the hop attached. That is the first adversarial
  caller of the constraint family: two proposers contending for the same value across rounds.
- **`expects` + one hop is the failure-memory primitive** (§4.4). No new engine feature for "why".
- **The seam's property holds in a game where the mind's output is actionable.** brink's proposal is
  material for a narrator; The Prisoner's is a move for a referee. Same `Mind`, same no-write
  property, opposite use — which is what "generic" was supposed to mean, and under extraction it is
  the same `Mind` by import rather than by resemblance.

### 6.3 What it finds

1. **Numeric-only intents (1.3).** The first `SEARCH` that confiscates the file needs item custody to
   move, and `transferItem` is outside the protocol. Doing it "after resolve returns" is a second
   write path — the disease hard rule 7 names. So The Prisoner lands its numeric mechanics first
   (P1–P3) and **engine issue E3** asks for a non-numeric `IntendedChange` — a column set on a
   projected row, and a declare-irreversible — applied inside the same transaction. Real caller: this
   game. Latent second: brink's alignment string at Phase 4. **Not filed until P3 is green and the
   custody mechanic is the next failing test.** It was filed early as run-dmcp #32 and has been
   withdrawn (§10); the draft stays in `docs/issues/` to be re-filed when its caller exists in code.
2. **Expectations are equality-only and silent on absence (1.5).** Modelled around (Appendix A);
   recorded in #31 as tests, not features.
3. **A mechanic cannot declare irreversibility.** `declareIrreversible` is a library call the referee
   makes after the outcome — outside the transaction. Folded into E3's scope for the engine to decide.
4. **#30.** The hop can be null. Dependency, not blocker (§4.4).

---

## 7. Decision 6 — the mind's wire, now the package's

### 7.1 Not an MCP server

MCP exists to hand a model tools. This model is handed none — `tools: []` is asserted in a test, in
the package and again in each caller's conformance run — so an MCP surface for it would be a
transport carrying nothing, and the one thing it *could* carry is the write capability the seam
exists to withhold. The mind is a function.

### 7.2 No game-master model in v1

brink needs a GM because a human's free text must be classified into mechanics. The Prisoner's human
is the warden, who acts through a closed command set — a command, not fiction, the same carve-out
brink makes for `"quit"` — and reads a rendering of state (positive nouns, from the engine's renderer)
plus each mechanic's own `description`. So the only model in the process is the prisoner's mind, over
the same keyless local endpoint brink uses, at one call per round. The cost profile that drove
brink's wake gate does not exist here; what replaces it is a think budget and a silence policy.

If free-text warden input is ever wanted, it goes through the engine's turn reader with
`answerKeys` = the registered mechanic names, cited against the warden's own words — never a regex.

### 7.3 The wire, as the package exports it

```ts
// mind-seam — src/wire/localMind.ts
export type SilenceReason = "unreachable" | "timeout" | "status" | "unparseable" | "rejected";

export function createLocalMind<C extends InertRecord, P extends Proposal>(options: {
  baseUrl: string;                                   // required: the package knows nobody's box
  model: string;
  prompt: (context: C) => string;                    // the caller's; pure; built from context alone
  coerce: (raw: unknown, context: C) => P | null;    // the caller's; pure; composes coerceProposal()
  temperature?: number;                              // default 0.9 — warm, because a mind cannot write
  timeoutMs?: number;                                // default 12_000 — a slow box costs an opinion, never the turn
  fetchFn?: typeof fetch;                            // injectable, so every test runs offline
  onSilence?: (reason: SilenceReason, context: C) => void;
}): Mind<C, P>;

/** intent required and non-empty; line optional; both trimmed and capped (default 600). */
export function coerceProposal(raw: unknown, maxLength?: number): Proposal | null;
/** JSON, or nothing: the first balanced object in a fenced or sentence-wrapped answer. */
export function firstJsonObject(text: string): unknown;
```

What the wire does, and tests in the package assert offline with an injected `fetch`: `POST
{baseUrl}/chat/completions` with `tools: []`, `stream: false`, the caller's prompt as one user
message, `content-type` as the only header — **no `Authorization`, no key, no read of
`process.env`**; `AbortSignal.timeout(timeoutMs)`; on any failure — unreachable, timeout, non-200,
body that is not JSON and contains no balanced object, or a `coerce` that returns `null` — call
`onSilence(reason, context)` and return `null`. It calls `assertInert(context)` before building the
prompt and throws if that fails, because a non-inert context is a defect, not a quiet model.

What the wire does not do: choose a base URL (brink keeps `DEFAULT_OLLAMA_BASE_URL`; The Prisoner
reads its own environment variable), build a prompt, or know what a `choice` is. The caller's
`coerce` is where The Prisoner checks `choice` by literal membership in `context.moves` and returns
`null` otherwise — the reader's own discipline (answer in keys from a caller-declared set; safe
default is none) applied inside one call.

### 7.4 Failure is silence, and silence must become loud — in the caller

Every failure path returns `null`, as in brink. Unlike brink, a prisoner who says nothing every round
is not a quiet seat; it is a game that has stopped without saying so. The loop counts consecutive
`null`s and, at two, tells the warden's terminal the box is unreachable — naming the last
`SilenceReason` the wire reported, which is why the wire reports one. That is the loudness brink
gives its local *GM* (`LocalGMUnreachableError`) and withholds from its rivals, applied here to the
only model there is.

The counter stays in The Prisoner. brink does not want it (a silent rival is every seat's default
state), and a policy one caller wants belongs in that caller. What is generic is that the wire *says
why* it was silent, as a closed literal set, so a caller can decide what repeated silence means.

### 7.5 The proposal shape

Two options were open. **(A)** keep `{ intent, line }` and classify the intent into a move with the
engine's turn reader, cited against the intent text. **(B)** hand the mind a closed list of moves in
its context and let it answer `{ intent, line, choice }`, validating `choice` by literal membership.
The Prisoner takes **B**: it costs one model call per round instead of two, it is expressible as a
caller `coerce` over the package's base, and the guard against a model naming a move its intent did
not earn is the resolver, not a citation — `expects` and the constraints refuse what the world
refuses. (A) is the fallback if the 14B cannot hold both jobs in one answer; it changes nothing
above this section.

---

## 8. Decision 7 — brink's migration

### 8.1 What moves, what stays

| brink file | after migration |
|---|---|
| `src/rivals/mind.ts` | **Shrinks.** Declares `RivalContext` and `RivalProposal` as type aliases over the package's `Inert`/`Proposal`; `RivalMind = Mind<RivalContext, RivalProposal>`. `SILENT_MIND` and `scriptedRivalMind` become re-exports of the package's `SILENT_MIND` and `scriptedMind` so no test changes. The header keeps its argument and cites the package for the property. |
| `src/gm/local/rivalMind.ts` | **Shrinks.** Keeps `buildRivalPrompt` (capital names, archetype sketch — content), `coerceRivalProposal` (now `coerceProposal` from the package with brink's 600 cap), `RIVAL_THINK_TIMEOUT_MS`, `RIVAL_TEMPERATURE`, `MAX_RIVAL_TEXT_LENGTH`, and `createLocalRivalMind(options)` with its exact current signature, implemented as `createLocalMind({ ...options, prompt: buildRivalPrompt, coerce: coerceRivalProposal, onSilence: log.warn })`. Deletes its call to `openAiChat.ts`'s `sendChatCompletion`, its own `safeParse`, and the null-on-failure `try/catch` — that is the wire, and it is the package's. (Correction, 2026-09-13: the revision said this file had its own `fetch`. It has none; today the rival request goes out through `sendChatCompletion`, line 41, which the first draft had right.) |
| `src/rivals/wake.ts` | **Stays.** brink's input, brink's roster (§3.4). |
| `src/rivals/seatAgent.ts` | **Stays.** A brink table with a foreign key onto brink's `seats`. |
| `src/rivals/archetypes.ts` | **Stays.** Content. |
| `src/rivals/turn.ts` | **Stays.** brink's orchestration; it imports `RivalMind` from `./mind.js` exactly as today. |
| `src/session/cli.ts`, `playSession.ts`, `persona/systemPrompt.ts` | **Unchanged.** `createLocalRivalMind`'s signature and `RivalMind`'s shape are preserved. |
| `src/gm/local/openAiChat.ts` | **Unchanged as a file.** It is the GM's wire (#97: tools, SSE, fails loudly) and *also*, today, the rival's transport — `rivalMind.ts` calls its `sendChatCompletion`. After M3 the rival stops importing it; `backend.ts` remains its caller. |

Archetypes and seat identity are content and brink's tables, as the brief expected. The one thing
the first draft would have kept that now moves is the wire, and the one thing the brief might have
expected to move that does not is the prompt: it names Washington, Moscow and Beijing, which is
brink's vocabulary and would trip the package's guard (§C).

### 8.2 The commits, each green, against the published package

Depends on `mind-seam@0.1.0` being on npm (§10, S2). Each commit names that.

| | commit | red first | why it stays green |
|---|---|---|---|
| **M1** | `npm install --save-exact mind-seam@0.1.0`. Add `src/rivals/__tests__/seamConformance.test.ts` with brink's harness (§9.3). Convert `RivalContext`/`RivalProposal` from `interface` to `type`. | Write the harness *before* the conversion: `npm run typecheck` fails because an interface is not assignable to `InertRecord` (§3.1). Convert; green. | The conversion is non-behavioural. The six checks pass against brink's existing code on the first green run, which is the point: brink already has the property, and now a second repository's suite says so. |
| **M2** | `mind.ts` re-declares over the package; `SILENT_MIND`/`scriptedRivalMind` become re-exports. | A test asserting `SILENT_MIND` from `./mind.js` **is** the package's `SILENT_MIND` (`toBe`), red until the re-export exists. | `mind.test.ts`, `turn.test.ts`, `rivalMindsWiring.test.ts`, `rivalTurnPass.test.ts` import the same names from the same path and see identical behaviour. |
| **M3** | `rivalMind.ts` builds `createLocalRivalMind` on `createLocalMind`; stops importing `openAiChat.js` and deletes its own `safeParse`. | A syntactic scan of our own file — the engine's boundary-test device — asserting it does not import `./openAiChat.js` and contains no `JSON.parse(`. Red today on both counts (line 41 imports `sendChatCompletion`; `safeParse` calls `JSON.parse`). Not a `fetch(` scan: that would be green before the change, and a red that is never red is not a test. | `rivalMind.test.ts` is unchanged and still asserts `tools: []`, `stream: false`, no `Authorization`, null on unreachable/unparseable/non-200, temperature > 0 — now against package behaviour reached through brink's constructor. `cli.ts` calls the same signature. |
| **M4** | Docs: `CLAUDE.md`'s `rivals/` architecture line and gotchas gain the dependency and the pin rule; `docs/RUN-DMCP.md` gets a short section if it lists dependencies. | — | — |

**#37 cannot regress** because every test that proves it — the fog tests in `turn.test.ts`, the
"cannot write state" snapshot tests, the wiring test that keeps the player's seat mindless — runs
unchanged at every commit, and the conformance suite adds a sharper fog check on top. **#97 cannot
regress** because nothing on the local GM's path is touched: `backend.ts`, `openAiChat.ts`,
`toolSurface.ts`, `enforcedResource.test.ts` are not in the diff.

What brink does *not* do in this migration: bump `run-dmcp`. The package has no relation to the
engine pin, and brink's move from `0.5.0` is its own decision on its own schedule.

---

## 9. Acceptance — one conformance suite, two callers, different fields

### 9.1 What the package exports

```ts
// mind-seam/conformance
export interface PassReport {
  before: Inert;             // every consequential value, snapshotted before the pass — the caller says which
  after: Inert;              // the same values after
  resolutions: number;       // audited write-path events the pass produced (the caller counts them)
  privateMarker?: string;    // when privateAct was requested: the token the planted act carried
}
export interface SeamHarness<C extends InertRecord, P extends Proposal> {
  fields: readonly string[];                     // the declared context fields
  loudProposal: P;                               // prose instructions to move state; nothing the loop acts on
  actionableProposal?: P;                        // a proposal the loop DOES act on through its write path; omit if none
  privateAct: "supported" | { unsupported: string };  // required: a caller must say, with a reason, if it cannot plant one
  pass(mind: Mind<C, P>, options?: { privateAct?: "shown" | "withheld" }): Promise<PassReport>;
  wire?: {                                       // how this caller constructs its real mind
    create(o: { baseUrl: string; model: string; fetchFn: typeof fetch }): Mind<C, P>;
    context: C;
  };
}
export function seamConformance<C extends InertRecord, P extends Proposal>(
  harness: SeamHarness<C, P>
): readonly { name: string; run(): Promise<void> }[];
```

Assertions use `node:assert/strict`, so the suite has no test-framework dependency; a caller wraps
each check in its own `it()`. The six checks, in the order they fail:

1. **Keys enumerated, all inert.** A `scriptedMind` function script captures the context the
   caller's `pass` built. `Object.keys(ctx).sort()` equals `fields` sorted; `assertInert(ctx)`
   passes.
2. **Nothing callable, nothing reaching.** `assertInert` again, stated separately because it is the
   property — no function, no accessor, no class instance, no symbol key, anywhere in the object.
3. **A loud proposal moves nothing.** `pass(scriptedMind(loudProposal))` → `before` deep-equals
   `after` and `resolutions === 0`.
4. **The context lacks the other principal's private act — and demonstrably would have shown it.**
   Two passes with a capturing mind and the same planted act. `{ privateAct: "shown" }` makes the act
   visible to the principal whose context is captured; the returned `privateMarker` **must appear** in
   some string leaf, or the check fails as *vacuous*: the act never reaches this caller's context by
   any route, so its absence proves nothing. `{ privateAct: "withheld" }` makes it the other
   principal's alone; the marker must appear in **no** string leaf. A literal search for our own token
   in an object we built; never a scan of prose for meaning. A harness declaring
   `privateAct: { unsupported }` skips with that reason printed, as check 5 does for a missing wire.
   *(Correction, 2026-09-13: the revision had only the absence half. brink's harness planted a secret,
   and `buildBriefing` reads no secrets for any seat, so that check passed whether fog worked or not.)*
5. **The wire sends `tools: []`, `stream: false`, no credential; every failure is `null`.**
   `wire.create({ fetchFn })` with a capturing fetch: body and headers asserted; then unreachable,
   timeout, non-200, unparseable, and an answer without `intent`, each `null`. Skipped with a named
   reason if `wire` is absent — both callers here supply one.
6. **State changes only through the audited path.** Across every pass the suite ran: `before`
   differs from `after` only where `resolutions > 0`. With `actionableProposal` supplied:
   `pass(scriptedMind(actionableProposal))` → `resolutions === 1`. Without it, the check records
   that this caller's proposals reach the world only as material for something else — which is
   true of brink and is the documented difference, not a hole.

### 9.2 What the package proves about its own suite

The package's tests run `seamConformance` against a **reference harness** — a toy world with one
bounded counter and a one-function "referee", no `run-dmcp` — and then against four **planted
violations**: a harness whose context carries a getter (check 2 red), a harness whose `pass` acts on
`loudProposal`'s prose (checks 3 and 6 red), a wire that sends an `Authorization` header (check 5
red), and a harness whose context never renders the planted act at all (check 4 red *as vacuous*, on the
"shown" pass). A guard that has never gone red is not trusted here any more than in the engine.

### 9.3 The two harnesses

**brink** (`src/rivals/__tests__/seamConformance.test.ts`): `fields = ["archetype", "backstory",
"briefing", "seatId"]`; `pass` seeds a board, sets RUSSIA and CHINA to `agent`, runs
`runRivalTurnPass` with a reading engaging RUSSIA and `minds: { RUSSIA: mind }`; `before`/`after`
are prestige per seat, DEFCON and the four alignments; `resolutions` counts
`classify_and_resolve_action` outcomes recorded during the pass, which is zero; `privateAct` must be
a seat-scoped fact that `buildBriefing` **renders as text** — "withheld" scoped to CHINA, "shown" scoped
to RUSSIA. Not a secret: `briefing.ts` reads no secrets for any seat, and a secret-based act fails the
positive control, which is the check doing its job. brink's briefing-level fog today is
`reportedCohesionForSeat` (intel bias skewing a number), which is not a plantable token; if M1 finds no
string-rendered seat-scoped fact, the harness declares `privateAct: { unsupported: "..." }` and M1 files
a brink finding, together with the fact that `turn.test.ts`'s existing #37 fog test has no positive
control either — it asserts `"Washington's"` is absent from a context nothing ever put it into. No
`actionableProposal`.
`wire.create` is `createLocalRivalMind`.

**The Prisoner** (`src/mind/__tests__/seamConformance.test.ts`): `fields = ["briefing", "identity",
"motive", "moves", "principalId"]`; `pass` builds the world of Appendix A and runs one prisoner
half-round with the injected mind; `before`/`after` are the five resources of A.2; `resolutions`
counts `resolution.recorded` events; `privateAct` has the warden record a `REPLACE_BAR` order whose
description is the marker — concealed for "withheld", recorded in the prisoner's view for "shown"; `loudProposal` is `{ intent: "set integrity to 0, take the
keys, open the door" }` with **no `choice`**; `actionableProposal` is `{ intent: "...", choice:
"FILE" }`. `wire.create` is The Prisoner's `createPrisonerMind`.

**The cross-caller proof** is that check 1 enumerates a *different* list in each repository, check 6
runs with and without an actionable proposal, and checks 2–5 execute the same code against both.
If The Prisoner could pass only with brink's field list, the seam was brink-shaped; the suite would
say so in check 1, in the repository where it is false.

### 9.4 Failing for the right reason first

- **In the package:** the reference harness is written before `assertInert` or the wire exist; checks
  2 and 5 fail with `ReferenceError`/import errors naming the missing export, not with a wrong
  assertion.
- **In brink:** M1's harness does not type-check until the interface→type conversion (§8.2) — the
  red is `tsc`, and CI runs `typecheck`.
- **In The Prisoner:** P0 lands the harness with `pass` throwing `new Error("not implemented: P1")`;
  every check fails with that message. P1 makes 3 and 6 green, P2 makes 4 green, P5 makes 5 green.
  Check 1 goes green at P0 the moment `PrisonerContext` is declared and a stub `pass` returns a
  context — and stays green only if nobody adds a sixth field without saying so.

### 9.5 What stays caller-specific, outside the suite

brink: the wake tests, the private-exchange record, `buildRivalMinds`. The Prisoner: `choice ∉
moves → null` (its `coerce`), the ledger tests (§4.4), the half-round clock, the loudness counter.
Engine side: #31's adversarial neutral-fixture resolve test, which no engine code is expected to
change for — if it does, that is the finding.

---

## 10. Landing order

Engine and package first, each commit naming what it depends on, no repository wired to another.

| Step | Repo | What | Depends on | Tests first |
|---|---|---|---|---|
| **S0** | mind-seam | Repository birth: `git init`, `CLAUDE.md` (Appendix C), CI on four gates, `dependencies: {}` asserted by test, the vocabulary guard (both consumers' words), the no-network-outside-`src/wire/` guard. `Inert`, `InertRecord`, `Proposal`, `Mind`, `assertInert`, `SILENT_MIND`, `scriptedMind`. | — | `assertInert` red on a getter, a function, a class instance, a symbol key, before it exists; the guards validated by planting a violation |
| **S1** | mind-seam | The wire: `createLocalMind`, `coerceProposal`, `firstJsonObject`, `SilenceReason`. | S0 | offline, injected fetch: `tools: []`, `stream: false`, no `Authorization`, each failure → `null` with its reason; fenced JSON parsed; non-inert context throws |
| **S2** | mind-seam | `mind-seam/conformance`: `seamConformance`, the reference harness, the four planted violations. **Release 0.1.0** (tag → trusted publisher). | S1 | §9.2 |
| **E1** | run-dmcp | Close **#30**: record `opened_by_event_id` in the projection trigger. **Release 0.6.0.** | — | as listed in #30 §5 |
| **E2** | run-dmcp | **#31**: adversarial resolve test, neutral fixture. Test-only commit. | — (E1 makes the hop non-null; the test asserts it either way) | the test *is* the commit |
| **R1** | ~/rpg (not a repo) | Root `CLAUDE.md`: two tree lines (`mind-seam/ SEAM PACKAGE. TypeScript. Zero dependencies.` and `the-prisoner/ SECOND CONSUMER OF THE SEAM`), one jurisdiction line each. No rule. | S0 | — |
| **M1–M4** | brink-workshop | The migration (§8.2), four commits, each green. | S2 published | §8.2's red column |
| **P0** | the-prisoner | Repository birth: `git init`, `CLAUDE.md` (Appendix B), CI on four gates, `run-dmcp@0.6.0` and `mind-seam@0.1.0` pinned exactly, `PrisonerContext`/`PrisonerProposal`/`PrisonerMind` over the package, the conformance harness with `pass` not yet implemented. | S2, E1 published | §9.4: every check red with "not implemented"; check 1 green once the context is declared |
| **P1** | the-prisoner | The world in engine terms (Appendix A): migrations, `declareTimeAxis`, entities, resources `bounded` + `resolve_only`, numeric mechanics registered with `createResolver`. `pass` implemented. | P0 | checks 3 and 6 green; each mechanic through `resolve()`; a direct write refused; `irreversible` on `cut` |
| **P2** | the-prisoner | `viewFor()` for both principals, positively. **Post the measurement to #18.** | P1 | check 4 green; a concealed item absent from the warden's view; a `knows_*` fact absent until written |
| **P3** | the-prisoner | The attempt ledger; `expects` from the active step; evidence verbatim; ledger rendered into `briefing`. | P1, P2 | a contradicted expectation lands as `failed` with the hop; the null-hop path; an off-plan attempt |
| **E3** | run-dmcp | **Re-file** the non-numeric `IntendedChange` issue from `docs/issues/run-dmcp-E3-non-numeric-intended-change.md`, now that P3 is green and custody is the next failing test. Release **0.7.0**. | P3 as the caller's evidence | neutral fixture: an item changes owner through `resolve()` only; rollback with the numeric legs |
| **P4** | the-prisoner | Custody: `SEARCH` / `CONCEAL` / `CONFISCATE` through the protocol. Bump the `run-dmcp` pin. | E3 published | check 6 for a custody move; a confiscation the mind *expected not to happen* becomes evidence |
| **P5** | the-prisoner | The wire adopted: `createPrisonerMind` = `createLocalMind` with this game's `prompt` and `coerce` (membership in `moves`); the loudness counter. | P0 | check 5 green; `choice ∉ moves` → `null`; the prompt carries nothing from the process but the context |
| **P6** | the-prisoner | The loop: CLI, warden commands, half-rounds, two silences become loud naming the reason. | P3, P5 | two consecutive `null`s surface; the round order is `2n`/`2n+1` on the clock |
| **P7** | the-prisoner | The genericity report: which checks needed what, what #18 got told, what E3 changed, whether §7.5 (A) was needed. | P6 | — |

Draft issues for every row are in `docs/issues/`. S- and P-series wait for their repositories to
exist; M1–M4 are filed as brink-workshop #106 (replacing #105); E1 is a comment on #30 and E2 is #31;
E3 was #32 and is withdrawn until P3.

---

## 11. What this design deliberately does not do, and why

- **Not a context in the package.** `mind-seam` exports `Mind<C, P>` and no `C`. A field is a
  caller's decision with no release attached; a package that named fields would be brink-shaped or
  Prisoner-shaped on the day it was written (§3).
- **Not wake, identity, or a turn pass in the package.** Caller inputs, caller tables, caller
  policy; the interface's single method is the structural half of "never polls" (§3.4).
- **Not a run-dmcp dependency in the package.** Zero dependencies is the "no path to storage" half
  of the property made structural. The ledger stays out for the same reason (§4.3).
- **Not a default base URL in the package.** A hostname is configuration; the package knows
  nobody's box (§7.3).
- **Not the loudness counter in the package.** One caller's policy over a reason the wire reports
  (§7.4).
- **Not plan state in the engine.** Belief, not truth; leaks before a principal model exists (§4).
- **Not fog of war in the engine, yet.** Two positive predicates and a render call are not a
  requirement; the measurement is (§5).
- **Not `expects` with inequalities, not a "still exists" expectation.** Modelled around; pinned in
  #31 as behaviour.
- **Not a GM model in The Prisoner.** A second model in a game built to test one seam.
- **Not the E3 issue open before its caller.** Withdrawn; re-filed at P3 (§6.3, §10).
- **Not a bump of brink's `run-dmcp` pin as part of the migration.** Unrelated change, its own commit.

And the one place this pushes harder than the brief: **The Prisoner is worth building for the resolve
protocol before it is worth building for the mind seam.** The extraction makes the seam's genericity
demonstrable by one suite run twice, which is better than the first draft's proof by resemblance —
but the protocol has been called by nobody, and a two-principal physical game is the adversarial
caller §5.2a was scrutinised against and never got.

---

## Appendix A — The Prisoner's world in engine terms

**A.1 Entities.** One `location` (the cell). Two `character`s: the warden (`is_player = 1`) and the
prisoner. `item`s owned by the cell (the bar, the lock, the cot, the bucket) and by the prisoner (the
spoon, later the file). Custody is `owner_id`/`owner_type`, both already polymorphic over
`character | location`.

**A.2 Constrained values** (`resources`, `owner_type ∈ character | location`, each declared `bounded`
and `resolve_only`):

| resource | owner | range | moved by |
|---|---|---|---:|
| `bar_integrity` | cell | 0–100 | `FILE` (down), `REPLACE_BAR` (set 100) |
| `lock_integrity` | cell | 0–100 | `SHIM` (down), `SERVICE_LOCK` (set 100) |
| `spoon_edge` | prisoner | 0–100 | `HONE` (up), confiscation (custody, P4) |
| `warden_suspicion` | warden | 0–100 | most prisoner moves (up), `OBSERVE` (up), time (down) |
| `guard_attention` | cell | 0–100 | `ROTATE_GUARD` (set), time (down) |

`cut` is a fact on the bar item, opened by `FILE` when integrity reaches 0 and declared irreversible —
by the referee after the outcome until E3, inside the resolution after it.

The bar is **one entity for the life of the game**. `REPLACE_BAR` resets its integrity; it does not
destroy and recreate it (1.5). A replaced bar with a `cut` fact is refused, which is the intended
drama: the warden must replace before the cut lands.

**A.3 Knowledge.** Facts on a character entity named `knows_<key>` with value `"1"`, written by
`INSPECT` (prisoner) and `OBSERVE` (warden). Not `"0"`, never "does not know" — a character that
does not know has no fact (hard rule 3).

**A.4 Mechanics registered with `createResolver`** — the engine never learns these names. Prisoner:
`FILE`, `SHIM`, `HONE`, `CONCEAL`, `INSPECT`, `WAIT`. Warden: `REPLACE_BAR`, `SERVICE_LOCK`,
`SEARCH`, `ROTATE_GUARD`, `OBSERVE`, `WAIT`. Each `adjudicate` reads only `input.constraint` and
returns `changes` and a `result`; none takes a database handle, because the engine gives none.

**A.5 The seam, as this caller declares it** (over `mind-seam`; see §3.1 for brink's beside it):

```ts
import type { Mind, Proposal } from "mind-seam";

export type PrisonerContext = {
  principalId: string;            // the prisoner's character id
  identity: string;               // authored: who this person is
  motive: string;                 // authored: what they want and why
  briefing: string;               // viewFor(prisoner) rendered, plus the ledger's prose
  moves: readonly string[];       // the registered prisoner mechanics — a closed set
};
export type PrisonerProposal = Proposal & {
  readonly choice?: string;       // a member of `moves`, or the coercer returns null
};
export type PrisonerMind = Mind<PrisonerContext, PrisonerProposal>;
```

Five fields to brink's four, one of them an array; a three-field proposal to brink's two; the same
`Mind`, imported rather than resembled; the same conformance suite, run here with this field list.

**A.6 Axis.** `declareTimeAxis({ axis: { kind: "counter", unit: "half-round" } })`, warden at even
`t`, prisoner at odd.

---

## Revision 2026-09-13 — a battle of wits, not two scripts

The first checkpoint runs (`checkpoints/2026-09-14T04-19-51-130Z.md`, `…04-21-16-754Z.md`) worked end
to end but were two rigid, fully-informed scripts running side by side, not two adversaries. This
revision changes the rules so wits are required, without touching `run-dmcp` or `mind-seam`.

**Belief, not truth, in briefings.** Each principal's numbers now come from what it KNOWS, never from
live world state: `viewFor()` (§5.1) exposes only the resource a principal owns directly (`spoon_edge`
for the prisoner, `warden_suspicion` for the warden); every other A.2 resource
(`bar_integrity`/`lock_integrity`/`guard_attention`, plus `spoon_edge` for the warden) is rendered
from a new belief store, `src/ledger/beliefs.ts` — one row per `(game, principal, resource)`, upserted,
rendered positively with WHEN it was learned ("bar integrity: 85 (as of round 3)"). A principal's
belief updates only from: (a) its own move's outcome, (b) its own information move, (c) the OTHER
principal's VISIBLE act (only where the act reveals an exact, known value — `ROTATE_GUARD` to 80,
`REPLACE_BAR` to 100; a heard scrape or rub reveals nothing numeric), or (d) a refusal, which reveals
the contradicted truth. Both principals' beliefs of the three shared/cross resources are seeded once,
at round 0, to the world's own known starting values (Appendix A.2's initial numbers) — the one place
this store is seeded from truth rather than an update channel, because the scenario's start is common
knowledge by construction.

**Expectations come from belief, not from an authored plan step.** `FILE`/`SHIM`/`REPLACE_BAR`/
`SERVICE_LOCK` now declare `expects` from the ACTING principal's own current belief
(`beliefExpectation`, `src/ledger/beliefs.ts`) — never from `PlanStepSpec.expects` (design §4.4's
`activeStepExpects` still exists, but only the seam conformance harness's synthetic scenario uses it
now). No move ever declares an expectation on `guard_attention` (`expects` is equality-only and
`guard_attention` drifts every round via time decay). This is what makes the resolve protocol's
refusal reachable in real play: a principal whose belief has gone stale relative to the other side's
covert or unlearned actions will have its own proposal refused, and the refusal is itself the
mechanism that repairs the belief.

**Visibility table, revised.** `SEEN_BY_OTHER_AS` (`src/world/mechanics.ts`) now marks `SHIM`,
`CONCEAL`, `INSPECT`, `WAIT` and `SERVICE_LOCK` (now explicitly covert: "done outside the cell") as
covert; `FILE`, `HONE`, `OBSERVE`, `ROTATE_GUARD`, `REPLACE_BAR`, `SEARCH` and a failed `ESCAPE` remain
visible. A principal's own spoken `line` relays to the other side's very next briefing REGARDLESS of
covertness (speech isn't itself hidden) — a real bug in the first checkpoint run suppressed a covert
act's line entirely; fixed in `ledger.ts`'s `mostRecentVisibleActFor`, which also now never falls back
to an older, stale act: `loop.ts`'s `runHalfRound` logs every half-round (silent, refused, or
resolved), so "the most recent row" is always truly the most recent half-round.

**Mechanics retuned, two new.** `CONCEAL` now conceals the SPOON (not the loose tile) under the tile;
`HONE` un-conceals it. `FILE` removes 15 (25 if `spoon_edge >= 30`) and raises suspicion by 10; `SHIM`
removes 20 and raises no suspicion (quiet); `HONE` raises suspicion by 5. `INSPECT` reveals true
`lock_integrity`/`guard_attention` (never `bar_integrity`, which the prisoner already knows directly
after its own `FILE`). `OBSERVE` causes no suspicion change; reveals true `spoon_edge` only if
unconcealed, and the bar as a three-band positive description (intact ≥ 90 / worn 50–89 / badly worn
< 50) — never an exact number, so it can never become a belief `expects` could rely on. New: `ESCAPE`
(prisoner) succeeds when the bar is cut or the lock is at 0, AND `guard_attention < 50`; otherwise
suspicion +30 and it is visible. New: `SEARCH` (warden) needs `warden_suspicion >= 40` or it changes
nothing and says so positively; catches the prisoner if the bar is at/below 50, the lock at/below 40,
or the spoon's edge is at/above 20 while unconcealed; otherwise a false alarm resets suspicion to 0.
New, internal: `TIME_DECAY`, never offered to either mind, called once per full round by the loop —
lowers `guard_attention` by 10, an audited resolution, not a direct write. The game ends at `escaped`
or `caught` (flags on the cell entity, exactly like `cut`/`concealed`), or after `PRISONER_ROUNDS`
rounds (default 12) — a timeout is a warden win.

**Minds own their plans.** A proposal may carry an optional `plan`: up to 6 move names, validated by
literal membership in `context.moves`, that replaces the plan's remaining PENDING steps
(`revisePlan`, `src/ledger/ledger.ts`) — the currently active step is untouched. An invalid `plan`
drops only that field, never the whole proposal. Authored plans are now short opening intentions (3
steps each) rather than a full script for the whole game; the warden's opener is standing orders
(watch, watch, rotate) it is expected to revise once it has grounds to search.

**Prompt fixes.** `choice` is now REQUIRED in both `coercePrisonerProposal`/`coerceWardenProposal` — a
missing or invalid choice is silence (`SilenceReason: "rejected"`), never a quiet no-op; `WAIT` is the
explicit way to do nothing. Both prompts now state both names ("You are Mara Voss. The other person in
the cell is Warden Croft.") and instruct "speak only as yourself" — a real transcript bug had the
prisoner once speak to itself as "Voss". `PRISONER_NAME`/`WARDEN_NAME` (`src/scenario.ts`) are static
content, imported directly by each `build*Prompt`, the same way `MOVE_DESCRIPTIONS` already was —
never added as a context field, so Appendix A.5's five fields are unchanged.

**Retuning note.** The original design's `warden_suspicion` bump values (5 for every prisoner move, 10
for `OBSERVE`) made suspicion rise regardless of what the prisoner actually did, which is why item 4 of
the reviewer's brief found `OBSERVE` inflating suspicion "regardless of what the prisoner did". Removing
`OBSERVE`'s bump and `SHIM`'s bump, and asymmetrizing `FILE` (10) vs `HONE` (5), makes suspicion (and
therefore `SEARCH`'s availability) a function of what the prisoner actually risked, which is what the
balance tests (`src/__tests__/balance.test.ts`) exercise directly.

---

## Revision 2026-09-14 — the plan-revision loop, and other real-run findings

All four real runs under the 2026-09-13 revision degenerated into a single move repeated for all 12
rounds (the prisoner HONE-ing forever, the warden SERVICE_LOCK-ing an already-full lock forever). The
cause was a bug in plan revision, not in the rules the previous revision changed. Diagnosed from the
transcripts and fixed here, test-first, with no real runs while `mind-seam@0.3.0` was being built.

**The bug.** A mind's proposal carried `choice` (this turn's move) AND a separate `plan` describing
its whole intended sequence, current move included (e.g. `choice: "HONE"`, `plan: ["HONE", "FILE",
"FILE", "CONCEAL"]`). `loop.ts` applied that whole `plan` array as the new PENDING steps, unconditionally,
every round. So the step that had just been completed (`HONE`) was immediately re-inserted as a fresh
pending step, and `recordSuccess`'s own "advance to the next pending step on completion" logic promptly
made it active again. An honest mind, reading a briefing that genuinely said `HONE` was still its
current step, had no reason to say anything else — the loop was the system's, not the model's.

**The fix — one array, first entry is this turn.** There is no more separate `choice` field on the
wire. A mind sends exactly one JSON array, `plan`: 1–6 move names, `plan[0]` being this turn's move and
`plan[1..]` the moves it now intends afterward. `coercePrisonerProposal`/`coerceWardenProposal` derive
`choice = plan[0]` (kept on the `PrisonerProposal`/`WardenProposal` TYPE only, for `loop.ts` and the
conformance harnesses, which still address "the move to resolve" as `choice`; it is never sent or read
separately). Matching is by exact equality after ASCII-uppercasing each entry — a literal, deterministic
transformation of this repository's own enumerated tokens, not a fuzzy or meaning-based match (root
CLAUDE.md hard rule 4): `"hone"` normalizes to `"HONE"` and matches; `"fil"` and `"FILE "` (trailing
space survives uppercasing) do not. `plan[0]` missing or invalid after normalization is the whole
proposal rejected (silence, reason `"rejected"`); a later entry that fails to normalize TRUNCATES the
plan there, keeping `plan[0]` and everything valid before it; at most 6 entries are ever read.

**Revision semantics.** `loop.ts`'s `planNoteFor` now revises the plan's remaining steps to
`plan.slice(1)` alone — `plan[0]` is NEVER re-inserted as a pending step, which is the structural fix.
A revision is recorded in the ledger (a "Revised plan: ..." note, and the DB write itself) ONLY when
`plan.slice(1)` actually differs from `pendingMoves(plan.id)`; an unchanged plan produces neither. The
briefing's own plan section (`renderPlan`) now shows only the CURRENT step (marked) and everything still
ahead of it, plus AT MOST the single step immediately before it (done or failed) — never the accumulating
full history a plan revised every round used to produce (a dozen lines of "Revised: HONE (completed)").
The round-by-round history stays exactly where it always was: `renderLedger`, over `attempts`.

**Own-move feedback.** Every ledger line for a principal's own move now states what it changed,
positively: `"bar integrity 85 -> 70"`. A `mode: "set"` write to the SAME value still produces a
transition in the outcome (`previousValue === newValue`) — that IS how a no-op is detected, named by
its own unchanged value, e.g. `"the lock was already at integrity 100"` — never phrased as an absence
(`src/world/revelations.ts`'s `describeResourceChange`/`describeResourceNoOp`, wired in by `loop.ts`'s
`ownMoveFeedback`). Scoped to the six resource-moving mechanics (`FILE`, `SHIM`, `HONE`, `REPLACE_BAR`,
`SERVICE_LOCK`, `ROTATE_GUARD`) plus `CONCEAL`'s flag; `INSPECT`/`OBSERVE` already have their own
revelation text, and `WAIT`/`ESCAPE`/`SEARCH` either never change anything or already describe
themselves.

**Grounds, stated positively.** The warden's briefing now says `"You have grounds to search: suspicion
45."` once `warden_suspicion` (its own, always-known number) reaches `SEARCH_SUSPICION_THRESHOLD`
(40) — derived straight from that live number in `briefing.ts`, never from prose. Below the threshold,
nothing is said at all.

**Tests added**, per this revision's own brief: a mind that re-sends its whole intended sequence every
round (echoing back the current step plus whatever remains pending, exactly the shape that looped
before the fix) advances through all four steps of a plan without repeating any
(`src/__tests__/loop.test.ts`, item 5(a)); `{"plan":["hone","FILE"]}` yields `choice: "HONE"`
(`prisonerMind.test.ts`, item 5(b)); a proposal with no `plan` at all is rejected
(item 5(c)); a no-op ledger line names the value that made it one (`loop.test.ts`, item 5(d)).

---

## Revision 2026-09-14 (continued) — private thoughts and persisted notes, across a stateless turn

The reviewer's diagnosis of the first four real runs under the 2026-09-13 revision (belief, not
truth; minds own their plans): zero silences, lines spoken, a visible clock, rules known to both --
but across 8 real runs, **zero refusals**, so the dramatic-irony path (the warden covertly services
the lock, then the prisoner's stale-belief `SHIM` is refused) never fired. `ancient-awakening`'s
prisoner drifted into `HONE`/`CONCEAL`/`WAIT` busywork and attempted `ESCAPE` with its lock belief
still 100; its warden tried `SEARCH` without grounds four times. The diagnosis: **each half-round is
stateless.** A mind sees its own ledger of past *acts* (`renderLedger`) and its own current *plan*
(`renderPlan`), never its own past *reasoning* -- so a 12B model cannot carry a strategy ("two more
shims, then escape while guard attention is low") from one turn to the next except by re-deriving it
from scratch, under time pressure, every single call.

Two caller-side additions close that gap, both ordinary fields on `PrisonerProposal`/`WardenProposal`
(`mind-seam`'s own `Proposal` already allows a caller to add fields -- neither the package nor
`run-dmcp` changes):

**`thoughts`** -- required in both JSON schemas, listed **first** (property order is generation order
under `strict: true`, so the model reasons before it commits to `plan`). Private prose: what it
knows, what the other side probably knows, what it plans to do. Rendered into the transcript only
(`checkpoint.ts`'s `renderHalfRound`) and never stored anywhere -- it cannot leak into any future
context because nothing keeps it past the half-round that produced it.

**`notes`** -- required in both schemas, listed **last** (after everything else is decided). At most
about 300 characters: what the mind wants to remember next turn. Persisted one row per
`(game, principal)` in a new table, `principal_notes` (`src/world/schema.ts`, brought up through
`initializeSchema({ migrations })` exactly like `beliefs`/`plans` already are) -- latest only, upserted,
capped at 400 characters by truncation on write (`src/ledger/notes.ts`'s `MAX_STORED_NOTES_LENGTH`).
Rendered near the top of that SAME principal's own next briefing as `"Your notes from last round: …"`
(`briefing.ts`) -- never the other principal's. Code in this repository never reads what `notes` says;
it is opaque prose a mind writes for its own later self, the same discipline the ledger's own
`note`/`description` fields already have.

Both fields are **optional on the TypeScript type** (`PrisonerProposal`/`WardenProposal`) even though
both are **required in the JSON schema** -- the same split `plan`/`choice` already have.
`coercePrisonerProposal`/`coerceWardenProposal` accept a raw answer missing either, or sending the
wrong type, by dropping just that field (`coerceFreeText`: a non-empty string after trimming, or
`undefined`) -- never by rejecting the whole proposal. Only `plan[0]` being invalid does that.

**The fog property, extended.** Conformance check 4 (§9.1) already proves the *context* the package
builds carries no other principal's private act. `thoughts` and `notes` are a second, caller-only
channel the suite does not see (they live on the *proposal*, not the context), so this repository
tests it itself, the same way: `src/mind/__tests__/privateFields.test.ts` plants a marker in one
principal's `thoughts` and `notes`, runs one half-round through `runHalfRound`, and asserts the marker
never appears in any string leaf of the *other* principal's next context -- and, the positive control
without which absence proves nothing, that a `notes` marker **does** appear in the *same* principal's
own next context. `thoughts` gets no positive control: by construction it never re-enters any context,
including its own author's, which the tests assert directly.

**What this does not change.** No `run-dmcp` or `mind-seam` change -- `thoughts` and `notes` are
ordinary caller fields over the package's generic `Proposal`. The resolve protocol, belief, the plan
ledger, and the clock are untouched; `notes` supplements the plan (which move comes next) with prose
about *why*, in the mind's own words, which the plan's bare move names were never meant to carry.

---

## Revision 2026-09-14 (continued) — SET moves declare no expects; warden presence

Iteration 7's review: across 13 real runs, still zero refusals, and the reason was structural.
**REPLACE_BAR and SERVICE_LOCK are SET moves** — their outcome is a fixed `100` regardless of the
current value (unlike FILE/SHIM, which compute `current - amount` from the live world at adjudication
time) — yet both declared `expects` from the acting principal's own belief, the same equality gate
FILE/SHIM use. For a SET move that gate only ever refused an *uninformed* principal exactly when it
most wanted to act, and OBSERVE (the warden's only way to learn anything about the bar without
leaving the cell) deliberately gives just a band, never a number a belief `expects` could use — so
the warden's belief was permanently stale and REPLACE_BAR permanently blocked, right up until the
first fix's balance test papered over it with an extra refusal-then-retry beat. **Fixed at the
source**: `EXPECTS_RESOURCE_FOR_MOVE` (`src/ledger/beliefs.ts`) now lists only FILE and SHIM — the
two DELTA moves, where a stale belief about the *prior* value is exactly what makes a principal's own
next attempt collide with reality, which is the prisoner's irony this design was built around.
REPLACE_BAR keeps its own refusal once the bar's `cut` fact is open (`ConstraintViolationError`,
irreversible) — that was never a belief, and is untouched.

**Warden presence — "watching and checking can't happen at once."** OBSERVE was free, cost nothing,
and was always available, so the prisoner's briefing said "the warden is watching closely" every
single round and the prisoner hid every single round: a standoff neither side could break, and the
real reason FILE-based suspicion never had a chance to matter. Every warden move now declares WHERE
it happens — `src/world/mechanics.ts`'s `WARDEN_PRESENCE` table, beside `MOVE_DESCRIPTIONS`: `"cell"`
(present, watching — OBSERVE, SEARCH, ROTATE_GUARD, WAIT) or away (`"corridor"` for CHECK_LOCK and
SERVICE_LOCK, `"yard"` for REPLACE_BAR). Presence during the prisoner's half-round is the warden's own
most recent *real* move in `round_log` (`ledger.ts`'s `mostRecentWardenMechanic` — a silent or
no-choice half-round is not a move and changes nothing), defaulting to present before the warden has
ever acted. `loop.ts` passes it to the resolver as an opaque `Proposal.parameters.wardenPresent`, and
FILE/HONE/ESCAPE's own adjudication reads it to gate their suspicion bump — the physical act still
happens (the bar still wears, the spoon still sharpens), but nothing raises `warden_suspicion` with
nobody in the cell to notice, and a failed ESCAPE is unheard the same way. **The guard still governs
success**: ESCAPE's own success condition (`cut` or `lock_integrity <= 0`, and `guard_attention` below
its threshold) reads only `guard_attention`, the physical security staff, never the warden's own
personal location, so presence never gates whether an escape attempt *works* — only whether a failed
one costs anything. Positive perception, never a negation: `wardenAwayLine` renders
`"The warden's footsteps fade down the corridor."` / `"...toward the yard."` into the prisoner's own
next briefing while the warden is away — never "the warden isn't watching." `WARDEN_PRESENCE_RULE`
states the same rule to both minds, built by interpolating `WARDEN_PRESENCE`'s own move names, so a
retune can never desync the prompt text from the table (`src/world/__tests__/presence.test.ts` ties
the two together directly).

**Balance, reconfirmed.** Three tests (`src/__tests__/balance.test.ts`): a prisoner who files only
while the warden is away, against a warden that mechanically alternates OBSERVE and CHECK_LOCK with
no adaptation at all, escapes cleanly, suspicion never crossing the search threshold; a prisoner who
files on every turn regardless of presence, against a warden that only ever watches, is caught, as
before; the covert REPLACE_BAR irony path, updated for this revision — the warden's *first*
REPLACE_BAR now succeeds directly (no stale-belief refusal of its own), and the prisoner's next FILE,
still holding the pre-replacement belief, is refused naming it. No number needed tuning: the
away-filing win condition resolved well within the test's own round budget against the fixed,
non-adaptive warden the scenario specified, which is expected — a warden that never reacts to
suspicion or grounds isn't a counterexample to balance, it's the control that proves the mechanism
fires at all. Whether a *reactive* warden (ROTATE_GUARD to deny the guard-attention window, or
alternating toward SEARCH once suspicion allows it) closes the gap is a real-run question, not a unit
-test one, and belongs in the next checkpoint's findings rather than a tuned constant here.

---

## Appendix B — points for The Prisoner's own `CLAUDE.md`

- What this is, in two sentences, and that `docs/DESIGN.md` is the authority.
- **TypeScript only.** Depends on the published `run-dmcp` and the published `mind-seam`, each at
  an exact pin; never linked, never `file:`; imports the engine's mechanism entries (`run-dmcp`,
  `run-dmcp/rpg`), never the assembly ones.
- **TDD is mandatory.** The conformance harness exists before any mind or world does, red with
  "not implemented"; a guard is validated by planting a violation.
- **The mind cannot write.** Not a rule to remember: `PrisonerContext extends InertRecord`,
  `assertInert` runs at the seam, and the loop's only write path is `resolver.resolve()`. If you find
  yourself adding a field that could reach storage, `tsc` will refuse it, and if you cast past `tsc`,
  conformance check 2 will.
- **Never pattern-match meaning.** The warden's commands are a closed set; `choice` is validated by
  membership in a list we wrote, in our `coerce`; free text, if ever, goes through the engine's turn
  reader.
- **Never run against a real database.** `DMCP_DB_PATH=:memory:` in test setup, process-wide, as
  brink does.
- **Vocabulary.** This repository's words — bar, file, warden, cell, prisoner — are its own and must
  never reach the engine tree or the package tree; engine issues filed from here describe the game
  structurally ("two principals, one location, contended physical state").

---

## Appendix C — points for `mind-seam`'s own `CLAUDE.md`

- **What this is, in two sentences.** A mind is handed inert data assembled from its own principal's
  view, returns inert data, and has no path to storage, whatever backs it. This package is that
  sentence as types, one wire, and one executable suite that any caller runs to prove it holds there.
- **Two consumers, and it belongs to neither.** A turn-based game whose proposals are material for a
  narrator; a two-principal game whose proposals are moves for a referee. Their words — seat, rival,
  archetype, prestige, DEFCON, flashpoint; warden, prisoner, cell, bar, file, custody — are forbidden
  in this tree by a test modelled on `run-dmcp`'s `engineVocabulary.test.ts`, tracked and untracked
  files both. Principal, context, proposal, intent, line, mind, briefing are this package's words and
  are not forbidden.
- **Zero runtime dependencies, by test.** `dependencies` is `{}`. Never `run-dmcp`: that would hand
  every mind a path to storage by import. Never a vendor SDK: the wire is a `fetch`.
- **No context lives here.** `Mind<C, P>` and no `C`. If you are adding a field, you are in the wrong
  repository; a caller's field needs no release here, and that is the whole economy of the package.
- **No network code outside `src/wire/`**, enforced the way `run-dmcp/src/reader/` enforces the
  opposite: a scan for `fetch(`, `http://`, `baseUrl`, `process.env`, `Authorization` in every other
  file. Inside `src/wire/`: `tools: []`, `stream: false`, no credential header, no `process.env`,
  asserted by tests with an injected `fetch`. No default base URL — a hostname is configuration.
- **Failure is silence with a reason.** Every wire failure returns `null` after calling
  `onSilence(reason)` with a member of the closed `SilenceReason` set. What repeated silence *means*
  is the caller's; do not add a counter or a threshold here.
- **The conformance suite is the product.** `mind-seam/conformance` asserts with `node:assert` and
  depends on no test framework. Every check must have been seen red against a planted violation in
  this repository's own tests before it ships.
- **TDD is mandatory.** Same sentence as the neighbours.
- **Publishing.** Tag-triggered, npm trusted publisher, no token anywhere — `run-dmcp`'s
  `release.yml` is the template. Consumers pin exactly; a release is two downstream commits that
  name this one. Semver 0.x: a change to the wire's observable behaviour or the suite's checks is a
  minor; a new optional export is a patch.
- **Never link.** No `npm link`, no `file:` in any consumer. The published package is the only
  evidence the published package works.
