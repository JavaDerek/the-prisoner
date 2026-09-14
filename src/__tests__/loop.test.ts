import { describe, it, expect, afterEach } from "vitest";
import type { Mind } from "mind-seam";
import { SILENT_MIND, scriptedMind } from "mind-seam";
import { ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../world/testDb.js";
import { buildWorld, type World } from "../world/setup.js";
import { buildResolver } from "../world/mechanics.js";
import { authorPlan, planSteps, attemptsFor, renderLedger, type Plan } from "../ledger/ledger.js";
import { getBelief, seedInitialBeliefs } from "../ledger/beliefs.js";
import { buildPrisonerContext, buildWardenContext } from "../mind/briefing.js";
import type { PrisonerContext, PrisonerProposal } from "../mind/prisonerMind.js";
import type { WardenContext, WardenProposal } from "../mind/wardenMind.js";
import {
  runHalfRound,
  newSilenceTracker,
  noteSilenceReason,
  loudSilenceMessage,
  LOUD_AFTER_CONSECUTIVE_SILENCES,
} from "../loop.js";

describe("the loop -- deterministic, scripted minds only (design §6.1, §7.4)", () => {
  let world: World;
  let resolver: ReturnType<typeof buildResolver>;
  let plan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [{ move: "HONE", description: "hone the spoon" }],
    });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("with SILENT_MIND, the FIRST silent half-round is not loud", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const t = world.clock.prisonerT(1);
    const context = buildPrisonerContext(world, plan, t);

    const result = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t,
      context,
      mind: SILENT_MIND,
      tracker,
    });

    expect(result.result.kind).toBe("silent");
    expect(tracker.streak).toBe(1);
    expect(tracker.streak >= LOUD_AFTER_CONSECUTIVE_SILENCES).toBe(false);
  });

  it("with SILENT_MIND, the SECOND consecutive silent half-round produces the loud condition, naming the last reason", async () => {
    fresh();
    const tracker = newSilenceTracker();
    noteSilenceReason(tracker, "unreachable");

    const t1 = world.clock.prisonerT(1);
    await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t: t1,
      context: buildPrisonerContext(world, plan, t1),
      mind: SILENT_MIND,
      tracker,
    });
    expect(tracker.streak).toBe(1);

    const t2 = world.clock.prisonerT(2);
    const second = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t: t2,
      context: buildPrisonerContext(world, plan, t2),
      mind: SILENT_MIND,
      tracker,
    });

    expect(second.result.kind).toBe("silent");
    if (second.result.kind === "silent") {
      expect(second.result.loud).toBe(true);
      expect(second.result.reason).toBe("unreachable");
      const message = loudSilenceMessage("prisoner", "http://localhost:11434/v1", "qwen2.5:14b", second.result.reason, tracker.streak);
      expect(message).toContain("unreachable");
      expect(message).toContain("2 consecutive");
    }
  });

  it("a real proposal after a silence resets the streak to 0", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const t1 = world.clock.prisonerT(1);
    await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t: t1,
      context: buildPrisonerContext(world, plan, t1),
      mind: SILENT_MIND,
      tracker,
    });
    expect(tracker.streak).toBe(1);

    const t2 = world.clock.prisonerT(2);
    const mind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "hone the spoon", choice: "HONE" });
    const result = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t: t2,
      context: buildPrisonerContext(world, plan, t2),
      mind,
      tracker,
    });

    expect(tracker.streak).toBe(0);
    expect(result.result.kind).toBe("resolved");
  });

  it("a scripted proposal with no choice at all does not touch the resolver (recorded as no-choice)", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const t = world.clock.prisonerT(1);
    const mind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "just thinking" });

    const before = planSteps(plan.id)[0].status;
    const result = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildPrisonerContext(world, plan, t),
      mind,
      tracker,
    });

    expect(result.result.kind).toBe("no-choice");
    expect(planSteps(plan.id)[0].status).toBe(before); // untouched
  });

  it("an unknown mechanic name is refused by the resolver itself (never pattern-matched by the loop)", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const t = world.clock.prisonerT(1);
    // A scripted mind bypasses coerce's own membership check entirely --
    // this proves the loop does not ALSO re-check `choice` against `moves`
    // itself (it has no list to check against; membership is coerce's job,
    // not the loop's), and instead lets the resolver's own
    // "unknown-mechanic" refusal do the work, exactly as it would for any
    // other proposal it has never seen before.
    const mind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "do something", choice: "NOT_A_REAL_MOVE" });

    const result = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildPrisonerContext(world, plan, t),
      mind,
      tracker,
    });

    expect(result.result.kind).toBe("refused");
    if (result.result.kind === "refused") {
      expect(result.result.error).toBeInstanceOf(ResolveProtocolError);
      expect((result.result.error as ResolveProtocolError).reason).toBe("unknown-mechanic");
    }
  });

  it("the clock alternates warden/prisoner half-rounds exactly (integration with world/clock.ts)", () => {
    fresh();
    const t0 = world.clock.t0;
    expect(world.clock.wardenT(1) - t0).toBe(2);
    expect(world.clock.prisonerT(1) - t0).toBe(3);
    expect(world.clock.wardenT(2) - t0).toBe(4);
    expect(world.clock.prisonerT(2) - t0).toBe(5);
  });
});

describe("item 5(a), coordinator's fix -- a mind that re-sends the same overall plan every turn advances through it, rather than looping", () => {
  let world: World;
  let resolver: ReturnType<typeof buildResolver>;
  let plan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "HONE", description: "hone" },
        { move: "FILE", description: "file 1" },
        { move: "FILE", description: "file 2" },
        { move: "CONCEAL", description: "conceal" },
      ],
    });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("an 'obedient' mind that always echoes back [current step, ...remaining pending] as its plan advances through all four steps", async () => {
    fresh();
    // This mind does not track anything of its own -- every call it reads
    // the CURRENT active step and the CURRENT remaining pending steps
    // straight off the plan (standing in for a real model correctly
    // reporting whatever its own briefing's "current step" and plan
    // section say) and echoes them back verbatim as `plan`. Under the
    // PRE-FIX loop, this exact behaviour looped forever on the first step:
    // `plan[0]` (the just-decided current move) was re-inserted as a fresh
    // pending step, so it came back as "current" again next round.
    const obedientMind: Mind<PrisonerContext, PrisonerProposal> = {
      async consider(): Promise<PrisonerProposal> {
        const steps = planSteps(plan.id);
        const active = steps.find((s) => s.status === "active");
        if (!active) throw new Error("test setup: no active step");
        const remaining = steps.filter((s) => s.status === "pending").map((s) => s.move);
        return { intent: `doing ${active.move}`, choice: active.move, plan: [active.move, ...remaining] };
      },
    };

    const tracker = newSilenceTracker();
    const expectedOrder = ["HONE", "FILE", "FILE", "CONCEAL"];
    for (let n = 1; n <= expectedOrder.length; n++) {
      const t = world.clock.prisonerT(n);
      const before = planSteps(plan.id).find((s) => s.status === "active");
      expect(before?.move).toBe(expectedOrder[n - 1]);

      const half = await runHalfRound({
        world,
        resolver,
        plan,
        principal: "prisoner",
        roundN: n,
        t,
        context: buildPrisonerContext(world, plan, t),
        mind: obedientMind,
        tracker,
      });
      expect(half.result.kind).toBe("resolved");
    }

    // All four steps completed, in order -- none repeated, none skipped.
    const finalSteps = planSteps(plan.id);
    expect(finalSteps.every((s) => s.status === "done")).toBe(true);
  });
});

describe("item 5(d), coordinator's fix -- the no-op ledger line names the value that made it one", () => {
  let world: World;
  let resolver: ReturnType<typeof buildResolver>;
  let plan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    plan = authorPlan({
      gameId: world.gameId,
      characterId: world.wardenId,
      t: world.clock.t0,
      steps: [{ move: "SERVICE_LOCK", description: "service the lock" }],
    });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("SERVICE_LOCK on an already-full lock records a positive no-op line, never an absence", async () => {
    fresh();
    const mind: Mind<WardenContext, WardenProposal> = scriptedMind<WardenContext, WardenProposal>({
      intent: "service the lock",
      choice: "SERVICE_LOCK",
      plan: ["SERVICE_LOCK"],
    });
    const t = world.clock.wardenT(1);
    const half = await runHalfRound({
      world,
      resolver,
      plan,
      principal: "warden",
      roundN: 1,
      t,
      context: buildWardenContext(world, plan, t),
      mind,
      tracker: newSilenceTracker(),
    });

    expect(half.result.kind).toBe("resolved");
    const attempts = attemptsFor(plan.id);
    expect(attempts[0].note).toBe("the lock was already at integrity 100");

    const rendered = renderLedger(world.gameId, plan);
    expect(rendered).toContain("the lock was already at integrity 100");
    for (const forbidden of ["no change", "nothing happened", "did not change"]) {
      expect(rendered.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("coordinator's fix, item 1 -- own outcomes update own beliefs (never contradicted by its own act)", () => {
  let world: World;
  let resolver: ReturnType<typeof buildResolver>;
  let prisonerPlan: Plan;
  let wardenPlan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    seedInitialBeliefs(world);
    prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "placeholder" }] });
    wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "placeholder" }] });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("SHIM twice in a row, with no warden action between, is never refused", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const shimMind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "shim", choice: "SHIM", plan: ["SHIM"] });

    const t1 = world.clock.prisonerT(1);
    const first = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t: t1, context: buildPrisonerContext(world, prisonerPlan, t1), mind: shimMind, tracker });
    expect(first.result.kind).toBe("resolved");
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 80, asOfRound: 1 });

    const t2 = world.clock.prisonerT(2);
    const second = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 2, t: t2, context: buildPrisonerContext(world, prisonerPlan, t2), mind: shimMind, tracker });
    expect(second.result.kind).toBe("resolved");
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 60, asOfRound: 2 });
  });

  it("FILE twice in a row, with no warden action between, is never refused", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const fileMind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "file", choice: "FILE", plan: ["FILE"] });

    const t1 = world.clock.prisonerT(1);
    const first = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t: t1, context: buildPrisonerContext(world, prisonerPlan, t1), mind: fileMind, tracker });
    expect(first.result.kind).toBe("resolved");
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 85, asOfRound: 1 });

    const t2 = world.clock.prisonerT(2);
    const second = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 2, t: t2, context: buildPrisonerContext(world, prisonerPlan, t2), mind: fileMind, tracker });
    expect(second.result.kind).toBe("resolved");
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 70, asOfRound: 2 });
  });

  it("REPLACE_BAR twice in a row, with no prisoner action between, is never refused (the same fix, symmetric for the warden)", async () => {
    fresh();
    const tracker = newSilenceTracker();
    const replaceMind = scriptedMind<WardenContext, WardenProposal>({ intent: "replace", choice: "REPLACE_BAR", plan: ["REPLACE_BAR"] });

    const t1 = world.clock.wardenT(1);
    const first = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 1, t: t1, context: buildWardenContext(world, wardenPlan, t1), mind: replaceMind, tracker });
    expect(first.result.kind).toBe("resolved");

    const t2 = world.clock.wardenT(2);
    const second = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 2, t: t2, context: buildWardenContext(world, wardenPlan, t2), mind: replaceMind, tracker });
    expect(second.result.kind).toBe("resolved");
  });
});

describe("coordinator's fix, item 5 -- ledger wording states the plan positively, never 'this move is now the last planned step'", () => {
  let world: World;
  let resolver: ReturnType<typeof buildResolver>;
  let plan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "HONE", description: "hone" },
        { move: "FILE", description: "file" },
      ],
    });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a plan revision that empties the remaining steps (previously FILE) is worded positively", async () => {
    fresh();
    const mind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "hone, nothing planned after", choice: "HONE", plan: ["HONE"] });
    const t = world.clock.prisonerT(1);
    await runHalfRound({ world, resolver, plan, principal: "prisoner", roundN: 1, t, context: buildPrisonerContext(world, plan, t), mind, tracker: newSilenceTracker() });

    const rendered = renderLedger(world.gameId, plan);
    expect(rendered).toContain("Plan now: to be decided next turn.");
    expect(rendered).not.toContain("this move is now the last planned step");
  });

  it("a plan revision that leaves steps remaining names them, positively", async () => {
    fresh();
    // The authored plan's own remaining step is FILE; this mind revises to
    // CONCEAL instead -- a genuine change, worth a note.
    const mind = scriptedMind<PrisonerContext, PrisonerProposal>({ intent: "hone, then conceal", choice: "HONE", plan: ["HONE", "CONCEAL"] });
    const t = world.clock.prisonerT(1);
    await runHalfRound({ world, resolver, plan, principal: "prisoner", roundN: 1, t, context: buildPrisonerContext(world, plan, t), mind, tracker: newSilenceTracker() });

    const rendered = renderLedger(world.gameId, plan);
    expect(rendered).toContain("Plan now: CONCEAL.");
  });
});
