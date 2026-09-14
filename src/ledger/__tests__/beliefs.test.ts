import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { setBelief, getBelief, renderBeliefLine, seedInitialBeliefs, beliefExpectation } from "../beliefs.js";

/**
 * The belief store (this task's brief, "Belief, not truth, in briefings"):
 * one row per (game, principal, resource), upserted -- never a history --
 * because a belief IS "the current state of what a principal knows", and
 * history already lives in round_log/attempts. Rendered positively, with
 * WHEN it was learned.
 */
describe("the belief store", () => {
  let world: World;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a resource nobody has set a belief for is unknown -- null, never a guessed default", () => {
    fresh();
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toBeNull();
  });

  it("setBelief then getBelief round-trips the value and the round it was learned", () => {
    fresh();
    setBelief(world.gameId, "prisoner", "bar_integrity", 85, 3);
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 85, asOfRound: 3 });
  });

  it("setBelief again overwrites -- a belief is current knowledge, not a history", () => {
    fresh();
    setBelief(world.gameId, "prisoner", "bar_integrity", 85, 3);
    setBelief(world.gameId, "prisoner", "bar_integrity", 70, 5);
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 70, asOfRound: 5 });
  });

  it("a stale write (an earlier round than what is already known) never overwrites a newer belief", () => {
    fresh();
    setBelief(world.gameId, "prisoner", "bar_integrity", 70, 5);
    setBelief(world.gameId, "prisoner", "bar_integrity", 85, 3);
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 70, asOfRound: 5 });
  });

  it("beliefs are per-principal -- the warden's belief of a resource never leaks into the prisoner's", () => {
    fresh();
    setBelief(world.gameId, "warden", "bar_integrity", 40, 2);
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toBeNull();
  });

  it("renderBeliefLine states the value positively, with when it was learned", () => {
    const line = renderBeliefLine("bar integrity", { value: 85, asOfRound: 3 });
    expect(line).toBe("bar integrity: 85 (as of round 3).");
  });

  it("renderBeliefLine returns null for an unknown belief -- nothing to render, never a guess", () => {
    expect(renderBeliefLine("lock integrity", null)).toBeNull();
  });

  it("seedInitialBeliefs seeds both principals with the world's real starting truths, at round 0", () => {
    fresh();
    seedInitialBeliefs(world);
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 100, asOfRound: 0 });
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 100, asOfRound: 0 });
    expect(getBelief(world.gameId, "prisoner", "guard_attention")).toEqual({ value: 50, asOfRound: 0 });
    expect(getBelief(world.gameId, "warden", "bar_integrity")).toEqual({ value: 100, asOfRound: 0 });
    expect(getBelief(world.gameId, "warden", "lock_integrity")).toEqual({ value: 100, asOfRound: 0 });
    expect(getBelief(world.gameId, "warden", "guard_attention")).toEqual({ value: 50, asOfRound: 0 });
    expect(getBelief(world.gameId, "warden", "spoon_edge")).toEqual({ value: 0, asOfRound: 0 });
  });

  describe("beliefExpectation -- expects built from belief, never truth (design: 'expects come from belief')", () => {
    it("FILE expects the prisoner's own believed bar_integrity", () => {
      fresh();
      setBelief(world.gameId, "prisoner", "bar_integrity", 55, 4);
      const expects = beliefExpectation(world, "prisoner", "FILE");
      expect(expects).toEqual([{ entityId: world.resources.barIntegrity, key: "value", value: 55 }]);
    });

    it("SHIM expects the prisoner's own believed lock_integrity", () => {
      fresh();
      setBelief(world.gameId, "prisoner", "lock_integrity", 60, 2);
      const expects = beliefExpectation(world, "prisoner", "SHIM");
      expect(expects).toEqual([{ entityId: world.resources.lockIntegrity, key: "value", value: 60 }]);
    });

    it("REPLACE_BAR expects the warden's own believed bar_integrity", () => {
      fresh();
      setBelief(world.gameId, "warden", "bar_integrity", 100, 0);
      const expects = beliefExpectation(world, "warden", "REPLACE_BAR");
      expect(expects).toEqual([{ entityId: world.resources.barIntegrity, key: "value", value: 100 }]);
    });

    it("SERVICE_LOCK expects the warden's own believed lock_integrity", () => {
      fresh();
      setBelief(world.gameId, "warden", "lock_integrity", 100, 0);
      const expects = beliefExpectation(world, "warden", "SERVICE_LOCK");
      expect(expects).toEqual([{ entityId: world.resources.lockIntegrity, key: "value", value: 100 }]);
    });

    it("a move with no belief-dependent resource (e.g. WAIT, HONE) declares no expects", () => {
      fresh();
      expect(beliefExpectation(world, "prisoner", "WAIT")).toBeUndefined();
      expect(beliefExpectation(world, "prisoner", "HONE")).toBeUndefined();
    });

    it("never declares an expectation on guard_attention -- it drifts every round", () => {
      fresh();
      setBelief(world.gameId, "prisoner", "guard_attention", 50, 0);
      // No move maps to guard_attention in the expects table at all.
      expect(beliefExpectation(world, "prisoner", "INSPECT")).toBeUndefined();
    });

    it("declares no expects when the principal has no belief yet for that resource", () => {
      fresh();
      expect(beliefExpectation(world, "prisoner", "FILE")).toBeUndefined();
    });
  });
});
