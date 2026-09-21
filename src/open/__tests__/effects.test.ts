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

  it("a kind that consumes nothing has no parent leg, whatever property the referee named (§25)", () => {
    const plan = planEffect({ targetObjectId: "loose_tile", effectKind: "derive", property: "none", magnitude: "slight", ...cotIds, derive: { ...derive, product: "grit", newObjectId: "grit" }, description: "x" });
    expect(plan?.parameters.parent).toBeNull();
    expect(plan?.resourceId).toBeNull();
    expect(plan?.isWearType).toBe(false);
    expect(planEffect({ targetObjectId: "loose_tile", effectKind: "derive", property: "concealment", magnitude: "slight", ...cotIds, derive: { ...derive, product: "grit" }, description: "x" })?.parameters.parent).toBeNull();
  });

  it("refuses: product none, an unknown product, a product whose parent is not the target, and no derive details at all; a property answer never decides (§25)", () => {
    const base = { targetObjectId: "cot", effectKind: "derive" as const, magnitude: "moderate" as const, ...cotIds, description: "x" };
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "none" } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "shiv" } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, product: "strip" } })).toBeNull();
    expect(planEffect({ ...base, property: "none", derive: { ...derive, product: "wire" } })?.parameters.parent).not.toBeNull();
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

  it("refuses: a target with no recorded kind, a target of another kind, and a kind parent matched by id alone; a property named does not refuse (§25)", () => {
    expect(planEffect({ ...base, property: "none", derive })).toBeNull();
    expect(planEffect({ ...base, property: "none", derive: { ...derive, parent: { ...wireParent, kindId: "strip" } } })).toBeNull();
    expect(planEffect({ ...base, property: "integrity", derive: { ...derive, parent: wireParent } })).not.toBeNull();
    expect(planEffect({ ...base, targetObjectId: "wire", entityIdFor: { wire: "e-wire" }, property: "none", derive })).toBeNull();
  });

  it("a derivation that takes a piece destroys nothing", () => {
    const plan = planEffect({ targetObjectId: "cot", effectKind: "derive", property: "integrity", magnitude: "slight", entityIdFor: { cot: "e-cot" }, resourceIdFor: { "cot.integrity": "r-cot" }, derive: { ...derive, product: "wire", newObjectId: "wire" }, description: "x" });
    expect(plan?.parameters.destroy).toEqual([]);
    expect(plan?.derived?.replaces).toBeNull();
  });
});

// OPEN-VARIANT.md §55 (issue #22, gap 2): a perceived principal is now a
// legal target, on the same terms as a perceived object -- `entityIdFor`
// merged with the principal's own character id, exactly the way every
// other caller of `planEffect` already merges in whatever this half-round's
// world declares (loop.ts). No world/entityIdFor change was needed to make
// this legal: the map is generic, this is just a new kind of value in it.
describe("planEffect: a perceived principal as a target (OPEN-VARIANT.md §55, issue #22 gap 2)", () => {
  const withPrincipals = { ...entityIdFor, prisoner: "e-prisoner", warden: "e-warden" };

  it("noise ruled at a perceived principal builds OPEN_NOISE with no resource at all -- nothing here can ever write a belief", () => {
    const plan = planEffect({
      targetObjectId: "warden",
      effectKind: "noise",
      property: "none",
      magnitude: "moderate",
      entityIdFor: withPrincipals,
      resourceIdFor,
      description: "calls out to the warden",
    });
    expect(plan?.mechanic).toBe("OPEN_NOISE");
    expect(plan?.resourceId).toBeNull();
    expect(plan?.isWearType).toBe(false);
  });

  // THE GROUNDING RULE (SOCIAL-INTENTS.md, the owner's own reason for
  // approving it): a state change must be grounded in a citation describing
  // the physical act, never in the claim about the act. No property is
  // declared for a principal at all (gap 3, deliberately not built here --
  // "with a person's own state as bounded numeric properties" is the NEXT
  // agent's job), so every effect that would WRITE something refuses,
  // exactly the "no invented world" discipline `effects.ts`'s own comment
  // already applies to an incoherent conceal/expose ruling -- never a
  // guess at what property a person-directed `wear` or `conceal` could
  // possibly mean.
  it("PLANTED VIOLATION: a wear/restore/conceal/expose ruled at a perceived principal is refused -- no property is declared for a person", () => {
    for (const effectKind of ["wear", "restore", "conceal", "expose"] as const) {
      const plan = planEffect({
        targetObjectId: "prisoner",
        effectKind,
        property: effectKind === "conceal" || effectKind === "expose" ? "concealment" : "integrity",
        magnitude: "moderate",
        entityIdFor: withPrincipals,
        resourceIdFor,
        description: "strikes at the prisoner",
      });
      expect(plan).toBeNull();
    }
  });

  it("PLANTED VIOLATION: open/close/leave/derive ruled at a perceived principal are refused -- a person is not a way out or a derivable parent", () => {
    expect(planEffect({ targetObjectId: "warden", effectKind: "open", property: "passage", magnitude: "slight", entityIdFor: withPrincipals, resourceIdFor, exits: {}, description: "x" })).toBeNull();
    expect(planEffect({ targetObjectId: "warden", effectKind: "leave", property: "none", magnitude: "slight", entityIdFor: withPrincipals, resourceIdFor, exits: {}, actorId: "e-prisoner", description: "x" })).toBeNull();
  });
});

// OPUS-FIRST-DESIGN.md §3.2: a noise's target may be `none` (the O game's
// slow circuit, `checkpoints/2026-09-20-ambition/RESULTS.md` bug 3). With no
// target there is no entity in `entityIdFor` to hang the event on, so the
// sound is the actor's own: `OPEN_NOISE`'s `entityId` is the actor.
describe("planEffect: a noise with no target (OPUS-FIRST-DESIGN.md §3.2)", () => {
  it("builds OPEN_NOISE against the actor's own entity, with no resource", () => {
    const plan = planEffect({
      targetObjectId: "none",
      effectKind: "noise",
      property: "none",
      magnitude: "moderate",
      entityIdFor,
      resourceIdFor,
      actorId: "e-warden",
      description: "makes a sound",
    });
    expect(plan?.mechanic).toBe("OPEN_NOISE");
    expect(plan?.parameters.entityId).toBe("e-warden");
    expect(plan?.resourceId).toBeNull();
    expect(plan?.isWearType).toBe(false);
  });

  it("plans nothing when there is neither a target nor an actor to be the source of the sound", () => {
    expect(planEffect({ targetObjectId: "none", effectKind: "noise", property: "none", magnitude: "slight", entityIdFor, resourceIdFor, description: "" })).toBeNull();
  });

  it("every other effect with target 'none' still plans nothing", () => {
    for (const effectKind of ["wear", "restore", "reveal", "conceal", "expose", "open", "close", "leave", "derive"] as const) {
      expect(planEffect({ targetObjectId: "none", effectKind, property: "none", magnitude: "slight", entityIdFor, resourceIdFor, actorId: "e-warden", description: "" })).toBeNull();
    }
  });
});
