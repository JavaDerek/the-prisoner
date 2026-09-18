import { CONDITION_LIST_OPENING, type Condition } from "./conditionList.js";
import { seatSituationParts, type OpenPrincipalContext } from "./mind.js";

/**
 * The-prisoner#21: a human-fiction view of a turn, for the PLAYER only, that
 * changes nothing about what the player knows (OPEN-VARIANT.md §47's own
 * rule: a person is shown exactly what the model in that chair would have
 * been shown). Route 1 of that issue -- deterministic prose, composed by
 * code, from data that is already there. No model, no latency, no fourth
 * tenant on the 4090, and it cannot invent a fact the raw view does not
 * already carry.
 *
 * `renderSeatSituation` (mind.ts) is the raw view AND the model's own
 * prompt opening, byte for byte (§47, §49) -- this module never changes
 * that function, and never changes what `OpenPrincipalContext` carries.
 * It only re-presents the SAME `context` (identity, motive, briefing,
 * perceivedObjects) and the SAME `conditions`, in paragraphs instead of
 * labelled blocks -- composed from `seatSituationParts` (mind.ts), the same
 * pieces `renderSeatSituation` itself joins, so this module reads DATA,
 * never another renderer's finished string.
 *
 * THE HARD CONSTRAINT this file exists under: a re-presentation, never a
 * different information set. Every belief line's number and its "as of
 * round N" stamp, every perceived object and its authored description
 * (state readings included), the clock, the conditions list, the news, and
 * identity/motive must all survive -- pinned by
 * `__tests__/proseView.test.ts`'s completeness test, not by taste. Where
 * this module cannot tell what a line of the briefing MEANS (news is free
 * text, from `perception.ts`'s own many different sentence shapes), it
 * never guesses: it keeps the line verbatim and places it in the reading
 * order the game already gives it, rather than risk quietly summarising a
 * fact away.
 */

const BELIEF_LINE = /^(.+): (-?\d+) \(as of round (\d+)\)\.$/;
const ROUND_LINE = /^Round (\d+) of (\d+)\.$/;
const SUSPICION_LINE = /^warden suspicion: (\d+)\.$/;
const GROUNDS_LINE = /^You have grounds to search: suspicion (\d+)\.$/;
const NOTES_LINE = /^Your notes from last round: (.+)$/;
const PLAN_LINE = /^Your plan, from your last turn: (.+)$/;

interface BeliefFact {
  readonly label: string;
  readonly value: number;
  readonly asOfRound: number;
}

interface ParsedBriefing {
  readonly roundN?: number;
  readonly totalRounds?: number;
  readonly beliefs: readonly BeliefFact[];
  readonly notes?: string;
  readonly plan?: string;
  readonly suspicion?: number;
  readonly hasGrounds: boolean;
  /** Everything this parser does not recognise a fixed template for --
   *  the outcome of the actor's own last attempt, what it perceived of the
   *  other principal, the authored stakes sentence, and standing/precedent
   *  news. Each is already a complete, free-text sentence (`perception.ts`,
   *  `scenario.ts`, `precedent.ts`); this module places them, never
   *  rewrites them, so nothing here can drift into inventing what they say. */
  readonly other: readonly string[];
}

/** `buildOpenBriefing` (briefing.ts) renders every line here from one of a
 *  small, fixed set of templates -- this function reads them back by
 *  exactly those templates, never by guessing at a line's meaning from its
 *  words (CLAUDE.md's "never pattern-match meaning" is about a referee
 *  judging free-text INTENT; this is the opposite direction, recognising
 *  this repository's own deterministic output). Anything that matches
 *  nothing here is kept, verbatim, in `other` -- never dropped. */
function parseBriefing(briefing: string): ParsedBriefing {
  const beliefs: BeliefFact[] = [];
  const other: string[] = [];
  let roundN: number | undefined;
  let totalRounds: number | undefined;
  let notes: string | undefined;
  let plan: string | undefined;
  let suspicion: number | undefined;
  let hasGrounds = false;

  for (const line of briefing.split("\n")) {
    if (line.length === 0) continue;
    const round = ROUND_LINE.exec(line);
    if (round) {
      roundN = Number(round[1]);
      totalRounds = Number(round[2]);
      continue;
    }
    const suspicionMatch = SUSPICION_LINE.exec(line);
    if (suspicionMatch) {
      suspicion = Number(suspicionMatch[1]);
      continue;
    }
    if (GROUNDS_LINE.test(line)) {
      hasGrounds = true;
      continue;
    }
    const notesMatch = NOTES_LINE.exec(line);
    if (notesMatch) {
      notes = notesMatch[1];
      continue;
    }
    const planMatch = PLAN_LINE.exec(line);
    if (planMatch) {
      plan = planMatch[1];
      continue;
    }
    const belief = BELIEF_LINE.exec(line);
    if (belief) {
      beliefs.push({ label: belief[1], value: Number(belief[2]), asOfRound: Number(belief[3]) });
      continue;
    }
    other.push(line);
  }

  return { roundN, totalRounds, beliefs, notes, plan, suspicion, hasGrounds, other };
}

function spacedLabel(id: string): string {
  return id.replace(/_/g, " ");
}

/** Keeps the exact number and the exact stamp -- "as of round N" is kept in
 *  those words rather than paraphrased ("recently", "a while back"), because
 *  a paraphrase is exactly the kind of softening the issue forbids. */
function beliefSentence(belief: BeliefFact): string {
  return `Your last word on the ${belief.label} was ${belief.value}, as of round ${belief.asOfRound}.`;
}

function sceneParagraph(objects: OpenPrincipalContext["perceivedObjects"]): string {
  if (objects.length === 0) return "You perceive nothing you could act on right now.";
  const items = objects.map((o) => `The ${spacedLabel(o.id)}: ${o.description}`);
  return ["In the cell around you:", ...items].join(" ");
}

/**
 * One condition as a sentence, keeping every threshold number in `when` and
 * the `then` clause verbatim (both are the caller's own authored content --
 * `conditions.ts` -- and this module never touches their words, only their
 * shape), plus a trailing citation of its number and WHOSE it is. The
 * `(for you)` / `(for Warden Croft)` distinction is load-bearing (§44: she
 * cites conditions by number and reasons about whose they are), so it is
 * kept as literally as `renderConditionList` (conditionList.ts) keeps it --
 * "you" only when this is the reader's own condition, the other party's
 * name otherwise -- never dropped for the sake of a smoother sentence.
 */
function conditionSentence(condition: Condition, index: number, selfName: string): string {
  const whose = condition.for === selfName ? "you" : condition.for;
  return `Once ${condition.when.join(", and ")}, ${condition.then} -- condition ${index + 1}, for ${whose}.`;
}

/** Every number and every attribution a condition carries, in one flowing
 *  paragraph instead of `renderConditionList`'s labelled
 *  `CONDITION N (for X): If ..., then ...` block -- the most prompt-shaped
 *  part of the raw view, and the owner's own complaint (§48, #21) named
 *  exactly this shape. Reuses `CONDITION_LIST_OPENING` (conditionList.ts)
 *  rather than re-authoring it, so the two views open on the same claim. */
function conditionsParagraph(conditions: readonly Condition[] | undefined, selfName: string): string {
  if (!conditions || conditions.length === 0) return "";
  return [CONDITION_LIST_OPENING, ...conditions.map((c, i) => conditionSentence(c, i, selfName))].join(" ");
}

/** The rules that stay state-based (`seatSituationParts(...).ruleLines`,
 *  mind.ts), already complete sentences -- joined into one paragraph rather
 *  than kept as the raw view's own line-per-rule block, since prose is fine
 *  here too as long as every number in them survives, which they do
 *  unmodified: this module only changes how the sentences are JOINED, never
 *  their words. */
function rulesParagraph(ruleLines: readonly string[]): string {
  if (ruleLines.length === 0) return "";
  return ["Some things about this cell never change:", ...ruleLines].join(" ");
}

/**
 * The prose view: paragraphs composed by code from the identical data
 * `renderSeatSituation` renders, for the human seat alone
 * (`humanSeat.ts`'s `view: "prose"`). Never called by anything that builds
 * a model prompt.
 */
export function renderProseSituation(selfName: string, otherName: string, context: OpenPrincipalContext, conditions?: readonly Condition[]): string {
  const parsed = parseBriefing(context.briefing);
  const paragraphs: string[] = [];

  paragraphs.push(conditionsParagraph(conditions, selfName));

  paragraphs.push(`${context.identity} ${context.motive}`.trim());

  paragraphs.push(sceneParagraph(context.perceivedObjects));

  if (parsed.roundN !== undefined && parsed.totalRounds !== undefined) {
    paragraphs.push([`This is round ${parsed.roundN} of ${parsed.totalRounds}.`, ...parsed.other].join(" "));
  } else if (parsed.other.length > 0) {
    paragraphs.push(parsed.other.join(" "));
  }

  const notesAndPlan: string[] = [];
  if (parsed.notes !== undefined) notesAndPlan.push(`You'd made a note to yourself last round: ${parsed.notes}`);
  if (parsed.plan !== undefined) notesAndPlan.push(`Your plan, from your last turn, was: ${parsed.plan}`);
  if (notesAndPlan.length > 0) paragraphs.push(notesAndPlan.join(" "));

  const knowledge: string[] = [];
  if (parsed.suspicion !== undefined) {
    // `warden suspicion` is only ever rendered into a warden's OWN briefing
    // (`buildOpenBriefing`), so a chair reading this line is always the
    // warden's, reading of the prisoner -- authored throughout scenario.ts
    // and docs/OPEN-VARIANT.md as "her" (Voss).
    knowledge.push(`Your own reading of her, right now, stands at suspicion ${parsed.suspicion}.`);
    if (parsed.hasGrounds) knowledge.push("That is enough to search her cell outright, whenever you choose to.");
  }
  for (const belief of parsed.beliefs) knowledge.push(beliefSentence(belief));
  if (knowledge.length > 0) paragraphs.push(knowledge.join(" "));

  const parts = seatSituationParts(selfName, otherName, context, conditions);
  paragraphs.push(rulesParagraph(parts.ruleLines));

  return paragraphs.filter((p) => p.length > 0).join("\n\n");
}
