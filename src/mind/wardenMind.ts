import type { Mind, Proposal, SilenceReason } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import { MAX_PLAN_LENGTH } from "./prisonerMind.js";

/**
 * The warden as a model too (this checkpoint's correction 1 over DESIGN.md,
 * which has a human warden on a closed command set). Its own context type,
 * beside `PrisonerContext` -- same shape by accident of this game having
 * two symmetric principals, never by the package's decision.
 */
export type WardenContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  /** `viewFor(warden)` rendered, plus belief and the warden's own ledger
   *  prose. */
  readonly briefing: string;
  /** The registered warden mechanics -- a closed set (`WARDEN_MOVES`,
   *  `src/world/mechanics.ts`). */
  readonly moves: readonly string[];
};

/** See `PrisonerProposal` (`prisonerMind.ts`) for the full reasoning --
 *  identical shape here: `choice` REQUIRED by this repository's `coerce`,
 *  `plan` optional and validated the same way. */
export type WardenProposal = Proposal & { readonly choice?: string; readonly plan?: readonly string[] };

export type WardenMind = Mind<WardenContext, WardenProposal>;

export function buildWardenPrompt(context: WardenContext): string {
  const moveLines = context.moves.map((move) => `- ${move}: ${MOVE_DESCRIPTIONS[move] ?? "(no description on file)"}`);
  return [
    `You are ${WARDEN_NAME}. The other person in the cell is ${PRISONER_NAME}.`,
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

export function coerceWardenProposal(raw: unknown, context: WardenContext): WardenProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  const rawChoice = record.choice;
  if (typeof rawChoice !== "string" || !context.moves.includes(rawChoice)) {
    return null;
  }

  const proposal: WardenProposal = { ...base, choice: rawChoice };
  const plan = validPlan(record.plan, context.moves);
  return plan ? { ...proposal, plan } : proposal;
}

export interface CreateWardenMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onSilence?: (reason: SilenceReason, context: WardenContext) => void;
  /** Item 9: see `CreatePrisonerMindOptions.onRawAnswer` (`prisonerMind.ts`)
   *  for the full reasoning -- identical shape here. */
  onRawAnswer?: (raw: unknown) => void;
}

export function createWardenMind(options: CreateWardenMindOptions): WardenMind {
  const { onRawAnswer, ...rest } = options;
  return createLocalMind<WardenContext, WardenProposal>({
    ...rest,
    prompt: buildWardenPrompt,
    coerce: (raw, context) => {
      onRawAnswer?.(raw);
      return coerceWardenProposal(raw, context);
    },
  });
}
