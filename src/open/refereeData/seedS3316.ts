import { findObject } from "../scenarioObjects.js";
import { quoteToRange } from "./citationRange.js";
import type { LabelCitation, RefereeLabel } from "./types.js";

/**
 * The-prisoner#10's first seed corpus: §33.16's 26 intents
 * (`checkpoints/2026-09-16-referee-removal-s33-16/referee-intents.txt`,
 * `build-requests.mts`'s own `INTENTS` array), on the fixed scene that
 * checkpoint used -- every §4.1 object except the two principals and
 * `banknotes` (presence was not yet modelled when this corpus was
 * recorded).
 *
 * PROVENANCE, HONESTLY SPLIT IN TWO (the issue's own instruction: "only the
 * expected effect is known from §33.16 -- for the other answers, derive
 * them from the recorded rulings where the recorded ruling is
 * known-correct, and mark provenance honestly"):
 *
 * - `effect` is §33.16's OWN pre-registered expectation, unchanged (the one
 *   thing the checkpoint itself asserts).
 * - `target`/`product`/`property`/`magnitude`/`perceptibility` are read off
 *   `out-qwen3-base-N3.txt` -- qwen3:14b's own RECORDED, KNOWN-CORRECT
 *   ruling (the referee this project actually shipped after §33.16,
 *   scoring 24 of 26 on this exact set) -- for every row where its `effect`
 *   answer matches this corpus's own expectation. The two rows it MISSED
 *   (`s33.16-17`, `s33.16-22`) get the DESIGN's intended answer instead,
 *   never the model's own wrong one; each says so in its own `note`.
 * - Every CITATION is freshly authored against TODAY's `scenarioObjects.ts`
 *   text, never copied from the checkpoint's own recorded request
 *   (`requests-26-intents.json`), which still carries the "Iron bars cross
 *   it" plural the-prisoner#26 removed on 2026-09-26 -- exactly the
 *   staleness this issue's "through the real code" requirement exists to
 *   avoid. Nobody has read these citations back against a live model; they
 *   are marked `audited: false` for that reason, and validated only
 *   mechanically (the renderer's `createTurnReader` check, run over this
 *   whole file as part of this task's own tests).
 *
 * `refereeArms` is `{}` throughout -- `createReferee`'s own bare defaults
 * (elision/container clause/instrument off, derive wording baseline),
 * because §33.16 predates every one of those arms; asking today's DEFAULT
 * arms (elision/container-clause on) against this fixed scene would be a
 * different, unmeasured request.
 */

const PERCEIVED_IDS = ["window", "bar", "door", "lock", "spoon", "loose_tile", "cot", "blanket", "bucket", "meal_tray", "key_ring"] as const;

const BAR_GROUNDS = "Rust has pitted it near the bottom, where it is set into old mortar that is dry and cracked.";
const WINDOW_GROUNDS = "with that bar gone, a person could climb through";
const DOOR_GROUNDS = "the edge of the bolt shows in the gap";
const COT_GROUNDS = "the springs are held to the frame by twists of wire";
const TILE_GROUNDS = "beneath it is a shallow hollow of dry grit about the size of a hand";
const BLANKET_GROUNDS = "thick and coarse";

const AUDITED_FALSE_NOTE =
  "target/product/property/magnitude/perceptibility read off out-qwen3-base-N3.txt's recorded (known-correct) ruling; citations authored fresh against current scenarioObjects.ts text; not independently audited.";

interface Row {
  id: string;
  intentText: string;
  target: string;
  effect: string;
  product: string;
  property: string;
  magnitude: "slight" | "moderate" | "substantial";
  perceptibility: "silent" | "audible" | "visible";
  targetSpan: string;
  propertySourceId: string;
  propertyQuote: string;
  productSpan?: string;
  note: string;
}

// Effect/magnitude/perceptibility/product(when "none") are all cited by the
// WHOLE intent text -- always a verbatim substring of itself, so this
// choice can never fail the renderer's citation check regardless of
// wording. `targetSpan` and (for `derive`) `productSpan` are the words that
// actually distinguish one row from the next, so those are hand-picked.
const ROWS: Row[] = [
  { id: "s33.16-01", intentText: "Remove the bar", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-02", intentText: "Use the spoon to remove the bar", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "silent", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-03", intentText: "Pull the bar out of the window", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-04", intentText: "Take the bar out", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-05", intentText: "Use the spoon to pry the bar out of the mortar", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-06", intentText: "Use the spoon to lever the bar out of the mortar", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-07", intentText: "Attempt to remove the bar from the window", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-08", intentText: "Use the spoon to twist and remove the bar", target: "bar", effect: "open", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  {
    id: "s33.16-09",
    intentText: "Use the spoon to push back the bolt through the gap",
    target: "door",
    effect: "open",
    product: "none",
    property: "passage",
    magnitude: "moderate",
    perceptibility: "audible",
    targetSpan: "the bolt",
    propertySourceId: "desc:door",
    propertyQuote: DOOR_GROUNDS,
    note: `${AUDITED_FALSE_NOTE} Target cites "the bolt" (the door's own part named in the intent) for answer key "door", per this project's own rule that a citation is checked for being verbatim and correctly sourced, never for whether it lexically justifies the key (CLAUDE.md, "Never pattern-match meaning").`,
  },
  { id: "s33.16-10", intentText: "Continue abrading the bar with the spoon to reduce its integrity", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-11", intentText: "Use the spoon to scrape at the rusted bottom of the bar", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-12", intentText: "Use the spoon to damage the bar further", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-13", intentText: "Use the spoon to strike the bar repeatedly", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "substantial", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-14", intentText: "Use the spoon to chip away the mortar around the bar", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-15", intentText: "Examine the bar for signs of damage or wear", target: "bar", effect: "reveal", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "silent", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-16", intentText: "Climb out through the window", target: "window", effect: "leave", product: "none", property: "passage", magnitude: "moderate", perceptibility: "visible", targetSpan: "the window", propertySourceId: "desc:window", propertyQuote: WINDOW_GROUNDS, note: AUDITED_FALSE_NOTE },
  {
    id: "s33.16-17",
    intentText: "Climb through the window and escape",
    target: "window",
    effect: "leave",
    product: "none",
    property: "passage",
    magnitude: "moderate",
    perceptibility: "visible",
    targetSpan: "the window",
    propertySourceId: "desc:window",
    propertyQuote: WINDOW_GROUNDS,
    note: "One of §33.16's 2 misruled rows: qwen3:14b's own recorded output answered effect=open here, not leave. This label carries the DESIGN's intended answer (climbing through is always `leave`, even through a way out already open -- OPEN-VARIANT.md §30), never the model's own miss, so scoring this row against a live referee is a real test of that distinction.",
  },
  { id: "s33.16-18", intentText: "Squeeze through the gap in the window where the bar was", target: "window", effect: "leave", product: "none", property: "passage", magnitude: "moderate", perceptibility: "visible", targetSpan: "the window", propertySourceId: "desc:window", propertyQuote: WINDOW_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-19", intentText: "Get out through the window", target: "window", effect: "leave", product: "none", property: "passage", magnitude: "moderate", perceptibility: "visible", targetSpan: "the window", propertySourceId: "desc:window", propertyQuote: WINDOW_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-20", intentText: "Slip out of the open door", target: "door", effect: "leave", product: "none", property: "passage", magnitude: "slight", perceptibility: "silent", targetSpan: "the open door", propertySourceId: "desc:door", propertyQuote: DOOR_GROUNDS, note: AUDITED_FALSE_NOTE },
  { id: "s33.16-21", intentText: "Rub the spoon back and forth against the bar", target: "bar", effect: "wear", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "audible", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
  {
    id: "s33.16-22",
    intentText: "Grind at the bar with the spoon's edge to weaken it",
    target: "bar",
    effect: "wear",
    product: "none",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "audible",
    targetSpan: "the bar",
    propertySourceId: "desc:bar",
    propertyQuote: BAR_GROUNDS,
    note: "§33.16's other misruled row: qwen3:14b's own recorded output refused this one outright (target/effect/property all fell to `none`). This label carries the DESIGN's intended answer (grinding at the bar is wear on its integrity, the same shape as every other abrasion intent in this set), never the model's own refusal.",
  },
  {
    id: "s33.16-23",
    intentText: "Pull a length of wire from the cot springs and keep it",
    target: "cot",
    effect: "derive",
    product: "wire",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "silent",
    targetSpan: "the cot springs",
    propertySourceId: "desc:cot",
    propertyQuote: COT_GROUNDS,
    productSpan: "a length of wire",
    note: AUDITED_FALSE_NOTE,
  },
  { id: "s33.16-24", intentText: "Remove the loose tile to get at the hollow beneath it", target: "loose_tile", effect: "expose", product: "none", property: "concealment", magnitude: "moderate", perceptibility: "visible", targetSpan: "the loose tile", propertySourceId: "desc:loose_tile", propertyQuote: TILE_GROUNDS, note: AUDITED_FALSE_NOTE },
  {
    id: "s33.16-25",
    intentText: "Remove the blanket from the cot",
    target: "blanket",
    effect: "none",
    product: "none",
    property: "none",
    magnitude: "moderate",
    perceptibility: "visible",
    targetSpan: "the blanket",
    propertySourceId: "desc:blanket",
    propertyQuote: BLANKET_GROUNDS,
    note: `${AUDITED_FALSE_NOTE} §33.16 only asserted this row's effect is NOT "open" ("none-of-open"); "none" is qwen3:14b's own recorded (accepted) answer, kept as the label rather than reasoning ahead to whether today's custody vocabulary (take/give, added after this checkpoint) would now also fit -- that would be a different, unmeasured claim.`,
  },
  { id: "s33.16-26", intentText: "Rub grit from the hollow into the scratches on the bar to hide them", target: "bar", effect: "conceal", product: "none", property: "integrity", magnitude: "moderate", perceptibility: "silent", targetSpan: "the bar", propertySourceId: "desc:bar", propertyQuote: BAR_GROUNDS, note: AUDITED_FALSE_NOTE },
];

/** Resolves the source text a citation's `sourceId` names -- `"intent"` is
 *  this row's own intent text, `"desc:<id>"` is that scenario object's
 *  TODAY-authored description (`scenarioObjects.ts`) -- so `stampRange`
 *  below can compute the word range the issue's own schema asks for
 *  ("source id + word range") without a second, hand-copied text. */
function sourceTextFor(sourceId: string, intentText: string): string {
  if (sourceId === "intent") return intentText;
  const objectId = sourceId.replace(/^desc:/, "");
  const spec = findObject(objectId);
  if (!spec) throw new Error(`seedS3316: citation source "${sourceId}" is not a known scenario object`);
  return spec.description;
}

/** Stamps `from`/`to` onto a `{sourceId, quote}` citation, computed by the
 *  REAL `sourceWords` (via `quoteToRange`) -- never typed by hand, so a
 *  stamped range can never silently drift from the quote beside it. A quote
 *  that ends mid-word-with-trailing-punctuation attached (e.g. a sentence's
 *  own final "...cracked." token) does not resolve to a word-exact range --
 *  `sourceWords` never splits punctuation off a word, only whitespace, so a
 *  quote has to end exactly where a word does. Left as quote-only in that
 *  case (still a fully valid citation: `run-dmcp`'s own check is a literal
 *  substring test, never a word-boundary one) rather than forcing every
 *  hand-picked quote in this file to chase punctuation just to gain a range
 *  that is not this schema's only way to name a span. */
function stampRange(citation: LabelCitation, intentText: string): LabelCitation {
  if (citation.quote === undefined) return citation;
  const range = quoteToRange(sourceTextFor(citation.sourceId, intentText), citation.quote);
  return range ? { ...citation, ...range } : citation;
}

export function buildS3316Labels(): RefereeLabel[] {
  return ROWS.map((row) => ({
    id: row.id,
    split: "test",
    scene: { kind: "static", perceivedObjectIds: PERCEIVED_IDS },
    refereeArms: {},
    intentText: row.intentText,
    expected: {
      target: row.target,
      effect: row.effect,
      product: row.product,
      property: row.property,
      magnitude: row.magnitude,
      perceptibility: row.perceptibility,
      acts: null,
    },
    citations: {
      target: stampRange({ sourceId: "intent", quote: row.targetSpan }, row.intentText),
      effect: stampRange({ sourceId: "intent", quote: row.intentText }, row.intentText),
      product: stampRange({ sourceId: "intent", quote: row.productSpan ?? row.intentText }, row.intentText),
      property: stampRange({ sourceId: row.propertySourceId, quote: row.propertyQuote }, row.intentText),
      magnitude: stampRange({ sourceId: "intent", quote: row.intentText }, row.intentText),
      perceptibility: stampRange({ sourceId: "intent", quote: row.intentText }, row.intentText),
      acts: null,
    },
    provenance: {
      labeller: "claude (overnight 2026-09-27)",
      audited: false,
      source: "checkpoints/2026-09-16-referee-removal-s33-16/referee-intents.txt, build-requests.mts INTENTS, out-qwen3-base-N3.txt",
      note: row.note,
    },
  }));
}
