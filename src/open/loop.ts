import { ResolveProtocolError, ConstraintViolationError, type Resolver, type Outcome, type Expectation } from "run-dmcp";
import { adoptDerivedObject, retireDerivedObject, nextDerivedId, adoptAcquiredProperty, declaredProperty, declaredPropertyKeys, resourceIdForProperty, type OpenWorld, type DerivedObjectRecord } from "./world.js";
import { findKind } from "./derivedObjects.js";
import { bandNumbersFor } from "./acquirableProperties.js";
import { computePerceivedObjects, principalLocation, type PresenceMode } from "./briefing.js";
import type { Referee, RefereeRuling, ObjectPerception } from "./referee.js";
import type { ElaborationReferee, ElaborationRuling } from "./elaborationReferee.js";
import { ELABORATION_BANDS, type ElaborationBandRow, type DifficultyBand } from "./elaborationBands.js";
import { planEffect, type EffectPlan, type EffectKind, type Magnitude, type DerivedParent, PROPERTY_KEYS } from "./effects.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "./mind.js";
import { pick, type Verdict } from "mother-of-invention";
import { setBelief, getBelief, type Principal } from "../ledger/beliefs.js";
import { setNotes } from "../ledger/notes.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import { HONE_SUSPICION_BUMP, FILE_SUSPICION_BUMP, FAILED_ESCAPE_SUSPICION_BUMP, EVIDENCE_SUSPICION_DIVISOR } from "../world/mechanics.js";

/**
 * The open variant's half-round (this task's brief: mind -> referee ->
 * resolve()). One function, used identically for both principals, mirroring
 * the closed variant's own `runHalfRound` (`src/loop.ts`) shape: consider()
 * -> (referee rules) -> resolve() -> record. `expects`/belief are the SAME
 * caller-side machinery the closed variant uses (`src/ledger/beliefs.ts`),
 * never reimplemented, because a belief is per-(game, principal, resource
 * NAME) and this module's resources have names too
 * (`OpenWorld.resourceNameById`).
 *
 * INVARIANT 1 (OPEN-VARIANT.md §2): "No write outside the resolve
 * protocol." The only call in this module that can change state is
 * `resolver.resolve()`, below -- the referee never writes (`referee.rule`
 * returns a plain object), and a mind never writes (`mind-seam`'s own
 * property).
 *
 * INVARIANT 3: "No ruling without grounds in text." `ruling.applicable`
 * (computed entirely inside `referee.ts` from BOTH citations) gates
 * `resolver.resolve()` being called AT ALL -- an inapplicable ruling
 * returns here with `outcome: null`, `plan: null`, doing nothing.
 *
 * INVARIANT 6: "No object or property outside the scenario can be
 * targeted." `planEffect` (`effects.ts`) returns `null` for anything not
 * declared in `scenarioObjects.ts`, treated identically to an inapplicable
 * ruling.
 */
export interface OpenHalfRoundResult {
  principal: Principal;
  t: number;
  roundN: number;
  context: OpenPrincipalContext;
  proposal: OpenProposal | null;
  ruling: RefereeRuling | null;
  plan: EffectPlan | null;
  outcome: Outcome | null;
  refusalError: ResolveProtocolError | ConstraintViolationError | null;
  /** The positive sentence relayed to the OTHER principal's own next
   *  briefing -- `null` when nothing is perceptible (silence, an
   *  inapplicable ruling, a refusal, or a ruled-`"silent"` perceptibility).
   *  Never carries a revealed VALUE (invariant 2: a mind never learns what
   *  it could not perceive) -- only the authored, positive description of
   *  the ATTEMPT itself. */
  perceptionForOther: string | null;
  /** Set only when this half-round's resolution was a `reveal` -- the
   *  target object id, property, and the value it revealed. A caller (a
   *  future open-mode round loop) hands this straight to `gameEnd.ts`'s
   *  `checkOpenGameEnd` to check the catch condition; `null` for every
   *  other outcome (OPEN-VARIANT.md §9.3: catch is checked only right
   *  after a warden `reveal`). */
  revealFor: { objectId: string; property: string; value: number } | null;
  /** Set only when this half-round's resolution was a `derive` that made
   *  something (OPEN-VARIANT.md §13): the object the world now holds. */
  derived: DerivedObjectRecord | null;
  /** Set only when that derive reshaped a derived object into the product
   *  (OPEN-VARIANT.md §14.2): the object now gone, and whether the other
   *  principal perceived it when the act began (§14.4). */
  reshaped: { parent: DerivedObjectRecord; seenByOther: boolean } | null;
  /** The pick condition (OPEN-VARIANT.md §21), on a forced turn only: the
   *  mind's own intent and every candidate's verdict. When `overridden`,
   *  `proposal.intent` is the chosen candidate, the text actually ruled on.
   *  `null` on a free turn, and always outside the condition. Under §23,
   *  set on every new prisoner plan checked, with `reasked`. */
  pick: { own: string; forced: boolean; overridden: boolean; verdicts: readonly { candidate: string; verdict: Verdict }[]; reasked?: boolean; regenerated?: readonly { candidate: string; verdict: Verdict }[] } | null;
  /** The scenario's own display name for the resource this half-round's plan
   *  actually wrote or read (`EffectPlan.resourceId` through `world.ts`'s
   *  `resourceNameById`) -- `null` when there is no plan, or the plan touches
   *  no resource (`noise`, `leave`, a `derive` that consumes nothing).
   *
   *  Carried because only the loop has the world in scope, and because the
   *  ruling's own target and property are NOT that resource whenever §19
   *  resolves an effect through a different object than the referee named:
   *  an `open` ruled on the bar writes the window's `passage`. Presentation
   *  only (the-prisoner#6) -- nothing reads this to decide anything. */
  resourceName: string | null;
  /** WORLD-ELABORATION-DESIGN.md §4.1, §4.2, §9 row P1b: the play-time
   *  elaboration request considered on this half-round, when the BASE
   *  ruling did not apply (§1.4's two null paths: `!ruling.applicable`, and
   *  `plan === null`) and the `PRISONER_ELABORATE` arm is on
   *  (`elaborationReferee` present). `null` on every other half-round --
   *  including a successful one, a silent one, and a refusal -- and always
   *  `null` when the arm is off, so this field adds nothing to a batch that
   *  does not ask for it. P1b only: fires and logs; nothing here is ever
   *  applied to the world (no mechanic exists yet -- that is P2). */
  elaboration: ElaborationRuling | null;
  /** WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: set only when this
   *  half-round's elaboration request (above) actually turned into an
   *  `OPEN_ACQUIRE` resolution -- `null` on every half-round that never
   *  asked (the arm off), that asked and got `need: none` or an
   *  unverified/un-priced/`impossible` answer, or that asked but the pair
   *  was already acquired (§2: never twice). `band` is what was actually
   *  APPLIED (possibly `PRISONER_ELABORATE_BAND`-forced); `builtBand` is
   *  always the table's own unforced reading, so a reader can tell the two
   *  apart the way Appendix C requires ("the override can never be mistaken
   *  for the world's own reading") even when they happen to agree. */
  acquired: { objectId: string; need: string; band: Exclude<DifficultyBand, "impossible">; builtBand: DifficultyBand; bandSource: "model" | "author"; startValue: number; resourceName: string } | null;
}

/** OPEN-VARIANT.md §9.3: "grounds accrue... generalised past FILE/HONE/
 *  CHECK_LOCK/OBSERVE to any effect." A PRISONER's own non-`silent`
 *  `wear`/`restore`/`expose` bumps `warden_suspicion` by a magnitude-scaled
 *  amount, carrying over the closed variant's own three constants. `conceal`
 *  and `reveal` never bump it here (mirroring CONCEAL/INSPECT's own "quiet"
 *  rule); `noise` doesn't touch a property at all. */
const SUSPICION_BUMP_FOR_MAGNITUDE: Record<Magnitude, number> = {
  slight: HONE_SUSPICION_BUMP,
  moderate: FILE_SUSPICION_BUMP,
  substantial: FAILED_ESCAPE_SUSPICION_BUMP,
};

/** The precedent condition's consequence (OPEN-VARIANT.md §11.3): an approach
 *  the warden already knows on sight is noticed however quietly it is done,
 *  and suspicion jumps by this much on top of any ordinary bump. The closed
 *  variant's own failed-escape bump: the largest single rise it has. */
export const KNOWN_APPROACH_SUSPICION_BUMP = FAILED_ESCAPE_SUSPICION_BUMP;

/** One approach the warden knows on sight, and what noticing it costs
 *  (OPEN-VARIANT.md §42). The price arrives already decided by
 *  `precedent.ts`, whose arm it is: under `flat` every entry carries
 *  `KNOWN_APPROACH_SUSPICION_BUMP` and this file behaves exactly as it did
 *  before the arm existed, so there is one code path here, not two. */
export type KnownApproach = { readonly text: string; readonly suspicionBump: number };

/** A prisoner attempt as the warden perceives it, with a role-neutral actor --
 *  the text the precedent ledger records, and the text a known approach is
 *  matched on. Built by code from ruling keys, so matching it is exact string
 *  equality on this repository's own sentence, never a reading of prose. */
export function precedentTextFor(ruling: Pick<RefereeRuling, "targetObjectId" | "effectKind">, reshapeOf?: string): string {
  // OPEN-VARIANT.md §14.4: a reshaping is known by the parent's kind.
  if (ruling.effectKind === "derive" && reshapeOf !== undefined) return `A prisoner reshapes a ${reshapeOf}.`;
  return describeAttempt("prisoner", ruling, "A prisoner");
}

/** OPEN-VARIANT.md §14.4: a reshaping of a thing the other principal cannot
 *  perceive reaches it as noise, naming neither object. */
export function describeUnseenAttempt(principal: Principal): string {
  return `${actorName(principal)} works at something out of view.`;
}

/** OPEN-VARIANT.md §55 (issue #22): exported so the grounding rule's own
 *  regression test (referee.test.ts) can pin the asymmetry directly --
 *  `noise` is not in this set, and was not before this gap either.
 *
 *  This used to add "(the only effect a principal-targeted act can ever
 *  produce, §55)". That stopped being true when the referee learned to name a
 *  person's `posture` (issue #22 gap 3): a principal-targeted act can now rule
 *  `wear` or `restore` as well. The asymmetry the test pins is unaffected --
 *  `suspicionEligibleFor` below exempts a person as the target whatever the
 *  effect kind is, which is why widening the effect changed nothing here. */
export function suspicionEligible(effectKind: EffectKind): boolean {
  return effectKind === "wear" || effectKind === "restore" || effectKind === "expose" || effectKind === "open" || effectKind === "leave" || effectKind === "derive";
}

/**
 * Issue #22 gap 3 (D5): an act on a PERSON never raises warden suspicion, even
 * when its effect kind otherwise would. The prompt's own suspicion sentence is
 * about damaging, repairing or uncovering SOMETHING -- a prisoner dropping to
 * the floor damages nothing, and charging her for it would make that sentence
 * false to every mind that reads it. What the warden makes of a collapse is her
 * own mind's business: she perceives it (§55) and decides, which is the whole
 * shape of SOCIAL-INTENTS.md's reframe -- truth in the world, judgement in the
 * mind, never a belief written by the actor.
 */
export function suspicionEligibleFor(effectKind: EffectKind, targetObjectId: string | null): boolean {
  if (targetObjectId === "prisoner" || targetObjectId === "warden") return false;
  return suspicionEligible(effectKind);
}

/** Applies ONE further, audited `resolve()` call against `warden_suspicion`
 *  -- still through the one choke point (invariant 1), never a direct
 *  write. A no-op for `amount <= 0`. */
function bumpWardenSuspicion(openWorld: OpenWorld, resolver: Resolver, amount: number, description: string): void {
  if (amount <= 0) return;
  resolver.resolve({
    gameId: openWorld.base.gameId,
    mechanic: "OPEN_RESTORE",
    parameters: { resourceId: openWorld.base.resources.wardenSuspicion, amount, min: 0, max: 100, description },
  });
}

function actorName(principal: Principal): string {
  return principal === "prisoner" ? PRISONER_NAME : WARDEN_NAME;
}

function objectLabel(objectId: string): string {
  return objectId.replace(/_/g, " ");
}

/** OPEN-VARIANT.md §55 (issue #22 gap 2): whether a referee's `target`
 *  answer names a perceived PRINCIPAL rather than an object -- the two
 *  literal ids `briefing.ts`'s `computePerceivedObjects` ever adds under
 *  `PRISONER_PRESENCE=modelled` (`principal`/`other`, never a game object's
 *  own id, since neither §4.1 nor a derived kind is ever spelled this way). */
function isPrincipalId(id: string): id is Principal {
  return id === "prisoner" || id === "warden";
}

/** WORLD-ELABORATION-DESIGN.md §4.1 condition 2, evaluated purely from world
 *  data (`declaredPropertyKeys`, `world.ts`) and never from a model call:
 *  whether `targetObjectId` has ANY property kind left to acquire at all. A
 *  target that already declares every key in `PROPERTY_KEYS` has no `need`
 *  answer that could ever be a genuine gap, so asking would be a request
 *  whose answer is already knowable from data the world owns -- the
 *  condition is checked BEFORE the model is ever asked which specific kind,
 *  not after, exactly because it does not depend on which kind. */
function hasRoomToElaborate(openWorld: OpenWorld, targetObjectId: string): boolean {
  const declared = new Set(declaredPropertyKeys(openWorld, targetObjectId));
  return PROPERTY_KEYS.some((key) => !declared.has(key));
}

/**
 * WORLD-ELABORATION-DESIGN.md §4.1/§4.2, §9 row P1b: fires the elaboration
 * request on a half-round whose BASE ruling did not apply. Called from
 * BOTH of §1.4's null paths, identically -- "the elaboration request is
 * still asked in full" even when the base ruling already named a property
 * the target lacks (the `plan === null` path); this function never reads
 * `ruling.property` to decide anything, only to let its caller record the
 * free consistency measurement afterwards (§4.1: "recorded, never used to
 * decide").
 *
 * `elaborationReferee` is `undefined` under the `PRISONER_ELABORATE=off`
 * arm (the default) -- callers check that first, so this function itself
 * never has an "off" branch: it is simply never invoked in that case, which
 * is what keeps `off` byte-identical to every half-round recorded before
 * this file existed (no second request, no model call, nothing to log).
 */
async function considerElaboration(
  openWorld: OpenWorld,
  elaborationReferee: ElaborationReferee,
  targetObjectId: string,
  proposal: OpenProposal,
  perceivedObjects: readonly ObjectPerception[]
): Promise<ElaborationRuling | null> {
  // §4.1 condition 1: a real, perceived object -- never "none", and never a
  // principal (§2: "never a person as the target").
  if (targetObjectId === "none" || isPrincipalId(targetObjectId)) return null;
  // §4.1 condition 2.
  if (!hasRoomToElaborate(openWorld, targetObjectId)) return null;
  const target = perceivedObjects.find((o) => o.id === targetObjectId);
  // Defensive: the base referee's own target answer keys are built from
  // exactly this list (`referee.ts`'s `buildQuestions`), so a
  // `targetObjectId` that came from a real ruling is always one of them.
  if (!target) return null;
  return elaborationReferee.rule(proposal.intent, target);
}

/**
 * WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: turns a fired elaboration
 * ruling into the world's own acquisition, in ONE `OPEN_ACQUIRE` resolution
 * -- or refuses, applying nothing, for any of §2's invariants: `need` is
 * `none`; the `need` citation is not verified (grounded in the target's own
 * description, never the actor's words); the pair is already acquired
 * (`declaredPropertyKeys`, checked in code, never re-asked); the build-time
 * table (`elaborationBands`) holds no `priced` row for this `(target, need)`
 * pair, or the applied band is `impossible`; or this scenario has not yet
 * authored band-numbers content for `need` at all (`bandNumbersFor`).
 *
 * THE BAND COMES FROM THE TABLE, NEVER FROM A RULING (§4.4's own words):
 * this function never reads `elaboration.citation.quote` or
 * `proposal.intent` to decide a band, only `elaboration.need` (WHICH kind)
 * -- the band itself is a lookup from `elaborationBands`
 * (`PRISONER_ELABORATE_BAND` may override which band applies, but never
 * which pair does, and never invents a row that build time did not price).
 *
 * A `ResolveProtocolError`/`ConstraintViolationError` out of `resolve()`
 * (the suspicion leg's OWN registered bound rejecting it, §4.4) is caught
 * here and treated the same as any other refusal: nothing acquired, the
 * half-round falls back to its ordinary "nothing happened" rendering.
 */
async function tryAcquire(
  openWorld: OpenWorld,
  resolver: Resolver,
  elaboration: ElaborationRuling,
  ruling: RefereeRuling,
  principal: Principal,
  otherPresent: boolean,
  roundN: number,
  forcedBand: DifficultyBand | undefined,
  elaborationBands: readonly ElaborationBandRow[]
): Promise<{ outcome: Outcome; result: OpenHalfRoundResult["acquired"]; perceptionForOther: string | null } | null> {
  if (elaboration.need === "none" || !elaboration.citation.verified) return null;
  const targetObjectId = elaboration.targetObjectId;
  const need = elaboration.need;
  // §2: never acquires the same (object, property) pair twice.
  if (declaredPropertyKeys(openWorld, targetObjectId).includes(need)) return null;
  const row = elaborationBands.find((r) => r.objectId === targetObjectId && r.need === need);
  if (!row || row.status !== "priced") return null;
  const builtBand = row.band;
  const band = forcedBand ?? builtBand;
  if (band === "impossible") return null;
  const numbers = bandNumbersFor(need, band);
  if (!numbers) return null;

  const wearAmount = numbers.wear[ruling.magnitude];
  const resourceName = `${targetObjectId}_${need}`;
  // OPEN-VARIANT.md §9.3, generalised here exactly as `OPEN_WEAR` is: only a
  // PRISONER's own non-silent act bumps the WARDEN's suspicion.
  const suspicionAmount = principal === "prisoner" && otherPresent && ruling.perceptibility !== "silent" ? SUSPICION_BUMP_FOR_MAGNITUDE[ruling.magnitude] : 0;
  const description = describeAttempt(principal, { targetObjectId, effectKind: "wear" });

  let outcome: Outcome;
  try {
    outcome = resolver.resolve({
      gameId: openWorld.base.gameId,
      mechanic: "OPEN_ACQUIRE",
      parameters: {
        need,
        band,
        bandSource: row.bandSource,
        ownerId: openWorld.base.cellId,
        resourceName,
        initialValue: numbers.initialValue,
        min: numbers.min,
        max: numbers.max,
        wearAmount,
        suspicionResourceId: openWorld.base.resources.wardenSuspicion,
        suspicionAmount,
        description,
      },
    });
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) return null;
    throw err;
  }

  const created = outcome.created.find((c) => c.ref === "property:acquired");
  if (!created) return null; // Defensive: OPEN_ACQUIRE always creates under this ref once resolve() succeeds.
  const startValue = (outcome.result as { startValue: number }).startValue;

  adoptAcquiredProperty(openWorld, {
    objectId: targetObjectId,
    need,
    resourceId: created.entityId,
    resourceName,
    property: { min: numbers.min, max: numbers.max, initialValue: numbers.initialValue, wear: numbers.wear, restore: numbers.restore, readRanges: numbers.readRanges },
  });
  // §4.5: the actor's belief in the new resource is stamped as of THIS
  // round, at the post-scrape value -- the same channel (a) every other
  // resolution's own belief update goes through (`updateActorBelief`),
  // written directly here because there is no `EffectPlan.resourceId` for
  // this path (there is no `plan` at all; `OPEN_ACQUIRE` is never reached
  // through `planEffect`).
  setBelief(openWorld.base.gameId, principal, resourceName, startValue, roundN);

  const perceptionForOther = otherPresent && ruling.perceptibility !== "silent" ? description : null;

  return {
    outcome,
    result: { objectId: targetObjectId, need, band, builtBand, bandSource: row.bandSource, startValue, resourceName },
    perceptionForOther,
  };
}

/** One authored, positive sentence per effect kind -- used as BOTH the
 *  resolved mechanic's own `description` (the ledger/transcript record) AND,
 *  when perceptibility allows it, the sentence relayed to the other
 *  principal. Never states a number, a property name, or a magnitude --
 *  "say what is, never what is absent" applies equally to "say only what
 *  was actually perceived," so this never leaks more than "something
 *  happened here," which is all a bystander -- as opposed to the actor --
 *  would genuinely take in. `actor` overrides the name, for a record that
 *  must outlive this game's characters (`precedent.ts`). */
export function describeAttempt(
  principal: Principal,
  ruling: Pick<RefereeRuling, "targetObjectId" | "effectKind">,
  actor: string = actorName(principal),
  /** OPEN-VARIANT.md §14.4: the parent kind's label, when the derive reshapes. */
  reshapeOf?: string
): string {
  const obj = objectLabel(ruling.targetObjectId);
  switch (ruling.effectKind) {
    case "wear":
      return `${actor} works at the ${obj}.`;
    case "restore":
      return `${actor} works to restore the ${obj}.`;
    case "reveal":
      return `${actor} examines the ${obj} closely.`;
    case "conceal":
      return `${actor} hides the ${obj} from view.`;
    case "expose":
      return `${actor} brings the ${obj} into view.`;
    case "noise":
      // OPEN-VARIANT.md §55 (issue #22 gap 2): a principal is now a legal
      // `noise` target (`referee.ts`'s `targetKeys` is built from whatever
      // `perceivedObjects` names, generic to this file), and "a sound rings
      // out from the warden" reads as nonsense. Addressed, not ambient --
      // named by who it reaches, exactly like every other case here never
      // states a number or the intent's own words (this function's own
      // header), only the positive, authored fact that the actor called out
      // to them.
      if (isPrincipalId(ruling.targetObjectId)) {
        return `${actor} calls out to ${actorName(ruling.targetObjectId)}.`;
      }
      // OPUS-FIRST-DESIGN.md §3.2: a noise at nothing in particular is the
      // actor's own sound -- "rings out from the none" is what the generic
      // line below would say of it.
      if (ruling.targetObjectId === "none") return `${actor} makes a sound.`;
      return `A sound rings out from the ${obj}.`;
    case "open":
      return `${actor} opens the ${obj}.`;
    case "close":
      return `${actor} shuts the ${obj}.`;
    case "leave":
      // OPEN-VARIANT.md §17.2: the target is the way out, whose id is its name.
      // True whether or not the way turns out to be open: what a bystander
      // sees is the attempt.
      return `${actor} makes for the ${obj}.`;
    case "derive":
      if (reshapeOf !== undefined) return `${actor} works at the ${reshapeOf}.`;
      // The act on the parent, and nothing about the product (OPEN-VARIANT.md
      // §13.4): what was made, a bystander learns by perceiving it later.
      return `${actor} works a piece loose from the ${obj}.`;
    case "none":
      // Dead in the real pipeline: `runOpenHalfRound` only calls this once
      // `ruling.applicable` is true, which requires `effectKind !== "none"`
      // (`referee.ts`'s `computeRuling`). Kept for switch exhaustiveness and
      // for any direct caller (tests) -- worded positively, never "nothing"
      // or "no effect" (OPEN-VARIANT.md §2 invariant 7).
      return `${actor}'s moment passes.`;
  }
}

/** Belief-based `expects` on WEAR-type effects (this task's brief:
 *  "respecting... belief-based `expects` on wear-type effects, as the
 *  closed variant does for FILE/SHIM"), read from the acting principal's
 *  own belief of the resource by NAME -- `undefined` when this principal
 *  has no belief yet, never a guessed value standing in for one (exactly
 *  `src/ledger/beliefs.ts`'s own `beliefExpectation`, generalised past the
 *  closed variant's four-resource union type). */
function wearExpectation(openWorld: OpenWorld, principal: Principal, resourceId: string): readonly Expectation[] | undefined {
  const resourceName = openWorld.resourceNameById[resourceId];
  if (!resourceName) return undefined;
  const belief = getBelief(openWorld.base.gameId, principal, resourceName);
  if (!belief) return undefined;
  return [{ entityId: resourceId, key: "value", value: belief.value }];
}

/** Channel (a) -- generic, mirroring `src/loop.ts`'s own
 *  `applyBeliefUpdatesForSuccess`: whatever resource the ACTOR's own
 *  outcome just touched (a write, or a reveal's own read) is now known to
 *  the acting principal exactly. */
/** A refusal reveals the contradicted truth into the ACTING principal's own
 *  belief -- mirroring `src/loop.ts`'s own `applyBeliefRevealFromRefusal`.
 *  Only the first contradiction is used, exactly like the closed variant. */
function revealBeliefFromRefusal(openWorld: OpenWorld, principal: Principal, resourceId: string, err: ResolveProtocolError | ConstraintViolationError, roundN: number): void {
  let value: number | undefined;
  if (err instanceof ResolveProtocolError) {
    const first = err.contradictions?.[0];
    if (first && first.fact.entityId === resourceId) value = Number(first.fact.value);
  } else if (err.contradictedFact && err.resourceId === resourceId) {
    value = Number(err.contradictedFact.value);
  }
  if (value === undefined || Number.isNaN(value)) return;
  const resourceName = openWorld.resourceNameById[resourceId];
  if (!resourceName) return;
  setBelief(openWorld.base.gameId, principal, resourceName, value, roundN);
}

function updateActorBelief(openWorld: OpenWorld, principal: Principal, plan: EffectPlan, outcome: Outcome, roundN: number): void {
  if (!plan.resourceId) return;
  const resourceName = openWorld.resourceNameById[plan.resourceId];
  if (!resourceName) return;
  const written = outcome.transitions.find((t) => t.entityId === plan.resourceId && t.key === "value");
  const value = written ? Number(written.newValue) : typeof outcome.result.value === "number" ? outcome.result.value : undefined;
  if (typeof value === "number") setBelief(openWorld.base.gameId, principal, resourceName, value, roundN);
}

export async function runOpenHalfRound(params: {
  openWorld: OpenWorld;
  resolver: Resolver;
  referee: Referee;
  principal: Principal;
  roundN: number;
  t: number;
  context: OpenPrincipalContext;
  mind: OpenMind;
  /** Prisoner attempts the warden already knows on sight (`precedentTextFor`
   *  texts). Absent outside the precedent condition. */
  knownApproaches?: readonly KnownApproach[];
  /** The pick condition (OPEN-VARIANT.md §21), present only on a forced
   *  prisoner turn: every approach counted as seen -- the ledger's known
   *  approaches plus what the warden saw earlier this game. Recognition only:
   *  the known-approach cost still reads `knownApproaches` alone. */
  forcePick?: { readonly seen: readonly string[]; readonly regenerate?: boolean };
  /** The pick condition at replan time (OPEN-VARIANT.md §23), on every
   *  prisoner turn under it: what counts as seen, and whether the prisoner
   *  had a plan before this turn (a first plan is a new plan). */
  replanPick?: { readonly seen: readonly string[]; readonly hadPlan: boolean };
  /** OPEN-VARIANT.md §55 (issue #22, gaps 1 and 2). Default `"off"`:
   *  byte-identical to every batch recorded before this gap existed. */
  presenceMode?: PresenceMode;
  /** WORLD-ELABORATION-DESIGN.md §4.1, §9 row P1b: the play-time elaboration
   *  referee -- present only under `PRISONER_ELABORATE=property`. Absent
   *  (the default) means `considerElaboration` is never called, which is
   *  what keeps `off` byte-identical to every half-round recorded before
   *  this arm existed. */
  elaborationReferee?: ElaborationReferee;
  /** WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: the build-time band table
   *  a fired elaboration is priced against -- defaults to the real,
   *  committed `ELABORATION_BANDS`; a test hands in its own fixture rows the
   *  same way `lookupBand` itself already accepts an optional `rows`
   *  parameter. Read only when an elaboration actually fires; unused
   *  (imported, never called) under `PRISONER_ELABORATE=off`. */
  elaborationBands?: readonly ElaborationBandRow[];
  /** Appendix C's `PRISONER_ELABORATE_BAND`: forces which band a fired
   *  elaboration applies, for the §4.8 sweep -- absent (the default) means
   *  the built table's own reading always applies. */
  forcedElaborationBand?: DifficultyBand;
}): Promise<OpenHalfRoundResult> {
  const { openWorld, resolver, referee, principal, roundN, t, context, mind } = params;
  const presenceMode = params.presenceMode ?? "off";
  // Hoisted: depends only on `t`/`principal`/`presenceMode`, never on the
  // ruling or the plan, so both of §1.4's null paths (below) can use it for
  // an acquisition's own suspicion eligibility exactly as the success path
  // (further down) always has.
  const other: Principal = principal === "prisoner" ? "warden" : "prisoner";
  const otherPresent = presenceMode === "off" || principalLocation(openWorld, principal, t) === principalLocation(openWorld, other, t);

  const considered = await mind.consider(context);
  if (considered === null) {
    return { principal, t, roundN, context, pick: null, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null, elaboration: null, acquired: null };
  }

  // §21: the recogniser is the referee itself, so "seen" means exactly what
  // the precedent ledger would have recorded for that text. A reshaping is
  // not recognised here (it needs the parent's kind, §14.4).
  const recognisedAs = new Map<string, string>();
  const recognise = async (text: string, seen: readonly string[]): Promise<{ verdict: Verdict; as: string }> => {
    const ruling = await referee.rule(text, context.perceivedObjects);
    if (!ruling.applicable) return { verdict: "unavailable", as: "" };
    const as = precedentTextFor(ruling);
    recognisedAs.set(text, as);
    return { verdict: seen.includes(as) ? "seen" : "unseen", as };
  };
  let picked: OpenHalfRoundResult["pick"] = null;
  let proposal: OpenProposal = considered;
  if (principal === "prisoner" && params.forcePick) {
    const seen = params.forcePick.seen;
    const result = await pick(considered.intent, (considered.candidates ?? []).map((c) => c.text), {
      force: true,
      recognise: async (text) => (await recognise(text, seen)).verdict,
      // §36: told what is already known, in the words the warden knows it by;
      // the fresh answer's texts are only candidates, and its plan is not kept.
      ...(params.forcePick.regenerate
        ? {
            regenerate: async () => {
              const knownAs = [...new Set([considered.intent, ...(considered.candidates ?? []).map((c) => c.text)].map((t) => recognisedAs.get(t)).filter((as): as is string => !!as && seen.includes(as)))];
              const why = knownAs.length > 0 ? ` has already seen and knows on sight (${knownAs.map((as) => `"${as}"`).join("; ")})` : " could not do or has already seen";
              const again = await mind.consider({
                ...context,
                briefing: `${context.briefing}\nBefore you act: everything you listed is something ${WARDEN_NAME}${why}. List different things you could try this turn, that ${WARDEN_NAME} has not seen.`,
              });
              return again === null ? [] : [again.intent, ...(again.candidates ?? []).map((c) => c.text)];
            },
          }
        : {}),
    });
    picked = {
      own: considered.intent,
      forced: result.forced,
      overridden: result.overridden,
      verdicts: result.verdicts,
      ...(result.regenerated ? { regenerated: result.regenerated } : {}),
    };
    if (result.overridden) proposal = { ...considered, intent: result.chosen };
  }
  // §23: a new plan whose first step the warden has seen is sent back to the
  // mind once, told which approach it began with. The mind plans again; code
  // never substitutes a step, and the second answer stands whatever it is.
  if (principal === "prisoner" && params.replanPick && (considered.replanned === true || !params.replanPick.hadPlan)) {
    const first = await recognise(considered.intent, params.replanPick.seen);
    const reasked = first.verdict === "seen";
    if (reasked) {
      const again = await mind.consider({
        ...context,
        briefing: `${context.briefing}\nBefore you act: your new plan begins with something ${WARDEN_NAME} has already seen and knows on sight ("${first.as}"). Make a different plan, whose first step ${WARDEN_NAME} has not seen.`,
      });
      if (again !== null) proposal = again;
    }
    picked = { own: considered.intent, forced: true, overridden: proposal.intent !== considered.intent, verdicts: [{ candidate: considered.intent, verdict: first.verdict }], reasked };
  }
  const base = { principal, t, roundN, context, pick: picked };

  // Notes to self, persisted before the referee rules -- exactly the closed
  // variant's `runHalfRound`: a note is the mind's own memo, independent of
  // what its attempt goes on to do.
  if (proposal.notes) setNotes(openWorld.base.gameId, principal, proposal.notes, roundN);

  const ruling = await referee.rule(proposal.intent, context.perceivedObjects);
  if (!ruling.applicable) {
    // WORLD-ELABORATION-DESIGN.md §1.4's first silent null path: the
    // referee found nothing applicable. §4.1's first of its two routes.
    const elaboration = params.elaborationReferee
      ? await considerElaboration(openWorld, params.elaborationReferee, ruling.targetObjectId, proposal, context.perceivedObjects)
      : null;
    const acquired = elaboration
      ? await tryAcquire(openWorld, resolver, elaboration, ruling, principal, otherPresent, roundN, params.forcedElaborationBand, params.elaborationBands ?? ELABORATION_BANDS)
      : null;
    return {
      ...base,
      proposal,
      ruling,
      plan: null,
      outcome: acquired?.outcome ?? null,
      refusalError: null,
      perceptionForOther: acquired?.perceptionForOther ?? null,
      revealFor: null,
      derived: null,
      reshaped: null,
      resourceName: acquired?.result?.resourceName ?? null,
      elaboration,
      acquired: acquired?.result ?? null,
    };
  }

  const actorId = principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId;
  // OPEN-VARIANT.md §14: a derive from an object made earlier in this game
  // names it by its recorded kind; a product that replaces its parent is a
  // reshaping, perceived by the other only if it perceives the parent now.
  const parentRecord = ruling.effectKind === "derive" ? openWorld.derived.find((d) => d.id === ruling.targetObjectId) : undefined;
  const reshapeOf = parentRecord && findKind(ruling.product)?.replacesParent ? findKind(parentRecord.kindId)?.label : undefined;
  const description = describeAttempt(principal, ruling, undefined, reshapeOf);
  const parent: DerivedParent | undefined = parentRecord
    ? {
        kindId: parentRecord.kindId,
        heldBy: parentRecord.heldBy,
        holderId: parentRecord.heldBy === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId,
        entityId: parentRecord.entityId,
        resources: parentRecord.properties.map((p) => ({ key: p.key, resourceId: resourceIdForProperty(openWorld, parentRecord.id, p.key) as string })),
      }
    : undefined;
  const plan = planEffect({
    targetObjectId: ruling.targetObjectId,
    effectKind: ruling.effectKind as EffectKind,
    property: ruling.property,
    magnitude: ruling.magnitude,
    // OPEN-VARIANT.md §55 (issue #22 gap 2): a perceived PRINCIPAL is now a
    // legal target too (`briefing.ts`'s `computePerceivedObjects` adds one
    // under `PRISONER_PRESENCE=modelled`) -- merged in here, never in
    // `openWorld.entityIdFor` itself, which stays exactly the §4.1/derived
    // object map it always was. No property is declared for either literal
    // id (`world.ts`'s `declaredProperty` below knows only OPEN_OBJECTS and
    // this game's own derived objects), so every effect that would WRITE
    // something still refuses -- only `noise` (`resourceId: null`) can ever
    // resolve against one, and nothing here can write a belief from it.
    entityIdFor: { ...openWorld.entityIdFor, prisoner: openWorld.base.prisonerId, warden: openWorld.base.wardenId },
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    actorId,
    declaredProperty: (objectId, key) => declaredProperty(openWorld, objectId, key),
    ...(ruling.effectKind === "derive"
      ? {
          derive: {
            product: ruling.product,
            parentSpan: ruling.citations.property.citation?.quote ?? "",
            actorId,
            ownerLocationId: openWorld.base.cellId,
            newObjectId: nextDerivedId(openWorld, ruling.product),
            ...(parent ? { parent } : {}),
          },
        }
      : {}),
    description,
  });
  if (plan === null) {
    // Declared applicable by the referee, but not a real (object, property)
    // pair in the scenario -- "no invented world" (invariant 6). Do nothing.
    // WORLD-ELABORATION-DESIGN.md §1.4's second silent null path, §4.1's
    // second route: the elaboration request is still asked in full here --
    // `ruling.property` already names the gap the base ruling found, and
    // whether `elaboration.need` agrees with it is a free consistency
    // measurement a reader (or a future test) can make from both fields,
    // never something this function uses to decide anything.
    const elaboration = params.elaborationReferee
      ? await considerElaboration(openWorld, params.elaborationReferee, ruling.targetObjectId, proposal, context.perceivedObjects)
      : null;
    const acquired = elaboration
      ? await tryAcquire(openWorld, resolver, elaboration, ruling, principal, otherPresent, roundN, params.forcedElaborationBand, params.elaborationBands ?? ELABORATION_BANDS)
      : null;
    return {
      ...base,
      proposal,
      ruling,
      plan: null,
      outcome: acquired?.outcome ?? null,
      refusalError: null,
      perceptionForOther: acquired?.perceptionForOther ?? null,
      revealFor: null,
      derived: null,
      reshaped: null,
      resourceName: acquired?.result?.resourceName ?? null,
      elaboration,
      acquired: acquired?.result ?? null,
    };
  }

  // `other`/`otherPresent` are hoisted to the top of this function (OPEN-VARIANT.md
  // §55, issue #22 gap 1): under `off` (the default), `otherPresent` is
  // unconditionally true -- byte-identical to every batch recorded before
  // that gap existed. Under `modelled`, the other principal genuinely has
  // to share this location right now.
  const seenByOther = otherPresent && (plan.derived?.replaces ? computePerceivedObjects(openWorld, other, t, presenceMode).some((o) => o.id === ruling.targetObjectId) : true);

  const expects = plan.isWearType && plan.resourceId ? wearExpectation(openWorld, principal, plan.resourceId) : undefined;

  // the-prisoner#6: what the plan writes, named for the reader here, where the
  // world is in scope -- §19 means this is not always the ruling's own target.
  const resourceName = plan.resourceId ? (openWorld.resourceNameById[plan.resourceId] ?? null) : null;

  // Evidence becomes grounds (OPEN-VARIANT.md §9.3): the warden's OWN prior
  // belief, read BEFORE this resolution -- `updateActorBelief` below (channel
  // a) would otherwise overwrite it with the just-revealed value first,
  // making a warden's own reveal permanently unable to detect its own
  // freshest discovery (exactly the bug this comment is here to prevent
  // reintroducing: read prior belief, THEN resolve, THEN update belief).
  const priorBeliefResourceName = principal === "warden" && plan.resourceId ? openWorld.resourceNameById[plan.resourceId] : undefined;
  const priorBelief = priorBeliefResourceName ? getBelief(openWorld.base.gameId, "warden", priorBeliefResourceName) : null;

  try {
    const outcome = resolver.resolve({
      gameId: openWorld.base.gameId,
      mechanic: plan.mechanic,
      parameters: plan.parameters,
      ...(expects ? { expects } : {}),
    });
    updateActorBelief(openWorld, principal, plan, outcome, roundN);

    // OPEN-VARIANT.md §13.5: what the derive made, registered from its own
    // outcome; the maker knows the new thing's starting state exactly.
    let derived: DerivedObjectRecord | null = null;
    let reshaped: OpenHalfRoundResult["reshaped"] = null;
    if (plan.derived && outcome.result.made === true) {
      const replaces = plan.derived.replaces;
      derived = adoptDerivedObject(openWorld, { ...plan.derived, heldBy: replaces?.heldBy ?? principal, outcome });
      const startValues = (outcome.result.startValues ?? {}) as Record<string, number>;
      for (const p of derived.properties) setBelief(openWorld.base.gameId, principal, p.resourceName, startValues[`property:${p.key}`] ?? p.initialValue, roundN);
      // §14.2: the parent went in the same resolution; the world forgets it.
      if (replaces) reshaped = { parent: retireDerivedObject(openWorld, replaces.id), seenByOther };
    }

    // A known approach is known on sight: a reshaping the warden cannot see is
    // no approach it recognises (§14.4).
    const knownAs = precedentTextFor(ruling, reshapeOf);
    const known = principal === "prisoner" && seenByOther ? ((params.knownApproaches ?? []).find((k) => k.text === knownAs) ?? null) : null;
    // OPEN-VARIANT.md §55 (issue #22 gap 1): not present at all is not "a
    // reshaping unseen" (`describeUnseenAttempt`'s own vague noise) -- it is
    // nothing perceived whatsoever, the same "the warden hears nothing...
    // and sees none of it" rule the closed variant's own
    // `WARDEN_PRESENCE_RULE` already states.
    const perceptionForOther = !otherPresent ? null : ruling.perceptibility !== "silent" || known ? (seenByOther ? description : describeUnseenAttempt(principal)) : null;

    // OPEN-VARIANT.md §9.3, "grounds accrue": a prisoner's own non-silent
    // wear/restore/expose bumps warden_suspicion by a fixed, magnitude-scaled
    // amount -- a SEPARATE, audited resolve() call, never a side channel.
    // OPEN-VARIANT.md §55 (issue #22 gap 1): gated on `otherPresent`, exactly
    // the closed variant's own `WARDEN_PRESENCE`/`wardenPresent` rule
    // ("unheard while the warden is away") -- always true under `off`.
    if (principal === "prisoner" && otherPresent && suspicionEligibleFor(ruling.effectKind, ruling.targetObjectId) && ruling.perceptibility !== "silent") {
      bumpWardenSuspicion(openWorld, resolver, SUSPICION_BUMP_FOR_MAGNITUDE[ruling.magnitude], "The warden grows more suspicious.");
    }
    if (known) {
      bumpWardenSuspicion(openWorld, resolver, known.suspicionBump, "The warden recognises a known approach.");
    }

    let revealFor: OpenHalfRoundResult["revealFor"] = null;
    if (ruling.effectKind === "reveal" && typeof outcome.result.value === "number") {
      const value = outcome.result.value;
      revealFor = { objectId: ruling.targetObjectId, property: ruling.property === "none" ? "" : ruling.property, value };
      if (principal === "warden" && priorBelief && value < priorBelief.value) {
        // The identical rule and constant the closed variant's OBSERVE/
        // CHECK_LOCK already use, applied here to any revealed property.
        const bump = Math.floor((priorBelief.value - value) / EVIDENCE_SUSPICION_DIVISOR);
        bumpWardenSuspicion(openWorld, resolver, bump, "The warden notices unexplained wear.");
      }
    }

    return { ...base, proposal, ruling, plan, outcome, refusalError: null, perceptionForOther, revealFor, derived, reshaped, resourceName, elaboration: null, acquired: null };
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      if (plan.resourceId) revealBeliefFromRefusal(openWorld, principal, plan.resourceId, err, roundN);
      return { ...base, proposal, ruling, plan, outcome: null, refusalError: err, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName, elaboration: null, acquired: null };
    }
    throw err;
  }
}
