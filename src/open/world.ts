import { createItem, createLocation, createResource, declareBoundedConstraint, declareResolveOnlyConstraint, type Outcome } from "run-dmcp";
import { buildWorld, type World } from "../world/setup.js";
import { OPEN_OBJECTS, findProperty, type OpenObjectSpec, type OpenObjectProperty, type OpenPropertyKey, OPEN_PERSONS } from "./scenarioObjects.js";
import { findKind } from "./derivedObjects.js";
import { ELABORABLE_EXITS } from "./acquirableProperties.js";
import type { Principal } from "../ledger/beliefs.js";

/**
 * The open variant's world (OPEN-VARIANT.md §1: "Everything the closed
 * variant built stays... Only the action layer changes"). `base` is the
 * UNCHANGED closed-variant `World` (`buildWorld()`, `src/world/setup.ts`) --
 * same game, same cell, same two characters, same half-round clock, same
 * five resources -- so the bar/lock/spoon resource ids below are literally
 * the same entities the closed variant's own mechanics read and write.
 *
 * On top of that, this module creates one `run-dmcp` item per §4.1 object
 * that the closed variant did not already create (`window`, `door`, `lock`, `cot`, `blanket`,
 * `bucket`, `meal_tray`, `key_ring` -- `bar`, `spoon` and `loose_tile`
 * already exist on `base`), and one bounded/`resolve_only` resource per
 * declared property (`scenarioObjects.ts`) that the closed variant did not
 * already create (`spoon_concealment`, `cot_wire_integrity`,
 * `blanket_thread_integrity` -- `bar_integrity`/`lock_integrity`/
 * `spoon_edge` are reused from `base.resources` by name, never recreated).
 */
export interface OpenWorld {
  base: World;
  /** §4.1 object id -> the `run-dmcp` entity id the referee may target. */
  entityIdFor: Record<string, string>;
  /** `<objectId>.<propertyKey>` -> the resource id `resolve()` writes to. */
  resourceIdFor: Record<string, string>;
  /** The inverse of `resourceIdFor`'s VALUES -> the scenario's own
   *  `resourceName` (`scenarioObjects.ts`, e.g. `"bar_integrity"`) -- the
   *  string `src/ledger/beliefs.ts`'s generic `setBelief`/`getBelief` key
   *  belief entries on, so `loop.ts` can update belief for whichever
   *  resource an open-mode effect just touched without a second, redeclared
   *  mapping. */
  resourceNameById: Record<string, string>;
  /** OPEN-VARIANT.md §12, §17.2: the cell's ways out, keyed by the way-out
   *  object itself (`door`, `window`), each naming its part (`lock`, `bar`). */
  exits: Readonly<Record<string, OpenExit>>;
  /** OPEN-VARIANT.md §13: every object made during this game, in order.
   *  Registered by `adoptDerivedObject` from a derive's own outcome. */
  derived: DerivedObjectRecord[];
  /** OPEN-VARIANT.md §14.2: every derived object a reshaping destroyed, in
   *  order. Kept out of `derived` so it leaves every briefing and every
   *  referee request, and kept at all so its id is never handed out again. */
  destroyed: DerivedObjectRecord[];
  /** WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: every property acquired
   *  this game onto an EXISTING §4.1 or derived object (never a whole new
   *  object -- that is Tier 2, not built here). Registered by
   *  `adoptAcquiredProperty` from an `OPEN_ACQUIRE` resolution's own
   *  outcome. */
  acquired: AcquiredPropertyRecord[];
  /** §4.3's `ELABORABLE_EXITS`: the locations that table names by string
   *  (`"corridor"`), resolved once at build time so no location id is
   *  content -- `buildOpenWorld` creates them the same way it always has;
   *  `adoptAcquiredProperty` only looks the id up here. */
  namedLocations: Readonly<Record<string, string>>;
  /** OPEN-VARIANT.md §64.3, WORLD-ELABORATION-DESIGN.md §4.8. `"open"` (the
   *  default): unchanged. `"welded"`: the bar declares no property at all
   *  (§64.3's "its integrity belief removed, and its condition removed"),
   *  so `declaredProperty`/`declaredPropertyKeys` below never offer it and
   *  the window is never built as an exit (see `buildOpenWorld`). Read
   *  directly off the world by `briefing.ts` (welded description text,
   *  belief line suppression) -- never threaded as a second parameter next
   *  to `openWorld`, since every caller that needs it already has one. */
  windowMode: WindowMode;
}

/** One property acquired onto an existing object (WORLD-ELABORATION-DESIGN.md
 *  §4.4): which object, and the property itself -- shaped exactly like any
 *  §4.1 property (`OpenObjectProperty`), so it is perceived, targeted and
 *  believed about like one (`declaredProperty`/`declaredPropertyKeys` below,
 *  `briefing.ts`'s `describedAsItStands`). */
export interface AcquiredPropertyRecord {
  objectId: string;
  property: OpenObjectProperty;
}

/** One derived object (OPEN-VARIANT.md §13.3): an object like any other --
 *  id, holder, composed description, declared properties -- known to the
 *  world from the resolution that created it. */
export interface DerivedObjectRecord {
  id: string;
  kindId: string;
  /** Who held it when it was made. docs/CUSTODY-DESIGN.md: it can change
   *  hands afterwards, so who holds it NOW is the item's own owner, read from
   *  the engine at t (`briefing.ts`'s `holderAt`), never this field. */
  heldBy: Principal;
  description: string;
  entityId: string;
  properties: readonly OpenObjectProperty[];
}

export interface OpenExit {
  /** The object whose `integrity` is §12's other way through (§17.2). */
  part: string;
  /** The way out's own `passage`: 0 shut, 1 open. `null` for an
   *  ELABORABLE_EXITS route (§4.3): a dug or forced way has no explicit
   *  "open" step of its own -- `OPEN_LEAVE` (`mechanics.ts`) treats a
   *  `null` passage as never 1, so only the part's own integrity governs. */
  passageResourceId: string | null;
  /** The part's integrity: spent (0) also makes the exit passable. */
  integrityResourceId: string;
  /** The location a principal who leaves through this exit is in. */
  destinationId: string;
  /** OPEN-VARIANT.md §24: the part's integrity at or below which `open` can
   *  make this way out passable; `null` when nothing but the way out's own
   *  description gates it. */
  openWhenPartAtMost: number | null;
}

/** OPEN-VARIANT.md §24: the window opens only once its bar is worn to this
 *  line. Until §33.5 it was the catch's own line, by definition. */
export const OPEN_WINDOW_BAR_MAX = 50;

/** OPEN-VARIANT.md §33.5 (owner's decision): a warden's close look catches on
 *  the bar only at or below this. He is outside the cell, so damage has to be
 *  worse before he can see it than before she can pull the bar free -- which
 *  leaves the prisoner a margin between the window opening and being caught.
 *  The closed variant's `SEARCH_CATCH_BAR_MAX` is untouched. */
export const OPEN_CATCH_BAR_MAX = 30;

/**
 * OPEN-VARIANT.md §50 (issue #19): the door's own gate under
 * `PRISONER_DOOR_PRICE=threshold`, on the lock exactly as `OPEN_WINDOW_BAR_MAX`
 * gates the window on the bar. Chosen so the two routes cost the same: at
 * `lock.wear.moderate` (20/turn, `scenarioObjects.ts`) the lock crosses this
 * line on the 4th wear turn (100, 80, 60, 40, 20), the same 4 wear turns the
 * bar needs at its own `wear.moderate` (15/turn) to cross `OPEN_WINDOW_BAR_MAX`
 * (100, 85, 70, 55, 40) -- landing 10 below its own line (40 vs. <=50) exactly
 * as this landing is 10 below its (20 vs. <=30). Both routes are then one
 * further `open` turn, so both cost 5 prisoner turns and, at
 * `SUSPICION_BUMP_FOR_MAGNITUDE.moderate` (10, `loop.ts`) charged on every
 * wear turn and the open turn alike, both cost 50 suspicion. §50 shows the
 * full arithmetic, including why the range of thresholds that ties the turn
 * count (20-39) is wider than this one deliberate pick.
 */
export const OPEN_DOOR_LOCK_MAX = 30;

/**
 * §50.5, chosen from the measured failure of `OPEN_DOOR_LOCK_MAX` rather than
 * from arithmetic about turns. `threshold`'s 30 made the two routes cost the
 * same on paper -- 5 prisoner turns and 50 suspicion each -- and killed the
 * door in play: across four games under that arm the referee ruled not one
 * prisoner intent against the door or the lock. The reason is a property the
 * turn arithmetic cannot see. The lock wears 20 at a time (100, 80, 60, 40,
 * 20), `SEARCH_CATCH_LOCK_MAX` catches her at 40 or below, so every step at or
 * below a gate of 30 -- and at or below one of 50, since 40 is the first step
 * under it -- is a step she can be caught at. To use the door she had to pass
 * through the catch band, which the window never asks of her: the bar's own
 * steps put 40 at or below `OPEN_WINDOW_BAR_MAX` while still above
 * `OPEN_CATCH_BAR_MAX`. She read her conditions correctly and declined.
 *
 * 60 is the lowest candidate that gives the door the window's SHAPE: the lock
 * at 60 is openable and still safe to be found at, two wear turns in. The door
 * stays cheaper than the window (3 turns and 30 suspicion against 5 and 50) --
 * this is not parity, and pretending otherwise was the mistake the first arm
 * made. What it buys is the first room where both ways out are worth starting,
 * which is the precondition `mother-of-invention`'s thesis has never had.
 */
export const OPEN_DOOR_LOCK_MARGIN = 60;

function propertyToken(objectId: string, propertyKey: string): string {
  return `${objectId}.${propertyKey}`;
}

/**
 * OPEN-VARIANT.md §64.3, WORLD-ELABORATION-DESIGN.md §4.8: the welded-window
 * arm -- reproducing §64.3's measured room as closely as the real game
 * allows. Ground truth: `~/rpg/prisoner-prompt-lab/prisoner-prompt-r1-welded.txt`,
 * diffed against `prisoner-prompt-r1-susp-hidden.txt` (§64.3's open control).
 * "Bars flush and welded, the bar immovable, its integrity belief removed,
 * and its condition removed -- everything else untouched": `"welded"` never
 * creates a resource for the bar's own `integrity` property at all (see
 * `buildOpenWorld`), so nothing can wear it, reveal it, or gate the window's
 * passage on it, and the window is never built as an exit -- the door stays
 * the one working way out.
 */
export type WindowMode = "open" | "welded";

/** `open` unless asked otherwise: every batch recorded before this arm
 *  played by a bar that wears down and a window gated on it. Anything else
 *  stops the run rather than guessing. */
export function readWindowMode(raw: string | undefined): WindowMode {
  if (raw === undefined || raw === "") return "open";
  if (raw === "open" || raw === "welded") return raw;
  throw new Error(`PRISONER_WINDOW: unrecognised value ${JSON.stringify(raw)} -- must be "welded" or "open" (the default)`);
}

export type DoorPriceMode = "free" | "threshold" | "margin";

/** `free` unless asked otherwise: the door's passage has no threshold to
 *  meet, today's behaviour, unchanged -- every batch recorded before this
 *  arm (issue #19) stays the comparison it was, the D3 lesson (§40.1)
 *  applied here before the fact. `threshold` gates it on `OPEN_DOOR_LOCK_MAX`,
 *  exactly mirroring the window's own gate on the bar. Anything else stops
 *  the run rather than guessing. */
export function readDoorPrice(raw: string | undefined): DoorPriceMode {
  if (raw === undefined || raw === "") return "free";
  if (raw === "free" || raw === "threshold" || raw === "margin") return raw;
  throw new Error(`PRISONER_DOOR_PRICE: unrecognised value ${JSON.stringify(raw)} -- must be "threshold", "margin" or "free" (the default)`);
}

/** The lock value the door's passage is gated on, per arm: none under `free`
 *  (every batch before §50), `OPEN_DOOR_LOCK_MAX` under `threshold`,
 *  `OPEN_DOOR_LOCK_MARGIN` under `margin` (§50.5). */
function doorGate(mode: DoorPriceMode | undefined): number | null {
  if (mode === "threshold") return OPEN_DOOR_LOCK_MAX;
  if (mode === "margin") return OPEN_DOOR_LOCK_MARGIN;
  return null;
}

export function buildOpenWorld(options: { doorPrice?: DoorPriceMode; presence?: "off" | "modelled"; window?: WindowMode } = {}): OpenWorld {
  const base = buildWorld();
  const gameId = base.gameId;
  const windowMode = options.window ?? "open";

  const entityIdFor: Record<string, string> = {
    bar: base.barId,
    spoon: base.spoonId,
    loose_tile: base.looseTileId,
  };
  const resourceIdFor: Record<string, string> = {
    // §64.3: welded, the bar's own integrity is never a resource at all --
    // no belief, no wear, no reveal, no exit gate. The closed variant's own
    // `barIntegrity` resource still exists underneath (`buildWorld()` always
    // creates it), simply never exposed here.
    ...(windowMode === "welded" ? {} : { [propertyToken("bar", "integrity")]: base.resources.barIntegrity }),
    // The lock too: `gameEnd.ts`'s escape check reads `base.resources.
    // lockIntegrity`, so a second `lock_integrity` resource here would be
    // one no escape could ever read.
    [propertyToken("lock", "integrity")]: base.resources.lockIntegrity,
    [propertyToken("spoon", "edge")]: base.resources.spoonEdge,
  };
  const resourceNameById: Record<string, string> = {
    ...(windowMode === "welded" ? {} : { [base.resources.barIntegrity]: "bar_integrity" }),
    [base.resources.lockIntegrity]: "lock_integrity",
    [base.resources.spoonEdge]: "spoon_edge",
  };

  function boundedResolveOnly(ownerId: string, name: string, value: number, min: number, max: number): string {
    const resource = createResource({ gameId, ownerType: "location", ownerId, name, value, minValue: min, maxValue: max });
    declareBoundedConstraint({ gameId, resourceId: resource.id });
    declareResolveOnlyConstraint({ gameId, resourceId: resource.id });
    return resource.id;
  }

  function ensureItem(spec: OpenObjectSpec, ownerId: string, name: string): string {
    if (entityIdFor[spec.id]) return entityIdFor[spec.id];
    const item = createItem({ gameId, ownerId, ownerType: "location", name });
    entityIdFor[spec.id] = item.id;
    return item.id;
  }

  for (const spec of OPEN_OBJECTS) {
    if (spec.id === "key_ring") {
      // Owned by the warden, not the cell -- it lives on Croft's belt
      // (§4.1). `ownerType: "character"` matches how `world/setup.ts`
      // already owns the prisoner's own spoon.
      if (!entityIdFor[spec.id]) {
        const item = createItem({ gameId, ownerId: base.wardenId, ownerType: "character", name: "the key ring" });
        entityIdFor[spec.id] = item.id;
      }
    } else if (spec.id === "spoon") {
      // Already created by `buildWorld()`, owned by the prisoner.
    } else {
      ensureItem(spec, base.cellId, `the ${spec.id.replace(/_/g, " ")}`);
    }

    for (const property of spec.properties) {
      // §64.3: the one property this arm removes -- skipped here, not just
      // left unset above, so a welded bar never gets a fresh resource
      // created for it either.
      if (windowMode === "welded" && spec.id === "bar" && property.key === "integrity") continue;
      const token = propertyToken(spec.id, property.key);
      if (!resourceIdFor[token]) {
        resourceIdFor[token] = boundedResolveOnly(base.cellId, property.resourceName, property.initialValue, property.min, property.max);
      }
      resourceNameById[resourceIdFor[token]] = property.resourceName;
    }
  }

  // Issue #22 gap 3 (D5): each principal's own declared state, created only
  // under the presence arm -- with it off, no person resource exists at all and
  // every batch recorded before this gap is byte-identical. Owned by the
  // CHARACTER, which `run-dmcp`'s own `createResource` has always supported
  // (`ownerType: "character"`), so nothing entered the engine for this.
  if (options.presence === "modelled") {
    for (const spec of OPEN_PERSONS) {
      const characterId = spec.id === "prisoner" ? base.prisonerId : base.wardenId;
      entityIdFor[spec.id] = characterId;
      for (const property of spec.properties) {
        const token = propertyToken(spec.id, property.key);
        if (!resourceIdFor[token]) {
          const resource = createResource({ gameId, ownerType: "character", ownerId: characterId, name: property.resourceName, value: property.initialValue, minValue: property.min, maxValue: property.max });
          declareBoundedConstraint({ gameId, resourceId: resource.id });
          declareResolveOnlyConstraint({ gameId, resourceId: resource.id });
          resourceIdFor[token] = resource.id;
        }
        resourceNameById[resourceIdFor[token]] = property.resourceName;
      }
    }
  }

  const corridor = createLocation({ gameId, name: "the corridor", description: "The corridor outside the cell door." });
  const outsideWindow = createLocation({ gameId, name: "outside the window", description: "Outside the cell's small window." });
  const exit = (wayOut: string, part: string, destinationId: string, openWhenPartAtMost: number | null): OpenExit => ({
    part,
    openWhenPartAtMost,
    passageResourceId: resourceIdFor[propertyToken(wayOut, "passage")],
    integrityResourceId: resourceIdFor[propertyToken(part, "integrity")],
    destinationId,
  });
  const exits: Record<string, OpenExit> = {
    // The door's own description grounds opening it: the bolt shows in the
    // gap. `free` (the default) keeps that true; `threshold` (issue #19,
    // §50) gates it on the lock like the window is gated on the bar.
    door: exit("door", "lock", corridor.id, doorGate(options.doorPrice)),
    // §64.3: welded, the window is never built as an exit at all -- the bar
    // has no integrity resource to gate it on, and no other route through it
    // is declared. `effects.ts`'s `open`/`leave` both already refuse an
    // intent against an object that names no exit ("no invented world"), so
    // omitting the entry is enough; nothing downstream needs a special case.
    ...(windowMode === "welded" ? {} : { window: exit("window", "bar", outsideWindow.id, OPEN_WINDOW_BAR_MAX) }),
  };

  return { base, entityIdFor, resourceIdFor, resourceNameById, exits, derived: [], destroyed: [], acquired: [], namedLocations: { corridor: corridor.id, outsideWindow: outsideWindow.id }, windowMode };
}

export function resourceIdForProperty(world: OpenWorld, objectId: string, propertyKey: string): string | undefined {
  return world.resourceIdFor[propertyToken(objectId, propertyKey)];
}

/** A property declared on a §4.1 object or on an object derived in this
 *  game (§13.3) -- the world-aware form of `findProperty`. */
export function declaredProperty(world: OpenWorld, objectId: string, key: string): OpenObjectProperty | undefined {
  const derived = world.derived.find((d) => d.id === objectId);
  if (derived) return derived.properties.find((p) => p.key === key);
  // WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: a property acquired this
  // game onto an EXISTING object -- checked before the static table, the
  // same order `derived` already takes priority in, so a later ordinary
  // wear/restore against it (§2: "Tier 1 makes acquirable facts actionable
  // on first contact") is planned exactly like any §4.1 property.
  const acquired = world.acquired.find((a) => a.objectId === objectId && a.property.key === key);
  if (acquired) return acquired.property;
  // A person's own property exists only where this world actually built it
  // (the presence arm), so `off` keeps answering exactly as it always did.
  const person = OPEN_PERSONS.find((p) => p.id === objectId);
  if (person) return resourceIdForProperty(world, objectId, key) ? person.properties.find((p) => p.key === key) : undefined;
  // §64.3: the same gate, generalised -- a §4.1 property is declared only
  // where this world actually built a resource for it. Every property but
  // the bar's own `integrity` under the welded arm always has one (`buildOpenWorld`
  // creates every declared property's resource unconditionally), so this is
  // a no-op everywhere else; it is what makes welded's dropped resource
  // (above) also a dropped property, with no second, redeclared check here.
  return resourceIdForProperty(world, objectId, key) ? findProperty(objectId, key as OpenPropertyKey) : undefined;
}

/** Every property key an object declares, derived in this game, acquired
 *  this game (§4.4), or §4.1 -- what the referee's property question lists
 *  per object (OPEN-VARIANT.md §24), and what `hasRoomToElaborate` (`loop.ts`)
 *  and `tryAcquire`'s own "never twice" guard (§2) both read. */
export function declaredPropertyKeys(world: OpenWorld, objectId: string): string[] {
  const derived = world.derived.find((d) => d.id === objectId);
  if (derived) return derived.properties.map((p) => p.key);
  const person = OPEN_PERSONS.find((p) => p.id === objectId);
  if (person) return resourceIdForProperty(world, objectId, person.properties[0].key) ? person.properties.map((p) => p.key) : [];
  // §64.3: the same resource-presence gate as `declaredProperty`, above.
  const staticKeys = (OPEN_OBJECTS.find((o) => o.id === objectId)?.properties ?? []).filter((p) => resourceIdForProperty(world, objectId, p.key) !== undefined).map((p) => p.key);
  const acquiredKeys = world.acquired.filter((a) => a.objectId === objectId).map((a) => a.property.key);
  return [...staticKeys, ...acquiredKeys];
}

/** The id the next derived object of `kindId` gets: the kind's name, then
 *  `<kind>_2`, `<kind>_3` (§13.3). */
export function nextDerivedId(world: OpenWorld, kindId: string): string {
  // Destroyed ones count: a belief or resource name keyed on a reused id
  // would describe the old object as the new one.
  const count = [...world.derived, ...world.destroyed].filter((d) => d.kindId === kindId).length;
  return count === 0 ? kindId : `${kindId}_${count + 1}`;
}

/** The recorded kind of an object derived in this game and still in it, or
 *  `undefined` -- decided from the record, never from the id's spelling
 *  (OPEN-VARIANT.md §14.1). */
export function derivedKindOf(world: OpenWorld, objectId: string): string | undefined {
  return world.derived.find((d) => d.id === objectId)?.kindId;
}

/**
 * Forgets an object a reshaping just destroyed (OPEN-VARIANT.md §14.2), after
 * the resolution that destroyed it has returned: out of `derived` and into
 * `destroyed`, and out of the maps the referee's targets and effects are
 * planned from, so it leaves every briefing and can take no later effect.
 * Changes no world state; the destruction itself was a leg of `resolve()`.
 */
export function retireDerivedObject(world: OpenWorld, objectId: string): DerivedObjectRecord {
  const index = world.derived.findIndex((d) => d.id === objectId);
  if (index < 0) throw new Error(`open/world: '${objectId}' is not a derived object in this game`);
  const [record] = world.derived.splice(index, 1);
  delete world.entityIdFor[objectId];
  for (const p of record.properties) delete world.resourceIdFor[propertyToken(objectId, p.key)];
  world.destroyed.push(record);
  return record;
}

/**
 * Registers what a derive's resolution just created (OPEN-VARIANT.md
 * §13.5): reads the item and its property resources off `outcome.created`
 * by the refs `effects.ts` gave them, declares each resource `bounded` and
 * `resolve_only` by the same call `buildOpenWorld` makes at setup (the one
 * thing that happens after `resolve()` returns -- §13.5 records it), and
 * extends the world's maps so the new object is perceived, targeted and
 * believed about like any §4.1 object.
 */
export function adoptDerivedObject(
  world: OpenWorld,
  params: { id: string; kindId: string; heldBy: Principal; description: string; outcome: Outcome }
): DerivedObjectRecord {
  const kind = findKind(params.kindId);
  if (!kind) throw new Error(`open/world: '${params.kindId}' is not a derivable kind`);
  const byRef = new Map(params.outcome.created.map((c) => [c.ref, c.entityId]));
  const entityId = byRef.get("object");
  if (!entityId) throw new Error(`open/world: the derive resolution created no item under ref 'object'`);

  const properties: OpenObjectProperty[] = [];
  for (const p of kind.properties) {
    const resourceId = byRef.get(`property:${p.key}`);
    if (!resourceId) throw new Error(`open/world: the derive resolution created no resource under ref 'property:${p.key}'`);
    declareBoundedConstraint({ gameId: world.base.gameId, resourceId });
    declareResolveOnlyConstraint({ gameId: world.base.gameId, resourceId });
    const resourceName = `${params.id}_${p.key}`;
    world.resourceIdFor[propertyToken(params.id, p.key)] = resourceId;
    world.resourceNameById[resourceId] = resourceName;
    properties.push({ ...p, resourceName });
  }
  world.entityIdFor[params.id] = entityId;

  const record: DerivedObjectRecord = { id: params.id, kindId: kind.id, heldBy: params.heldBy, description: params.description, entityId, properties };
  world.derived.push(record);
  return record;
}

/**
 * WORLD-ELABORATION-DESIGN.md §4.4/"4. `adoptAcquiredProperty`", §9 row P2:
 * registers what an `OPEN_ACQUIRE` resolution just created into the world's
 * maps -- the derive path's own template (`adoptDerivedObject` above), but
 * for a property acquired onto an EXISTING object rather than a whole new
 * one. With run-dmcp 0.9.0's `constraints` (issue #42) carried on
 * `OPEN_ACQUIRE`'s own `create` leg, this function does NOT need to declare
 * bounds after `resolve()` returns -- the wart `adoptDerivedObject` still
 * carries for the older path is not inherited here; this is issue #42's
 * second caller.
 *
 * Also wires §4.3's `ELABORABLE_EXITS`: when `need` is `integrity` and the
 * object is one the table names, the route it declares becomes real --
 * `world.exits` gains an entry gated on this newly-acquired resource,
 * exactly as `door`/`window` are gated on `bar`/`lock` (`buildOpenWorld`).
 */
export function adoptAcquiredProperty(
  world: OpenWorld,
  params: { objectId: string; need: OpenPropertyKey; resourceId: string; resourceName: string; property: Omit<OpenObjectProperty, "key" | "resourceName"> }
): AcquiredPropertyRecord {
  const property: OpenObjectProperty = { key: params.need, resourceName: params.resourceName, ...params.property };
  const record: AcquiredPropertyRecord = { objectId: params.objectId, property };
  world.acquired.push(record);
  world.resourceIdFor[propertyToken(params.objectId, params.need)] = params.resourceId;
  world.resourceNameById[params.resourceId] = params.resourceName;

  if (params.need === "integrity" && !world.exits[params.objectId]) {
    const route = ELABORABLE_EXITS[params.objectId];
    const destinationId = route ? world.namedLocations[route.destination] : undefined;
    if (route && destinationId) {
      world.exits = {
        ...world.exits,
        [params.objectId]: {
          part: params.objectId,
          passageResourceId: null,
          integrityResourceId: params.resourceId,
          destinationId,
          openWhenPartAtMost: route.openWhenIntegrityAtMost,
        },
      };
    }
  }

  return record;
}
