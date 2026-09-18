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
  /** The conditions THEMSELVES, not only `parts.conditionLines`'s rendering
   *  of them: `quotesACondition` has to recognise a condition said back in
   *  whichever words a view chose, and the two views in this repository
   *  already disagree about the connectives ("If X, then Y" against "Once X,
   *  Y"). The authored clauses inside are what both render verbatim. */
  readonly conditions: readonly Condition[];
}

export function buildNarratorFacts(selfName: string, otherName: string, context: OpenPrincipalContext, conditions?: readonly Condition[]): NarratorFacts {
  return {
    parts: seatSituationParts(selfName, otherName, context, conditions),
    parsed: parseBriefing(context.briefing),
    objects: context.perceivedObjects,
    conditions: conditions ?? [],
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

/**
 * Does this sentence talk about the belief `label` names?
 *
 * By its WORDS, close together, in any order -- never as one contiguous
 * string (§60). A belief's label is this repository's own key spelling, "bar
 * integrity"; no English sentence about it contains that, because English
 * writes "the bar's integrity" or "the integrity of the bar". The contiguous
 * test made `dropped-belief` unsatisfiable by prose, which mattered little
 * while EVERY completeness kind was fatal and matters entirely now that the
 * belief checks are among the mandatory ones.
 *
 * PROXIMITY, not mere presence, and the calibration test is why: a condition
 * sentence reads "...closely examines the lock, and Warden Croft finds its
 * integrity at or below 40...", which contains every word of the label "lock
 * integrity" and is not a claim about the reader's belief at all. Scoring that
 * as a belief sentence made its threshold (40) look like a contradiction of
 * the belief (100). The words of a label that a sentence is really ABOUT sit
 * within a few tokens of each other; the words of two different clauses do
 * not.
 *
 * Deliberately nothing cleverer: no stemming, no synonyms, no judging what the
 * sentence MEANS. A narration that names a belief and then states its number
 * wrongly is caught by `contradicts-belief`, on the number, which is the check
 * that can actually be right about it.
 */
const BELIEF_WINDOW_SLACK = 3;

/** Punctuation and case removed, whitespace collapsed -- so a sentence can be
 *  recognised as one of the data's own lines however the view that printed it
 *  chose to punctuate it. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Is this narration sentence just one of the CONDITIONS the narrator was
 * given, said back?
 *
 * `contradicts-belief` compares the numbers in a sentence about a belief
 * against that belief's value, and a condition breaks it: "Once the bar's
 * integrity is at or below 50, Mara Voss can open the window" is genuinely
 * about the bar's integrity, sits right next to the word, and carries 50 --
 * which is a THRESHOLD, not a claim that the bar is at 50. Scored as a belief
 * sentence it reads as a contradiction of a belief of 100, which is how the
 * deterministic prose view -- whose own conditions are rendered verbatim --
 * managed to fail a checker built to catch narrators inventing things.
 *
 * Recognised by the data, never by meaning: a condition's own `when` clauses
 * are authored text that every view renders verbatim, so a sentence containing
 * one is saying back what it was given. Matched on the CLAUSES rather than on
 * a rendered line because the two views in this repository already render the
 * same condition differently ("If X, then Y" against "Once X, Y"), and a third
 * would be free to differ again. No attempt to tell a hypothetical from an
 * assertion in general -- that is exactly the judgement of MEANING this module
 * refuses at its own top.
 */
function quotesACondition(facts: NarratorFacts, sentence: string): boolean {
  const normalised = normalise(sentence);
  return facts.conditions.some((condition) =>
    condition.when.some((clause) => {
      const normalisedClause = normalise(clause);
      return normalisedClause.length > 0 && normalised.includes(normalisedClause);
    })
  );
}


function mentionsBelief(sentence: string, label: string): boolean {
  const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return false;
  const tokens = sentence.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);
  const window = words.length + BELIEF_WINDOW_SLACK;
  for (let start = 0; start + words.length <= tokens.length; start += 1) {
    const slice = tokens.slice(start, start + window);
    if (words.every((w) => slice.some((t) => t.startsWith(w)))) return true;
  }
  return false;
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

/**
 * The violation kinds that DISCARD a narration, as against the ones a run
 * merely counts (owner's decision, 2026-09-18, OPEN-VARIANT.md §60/§61).
 *
 * It is the LYING class, and only that: `invented-number`, `invented-object`,
 * `contradicts-belief`, `contradicts-state`, `speaks-for-other`,
 * `narrates-outcome`. Each is a narration telling the player something the
 * world does not contain -- a detail they would then act on, the other
 * principal's private mind, which this chair is never given, or an outcome no
 * referee ruled. That is the liability D3 was built to catch, and it is fatal.
 *
 * READ THIS BEFORE CONCLUDING THAT PRECISION WAS TRADED AWAY. The completeness
 * kinds are not here, and `dropped-belief` and `dropped-clock` in particular
 * left this set for a reason that is the opposite of a relaxation: **the seat
 * stopped asking a narrator to carry state at all.** `humanSeat.ts` renders
 * every belief with its exact value and its "as of round N" stamp, the clock,
 * the news, the conditions and the standing rules ITSELF, by code, through
 * `deltaView.ts` -- and hands the narrator the one job a model is actually
 * better at, the room. A player therefore gets those numbers with a guarantee
 * no prompt can offer, and the narration is judged on whether it LIES, because
 * that is now the only thing it can get wrong that the code above it does not
 * already get right.
 *
 * The evidence that forced it (§61): asked to write a scene AND to restate the
 * clock, a real narrator wrote the scene, skipped "round 1 of 30", and was
 * discarded for it -- with no invention, no contradiction and nothing else
 * wrong. Rejecting good prose over a number that code prints perfectly one
 * line above is not a standard, it is a waste.
 *
 * `verifyNarration` still finds and returns every violation of every kind --
 * the checker's job is to see, not to decide -- and this set is what
 * `createNarrator` consults when deciding whether a player may see it. The
 * rest are counted into the transcript (`onObserved`), because how much of the
 * catalogue a narrator chooses to leave behind is worth knowing.
 */
export const REJECTING_KINDS: ReadonlySet<NarrationViolation["kind"]> = new Set<NarrationViolation["kind"]>([
  "invented-number",
  "invented-object",
  "contradicts-belief",
  "contradicts-state",
  "speaks-for-other",
  "narrates-outcome",
]);

/** The subset of `violations` that discards a narration -- empty means a
 *  player may see it, whatever else was counted. */
export function rejectingViolations(violations: readonly NarrationViolation[]): NarrationViolation[] {
  return violations.filter((v) => REJECTING_KINDS.has(v.kind));
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
    const labelSentences = narrationSentences.filter((s) => mentionsBelief(s, belief.label));
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
        if (quotesACondition(facts, s)) continue;
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

/**
 * A run's rejected narrations, tallied by kind, as one transcript line.
 *
 * Why this exists rather than a `console.log` per rejection: the first human
 * game with `PRISONER_VIEW=narrated` (2026-09-18) printed one of those to the
 * PLAYER's terminal every round -- "Narrator rejected (falling back to the
 * prose view): dropped-belief, dropped-belief, dropped-object, ..." -- above
 * the very view the player was trying to read. A rejection is evidence about
 * the narrator, and evidence belongs in the transcript where it can be
 * counted across a run, never in the seat, where it is noise in front of the
 * one person the whole view exists for.
 *
 * The TALLY, not the list: which kinds fire and how often is what tells you
 * whether a narrator is inventing (the liability the checker was built for)
 * or merely writing prose (the completeness kinds), and that question is
 * about a run, not about one round.
 */
export function formatViolationTally(tally: ReadonlyMap<string, number>): string {
  if (tally.size === 0) return "none";
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => `${kind} ${n}`)
    .join(", ");
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

/**
 * §61.1: `mind.ts`'s `objectLines` renders `- loose_tile: <description>`,
 * because an object's ID is the key a referee rules against and that is
 * exactly right for the prompts that ask for an intent. A narrator is writing
 * for a person, and the first real run had it echo the id straight into the
 * prose ("your fingers brushing the loose_tile's cracked surface").
 *
 * Fixed HERE and nowhere else: `mind.ts` feeds the wits and voice prompts, and
 * editing it to suit a narrator would move the benchmark every measured run
 * sits on. This is a prompt-shaping step over data this module already holds.
 * The FACTS keep the id -- `verifyNarration` matches on both spellings
 * (`mentionsLabel`), so nothing here weakens the checker.
 */
function spacedObjectLines(facts: NarratorFacts): string[] {
  const ids = facts.objects.map((o) => o.id).filter((id) => id.includes("_"));
  return facts.parts.objectLines.map((line) => ids.reduce((acc, id) => acc.replace(id, id.replace(/_/g, " ")), line));
}

function factsAsPromptLines(facts: NarratorFacts): string[] {
  const lines: string[] = [];
  if (facts.parts.conditionLines.length > 0) lines.push(...facts.parts.conditionLines, "");
  lines.push(...facts.parts.identityLines, "");
  lines.push("Perceived objects:", ...spacedObjectLines(facts), "");
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
    "- Write the ROOM, and only the room. The player is shown the clock, every number they know with the round they " +
      "learned it in, the conditions and the rules separately, in full, right above your prose -- so you do not need to " +
      "repeat any of them, and prose that recites them reads worse than prose that does not.",
    "- A SCENE, not an inventory. Foreground what a person standing in this room would actually notice. You do NOT have " +
      "to mention every object listed above; the player can ask for the full list at any time and it costs them nothing.",
    "- If you do give a number, it must be one of the numbers above, said exactly.",
    // §61.1: with completeness no longer holding it to the catalogue, the
    // first real narrator filled the space with invented atmosphere --
    // moonlight, a smell of damp, stars, and "no guards on this side this
    // late at night", which is fabricated tactical information a player would
    // act on. `verifyNarration` cannot catch any of it (§54's own documented
    // limit: a plausible sentence with no number, no known object and no
    // outcome word). The prompt is the only lever this side of a second
    // verifier model, so it says the quiet part explicitly and by category.
    "- Add NOTHING that is not written above. No weather, no light or darkness, no time of day, no sounds, no smells, " +
      "no temperature, no other rooms, and no other people. If the descriptions above do not mention it, it does not " +
      "exist and you may not put it in the room.",
    "- You may re-order what is above, connect it into flowing sentences, and choose what to foreground. You may not " +
      "add to it. Every concrete thing in your prose must be traceable to a line above.",
    `- Write about ${selfName} as "you" throughout. Never switch to her name or to "she" for the person you are addressing.`,
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
  /** The narration was SHOWN, and `verifyNarration` still found violations in
   *  it -- from §60 on, the kinds outside `REJECTING_KINDS`: a scene that left
   *  an object or a condition out. Never a fault, and never hidden either:
   *  this is how a run measures how much of the catalogue its narrator is
   *  actually choosing to leave behind, which is the number that says whether
   *  §60 bought readable prose or only a looser checker. */
  onObserved?: (violations: readonly NarrationViolation[], raw: string) => void;
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
      // §60: every violation is still FOUND; only the rejecting class decides.
      if (rejectingViolations(violations).length > 0) {
        options.onRejected?.(violations, reply.narration);
        return null;
      }
      if (violations.length > 0) options.onObserved?.(violations, reply.narration);
      return reply.narration;
    },
  };
}
