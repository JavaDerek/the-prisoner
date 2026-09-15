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
 *  returns" beyond ordinary JSON parsing. OPEN-VARIANT.md §18 changed the
 *  citation to a word range `{sourceId, from, to}`, rebuilt into that shape
 *  by `coerceAnswers`; a `{sourceId, quote}` still passes through. */
const PRECEDENT_SOURCE_PREFIX = "precedent:";

/** A citation as this transport hands it on (OPEN-VARIANT.md §18): the
 *  engine's `{sourceId, quote}`, plus the word range the quote was rebuilt
 *  from when the referee cited by range. The engine reads only `sourceId`
 *  and `quote`; the range is this repository's record, for transcripts. */
export type RangedCitation = { sourceId: string; quote: string; from?: number; to?: number };

/** A source's words, OPEN-VARIANT.md §18.1: each maximal run of
 *  non-whitespace, with where it starts and ends in the text. Lexical only --
 *  nothing here reads what a word means. */
function wordsOf(text: string): { start: number; end: number }[] {
  const words: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i <= text.length; i++) {
    const isSpace = i === text.length || text[i].trim() === "";
    if (!isSpace && start < 0) start = i;
    else if (isSpace && start >= 0) {
      words.push({ start, end: i });
      start = -1;
    }
  }
  return words;
}

/** `1:A 2:heavy 3:door ...` -- the words of `text`, numbered from 1. */
function numberedWords(text: string): string {
  return wordsOf(text)
    .map((w, i) => `${i + 1}:${text.slice(w.start, w.end)}`)
    .join(" ");
}

function buildPrompt(request: ReadRequest): string {
  // Earlier rulings are this referee's own precedent (`referee.ts`): shown for
  // consistency, apart from the sources, because a referee shown them among
  // the sources cites them -- and no answer may rest on one (OPEN-VARIANT.md
  // §11.4). Ids are written as quoted labels, never in brackets, which the
  // first games showed coming back as "[desc:bar]".
  const citable = request.sources.filter((s) => !s.id.startsWith(PRECEDENT_SOURCE_PREFIX));
  const earlier = request.sources.filter((s) => s.id.startsWith(PRECEDENT_SOURCE_PREFIX));
  // OPEN-VARIANT.md §18.1: every citable source with its words numbered, so a
  // citation names a range instead of retyping text.
  const sourceBlocks = citable.flatMap((s) => [`source "${s.id}":`, numberedWords(s.text), ""]);
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
      '"citation": {"sourceId": string, "from": number, "to": number}}, ...].',
    '"sourceId" is a source\'s label exactly as written above, such as "intent" -- no brackets, nothing added.',
    // OPEN-VARIANT.md §18.1: the words cited are named by their numbers.
    '"from" and "to" are the numbers of the first and last words of the span you cite in that source, as numbered above; ' +
      'for a single word, "from" and "to" are the same number.',
    // §18.2: a quote is still accepted, and still checked byte-exact.
    'A citation may instead give "quote" in place of "from" and "to".',
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

/**
 * OPEN-VARIANT.md §18.1: a ranged citation becomes the engine's quote, the
 * source sliced from the first character of word `from` to the last of word
 * `to` -- an exact substring by construction. `null` (the offer is dropped,
 * §18.2) for a source not in the request, or a range that is not two
 * integers with 1 <= from <= to <= the source's word count.
 */
function rebuildRanged(citation: { sourceId: string; from?: unknown; to?: unknown }, request: ReadRequest): RangedCitation | null {
  const { from, to } = citation;
  const source = request.sources.find((s) => s.id === citation.sourceId);
  if (!source || typeof from !== "number" || typeof to !== "number" || !Number.isInteger(from) || !Number.isInteger(to)) return null;
  const words = wordsOf(source.text);
  if (from < 1 || from > to || to > words.length) return null;
  return { sourceId: source.id, quote: source.text.slice(words[from - 1].start, words[to - 1].end), from, to };
}

function coerceAnswers(raw: unknown, request: ReadRequest): TransportAnswer[] {
  if (!Array.isArray(raw)) return [];
  const answers: TransportAnswer[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const questionId = record.questionId;
    const answerKey = record.answerKey;
    const citation = record.citation as { sourceId?: unknown; quote?: unknown; from?: unknown; to?: unknown } | undefined;
    if (typeof questionId !== "string" || typeof answerKey !== "string") continue;
    if (!citation || typeof citation.sourceId !== "string") continue;
    // A range, when one is given, is what the referee cited; a quote alongside
    // it is not read (§18.1: the quote is rebuilt). Without one, a quote
    // passes through untouched for the engine's byte-exact check (§18.2).
    if (citation.from !== undefined || citation.to !== undefined) {
      const rebuilt = rebuildRanged({ sourceId: citation.sourceId, from: citation.from, to: citation.to }, request);
      if (rebuilt) answers.push({ questionId, answerKey, citation: rebuilt });
      continue;
    }
    if (typeof citation.quote !== "string") continue;
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
      return coerceAnswers(parsed, request);
    } catch {
      return [];
    }
  };
}
