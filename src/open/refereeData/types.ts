/**
 * the-prisoner#10: shared data shapes for the referee's own labels file, the
 * renderer (labels -> LoRA chat-messages JSONL) and the scorer (labels ->
 * X of N against a live referee). Kept as `type`s deliberately -- these
 * cross into `data/referee/labels.jsonl`, a checked-in file a person or a
 * trainer reads with no code at all, so the shapes here are the documented
 * contract for that file (docs/REFEREE-DATA.md), not an implementation
 * detail.
 *
 * SCOPE (the issue's own "Rule-applying roles only" decision): this module
 * ships labels for the REFEREE alone -- never the prisoner or warden minds.
 * Training on their play would make the README benchmark measure the
 * dataset instead of the model (the-prisoner#10, "Decisions for whoever
 * picks this up").
 */

/** The six questions `src/open/referee.ts`'s `buildQuestions` asks on every
 *  call, plus `acts` -- OPEN-VARIANT.md §74.1's separate one-act reading,
 *  asked as its own single-question call only under `PRISONER_ONE_ACT`. A
 *  label's `expected.acts` is non-null only for a label that specifically
 *  exercises that second call; every label seeded by this task leaves it
 *  `null` (the seed corpora predate or do not exercise that arm). */
export type RefereeQuestionId = "target" | "effect" | "product" | "property" | "magnitude" | "perceptibility" | "acts";

/** A citation as the labels file records it: a source id, and either a
 *  verbatim quote (checked byte-exact against that source by `run-dmcp`'s
 *  own turn reader -- never by this repository) or the word range
 *  `sourceWords` would number it as, or both -- the renderer only ever
 *  needs one to build a legal `TransportAnswer`. `null` means "this answer
 *  had no citation to give" (a `none`/safe-default answer, or a question
 *  this label leaves unlabelled). */
export interface LabelCitation {
  sourceId: string;
  quote?: string;
  from?: number;
  to?: number;
}

/** The scene a label is ruled against -- WHERE the perceived objects and
 *  their descriptions come from, never a copy of the text itself (the
 *  issue's own "through the real code" requirement). Two kinds, one per
 *  seed corpus:
 *
 *  - `static`: the fixed §33.16 scene -- a list of scenario object/person
 *    ids, looked up in TODAY's `scenarioObjects.ts` (`findObject`/
 *    `OPEN_PERSONS`) at their AUTHORED (unworn) description. This is
 *    deliberately NOT the old recorded checkpoint text (which still carried
 *    the "Iron bars cross it" plural #26 fixed on 2026-09-26) -- rebuilding
 *    from today's code is the whole point of storing ids, not prose.
 *  - `replay`: a D11-corpus row. The scene is rebuilt by REPLAYING every
 *    earlier half-round of the named transcript (both chairs, in file
 *    order, up to but excluding this row's own turn) through the real
 *    `planEffect`/`resolver.resolve()` path, exactly as
 *    `checkpoints/2026-09-26-human-intents/probe.mts` already does --
 *    `sourceFile: null` means no transcript survives and the scene is the
 *    game's own round-1 default state (`docs/HUMAN-INTENTS-DESIGN.md` §7.2's
 *    own documented exception, `corpus.json`'s `priorTurnsAvailable: false`
 *    rows).
 */
export type LabelScene =
  | { kind: "static"; perceivedObjectIds: readonly string[] }
  | { kind: "replay"; sourceFile: string | null; round: number; chair: "prisoner" | "warden" };

/** The referee-construction arms a label's scene was authored (or, for a
 *  replay scene, is scored) against -- never assumed from `createReferee`'s
 *  own bare defaults, per `checkpoints/2026-09-28-probe-kit/kit.mts`'s own
 *  documented lesson (`prisoner-measurement-fidelity`, the D11 fidelity
 *  bug): a probe that copied a harness and left an arm at its bare default
 *  measured the wrong referee. `undefined` fields fall to `createReferee`'s
 *  own bare defaults (all "off"/"baseline"), which is exactly right for the
 *  `static` §33.16 scene (that corpus predates every one of these arms). */
export interface LabelRefereeArms {
  elisionMode?: "off" | "on";
  containerClauseMode?: "off" | "on";
  instrumentMode?: "off" | "checked";
  deriveWording?: "baseline" | "sharpened";
}

/** The expected answer to each question the referee may ask, or `null` for
 *  "not known" -- the issue's own "never invent a label" rule: a `null`
 *  here is an honest gap, skipped by the scorer and refused by the
 *  renderer (a `train`-split label needs every field the request actually
 *  asks; `test` never reaches the renderer's training output at all). */
export interface ExpectedAnswers {
  target: string | null;
  effect: string | null;
  product: string | null;
  property: string | null;
  magnitude: string | null;
  perceptibility: string | null;
  /** OPEN-VARIANT.md §74.1's one-act reading; see `RefereeQuestionId`'s own
   *  comment. */
  acts: "one" | "several" | null;
}

/** The expected citation for each ANSWERED question above -- `null` for a
 *  question whose `ExpectedAnswers` field is also `null`, or (the issue's
 *  own "never invent a label" rule again) for one this label leaves
 *  unlabelled even though the answer itself is known. The renderer needs
 *  every field filled to render a `train`-split label (every question the
 *  real referee asks wants a citation); the seed corpora this task ships
 *  are all `test`, and mark magnitude/perceptibility citations honestly as
 *  unlabelled where they were never hand-checked. */
export interface ExpectedCitations {
  target: LabelCitation | null;
  effect: LabelCitation | null;
  product: LabelCitation | null;
  property: LabelCitation | null;
  magnitude: LabelCitation | null;
  perceptibility: LabelCitation | null;
  /** OPEN-VARIANT.md §74.1's one-act reading; `null` unless `expected.acts`
   *  is also set. */
  acts: LabelCitation | null;
}

/** Who wrote this label and whether a person has checked it -- the issue's
 *  own required field, honestly kept even where the answer is "no": the
 *  §33.16 seed's five non-effect answers are `labeller: "claude (overnight
 *  2026-09-27)"`, `audited: false` until a person reviews them. */
export interface LabelProvenance {
  labeller: string;
  audited: boolean;
  /** Where this label came from, for anyone auditing the file -- a
   *  checkpoint path, a corpus row id, or similar. */
  source: string;
  /** Free-text context worth keeping beside the label (e.g. why an answer
   *  was left unlabelled). Optional. */
  note?: string;
}

export interface RefereeLabel {
  id: string;
  split: "test" | "train";
  scene: LabelScene;
  refereeArms: LabelRefereeArms;
  intentText: string;
  expected: ExpectedAnswers;
  citations: ExpectedCitations;
  provenance: LabelProvenance;
}
