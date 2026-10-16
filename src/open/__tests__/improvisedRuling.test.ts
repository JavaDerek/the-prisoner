import { describe, it, expect, afterEach } from "vitest";
import { ConstraintViolationError, getResource, listConstraints, type ImprovisedRulingParameters } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import {
  readImproviseMode,
  SUSPICION_TIERS,
  SUSPICION_IMPROVISED_RULING,
  improvisedSuspicionParameters,
} from "../improvisedRuling.js";

/**
 * "Unlisted is not impossible" (run-dmcp's AUTHORING-GUIDE.md, NPC-MINDS-ARCHITECTURE.md §3.5): an act the referee
 * rules onto nothing may still receive a bounded improvised ruling -- here, on `warden_suspicion` alone, raise only,
 * with the owner's caps (minor 2 / serious 5 / outrage 10, outrage confirmed by a second call). These tests pin the
 * DATA and the MAPPING; the separate reading and the half-round wiring have their own describe blocks below.
 */

describe("PRISONER_IMPROVISE (readImproviseMode)", () => {
  it("is off unless asked, so every recorded batch is unchanged", () => {
    expect(readImproviseMode(undefined)).toBe("off");
    expect(readImproviseMode("")).toBe("off");
    expect(readImproviseMode("off")).toBe("off");
  });

  it("accepts suspicion, the one arm", () => {
    expect(readImproviseMode("suspicion")).toBe("suspicion");
  });

  it("throws on anything else, naming the variable", () => {
    expect(() => readImproviseMode("on")).toThrow(/PRISONER_IMPROVISE/);
  });
});

describe("the suspicion tiers (owner's caps, 2026-10-16)", () => {
  it("are minor 2, serious 5, outrage 10 -- and only outrage needs a confirmation", () => {
    expect(SUSPICION_TIERS).toEqual([
      { key: "minor", cap: 2 },
      { key: "serious", cap: 5 },
      { key: "outrage", cap: 10, requiresConfirmation: true },
    ]);
  });

  it("keep even an outrage below the grounds threshold, so no single improvised act can by itself give grounds for a catch", () => {
    // SEARCH_SUSPICION_THRESHOLD is 40 (world/mechanics.ts); a catch still needs it AND evidence (gameEnd.ts).
    expect(Math.max(...SUSPICION_TIERS.map((t) => t.cap))).toBeLessThan(40);
  });
});

describe("improvisedSuspicionParameters -- the game's own mapping, raise only", () => {
  const base = { resourceId: "res-suspicion", citedAct: "shout insults at the warden", current: 0, max: 100 };

  it("maps each tier to its cap, as a positive amount on the suspicion value", () => {
    const minor = improvisedSuspicionParameters({ ...base, tier: "minor" }) as ImprovisedRulingParameters;
    expect(minor.targets).toEqual([{ entityId: "res-suspicion", key: "value", tier: "minor", amount: 2 }]);
    expect(improvisedSuspicionParameters({ ...base, tier: "serious" })?.targets[0].amount).toBe(5);
    expect(improvisedSuspicionParameters({ ...base, tier: "outrage", confirmation: "confirm-1" })?.targets[0].amount).toBe(10);
  });

  it("records the cited act verbatim, a rationale naming the tier, and the confirmation only where given", () => {
    const minor = improvisedSuspicionParameters({ ...base, tier: "minor" }) as ImprovisedRulingParameters;
    expect(minor.citedAct).toBe("shout insults at the warden");
    expect(minor.rationale).toMatch(/minor/);
    expect(minor.confirmation).toBeUndefined();
    expect(minor.precedentKey).toBeUndefined();
    const outrage = improvisedSuspicionParameters({ ...base, tier: "outrage", confirmation: "confirm-1" }) as ImprovisedRulingParameters;
    expect(outrage.confirmation).toBe("confirm-1");
  });

  it("refuses to build an outrage without a confirmation -- the engine would refuse it too, but the game never asks", () => {
    expect(() => improvisedSuspicionParameters({ ...base, tier: "outrage" })).toThrow(/confirmation/);
  });

  it("moves no further than the value's own headroom: a cap is a ceiling, not a quota, and the bound would refuse the excess", () => {
    expect(improvisedSuspicionParameters({ ...base, tier: "serious", current: 98 })?.targets[0].amount).toBe(2);
    expect(improvisedSuspicionParameters({ ...base, tier: "minor", current: 100 })).toBeNull();
  });

  it("never yields a zero or negative amount, whatever it is handed", () => {
    for (const tier of ["minor", "serious"] as const) {
      for (const current of [0, 1, 50, 99, 100, 120]) {
        const p = improvisedSuspicionParameters({ ...base, tier, current });
        if (p) expect(p.targets.every((t) => t.amount > 0)).toBe(true);
      }
    }
  });
});

describe("buildOpenWorld({ improvise }) -- the declaration", () => {
  afterEach(() => destroyTestDb());

  it("off (the default) declares nothing new on warden_suspicion: bounded and resolve_only, as before", () => {
    createTestDb();
    const w = buildOpenWorld();
    const kinds = listConstraints(w.base.gameId, w.base.resources.wardenSuspicion).map((c) => c.kind).sort();
    expect(kinds).toEqual(["bounded", "resolve_only"]);
  });

  it("suspicion declares warden_suspicion improvisable with the three tiers, and monotonic non-decreasing", () => {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion" });
    const constraints = listConstraints(w.base.gameId, w.base.resources.wardenSuspicion);
    const improvisable = constraints.find((c) => c.kind === "improvisable");
    expect(improvisable?.tiers?.map((t) => ({ key: t.key, cap: t.cap, requiresConfirmation: t.requiresConfirmation }))).toEqual([
      { key: "minor", cap: 2, requiresConfirmation: false },
      { key: "serious", cap: 5, requiresConfirmation: false },
      { key: "outrage", cap: 10, requiresConfirmation: true },
    ]);
    expect(constraints.find((c) => c.kind === "monotonic")?.direction).toBe("increasing");
  });

  it("declares NOTHING else improvisable -- the escape gates, the spoon, every person's state stay out of reach", () => {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion", presence: "modelled", harm: "on" });
    const improvisable = listConstraints(w.base.gameId).filter((c) => c.kind === "improvisable");
    expect(improvisable.flatMap((c) => c.resourceIds)).toEqual([w.base.resources.wardenSuspicion]);
  });
});

describe("the engine holds the declaration (run-dmcp 0.11.0's improvised_ruling, through the game's resolver)", () => {
  afterEach(() => destroyTestDb());

  function setup() {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion", presence: "modelled" });
    return { w, resolver: buildOpenResolver() };
  }
  const suspicion = (w: ReturnType<typeof buildOpenWorld>) => getResource(w.base.resources.wardenSuspicion)?.value;
  const rule = (resolver: ReturnType<typeof buildOpenResolver>, gameId: string, parameters: ImprovisedRulingParameters) =>
    resolver.resolve({ gameId, mechanic: SUSPICION_IMPROVISED_RULING, parameters: parameters as unknown as Record<string, unknown> });
  const refusal = (fn: () => unknown): ConstraintViolationError => {
    try {
      fn();
    } catch (err) {
      if (err instanceof ConstraintViolationError) return err;
      throw err;
    }
    throw new Error("expected a refusal");
  };

  it("lands a mapped minor ruling as +2", () => {
    const { w, resolver } = setup();
    rule(resolver, w.base.gameId, improvisedSuspicionParameters({ resourceId: w.base.resources.wardenSuspicion, citedAct: "spit", tier: "minor", current: 0, max: 100 }) as ImprovisedRulingParameters);
    expect(suspicion(w)).toBe(2);
  });

  it("refuses a negative ruling structurally (monotonic), even one inside the cap -- talk never lowers suspicion", () => {
    const { w, resolver } = setup();
    rule(resolver, w.base.gameId, improvisedSuspicionParameters({ resourceId: w.base.resources.wardenSuspicion, citedAct: "spit", tier: "serious", current: 0, max: 100 }) as ImprovisedRulingParameters);
    const err = refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: w.base.resources.wardenSuspicion, tier: "minor", amount: -2 }], rationale: "calmed", citedAct: "I am harmless" }));
    expect(err.constraintKind).toBe("monotonic");
    expect(suspicion(w)).toBe(5);
  });

  it("refuses over-cap and an unconfirmed outrage, as kind improvisable", () => {
    const { w, resolver } = setup();
    const id = w.base.resources.wardenSuspicion;
    expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "minor", amount: 3 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("over-cap");
    expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "outrage", amount: 10 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("confirmation-required");
    expect(suspicion(w)).toBe(0);
  });

  it("refuses any improvised ruling on an escape gate (not-improvisable)", () => {
    const { w, resolver } = setup();
    for (const [object, key] of [["bar", "integrity"], ["lock", "integrity"], ["door", "passage"], ["window", "passage"], ["spoon", "edge"], ["prisoner", "posture"], ["warden", "sight"]] as const) {
      const id = resourceIdForProperty(w, object, key) as string;
      expect(id, `${object}.${key}`).toBeTruthy();
      expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "minor", amount: 1 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("not-improvisable");
    }
  });
});
