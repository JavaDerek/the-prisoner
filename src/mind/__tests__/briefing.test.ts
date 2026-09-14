import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { authorPlan } from "../../ledger/ledger.js";
import { setBelief, seedInitialBeliefs } from "../../ledger/beliefs.js";
import { setNotes } from "../../ledger/notes.js";
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
    expect(context.briefing).toContain("next");
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

  it("coordinator's fix, item 2 -- every briefing starts with 'Round N of R.'", () => {
    fresh();
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(3), undefined, 12);
    expect(briefing.split("\n")[0]).toBe("Round 3 of 12.");
  });

  it("coordinator's fix, item 2 -- the round number is correct for BOTH principals at the same round", () => {
    fresh();
    const wardenBriefing = buildBriefing(world, world.wardenId, world.clock.wardenT(5), undefined, 12);
    const prisonerBriefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(5), undefined, 12);
    expect(wardenBriefing.split("\n")[0]).toBe("Round 5 of 12.");
    expect(prisonerBriefing.split("\n")[0]).toBe("Round 5 of 12.");
  });

  it("coordinator's fix, item 2 -- R comes from the caller, never hard-coded", () => {
    fresh();
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1), undefined, 30);
    expect(briefing).toContain("Round 1 of 30.");
  });

  it("coordinator's fix, item 2 -- each side's authored stakes state what the end means, with R interpolated", () => {
    fresh();
    const prisonerBriefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1), undefined, 12);
    expect(prisonerBriefing).toContain("At the end of round 12 you are transferred to a maximum-security block, and this chance is gone.");

    const wardenBriefing = buildBriefing(world, world.wardenId, world.clock.wardenT(2), undefined, 12);
    expect(wardenBriefing).toContain("If Voss is still in this cell at the end of round 12, the transfer goes through and your record stands.");
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

  it("notes to self (this task's brief, item 2) -- a principal's OWN persisted notes render near the top of its OWN next briefing", () => {
    fresh();
    setNotes(world.gameId, "prisoner", "two more shims, then escape while guard attention is low", 1);
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(2));
    expect(briefing).toContain("Your notes from last round: two more shims, then escape while guard attention is low");
    // Near the top: within the first few lines, not buried past the ledger.
    const lines = briefing.split("\n");
    const noteIndex = lines.findIndex((l) => l.startsWith("Your notes from last round:"));
    expect(noteIndex).toBeGreaterThanOrEqual(0);
    expect(noteIndex).toBeLessThan(5);
  });

  it("notes to self -- absent entirely when this principal has never left one (never a guessed or empty line)", () => {
    fresh();
    const briefing = buildBriefing(world, world.prisonerId, world.clock.prisonerT(1));
    expect(briefing).not.toContain("Your notes from last round");
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

  it("coordinator's fix, item 3 -- both prompts warn that a line is heard aloud (the qwen prisoner once gave itself away this way)", () => {
    fresh();
    const plan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const prisonerPrompt = buildPrisonerPrompt(buildPrisonerContext(world, plan, world.clock.prisonerT(1)));
    expect(prisonerPrompt.toLowerCase()).toContain("spoken aloud");
    expect(prisonerPrompt.toLowerCase()).toContain("hears every word");

    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const wardenPrompt = buildWardenPrompt(buildWardenContext(world, wardenPlan, world.clock.wardenT(2)));
    expect(wardenPrompt.toLowerCase()).toContain("spoken aloud");
    expect(wardenPrompt.toLowerCase()).toContain("hears every word");
  });

  it("each is authored short-form -- under about five sentences", () => {
    expect(sentenceCount(PRISONER_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(PRISONER_MOTIVE)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_IDENTITY)).toBeLessThanOrEqual(5);
    expect(sentenceCount(WARDEN_MOTIVE)).toBeLessThanOrEqual(5);
  });
});
