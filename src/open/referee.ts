import { createTurnReader, type ReaderQuestion, type ReaderSource, type ReaderTransport, type ReaderResult, type AnsweredQuestion } from "run-dmcp";
import { EFFECT_KINDS, MAGNITUDES, PERCEPTIBILITIES, PROPERTY_ANSWER_KEYS, effectRequiresProperty, type EffectKind, type Magnitude, type Perceptibility } from "./effects.js";
import { findProperty, type OpenPropertyKey } from "./scenarioObjects.js";

/**
 * The referee (OPEN-VARIANT.md §3, this task's brief "The referee"). A
 * model call, separate from both minds, made once per intent -- built on
 * run-dmcp's `createTurnReader` (§3.1), which owns the closed-key/
 * verbatim-citation/safe-default/fallback-ladder machinery this module
 * never reimplements. This module is NOT a `Mind`: it has no principal, no
 * fog of its own (it is handed exactly one actor's intent by its caller,
 * `loop.ts`, and never reads the other principal's anything), and it does
 * not belong in `mind-seam` or `run-dmcp` (root `~/rpg/CLAUDE.md`: "a
 * specific game's content" stays out of the engine; a model that DECIDES,
 * as opposed to one that only proposes, is this game's own referee, not
 * generic mechanism with a caller anywhere else).
 *
 * FIVE QUESTIONS, closed keys, per this task's brief (reconciling
 * OPEN-VARIANT.md §3.2's five-question list with the brief's own naming):
 * `target`, `effect`, `property`, `magnitude`, `perceptibility`. Every
 * question's `safeDefault` names the key that means "this question
 * contributed nothing towards an effect actually happening" -- `target`
 * and `effect` default to `"none"`; `property` defaults to `"none"`;
 * `magnitude`/`perceptibility` have no "inert" key of their own (a
 * magnitude is still a magnitude), so their defaults (`"slight"`,
 * `"silent"`) are simply the least consequential member of each set --
 * they never make an inapplicable ruling applicable, because applicability
 * is decided entirely by `target`/`effect`/`property` and their citations
 * (`computeRuling`, below), never by which magnitude or perceptibility key
 * came back.
 *
 * RECONCILING §3.2's "grounding" WITH THE BRIEF'S "the property" (recorded
 * here because this task's brief asks that an ambiguity like this, and
 * what was decided, be reported): OPEN-VARIANT.md §3.2 names a THIRD
 * question, "grounding" -- the verbatim span of the target's description
 * that makes the effect possible, or `none`, which rules the intent
 * impossible. The brief's own list instead names "the property" as the
 * third question. This module treats them as the SAME question under one
 * name: the answer key is a property name (or `none`, for an effect like
 * `noise` that has no property, or for "no grounding exists"), and the
 * CITATION on that answer -- which must be a verbatim span of the TARGET
 * OBJECT'S OWN description -- is what actually carries §3.2's "grounding"
 * requirement, independent of which key was chosen. A `property` answer of
 * `"none"` therefore still needs a valid description citation to count as
 * "grounded but propertyless" (legal only for `noise`, which
 * `effectRequiresProperty` excludes); a `property` answer of `"none"` with
 * NO citation (the safe default, or an offer the ladder rejected) is
 * ungrounded, exactly as §3.2 describes, for every effect including
 * `noise`.
 */
/** Declared as a `type`, never an `interface` -- `mind-seam`'s own
 *  discipline (DESIGN §3.1): an object type literal carries an implicit
 *  index signature and an interface does not, so an `interface` here would
 *  fail to satisfy `InertRecord` the moment it appears inside
 *  `OpenPrincipalContext.perceivedObjects` (`mind.ts`). */
export type ObjectPerception = {
  id: string;
  description: string;
};

export interface RefereeRuling {
  targetObjectId: string;
  effectKind: EffectKind;
  property: OpenPropertyKey | "none";
  magnitude: Magnitude;
  perceptibility: Perceptibility;
  /** Whether this ruling passed every citation and "declared in the
   *  scenario" check (this module's own check; `planEffect`, `effects.ts`,
   *  does the scenario-declaration half) -- when `false`, the intent does
   *  nothing, unconditionally (OPEN-VARIANT.md §2 invariant 3). */
  applicable: boolean;
  /** Every citation this ruling actually carries, and whether each
   *  verified against its DECLARED required source -- for the transcript
   *  (this task's brief: "the referee's answers with both citations,
   *  whether each citation verified"). */
  citations: {
    target: CitationCheck;
    effect: CitationCheck;
    property: CitationCheck;
  };
  /** The raw reader result, kept for the transcript. */
  raw: ReaderResult;
  /** The exact request (questions + sources) this ruling was asked against
   *  -- kept so the replay tool (`replay.ts`, this task's brief) can re-ask
   *  the IDENTICAL request N times for §5.2's consistency measurement,
   *  rather than rebuilding one that might drift from what was actually
   *  sent. */
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] };
}

export interface CitationCheck {
  citation: { sourceId: string; quote: string } | null;
  /** The sourceId this citation was REQUIRED to name (`"intent"` for
   *  target/effect; the target's own `desc:<id>` source for property) --
   *  `null` when there was no target to require one against yet (a `none`
   *  target makes the property question moot). */
  requiredSourceId: string | null;
  verified: boolean;
}

const INTENT_SOURCE_ID = "intent";
function descriptionSourceId(objectId: string): string {
  return `desc:${objectId}`;
}
function precedentSourceId(objectId: string): string {
  return `precedent:${objectId}`;
}

/**
 * Precedent (OPEN-VARIANT.md §3.5): "each question is shown the precedent
 * record for the same (object, effect kind): earlier rulings' keys and
 * citations, never their reasoning." An in-memory, per-referee-instance
 * store -- consistency is measured by replaying a RECORDED transcript
 * (`replay.ts`), not by this store surviving a process restart, so nothing
 * here needs to be a database table (root CLAUDE.md's "in-memory or
 * scratch databases only" is satisfied trivially: there is no database
 * here at all).
 */
export class PrecedentStore {
  private readonly byObject = new Map<string, string[]>();

  record(ruling: Pick<RefereeRuling, "targetObjectId" | "effectKind" | "property" | "magnitude" | "citations">): void {
    if (ruling.targetObjectId === "none") return;
    const line =
      `effect=${ruling.effectKind} property=${ruling.property} magnitude=${ruling.magnitude}` +
      ` target-citation="${ruling.citations.target.citation?.quote ?? ""}"` +
      ` property-citation="${ruling.citations.property.citation?.quote ?? ""}"`;
    const existing = this.byObject.get(ruling.targetObjectId) ?? [];
    existing.push(line);
    this.byObject.set(ruling.targetObjectId, existing);
  }

  /** One source per perceived object that has precedent, `undefined`
   *  otherwise (never an empty source -- nothing to cite against). */
  sourceFor(objectId: string): ReaderSource | undefined {
    const lines = this.byObject.get(objectId);
    if (!lines || lines.length === 0) return undefined;
    return { id: precedentSourceId(objectId), text: lines.join("\n") };
  }
}

function buildQuestions(perceivedObjects: readonly ObjectPerception[]): ReaderQuestion[] {
  const targetKeys = [...perceivedObjects.map((o) => o.id), "none"];
  return [
    {
      id: "target",
      prompt:
        "Which object, if any, does the actor's intent act on? Answer with the object's id, or 'none' if the " +
        "intent names no object the actor can reach or perceive. Cite the exact words in the actor's intent that name it.",
      answerKeys: targetKeys,
      safeDefault: "none",
    },
    {
      id: "effect",
      prompt:
        "What kind of effect, if any, does the intent attempt? One of: wear (lower a property), restore (raise " +
        "or reset a property), reveal (learn a property's true value), conceal (raise concealment), expose " +
        "(lower concealment), noise (a perceptible event with no state change), or none. Cite the exact words in " +
        "the actor's intent that describe the action.",
      answerKeys: [...EFFECT_KINDS],
      safeDefault: "none",
    },
    {
      id: "property",
      prompt:
        "Which property of the target object makes this effect PHYSICALLY POSSIBLE, per the target's own authored " +
        "description -- one of: integrity, edge, concealment, or none (none if the effect needs no property, e.g. " +
        "noise, or if nothing in the description grounds the effect at all). Cite the exact words in the TARGET " +
        "OBJECT'S OWN description that make it possible.",
      answerKeys: [...PROPERTY_ANSWER_KEYS],
      safeDefault: "none",
    },
    {
      id: "magnitude",
      prompt: "How large is the effect: slight, moderate, or substantial?",
      answerKeys: [...MAGNITUDES],
      safeDefault: "slight",
    },
    {
      id: "perceptibility",
      prompt: "Is the effect silent, audible, or visible to someone else present?",
      answerKeys: [...PERCEPTIBILITIES],
      safeDefault: "silent",
    },
  ];
}

function buildSources(intentText: string, perceivedObjects: readonly ObjectPerception[], precedent: PrecedentStore): ReaderSource[] {
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  for (const object of perceivedObjects) {
    sources.push({ id: descriptionSourceId(object.id), text: object.description });
    const precedentSource = precedent.sourceFor(object.id);
    if (precedentSource) sources.push(precedentSource);
  }
  return sources;
}

function answerFor(result: ReaderResult, questionId: string): AnsweredQuestion {
  const answer = result.answers.find((a) => a.questionId === questionId);
  if (!answer) throw new Error(`referee: no answer for question '${questionId}' -- the reader is misconfigured`);
  return answer;
}

function citationCheck(answer: AnsweredQuestion, requiredSourceId: string | null): CitationCheck {
  const citation = answer.citation;
  const verified = citation !== null && requiredSourceId !== null && citation.sourceId === requiredSourceId;
  return { citation, requiredSourceId, verified };
}

/** Builds the ruling from a completed read -- pure, so it is unit-testable
 *  against a hand-built `ReaderResult` without ever constructing a reader
 *  (used directly by `replay.ts`, which re-runs the ladder itself and only
 *  needs this half). */
export function computeRuling(
  result: ReaderResult,
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] }
): RefereeRuling {
  const targetAnswer = answerFor(result, "target");
  const effectAnswer = answerFor(result, "effect");
  const propertyAnswer = answerFor(result, "property");
  const magnitudeAnswer = answerFor(result, "magnitude");
  const perceptibilityAnswer = answerFor(result, "perceptibility");

  const targetObjectId = targetAnswer.answerKey;
  const effectKind = effectAnswer.answerKey as EffectKind;
  const property = propertyAnswer.answerKey as OpenPropertyKey | "none";

  const targetCitation = citationCheck(targetAnswer, INTENT_SOURCE_ID);
  const effectCitation = citationCheck(effectAnswer, INTENT_SOURCE_ID);
  const propertyCitation = citationCheck(propertyAnswer, targetObjectId !== "none" ? descriptionSourceId(targetObjectId) : null);

  const propertyNamedWhenRequired = !effectRequiresProperty(effectKind) || (property !== "none" && !!findProperty(targetObjectId, property));

  const applicable =
    targetObjectId !== "none" &&
    effectKind !== "none" &&
    targetCitation.verified &&
    effectCitation.verified &&
    propertyCitation.verified &&
    propertyNamedWhenRequired;

  return {
    targetObjectId,
    effectKind,
    property,
    magnitude: magnitudeAnswer.answerKey as Magnitude,
    perceptibility: perceptibilityAnswer.answerKey as Perceptibility,
    applicable,
    citations: { target: targetCitation, effect: effectCitation, property: propertyCitation },
    raw: result,
    request,
  };
}

export interface Referee {
  rule(intentText: string, perceivedObjects: readonly ObjectPerception[]): Promise<RefereeRuling>;
  precedent: PrecedentStore;
}

/** Builds one referee for the lifetime of a game -- `transports` is the
 *  fallback ladder `createTurnReader` runs (this task's brief: "a plain
 *  async function in this repo that calls the configured referee model
 *  through the swapper"; see `refereeTransport.ts` for the real one, and
 *  every test in this module for a scripted one). Temperature 0 is the
 *  TRANSPORT's own concern (`refereeTransport.ts`), not this module's --
 *  this module never itself calls a model. */
export function createReferee(transports: readonly ReaderTransport[]): Referee {
  const precedent = new PrecedentStore();
  return {
    precedent,
    async rule(intentText: string, perceivedObjects: readonly ObjectPerception[]): Promise<RefereeRuling> {
      const questions = buildQuestions(perceivedObjects);
      const sources = buildSources(intentText, perceivedObjects, precedent);
      const reader = createTurnReader({ questions, transports });
      const result = await reader.read(sources);
      const ruling = computeRuling(result, { questions, sources });
      // Only rulings that applied become precedent. A failed ruling shown as
      // an example is copied: the first real games (OPEN-VARIANT.md §11.2) had
      // one bad bar ruling repeated turn after turn.
      if (ruling.applicable) precedent.record(ruling);
      return ruling;
    },
  };
}
