// Item 5: the two sides perceive each other. Tested the way conformance
// check 4 tests the fog property -- a planted marker that MUST reach the
// other principal's context for a non-covert act (the positive control,
// without which absence proves nothing) and MUST NOT reach it for a
// covert one (CONCEAL).
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { authorPlan, logRound } from "../../ledger/ledger.js";
import { buildPrisonerContext, buildWardenContext } from "../briefing.js";
import { SEEN_BY_OTHER_AS } from "../../world/mechanics.js";
import type { Resolver } from "run-dmcp";

describe("item 5 -- cross-perception is fog-correct (planted marker, like conformance check 4)", () => {
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

  it("a non-covert act's line and seenByOtherAs reach the OTHER principal's very next briefing (positive control)", () => {
    fresh();
    const marker = `seam-marker-${Math.random().toString(36).slice(2, 10)}`;

    const tw = world.clock.wardenT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "OBSERVE" });
    logRound({
      gameId: world.gameId,
      t: tw,
      roundN: 1,
      principal: "warden",
      mechanic: "OBSERVE",
      description: null,
      line: `I see you, ${marker}.`,
      seenByOtherAs: SEEN_BY_OTHER_AS.OBSERVE,
    });

    const prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const context = buildPrisonerContext(world, prisonerPlan, world.clock.prisonerT(1));

    expect(context.briefing).toContain(marker);
    expect(context.briefing).toContain(SEEN_BY_OTHER_AS.OBSERVE as string);
    // Grammar: the warden's own character name is already "the warden" --
    // found by reading a real transcript, which read "The the warden
    // said:" (a double "the").
    expect(context.briefing).toContain(`The warden said: "I see you, ${marker}."`);
    expect(context.briefing.toLowerCase()).not.toContain("the the ");
  });

  it("a covert act (CONCEAL) contributes NOTHING to the other principal's next briefing -- no line, no seenByOtherAs, no marker", () => {
    fresh();
    const marker = `seam-marker-${Math.random().toString(36).slice(2, 10)}`;
    expect(SEEN_BY_OTHER_AS.CONCEAL).toBeNull();

    const tp = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    logRound({
      gameId: world.gameId,
      t: tp,
      roundN: 1,
      principal: "prisoner",
      mechanic: "CONCEAL",
      description: null,
      line: `Hiding the ${marker} here.`,
      seenByOtherAs: SEEN_BY_OTHER_AS.CONCEAL,
    });

    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const context = buildWardenContext(world, wardenPlan, world.clock.wardenT(2));

    expect(context.briefing).not.toContain(marker);
    expect(context.briefing).not.toContain("Hiding the");
  });

  it("only the SINGLE most recent act is relayed -- an older act does not leak forward past a newer covert one", () => {
    fresh();
    const olderMarker = "older-marker-abc";

    // An older, non-covert act...
    const tp1 = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "HONE" });
    logRound({
      gameId: world.gameId,
      t: tp1,
      roundN: 1,
      principal: "prisoner",
      mechanic: "HONE",
      description: null,
      line: `Sharpening, ${olderMarker}.`,
      seenByOtherAs: SEEN_BY_OTHER_AS.HONE,
    });

    // ...then a newer, covert one.
    const tp2 = world.clock.prisonerT(2);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });
    logRound({
      gameId: world.gameId,
      t: tp2,
      roundN: 2,
      principal: "prisoner",
      mechanic: "CONCEAL",
      description: null,
      line: null,
      seenByOtherAs: SEEN_BY_OTHER_AS.CONCEAL,
    });

    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const context = buildWardenContext(world, wardenPlan, world.clock.wardenT(3));

    // Never the STALE older marker -- the covert act must suppress it, not
    // let it show through from before.
    expect(context.briefing).not.toContain(olderMarker);
  });
});
