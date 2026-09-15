import { describe, it, expect } from "vitest";
import { OPEN_OBJECTS, OPEN_OBJECT_IDS, findObject, findProperty } from "../scenarioObjects.js";

describe("open-variant scenario objects (OPEN-VARIANT.md §4.1)", () => {
  it("has the §4.1 objects in order, each way out (§17.1) just before its part, then the banknotes of §15.3", () => {
    expect(OPEN_OBJECT_IDS).toEqual([
      "window",
      "bar",
      "door",
      "lock",
      "spoon",
      "loose_tile",
      "cot",
      "blanket",
      "bucket",
      "meal_tray",
      "key_ring",
      "banknotes",
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

  it("objects with no authored numeric property (bucket, meal tray, key ring) have none", () => {
    // The loose tile was in this list until OPEN-VARIANT.md §15.2 gave it `concealment`.
    for (const id of ["bucket", "meal_tray", "key_ring"]) {
      expect(findObject(id)?.properties).toEqual([]);
    }
  });

  it("the loose tile declares concealment starting at 100, with the spoon's own wear/restore tables (§15.2)", () => {
    const tile = findProperty("loose_tile", "concealment");
    const spoon = findProperty("spoon", "concealment");
    expect(tile).toEqual(expect.objectContaining({ key: "concealment", resourceName: "loose_tile_concealment", min: 0, max: 100, initialValue: 100 }));
    expect(tile?.wear).toEqual(spoon?.wear);
    expect(tile?.restore).toEqual(spoon?.restore);
    expect(findObject("loose_tile")?.properties.map((p) => p.key)).toEqual(["concealment"]);
  });

  it("the banknotes are held in the loose tile, with §15.3's description verbatim and concealment 0 (§15.3)", () => {
    const notes = findObject("banknotes");
    expect(notes?.heldIn).toBe("loose_tile");
    expect(notes?.description).toBe("A fold of banknotes wrapped in a strip of oilcloth, ten notes of a hundred each, soft and grey with damp.");
    expect(notes?.properties.map((p) => p.key)).toEqual(["concealment"]);
    expect(findProperty("banknotes", "concealment")).toEqual(expect.objectContaining({ resourceName: "banknotes_concealment", min: 0, max: 100, initialValue: 0 }));
  });

  it("every heldIn names a scenario object that declares concealment, the property that gates what it holds (§15.1)", () => {
    const held = OPEN_OBJECTS.filter((o) => o.heldIn !== undefined);
    expect(held.map((o) => o.id)).toEqual(["banknotes"]);
    for (const object of held) {
      expect(findProperty(object.heldIn as string, "concealment"), `${object.id} held in ${object.heldIn}`).toBeDefined();
    }
  });

  it("the ways out are objects of their own, with §17.1's descriptions verbatim; passage moved to them, integrity stayed on their parts (§17.1)", () => {
    const door = findObject("door");
    expect(door?.heldBy).toBe("the cell wall");
    expect(door?.description).toBe(
      "A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap."
    );
    expect(door?.properties.map((p) => p.key)).toEqual(["passage"]);
    expect(findProperty("door", "passage")).toEqual(expect.objectContaining({ resourceName: "door_passage", min: 0, max: 1, initialValue: 0 }));

    const lock = findObject("lock");
    expect(lock?.heldBy).toBe("the cell door");
    expect(lock?.description).toBe("A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame.");
    expect(lock?.properties.map((p) => p.key)).toEqual(["integrity"]);

    const window = findObject("window");
    expect(window?.heldBy).toBe("the cell wall");
    expect(window?.description).toBe("A small window high in the wall, a little wider than a person's shoulders, barred by five vertical iron bars.");
    expect(window?.properties.map((p) => p.key)).toEqual(["passage"]);
    expect(findProperty("window", "passage")).toEqual(expect.objectContaining({ resourceName: "window_passage", min: 0, max: 1, initialValue: 0 }));

    const bar = findObject("bar");
    expect(bar?.heldBy).toBe("the window");
    expect(bar?.description).toBe(
      "One of five vertical iron bars in the cell's small window, about as thick as a thumb. Rust has pitted it near the bottom, where it is set into old mortar that is dry and cracked."
    );
    expect(bar?.properties.map((p) => p.key)).toEqual(["integrity"]);
  });

  it("findObject/findProperty return undefined for anything outside the scenario", () => {
    expect(findObject("the-warden's-sidearm")).toBeUndefined();
    expect(findProperty("bar", "concealment")).toBeUndefined();
  });
});
