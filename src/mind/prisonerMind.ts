import type { Mind, Proposal, SilenceReason } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS } from "../world/mechanics.js";

/**
 * The prisoner's declaration of `mind-seam`'s generic seam (design §A.5,
 * §3.1) -- a `type` alias over the package's own `Inert`/`Proposal`/`Mind`,
 * never an `interface` (TypeScript gives an object type literal an implicit
 * index signature and an interface none, so an `interface` here would not
 * satisfy `InertRecord` -- `src/mind/__tests__/types.test.ts` pins this with
 * a `// @ts-expect-error`).
 *
 * THE MIND CANNOT WRITE. Not a rule to remember: `PrisonerContext` is
 * structurally `InertRecord`, so `Mind<PrisonerContext, PrisonerProposal>`
 * accepts no field that could reach storage -- `tsc` refuses it before this
 * file's own types even compile against a bad field, and `assertInert`
 * (imported transitively through `createLocalMind`) catches a cast or a
 * getter at runtime. This repository's only write path is
 * `resolver.resolve()` (`src/world/mechanics.ts`), which the mind never
 * sees.
 */
export type PrisonerContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  /** `viewFor(prisoner)` rendered, plus the attempt ledger's prose
   *  (`src/mind/briefing.ts`). */
  readonly briefing: string;
  /** The registered prisoner mechanics -- a closed set (`PRISONER_MOVES`,
   *  `src/world/mechanics.ts`). */
  readonly moves: readonly string[];
};

/** `choice`, when present, is a member of `context.moves` by literal
 *  equality -- `coercePrisonerProposal` below is the one place that is
 *  checked; never a regex, never a scan of `intent`/`line` for meaning
 *  (root CLAUDE.md hard rule 4). */
export type PrisonerProposal = Proposal & { readonly choice?: string };

export type PrisonerMind = Mind<PrisonerContext, PrisonerProposal>;

/**
 * `buildPrisonerPrompt` (design §7.3, P5): identity, motive, the briefing,
 * and the closed move list to answer from -- pure, built from `context`
 * alone, and nothing else from the process (no game id, no path, no other
 * principal's anything -- asserted on the string in
 * `src/mind/__tests__/prisonerMind.test.ts`).
 */
export function buildPrisonerPrompt(context: PrisonerContext): string {
  const moveLines = context.moves.map((move) => `- ${move}: ${MOVE_DESCRIPTIONS[move] ?? "(no description on file)"}`);
  return [
    `You are ${context.identity}.`,
    `Your motive: ${context.motive}`,
    "",
    context.briefing,
    "",
    "Your possible moves are exactly these, each with what it does:",
    ...moveLines,
    "",
    'Answer with one JSON object: {"intent": string, "line"?: string, "choice"?: string}.',
    '"intent" is what you are trying to do, in your own words.',
    '"line" is optional -- something you might say aloud.',
    '"choice" must be exactly one of your possible moves, spelled exactly as given, or omitted entirely if none fits.',
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
  ].join("\n");
}

/**
 * `coercePrisonerProposal` (design §7.3, §7.5, P5): the package's
 * `coerceProposal` for `intent`/`line`, then `choice` kept only by literal
 * membership in `context.moves` -- never pattern-matched. Three cases,
 * exactly the P5 draft issue's own tests:
 *
 *   - `choice` absent: kept, without a `choice` -- not silence (P6 decides
 *     what a choiceless proposal means for the loop).
 *   - `choice` present and a member of `moves`: kept, with `choice`.
 *   - `choice` present and NOT a member of `moves`: the whole proposal is
 *     rejected (`null`) -- a model naming a move never offered is a broken
 *     answer, not a quiet prisoner, and the wire's own `onSilence("rejected")`
 *     fires for it.
 */
export function coercePrisonerProposal(raw: unknown, context: PrisonerContext): PrisonerProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  if (!("choice" in record) || record.choice === undefined) {
    return base;
  }
  const rawChoice = record.choice;
  if (typeof rawChoice === "string" && context.moves.includes(rawChoice)) {
    return { ...base, choice: rawChoice };
  }
  return null;
}

export interface CreatePrisonerMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onSilence?: (reason: SilenceReason, context: PrisonerContext) => void;
  /**
   * Item 9: when a proposal is rejected because `choice` names a move never
   * offered, the checkpoint wants the model's raw parsed answer in the
   * transcript -- not a guess at what it "must have meant". This is the
   * side channel: the CHECKPOINT owns the callback (and whatever variable
   * it writes into), the wire's `coerce` step is the only place with the
   * raw object to hand it, so this wrapper calls it there, on every
   * successful JSON parse, whether `coercePrisonerProposal` goes on to
   * accept or reject it. Never called when the wire fails before any JSON
   * is parsed (unreachable/timeout/status/unparseable) -- there is no raw
   * object to invent at that point, and this callback does not invent one.
   */
  onRawAnswer?: (raw: unknown) => void;
}

/**
 * `createPrisonerMind` = the package's `createLocalMind` with this game's
 * two pure functions (design §7.3). The base URL comes from THIS
 * repository's own environment variable (`PRISONER_MODEL_URL`, read by
 * `src/checkpoint.ts` -- never here, and never a raw default: "the package
 * knows nobody's box").
 */
export function createPrisonerMind(options: CreatePrisonerMindOptions): PrisonerMind {
  const { onRawAnswer, ...rest } = options;
  return createLocalMind<PrisonerContext, PrisonerProposal>({
    ...rest,
    prompt: buildPrisonerPrompt,
    coerce: (raw, context) => {
      onRawAnswer?.(raw);
      return coercePrisonerProposal(raw, context);
    },
  });
}
