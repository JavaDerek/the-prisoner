import type { InertRecord, Proposal } from "mind-seam";
import { createLocalMind } from "mind-seam";
import type { NarratorFacts } from "./narrator.js";

/**
 * The second verifier (OPEN-VARIANT.md §63) -- a model asked, sentence by
 * sentence, whether a narration is SUPPORTED by the facts it was written
 * from.
 *
 * §54 named this when it wrote down what `verifyNarration` cannot catch: "a
 * PLAUSIBLE sentence with no number, no recognisable object, no outcome
 * phrase, and no mind-state verb about the other principal, that is
 * nonetheless false." It stayed theoretical while completeness held a
 * narration to the catalogue. §60 freed the scene, and a human game on
 * 2026-09-18 showed what lives in the space that opened up -- with
 * `Narrator rejections: 0` for the whole run:
 *
 *   "An ancient fan creaks in the corner"            (no such object)
 *   "To your right, another cot"                     (there is one cot)
 *   "The bar across the window seems a little weaker
 *    than before ... flakes of it breaking free"     (bar integrity 100, never touched)
 *
 * The last one is why this module exists rather than being another item on
 * the open list. It told a player their escape route was progressing when it
 * was not, and it is invisible to every mechanical check: it names no number,
 * so `contradicts-belief` has nothing to compare; it mentions no unknown
 * object; it asserts no outcome. §61 argued that a narration dropping a
 * belief costs the player nothing because code prints the number above it.
 * That is true of SILENCE and false of a vague assertion, and the mechanical
 * checker cannot tell the two apart. A model can.
 *
 * WHAT THIS IS NOT. Not a second narrator: it never rewrites, never suggests,
 * and its answer is a closed key per sentence, never prose. Not a judge of
 * quality: dull-but-true passes. Not a replacement for `verifyNarration`,
 * which stays exactly as it is -- it is cheap, deterministic, and catches
 * things a model reading for sense will wave through (a number that appears
 * nowhere in the data, a way out called shut when it stands open). The two
 * run in that order, mechanical first, and a narration must clear both.
 *
 * COST, and why it is smaller than it looks: one extra generation, and on a
 * single-GPU host usually no extra residency at all, because the call that
 * follows a narration is already a wits or referee call on the auditor's own
 * model. `checkpoint.ts` passes the same `ensureLoaded` every other role uses.
 */

/** One sentence's verdict. An unsupported sentence is CUT, and the rest of
 *  the narration is shown (`redact` below) -- measured, not assumed: on this
 *  scenario the auditor finds something wrong with 2 of 5, 3 of 3 and 3 of 10
 *  sentences from `ancient-awakening:12b`, and 3 of 16, 2 of 12 and 0 of 6
 *  from `qwen3:14b`. Discarding a whole narration for any one bad sentence
 *  therefore throws away every narration the better writer produces and two
 *  thirds of the safer one's -- which is §58.1's failure exactly, a checker
 *  so strict that the mode it guards can never run.
 *
 *  Cutting is safe in the one way that matters: removing a sentence can only
 *  make a narration say LESS. It cannot make the remainder false, and it
 *  cannot hide state, because `humanSeat.ts` renders every belief, the clock
 *  and the news by code above the prose (§61). What it costs is smoothness --
 *  a paragraph can read abruptly where something was taken out. */
export interface SentenceVerdict {
  readonly sentence: string;
  readonly supported: boolean;
  /** The auditor's own short reason, kept for the transcript -- never shown
   *  to a player, who sees only the fallback. */
  readonly why: string;
}

export interface NarrationAudit {
  /** Every sentence that failed. Empty means the auditor found nothing
   *  unsupported, which is NOT a proof the narration is true -- it is one
   *  more reader, with its own blind spots, not an oracle. */
  readonly unsupported: readonly SentenceVerdict[];
  /** The narration with those sentences cut: what a player actually reads.
   *  Empty when nothing survived, which `narrator.ts` reads as "fall back to
   *  the prose view". */
  readonly kept: string;
  /** False when the auditor could not be reached, timed out, or answered
   *  unusably. A narration is NOT discarded for that -- an auditor that is
   *  down must not silently turn every turn into the prose view, which is
   *  the failure §58.1 spent a day being. It is counted instead. */
  readonly audited: boolean;
}

/** Sentence splitting, shared with `verifyNarration`'s own: a plain
 *  punctuation split, conservative rather than clever, and the numbering the
 *  auditor answers against is this array's own order. */
export function auditSentences(narration: string): string[] {
  return narration
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The narration a player reads: every sentence the auditor did not object
 *  to, in their original order, rejoined with single spaces. */
export function redact(sentences: readonly string[], unsupported: readonly SentenceVerdict[]): string {
  const cut = new Set(unsupported.map((u) => u.sentence));
  return sentences.filter((s) => !cut.has(s)).join(" ");
}

const AUDIT_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          supported: { type: "boolean" },
          why: { type: "string" },
        },
        required: ["n", "supported", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["verdicts"],
  additionalProperties: false,
};

interface AuditReply extends Proposal {
  readonly verdicts: readonly { readonly n: number; readonly supported: boolean; readonly why: string }[];
}

function coerceAuditReply(raw: unknown): AuditReply | null {
  if (typeof raw !== "object" || raw === null) return null;
  const verdicts = (raw as Record<string, unknown>).verdicts;
  if (!Array.isArray(verdicts)) return null;
  const parsed = verdicts
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({ n: Number(v.n), supported: v.supported === true, why: typeof v.why === "string" ? v.why : "" }))
    .filter((v) => Number.isInteger(v.n));
  if (parsed.length === 0) return null;
  return { intent: "audit", verdicts: parsed };
}

function factLines(facts: NarratorFacts): string[] {
  const lines: string[] = [];
  if (facts.parts.conditionLines.length > 0) lines.push(...facts.parts.conditionLines, "");
  lines.push(...facts.parts.identityLines, "");
  lines.push("Things that exist here, and their full descriptions:", ...facts.parts.objectLines, "");
  lines.push(...facts.parts.ruleLines);
  return lines;
}

export function buildAuditPrompt(facts: NarratorFacts, sentences: readonly string[]): string {
  return [
    "You are checking a piece of prose against the facts it was supposed to be written from.",
    "",
    "=== THE FACTS, complete. Nothing else about this world is true. ===",
    ...factLines(facts),
    "",
    "=== THE PROSE, one numbered sentence at a time ===",
    ...sentences.map((s, i) => `${i + 1}. ${s}`),
    "",
    "For EACH numbered sentence, decide whether everything it asserts is supported by the facts above.",
    "Mark a sentence UNSUPPORTED when it does any of these:",
    "- mentions a thing, person, place or room that is not in the facts (a fan, a second cot, another prisoner, a corridor);",
    "- describes weather, light, darkness, time of day, a sound, a smell or a temperature that the facts never state;",
    "- says something has changed, worn, weakened, improved or moved, when the facts do not record that change;",
    "- gives a property, material or detail of a thing that differs from its description above;",
    "- states what another person thinks, feels, intends, suspects or has been doing;",
    "- asserts what will happen, or what an action will achieve.",
    "Mark it SUPPORTED when everything in it traces to the facts -- including plain re-wording, mood, and a character's",
    "own memories or motive where the facts above state them. Dull and true is SUPPORTED. Vivid and invented is not.",
    "",
    'Answer with one JSON object: {"verdicts": [{"n": <sentence number>, "supported": <true|false>, "why": "<a few words>"}]}.',
    "Give a verdict for every sentence, in order.",
  ].join("\n");
}

export interface CreateNarrationAuditorOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), exactly as every other role. */
  ensureLoaded?: (model: string) => Promise<void>;
  /** The auditor itself was unreachable, slow or unusable -- counted, never
   *  a reason to discard the narration (see `NarrationAudit.audited`). */
  onUnavailable?: (detail: string) => void;
}

export interface NarrationAuditor {
  audit(facts: NarratorFacts, narration: string): Promise<NarrationAudit>;
}

export function createNarrationAuditor(options: CreateNarrationAuditorOptions): NarrationAuditor {
  const ensureLoaded = options.ensureLoaded ?? (async () => {});
  return {
    async audit(facts: NarratorFacts, narration: string): Promise<NarrationAudit> {
      const sentences = auditSentences(narration);
      if (sentences.length === 0) return { unsupported: [], kept: narration, audited: true };
      const localMind = createLocalMind<{ sentences: readonly string[] }, AuditReply>({
        baseUrl: options.baseUrl,
        model: options.model,
        temperature: options.temperature,
        timeoutMs: options.timeoutMs,
        fetchFn: options.fetchFn,
        responseFormat: { jsonSchema: AUDIT_SCHEMA, name: "audit" },
        prompt: () => buildAuditPrompt(facts, sentences),
        coerce: (raw) => coerceAuditReply(raw),
        onSilence: (reason) => options.onUnavailable?.(String(reason)),
      });
      await ensureLoaded(options.model);
      const reply = await localMind.consider({ sentences });
      // An auditor that is down leaves the narration exactly as it was. It
      // must never silently turn every turn into the prose view.
      if (reply === null) return { unsupported: [], kept: narration, audited: false };
      const unsupported = reply.verdicts
        .filter((v) => !v.supported)
        // 1-based, as the prompt numbers them; anything outside the range is
        // an auditor talking about a sentence that does not exist, and is
        // dropped rather than guessed at.
        .filter((v) => v.n >= 1 && v.n <= sentences.length)
        .map((v) => ({ sentence: sentences[v.n - 1], supported: false, why: v.why }));
      return { unsupported, kept: redact(sentences, unsupported), audited: true };
    },
  };
}
