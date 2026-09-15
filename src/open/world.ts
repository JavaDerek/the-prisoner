import { createItem, createLocation, createResource, declareBoundedConstraint, declareResolveOnlyConstraint, type Outcome } from "run-dmcp";
import { buildWorld, type World } from "../world/setup.js";
import { OPEN_OBJECTS, findProperty, type OpenObjectSpec, type OpenObjectProperty, type OpenPropertyKey } from "./scenarioObjects.js";
import { findKind } from "./derivedObjects.js";
import type { Principal } from "../ledger/beliefs.js";
import { SEARCH_CATCH_BAR_MAX } from "../world/mechanics.js";

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
}

/** One derived object (OPEN-VARIANT.md §13.3): an object like any other --
 *  id, holder, composed description, declared properties -- known to the
 *  world from the resolution that created it. */
export interface DerivedObjectRecord {
  id: string;
  kindId: string;
  heldBy: Principal;
  description: string;
  entityId: string;
  properties: readonly OpenObjectProperty[];
}

export interface OpenExit {
  /** The object whose `integrity` is §12's other way through (§17.2). */
  part: string;
  /** The way out's own `passage`: 0 shut, 1 open. */
  passageResourceId: string;
  /** The part's integrity: spent (0) also makes the exit passable. */
  integrityResourceId: string;
  /** The location a principal who leaves through this exit is in. */
  destinationId: string;
  /** OPEN-VARIANT.md §24: the part's integrity at or below which `open` can
   *  make this way out passable; `null` when nothing but the way out's own
   *  description gates it. */
  openWhenPartAtMost: number | null;
}

/** OPEN-VARIANT.md §24: the window opens only once its bar is worn to the line
 *  a catch already treats as visibly compromised. */
export const OPEN_WINDOW_BAR_MAX = SEARCH_CATCH_BAR_MAX;

function propertyToken(objectId: string, propertyKey: string): string {
  return `${objectId}.${propertyKey}`;
}

export function buildOpenWorld(): OpenWorld {
  const base = buildWorld();
  const gameId = base.gameId;

  const entityIdFor: Record<string, string> = {
    bar: base.barId,
    spoon: base.spoonId,
    loose_tile: base.looseTileId,
  };
  const resourceIdFor: Record<string, string> = {
    [propertyToken("bar", "integrity")]: base.resources.barIntegrity,
    // The lock too: `gameEnd.ts`'s escape check reads `base.resources.
    // lockIntegrity`, so a second `lock_integrity` resource here would be
    // one no escape could ever read.
    [propertyToken("lock", "integrity")]: base.resources.lockIntegrity,
    [propertyToken("spoon", "edge")]: base.resources.spoonEdge,
  };
  const resourceNameById: Record<string, string> = {
    [base.resources.barIntegrity]: "bar_integrity",
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
      const token = propertyToken(spec.id, property.key);
      if (!resourceIdFor[token]) {
        resourceIdFor[token] = boundedResolveOnly(base.cellId, property.resourceName, property.initialValue, property.min, property.max);
      }
      resourceNameById[resourceIdFor[token]] = property.resourceName;
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
    // The door's own description grounds opening it: the bolt shows in the gap.
    door: exit("door", "lock", corridor.id, null),
    window: exit("window", "bar", outsideWindow.id, OPEN_WINDOW_BAR_MAX),
  };

  return { base, entityIdFor, resourceIdFor, resourceNameById, exits, derived: [], destroyed: [] };
}

export function resourceIdForProperty(world: OpenWorld, objectId: string, propertyKey: string): string | undefined {
  return world.resourceIdFor[propertyToken(objectId, propertyKey)];
}

/** A property declared on a §4.1 object or on an object derived in this
 *  game (§13.3) -- the world-aware form of `findProperty`. */
export function declaredProperty(world: OpenWorld, objectId: string, key: string): OpenObjectProperty | undefined {
  const derived = world.derived.find((d) => d.id === objectId);
  if (derived) return derived.properties.find((p) => p.key === key);
  return findProperty(objectId, key as OpenPropertyKey);
}

/** Every property key an object declares, derived in this game or §4.1 --
 *  what the referee's property question lists per object (OPEN-VARIANT.md §24). */
export function declaredPropertyKeys(world: OpenWorld, objectId: string): string[] {
  const derived = world.derived.find((d) => d.id === objectId);
  if (derived) return derived.properties.map((p) => p.key);
  return OPEN_OBJECTS.find((o) => o.id === objectId)?.properties.map((p) => p.key) ?? [];
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
