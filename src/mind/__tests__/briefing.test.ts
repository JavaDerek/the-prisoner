import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { authorPlan } from "../../ledger/ledger.js";
import { setBelief, seedInitialBeliefs } from "../../ledger/beliefs.js";
import { buildPrisonerContext, buildWardenContext, buildBriefing } from "../briefing.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE, PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import { buildPrisonerPrompt } from "../prisonerMind.js";
import { buildWardenPrompt } from "../wardenMind.js";
import { buildResolver, SEARCH_SUSPICION_THRESHOLD } from "../../world/mechanics.js";

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

  it("the briefing shows the plan itself, current step marked (item 3)", () => {
    fresh();
    const plan = authorPlan({
      gameId: world.gameId,
      characterId: world.prisonerId,
      t: world.clock.t0,
      steps: [
        { move: "HONE", description: "Hone the spoon into something sharper." },
        { move: "FILE", description: "File at the bar." },
      ],
    });
    const context = buildPrisonerContext(world, plan, world.clock.prisonerT(1));
    expect(context.briefing).toContain("Hone the spoon into something sharper.");
    expect(context.briefing).toContain("current step");
  });

  it("REVISION -- belief, not truth: an unowned resource is absent from the briefing until this principal has learned something about it", () => {
    fresh();
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1));
    expect(briefing).not.toContain("bar integrity");
    expect(briefing).not.toContain("lock integrity");
    expect(briefing).not.toContain("guard attention");
  });

  it("REVISION -- a believed resource renders positively with when it was learned", () => {
    fresh();
    setBelief(world.gameId, "prisoner", "bar_integrity", 55, 3);
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(4));
    expect(briefing).toContain("bar integrity: 55 (as of round 3).");
  });

  it("REVISION -- the prisoner's own spoon_edge is always live truth, never a belief line", () => {
    fresh();
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1));
    expect(briefing).toContain("spoon edge: 0.");
    expect(briefing).not.toContain("as of round");
  });

  it("REVISION -- seedInitialBeliefs makes the scenario's known starting truths visible at round 1", () => {
    fresh();
    seedInitialBeliefs(world);
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1));
    expect(briefing).toContain("bar integrity: 100 (as of round 0).");
    expect(briefing).toContain("lock integrity: 100 (as of round 0).");
    expect(briefing).toContain("guard attention: 50 (as of round 0).");
  });

  it("REVISION -- the warden's belief of bar/lock/guard/spoon is likewise absent until learned", () => {
    fresh();
    const briefing = buildBriefing(world, world.wardenId, world.clock.wardenT(1));
    expect(briefing).not.toContain("bar integrity");
    expect(briefing).not.toContain("spoon edge");
    expect(briefing).toContain("warden suspicion: 0.");
  });

  it("item 4, coordinator's fix -- grounds to search are stated positively once suspicion reaches the threshold", () => {
    fresh();
    const resolver = buildResolver(world);
    // FILE raises warden_suspicion by 10 each time (mechanics.ts); drive it
    // to the threshold via the prisoner's own moves.
    for (let n = 1; SEARCH_SUSPICION_THRESHOLD > (n - 1) * 10; n++) {
      world.clock.prisonerT(n);
      resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });
    }
    const t = world.clock.wardenT(100);
    const briefing = buildBriefing(world, world.wardenId, t);
    expect(briefing).toContain(`You have grounds to search: suspicion ${SEARCH_SUSPICION_THRESHOLD}.`);
  });

  it("item 4 -- says nothing about grounds while suspicion is below the threshold", () => {
    fresh();
    const briefing = buildBriefing(world, world.wardenId, world.clock.wardenT(1));
    expect(briefing.toLowerCase()).not.toContain("grounds");
  });

  it("both prompts state BOTH names, and instruct speaking only as yourself (bug: the prisoner once spoke as 'Voss')", () => {
    fresh();
    const plan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const prisonerPrompt = buildPrisonerPrompt(buildPrisonerContext(world, plan, world.clock.prisonerT(1)));
    expect(prisonerPrompt).toContain(`You are ${PRISONER_NAME}.`);
    expect(prisonerPrompt).toContain(WARDEN_NAME);
    expect(prisonerPrompt.toLowerCase()).toContain("speak only as yourself");

    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const wardenPrompt = buildWardenPrompt(buildWardenContext(world, wardenPlan, world.clock.wardenT(2)));
    expect(wardenPrompt).toContain(`You are ${WARDEN_NAME}.`);
    expect(wardenPrompt).toContain(PRISONER_NAME);
    expect(wardenPrompt.toLowerCase()).toContain("speak only as yourself");
  });

  it("each is authored short-form -- under about five sentences", () => {
    expect(sentenceCount(PRISONER_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(PRISONER_MOTIVE)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_MOTIVE)).toBeLessThanOrEqual(5);
  });
});
