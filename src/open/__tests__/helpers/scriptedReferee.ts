import type { ReaderTransport } from "run-dmcp";

/**
 * A scripted referee transport for tests: rules on an intent by looking it up
 * verbatim in a table the TEST wrote, the way a real referee model would read
 * it. Test content only -- production code never keys anything off prose.
 * An intent missing from the table gets no answers, so every question falls
 * to its safe default and the attempt does nothing.
 */
export type ScriptedRuling = {
  target: string;
  effect: string;
  property: string;
  magnitude: string;
  perceptibility: string;
  /** OPEN-VARIANT.md §13.1's sixth question; `none` when absent. */
  product?: string;
  intentQuote: string;
  descQuote: string;
};

export function scriptedReferee(byIntent: Record<string, ScriptedRuling>): ReaderTransport {
  return async (request) => {
    const intent = request.sources.find((s) => s.id === "intent")?.text ?? "";
    const script = byIntent[intent];
    if (!script) return [];
    return request.questions.map((q) => ({
      questionId: q.id,
      answerKey: (script as Record<string, string | undefined>)[q.id] ?? "none",
      citation: q.id === "property" ? { sourceId: `desc:${script.target}`, quote: script.descQuote } : { sourceId: "intent", quote: script.intentQuote },
    }));
  };
}

export const SCRAPE = "I scrape at the rusted base of the bar with my spoon.";
export const EXAMINE = "I examine the bar closely.";
export const WAIT = "I sit on the cot and wait.";
export const OPEN_DOOR = "I work the flattened spoon into the gap and lever the bolt back.";
export const LEAVE_DOOR = "I slip out through the open door.";
export const LEAVE_WINDOW = "I climb out through the window where the bar was.";
export const CUT_WIRE = "I untwist a length of wire from the cot's springs.";
export const TAKE_GRIT = "I scoop a handful of grit from the hollow under the loose tile.";
export const HIDE_WIRE = "I tuck the wire away under the loose tile.";
export const BEND_WIRE = "I bend the wire back and forth to straighten it.";
export const PUSH_BOLT_WITH_WIRE = "I push the wire into the gap and slide the bolt back.";
export const BEND_HOOK = "I bend the end of the wire back into a hook.";
export const TWIST_CORD = "I twist the strip of wool into a tight cord.";
export const TEAR_STRIP = "I tear a strip from the hem of the blanket.";
export const LIFT_TILE = "I lift the loose tile and dig through the grit beneath it.";
export const EASE_TILE = "I ease the loose tile up a little at one corner.";
export const HIDE_NOTES = "I push the banknotes back down into the grit.";

export const RULINGS: Record<string, ScriptedRuling> = {
  [SCRAPE]: {
    target: "bar",
    effect: "wear",
    property: "integrity",
    magnitude: "substantial",
    perceptibility: "audible",
    intentQuote: "scrape at the rusted base of the bar",
    descQuote: "Rust has pitted it near the bottom",
  },
  [EXAMINE]: {
    target: "bar",
    effect: "reveal",
    property: "integrity",
    magnitude: "slight",
    perceptibility: "visible",
    intentQuote: "examine the bar closely",
    descQuote: "Rust has pitted it near the bottom",
  },
  [OPEN_DOOR]: {
    target: "lock",
    effect: "open",
    property: "passage",
    magnitude: "moderate",
    perceptibility: "silent",
    intentQuote: "lever the bolt back",
    descQuote: "the edge of the bolt shows in the gap",
  },
  [LEAVE_DOOR]: {
    target: "lock",
    effect: "leave",
    property: "none",
    magnitude: "slight",
    perceptibility: "visible",
    intentQuote: "slip out through the open door",
    descQuote: "A steel lock set in the cell door",
  },
  [LEAVE_WINDOW]: {
    target: "bar",
    effect: "leave",
    property: "none",
    magnitude: "slight",
    perceptibility: "visible",
    intentQuote: "climb out through the window",
    descQuote: "the cell's small window",
  },
  [CUT_WIRE]: {
    target: "cot",
    effect: "derive",
    product: "wire",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "audible",
    intentQuote: "untwist a length of wire",
    descQuote: "the springs are held to the frame by twists of wire",
  },
  [TAKE_GRIT]: {
    target: "loose_tile",
    effect: "derive",
    product: "grit",
    property: "none",
    magnitude: "slight",
    perceptibility: "silent",
    intentQuote: "scoop a handful of grit",
    descQuote: "a shallow hollow of dry grit",
  },
  [HIDE_WIRE]: {
    target: "wire",
    effect: "conceal",
    property: "concealment",
    magnitude: "substantial",
    perceptibility: "silent",
    intentQuote: "tuck the wire away",
    descQuote: "A length of stiff iron wire",
  },
  [BEND_WIRE]: {
    target: "wire",
    effect: "wear",
    property: "integrity",
    magnitude: "slight",
    perceptibility: "silent",
    intentQuote: "bend the wire back and forth",
    descQuote: "with a kink at one end",
  },
  [BEND_HOOK]: {
    target: "wire",
    effect: "derive",
    product: "hook",
    property: "none",
    magnitude: "slight",
    perceptibility: "audible",
    intentQuote: "bend the end of the wire back into a hook",
    descQuote: "with a kink at one end",
  },
  [TWIST_CORD]: {
    target: "strip",
    effect: "derive",
    product: "cord",
    property: "none",
    magnitude: "slight",
    perceptibility: "silent",
    intentQuote: "twist the strip of wool into a tight cord",
    descQuote: "with loose threads at both ends",
  },
  [TEAR_STRIP]: {
    target: "blanket",
    effect: "derive",
    product: "strip",
    property: "integrity",
    magnitude: "slight",
    perceptibility: "silent",
    intentQuote: "tear a strip from the hem",
    descQuote: "frayed along the hem",
  },
  [LIFT_TILE]: {
    target: "loose_tile",
    effect: "expose",
    property: "concealment",
    magnitude: "substantial",
    perceptibility: "audible",
    intentQuote: "lift the loose tile and dig through the grit",
    descQuote: "beneath it is a shallow hollow of dry grit about the size of a hand",
  },
  [EASE_TILE]: {
    target: "loose_tile",
    effect: "expose",
    property: "concealment",
    magnitude: "moderate",
    perceptibility: "silent",
    intentQuote: "ease the loose tile up a little",
    descQuote: "It rocks underfoot",
  },
  [HIDE_NOTES]: {
    target: "banknotes",
    effect: "conceal",
    property: "concealment",
    magnitude: "substantial",
    perceptibility: "silent",
    intentQuote: "push the banknotes back down into the grit",
    descQuote: "A fold of banknotes wrapped in a strip of oilcloth",
  },
  [PUSH_BOLT_WITH_WIRE]: {
    target: "lock",
    effect: "open",
    property: "passage",
    magnitude: "moderate",
    perceptibility: "silent",
    intentQuote: "slide the bolt back",
    descQuote: "the edge of the bolt shows in the gap",
  },
};
