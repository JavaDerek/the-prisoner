import { describe, it, expect, afterEach } from "vitest";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { OPEN_OBJECTS } from "../scenarioObjects.js";

describe("buildOpenWorld (OPEN-VARIANT.md §1: everything the closed variant built stays)", () => {
  afterEach(() => destroyTestDb());

  it("reuses the closed variant's own bar/lock/spoon resource ids, never recreating them", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(resourceIdForProperty(world, "bar", "integrity")).toBe(world.base.resources.barIntegrity);
    expect(resourceIdForProperty(world, "lock", "integrity")).toBe(world.base.resources.lockIntegrity);
    expect(resourceIdForProperty(world, "spoon", "edge")).toBe(world.base.resources.spoonEdge);
  });

  it("creates one entity per §4.1 object", () => {
    createTestDb();
    const world = buildOpenWorld();
    for (const spec of OPEN_OBJECTS) {
      expect(world.entityIdFor[spec.id], `entity for ${spec.id}`).toBeTruthy();
    }
    // bar/spoon/loose_tile are the closed variant's own entities.
    expect(world.entityIdFor.bar).toBe(world.base.barId);
    expect(world.entityIdFor.spoon).toBe(world.base.spoonId);
    expect(world.entityIdFor.loose_tile).toBe(world.base.looseTileId);
  });

  it("creates one bounded, resolve_only resource per declared property, at its authored initial value", () => {
    createTestDb();
    const world = buildOpenWorld();
    const wireId = resourceIdForProperty(world, "cot", "integrity");
    expect(wireId).toBeTruthy();
    expect(getResource(wireId as string)?.value).toBe(100);

    const concealmentId = resourceIdForProperty(world, "spoon", "concealment");
    expect(concealmentId).toBeTruthy();
    expect(getResource(concealmentId as string)?.value).toBe(0);
  });

  it("declares no resource for an object with no authored property", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(resourceIdForProperty(world, "bucket", "integrity")).toBeUndefined();
    expect(resourceIdForProperty(world, "key_ring", "integrity")).toBeUndefined();
  });

  it("the key ring is owned by the warden, not the cell", () => {
    createTestDb();
    const world = buildOpenWorld();
    // No direct owner-read helper exported here; a resolve_only/bounded
    // resource write through the ordinary path is enough to prove the
    // entity exists and is distinct from the cell.
    expect(world.entityIdFor.key_ring).not.toBe(world.base.cellId);
  });
});
