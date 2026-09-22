import { findProperty, type OpenPropertyKey, type OpenObjectProperty } from "./scenarioObjects.js";
import { findKind, composeDescription, parentLabel } from "./derivedObjects.js";
import type { Principal } from "../ledger/beliefs.js";

/**
 * The open variant's effect vocabulary (OPEN-VARIANT.md §4.2, this task's
 * brief's O1 list): `wear`, `restore`, `reveal`, `conceal`, `expose`,
 * `noise`, plus `none` for "the referee ruled nothing applies" -- itself a
 * legal, closed answer key, never a special case the reader has to invent
 * (`run-dmcp`'s turn reader requires every question to declare a real,
 * non-empty `answerKeys` set; `none` is a member of it here, not an
 * absence).
 */
export type EffectKind = "wear" | "restore" | "reveal" | "conceal" | "expose" | "noise" | "open" | "close" | "leave" | "derive" | "take" | "give" | "none";
/** docs/CUSTODY-DESIGN.md: `take` and `give` move who holds a thing -- the
 *  target is the thing, never the place or the person -- through one `set`
 *  of the item's own owner columns (`OPEN_TAKE`/`OPEN_GIVE`, mechanics.ts).
 *  `none` stays last: it is the "nothing applies" key, not an effect. */
export const EFFECT_KINDS: readonly EffectKind[] = ["wear", "restore", "reveal", "conceal", "expose", "noise", "open", "close", "leave", "derive", "take", "give", "none"];

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

/** Issue #22 gap 3: the keys a PERSON declares and an object never does
 *  (`scenarioObjects.ts`'s `posture`). Deliberately NOT in `PROPERTY_KEYS`,
 *  which is the elaborable-object vocabulary: `elaborationBands.ts` iterates
 *  that set to price every (object, need) pair and its own header states the
 *  reason -- "a person is never elaborated (§2)". `PROPERTY_ANSWER_KEYS` stays
 *  exactly the four-plus-none set `elaborationReferee.ts` documents itself as
 *  reusing, so neither the pricing table nor the `need` question can silently
 *  gain a person's key.
 *
 *  Only the RULING's own property question widens, and only when a person is
 *  actually perceived (`referee.ts`): with the presence arm off no person is
 *  ever in view, so the base request stays byte-identical to every recorded
 *  batch -- which `referee.test.ts`'s fingerprint PIN proves mechanically. */
export const PERSON_PROPERTY_KEYS: readonly OpenPropertyKey[] = ["posture"];

/** The property answers a ruling may give for the objects actually in view:
 *  the object vocabulary always, plus a person's own keys when one is there
 *  to be acted on. */
export function rulingPropertyAnswerKeys(personInView: boolean): readonly string[] {
  return personInView ? [...PROPERTY_KEYS, ...PERSON_PROPERTY_KEYS, "none"] : [...PROPERTY_ANSWER_KEYS];
}

/** `noise` names no property at all (OPEN-VARIANT.md §4.2: "a perceptible
 *  event with no state change"), and neither do `take`/`give`
 *  (docs/CUSTODY-DESIGN.md): what they change is who holds the thing, an
 *  owner column on the item itself, never one of its bounded properties. */
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

export type OpenMechanicName = "OPEN_WEAR" | "OPEN_RESTORE" | "OPEN_REVEAL" | "OPEN_NOISE" | "OPEN_PASSAGE" | "OPEN_LEAVE" | "OPEN_DERIVE";

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
  /** OPEN-VARIANT.md §14.2: set when the product replaces its parent -- the
   *  derived object the resolution destroys, and who held it (and so holds
   *  the product). `null` for a derivation that takes a piece. */
  replaces: { id: string; kindId: string; heldBy: Principal } | null;
}

/** An object derived earlier in this game, as `planEffect` needs it to derive
 *  from it (OPEN-VARIANT.md §14): its recorded kind, who holds it, and the
 *  entities a reshaping destroys. */
export interface DerivedParent {
  kindId: string;
  heldBy: Principal;
  /** The holder's character id: the product's owner when it replaces this. */
  holderId: string;
  entityId: string;
  resources: readonly { key: OpenPropertyKey; resourceId: string }[];
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
  /** OPEN-VARIANT.md §27: set only for a `wear` on a way out's part, naming
   *  the way out that part keeps shut, so a wear to the bottom can be told as
   *  the way out it frees. */
  frees?: string;
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
  /** The cell's ways out (OPEN-VARIANT.md §12), keyed by the way-out object
   *  (§17.2), and who is acting -- both needed only by `leave`. */
  exits?: Readonly<Record<string, { passageResourceId: string | null; integrityResourceId: string; destinationId: string; part: string; openWhenPartAtMost: number | null }>>;
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
    /** Set when the target is an object derived in this game (§14.1). */
    parent?: DerivedParent;
  };
  description: string;
}): EffectPlan | null {
  const { targetObjectId, effectKind, property, magnitude, entityIdFor, resourceIdFor, description } = params;
  const lookup = params.declaredProperty ?? findProperty;
  if (effectKind === "noise") {
    // OPUS-FIRST-DESIGN.md §3.2: a noise's target may be `none` -- the sound
    // is then the actor's own (the O game's slow circuit, made of pointed
    // conversation at nothing in particular), so the event hangs on the
    // actor's entity. A named target that is not in the map is still "no
    // invented world", exactly as below; with neither there is no source
    // for the sound to be recorded against.
    const source = targetObjectId === "none" ? params.actorId : entityIdFor[targetObjectId];
    if (!source) return null;
    return { mechanic: "OPEN_NOISE", parameters: { entityId: source, description }, resourceId: null, isWearType: false };
  }
  const entityId = entityIdFor[targetObjectId];
  if (!entityId) return null;

  if (effectKind === "leave") {
    // Through a way out, and only a way out: an object that is not one -- a
    // lock or a bar, the part of one (§17.2) -- is not, whatever the referee
    // said ("no invented world").
    const exit = params.exits?.[targetObjectId];
    if (!exit || !params.actorId) return null;
    const { passageResourceId, integrityResourceId, destinationId } = exit;
    return {
      mechanic: "OPEN_LEAVE",
      parameters: { characterId: params.actorId, passageResourceId, integrityResourceId, destinationId, description },
      resourceId: null,
      isWearType: false,
    };
  }
  if (effectKind === "derive") return planDerive(params);
  if (effectKind === "none") return null;

  if (effectKind === "open" || effectKind === "close") {
    // OPEN-VARIANT.md §19: the referee's target may already be the way out,
    // or may be the part that makes it passable (`lock`, `bar`) -- resolved
    // here from `world.ts`'s own part/exit pairing, never left to the
    // referee's target answer to make the leap on its own. Whichever the
    // target, the property this effect ever acts on is the resolved way
    // out's OWN `passage` -- never whatever property key the referee
    // separately answered (a part declares no `passage` to name), the same
    // way `leave` below already ignores it.
    const exits = params.exits ?? {};
    const exitId = exits[targetObjectId] ? targetObjectId : Object.keys(exits).find((id) => exits[id]?.part === targetObjectId);
    if (!exitId) return null; // Neither a way out nor a declared part of one -- "no invented world".
    const declared = lookup(exitId, "passage");
    const resourceId = resourceIdFor[`${exitId}.passage`];
    if (!declared || !resourceId) return null;
    // One act, to the end of the range: open is fully open, close fully shut.
    // §24: an open is held to the way out's threshold on its part, whichever
    // object the referee named.
    const exit = exits[exitId];
    const gate = effectKind === "open" && exit?.openWhenPartAtMost !== null && exit?.openWhenPartAtMost !== undefined ? { integrityResourceId: exit.integrityResourceId, atMost: exit.openWhenPartAtMost, part: exit.part } : undefined;
    return {
      mechanic: "OPEN_PASSAGE",
      parameters: { resourceId, wayOut: exitId, open: effectKind === "open", min: declared.min, max: declared.max, ...(gate ? { gate } : {}), description },
      resourceId,
      isWearType: false,
    };
  }
  if (property === "none") return null;
  // `passage` changes by open/close alone (handled above), so every effect
  // that WRITES is refused on it. `reveal` is not one: `OPEN_REVEAL` declares
  // `changes: []` and only reads the fact it is handed, so letting it through
  // leaves this rule exactly as strong as it was.
  //
  // It has to be let through (the-prisoner#7). `OPEN_LEAVE` needs only
  // `passage === 1`, and a principal that is not the actor has no other way
  // to learn that value: perception carries no number (§2 invariant 2), and a
  // belief is only ever written for the principal that acted. Refusing
  // `reveal` here closed the last channel, so the warden held a belief slot
  // for `window_passage` that nothing could fill.
  if (property === "passage" && effectKind !== "reveal") return null;

  const declared = lookup(targetObjectId, property);
  if (!declared) return null; // Not declared on this object -- "no invented world".
  const resourceId = resourceIdFor[`${targetObjectId}.${property}`];
  if (!resourceId) return null;

  if (effectKind === "reveal") {
    return { mechanic: "OPEN_REVEAL", parameters: { resourceId, description }, resourceId, isWearType: false };
  }
  if (effectKind === "wear") {
    const frees = property === "integrity" ? Object.keys(params.exits ?? {}).find((id) => params.exits?.[id]?.part === targetObjectId) : undefined;
    return {
      mechanic: "OPEN_WEAR",
      parameters: { resourceId, amount: declared.wear[magnitude], min: declared.min, max: declared.max, description },
      resourceId,
      isWearType: true,
      ...(frees ? { frees } : {}),
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
 * whose declared parent is not the target (§13.1) -- for a kind whose parent
 * is a kind, not the target's RECORDED kind (§14.1); a property that is not
 * what the kind consumes (`none` for a kind that consumes nothing).
 *
 * §14.2, a kind that replaces its parent: the same resolution also destroys
 * the parent's resources and item, the product is held by the parent's
 * holder, and each property both kinds declare starts at the parent's
 * current value -- named here by resource id, read by the mechanic from the
 * facts it is handed, so the number is copied from a fact, never chosen.
 */
function planDerive(params: Parameters<typeof planEffect>[0]): EffectPlan | null {
  const { targetObjectId, magnitude, resourceIdFor, description } = params;
  const lookup = params.declaredProperty ?? findProperty;
  const derive = params.derive;
  if (!derive || derive.product === "none") return null;
  const kind = findKind(derive.product);
  if (!kind) return null;
  const parentIsKind = findKind(kind.parent) !== undefined;
  if (parentIsKind ? derive.parent?.kindId !== kind.parent : kind.parent !== targetObjectId) return null;
  // OPEN-VARIANT.md §25: what comes away is the kind's own declaration, never
  // the referee's separate property answer -- the same choice §19 made for a
  // way out's passage. The answer's citation still grounds it (`referee.ts`).
  const replaced = kind.replacesParent ? derive.parent : undefined;
  if (kind.replacesParent && (!replaced || kind.consumes !== null)) return null;

  let parent: { resourceId: string; amount: number; min: number; max: number } | null = null;
  if (kind.consumes !== null) {
    const declared = lookup(targetObjectId, kind.consumes);
    const resourceId = resourceIdFor[`${targetObjectId}.${kind.consumes}`];
    if (!declared || !resourceId) return null;
    parent = { resourceId, amount: declared.wear[magnitude], min: declared.min, max: declared.max };
  }

  const composed = composeDescription(kind, parentIsKind ? parentLabel(kind) : targetObjectId.replace(/_/g, " "), derive.parentSpan);
  return {
    mechanic: "OPEN_DERIVE",
    parameters: {
      parent,
      destroy: replaced ? [...replaced.resources.map((r) => r.resourceId), replaced.entityId] : [],
      item: {
        ownerId: replaced ? replaced.holderId : derive.actorId,
        name: `the ${kind.label}`,
        properties: JSON.stringify({ description: composed, kind: kind.id, derivedFrom: targetObjectId }),
      },
      resources: kind.properties.map((p) => {
        const carryFrom = replaced?.resources.find((r) => r.key === p.key)?.resourceId;
        return {
          ref: `property:${p.key}`,
          ownerId: derive.ownerLocationId,
          name: `${derive.newObjectId}_${p.key}`,
          value: p.initialValue,
          ...(carryFrom ? { carryFrom } : {}),
          min: p.min,
          max: p.max,
        };
      }),
      description,
    },
    resourceId: parent?.resourceId ?? null,
    isWearType: parent !== null,
    derived: {
      id: derive.newObjectId,
      kindId: kind.id,
      description: composed,
      consumes: kind.consumes,
      parentObjectId: targetObjectId,
      replaces: replaced ? { id: targetObjectId, kindId: replaced.kindId, heldBy: replaced.heldBy } : null,
    },
  };
}
