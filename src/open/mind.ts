import type { Mind, Proposal, InertRecord, SilenceReason, SilenceDetail } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import {
  TIME_DECAY_RULE,
  ESCAPE_GUARD_MAX,
  EVIDENCE_SUSPICION_DIVISOR,
  HONE_SUSPICION_BUMP,
  FILE_SUSPICION_BUMP,
  FAILED_ESCAPE_SUSPICION_BUMP,
  SEARCH_SUSPICION_THRESHOLD,
  SEARCH_CATCH_BAR_MAX,
  SEARCH_CATCH_LOCK_MAX,
  SEARCH_CATCH_SPOON_MIN,
} from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import type { ObjectPerception } from "./referee.js";

/**
 * The open variant's minds (this task's brief, "Open-mode minds (both
 * principals)"). `mind-seam`'s `Mind<C, P>` is reused unchanged (root
 * `~/rpg/CLAUDE.md`: never wire the seam differently per variant) -- only
 * the CONTENT of `C`/`P` differs from the closed variant's
 * `PrisonerContext`/`WardenContext`: `intent` is free text instead of
 * `plan[0]` from an enum, there is no `moves` field at all (OPEN-VARIANT.md
 * §1's table: "a free-text intent" replaces "plan[0] from an enum"), and
 * the context instead lists the OBJECTS this principal can currently
 * perceive (id + authored description) so the mind's prompt can describe
 * them without ever handing it a move list.
 *
 * ESCAPE/CATCH/CLOCK/PRESENCE/EVIDENCE STAY STATE-BASED, RULED BY THE SAME
 * NUMBERS (this task's brief: "the rules that stay state-based... No move
 * list"): the constants imported above are the CLOSED variant's own
 * (`world/mechanics.ts`), never redeclared, so an open-mode prompt states
 * the identical thresholds a closed-mode prompt does -- only the vehicle
 * (an attemptable intent vs. an enumerated move) differs.
 */
export type OpenPrincipalContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  readonly briefing: string;
  /** What this principal can currently reach or perceive -- id and
   *  authored description, never an affordance list (OPEN-VARIANT.md §3.3:
   *  "physical descriptions, never affordance lists"). The SAME array
   *  `loop.ts` hands the referee as `perceivedObjects` for this half-round,
   *  so a mind is never shown an object the referee itself could not
   *  target. */
  readonly perceivedObjects: readonly ObjectPerception[];
};

export type OpenProposal = Proposal & {
  readonly thoughts?: string;
  readonly notes?: string;
  /** A SHORT FREE-TEXT plan the mind keeps for itself (this task's brief:
   *  "a short free-text plan the mind keeps for itself") -- never a list of
   *  enumerated moves (there are none to enumerate in the open variant).
   *  Rendered into this SAME principal's own next briefing exactly like the
   *  closed variant's `notes` (never the other principal's -- the fog
   *  property `invariants.test.ts` checks). */
  readonly plan?: string;
  readonly witsModel?: string;
  readonly voiceModel?: string;
  readonly witsMs?: number;
  readonly voiceMs?: number;
};

export type OpenMind = Mind<OpenPrincipalContext, OpenProposal>;

function coerceFreeText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const OPEN_WITS_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    intent: { type: "string" },
    plan: { type: "string" },
    notes: { type: "string" },
  },
  required: ["thoughts", "intent", "plan", "notes"],
  additionalProperties: false,
};

const OPEN_SINGLE_CALL_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    intent: { type: "string" },
    line: { type: "string" },
    plan: { type: "string" },
    notes: { type: "string" },
  },
  required: ["thoughts", "intent", "line", "plan", "notes"],
  additionalProperties: false,
};

const VOICE_SCHEMA: InertRecord = {
  type: "object",
  properties: { intent: { type: "string" }, line: { type: "string" } },
  required: ["intent", "line"],
  additionalProperties: false,
};

/** The open variant's own statement of the state-based rules. The closed
 *  variant's `WARDEN_PRESENCE_RULE`/`EVIDENCE_RULE` name its moves (a move
 *  list by another route) and describe presence, which O1 does not model
 *  (OPEN-VARIANT.md §9.3) -- so these are restated here from the SAME
 *  constants, in terms of what happens rather than which move does it. */
function stateBasedRules(): string[] {
  return [
    `Also, rules that never change: ${TIME_DECAY_RULE}`,
    `Whenever ${PRISONER_NAME} audibly or visibly damages, repairs or uncovers something, warden suspicion rises: ` +
      `by ${HONE_SUSPICION_BUMP} for a slight act, ${FILE_SUSPICION_BUMP} for a moderate one, ${FAILED_ESCAPE_SUSPICION_BUMP} for a substantial one.`,
    `When ${WARDEN_NAME} examines something closely and finds it more worn than ${WARDEN_NAME} last believed, warden suspicion ` +
      `rises by the unexplained drop divided by ${EVIDENCE_SUSPICION_DIVISOR}, rounded down -- finding damage is evidence.`,
    `${PRISONER_NAME} escapes the moment the bar's integrity or the lock's integrity reaches 0 while the guard's attention is below ${ESCAPE_GUARD_MAX}.`,
    `${WARDEN_NAME} catches ${PRISONER_NAME} (ending the game) by closely examining, while warden suspicion is at or above ` +
      `${SEARCH_SUSPICION_THRESHOLD}, the bar and finding its integrity at or below ${SEARCH_CATCH_BAR_MAX}, or the lock and ` +
      `finding its integrity at or below ${SEARCH_CATCH_LOCK_MAX}, or the spoon and finding its edge at or above ` +
      `${SEARCH_CATCH_SPOON_MIN} while it is out in the open.`,
  ];
}

function objectLines(context: OpenPrincipalContext): string[] {
  if (context.perceivedObjects.length === 0) return ["You perceive nothing you could act on right now."];
  return context.perceivedObjects.map((o) => `- ${o.id}: ${o.description}`);
}

function identityLines(selfName: string, otherName: string, context: OpenPrincipalContext): string[] {
  return [`You are ${selfName}. The other person in the cell is ${otherName}.`, context.identity, `Your motive: ${context.motive}`, "", context.briefing];
}

function buildOpenWitsPrompt(selfName: string, otherName: string, context: OpenPrincipalContext): string {
  return [
    ...identityLines(selfName, otherName, context),
    "",
    "What you can currently reach or perceive:",
    ...objectLines(context),
    "",
    ...stateBasedRules(),
    "",
    "You may attempt ANYTHING you can plausibly do with what you perceive -- there is no fixed list of moves. " +
      "The world (a referee, never you) decides what actually happens; you only decide what you TRY.",
    'Answer with one JSON object: {"thoughts": string, "intent": string, "plan": string, "notes": string}.',
    '"thoughts" is REQUIRED -- your private reasoning. Nobody else ever sees this.',
    '"intent" is REQUIRED -- exactly what you are trying to do this turn, in plain words, concrete enough that ' +
      "a referee could judge it against what you can perceive. This is not narration of an outcome -- only an attempt.",
    '"plan" is REQUIRED -- a short free-text note to yourself about what you mean to do after this, for your own use next turn.',
    '"notes" is REQUIRED -- at most about 300 characters: what you want to remember next turn. Nobody else ever sees this.',
    "You never decide what happens next -- only the world decides that.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

function buildOpenSingleCallPrompt(selfName: string, otherName: string, context: OpenPrincipalContext): string {
  return [
    ...identityLines(selfName, otherName, context),
    "",
    "What you can currently reach or perceive:",
    ...objectLines(context),
    "",
    ...stateBasedRules(),
    "",
    "You may attempt ANYTHING you can plausibly do with what you perceive -- there is no fixed list of moves. " +
      "The world (a referee, never you) decides what actually happens; you only decide what you TRY.",
    'Answer with one JSON object: {"thoughts": string, "intent": string, "line": string, "plan": string, "notes": string}.',
    '"thoughts" is REQUIRED -- your private reasoning. Nobody else ever sees this.',
    '"intent" is REQUIRED -- exactly what you are trying to do this turn, concrete enough for a referee to judge.',
    '"line" is REQUIRED -- one sentence spoken ALOUD to the other person, or an empty string ("") to stay silent this turn.',
    '"plan" is REQUIRED -- a short free-text note to yourself about what you mean to do after this.',
    '"notes" is REQUIRED -- at most about 300 characters: what you want to remember next turn.',
    "You never decide what happens next -- only the world decides that.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

interface VoiceContext extends InertRecord {
  readonly identity: string;
  readonly motive: string;
  readonly briefing: string;
  readonly intent: string;
  readonly thoughts?: string;
}

function buildVoicePrompt(selfName: string, otherName: string, context: VoiceContext): string {
  return [
    `You are ${selfName}. The other person in the cell is ${otherName}.`,
    context.identity,
    `Your motive: ${context.motive}`,
    "",
    context.briefing,
    "",
    `You have already decided what to try this turn: ${context.intent}`,
    ...(context.thoughts ? [`Your own private reasoning behind it, for tone only: ${context.thoughts}`] : []),
    "",
    "Your only job now is to voice this in character. What you are attempting is already decided and cannot change.",
    'Answer with one JSON object: {"intent": string, "line": string}.',
    '"intent" may restate what you are doing, in your own words.',
    `"line" is REQUIRED: one sentence you say aloud to ${otherName} this turn, in your own voice, or "" to stay silent.`,
    "Speak only as yourself.",
  ].join("\n");
}

function coerceWits(raw: unknown): { thoughts?: string; intent: string; plan?: string; notes?: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const intent = coerceFreeText(record.intent);
  if (!intent) return null;
  return {
    intent,
    ...(coerceFreeText(record.thoughts) !== undefined ? { thoughts: coerceFreeText(record.thoughts) } : {}),
    ...(coerceFreeText(record.plan) !== undefined ? { plan: coerceFreeText(record.plan) } : {}),
    ...(coerceFreeText(record.notes) !== undefined ? { notes: coerceFreeText(record.notes) } : {}),
  };
}

export interface CreateOpenMindOptions {
  baseUrl: string;
  selfName: string;
  otherName: string;
  model?: string;
  witsModel?: string;
  voiceModel?: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), exactly as the closed
   *  variant's `CreatePrisonerMindOptions.ensureLoaded`: awaited before each
   *  call's own request, with that call's model. Only `checkpoint.ts`'s real
   *  run supplies one. */
  ensureLoaded?: (model: string) => Promise<void>;
  onSilence?: (reason: SilenceReason, context: OpenPrincipalContext, detail?: SilenceDetail) => void;
  onVoiceSilence?: (reason: SilenceReason, context: VoiceContext, detail?: SilenceDetail) => void;
}

/**
 * Builds one open-mode mind. Single-call by default (`witsModel ===
 * voiceModel`, exactly the closed variant's own collapse rule in
 * `createPrisonerMind`/`createWardenMind`) -- one schema, one prompt, one
 * coercer. When the two role models differ, WITS decides `intent` (the text
 * the referee will rule on) and VOICE separately produces only `line`,
 * given the wits decision as context -- "the voice role... works as today"
 * (this task's brief) in the sense that voicing is a SEPARATE call seeing
 * only this principal's own briefing plus the decision, never a second,
 * competing `intent`; the wits call's `intent` is always what reaches the
 * referee.
 */
export function createOpenMind(options: CreateOpenMindOptions): OpenMind {
  const witsModel = options.witsModel ?? options.model;
  const voiceModel = options.voiceModel ?? options.model;
  if (!witsModel || !voiceModel) {
    throw new Error("createOpenMind: provide `model`, or both `witsModel` and `voiceModel`.");
  }

  const ensureLoaded = options.ensureLoaded ?? (async () => {});

  if (witsModel === voiceModel) {
    const singleMind = createLocalMind<OpenPrincipalContext, OpenProposal>({
      baseUrl: options.baseUrl,
      model: witsModel,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      fetchFn: options.fetchFn,
      responseFormat: { jsonSchema: OPEN_SINGLE_CALL_SCHEMA, name: "proposal" },
      prompt: (context) => buildOpenSingleCallPrompt(options.selfName, options.otherName, context),
      coerce: (raw) => {
        const base = coerceProposal(raw);
        if (base === null) return null;
        const record = raw as Record<string, unknown>;
        return {
          ...base,
          ...(coerceFreeText(record.thoughts) !== undefined ? { thoughts: coerceFreeText(record.thoughts) } : {}),
          ...(coerceFreeText(record.plan) !== undefined ? { plan: coerceFreeText(record.plan) } : {}),
          ...(coerceFreeText(record.notes) !== undefined ? { notes: coerceFreeText(record.notes) } : {}),
        };
      },
      onSilence: options.onSilence,
    });
    return {
      async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
        await ensureLoaded(witsModel);
        return singleMind.consider(context);
      },
    };
  }

  const witsMind = createLocalMind<OpenPrincipalContext, { intent: string; thoughts?: string; plan?: string; notes?: string; line?: string }>({
    baseUrl: options.baseUrl,
    model: witsModel,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    fetchFn: options.fetchFn,
    responseFormat: { jsonSchema: OPEN_WITS_SCHEMA, name: "wits" },
    prompt: (context) => buildOpenWitsPrompt(options.selfName, options.otherName, context),
    coerce: (raw) => coerceWits(raw) as { intent: string; thoughts?: string; plan?: string; notes?: string; line?: string } | null,
    onSilence: options.onSilence,
  });

  const voiceMind = createLocalMind<VoiceContext, Proposal>({
    baseUrl: options.baseUrl,
    model: voiceModel,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    fetchFn: options.fetchFn,
    responseFormat: { jsonSchema: VOICE_SCHEMA, name: "voice" },
    prompt: (context) => buildVoicePrompt(options.selfName, options.otherName, context),
    coerce: (raw) => coerceProposal(raw),
    onSilence: options.onVoiceSilence,
  });

  return {
    async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
      await ensureLoaded(witsModel);
      const start = performance.now();
      const wits = await witsMind.consider(context);
      const witsMs = performance.now() - start;
      if (wits === null) return null;

      const voiceContext: VoiceContext = {
        identity: context.identity,
        motive: context.motive,
        briefing: context.briefing,
        intent: wits.intent,
        ...(wits.thoughts !== undefined ? { thoughts: wits.thoughts } : {}),
      };
      await ensureLoaded(voiceModel);
      const voiceStart = performance.now();
      const voice = await voiceMind.consider(voiceContext);
      const voiceMs = performance.now() - voiceStart;

      return {
        intent: wits.intent,
        line: voice?.line ?? "",
        ...(wits.thoughts !== undefined ? { thoughts: wits.thoughts } : {}),
        ...(wits.plan !== undefined ? { plan: wits.plan } : {}),
        ...(wits.notes !== undefined ? { notes: wits.notes } : {}),
        witsModel,
        voiceModel,
        witsMs,
        voiceMs,
      };
    },
  };
}

export function createOpenPrisonerMind(options: Omit<CreateOpenMindOptions, "selfName" | "otherName">): OpenMind {
  return createOpenMind({ ...options, selfName: PRISONER_NAME, otherName: WARDEN_NAME });
}

export function createOpenWardenMind(options: Omit<CreateOpenMindOptions, "selfName" | "otherName">): OpenMind {
  return createOpenMind({ ...options, selfName: WARDEN_NAME, otherName: PRISONER_NAME });
}
