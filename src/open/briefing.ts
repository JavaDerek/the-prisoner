import { readNumericFact, readFactValue } from "../world/facts.js";
import { getBelief, renderBeliefLine } from "../ledger/beliefs.js";
import { SEARCH_SUSPICION_THRESHOLD } from "../world/mechanics.js";
import { getNotes } from "../ledger/notes.js";
import { OPEN_OBJECTS, type OpenObjectSpec } from "./scenarioObjects.js";
import { resourceIdForProperty, type OpenWorld } from "./world.js";
import type { ObjectPerception } from "./referee.js";
import type { OpenPrincipalContext } from "./mind.js";
import type { Principal } from "../ledger/beliefs.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE, PRISONER_NAME, WARDEN_NAME, prisonerStakes, wardenStakes } from "../scenario.js";

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

/** OPEN-VARIANT.md §15.1: the objects some other object is held in. */
const CONTAINERS: ReadonlySet<string> = new Set(OPEN_OBJECTS.flatMap((spec) => (spec.heldIn ? [spec.heldIn] : [])));

/**
 * OPEN-VARIANT.md §55 (issue #22, gaps 1 and 2): whether presence is
 * modelled at all. `off` (the default, and every batch recorded before this
 * gap existed) keeps `computePerceivedObjects`/`buildOpenBriefing` exactly
 * as they were -- both principals always share the cell, and the other
 * principal is never itself a perceivable target. `modelled` reads each
 * character's own `location_id` (already written by `world/setup.ts` at
 * creation and by `OPEN_LEAVE` on every move, entirely unchanged by this
 * gap) and gates perception and interpersonal targeting on it. One arm for
 * both gaps, not two (this task's own call, argued in OPEN-VARIANT.md §55):
 * gap 2's target availability is naturally presence-gated by the same
 * "share a location" predicate gap 1 introduces, and a second switch whose
 * "on" state is meaningless without gap 1's own "on" state is not a real
 * choice worth its own flag.
 */
export type PresenceMode = "off" | "modelled";

export function readPresenceMode(raw: string | undefined): PresenceMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "modelled") return raw;
  throw new Error(`PRISONER_PRESENCE: unrecognised value ${JSON.stringify(raw)} -- must be "modelled" or "off" (the default)`);
}

/** Where a principal currently is -- the cell by default (before anything
 *  has ever moved it, `readFactValue` returns `null`, and the cell is where
 *  every principal starts, `world/setup.ts:71-72`), never a guessed
 *  location once something has. */
export function principalLocation(openWorld: OpenWorld, principal: Principal, t: number): string {
  const characterId = principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId;
  return readFactValue({ gameId: openWorld.base.gameId, t, entityId: characterId, key: "location_id" }) ?? openWorld.base.cellId;
}

/** OPEN-VARIANT.md §55, gap 2: a principal's own presence, as the OTHER
 *  principal can perceive and cite it once they share a location --
 *  third-person, because scenario.ts's PRISONER_IDENTITY/WARDEN_IDENTITY
 *  are first/second-person self-descriptions fed to each mind's OWN prompt
 *  (SOCIAL-INTENTS.md's own finding), never a description the OTHER
 *  principal's referee call can cite against. Declares no numeric property
 *  on purpose (issue #22's third gap, out of scope here): this grounds only
 *  what any perceivable person supports generically -- being seen, heard,
 *  spoken to, or touched -- never a game-specific state. */
const PRINCIPAL_DESCRIPTION: Record<Principal, string> = {
  prisoner: `${PRISONER_NAME}, the prisoner. She can be seen, heard, spoken to, or touched by anyone who shares this room with her.`,
  warden: `${WARDEN_NAME}, the warden. She can be seen, heard, spoken to, or touched by anyone who shares this room with her.`,
};

function concealmentAt(openWorld: OpenWorld, objectId: string, t: number): number | null | undefined {
  const resourceId = resourceIdForProperty(openWorld, objectId, "concealment");
  if (!resourceId) return undefined; // Not concealable at all.
  return readNumericFact({ gameId: openWorld.base.gameId, t, entityId: resourceId, key: "value" });
}

/** OPEN-VARIANT.md §33.8: the authored description, then the reading of every
 *  property whose current value declares one (`OpenObjectProperty.reads`). */
function describedAsItStands(openWorld: OpenWorld, spec: OpenObjectSpec, t: number): string {
  const readings = spec.properties.flatMap((property) => {
    if (!property.reads) return [];
    const resourceId = resourceIdForProperty(openWorld, spec.id, property.key);
    const value = resourceId ? readNumericFact({ gameId: openWorld.base.gameId, t, entityId: resourceId, key: "value" }) : null;
    const reading = value === null ? undefined : property.reads[value];
    return reading ? [reading] : [];
  });
  return [spec.description, ...readings].join(" ");
}

export function computePerceivedObjects(openWorld: OpenWorld, principal: Principal, t: number, presenceMode: PresenceMode = "off"): ObjectPerception[] {
  // The §4.1 objects, then every object derived in this game (OPEN-VARIANT.md
  // §13.3), under one rule: the holder always perceives its own things; the
  // other principal does unless the thing is concealed at 50 or more.
  //
  // CONTAINMENT FIRST (§15.1): a thing held in another is perceived by nobody,
  // its holder and both principals alike, while the container's concealment
  // stands at 50 or more -- and a missing reading keeps it hidden rather than
  // inventing a view. A CONTAINER'S concealment is what hides its contents,
  // not the container: the tile down at 100 is still a tile anyone can see
  // and lift (§15.2 grounds `expose` on the tile's own description), exactly
  // as the closed variant's loose tile "stays visible in either view
  // regardless of CONCEAL" (`src/view/viewFor.ts`).
  const candidates = [
    ...OPEN_OBJECTS.map((spec) => ({ id: spec.id, description: describedAsItStands(openWorld, spec, t), owner: OWNER_OF[spec.id], heldIn: spec.heldIn })),
    ...openWorld.derived.map((d) => ({ id: d.id, description: d.description, owner: d.heldBy as Principal | undefined, heldIn: undefined })),
  ];
  const objects = candidates
    .filter((object) => {
      if (object.heldIn !== undefined) {
        const container = concealmentAt(openWorld, object.heldIn, t);
        if (container === undefined || container === null || container >= 50) return false;
      }
      if (object.owner === principal) return true;
      // OPEN-VARIANT.md §55 (issue #22 gap 1): a cell-fixed object (no
      // owner) is where the cell is; an object owned by a principal travels
      // with them (`OWNER_OF`, `derived.heldBy` -- the same map gap 2's
      // reported-speech routing and the belief store's own channel (a)
      // already key on). The owner already returned above regardless of
      // location ("the holder always perceives its own things"); this gate
      // is for the OTHER principal only.
      if (presenceMode === "modelled") {
        const objectLocation = object.owner ? principalLocation(openWorld, object.owner, t) : openWorld.base.cellId;
        if (principalLocation(openWorld, principal, t) !== objectLocation) return false;
      }
      if (CONTAINERS.has(object.id)) return true;
      const value = concealmentAt(openWorld, object.id, t);
      return value === undefined || value === null || value < 50;
    })
    .map((object) => ({ id: object.id, description: object.description }));

  // OPEN-VARIANT.md §55, gap 2: the OTHER principal, perceivable exactly
  // when presence says they are here -- never itself (a principal is not
  // its own target).
  if (presenceMode === "modelled") {
    const other: Principal = principal === "prisoner" ? "warden" : "prisoner";
    if (principalLocation(openWorld, principal, t) === principalLocation(openWorld, other, t)) {
      objects.push({ id: other, description: PRINCIPAL_DESCRIPTION[other] });
    }
  }
  return objects;
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
  /** This principal's own plan from its last turn that had one (OPEN-VARIANT.md §22). */
  readonly plan?: string;
};

/** Every resource name a belief can be held about in the open world: the
 *  scenario's declared properties. A line renders only where THIS principal
 *  holds a belief. `guard_attention` is still seeded (the shared
 *  `seedInitialBeliefs`) but never rendered: nothing in the open variant
 *  reads it (§12), and shown, minds planned around it (OPEN-VARIANT.md §33.9). */
function beliefResourceNames(openWorld: OpenWorld): string[] {
  const names = OPEN_OBJECTS.flatMap((spec) => spec.properties.map((p) => p.resourceName));
  const derived = openWorld.derived.flatMap((d) => d.properties.map((p) => p.resourceName));
  return [...new Set([...names, ...derived])];
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
  news: OpenNews = {},
  presenceMode: PresenceMode = "off"
): string {
  const gameId = openWorld.base.gameId;
  const lines: string[] = [];
  lines.push(`Round ${roundN} of ${totalRounds}.`);
  if (news.ownOutcome) lines.push(news.ownOutcome);
  for (const perceived of news.fromOther ?? []) lines.push(perceived);
  lines.push(principal === "prisoner" ? prisonerStakes(totalRounds) : wardenStakes(totalRounds));
  for (const line of news.standing ?? []) lines.push(line);

  // OPEN-VARIANT.md §55 (issue #22 gap 1): "the warden being elsewhere is a
  // state that can change and that both sides can reason about" -- a rule
  // known to both, parallel to the closed variant's own WARDEN_PRESENCE_RULE
  // (`world/mechanics.ts`), rendered here because it never changes.
  if (presenceMode === "modelled") {
    const other: Principal = principal === "prisoner" ? "warden" : "prisoner";
    const otherName = other === "prisoner" ? PRISONER_NAME : WARDEN_NAME;
    const together = principalLocation(openWorld, principal, t) === principalLocation(openWorld, other, t);
    lines.push(together ? `${otherName} is here with you.` : `${otherName} is not here right now.`);
  }

  const notes = getNotes(gameId, principal);
  if (notes) lines.push(`Your notes from last round: ${notes}`);
  if (news.plan) lines.push(`Your plan, from your last turn: ${news.plan}`);

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

  // issue #15: the per-object "You perceive the <id>: <description>" lines
  // used to be built here, and mind.ts's `objectLines` (inside the exported
  // `renderSeatSituation`) built the SAME sentence, from the SAME array,
  // right below it -- the identical prose, twice, in front of every
  // decision. `renderSeatSituation` is the one place that renders
  // perceivedObjects now: it is the copy the referee is handed as
  // `perceivedObjects` for this half-round, and the one the human-seat test
  // pins byte-for-byte against the model prompt, so it is the copy that
  // stays. Nothing here computed a fact that lived ONLY in this loop --
  // `describedAsItStands` (state readings included) is the same function
  // `computePerceivedObjects` already calls for `perceivedObjects` below, so
  // no fact is lost, only the second rendering of it.

  return lines.join("\n");
}

export function buildOpenContext(
  openWorld: OpenWorld,
  principal: Principal,
  t: number,
  roundN: number,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS,
  news: OpenNews = {},
  presenceMode: PresenceMode = "off"
): OpenPrincipalContext {
  const principalId = principal === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId;
  return {
    principalId,
    identity: principal === "prisoner" ? PRISONER_IDENTITY : WARDEN_IDENTITY,
    motive: principal === "prisoner" ? PRISONER_MOTIVE : WARDEN_MOTIVE,
    briefing: buildOpenBriefing(openWorld, principal, t, roundN, totalRounds, news, presenceMode),
    perceivedObjects: computePerceivedObjects(openWorld, principal, t, presenceMode),
  };
}
