import type { OpenObjectProperty, OpenPropertyKey } from "./scenarioObjects.js";

/**
 * The derivable kinds (OPEN-VARIANT.md §13.3) -- content, like
 * `scenarioObjects.ts`, never mechanism. A kind names the one parent it
 * comes from, the parent's property the derivation consumes (or nothing),
 * an authored physical description written the way §4.1 writes everything
 * (material, size, wear; never what it is for), and the properties a
 * derived object of this kind carries, each with the same bounded shape and
 * magnitude tables every §4.1 property has.
 *
 * WHAT A DERIVED OBJECT IS FOR IS NOT DECLARED (§13.3). Whether a length of
 * wire pushes a bolt back is the referee's ruling on an `open` intent
 * against the door (OPEN-VARIANT.md §17.2: the way out, not its lock),
 * grounded on the door's own text -- exactly as O1 never
 * verified the spoon was to hand for "file the bar with my spoon".
 *
 * EVERY KIND CARRIES `concealment` so §10.1's perception rule applies
 * unchanged (§13.6, decision 4): the holder always perceives it; the other
 * principal perceives it unless it is concealed at 50 or more.
 *
 * CONSUMPTION IS THE PARENT'S OWN WEAR TABLE (§13.6, decision 3): a derive
 * at a magnitude wears the consumed property by what a `wear` at that
 * magnitude would. Nothing here authors a number for it.
 */
export type DerivedProperty = Omit<OpenObjectProperty, "resourceName">;

export interface DerivableKind {
  /** The id a derived object of this kind gets (`wire`, then `wire_2`...). */
  id: string;
  /** How the actor's own outcome names it: "made a length of wire". */
  label: string;
  /** What it comes from: a §4.1 object id, or (OPEN-VARIANT.md §14.1) another
   *  derivable kind's id, in which case the ruling's target is any derived
   *  object of that kind, matched by its recorded kind. */
  parent: string;
  /** OPEN-VARIANT.md §14.2: the parent is reshaped, not taken from. One
   *  resolution destroys it (item and every resource) and creates this, held
   *  by whoever held the parent, carrying over every property both kinds
   *  declare. Such a kind consumes nothing. */
  replacesParent: boolean;
  /** The parent's property the derivation wears, or `null` for a kind that
   *  takes nothing measurable from its parent. */
  consumes: OpenPropertyKey | null;
  /** Authored, physical. */
  description: string;
  properties: readonly DerivedProperty[];
}

// Magnitude tables authored in the same proportion as the blanket thread and
// cot wire (OPEN-VARIANT.md §9.1), the nearest siblings; concealment in the
// spoon's own proportion (§9.1).
const INTEGRITY: DerivedProperty = {
  key: "integrity",
  min: 0,
  max: 100,
  initialValue: 100,
  wear: { slight: 10, moderate: 20, substantial: 35 },
  restore: { slight: 20, moderate: 50, substantial: 100 },
};
const CONCEALMENT: DerivedProperty = {
  key: "concealment",
  min: 0,
  max: 100,
  initialValue: 0,
  wear: { slight: 20, moderate: 50, substantial: 100 },
  restore: { slight: 20, moderate: 50, substantial: 100 },
};

export const DERIVABLE_KINDS: readonly DerivableKind[] = [
  {
    id: "wire",
    label: "length of wire",
    parent: "cot",
    replacesParent: false,
    consumes: "integrity",
    description:
      "A length of stiff iron wire about a hand long, untwisted from a spring, with a kink at one end where it " +
      "was worked back and forth.",
    properties: [INTEGRITY, CONCEALMENT],
  },
  {
    id: "strip",
    label: "strip of wool",
    parent: "blanket",
    replacesParent: false,
    consumes: "integrity",
    description: "A strip of coarse grey wool about an arm long, torn along the hem, with loose threads at both ends.",
    properties: [INTEGRITY, CONCEALMENT],
  },
  {
    id: "grit",
    label: "handful of grit",
    parent: "loose_tile",
    replacesParent: false,
    consumes: null,
    description: "A handful of dry grit from the hollow beneath the tile, coarse and sharp-grained.",
    properties: [CONCEALMENT],
  },
  // OPEN-VARIANT.md §14.5 -- content, awaiting the owner's approval of wording.
  {
    id: "hook",
    label: "hook",
    parent: "wire",
    replacesParent: true,
    consumes: null,
    description:
      "A length of stiff iron wire about a hand long, bent back on itself at one end into a narrow hook, the rust flaked away along the bend.",
    properties: [INTEGRITY, CONCEALMENT],
  },
  {
    id: "cord",
    label: "cord",
    parent: "strip",
    replacesParent: true,
    consumes: null,
    description: "A cord of coarse grey wool about an arm long, twisted tight on itself and knotted at both ends.",
    properties: [INTEGRITY, CONCEALMENT],
  },
];

export const DERIVABLE_KIND_IDS: readonly string[] = DERIVABLE_KINDS.map((k) => k.id);

export function findKind(id: string): DerivableKind | undefined {
  return DERIVABLE_KINDS.find((k) => k.id === id);
}

/** How a kind's parent is named in prose: a §4.1 object by its id with
 *  underscores as spaces ("loose tile"), a kind by its label ("length of
 *  wire", §14.3). */
export function parentLabel(kind: DerivableKind): string {
  return findKind(kind.parent)?.label ?? kind.parent.replace(/_/g, " ");
}

/** OPEN-VARIANT.md §13.2: composed by code from two authored texts -- the
 *  kind's own description and the span the referee cited from the parent.
 *  Every later citation against the new object is a quote of text a human
 *  wrote. `parentLabel` is the parent's id with underscores as spaces. */
export function composeDescription(kind: DerivableKind, parentLabel: string, citedSpan: string): string {
  return `${kind.description} It came away from the ${parentLabel}, where "${citedSpan}".`;
}
