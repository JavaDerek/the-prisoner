import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { checkOpenEscape, checkOpenCatch, checkOpenGameEnd } from "../gameEnd.js";

describe("open-mode game end (OPEN-VARIANT.md §9.3, mapped before implementation)", () => {
  afterEach(() => destroyTestDb());

  it("no escape while the bar and lock are both intact", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(checkOpenEscape(world, world.base.clock.t0)).toBe(false);
  });

  it("escapes once the bar reaches 0 AND guard_attention is below the threshold", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const barResource = resourceIdForProperty(world, "bar", "integrity") as string;

    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: barResource, amount: 1000, min: 0, max: 100, description: "x" } });
    // Starting guard_attention is 50, equal to ESCAPE_GUARD_MAX -- not itself
    // below it (the closed variant's own boundary: "< ESCAPE_GUARD_MAX", not
    // "<="), so lower it first to isolate the opening condition from the
    // guard condition.
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_WEAR",
      parameters: { resourceId: world.base.resources.guardAttention, amount: 20, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    expect(checkOpenEscape(world, t)).toBe(true);
  });

  it("escapes once the lock, worn through its own open-world property, reaches 0 AND guard_attention is below the threshold", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const lockResource = resourceIdForProperty(world, "lock", "integrity") as string;

    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: lockResource, amount: 1000, min: 0, max: 100, description: "x" } });
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_WEAR",
      parameters: { resourceId: world.base.resources.guardAttention, amount: 20, min: 0, max: 100, description: "x" },
    });
    expect(checkOpenEscape(world, world.base.clock.wardenT(1))).toBe(true);
  });

  it("does NOT escape at the starting guard_attention of 50, exactly AT the threshold (boundary: strictly less than, not less-or-equal)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const barResource = resourceIdForProperty(world, "bar", "integrity") as string;
    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: barResource, amount: 1000, min: 0, max: 100, description: "x" } });
    const t = world.base.clock.wardenT(1);
    expect(checkOpenEscape(world, t)).toBe(false);
  });

  it("does NOT escape when the opening exists but guard_attention is at or above the threshold", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const barResource = resourceIdForProperty(world, "bar", "integrity") as string;
    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: barResource, amount: 1000, min: 0, max: 100, description: "x" } });
    // Raise guard_attention back up so it no longer satisfies "< ESCAPE_GUARD_MAX".
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: world.base.resources.guardAttention, amount: 100, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    expect(checkOpenEscape(world, t)).toBe(false);
  });

  it("does not catch when warden_suspicion is below the grounds threshold, even if the revealed value would otherwise qualify", () => {
    createTestDb();
    const world = buildOpenWorld();
    const t = world.base.clock.t0;
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 10 })).toBe(false);
  });

  it("catches once grounds hold and the revealed bar integrity is at or below the threshold", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: world.base.resources.wardenSuspicion, amount: 100, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 10 })).toBe(true);
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 90 })).toBe(false); // not worn enough
  });

  it("catches on the spoon's edge only while it is not concealed", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: world.base.resources.wardenSuspicion, amount: 100, min: 0, max: 100, description: "x" },
    });
    const t1 = world.base.clock.wardenT(1);
    expect(checkOpenCatch(world, t1, { objectId: "spoon", property: "edge", value: 30 })).toBe(true);

    const concealmentId = resourceIdForProperty(world, "spoon", "concealment") as string;
    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: concealmentId, amount: 100, min: 0, max: 100, description: "x" } });
    const t2 = world.base.clock.wardenT(2);
    expect(checkOpenCatch(world, t2, { objectId: "spoon", property: "edge", value: 30 })).toBe(false);
  });

  it("checkOpenGameEnd prefers escape over catch, and needs no `reveal` argument to detect escape", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const barResource = resourceIdForProperty(world, "bar", "integrity") as string;
    resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: barResource, amount: 1000, min: 0, max: 100, description: "x" } });
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_WEAR",
      parameters: { resourceId: world.base.resources.guardAttention, amount: 20, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    expect(checkOpenGameEnd(world, t)).toEqual({ kind: "escaped" });
  });

  it("checkOpenGameEnd returns null when neither condition holds", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(checkOpenGameEnd(world, world.base.clock.t0)).toBeNull();
  });
});
