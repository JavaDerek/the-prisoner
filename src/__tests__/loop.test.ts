import { describe, it, expect, afterEach } from "vitest";
import { SILENT_MIND, scriptedMind } from "mind-seam";
import { ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../world/testDb.js";
import { buildWorld, type World } from "../world/setup.js";
import { buildResolver } from "../world/mechanics.js";
import { authorPlan, planSteps, type Plan } from "../ledger/ledger.js";
import { buildPrisonerContext } from "../mind/briefing.js";
import type { PrisonerContext, PrisonerProposal } from "../mind/prisonerMind.js";
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
