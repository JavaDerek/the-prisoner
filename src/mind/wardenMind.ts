import type { Mind, Proposal, SilenceReason } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";

/**
 * The warden as a model too, for this checkpoint (this task's correction 1
 * over DESIGN.md, which has a human warden on a closed command set -- P6's
 * CLI is out of scope here). Its own context type, beside
 * `PrisonerContext`, both going through the same seam: same shape by
 * accident of this game having two symmetric principals, never by the
 * package's decision -- `mind-seam` exports `Mind<C, P>` and no `C`
 * (package CLAUDE.md, "no context lives here").
 */
export type WardenContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  /** `viewFor(warden)` rendered, plus the warden's own ledger prose. */
  readonly briefing: string;
  /** The registered warden mechanics -- a closed set (`WARDEN_MOVES`,
   *  `src/world/mechanics.ts`). */
  readonly moves: readonly string[];
};

export type WardenProposal = Proposal & { readonly choice?: string };

export type WardenMind = Mind<WardenContext, WardenProposal>;

export function buildWardenPrompt(context: WardenContext): string {
  return [
    `You are ${context.identity}.`,
    `Your motive: ${context.motive}`,
    "",
    context.briefing,
    "",
    `Your possible moves are exactly: ${context.moves.join(", ")}.`,
    "",
    'Answer with one JSON object: {"intent": string, "line"?: string, "choice"?: string}.',
    '"intent" is what you are trying to do, in your own words.',
    '"line" is optional -- something you might say aloud.',
    '"choice" must be exactly one of your possible moves, spelled exactly as given, or omitted entirely if none fits.',
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
  ].join("\n");
}

export function coerceWardenProposal(raw: unknown, context: WardenContext): WardenProposal | null {
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

export interface CreateWardenMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  onSilence?: (reason: SilenceReason, context: WardenContext) => void;
}

export function createWardenMind(options: CreateWardenMindOptions): WardenMind {
  return createLocalMind<WardenContext, WardenProposal>({
    ...options,
    prompt: buildWardenPrompt,
    coerce: coerceWardenProposal,
  });
}
