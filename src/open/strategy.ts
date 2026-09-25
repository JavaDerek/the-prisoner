/**
 * A pre-episode commitment step: two calls before the first turn that choose ONE approach from a list the
 * actor itself drew, and hand back a sentence the actor is shown every turn afterwards.
 * `docs/STRATEGY-DESIGN.md` is the design; D1 there is why it lives here rather than in
 * `mother-of-invention`, and the answer is that moi's admission test is "generic with at least one real
 * caller" and tonight this would have zero MEASURED callers. §20 and §40.3 are the precedent: drive it
 * here, move it once it changes something.
 *
 * SO THERE ARE NO GAME WORDS IN THIS FILE, deliberately, the same discipline `conditionList.ts` keeps.
 * It never imports this game's context type either: it takes a situation already rendered and a list of
 * object ids, which is everything it needs and nothing about which game rendered them. That is also why
 * the signature differs from §3.7's sketch, which named `context` and `conditions` -- taking
 * `OpenPrincipalContext` would import a game type into a module whose whole stated purpose is to be
 * liftable, and §3.7 says "what to build, not the lines to type".
 *
 * WHAT THE THREE PARTS ARE FOR (D2), because the shape looks redundant and is not:
 *   - the `chosen` INDEX makes selection countable as GIVEN, the way `replanned` is -- no code ever
 *     decides whether a text matches a text;
 *   - the `targets` IDS make adherence checkable against the referee's own keys, which every ruling
 *     already carries;
 *   - the SENTENCE is the only part the actor ever reads back, and the only part in its own words.
 */

/** One option, carrying the number it was given when the list was fixed. The number travels WITH the
 *  option, so a list shown in a different order still identifies the same choice -- which is the only
 *  reason a positional-bias reading is separable from a content reading at all. */
export interface StrategyOption {
  readonly n: number;
  readonly text: string;
  readonly reason?: string;
}

export type ReasoningStrength = "none" | "low" | "medium" | "high";

/** What one model call gave back. `reasoning` is kept because the transcript prints it: a gate failure in
 *  the first game has to be readable as what it was, not inferred from a null. */
export interface StrategyReply {
  readonly content: string;
  readonly reasoning: string;
  readonly tokens: number;
}

export interface StrategyContext {
  /** The actor's own situation, already rendered by whatever renders it for a turn. Byte-identical to
   *  what the turn sees, or this step is answering a different question than the game asks. */
  readonly situation: string;
  /** The ids a declared target may name. Membership is checked against this and nothing else. */
  readonly objectIds: readonly string[];
}

export interface Strategy {
  readonly options: readonly StrategyOption[];
  readonly chosen: number;
  readonly sentence: string;
  readonly targets: readonly string[];
  readonly rawOptions: StrategyReply;
  readonly rawCommit: StrategyReply;
}

/** `fixed` chooses once and never revises. `revise` is designed (§3.5) and not built; it parses so the
 *  variable's vocabulary is settled, and the caller is what refuses to act on it tonight. */
export type StrategyMode = "off" | "fixed" | "revise";

export function readStrategyMode(raw: string | undefined): StrategyMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "fixed" || raw === "revise") return raw;
  throw new Error(`PRISONER_STRATEGY: unrecognised value ${JSON.stringify(raw)} -- must be "fixed", "revise", or unset (the default, off)`);
}

export const SENTENCE_MAX = 200;

export const OPTIONS_ASK =
  "List 5 to 8 DIFFERENT concrete things you could try over this game to get out, each grounded only in " +
  "what you can reach or perceive above. Number them. List only; choose nothing. Answer with one JSON " +
  'array of objects: [{"text": string, "reason": string}].';

const COMMIT_ASK =
  'Which ONE of these do you pursue this game? Answer with one JSON object: {"chosen": number, "strategy": string, "targets": [string]} -- ' +
  '"chosen" is the option\'s number; "strategy" is one sentence, at most 200 characters, you will be shown every turn to remind you what ' +
  'you are trying to do; "targets" names 1 or 2 of the object ids above that this strategy works on.';

/** The precedent block reaches BOTH prompts or neither, under the caller's one existing switch (§3.6):
 *  precedent on/off must stay one variable across the whole game, not two that can disagree. */
function withPrecedent(body: string, precedent?: readonly string[]): string {
  return precedent && precedent.length > 0 ? `${body}\n\n${precedent.join("\n")}` : body;
}

export function buildOptionsPrompt(situation: string, precedent?: readonly string[]): string {
  return `${withPrecedent(situation, precedent)}\n\n${OPTIONS_ASK}`;
}

/** `shown` is the list in the order it is to be SHOWN; each line keeps its own `n`. */
export function buildCommitPrompt(situation: string, shown: readonly StrategyOption[], precedent?: readonly string[]): string {
  const numbered = shown.map((o) => `${o.n}. ${o.text}`).join("\n");
  return `${withPrecedent(situation, precedent)}\n\nYour options this game, as you listed them:\n${numbered}\n\n${COMMIT_ASK}`;
}

/** The first balanced `{...}` in a string, so a reply that wraps its object in prose, a fenced block or
 *  trailing chatter still reads. Brace counting rather than a regex because a regex cannot balance, and
 *  the red team's first point was precisely that a chattered reply must not look like a refusal.
 *  Quote-aware, so a brace inside a string value cannot end the object early. */
function firstBalancedObject(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** The same walk for a top-level array, which is the OPTIONS call's shape. */
function firstBalancedArray(text: string): unknown[] {
  const start = text.indexOf("[");
  if (start < 0) return [];
  for (let end = text.lastIndexOf("]"); end > start; end = text.lastIndexOf("]", end - 1)) {
    try {
      const v = JSON.parse(text.slice(start, end + 1)) as unknown;
      if (Array.isArray(v)) return v;
    } catch {
      /* walk back to the previous closing bracket: a truncated tail is common and is not a refusal */
    }
  }
  return [];
}

export interface CoercedStrategy {
  readonly chosen: number;
  readonly sentence: string;
  readonly targets: readonly string[];
}

/**
 * `null` means "there is no strategy here", and it means it for exactly two reasons: the index names no
 * option, or no declared target survives membership. Both make the result UNCHECKABLE -- adherence is
 * keyed on those ids -- so a guess would be worse than a null. Everything else is repaired rather than
 * refused: the sentence is capped, ids are matched case-insensitively, duplicates collapse, and at most
 * two ids are kept, because D2 said one or two and a model that offers five has still chosen.
 */
export function coerceStrategy(content: string, options: readonly StrategyOption[], objectIds: readonly string[]): CoercedStrategy | null {
  const obj = firstBalancedObject(content);
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return null;
  const raw = obj as { chosen?: unknown; strategy?: unknown; targets?: unknown };
  const chosen = typeof raw.chosen === "number" ? raw.chosen : Number(raw.chosen);
  if (!Number.isFinite(chosen) || !options.some((o) => o.n === chosen)) return null;
  const byLower = new Map(objectIds.map((id) => [id.toLowerCase(), id]));
  const targets: string[] = [];
  for (const t of Array.isArray(raw.targets) ? raw.targets : []) {
    const id = byLower.get(String(t).trim().toLowerCase());
    if (id !== undefined && !targets.includes(id)) targets.push(id);
    if (targets.length === 2) break;
  }
  if (targets.length === 0) return null;
  const sentence = (typeof raw.strategy === "string" ? raw.strategy : "").slice(0, SENTENCE_MAX);
  return { chosen, sentence, targets };
}

/** Exact-duplicate texts collapse to one, the first kept (§20.1's rule, reused rather than re-invented). */
function fixOptions(replyContent: string): StrategyOption[] {
  const seen = new Set<string>();
  return firstBalancedArray(replyContent)
    .map((x) => (typeof x === "string" ? { text: x } : (x as { text?: unknown; reason?: unknown })))
    .map((x) => ({ text: String(x.text ?? "").trim(), reason: x.reason === undefined ? undefined : String(x.reason) }))
    .filter((x) => x.text.length > 0)
    .filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)))
    .map((x, i) => ({ n: i + 1, text: x.text, ...(x.reason ? { reason: x.reason } : {}) }));
}

export type StrategyAsk = (prompt: string, options: { readonly reasoning: ReasoningStrength }) => Promise<StrategyReply>;

/**
 * Two calls, in order, and the second is never asked if the first gave nothing usable -- a commit call
 * against an empty list is a request to invent, which is the one thing this step must not do.
 *
 * The OPTIONS call runs at `none` and the COMMIT call at the strength it is given (§3.2). That asymmetry
 * is the design's whole bet: listing what is in front of you is recall, choosing between the listed
 * things is the part deliberation might change. §1.3 measured, on a toy prompt, that it did NOT change
 * the choice -- so the reading grid pairs this with adherence rather than treating conviction as free.
 */
export async function chooseStrategy(params: {
  readonly context: StrategyContext;
  readonly ask: StrategyAsk;
  readonly reasoningStrength: ReasoningStrength;
  readonly precedent?: readonly string[];
  /** Injectable only so a test can fix the order; a real call shows the list as it was drawn. */
  readonly showAs?: (options: readonly StrategyOption[]) => readonly StrategyOption[];
}): Promise<Strategy | null> {
  const { context, ask, reasoningStrength, precedent } = params;
  const rawOptions = await ask(buildOptionsPrompt(context.situation, precedent), { reasoning: "none" });
  const options = fixOptions(rawOptions.content);
  if (options.length === 0) return null;
  const shown = params.showAs ? params.showAs(options) : options;
  const rawCommit = await ask(buildCommitPrompt(context.situation, shown, precedent), { reasoning: reasoningStrength });
  const coerced = coerceStrategy(rawCommit.content, options, context.objectIds);
  if (coerced === null) return null;
  return { options, ...coerced, rawOptions, rawCommit };
}

export interface StrategyHeader {
  readonly options: readonly StrategyOption[];
  readonly chosen: number;
  readonly sentence: string;
  readonly targets: readonly string[];
  readonly reasoningField: string;
  readonly reasoningStrength: ReasoningStrength;
  readonly optionsTokens: number;
  readonly commitTokens: number;
  readonly rawOptions: { readonly content: string; readonly reasoning: string };
  readonly rawCommit: { readonly content: string; readonly reasoning: string };
}

/**
 * The transcript's own record. It prints the FIELD as well as the strength because §1.1 caught a switch
 * whose header named a value the server ignored, and the lesson generalises past that one bug: a header
 * that names an intention rather than a wire fact cannot be checked by anyone reading it later.
 */
export function strategyHeaderBlock(mode: StrategyMode, header: StrategyHeader | null): string {
  if (mode === "off" || header === null) return "Strategy: OFF (baseline).";
  const lines = [
    `Strategy: ON (\`PRISONER_STRATEGY=${mode}\`): chosen before round 1 in two calls, and the sentence below is shown in every prisoner briefing.`,
    `Reasoning sent: \`${header.reasoningField}: "${header.reasoningStrength}"\` on the commit call, \`"none"\` on the options call. Completion tokens: options ${header.optionsTokens}, commit ${header.commitTokens}.`,
    "",
    "Options, as the mind listed them (numbers fixed here and carried into the commit call):",
    ...header.options.map((o) => `${o.n}. ${o.text}`),
    "",
    `Chosen: ${header.chosen}. Declared targets: ${header.targets.join(", ")}.`,
    `Strategy: ${header.sentence}`,
    "",
    "Raw options reply:",
    "```",
    header.rawOptions.content,
    "```",
    ...(header.rawOptions.reasoning ? ["Raw options reasoning:", "```", header.rawOptions.reasoning, "```"] : []),
    "Raw commit reply:",
    "```",
    header.rawCommit.content,
    "```",
    ...(header.rawCommit.reasoning ? ["Raw commit reasoning:", "```", header.rawCommit.reasoning, "```"] : []),
  ];
  return lines.join("\n");
}

/**
 * §3.5's revision trigger, EVALUATED EVEN WHEN REVISION IS OFF. Under `fixed` nothing acts on it and the
 * transcript prints the round it would have fired, because that is the number a decision to build revision
 * actually needs -- and getting it costs the batch's isolation nothing, which is the whole reason the red
 * team's third point is answerable tonight rather than in a later arm.
 *
 * "Stalled" is not a new notion invented here: three consecutive turns that were refused or changed no
 * property is the re-try measure's own definition (b6's prediction 7), reused so the two cannot drift.
 */
export function revisionWouldFireAt(turns: readonly { readonly stalled: boolean }[]): number | "never" {
  let run = 0;
  for (let i = 0; i < turns.length; i++) {
    run = turns[i]!.stalled ? run + 1 : 0;
    if (run === 3) return i + 1;
  }
  return "never";
}

export function revisionHeaderLine(at: number | "never"): string {
  return at === "never" ? "Revision would have fired: never" : `Revision would have fired: round ${at}`;
}
