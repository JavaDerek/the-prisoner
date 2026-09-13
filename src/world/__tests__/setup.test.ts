import { describe, it, expect, afterEach } from "vitest";
import { getResource, getCharacter, getItem, currentStoryTime } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../testDb.js";
import { buildWorld } from "../setup.js";
import { readNumericFact } from "../facts.js";

describe("buildWorld() -- design Appendix A's world, in engine terms", () => {
  afterEach(() => {
    destroyTestDb();
  });

  it("creates one cell, two characters (warden is_player, prisoner not)", () => {
    createTestDb();
    const world = buildWorld();

    const warden = getCharacter(world.wardenId);
    const prisoner = getCharacter(world.prisonerId);
    expect(warden?.isPlayer).toBe(true);
    expect(prisoner?.isPlayer).toBe(false);
    expect(warden?.locationId).toBe(world.cellId);
    expect(prisoner?.locationId).toBe(world.cellId);
  });

  it("creates the five A.2 resources bounded 0-100 and starting at their authored values", () => {
    createTestDb();
    const world = buildWorld();

    expect(getResource(world.resources.barIntegrity)).toMatchObject({ value: 100, minValue: 0, maxValue: 100 });
    expect(getResource(world.resources.lockIntegrity)).toMatchObject({ value: 100, minValue: 0, maxValue: 100 });
    expect(getResource(world.resources.spoonEdge)).toMatchObject({ value: 0, minValue: 0, maxValue: 100 });
    expect(getResource(world.resources.wardenSuspicion)).toMatchObject({ value: 0, minValue: 0, maxValue: 100 });
    expect(getResource(world.resources.guardAttention)).toMatchObject({ value: 50, minValue: 0, maxValue: 100 });
  });

  it("creates the bar and the loose tile owned by the cell, the spoon owned by the prisoner", () => {
    createTestDb();
    const world = buildWorld();

    expect(getItem(world.barId)).toMatchObject({ ownerId: world.cellId, ownerType: "location" });
    expect(getItem(world.looseTileId)).toMatchObject({ ownerId: world.cellId, ownerType: "location" });
    expect(getItem(world.spoonId)).toMatchObject({ ownerId: world.prisonerId, ownerType: "character" });

    expect(readNumericFact({ gameId: world.gameId, t: world.clock.t0, entityId: world.barId, key: "cut" })).toBe(0);
    expect(
      readNumericFact({ gameId: world.gameId, t: world.clock.t0, entityId: world.looseTileId, key: "concealed" })
    ).toBe(0);
  });

  it("declares the counter/half-round axis before authoring the rest of the world, so every entity lands at t0", () => {
    createTestDb();
    const world = buildWorld();

    const story = currentStoryTime(world.gameId);
    expect(story?.axis).toEqual({ kind: "counter", unit: "half-round" });
    expect(story?.t).toBe(world.clock.t0);
  });

  it("the half-round clock alternates warden (even offset) and prisoner (odd offset) t's", () => {
    createTestDb();
    const world = buildWorld();
    const t0 = world.clock.t0;

    expect(world.clock.wardenT(1)).toBe(t0 + 2);
    expect(world.clock.prisonerT(1)).toBe(t0 + 3);
    expect(world.clock.wardenT(2)).toBe(t0 + 4);
    expect(world.clock.prisonerT(2)).toBe(t0 + 5);
  });
});
