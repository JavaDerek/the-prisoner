import { ResolveProtocolError, ConstraintViolationError, type Resolver, type Outcome, type Expectation } from "run-dmcp";
import { adoptDerivedObject, retireDerivedObject, nextDerivedId, declaredProperty, resourceIdForProperty, type OpenWorld, type DerivedObjectRecord } from "./world.js";
import { findKind } from "./derivedObjects.js";
import { computePerceivedObjects } from "./briefing.js";
import type { Referee, RefereeRuling } from "./referee.js";
import { planEffect, type EffectPlan, type EffectKind, type Magnitude, type DerivedParent } from "./effects.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "./mind.js";
import { pick, type Verdict } from "./pick.js";
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

function suspicionEligible(effectKind: EffectKind): boolean {
  return effectKind === "wear" || effectKind === "restore" || effectKind === "expose" || effectKind === "open" || effectKind === "leave" || effectKind === "derive";
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
  knownApproaches?: readonly string[];
  /** The pick condition (OPEN-VARIANT.md §21), present only on a forced
   *  prisoner turn: every approach counted as seen -- the ledger's known
   *  approaches plus what the warden saw earlier this game. Recognition only:
   *  the known-approach cost still reads `knownApproaches` alone. */
  forcePick?: { readonly seen: readonly string[]; readonly regenerate?: boolean };
  /** The pick condition at replan time (OPEN-VARIANT.md §23), on every
   *  prisoner turn under it: what counts as seen, and whether the prisoner
   *  had a plan before this turn (a first plan is a new plan). */
  replanPick?: { readonly seen: readonly string[]; readonly hadPlan: boolean };
}): Promise<OpenHalfRoundResult> {
  const { openWorld, resolver, referee, principal, roundN, t, context, mind } = params;

  const considered = await mind.consider(context);
  if (considered === null) {
    return { principal, t, roundN, context, pick: null, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null };
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
    return { ...base, proposal, ruling, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null };
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
    entityIdFor: openWorld.entityIdFor,
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
    return { ...base, proposal, ruling, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null };
  }

  const other: Principal = principal === "prisoner" ? "warden" : "prisoner";
  const seenByOther = plan.derived?.replaces ? computePerceivedObjects(openWorld, other, t).some((o) => o.id === ruling.targetObjectId) : true;

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
    const known = principal === "prisoner" && seenByOther && (params.knownApproaches ?? []).includes(precedentTextFor(ruling, reshapeOf));
    const perceptionForOther = ruling.perceptibility !== "silent" || known ? (seenByOther ? description : describeUnseenAttempt(principal)) : null;

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

    return { ...base, proposal, ruling, plan, outcome, refusalError: null, perceptionForOther, revealFor, derived, reshaped, resourceName };
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      if (plan.resourceId) revealBeliefFromRefusal(openWorld, principal, plan.resourceId, err, roundN);
      return { ...base, proposal, ruling, plan, outcome: null, refusalError: err, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName };
    }
    throw err;
  }
}
