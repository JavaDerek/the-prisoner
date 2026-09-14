import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { computePerceivedObjects, buildOpenBriefing, buildOpenContext } from "../briefing.js";
import { setNotes } from "../../ledger/notes.js";

describe("open-mode perception and briefing", () => {
  afterEach(() => destroyTestDb());

  it("both principals perceive every object when nothing is concealed", () => {
    createTestDb();
    const world = buildOpenWorld();
    const prisonerView = computePerceivedObjects(world, "prisoner", world.base.clock.t0);
    const wardenView = computePerceivedObjects(world, "warden", world.base.clock.t0);
    expect(prisonerView.map((o) => o.id).sort()).toEqual(wardenView.map((o) => o.id).sort());
    expect(prisonerView.some((o) => o.id === "spoon")).toBe(true);
  });

  it("concealing the spoon hides it from the warden but not from the prisoner (its own owner)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const concealmentId = resourceIdForProperty(world, "spoon", "concealment") as string;

    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: concealmentId, amount: 100, min: 0, max: 100, description: "hidden" },
    });

    const t = world.base.clock.wardenT(1);
    const wardenView = computePerceivedObjects(world, "warden", t);
    const prisonerView = computePerceivedObjects(world, "prisoner", t);
    expect(wardenView.some((o) => o.id === "spoon")).toBe(false);
    expect(prisonerView.some((o) => o.id === "spoon")).toBe(true);
  });

  it("a principal's own persisted notes render into ITS OWN briefing, never the other's", () => {
    createTestDb();
    const world = buildOpenWorld();
    setNotes(world.base.gameId, "prisoner", "SECRET_PRISONER_PLAN_MARKER", 1);

    const prisonerBriefing = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 1);
    const wardenBriefing = buildOpenBriefing(world, "warden", world.base.clock.t0, 1);
    expect(prisonerBriefing).toContain("SECRET_PRISONER_PLAN_MARKER");
    expect(wardenBriefing).not.toContain("SECRET_PRISONER_PLAN_MARKER");
  });

  it("buildOpenContext assembles principalId/identity/motive/briefing/perceivedObjects", () => {
    createTestDb();
    const world = buildOpenWorld();
    const context = buildOpenContext(world, "prisoner", world.base.clock.t0, 1);
    expect(context.principalId).toBe(world.base.prisonerId);
    expect(context.identity).toContain("Voss");
    expect(context.perceivedObjects.length).toBeGreaterThan(0);
  });
});
