import { describe, it, expect, afterEach } from "vitest";
import { getResource, writeConstrainedValue, ConstraintViolationError, valueHistory, getDatabase } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../testDb.js";
import { buildWorld, type World } from "../setup.js";
import {
  buildResolver,
  declareCutIfJustCut,
  checkGameEnd,
  PRISONER_MOVES,
  WARDEN_MOVES,
  FILE_AMOUNT,
  FILE_AMOUNT_SHARP,
  FILE_SHARP_THRESHOLD,
  SHIM_AMOUNT,
  HONE_AMOUNT,
  FILE_SUSPICION_BUMP,
  ROTATE_GUARD_LEVEL,
  TIME_DECAY_AMOUNT,
  FAILED_ESCAPE_SUSPICION_BUMP,
  SEARCH_SUSPICION_THRESHOLD,
  ESCAPE_GUARD_MAX,
  barBand,
} from "../mechanics.js";
import { readNumericFact } from "../facts.js";
import type { Resolver } from "run-dmcp";

describe("the-prisoner's mechanics -- every consequential change through resolve()", () => {
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

  it("FILE lowers bar_integrity and raises warden_suspicion, recording one resolution", () => {
    fresh();
    world.clock.prisonerT(1);
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });

    expect(getResource(world.resources.barIntegrity)?.value).toBe(100 - FILE_AMOUNT);
    expect(getResource(world.resources.wardenSuspicion)?.value).toBe(FILE_SUSPICION_BUMP);
    expect(outcome.mechanic).toBe("FILE");
    expect(outcome.transitions).toHaveLength(2);
  });

  it("FILE removes more integrity when the spoon is sharp enough to help", () => {
    fresh();
    for (let n = 1; n <= 3; n++) {
      world.clock.prisonerT(n);
      resolver.resolve({ gameId: world.gameId, mechanic: "HONE" }); // spoon_edge -> 30
    }
    expect(getResource(world.resources.spoonEdge)?.value).toBeGreaterThanOrEqual(FILE_SHARP_THRESHOLD);
    const before = getResource(world.resources.barIntegrity)?.value as number;
    world.clock.prisonerT(4);
    resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
    expect(getResource(world.resources.barIntegrity)?.value).toBe(before - FILE_AMOUNT_SHARP);
  });

  it("SHIM lowers lock_integrity", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "SHIM" });
    expect(getResource(world.resources.lockIntegrity)?.value).toBe(100 - SHIM_AMOUNT);
  });

  it("HONE raises spoon_edge", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    expect(getResource(world.resources.spoonEdge)?.value).toBe(HONE_AMOUNT);
  });

  it("CONCEAL marks the SPOON concealed (design revision: hides the spoon under the loose tile)", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    expect(readNumericFact({ gameId: world.gameId, t, entityId: world.spoonId, key: "concealed" })).toBe(1);
  });

  it("HONE un-conceals the spoon", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    const t = world.clock.prisonerT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    expect(readNumericFact({ gameId: world.gameId, t, entityId: world.spoonId, key: "concealed" })).toBe(0);
  });

  it("INSPECT writes no state and reveals true lock_integrity and guard_attention only (never bar_integrity)", () => {
    fresh();
    world.clock.prisonerT(1);
    const before = getResource(world.resources.barIntegrity)?.value;
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "INSPECT" });
    expect(outcome.transitions).toHaveLength(0);
    expect(getResource(world.resources.barIntegrity)?.value).toBe(before);
    expect(outcome.result).toMatchObject({ mechanic: "INSPECT", lockIntegrity: 100, guardAttention: 50 });
    expect(outcome.result).not.toHaveProperty("barIntegrity");
  });

  it("REPLACE_BAR sets bar_integrity to 100", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
    world.clock.wardenT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    expect(getResource(world.resources.barIntegrity)?.value).toBe(100);
  });

  it("SERVICE_LOCK sets lock_integrity to 100", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "SHIM" });
    world.clock.wardenT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "SERVICE_LOCK" });
    expect(getResource(world.resources.lockIntegrity)?.value).toBe(100);
  });

  it("ROTATE_GUARD sets guard_attention to its fixed level", () => {
    fresh();
    world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "ROTATE_GUARD" });
    expect(getResource(world.resources.guardAttention)?.value).toBe(ROTATE_GUARD_LEVEL);
  });

  it("OBSERVE causes no suspicion change, reveals true spoon_edge when unconcealed, and the bar as a band", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    const suspicionBefore = getResource(world.resources.wardenSuspicion)?.value as number;

    world.clock.wardenT(2);
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
    expect(getResource(world.resources.wardenSuspicion)?.value).toBe(suspicionBefore);
    expect(outcome.result).toMatchObject({ mechanic: "OBSERVE", spoonEdge: HONE_AMOUNT, barBand: "intact" });
  });

  it("OBSERVE does not reveal spoon_edge when the spoon is concealed", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    world.clock.wardenT(2);
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
    expect(outcome.result).not.toHaveProperty("spoonEdge");
  });

  it("WAIT does nothing", () => {
    fresh();
    world.clock.prisonerT(1);
    const before = { ...world.resources };
    void before;
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "WAIT" });
    expect(outcome.transitions).toHaveLength(0);
  });

  it("TIME_DECAY lowers guard_attention only, once called, and is not offered to either mind", () => {
    fresh();
    expect(PRISONER_MOVES).not.toContain("TIME_DECAY");
    expect(WARDEN_MOVES).not.toContain("TIME_DECAY");
    world.clock.prisonerT(1);
    const before = getResource(world.resources.guardAttention)?.value as number;
    resolver.resolve({ gameId: world.gameId, mechanic: "TIME_DECAY" });
    expect(getResource(world.resources.guardAttention)?.value).toBe(before - TIME_DECAY_AMOUNT);
  });

  it("barBand renders three positive ranges", () => {
    expect(barBand(100)).toBe("intact");
    expect(barBand(90)).toBe("intact");
    expect(barBand(89)).toBe("worn");
    expect(barBand(50)).toBe("worn");
    expect(barBand(49)).toBe("badly worn");
    expect(barBand(0)).toBe("badly worn");
  });

  describe("ESCAPE (new mechanic)", () => {
    it("fails and raises suspicion sharply when the bar is not cut and the lock is not fully worn", () => {
      fresh();
      world.clock.prisonerT(1);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "ESCAPE" });
      expect(outcome.result).toMatchObject({ mechanic: "ESCAPE", success: 0 });
      expect(getResource(world.resources.wardenSuspicion)?.value).toBe(FAILED_ESCAPE_SUSPICION_BUMP);
      expect(checkGameEnd(world, outcome.t)).toBeNull();
    });

    it("fails when the opening exists but guard_attention is not low enough", () => {
      fresh();
      for (let n = 1; n <= 100 / SHIM_AMOUNT; n++) {
        world.clock.prisonerT(n);
        resolver.resolve({ gameId: world.gameId, mechanic: "SHIM" });
      }
      expect(getResource(world.resources.lockIntegrity)?.value).toBe(0);
      expect(getResource(world.resources.guardAttention)?.value).toBeGreaterThanOrEqual(ESCAPE_GUARD_MAX);

      world.clock.prisonerT(100);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "ESCAPE" });
      expect(outcome.result).toMatchObject({ mechanic: "ESCAPE", success: 0 });
    });

    it("succeeds when the lock is fully worn through and guard_attention is low, ending the game", () => {
      fresh();
      for (let n = 1; n <= 100 / SHIM_AMOUNT; n++) {
        world.clock.prisonerT(n);
        resolver.resolve({ gameId: world.gameId, mechanic: "SHIM" });
      }
      // Drive guard_attention below the threshold via TIME_DECAY.
      for (let i = 0; i < 6; i++) {
        world.clock.prisonerT(200 + i);
        resolver.resolve({ gameId: world.gameId, mechanic: "TIME_DECAY" });
      }
      expect(getResource(world.resources.guardAttention)?.value).toBeLessThan(ESCAPE_GUARD_MAX);

      const t = world.clock.prisonerT(300);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "ESCAPE" });
      expect(outcome.result).toMatchObject({ mechanic: "ESCAPE", success: 1 });
      expect(checkGameEnd(world, t)).toEqual({ kind: "escaped" });
    });
  });

  describe("SEARCH (new mechanic)", () => {
    it("has no grounds and changes nothing while suspicion is below the threshold", () => {
      fresh();
      world.clock.wardenT(1);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "SEARCH" });
      expect(outcome.transitions).toHaveLength(0);
      expect(outcome.result).toMatchObject({ mechanic: "SEARCH", grounds: false });
    });

    it("is a false alarm and resets suspicion to 0 when nothing incriminating is found", () => {
      fresh();
      // Raise suspicion to the threshold via HONE (+5 each) without leaving
      // the bar/lock touched and without leaving the spoon exposed --
      // conceal again after every hone, so the final state has the spoon
      // hidden (spoon_edge ends high, but concealed, so SEARCH's spoon leg
      // does not fire).
      for (let n = 1; n <= 8; n++) {
        world.clock.prisonerT(2 * n - 1);
        resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
        world.clock.prisonerT(2 * n);
        resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
      }
      expect(getResource(world.resources.wardenSuspicion)?.value).toBeGreaterThanOrEqual(SEARCH_SUSPICION_THRESHOLD);
      expect(getResource(world.resources.barIntegrity)?.value).toBe(100);
      expect(getResource(world.resources.lockIntegrity)?.value).toBe(100);

      world.clock.wardenT(51);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "SEARCH" });
      expect(outcome.result).toMatchObject({ mechanic: "SEARCH", grounds: true, caught: 0 });
      expect(getResource(world.resources.wardenSuspicion)?.value).toBe(0);
      expect(checkGameEnd(world, outcome.t)).toBeNull();
    });

    it("catches the prisoner and ends the game when the bar is worn down enough", () => {
      fresh();
      for (let n = 1; n <= 4; n++) {
        world.clock.prisonerT(n);
        resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
      }
      expect(getResource(world.resources.wardenSuspicion)?.value).toBeGreaterThanOrEqual(SEARCH_SUSPICION_THRESHOLD);
      expect(getResource(world.resources.barIntegrity)?.value).toBeLessThanOrEqual(50);

      const t = world.clock.wardenT(5);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "SEARCH" });
      expect(outcome.result).toMatchObject({ mechanic: "SEARCH", grounds: true, caught: 1 });
      expect(checkGameEnd(world, t)).toEqual({ kind: "caught" });
    });
  });

  it("a direct write to a resolve_only A.2 resource outside a resolution is refused", () => {
    fresh();
    expect(() =>
      writeConstrainedValue({ entityId: world.resources.barIntegrity, key: "value", mode: "delta", value: -10 })
    ).toThrow(ConstraintViolationError);
    expect(getResource(world.resources.barIntegrity)?.value).toBe(100);
  });

  it("FILE to 0 then REPLACE_BAR is refused, naming the cut fact and the event that opened it", () => {
    fresh();
    // Drive bar_integrity to exactly 0.
    for (let n = 1; n <= 100 / FILE_AMOUNT + 2; n++) {
      world.clock.prisonerT(n);
      const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
      declareCutIfJustCut(world, outcome);
      if ((getResource(world.resources.barIntegrity)?.value ?? -1) <= 0) break;
    }
    expect(getResource(world.resources.barIntegrity)?.value).toBe(0);

    let caught: unknown;
    world.clock.wardenT(50);
    try {
      resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConstraintViolationError);
    const err = caught as ConstraintViolationError;
    expect(err.constraintKind).toBe("irreversible");
    expect(err.contradictedFact?.key).toBe("cut");
    expect(err.contradictedFact?.entityId).toBe(world.barId);
    expect(err.contradictedFact?.openedByEventId).not.toBeNull();

    // Rolled back completely: bar_integrity was not reset either.
    expect(getResource(world.resources.barIntegrity)?.value).toBe(0);
  });

  it("REPLACE_BAR before any cut succeeds, and valueHistory shows both intervals", () => {
    fresh();
    world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
    world.clock.wardenT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });

    expect(getResource(world.resources.barIntegrity)?.value).toBe(100);
    const history = valueHistory(world.resources.barIntegrity, "value");
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it("a parameters.note is appended to the outcome's description (opaque to the engine, read back from resolution.recorded)", () => {
    fresh();
    world.clock.wardenT(1);
    const outcome = resolver.resolve({
      gameId: world.gameId,
      mechanic: "REPLACE_BAR",
      parameters: { note: "seam-conformance-marker-xyz" },
    });
    const event = getDatabase()
      .prepare(`SELECT description FROM events WHERE game_id = ? AND kind = 'resolution.recorded' AND at_t = ?`)
      .get(world.gameId, outcome.t) as { description: string } | undefined;
    expect(event?.description).toContain("seam-conformance-marker-xyz");

    world.clock.wardenT(2);
    const plainOutcome = resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR" });
    const plainEvent = getDatabase()
      .prepare(`SELECT description FROM events WHERE game_id = ? AND kind = 'resolution.recorded' AND at_t = ?`)
      .get(world.gameId, plainOutcome.t) as { description: string } | undefined;
    expect(plainEvent?.description).not.toContain("(");
  });

  it("half-round alternation: the warden's writes land at even offsets from t0, the prisoner's at odd", () => {
    fresh();
    const t0 = world.clock.t0;

    const tw1 = world.clock.wardenT(1);
    const outcomeW = resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
    expect(outcomeW.t).toBe(tw1);
    expect(tw1 - t0).toBe(2);

    const tp1 = world.clock.prisonerT(1);
    const outcomeP = resolver.resolve({ gameId: world.gameId, mechanic: "WAIT" });
    expect(outcomeP.t).toBe(tp1);
    expect(tp1 - t0).toBe(3);
  });
});
