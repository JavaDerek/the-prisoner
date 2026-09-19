import type { DifficultyBand } from "./elaborationBands.js";
import type { OpenPropertyKey, MagnitudeTable } from "./scenarioObjects.js";

/**
 * WORLD-ELABORATION-DESIGN.md §4.3: the band -> numbers table -- content,
 * the owner's to set, never mechanism (`OPEN_ACQUIRE` in `mechanics.ts`
 * reads only what `bandNumbersFor` hands it, and holds no scenario content
 * of its own, exactly as every other mechanic in that file). Keyed by
 * property KIND (the `need` an elaboration ruling names, `elaborationReferee.ts`)
 * and `DifficultyBand` (the build-time table's own reading,
 * `elaborationBands.ts` -- read from an object's description alone, before
 * play, §4.2a). Shaped like `OpenObjectProperty` minus `key`/`resourceName`,
 * both of which are assigned at acquisition time from the object and the
 * need, never authored here (§4.3: "the shape is OpenObjectProperty minus
 * key").
 *
 * AUTHORING RULE (§4.3, enforced structurally, not by convention): "the
 * `reads` line at a band's start value is EMPTY." `readRanges` (never
 * `reads`) is what makes this automatic -- a range fires only strictly
 * BELOW the initial value (`atOrBelow: initialValue - 1`), so a value AT
 * the initial reads as nothing (`briefing.ts`'s own `describedAsItStands`
 * already renders "nothing" for a property with no matching reading), and a
 * `restore` back to the initial value reads as nothing again. In practice a
 * fresh acquisition is never actually read at its initial value anyway --
 * §4.4's leg 2 always wears it in the SAME resolution that creates it -- so
 * this rule's real work is protecting the `restore` case §4.3 also names
 * ("a warden can fill a hollow back in").
 *
 * ONLY `integrity` IS AUTHORED HERE (§4.3's own proposed defaults: "Proposed
 * defaults for `integrity` acquired on a thing to be worn through"). A
 * `need` this scenario has not yet priced in numbers (`edge`, `concealment`,
 * `passage`) has no row here, so `bandNumbersFor` returns `undefined` for
 * it and the caller (`loop.ts`'s `tryAcquire`) refuses the acquisition --
 * the same "not yet authored, so nothing happens" discipline every other
 * content gap in this game already keeps (`declaredProperty` returning
 * `undefined`, `lookupBand` returning `undefined`). Never invented silently.
 *
 * `restore` mirrors the closed variant's own convention for every existing
 * `integrity` property in `scenarioObjects.ts` (bar/lock/cot/blanket, all
 * `{ slight: 20, moderate: 50, substantial: 100 }` against a max of 100 --
 * `substantial` always reaches `max` from `min` in one step, carrying over
 * REPLACE_BAR/SERVICE_LOCK's own `setResource(..., 100)`): the same
 * 20%/50%/100%-of-max proportion, scaled down for `trivial`'s own smaller
 * max (20).
 */
export interface BandNumbers {
  min: number;
  max: number;
  initialValue: number;
  wear: MagnitudeTable;
  restore: MagnitudeTable;
  readRanges: readonly { readonly atOrBelow: number; readonly text: string }[];
}

type PricedBand = Exclude<DifficultyBand, "impossible">;

// §4.3's table verbatim: trivial 20 / wear 10-20-30 (turns to zero at
// moderate: 1); hard 100 / wear 5-10-15 (10); ruinous 100 / wear 1-2-3 (50).
const INTEGRITY_BANDS: Readonly<Record<PricedBand, BandNumbers>> = {
  trivial: {
    min: 0,
    max: 20,
    initialValue: 20,
    wear: { slight: 10, moderate: 20, substantial: 30 },
    restore: { slight: 4, moderate: 10, substantial: 20 },
    readRanges: [{ atOrBelow: 19, text: "The grit beneath lifts at a touch." }],
  },
  hard: {
    min: 0,
    max: 100,
    initialValue: 100,
    wear: { slight: 5, moderate: 10, substantial: 15 },
    restore: { slight: 20, moderate: 50, substantial: 100 },
    readRanges: [{ atOrBelow: 99, text: "The packed grit beneath is scraped, and gives slowly." }],
  },
  ruinous: {
    min: 0,
    max: 100,
    initialValue: 100,
    wear: { slight: 1, moderate: 2, substantial: 3 },
    restore: { slight: 20, moderate: 50, substantial: 100 },
    readRanges: [{ atOrBelow: 99, text: "The packed grit beneath is scratched, a grain at a time." }],
  },
};

const BAND_NUMBERS: Partial<Record<OpenPropertyKey, Readonly<Record<PricedBand, BandNumbers>>>> = {
  integrity: INTEGRITY_BANDS,
};

/** `undefined` for a `need`/`band` this scenario has not authored numbers
 *  for -- see this file's header. `band` is never `"impossible"`: that band
 *  is a refusal (§4.2, "a build-time table of impossible... is not a
 *  price"), so `tryAcquire` (`loop.ts`) never calls this with one. */
export function bandNumbersFor(need: OpenPropertyKey, band: PricedBand): BandNumbers | undefined {
  return BAND_NUMBERS[need]?.[band];
}

/**
 * §4.3's `ELABORABLE_EXITS` verbatim: which objects a dug or forced route
 * could open, and to where. Declared, never stated to a mind, and not in
 * any condition list -- play decides whether it is ever acquired. This
 * table only says what WOULD happen if `integrity` is acquired on the
 * named object and worn to the threshold; `buildOpenWorld` creates the
 * corridor location and `adoptAcquiredProperty` (`world.ts`) resolves
 * `destination` by name against the world's own `namedLocations`, so no
 * location id is content here.
 */
export const ELABORABLE_EXITS: Readonly<Record<string, { destination: string; openWhenIntegrityAtMost: number }>> = {
  loose_tile: { destination: "corridor", openWhenIntegrityAtMost: 0 },
};
