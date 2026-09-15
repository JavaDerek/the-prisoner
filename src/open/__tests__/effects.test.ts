import { describe, it, expect } from "vitest";
import { planEffect } from "../effects.js";

const entityIdFor = { bar: "e-bar", spoon: "e-spoon", bucket: "e-bucket" };
const resourceIdFor = { "bar.integrity": "r-bar", "spoon.edge": "r-edge", "spoon.concealment": "r-conceal" };

describe("planEffect (this task's brief: 'effects become resolutions')", () => {
  it("wear on a declared property builds OPEN_WEAR with the scenario's own magnitude", () => {
    const plan = planEffect({
      targetObjectId: "bar",
      effectKind: "wear",
      property: "integrity",
      magnitude: "moderate",
      entityIdFor,
      resourceIdFor,
      description: "files at the bar",
    });
    expect(plan?.mechanic).toBe("OPEN_WEAR");
    expect(plan?.parameters.amount).toBe(15); // FILE_AMOUNT carried over
    expect(plan?.isWearType).toBe(true);
  });

  it("restore builds OPEN_RESTORE", () => {
    const plan = planEffect({
      targetObjectId: "spoon",
      effectKind: "restore",
      property: "edge",
      magnitude: "moderate",
      entityIdFor,
      resourceIdFor,
      description: "hones the spoon",
    });
    expect(plan?.mechanic).toBe("OPEN_RESTORE");
    expect(plan?.parameters.amount).toBe(10); // HONE_AMOUNT carried over
    expect(plan?.isWearType).toBe(false);
  });

  it("reveal builds OPEN_REVEAL with no amount", () => {
    const plan = planEffect({
      targetObjectId: "bar",
      effectKind: "reveal",
      property: "integrity",
      magnitude: "slight",
      entityIdFor,
      resourceIdFor,
      description: "inspects the bar",
    });
    expect(plan?.mechanic).toBe("OPEN_REVEAL");
    expect(plan?.parameters.amount).toBeUndefined();
  });

  it("conceal only applies against the concealment property", () => {
    const good = planEffect({
      targetObjectId: "spoon",
      effectKind: "conceal",
      property: "concealment",
      magnitude: "substantial",
      entityIdFor,
      resourceIdFor,
      description: "hides the spoon",
    });
    expect(good?.mechanic).toBe("OPEN_RESTORE");
    expect(good?.isWearType).toBe(false);

    const incoherent = planEffect({
      targetObjectId: "spoon",
      effectKind: "conceal",
      property: "edge",
      magnitude: "substantial",
      entityIdFor,
      resourceIdFor,
      description: "hides the spoon",
    });
    expect(incoherent).toBeNull();
  });

  it("expose is a wear-type effect on concealment", () => {
    const plan = planEffect({
      targetObjectId: "spoon",
      effectKind: "expose",
      property: "concealment",
      magnitude: "substantial",
      entityIdFor,
      resourceIdFor,
      description: "exposes the spoon",
    });
    expect(plan?.mechanic).toBe("OPEN_WEAR");
    expect(plan?.isWearType).toBe(true);
  });

  it("noise needs no property at all", () => {
    const plan = planEffect({
      targetObjectId: "bucket",
      effectKind: "noise",
      property: "none",
      magnitude: "slight",
      entityIdFor,
      resourceIdFor,
      description: "the bucket rings",
    });
    expect(plan?.mechanic).toBe("OPEN_NOISE");
    expect(plan?.resourceId).toBeNull();
  });

  it("'none' effect plans nothing", () => {
    expect(
      planEffect({ targetObjectId: "bar", effectKind: "none", property: "none", magnitude: "slight", entityIdFor, resourceIdFor, description: "" })
    ).toBeNull();
  });

  it("a property not declared on the target object plans nothing -- 'no invented world'", () => {
    expect(
      planEffect({
        targetObjectId: "bucket", // bucket has no declared property at all
        effectKind: "wear",
        property: "integrity",
        magnitude: "moderate",
        entityIdFor,
        resourceIdFor,
        description: "",
      })
    ).toBeNull();
  });

  it("an unknown target object plans nothing", () => {
    expect(
      planEffect({
        targetObjectId: "the-warden's-desk",
        effectKind: "wear",
        property: "integrity",
        magnitude: "moderate",
        entityIdFor,
        resourceIdFor,
        description: "",
      })
    ).toBeNull();
  });
});

describe("planEffect: derive (OPEN-VARIANT.md §13.5)", () => {
  const cotIds = { entityIdFor: { cot: "e-cot", loose_tile: "e-tile" }, resourceIdFor: { "cot.integrity": "r-cot" } };
  const derive = { actorId: "c-prisoner", ownerLocationId: "l-cell", newObjectId: "wire", parentSpan: "the springs are held to the frame by twists of wire" };

  it("builds OPEN_DERIVE: the parent's consumed property worn by the parent's own table, the item held by the maker, one resource per declared property, refs linking them", () => {
    const plan = planEffect({ targetObjectId: "cot", effectKind: "derive", property: "integrity", magnitude: "moderate", ...cotIds, derive: { ...derive, product: "wire" }, description: "works a piece loose" });
    expect(plan?.mechanic).toBe("OPEN_DERIVE");
    expect(plan?.resourceId).toBe("r-cot");
    expect(plan?.isWearType).toBe(true);
    expect(plan?.parameters.parent).toEqual({ resourceId: "r-cot", amount: 20, min: 0, max: 100 }); // cot integrity wear moderate
    expect(plan?.parameters.item).toEqual(expect.objectContaining({ ownerId: "c-prisoner", name: "the length of wire" }));
    expect(JSON.parse((plan?.parameters.item as { properties: string }).properties)).toEqual(expect.objectContaining({ kind: "wire", derivedFrom: "cot" }));
    const resources = plan?.parameters.resources as { ref: string; name: string; value: number; min: number; max: number; ownerId: string }[];
    expect(resources.map((r) => r.ref)).toEqual(["property:integrity", "property:concealment"]);
    expect(resources.map((r) => r.name)).toEqual(["wire_integrity", "wire_concealment"]);
    expect(resources[1]).toEqual(expect.objectContaining({ value: 0, min: 0, max: 100, ownerId: "l-cell" }));
    expect(plan?.derived).toEqual(expect.objectContaining({ id: "wire", kindId: "wire" }));
    expect(plan?.derived?.description).toContain('It came away from the cot, where "the springs are held to the frame by twists of wire".');
  });

  it("a kind that consumes nothing has no parent leg and needs property none", () => {
    const plan = planEffect({ targetObjectId: "loose_tile", effectKind: "derive", property: "none", magnitude: "slight", ...cotIds, derive: { ...derive, product: "grit", newObjectId: "grit" }, description: "x" });
    expect(plan?.parameters.parent).toBeNull();
    expect(plan?.resourceId).toBeNull();
    expect(plan?.isWearType).toBe(false);
    expect(planEffect({ targetObjectId: "loose_tile", effectKind: "derive", property: "integrity", magnitude: "slight", ...cotIds, derive: { ...derive, product: "grit" }, description: "x" })).toBeNull();
  });

  it("refuses: product none, an unknown product, a product whose parent is not the target, a property other than what the kind consumes, and no derive details at all", () => {
    const base = { targetObjectId: "cot", effectKind: "derive" as const, magnitude: "moderate" as const, ...cotIds, description: "x" };
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "none" } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "shiv" } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "strip" } })).toBeNull();
    expect(planEffect({ ...base, property: "none", derive: { ...derive, product: "wire" } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity" })).toBeNull();
  });
});

describe("planEffect: reshaping (OPEN-VARIANT.md §14.2)", () => {
  const ids = { entityIdFor: { wire_2: "e-wire", cot: "e-cot" }, resourceIdFor: {} };
  const wireParent = {
    kindId: "wire",
    heldBy: "prisoner" as const,
    holderId: "c-prisoner",
    entityId: "e-wire",
    resources: [
      { key: "integrity" as const, resourceId: "r-wire-int" },
      { key: "concealment" as const, resourceId: "r-wire-con" },
    ],
  };
  const derive = { product: "hook", actorId: "c-warden", ownerLocationId: "l-cell", newObjectId: "hook", parentSpan: "with a kink at one end" };
  const base = { targetObjectId: "wire_2", effectKind: "derive" as const, magnitude: "slight" as const, ...ids, description: "x" };

  it("destroys the parent's resources and item, gives the product to the parent's holder, and carries each shared property from the parent's resource", () => {
    const plan = planEffect({ ...base, property: "none", derive: { ...derive, parent: wireParent } });
    expect(plan?.mechanic).toBe("OPEN_DERIVE");
    expect(plan?.parameters.parent).toBeNull();
    expect(plan?.parameters.destroy).toEqual(["r-wire-int", "r-wire-con", "e-wire"]);
    expect(plan?.parameters.item).toEqual(expect.objectContaining({ ownerId: "c-prisoner", name: "the hook" }));
    const resources = plan?.parameters.resources as { ref: string; carryFrom?: string }[];
    expect(resources.map((r) => [r.ref, r.carryFrom])).toEqual([
      ["property:integrity", "r-wire-int"],
      ["property:concealment", "r-wire-con"],
    ]);
    expect(plan?.derived?.replaces).toEqual({ id: "wire_2", kindId: "wire", heldBy: "prisoner" });
    expect(plan?.derived?.description).toContain('It came away from the length of wire, where "with a kink at one end".');
  });

  it("refuses: a target with no recorded kind, a target of another kind, a property named, and a kind parent matched by id alone", () => {
    expect(planEffect({ ...base, property: "none", derive })).toBeNull();
    expect(planEffect({ ...base, property: "none", derive: { ...derive, parent: { ...wireParent, kindId: "strip" } } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, parent: wireParent } })).toBeNull();
    expect(planEffect({ ...base, targetObjectId: "wire", entityIdFor: { wire: "e-wire" }, property: "none", derive })).toBeNull();
  });

  it("a derivation that takes a piece destroys nothing", () => {
    const plan = planEffect({ targetObjectId: "cot", effectKind: "derive", property: "integrity", magnitude: "slight", entityIdFor: { cot: "e-cot" }, resourceIdFor: { "cot.integrity": "r-cot" }, derive: { ...derive, product: "wire", newObjectId: "wire" }, description: "x" });
    expect(plan?.parameters.destroy).toEqual([]);
    expect(plan?.derived?.replaces).toBeNull();
  });
});
