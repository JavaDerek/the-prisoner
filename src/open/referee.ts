import { createTurnReader, type ReaderQuestion, type ReaderSource, type ReaderTransport, type ReaderResult, type AnsweredQuestion, type TransportAnswer } from "run-dmcp";
import { EFFECT_KINDS, MAGNITUDES, PERCEPTIBILITIES, PROPERTY_ANSWER_KEYS, effectRequiresProperty, type EffectKind, type Magnitude, type Perceptibility } from "./effects.js";
import { findObject, findProperty, type OpenPropertyKey } from "./scenarioObjects.js";
import { DERIVABLE_KINDS, parentLabel } from "./derivedObjects.js";
import type { RangedCitation } from "./refereeTransport.js";

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
  /** OPEN-VARIANT.md §13.1's sixth question: the declared derivable kind
   *  the new thing is, or `none`. Read only when the effect is `derive`. */
  product: string;
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
    product: CitationCheck;
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
  /** With the word range it was rebuilt from, when the referee cited by
   *  range (OPEN-VARIANT.md §18). */
  citation: RangedCitation | null;
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

/**
 * §3.5's actual requirement -- "the same intent in the same state should get
 * the same ruling" -- by construction, not by showing the referee its own
 * earlier work as a prompt example. OPEN-VARIANT.md §18.6/§18.7: a block of
 * "EARLIER RULINGS on the same object" was tried for this and made the
 * referee copy an earlier ruling onto a DIFFERENT intent on the same object
 * (the prisoner's scrape read as the warden's earlier reveal); prefixing
 * each line with the intent it was ruled on did not fix it (§18.7's
 * live re-rule: still 8 of 11 reveal). The owner's remaining option
 * (§18.7's "awaiting the owner: drop the block") is this: no block, no
 * prompt exposure -- an exact repeat is served from an in-memory cache
 * instead of asked again, so it cannot diverge, and anything that is not an
 * exact repeat is judged with no precedent text at all.
 */
function cacheKeyFor(intentText: string, perceivedObjects: readonly ObjectPerception[]): string {
  return JSON.stringify({ intentText, perceivedObjects });
}

/** The recorded kind of an object derived in this game, or `undefined` --
 *  `derivedKindOf` (`world.ts`) for a caller with a world. */
export type KindOf = (objectId: string) => string | undefined;
const noKinds: KindOf = () => undefined;

/** The property keys an object declares -- the §4.1 objects by default; a
 *  caller with a world hands in one that knows objects derived in this game. */
export type PropertiesOf = (objectId: string) => readonly string[];
const scenarioProperties: PropertiesOf = (objectId) => findObject(objectId)?.properties.map((p) => p.key) ?? [];

function buildQuestions(perceivedObjects: readonly ObjectPerception[], kindOf: KindOf, propertiesOf: PropertiesOf): ReaderQuestion[] {
  // OPEN-VARIANT.md §24: the property keys are the same for every target, so
  // the question says which ones each object in view actually has.
  const propertyList = perceivedObjects.map((o) => `${o.id}: ${propertiesOf(o.id).join(", ") || "none"}`).join("; ");
  const targetKeys = [...perceivedObjects.map((o) => o.id), "none"];
  // OPEN-VARIANT.md §13.1: the kinds derivable from a parent in view, named
  // in the effect question by example and offered as the product keys. A
  // parent that is a kind (§14.1) is in view when an object of that recorded
  // kind is.
  // A kind parent matches only a recorded kind, never an id that happens to
  // be spelled like one.
  const objectsInView = new Set(perceivedObjects.map((o) => o.id));
  const kindsInView = new Set(perceivedObjects.flatMap((o) => kindOf(o.id) ?? []));
  const derivable = DERIVABLE_KINDS.filter((k) => (DERIVABLE_KINDS.some((parent) => parent.id === k.parent) ? kindsInView.has(k.parent) : objectsInView.has(k.parent)));
  const deriveExamples = DERIVABLE_KINDS.map((k) => `a ${k.label} from the ${parentLabel(k)}`).join(", ");
  return [
    {
      id: "target",
      prompt:
        "Which object, if any, does the actor's intent act on? Answer with the object's id, or 'none' if the " +
        "intent names no object the actor can reach or perceive. " +
        // OPEN-VARIANT.md §30: §19's lesson a third time -- the effect question's own rule about ways
        // out never reached this question, and an intent that goes THROUGH something acts on nothing.
        "An intent that goes out through a way out acts on that way out: name it, never none. " +
        "Cite the exact words in the actor's intent that name it.",
      answerKeys: targetKeys,
      safeDefault: "none",
    },
    {
      id: "effect",
      prompt:
        "What kind of effect, if any, does the intent attempt? One of: wear (lower a property), restore (raise " +
        "or reset a property), reveal (learn a property's true value), conceal (raise concealment), expose " +
        "(lower concealment), noise (a perceptible event with no state change), open (make a way out passable in " +
        "one act -- a door, a window), close (shut a way out), leave (go out through a way out), or none. " +
        "Judge by the intent's aim, not its method: an act whose aim is to make a way out passable -- a bolt pushed " +
        "back, a lock worked, a bar levered from its mortar -- is open, even when the method is scraping or prying; " +
        "wear is for damage or dulling with no way out as its goal. " +
        // OPEN-VARIANT.md §18.5: an examination is not the damage it looks for.
        "An act whose aim is to learn -- to examine, inspect or check something -- is reveal, whatever it looks for: " +
        "examining a bar for signs of damage or wear is reveal, not wear. " +
        // OPEN-VARIANT.md §17.2, verbatim.
        "For open, close and leave, the target is the way out (the door, the window), even when the method works on a part of it such as its lock or a bar. " +
        // OPEN-VARIANT.md §30: every climb-out in a real game came back as `open`.
        "Going out through a way out is leave, even when it already stands open: climbing through an open window is leave, not open. " +
        `derive (make a new thing from part of the target and keep it: ${deriveExamples}) is for an act whose aim ` +
        "is to have the piece afterwards; wear is for damage that leaves nothing in hand. Cite the exact words in " +
        "the actor's intent that describe the action.",
      answerKeys: [...EFFECT_KINDS],
      safeDefault: "none",
    },
    {
      id: "product",
      prompt:
        "If the effect is derive, which declared kind of thing does the actor make from the target? One of: " +
        (derivable.length > 0 ? derivable.map((k) => `${k.id} (a ${k.label}, from the ${parentLabel(k)})`).join(", ") + ", or none" : "none") +
        ". Answer none for every other effect. Cite the exact words in the actor's intent that name what is made.",
      answerKeys: [...derivable.map((k) => k.id), "none"],
      safeDefault: "none",
    },
    {
      id: "property",
      prompt:
        "Which property of the target object makes this effect PHYSICALLY POSSIBLE, per the target's own authored " +
        "description -- one of: integrity, edge, concealment, passage (whether a way out is open, for open and close), or none " +
        "(none if the effect needs no property, e.g. noise or leave, or if nothing in the description grounds the effect at all). " +
        "For derive, name the property of the target that the new thing is taken from (integrity for a part worked loose; none for loose material " +
        "that takes nothing from the target, or for a held thing reshaped whole into another), and cite the words naming the part that comes away. " +
        // OPEN-VARIANT.md §18.5.
        "For reveal, name the property being learned: integrity for damage, wear, rust or tampering, even when the intent calls it hidden. " +
        // OPEN-VARIANT.md §24.
        "Or concealment for what may be hidden in, under or beneath it. " +
        `The properties each object has: ${propertyList}. Name only a property the target has; if it has none that fits, answer none. ` +
        "An answer of none still needs the words in the target's description that make the effect possible (for noise, the words saying it makes a sound). " +
        "Cite the exact words in the TARGET " +
        "OBJECT'S OWN description (the source labelled desc: followed by that object's id) that make it possible.",
      answerKeys: [...PROPERTY_ANSWER_KEYS],
      safeDefault: "none",
    },
    {
      id: "magnitude",
      prompt:
        "How large is the effect: slight, moderate, or substantial? Cite the exact words in the actor's intent " +
        "that show how much force, time or care goes into it.",
      answerKeys: [...MAGNITUDES],
      safeDefault: "slight",
    },
    {
      id: "perceptibility",
      prompt:
        "Is the effect silent, audible, or visible to someone else present? Cite the exact words in the actor's " +
        "intent that show how it would or would not be noticed.",
      answerKeys: [...PERCEPTIBILITIES],
      safeDefault: "silent",
    },
  ];
}

function buildSources(intentText: string, perceivedObjects: readonly ObjectPerception[]): ReaderSource[] {
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  for (const object of perceivedObjects) {
    sources.push({ id: descriptionSourceId(object.id), text: object.description });
  }
  return sources;
}

function answerFor(result: ReaderResult, questionId: string): AnsweredQuestion {
  const answer = result.answers.find((a) => a.questionId === questionId);
  if (!answer) throw new Error(`referee: no answer for question '${questionId}' -- the reader is misconfigured`);
  return answer;
}

function citationCheck(answer: AnsweredQuestion, requiredSourceId: string | null): CitationCheck {
  const citation: RangedCitation | null = answer.citation;
  const verified = citation !== null && requiredSourceId !== null && citation.sourceId === requiredSourceId;
  return { citation, requiredSourceId, verified };
}

/** Whether `(objectId, property)` is declared in the scenario -- the check
 *  a property answer must pass. The default knows the §4.1 objects only; a
 *  caller with a world hands in `declaredProperty` (`world.ts`) so objects
 *  derived in this game (OPEN-VARIANT.md §13.3) count too. */
export type DeclaredPropertyCheck = (objectId: string, property: string) => boolean;
const declaredInScenario: DeclaredPropertyCheck = (objectId, property) => !!findProperty(objectId, property as OpenPropertyKey);

/** Builds the ruling from a completed read -- pure, so it is unit-testable
 *  against a hand-built `ReaderResult` without ever constructing a reader. */
export function computeRuling(
  result: ReaderResult,
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] },
  isDeclared: DeclaredPropertyCheck = declaredInScenario
): RefereeRuling {
  const targetAnswer = answerFor(result, "target");
  const effectAnswer = answerFor(result, "effect");
  const productAnswer = answerFor(result, "product");
  const propertyAnswer = answerFor(result, "property");
  const magnitudeAnswer = answerFor(result, "magnitude");
  const perceptibilityAnswer = answerFor(result, "perceptibility");

  const targetObjectId = targetAnswer.answerKey;
  const effectKind = effectAnswer.answerKey as EffectKind;
  const property = propertyAnswer.answerKey as OpenPropertyKey | "none";
  const product = productAnswer.answerKey;

  const targetCitation = citationCheck(targetAnswer, INTENT_SOURCE_ID);
  const effectCitation = citationCheck(effectAnswer, INTENT_SOURCE_ID);
  const propertyCitation = citationCheck(propertyAnswer, targetObjectId !== "none" ? descriptionSourceId(targetObjectId) : null);
  const productCitation = citationCheck(productAnswer, INTENT_SOURCE_ID);

  const propertyNamedWhenRequired = !effectRequiresProperty(effectKind) || (property !== "none" && isDeclared(targetObjectId, property));
  // OPEN-VARIANT.md §13.1: a derive names a declared product, cited from the
  // intent. Whether that product's parent is the target is `effects.ts`'s
  // check, as every "declared in the scenario" check is.
  const productNamedWhenRequired = effectKind !== "derive" || (product !== "none" && productCitation.verified);

  const applicable =
    targetObjectId !== "none" &&
    effectKind !== "none" &&
    targetCitation.verified &&
    effectCitation.verified &&
    propertyCitation.verified &&
    propertyNamedWhenRequired &&
    productNamedWhenRequired;

  return {
    targetObjectId,
    effectKind,
    property,
    magnitude: magnitudeAnswer.answerKey as Magnitude,
    perceptibility: perceptibilityAnswer.answerKey as Perceptibility,
    product,
    applicable,
    citations: { target: targetCitation, effect: effectCitation, property: propertyCitation, product: productCitation },
    raw: result,
    request,
  };
}

/**
 * The reader's result with each accepted citation's word range restored from
 * the offer it came from (OPEN-VARIANT.md §18.3) -- for the transcript; the
 * sourceId and quote are the engine's own, unchanged. The accepted offer is
 * the first one on its rung with the same question, key, source and quote:
 * any earlier identical offer would have passed the same checks and been the
 * one accepted. A citation given as a quote has no range and gains none.
 */
function withRanges(result: ReaderResult, offered: readonly unknown[]): ReaderResult {
  const answers = result.answers.map((answer) => {
    const rungOffers = answer.answeredByRung === null ? undefined : offered[answer.answeredByRung];
    if (!answer.citation || !Array.isArray(rungOffers)) return answer;
    const { sourceId, quote } = answer.citation;
    const offer = (rungOffers as TransportAnswer[]).find(
      (o) => o?.questionId === answer.questionId && o.answerKey === answer.answerKey && o.citation?.sourceId === sourceId && o.citation.quote === quote
    );
    const { from, to } = (offer?.citation ?? {}) as RangedCitation;
    if (typeof from !== "number" || typeof to !== "number") return answer;
    return { ...answer, citation: { sourceId, quote, from, to } };
  });
  return { ...result, answers };
}

export interface Referee {
  rule(intentText: string, perceivedObjects: readonly ObjectPerception[]): Promise<RefereeRuling>;
}

/** Builds one referee for the lifetime of a game -- `transports` is the
 *  fallback ladder `createTurnReader` runs (this task's brief: "a plain
 *  async function in this repo that calls the configured referee model
 *  through the swapper"; see `refereeTransport.ts` for the real one, and
 *  every test in this module for a scripted one). Temperature 0 is the
 *  TRANSPORT's own concern (`refereeTransport.ts`), not this module's --
 *  this module never itself calls a model. */
export function createReferee(transports: readonly ReaderTransport[], options: { isDeclared?: DeclaredPropertyCheck; kindOf?: KindOf; propertiesOf?: PropertiesOf } = {}): Referee {
  const isDeclared = options.isDeclared ?? declaredInScenario;
  const kindOf = options.kindOf ?? noKinds;
  const propertiesOf = options.propertiesOf ?? scenarioProperties;
  const cache = new Map<string, RefereeRuling>();
  return {
    async rule(intentText: string, perceivedObjects: readonly ObjectPerception[]): Promise<RefereeRuling> {
      const key = cacheKeyFor(intentText, perceivedObjects);
      const cached = cache.get(key);
      if (cached) return cached;

      const questions = buildQuestions(perceivedObjects, kindOf, propertiesOf);
      const sources = buildSources(intentText, perceivedObjects);
      // OPEN-VARIANT.md §18.3: the engine keeps an accepted citation as
      // `{sourceId, quote}` only, so what each rung offered is kept here, to
      // put the word range back beside the quote it was rebuilt into.
      const offered: unknown[] = [];
      const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
        const answers = await transport(request);
        offered[rung] = answers;
        return answers;
      });
      const reader = createTurnReader({ questions, transports: recording });
      const result = withRanges(await reader.read(sources), offered);
      const ruling = computeRuling(result, { questions, sources }, isDeclared);
      cache.set(key, ruling);
      return ruling;
    },
  };
}
