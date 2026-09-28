import { createTurnReader, type ReaderQuestion, type ReaderSource, type ReaderTransport } from "run-dmcp";
import { answerFor, citationCheck, type CitedSpan } from "./referee.js";
import { OPEN_OBJECTS } from "./scenarioObjects.js";

/**
 * the-prisoner#3, enjoyable mode: per-game description generation, honesty
 * review and fallback (OPEN-VARIANT.md's own new section has the full
 * design). Built on the SAME machinery the referee is built on
 * (`run-dmcp`'s `createTurnReader`) for the review half, per CLAUDE.md's
 * "never pattern-match meaning": code verifies a review answer's citation is
 * verbatim and from the right source, and never judges whether the citation
 * actually justifies the verdict -- that judgement is the reviewer model's,
 * audited by a human reading the game's `.scenario.json` sidecar, exactly as
 * a referee ruling is audited from the transcript.
 *
 * WHAT IS GENERATED (CODER-BRIEF decision 2, "start small"): only the
 * physical DESCRIPTION of each object in the FIXED §4.1 list. The object
 * list, ids, properties, starting values, mechanics, the persons and their
 * identities/motives are never touched here -- `scenarioObjectFacts` below
 * reads `OPEN_OBJECTS` for ids and authored text only, never its properties,
 * and the game wires the result back in as a description OVERRIDE
 * (`briefing.ts`'s `authoredDescription`), the same seam the welded-window
 * arm already uses to swap two objects' text by mode.
 *
 * THIS MODULE NEVER CALLS A MODEL ITSELF. `generate` and `reviewTransports`
 * are injected, exactly as `referee.ts` never calls `fetch` and
 * `refereeTransport.ts` is the only place that does -- `scenarioTransport.ts`
 * is this module's own real transport, and every test here is scripted
 * (CODER-BRIEF: "scripted transports only, no model calls").
 */

/** The four closed keys the honesty review answers with -- CODER-BRIEF
 *  decision 3, verbatim. `physical-only` is the ONLY passing key
 *  (`passesReview`); the other three each name a distinct way a generated
 *  description could sit upstream of the referee's own grounding guard
 *  (OPEN-VARIANT.md §3.3, the-prisoner#26/§76's "no description carries
 *  another object's name" lesson) rather than merely describing what the
 *  object physically is. */
export type HonestyAnswerKey = "physical-only" | "states-a-use" | "names-another-object" | "drops-a-fact";

export const HONESTY_ANSWER_KEYS: readonly HonestyAnswerKey[] = ["physical-only", "states-a-use", "names-another-object", "drops-a-fact"];

/** The two sources the honesty question is asked against: the text just
 *  generated, and the authored facts it was told to preserve. Named
 *  constants, like `referee.ts`'s `INTENT_SOURCE_ID`, so a caller building
 *  the request and this module's own source-requirement logic cannot name
 *  the same source two different ways. */
export const GENERATED_SOURCE_ID = "generated";
export const FACTS_SOURCE_ID = "facts";

/**
 * Which source a given answer key's citation is REQUIRED to come from.
 * `physical-only`/`states-a-use`/`names-another-object` all point at
 * something the GENERATED text itself contains -- a physical fact it states,
 * a use it states, or another object's name it uses -- so their citation
 * must come from the generated text. `drops-a-fact` is the one exception,
 * decided and recorded here exactly as `referee.ts`'s own header records its
 * `reveal`-property exception (§9.2): a fact the generated text DROPPED
 * cannot be quoted FROM the generated text, because the whole verdict is
 * that the text does not contain it -- so its citation is required from
 * FACTS instead, naming the dropped fact verbatim. Never a judgement of
 * whether the citation actually proves the drop; only of which source it is
 * allowed to name.
 */
export function requiredHonestySource(answerKey: string): string {
  return answerKey === "drops-a-fact" ? FACTS_SOURCE_ID : GENERATED_SOURCE_ID;
}

/**
 * The honesty question. One question, four closed keys (CODER-BRIEF decision
 * 3's own enumeration, "physical-only or states-a-use or names-another-object
 * or drops-a-fact"), each answer cited verbatim -- the same shape `referee.ts`
 * asks its `effect`/`target` questions in. `safeDefault` must be a member of
 * `answerKeys` and the safe DIRECTION here is always rejection (an
 * unreachable or uncertain review must never be trusted as a pass): any of
 * the three failing keys serves; `states-a-use` is picked with no other
 * significance than being first among them.
 */
export function buildHonestyQuestion(): ReaderQuestion {
  return {
    id: "honesty",
    prompt:
      "GENERATED is a freshly written physical description of one object in a physical scene, meant to replace FACTS with fresh texture while preserving every physical fact FACTS states. " +
      "Judge GENERATED against FACTS. Answer physical-only if GENERATED states only physical, sensory facts about the object itself -- material, size, wear, colour, smell, texture -- and " +
      "changes nothing FACTS states. Answer states-a-use if any part of GENERATED says what the object can be used for, an effect it produces, or a purpose it serves, rather than only what " +
      "it physically is. Answer names-another-object if GENERATED names any other object in the scene, in the singular or the plural, rather than only itself. Answer drops-a-fact if a " +
      "physical fact FACTS states -- including what the object is attached to, what it closes, or what is set into what -- is missing, changed, or contradicted in GENERATED. " +
      "For physical-only, cite the exact words in GENERATED that state a physical fact. For states-a-use or names-another-object, cite the exact words in GENERATED that show it. " +
      "For drops-a-fact, cite the exact words in FACTS naming the fact GENERATED left out or changed.",
    answerKeys: [...HONESTY_ANSWER_KEYS],
    safeDefault: "states-a-use",
  };
}

export interface ScenarioReviewAnswer {
  readonly answerKey: HonestyAnswerKey;
  readonly citation: CitedSpan | null;
  readonly requiredSourceId: string;
  readonly verified: boolean;
}

/** Runs the honesty review for one generated description, through
 *  run-dmcp's `createTurnReader` -- `reviewTransports` is the fallback
 *  ladder, exactly `referee.ts`'s own `transports` parameter, so an
 *  unreachable review falls to the question's own safe default rather than
 *  throwing. */
export async function reviewDescription(generated: string, facts: string, reviewTransports: readonly ReaderTransport[]): Promise<ScenarioReviewAnswer> {
  const question = buildHonestyQuestion();
  const sources: ReaderSource[] = [
    { id: GENERATED_SOURCE_ID, text: generated },
    { id: FACTS_SOURCE_ID, text: facts },
  ];
  const reader = createTurnReader({ questions: [question], transports: reviewTransports });
  const result = await reader.read(sources);
  const answer = answerFor(result, "honesty");
  const requiredSourceId = requiredHonestySource(answer.answerKey);
  const check = citationCheck(answer, requiredSourceId);
  return { answerKey: answer.answerKey as HonestyAnswerKey, citation: check.citation, requiredSourceId, verified: check.verified };
}

/** The one passing verdict: `physical-only`, grounded in the generated text
 *  itself. Every other answer -- including a `physical-only` whose citation
 *  did not verify -- is a rejection. */
export function passesReview(review: ScenarioReviewAnswer): boolean {
  return review.answerKey === "physical-only" && review.verified;
}

/** CODER-BRIEF decision 3: "Reject -> regenerate, up to 3 attempts, then
 *  fall back to the authored benchmark text." */
export const MAX_GENERATION_ATTEMPTS = 3;

/** The one fact this module asks a generator to preserve: an object's id
 *  (never sent to the model as anything but a label) and the authored
 *  benchmark text it must keep true, which doubles as the fallback text. */
export interface ScenarioObjectFact {
  readonly id: string;
  readonly facts: string;
}

/** A generation call: given an object's id and the facts to preserve, returns
 *  fresh description text, or `null` when the call itself could not be
 *  answered (unreachable, empty reply) -- never a thrown error, the same
 *  "failure is an empty/null answer" discipline `refereeTransport.ts` keeps. */
export type ScenarioGenerationTransport = (params: { objectId: string; facts: string; attempt: number }) => Promise<string | null>;

export interface ScenarioGenerationAttempt {
  readonly attempt: number;
  /** `null` when the generation call itself came back with nothing -- there
   *  was no text to review. */
  readonly generated: string | null;
  readonly review: ScenarioReviewAnswer | null;
}

export interface GeneratedObject {
  readonly id: string;
  /** What the game actually uses: a passing generation, or (when every
   *  attempt was rejected or empty) the authored facts text, unchanged. */
  readonly description: string;
  /** `true` exactly when `description` came from a generation attempt that
   *  passed review; `false` means this object fell back. */
  readonly accepted: boolean;
  readonly attempts: readonly ScenarioGenerationAttempt[];
}

/** Generates one object's description, reviewing and regenerating up to
 *  `maxAttempts` times, then falling back to the authored facts text. Every
 *  attempt -- including a fallback's -- is recorded, never silently. */
export async function generateObjectDescription(
  fact: ScenarioObjectFact,
  generate: ScenarioGenerationTransport,
  reviewTransports: readonly ReaderTransport[],
  maxAttempts: number = MAX_GENERATION_ATTEMPTS
): Promise<GeneratedObject> {
  const attempts: ScenarioGenerationAttempt[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const generated = await generate({ objectId: fact.id, facts: fact.facts, attempt });
    if (generated === null || generated.trim().length === 0) {
      attempts.push({ attempt, generated: null, review: null });
      continue;
    }
    const review = await reviewDescription(generated, fact.facts, reviewTransports);
    attempts.push({ attempt, generated, review });
    if (passesReview(review)) return { id: fact.id, description: generated, accepted: true, attempts };
  }
  return { id: fact.id, description: fact.facts, accepted: false, attempts };
}

export interface GeneratedScenario {
  readonly mode: "enjoyable";
  readonly model: string;
  readonly generationTemperature: number;
  readonly reviewTemperature: number;
  readonly generatedAt: string;
  readonly objects: readonly GeneratedObject[];
}

/** CODER-BRIEF decision 5: "the full generated scenario (every description,
 *  every review answer, the model, the temperature) is written into the
 *  transcript" -- this is that record, one object at a time (never
 *  concurrently: the one-model-at-a-time swapper the real transport goes
 *  through, CLAUDE.md, "one driver at a time"). */
export async function generateScenario(params: {
  objects: readonly ScenarioObjectFact[];
  model: string;
  generationTemperature: number;
  reviewTemperature: number;
  generate: ScenarioGenerationTransport;
  reviewTransports: readonly ReaderTransport[];
  maxAttempts?: number;
  now?: () => Date;
}): Promise<GeneratedScenario> {
  const objects: GeneratedObject[] = [];
  for (const fact of params.objects) {
    objects.push(await generateObjectDescription(fact, params.generate, params.reviewTransports, params.maxAttempts));
  }
  const now = params.now ?? (() => new Date());
  return {
    mode: "enjoyable",
    model: params.model,
    generationTemperature: params.generationTemperature,
    reviewTemperature: params.reviewTemperature,
    generatedAt: now().toISOString(),
    objects,
  };
}

/** The description override map `briefing.ts`'s `authoredDescription` reads
 *  (the same seam the welded-window arm's `WELDED_DESCRIPTION` already is):
 *  object id -> the text the game actually uses this game. */
export function descriptionOverridesFrom(scenario: GeneratedScenario): Readonly<Record<string, string>> {
  return Object.fromEntries(scenario.objects.map((o) => [o.id, o.description]));
}

/** The fixed §4.1 list, as facts to preserve -- ids and authored text only,
 *  never a property, a starting value or a mechanic (CODER-BRIEF decision 2:
 *  "start small"). */
export function scenarioObjectFacts(): readonly ScenarioObjectFact[] {
  return OPEN_OBJECTS.map((o) => ({ id: o.id, facts: o.description }));
}
