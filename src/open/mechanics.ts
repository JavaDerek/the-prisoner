import { createResolver, type Mechanic, type AdjudicationInput, type Adjudication, type IntendedWrite, type IntendedChange, type Resolver } from "run-dmcp";
import { numericFactFrom } from "../world/facts.js";

/**
 * The open variant's four GENERIC mechanics (OPEN-VARIANT.md §4.2, this
 * task's brief "Effects become resolutions"). Every ruled effect becomes a
 * resolution through exactly one of these -- never a per-object, per-game
 * mechanic, which is precisely the "prestige is conserved across three
 * great powers" shape the engine boundary (root CLAUDE.md, `~/rpg/
 * CLAUDE.md`) forbids. `conceal`/`expose` are not separate mechanics: they
 * are `restore`/`wear` aimed at a `concealment` property, exactly as
 * OPEN-VARIANT.md §4.2 marks them "today (numeric flag)" -- the same
 * bounded-resource mechanism, never a new one.
 *
 * Every parameter these mechanics read comes from `AdjudicationInput.
 * parameters`, which the caller (`effects.ts`) builds entirely from the
 * scenario's own declared bounds and magnitude table
 * (`scenarioObjects.ts`) -- these mechanics hold no scenario content of
 * their own, unlike the closed variant's FILE/SHIM/HONE (which import their
 * own constants directly), because there is exactly ONE of each of these
 * mechanics for the whole open-mode object set, not one per object.
 */

export interface WearRestoreParams {
  resourceId: string;
  amount: number;
  min: number;
  max: number;
  description: string;
}

export interface RevealParams {
  resourceId: string;
  description: string;
}

export interface NoiseParams {
  entityId: string;
  description: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function currentValue(input: AdjudicationInput, resourceId: string): number {
  const value = numericFactFrom(input.constraint.mustHonor, resourceId, "value");
  if (value === null) {
    throw new Error(`open/mechanics: no numeric fact for resource '${resourceId}' at t=${input.constraint.t}`);
  }
  return value;
}

function setResource(resourceId: string, value: number, min: number, max: number): IntendedWrite {
  return { kind: "write", entityId: resourceId, key: "value", mode: "set", value, bounds: { minValue: min, maxValue: max } };
}

export const OPEN_WEAR: Mechanic = {
  name: "OPEN_WEAR",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as WearRestoreParams;
    const before = currentValue(input, p.resourceId);
    const after = clamp(before - p.amount, p.min, p.max);
    return {
      changes: [setResource(p.resourceId, after, p.min, p.max)],
      result: { mechanic: "OPEN_WEAR", resourceId: p.resourceId, before, after },
      description: p.description,
    };
  },
};

export const OPEN_RESTORE: Mechanic = {
  name: "OPEN_RESTORE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as WearRestoreParams;
    const before = currentValue(input, p.resourceId);
    const after = clamp(before + p.amount, p.min, p.max);
    return {
      changes: [setResource(p.resourceId, after, p.min, p.max)],
      result: { mechanic: "OPEN_RESTORE", resourceId: p.resourceId, before, after },
      description: p.description,
    };
  },
};

/** No write -- an information move, exactly like the closed variant's
 *  INSPECT/OBSERVE (`world/mechanics.ts`), generalised to any declared
 *  resource. */
export const OPEN_REVEAL: Mechanic = {
  name: "OPEN_REVEAL",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as RevealParams;
    const value = currentValue(input, p.resourceId);
    return {
      changes: [],
      result: { mechanic: "OPEN_REVEAL", resourceId: p.resourceId, value },
      description: p.description,
    };
  },
};

/** No write, no reveal -- a perceptible event and nothing else
 *  (OPEN-VARIANT.md §4.2: "create a perceptible event with no state
 *  change"). Still an AUDITED referee resolution, not a direct write,
 *  matching the closed variant's own `TIME_DECAY` (`world/mechanics.ts`):
 *  registered and dispatched through `resolve()` even though it changes
 *  nothing. */
export const OPEN_NOISE: Mechanic = {
  name: "OPEN_NOISE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as NoiseParams;
    return {
      changes: [],
      result: { mechanic: "OPEN_NOISE", entityId: p.entityId },
      description: p.description,
    };
  },
};

export interface LeaveParams {
  characterId: string;
  passageResourceId: string;
  integrityResourceId: string;
  destinationId: string;
  description: string;
}

/** OPEN-VARIANT.md §12: move the actor through an exit, if it is passable
 *  now -- its passage open (1), or its integrity spent (0). The move is a
 *  `set` of the character's location (run-dmcp 0.7.0), inside the
 *  resolution; a shut exit moves nothing and says so in `result`. Read only
 *  from the constraint this mechanic is handed, like every other. */
export const OPEN_LEAVE: Mechanic = {
  name: "OPEN_LEAVE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as LeaveParams;
    const passage = numericFactFrom(input.constraint.mustHonor, p.passageResourceId, "value");
    const integrity = numericFactFrom(input.constraint.mustHonor, p.integrityResourceId, "value");
    const left = passage === 1 || integrity === 0;
    return {
      changes: left ? [{ kind: "set", entityId: p.characterId, key: "location_id", value: p.destinationId }] : [],
      result: { mechanic: "OPEN_LEAVE", left, ...(left ? { destinationId: p.destinationId } : {}) },
      description: p.description,
    };
  },
};

export interface DeriveParams {
  /** The parent's consumed property, or `null` for a kind that consumes nothing. */
  parent: { resourceId: string; amount: number; min: number; max: number } | null;
  /** OPEN-VARIANT.md §14.2: entities this resolution destroys (a reshaped
   *  parent's resources, then its item). Empty for a derivation that takes a piece. */
  destroy?: string[];
  item: { ownerId: string; name: string; properties: string };
  /** `carryFrom`: start at that resource's current value instead of `value`
   *  (§14.2, a property both kinds declare). */
  resources: { ref: string; ownerId: string; name: string; value: number; carryFrom?: string; min: number; max: number }[];
  description: string;
}

/** OPEN-VARIANT.md §13.5: the parent worn by its own table, the item and
 *  its property resources created, all in ONE resolution on run-dmcp 0.8.0's
 *  `create` intent, later legs naming the item by `{ ref }`. A parent whose
 *  consumed property already stands at its minimum yields nothing (§13.6,
 *  decision 9): the resolution records the attempt and creates nothing.
 *  Reads only the constraint it is handed, like every other. The engine
 *  never learns what the new entity is for or what it was made from; the
 *  item row's `properties` carries that, as this repository's own record. */
export const OPEN_DERIVE: Mechanic = {
  name: "OPEN_DERIVE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as DeriveParams;
    const changes: IntendedChange[] = [];
    let before: number | null = null;
    let after: number | null = null;
    if (p.parent) {
      before = currentValue(input, p.parent.resourceId);
      if (before <= p.parent.min) {
        return { changes: [], result: { mechanic: "OPEN_DERIVE", made: false, before, after: before }, description: p.description };
      }
      after = clamp(before - p.parent.amount, p.parent.min, p.parent.max);
      changes.push(setResource(p.parent.resourceId, after, p.parent.min, p.parent.max));
    }
    // Read every carried value before any leg, from the facts this mechanic
    // is handed; then the parent goes and the product comes, in one resolution.
    const startValues: Record<string, number> = {};
    for (const r of p.resources) startValues[r.ref] = r.carryFrom ? clamp(currentValue(input, r.carryFrom), r.min, r.max) : r.value;
    for (const entityId of p.destroy ?? []) changes.push({ kind: "destroy", entityId });
    changes.push({
      kind: "create",
      ref: "object",
      entityKind: "item",
      columns: { owner_id: p.item.ownerId, owner_type: "character", name: p.item.name, properties: p.item.properties },
    });
    const createdAt = new Date().toISOString();
    for (const r of p.resources) {
      changes.push({
        kind: "create",
        ref: r.ref,
        entityKind: "resource",
        columns: { owner_id: r.ownerId, owner_type: "location", name: r.name, value: startValues[r.ref], min_value: r.min, max_value: r.max, created_at: createdAt },
      });
    }
    return {
      changes,
      result: { mechanic: "OPEN_DERIVE", made: true, before, after, startValues },
      description: p.description,
    };
  },
};

export function buildOpenResolver(): Resolver {
  return createResolver({ mechanics: [OPEN_WEAR, OPEN_RESTORE, OPEN_REVEAL, OPEN_NOISE, OPEN_LEAVE, OPEN_DERIVE] });
}
