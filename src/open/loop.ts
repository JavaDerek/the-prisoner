import { ResolveProtocolError, ConstraintViolationError, type Resolver, type Outcome, type Expectation } from "run-dmcp";
import type { OpenWorld } from "./world.js";
import type { Referee, RefereeRuling } from "./referee.js";
import { planEffect, type EffectPlan, type EffectKind, type Magnitude } from "./effects.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "./mind.js";
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

/** A prisoner attempt as the warden perceives it, with a role-neutral actor --
 *  the text the precedent ledger records, and the text a known approach is
 *  matched on. Built by code from ruling keys, so matching it is exact string
 *  equality on this repository's own sentence, never a reading of prose. */
export function precedentTextFor(ruling: Pick<RefereeRuling, "targetObjectId" | "effectKind">): string {
  return describeAttempt("prisoner", ruling, "A prisoner");
}

function suspicionEligible(effectKind: EffectKind): boolean {
  return effectKind === "wear" || effectKind === "restore" || effectKind === "expose" || effectKind === "open" || effectKind === "leave";
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

/** OPEN-VARIANT.md §12: the way out each exit object is, as a bystander
 *  names it. Exported for `perception.ts`, which tells the actor the same. */
export const EXIT_LABEL: Readonly<Record<string, string>> = { lock: "door", bar: "window" };

function exitLabel(objectId: string): string {
  return EXIT_LABEL[objectId] ?? objectLabel(objectId);
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
  actor: string = actorName(principal)
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
      return `A sound rings out from the ${obj}.`;
    case "open":
      return `${actor} opens the ${exitLabel(ruling.targetObjectId)}.`;
    case "close":
      return `${actor} shuts the ${exitLabel(ruling.targetObjectId)}.`;
    case "leave":
      // True whether or not the way turns out to be open: what a bystander
      // sees is the attempt.
      return `${actor} makes for the ${exitLabel(ruling.targetObjectId)}.`;
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
  knownApproaches?: readonly string[];
}): Promise<OpenHalfRoundResult> {
  const { openWorld, resolver, referee, principal, roundN, t, context, mind } = params;
  const base = { principal, t, roundN, context };

  const proposal = await mind.consider(context);
  if (proposal === null) {
    return { ...base, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null };
  }

  // Notes to self, persisted before the referee rules -- exactly the closed
  // variant's `runHalfRound`: a note is the mind's own memo, independent of
  // what its attempt goes on to do.
  if (proposal.notes) setNotes(openWorld.base.gameId, principal, proposal.notes, roundN);

  const ruling = await referee.rule(proposal.intent, context.perceivedObjects);
  if (!ruling.applicable) {
    return { ...base, proposal, ruling, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null };
  }

  const description = describeAttempt(principal, ruling);
  const plan = planEffect({
    targetObjectId: ruling.targetObjectId,
    effectKind: ruling.effectKind as EffectKind,
    property: ruling.property,
    magnitude: ruling.magnitude,
    entityIdFor: openWorld.entityIdFor,
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    actorId: principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId,
    description,
  });
  if (plan === null) {
    // Declared applicable by the referee, but not a real (object, property)
    // pair in the scenario -- "no invented world" (invariant 6). Do nothing.
    return { ...base, proposal, ruling, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null };
  }

  const expects = plan.isWearType && plan.resourceId ? wearExpectation(openWorld, principal, plan.resourceId) : undefined;

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
    const known = principal === "prisoner" && (params.knownApproaches ?? []).includes(precedentTextFor(ruling));
    const perceptionForOther = ruling.perceptibility !== "silent" || known ? description : null;

    // OPEN-VARIANT.md §9.3, "grounds accrue": a prisoner's own non-silent
    // wear/restore/expose bumps warden_suspicion by a fixed, magnitude-scaled
    // amount -- a SEPARATE, audited resolve() call, never a side channel.
    if (principal === "prisoner" && suspicionEligible(ruling.effectKind) && ruling.perceptibility !== "silent") {
      bumpWardenSuspicion(openWorld, resolver, SUSPICION_BUMP_FOR_MAGNITUDE[ruling.magnitude], "The warden grows more suspicious.");
    }
    if (known) {
      bumpWardenSuspicion(openWorld, resolver, KNOWN_APPROACH_SUSPICION_BUMP, "The warden recognises a known approach.");
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

    return { ...base, proposal, ruling, plan, outcome, refusalError: null, perceptionForOther, revealFor };
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      if (plan.resourceId) revealBeliefFromRefusal(openWorld, principal, plan.resourceId, err, roundN);
      return { ...base, proposal, ruling, plan, outcome: null, refusalError: err, perceptionForOther: null, revealFor: null };
    }
    throw err;
  }
}
