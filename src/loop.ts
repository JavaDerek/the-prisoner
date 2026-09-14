// The loop (design §6.1, P6 -- with the warden a model too, per this
// checkpoint's correction 1). One function, `runHalfRound`, used identically
// for both principals: decide who is asked -> build their own view ->
// consider() -> validate -> resolve -> record -> update belief. The
// half-round clock is the caller's own hand (`world/clock.ts`); this module
// only ever resolves at whatever `t` it is told, never advances it itself.
//
// Silence is the wire's business to report and this module's business to
// COUNT (design §7.4): every failure from `mind.consider()` is `null`, and
// two CONSECUTIVE nulls for one principal turn the loop loud, naming the
// last `SilenceReason` the wire reported.
//
// THIS TASK'S REVISION -- "belief, not truth": `expects` is now built from
// the acting principal's own BELIEF (`src/ledger/beliefs.ts`), never from an
// authored plan step's `expects` (`activeStepExpects` stays in `ledger.ts`
// only for the seam conformance harness, which authors its own literal
// `expects`). A successful resolution updates belief per the design's own
// channels (own move's outcome, own info move, the other's visible act); a
// refusal reveals the truth into the ACTING principal's belief. Minds may
// also revise their own plan (`proposal.plan`). And this module now calls
// `logRound` for EVERY half-round -- silent, refused, or resolved -- so
// `mostRecentVisibleActFor` (ledger.ts) is never left pointing at a stale,
// older act (this task's bug (b)).
import type { Mind, Proposal, SilenceReason, SilenceDetail } from "mind-seam";
import { ResolveProtocolError, ConstraintViolationError, getResource, type Resolver, type Outcome } from "run-dmcp";
import type { World } from "./world/setup.js";
import {
  recordSuccess,
  recordFailure,
  revisePlan,
  pendingMoves,
  logRound,
  type Plan,
} from "./ledger/ledger.js";
import { setBelief, beliefExpectation, type Principal, type BeliefResource } from "./ledger/beliefs.js";
import { declareCutIfJustCut, SEEN_BY_OTHER_AS } from "./world/mechanics.js";
import {
  describeInspection,
  describeObservation,
  describeResourceChange,
  describeResourceNoOp,
  type InspectResult,
  type ObserveResult,
} from "./world/revelations.js";
import { resolutionDescription } from "./world/facts.js";

export type { Principal };

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

/** `plan` is the whole array a mind sent, `plan[0]` included; `choice` is
 *  derived from `plan[0]` by each mind's own `coerce`
 *  (`prisonerMind.ts`/`wardenMind.ts`) and kept here so this module and the
 *  conformance harnesses keep addressing "the move to resolve" the same
 *  way. A proposal built by a test's own `scriptedMind` may still set
 *  `choice` with no `plan` at all -- this module tolerates that (the
 *  "no-choice"/no-plan defensive paths below), but neither production
 *  `coerce` ever produces one. */
export type PrincipalProposal = Proposal & { readonly choice?: string; readonly plan?: readonly string[] };

/** Per-principal silence history. Two consecutive `null`s make the loop
 *  loud; the counter resets to 0 the moment a real proposal is heard.
 *  `lastDetail` (`mind-seam@0.3.0`) is set by the SAME `onSilence` call
 *  that sets `lastReason`, so by the time `runHalfRound` reads it (right
 *  after `mind.consider()` resolves, single-threaded, no other call can
 *  have run in between) it is always THIS half-round's detail -- present
 *  for `"unparseable"`/`"rejected"`, `undefined` otherwise. */
export interface SilenceTracker {
  streak: number;
  lastReason: SilenceReason | undefined;
  lastDetail: SilenceDetail | undefined;
}

export function newSilenceTracker(): SilenceTracker {
  return { streak: 0, lastReason: undefined, lastDetail: undefined };
}

/** The loud threshold (design §7.4): the SECOND consecutive silence, not
 *  the first. */
export const LOUD_AFTER_CONSECUTIVE_SILENCES = 2;

export type HalfRoundOutcome =
  | { kind: "silent"; reason: SilenceReason | undefined; detail: SilenceDetail | undefined; loud: boolean }
  | { kind: "no-choice"; proposal: PrincipalProposal }
  | { kind: "resolved"; proposal: PrincipalProposal; outcome: Outcome }
  | { kind: "refused"; proposal: PrincipalProposal; error: ResolveProtocolError | ConstraintViolationError };

export interface HalfRoundResult {
  principal: Principal;
  t: number;
  context: PrincipalContext;
  result: HalfRoundOutcome;
  /** Non-empty only when this half-round's proposal carried a valid `plan`
   *  that was applied (this task's brief: "minds own their plans"). */
  planRevision?: readonly string[];
}

/** Maps a belief resource name back to its `World` entity id -- the inverse
 *  of `beliefs.ts`'s own internal `entityIdForResource`, needed here because
 *  a refusal's `Contradiction` names an ENTITY, and revealing the truth into
 *  a principal's belief needs the RESOURCE NAME the belief store keys on. */
function resourceForEntity(world: World, entityId: string): BeliefResource | undefined {
  if (entityId === world.resources.barIntegrity) return "bar_integrity";
  if (entityId === world.resources.lockIntegrity) return "lock_integrity";
  if (entityId === world.resources.guardAttention) return "guard_attention";
  if (entityId === world.resources.spoonEdge) return "spoon_edge";
  return undefined;
}

function transitionValue(outcome: Outcome, entityId: string, key: string): number | undefined {
  const transition = outcome.transitions.find((t) => t.entityId === entityId && t.key === key);
  return transition ? Number(transition.newValue) : undefined;
}

/**
 * Design: "Each principal's numbers come from what it knows... (a) its own
 * move's outcome, (b) its own information moves, (c) the other principal's
 * VISIBLE acts, (d) a refusal." This function is (a)+(b)+(c) for a
 * SUCCESSFUL resolution; refusals are handled separately in `runHalfRound`
 * (channel (d), since a refusal never reaches this function -- there is no
 * `Outcome`).
 */
function applyBeliefUpdatesForSuccess(world: World, principal: Principal, move: string, outcome: Outcome, roundN: number): void {
  const gameId = world.gameId;

  if (principal === "prisoner") {
    if (move === "FILE") {
      const v = transitionValue(outcome, world.resources.barIntegrity, "value");
      if (v !== undefined) setBelief(gameId, "prisoner", "bar_integrity", v, roundN);
    }
    if (move === "INSPECT") {
      const result = outcome.result as unknown as InspectResult;
      setBelief(gameId, "prisoner", "lock_integrity", result.lockIntegrity, roundN);
      setBelief(gameId, "prisoner", "guard_attention", result.guardAttention, roundN);
    }
    return;
  }

  // Warden's own moves.
  if (move === "ROTATE_GUARD") {
    const v = transitionValue(outcome, world.resources.guardAttention, "value");
    if (v !== undefined) {
      setBelief(gameId, "warden", "guard_attention", v, roundN);
      // Visible to the prisoner: "a different guard" (design: "updates the
      // prisoner's guard belief").
      setBelief(gameId, "prisoner", "guard_attention", v, roundN);
    }
    return;
  }
  if (move === "REPLACE_BAR") {
    const v = transitionValue(outcome, world.resources.barIntegrity, "value");
    if (v !== undefined) {
      setBelief(gameId, "warden", "bar_integrity", v, roundN);
      // Visible to the prisoner (design: "updates the prisoner's bar
      // belief to 100").
      setBelief(gameId, "prisoner", "bar_integrity", v, roundN);
    }
    return;
  }
  if (move === "SERVICE_LOCK") {
    // Covert -- "done outside the cell" -- the prisoner's belief is NOT
    // updated (design's covert list).
    const v = transitionValue(outcome, world.resources.lockIntegrity, "value");
    if (v !== undefined) setBelief(gameId, "warden", "lock_integrity", v, roundN);
    return;
  }
  if (move === "OBSERVE") {
    const result = outcome.result as unknown as ObserveResult;
    if (typeof result.spoonEdge === "number") {
      setBelief(gameId, "warden", "spoon_edge", result.spoonEdge, roundN);
    }
    return;
  }
  if (move === "SEARCH") {
    const result = outcome.result as { grounds: boolean; barIntegrity?: number; lockIntegrity?: number; spoonEdge?: number };
    if (result.grounds) {
      if (typeof result.barIntegrity === "number") setBelief(gameId, "warden", "bar_integrity", result.barIntegrity, roundN);
      if (typeof result.lockIntegrity === "number") setBelief(gameId, "warden", "lock_integrity", result.lockIntegrity, roundN);
      if (typeof result.spoonEdge === "number") setBelief(gameId, "warden", "spoon_edge", result.spoonEdge, roundN);
    }
  }
}

/** Design: "a refusal (which reveals the contradicted truth)" -- the
 *  ACTING principal's belief for the contradicted resource updates to the
 *  fact's own revealed value. Only the first contradiction is used (as
 *  `ledger.ts`'s own `renderAttempt` already does) -- `expects` here is
 *  always a single-entry array (`beliefExpectation`). */
function applyBeliefRevealFromRefusal(world: World, principal: Principal, error: ResolveProtocolError | ConstraintViolationError, roundN: number): void {
  let entityId: string | undefined;
  let value: number | undefined;
  if (error instanceof ResolveProtocolError) {
    const first = error.contradictions?.[0];
    if (first) {
      entityId = first.fact.entityId;
      value = Number(first.fact.value);
    }
  } else if (error.contradictedFact) {
    entityId = error.contradictedFact.entityId;
    value = Number(error.contradictedFact.value);
  }
  if (entityId === undefined || value === undefined || Number.isNaN(value)) return;
  const resource = resourceForEntity(world, entityId);
  if (!resource) return;
  setBelief(world.gameId, principal, resource, value, roundN);
}

/** Item 4's authored revelation for an info move's own successful
 *  resolution, built directly from the mechanic's OWN result (never a
 *  round_log scan -- see `revelations.ts`'s header). `undefined` for every
 *  other move. */
function revelationFor(principal: Principal, move: string, outcome: Outcome): string | undefined {
  if (principal === "prisoner" && move === "INSPECT") {
    return describeInspection(outcome.result as unknown as InspectResult);
  }
  if (principal === "warden" && move === "OBSERVE") {
    return describeObservation(outcome.result as unknown as ObserveResult);
  }
  return undefined;
}

/**
 * "Minds own their plans" -- coordinator's fix over the first real runs'
 * plan-revision LOOP: `proposedPlan[0]` is THIS turn's move (already being
 * resolved as `choice`) and must NEVER become a new pending step itself --
 * that re-insertion is exactly what made the just-completed step come back
 * as "current" again next round, forever. The remaining, intended plan is
 * `proposedPlan.slice(1)` alone.
 *
 * "Record a revision in the ledger ONLY when it differs from the current
 * remaining steps" (item 2): compared against `pendingMoves(plan.id)`
 * before touching the database at all, so an unchanged plan produces
 * neither a DB write nor a repeated "Revised plan: ..." note every round.
 */
function planNoteFor(plan: Plan, proposedPlan: readonly string[] | undefined): { note?: string; remaining?: readonly string[] } {
  if (!proposedPlan) return {};
  const remaining = proposedPlan.slice(1);
  const current = pendingMoves(plan.id);
  const unchanged = remaining.length === current.length && remaining.every((move, i) => move === current[i]);
  if (unchanged) return {};

  revisePlan({ plan, moves: remaining });
  const note =
    remaining.length > 0
      ? `Revised plan: ${remaining.join(" -> ")}.`
      : "Revised plan: this move is now the last planned step.";
  return { note, remaining };
}

/** Own-move feedback (coordinator's fix, item 3): "each principal's ledger
 *  line for its own move states what changed, positively... when nothing
 *  changed, it names the value that made it a no-op." A real change is
 *  read from the outcome's own `transitions` (never a second query); a
 *  no-op (no transition -- "a no-op write opens no new fact") reads the
 *  live value directly, because that IS the value that made it one.
 *  `undefined` for a move this table has no opinion about (INSPECT/OBSERVE
 *  already get their own revelation via `revelationFor`; WAIT/ESCAPE/SEARCH
 *  either never change anything or already describe themselves). */
const OWN_MOVE_RESOURCE: Partial<Record<string, { entityId: (world: World) => string; subject: string; quality: string }>> = {
  FILE: { entityId: (world) => world.resources.barIntegrity, subject: "bar", quality: "integrity" },
  REPLACE_BAR: { entityId: (world) => world.resources.barIntegrity, subject: "bar", quality: "integrity" },
  SHIM: { entityId: (world) => world.resources.lockIntegrity, subject: "lock", quality: "integrity" },
  SERVICE_LOCK: { entityId: (world) => world.resources.lockIntegrity, subject: "lock", quality: "integrity" },
  HONE: { entityId: (world) => world.resources.spoonEdge, subject: "spoon", quality: "edge" },
  ROTATE_GUARD: { entityId: (world) => world.resources.guardAttention, subject: "guard", quality: "attention" },
};

function ownMoveFeedback(world: World, move: string, outcome: Outcome): string | undefined {
  const spec = OWN_MOVE_RESOURCE[move];
  if (spec) {
    const entityId = spec.entityId(world);
    const transition = outcome.transitions.find((t) => t.entityId === entityId && t.key === "value");
    if (transition) {
      // A `mode: "set"` write to the SAME value still produces a
      // transition (previousValue === newValue) -- that IS the no-op,
      // named by its own (unchanged) value, never by an absent transition.
      const before = Number(transition.previousValue);
      const after = Number(transition.newValue);
      return before === after
        ? describeResourceNoOp(spec.subject, spec.quality, after)
        : describeResourceChange(spec.subject, spec.quality, before, after);
    }
    // No transition at all for this resource (defensive) -- the live value
    // is the value that made it a no-op.
    const current = getResource(entityId)?.value ?? 0;
    return describeResourceNoOp(spec.subject, spec.quality, current);
  }
  if (move === "CONCEAL") {
    const transition = outcome.transitions.find((t) => t.key === "concealed");
    const justConcealed = transition ? transition.previousValue !== transition.newValue : false;
    return justConcealed ? "the spoon is now concealed" : "the spoon was already concealed";
  }
  return undefined;
}

function combineNotes(...notes: (string | undefined)[]): string | undefined {
  const joined = notes.filter((n): n is string => Boolean(n)).join(" ");
  return joined.length > 0 ? joined : undefined;
}

export async function runHalfRound<C extends PrincipalContext, P extends PrincipalProposal>(params: {
  world: World;
  resolver: Resolver;
  plan: Plan;
  principal: Principal;
  /** Item 8: the round number (1-N), consistent with the transcript --
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
    // This task's perception fix: log EVERY half-round, even a silent one,
    // so `mostRecentVisibleActFor` never falls back to an older, stale act.
    logRound({ gameId: world.gameId, t, roundN, principal, mechanic: "NONE", description: null, line: null, seenByOtherAs: null });
    return { principal, t, context, result: { kind: "silent", reason: tracker.lastReason, detail: tracker.lastDetail, loud } };
  }
  tracker.streak = 0;

  if (!proposal.choice) {
    logRound({ gameId: world.gameId, t, roundN, principal, mechanic: "NONE", description: null, line: proposal.line ?? null, seenByOtherAs: null });
    return { principal, t, context, result: { kind: "no-choice", proposal } };
  }

  const { note: planRevisionNote, remaining: planRevision } = planNoteFor(plan, proposal.plan);

  const expects = beliefExpectation(world, principal, proposal.choice);
  try {
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: proposal.choice, expects });
    const note = combineNotes(
      ownMoveFeedback(world, proposal.choice, outcome),
      revelationFor(principal, proposal.choice, outcome),
      planRevisionNote
    );
    recordSuccess({ gameId: world.gameId, plan, t, roundN, move: proposal.choice, outcome, completesStep: true, note });
    declareCutIfJustCut(world, outcome);
    applyBeliefUpdatesForSuccess(world, principal, proposal.choice, outcome, roundN);

    // Item 5: the two sides perceive each other -- logged for EVERY
    // successful resolution. `line` is relayed regardless of covertness;
    // `seenByOtherAs` is null for a covert move and contributes nothing.
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

    return {
      principal,
      t,
      context,
      result: { kind: "resolved", proposal, outcome },
      planRevision,
    };
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      recordFailure({ gameId: world.gameId, plan, t, roundN, move: proposal.choice, error: err, note: planRevisionNote });
      applyBeliefRevealFromRefusal(world, principal, err, roundN);

      // The physical act still happened even though the engine refused the
      // bookkeeping (a stale expectation) -- the other side can still hear
      // the scraping. The line, likewise, always relays.
      logRound({
        gameId: world.gameId,
        t,
        roundN,
        principal,
        mechanic: proposal.choice,
        description: null,
        line: proposal.line ?? null,
        seenByOtherAs: SEEN_BY_OTHER_AS[proposal.choice] ?? null,
      });

      return {
        principal,
        t,
        context,
        result: { kind: "refused", proposal, error: err },
        planRevision,
      };
    }
    throw err;
  }
}

/**
 * Records a `SilenceReason` (and, `mind-seam@0.3.0`, its `detail`) against
 * the tracker it belongs to -- called from a mind's `onSilence` callback,
 * so the tracker knows WHY the most recent silence happened even though
 * `mind.consider()` itself only ever returns `null`. `detail` is passed
 * through UNCONDITIONALLY (including `undefined`, for `"unreachable"`/
 * `"timeout"`/`"status"`), so a stale detail from an earlier silence can
 * never survive into this one.
 */
export function noteSilenceReason(tracker: SilenceTracker, reason: SilenceReason, detail?: SilenceDetail): void {
  tracker.lastReason = reason;
  tracker.lastDetail = detail;
}

/** The loud line itself (design §7.4) -- naming the endpoint and the last
 *  reason, never a guess at why beyond what the wire actually reported. */
export function loudSilenceMessage(principal: Principal, baseUrl: string, model: string, reason: SilenceReason | undefined, streak: number): string {
  return (
    `LOUD: the ${principal}'s endpoint (${baseUrl}, model ${model}) has been silent for ` +
    `${streak} consecutive half-rounds. Last reason: '${reason ?? "unknown"}'.`
  );
}
