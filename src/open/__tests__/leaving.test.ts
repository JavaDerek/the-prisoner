import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect } from "../effects.js";
import { checkOpenEscape, checkOpenGameEnd } from "../gameEnd.js";
import { EFFECT_KINDS, PROPERTY_ANSWER_KEYS } from "../effects.js";
import { scriptedMind } from "mind-seam";
import { createReferee } from "../referee.js";
import { runOpenHalfRound, precedentTextFor } from "../loop.js";
import { buildOpenContext } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * OPEN-VARIANT.md §12: escape is leaving the cell. Where a principal is, is
 * its character's location, changed only inside a resolution (run-dmcp
 * 0.7.0's `set`). The lock is the door's exit and the bar the window's; each
 * has a `passage` (0 shut, 1 open); an exit is passable when open or when its
 * integrity is spent.
 */

function locationOf(characterId: string): string | null {
  return (getDatabase().prepare(`SELECT location_id AS v FROM characters WHERE id = ?`).get(characterId) as { v: string | null }).v;
}

function plan(openWorld: OpenWorld, effectKind: "open" | "close" | "leave" | "wear" | "restore", target: "lock" | "bar", property: "passage" | "none" | "integrity", actor: "prisoner" | "warden" = "prisoner") {
  return planEffect({
    targetObjectId: target,
    effectKind,
    property,
    magnitude: "slight",
    entityIdFor: openWorld.entityIdFor,
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    actorId: actor === "prisoner" ? openWorld.base.prisonerId : openWorld.base.wardenId,
    description: "x",
  });
}

function resolvePlan(openWorld: OpenWorld, p: ReturnType<typeof plan>) {
  if (!p) throw new Error("no plan");
  return buildOpenResolver().resolve({ gameId: openWorld.base.gameId, mechanic: p.mechanic, parameters: p.parameters });
}

describe("leaving the cell (OPEN-VARIANT.md §12)", () => {
  afterEach(() => destroyTestDb());

  it("the world has two ways out, each starting shut, each leading somewhere that is not the cell", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(Object.keys(w.exits).sort()).toEqual(["bar", "lock"]);
    for (const exit of Object.values(w.exits)) {
      expect(getResource(exit.passageResourceId)?.value).toBe(0);
      expect(exit.destinationId).not.toBe(w.base.cellId);
    }
    expect(w.exits.lock.destinationId).not.toBe(w.exits.bar.destinationId);
    expect(locationOf(w.base.prisonerId)).toBe(w.base.cellId);
  });

  it("the referee may answer open, close and leave, and name the passage property", () => {
    expect(EFFECT_KINDS).toEqual(expect.arrayContaining(["open", "close", "leave"]));
    expect(PROPERTY_ANSWER_KEYS).toContain("passage");
  });

  it("open sets an exit's passage to open in one act; close shuts it", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "lock", "passage"));
    expect(getResource(w.exits.lock.passageResourceId)?.value).toBe(1);
    resolvePlan(w, plan(w, "close", "lock", "passage"));
    expect(getResource(w.exits.lock.passageResourceId)?.value).toBe(0);
  });

  it("wear and restore never act on passage, and open/close act on nothing else", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(plan(w, "wear", "lock", "passage")).toBeNull();
    expect(plan(w, "restore", "lock", "passage")).toBeNull();
    expect(plan(w, "open", "lock", "integrity")).toBeNull();
  });

  it("leave through a shut exit moves nothing, and says so in its result", () => {
    createTestDb();
    const w = buildOpenWorld();
    const outcome = resolvePlan(w, plan(w, "leave", "lock", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.base.cellId);
    expect(outcome.sets).toEqual([]);
    expect(outcome.result).toEqual(expect.objectContaining({ left: false }));
  });

  it("leave through an open exit moves the actor to that exit's destination, inside the resolution", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "lock", "passage"));
    const outcome = resolvePlan(w, plan(w, "leave", "lock", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.exits.lock.destinationId);
    expect(outcome.sets).toEqual([expect.objectContaining({ entityId: w.base.prisonerId, key: "location_id", newValue: w.exits.lock.destinationId })]);
    expect(outcome.result).toEqual(expect.objectContaining({ left: true }));
  });

  it("an exit whose integrity is spent is passable though its passage was never opened -- the old routes still lead out", () => {
    createTestDb();
    const w = buildOpenWorld();
    const bar = resourceIdForProperty(w, "bar", "integrity") as string;
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: bar, amount: 1000, min: 0, max: 100, description: "x" } });
    resolvePlan(w, plan(w, "leave", "bar", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.exits.bar.destinationId);
  });

  it("escape is the prisoner being anywhere but the cell -- a spent bar alone is not escape, and guard attention is not read", () => {
    createTestDb();
    const w = buildOpenWorld();
    const bar = resourceIdForProperty(w, "bar", "integrity") as string;
    const resolver = buildOpenResolver();
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: bar, amount: 1000, min: 0, max: 100, description: "x" } });
    const t1 = w.base.clock.prisonerT(1);
    expect(checkOpenEscape(w, t1)).toBe(false); // guard attention is still 50, and would not matter either way

    resolvePlan(w, plan(w, "leave", "bar", "none"));
    const t2 = w.base.clock.wardenT(2);
    expect(checkOpenEscape(w, t2)).toBe(true);
    expect(checkOpenGameEnd(w, t2)).toEqual({ kind: "escaped" });
  });

  it("the warden leaving the cell is not the prisoner's escape", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "lock", "passage", "warden"));
    resolvePlan(w, plan(w, "leave", "lock", "none", "warden"));
    expect(locationOf(w.base.wardenId)).toBe(w.exits.lock.destinationId);
    expect(checkOpenEscape(w, w.base.clock.wardenT(2))).toBe(false);
  });
});

describe("leaving, through a whole half-round: what each side is told (OPEN-VARIANT.md §12)", () => {
  afterEach(() => destroyTestDb());

  const scripted = (target: string, effect: string, property: string, intentQuote: string, descQuote: string) =>
    createReferee([
      async (request) =>
        request.questions.map((q) => ({
          questionId: q.id,
          answerKey: ({ target, effect, property, magnitude: "moderate", perceptibility: "visible" } as Record<string, string>)[q.id],
          citation: q.id === "property" ? { sourceId: `desc:${target}`, quote: descQuote } : { sourceId: "intent", quote: intentQuote },
        })),
    ]);

  async function half(w: OpenWorld, intent: string, referee: ReturnType<typeof createReferee>, roundN: number) {
    const t = w.base.clock.prisonerT(roundN);
    return runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee,
      principal: "prisoner",
      roundN,
      t,
      context: buildOpenContext(w, "prisoner", t, roundN),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
    });
  }

  it("open the door, then leave through it: the actor is told the door is open, then that it is out; the other sees it make for the door", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const opened = await half(w, "I lever the bolt back through the gap.", scripted("lock", "open", "passage", "lever the bolt back", "the edge of the bolt shows in the gap"), 1);
    expect(renderOwnOutcome(opened)).toBe("Your last attempt opened the door.");
    expect(opened.perceptionForOther).toBe("Mara Voss opens the door.");

    const left = await half(w, "I slip out through the open door.", scripted("lock", "leave", "none", "slip out through the open door", "A steel lock set in the cell door"), 2);
    expect(left.outcome?.result).toEqual(expect.objectContaining({ left: true }));
    expect(renderOwnOutcome(left)).toBe("You are out of the cell, through the door.");
    expect(left.perceptionForOther).toBe("Mara Voss makes for the door.");
    expect(checkOpenEscape(w, w.base.clock.wardenT(3))).toBe(true);
  });

  it("leaving through a shut door leaves the actor in the cell and tells it the door holds", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const tried = await half(w, "I walk out of the door.", scripted("lock", "leave", "none", "walk out of the door", "A steel lock set in the cell door"), 1);
    expect(tried.outcome?.result).toEqual(expect.objectContaining({ left: false }));
    expect(renderOwnOutcome(tried)).toBe("Your last attempt met the door shut: you are still in the cell.");
  });

  it("the known-approach sentence for these acts is role-neutral, like every other", () => {
    expect(precedentTextFor({ targetObjectId: "lock", effectKind: "open" })).toBe("A prisoner opens the door.");
    expect(precedentTextFor({ targetObjectId: "bar", effectKind: "leave" })).toBe("A prisoner makes for the window.");
  });
});
