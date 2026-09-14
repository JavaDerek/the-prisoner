import type { Mind, Proposal, SilenceReason, SilenceDetail, InertRecord } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS, WARDEN_MOVES } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import { normalizePlan, MAX_PLAN_LENGTH } from "./prisonerMind.js";

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
 *  identical shape here: `plan` REQUIRED (`plan[0]` is this turn's move,
 *  `plan[1..]` the revised remaining plan); `choice` is derived as
 *  `plan[0]` and never read from the raw answer directly. */
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
    'Answer with one JSON object: {"intent": string, "line"?: string, "plan": string[]}.',
    '"intent" is what you are trying to do, in your own words.',
    '"line" is optional -- something you might say aloud. Anything in "line" is spoken ALOUD and the ' +
      "other person hears every word; keep secrets out of it.",
    '"plan" is REQUIRED -- a list of 1 to 6 of your possible moves, spelled exactly as given. The FIRST ' +
      "entry is what you do THIS turn. Use WAIT as the first entry to do nothing this turn. Any further " +
      "entries are what you now intend to do afterward, replacing whatever you intended before -- include " +
      "only as many as you are confident about.",
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

export function coerceWardenProposal(raw: unknown, context: WardenContext): WardenProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  const plan = normalizePlan(record.plan, context.moves);
  if (!plan) return null;

  return { ...base, choice: plan[0], plan };
}

export interface CreateWardenMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** See `CreatePrisonerMindOptions.onSilence` (`prisonerMind.ts`) for the
   *  full reasoning -- identical shape here. */
  onSilence?: (reason: SilenceReason, context: WardenContext, detail?: SilenceDetail) => void;
}

/** `mind-seam@0.4.0`: see `PRISONER_PROPOSAL_SCHEMA` (`prisonerMind.ts`) for
 *  the full reasoning -- built from THIS principal's own move list,
 *  `WARDEN_MOVES`, which is why the two schemas' `plan.items.enum` differ. */
const WARDEN_PROPOSAL_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    intent: { type: "string" },
    line: { type: "string" },
    plan: {
      type: "array",
      minItems: 1,
      maxItems: MAX_PLAN_LENGTH,
      items: { type: "string", enum: WARDEN_MOVES },
    },
  },
  required: ["intent", "plan"],
  additionalProperties: false,
};

export function createWardenMind(options: CreateWardenMindOptions): WardenMind {
  return createLocalMind<WardenContext, WardenProposal>({
    ...options,
    responseFormat: { jsonSchema: WARDEN_PROPOSAL_SCHEMA, name: "proposal" },
    prompt: buildWardenPrompt,
    coerce: coerceWardenProposal,
  });
}
