import { createHash } from "node:crypto";
import { OPEN_OBJECTS, findObject, type OpenObjectSpec, type OpenPropertyKey } from "./scenarioObjects.js";
import { PROPERTY_KEYS } from "./effects.js";

/**
 * Build-time band pricing (WORLD-ELABORATION-DESIGN.md §4.2a, §9 row P1).
 * `npm run price-world` (`priceWorldCli.ts`) is the ONLY writer of this
 * file's `ELABORATION_BANDS` data (an author's own hand-edit aside, see
 * below); every mind, referee and loop reads it through the functions here,
 * never the raw array.
 *
 * THE WHOLE POINT, restated because it is the thing every other detail here
 * protects: a band is read from an object's authored description ALONE, at
 * build time, before any game exists and with no intent in play -- so an
 * actor's own words can never reach a price. Nothing in this file, or in
 * `priceWorldCli.ts`, ever sees an intent. §4.2's play-time `need` question
 * (P1b, not built here) only ever LOOKS UP a band this file already holds;
 * it never asks for one.
 *
 * `need` VOCABULARY (§4.2a's table, §2's own "never a person as the
 * target"): the scenario's declared property vocabulary, `PROPERTY_KEYS`
 * from `effects.ts` -- `integrity`, `edge`, `concealment`, `passage` --
 * reused rather than retyped so this file cannot silently drift from the
 * referee's own property-answer vocabulary. `posture` is `scenarioObjects.ts`
 * own key for a PERSON's physical state and is already excluded from
 * `PROPERTY_KEYS`; nothing here re-derives that exclusion, which is the
 * point -- a person is never elaborated (§2).
 *
 * THREE ROW SHAPES, one discriminated union. A `review` row is what
 * `price-world` writes when its N=5 replay did not fully agree (§4.2a: "a
 * key below full agreement... with all five answers and citations"). A
 * `priced` row is either `bandSource: "model"` (full agreement, written by
 * `price-world` itself) or `bandSource: "author"` (the row an author sets by
 * hand, in this same file, after reading a `review` row's disagreement --
 * `comment` is required precisely so that hand-edit is never silent). §4.4's
 * own language is carried verbatim as the field name: "`bandSource: "model"
 * | "author"`".
 *
 * THE HASH (§4.2a: "the row carries a hash of the description it was read
 * from"). sha256 over the object's current authored `description`, hex --
 * chosen only because `node:crypto` ships it with no dependency; nothing
 * about the choice of algorithm matters beyond "changes when the text
 * changes, agrees when it doesn't". A row whose stored hash no longer
 * matches the live description is STALE (`elaborationBandProblems`), and
 * `assertElaborationBandsReady` is the one function that turns "stale" (or
 * "review", or simply "never priced") into a hard refusal to start -- the
 * function P1b's `PRISONER_ELABORATE` arm calls before a game may begin.
 */

export type DifficultyBand = "trivial" | "hard" | "ruinous" | "impossible";
export const DIFFICULTY_BANDS: readonly DifficultyBand[] = ["trivial", "hard", "ruinous", "impossible"];

/** A citation exactly as the referee's own (`refereeTransport.ts`'s
 *  `RangedCitation`) -- the engine's `{sourceId, quote}` plus the word range
 *  it was rebuilt from, when the reader cited by range. `null` only for a
 *  row whose every replay fell to the safe default (`impossible`) with
 *  nothing to cite -- §4.2a's own closing note: "`impossible` needs no
 *  citation review by the author unless a game's `need` answer lands on
 *  it". Deliberately NOT imported from `refereeTransport.ts`: this file has
 *  no other reason to depend on that module, and the shape is small enough
 *  to keep independent rather than couple two otherwise-unrelated files. */
export type BandCitation = { sourceId: string; quote: string; from?: number; to?: number };

interface PricedRowBase {
  status: "priced";
  objectId: string;
  need: OpenPropertyKey;
  band: DifficultyBand;
  scenarioRevision: string;
  descriptionHash: string;
}

/** Written only by `price-world`, never by hand. */
export interface ModelPricedRow extends PricedRowBase {
  bandSource: "model";
  citation: BandCitation | null;
  model: string;
}

/** Written only by an author's own hand-edit, in this file, after reading a
 *  `review` row -- `price-world` never produces one and (`priceWorldCli.ts`'s
 *  `mergeElaborationBands`) never overwrites one it finds. */
export interface AuthorPricedRow extends PricedRowBase {
  bandSource: "author";
  citation: BandCitation | null;
  /** No model read this row, by definition. */
  model: null;
  /** Required, not optional: an author-set row with no comment is exactly
   *  the silent hand-edit this file's whole discipline exists to prevent. */
  comment: string;
}

/** Written by `price-world` when its N replays did not fully agree
 *  (§4.2a). Never read as a price -- `lookupBand` returns `undefined` for
 *  one, and `elaborationBandProblems` reports it, until an author replaces
 *  it with an `AuthorPricedRow` by hand. */
export interface ReviewRow {
  status: "review";
  objectId: string;
  need: OpenPropertyKey;
  model: string;
  scenarioRevision: string;
  descriptionHash: string;
  /** Every one of the N replay's own accepted answers (post safe-default
   *  fallback, exactly what `KeyAgreement`'s own tally counted), so the
   *  author reviewing this row sees the actual disagreement rather than a
   *  summary of it. */
  replies: readonly { band: DifficultyBand; citation: BandCitation | null }[];
}

export type ElaborationBandRow = ModelPricedRow | AuthorPricedRow | ReviewRow;

export function isAuthorSet(row: ElaborationBandRow): row is AuthorPricedRow {
  return row.status === "priced" && row.bandSource === "author";
}

export function isModelRead(row: ElaborationBandRow): row is ModelPricedRow {
  return row.status === "priced" && row.bandSource === "model";
}

/** sha256/hex over the object's OWN authored text -- see this file's header. */
export function descriptionHash(description: string): string {
  return createHash("sha256").update(description, "utf8").digest("hex");
}

/** Every `(object, need)` pair this scenario could acquire a fact for: every
 *  object in `objects`, crossed with every `need` key it does NOT already
 *  declare (§4.1's trigger condition 2, mirrored here at build time rather
 *  than read from a running world -- `price-world` has no world, only the
 *  authored table). A caller with a smaller/fixture object list (every test
 *  in this repository's own `scenarioObjects.ts` style) gets the identical
 *  computation over its own objects, never the real scenario's by accident. */
export function acquirablePairs(objects: readonly OpenObjectSpec[] = OPEN_OBJECTS): readonly { objectId: string; need: OpenPropertyKey }[] {
  const pairs: { objectId: string; need: OpenPropertyKey }[] = [];
  for (const object of objects) {
    for (const need of PROPERTY_KEYS) {
      if (!object.properties.some((p) => p.key === need)) pairs.push({ objectId: object.id, need });
    }
  }
  return pairs;
}

export interface BandProblem {
  objectId: string;
  need: OpenPropertyKey;
  /** `missing`: no row at all for this pair (an empty table's own honest
   *  state, before `price-world` has ever run). `review`: §4.2a's
   *  disagreement, awaiting the author. `stale`: the row's `descriptionHash`
   *  no longer matches the object's live description. */
  reason: "missing" | "review" | "stale";
}

/** Every acquirable pair that is NOT safe to play against: never priced,
 *  still under review, or priced against a description that has since
 *  changed. An empty table (this file's own starting state) reports every
 *  acquirable pair as `missing` -- correctly, since nothing has been read
 *  yet; this is `assertElaborationBandsReady`'s own check, exposed
 *  separately so a caller (a test, or a report) can see every offending row
 *  rather than only the first one a throw would name. */
export function elaborationBandProblems(
  rows: readonly ElaborationBandRow[] = ELABORATION_BANDS,
  objects: readonly OpenObjectSpec[] = OPEN_OBJECTS
): BandProblem[] {
  const problems: BandProblem[] = [];
  for (const { objectId, need } of acquirablePairs(objects)) {
    const row = rows.find((r) => r.objectId === objectId && r.need === need);
    if (!row) {
      problems.push({ objectId, need, reason: "missing" });
      continue;
    }
    if (row.status === "review") {
      problems.push({ objectId, need, reason: "review" });
      continue;
    }
    const object = objects.find((o) => o.id === objectId) ?? findObject(objectId);
    const liveHash = object ? descriptionHash(object.description) : null;
    if (liveHash === null || row.descriptionHash !== liveHash) problems.push({ objectId, need, reason: "stale" });
  }
  return problems;
}

/** WORLD-ELABORATION-DESIGN.md §4.2a: "the arm refuses to start a game
 *  while any `review` entry stands" -- generalised here to every reason
 *  `elaborationBandProblems` reports, because a `missing` or `stale` row is
 *  the identical failure mode (no trustworthy price to look up) under a
 *  different name. This IS the refusal; P1b's `PRISONER_ELABORATE` arm
 *  calls it directly before a game may begin, per this task's brief
 *  ("export the check as a function P1b can call"). */
export function assertElaborationBandsReady(rows: readonly ElaborationBandRow[] = ELABORATION_BANDS, objects: readonly OpenObjectSpec[] = OPEN_OBJECTS): void {
  const problems = elaborationBandProblems(rows, objects);
  if (problems.length === 0) return;
  const named = problems.map((p) => `${p.objectId}.${p.need} (${p.reason})`).join(", ");
  throw new Error(`elaborationBands: cannot start with ${problems.length} unresolved row(s) -- ${named}. Run "npm run price-world", or set the review row by hand.`);
}

/**
 * Appendix C's second arm, `PRISONER_ELABORATE_BAND`: unset (the default,
 * meaning "the built table") or one of `DIFFICULTY_BANDS`. Overrides the
 * table's own reading for every acquisition in the game -- `tryAcquire`
 * (`loop.ts`) still requires a `priced` row to exist for the pair (a forced
 * value never fabricates provenance from nothing); it only replaces which
 * band that row's own numbers are read at. Exists for the §4.8 sweep and
 * for nothing else (Appendix C: "the override exists for the sweep... and
 * for nothing else").
 */
export function readElaborateBandMode(raw: string | undefined): DifficultyBand | undefined {
  if (raw === undefined || raw === "") return undefined;
  if ((DIFFICULTY_BANDS as readonly string[]).includes(raw)) return raw as DifficultyBand;
  throw new Error(`PRISONER_ELABORATE_BAND: unrecognised value ${JSON.stringify(raw)} -- must be one of ${DIFFICULTY_BANDS.join(", ")}, or unset (the built table)`);
}

/** The price itself, for P1b's play-time lookup (§4.2: "The price is not
 *  asked here; it was read at build (§4.2a) and is a lookup."). `undefined`
 *  for anything not a clean `priced` row -- a caller that reaches here with
 *  an unready table is already a bug `assertElaborationBandsReady` should
 *  have caught first. */
export function lookupBand(objectId: string, need: OpenPropertyKey, rows: readonly ElaborationBandRow[] = ELABORATION_BANDS): DifficultyBand | undefined {
  const row = rows.find((r) => r.objectId === objectId && r.need === need);
  return row && row.status === "priced" ? row.band : undefined;
}

/**
 * The data itself. Empty today, honestly: no `price-world` run has ever
 * been made against a real model (this task's brief -- "Make no model call
 * of any kind. No GPU tonight"), so every acquirable pair in `OPEN_OBJECTS`
 * is `missing`, and `assertElaborationBandsReady()` throws naming all of
 * them. That is the CORRECT behaviour for an unpriced scenario, not a bug
 * to work around here.
 *
 * The comments below are markers `priceWorldCli.ts`'s `spliceGeneratedRows`
 * looks for -- it rewrites only the text between them, verbatim, and never
 * touches a single line of this file outside that span. Do not remove or
 * reorder them by hand; an `AuthorPricedRow` an author sets by hand belongs
 * INSIDE the markers, beside the row it replaces, with its `comment` saying
 * so -- `mergeElaborationBands` (`priceWorldCli.ts`) reads it back out of
 * here on the next run and carries it forward untouched.
 */
export const ELABORATION_BANDS: readonly ElaborationBandRow[] = [
  // price-world: generated rows start
  // price-world: generated rows end
];
