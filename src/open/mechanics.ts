import { createResolver, type Mechanic, type AdjudicationInput, type Adjudication, type IntendedWrite, type IntendedChange, type EntityRef, type Resolver } from "run-dmcp";
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
  /** PLAYTEST-2026-09-27 D12: the actor's own sight resource and its blind line, where the world built one. At
   *  or below the line the reveal refuses: no value, `result.blind`. */
  actorSightResourceId?: string;
  blindAtOrBelow?: number;
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

function setResource(entityId: EntityRef, value: number, min: number, max: number): IntendedWrite {
  return { kind: "write", entityId, key: "value", mode: "set", value, bounds: { minValue: min, maxValue: max } };
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

/**
 * HUMAN-INTENTS-DESIGN.md D9 (§6.2), OPEN-VARIANT.md §76.1: a `conceal` on a
 * person-container (the blanket, the cot) is `OPEN_RESTORE` on its own
 * `concealment` PLUS, in the SAME resolution (the custody rule: one
 * `resolve()` call, never two), the acting principal's own containment set
 * to this container's index -- once the raise crosses
 * `CONTAINMENT_HIDDEN_AT_OR_ABOVE`.
 *
 * OWNER'S DECISION, 2026-09-26 (OPEN-VARIANT.md §77 addendum): "getting under
 * covers you." §77 measured the shipped referee ruling `magnitude: slight`
 * on every "hide under the blanket"-shaped intent it was ever asked (§76.1's
 * own precision, §77's own targeting fix, both landed; the magnitude
 * question is a THIRD, untouched prompt), and `slight` raises a container's
 * concealment by only 20 (`scenarioObjects.ts`'s own wear/restore table),
 * short of the 50 line -- so the mechanic that exists to hide a person under
 * a blanket had never once fired, against a referee that reads the act
 * correctly by every other measure. Getting under a container now sets its
 * concealment to AT LEAST `hiddenAtOrAbove`, regardless of the ruled
 * magnitude, so the actor is contained in that one resolution: `after` is
 * the raise the magnitude earns, floored at the hidden line, never the
 * reverse -- a magnitude that already earns more than the floor (a
 * `moderate` or `substantial` conceal, or a `slight` one stacked on an
 * earlier raise) is never brought DOWN to it. `PRISONER_CONTAINER_CLAUSE`
 * itself stays off pending a re-probe under this mechanic
 * (`checkpoints/2026-09-26-arms/PREDICTION-2.md`) -- this fixes the
 * mechanic the clause would resolve through, not whether the referee reaches
 * for `conceal` on the container at all.
 */
export interface ConcealContainerParams extends WearRestoreParams {
  /** Absent when the world built no containment resource for the actor at
   *  all (the presence arm off) -- `effects.ts` never builds this shape in
   *  that case, but the mechanic stays honest about it regardless. */
  actorHeldIn?: { resourceId: string; containerIndex: number; max: number };
  hiddenAtOrAbove: number;
}

export const OPEN_CONCEAL_CONTAINER: Mechanic = {
  name: "OPEN_CONCEAL_CONTAINER",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as ConcealContainerParams;
    const before = currentValue(input, p.resourceId);
    // Owner's decision, 2026-09-26 (OPEN-VARIANT.md §77 addendum): the raise
    // floors at `hiddenAtOrAbove` -- `Math.max` before the final clamp, so a
    // magnitude that already earns more than the floor is never brought
    // down to it, and the floor itself never exceeds `p.max` (the floor,
    // 50, is always below the scenario's own 100 ceiling).
    const after = clamp(Math.max(before + p.amount, p.hiddenAtOrAbove), p.min, p.max);
    const changes: IntendedChange[] = [setResource(p.resourceId, after, p.min, p.max)];
    const contained = after >= p.hiddenAtOrAbove;
    if (p.actorHeldIn && contained) changes.push(setResource(p.actorHeldIn.resourceId, p.actorHeldIn.containerIndex, 0, p.actorHeldIn.max));
    return {
      changes,
      result: { mechanic: "OPEN_CONCEAL_CONTAINER", resourceId: p.resourceId, before, after, ...(p.actorHeldIn ? { containment: contained ? p.actorHeldIn.containerIndex : 0 } : {}) },
      description: p.description,
    };
  },
};

/**
 * The reverse of `OPEN_CONCEAL_CONTAINER`: `OPEN_WEAR` on the container's
 * own `concealment`, plus -- read from the facts this mechanic is handed AT
 * RESOLUTION TIME, never at plan time, the same discipline `OPEN_TAKE`/
 * `OPEN_SEARCH` already follow for who holds what -- clearing whichever
 * principal's own containment resource currently names this container,
 * once the lower crosses back below `CONTAINMENT_HIDDEN_AT_OR_ABOVE`. A
 * partial expose that leaves concealment at or above the line clears
 * nothing, symmetric with the forward direction.
 */
export interface ExposeContainerParams extends WearRestoreParams {
  containerIndex: number;
  hiddenAtOrAbove: number;
  /** Every principal's own containment resource and its declared max, so
   *  whichever one currently points at THIS container is cleared in the
   *  same resolution -- there is no way to know which, if any, at plan
   *  time. */
  heldInResources: readonly { resourceId: string; max: number }[];
}

export const OPEN_EXPOSE_CONTAINER: Mechanic = {
  name: "OPEN_EXPOSE_CONTAINER",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as ExposeContainerParams;
    const before = currentValue(input, p.resourceId);
    const after = clamp(before - p.amount, p.min, p.max);
    const changes: IntendedChange[] = [setResource(p.resourceId, after, p.min, p.max)];
    const uncovered: string[] = [];
    if (after < p.hiddenAtOrAbove) {
      for (const held of p.heldInResources) {
        if (currentValue(input, held.resourceId) === p.containerIndex) {
          changes.push(setResource(held.resourceId, 0, 0, held.max));
          uncovered.push(held.resourceId);
        }
      }
    }
    return {
      changes,
      result: { mechanic: "OPEN_EXPOSE_CONTAINER", resourceId: p.resourceId, before, after, uncovered },
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
    const sight = p.actorSightResourceId ? numericFactFrom(input.constraint.mustHonor, p.actorSightResourceId, "value") : null;
    if (sight !== null && p.blindAtOrBelow !== undefined && sight <= p.blindAtOrBelow) {
      return { changes: [], result: { mechanic: "OPEN_REVEAL", resourceId: p.resourceId, blind: true }, description: p.description };
    }
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

export interface PassageParams {
  resourceId: string;
  /** The way out this acts on, whichever object the referee named (§19). */
  wayOut: string;
  /** true for open (to `max`), false for close (to `min`). */
  open: boolean;
  min: number;
  max: number;
  /** OPEN-VARIANT.md §24: open only while the part's integrity is at or below
   *  `atMost`. PLAYTEST-2026-09-27 D11: close only while it is ABOVE it. Absent
   *  for a way out with no threshold. */
  gate?: { integrityResourceId: string; atMost: number; part: string };
  /** HUMAN-INTENTS-DESIGN.md D7a (§5, OPEN-VARIANT.md §76.2, the-prisoner#26):
   *  when the gate above refuses, the SAME resolution applies this magnitude
   *  as `wear` on the part -- exactly as an ordinary `wear` ruling would --
   *  rather than doing nothing. Absent for `close`, for a way out with no
   *  threshold, and for a `gate` that lets the open through this turn (in
   *  which case there is nothing left to wear: the part already frees it). */
  wearOnRefusal?: { resourceId: string; amount: number; min: number; max: number };
  /** D15, the owner's answer to OPEN-VARIANT.md §80.4 question 2 (RED-TEAM.md F12), 2026-09-27: the way out's key
   *  and who is acting. When the key item's own `owner_id` at t is the actor (a character), `gate` does not apply
   *  to an OPEN. It never lifts D11's close gate: a lock worn past its gate holds no bolt whoever has the key, so
   *  the open-close exchange F3 closed stays closed on the door too (the owner's answer was "open the door", not
   *  "bolt it"; corrected 2026-09-27). Absent for a way out with no key or no gate. */
  key?: { itemId: string; actorId: string };
  description: string;
}

/** OPEN-VARIANT.md §19/§24: open or close a way out in one act. An open whose
 *  way out has a threshold changes nothing while its part still holds, and
 *  says so in `result.opened`. Read only from the constraint it is handed. */
export const OPEN_PASSAGE: Mechanic = {
  name: "OPEN_PASSAGE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as PassageParams;
    const before = currentValue(input, p.resourceId);
    // D15: the key's holder, read like custody reads holders -- the engine's owner columns at t.
    const keyHolder = p.key ? holderOf(input, p.key.itemId) : null;
    const keyed = p.key !== undefined && keyHolder !== null && keyHolder.type === "character" && keyHolder.id === p.key.actorId;
    const gate = keyed && p.open ? undefined : p.gate;
    if (p.open && gate && currentValue(input, gate.integrityResourceId) > gate.atMost) {
      // D7a: the passage itself changes nothing, but the SAME resolution
      // wears the part by the ruled magnitude, exactly as `OPEN_WEAR` would
      // -- a refused pry now progresses the window route instead of
      // teaching the actor nothing and costing a turn for free.
      const changes: IntendedChange[] = [];
      let part: { before: number; after: number } | undefined;
      if (p.wearOnRefusal) {
        const partBefore = currentValue(input, p.wearOnRefusal.resourceId);
        const partAfter = clamp(partBefore - p.wearOnRefusal.amount, p.wearOnRefusal.min, p.wearOnRefusal.max);
        changes.push(setResource(p.wearOnRefusal.resourceId, partAfter, p.wearOnRefusal.min, p.wearOnRefusal.max));
        part = { before: partBefore, after: partAfter };
      }
      return {
        changes,
        result: { mechanic: "OPEN_PASSAGE", resourceId: p.resourceId, wayOut: p.wayOut, before, after: before, opened: false, ...(part && gate ? { partId: gate.part, partBefore: part.before, partAfter: part.after } : {}) },
        description: p.description,
      };
    }
    if (!p.open && gate && currentValue(input, gate.integrityResourceId) <= gate.atMost) {
      // PLAYTEST-2026-09-27 D11 (RED-TEAM.md F3), 2026-09-27: a part at or under the gate cannot hold the way out
      // shut -- the window's bar is out of it, the door's lock will not hold. Nothing changes, and `result` says
      // which part, so the actor is told.
      return {
        changes: [],
        result: { mechanic: "OPEN_PASSAGE", resourceId: p.resourceId, wayOut: p.wayOut, before, after: before, shut: false, partId: gate.part },
        description: p.description,
      };
    }
    const after = p.open ? p.max : p.min;
    return {
      changes: [setResource(p.resourceId, after, p.min, p.max)],
      result: { mechanic: "OPEN_PASSAGE", resourceId: p.resourceId, wayOut: p.wayOut, before, after, ...(p.open ? { opened: true } : {}), ...(p.open && gate ? { freedPart: gate.part } : {}), ...(keyed ? { withKey: true } : {}) },
      description: p.description,
    };
  },
};

/** PLAYTEST-2026-09-27 D4': the other principal as a leave's blocker (`effects.ts`'s `BlockerRecord`). */
export interface LeaveBlocker {
  characterId: string;
  blockingResourceId: string;
  postureResourceId?: string;
  sightResourceId?: string;
}

export interface LeaveParams {
  characterId: string;
  /** D4': who might stand in this way out, and the way out's own index in their blocking resource. Absent
   *  (every caller before D4'): nothing blocks. */
  blockers?: readonly LeaveBlocker[];
  wayOutIndex?: number;
  /** D4': a blocker holds the way only while her posture is above `standsAbove` (C1's line) and her sight
   *  above `seesAbove` (D12's line); either one unmodelled counts as standing and seeing. Handed in, never known
   *  here. */
  standsAbove?: number;
  seesAbove?: number;
  /** `null` for a route with no explicit "open" step of its own -- an
   *  ELABORABLE_EXITS route (WORLD-ELABORATION-DESIGN.md §4.3): nobody
   *  "opens" a dug hole; it is simply passable once its part's integrity
   *  reaches the declared threshold, exactly the second half of this
   *  mechanic's own `left` rule below, already true for the door/window
   *  before this field could ever be `null`. */
  passageResourceId: string | null;
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
    const passage = p.passageResourceId ? numericFactFrom(input.constraint.mustHonor, p.passageResourceId, "value") : null;
    const integrity = numericFactFrom(input.constraint.mustHonor, p.integrityResourceId, "value");
    const passable = passage === 1 || integrity === 0;
    // PLAYTEST-2026-09-27 D4': a passable way is still held by a blocker who stands in it -- in this place, on
    // her feet, able to see -- every fact read live, at t.
    const here = factFrom(input, p.characterId, "location_id");
    const live = (resourceId: string | undefined): number | null => (resourceId ? numericFactFrom(input.constraint.mustHonor, resourceId, "value") : null);
    const blocker = (p.blockers ?? []).find((b) => {
      if (!p.wayOutIndex || live(b.blockingResourceId) !== p.wayOutIndex) return false;
      const there = factFrom(input, b.characterId, "location_id");
      if (here === null || there === null || here !== there) return false;
      const posture = live(b.postureResourceId);
      const sight = live(b.sightResourceId);
      return (posture === null || posture > (p.standsAbove ?? -Infinity)) && (sight === null || sight > (p.seesAbove ?? -Infinity));
    });
    const left = passable && blocker === undefined;
    return {
      changes: left ? [{ kind: "set", entityId: p.characterId, key: "location_id", value: p.destinationId }] : [],
      result: { mechanic: "OPEN_LEAVE", left, ...(left ? { destinationId: p.destinationId } : {}), ...(passable && blocker ? { held: "blocked", blockerId: blocker.characterId } : {}) },
      description: p.description,
    };
  },
};

export interface BlockParams {
  /** The actor's own blocking resource (`world.ts`'s `blocking`). */
  resourceId: string;
  /** The way out's 1-based index, or 0 to stand clear. */
  index: number;
  max: number;
  /** The way out's id, for the record; absent on a lapse. */
  wayOut?: string;
  description: string;
}

/** PLAYTEST-2026-09-27 D4' (RED-TEAM.md F4, F11): stand in a way out -- one `write` of the actor's own blocking
 *  resource to the way out's index (0 stands clear). One body, one doorway: the resource holds one index. The
 *  loop writes index 0 through this same mechanic when a block lapses (an occupation). */
export const OPEN_BLOCK: Mechanic = {
  name: "OPEN_BLOCK",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as BlockParams;
    const before = currentValue(input, p.resourceId);
    return {
      changes: [setResource(p.resourceId, p.index, 0, p.max)],
      result: { mechanic: "OPEN_BLOCK", resourceId: p.resourceId, before, after: p.index, ...(p.wayOut ? { wayOut: p.wayOut } : {}) },
      description: p.description,
    };
  },
};

export interface MoveParams {
  characterId: string;
  destinationId: string;
  description: string;
}

/** PLAYTEST-2026-09-27 D5 (RED-TEAM.md F10): the game moves a principal -- one `set` of her location, the change
 *  `OPEN_LEAVE` makes, with no exit involved (the absence cadence's out and back; the door stays as it is).
 *  Still an audited resolution through the one choke point, never a direct write. */
export const OPEN_MOVE: Mechanic = {
  name: "OPEN_MOVE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as MoveParams;
    return {
      changes: [{ kind: "set", entityId: p.characterId, key: "location_id", value: p.destinationId }],
      result: { mechanic: "OPEN_MOVE", destinationId: p.destinationId },
      description: p.description,
    };
  },
};

export interface TakeParams {
  itemId: string;
  actorId: string;
  /** Each person's posture resource by character id, where one exists. */
  postureOf: Readonly<Record<string, string>>;
  /** docs/CUSTODY-DESIGN.md, C1 = A: a holder whose posture stands at or
   *  above this keeps what she holds. Handed in, never known here. */
  keptAtOrAbove: number;
  /** PLAYTEST-2026-09-27 D12: each person's sight resource by character id, and the line at or below which she
   *  cannot see -- a holder who cannot see keeps nothing. Absent: sight is not modelled. */
  sightOf?: Readonly<Record<string, string>>;
  blindAtOrBelow?: number;
  description: string;
}

export interface GiveParams {
  itemId: string;
  actorId: string;
  recipientId: string;
  description: string;
}

export interface SearchParams {
  personId: string;
  /** Every concealable object with an item behind it; only the ones the
   *  person holds at t are uncovered. */
  candidates: readonly { objectId: string; itemId: string; resourceId: string; min: number; max: number }[];
  description: string;
}

/** A non-numeric fact's value (an owner, a location) from the facts a
 *  mechanic is handed, or `null` when none holds. */
function factFrom(input: AdjudicationInput, entityId: string, key: string): string | null {
  return input.constraint.mustHonor.find((f) => f.entityId === entityId && f.key === key)?.value ?? null;
}

/** Who holds an item at t, read from its own `owner_id`/`owner_type` -- the
 *  engine's columns, never a map kept here. `null` when either is missing. */
function holderOf(input: AdjudicationInput, itemId: string): { id: string; type: string } | null {
  const id = factFrom(input, itemId, "owner_id");
  const type = factFrom(input, itemId, "owner_type");
  return id !== null && type !== null ? { id, type } : null;
}

function setOwner(itemId: string, characterId: string): IntendedChange[] {
  return [
    { kind: "set", entityId: itemId, key: "owner_id", value: characterId },
    { kind: "set", entityId: itemId, key: "owner_type", value: "character" },
  ];
}

/**
 * docs/CUSTODY-DESIGN.md: the actor comes to hold a thing -- one `set` of the
 * item's owner, inside the resolution, the change kind `OPEN_LEAVE` uses for a
 * character's place. C1 = A: a thing another PERSON holds moves only while her
 * posture stands below `keptAtOrAbove`; a person with no posture modelled
 * counts as on her feet (nothing says otherwise, and refusing is the safe
 * direction). A thing that lies anywhere else moves -- whether the actor could
 * perceive it was the plan's gate (`effects.ts`). Reads only the constraint it
 * is handed; a refused take changes nothing and says why in `result`.
 */
export const OPEN_TAKE: Mechanic = {
  name: "OPEN_TAKE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as TakeParams;
    const holder = holderOf(input, p.itemId);
    const refuse = (refused: string, fromId?: string): Adjudication => ({ changes: [], result: { mechanic: "OPEN_TAKE", taken: false, refused, ...(fromId ? { fromId } : {}) }, description: p.description });
    if (!holder) return refuse("no-holder");
    if (holder.type === "character" && holder.id === p.actorId) return refuse("already-held");
    if (holder.type === "character") {
      const postureId = p.postureOf[holder.id];
      const posture = postureId ? numericFactFrom(input.constraint.mustHonor, postureId, "value") : null;
      const sightId = p.sightOf?.[holder.id];
      const sight = sightId ? numericFactFrom(input.constraint.mustHonor, sightId, "value") : null;
      const sees = sight === null || p.blindAtOrBelow === undefined || sight > p.blindAtOrBelow;
      if ((posture === null || posture >= p.keptAtOrAbove) && sees) return refuse("holder-on-her-feet", holder.id);
    }
    return {
      changes: setOwner(p.itemId, p.actorId),
      result: { mechanic: "OPEN_TAKE", taken: true, ...(holder.type === "character" ? { fromId: holder.id } : {}) },
      description: p.description,
    };
  },
};

/** docs/CUSTODY-DESIGN.md: the actor hands a thing she holds to the other
 *  principal, who must be present -- the same place, read from each
 *  character's own `location_id` at t, exactly as presence reads it. */
export const OPEN_GIVE: Mechanic = {
  name: "OPEN_GIVE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as GiveParams;
    const holder = holderOf(input, p.itemId);
    const refuse = (refused: string): Adjudication => ({ changes: [], result: { mechanic: "OPEN_GIVE", given: false, refused }, description: p.description });
    if (!holder || holder.type !== "character" || holder.id !== p.actorId) return refuse("not-held");
    const here = factFrom(input, p.actorId, "location_id");
    const there = factFrom(input, p.recipientId, "location_id");
    if (here === null || there === null || here !== there) return refuse("recipient-absent");
    return { changes: setOwner(p.itemId, p.recipientId), result: { mechanic: "OPEN_GIVE", given: true }, description: p.description };
  },
};

/** docs/CUSTODY-DESIGN.md: a search -- every thing the person holds at t loses
 *  its concealment, set to its floor in the same resolution, so it is
 *  perceived. A thing she does not hold keeps its own; nothing changes hands. */
export const OPEN_SEARCH: Mechanic = {
  name: "OPEN_SEARCH",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as SearchParams;
    const changes: IntendedChange[] = [];
    const uncovered: string[] = [];
    for (const c of p.candidates) {
      const holder = holderOf(input, c.itemId);
      if (!holder || holder.type !== "character" || holder.id !== p.personId) continue;
      uncovered.push(c.objectId);
      if (currentValue(input, c.resourceId) > c.min) changes.push(setResource(c.resourceId, c.min, c.min, c.max));
    }
    return { changes, result: { mechanic: "OPEN_SEARCH", personId: p.personId, uncovered }, description: p.description };
  },
};

export interface AcquireParams {
  /** Carried straight into `result` -- the mechanic never interprets either;
   *  content-typed (`OpenPropertyKey`/`DifficultyBand`) at the caller
   *  (`loop.ts`), plain strings here, matching this file's own header:
   *  "these mechanics hold no scenario content of their own." */
  need: string;
  band: string;
  bandSource: "model" | "author";
  /** The target's location -- every §4.1 property's own resource is owned
   *  the same way (`world.ts`'s `boundedResolveOnly`). */
  ownerId: string;
  resourceName: string;
  /** The band's own initial value (§4.3) -- the create leg's `value`, BEFORE
   *  the wear leg below ever runs. */
  initialValue: number;
  min: number;
  max: number;
  /** The band's wear at the ruled magnitude (§4.4 leg 2): "the first scrape
   *  counts." */
  wearAmount: number;
  suspicionResourceId: string;
  /** 0 when the perceptibility rules make no suspicion eligible -- leg 3 is
   *  then omitted entirely, exactly as `loop.ts`'s own `bumpWardenSuspicion`
   *  is a no-op for `amount <= 0`. */
  suspicionAmount: number;
  description: string;
}

const ACQUIRE_REF = "property:acquired";

/**
 * WORLD-ELABORATION-DESIGN.md §4.4: one resolution -- create the resource
 * under `ref: "property:acquired"` at the band's initial value, carrying
 * run-dmcp 0.9.0's `constraints` (issue #42) so it is `bounded` and
 * `resolve_only` from the instant it exists, inside this SAME transaction
 * (never a second, post-`resolve()` declaration -- the wart `adoptDerivedObject`
 * still carries for the OLDER `create` path, and exactly what issue #42 was
 * filed to remove for this, its second caller); wear it by the ruled
 * magnitude (leg 2, pre-clamped and written with `mode: "set"`, matching
 * `OPEN_WEAR`'s own style exactly -- "the first scrape counts," never a
 * separate act); then, only when eligible, bump `warden_suspicion` by the
 * ordinary magnitude bump (leg 3) -- UNCLAMPED, a raw `delta` against the
 * bound `warden_suspicion` already carries from world setup, so a resolution
 * that would push it past 100 is rejected by the engine's own registered
 * constraint and the WHOLE resolution rolls back, including the create and
 * the wear: "if any leg violates a constraint the whole resolution rolls
 * back and nothing was acquired" (§4.4), proven by the engine's existing
 * protocol rather than re-implemented here.
 */
export const OPEN_ACQUIRE: Mechanic = {
  name: "OPEN_ACQUIRE",
  adjudicate(input: AdjudicationInput): Adjudication {
    const p = input.parameters as unknown as AcquireParams;
    const startValue = clamp(p.initialValue - p.wearAmount, p.min, p.max);
    const changes: IntendedChange[] = [
      {
        kind: "create",
        ref: ACQUIRE_REF,
        entityKind: "resource",
        columns: { owner_id: p.ownerId, owner_type: "location", name: p.resourceName, value: p.initialValue, min_value: p.min, max_value: p.max, created_at: new Date().toISOString() },
        constraints: [
          { kind: "bounded", key: "value", minValue: p.min, maxValue: p.max },
          { kind: "resolve_only", key: "value" },
        ],
      },
      setResource({ ref: ACQUIRE_REF }, startValue, p.min, p.max),
    ];
    if (p.suspicionAmount > 0) {
      changes.push({ kind: "write", entityId: p.suspicionResourceId, key: "value", mode: "delta", value: p.suspicionAmount, bounds: { minValue: 0, maxValue: 100 } });
    }
    return {
      changes,
      result: { mechanic: "OPEN_ACQUIRE", acquired: true, need: p.need, band: p.band, bandSource: p.bandSource, startValue },
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
  return createResolver({
    mechanics: [OPEN_WEAR, OPEN_RESTORE, OPEN_REVEAL, OPEN_NOISE, OPEN_PASSAGE, OPEN_LEAVE, OPEN_DERIVE, OPEN_ACQUIRE, OPEN_TAKE, OPEN_GIVE, OPEN_SEARCH, OPEN_CONCEAL_CONTAINER, OPEN_EXPOSE_CONTAINER, OPEN_BLOCK, OPEN_MOVE],
  });
}
