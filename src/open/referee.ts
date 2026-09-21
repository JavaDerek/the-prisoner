import { createTurnReader, type ReaderQuestion, type ReaderSource, type ReaderTransport, type ReaderResult, type AnsweredQuestion, type TransportAnswer } from "run-dmcp";
import { EFFECT_KINDS, MAGNITUDES, PERCEPTIBILITIES, PERSON_PROPERTY_KEYS, rulingPropertyAnswerKeys, effectRequiresProperty, type EffectKind, type Magnitude, type Perceptibility } from "./effects.js";
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
 * `"none"` with NO citation (the safe default, or an offer the ladder
 * rejected) is therefore ungrounded, exactly as §3.2 describes, for every
 * effect that has a property to ground -- with ONE exception, decided by
 * OPUS-FIRST-DESIGN.md §3.2 after `checkpoints/2026-09-20-ambition/` showed
 * it ruling every deliberate sound impossible, 3 of 3: `noise` has no
 * property at all (`effectRequiresProperty` excludes it), so its `property`
 * answer of `"none"` needs no description citation, and its target may be
 * `none`, an object, or a person. A noise is grounded by its EFFECT
 * citation alone, from the actor's intent (`computeRuling`, below). This
 * module's earlier position -- that a propertyless noise "still needs a
 * verified description citation to count as grounded" (OPEN-VARIANT.md
 * §9.2, §24.2) -- asked the target's description to say that the thing
 * makes a sound, which no person's description and no key ring's ever
 * grounded in play.
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
  /** OPEN-VARIANT.md §51's seventh question (the-prisoner#17), asked only
   *  under the `PRISONER_INSTRUMENT=checked` arm: THREE closed keys -- an
   *  object among what the actor perceives or holds (the act uses that
   *  tool), `"none"` (the act uses no tool at all), or `"absent"` (the
   *  intent names a tool that is none of those objects). `"none"` is also
   *  what this reads as when the question was not asked (the arm is off) or
   *  went unanswered. Gates applicability only via the `"absent"` case --
   *  see `missingInstrument`, which is the trustworthy half of it. Optional
   *  (rather than required and always `"none"`) so a `RefereeRuling`
   *  hand-built before this arm existed (`loop.test.ts`, `transcript.test.ts`
   *  -- other agents' files tonight) keeps typechecking without being
   *  touched; `computeRuling` always sets it. */
  instrument?: string;
  /** Set when `instrument` is the legal key `"absent"` AND its citation
   *  verified against the actor's own intent -- the referee's own closed-key
   *  judgment that the intent names a tool it does not have, cited verbatim
   *  exactly like every other answer (never a rejected, out-of-vocabulary
   *  offer: `"absent"` is a normal member of the question's `answerKeys`, so
   *  a referee that follows its instructions perfectly can still report
   *  this). `null`/absent when the arm is off, the answer is not
   *  `"absent"`, or its citation did not verify. Applicability is gated
   *  directly on `instrument === "absent"` (OPEN-VARIANT.md §51,
   *  the-prisoner#17), the same way `effectKind === "none"` already gates
   *  it unconditionally -- a badly-cited `"absent"` still blocks (fail-safe:
   *  blocking is always the safe direction here), but only a verified one is
   *  trustworthy enough to report as a specific reason, which is what this
   *  field is for. Optional for the same reason `instrument` is. */
  missingInstrument?: { citation: RangedCitation } | null;
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
    /** Optional for the same reason `instrument` (above) is. */
    instrument?: CitationCheck;
  };
  /** The raw reader result, kept for the transcript. */
  raw: ReaderResult;
  /** OPEN-VARIANT.md §38: per rung, what the model call came back with, when the transport keeps it
   *  (`lastExchange`); `null` for a rung that was not asked or keeps nothing. */
  exchanges?: readonly (RefereeExchangeRecord | null)[];
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

/** Structural, so the referee needs no import of any one transport. */
export type RefereeExchangeRecord = { readonly ms: number; readonly status?: number; readonly content?: string; readonly error?: string };
/** Exported for `elaborationReferee.ts` (WORLD-ELABORATION-DESIGN.md §4.2,
 *  P1b): the second, separate referee this game asks needs the identical
 *  per-rung exchange-recording shape, never a second copy of it. */
export type ExchangeKeeping = { readonly lastExchange?: () => RefereeExchangeRecord | undefined };

/** Exported for `elaborationReferee.ts` (P1b): both referees cite the
 *  actor's intent under the identical source id, never a second name for
 *  the same thing. */
export const INTENT_SOURCE_ID = "intent";
/** Exported for `elaborationReferee.ts` (P1b): the elaboration request's
 *  `need` answer is required to cite the SAME `desc:<id>` source the base
 *  referee's own `property` question does -- reusing this naming function
 *  is what keeps the two in agreement rather than risking a second,
 *  differently-spelled convention. */
export function descriptionSourceId(objectId: string): string {
  return `desc:${objectId}`;
}

/**
 * OPEN-VARIANT.md §51, the-prisoner#17: whether the referee is asked a
 * seventh question naming the instrument an act uses. `off` is the
 * pre-existing request, unchanged byte for byte -- an arm, never a new
 * default (the D3 lesson, §40.1): a contract change that can shift a ruling
 * makes every earlier recorded batch incomparable until the owner measures
 * it and says otherwise.
 */
export type InstrumentMode = "off" | "checked";

export function readInstrumentMode(raw: string | undefined): InstrumentMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "checked") return raw;
  throw new Error(`PRISONER_INSTRUMENT: unrecognised value ${JSON.stringify(raw)} -- must be "checked" or "off" (the default)`);
}

/**
 * OPEN-VARIANT.md §51, the-prisoner#18: whether the effect question's
 * derive/wear wording carries the extra keep-the-piece sentence. `baseline`
 * is the pre-existing text, unchanged byte for byte -- the same D3 lesson:
 * a wording change that can shift a ruling ships switched off until a batch
 * justifies it.
 */
export type DeriveWordingMode = "baseline" | "sharpened";

export function readDeriveWordingMode(raw: string | undefined): DeriveWordingMode {
  if (raw === undefined || raw === "") return "baseline";
  if (raw === "baseline" || raw === "sharpened") return raw;
  throw new Error(`PRISONER_DERIVE_WORDING: unrecognised value ${JSON.stringify(raw)} -- must be "sharpened" or "baseline" (the default)`);
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

function buildQuestions(
  perceivedObjects: readonly ObjectPerception[],
  kindOf: KindOf,
  propertiesOf: PropertiesOf,
  instrumentMode: InstrumentMode,
  deriveWording: DeriveWordingMode
): ReaderQuestion[] {
  // OPEN-VARIANT.md §24: the property keys are the same for every target, so
  // the question says which ones each object in view actually has.
  const propertyList = perceivedObjects.map((o) => `${o.id}: ${propertiesOf(o.id).join(", ") || "none"}`).join("; ");
  // Issue #22 gap 3. A person in view is an object that declares a key only a
  // person has (`PERSON_PROPERTY_KEYS`), so this module needs no scenario
  // import and no new parameter, and the clauses below appear exactly when
  // there is a body to act on. With the presence arm off none is ever
  // perceived and every question below is byte-identical to what every
  // recorded batch was asked -- the fingerprint PIN in `referee.test.ts`.
  const personsInView = perceivedObjects.filter((o) => propertiesOf(o.id).some((k) => (PERSON_PROPERTY_KEYS as readonly string[]).includes(k)));
  const personInView = personsInView.length > 0;
  const PERSON_TARGET_CLAUSE =
    " A person here is a thing that can be acted on like any other: an act on someone else's body -- pushing them down, hauling them up -- names that person, and an act on the actor's OWN body -- collapsing, dropping to the floor, crouching, going limp -- names the actor herself.";
  const PERSON_EFFECT_CLAUSE =
    " An act that changes how a person's own body is held -- dropping to the floor, collapsing, crouching down, going limp -- is wear on that person; an act that gets a body back up off the floor is restore on that person. The body is the target, even when the act is a performance and nothing else in the room changes.";
  const PERSON_PROPERTY_CLAUSE = "posture (a person's own bounded physical state -- on her feet, crouched low, or lying on the floor), ";
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
  // OPEN-VARIANT.md §51, the-prisoner#18: the-prisoner#18's "pull a wire out
  // of the cot" was ruled `wear`, never reaching `derive` at all -- an
  // effect-question ambiguity, the same class of failure §18.5 fixed for
  // wear/reveal. Built from the SAME `deriveExamples` string the baseline
  // sentence already builds from `derivedObjects.ts`'s own table -- never a
  // fresh verb or noun list typed into this module -- so the sharpened text
  // names exactly the kinds the world declares, nothing this repository
  // invented. Off (`baseline`) is the pre-existing sentence, unchanged.
  const deriveClarification =
    deriveWording === "sharpened"
      ? `An act that ends with the actor holding a separate new thing -- ${deriveExamples} -- is derive, whatever verb ` +
        "names how the piece comes free (pull, tear, cut, scrape, untwist, dig): the test is whether a piece is kept " +
        "afterward, not which verb describes taking it. "
      : "";
  return [
    {
      id: "target",
      prompt:
        "Which object, if any, does the actor's intent act on? Answer with the object's id, or 'none' if the " +
        "intent names no object the actor can reach or perceive. " +
        // OPEN-VARIANT.md §30: §19's lesson a third time -- the effect question's own rule about ways
        // out never reached this question, and an intent that goes THROUGH something acts on nothing.
        "An intent that goes out through a way out acts on that way out: name it, never none. " +
        (personInView ? PERSON_TARGET_CLAUSE : "") +
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
        "is to have the piece afterwards; wear is for damage that leaves nothing in hand. " +
        deriveClarification +
        (personInView ? PERSON_EFFECT_CLAUSE : "") +
        "Cite the exact words in the actor's intent that describe the action.",
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
        "description -- one of: integrity, edge, concealment, passage (whether a way out is open, for open and close), " +
        (personInView ? PERSON_PROPERTY_CLAUSE : "") +
        "or none " +
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
      answerKeys: [...rulingPropertyAnswerKeys(personInView)],
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
    // OPEN-VARIANT.md §51, the-prisoner#17: asked only under the
    // `PRISONER_INSTRUMENT=checked` arm, so the request every earlier batch
    // recorded is unchanged when it is off. THREE closed keys, all legal:
    // `targetKeys` (this principal's own currently perceived/held objects,
    // plus `none`) for a real tool or no tool at all, and `absent` for the
    // one case those cannot express -- the intent names a tool that is none
    // of those objects. `absent` is answered and cited exactly like every
    // other key (never a rejected, out-of-vocabulary offer): a referee that
    // follows the closed-key instruction perfectly can still tell the truth
    // about a phantom tool, because the truth has a legal key to land on.
    ...(instrumentMode === "checked"
      ? [
          {
            id: "instrument",
            prompt:
              "Which object, if any, does the actor's intent use as a tool to carry out the effect -- something " +
              "worked WITH, not the thing worked on? Answer with its id if it is among what the actor currently " +
              "perceives or holds, 'none' if the intent uses no such tool, or 'absent' if it names a tool that is " +
              "not among those objects. Cite the exact words in the actor's intent that name it.",
            answerKeys: [...targetKeys, "absent"],
            safeDefault: "none",
          },
        ]
      : []),
  ];
}

function buildSources(intentText: string, perceivedObjects: readonly ObjectPerception[]): ReaderSource[] {
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  for (const object of perceivedObjects) {
    sources.push({ id: descriptionSourceId(object.id), text: object.description });
  }
  return sources;
}

/** Exported for `elaborationReferee.ts` (P1b): the identical "a question
 *  this reader was built with has no answer" defensive lookup, generic in
 *  the question id, never reimplemented for the elaboration request's own
 *  single `need` question. */
export function answerFor(result: ReaderResult, questionId: string): AnsweredQuestion {
  const answer = result.answers.find((a) => a.questionId === questionId);
  if (!answer) throw new Error(`referee: no answer for question '${questionId}' -- the reader is misconfigured`);
  return answer;
}

/** Exported for `elaborationReferee.ts` (P1b): the identical verbatim-source
 *  check every one of this module's own answers is held to. */
export function citationCheck(answer: AnsweredQuestion, requiredSourceId: string | null): CitationCheck {
  const citation: RangedCitation | null = answer.citation;
  const verified = citation !== null && requiredSourceId !== null && citation.sourceId === requiredSourceId;
  return { citation, requiredSourceId, verified };
}

const NO_INSTRUMENT_CITATION: CitationCheck = { citation: null, requiredSourceId: null, verified: false };

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
  // OPEN-VARIANT.md §51, the-prisoner#17: present only under the
  // `PRISONER_INSTRUMENT=checked` arm (`buildQuestions`) -- `undefined` when
  // the question was never asked, never looked up with `answerFor`'s
  // "the reader is misconfigured" throw, which a genuinely absent
  // (off-arm) question is not.
  const instrumentAnswer = result.answers.find((a) => a.questionId === "instrument");

  const targetObjectId = targetAnswer.answerKey;
  const effectKind = effectAnswer.answerKey as EffectKind;
  const property = propertyAnswer.answerKey as OpenPropertyKey | "none";
  const product = productAnswer.answerKey;
  const instrument = instrumentAnswer?.answerKey ?? "none";

  const targetCitation = citationCheck(targetAnswer, INTENT_SOURCE_ID);
  const effectCitation = citationCheck(effectAnswer, INTENT_SOURCE_ID);
  const propertyCitation = citationCheck(propertyAnswer, targetObjectId !== "none" ? descriptionSourceId(targetObjectId) : null);
  const productCitation = citationCheck(productAnswer, INTENT_SOURCE_ID);
  const instrumentCitation = instrumentAnswer ? citationCheck(instrumentAnswer, INTENT_SOURCE_ID) : NO_INSTRUMENT_CITATION;
  // OPEN-VARIANT.md §51, the-prisoner#17: `absent` is a normal, LEGAL member
  // of `instrument`'s own closed answerKeys (`buildQuestions`) -- the
  // referee's own judgment that the intent names a tool it does not have,
  // never a rejected offer this code reads meaning into. A verified citation
  // (from the actor's intent, like every other answer) makes it a
  // trustworthy, reportable reason; an unverified one still blocks below
  // (fail-safe), it just is not reported as one.
  const missingInstrument = instrument === "absent" && instrumentCitation.verified && instrumentCitation.citation !== null ? { citation: instrumentCitation.citation } : null;

  const propertyNamedWhenRequired = !effectRequiresProperty(effectKind) || (property !== "none" && isDeclared(targetObjectId, property));
  // OPEN-VARIANT.md §13.1: a derive names a declared product, cited from the
  // intent. Whether that product's parent is the target is `effects.ts`'s
  // check, as every "declared in the scenario" check is.
  const productNamedWhenRequired = effectKind !== "derive" || (product !== "none" && productCitation.verified);

  // OPUS-FIRST-DESIGN.md §3.2 (`checkpoints/2026-09-20-ambition/RESULTS.md`
  // bug 3): a noise needs no property, so it needs no property CITATION
  // either -- the referee answered `none` and cited the intent for it in all
  // three recorded cases, and holding that answer to the target's `desc:`
  // source (the line below, for every other effect) is exactly what ruled
  // every deliberate sound in that batch impossible. Its target may be
  // `none` too (the O game's slow circuit): a noise is a perceptible event
  // with no state change (OPEN-VARIANT.md §4.2), so no target contributes
  // anything to the effect, and a target answer that fell to its safe
  // default means the same as a cited `none`. What still grounds a noise is
  // its EFFECT citation, from the intent -- never waived -- and a target
  // that IS named is still held to its own citation like any other.
  const noise = effectKind === "noise";
  const applicable =
    (targetObjectId !== "none" || noise) &&
    effectKind !== "none" &&
    // OPEN-VARIANT.md §51, the-prisoner#17: the same unconditional pattern
    // `effectKind !== "none"` already uses -- the closed key itself is
    // trusted, regardless of its own citation quality (blocking is always
    // the safe direction; `missingInstrument`, above, is the separate,
    // citation-gated record of WHY, for reporting).
    instrument !== "absent" &&
    (targetCitation.verified || (noise && targetObjectId === "none")) &&
    effectCitation.verified &&
    (propertyCitation.verified || noise) &&
    propertyNamedWhenRequired &&
    productNamedWhenRequired;

  return {
    targetObjectId,
    effectKind,
    property,
    magnitude: magnitudeAnswer.answerKey as Magnitude,
    perceptibility: perceptibilityAnswer.answerKey as Perceptibility,
    product,
    instrument,
    missingInstrument,
    applicable,
    citations: { target: targetCitation, effect: effectCitation, property: propertyCitation, product: productCitation, instrument: instrumentCitation },
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
 *
 * Exported for `elaborationReferee.ts` (P1b): the second referee's own
 * single-question request needs the identical range-rebuilding, never a
 * second copy of it.
 */
export function withRanges(result: ReaderResult, offered: readonly unknown[]): ReaderResult {
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
export function createReferee(
  transports: readonly ReaderTransport[],
  options: {
    isDeclared?: DeclaredPropertyCheck;
    kindOf?: KindOf;
    propertiesOf?: PropertiesOf;
    /** OPEN-VARIANT.md §51, the-prisoner#17. Default `"off"`: byte-identical
     *  to every batch recorded before this arm existed. */
    instrumentMode?: InstrumentMode;
    /** OPEN-VARIANT.md §51, the-prisoner#18. Default `"baseline"`: the
     *  pre-existing effect-question wording, unchanged. */
    deriveWording?: DeriveWordingMode;
  } = {}
): Referee {
  const isDeclared = options.isDeclared ?? declaredInScenario;
  const kindOf = options.kindOf ?? noKinds;
  const propertiesOf = options.propertiesOf ?? scenarioProperties;
  const instrumentMode = options.instrumentMode ?? "off";
  const deriveWording = options.deriveWording ?? "baseline";
  const cache = new Map<string, RefereeRuling>();
  return {
    async rule(intentText: string, perceivedObjects: readonly ObjectPerception[]): Promise<RefereeRuling> {
      const key = cacheKeyFor(intentText, perceivedObjects);
      const cached = cache.get(key);
      if (cached) return cached;

      const questions = buildQuestions(perceivedObjects, kindOf, propertiesOf, instrumentMode, deriveWording);
      const sources = buildSources(intentText, perceivedObjects);
      // OPEN-VARIANT.md §18.3: the engine keeps an accepted citation as
      // `{sourceId, quote}` only, so what each rung offered is kept here, to
      // put the word range back beside the quote it was rebuilt into.
      const offered: unknown[] = [];
      const exchanges: (RefereeExchangeRecord | null)[] = transports.map(() => null);
      const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
        const answers = await transport(request);
        offered[rung] = answers;
        exchanges[rung] = (transport as ExchangeKeeping).lastExchange?.() ?? null;
        return answers;
      });
      const reader = createTurnReader({ questions, transports: recording });
      const result = withRanges(await reader.read(sources), offered);
      const ruling = { ...computeRuling(result, { questions, sources }, isDeclared), exchanges };
      cache.set(key, ruling);
      return ruling;
    },
  };
}
