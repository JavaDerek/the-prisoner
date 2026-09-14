import type { Mind, Proposal, SilenceReason, SilenceDetail } from "mind-seam";
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
 * (`loop.ts`'s `planNoteFor`). */
export type PrisonerProposal = Proposal & { readonly choice?: string; readonly plan?: readonly string[] };

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
    'Answer with one JSON object: {"intent": string, "line"?: string, "plan": string[]}.',
    '"intent" is what you are trying to do, in your own words.',
    '"line" is optional -- something you might say aloud.',
    '"plan" is REQUIRED -- a list of 1 to 6 of your possible moves, spelled exactly as given. The FIRST ' +
      "entry is what you do THIS turn. Use WAIT as the first entry to do nothing this turn. Any further " +
      "entries are what you now intend to do afterward, replacing whatever you intended before -- include " +
      "only as many as you are confident about.",
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

/**
 * `coercePrisonerProposal` (design §7.3, §7.5, P5; coordinator's fix): the
 * package's `coerceProposal` for `intent`/`line`, then `plan` REQUIRED --
 * `plan[0]` missing or invalid is the whole proposal rejected (silence);
 * `choice` is derived as `plan[0]`, never read from the raw answer
 * directly.
 */
export function coercePrisonerProposal(raw: unknown, context: PrisonerContext): PrisonerProposal | null {
  const base = coerceProposal(raw);
  if (base === null) return null;

  const record = raw as Record<string, unknown>;
  const plan = normalizePlan(record.plan, context.moves);
  if (!plan) return null;

  return { ...base, choice: plan[0], plan };
}

export interface CreatePrisonerMindOptions {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
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
   */
  onSilence?: (reason: SilenceReason, context: PrisonerContext, detail?: SilenceDetail) => void;
}

/**
 * `createPrisonerMind` = the package's `createLocalMind` with this game's
 * two pure functions (design §7.3). The base URL comes from THIS
 * repository's own environment variable (`PRISONER_MODEL_URL`, read by
 * `src/checkpoint.ts` -- never here, and never a raw default).
 *
 * `responseFormat: "json"` (`mind-seam@0.3.0`): sends
 * `response_format: { type: "json_object" }`, verified on doris (Ollama
 * 0.30.10) to return clean JSON from `ancient-awakening` -- most of the
 * first real runs' `"unparseable"` silences were this, not a genuinely
 * broken answer.
 */
export function createPrisonerMind(options: CreatePrisonerMindOptions): PrisonerMind {
  return createLocalMind<PrisonerContext, PrisonerProposal>({
    ...options,
    responseFormat: "json",
    prompt: buildPrisonerPrompt,
    coerce: coercePrisonerProposal,
  });
}
