import { ResolveProtocolError } from "run-dmcp";
import type { OpenHalfRoundResult } from "./loop.js";
import { findKind } from "./derivedObjects.js";
import { bandNumbersFor } from "./acquirableProperties.js";
import type { OpenPropertyKey } from "./scenarioObjects.js";
import { PRISONER_NAME, WARDEN_NAME, PRISONER_SHORT_NAME, WARDEN_SHORT_NAME } from "../scenario.js";

/**
 * What each principal learns from a half-round, rendered by code from
 * structured fields (OPEN-VARIANT.md §2 invariant 2: "What an actor learns
 * from a ruling is rendered from the effects it can perceive, by code, in
 * positive nouns, never from referee prose"). Two audiences, two functions:
 *
 * - `renderOwnOutcome` -- the ACTOR, who did the thing with its own hands and
 *   so learns the exact number it moved or revealed (the closed variant's
 *   `ownMoveFeedback` rule), or, when its attempt was ruled impossible, the
 *   positive reason (§5.3 item 2): the authored description of the object it
 *   reached for, or the list of things it can reach.
 * - `renderForOther` -- the OTHER principal, who hears the spoken line and
 *   perceives a non-silent attempt as `describeAttempt`'s sentence (no
 *   number, no property, no intent text).
 *
 * Neither reads the referee's citations or raw answers: only ruling KEYS
 * (object id, effect kind) and the engine's own outcome/refusal values.
 */

function label(id: string): string {
  return id.replace(/_/g, " ");
}

/** OPEN-VARIANT.md §55 (issue #22 gap 2) made a principal a legal ruling
 *  target. A principal is a PERSON, and every sentence this module renders
 *  about one has to be shaped for a person rather than for furniture --
 *  `noise`'s own special case ("made the warden ring out" is nonsense) was
 *  the first branch to need it, not the only one. */
function isPrincipalTarget(id: string): boolean {
  return id === "prisoner" || id === "warden";
}

/** A principal's own name, for the sentences that address one as a person.
 *  Never `label(id)` -- "the warden" is the definite article for a thing. */
function principalName(id: string): string {
  return id === "prisoner" ? PRISONER_NAME : WARDEN_NAME;
}

function quoted(intent: string): string {
  return `"${intent}"`;
}

export function renderOwnOutcome(half: OpenHalfRoundResult): string | null {
  const { proposal, ruling, plan, outcome, refusalError } = half;
  if (proposal === null || ruling === null) return null;
  const obj = label(ruling.targetObjectId);
  const property = ruling.property;

  if (refusalError !== null) {
    let value: unknown;
    if (refusalError instanceof ResolveProtocolError) value = refusalError.contradictions?.[0]?.fact.value;
    else value = refusalError.contradictedFact?.value;
    return value !== undefined
      ? `Your last attempt on the ${obj} was refused by the world as it stands: its ${property} is ${value}.`
      : `Your last attempt on the ${obj} was refused by the world as it stands.`;
  }

  // WORLD-ELABORATION-DESIGN.md §4.6: positive, from state, rendered by
  // code, never by a model -- the target's own authored description, then
  // the band's `reads` line at the value the acquisition's own resolution
  // just left it at (never the initial value: §4.4's leg 2 always wears it
  // in the SAME resolution that creates it, so the band's own "start value
  // renders nothing" rule never has anything to render here anyway).
  if (half.acquired) {
    const a = half.acquired;
    const acquiredObj = label(a.objectId);
    const target = half.context.perceivedObjects.find((o) => o.id === a.objectId);
    const numbers = bandNumbersFor(a.need as OpenPropertyKey, a.band);
    const wornLine = numbers?.readRanges.find((r) => a.startValue <= r.atOrBelow)?.text;
    const base = target ? target.description : "";
    return `Your last attempt (${quoted(proposal.intent)}) found the ${acquiredObj} as it is: ${base}${wornLine ? ` ${wornLine}` : ""}`;
  }

  if (outcome !== null && plan !== null) {
    const result = outcome.result as { before?: number; after?: number; value?: number; left?: boolean; opened?: boolean; wayOut?: string; freedPart?: string };
    // OPEN-VARIANT.md §17.2: open, close and leave target the way out, and its id is its name.
    const exit = obj;
    if (ruling.effectKind === "leave") {
      return result.left ? `You are out of the cell, through the ${exit}.` : `Your last attempt met the ${exit} shut: you are still in the cell.`;
    }
    if (ruling.effectKind === "open" || ruling.effectKind === "close") {
      // §19: resolved through the way out even when the referee named its part.
      const wayOut = result.wayOut?.replace(/_/g, " ") ?? exit;
      if (ruling.effectKind === "open" && result.opened === false) return `Your last attempt met the ${wayOut} shut: it will not open yet.`;
      // OPEN-VARIANT.md §28: a way out whose part closes its gap opens by that part coming free, and is told
      // as the action it opens up (§27.1: "opened the window" left her prying a bar still in the way).
      if (ruling.effectKind === "open" && result.freedPart) {
        const part = result.freedPart.replace(/_/g, " ");
        return result.before === result.after
          ? `The ${part} is already free of the ${wayOut}: the ${wayOut} can be climbed through now.`
          : `Your last attempt worked the ${part} free of the ${wayOut}: the ${wayOut} can be climbed through now.`;
      }
      const verb = ruling.effectKind === "open" ? "opened" : "shut";
      return result.before === result.after ? `The ${wayOut} was already ${ruling.effectKind === "open" ? "open" : "shut"}.` : `Your last attempt ${verb} the ${wayOut}.`;
    }
    if (ruling.effectKind === "reveal" && typeof result.value === "number") {
      return `Your last attempt showed you the ${obj} closely: its ${property} is ${result.value}.`;
    }
    if (ruling.effectKind === "noise") {
      // OPEN-VARIANT.md §55 (issue #22 gap 2): a principal is now a legal
      // `noise` target, and "made the warden ring out" is nonsense --
      // mirrors `loop.ts`'s own `describeAttempt` special case for the
      // same reason.
      if (isPrincipalTarget(ruling.targetObjectId)) {
        return `Your last attempt called out to ${principalName(ruling.targetObjectId)}.`;
      }
      // OPUS-FIRST-DESIGN.md §3.2: a noise may have no target at all; the
      // sound is then the actor's own, mirroring `describeAttempt` again.
      if (ruling.targetObjectId === "none") return "Your last attempt made a sound.";
      return `Your last attempt made the ${obj} ring out.`;
    }
    if (ruling.effectKind === "derive") {
      // OPEN-VARIANT.md §13.4: the maker holds it now, and learns the
      // parent's numbers; a stripped parent is stated as it is.
      const made = (outcome.result as { made?: boolean }).made === true;
      const label = findKind(ruling.product)?.label ?? ruling.product;
      if (!made) return `Your last attempt met the ${obj} with its ${property} at ${result.before}, already stripped.`;
      if (half.reshaped && half.derived) {
        // OPEN-VARIANT.md §14.4: the whole parent became the product, which
        // whoever held the parent holds.
        const parentLabel = findKind(half.reshaped.parent.kindId)?.label ?? label;
        const holder = half.derived.heldBy === half.principal ? "you hold it" : `${half.derived.heldBy === "prisoner" ? PRISONER_SHORT_NAME : WARDEN_SHORT_NAME} holds it`;
        return `Your last attempt made a ${label} from the ${parentLabel}: ${holder} now, as ${half.derived.id}, and the ${parentLabel} is gone.`;
      }
      const wear = typeof result.before === "number" && typeof result.after === "number" ? ` The ${obj}'s ${property} went from ${result.before} to ${result.after}.` : "";
      return `Your last attempt made a ${label} from the ${obj}: you hold it now, as ${half.derived?.id ?? ruling.product}.${wear}`;
    }
    if (typeof result.before === "number" && typeof result.after === "number") {
      return result.before === result.after
        ? `Your last attempt left the ${obj}'s ${property} at ${result.after}, where it already stood.`
        : `Your last attempt worked on the ${obj}: its ${property} went from ${result.before} to ${result.after}.${
            // OPEN-VARIANT.md §27: a part worn through is told as the way out it frees (§12: passable at 0).
            plan.frees && result.after === (plan.parameters as { min?: number }).min ? ` The ${plan.frees.replace(/_/g, " ")} can be climbed through now.` : ""
          }`;
    }
    return `Your last attempt on the ${obj} took effect.`;
  }

  // Ruled impossible (or ungrounded): the positive reason, from authored text
  // -- the description this principal was itself shown, which for an object
  // derived in this game (OPEN-VARIANT.md §13) is its composed one.
  const target = ruling.targetObjectId !== "none" ? half.context.perceivedObjects.find((o) => o.id === ruling.targetObjectId) : undefined;
  if (target) {
    // A PERSON, not a thing (§55, issue #22 gap 2): "met the warden as it
    // is" was what a human game (2026-09-18) was told after bluffing Croft
    // -- the object wording, definite article and all, applied to the one
    // target in the game that is somebody. The information is identical
    // (the authored description this principal was itself shown, verbatim,
    // which is the positive reason §5.3 item 2 requires); only the frame
    // around it changes, from a thing examined to a person met.
    if (isPrincipalTarget(ruling.targetObjectId)) {
      return `Your last attempt (${quoted(proposal.intent)}) met ${principalName(ruling.targetObjectId)}: ${target.description}`;
    }
    return `Your last attempt (${quoted(proposal.intent)}) met the ${obj} as it is: ${target.description}`;
  }
  // issue #16: this used to say the attempt "reached past what is here" --
  // read, correctly, as "stand closer" -- for EVERY `target: "none"`
  // ruling. That is wrong whenever the intent named nothing the world
  // models at all (a person, a belief): the referee's own `target`
  // question (referee.ts's `buildQuestions`) already folds "names no
  // object" and "names an object this principal cannot reach or perceive"
  // into the same closed key, because `targetKeys` never offers an id
  // outside what this principal already perceives -- an out-of-reach real
  // object cannot be NAMED by id here any more than a person can.
  // `RefereeRuling` (target/effect/property, citations, `raw.answers`)
  // carries nothing that tells the two apart -- no candidate id, no flag
  // for "recognised but unreachable" -- so this claims only what the
  // ruling actually supports: nothing here was matched, not why. Naming
  // what IS here stays, as positive, ruling-backed information.
  const reachable = half.context.perceivedObjects.map((o) => label(o.id)).join(", ");
  return `Your last attempt (${quoted(proposal.intent)}) matches none of what is here: ${reachable}.`;
}

export function renderForOther(half: OpenHalfRoundResult): string[] {
  const lines: string[] = [];
  if (half.perceptionForOther) lines.push(half.perceptionForOther);
  const line = half.proposal?.line;
  if (line && line.length > 0) {
    const speaker = half.principal === "prisoner" ? PRISONER_SHORT_NAME : WARDEN_SHORT_NAME;
    lines.push(`${speaker} says: "${line}"`);
  }
  return lines;
}
