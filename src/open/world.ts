import { createItem, createResource, declareBoundedConstraint, declareResolveOnlyConstraint } from "run-dmcp";
import { buildWorld, type World } from "../world/setup.js";
import { OPEN_OBJECTS, type OpenObjectSpec } from "./scenarioObjects.js";

/**
 * The open variant's world (OPEN-VARIANT.md §1: "Everything the closed
 * variant built stays... Only the action layer changes"). `base` is the
 * UNCHANGED closed-variant `World` (`buildWorld()`, `src/world/setup.ts`) --
 * same game, same cell, same two characters, same half-round clock, same
 * five resources -- so the bar/lock/spoon resource ids below are literally
 * the same entities the closed variant's own mechanics read and write.
 *
 * On top of that, this module creates one `run-dmcp` item per §4.1 object
 * that the closed variant did not already create (`lock`, `cot`, `blanket`,
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
}

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

  return { base, entityIdFor, resourceIdFor, resourceNameById };
}

export function resourceIdForProperty(world: OpenWorld, objectId: string, propertyKey: string): string | undefined {
  return world.resourceIdFor[propertyToken(objectId, propertyKey)];
}
