import { createHash } from "node:crypto";
import { createTurnReader, type ReadRequest, type ReaderTransport, type TransportAnswer } from "run-dmcp";
import { createReferee, ONE_ACT_QUESTION, INTENT_SOURCE_ID } from "../referee.js";
import { buildPrompt } from "../refereeTransport.js";
import { resolveScene } from "./scene.js";
import type { LabelCitation, RefereeLabel, RefereeQuestionId } from "./types.js";

/**
 * The renderer (the-prisoner#10): a `train`-split label -> one chat-messages
 * example, built through the REAL request the referee would actually be
 * asked (`resolveScene` + `createReferee`, never a copy of the prompt text)
 * and validated through `run-dmcp`'s own `createTurnReader` -- the same
 * closed-key/verbatim-citation machinery every real referee call goes
 * through -- before it is ever written. A label that fails that check is an
 * error, not a skipped line (the issue's own words): a bad citation in the
 * TRAINING data would teach a model to cite wrongly, which is worse than
 * shipping nothing.
 *
 * `test`-split labels are never rendered into training output at all --
 * see `renderTrainingExamples` below, and its own test asserting a `test`
 * row never reaches the output even when handed to it.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface RenderedExample {
  labelId: string;
  /** `"main"` for the six-question ruling, `"acts"` for OPEN-VARIANT.md
   *  §74.1's separate one-act reading (only when `expected.acts` is set). */
  part: "main" | "acts";
  messages: readonly ChatMessage[];
  /** sha256 of the exact prompt text this example's user turn carries --
   *  built by the real `buildPrompt`, so two examples with this hash equal
   *  were asked byte-identical requests (the issue's own "stamps each
   *  output with a hash of the prompt it used"). */
  promptHash: string;
  questionIds: readonly string[];
}

function fieldFor(label: RefereeLabel, questionId: RefereeQuestionId): { answerKey: string | null; citation: LabelCitation | null } {
  switch (questionId) {
    case "target":
      return { answerKey: label.expected.target, citation: label.citations.target };
    case "effect":
      return { answerKey: label.expected.effect, citation: label.citations.effect };
    case "product":
      return { answerKey: label.expected.product, citation: label.citations.product };
    case "property":
      return { answerKey: label.expected.property, citation: label.citations.property };
    case "magnitude":
      return { answerKey: label.expected.magnitude, citation: label.citations.magnitude };
    case "perceptibility":
      return { answerKey: label.expected.perceptibility, citation: label.citations.perceptibility };
    case "acts":
      return { answerKey: label.expected.acts, citation: label.citations.acts };
  }
}

function citationToTransport(citation: LabelCitation): TransportAnswer["citation"] {
  if (citation.from !== undefined && citation.to !== undefined) return { sourceId: citation.sourceId, from: citation.from, to: citation.to };
  if (citation.quote !== undefined) return { sourceId: citation.sourceId, quote: citation.quote };
  throw new Error(`refereeData/render: citation for source "${citation.sourceId}" has neither a "quote" nor a "from"/"to" range`);
}

/** Builds the `TransportAnswer[]` a label's OWN expected answers would
 *  produce for `request` -- throws (never skips) when a question the
 *  request asks has no expected answer, or an expected key is not legal for
 *  that question: both are label defects, not "nothing to render" cases. */
function answersFor(label: RefereeLabel, request: ReadRequest): TransportAnswer[] {
  return request.questions.map((q) => {
    const { answerKey, citation } = fieldFor(label, q.id as RefereeQuestionId);
    if (answerKey === null) throw new Error(`refereeData/render: label "${label.id}" has no expected answer for question "${q.id}" -- cannot render a training example`);
    if (!q.answerKeys.includes(answerKey)) throw new Error(`refereeData/render: label "${label.id}"'s expected "${q.id}" answer "${answerKey}" is not one of this question's legal keys (${q.answerKeys.join(", ")}) -- the label is stale against the current referee`);
    if (citation === null) throw new Error(`refereeData/render: label "${label.id}" has no expected citation for question "${q.id}"`);
    return { questionId: q.id, answerKey, citation: citationToTransport(citation) };
  });
}

/** Runs `answers` through the REAL `createTurnReader` for `request` and
 *  throws with the reader's own reason when any answer was not accepted
 *  exactly as offered -- the issue's own required check ("passes every
 *  rendered assistant answer through run-dmcp's `createTurnReader` checks
 *  (closed keys, verbatim citations) before writing it"). */
async function validateAnswers(label: RefereeLabel, request: ReadRequest, answers: readonly TransportAnswer[]): Promise<void> {
  const scripted: ReaderTransport = async () => answers;
  const result = await createTurnReader({ questions: request.questions, transports: [scripted] }).read(request.sources);
  for (const answer of result.answers) {
    if (answer.fromSafeDefault) {
      const rejected = answer.rejected.map((r) => r.reason).join(", ") || "no offer reached this question";
      throw new Error(`refereeData/render: label "${label.id}" question "${answer.questionId}" fell to its safe default ("${answer.answerKey}") -- rejected: ${rejected}`);
    }
    const offered = fieldFor(label, answer.questionId as RefereeQuestionId).answerKey;
    if (answer.answerKey !== offered) {
      throw new Error(`refereeData/render: label "${label.id}" question "${answer.questionId}" was accepted as "${answer.answerKey}", not the label's own "${offered}" -- run-dmcp normalised or rejected part of the offer`);
    }
  }
}

function promptHashFor(request: ReadRequest): string {
  return `sha256:${createHash("sha256").update(buildPrompt(request)).digest("hex")}`;
}

function toExample(label: RefereeLabel, part: "main" | "acts", request: ReadRequest, answers: readonly TransportAnswer[]): RenderedExample {
  const assistantJson = answers.map((a) => ({ questionId: a.questionId, answerKey: a.answerKey, citation: a.citation }));
  return {
    labelId: label.id,
    part,
    messages: [
      { role: "user", content: buildPrompt(request) },
      { role: "assistant", content: JSON.stringify(assistantJson) },
    ],
    promptHash: promptHashFor(request),
    questionIds: request.questions.map((q) => q.id),
  };
}

/** Captures the real six-question `ReadRequest` `createReferee(...).rule()`
 *  would build for this label -- `oneAct: "off"` always: the separate
 *  one-act reading is rendered on its own below, never folded into this
 *  request, so a label that never exercises it renders a request identical
 *  to every other referee call in this file. */
async function captureMainRequest(label: RefereeLabel): Promise<ReadRequest> {
  const { perceived, refereeOptions } = resolveScene(label.scene, label.intentText, label.refereeArms);
  let captured: ReadRequest | null = null;
  const captor: ReaderTransport = async (request) => {
    captured = request;
    return [];
  };
  await createReferee([captor], { ...refereeOptions, oneAct: "off" }).rule(label.intentText, perceived);
  if (!captured) throw new Error(`refereeData/render: label "${label.id}": the referee never asked a question for this scene`);
  return captured;
}

/** OPEN-VARIANT.md §74.1's one-act reading: its own single-question request,
 *  the actor's intent as its only source -- built the same way `referee.ts`'s
 *  own `readOneAct` builds it, never a copy of `ONE_ACT_QUESTION`'s text. */
function actsRequest(label: RefereeLabel): ReadRequest {
  return { questions: [ONE_ACT_QUESTION], sources: [{ id: INTENT_SOURCE_ID, text: label.intentText }] };
}

/** Renders one `train`-split label into one or two chat-messages examples
 *  (a second, `"acts"` one only when `expected.acts` is set) -- throws on
 *  any defect (the issue's "a label that fails is an error, not a skipped
 *  line"). Exported so a caller that already knows a label is `train` (a
 *  test, or a caller building a single label's preview) can render it
 *  directly; `renderTrainingExamples` below is the batch entry point that
 *  also enforces the split rule. */
export async function renderLabel(label: RefereeLabel): Promise<RenderedExample[]> {
  const examples: RenderedExample[] = [];

  const mainRequest = await captureMainRequest(label);
  const mainAnswers = answersFor(label, mainRequest);
  await validateAnswers(label, mainRequest, mainAnswers);
  examples.push(toExample(label, "main", mainRequest, mainAnswers));

  if (label.expected.acts !== null) {
    const request = actsRequest(label);
    const answers = answersFor(label, request);
    await validateAnswers(label, request, answers);
    examples.push(toExample(label, "acts", request, answers));
  }

  return examples;
}

export interface RenderReport {
  examples: RenderedExample[];
  /** Labels present in the input whose `split` was `test` -- never rendered
   *  (the issue's own required refusal), counted so a caller can see the
   *  filter did something rather than silently emitting zero rows. */
  refusedTestCount: number;
}

/**
 * The batch entry point: renders every `train`-split label, in order, and
 * REFUSES every `test`-split one -- not by throwing (a labels file mixing
 * both splits is normal and expected), but by never including it in
 * `examples`, which is what "refuses to write the `test` split into
 * training output" means operationally. A label that IS `train` but fails
 * validation still throws (see `renderLabel`), because that failure is a
 * defect in a label meant to teach a model something, never a row worth
 * silently dropping.
 */
export async function renderTrainingExamples(labels: readonly RefereeLabel[]): Promise<RenderReport> {
  const examples: RenderedExample[] = [];
  let refusedTestCount = 0;
  for (const label of labels) {
    if (label.split === "test") {
      refusedTestCount++;
      continue;
    }
    examples.push(...(await renderLabel(label)));
  }
  return { examples, refusedTestCount };
}
