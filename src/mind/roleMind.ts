// Configurable model roles (this task's brief, item 1): a principal's mind
// composed of two model calls, WITS and VOICE, both through mind-seam's own
// `createLocalMind` -- one seam, called twice, never a second kind of mind.
//
// WITS produces the decision: `thoughts`, `notes` and `plan` (`choice` =
// `plan[0]`, exactly as `prisonerMind.ts`/`wardenMind.ts` already derive it
// today). VOICE produces `intent` and `line` IN CHARACTER, given the wits
// call's own decision -- its context is this SAME principal's own briefing
// plus the decision (the chosen move and the wits call's `thoughts`), never
// the raw briefing again from scratch and never the other principal's
// context. It does not choose the move; `VoiceContext` carries no `moves`
// list at all, so there is nothing there for it to choose FROM.
//
// This module is used ONLY when wits and voice name different models.
// `prisonerMind.ts`/`wardenMind.ts` keep the ORIGINAL, unmodified single-
// call code path (one schema, one prompt, one `coerce`, byte-identical to
// before this task) for the default case -- witsModel === voiceModel, or
// only `PRISONER_MODEL`/`WARDEN_MODEL` given -- so "one call per half-round,
// no swapping, identical transcripts" is provably the OLD code running
// unchanged, not merely code that happens to behave the same today.
//
// GPU-safe swapping (`src/ollamaSwap.ts`) is deliberately NOT referenced
// here by name -- this module only knows an optional `ensureLoaded(model)`
// hook, called immediately before each sub-call's own request, OUTSIDE
// `createLocalMind`'s own fetchFn (see `timedFetch` below): a thrown swap
// error (the swapper's bounded-timeout case) must propagate out of
// `consider()` uncaught, because "never proceed with two models loaded" is
// a safety invariant, not an ordinary model silence that `onSilence` would
// quietly absorb. No test in this file or `ollamaSwap.test.ts` ever
// exercises the two together end to end for that reason; `checkpoint.ts` is
// the only real caller that supplies a real `ensureLoaded`.
import type { Mind, Proposal, InertRecord, Inert, SilenceReason, SilenceDetail } from "mind-seam";
import { createLocalMind } from "mind-seam";

export interface RoleContext extends InertRecord {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  readonly briefing: string;
  readonly moves: readonly string[];
}

/** The voice call's own context (this task's brief, item 1): "the same
 *  principal's own briefing plus the decision (the chosen move and
 *  thoughts)." No `moves` field -- voice never chooses, so there is nothing
 *  here to choose from; adding `moves` would be a plantable temptation for
 *  a prompt or a future change to let voice pick, which the brief forbids
 *  ("It does not change the move"). */
export interface VoiceContext extends InertRecord {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  readonly briefing: string;
  readonly decision: {
    readonly choice: string;
    readonly thoughts?: string;
  };
}

/** What the wits call alone produces. `intent` is a placeholder ("") the
 *  wits prompt never asks for and `combine` never reads -- it exists only
 *  because `mind-seam`'s own `Proposal` requires the field structurally
 *  (`Mind<C, P extends Proposal>`); the wits call's real output is
 *  `thoughts`/`notes`/`plan` (this task's brief, item 1). `choice` is
 *  derived from `plan[0]` by the caller's own `coerceWits`, the same
 *  convention `prisonerMind.ts`/`wardenMind.ts` already use for the
 *  single-call path. */
export type WitsProposal = Proposal & {
  readonly choice?: string;
  readonly plan?: readonly string[];
  readonly thoughts?: string;
  readonly notes?: string;
};

/** What the voice call alone produces -- exactly `mind-seam`'s own
 *  `Proposal` shape (`intent` required, `line` optional), so a caller's
 *  `coerceVoice` can simply be the package's own `coerceProposal`. */
export type VoiceProposal = Proposal;

/** Timing and provenance metadata `combine` receives alongside both raw
 *  sub-proposals, so a caller's `combine` can carry it onto the final
 *  proposal for the transcript (this task's brief, item 3: "show which
 *  model produced each part... per-call timings, and swap timings...
 *  separately"). `voiceMs`/`voiceSwapMs` are `undefined` when voice was
 *  never reached at all (impossible today -- voice always runs once wits
 *  succeeds) or, more precisely, present whenever the voice call was made,
 *  regardless of whether it then silenced. */
/** `voiceSilenceText`/`voiceSilenceParsed` are `mind-seam`'s own
 *  `SilenceDetail.text`/`.parsed`, flattened onto this object rather than
 *  nested as `SilenceDetail` itself: `SilenceDetail` is declared as an
 *  `interface` in the package (no implicit index signature), so a value of
 *  that exact type cannot flow into anything that must end up `Inert` --
 *  the same "declare contexts as `type`, never `interface`" discipline
 *  `mind-seam`'s own design doc (§3.1) states for a caller's context,
 *  applied here to a caller's proposal field instead. */
/** `"empty-line"` (coordinator's fix): the voice call SUCCEEDED -- it is
 *  not a `mind-seam` wire failure and `onVoiceSilence` never fires for it
 *  -- but the model chose (or defaulted to) an empty `line`. Recorded here
 *  so it shows up in the transcript's voice-silence counts exactly like a
 *  real failure, without being confused for one: the fix that keeps this
 *  rare is the voice prompt's own wording (`buildPrisonerVoicePrompt`/
 *  `buildWardenVoicePrompt`), not this bookkeeping. */
export type VoiceSilenceReason = SilenceReason | "empty-line";

export interface RoleCallMeta {
  witsMs: number;
  witsSwapMs?: number;
  voiceMs?: number;
  voiceSwapMs?: number;
  voiceSilenceReason?: VoiceSilenceReason;
  voiceSilenceText?: string;
  voiceSilenceParsed?: Inert;
}

export interface RoleMindOptions<C extends RoleContext> {
  baseUrl: string;
  witsModel: string;
  voiceModel: string;
  witsSchema: InertRecord;
  voiceSchema: InertRecord;
  buildWitsPrompt: (context: C) => string;
  buildVoicePrompt: (context: VoiceContext) => string;
  coerceWits: (raw: unknown, context: C) => WitsProposal | null;
  coerceVoice: (raw: unknown, context: VoiceContext) => VoiceProposal | null;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (see this file's header) -- absent in every test
   *  in this repository except `ollamaSwap.test.ts`'s own unit tests and
   *  the dedicated "propagates uncaught" test below. */
  ensureLoaded?: (model: string) => Promise<void>;
  onWitsSilence?: (reason: SilenceReason, context: C, detail?: SilenceDetail) => void;
  onVoiceSilence?: (reason: SilenceReason, context: VoiceContext, detail?: SilenceDetail) => void;
}

/** The voice call's own schema -- `intent`/`line`, both required, exactly
 *  `mind-seam`'s own `Proposal` shape and identical for both principals (it
 *  carries no game vocabulary at all), so `prisonerMind.ts`/`wardenMind.ts`
 *  both use this ONE object rather than each declaring their own copy. */
export const VOICE_PROPOSAL_SCHEMA: InertRecord = {
  type: "object",
  properties: {
    intent: { type: "string" },
    line: { type: "string" },
  },
  required: ["intent", "line"],
  additionalProperties: false,
};

function now(): number {
  return performance.now();
}

/** Wraps `baseFetch` so, immediately before the underlying HTTP request:
 *  `ensureLoaded(model)` runs (if supplied) and its own wall time is
 *  reported as `swapMs`; then the request itself runs and its wall time is
 *  reported as `callMs`. Both are reported via `onTiming` AFTER the
 *  request settles (success or failure) so a timed-out or failed call still
 *  contributes a real number, never a guess. `ensureLoaded` throwing is NOT
 *  caught here -- it propagates straight out of the returned function,
 *  which is exactly what makes it visible to `createLocalMind` as an
 *  uncaught rejection from `fetchFn`... except `createLocalMind` DOES catch
 *  fetch failures (that is its whole job, per `mind-seam`'s own design) and
 *  turn them into `SilenceReason: "unreachable"`. That would swallow a
 *  swap-timeout error into an ordinary silence, which is exactly the
 *  outcome this repository's CLAUDE.md forbids for a safety invariant --
 *  so `ensureLoaded` is called from `consider()` below, OUTSIDE this
 *  wrapper and outside `createLocalMind` entirely, and this wrapper only
 *  ever times the HTTP request itself. */
function timedFetch(baseFetch: typeof fetch, onTiming: (callMs: number) => void): typeof fetch {
  return (async (url, init) => {
    const start = now();
    try {
      return await baseFetch(url, init);
    } finally {
      onTiming(now() - start);
    }
  }) as typeof fetch;
}

/**
 * Composes two `createLocalMind` calls into one `Mind<C, RoleProposal>`:
 * WITS first (the decision); if it silences, the WHOLE turn silences
 * (`consider()` returns `null`, exactly like today's single call) --
 * VOICE is never reached. If wits succeeds, VOICE runs next, seeing only
 * this principal's own briefing plus the decision. If voice silences, the
 * turn still resolves: `combine` is called with `voice = null`, and it is
 * `combine`'s job (in `prisonerMind.ts`/`wardenMind.ts`) to fall back to an
 * empty `intent`/`line` and carry `voiceSilenceReason` onto the final
 * proposal -- a voice silence is never a decision silence.
 */
export function composeRoleMind<C extends RoleContext>(
  options: RoleMindOptions<C>,
  buildVoiceContext: (context: C, wits: WitsProposal) => VoiceContext,
  combine: (context: C, wits: WitsProposal, voice: VoiceProposal | null, meta: RoleCallMeta) => Proposal
): Mind<C, Proposal> {
  let witsCallMs = 0;
  const witsFetch = timedFetch(options.fetchFn ?? fetch, (ms) => {
    witsCallMs = ms;
  });
  const witsMind = createLocalMind<C, WitsProposal>({
    baseUrl: options.baseUrl,
    model: options.witsModel,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    fetchFn: witsFetch,
    responseFormat: { jsonSchema: options.witsSchema, name: "wits" },
    prompt: options.buildWitsPrompt,
    coerce: options.coerceWits,
    onSilence: options.onWitsSilence,
  });

  let voiceCallMs = 0;
  const voiceFetch = timedFetch(options.fetchFn ?? fetch, (ms) => {
    voiceCallMs = ms;
  });
  // A mutable object of flat, primitive-typed fields (never a nested
  // `SilenceDetail`, and never a reassigned bare `let`): read back right
  // after the single `await voiceMind.consider(...)` that could have set it
  // (single-threaded, so nothing else can have run in between -- the same
  // pattern `loop.ts`'s own `SilenceTracker` documents).
  const voiceSilence: { reason?: SilenceReason; text?: string; parsed?: Inert } = {};
  const voiceMind = createLocalMind<VoiceContext, VoiceProposal>({
    baseUrl: options.baseUrl,
    model: options.voiceModel,
    temperature: options.temperature,
    timeoutMs: options.timeoutMs,
    fetchFn: voiceFetch,
    responseFormat: { jsonSchema: options.voiceSchema, name: "voice" },
    prompt: options.buildVoicePrompt,
    coerce: options.coerceVoice,
    onSilence: (reason, context, detail) => {
      voiceSilence.reason = reason;
      voiceSilence.text = detail?.text;
      voiceSilence.parsed = detail?.parsed;
      options.onVoiceSilence?.(reason, context, detail);
    },
  });

  return {
    async consider(context: C): Promise<Proposal | null> {
      let witsSwapMs: number | undefined;
      if (options.ensureLoaded) {
        const swapStart = now();
        await options.ensureLoaded(options.witsModel);
        witsSwapMs = now() - swapStart;
      }
      const wits = await witsMind.consider(context);
      if (wits === null) return null; // decision silence -- reported exactly like today's single call.

      const voiceContext = buildVoiceContext(context, wits);
      voiceSilence.reason = undefined;
      voiceSilence.text = undefined;
      voiceSilence.parsed = undefined;
      let voiceSwapMs: number | undefined;
      if (options.ensureLoaded) {
        const swapStart = now();
        await options.ensureLoaded(options.voiceModel);
        voiceSwapMs = now() - swapStart;
      }
      const voice = await voiceMind.consider(voiceContext);
      // Coordinator's fix: the wire call can SUCCEED and still hand back an
      // empty (or missing) line -- not a `mind-seam` failure, so
      // `onVoiceSilence` never fires for it, but the transcript still needs
      // to count it as a voice that didn't do its job.
      const emptyLine = voice !== null && (!voice.line || voice.line.length === 0);

      return combine(context, wits, voice, {
        witsMs: witsCallMs,
        witsSwapMs,
        voiceMs: voiceCallMs,
        voiceSwapMs,
        voiceSilenceReason: voice === null ? voiceSilence.reason : emptyLine ? "empty-line" : undefined,
        voiceSilenceText: voice === null ? voiceSilence.text : undefined,
        voiceSilenceParsed: voice === null ? voiceSilence.parsed : undefined,
      });
    },
  };
}
