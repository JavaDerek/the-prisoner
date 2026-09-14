import type { ReadRequest, ReaderTransport, TransportAnswer } from "run-dmcp";

/**
 * The referee's real transport (this task's brief: "The referee transport
 * is a plain async function in this repo that calls the configured referee
 * model through the swapper... never in run-dmcp or mind-seam"). A
 * `ReaderTransport` per `run-dmcp`'s own contract (`turnReader.ts`'s header:
 * "a transport is a plain async function the CALLER wrote"), built the same
 * way `mind-seam`'s own `createLocalMind` wire is -- a POST to an
 * OpenAI-compatible `/chat/completions` endpoint, `tools: []`, `stream:
 * false`, no credential -- but standalone: the turn reader's `Mind`-free
 * shape (`TransportAnswer[]`, not a `Proposal`) means this cannot simply
 * call `mind-seam`'s wire, and the referee is explicitly NOT a `Mind`
 * (`referee.ts`'s header).
 *
 * TEMPERATURE 0 (OPEN-VARIANT.md §3.5: "The referee runs at temperature
 * 0") -- not configurable by a caller of this function, because determinism
 * is the whole point of §3.5's consistency property, never a per-call
 * choice.
 *
 * NEVER RUN AGAINST doris IN THIS TASK. This module is exercised only with
 * an injected `fetchFn` in tests (`refereeTransport.test.ts`) -- the real
 * network path is untested here by design (this task's brief: "Do not run
 * any game against doris").
 *
 * FAILURE IS AN EMPTY ANSWER LIST, never a throw: `createTurnReader`'s own
 * ladder treats a rung that throws and a rung that returns `[]` identically
 * (`turnReader.ts`: "a rung that throws, rejects, or returns something that
 * is not an array of answers is treated identically") -- returning `[]`
 * rather than throwing keeps this function's own error handling in one
 * place (a single `try/catch`) rather than relying on the ladder's own
 * catch to paper over a thrown error this function could have reported more
 * specifically, at no behavioural cost, since both paths advance the ladder
 * identically either way.
 */
export interface CreateRefereeTransportOptions {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), mirroring
   *  `CreatePrisonerMindOptions.ensureLoaded` -- called once per transport
   *  invocation, before the request itself, so the referee model and
   *  either mind's model are never both resident when this run intends
   *  only one loaded at a time. Absent in every test in this repository
   *  except a real checkpoint run. */
  ensureLoaded?: (model: string) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 12_000;

/** Renders one `ReadRequest` into a single user prompt -- this repository's
 *  own text, never read back by `run-dmcp` (the reader's own discipline:
 *  `ReaderQuestion.prompt`/`ReaderSource.text` are opaque to the engine;
 *  building a model prompt from them is this CALLER's job, exactly as
 *  `mind-seam`'s own `prompt: (context) => string` is the caller's). Asks
 *  for a JSON array of `{questionId, answerKey, citation: {sourceId,
 *  quote}}` -- the exact shape `TransportAnswer[]` needs, so no translation
 *  step sits between "what the model said" and "what this function
 *  returns" beyond ordinary JSON parsing. */
const PRECEDENT_SOURCE_PREFIX = "precedent:";

function buildPrompt(request: ReadRequest): string {
  // Earlier rulings are this referee's own precedent (`referee.ts`): shown for
  // consistency, apart from the sources, because a referee shown them among
  // the sources cites them -- and no answer may rest on one (OPEN-VARIANT.md
  // §11.4). Ids are written as quoted labels, never in brackets, which the
  // first games showed coming back as "[desc:bar]".
  const citable = request.sources.filter((s) => !s.id.startsWith(PRECEDENT_SOURCE_PREFIX));
  const earlier = request.sources.filter((s) => s.id.startsWith(PRECEDENT_SOURCE_PREFIX));
  const sourceBlocks = citable.flatMap((s) => [`source "${s.id}":`, s.text, ""]);
  const questionLines = request.questions.map(
    (q) => `- id "${q.id}": ${q.prompt} Answer with exactly one of: ${q.answerKeys.join(", ")}.`
  );
  const earlierBlock =
    earlier.length > 0
      ? [
          "EARLIER RULINGS on the same objects, for consistency only. Never cite these; every citation comes from the SOURCES above:",
          ...earlier.map((s) => s.text),
          "",
        ]
      : [];
  return [
    "You are ruling on one attempted action in a physical scene, as a referee -- not a character. Answer every question below.",
    "",
    "SOURCES (the only text you may cite):",
    "",
    ...sourceBlocks,
    ...earlierBlock,
    "QUESTIONS:",
    ...questionLines,
    "",
    'Answer with a JSON array, one entry per question: [{"questionId": string, "answerKey": string, ' +
      '"citation": {"sourceId": string, "quote": string}}, ...].',
    '"sourceId" is a source\'s label exactly as written above, such as "intent" -- no brackets, nothing added.',
    '"quote" is copied from that source character for character: the same capital letters and punctuation, ' +
      'one unbroken span, never shortened with "...", never paraphrased, and never empty.',
  ].join("\n");
}

function firstJsonArray(text: string): unknown {
  try {
    const whole = JSON.parse(text);
    if (Array.isArray(whole)) return whole;
  } catch {
    // fall through to the bracket scan below.
  }
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function coerceAnswers(raw: unknown): TransportAnswer[] {
  if (!Array.isArray(raw)) return [];
  const answers: TransportAnswer[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const questionId = record.questionId;
    const answerKey = record.answerKey;
    const citation = record.citation as { sourceId?: unknown; quote?: unknown } | undefined;
    if (typeof questionId !== "string" || typeof answerKey !== "string") continue;
    if (!citation || typeof citation.sourceId !== "string" || typeof citation.quote !== "string") continue;
    answers.push({ questionId, answerKey, citation: { sourceId: citation.sourceId, quote: citation.quote } });
  }
  return answers;
}

export function createRefereeTransport(options: CreateRefereeTransportOptions): ReaderTransport {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (request: ReadRequest): Promise<readonly TransportAnswer[]> => {
    try {
      if (options.ensureLoaded) await options.ensureLoaded(options.model);

      const response = await fetchFn(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          temperature: 0,
          stream: false,
          tools: [],
          messages: [{ role: "user", content: buildPrompt(request) }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return [];

      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== "string") return [];

      const parsed = firstJsonArray(content);
      return coerceAnswers(parsed);
    } catch {
      return [];
    }
  };
}
