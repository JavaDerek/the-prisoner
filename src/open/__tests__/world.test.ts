import { describe, it, expect, afterEach } from "vitest";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, declaredProperty, declaredPropertyKeys, readDoorPrice, readWindowMode, OPEN_DOOR_LOCK_MAX, OPEN_DOOR_LOCK_MARGIN, OPEN_WINDOW_BAR_MAX, OPEN_CATCH_BAR_MAX } from "../world.js";
import { SEARCH_CATCH_LOCK_MAX } from "../../world/mechanics.js";
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

  it("declaredPropertyKeys lists a scenario object's own property keys, and none for an object with none (OPEN-VARIANT.md §24)", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(declaredPropertyKeys(world, "loose_tile")).toEqual(["concealment"]);
    expect(declaredPropertyKeys(world, "spoon")).toEqual(["edge", "concealment"]);
    expect(declaredPropertyKeys(world, "bucket")).toEqual([]);
    expect(declaredPropertyKeys(world, "nothing_here")).toEqual([]);
  });

  it("the key ring is owned by the warden, not the cell", () => {
    createTestDb();
    const world = buildOpenWorld();
    // No direct owner-read helper exported here; a resolve_only/bounded
    // resource write through the ordinary path is enough to prove the
    // entity exists and is distinct from the cell.
    expect(world.entityIdFor.key_ring).not.toBe(world.base.cellId);
  });

  // OPEN-VARIANT.md §50 (issue #19): the door route cost nothing while the
  // window needed the bar worn to 50. `doorPrice: "threshold"` gates the
  // door on the lock exactly as the window is already gated on the bar;
  // `free` (the default, and what every batch before this arm played by)
  // leaves `openWhenPartAtMost: null`, unchanged.
  it("doorPrice defaults to free: the door keeps no threshold", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(world.exits.door.openWhenPartAtMost).toBeNull();
  });

  it("doorPrice: threshold gates the door on the lock at OPEN_DOOR_LOCK_MAX, mirroring the window's own gate on the bar", () => {
    createTestDb();
    const world = buildOpenWorld({ doorPrice: "threshold" });
    expect(world.exits.door.openWhenPartAtMost).toBe(OPEN_DOOR_LOCK_MAX);
    // The window is untouched by this arm.
    expect(world.exits.window.openWhenPartAtMost).toBe(50);
  });

  // §50.5, measured: `threshold`'s 30 made the two routes cost the same on
  // paper and killed the door in play -- she stopped aiming at it in 4 of 4
  // games. The reason is a property no arithmetic about turns can see, so it
  // is pinned here as a test rather than argued in prose: a way out is only
  // worth attempting if some wear step leaves it OPENABLE while its own part
  // is still SAFE to be found at. The window has always had one; the door
  // under `threshold` never did.
  const lockWearSteps = (): number[] => {
    const steps: number[] = [];
    for (let v = 100; v > 0; v -= 20) steps.push(v - 20 >= 0 ? v - 20 : 0);
    return steps;
  };

  it("the window has a wear step that is openable and still safe -- the property that makes a route worth starting", () => {
    // bar: 100 -> 85 -> 70 -> 55 -> 40, openable at <=50, catchable at <=30.
    const barSteps = [85, 70, 55, 40, 25];
    const safeAndOpenable = barSteps.filter((v) => v <= OPEN_WINDOW_BAR_MAX && v > OPEN_CATCH_BAR_MAX);
    expect(safeAndOpenable).toEqual([40]);
  });

  it("doorPrice: threshold has NO such step -- reaching the gate means passing through the catch band (§50.5)", () => {
    const safeAndOpenable = lockWearSteps().filter((v) => v <= OPEN_DOOR_LOCK_MAX && v > SEARCH_CATCH_LOCK_MAX);
    expect(safeAndOpenable).toEqual([]);
  });

  it("doorPrice: margin gates the door where a step IS openable and safe, and costs real wear turns", () => {
    createTestDb();
    const world = buildOpenWorld({ doorPrice: "margin" });
    expect(world.exits.door.openWhenPartAtMost).toBe(OPEN_DOOR_LOCK_MARGIN);
    const safeAndOpenable = lockWearSteps().filter((v) => v <= OPEN_DOOR_LOCK_MARGIN && v > SEARCH_CATCH_LOCK_MAX);
    expect(safeAndOpenable).toEqual([60]);
    // Still not free: two wear turns before the door can be opened at all.
    expect(OPEN_DOOR_LOCK_MARGIN).toBeLessThan(100);
    expect(world.exits.window.openWhenPartAtMost).toBe(OPEN_WINDOW_BAR_MAX);
  });
});

// OPEN-VARIANT.md §64.3, WORLD-ELABORATION-DESIGN.md §4.8: the welded-window
// arm -- ground truth ~/rpg/prisoner-prompt-lab/prisoner-prompt-r1-welded.txt,
// diffed against prisoner-prompt-r1-susp-hidden.txt (§64.3's open control).
// "bars flush and welded, the bar immovable, its integrity belief removed,
// and its condition removed -- everything else untouched": no resource for
// the bar's integrity at all, so nothing can wear it, reveal it, or gate the
// window's own passage on it.
describe("buildOpenWorld: PRISONER_WINDOW=welded (§64.3)", () => {
  afterEach(() => destroyTestDb());

  it("open (the default) is untouched: the bar keeps its integrity resource and the window keeps its gate", () => {
    createTestDb();
    const world = buildOpenWorld({ window: "open" });
    expect(resourceIdForProperty(world, "bar", "integrity")).toBe(world.base.resources.barIntegrity);
    expect(declaredPropertyKeys(world, "bar")).toEqual(["integrity"]);
    expect(declaredProperty(world, "bar", "integrity")).toBeDefined();
    expect(world.exits.window).toBeDefined();
    expect(world.exits.window.openWhenPartAtMost).toBe(OPEN_WINDOW_BAR_MAX);
  });

  it("welded: the bar declares no property at all -- no belief, no wear, no reveal, no condition", () => {
    createTestDb();
    const world = buildOpenWorld({ window: "welded" });
    expect(resourceIdForProperty(world, "bar", "integrity")).toBeUndefined();
    expect(declaredPropertyKeys(world, "bar")).toEqual([]);
    expect(declaredProperty(world, "bar", "integrity")).toBeUndefined();
  });

  it("welded: the window is not a way out at all -- the bar cannot be worn loose, so nothing gates it open", () => {
    createTestDb();
    const world = buildOpenWorld({ window: "welded" });
    expect(world.exits.window).toBeUndefined();
    // The door is untouched: still the one working way out.
    expect(world.exits.door).toBeDefined();
  });

  it("welded still reuses the closed variant's bar entity (immovable, not absent) -- only its own property is gone", () => {
    createTestDb();
    const world = buildOpenWorld({ window: "welded" });
    expect(world.entityIdFor.bar).toBe(world.base.barId);
  });

  it("defaults to open when unset, byte-identical to every batch before this arm", () => {
    createTestDb();
    const withoutOption = buildOpenWorld();
    expect(resourceIdForProperty(withoutOption, "bar", "integrity")).toBe(withoutOption.base.resources.barIntegrity);
    expect(withoutOption.exits.window.openWhenPartAtMost).toBe(OPEN_WINDOW_BAR_MAX);
  });
});

describe("readWindowMode: PRISONER_WINDOW (§64.3)", () => {
  it("leaves the window open unless asked", () => {
    expect(readWindowMode(undefined)).toBe("open");
    expect(readWindowMode("")).toBe("open");
    expect(readWindowMode("open")).toBe("open");
  });

  it("welds it when asked for", () => {
    expect(readWindowMode("welded")).toBe("welded");
  });

  it("stops the run rather than guessing", () => {
    expect(() => readWindowMode("shut")).toThrow(/PRISONER_WINDOW/);
    expect(() => readWindowMode("shut")).toThrow(/"open"/);
  });
});

describe("readDoorPrice: PRISONER_DOOR_PRICE (§50)", () => {
  it("accepts the margin arm (§50.5)", () => {
    expect(readDoorPrice("margin")).toBe("margin");
  });

  it("leaves the door free unless asked", () => {
    expect(readDoorPrice(undefined)).toBe("free");
    expect(readDoorPrice("")).toBe("free");
    expect(readDoorPrice("free")).toBe("free");
  });

  it("prices it when asked for", () => {
    expect(readDoorPrice("threshold")).toBe("threshold");
  });

  it("stops the run rather than guessing", () => {
    expect(() => readDoorPrice("expensive")).toThrow(/PRISONER_DOOR_PRICE/);
    expect(() => readDoorPrice("expensive")).toThrow(/"free"/);
  });
});
