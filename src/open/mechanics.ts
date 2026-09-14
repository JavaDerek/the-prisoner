import { createResolver, type Mechanic, type AdjudicationInput, type Adjudication, type IntendedWrite, type Resolver } from "run-dmcp";
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

export function buildOpenResolver(): Resolver {
  return createResolver({ mechanics: [OPEN_WEAR, OPEN_RESTORE, OPEN_REVEAL, OPEN_NOISE, OPEN_LEAVE] });
}
