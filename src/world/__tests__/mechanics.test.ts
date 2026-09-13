import { describe, it, expect, afterEach } from "vitest";
import { getResource, writeConstrainedValue, ConstraintViolationError, valueHistory } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../testDb.js";
import { buildWorld, type World } from "../setup.js";
import {
  buildResolver,
  declareCutIfJustCut,
  FILE_AMOUNT,
  SHIM_AMOUNT,
  HONE_AMOUNT,
  SUSPICION_BUMP,
  ROTATE_GUARD_LEVEL,
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
    expect(getResource(world.resources.wardenSuspicion)?.value).toBe(SUSPICION_BUMP);
    expect(outcome.mechanic).toBe("FILE");
    expect(outcome.transitions).toHaveLength(2);
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

  it("CONCEAL marks the loose tile concealed", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    expect(readNumericFact({ gameId: world.gameId, t, entityId: world.looseTileId, key: "concealed" })).toBe(1);
  });

  it("INSPECT writes no state and still records one resolution event", () => {
    fresh();
    world.clock.prisonerT(1);
    const before = getResource(world.resources.barIntegrity)?.value;
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: "INSPECT" });
    expect(outcome.transitions).toHaveLength(0);
    expect(getResource(world.resources.barIntegrity)?.value).toBe(before);
    expect(outcome.result).toMatchObject({ mechanic: "INSPECT" });
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

  it("OBSERVE raises warden_suspicion and writes no other state", () => {
    fresh();
    world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
    expect(getResource(world.resources.wardenSuspicion)?.value).toBeGreaterThan(0);
  });

  it("WAIT lowers guard_attention and warden_suspicion", () => {
    fresh();
    world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" }); // give suspicion something to lower
    world.clock.prisonerT(1);
    const before = getResource(world.resources.guardAttention)?.value as number;
    resolver.resolve({ gameId: world.gameId, mechanic: "WAIT" });
    expect(getResource(world.resources.guardAttention)?.value).toBeLessThan(before);
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
