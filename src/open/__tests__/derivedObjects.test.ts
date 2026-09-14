import { describe, it, expect } from "vitest";
import { DERIVABLE_KINDS, DERIVABLE_KIND_IDS, findKind, composeDescription } from "../derivedObjects.js";
import { findObject, findProperty } from "../scenarioObjects.js";

/** OPEN-VARIANT.md §13.3: the derivable kinds, content the owner may cut. */
describe("derivable kinds (OPEN-VARIANT.md §13.3)", () => {
  it("has exactly the three kinds of the §13.3 table, in order", () => {
    expect(DERIVABLE_KIND_IDS).toEqual(["wire", "strip", "grit"]);
  });

  it("every kind's parent is a §4.1 object, and what it consumes is a property that parent declares, or nothing", () => {
    for (const kind of DERIVABLE_KINDS) {
      expect(findObject(kind.parent), kind.id).toBeDefined();
      if (kind.consumes !== null) expect(findProperty(kind.parent, kind.consumes), `${kind.id} consumes ${kind.consumes}`).toBeDefined();
    }
    expect(findKind("wire")?.consumes).toBe("integrity");
    expect(findKind("grit")?.consumes).toBeNull();
  });

  it("every kind has an authored physical description and a label, and carries concealment so §10.1's perception rule applies", () => {
    for (const kind of DERIVABLE_KINDS) {
      expect(kind.description.length).toBeGreaterThan(20);
      expect(kind.label.length).toBeGreaterThan(0);
      const concealment = kind.properties.find((p) => p.key === "concealment");
      expect(concealment, kind.id).toBeDefined();
      expect(concealment?.initialValue).toBe(0);
    }
  });

  it("every property's magnitude table is strictly increasing, slight < moderate < substantial", () => {
    for (const kind of DERIVABLE_KINDS) {
      for (const property of kind.properties) {
        expect(property.wear.slight).toBeLessThan(property.wear.moderate);
        expect(property.wear.moderate).toBeLessThan(property.wear.substantial);
        expect(property.restore.slight).toBeLessThan(property.restore.moderate);
        expect(property.restore.moderate).toBeLessThan(property.restore.substantial);
      }
    }
  });

  it("a derived object's description is composed by code from the kind's authored text and the span cited from the parent (§13.2)", () => {
    const wire = DERIVABLE_KINDS[0];
    const text = composeDescription(wire, "cot", "the springs are held to the frame by twists of wire");
    expect(text).toBe(`${wire.description} It came away from the cot, where "the springs are held to the frame by twists of wire".`);
  });

  it("findKind returns undefined for anything outside the table", () => {
    expect(findKind("shiv")).toBeUndefined();
  });
});
