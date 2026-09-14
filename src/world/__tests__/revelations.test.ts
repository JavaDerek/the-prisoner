import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../testDb.js";
import { buildWorld, type World } from "../setup.js";
import { buildResolver } from "../mechanics.js";
import { logRound } from "../../ledger/ledger.js";
import { describeInspection, describeObservation } from "../revelations.js";
import type { Resolver } from "run-dmcp";

describe("item 4 -- INSPECT/OBSERVE reveal something the principal's numeric view does not already carry", () => {
  let world: World;
  let resolver: Resolver;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("describeInspection reports the stable state when nothing changed since sinceT", () => {
    fresh();
    const text = describeInspection(world, world.clock.t0, world.clock.t0);
    expect(text.toLowerCase()).toContain("same as");
  });

  it("describeInspection reports a guard rotation that happened since sinceT", () => {
    fresh();
    const since = world.clock.t0;
    const tw = world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "ROTATE_GUARD" });
    logRound({ gameId: world.gameId, t: tw, roundN: 1, principal: "warden", mechanic: "ROTATE_GUARD", description: null });

    const text = describeInspection(world, since, tw);
    expect(text.toLowerCase()).toContain("guard rotation");
    expect(text.toLowerCase()).toContain("fresh");
  });

  it("describeInspection reports a lock service that happened since sinceT", () => {
    fresh();
    const since = world.clock.t0;
    const tw = world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "SERVICE_LOCK" });
    logRound({ gameId: world.gameId, t: tw, roundN: 1, principal: "warden", mechanic: "SERVICE_LOCK", description: null });

    const text = describeInspection(world, since, tw);
    expect(text.toLowerCase()).toContain("lock");
    expect(text.toLowerCase()).toContain("fresh");
  });

  it("describeInspection ignores a warden move BEFORE sinceT (only the window since last inspection matters)", () => {
    fresh();
    const tw1 = world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "ROTATE_GUARD" });
    logRound({ gameId: world.gameId, t: tw1, roundN: 1, principal: "warden", mechanic: "ROTATE_GUARD", description: null });

    // The prisoner's "last inspection" is AFTER that rotation.
    const since = tw1;
    const tw2 = world.clock.wardenT(2);

    const text = describeInspection(world, since, tw2);
    expect(text.toLowerCase()).toContain("same as");
  });

  it("describeObservation reveals the prisoner's current spoon edge, which the warden's own numeric view never carries", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });

    const t = world.clock.wardenT(2);
    const text = describeObservation(world, t);
    expect(text).toMatch(/edge reading of 10/);
  });

  it("describeObservation reveals concealment near the loose tile when present", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });

    const t = world.clock.wardenT(2);
    const text = describeObservation(world, t);
    expect(text.toLowerCase()).toContain("tucked out of sight");
  });

  it("describeObservation says nothing about concealment when there is none", () => {
    fresh();
    const t = world.clock.wardenT(1);
    const text = describeObservation(world, t);
    expect(text.toLowerCase()).not.toContain("tucked");
  });
});
