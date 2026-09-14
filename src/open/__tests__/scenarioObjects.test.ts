import { describe, it, expect } from "vitest";
import { OPEN_OBJECTS, OPEN_OBJECT_IDS, findObject, findProperty } from "../scenarioObjects.js";

describe("open-variant scenario objects (OPEN-VARIANT.md §4.1)", () => {
  it("has exactly the nine objects of the §4.1 table, in order", () => {
    expect(OPEN_OBJECT_IDS).toEqual([
      "bar",
      "lock",
      "spoon",
      "loose_tile",
      "cot",
      "blanket",
      "bucket",
      "meal_tray",
      "key_ring",
    ]);
  });

  it("every description is non-empty authored content, not engine or seam vocabulary", () => {
    for (const object of OPEN_OBJECTS) {
      expect(object.description.length).toBeGreaterThan(20);
      expect(object.heldBy.length).toBeGreaterThan(0);
    }
  });

  it("carries over the closed variant's numbers for bar/lock/spoon", () => {
    expect(findProperty("bar", "integrity")?.wear.moderate).toBe(15); // FILE_AMOUNT
    expect(findProperty("bar", "integrity")?.wear.substantial).toBe(25); // FILE_AMOUNT_SHARP
    expect(findProperty("bar", "integrity")?.restore.substantial).toBe(100); // REPLACE_BAR
    expect(findProperty("lock", "integrity")?.wear.moderate).toBe(20); // SHIM_AMOUNT
    expect(findProperty("lock", "integrity")?.restore.substantial).toBe(100); // SERVICE_LOCK
    expect(findProperty("spoon", "edge")?.restore.moderate).toBe(10); // HONE_AMOUNT
  });

  it("every property's magnitude table is strictly increasing, slight < moderate < substantial", () => {
    for (const object of OPEN_OBJECTS) {
      // `passage` is exempt: open/close set it end to end and never read its tables (OPEN-VARIANT.md §12).
      for (const property of object.properties.filter((p) => p.key !== "passage")) {
        expect(property.wear.slight).toBeLessThan(property.wear.moderate);
        expect(property.wear.moderate).toBeLessThan(property.wear.substantial);
        expect(property.restore.slight).toBeLessThan(property.restore.moderate);
        expect(property.restore.moderate).toBeLessThan(property.restore.substantial);
      }
    }
  });

  it("objects with no authored numeric property (bucket, meal tray, key ring, loose tile) have none", () => {
    for (const id of ["loose_tile", "bucket", "meal_tray", "key_ring"]) {
      expect(findObject(id)?.properties).toEqual([]);
    }
  });

  it("findObject/findProperty return undefined for anything outside the scenario", () => {
    expect(findObject("the-warden's-sidearm")).toBeUndefined();
    expect(findProperty("bar", "concealment")).toBeUndefined();
  });
});
