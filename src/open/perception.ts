import { ResolveProtocolError } from "run-dmcp";
import type { OpenHalfRoundResult } from "./loop.js";
import { findObject } from "./scenarioObjects.js";
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
    const result = outcome.result as { before?: number; after?: number; value?: number };
    if (ruling.effectKind === "reveal" && typeof result.value === "number") {
      return `Your last attempt showed you the ${obj} closely: its ${property} is ${result.value}.`;
    }
    if (ruling.effectKind === "noise") {
      return `Your last attempt made the ${obj} ring out.`;
    }
    if (typeof result.before === "number" && typeof result.after === "number") {
      return result.before === result.after
        ? `Your last attempt left the ${obj}'s ${property} at ${result.after}, where it already stood.`
        : `Your last attempt worked on the ${obj}: its ${property} went from ${result.before} to ${result.after}.`;
    }
    return `Your last attempt on the ${obj} took effect.`;
  }

  // Ruled impossible (or ungrounded): the positive reason, from authored text.
  const target = ruling.targetObjectId !== "none" ? findObject(ruling.targetObjectId) : undefined;
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
