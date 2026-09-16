import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, OPEN_CATCH_BAR_MAX, OPEN_WINDOW_BAR_MAX } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { checkOpenEscape, checkOpenCatch, checkOpenGameEnd } from "../gameEnd.js";

describe("open-mode game end (OPEN-VARIANT.md §9.3; escape revised by §12)", () => {
  afterEach(() => destroyTestDb());

  it("no escape while the bar and lock are both intact", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(checkOpenEscape(world, world.base.clock.t0)).toBe(false);
  });

  // OPEN-VARIANT.md §12 (owner's decision): escape is leaving the cell. The
  // integrity-and-guard condition these tests used to pin is gone; the
  // routes it described now lead to an exit (leaving.test.ts).
  function leaveThrough(world: ReturnType<typeof buildOpenWorld>, exit: "door" | "window") {
    const e = world.exits[exit];
    buildOpenResolver().resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_LEAVE",
      parameters: { characterId: world.base.prisonerId, ...e, description: "x" },
    });
  }

  it("a spent bar and lock with the guard long gone is still not escape: the prisoner has to leave", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    for (const object of ["bar", "lock"]) {
      const resourceId = resourceIdForProperty(world, object, "integrity") as string;
      resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: 1000, min: 0, max: 100, description: "x" } });
    }
    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_WEAR",
      parameters: { resourceId: world.base.resources.guardAttention, amount: 1000, min: 0, max: 100, description: "x" },
    });
    expect(checkOpenEscape(world, world.base.clock.wardenT(1))).toBe(false);
  });

  it("escapes once the prisoner is through an exit, with guard attention at its starting 50", () => {
    createTestDb();
    const world = buildOpenWorld();
    const lock = resourceIdForProperty(world, "lock", "integrity") as string;
    buildOpenResolver().resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: lock, amount: 1000, min: 0, max: 100, description: "x" } });
    leaveThrough(world, "door");
    expect(checkOpenEscape(world, world.base.clock.wardenT(1))).toBe(true);
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

  // OPEN-VARIANT.md §33.5 (owner's decision): the warden is outside the cell,
  // so the bar has to be worse before he can see it than before she can pull
  // it out. The window opens at 50; the catch waits for 30.
  it("the bar is caught at 30 or below, not at the 50 that opens the window (§33.5)", () => {
    createTestDb();
    const world = buildOpenWorld();
    buildOpenResolver().resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: world.base.resources.wardenSuspicion, amount: 100, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    expect(OPEN_CATCH_BAR_MAX).toBe(30);
    expect(OPEN_CATCH_BAR_MAX).toBeLessThan(OPEN_WINDOW_BAR_MAX);
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 40 })).toBe(false);
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 31 })).toBe(false);
    expect(checkOpenCatch(world, t, { objectId: "bar", property: "integrity", value: 30 })).toBe(true);
  });

  it("examining a way out and finding it standing open catches, given grounds (§33.8)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const t0 = world.base.clock.t0;
    expect(checkOpenCatch(world, t0, { objectId: "window", property: "passage", value: 1 })).toBe(false); // no grounds yet
    buildOpenResolver().resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: world.base.resources.wardenSuspicion, amount: 40, min: 0, max: 100, description: "x" },
    });
    const t = world.base.clock.wardenT(1);
    for (const wayOut of ["window", "door"]) {
      expect(checkOpenCatch(world, t, { objectId: wayOut, property: "passage", value: 1 })).toBe(true);
      expect(checkOpenCatch(world, t, { objectId: wayOut, property: "passage", value: 0 })).toBe(false);
    }
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
    const bar = resourceIdForProperty(world, "bar", "integrity") as string;
    buildOpenResolver().resolve({ gameId: world.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: bar, amount: 1000, min: 0, max: 100, description: "x" } });
    leaveThrough(world, "window");
    const t = world.base.clock.wardenT(1);
    expect(checkOpenGameEnd(world, t)).toEqual({ kind: "escaped" });
    expect(checkOpenGameEnd(world, t, { objectId: "bar", property: "integrity", value: 0 })).toEqual({ kind: "escaped" });
  });

  it("checkOpenGameEnd returns null when neither condition holds", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(checkOpenGameEnd(world, world.base.clock.t0)).toBeNull();
  });
});
