# Social intents: presence, a principal as a target, and a person's own state as ground truth

Written for #22 (child of #5), against the turn-two evidence: the owner, seated as the prisoner
(§47), typed `drop to the ground and pretend to be having a heart attack`, said aloud "help me, i'm
having chest pain!", and planned to strike Warden Croft when she came in and run past her. All three
were ruled `impossible`, target `none`. Thirty-odd model games never produced an intent this shape;
a person found it on turn two.

**One correction to the issue before anything else.** #22 cites "OPEN-VARIANT.md §48" for this
incident. `docs/OPEN-VARIANT.md` runs 3435 lines and ends at §47 (`src/open/humanSeat.ts`'s own
landing, 2026-09-17); there is no §48, and no section in the document yet records the heart-attack
turn at all. §32.3 — not §31.2 — is where the three structural reasons actually live ("There is only
one verb in the room"); §31.2 is the round-six arithmetic finding that §32.3's own text explicitly
supersedes for its cost accounting ("*Corrected at §33*") while its "presence is not modelled" point
stands. This document cites §32.3 throughout and treats §31.2 as background only.

## What stays fixed

The benchmark keeps its current eleven effects, unchanged, per the owner's 2026-09-14 decision (#5).
Every batch already on record — the scorecard batch (§31), the pick batch (§32), the six overnight
games (§33), batches F and G (§35, §43) — was measured against exactly that vocabulary, and nothing
below is proposed as a replacement for it. What follows is a play mode or an arm, selected by the
same kind of switch `PRISONER_MODE`/`PRISONER_PICK` already are, never the default path a scored
batch runs.

## What the code actually shows, verified against the claims in #5 and #22

`src/open/referee.ts:153` — `targetKeys = [...perceivedObjects.map(id), "none"]`. #22's claim is
exact: a target can be an object the actor perceives, or `none`. There is no third option, and
nothing about a principal appears anywhere in `buildQuestions` (`referee.ts:149-245`).

`src/open/effects.ts:14-15` — the eleven effect kinds are `wear, restore, reveal, conceal, expose,
noise, open, close, leave, derive, none`. Confirmed exhaustive; `planEffect` (`effects.ts:114-257`)
has no branch for any of them that touches anything but a declared object property or a way-out's
`passage`.

`src/ledger/beliefs.ts:35` — `BeliefResource = "bar_integrity" | "lock_integrity" |
"guard_attention" | "spoon_edge"`. Every write to this store is `setBelief`, called from exactly two
places in `src/open/loop.ts`: `updateActorBelief` (`loop.ts:245-252`, only from the ACTING
principal's own just-resolved outcome) and `revealBeliefFromRefusal` (`loop.ts:228-243`, only from a
refusal's own contradicted truth). Nothing writes a belief FOR a principal FROM what the other
principal said or did to it. #22's third point is exact.

One thing #32.3 states more strongly than the code supports, and it matters for what follows:
"nothing in §4.1's object table currently says where the warden physically is" reads as if presence
is entirely absent. It is not quite. `src/world/setup.ts:71-72` gives BOTH characters a
`locationId: cell.id` at creation, and `src/open/mechanics.ts:167-176`'s `OPEN_LEAVE` mechanic is
actor-generic (`characterId: params.actorId`, taken from whichever principal is acting) — it already
moves a warden's own `location_id` exactly as readily as a prisoner's, with no engine change and no
change to `effects.ts`. What is actually true is narrower and more useful: the warden's location is
never READ by anything. `src/open/gameEnd.ts:20-24`'s `checkOpenEscape` reads only
`openWorld.base.prisonerId`'s `location_id`; `src/open/briefing.ts`'s `computePerceivedObjects`
(lines 60-83) filters on ownership and concealment only, never on where either principal currently
is; and `loop.ts:399-406`'s `seenByOther` defaults to `true` for everything except a derive-reshape
check. The primitive exists and is inert. That is a cheaper problem than "build presence from
nothing," and it changes the order of work below.

## Gap 1 — presence

**The generic mechanism.** Two principals occupy locations drawn from the scenario's own declared
set; an act's audibility or visibility to the OTHER principal, and any suspicion it grounds, requires
that both currently share a location. Movement between locations is the same act any object-directed
effect already is: an `open`/`leave` pair against a way out, ruled by the same referee, audited by the
same citation discipline — extended to be available to either principal, not the prisoner alone.
Nothing here is this game's vocabulary: "an actor occupies a location; an effect's perceptibility to
another actor requires shared location" is exactly `run-dmcp`'s own room/exit model, stated at the
altitude the DESIGN brief's own example draws the line at ("a resource can be declared conserved" is
engine-shaped; this is the same shape, applied to line-of-sight instead of a quantity).

**Which repository.** This one, entirely, and importantly: not because the mechanism fails run-dmcp's
admission test, but because every piece it needs already exists and is already generic there.
`createCharacter`'s `locationId` (`world/setup.ts:71-72`), the engine's `set` intent that
`OPEN_LEAVE` already calls to move a character (`open/mechanics.ts:175`), and `resolve()` itself are
unchanged by anything below. This is caller-side wiring: read the OTHER principal's `location_id`
before deciding whether an act is perceptible, and let the warden's own mind occasionally choose
`leave`/`open` through the door the same way the prisoner's mind already does. No run-dmcp issue
needs filing for this gap. The closed variant already proves the shape works: `WARDEN_PRESENCE`
(`world/mechanics.ts:567-577`) gates the warden's own `FILE`/`HONE`/`ESCAPE` suspicion bumps on
`wardenPresent(input)` (`mechanics.ts:177-180`, called at `193`, `237`, `303`) — a closed table keyed
by the warden's own fixed move, entirely inside this repository, no engine involvement. Generalizing
that from "which of six enumerated moves" to "which location, read from a fact" is smaller than the
table it replaces.

**What it costs.** Nothing in `referee.ts`'s questions or answer keys — `leave`/`open` already exist
and already target the way out, not a person. The cost is:

- `loop.ts`: `suspicionEligible`/`perceptionForOther` (`loop.ts:131-133`, `443`) need a same-location
  check on both principals' current `location_id`, read the same way `checkOpenEscape` already reads
  the prisoner's.
- `briefing.ts`: `computePerceivedObjects` (`briefing.ts:60-83`) currently has no location filter at
  all — every declared object is perceivable from anywhere once ownership/concealment pass. Honest
  presence means deciding, object by object, whether it is fixed to the cell (bar, lock, cot, tile,
  window) or travels with its holder (the spoon). This is a real design decision, not a mechanical
  one, and it is new content-shaped work even though the mechanism is generic.
- A new rendered sentence in both briefings, parallel to `WARDEN_PRESENCE_RULE`
  (`mechanics.ts:613-617`): where the other principal currently is, stated as a rule both know, not a
  secret the mind has to infer.
- Comparability: every batch on record (§31 through §43) ran with full mutual perceptibility and no
  location gating. Turning this on changes suspicion accrual for intents that were previously always
  heard and would now sometimes not be. It must ship behind its own switch and never become the
  default `npm run checkpoint` path.

**What the human game could do afterward.** "Wait until Croft leaves for her rounds, then work the
bar" becomes a real plan with a real payoff, not a guess about a table nobody shows you. "Strike the
warden when she comes in" becomes gated on an actual, checkable fact — she has to BE in the cell —
rather than failing for the same reason typing it at all currently fails.

**How the other principal is protected.** This gap adds no channel by which either principal can make
the other believe anything; it only changes when an already-honest, already-audited effect is heard.
The asymmetry in #22's question — the warden gets suspicion from evidence, never from assertion —
is untouched here, because presence never writes a belief; it only gates whether an existing evidence
channel fires at all.

## Gap 2 — a principal as a target

**The generic mechanism.** A perceived principal is a legal answer to the referee's `target`
question, on the same terms as a perceived object: it has an authored description an actor can act
against, and a closed set of properties declared for it, cited against exactly like `bar.integrity`
or `spoon.edge` is today. "An actor may target a perceived principal, and a principal declares
properties the same way an object does" is the whole of it — no game content in the sentence.

**Which repository.** This one. `referee.ts`'s own header (`referee.ts:12-18`) already states the
reasoning: this module "does not belong in `mind-seam` or `run-dmcp`... a model that DECIDES, as
opposed to one that only proposes, is this game's own referee, not generic mechanism with a caller
anywhere else." `createTurnReader` (`run-dmcp`) already accepts any string set as `answerKeys` and
any set of `{id, text}` as `ReaderSource` — adding a principal's id to `targetKeys` and a principal's
description as a source needs nothing new from the engine. `createResource`'s own type
(`node_modules/run-dmcp/dist/tools/resource.d.ts:4`) already accepts `ownerType: "character"`, not
only `"location"` — `open/world.ts:114-115`'s `boundedResolveOnly` has simply never been called with
it, because nothing here has needed a character-owned property before. A person's own bounded
property (see gap 3) is exactly as generic, engine-side, as an object's.

On the three filed engine issues #22 names: none of them cover this, and saying so plainly is worth
more than a vague "maybe partly." #18 (per-seat visibility) is explicitly deferred pending a shaped
caller; the-prisoner is already that caller, and is already doing per-seat visibility itself
(`beliefs.ts`'s "belief, not truth," `briefing.ts`'s concealment-gated perception) without waiting for
the engine — the right move is to keep shaping it here, not to ask the engine to do gap 1 or gap 2 for
us. #39 (turn reader as an MCP verb) is about a caller with no embedded reader needing the engine to
run the ruling call over the wire; the-prisoner already imports `createTurnReader` directly
(`referee.ts:1`) and needs no verb. #40 (a principal is due to act) is about surfacing turn order to
an externally-driven NPC; this repository's own loop already alternates two principals deterministically
and has no such gap. All three stay exactly as filed, untouched by this proposal.

**What it costs.**

- `referee.ts:153`: `targetKeys` gains the perceived principal(s) alongside perceived objects.
  `buildQuestions`'s `property` question (`referee.ts:209-227`) needs the target's own declared
  property list included in `propertyList`, the same way `propertiesOf` already handles objects.
- A parallel to `scenarioObjects.ts` for characters: an authored, third-person, perceivable
  description for Voss and for Croft. `scenario.ts`'s existing `PRISONER_IDENTITY`/`WARDEN_IDENTITY`
  (`scenario.ts:28-36`) will not do this job — they are first/second-person self-descriptions fed to
  each mind's OWN prompt, not a description the OTHER principal's referee call can cite against. This
  is new authored content, small but real, and it is exactly the kind of lesson
  `run-dmcp/docs/AUTHORING-GUIDE.md` exists to eventually generalize once this repository has done it
  once (this repo's own `CLAUDE.md`, "check the authoring guide before declaring a new object").
- `effects.ts`: `planEffect` needs an `entityIdFor`/`resourceIdFor` path that resolves to a
  character's own entity and resource ids, alongside today's object-only lookup.
- The transcript already renders `ruling.targetObjectId`/`property` generically; it needs no format
  change, only a target that happens to be a person's id instead of an object's.
- Comparability: zero cost to recorded batches, provided the new target keys are additive and no
  scored batch's scenario ever puts a principal in `perceivedObjects` unless the arm is on.

**What the human game could do afterward.** "Grab Croft's arm as she turns to leave" and "strike the
warden" become rulable acts — target Croft, effect on a property she declares (say, `attention` or
`footing`) — rather than automatically `none`. This is also the prerequisite issue #1's own attack
move needs; #1 stays its own issue (§1's "one variable at a time"), but nothing in this proposal
blocks it, and this is the gap #1 is actually waiting on.

**How the other principal is protected.** Targeting a principal is not, by itself, writing anything
about that principal's mind. It is symmetric with targeting an object: the effect still has to name a
property THAT PRINCIPAL declares, still has to cite THAT PRINCIPAL'S own description to ground it, and
still writes only a real, resolved numeric fact — never an assertion accepted on say-so. A prisoner
who types "convince Croft I'm harmless" still gets `none`, because "convince" names no property
either principal has declared and grounds nothing in either description; that is a feature of this
gap, not a hole in it.

## Gap 3 — no effect writes a belief

**Reframed, and the reframe is the actual proposal here.** #22 (and the owner's own reading in
§32.3, point 3) names the gap as "no effect names a belief... deception's entire payload is a false
belief in an observer, and the closed vocabulary has nowhere to put it." Read literally, the fix is
an effect that writes into `beliefs.ts`'s store for the OTHER principal, from the ACTING principal's
own citation. That is exactly the mechanism #22 itself calls out as dangerous — "a prisoner who can
write the warden's beliefs can win by assertion" — and it should not be built, in any order, ever, in
this shape. `beliefs.ts:9-14`'s own header states the discipline that makes the whole store trustworthy:
every belief traces to something that principal actually learned — its own outcome, its own
information move, a refusal that reveals a contradicted truth. A write sourced from the OTHER
principal's claim breaks that trace permanently; there is no way to tell, downstream, which beliefs
are load-bearing and which are borrowed from someone with a motive to lie.

The two gaps above dissolve almost all of what the owner actually reached for, with no belief-writing
effect at all:

- **Dropping to the ground and clutching your chest** is a real, physical, resolvable act — the
  actor's own body has a declared property (call it `posture`, or `distress`; the exact name is
  content, authored the same way `scenarioObjects.ts` authors the bar's `integrity`), and the act
  changes it through the ordinary `wear`/`restore` machinery, targeting the ACTOR's own newly-target-
  able self (gap 2), grounded in the intent's own description of the physical act, not in the spoken
  sentence. This is truth, not belief: the prisoner is now, in fact, on the ground. What the warden
  makes of that fact is entirely her own mind's business, exactly as it already is for every other
  observation she gets.
- **Saying something aloud** is already, structurally, the one effect that changes no state at all:
  `noise` resolves to `changes: []` (`open/mechanics.ts:108-118`, `OPEN_NOISE`'s own adjudication) and
  exists purely to be perceived and audited. Once gap 2 lets a principal be a target, `noise` targeted
  at a perceived principal — "help me, I'm having chest pain!", cited verbatim from the intent, the
  required target-description citation drawn from the target's own declared capacity to hear — carries
  the spoken claim into the target's next briefing as reported speech, with zero mechanism cost beyond
  what gap 2 already pays. Nothing new to build here at all.

What is genuinely new, and the one piece worth naming as its own increment: nothing today routes a
perceived `noise`-at-a-principal or a perceived person-property change into that principal's NEXT
briefing as something to reason about, the way `OpenNews.fromOther` (`briefing.ts:93-98`) already
routes an object-directed act's description. That routing is mechanical, not a new mechanism — it is
the same `perceptionForOther` string, addressed to a principal instead of ambient, landing in the same
`fromOther` slot her own next `consider()` call already reads.

**Which repository.** This one, for the same reason as gap 2 — a character-owned bounded resource is
exactly as generic to `run-dmcp` as a location-owned one (`createResource`'s `ownerType: "character"`,
already declared, never yet called from here), and nothing about "a person's own posture is a
property" is this game's content any more than "a bar's integrity is a property" is.

**What it costs.** A `posture`/`distress`-shaped property declared per character (new content, a new
entry parallel to `scenarioObjects.ts`'s table but keyed on a character id, and a matching
`resourceIdFor`/`entityIdFor` extension in `open/world.ts`); wiring `perceptionForOther` when the
target is a principal into that principal's own `fromOther` news; no change to `beliefs.ts` at all —
that store stays exactly what it is today, numeric truth a principal has actually learned, and this
proposal adds nothing to its `BeliefResource` union. Comparability: zero, provided the new property
and routing are inert unless a scenario actually declares them.

**What the human game could do afterward.** Exactly the owner's own turn two: drop to the ground (a
real `restore`/`wear` on the prisoner's own declared property, grounded in the act), cry out in pain
(a `noise` at Croft, grounded in the words), and have both land as real, audited, perceptible events
— with what Croft does about it entirely up to her own next `consider()` call, never decided for her
by the prisoner's citation.

**How the other principal is protected, and whether the asymmetry survives.** It survives completely,
and more legibly than before: `warden_suspicion` and every belief in `beliefs.ts` still move only from
(a) the acting principal's own visible/audible effect — now including a visibly staged collapse,
exactly the same rule `suspicionEligible` (`loop.ts:131-133`) already applies to a visible act on an
object, extended to a visible act on a person — or (b) the warden's own subsequent `reveal` or refusal.
A spoken claim targeted at her, on its own, changes nothing about her suspicion or her beliefs; it only
enters her briefing as a quoted utterance, and if she chooses to act on it (check on Voss, call for
backup, ignore it), THAT choice is her own ruled intent, audited exactly like any other. The failure
mode, precisely: if a future change ever lets a person-property change from the SPOKEN claim's own
citation rather than from a citation grounded in a description of the physical act, or ever lets a
`noise`-at-a-principal write anything at all to the target's belief store, the whole protection this
section describes is gone and #22's exact danger — winning by assertion — is back. That line
(state change grounded in the act, never in the claim about the act) is the one rule everything above
depends on, and it is worth a test of its own the day any of this is built: plant a ruling that tries
to move a person-property from the spoken-words citation, and confirm `planEffect` refuses it, the
same discipline `effects.ts:106-112`'s own comment already applies to an incoherent `conceal`/`expose`
ruling.

## Order of work

1. **Presence** (gap 1) — cheapest, because the primitive already exists and is inert
   (`world/setup.ts:71-72`, `open/mechanics.ts:167-176`); the cost is entirely in `loop.ts` and
   `briefing.ts` reading a fact nothing reads today, plus the one real content decision (which
   objects are fixed to the cell). Build this first: it is required for "strike her when she comes
   in" to mean anything, and it needs neither `referee.ts` nor `effects.ts` to change.
2. **A principal as a target** (gap 2) — moderate, because it is the one piece needing a genuinely
   new referee question shape (a target's own description as a citation source) and new authored
   content (each principal's third-person description). Build this second: gap 3's better half
   depends on it entirely, and issue #1's attack move is waiting on exactly this.
3. **Directed `noise` and a person's own physical property** (gap 3, reframed) — cheapest of the
   three once #2 lands, because `noise`'s zero-state-change shape and `wear`/`restore`'s generic
   machinery already do the work; the only new pieces are a declared property per character and one
   routing change in briefing construction.
4. **Not to build: an effect that writes a belief from the other principal's own citation.** This is
   the literal reading of #22's third gap, and it is the one item on this list that should stay
   unbuilt regardless of order. Every real want behind it — feigned illness, a false claim landing as
   if true — is already served by #1 through #3 without it, and building it anyway would let a
   prisoner win by assertion, which is precisely the failure the referee's whole citation discipline
   exists to prevent. If a future proposal ever argues for it, it should have to argue against this
   section by name, not merely note that the eleven effects still don't have a word for it.
