import { readNumericFact, readFactValue, factReaderAt } from "../world/facts.js";
import { getBelief, renderBeliefLine } from "../ledger/beliefs.js";
import { SEARCH_SUSPICION_THRESHOLD } from "../world/mechanics.js";
import { getNotes } from "../ledger/notes.js";
import { OPEN_PERSONS, OPEN_OBJECTS, PERSON_CONTAINERS, CONTAINMENT_HIDDEN_AT_OR_ABOVE, personContainerId, type OpenObjectSpec } from "./scenarioObjects.js";
import { resourceIdForProperty, type OpenWorld, type WindowMode } from "./world.js";
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
// docs/CUSTODY-DESIGN.md: AUTHORING ONLY -- who holds what when the game
// starts, as `world/setup.ts` and `world.ts` create it (a test pins the two
// equal). Nothing reads it to decide who holds a thing during play: custody
// changes an item's owner through `resolve()`, so every such read is
// `holderAt`/`ownershipAt` below, from the engine at t.
export const OWNER_OF: Partial<Record<string, Principal>> = { spoon: "prisoner", key_ring: "warden" };

/** Who holds an object at t, and where it lies when nobody does. */
export type Ownership = { readonly holder: Principal | null; readonly placeId: string | null };

/**
 * docs/CUSTODY-DESIGN.md: every read of who holds what, from the item's own
 * `owner_id`/`owner_type` at t -- the engine's columns, read the way presence
 * reads `location_id` (`principalLocation`), in ONE replay for however many
 * objects the caller asks about. A §4.1 object and one derived in this game
 * alike: both are items in `openWorld.entityIdFor`. An id with no item behind
 * it (a person, `none`) is held by nobody and lies nowhere.
 */
export function ownershipAt(openWorld: OpenWorld, t: number): (objectId: string) => Ownership {
  const fact = factReaderAt({ gameId: openWorld.base.gameId, t });
  return (objectId) => {
    const entityId = openWorld.entityIdFor[objectId];
    if (!entityId || objectId === "prisoner" || objectId === "warden") return { holder: null, placeId: null };
    const ownerId = fact(entityId, "owner_id");
    const ownerType = fact(entityId, "owner_type");
    if (ownerType === "character") {
      const holder: Principal | null = ownerId === openWorld.base.prisonerId ? "prisoner" : ownerId === openWorld.base.wardenId ? "warden" : null;
      return { holder, placeId: null };
    }
    return { holder: null, placeId: ownerType === "location" ? ownerId : null };
  };
}

/** Who holds one object at t (`ownershipAt`), or `null` for nobody. */
export function holderAt(openWorld: OpenWorld, objectId: string, t: number): Principal | null {
  return ownershipAt(openWorld, t)(objectId).holder;
}

/** OPEN-VARIANT.md §15.1: the objects some other object is held in --
 *  a STATIC object's own `heldIn` (the banknotes' loose_tile) plus, D9
 *  (§6.2, OPEN-VARIANT.md §76.1), the objects a PERSON can be held in
 *  DYNAMICALLY (`PERSON_CONTAINERS`: the blanket, the cot). Either way, a
 *  container's own concealment hides what it holds, never the container
 *  itself -- without this set, a covered blanket would vanish along with
 *  whoever is under it, which §15.1 already forbids for the loose tile. */
const CONTAINERS: ReadonlySet<string> = new Set([...OPEN_OBJECTS.flatMap((spec) => (spec.heldIn ? [spec.heldIn] : [])), ...PERSON_CONTAINERS]);

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

/** OPEN-VARIANT.md §64.3, WORLD-ELABORATION-DESIGN.md §4.8: the welded-window
 *  arm's own text for the two objects it changes, copied verbatim from the
 *  prompt lab's own ground truth
 *  (`~/rpg/prisoner-prompt-lab/prisoner-prompt-r1-welded.txt`, diffed against
 *  `prisoner-prompt-r1-susp-hidden.txt`, the open control) -- this task's own
 *  brief: "match its substance, so the game arm and the measured finding are
 *  about the same room." Every other object keeps `OPEN_OBJECTS`'s own
 *  description, untouched. */
const WELDED_DESCRIPTION: Readonly<Record<string, string>> = {
  window: "A small window set high in the wall, barely a hand across. Its iron bars are set flush into the stone and welded at every crossing.",
  bar: "An iron bar welded into the window's grid, set flush in sound stone. It does not move.",
};

/** The authored text an object actually carries under a given window arm
 *  (§64.3) -- `welded` swaps the window's and the bar's, every other object
 *  keeps `OPEN_OBJECTS`'s own. Exported because the TRANSCRIPT header needs
 *  the same answer the minds get: `checkpoint.ts` used to print `OPEN_OBJECTS`
 *  straight, so a welded run's "Objects as authored" section described the
 *  open room the game never played, while all 120 perception lines below it
 *  described the welded one. The descriptions a reader checks a citation
 *  against must be the ones that were cited.  */
export function authoredDescription(spec: OpenObjectSpec, windowMode: WindowMode): string {
  return windowMode === "welded" && spec.id in WELDED_DESCRIPTION ? WELDED_DESCRIPTION[spec.id] : spec.description;
}

function concealmentAt(openWorld: OpenWorld, objectId: string, t: number): number | null | undefined {
  const resourceId = resourceIdForProperty(openWorld, objectId, "concealment");
  if (!resourceId) return undefined; // Not concealable at all.
  return readNumericFact({ gameId: openWorld.base.gameId, t, entityId: resourceId, key: "value" });
}

/** D9 (HUMAN-INTENTS-DESIGN.md §6.2, OPEN-VARIANT.md §76.1): which
 *  `PERSON_CONTAINERS` member, if any, this principal is currently held in
 *  -- dynamic, read from her own resource (`world.ts`'s `personHeldIn`),
 *  never authored the way an object's own `heldIn` is. `undefined` with the
 *  presence arm off (no such resource exists) or when the value is 0
 *  ("not contained"). */
function personContainerAt(openWorld: OpenWorld, principal: Principal, t: number): string | undefined {
  const resourceId = openWorld.personHeldIn[principal];
  if (!resourceId) return undefined;
  const value = readNumericFact({ gameId: openWorld.base.gameId, t, entityId: resourceId, key: "value" });
  return value ? personContainerId(value) : undefined;
}

/** OPEN-VARIANT.md §33.8: the authored description, then the reading of every
 *  property whose current value declares one (`OpenObjectProperty.reads`).
 *  WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: a property acquired this
 *  game (`openWorld.acquired`) reads exactly like a §4.1 one -- "a resource
 *  is a resource" -- so it is simply appended to the static list before the
 *  same fold runs; nothing below this line needed to change. */
function describedAsItStands(openWorld: OpenWorld, spec: OpenObjectSpec, t: number): string {
  const acquiredProperties = openWorld.acquired.filter((a) => a.objectId === spec.id).map((a) => a.property);
  const properties = [...spec.properties, ...acquiredProperties];
  const readings = properties.flatMap((property) => {
    if (!property.reads && !property.readRanges) return [];
    const resourceId = resourceIdForProperty(openWorld, spec.id, property.key);
    const value = resourceId ? readNumericFact({ gameId: openWorld.base.gameId, t, entityId: resourceId, key: "value" }) : null;
    if (value === null) return [];
    // An exact reading is the more specific statement, so it wins; otherwise
    // the first band the value falls in (§56, issue #22 gap 3).
    const exact = property.reads?.[value];
    if (exact) return [exact];
    const band = property.readRanges?.find((range) => value <= range.atOrBelow);
    return band ? [band.text] : [];
  });
  // §64.3: welded swaps the window's and bar's own authored text; every
  // other object's stays `OPEN_OBJECTS`'s own. The bar's `integrity` reading
  // never fires either way -- `windowMode === "welded"` means `buildOpenWorld`
  // never created a resource for it, so `readings` above already found none.
  return [authoredDescription(spec, openWorld.windowMode), ...readings].join(" ");
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
  //
  // WHO HOLDS IT IS READ AT t (docs/CUSTODY-DESIGN.md): `take`/`give` change an
  // item's owner through `resolve()`, so the holder -- and, for a thing nobody
  // holds, where it lies -- comes from the engine (`ownershipAt`), never from
  // `OWNER_OF` or a derived object's record of who made it. A container hides
  // only what still lies in it: a thing someone has taken out is held, not
  // contained, whatever `heldIn` its authoring names.
  const ownership = ownershipAt(openWorld, t);
  const candidates = [
    ...OPEN_OBJECTS.map((spec) => ({ id: spec.id, description: describedAsItStands(openWorld, spec, t), ...ownership(spec.id), heldIn: spec.heldIn })),
    ...openWorld.derived.map((d) => ({ id: d.id, description: d.description, ...ownership(d.id), heldIn: undefined })),
  ].map(({ holder, ...rest }) => ({ ...rest, owner: holder ?? undefined, heldIn: holder === null ? rest.heldIn : undefined }));
  const objects = candidates
    .filter((object) => {
      if (object.heldIn !== undefined) {
        const container = concealmentAt(openWorld, object.heldIn, t);
        if (container === undefined || container === null || container >= 50) return false;
      }
      if (object.owner === principal) return true;
      // OPEN-VARIANT.md §55 (issue #22 gap 1): an object nobody holds is
      // where it lies (the cell, for every object as authored); an object
      // held by a principal travels with them -- its holder at t, read from
      // the engine above. The owner already returned above regardless of
      // location ("the holder always perceives its own things"); this gate
      // is for the OTHER principal only.
      if (presenceMode === "modelled") {
        const objectLocation = object.owner ? principalLocation(openWorld, object.owner, t) : (object.placeId ?? openWorld.base.cellId);
        if (principalLocation(openWorld, principal, t) !== objectLocation) return false;
      }
      if (CONTAINERS.has(object.id)) return true;
      const value = concealmentAt(openWorld, object.id, t);
      return value === undefined || value === null || value < 50;
    })
    .map((object) => ({ id: object.id, description: object.description }));

  // OPEN-VARIANT.md §55, gap 2: the OTHER principal, perceivable exactly
  // when presence says they are here -- and, issue #22 gap 3, the actor
  // HERSELF, who needs no location test because she is always where she is.
  //
  // This used to read "never itself (a principal is not its own target)",
  // against `docs/issues/SOCIAL-INTENTS.md`'s own explicit ask ("targeting the
  // ACTOR's own newly-target-able self") and with no decision recorded for the
  // divergence. `checkpoints/2026-09-19-selftarget/` measured what it cost: a
  // human in the seat typed "pretend to have a heart attack" and was told it
  // "matches none of what is here", because her own body -- whose `posture` is
  // declared 0-100 with `wear` magnitudes -- was the one thing in the room she
  // could not act on. A body is a thing that can be acted on; that is all this
  // is.
  if (presenceMode === "modelled") {
    const other: Principal = principal === "prisoner" ? "warden" : "prisoner";
    // Issue #22 gap 3: a person carries its own declared state, so the
    // description a principal perceives -- and the referee cites -- reads it
    // the same way an object's does ("She is lying on the floor").
    const perceive = (who: Principal): void => {
      const spec = OPEN_PERSONS.find((p) => p.id === who);
      objects.push({ id: who, description: spec ? describedAsItStands(openWorld, spec, t) : PRINCIPAL_DESCRIPTION[who] });
    };
    // D9 (HUMAN-INTENTS-DESIGN.md §6.2, OPEN-VARIANT.md §76.1): the OTHER
    // principal's own view drops her when her own containment resource
    // names a container whose concealment has reached the hidden line --
    // never the actor's own view of herself (presence untouched, §55:
    // hidden is not absent, and she perceives her own situation always).
    if (principalLocation(openWorld, principal, t) === principalLocation(openWorld, other, t)) {
      const containerId = personContainerAt(openWorld, other, t);
      const hiddenFromOther = containerId !== undefined && (concealmentAt(openWorld, containerId, t) ?? 0) >= CONTAINMENT_HIDDEN_AT_OR_ABOVE;
      if (!hiddenFromOther) perceive(other);
    }
    perceive(principal);
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
  /** docs/STRATEGY-DESIGN.md D5: the ONE line a strategy reaches the turn through, chosen before round 1
   *  and unchanged for the whole game. Absent under `PRISONER_STRATEGY` unset, which is what makes every
   *  batch recorded before this field byte-identical -- see `__tests__/strategy.test.ts`'s first guard.
   *  Read cost, never fill cost: no field is added to any proposal and the seat still asks one question. */
  readonly strategy?: string;
};

/** Every resource name a belief can be held about in the open world: the
 *  scenario's declared properties. A line renders only where THIS principal
 *  holds a belief. `guard_attention` is still seeded (the shared
 *  `seedInitialBeliefs`) but never rendered: nothing in the open variant
 *  reads it (§12), and shown, minds planned around it (OPEN-VARIANT.md §33.9). */
function beliefResourceNames(openWorld: OpenWorld): string[] {
  // §64.3: a property with no built resource (the bar's own `integrity`,
  // under the welded arm) is never a belief line either -- the same
  // resource-presence gate `declaredPropertyKeys` (`world.ts`) uses, so this
  // module never needs its own second notion of "declared".
  const names = OPEN_OBJECTS.flatMap((spec) => spec.properties.filter((p) => resourceIdForProperty(openWorld, spec.id, p.key) !== undefined).map((p) => p.resourceName));
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
  if (news.strategy) lines.push(`Your strategy for this game: ${news.strategy}`);
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
  const perceivedObjects = computePerceivedObjects(openWorld, principal, t, presenceMode);
  // docs/CUSTODY-DESIGN.md: what she holds at t, from the engine, for the
  // seat's `holding` line -- among what she perceives, which every holder does.
  const ownership = ownershipAt(openWorld, t);
  return {
    principalId,
    identity: principal === "prisoner" ? PRISONER_IDENTITY : WARDEN_IDENTITY,
    motive: principal === "prisoner" ? PRISONER_MOTIVE : WARDEN_MOTIVE,
    briefing: buildOpenBriefing(openWorld, principal, t, roundN, totalRounds, news, presenceMode),
    perceivedObjects,
    holding: perceivedObjects.filter((o) => ownership(o.id).holder === principal).map((o) => o.id),
  };
}
