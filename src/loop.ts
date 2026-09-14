// The loop (design §6.1, P6 -- with the warden a model too, per this
// checkpoint's correction 1; P6's human CLI stays out of scope). One
// function, `runHalfRound`, used identically for both principals: decide
// who is asked -> build their own view -> consider() -> validate -> resolve
// -> record. The half-round clock is the caller's own hand
// (`world/clock.ts`); this module only ever resolves at whatever `t` it is
// told, never advances it itself.
//
// Silence is the wire's business to report and this module's business to
// COUNT (design §7.4): every failure from `mind.consider()` is `null`, and
// two CONSECUTIVE nulls for one principal turn the loop loud, naming the
// last `SilenceReason` the wire reported. The counter is per principal,
// because a principal's own silence history is what should decide when to
// say something, not a shared count that conflates two different endpoints
// (this checkpoint runs one endpoint for both, but the loop does not
// assume that).
import type { Mind, Proposal, SilenceReason } from "mind-seam";
import { ResolveProtocolError, ConstraintViolationError, type Resolver, type Outcome } from "run-dmcp";
import type { World } from "./world/setup.js";
import { recordSuccess, recordFailure, activeStepExpects, lastSuccessfulAttemptAtT, logRound, type Plan } from "./ledger/ledger.js";
import { declareCutIfJustCut, SEEN_BY_OTHER_AS } from "./world/mechanics.js";
import { describeInspection, describeObservation } from "./world/revelations.js";
import { resolutionDescription } from "./world/facts.js";

export type Principal = "warden" | "prisoner";

/** The shape `PrisonerContext` and `WardenContext` both structurally share
 *  -- this module is generic over either, never importing one over the
 *  other, because the loop treats both principals identically. */
export type PrincipalContext = {
  readonly principalId: string;
  readonly identity: string;
  readonly motive: string;
  readonly briefing: string;
  readonly moves: readonly string[];
};

export type PrincipalProposal = Proposal & { readonly choice?: string };

/** Per-principal silence history. Two consecutive `null`s make the loop
 *  loud; the counter resets to 0 the moment a real proposal is heard. */
export interface SilenceTracker {
  streak: number;
  lastReason: SilenceReason | undefined;
}

export function newSilenceTracker(): SilenceTracker {
  return { streak: 0, lastReason: undefined };
}

/** The loud threshold (design §7.4): the SECOND consecutive silence, not
 *  the first. */
export const LOUD_AFTER_CONSECUTIVE_SILENCES = 2;

export type HalfRoundOutcome =
  | { kind: "silent"; reason: SilenceReason | undefined; loud: boolean }
  | { kind: "no-choice"; proposal: PrincipalProposal }
  | { kind: "resolved"; proposal: PrincipalProposal; outcome: Outcome }
  | { kind: "refused"; proposal: PrincipalProposal; error: ResolveProtocolError | ConstraintViolationError };

export interface HalfRoundResult {
  principal: Principal;
  t: number;
  context: PrincipalContext;
  result: HalfRoundOutcome;
}

/**
 * Runs one principal's half-round at the clock's CURRENT `t` (the caller
 * has already moved it there -- see `world/clock.ts`'s `wardenT`/
 * `prisonerT`). Mutates `tracker` in place (the caller owns its lifetime
 * across rounds) and never advances the clock itself.
 */
/** Item 4's authored revelation for an info move's own successful
 *  resolution, or `undefined` for every other move (nothing to add: the
 *  base "you performed X" line already says what happened). Structural,
 *  literal-equality dispatch on a move name this repository itself
 *  defined -- not meaning inferred from prose (root CLAUDE.md hard rule
 *  4), the same shape `declareCutIfJustCut` already uses for `cut`. */
function revelationFor(world: World, plan: Plan, principal: Principal, move: string, t: number): string | undefined {
  if (principal === "prisoner" && move === "INSPECT") {
    const since = lastSuccessfulAttemptAtT(plan.id, "INSPECT") ?? world.clock.t0;
    return describeInspection(world, since, t);
  }
  if (principal === "warden" && move === "OBSERVE") {
    return describeObservation(world, t);
  }
  return undefined;
}

export async function runHalfRound<C extends PrincipalContext, P extends PrincipalProposal>(params: {
  world: World;
  resolver: Resolver;
  plan: Plan;
  principal: Principal;
  /** Item 8: the round number (1-5), consistent with the transcript --
   *  never the half-round clock `t`. */
  roundN: number;
  t: number;
  context: C;
  mind: Mind<C, P>;
  tracker: SilenceTracker;
}): Promise<HalfRoundResult> {
  const { world, resolver, plan, principal, roundN, t, context, mind, tracker } = params;

  const proposal = await mind.consider(context);

  if (proposal === null) {
    tracker.streak += 1;
    const loud = tracker.streak >= LOUD_AFTER_CONSECUTIVE_SILENCES;
    return { principal, t, context, result: { kind: "silent", reason: tracker.lastReason, loud } };
  }
  tracker.streak = 0;

  if (!proposal.choice) {
    return { principal, t, context, result: { kind: "no-choice", proposal } };
  }

  const expects = activeStepExpects(plan.id);
  try {
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: proposal.choice, expects });
    const note = revelationFor(world, plan, principal, proposal.choice, t);
    recordSuccess({ gameId: world.gameId, plan, t, roundN, move: proposal.choice, outcome, completesStep: true, note });
    declareCutIfJustCut(world, outcome);

    // Item 5: the two sides perceive each other. Logged for EVERY
    // successful resolution (this also closes a real gap: nothing wrote
    // round_log from the production loop before this, so a contradiction's
    // cause -- correction 2 -- could never actually be attributed during a
    // real game). `line` is relayed regardless of covertness (speech isn't
    // itself hidden); `seenByOtherAs` is null for a covert move and
    // contributes nothing (`mostRecentVisibleActFor`, ledger.ts).
    logRound({
      gameId: world.gameId,
      t,
      roundN,
      principal,
      mechanic: proposal.choice,
      description: resolutionDescription(outcome.eventId),
      line: proposal.line ?? null,
      seenByOtherAs: SEEN_BY_OTHER_AS[proposal.choice] ?? null,
    });

    return { principal, t, context, result: { kind: "resolved", proposal, outcome } };
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      recordFailure({ gameId: world.gameId, plan, t, roundN, move: proposal.choice, error: err });
      return { principal, t, context, result: { kind: "refused", proposal, error: err } };
    }
    throw err;
  }
}

/**
 * Records a `SilenceReason` against the tracker it belongs to -- called
 * from a mind's `onSilence` callback, so the tracker knows WHY the most
 * recent silence happened even though `mind.consider()` itself only ever
 * returns `null` (design §7.4: "the wire says why it was silent... so a
 * caller can decide what repeated silence means").
 */
export function noteSilenceReason(tracker: SilenceTracker, reason: SilenceReason): void {
  tracker.lastReason = reason;
}

/** The loud line itself (design §7.4) -- naming the endpoint and the last
 *  reason, never a guess at why beyond what the wire actually reported. */
export function loudSilenceMessage(principal: Principal, baseUrl: string, model: string, reason: SilenceReason | undefined, streak: number): string {
  return (
    `LOUD: the ${principal}'s endpoint (${baseUrl}, model ${model}) has been silent for ` +
    `${streak} consecutive half-rounds. Last reason: '${reason ?? "unknown"}'.`
  );
}
