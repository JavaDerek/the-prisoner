import { randomUUID } from "node:crypto";
import {
  getDatabase,
  ConstraintViolationError,
  ResolveProtocolError,
  type Outcome,
  type Contradiction,
  type Expectation,
} from "run-dmcp";

/**
 * The attempt ledger (design §4.4) -- plan memory as this repository's own,
 * never the engine's and never `mind-seam`'s (design §4.2-§4.3): a plan is
 * belief, not truth, and its evidence column is the engine's own
 * `Contradiction[]`/`ConstraintViolationError` fields, stored verbatim,
 * never redeclared.
 *
 * CORRECTION 2 (this project's brief, over run-dmcp #31's own finding): a
 * contradiction's `fact.openedByEventId` names the low-level `<kind>.updated`
 * event a projection trigger wrote, never the `resolution.recorded` event
 * that actually caused it (see `resolveAdversarial.test.ts` in run-dmcp,
 * case 2, "ISSUE #31 SAYS ... OBSERVED: it does not"). So the hop alone
 * cannot say WHICH MOVE caused the fact. This repository resolves that
 * itself, without any engine change: `t` is a half-round counter this
 * repository owns completely (warden even, prisoner odd -- `world/clock.ts`),
 * so the hop's `validFromT` identifies EXACTLY one entry in this
 * repository's own `round_log` -- the move that ran at that `t`. The hop
 * itself is still stored verbatim as evidence (§4.3); `causeFromHop` below
 * is purely a caller-side rendering step over a caller-side table, and the
 * engine never learns any of this repository's vocabulary from it.
 */

export type StepStatus = "pending" | "active" | "done" | "failed" | "abandoned";

export interface PlanStepSpec {
  move: string;
  description: string;
  /** The preconditions this step's proposal declares (design §6.1: "Proposal{
   *  mechanic: choice, expects: active step's declared expectations }") --
   *  content, authored per scenario, never interpreted by this module. */
  expects?: readonly Expectation[];
}

export interface Plan {
  id: string;
  gameId: string;
  characterId: string;
}

/** Authors a plan skeleton (content, not mechanism) for `characterId`. The
 *  first step starts `active`; the rest start `pending`. */
export function authorPlan(params: { gameId: string; characterId: string; t: number; steps: readonly PlanStepSpec[] }): Plan {
  const db = getDatabase();
  const planId = randomUUID();
  db.prepare(`INSERT INTO plans (id, game_id, character_id, created_t) VALUES (?, ?, ?, ?)`).run(
    planId,
    params.gameId,
    params.characterId,
    params.t
  );

  const insertStep = db.prepare(
    `INSERT INTO plan_steps (id, plan_id, step_index, move, description, status, expects) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  params.steps.forEach((step, index) => {
    insertStep.run(
      randomUUID(),
      planId,
      index,
      step.move,
      step.description,
      index === 0 ? "active" : "pending",
      step.expects ? JSON.stringify(step.expects) : null
    );
  });

  return { id: planId, gameId: params.gameId, characterId: params.characterId };
}

interface PlanStepRow {
  id: string;
  plan_id: string;
  step_index: number;
  move: string;
  description: string;
  status: StepStatus;
  evidence: string | null;
  attempted_at_t: number | null;
  expects: string | null;
}

function activeStep(planId: string): PlanStepRow | undefined {
  return getDatabase()
    .prepare(`SELECT * FROM plan_steps WHERE plan_id = ? AND status = 'active' ORDER BY step_index LIMIT 1`)
    .get(planId) as PlanStepRow | undefined;
}

/** The active step's declared `expects`, ready to hand to `resolver.resolve()`
 *  (design §6.1) -- `undefined` when the plan has no active step, or the
 *  active step declared none. */
export function activeStepExpects(planId: string): readonly Expectation[] | undefined {
  const step = activeStep(planId);
  if (!step?.expects) return undefined;
  return JSON.parse(step.expects) as Expectation[];
}

/**
 * "Minds own their plans" (this task's brief): a proposal may carry an
 * optional `plan` -- up to 6 move names -- that REPLACES the plan's
 * remaining, not-yet-attempted steps. The currently active step (whatever
 * is being attempted this very half-round) is left untouched; only steps
 * still `pending` are discarded and replaced, appended after the highest
 * existing `step_index` so ordering and the active step's place in the
 * sequence are both preserved. Validation (literal membership in `moves`,
 * length <= 6) happens in the caller's own `coerce` (`prisonerMind.ts`/
 * `wardenMind.ts`) -- this function trusts what it is given, the same
 * division of labour `authorPlan` already has with its own caller.
 */
export function revisePlan(params: { plan: Plan; moves: readonly string[] }): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM plan_steps WHERE plan_id = ? AND status = 'pending'`).run(params.plan.id);
  const row = db
    .prepare(`SELECT COALESCE(MAX(step_index), -1) as m FROM plan_steps WHERE plan_id = ?`)
    .get(params.plan.id) as { m: number };
  const insertStep = db.prepare(
    `INSERT INTO plan_steps (id, plan_id, step_index, move, description, status) VALUES (?, ?, ?, ?, ?, 'pending')`
  );
  params.moves.forEach((move, index) => {
    insertStep.run(randomUUID(), params.plan.id, row.m + 1 + index, move, `Revised: ${move}.`);
  });
}

function nextPendingStep(planId: string): PlanStepRow | undefined {
  return getDatabase()
    .prepare(`SELECT * FROM plan_steps WHERE plan_id = ? AND status = 'pending' ORDER BY step_index LIMIT 1`)
    .get(planId) as PlanStepRow | undefined;
}

/** Logged once per SUCCESSFUL resolution (by either principal), so a
 *  contradiction's hop (`validFromT`) can later be traced back to the move
 *  that produced it. A refused proposal writes nothing, so it is never the
 *  cause of any fact and is never logged here -- see `ledger.test.ts` for
 *  the off-plan/refused cases, which are tracked in `attempts` instead. */
export function logRound(params: {
  gameId: string;
  t: number;
  roundN: number;
  principal: "warden" | "prisoner";
  mechanic: string;
  description: string | null;
  /** Item 5: the acting principal's own spoken `line`, verbatim -- relayed
   *  to the OTHER principal's next briefing when this act was not covert
   *  (see `seenByOtherAs`). `null`/omitted when the mind offered none. */
  line?: string | null;
  /** Item 5: an authored, positive "what this looked like from outside"
   *  sentence (`world/mechanics.ts`'s `SEEN_BY_OTHER_AS`) -- `null` marks a
   *  covert act, which then contributes NOTHING to the other principal's
   *  perception (neither this sentence nor the line above). */
  seenByOtherAs?: string | null;
}): void {
  getDatabase()
    .prepare(
      `INSERT INTO round_log (id, game_id, t, round_n, principal, mechanic, description, line, seen_by_other_as)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      randomUUID(),
      params.gameId,
      params.t,
      params.roundN,
      params.principal,
      params.mechanic,
      params.description,
      params.line ?? null,
      params.seenByOtherAs ?? null
    );
}

interface RoundLogRow {
  t: number;
  round_n: number;
  principal: "warden" | "prisoner";
  mechanic: string;
  description: string | null;
}

interface VisibleActRow {
  line: string | null;
  seen_by_other_as: string | null;
}

/**
 * Item 5 / this task's perception fix: the OTHER principal's most recent
 * HALF-ROUND, exactly -- never an older one. `line` and `seen_by_other_as`
 * are independent: a line (spoken aloud) relays regardless of whether the
 * act itself was covert or even resolved at all (design: "its line (even
 * from a WAIT or rejected turn, if a line was parsed) and its visible
 * act"), while `seen_by_other_as` alone stays `null` for a covert move.
 *
 * CORRECTION (this task's bug (b)): the previous version returned `null`
 * for the WHOLE row whenever `seen_by_other_as` was null, which both
 * suppressed a covert move's own spoken line (wrong: speech isn't itself
 * hidden) and -- for any half-round `logRound` was never called at all
 * (silence, a refusal, a no-choice turn) -- let this query skip past that
 * half-round entirely and surface an OLDER, unrelated act instead (a stale
 * repeat). `runHalfRound` (`loop.ts`) now calls `logRound` for EVERY
 * half-round, content or none, so "most recent row" is always truly the
 * most recent half-round, and this function simply returns it, un-filtered.
 */
export function mostRecentVisibleActFor(gameId: string, otherPrincipal: "warden" | "prisoner"): VisibleActRow | null {
  const row = getDatabase()
    .prepare(`SELECT line, seen_by_other_as FROM round_log WHERE game_id = ? AND principal = ? ORDER BY t DESC LIMIT 1`)
    .get(gameId, otherPrincipal) as VisibleActRow | undefined;
  return row ?? null;
}

/** Design's correction 2: resolves "which move caused this fact" from this
 *  repository's own round log, keyed on the hop's `validFromT` -- never on
 *  `openedByEventId`, which the engine only promises names *some* event,
 *  not the resolution. Returns `null` when the log has no entry at that
 *  `t` (a fact opened by scenario setup itself, at `t0`, before any move
 *  was logged), which the caller renders as "cause unknown" -- never a
 *  guess. */
export function causeAtT(gameId: string, t: number): RoundLogRow | null {
  const row = getDatabase()
    .prepare(`SELECT t, round_n, principal, mechanic, description FROM round_log WHERE game_id = ? AND t = ?`)
    .get(gameId, t) as RoundLogRow | undefined;
  return row ?? null;
}

export type AttemptOutcome = "done" | "active" | "failed";

interface RecordAttemptParams {
  gameId: string;
  plan: Plan;
  t: number;
  /** Item 8: the round number (1-5 in this checkpoint), consistent with
   *  the transcript -- never the half-round clock `t`, which is this
   *  repository's own internal axis and not something a reader outside
   *  this codebase should have to decode. */
  roundN: number;
  move: string;
  /** Whether this move, once resolved, completes its plan step -- a
   *  caller policy (design §4.4: "the mechanic's own result decides done
   *  or still active"), decided outside this module because it depends on
   *  the mechanic's own semantics, which this ledger never interprets. */
  completesStep?: boolean;
}

/** Records a successful resolution against the active step (if the move
 *  matches it) or as an off-plan attempt (otherwise). `note` (item 4) is
 *  an info move's own authored revelation, positive prose, verbatim --
 *  omitted for a move that reveals nothing new. */
export function recordSuccess(params: RecordAttemptParams & { outcome: Outcome; note?: string }): void {
  const db = getDatabase();
  const active = activeStep(params.plan.id);
  const onPlanStep = active && active.move === params.move ? active : null;

  db.prepare(
    `INSERT INTO attempts (id, plan_id, step_id, game_id, move, on_plan, outcome, evidence, opened_by_event_id, at_t, round_n, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`
  ).run(
    randomUUID(),
    params.plan.id,
    onPlanStep?.id ?? null,
    params.gameId,
    params.move,
    onPlanStep ? 1 : 0,
    onPlanStep && params.completesStep ? "done" : "active",
    params.t,
    params.roundN,
    params.note ?? null
  );

  if (onPlanStep) {
    const newStatus: StepStatus = params.completesStep ? "done" : "active";
    db.prepare(`UPDATE plan_steps SET status = ?, attempted_at_t = ? WHERE id = ?`).run(newStatus, params.t, onPlanStep.id);
    if (newStatus === "done") {
      const next = nextPendingStep(params.plan.id);
      if (next) {
        db.prepare(`UPDATE plan_steps SET status = 'active' WHERE id = ?`).run(next.id);
      }
    }
  }
}

/** Records a refused proposal -- `ResolveProtocolError("expectation-
 *  contradicted")` or a mid-resolution `ConstraintViolationError` -- as a
 *  failed attempt against the active step (if it matches), evidence stored
 *  verbatim per design §4.3. */
export function recordFailure(
  params: RecordAttemptParams & { error: ResolveProtocolError | ConstraintViolationError; note?: string }
): void {
  const db = getDatabase();
  const active = activeStep(params.plan.id);
  const onPlanStep = active && active.move === params.move ? active : null;

  let evidence: unknown;
  let openedByEventId: string | null = null;
  if (params.error instanceof ResolveProtocolError) {
    evidence = params.error.contradictions ?? [];
    const first = (params.error.contradictions ?? [])[0] as Contradiction | undefined;
    openedByEventId = first?.fact.openedByEventId ?? null;
  } else {
    evidence = {
      constraintKind: params.error.constraintKind,
      resourceId: params.error.resourceId,
      contradictedFact: params.error.contradictedFact ?? null,
    };
    openedByEventId = params.error.contradictedFact?.openedByEventId ?? null;
  }

  db.prepare(
    `INSERT INTO attempts (id, plan_id, step_id, game_id, move, on_plan, outcome, evidence, opened_by_event_id, at_t, round_n, note)
     VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    params.plan.id,
    onPlanStep?.id ?? null,
    params.gameId,
    params.move,
    onPlanStep ? 1 : 0,
    JSON.stringify(evidence),
    openedByEventId,
    params.t,
    params.roundN,
    params.note ?? null
  );

  if (onPlanStep) {
    db.prepare(`UPDATE plan_steps SET status = 'failed', attempted_at_t = ? WHERE id = ?`).run(params.t, onPlanStep.id);
  }
}

interface AttemptRow {
  id: string;
  plan_id: string;
  step_id: string | null;
  move: string;
  on_plan: number;
  outcome: AttemptOutcome | "failed";
  evidence: string | null;
  opened_by_event_id: string | null;
  at_t: number;
  round_n: number | null;
  note: string | null;
}

export function attemptsFor(planId: string): AttemptRow[] {
  return getDatabase()
    .prepare(`SELECT * FROM attempts WHERE plan_id = ? ORDER BY at_t, rowid`)
    .all(planId) as AttemptRow[];
}

/** Item 4: the `at_t` of this plan's own most recent SUCCESSFUL attempt at
 *  `move` -- the window an info move's own revelation is computed over
 *  ("since your last inspection"). `null` when there is none yet, which
 *  the caller reads as "since the start". */
export function lastSuccessfulAttemptAtT(planId: string, move: string): number | null {
  const row = getDatabase()
    .prepare(
      `SELECT at_t FROM attempts WHERE plan_id = ? AND move = ? AND outcome != 'failed' ORDER BY at_t DESC LIMIT 1`
    )
    .get(planId, move) as { at_t: number } | undefined;
  return row?.at_t ?? null;
}

export function planSteps(planId: string): PlanStepRow[] {
  return getDatabase()
    .prepare(`SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_index`)
    .all(planId) as PlanStepRow[];
}

/**
 * "What was the plan at `t`" (design §4.4) -- reconstructed from `attempts`
 * alone, never from `plan_steps`' own `status`/`attempted_at_t` columns,
 * which are mutated in place and therefore only ever describe *now*.
 * `attempts` is append-only and carries `at_t` per row, so replaying it up
 * to `t` (steps complete strictly in order in this repository's model)
 * answers the question without the plan ever living in the timeline.
 */
export function planAsOfT(planId: string, t: number): PlanStepRow[] {
  const steps = planSteps(planId);
  const attempts = attemptsFor(planId).filter((a) => a.at_t <= t);

  const result: PlanStepRow[] = [];
  let previousDone = true; // the first step is active once nothing precedes it.

  for (const step of steps) {
    const onPlanAttempts = attempts.filter((a) => a.on_plan === 1 && a.step_id === step.id);
    const last = onPlanAttempts[onPlanAttempts.length - 1];

    let status: StepStatus;
    let attemptedAtT: number | null = null;
    if (last) {
      attemptedAtT = last.at_t;
      status = last.outcome === "done" ? "done" : last.outcome === "failed" ? "failed" : "active";
    } else {
      status = previousDone ? "active" : "pending";
    }

    result.push({ ...step, status, attempted_at_t: attemptedAtT });
    previousDone = status === "done";
  }

  return result;
}

/** Renders one attempt's row into one line of positive prose (design
 *  §4.4's examples), for `briefing`. Never "no longer"/"not"/"failed
 *  to" -- literal tokens this module would have had to write itself to
 *  produce a negation, and it never does (root CLAUDE.md hard rule 4's
 *  "a literal check for a token we defined... is fine" applied here to
 *  our OWN generated prose, in `ledger.test.ts`). */
function renderAttempt(gameId: string, row: AttemptRow): string {
  // Item 8: the round number shown to a reader is the transcript's own
  // 1-5, never the half-round clock t -- round_n is null only for rows
  // written before this column existed (defensive, not expected in a
  // fresh checkpoint run).
  const roundLabel = row.round_n ?? row.at_t;

  if (row.outcome !== "failed") {
    const base = `Round ${roundLabel}: you performed ${row.move}${row.on_plan === 1 ? "" : " (off-plan)"}.`;
    // Item 4: an info move's own authored revelation, positive prose,
    // verbatim -- appended, never replacing the base line, so the ledger
    // still says WHAT was done as well as what it revealed.
    return row.note ? `${base} ${row.note}` : base;
  }

  const evidence = row.evidence ? (JSON.parse(row.evidence) as unknown) : null;
  let factLine = "the world refused it";
  let key: string | null = null;
  let value: string | null = null;
  let validFromT: number | null = null;

  if (Array.isArray(evidence) && evidence.length > 0) {
    const contradiction = evidence[0] as Contradiction;
    key = contradiction.fact.key;
    value = contradiction.fact.value;
    validFromT = contradiction.fact.validFromT;
  } else if (evidence && typeof evidence === "object" && "contradictedFact" in evidence) {
    const withFact = evidence as { contradictedFact: { key: string; value: string; validFromT: number } | null };
    if (withFact.contradictedFact) {
      key = withFact.contradictedFact.key;
      value = withFact.contradictedFact.value;
      validFromT = withFact.contradictedFact.validFromT;
    }
  }

  if (key !== null && value !== null && validFromT !== null) {
    const cause = causeAtT(gameId, validFromT);
    const attribution = cause
      ? `set by the ${cause.principal}'s ${cause.mechanic} in round ${cause.round_n}` +
        (cause.description ? ` -- ${cause.description}` : "")
      : "cause unknown";
    factLine = `${key} was ${value}, ${attribution}`;
  }

  const base = `Round ${roundLabel}: ${row.move} was refused -- ${factLine}.`;
  return row.note ? `${base} ${row.note}` : base;
}

/** One authored plan step, rendered positively with its own status marked
 *  (item 3, over the owner's finding: "an invisible plan"). Never "not yet
 *  started" or "hasn't happened" -- "not yet reached" names a real,
 *  positive fact about a step's place in a known sequence, not an
 *  absence. */
function statusLabel(status: StepStatus): string {
  switch (status) {
    case "active":
      return "current step";
    case "done":
      return "completed";
    case "failed":
      return "failed";
    case "abandoned":
      return "abandoned";
    case "pending":
      return "not yet reached";
  }
}

/** Renders a principal's own authored plan into positive prose, current
 *  step marked -- so "(off-plan)" in `renderLedger`'s own output refers to
 *  something the mind has actually seen (item 3). Reads `plan_steps`'
 *  live `status` directly (unlike `planAsOfT`, this is always "now": the
 *  plan a principal is being handed IS the current one, not a historical
 *  reconstruction). */
export function renderPlan(planId: string): string {
  const steps = planSteps(planId);
  return steps.map((step, index) => `${index + 1}. ${step.description} (${statusLabel(step.status)})`).join("\n");
}

export function renderLedger(gameId: string, plan: Plan): string {
  const attempts = attemptsFor(plan.id);
  if (attempts.length === 0) return "No attempts yet.";
  return attempts.map((row) => renderAttempt(gameId, row)).join("\n");
}
