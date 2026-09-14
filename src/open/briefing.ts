import { readNumericFact } from "../world/facts.js";
import { getBelief, renderBeliefLine } from "../ledger/beliefs.js";
import { SEARCH_SUSPICION_THRESHOLD } from "../world/mechanics.js";
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
  // The §4.1 objects, then every object derived in this game (OPEN-VARIANT.md
  // §13.3), under one rule: the holder always perceives its own things; the
  // other principal does unless the thing is concealed at 50 or more.
  const candidates = [
    ...OPEN_OBJECTS.map((spec) => ({ id: spec.id, description: spec.description, owner: OWNER_OF[spec.id] })),
    ...openWorld.derived.map((d) => ({ id: d.id, description: d.description, owner: d.heldBy as Principal | undefined })),
  ];
  return candidates
    .filter((object) => {
      if (object.owner === principal) return true;
      const concealmentResourceId = resourceIdForProperty(openWorld, object.id, "concealment");
      if (!concealmentResourceId) return true; // Not concealable at all.
      const value = readNumericFact({ gameId: openWorld.base.gameId, t, entityId: concealmentResourceId, key: "value" });
      return value === null || value < 50;
    })
    .map((object) => ({ id: object.id, description: object.description }));
}

const DEFAULT_TOTAL_ROUNDS = 12;

/** What happened since this principal's own last turn, already rendered by
 *  `perception.ts` -- its own attempt's outcome, and what it perceived of
 *  the other principal's. Strings only: the caller decides WHOSE news goes
 *  to whom, and this module only places it. */
export type OpenNews = {
  /** Standing knowledge for the whole game, repeated every turn (`precedent.ts`). */
  readonly standing?: readonly string[];
  readonly ownOutcome?: string;
  readonly fromOther?: readonly string[];
};

/** Every resource name a belief can be held about in the open world: the
 *  scenario's declared properties, plus `guard_attention` (a game-state
 *  resource, OPEN-VARIANT.md §9.1, seeded like the closed variant's). A line
 *  renders only where THIS principal holds a belief. */
function beliefResourceNames(openWorld: OpenWorld): string[] {
  const names = OPEN_OBJECTS.flatMap((spec) => spec.properties.map((p) => p.resourceName));
  const derived = openWorld.derived.flatMap((d) => d.properties.map((p) => p.resourceName));
  return [...new Set([...names, ...derived, "guard_attention"])];
}

/** Builds one principal's own briefing -- clock, stakes, this SAME
 *  principal's own persisted notes (`src/ledger/notes.ts`, reused
 *  unchanged), and nothing belonging to the other principal at all. Never
 *  reads the other principal's notes, thoughts, or any referee text --
 *  there is no code path here that could (`getNotes` is keyed on
 *  `principal`, taken as a parameter, and this function is never called
 *  with any string but `"prisoner"`/`"warden"` for the principal it is
 *  building FOR). */
export function buildOpenBriefing(
  openWorld: OpenWorld,
  principal: Principal,
  t: number,
  roundN: number,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS,
  news: OpenNews = {}
): string {
  const gameId = openWorld.base.gameId;
  const lines: string[] = [];
  lines.push(`Round ${roundN} of ${totalRounds}.`);
  if (news.ownOutcome) lines.push(news.ownOutcome);
  for (const perceived of news.fromOther ?? []) lines.push(perceived);
  lines.push(principal === "prisoner" ? prisonerStakes(totalRounds) : wardenStakes(totalRounds));
  for (const line of news.standing ?? []) lines.push(line);

  const notes = getNotes(gameId, principal);
  if (notes) lines.push(`Your notes from last round: ${notes}`);

  // The warden's own suspicion is its own state, live -- the closed
  // briefing's rule; everything else is belief, with its age.
  if (principal === "warden") {
    const suspicion = readNumericFact({ gameId, t, entityId: openWorld.base.resources.wardenSuspicion, key: "value" });
    if (suspicion !== null) {
      lines.push(`warden suspicion: ${suspicion}.`);
      if (suspicion >= SEARCH_SUSPICION_THRESHOLD) lines.push(`You have grounds to search: suspicion ${suspicion}.`);
    }
  }
  for (const name of beliefResourceNames(openWorld)) {
    const line = renderBeliefLine(name.replace(/_/g, " "), getBelief(gameId, principal, name));
    if (line) lines.push(line);
  }

  const perceived = computePerceivedObjects(openWorld, principal, t);
  for (const object of perceived) {
    lines.push(`You perceive the ${object.id.replace(/_/g, " ")}: ${object.description}`);
  }

  return lines.join("\n");
}

export function buildOpenContext(
  openWorld: OpenWorld,
  principal: Principal,
  t: number,
  roundN: number,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS,
  news: OpenNews = {}
): OpenPrincipalContext {
  const principalId = principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId;
  return {
    principalId,
    identity: principal === "prisoner" ? PRISONER_IDENTITY : WARDEN_IDENTITY,
    motive: principal === "prisoner" ? PRISONER_MOTIVE : WARDEN_MOTIVE,
    briefing: buildOpenBriefing(openWorld, principal, t, roundN, totalRounds, news),
    perceivedObjects: computePerceivedObjects(openWorld, principal, t),
  };
}
