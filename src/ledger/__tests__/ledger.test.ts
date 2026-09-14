import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, ResolveProtocolError, ConstraintViolationError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver, declareCutIfJustCut, FILE_AMOUNT } from "../../world/mechanics.js";
import {
  authorPlan,
  logRound,
  recordSuccess,
  recordFailure,
  attemptsFor,
  planSteps,
  planAsOfT,
  renderLedger,
  renderPlan,
  causeAtT,
  revisePlan,
  mostRecentVisibleActFor,
  pendingMoves,
} from "../ledger.js";
import type { Resolver } from "run-dmcp";

describe("the attempt ledger (design §4.4)", () => {
  let world: World;
  let resolver: Resolver;

  function fresh(): World {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    return world;
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("an off-plan attempt is recorded and does not advance the active step", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "SHIM", description: "work the lock" },
        { move: "FILE", description: "file the bar" },
      ],
    });

    const t = world.clock.prisonerT(1);
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" }); // off-plan: active step is SHIM
    recordSuccess({ gameId: world.gameId, plan, roundN: 1, t, move: "FILE", outcome, completesStep: false });

    const steps = planSteps(plan.id);
    expect(steps[0]).toMatchObject({ move: "SHIM", status: "active" });

    const attempts = attemptsFor(plan.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ move: "FILE", on_plan: 0 });
  });

  it("an on-plan attempt that completes its step advances the plan to the next step", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "HONE", description: "hone the spoon" },
        { move: "FILE", description: "file the bar" },
      ],
    });

    const t = world.clock.prisonerT(1);
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    recordSuccess({ gameId: world.gameId, plan, roundN: 1, t, move: "HONE", outcome, completesStep: true });

    const steps = planSteps(plan.id);
    expect(steps[0]).toMatchObject({ move: "HONE", status: "done" });
    expect(steps[1]).toMatchObject({ move: "FILE", status: "active" });
  });

  it("a contradicted expectation lands as failed, with the Contradiction[] stored verbatim and a non-null hop naming the low-level event (not resolution.recorded)", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "FILE", description: "file the bar down to 40" }],
    });

    // The prisoner files the bar down first, so the warden's replacement
    // below is a REAL change (a no-op write opens no new fact -- see
    // constrained.ts's applyLiveWrite -- and this test needs a fresh fact
    // to attribute).
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });

    // The warden replaces the bar at round 2 -- logged, so the ledger can
    // later attribute the contradiction to it.
    const tw = world.clock.wardenT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    logRound({ gameId: world.gameId, t: tw, roundN: 2, principal: "warden", mechanic: "REPLACE_BAR", description: null });

    // The prisoner's plan expects bar_integrity to still be 40 -- stale.
    const tp = world.clock.prisonerT(2);
    let caught: unknown;
    try {
      resolver.resolve({
        gameId: world.gameId,
        mechanic: "FILE",
        expects: [{ entityId: world.resources.barIntegrity, key: "value", value: 40 }],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResolveProtocolError);
    recordFailure({ gameId: world.gameId, plan, roundN: 1, t: tp, move: "FILE", error: caught as ResolveProtocolError });

    const steps = planSteps(plan.id);
    expect(steps[0]).toMatchObject({ move: "FILE", status: "failed" });

    const attempts = attemptsFor(plan.id);
    expect(attempts[0].outcome).toBe("failed");
    const evidence = JSON.parse(attempts[0].evidence as string);
    expect(Array.isArray(evidence)).toBe(true);
    expect(evidence[0].fact.key).toBe("value");
    expect(attempts[0].opened_by_event_id).not.toBeNull();

    // The hop names a low-level projection event, never resolution.recorded
    // -- correction 2's own premise, reconfirmed against this world.
    const namedEvent = getDatabase()
      .prepare(`SELECT kind FROM events WHERE id = ?`)
      .get(attempts[0].opened_by_event_id) as { kind: string } | undefined;
    expect(namedEvent?.kind).not.toBe("resolution.recorded");

    // Rendering attributes the refusal to the warden's REPLACE_BAR by
    // consulting this repository's own round_log, keyed on the hop's t --
    // never on the hop's event id.
    const rendered = renderLedger(world.gameId, plan);
    expect(rendered).toContain("warden's REPLACE_BAR");
    expect(rendered).toContain(`round 2`);
  });

  it("the null-hop path: evidence is stored with a null hop, and the rendering says only what it knows", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "WAIT", description: "wait for the moment" }],
    });

    // Simulate a fact opened outside the projection path (per the P3 draft
    // issue's own instruction) by writing directly to `facts`, with a null
    // opened_by_event_id -- test-only; production code never writes facts
    // directly (run-dmcp's own dual-write discipline). `cut` carries no
    // `resolve_only` constraint (only the five A.2 resources do), so this
    // is the one fact in this world a direct write is not itself refused
    // by the engine's own trigger.
    const db = getDatabase();
    const simulatedAtT = world.clock.t0 + 1;
    db.prepare(`UPDATE facts SET valid_to_t = ? WHERE entity_id = ? AND key = 'cut' AND valid_to_t IS NULL`).run(
      simulatedAtT,
      world.barId
    );
    db.prepare(
      `INSERT INTO facts (id, entity_id, key, value, valid_from_t, valid_to_t, irreversible, opened_by_event_id)
       VALUES (lower(hex(randomblob(16))), ?, 'cut', '1', ?, NULL, 0, NULL)`
    ).run(world.barId, simulatedAtT);

    const tp = world.clock.prisonerT(1);
    let caught: unknown;
    try {
      resolver.resolve({
        gameId: world.gameId,
        mechanic: "WAIT",
        expects: [{ entityId: world.barId, key: "cut", value: 0 }],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ResolveProtocolError);
    const error = caught as ResolveProtocolError;
    expect(error.contradictions?.[0]?.fact.openedByEventId).toBeNull();

    recordFailure({ gameId: world.gameId, plan, roundN: 1, t: tp, move: "WAIT", error });

    const attempts = attemptsFor(plan.id);
    expect(attempts[0].opened_by_event_id).toBeNull();

    const rendered = renderLedger(world.gameId, plan);
    expect(rendered).toContain("cause unknown");
    // Never a guess at who caused it.
    expect(rendered).not.toContain("warden's");
    expect(rendered).not.toContain("prisoner's");
  });

  it("a ConstraintViolationError (irreversible) is recorded as a failed attempt with its own hop", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "FILE", description: "cut the bar" }],
    });

    for (let n = 1; n <= 100 / FILE_AMOUNT + 2; n++) {
      const t = world.clock.prisonerT(n);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t, move: "FILE", outcome, completesStep: false });
      declareCutIfJustCut(world, outcome);
      if ((JSON.parse(JSON.stringify(outcome.constraint)) as { mustHonor: unknown[] }).mustHonor.length >= 0) {
        // no-op, just keeping the loop shape obvious
      }
      const cutNow = outcome.transitions.some((tr) => tr.key === "cut" && tr.newValue === 1);
      if (cutNow) break;
    }

    const plan2Step = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "REPLACE_BAR_ATTEMPT", description: "placeholder, not a registered mechanic" }],
    });
    // Exercise recordFailure directly against a real ConstraintViolationError
    // by attempting REPLACE_BAR (the warden's move) as a stand-in caller.
    let caught: unknown;
    const tw = world.clock.wardenT(50);
    try {
      resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ConstraintViolationError);
    recordFailure({ gameId: world.gameId, plan: plan2Step, roundN: 1, t: tw, move: "REPLACE_BAR", error: caught as ConstraintViolationError });

    const attempts = attemptsFor(plan2Step.id);
    expect(attempts[0].outcome).toBe("failed");
    const evidence = JSON.parse(attempts[0].evidence as string);
    expect(evidence.constraintKind).toBe("irreversible");
    expect(evidence.contradictedFact.key).toBe("cut");
  });

  it("what the plan looked like at an earlier t is reconstructible from attempted_at_t", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "HONE", description: "hone the spoon" },
        { move: "FILE", description: "file the bar" },
      ],
    });

    const t1 = world.clock.prisonerT(1);
    const outcome1 = resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t1, move: "HONE", outcome: outcome1, completesStep: true });

    const t2 = world.clock.prisonerT(2);
    const outcome2 = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
    recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t2, move: "FILE", outcome: outcome2, completesStep: false });

    const asOfT1 = planAsOfT(plan.id, t1);
    expect(asOfT1.find((s) => s.move === "HONE")?.status).toBe("done");
    expect(asOfT1.find((s) => s.move === "FILE")?.status).toBe("active");
  });

  it("the rendered ledger never contains a negation phrasing this module would have had to write itself", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "FILE", description: "file the bar down to 40" }],
    });
    const tw = world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    logRound({ gameId: world.gameId, t: tw, roundN: 1, principal: "warden", mechanic: "REPLACE_BAR", description: null });

    const tp = world.clock.prisonerT(1);
    let caught: unknown;
    try {
      resolver.resolve({
        gameId: world.gameId,
        mechanic: "FILE",
        expects: [{ entityId: world.resources.barIntegrity, key: "value", value: 40 }],
      });
    } catch (err) {
      caught = err;
    }
    recordFailure({ gameId: world.gameId, plan, roundN: 1, t: tp, move: "FILE", error: caught as ResolveProtocolError });

    const rendered = renderLedger(world.gameId, plan);
    for (const forbidden of ["no longer", " not ", "failed to"]) {
      expect(rendered.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("causeAtT returns null for a t nothing was ever logged at", () => {
    fresh();
    expect(causeAtT(world.gameId, world.clock.t0 + 999)).toBeNull();
  });

  describe("mostRecentVisibleActFor -- this task's perception fix", () => {
    it("relays a line even when the act itself is covert (speech isn't itself hidden)", () => {
      fresh();
      const tp = world.clock.prisonerT(1);
      resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
      logRound({
        gameId: world.gameId,
        t: tp,
        roundN: 1,
        principal: "prisoner",
        mechanic: "CONCEAL",
        description: null,
        line: "Just stretching.",
        seenByOtherAs: null,
      });

      const act = mostRecentVisibleActFor(world.gameId, "prisoner");
      expect(act?.line).toBe("Just stretching.");
      expect(act?.seen_by_other_as).toBeNull();
    });

    it("never repeats an older perception -- a half-round with nothing to report is still the most recent row", () => {
      fresh();
      const t1 = world.clock.prisonerT(1);
      resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
      logRound({
        gameId: world.gameId,
        t: t1,
        roundN: 1,
        principal: "prisoner",
        mechanic: "FILE",
        description: null,
        line: "old-marker",
        seenByOtherAs: "scraping",
      });

      // A later half-round with nothing to report -- still logged, with
      // both fields null (the fix: it must NOT be skipped in favour of the
      // older, content-bearing row above).
      const t2 = world.clock.prisonerT(2);
      logRound({ gameId: world.gameId, t: t2, roundN: 2, principal: "prisoner", mechanic: "NONE", description: null, line: null, seenByOtherAs: null });

      const act = mostRecentVisibleActFor(world.gameId, "prisoner");
      expect(act?.line).toBeNull();
      expect(act?.seen_by_other_as).toBeNull();
    });
  });

  describe("revisePlan -- minds own their plans (this task's brief)", () => {
    it("replaces the remaining PENDING steps, leaving the active one untouched", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "hone the spoon" },
          { move: "FILE", description: "file the bar" },
          { move: "FILE", description: "file again" },
        ],
      });

      revisePlan({ plan, moves: ["SHIM", "CONCEAL"] });

      const steps = planSteps(plan.id);
      expect(steps[0]).toMatchObject({ move: "HONE", status: "active" }); // untouched
      expect(steps.filter((s) => s.status === "pending").map((s) => s.move)).toEqual(["SHIM", "CONCEAL"]);
      expect(steps.some((s) => s.move === "FILE")).toBe(false);
    });

    it("appends after the highest existing step index, preserving order", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [{ move: "HONE", description: "hone the spoon" }],
      });
      revisePlan({ plan, moves: ["FILE", "SHIM"] });
      const rendered = renderPlan(plan.id);
      expect(rendered.indexOf("FILE")).toBeLessThan(rendered.indexOf("SHIM"));
    });
  });

  describe("renderPlan (item 3) -- the plan itself, shown as positive prose, current step marked", () => {
    it("renders every step's own description, in order, with the first marked current", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "Hone the spoon into something sharper." },
          { move: "FILE", description: "File at the bar." },
        ],
      });

      const rendered = renderPlan(plan.id);
      expect(rendered).toContain("Hone the spoon into something sharper.");
      expect(rendered).toContain("File at the bar.");
      // The order in the rendering matches step order.
      expect(rendered.indexOf("Hone the spoon")).toBeLessThan(rendered.indexOf("File at the bar"));
      // The first (only active) step is marked current; the second is not.
      const lines = rendered.split("\n");
      const honeLine = lines.find((l) => l.includes("Hone the spoon"));
      const fileLine = lines.find((l) => l.includes("File at the bar"));
      expect(honeLine).toContain("next");
      expect(fileLine).not.toContain("next");
    });

    it("marks a completed step and advances the marker to the next one", () => {
      fresh();
      const resolver = buildResolver(world);
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "Hone the spoon into something sharper." },
          { move: "FILE", description: "File at the bar." },
        ],
      });

      const t1 = world.clock.prisonerT(1);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t1, move: "HONE", outcome, completesStep: true });

      const rendered = renderPlan(plan.id);
      const lines = rendered.split("\n");
      const honeLine = lines.find((l) => l.includes("Hone the spoon"));
      const fileLine = lines.find((l) => l.includes("File at the bar"));
      expect(honeLine).toContain("done");
      expect(fileLine).toContain("next");
    });

    it("never renders a negation phrasing", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "Hone the spoon into something sharper." },
          { move: "FILE", description: "File at the bar." },
        ],
      });
      const rendered = renderPlan(plan.id).toLowerCase();
      for (const forbidden of ["no longer", " not ", "failed to", "nothing"]) {
        expect(rendered).not.toContain(forbidden);
      }
    });

    it("coordinator's fix, item 5 -- bare move name, done/next labels: '1. OBSERVE (done)', '2. SEARCH (next)'", () => {
      fresh();
      const resolver = buildResolver(world);
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.wardenId,
        t: world.clock.t0,
        steps: [{ move: "OBSERVE", description: "OBSERVE" }],
      });
      // Real call order (loop.ts): the plan revision is applied BEFORE the
      // move resolves, so "next pending step" promotion (inside
      // recordSuccess) sees the freshly-revised SEARCH already there.
      revisePlan({ plan, moves: ["SEARCH"] });
      const t1 = world.clock.wardenT(1);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t1, move: "OBSERVE", outcome, completesStep: true });

      const rendered = renderPlan(plan.id);
      expect(rendered).not.toContain("Revised:");
      const lines = rendered.split("\n");
      expect(lines[0]).toBe("1. OBSERVE (done)");
      expect(lines[1]).toBe("2. SEARCH (next)");
    });

    it("coordinator's fix -- shows at most the LAST completed step, never the whole history", () => {
      fresh();
      const resolver = buildResolver(world);
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "step one" },
          { move: "FILE", description: "step two" },
          { move: "FILE", description: "step three" },
        ],
      });

      const t1 = world.clock.prisonerT(1);
      const outcome1 = resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t1, move: "HONE", outcome: outcome1, completesStep: true });

      const t2 = world.clock.prisonerT(2);
      const outcome2 = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 2, t: t2, move: "FILE", outcome: outcome2, completesStep: true });

      const rendered = renderPlan(plan.id);
      // "step one" (two steps back) is gone; "step two" (immediately before
      // the current one) is the one and only completed step shown.
      expect(rendered).not.toContain("step one");
      expect(rendered).toContain("step two");
      expect(rendered).toContain("step three");
    });
  });

  describe("pendingMoves -- what the plan intends after whatever is active now (coordinator's fix)", () => {
    it("lists the pending steps' moves, in order", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "active" },
          { move: "FILE", description: "pending 1" },
          { move: "CONCEAL", description: "pending 2" },
        ],
      });
      expect(pendingMoves(plan.id)).toEqual(["FILE", "CONCEAL"]);
    });

    it("is empty once nothing is left pending", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [{ move: "WAIT", description: "only step" }],
      });
      expect(pendingMoves(plan.id)).toEqual([]);
    });
  });

  describe("revisePlan -- coordinator's fix: plan[0] (this turn's move) is never re-inserted as a future step", () => {
    it("replacing pending steps with an empty list leaves nothing pending, and does not touch the active step", () => {
      fresh();
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "active" },
          { move: "FILE", description: "old pending" },
        ],
      });
      revisePlan({ plan, moves: [] });
      const steps = planSteps(plan.id);
      expect(steps.find((s) => s.move === "HONE")?.status).toBe("active");
      expect(pendingMoves(plan.id)).toEqual([]);
    });

    it("the just-completed move is never among the newly revised pending steps -- this is the exact loop the coordinator diagnosed", () => {
      fresh();
      const resolver = buildResolver(world);
      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.prisonerId,
        t: world.clock.t0,
        steps: [
          { move: "HONE", description: "active" },
          { move: "FILE", description: "old pending" },
        ],
      });

      // A mind proposes plan = [HONE, FILE, FILE, CONCEAL] -- HONE is this
      // turn's move (plan[0]); the caller must revise remaining steps to
      // plan[1..] = [FILE, FILE, CONCEAL], NEVER re-adding HONE itself.
      revisePlan({ plan, moves: ["FILE", "FILE", "CONCEAL"] });

      const t1 = world.clock.prisonerT(1);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t: t1, move: "HONE", outcome, completesStep: true });

      // The step that becomes active next is FILE, never HONE again.
      const active = planSteps(plan.id).find((s) => s.status === "active");
      expect(active?.move).toBe("FILE");
      expect(planSteps(plan.id).some((s) => s.move === "HONE" && s.status === "pending")).toBe(false);
    });
  });
});
