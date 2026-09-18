import type { Proposal, InertRecord, SilenceReason, SilenceDetail } from "mind-seam";
import { createLocalMind } from "mind-seam";
import { seatSituationParts, type OpenPrincipalContext, type SeatSituationParts } from "./mind.js";
import { parseBriefing, type ParsedBriefing } from "./proseView.js";
import type { ObjectPerception } from "./referee.js";
import type { Condition } from "./conditionList.js";

/**
 * The-prisoner#21 route 2 (D3, 2026-09-18): a narrator model, deferred at
 * §53 until route 1 (`proseView.ts`) existed to compare against. Same rule
 * as route 1's hard constraint: a VIEW, never a different information set --
 * but a model, unlike code, can fail that rule by simply being wrong. The
 * owner's own words: build it "as a switch, with acceptance tests that will
 * tell us if the narration becomes a liability." This module is both halves:
 * the narrator call itself, and `verifyNarration`, the checker that decides
 * whether a given narration is safe to show a player.
 *
 * THE HUMAN SEAT ONLY. No model prompt changes, ever -- this module is never
 * imported by `mind.ts`'s prompt builders, and nothing here reaches
 * `OpenPrincipalContext` before it goes to a wits or voice call. A narrated
 * prompt would change the benchmark underneath the project (root
 * CLAUDE.md/OPEN-VARIANT.md §53's own words, restated because they apply
 * with more force here, not less).
 *
 * DATA IN: the SAME structured data `proseView.ts` composes from --
 * `seatSituationParts` (mind.ts) plus `parseBriefing` (proseView.ts) over
 * the identical `context.briefing` -- never a second, independently-written
 * reading of the same text that could drift from route 1's. `buildNarratorFacts`
 * below is nothing but those two calls, held together as one record.
 *
 * DATA OUT, VERIFIED: the model is free-text prose, so unlike route 1 it CAN
 * be wrong -- it can invent, drop, contradict, or speak for a principal it
 * was never given the mind of. `verifyNarration(facts, narration)` is a
 * checker over exactly those two things: never a second model call
 * second-guessing the first (this game does not have a second GPU tenant to
 * spend on that), and never a snapshot comparison (a future edit could
 * regenerate a wrong snapshot along with the bug, the same lesson §53's own
 * completeness test was built against). A narration that fails is discarded
 * by `createNarrator` itself: the caller never sees an unverified narration,
 * only `null`, which `humanSeat.ts` reads as "fall back to the prose view."
 *
 * WHAT THIS CANNOT CATCH, stated plainly (the owner's own requirement, and
 * the reason this comment is this long): a PLAUSIBLE sentence with no number,
 * no recognisable object, no outcome phrase, and no mind-state verb about the
 * other principal, that is nonetheless false -- "the corridor is quiet" when
 * nothing in the data says whether it is. Nothing mechanical catches that
 * without judging what the sentence MEANS, which is exactly the kind of
 * pattern-matching CLAUDE.md forbids for a referee's ruling and which this
 * checker refuses for the identical reason: a checker that is sometimes
 * wrong about meaning is worse than a checker that says plainly what it
 * cannot do. See docs/OPEN-VARIANT.md's own section on this for what would
 * actually catch it (a second, independent verifier model asking "is this
 * sentence supported by the facts", which is a different cost and a
 * different failure mode, not a free extension of this one).
 */

/** Everything the narrator's prompt is built from, and everything
 *  `verifyNarration` checks a narration against -- one record, so the two
 *  can never see a different set of facts than each other. */
export interface NarratorFacts {
  readonly parts: SeatSituationParts;
  readonly parsed: ParsedBriefing;
  readonly objects: readonly ObjectPerception[];
}

export function buildNarratorFacts(selfName: string, otherName: string, context: OpenPrincipalContext, conditions?: readonly Condition[]): NarratorFacts {
  return {
    parts: seatSituationParts(selfName, otherName, context, conditions),
    parsed: parseBriefing(context.briefing),
    objects: context.perceivedObjects,
  };
}

function extractIntegers(text: string): number[] {
  const matches = text.match(/-?\d+/g);
  return matches ? matches.map(Number) : [];
}

function collectKnownNumbers(facts: NarratorFacts): Set<number> {
  const texts = [...facts.parts.conditionLines, ...facts.parts.identityLines, ...facts.parts.objectLines, ...facts.parts.ruleLines];
  const set = new Set<number>();
  for (const text of texts) for (const n of extractIntegers(text)) set.add(n);
  return set;
}

/** Sentences, for the checks that need to know WHICH claim a number or a
 *  state word belongs to (`contradicts-belief`, `contradicts-state`,
 *  `speaks-for-other`, `narrates-outcome`) rather than only whether it
 *  appears anywhere in the whole narration. A plain punctuation split -- no
 *  attempt to parse grammar, and no claim that it always finds the right
 *  boundary; it only needs to be conservative enough not to manufacture
 *  false contradictions across unrelated sentences. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function spacedLabel(id: string): string {
  return id.replace(/_/g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentionsLabel(text: string, label: string): boolean {
  return new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(text);
}

const OPEN_STATE_WORDS = /\bstands? open\b|\bis open\b|\bopen now\b|\bswings? open\b|\blies open\b/i;
const CLOSED_STATE_WORDS = /\bstands? closed\b|\bis closed\b|\bstands? shut\b|\bis shut\b|\bswings? shut\b/i;

const MIND_STATE_VERBS = [
  "thinks",
  "think",
  "feels",
  "feel",
  "plans",
  "plan",
  "decides",
  "decide",
  "intends",
  "intend",
  "believes",
  "believe",
  "wants",
  "want",
  "hopes",
  "hope",
  "remembers",
  "remember",
  "resolves",
  "resolve",
  "wonders",
  "wonder",
  "suspects",
  "suspect",
];

/** Deliberately a fixed, narrow list rather than any attempt to classify
 *  "outcome language" in general -- exactly the "never pattern-match
 *  meaning" limit this module documents at its own top. Each phrase asserts,
 *  in the narrator's own voice, that an attempt has already succeeded or
 *  failed, which only a referee's ruling may say. */
const OUTCOME_PHRASES = [
  "you succeed",
  "you manage to",
  "and it works",
  "you escape now",
  "you will escape",
  "the door opens for you",
  "you are caught",
  "you are free",
  "it succeeds",
  "you win",
  "you have escaped",
  "you fail to",
];

export interface NarrationViolation {
  readonly kind:
    | "invented-number"
    | "invented-object"
    | "dropped-belief"
    | "dropped-object"
    | "dropped-condition"
    | "dropped-clock"
    | "contradicts-belief"
    | "contradicts-state"
    | "speaks-for-other"
    | "narrates-outcome";
  readonly detail: string;
}

export interface VerifyNarrationOptions {
  readonly selfName: string;
  readonly otherName: string;
  /** Labels (or ids) of every object that exists ANYWHERE in the current
   *  world, perceived by this principal or not -- e.g. the authored
   *  catalogue. OPTIONAL: without it, `invented-object` can only ever fire
   *  for a label this call is explicitly told about, so omitting it never
   *  manufactures a false positive -- it only forgoes the check for objects
   *  nobody named. A label already among the facts' own perceived objects is
   *  never flagged, however it is spelled here. */
  readonly knownWorldLabels?: readonly string[];
}

/**
 * A checker over (data, narration). Returns every violation it finds; an
 * empty array means nothing here caught a problem -- NOT a claim that the
 * narration is true (see this module's own top comment for what it cannot
 * catch).
 */
export function verifyNarration(facts: NarratorFacts, narration: string, options: VerifyNarrationOptions): NarrationViolation[] {
  const violations: NarrationViolation[] = [];
  const known = collectKnownNumbers(facts);
  const narrationSentences = sentences(narration);

  // 1. Invents a fact: a number nowhere in the data it was given.
  for (const n of extractIntegers(narration)) {
    if (!known.has(n)) {
      violations.push({ kind: "invented-number", detail: `the number ${n} appears in the narration but not anywhere in the data the narrator was given` });
    }
  }

  // 2/3. Beliefs: dropped (value or stamp missing) and contradicted (a
  // sentence about this belief gives a different number).
  for (const belief of facts.parsed.beliefs) {
    const labelSentences = narrationSentences.filter((s) => s.toLowerCase().includes(belief.label.toLowerCase()));
    if (labelSentences.length === 0) {
      violations.push({ kind: "dropped-belief", detail: `"${belief.label}" (value ${belief.value}, as of round ${belief.asOfRound}) is never mentioned` });
    } else {
      if (!narration.includes(String(belief.value))) {
        violations.push({ kind: "dropped-belief", detail: `"${belief.label}"'s value (${belief.value}) does not appear anywhere in the narration` });
      }
      if (!narration.includes(String(belief.asOfRound))) {
        violations.push({ kind: "dropped-belief", detail: `"${belief.label}"'s stamp (as of round ${belief.asOfRound}) does not appear anywhere in the narration` });
      }
      for (const s of labelSentences) {
        const nums = extractIntegers(s);
        if (nums.length > 0 && !nums.includes(belief.value)) {
          violations.push({ kind: "contradicts-belief", detail: `a sentence about "${belief.label}" gives ${nums.join(", ")}, but the belief is ${belief.value}: "${s}"` });
        }
      }
    }
  }

  // 4/5. Perceived objects: dropped (never mentioned), and -- only with a
  // wider catalogue supplied -- an object outside what this principal has.
  const perceivedLabels = new Set(facts.objects.map((o) => spacedLabel(o.id).toLowerCase()));
  for (const o of facts.objects) {
    if (!mentionsLabel(narration, spacedLabel(o.id)) && !narration.toLowerCase().includes(o.id.toLowerCase())) {
      violations.push({ kind: "dropped-object", detail: `perceived object "${o.id}" is never mentioned` });
    }
  }
  if (options.knownWorldLabels) {
    for (const label of options.knownWorldLabels) {
      if (perceivedLabels.has(label.toLowerCase())) continue; // legitimately given
      if (mentionsLabel(narration, label)) {
        violations.push({ kind: "invented-object", detail: `"${label}" is mentioned but was not given to the narrator as something ${options.selfName} perceives` });
      }
    }
  }

  // 6. Condition thresholds: every number in a condition's own clauses must
  // survive -- NOT the leading "CONDITION N (for X):" ordinal `renderConditionList`
  // (conditionList.ts) prefixes each line with, which is a list position, not a
  // fact about the world, and must never itself be treated as a dropped threshold.
  for (const line of facts.parts.conditionLines) {
    const clause = line.replace(/^CONDITION \d+ \([^)]*\):\s*/i, "");
    for (const n of extractIntegers(clause)) {
      if (!narration.includes(String(n))) {
        violations.push({ kind: "dropped-condition", detail: `condition threshold ${n} (from "${line}") does not appear in the narration` });
      }
    }
  }

  // 7. The clock.
  if (facts.parsed.roundN !== undefined && !narration.includes(String(facts.parsed.roundN))) {
    violations.push({ kind: "dropped-clock", detail: `the round number (${facts.parsed.roundN}) does not appear in the narration` });
  }
  if (facts.parsed.totalRounds !== undefined && !narration.includes(String(facts.parsed.totalRounds))) {
    violations.push({ kind: "dropped-clock", detail: `the total rounds (${facts.parsed.totalRounds}) does not appear in the narration` });
  }

  // 8. Contradicts the data: open/closed polarity only (the exact example
  // the brief names, "a way out stands open when it does not") -- narrow by
  // design, see this module's own top comment.
  for (const o of facts.objects) {
    const describedOpen = OPEN_STATE_WORDS.test(o.description);
    const label = spacedLabel(o.id);
    for (const s of narrationSentences) {
      if (!mentionsLabel(s, label)) continue;
      const saysOpen = OPEN_STATE_WORDS.test(s);
      const saysClosed = CLOSED_STATE_WORDS.test(s);
      if (describedOpen && saysClosed && !saysOpen) {
        violations.push({ kind: "contradicts-state", detail: `"${o.id}" is described as open, but a sentence says it is closed/shut: "${s}"` });
      }
      if (!describedOpen && saysOpen) {
        violations.push({ kind: "contradicts-state", detail: `"${o.id}" is not described as open, but a sentence says it stands open: "${s}"` });
      }
    }
  }

  // 9. Speaks for the other principal: a mind-state verb applied to them --
  // this principal is never given the other's thoughts, plan, or feelings,
  // so any such claim is invented by definition, regardless of whether it
  // happens to be plausible.
  for (const s of narrationSentences) {
    if (!s.toLowerCase().includes(options.otherName.toLowerCase())) continue;
    if (MIND_STATE_VERBS.some((v) => new RegExp(`\\b${v}\\b`, "i").test(s))) {
      violations.push({ kind: "speaks-for-other", detail: `narrates ${options.otherName}'s own mind, which ${options.selfName} is never given: "${s}"` });
    }
  }

  // 10. Narrates an outcome: only the referee decides what happens.
  for (const s of narrationSentences) {
    const lower = s.toLowerCase();
    if (OUTCOME_PHRASES.some((p) => lower.includes(p))) {
      violations.push({ kind: "narrates-outcome", detail: `asserts an outcome no referee has ruled on: "${s}"` });
    }
  }

  return violations;
}

/** The narrator's own schema: one field, so the model spends its whole
 *  answer on prose rather than a duplicate `intent` field that nothing
 *  reads. `mind-seam`'s `Proposal` still requires `intent`; `coerceNarratorReply`
 *  satisfies that by aliasing it to the same text, never by asking the model
 *  for it twice. */
const NARRATOR_SCHEMA: InertRecord = {
  type: "object",
  properties: { narration: { type: "string" } },
  required: ["narration"],
  additionalProperties: false,
};

interface NarratorReply extends Proposal {
  readonly narration: string;
}

function coerceNarratorReply(raw: unknown): NarratorReply | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const narration = typeof record.narration === "string" ? record.narration.trim() : "";
  if (narration.length === 0) return null;
  return { intent: narration, narration };
}

function factsAsPromptLines(facts: NarratorFacts): string[] {
  const lines: string[] = [];
  if (facts.parts.conditionLines.length > 0) lines.push(...facts.parts.conditionLines, "");
  lines.push(...facts.parts.identityLines, "");
  lines.push("Perceived objects:", ...facts.parts.objectLines, "");
  lines.push(...facts.parts.ruleLines);
  return lines;
}

function buildNarratorPrompt(selfName: string, otherName: string, facts: NarratorFacts): string {
  return [
    `You are a narrator writing immersive prose for ${selfName}, addressed as "you", from EXACTLY the facts below -- nothing more.`,
    "",
    ...factsAsPromptLines(facts),
    "",
    "Write the scene as flowing narrative prose, second person, for the player to read.",
    "RULES, followed exactly:",
    "- Use ONLY the facts given above. Never invent a number, an object, an action, or a state that is not stated above.",
    '- Every belief above must appear, with its exact value AND its "as of round N" stamp, in words close to those.',
    "- Every perceived object listed above must be mentioned.",
    "- Every number in the condition list above (if any) must appear.",
    "- The round number and the total number of rounds must both appear.",
    `- Never write what ${otherName} thinks, feels, plans, wants, believes, hopes, or decides -- you are only given what ${selfName} perceives, never ${otherName}'s own mind.`,
    "- Never say what happens as a RESULT of anything -- only a referee decides outcomes. Describe the scene as it stands, not what will happen next.",
    'Answer with one JSON object: {"narration": string}.',
  ].join("\n");
}

export interface CreateNarratorOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), exactly as every other role
   *  in this repository -- awaited before the call, with this call's model.
   *  Only `checkpoint.ts`'s real run supplies one. */
  ensureLoaded?: (model: string) => Promise<void>;
  /** The model call itself came back empty, unparseable, or timed out --
   *  `mind-seam`'s own silence path, the same one every other role reports
   *  through. Never counts a rejected (but present) narration -- see
   *  `onRejected`. */
  onSilence?: (reason: SilenceReason, detail?: SilenceDetail) => void;
  /** The model produced a narration, but `verifyNarration` found at least
   *  one violation in it -- discarded before it ever reaches a player. The
   *  owner's own requirement: "a liability the player never sees is a
   *  liability that cannot mislead them," but it must still be COUNTED and
   *  recorded where a transcript will show it (`checkpoint.ts`). */
  onRejected?: (violations: readonly NarrationViolation[], raw: string) => void;
  /** See `VerifyNarrationOptions.knownWorldLabels`. */
  knownWorldLabels?: readonly string[];
}

export interface Narrator {
  /** The verified narration, or `null` when the model produced nothing
   *  usable OR its narration failed verification -- either way the caller
   *  (`humanSeat.ts`) falls back to the deterministic prose view. Never
   *  throws: a bad narrator is a reason to fall back, never a reason to end
   *  the player's turn. */
  narrate(selfName: string, otherName: string, context: OpenPrincipalContext, conditions?: readonly Condition[]): Promise<string | null>;
}

export function createNarrator(options: CreateNarratorOptions): Narrator {
  const ensureLoaded = options.ensureLoaded ?? (async () => {});
  return {
    async narrate(selfName, otherName, context, conditions) {
      const facts = buildNarratorFacts(selfName, otherName, context, conditions);
      const localMind = createLocalMind<OpenPrincipalContext, NarratorReply>({
        baseUrl: options.baseUrl,
        model: options.model,
        temperature: options.temperature,
        timeoutMs: options.timeoutMs,
        fetchFn: options.fetchFn,
        responseFormat: { jsonSchema: NARRATOR_SCHEMA, name: "narration" },
        prompt: () => buildNarratorPrompt(selfName, otherName, facts),
        coerce: (raw) => coerceNarratorReply(raw),
        onSilence: options.onSilence ? (reason, _context, detail) => options.onSilence?.(reason, detail) : undefined,
      });
      await ensureLoaded(options.model);
      const reply = await localMind.consider(context);
      if (reply === null) return null;
      const violations = verifyNarration(facts, reply.narration, { selfName, otherName, knownWorldLabels: options.knownWorldLabels });
      if (violations.length > 0) {
        options.onRejected?.(violations, reply.narration);
        return null;
      }
      return reply.narration;
    },
  };
}
