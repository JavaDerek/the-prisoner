import { describe, it, expect } from "vitest";
import { DERIVABLE_KINDS, DERIVABLE_KIND_IDS, findKind, composeDescription, parentLabel, type DerivableKind } from "../derivedObjects.js";
import { findObject, findProperty } from "../scenarioObjects.js";

/** OPEN-VARIANT.md §13.3: the derivable kinds, content the owner may cut. */
describe("derivable kinds (OPEN-VARIANT.md §13.3)", () => {
  it("has exactly the three kinds of the §13.3 table, then the two of §14.5, in order", () => {
    expect(DERIVABLE_KIND_IDS).toEqual(["wire", "strip", "grit", "hook", "cord"]);
  });

  it("every kind's parent is a §4.1 object or another declared kind (§14.1), and what it consumes is a property that parent declares, or nothing", () => {
    for (const kind of DERIVABLE_KINDS) {
      const parentKind = findKind(kind.parent);
      expect(findObject(kind.parent) ?? parentKind, kind.id).toBeDefined();
      if (kind.consumes !== null) {
        const declared = parentKind ? parentKind.properties.find((p) => p.key === kind.consumes) : findProperty(kind.parent, kind.consumes);
        expect(declared, `${kind.id} consumes ${kind.consumes}`).toBeDefined();
      }
    }
    expect(findKind("wire")?.consumes).toBe("integrity");
    expect(findKind("grit")?.consumes).toBeNull();
  });

  it("§14.5: hook reshapes a wire and cord a strip, each replacing its parent, consuming nothing, with the table's descriptions verbatim", () => {
    expect(findKind("hook")).toEqual(
      expect.objectContaining({
        parent: "wire",
        replacesParent: true,
        consumes: null,
        description: "A length of stiff iron wire about a hand long, bent back on itself at one end into a narrow hook, the rust flaked away along the bend.",
      })
    );
    expect(findKind("cord")).toEqual(
      expect.objectContaining({
        parent: "strip",
        replacesParent: true,
        consumes: null,
        description: "A cord of coarse grey wool about an arm long, twisted tight on itself and knotted at both ends.",
      })
    );
    for (const id of ["hook", "cord"]) {
      const props = findKind(id)?.properties ?? [];
      expect(props.map((p) => [p.key, p.initialValue])).toEqual([
        ["integrity", 100],
        ["concealment", 0],
      ]);
    }
    for (const id of ["wire", "strip", "grit"]) expect(findKind(id)?.replacesParent).toBe(false);
  });

  it("a kind that replaces its parent names a kind as parent and consumes nothing (§14.2)", () => {
    for (const kind of DERIVABLE_KINDS.filter((k) => k.replacesParent)) {
      expect(findKind(kind.parent), kind.id).toBeDefined();
      expect(kind.consumes, kind.id).toBeNull();
    }
  });

  it("parentLabel names a §4.1 parent by its id and a kind parent by the kind's label", () => {
    expect(parentLabel(findKind("wire") as DerivableKind)).toBe("cot");
    expect(parentLabel(findKind("grit") as DerivableKind)).toBe("loose tile");
    expect(parentLabel(findKind("hook") as DerivableKind)).toBe("length of wire");
    expect(parentLabel(findKind("cord") as DerivableKind)).toBe("strip of wool");
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
