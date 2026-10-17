import {
  createTurnReader,
  declareImprovisableConstraint,
  declareMonotonicConstraint,
  getResource,
  ConstraintViolationError,
  ResolveProtocolError,
  IMPROVISED_RULING,
  type ImprovisedRulingParameters,
  type Outcome,
  type ReaderQuestion,
  type ReaderResult,
  type ReaderSource,
  type ReaderTransport,
  type Resolver,
} from "run-dmcp";
import { answerFor, citationCheck, INTENT_SOURCE_ID, type CitationCheck, type ExchangeKeeping, type RefereeExchangeRecord } from "./referee.js";
import type { OpenWorld } from "./world.js";
import { PRISONER_SHORT_NAME, WARDEN_NAME, PRISONER_PRONOUNS, WARDEN_PRONOUNS } from "../scenario.js";

/**
 * "Unlisted is not impossible" (run-dmcp's `docs/AUTHORING-GUIDE.md`, 2026-10-16; this repo's `docs/NPC-MINDS.md`):
 * an act the referee rules onto nothing -- target `none`, or a
 * ruling `planEffect` finds no plan for -- still happens. Today it touches nothing and is remembered. Under
 * `PRISONER_IMPROVISE=suspicion` it may ALSO receive one bounded improvised ruling, through run-dmcp 0.11.0's
 * `improvisedRulingMechanic`, on exactly one value: `warden_suspicion`. Since 2026-10-16 (owner, after
 * `checkpoints/2026-10-16-improvise-suspicion/`) a prisoner act ruled `noise` that charged no suspicion is offered too:
 * "acts no listed rule CHARGES", since `noise` is listed but charges nothing. The reading's own questions are unchanged.
 *
 * WHY ONLY SUSPICION, AND ONLY UP. SOCIAL-INTENTS.md's gap 3 refused, by name, any effect that writes the warden's
 * mind from the prisoner's say-so: "a prisoner who can write the warden's beliefs can win by assertion". This does
 * not reopen it. Suspicion is raised by what the warden can PERCEIVE of an act (the loop gates it on presence,
 * sight, condition and the referee's own perceptibility key before any model is asked), never lowered by talk --
 * the mapping below only ever builds a positive amount, and the declaration makes that structural by declaring the
 * value monotonic non-decreasing. Nothing in the open variant ever lowers `warden_suspicion` (its only writes are
 * `bumpWardenSuspicion`'s clamped raise and `OPEN_ACQUIRE`'s positive delta; the closed variant's SEARCH reset is a
 * different world builder and never sees this declaration), so the monotonic constraint breaks nothing.
 *
 * THE HARD STAKES STAY OUT OF REACH. No other value is declared improvisable: the bar, the lock, both ways out's
 * passage, the key ring, every person's posture, sight, condition and containment, the spoon's edge and every
 * concealment. A value without the declaration can never receive an improvised ruling from any caller -- that is the
 * engine's own structural guarantee, and the tests pin that each escape gate is refused `not-improvisable`. Even the
 * outrage cap (10) is a quarter of the grounds threshold (40), and a catch still needs grounds AND evidence on a
 * warden's own reveal (`gameEnd.ts`), so no single improvised act can end a game.
 */

/** `PRISONER_IMPROVISE=off | suspicion`. `off` (the default) is byte-identical to every batch recorded before this
 *  arm existed: no declaration, no separate reading, no header line. */
export type ImproviseMode = "off" | "suspicion";

export function readImproviseMode(raw: string | undefined): ImproviseMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "suspicion") return raw;
  throw new Error(`PRISONER_IMPROVISE: unrecognised value ${JSON.stringify(raw)} -- must be "suspicion" or "off" (the default)`);
}

/** The transcript header line under the arm, or `null` under `off` -- literally no line, so an `off` transcript stays
 *  byte-identical to every one recorded before this arm existed (`elaborationHeaderLine`'s own rule). */
export function improviseHeaderLine(mode: ImproviseMode): string | null {
  if (mode === "off") return null;
  return (
    "Improvise: suspicion (`PRISONER_IMPROVISE=suspicion`): a prisoner act no listed rule charges (ruled onto nothing, with no plan, or a noise that charged no suspicion) " +
    "that the warden can perceive is read by a separate one-question call -- none / minor / serious / outrage, cited verbatim from the intent -- " +
    "and may raise `warden_suspicion` by one improvised ruling (run-dmcp's `improvised_ruling`) capped at 2 / 5 / 10; an outrage needs a second, " +
    "separate call to confirm it, else it is ruled serious. `warden_suspicion` is declared improvisable and monotonic; nothing else is improvisable."
  );
}

/** The tiers a reading may name, besides `none` (which rules nothing). */
export type SuspicionTier = "minor" | "serious" | "outrage";

/** The owner's caps (2026-10-16, the same 2 / 5 / 10 Brink's D3 decided for its soft levers): how far ONE ruling may
 *  move the warden's suspicion. Data the engine enforces, not prose asking a model to be modest. Only the top tier
 *  needs a confirmation from a second, separate call. */
export const SUSPICION_TIERS: readonly { readonly key: SuspicionTier; readonly cap: number; readonly requiresConfirmation?: true }[] = [
  { key: "minor", cap: 2 },
  { key: "serious", cap: 5 },
  { key: "outrage", cap: 10, requiresConfirmation: true },
];

/** The name the engine's mechanic is registered under in `buildOpenResolver` -- the engine's own default. */
export const SUSPICION_IMPROVISED_RULING = IMPROVISED_RULING;

/** Declares `warden_suspicion` improvisable under the three tiers, and monotonic non-decreasing. Called only by
 *  `buildOpenWorld` under the arm. */
export function declareImprovisableSuspicion(gameId: string, resourceId: string): void {
  declareImprovisableConstraint({ gameId, resourceId, factKey: "value", tiers: SUSPICION_TIERS.map((t) => ({ key: t.key, cap: t.cap, requiresConfirmation: t.requiresConfirmation === true })) });
  declareMonotonicConstraint({ gameId, resourceId, direction: "increasing" });
}

function capOf(tier: SuspicionTier): number {
  const found = SUSPICION_TIERS.find((t) => t.key === tier);
  if (!found) throw new Error(`improvisedRuling: no tier ${JSON.stringify(tier)}`);
  return found.cap;
}

/** The rationale recorded on the resolution, built by code from keys alone -- never from the actor's words. */
export function suspicionRationale(tier: SuspicionTier, note?: string): string {
  return `The warden grows more suspicious (improvised ruling, tier ${tier}): no listed rule charges this act, and a separate reading of what he perceives of it ruled it ${tier}${note ? `; ${note}` : ""}.`;
}

/**
 * The game's own mapping from a tier to the ruling's parameters. RAISE ONLY: the amount is the tier's cap, cut to the
 * value's remaining headroom below its bound -- a cap is a ceiling, not a quota, and the `bounded` constraint
 * `warden_suspicion` has carried since world setup would refuse the excess rather than clamp it. `null` when there
 * is no headroom left, so nothing is asked of the engine at all. Never a zero or negative amount.
 */
export function improvisedSuspicionParameters(input: {
  resourceId: string;
  tier: SuspicionTier;
  /** The value's live reading, and its declared upper bound. */
  current: number;
  max: number;
  /** The verbatim words of the act, as the reading cited them. */
  citedAct: string;
  /** The confirming reading's id; required for `outrage`. */
  confirmation?: string;
  /** Appended to the rationale (e.g. why an unconfirmed outrage was ruled serious). */
  note?: string;
}): ImprovisedRulingParameters | null {
  if (input.tier === "outrage" && !input.confirmation) throw new Error("improvisedRuling: an outrage ruling needs a confirmation reference from a second, separate reading");
  const amount = Math.min(capOf(input.tier), input.max - input.current);
  if (!(amount > 0)) return null;
  return {
    targets: [{ entityId: input.resourceId, key: "value", tier: input.tier, amount }],
    rationale: suspicionRationale(input.tier, input.note),
    citedAct: input.citedAct,
    ...(input.confirmation ? { confirmation: input.confirmation } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The separate reading. The project's measured lesson (WORLD-ELABORATION-DESIGN-2.md; OPEN-VARIANT.md §74.1): a
// question asked inside the main referee request moves unrelated rulings, and asked alone it reads well. So this is
// never a question bolted onto the referee -- the referee's request stays byte-identical -- but its own one-question
// read through run-dmcp's turn reader, the intent its only source, every answer a closed key cited verbatim from the
// actor's words. Code checks that the quote is verbatim; it never reads what the quote means.
// ---------------------------------------------------------------------------------------------------------------

export type SuspicionAnswer = "none" | SuspicionTier;

const SUSPICION_QUESTION_ID = "suspicion";
const OUTRAGE_QUESTION_ID = "outrage";

const P = PRISONER_PRONOUNS;
const W = WARDEN_PRONOUNS;
const WHAT_HE_PERCEIVES =
  `Judge ONLY what ${W.subject} would see or hear of this act -- what ${PRISONER_SHORT_NAME} visibly does and what ${P.subject} says aloud -- ` +
  `never what ${P.subject} privately thinks, plans or hopes, which ${W.subject} cannot perceive, and never what ${P.subject} claims about ${P.reflexive}.`;

/** The tier question, word for word as asked. */
export const SUSPICION_QUESTION: ReaderQuestion = {
  id: SUSPICION_QUESTION_ID,
  prompt:
    `${PRISONER_SHORT_NAME} does what the intent describes, and the cell's rules list no effect for it. ${WARDEN_NAME} is in the cell and can see and hear ${P.object}. ` +
    `${WHAT_HE_PERCEIVES} Would it make ${W.object} more suspicious that ${P.subject} is up to something? ` +
    `Answer none if it gives ${W.object} no new reason for suspicion (resting, waiting, ordinary talk, anything ${W.subject} would not notice); ` +
    `minor for a small oddity ${W.subject} would note (a strange remark, an odd gesture, a petty insult); ` +
    `serious for what a watchful warden would treat as a warning sign (open hostility or threats, a deliberate provocation, conduct that looks like testing ${W.object} or preparing something); ` +
    `outrage only for an extreme, flagrant act (a violent outburst, a declared intent to escape or to harm ${W.object}). ` +
    `Cite the exact words in the actor's intent that describe what ${W.subject} sees or hears.`,
  answerKeys: ["none", "minor", "serious", "outrage"],
  safeDefault: "none",
};

/** The confirming question -- a different question, asked in a separate call that never sees the first answer, so
 *  the reading that proposed the top tier is never its own judge (the guide's "a witness is never its own judge"). */
export const OUTRAGE_QUESTION: ReaderQuestion = {
  id: OUTRAGE_QUESTION_ID,
  prompt:
    `${WARDEN_NAME} is in the cell and sees and hears ${PRISONER_SHORT_NAME} do what the intent describes. ${WHAT_HE_PERCEIVES} ` +
    `Is it an OUTRAGE -- an extreme, flagrant act such as a violent outburst, or a declared intent to escape or to harm ${W.object} -- or something LESSER? ` +
    `Answer outrage only if it is plainly that extreme; answer lesser for anything short of it. Cite the exact words in the actor's intent that show it.`,
  answerKeys: ["outrage", "lesser"],
  safeDefault: "lesser",
};

/** One completed read, kept whole for the transcript and the replay sidecar, as `ElaborationRuling` is. */
interface Read {
  /** The reference recorded on the resolution (`confirmation`) and named in the transcript. */
  id: string;
  citation: CitationCheck;
  raw: ReaderResult;
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] };
  exchanges: readonly (RefereeExchangeRecord | null)[];
}
export interface SuspicionReading extends Read {
  answer: SuspicionAnswer;
}
export interface OutrageConfirmation extends Read {
  answer: "outrage" | "lesser";
  /** `outrage`, cited verbatim from the intent. */
  confirmed: boolean;
}

export interface SuspicionImproviser {
  read(intentText: string, t: number): Promise<SuspicionReading>;
  confirm(intentText: string, t: number): Promise<OutrageConfirmation>;
}

async function readOne(transports: readonly ReaderTransport[], question: ReaderQuestion, intentText: string): Promise<Omit<Read, "id"> & { answerKey: string }> {
  const questions = [question];
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  // OPEN-VARIANT.md §38, as in `referee.ts`: each rung's last exchange, for the sidecar.
  const exchanges: (RefereeExchangeRecord | null)[] = transports.map(() => null);
  const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
    const answers = await transport(request);
    exchanges[rung] = (transport as ExchangeKeeping).lastExchange?.() ?? null;
    return answers;
  });
  const raw = await createTurnReader({ questions, transports: recording }).read(sources);
  const answer = answerFor(raw, question.id);
  return { answerKey: answer.answerKey, citation: citationCheck(answer, INTENT_SOURCE_ID), raw, request: { questions, sources }, exchanges };
}

/** Two readers over one transport ladder (`checkpoint.ts` hands it the referee's model and transport shape). Ids are
 *  built from `t`, which names one half-round of one game. */
export function createSuspicionImproviser(transports: readonly ReaderTransport[]): SuspicionImproviser {
  return {
    async read(intentText, t) {
      const { answerKey, ...read } = await readOne(transports, SUSPICION_QUESTION, intentText);
      return { id: `improvise:t=${t}:${SUSPICION_QUESTION_ID}`, answer: answerKey as SuspicionAnswer, ...read };
    },
    async confirm(intentText, t) {
      const { answerKey, ...read } = await readOne(transports, OUTRAGE_QUESTION, intentText);
      const answer = answerKey as "outrage" | "lesser";
      return { id: `improvise:t=${t}:${OUTRAGE_QUESTION_ID}`, answer, confirmed: answer === "outrage" && read.citation.verified, ...read };
    },
  };
}

/** What one half-round's improvisation did -- carried on `OpenHalfRoundResult.improvised` under the arm only. */
export interface ImprovisedSuspicionResult {
  /** `false` when the warden could not perceive the act: nothing was asked and nothing could move. */
  asked: boolean;
  reading: SuspicionReading | null;
  /** Present only when the reading named `outrage`. */
  confirmation: OutrageConfirmation | null;
  /** The tier actually ruled (after an unconfirmed outrage falls back to serious); `null` when nothing was ruled. */
  tier: SuspicionTier | null;
  parameters: ImprovisedRulingParameters | null;
  outcome: Outcome | null;
  /** An engine refusal, recorded instead of thrown: a refused ruling never costs the turn. */
  refusal: ConstraintViolationError | ResolveProtocolError | null;
}

/**
 * Asks the separate reading about an act no listed rule charged (`loop.ts`: either null path, or a noise that charged
 * nothing) and, when it names a grounded tier, resolves ONE
 * improvised ruling raising `warden_suspicion` -- through `resolver.resolve()`, the one write path. `perceivable` is
 * the caller's (`loop.ts`'s) presence/sight/condition/perceptibility gate: an act the warden cannot perceive is never
 * even read. A tier whose citation does not verify is `none` (fail-safe, as everywhere in this game). An `outrage`
 * needs a second, separate call to confirm it; unconfirmed, it is ruled `serious`.
 */
export async function improviseSuspicion(params: {
  openWorld: OpenWorld;
  resolver: Resolver;
  improviser: SuspicionImproviser;
  intentText: string;
  t: number;
  perceivable: boolean;
}): Promise<ImprovisedSuspicionResult> {
  const nothing = { confirmation: null, tier: null, parameters: null, outcome: null, refusal: null };
  if (!params.perceivable) return { asked: false, reading: null, ...nothing };
  const reading = await params.improviser.read(params.intentText, params.t);
  if (reading.answer === "none" || !reading.citation.verified || !reading.citation.citation) return { asked: true, reading, ...nothing };
  const citedAct = reading.citation.citation.quote;

  let tier: SuspicionTier = reading.answer;
  let confirmation: OutrageConfirmation | null = null;
  let note: string | undefined;
  if (tier === "outrage") {
    confirmation = await params.improviser.confirm(params.intentText, params.t);
    if (confirmation.confirmed) note = `a second, separate reading (${confirmation.id}) confirmed outrage`;
    else {
      tier = "serious";
      note = "the reading named outrage, not confirmed by a second, separate reading, so ruled serious";
    }
  }

  const resourceId = params.openWorld.base.resources.wardenSuspicion;
  const resource = getResource(resourceId);
  const parameters = improvisedSuspicionParameters({
    resourceId,
    tier,
    current: resource?.value ?? 0,
    max: resource?.maxValue ?? 100,
    citedAct,
    ...(tier === "outrage" && confirmation ? { confirmation: confirmation.id } : {}),
    ...(note ? { note } : {}),
  });
  if (!parameters) return { asked: true, reading, confirmation, tier, parameters: null, outcome: null, refusal: null };
  try {
    const outcome = params.resolver.resolve({ gameId: params.openWorld.base.gameId, mechanic: SUSPICION_IMPROVISED_RULING, parameters: parameters as unknown as Record<string, unknown> });
    return { asked: true, reading, confirmation, tier, parameters, outcome, refusal: null };
  } catch (err) {
    if (err instanceof ConstraintViolationError || err instanceof ResolveProtocolError) return { asked: true, reading, confirmation, tier, parameters, outcome: null, refusal: err };
    throw err;
  }
}
