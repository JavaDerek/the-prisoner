import type { ReadRequest, ReaderTransport, TransportAnswer } from "run-dmcp";
import type { ThinkingMode } from "./thinking.js";

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
  /** OPEN-VARIANT.md §64.7, WORLD-ELABORATION-DESIGN.md §4.8, `thinking.ts`.
   *  Default `"on"`: `reasoning_effort` stays unset, byte-identical to every
   *  batch recorded before this arm existed. `"off"` sends `reasoning_effort:
   *  "none"`. */
  thinking?: ThinkingMode;
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
  // OPEN-VARIANT.md §18.6/§18.7: this used to split off any `precedent:`
  // source into a separate "EARLIER RULINGS ... for consistency only" block.
  // The referee copied one intent's ruling onto a different one just
  // because the block named the same object; rewording it to include the
  // ruled intent did not fix that (§18.7's live re-rule: still 8 of 11
  // reveal). `referee.ts` no longer builds one -- every source here is an
  // ordinary citable one. Ids are written as quoted labels, never in brackets, which the
  // first games showed coming back as "[desc:bar]".
  // OPEN-VARIANT.md §18.1: every source with its words numbered, so a
  // citation names a range instead of retyping text. §18.4: the plain text
  // comes first -- a referee shown numbered words alone misread the intents
  // themselves (examinations ruled wear) in the first game that tried it.
  const sourceBlocks = request.sources.flatMap((s) => [`source "${s.id}":`, s.text, `words: ${numberedWords(s.text)}`, ""]);
  const questionLines = request.questions.map(
    (q) => `- id "${q.id}": ${q.prompt} Answer with exactly one of: ${q.answerKeys.join(", ")}.`
  );
  return [
    "You are ruling on one attempted action in a physical scene, as a referee -- not a character. Answer every question below.",
    "",
    "SOURCES (the only text you may cite):",
    "",
    ...sourceBlocks,
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

/**
 * OPUS-FIRST-DESIGN.md §3.1, RESULTS.md bug 1 of `checkpoints/2026-09-20-ambition`: behind §37's stray
 * quote, the one reply that batch lost also closed itself `]}` where `}]` was meant -- the last
 * entry's `}` and the array's `]` swapped -- so the quote repair alone still left it unparseable and
 * a `door`/`leave` ruling fell to every safe default. When a closer does not match the bracket that is
 * open, and nothing but closers and whitespace remains, the tail is rewritten to close what is
 * actually open, innermost first. Nothing else is touched: a closer in the wrong place with more
 * text after it, or a reply that simply stops short, is left as it came and stays unparseable.
 * Strings are skipped so a bracket inside a quote counts for nothing. Syntax only, like the quote
 * repair below: it rewrites brackets, never a key, a number, or a word.
 */
function rebalanceClosers(text: string): string {
  const open: string[] = [];
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "[" || ch === "{") open.push(ch === "[" ? "]" : "}");
    else if (ch === "]" || ch === "}") {
      if (open[open.length - 1] === ch) open.pop();
      else if (/^[\]}\s]*$/.test(text.slice(i))) return text.slice(0, i) + open.reverse().join("");
      else return text;
    }
  }
  return text;
}

/**
 * OPEN-VARIANT.md §37: a referee that judged correctly closed a citation `"to": 12"}`, and one stray
 * quote cost the whole ruling. Only when the text does not parse as it came, a quote directly after a
 * number that follows a key's colon, before `,` `}` or `]`, is dropped, then (§3.1 above) a transposed
 * closing tail is put in order, and the parse tried once more. Syntax only, like §30's clamp and
 * §33.16's id: it cannot touch a reply that already parses, and it never reads what an answer says.
 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const repaired = rebalanceClosers(text.replace(/(:\s*-?\d+)"(?=\s*[,}\]])/g, "$1"));
    if (repaired === text) throw error;
    return JSON.parse(repaired);
  }
}

function firstJsonArray(text: string): unknown {
  try {
    const whole = parseJson(text);
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
          const parsed = parseJson(text.slice(start, i + 1));
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
  if (from < 1 || from > to || from > words.length) return null;
  // OPEN-VARIANT.md §30: a referee that names a real first word and runs past the
  // source's last one is citing what is there plus nothing; the span ends where the
  // source does. Dropping it instead cost seven attempts to leave (§29.1), each on an
  // intent short enough to overshoot. A `from` past the end is still no citation at all.
  const end = Math.min(to, words.length);
  return { sourceId: source.id, quote: source.text.slice(words[from - 1].start, words[end - 1].end), from, to: end };
}

/**
 * OPEN-VARIANT.md §33.16: `buildPrompt` lists each question as `- id "target": ...`, and a referee
 * that copies that label back as its questionId has every answer ignored. Exactly `id "<id>"`, for
 * an id the request asked, is read as that id; any other questionId is handed on unchanged. Lexical
 * only, on the reply's structure -- the same kind of repair as §30's range clamp, never a reading of
 * what the intent means.
 */
function questionIdOf(questionId: string, request: ReadRequest): string {
  const match = /^id "([^"]+)"$/.exec(questionId);
  return match && request.questions.some((q) => q.id === match[1]) ? match[1] : questionId;
}

function coerceAnswers(raw: unknown, request: ReadRequest): TransportAnswer[] {
  if (!Array.isArray(raw)) return [];
  const answers: TransportAnswer[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const questionId = typeof record.questionId === "string" ? questionIdOf(record.questionId, request) : record.questionId;
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

/** OPEN-VARIANT.md §38: what one call to the referee model actually came back with, kept so a lost
 *  ruling can be diagnosed from the transcript's sidecar (§37 could not, for four of six). */
export type RefereeExchange = { readonly ms: number; readonly status?: number; readonly content?: string; readonly error?: string };

export type RefereeTransport = ReaderTransport & { readonly lastExchange: () => RefereeExchange | undefined };

export function createRefereeTransport(options: CreateRefereeTransportOptions): RefereeTransport {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let last: RefereeExchange | undefined;

  const transport = async (request: ReadRequest): Promise<readonly TransportAnswer[]> => {
    const start = performance.now();
    let status: number | undefined;
    let content: string | undefined;
    const keep = (error?: unknown) => {
      last = {
        ms: Math.round(performance.now() - start),
        ...(status !== undefined ? { status } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(error !== undefined ? { error: String(error) } : {}),
      };
    };
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
          // §64.7: "off" only -- "on" (the default) never adds this key at
          // all, so the request stays byte-identical to every batch
          // recorded before this arm existed.
          ...(options.thinking === "off" ? { reasoning_effort: "none" } : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      status = response.status;
      if (!response.ok) return (keep(), []);

      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = body.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return (keep("no message content"), []);
      content = reply;

      const parsed = firstJsonArray(reply);
      // OPUS-FIRST-DESIGN.md §3.1: a reply nothing above could read used to be kept as a clean
      // exchange -- status 200, content, no error -- and the ruling fell to every safe default
      // looking exactly like a referee that had offered nothing. Still `[]` to the ladder (the
      // header's contract), but the record says why, and `checkpointTranscript.ts` prints it.
      if (parsed === null) return (keep("referee reply unparseable: no JSON array of answers could be read from the content kept beside this"), []);
      keep();
      return coerceAnswers(parsed, request);
    } catch (error) {
      keep(error);
      return [];
    }
  };
  return Object.assign(transport, { lastExchange: () => last });
}
