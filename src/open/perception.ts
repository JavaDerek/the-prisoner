import { ResolveProtocolError } from "run-dmcp";
import type { OpenHalfRoundResult } from "./loop.js";
import { EXIT_LABEL } from "./loop.js";
import { findKind } from "./derivedObjects.js";
import { PRISONER_SHORT_NAME, WARDEN_SHORT_NAME } from "../scenario.js";

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

  if (outcome !== null && plan !== null) {
    const result = outcome.result as { before?: number; after?: number; value?: number; left?: boolean };
    const exit = EXIT_LABEL[ruling.targetObjectId] ?? obj;
    if (ruling.effectKind === "leave") {
      return result.left ? `You are out of the cell, through the ${exit}.` : `Your last attempt met the ${exit} shut: you are still in the cell.`;
    }
    if (ruling.effectKind === "open" || ruling.effectKind === "close") {
      const verb = ruling.effectKind === "open" ? "opened" : "shut";
      return result.before === result.after ? `The ${exit} was already ${ruling.effectKind === "open" ? "open" : "shut"}.` : `Your last attempt ${verb} the ${exit}.`;
    }
    if (ruling.effectKind === "reveal" && typeof result.value === "number") {
      return `Your last attempt showed you the ${obj} closely: its ${property} is ${result.value}.`;
    }
    if (ruling.effectKind === "noise") {
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
        : `Your last attempt worked on the ${obj}: its ${property} went from ${result.before} to ${result.after}.`;
    }
    return `Your last attempt on the ${obj} took effect.`;
  }

  // Ruled impossible (or ungrounded): the positive reason, from authored text
  // -- the description this principal was itself shown, which for an object
  // derived in this game (OPEN-VARIANT.md §13) is its composed one.
  const target = ruling.targetObjectId !== "none" ? half.context.perceivedObjects.find((o) => o.id === ruling.targetObjectId) : undefined;
  if (target) {
    return `Your last attempt (${quoted(proposal.intent)}) met the ${obj} as it is: ${target.description}`;
  }
  const reachable = half.context.perceivedObjects.map((o) => label(o.id)).join(", ");
  return `Your last attempt (${quoted(proposal.intent)}) reached past what is here; within your reach are: ${reachable}.`;
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
