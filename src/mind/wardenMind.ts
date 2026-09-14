import type { Mind, Proposal, SilenceReason, SilenceDetail, InertRecord } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS, WARDEN_MOVES, TIME_DECAY_RULE, WARDEN_PRESENCE_RULE, EVIDENCE_RULE } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME, PRISONER_SHORT_NAME } from "../scenario.js";
import { normalizePlan, MAX_PLAN_LENGTH } from "./prisonerMind.js";
import { composeRoleMind, VOICE_PROPOSAL_SCHEMA, type WitsProposal, type VoiceContext, type VoiceSilenceReason } from "./roleMind.js";

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
 *  `plan[0]` and never read from the raw answer directly. `thoughts`/
 *  `notes` (this task's brief, items 1-2) are likewise identical: private
 *  reasoning rendered to the transcript only, and a persisted note to the
 *  warden's own future self -- both optional here, required in the JSON
 *  schema below, for the same "coerce tolerates absence" reason `plan`
 *  itself does not extend to `choice`. */
/** See `PrisonerProposal` (`prisonerMind.ts`) for the full reasoning behind
 *  the six role fields below -- identical here. */
export type WardenProposal = Proposal & {
  readonly choice?: string;
  readonly plan?: readonly string[];
  readonly thoughts?: string;
  readonly notes?: string;
  readonly witsModel?: string;
  readonly voiceModel?: string;
  readonly witsMs?: number;
  readonly voiceMs?: number;
  readonly witsSwapMs?: number;
  readonly voiceSwapMs?: number;
  readonly voiceSilenceReason?: VoiceSilenceReason;
  readonly voiceSilenceText?: string;
  readonly voiceSilenceParsed?: import("mind-seam").Inert;
};

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
    `Also, a rule that never changes and is not one of your moves: ${TIME_DECAY_RULE}`,
    WARDEN_PRESENCE_RULE,
    EVIDENCE_RULE,
    "",
    'Answer with one JSON object: {"thoughts": string, "intent": string, "line": string, "plan": string[], "notes": string}.',
    '"thoughts" is REQUIRED -- your private reasoning: what you know, what the other person probably knows, ' +
      "and what you plan to do. A few sentences. Nobody else ever sees this; think it through before you commit " +
      "to the rest of your answer.",
    '"intent" is what you are trying to do, in your own words.',
    '"line" is REQUIRED -- one sentence spoken ALOUD to the other person, or an empty string ("") to ' +
      "stay silent this turn. The other person hears every word of it; keep secrets out of it.",
    '"plan" is REQUIRED -- a list of 1 to 6 of your possible moves, spelled exactly as given. The FIRST ' +
      "entry is what you do THIS turn. Use WAIT as the first entry to do nothing this turn. Any further " +
      "entries are what you now intend to do afterward, replacing whatever you intended before -- include " +
      "only as many as you are confident about.",
    '"notes" is REQUIRED -- at most about 300 characters: what you want to remember next turn. Nobody else ' +
      "ever sees this either; it will be shown back to only you, at the top of your next briefing.",
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

/** See `coerceFreeText` in `prisonerMind.ts` for the full reasoning --
 *  identical here: a non-empty string after trimming, or `undefined`. */
function coerceFreeText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function coerceWardenProposal(raw: unknown, context: WardenContext): WardenProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  const plan = normalizePlan(record.plan, context.moves);
  if (!plan) return null;

  const thoughts = coerceFreeText(record.thoughts);
  const notes = coerceFreeText(record.notes);

  return {
    ...base,
    choice: plan[0],
    plan,
    ...(thoughts !== undefined ? { thoughts } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** See `CreatePrisonerMindOptions` (`prisonerMind.ts`) for the full
 *  reasoning behind every field -- identical shape here. */
export interface CreateWardenMindOptions {
  baseUrl: string;
  model?: string;
  witsModel?: string;
  voiceModel?: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  ensureLoaded?: (model: string) => Promise<void>;
  onSilence?: (reason: SilenceReason, context: WardenContext, detail?: SilenceDetail) => void;
  onVoiceSilence?: (reason: SilenceReason, context: VoiceContext, detail?: SilenceDetail) => void;
}

/** `mind-seam@0.4.0`: see `PRISONER_PROPOSAL_SCHEMA` (`prisonerMind.ts`) for
 *  the full reasoning -- built from THIS principal's own move list,
 *  `WARDEN_MOVES`, which is why the two schemas' `plan.items.enum` differ.
 *  `line` is REQUIRED (coordinator's fix, item 1) for the same reason.
 *  `thoughts`/`notes` (this task's brief, item 1) are likewise `thoughts`
 *  FIRST, `notes` LAST -- property order is generation order under
 *  `strict: true`. */
const WARDEN_PROPOSAL_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    intent: { type: "string" },
    line: { type: "string" },
    plan: {
      type: "array",
      minItems: 1,
      maxItems: MAX_PLAN_LENGTH,
      items: { type: "string", enum: WARDEN_MOVES },
    },
    notes: { type: "string" },
  },
  required: ["thoughts", "intent", "line", "plan", "notes"],
  additionalProperties: false,
};

/** Configurable model roles (this task's brief, item 1): the WITS call's
 *  own schema and prompt -- see `PRISONER_WITS_SCHEMA`/`buildPrisonerWitsPrompt`
 *  (`prisonerMind.ts`) for the full reasoning, identical here except for
 *  `WARDEN_MOVES`. */
const WARDEN_WITS_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    plan: {
      type: "array",
      minItems: 1,
      maxItems: MAX_PLAN_LENGTH,
      items: { type: "string", enum: WARDEN_MOVES },
    },
    notes: { type: "string" },
  },
  required: ["thoughts", "plan", "notes"],
  additionalProperties: false,
};

function buildWardenWitsPrompt(context: WardenContext): string {
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
    `Also, a rule that never changes and is not one of your moves: ${TIME_DECAY_RULE}`,
    WARDEN_PRESENCE_RULE,
    EVIDENCE_RULE,
    "",
    "Decide what to do. Someone else will voice this decision in character afterward -- your job here is only the decision itself.",
    'Answer with one JSON object: {"thoughts": string, "plan": string[], "notes": string}.',
    '"thoughts" is REQUIRED -- your private reasoning: what you know, what the other person probably knows, ' +
      "and what you plan to do. A few sentences. Nobody else ever sees this; think it through before you commit " +
      "to the rest of your answer.",
    '"plan" is REQUIRED -- a list of 1 to 6 of your possible moves, spelled exactly as given. The FIRST ' +
      "entry is what you do THIS turn. Use WAIT as the first entry to do nothing this turn. Any further " +
      "entries are what you now intend to do afterward, replacing whatever you intended before -- include " +
      "only as many as you are confident about.",
    '"notes" is REQUIRED -- at most about 300 characters: what you want to remember next turn. Nobody else ' +
      "ever sees this either; it will be shown back to only you, at the top of your next briefing.",
    "You never decide what happens next -- only the world decides that. Propose; do not narrate an outcome.",
  ].join("\n");
}

function coerceWardenWitsProposal(raw: unknown, context: WardenContext): WitsProposal | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const plan = normalizePlan(record.plan, context.moves);
  if (!plan) return null;
  const thoughts = coerceFreeText(record.thoughts);
  const notes = coerceFreeText(record.notes);
  return {
    intent: "",
    choice: plan[0],
    plan,
    ...(thoughts !== undefined ? { thoughts } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** Configurable model roles: the VOICE call's own prompt -- see
 *  `buildPrisonerVoicePrompt` (`prisonerMind.ts`) for the full reasoning
 *  AND the coordinator's A/B-verified fix over the original wording,
 *  identical here. */
export function buildWardenVoicePrompt(context: VoiceContext): string {
  const moveDescription = MOVE_DESCRIPTIONS[context.decision.choice] ?? "(no description on file)";
  return [
    `You are ${WARDEN_NAME}. The other person in the cell is ${PRISONER_NAME}.`,
    context.identity,
    `Your motive: ${context.motive}`,
    "",
    context.briefing,
    "",
    `You have already decided what to do this turn: ${context.decision.choice} -- ${moveDescription}`,
    ...(context.decision.thoughts ? [`Your own private reasoning behind that decision, for tone only: ${context.decision.thoughts}`] : []),
    "",
    "Your only job now is to voice this decision in character. The move itself is already decided and cannot change.",
    'Answer with one JSON object: {"intent": string, "line": string}.',
    '"intent" is what you are doing, in your own words, consistent with the move already chosen.',
    `"line" is REQUIRED: one sentence you say aloud to ${PRISONER_NAME} this turn, in your own voice. ` +
      `${PRISONER_SHORT_NAME} hears every word, so it can cover for, distract from, or have nothing to do ` +
      "with what you are really doing. Never an empty string.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

/** See `createPrisonerMind` for the full reasoning -- identical shape here:
 *  `witsModel`/`voiceModel` resolve against `model`; equal, this is the
 *  single, unmodified `createLocalMind` call this function has always
 *  made; different, it composes two calls through `composeRoleMind`. */
export function createWardenMind(options: CreateWardenMindOptions): WardenMind {
  const witsModel = options.witsModel ?? options.model;
  const voiceModel = options.voiceModel ?? options.model;
  if (!witsModel || !voiceModel) {
    throw new Error("createWardenMind: provide `model`, or both `witsModel` and `voiceModel`.");
  }

  if (witsModel === voiceModel) {
    return createLocalMind<WardenContext, WardenProposal>({
      baseUrl: options.baseUrl,
      model: witsModel,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      fetchFn: options.fetchFn,
      responseFormat: { jsonSchema: WARDEN_PROPOSAL_SCHEMA, name: "proposal" },
      prompt: buildWardenPrompt,
      coerce: coerceWardenProposal,
      onSilence: options.onSilence,
    });
  }

  return composeRoleMind<WardenContext>(
    {
      baseUrl: options.baseUrl,
      witsModel,
      voiceModel,
      witsSchema: WARDEN_WITS_SCHEMA,
      voiceSchema: VOICE_PROPOSAL_SCHEMA,
      buildWitsPrompt: buildWardenWitsPrompt,
      buildVoicePrompt: buildWardenVoicePrompt,
      coerceWits: coerceWardenWitsProposal,
      coerceVoice: (raw) => coerceProposal(raw),
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      fetchFn: options.fetchFn,
      ensureLoaded: options.ensureLoaded,
      onWitsSilence: options.onSilence,
      onVoiceSilence: options.onVoiceSilence,
    },
    (context, wits) => ({
      principalId: context.principalId,
      identity: context.identity,
      motive: context.motive,
      briefing: context.briefing,
      decision: { choice: wits.choice ?? "", ...(wits.thoughts !== undefined ? { thoughts: wits.thoughts } : {}) },
    }),
    (_context, wits, voice, meta) => ({
      intent: voice?.intent ?? "",
      line: voice?.line ?? "",
      choice: wits.choice,
      plan: wits.plan,
      ...(wits.thoughts !== undefined ? { thoughts: wits.thoughts } : {}),
      ...(wits.notes !== undefined ? { notes: wits.notes } : {}),
      witsModel,
      voiceModel,
      witsMs: meta.witsMs,
      ...(meta.witsSwapMs !== undefined ? { witsSwapMs: meta.witsSwapMs } : {}),
      ...(meta.voiceMs !== undefined ? { voiceMs: meta.voiceMs } : {}),
      ...(meta.voiceSwapMs !== undefined ? { voiceSwapMs: meta.voiceSwapMs } : {}),
      ...(meta.voiceSilenceReason !== undefined ? { voiceSilenceReason: meta.voiceSilenceReason } : {}),
      ...(meta.voiceSilenceText !== undefined ? { voiceSilenceText: meta.voiceSilenceText } : {}),
      ...(meta.voiceSilenceParsed !== undefined ? { voiceSilenceParsed: meta.voiceSilenceParsed } : {}),
    })
  ) as WardenMind;
}
