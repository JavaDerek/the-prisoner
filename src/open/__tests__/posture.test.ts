import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, declaredPropertyKeys, resourceIdForProperty } from "../world.js";
import { computePerceivedObjects } from "../briefing.js";
import { OPEN_PERSONS, POSTURE_STANDING, POSTURE_CROUCHED, POSTURE_LYING } from "../scenarioObjects.js";
import { suspicionEligibleFor } from "../loop.js";
import { PRISONER_NAME } from "../../scenario.js";

/**
 * Issue #22's third gap, the owner's decision D5: a person's own physical state
 * as a BOUNDED NUMERIC PROPERTY, on his own scale -- 100 standing, 50 crouched,
 * 0 lying down. This is the piece that makes "drop to the ground and pretend to
 * be having a heart attack" a real, resolvable, perceptible act instead of an
 * assertion: she is then IN FACT on the floor, and what Croft makes of it is
 * her own mind's business (SOCIAL-INTENTS.md's reframe, which is why no effect
 * writes a belief).
 */
describe("posture: a person's own state (issue #22 gap 3, D5)", () => {
  afterEach(() => destroyTestDb());

  it("declares the owner's own scale: 100 standing, 50 crouched, 0 lying down", () => {
    expect(POSTURE_STANDING).toBe(100);
    expect(POSTURE_CROUCHED).toBe(50);
    expect(POSTURE_LYING).toBe(0);
    const posture = OPEN_PERSONS.flatMap((p) => p.properties).filter((p) => p.key === "posture");
    expect(posture.length).toBe(OPEN_PERSONS.length);
    for (const property of posture) {
      expect(property.min).toBe(POSTURE_LYING);
      expect(property.max).toBe(POSTURE_STANDING);
      expect(property.initialValue).toBe(POSTURE_STANDING);
    }
  });

  it("is a declared, resolvable property of each principal once presence is modelled", () => {
    createTestDb();
    const world = buildOpenWorld({ presence: "modelled" });
    expect(declaredProperty(world, "prisoner", "posture")).toBeDefined();
    expect(declaredPropertyKeys(world, "prisoner")).toContain("posture");
    expect(resourceIdForProperty(world, "prisoner", "posture")).toBeTruthy();
  });

  it("does not exist at all with presence off, so every earlier batch stays what it was", () => {
    createTestDb();
    const world = buildOpenWorld();
    expect(declaredProperty(world, "prisoner", "posture")).toBeUndefined();
    expect(resourceIdForProperty(world, "prisoner", "posture")).toBeFalsy();
  });

  it("reads in words across the whole range, not only at the three landmarks", () => {
    createTestDb();
    const world = buildOpenWorld({ presence: "modelled" });
    const seen = computePerceivedObjects(world, "warden", world.base.clock.wardenT(1), "modelled").find((o) => o.id === "prisoner");
    // She starts on her feet, and the warden can cite that sentence.
    expect(seen?.description).toContain(PRISONER_NAME);
    expect(seen?.description).toContain("She is on her feet.");

    // And the bands cover the whole range, so no value is ever a number with
    // no words for it -- 90 is still on her feet, 40 is still crouched, 10 is
    // still on the floor.
    const ranges = OPEN_PERSONS[0].properties[0].readRanges ?? [];
    const bandFor = (value: number) => ranges.find((r) => value <= r.atOrBelow)?.text;
    expect(bandFor(POSTURE_STANDING)).toBe("She is on her feet.");
    expect(bandFor(90)).toBe("She is on her feet.");
    expect(bandFor(POSTURE_CROUCHED)).toBe("She is crouched low.");
    expect(bandFor(40)).toBe("She is crouched low.");
    expect(bandFor(10)).toBe("She is lying on the floor.");
    expect(bandFor(POSTURE_LYING)).toBe("She is lying on the floor.");
  });

  it("a change to a PERSON never raises warden suspicion: the rule is about damaging, repairing or uncovering things", () => {
    // Collapsing is not damage to the cell, and the prompt's own suspicion
    // sentence says so. If this ever flips, that sentence becomes false.
    expect(suspicionEligibleFor("wear", "bar")).toBe(true);
    expect(suspicionEligibleFor("wear", "prisoner")).toBe(false);
    expect(suspicionEligibleFor("restore", "warden")).toBe(false);
  });
});
