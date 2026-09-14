// Fog tests for `thoughts` and `notes` (this task's brief, item 3) -- a
// planted marker, exactly like conformance check 4 (design §9.1's check 4,
// `mind-seam/conformance`): a marker in one principal's private field must
// never appear in any string leaf of the OTHER principal's next context,
// and (the positive control, without which absence proves nothing) a
// `notes` marker MUST appear in the SAME principal's own next context.
//
// `thoughts` never gets a positive control here: by design it is rendered
// to the transcript only (`checkpoint.ts`) and never persisted anywhere, so
// it can never re-enter ANY context, including its own author's -- these
// tests check exactly that absence, for both sides.
import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { authorPlan } from "../../ledger/ledger.js";
import { buildPrisonerContext, buildWardenContext } from "../briefing.js";
import { runHalfRound, newSilenceTracker } from "../../loop.js";
import type { PrisonerContext, PrisonerProposal } from "../prisonerMind.js";
import type { WardenContext, WardenProposal } from "../wardenMind.js";
import type { Resolver } from "run-dmcp";

describe("thoughts and notes are fog-correct (planted marker, like conformance check 4)", () => {
  let world: World;
  let resolver: Resolver;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a marker in the WARDEN's notes reaches the WARDEN's own next briefing (positive control) but never the PRISONER's", async () => {
    fresh();
    const notesMarker = `notes-marker-${Math.random().toString(36).slice(2, 10)}`;
    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });

    const wardenMind = scriptedMind<WardenContext, WardenProposal>({
      intent: "watch quietly",
      choice: "WAIT",
      plan: ["WAIT"],
      thoughts: "private reasoning that must never leak",
      notes: `remember: ${notesMarker}`,
    });

    const t1 = world.clock.wardenT(1);
    const half = await runHalfRound({
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: 1,
      t: t1,
      context: buildWardenContext(world, wardenPlan, t1),
      mind: wardenMind,
      tracker: newSilenceTracker(),
    });
    expect(half.result.kind).toBe("resolved");

    // Fog: the prisoner's very next context never contains the warden's
    // notes marker.
    const prisonerContext = buildPrisonerContext(world, prisonerPlan, world.clock.prisonerT(1));
    expect(prisonerContext.briefing).not.toContain(notesMarker);

    // Positive control: the warden's OWN next context carries it.
    const wardenContext2 = buildWardenContext(world, wardenPlan, world.clock.wardenT(2));
    expect(wardenContext2.briefing).toContain(notesMarker);
  });

  it("a marker in the WARDEN's thoughts never appears in ANY subsequent context -- not the prisoner's, not even the warden's own", async () => {
    fresh();
    const thoughtsMarker = `thoughts-marker-${Math.random().toString(36).slice(2, 10)}`;
    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });

    const wardenMind = scriptedMind<WardenContext, WardenProposal>({
      intent: "watch quietly",
      choice: "WAIT",
      plan: ["WAIT"],
      thoughts: thoughtsMarker,
      notes: "nothing notable",
    });

    const t1 = world.clock.wardenT(1);
    await runHalfRound({
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: 1,
      t: t1,
      context: buildWardenContext(world, wardenPlan, t1),
      mind: wardenMind,
      tracker: newSilenceTracker(),
    });

    const prisonerContext = buildPrisonerContext(world, prisonerPlan, world.clock.prisonerT(1));
    expect(prisonerContext.briefing).not.toContain(thoughtsMarker);

    const wardenContext2 = buildWardenContext(world, wardenPlan, world.clock.wardenT(2));
    expect(wardenContext2.briefing).not.toContain(thoughtsMarker);
  });

  it("symmetric for the PRISONER: a notes marker reaches the prisoner's own next briefing but never the warden's; a thoughts marker reaches neither", async () => {
    fresh();
    const notesMarker = `p-notes-${Math.random().toString(36).slice(2, 10)}`;
    const thoughtsMarker = `p-thoughts-${Math.random().toString(36).slice(2, 10)}`;
    const prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });

    const prisonerMind = scriptedMind<PrisonerContext, PrisonerProposal>({
      intent: "wait and think",
      choice: "WAIT",
      plan: ["WAIT"],
      thoughts: thoughtsMarker,
      notes: `remember: ${notesMarker}`,
    });

    const t1 = world.clock.prisonerT(1);
    await runHalfRound({
      world,
      resolver,
      plan: prisonerPlan,
      principal: "prisoner",
      roundN: 1,
      t: t1,
      context: buildPrisonerContext(world, prisonerPlan, t1),
      mind: prisonerMind,
      tracker: newSilenceTracker(),
    });

    const wardenContext = buildWardenContext(world, wardenPlan, world.clock.wardenT(2));
    expect(wardenContext.briefing).not.toContain(notesMarker);
    expect(wardenContext.briefing).not.toContain(thoughtsMarker);

    const prisonerContext2 = buildPrisonerContext(world, prisonerPlan, world.clock.prisonerT(2));
    expect(prisonerContext2.briefing).toContain(notesMarker);
    expect(prisonerContext2.briefing).not.toContain(thoughtsMarker);
  });
});
