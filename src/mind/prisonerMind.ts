import type { Mind, Proposal, SilenceReason, SilenceDetail, InertRecord } from "mind-seam";
import { createLocalMind, coerceProposal } from "mind-seam";
import { MOVE_DESCRIPTIONS, PRISONER_MOVES, TIME_DECAY_RULE, WARDEN_PRESENCE_RULE, EVIDENCE_RULE } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import { composeRoleMind, VOICE_PROPOSAL_SCHEMA, type WitsProposal, type VoiceContext } from "./roleMind.js";

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

/**
 * REVISION (coordinator's fix, over the first real runs' plan-revision
 * loop): there is no separate `choice` field on the wire anymore. A mind
 * sends exactly ONE array, `plan`: 1-6 move names, where `plan[0]` is what
 * it is doing THIS half-round and `plan[1..]` is what it now intends to do
 * after that. `choice` stays on this TYPE (`= plan[0]` once coerced) purely
 * so `loop.ts` and the conformance harnesses keep addressing "the move to
 * resolve" the way they always have -- it is never sent or read separately
 * on the wire.
 *
 * Why this fixes the loop: the old shape had a mind repeat its CURRENT move
 * as the first element of a plan that otherwise also described the future,
 * and the loop's plan revision naively re-inserted the WHOLE array
 * (including that just-decided current move) as new pending steps -- so the
 * step that had just been completed came right back as "current" the very
 * next round, and an honest mind that keeps reporting what the briefing
 * tells it is current necessarily kept re-proposing it forever. Under this
 * shape `plan[0]` is consumed as this turn's move and never re-enters the
 * pending steps at all; only `plan[1..]` becomes the new remaining plan
 * (`loop.ts`'s `planNoteFor`).
 *
 * REVISION (this task's brief, "a battle of wits, not two scripts", items
 * 1-2): every half-round is otherwise STATELESS -- a mind sees its ledger of
 * past ACTS, never its own past REASONING, so it cannot carry a strategy
 * ("two more shims, then escape while guard attention is low") from one
 * turn to the next except by re-deriving it from scratch. Two more optional
 * fields close that gap, both `Inert`, neither ever written to storage
 * through anything but this repository's own caller-side tables:
 *
 * `thoughts` -- private reasoning, rendered into the TRANSCRIPT only
 * (`checkpoint.ts`) and never stored, never fed back into any context. It
 * exists so a reader (and the model itself, mid-answer, since property
 * order in a `strict` JSON schema is generation order) reasons before
 * committing to `plan`.
 *
 * `notes` -- "what I want to remember next turn", persisted one row per
 * (game, principal) in `src/ledger/notes.ts` (latest only, capped at 400
 * characters by truncation on write) and rendered near the top of THAT SAME
 * principal's own next briefing (`briefing.ts`) -- never the other
 * principal's, which is the fog property `src/mind/__tests__/
 * privateFields.test.ts` checks with a planted marker, the same way
 * conformance check 4 checks the private-act fog.
 *
 * Both are optional on this TYPE (defence in depth: `coercePrisonerProposal`
 * accepts a proposal that omits either or both, even though the JSON schema
 * below marks both required) -- the same division `choice`/`plan` already
 * have between "required in the schema" and "tolerated absent by coerce". */
/**
 * Configurable model roles (this task's brief, item 1): the six fields
 * below `notes` are populated ONLY on the two-call (wits/voice) path
 * (`witsModel !== voiceModel`, see `createPrisonerMind`) -- the single-call
 * path never sets any of them, which is how "identical transcripts" in the
 * default case is kept true by construction (`checkpoint.ts`'s own
 * rendering only ever emits a line for one of these when it is present).
 * `witsModel`/`voiceModel` say which model produced the decision vs. the
 * line; `witsMs`/`voiceMs` are each sub-call's own wall time;
 * `witsSwapMs`/`voiceSwapMs` are the GPU swap wall time incurred
 * immediately before that sub-call, if any (`src/ollamaSwap.ts`);
 * `voiceSilenceReason`/`voiceSilenceText`/`voiceSilenceParsed` record a
 * VOICE failure -- distinct from a decision (wits) silence, which still
 * makes the whole `consider()` call return `null` exactly as it always has
 * (flattened rather than nested as `mind-seam`'s own `SilenceDetail`; see
 * `roleMind.ts`'s `RoleCallMeta` for why).
 */
export type PrisonerProposal = Proposal & {
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
  readonly voiceSilenceReason?: SilenceReason;
  readonly voiceSilenceText?: string;
  readonly voiceSilenceParsed?: import("mind-seam").Inert;
};

export type PrisonerMind = Mind<PrisonerContext, PrisonerProposal>;

/** The whole `plan` array, `plan[0]` included, is 1-6 entries. */
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

/** Matches `raw` against `moves` by exact equality after ASCII
 *  uppercasing -- a literal, deterministic normalization of this
 *  repository's OWN enumerated move tokens (never fuzzy, never a scan of
 *  meaning; root CLAUDE.md hard rule 4 covers case exactly the way it
 *  covers a substring: "file" is not read as meaning FILE by inference, it
 *  is transformed by one fixed character rule and then checked by literal
 *  equality against a list this repository wrote). `undefined` when `raw`
 *  is not a string, or uppercasing it still names no real move. */
export function normalizeMove(raw: unknown, moves: readonly string[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  const upper = raw.toUpperCase();
  return moves.includes(upper) ? upper : undefined;
}

/**
 * `plan[0]` (this turn's move) must normalize to a real move, or the whole
 * plan -- and with it the whole proposal -- is invalid (the caller treats
 * this as rejected silence: "If plan[0] is invalid or missing"). A later
 * entry that fails to normalize TRUNCATES the plan there (`plan[0]` is
 * always kept); at most `MAX_PLAN_LENGTH` entries are ever read.
 */
export function normalizePlan(raw: unknown, moves: readonly string[]): readonly string[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const first = normalizeMove(raw[0], moves);
  if (!first) return undefined;

  const plan: string[] = [first];
  for (let i = 1; i < raw.length && plan.length < MAX_PLAN_LENGTH; i++) {
    const next = normalizeMove(raw[i], moves);
    if (!next) break; // Truncate at the first invalid entry.
    plan.push(next);
  }
  return plan;
}

/** A free-text field this repository never interprets (`thoughts`/`notes`):
 *  a non-empty string after trimming, or `undefined` -- for anything that
 *  is not a string at all, OR trims to nothing. Defence in depth (this
 *  task's brief, item 4): the JSON schema below marks both REQUIRED, but a
 *  raw answer missing either -- or sending the wrong type -- drops just
 *  that field rather than rejecting the whole proposal, the same tolerance
 *  `line` already has between "required in the schema" and "optional on
 *  the wire". */
function coerceFreeText(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * `coercePrisonerProposal` (design §7.3, §7.5, P5; coordinator's fix): the
 * package's `coerceProposal` for `intent`/`line`, then `plan` REQUIRED --
 * `plan[0]` missing or invalid is the whole proposal rejected (silence);
 * `choice` is derived as `plan[0]`, never read from the raw answer
 * directly. `thoughts`/`notes` (this task's brief, items 1-2) are read the
 * same way `line` always was: present when the raw answer offered a real
 * string, silently absent otherwise -- never a reason to reject the rest of
 * an otherwise-valid proposal.
 */
export function coercePrisonerProposal(raw: unknown, context: PrisonerContext): PrisonerProposal | null {
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

export interface CreatePrisonerMindOptions {
  baseUrl: string;
  /** Legacy/default: one model for both roles. Ignored when `witsModel`
   *  and `voiceModel` are both given and differ (this task's brief, item
   *  1); when either role name is omitted, it falls back to this field, so
   *  `PRISONER_WITS_MODEL`/`PRISONER_VOICE_MODEL` unset and only
   *  `PRISONER_MODEL` set is exactly today's behaviour. */
  model?: string;
  /** Produces `thoughts`, `notes` and `plan` (the decision). */
  witsModel?: string;
  /** Produces `intent` and `line` in character, given the wits decision. */
  voiceModel?: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), wired only by
   *  `checkpoint.ts`'s real run -- absent in every test in this file. */
  ensureLoaded?: (model: string) => Promise<void>;
  /**
   * `mind-seam@0.3.0`: `detail` is present for `"unparseable"` (`text` only)
   * and `"rejected"` (`text` and `parsed`) -- `undefined` for
   * `"unreachable"`/`"timeout"`/`"status"`, which have nothing more to say.
   * This repository no longer needs its own raw-answer side channel (see
   * `CreatePrisonerMindOptions`'s old `onRawAnswer`, retired in this
   * revision): `detail.parsed` on a `"rejected"` silence IS the model's raw
   * parsed answer, and `detail.text` additionally covers `"unparseable"`,
   * which the old side channel could never report at all (it only ever saw
   * a raw object once JSON parsing had already succeeded).
   *
   * On the two-call path this is the WITS call's silence only (the
   * decision) -- a decision silence still makes `consider()` return `null`,
   * exactly as the single-call path always has. See `onVoiceSilence` for
   * the voice call's own, separate failure channel (this task's brief,
   * item 1: "record it as a voice silence... separate from decision
   * silences").
   */
  onSilence?: (reason: SilenceReason, context: PrisonerContext, detail?: SilenceDetail) => void;
  /** Fires only on the two-call path, only for a VOICE failure. The turn
   *  still resolves (`consider()` returns the wits decision with an empty
   *  `intent`/`line`); this is purely a report. */
  onVoiceSilence?: (reason: SilenceReason, context: VoiceContext, detail?: SilenceDetail) => void;
}

/**
 * `mind-seam@0.4.0`: a strict JSON schema, built from THIS principal's own
 * closed move list (`PRISONER_MOVES`) -- static, because the move list
 * itself is static; a per-context schema would be the same object every
 * call. Verified on doris (Ollama 0.30.10): `strict: true` with a schema
 * held `ancient-awakening` to exactly these keys and enum values even when
 * the prompt asked for others -- `"json"` alone (0.3.0) still let it invent
 * keys. This narrows what usually arrives; `coercePrisonerProposal` still
 * runs on every answer regardless (defence in depth -- the package's own
 * documentation: "schema enforcement narrows the model but doesn't replace
 * coerce"). `line` is REQUIRED here too (coordinator's fix, item 1): under
 * `additionalProperties: false`, a model asked for an OPTIONAL field tends
 * to just omit it -- every real run under 0.4.0's own schema had zero lines
 * spoken. `coercePrisonerProposal` (and `mind-seam`'s own `coerceProposal`)
 * still accept a missing `line` regardless (defence in depth, the other
 * direction: the schema asks, it does not enforce what `coerce` accepts).
 *
 * REVISION (this task's brief, item 1): `thoughts` is listed FIRST and
 * `notes` LAST -- property order matters under `strict: true` because it is
 * generation order, so the model reasons privately (`thoughts`) before it
 * commits to `plan`, and leaves itself a note (`notes`) only after
 * everything else is decided. Both are REQUIRED for the same reason `line`
 * is (a model asked for an optional field tends to just omit it);
 * `coercePrisonerProposal` still tolerates either missing (defence in
 * depth, item 4).
 */
const PRISONER_PROPOSAL_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    intent: { type: "string" },
    line: { type: "string" },
    plan: {
      type: "array",
      minItems: 1,
      maxItems: MAX_PLAN_LENGTH,
      items: { type: "string", enum: PRISONER_MOVES },
    },
    notes: { type: "string" },
  },
  required: ["thoughts", "intent", "line", "plan", "notes"],
  additionalProperties: false,
};

/**
 * Configurable model roles (this task's brief, item 1) -- the WITS call's
 * own schema and prompt: `thoughts`/`plan`/`notes` only, no `intent`, no
 * `line`. Same property order discipline as `PRISONER_PROPOSAL_SCHEMA`
 * (`thoughts` first, `notes` last -- generation order under `strict: true`).
 */
const PRISONER_WITS_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    thoughts: { type: "string" },
    plan: {
      type: "array",
      minItems: 1,
      maxItems: MAX_PLAN_LENGTH,
      items: { type: "string", enum: PRISONER_MOVES },
    },
    notes: { type: "string" },
  },
  required: ["thoughts", "plan", "notes"],
  additionalProperties: false,
};

function buildPrisonerWitsPrompt(context: PrisonerContext): string {
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

/** See `coercePrisonerProposal` for the shared reasoning -- this is its
 *  wits-only half: `plan` REQUIRED (`plan[0]` invalid or missing rejects
 *  the whole call, the decision silence), `thoughts`/`notes` tolerated
 *  missing (defence in depth). `intent` is always `""`: the wits call is
 *  never asked for it (`roleMind.ts`'s own `WitsProposal` header explains
 *  why the field exists on the type at all). */
function coercePrisonerWitsProposal(raw: unknown, context: PrisonerContext): WitsProposal | null {
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

/** Configurable model roles: the VOICE call's own prompt -- "the same
 *  principal's own briefing plus the decision (the chosen move and
 *  thoughts)" (this task's brief, item 1), verbatim. Never the move list:
 *  voice does not choose (`roleMind.ts`'s `VoiceContext` carries no
 *  `moves` field at all, so there is structurally nothing here to offer a
 *  prompt-writing mistake). */
function buildPrisonerVoicePrompt(context: VoiceContext): string {
  const moveDescription = MOVE_DESCRIPTIONS[context.decision.choice] ?? "(no description on file)";
  return [
    `You are ${PRISONER_NAME}. The other person in the cell is ${WARDEN_NAME}.`,
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
    '"line" is REQUIRED -- one sentence spoken ALOUD to the other person, or an empty string ("") to ' +
      "stay silent this turn. The other person hears every word of it; keep secrets out of it.",
    "Speak only as yourself. Never write the other person's words, thoughts, or actions.",
  ].join("\n");
}

/**
 * `createPrisonerMind` = the package's `createLocalMind` with this game's
 * two pure functions (design §7.3). The base URL comes from THIS
 * repository's own environment variable (`PRISONER_MODEL_URL`, read by
 * `src/checkpoint.ts` -- never here, and never a raw default).
 *
 * Configurable model roles (this task's brief, item 1): `witsModel` and
 * `voiceModel` resolve against `model` when either is omitted. When they
 * end up EQUAL, this returns the single, unmodified `createLocalMind` call
 * this function has always made -- the exact same schema, prompt and
 * coercer object identities as before this task, so "one call per
 * half-round, no swapping, identical transcripts" is the untouched old code
 * path, not new code that happens to match it. Only when they differ does
 * this compose two calls through `composeRoleMind`.
 */
export function createPrisonerMind(options: CreatePrisonerMindOptions): PrisonerMind {
  const witsModel = options.witsModel ?? options.model;
  const voiceModel = options.voiceModel ?? options.model;
  if (!witsModel || !voiceModel) {
    throw new Error("createPrisonerMind: provide `model`, or both `witsModel` and `voiceModel`.");
  }

  if (witsModel === voiceModel) {
    return createLocalMind<PrisonerContext, PrisonerProposal>({
      baseUrl: options.baseUrl,
      model: witsModel,
      temperature: options.temperature,
      timeoutMs: options.timeoutMs,
      fetchFn: options.fetchFn,
      responseFormat: { jsonSchema: PRISONER_PROPOSAL_SCHEMA, name: "proposal" },
      prompt: buildPrisonerPrompt,
      coerce: coercePrisonerProposal,
      onSilence: options.onSilence,
    });
  }

  return composeRoleMind<PrisonerContext>(
    {
      baseUrl: options.baseUrl,
      witsModel,
      voiceModel,
      witsSchema: PRISONER_WITS_SCHEMA,
      voiceSchema: VOICE_PROPOSAL_SCHEMA,
      buildWitsPrompt: buildPrisonerWitsPrompt,
      buildVoicePrompt: buildPrisonerVoicePrompt,
      coerceWits: coercePrisonerWitsProposal,
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
  ) as PrisonerMind;
}
