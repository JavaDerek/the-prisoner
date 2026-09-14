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
