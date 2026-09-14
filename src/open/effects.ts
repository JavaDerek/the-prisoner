import { findProperty, type OpenPropertyKey, type OpenObjectProperty } from "./scenarioObjects.js";
import { findKind, composeDescription } from "./derivedObjects.js";

/**
 * The open variant's effect vocabulary (OPEN-VARIANT.md §4.2, this task's
 * brief's O1 list): `wear`, `restore`, `reveal`, `conceal`, `expose`,
 * `noise`, plus `none` for "the referee ruled nothing applies" -- itself a
 * legal, closed answer key, never a special case the reader has to invent
 * (`run-dmcp`'s turn reader requires every question to declare a real,
 * non-empty `answerKeys` set; `none` is a member of it here, not an
 * absence).
 */
export type EffectKind = "wear" | "restore" | "reveal" | "conceal" | "expose" | "noise" | "open" | "close" | "leave" | "derive" | "none";
export const EFFECT_KINDS: readonly EffectKind[] = ["wear", "restore", "reveal", "conceal", "expose", "noise", "open", "close", "leave", "derive", "none"];

export type Magnitude = "slight" | "moderate" | "substantial";
export const MAGNITUDES: readonly Magnitude[] = ["slight", "moderate", "substantial"];

export type Perceptibility = "silent" | "audible" | "visible";
export const PERCEPTIBILITIES: readonly Perceptibility[] = ["silent", "audible", "visible"];

/** The closed set of property keys across the whole scenario
 *  (`scenarioObjects.ts`), plus `none` -- the referee's own "property"
 *  answer key set (this task's brief: "the property" is one of the reader's
 *  five closed-key questions). */
export const PROPERTY_KEYS: readonly OpenPropertyKey[] = ["integrity", "edge", "concealment", "passage"];
export const PROPERTY_ANSWER_KEYS: readonly string[] = [...PROPERTY_KEYS, "none"];

/** `noise` is the one effect kind that names no property at all
 *  (OPEN-VARIANT.md §4.2: "a perceptible event with no state change"). */
export function effectRequiresProperty(effectKind: EffectKind): boolean {
  return (
    effectKind === "wear" ||
    effectKind === "restore" ||
    effectKind === "reveal" ||
    effectKind === "conceal" ||
    effectKind === "expose" ||
    effectKind === "open" ||
    effectKind === "close"
  );
}

export type OpenMechanicName = "OPEN_WEAR" | "OPEN_RESTORE" | "OPEN_REVEAL" | "OPEN_NOISE" | "OPEN_LEAVE" | "OPEN_DERIVE";

/** What a `derive` plan will register in the world once its resolution has
 *  created the entities (OPEN-VARIANT.md §13.5) -- decided before the
 *  resolution, from keys and authored text, never from the outcome. */
export interface PlannedDerivation {
  id: string;
  kindId: string;
  /** Composed by code (§13.2). */
  description: string;
  /** The parent's property the derivation consumes, or `null`. */
  consumes: OpenPropertyKey | null;
  parentObjectId: string;
}

export interface EffectPlan {
  mechanic: OpenMechanicName;
  parameters: Record<string, unknown>;
  /** The resource this effect writes or reads, when it has one -- `null`
   *  for `noise`. Exposed so the caller (`loop.ts`) can attach a
   *  belief-based `expects` for `wear`-type effects (this task's brief:
   *  "respecting... belief-based `expects` on wear-type effects, as the
   *  closed variant does for FILE/SHIM") without re-deriving it. */
  resourceId: string | null;
  /** `true` for `wear` and for `expose` (which is a `wear` on the
   *  `concealment` property) -- the two directions the belief-gated
   *  `expects` applies to. */
  isWearType: boolean;
  /** Set only for `derive`. */
  derived?: PlannedDerivation;
}

/**
 * Turns one VALIDATED ruling (target/effect/property/magnitude, already
 * checked for citations by `referee.ts`) into the `resolve()` call it
 * produces -- or `null` when the (object, property) pair the referee named
 * is not declared in the scenario at all (OPEN-VARIANT.md §2 invariant 5,
 * "no invented world"; this task's brief: "no object or property outside
 * the scenario can be targeted"). A `null` result is the caller's own cue
 * to do nothing, the same "intent does nothing" default every other
 * ungrounded path in this module already falls to.
 *
 * `conceal`/`expose` are accepted ONLY when the referee's own `property`
 * answer is `"concealment"` -- OPEN-VARIANT.md §4.2 marks them as acting on
 * a numeric flag, and this project's own choice (`scenarioObjects.ts`) is
 * that flag IS the `concealment` property; a `conceal` ruling naming any
 * other property is an incoherent ruling this function refuses to invent
 * meaning for (root CLAUDE.md hard rule 4), so it returns `null` rather
 * than guessing which property was meant.
 */
export function planEffect(params: {
  targetObjectId: string;
  effectKind: EffectKind;
  property: OpenPropertyKey | "none";
  magnitude: Magnitude;
  entityIdFor: Readonly<Record<string, string>>;
  resourceIdFor: Readonly<Record<string, string>>;
  /** The cell's ways out (OPEN-VARIANT.md §12), and who is acting -- both
   *  needed only by `leave`. */
  exits?: Readonly<Record<string, { passageResourceId: string; integrityResourceId: string; destinationId: string }>>;
  actorId?: string;
  /** Which properties an object declares -- the §4.1 table by default; a
   *  caller with a world hands in `declaredProperty` (`world.ts`) so an
   *  object derived in this game (OPEN-VARIANT.md §13.3) takes effects too. */
  declaredProperty?: (objectId: string, key: OpenPropertyKey) => OpenObjectProperty | undefined;
  /** OPEN-VARIANT.md §13: the referee's `product` key and what the caller
   *  decided for the new object -- needed only by `derive`. */
  derive?: {
    product: string;
    /** The span the referee cited from the parent's description. */
    parentSpan: string;
    actorId: string;
    /** The location the new object's property resources belong to, as
     *  every §4.1 property's does (`world.ts`). */
    ownerLocationId: string;
    /** The scenario-local id the world has chosen (`wire`, `wire_2`). */
    newObjectId: string;
  };
  description: string;
}): EffectPlan | null {
  const { targetObjectId, effectKind, property, magnitude, entityIdFor, resourceIdFor, description } = params;
  const lookup = params.declaredProperty ?? findProperty;
  const entityId = entityIdFor[targetObjectId];
  if (!entityId) return null;

  if (effectKind === "noise") {
    return { mechanic: "OPEN_NOISE", parameters: { entityId, description }, resourceId: null, isWearType: false };
  }
  if (effectKind === "leave") {
    // Through an exit, and only an exit: an object that is not one is not a
    // way out, whatever the referee said ("no invented world").
    const exit = params.exits?.[targetObjectId];
    if (!exit || !params.actorId) return null;
    return {
      mechanic: "OPEN_LEAVE",
      parameters: { characterId: params.actorId, ...exit, description },
      resourceId: null,
      isWearType: false,
    };
  }
  if (effectKind === "derive") return planDerive(params);
  if (effectKind === "none" || property === "none") return null;
  // `passage` changes by open/close alone, and open/close change nothing else.
  if ((effectKind === "open" || effectKind === "close") !== (property === "passage")) return null;

  const declared = lookup(targetObjectId, property);
  if (!declared) return null; // Not declared on this object -- "no invented world".
  const resourceId = resourceIdFor[`${targetObjectId}.${property}`];
  if (!resourceId) return null;

  if (effectKind === "open" || effectKind === "close") {
    // One act, to the end of the range: open is fully open, close fully shut.
    const amount = declared.max - declared.min;
    return {
      mechanic: effectKind === "open" ? "OPEN_RESTORE" : "OPEN_WEAR",
      parameters: { resourceId, amount, min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: false,
    };
  }
  if (effectKind === "reveal") {
    return { mechanic: "OPEN_REVEAL", parameters: { resourceId, description }, resourceId, isWearType: false };
  }
  if (effectKind === "wear") {
    return {
      mechanic: "OPEN_WEAR",
      parameters: { resourceId, amount: declared.wear[magnitude], min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: true,
    };
  }
  if (effectKind === "restore") {
    return {
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId, amount: declared.restore[magnitude], min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: false,
    };
  }
  if (effectKind === "conceal") {
    if (property !== "concealment") return null;
    return {
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId, amount: declared.restore[magnitude], min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: false,
    };
  }
  if (effectKind === "expose") {
    if (property !== "concealment") return null;
    return {
      mechanic: "OPEN_WEAR",
      parameters: { resourceId, amount: declared.wear[magnitude], min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: true,
    };
  }
  return null;
}

/**
 * OPEN-VARIANT.md §13.5: one resolution -- a `write` wearing the consumed
 * property by the parent's own table, a `create` of the item held by the
 * maker, and one `create` per declared property, each naming the item by
 * run-dmcp 0.8.0's `{ ref }`. Refuses, returning `null` like every other
 * incoherent ruling: no product; a product not in the table; a product
 * whose declared parent is not the target (§13.1); a property that is not
 * what the kind consumes (`none` for a kind that consumes nothing).
 */
function planDerive(params: Parameters<typeof planEffect>[0]): EffectPlan | null {
  const { targetObjectId, property, magnitude, resourceIdFor, description } = params;
  const derive = params.derive;
  if (!derive || derive.product === "none") return null;
  const kind = findKind(derive.product);
  if (!kind || kind.parent !== targetObjectId) return null;
  if ((kind.consumes ?? "none") !== property) return null;

  let parent: { resourceId: string; amount: number; min: number; max: number } | null = null;
  if (kind.consumes !== null) {
    const declared = findProperty(targetObjectId, kind.consumes);
    const resourceId = resourceIdFor[`${targetObjectId}.${kind.consumes}`];
    if (!declared || !resourceId) return null;
    parent = { resourceId, amount: declared.wear[magnitude], min: declared.min, max: declared.max };
  }

  const composed = composeDescription(kind, targetObjectId.replace(/_/g, " "), derive.parentSpan);
  return {
    mechanic: "OPEN_DERIVE",
    parameters: {
      parent,
      item: {
        ownerId: derive.actorId,
        name: `the ${kind.label}`,
        properties: JSON.stringify({ description: composed, kind: kind.id, derivedFrom: targetObjectId }),
      },
      resources: kind.properties.map((p) => ({
        ref: `property:${p.key}`,
        ownerId: derive.ownerLocationId,
        name: `${derive.newObjectId}_${p.key}`,
        value: p.initialValue,
        min: p.min,
        max: p.max,
      })),
      description,
    },
    resourceId: parent?.resourceId ?? null,
    isWearType: parent !== null,
    derived: { id: derive.newObjectId, kindId: kind.id, description: composed, consumes: kind.consumes, parentObjectId: targetObjectId },
  };
}
