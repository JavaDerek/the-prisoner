import { readNumericFact } from "../world/facts.js";
import { getNotes } from "../ledger/notes.js";
import { OPEN_OBJECTS } from "./scenarioObjects.js";
import { resourceIdForProperty, type OpenWorld } from "./world.js";
import type { ObjectPerception } from "./referee.js";
import type { OpenPrincipalContext } from "./mind.js";
import type { Principal } from "../ledger/beliefs.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE, prisonerStakes, wardenStakes } from "../scenario.js";

/**
 * Open-mode perception and briefing (OPEN-VARIANT.md §1: presence, thoughts
 * and notes stay shared with the closed variant; only the ACTION layer
 * differs). Built the same POSITIVE way `src/view/viewFor.ts` and
 * `src/mind/briefing.ts` are: select what this principal can perceive, then
 * render only that -- never render everything and subtract.
 *
 * CONCEALMENT GATES PERCEPTION (this task's decision, recorded here since
 * OPEN-VARIANT.md does not spell out a perception rule for the new
 * bounded `concealment` property): an object is perceivable by a principal
 * unless it is BOTH (a) concealable (declares a `concealment` property) and
 * (b) currently concealed (value >= 50, the mid-point of the property's own
 * 0-100 range) from a principal who does not own it. In O1's scenario only
 * the spoon has a `concealment` property and only the prisoner owns it, so
 * in practice this hides the spoon from the warden once concealed and
 * changes nothing else -- but the rule itself is general, not
 * spoon-specific, matching the engine boundary's own "generic, with at
 * least one real caller" test.
 */
const OWNER_OF: Partial<Record<string, Principal>> = { spoon: "prisoner", key_ring: "warden" };

export function computePerceivedObjects(openWorld: OpenWorld, principal: Principal, t: number): ObjectPerception[] {
  return OPEN_OBJECTS.filter((spec) => {
    const owner = OWNER_OF[spec.id];
    if (owner === principal) return true; // Always perceive your own things, concealed or not.
    const concealmentResourceId = resourceIdForProperty(openWorld, spec.id, "concealment");
    if (!concealmentResourceId) return true; // Not concealable at all.
    const value = readNumericFact({ gameId: openWorld.base.gameId, t, entityId: concealmentResourceId, key: "value" });
    return value === null || value < 50;
  }).map((spec) => ({ id: spec.id, description: spec.description }));
}

const DEFAULT_TOTAL_ROUNDS = 12;

/** Builds one principal's own briefing -- clock, stakes, this SAME
 *  principal's own persisted notes (`src/ledger/notes.ts`, reused
 *  unchanged), and nothing belonging to the other principal at all. Never
 *  reads the other principal's notes, thoughts, or any referee text --
 *  there is no code path here that could (`getNotes` is keyed on
 *  `principal`, taken as a parameter, and this function is never called
 *  with any string but `"prisoner"`/`"warden"` for the principal it is
 *  building FOR). */
export function buildOpenBriefing(openWorld: OpenWorld, principal: Principal, t: number, roundN: number, totalRounds: number = DEFAULT_TOTAL_ROUNDS): string {
  const lines: string[] = [];
  lines.push(`Round ${roundN} of ${totalRounds}.`);
  lines.push(principal === "prisoner" ? prisonerStakes(totalRounds) : wardenStakes(totalRounds));

  const notes = getNotes(openWorld.base.gameId, principal);
  if (notes) lines.push(`Your notes from last round: ${notes}`);

  const perceived = computePerceivedObjects(openWorld, principal, t);
  for (const object of perceived) {
    lines.push(`You perceive the ${object.id.replace(/_/g, " ")}: ${object.description}`);
  }

  return lines.join("\n");
}

export function buildOpenContext(openWorld: OpenWorld, principal: Principal, t: number, roundN: number, totalRounds: number = DEFAULT_TOTAL_ROUNDS): OpenPrincipalContext {
  const principalId = principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId;
  return {
    principalId,
    identity: principal === "prisoner" ? PRISONER_IDENTITY : WARDEN_IDENTITY,
    motive: principal === "prisoner" ? PRISONER_MOTIVE : WARDEN_MOTIVE,
    briefing: buildOpenBriefing(openWorld, principal, t, roundN, totalRounds),
    perceivedObjects: computePerceivedObjects(openWorld, principal, t),
  };
}
