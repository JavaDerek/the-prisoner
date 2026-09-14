// Coordinator's fix, item 6: "Wits summary" -- a short, machine-derived
// section, appended to each transcript, listing every refusal (with cause
// and whose act caused it), every SEARCH (grounds, found or false alarm),
// every covert act by each side, and any ESCAPE attempt and its result.
// Derived from a HalfRoundResult's own structured fields (`outcome.result`,
// `error`) and `ledger.ts`'s `causeAtT` (itself a round_log lookup) --
// NEVER from a resolution's own prose `description`.
import { describe, it, expect, afterEach } from "vitest";
import { ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../world/testDb.js";
import { buildWorld, type World } from "../world/setup.js";
import { buildResolver } from "../world/mechanics.js";
import { authorPlan, type Plan } from "../ledger/ledger.js";
import { seedInitialBeliefs } from "../ledger/beliefs.js";
import { buildPrisonerContext, buildWardenContext } from "../mind/briefing.js";
import type { PrisonerProposal } from "../mind/prisonerMind.js";
import type { WardenProposal } from "../mind/wardenMind.js";
import { runHalfRound, newSilenceTracker } from "../loop.js";
import { newWitsSummary, noteWitsEvent, renderWitsSummary } from "../witsSummary.js";

describe("witsSummary -- machine-derived, never from prose", () => {
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

  it("records a refusal with its cause and the attribution naming whose act caused it", async () => {
    fresh();
    const summary = newWitsSummary();

    // Prisoner SHIM (lock 100 -> 80), belief updates to 80 (own outcome).
    const t1 = world.clock.prisonerT(1);
    const shimMind = { async consider() { return { intent: "shim", choice: "SHIM" } as PrisonerProposal; } };
    const half1 = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t: t1, context: buildPrisonerContext(world, prisonerPlan, t1), mind: shimMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half1, 1);

    // Warden CHECK_LOCK then SERVICE_LOCK (covert, accurate belief).
    const tw1 = world.clock.wardenT(2);
    const checkMind = { async consider() { return { intent: "check", choice: "CHECK_LOCK" } as WardenProposal; } };
    const half2 = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 2, t: tw1, context: buildWardenContext(world, wardenPlan, tw1), mind: checkMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half2, 2);

    const tw2 = world.clock.wardenT(3);
    const serviceMind = { async consider() { return { intent: "service", choice: "SERVICE_LOCK" } as WardenProposal; } };
    const half3 = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 3, t: tw2, context: buildWardenContext(world, wardenPlan, tw2), mind: serviceMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half3, 3);

    // Prisoner SHIM again -- refused (stale belief).
    const t2 = world.clock.prisonerT(4);
    const half4 = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 4, t: t2, context: buildPrisonerContext(world, prisonerPlan, t2), mind: shimMind, tracker: newSilenceTracker() });
    expect(half4.result.kind).toBe("refused");
    noteWitsEvent(summary, world.gameId, half4, 4);

    expect(summary.refusals).toHaveLength(1);
    expect(summary.refusals[0]).toMatchObject({ round: 4, principal: "prisoner", move: "SHIM" });
    expect(summary.refusals[0].attribution).toContain("warden's SERVICE_LOCK");
    expect(summary.refusals[0].attribution).toContain("round 3");

    // Also recorded: CHECK_LOCK and SERVICE_LOCK as covert acts.
    expect(summary.covertActs).toEqual(
      expect.arrayContaining([
        { round: 2, principal: "warden", move: "CHECK_LOCK" },
        { round: 3, principal: "warden", move: "SERVICE_LOCK" },
      ])
    );
    // SHIM (round 1) is covert too.
    expect(summary.covertActs.some((c) => c.round === 1 && c.move === "SHIM")).toBe(true);

    const rendered = renderWitsSummary(summary);
    expect(rendered.join("\n")).toContain("warden's SERVICE_LOCK");
    expect(rendered.join("\n")).toContain("round 3");
  });

  it("records a SEARCH with grounds and whether it caught (never parsing the resolution's own description text)", async () => {
    fresh();
    const summary = newWitsSummary();

    // No grounds yet (suspicion 0).
    const t1 = world.clock.wardenT(1);
    const searchMind = { async consider() { return { intent: "search", choice: "SEARCH" } as WardenProposal; } };
    const half1 = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 1, t: t1, context: buildWardenContext(world, wardenPlan, t1), mind: searchMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half1, 1);
    expect(summary.searches).toEqual([{ round: 1, grounds: false, caught: false }]);

    // Drive suspicion to the threshold via FILE, then search and catch.
    for (let n = 1; n <= 4; n++) {
      const t = world.clock.prisonerT(n);
      const fileMind = { async consider() { return { intent: "file", choice: "FILE" } as PrisonerProposal; } };
      await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: n, t, context: buildPrisonerContext(world, prisonerPlan, t), mind: fileMind, tracker: newSilenceTracker() });
    }
    const t2 = world.clock.wardenT(5);
    const half2 = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 5, t: t2, context: buildWardenContext(world, wardenPlan, t2), mind: searchMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half2, 5);

    expect(summary.searches).toContainEqual({ round: 5, grounds: true, caught: true });

    const rendered = renderWitsSummary(summary).join("\n");
    expect(rendered).toContain("found evidence");
  });

  it("records an ESCAPE attempt and its result", async () => {
    fresh();
    const summary = newWitsSummary();
    const t = world.clock.prisonerT(1);
    const escapeMind = { async consider() { return { intent: "escape", choice: "ESCAPE" } as PrisonerProposal; } };
    const half = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t, context: buildPrisonerContext(world, prisonerPlan, t), mind: escapeMind, tracker: newSilenceTracker() });
    noteWitsEvent(summary, world.gameId, half, 1);

    expect(summary.escapeAttempts).toEqual([{ round: 1, success: false }]);
    const rendered = renderWitsSummary(summary).join("\n");
    expect(rendered).toContain("failed");
  });

  it("a refusal with no contradiction detail at all renders 'cause unknown', never a guess", () => {
    const summary = newWitsSummary();
    const error = new ResolveProtocolError("unknown-mechanic", "no mechanic named 'NOPE'");
    const half = {
      principal: "prisoner" as const,
      t: 1,
      context: { principalId: "p", identity: "i", motive: "m", briefing: "b", moves: [] },
      result: { kind: "refused" as const, proposal: { intent: "x", choice: "NOPE" }, error },
    };
    noteWitsEvent(summary, "game-1", half, 1);
    expect(summary.refusals[0].attribution).toBe("cause unknown");
  });
});
