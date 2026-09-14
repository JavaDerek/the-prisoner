import type { Mind, Proposal, SilenceReason } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";

/**
 * The prisoner's declaration of `mind-seam`'s generic seam (design §A.5,
 * §3.1) -- a `type` alias over the package's own `Inert`/`Proposal`/`Mind`,
 * never an `interface`.
 *
 * THE MIND CANNOT WRITE. `PrisonerContext` is structurally `InertRecord`, so
 * `Mind<PrisonerContext, PrisonerProposal>` accepts no field that could
 * reach storage. This repository's only write path is `resolver.resolve()`
 * (`src/world/mechanics.ts`), which the mind never sees.
 */
export type PrisonerContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  /** `viewFor(prisoner)` rendered, plus belief and the attempt ledger's
   *  prose (`src/mind/briefing.ts`). */
  readonly briefing: string;
  /** The registered prisoner mechanics -- a closed set (`PRISONER_MOVES`,
   *  `src/world/mechanics.ts`). */
  readonly moves: readonly string[];
};

/** `choice` is now REQUIRED by this repository's own `coerce` (this task's
 *  prompt fix: "choice is REQUIRED; WAIT is the explicit way to do
 *  nothing"), even though the field itself stays optional at the type level
 *  -- `mind-seam`'s base `Proposal` never requires it, and requiring it
 *  structurally would also outlaw a caller-authored test proposal with no
 *  choice at all (`loop.test.ts`'s "no-choice" defensive path). The
 *  REQUIREMENT is enforced by `coercePrisonerProposal` returning `null`
 *  when `choice` is missing or invalid, exactly as it already does for an
 *  unrecognised move name. `plan` (this task's brief, "minds own their
 *  plans"): an optional list of up to 6 move names that replaces the
 *  remaining steps of this principal's own plan -- validated the same way
 *  `choice` is, by literal membership in `context.moves`. */
export type PrisonerProposal = Proposal & { readonly choice?: string; readonly plan?: readonly string[] };

export type PrisonerMind = Mind<PrisonerContext, PrisonerProposal>;

/** Up to this many moves in a revised plan (this task's brief). */
export const MAX_PLAN_LENGTH = 6;

/**
 * `buildPrisonerPrompt` (design §7.3, P5): identity, motive, the briefing,
 * and the closed move list to answer from -- pure, built from `context`
 * alone plus this repository's own static content (`MOVE_DESCRIPTIONS`,
 * `PRISONER_NAME`/`WARDEN_NAME`), never anything else from the process.
 */
export function buildPrisonerPrompt(context: PrisonerContext): string {
  const moveLines = context.moves.map((move) => `- ${move}: ${MOVE_DESCRIPTIONS[move] ?? "(no description on file)"}`);
  return [
    `You are ${PRISONER_NAME}. The other person in the cell is ${WARDEN_NAME}.`,
    context.identity,
    `Your motive: ${context.motive}`,
    "",
    context.briefing,
    "",
    "Your possible moves are exactly these, each with what it does:",
    ...moveLines,
    "",
    'Answer with one JSON object: {"intent": string, "line"?: string, "choice": string, "plan"?: string[]}.',
    '"intent" is what you are trying to do, in your own words.',
    '"line" is optional -- something you might say aloud.',
    '"choice" is REQUIRED -- exactly one of your possible moves, spelled exactly as given. Use WAIT to do nothing.',
    '"plan" is optional -- up to 6 of your possible moves, in order, replacing the rest of your current plan, ' +
      "if you want to change what you intend to do next.",
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

function validPlan(raw: unknown, moves: readonly string[]): readonly string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PLAN_LENGTH) return undefined;
  if (!raw.every((m) => typeof m === "string" && moves.includes(m))) return undefined;
  return raw as readonly string[];
}

/**
 * `coercePrisonerProposal` (design §7.3, §7.5, P5; this task's prompt fix):
 * the package's `coerceProposal` for `intent`/`line`, then `choice` REQUIRED
 * and kept only by literal membership in `context.moves` -- never
 * pattern-matched. `plan`, when present, is validated the same way; an
 * invalid `plan` drops only that field, never the whole proposal (this
 * task's brief: "if any entry is invalid, drop the plan field only, never
 * the proposal").
 */
export function coercePrisonerProposal(raw: unknown, context: PrisonerContext): PrisonerProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  const rawChoice = record.choice;
  if (typeof rawChoice !== "string" || !context.moves.includes(rawChoice)) {
    // choice is REQUIRED: missing, non-string, or naming a move never
    // offered is all silence ("rejected") -- never a quiet acceptance.
    return null;
  }

  const proposal: PrisonerProposal = { ...base, choice: rawChoice };
  const plan = validPlan(record.plan, context.moves);
  return plan ? { ...proposal, plan } : proposal;
}

export interface CreatePrisonerMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onSilence?: (reason: SilenceReason, context: PrisonerContext) => void;
  /**
   * Item 9: when a proposal is rejected because `choice` is missing or names
   * a move never offered, the checkpoint wants the model's raw parsed answer
   * in the transcript -- not a guess at what it "must have meant". This is
   * the side channel: the CHECKPOINT owns the callback, the wire's `coerce`
   * step is the only place with the raw object to hand it, so this wrapper
   * calls it there, on every successful JSON parse, whether
   * `coercePrisonerProposal` goes on to accept or reject it. Never called
   * when the wire fails before any JSON is parsed.
   */
  onRawAnswer?: (raw: unknown) => void;
}

/**
 * `createPrisonerMind` = the package's `createLocalMind` with this game's
 * two pure functions (design §7.3). The base URL comes from THIS
 * repository's own environment variable (`PRISONER_MODEL_URL`, read by
 * `src/checkpoint.ts` -- never here, and never a raw default).
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
