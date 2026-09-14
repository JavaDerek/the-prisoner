import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { authorPlan } from "../../ledger/ledger.js";
import { buildPrisonerContext, buildWardenContext } from "../briefing.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE } from "../../scenario.js";

function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0).length;
}

describe("authored identity and motive (item 1) -- content, not code logic", () => {
  let world: World;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("the prisoner's context carries the scenario's own authored identity and motive, with teeth", () => {
    fresh();
    const plan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const context = buildPrisonerContext(world, plan, world.clock.prisonerT(1));

    expect(context.identity).toBe(PRISONER_IDENTITY);
    expect(context.motive).toBe(PRISONER_MOTIVE);
    // "with teeth": the real motive from the owner's scenario -- escape,
    // then the warden -- not a timid "avoid notice" motive.
    expect(context.motive.toLowerCase()).toContain("cell");
    expect(context.motive.toLowerCase()).toContain("croft");
  });

  it("the warden's context carries the scenario's own authored identity and motive", () => {
    fresh();
    const plan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const context = buildWardenContext(world, plan, world.clock.wardenT(1));

    expect(context.identity).toBe(WARDEN_IDENTITY);
    expect(context.motive).toBe(WARDEN_MOTIVE);
    expect(context.motive.toLowerCase()).toContain("secure");
    expect(context.motive.toLowerCase()).toContain("planning");
  });

  it("each is authored short-form -- under about five sentences", () => {
    expect(sentenceCount(PRISONER_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(PRISONER_MOTIVE)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_MOTIVE)).toBeLessThanOrEqual(5);
  });
});
