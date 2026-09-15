import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect } from "../effects.js";
import { checkOpenEscape, checkOpenGameEnd, checkOpenCatch } from "../gameEnd.js";
import { OPEN_WINDOW_BAR_MAX } from "../world.js";
import { EFFECT_KINDS, PROPERTY_ANSWER_KEYS } from "../effects.js";
import { scriptedMind } from "mind-seam";
import { createReferee } from "../referee.js";
import { runOpenHalfRound, precedentTextFor } from "../loop.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * OPEN-VARIANT.md §12: escape is leaving the cell. Where a principal is, is
 * its character's location, changed only inside a resolution (run-dmcp
 * 0.7.0's `set`). §17: the ways out are the objects `door` and `window`, each
 * with a `passage` (0 shut, 1 open) and a part (`lock`, `bar`); an exit is
 * passable when its passage is open or when its part's integrity is spent.
 */

function locationOf(characterId: string): string | null {
  return (getDatabase().prepare(`SELECT location_id AS v FROM characters WHERE id = ?`).get(characterId) as { v: string | null }).v;
}

function plan(openWorld: OpenWorld, effectKind: "open" | "close" | "leave" | "wear" | "restore", target: "door" | "window" | "lock" | "bar", property: "passage" | "none" | "integrity", actor: "prisoner" | "warden" = "prisoner") {
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

/** Wears the bar down to `value` through the resolve protocol, as play would. */
function wearBarTo(openWorld: OpenWorld, value: number) {
  buildOpenResolver().resolve({
    gameId: openWorld.base.gameId,
    mechanic: "OPEN_WEAR",
    parameters: { resourceId: openWorld.base.resources.barIntegrity, amount: 100 - value, min: 0, max: 100, description: "worn" },
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
    expect(Object.keys(w.exits).sort()).toEqual(["door", "window"]);
    for (const exit of Object.values(w.exits)) {
      expect(getResource(exit.passageResourceId)?.value).toBe(0);
      expect(exit.destinationId).not.toBe(w.base.cellId);
    }
    expect(w.exits.door.destinationId).not.toBe(w.exits.window.destinationId);
    expect(locationOf(w.base.prisonerId)).toBe(w.base.cellId);
  });

  it("the referee may answer open, close and leave, and name the passage property", () => {
    expect(EFFECT_KINDS).toEqual(expect.arrayContaining(["open", "close", "leave"]));
    expect(PROPERTY_ANSWER_KEYS).toContain("passage");
  });

  it("open sets an exit's passage to open in one act; close shuts it", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "door", "passage"));
    expect(getResource(w.exits.door.passageResourceId)?.value).toBe(1);
    resolvePlan(w, plan(w, "close", "door", "passage"));
    expect(getResource(w.exits.door.passageResourceId)?.value).toBe(0);
  });

  it("wear and restore never act on passage", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(plan(w, "wear", "door", "passage")).toBeNull();
    expect(plan(w, "restore", "door", "passage")).toBeNull();
  });

  it("each way out names its part for §12's other way through: the door's is the lock's integrity, the window's the bar's (§17.2)", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(w.exits.door).toEqual(expect.objectContaining({ part: "lock", passageResourceId: resourceIdForProperty(w, "door", "passage"), integrityResourceId: w.base.resources.lockIntegrity }));
    expect(w.exits.window).toEqual(expect.objectContaining({ part: "bar", passageResourceId: resourceIdForProperty(w, "window", "passage"), integrityResourceId: w.base.resources.barIntegrity }));
    expect(w.entityIdFor.door).toBeTruthy();
    expect(w.entityIdFor.window).toBeTruthy();
    expect(new Set([w.entityIdFor.door, w.entityIdFor.window, w.entityIdFor.lock, w.entityIdFor.bar]).size).toBe(4);
  });

  it("open and close resolve through the way out whether the referee names the way out or its part (§19); leave still targets the way out only", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(plan(w, "open", "lock", "passage")).not.toBeNull();
    expect(plan(w, "close", "bar", "passage")).not.toBeNull();
    expect(plan(w, "leave", "lock", "none")).toBeNull();
    expect(plan(w, "leave", "bar", "none")).toBeNull();
    // wear, restore and reveal of integrity still target the part.
    expect(plan(w, "wear", "lock", "integrity")).not.toBeNull();
    expect(plan(w, "wear", "door", "integrity")).toBeNull();
  });

  it("open/close resolve the way out's passage even when the referee's own property answer names the part's integrity -- exactly what real games produced (§19)", () => {
    createTestDb();
    const w = buildOpenWorld();
    wearBarTo(w, OPEN_WINDOW_BAR_MAX); // §24: the window opens only once the bar is worn this far
    resolvePlan(w, plan(w, "open", "bar", "integrity"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(1);
    resolvePlan(w, plan(w, "close", "lock", "integrity"));
    expect(getResource(w.exits.door.passageResourceId)?.value).toBe(0);
  });

  it("the door and the window are perceived by both principals, like every §4.1 object with no concealment (§17)", () => {
    createTestDb();
    const w = buildOpenWorld();
    for (const principal of ["prisoner", "warden"] as const) {
      const ids = computePerceivedObjects(w, principal, w.base.clock.t0).map((o) => o.id);
      expect(ids, principal).toEqual(expect.arrayContaining(["door", "lock", "window", "bar"]));
    }
  });

  it("catch is unchanged: a close examination of the lock's integrity, not the door (§17.2)", () => {
    createTestDb();
    const w = buildOpenWorld();
    buildOpenResolver().resolve({
      gameId: w.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: w.base.resources.wardenSuspicion, amount: 100, min: 0, max: 100, description: "x" },
    });
    const t = w.base.clock.wardenT(1);
    expect(checkOpenCatch(w, t, { objectId: "lock", property: "integrity", value: 0 })).toBe(true);
    expect(checkOpenCatch(w, t, { objectId: "door", property: "passage", value: 0 })).toBe(false);
  });

  it("leave through a shut exit moves nothing, and says so in its result", () => {
    createTestDb();
    const w = buildOpenWorld();
    const outcome = resolvePlan(w, plan(w, "leave", "door", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.base.cellId);
    expect(outcome.sets).toEqual([]);
    expect(outcome.result).toEqual(expect.objectContaining({ left: false }));
  });

  it("leave through an open exit moves the actor to that exit's destination, inside the resolution", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "door", "passage"));
    const outcome = resolvePlan(w, plan(w, "leave", "door", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.exits.door.destinationId);
    expect(outcome.sets).toEqual([expect.objectContaining({ entityId: w.base.prisonerId, key: "location_id", newValue: w.exits.door.destinationId })]);
    expect(outcome.result).toEqual(expect.objectContaining({ left: true }));
  });

  it("an exit whose integrity is spent is passable though its passage was never opened -- the old routes still lead out", () => {
    createTestDb();
    const w = buildOpenWorld();
    const bar = resourceIdForProperty(w, "bar", "integrity") as string;
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: bar, amount: 1000, min: 0, max: 100, description: "x" } });
    resolvePlan(w, plan(w, "leave", "window", "none"));
    expect(locationOf(w.base.prisonerId)).toBe(w.exits.window.destinationId);
  });

  it("escape is the prisoner being anywhere but the cell -- a spent bar alone is not escape, and guard attention is not read", () => {
    createTestDb();
    const w = buildOpenWorld();
    const bar = resourceIdForProperty(w, "bar", "integrity") as string;
    const resolver = buildOpenResolver();
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: bar, amount: 1000, min: 0, max: 100, description: "x" } });
    const t1 = w.base.clock.prisonerT(1);
    expect(checkOpenEscape(w, t1)).toBe(false); // guard attention is still 50, and would not matter either way

    resolvePlan(w, plan(w, "leave", "window", "none"));
    const t2 = w.base.clock.wardenT(2);
    expect(checkOpenEscape(w, t2)).toBe(true);
    expect(checkOpenGameEnd(w, t2)).toEqual({ kind: "escaped" });
  });

  it("the warden leaving the cell is not the prisoner's escape", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "door", "passage", "warden"));
    resolvePlan(w, plan(w, "leave", "door", "none", "warden"));
    expect(locationOf(w.base.wardenId)).toBe(w.exits.door.destinationId);
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
    const opened = await half(w, "I lever the bolt back through the gap.", scripted("door", "open", "passage", "lever the bolt back", "the edge of the bolt shows in the gap"), 1);
    expect(renderOwnOutcome(opened)).toBe("Your last attempt opened the door.");
    expect(opened.perceptionForOther).toBe("Mara Voss opens the door.");

    const left = await half(w, "I slip out through the open door.", scripted("door", "leave", "none", "slip out through the open door", "A heavy door of iron-bound planks"), 2);
    expect(left.outcome?.result).toEqual(expect.objectContaining({ left: true }));
    expect(renderOwnOutcome(left)).toBe("You are out of the cell, through the door.");
    expect(left.perceptionForOther).toBe("Mara Voss makes for the door.");
    expect(checkOpenEscape(w, w.base.clock.wardenT(3))).toBe(true);
  });

  it("leaving through a shut door leaves the actor in the cell and tells it the door holds", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const tried = await half(w, "I walk out of the door.", scripted("door", "leave", "none", "walk out of the door", "A heavy door of iron-bound planks"), 1);
    expect(tried.outcome?.result).toEqual(expect.objectContaining({ left: false }));
    expect(renderOwnOutcome(tried)).toBe("Your last attempt met the door shut: you are still in the cell.");
  });

  it("the window, opened and left through, is told as the window (§17.2: the ids are the names)", async () => {
    createTestDb();
    const w = buildOpenWorld();
    wearBarTo(w, OPEN_WINDOW_BAR_MAX); // §24
    const opened = await half(w, "I lever the bars out of the window.", scripted("window", "open", "passage", "lever the bars out of the window", "a single rusted bar closes its widest gap"), 1);
    expect(renderOwnOutcome(opened)).toBe("Your last attempt opened the window.");
    const left = await half(w, "I climb out of the window.", scripted("window", "leave", "none", "climb out of the window", "A small window high in the wall"), 2);
    expect(renderOwnOutcome(left)).toBe("You are out of the cell, through the window.");
    expect(left.perceptionForOther).toBe("Mara Voss makes for the window.");
  });

  it("EXIT_LABEL is gone: nothing maps a part's id to a way out's name any more (§17.2)", async () => {
    const loop = (await import("../loop.js")) as Record<string, unknown>;
    expect(loop.EXIT_LABEL).toBeUndefined();
  });

  it("the known-approach sentence for these acts is role-neutral, like every other", () => {
    // The same sentences the ledger recorded before §17, now from the ids themselves.
    expect(precedentTextFor({ targetObjectId: "door", effectKind: "open" })).toBe("A prisoner opens the door.");
    expect(precedentTextFor({ targetObjectId: "window", effectKind: "leave" })).toBe("A prisoner makes for the window.");
    // Work on a part stays work on the part (§17.3: "works at the lock" stays true).
    expect(precedentTextFor({ targetObjectId: "lock", effectKind: "wear" })).toBe("A prisoner works at the lock.");
  });
});

describe("a way out opens only when its part allows it (OPEN-VARIANT.md §24)", () => {
  afterEach(() => destroyTestDb());

  it("each way out declares its threshold: the window's bar at or below 50, the same line a catch uses; the door none", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(OPEN_WINDOW_BAR_MAX).toBe(50);
    expect(w.exits.window.openWhenPartAtMost).toBe(OPEN_WINDOW_BAR_MAX);
    expect(w.exits.door.openWhenPartAtMost).toBeNull();
  });

  it("§21.3's round 1, replayed: an open through the bar at full integrity leaves the window shut, and says so in its result", () => {
    createTestDb();
    const w = buildOpenWorld();
    const outcome = resolvePlan(w, plan(w, "open", "bar", "integrity"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(0);
    expect(outcome.result).toEqual(expect.objectContaining({ opened: false }));
    expect(outcome.transitions).toEqual([]);
  });

  it("naming the window itself is held to the same threshold: the bar is the only thing keeping it shut", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "window", "passage"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(0);
    wearBarTo(w, 51);
    resolvePlan(w, plan(w, "open", "window", "passage"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(0);
    wearBarTo(w, 50);
    resolvePlan(w, plan(w, "open", "window", "passage"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(1);
  });

  it("the door has no threshold: the bolt pushed back through the gap still opens it through the lock at full integrity (the one real open, 2026-09-14)", () => {
    createTestDb();
    const w = buildOpenWorld();
    resolvePlan(w, plan(w, "open", "lock", "integrity"));
    expect(getResource(w.exits.door.passageResourceId)?.value).toBe(1);
  });

  it("close is never gated", () => {
    createTestDb();
    const w = buildOpenWorld();
    wearBarTo(w, 0);
    resolvePlan(w, plan(w, "open", "window", "passage"));
    wearBarTo(w, 0);
    resolvePlan(w, plan(w, "close", "bar", "integrity"));
    expect(getResource(w.exits.window.passageResourceId)?.value).toBe(0);
  });

  it("the actor is told the way out held, never that it opened or was already open", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const t = w.base.clock.prisonerT(1);
    const referee = createReferee([
      async (request) =>
        request.questions.map((q) => ({
          questionId: q.id,
          answerKey: ({ target: "bar", effect: "open", property: "integrity", magnitude: "moderate", perceptibility: "audible" } as Record<string, string>)[q.id] ?? "none",
          citation: q.id === "property" ? { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } : { sourceId: "intent", quote: "Scrape the rusted bar with the spoon to loosen it" },
        })),
    ]);
    const half = await runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "Scrape the rusted bar with the spoon to loosen it" }),
    });
    expect(renderOwnOutcome(half)).toBe("Your last attempt met the window shut: it will not open yet.");
  });

  it("once the bar allows it, the same act through the bar tells the actor it opened the window, not the bar (§24; half of #6)", () => {
    createTestDb();
    const w = buildOpenWorld();
    wearBarTo(w, 40);
    const outcome = resolvePlan(w, plan(w, "open", "bar", "integrity"));
    expect(outcome.result).toEqual(expect.objectContaining({ opened: true, wayOut: "window" }));
  });
});

describe("a way out's part worn through is told as the way out it frees (OPEN-VARIANT.md §27)", () => {
  afterEach(() => destroyTestDb());

  async function wearBar(w: OpenWorld, roundN: number) {
    const t = w.base.clock.prisonerT(roundN);
    const referee = createReferee([
      async (request) =>
        request.questions.map((q) => ({
          questionId: q.id,
          answerKey: ({ target: "bar", effect: "wear", property: "integrity", magnitude: "moderate", perceptibility: "audible" } as Record<string, string>)[q.id] ?? "none",
          citation: q.id === "property" ? { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } : { sourceId: "intent", quote: "Scrape the bar with the spoon" },
        })),
    ]);
    return runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee,
      principal: "prisoner",
      roundN,
      t,
      context: buildOpenContext(w, "prisoner", t, roundN),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "Scrape the bar with the spoon" }),
    });
  }

  it("the wear that takes the bar to 0 tells the actor the window can be climbed through now; a wear short of it does not", async () => {
    createTestDb();
    const w = buildOpenWorld();
    wearBarTo(w, 20);
    const short = await wearBar(w, 1); // moderate: 20 -> 5
    expect(renderOwnOutcome(short)).toBe("Your last attempt worked on the bar: its integrity went from 20 to 5.");
    const through = await wearBar(w, 2); // 5 -> 0
    expect(renderOwnOutcome(through)).toBe("Your last attempt worked on the bar: its integrity went from 5 to 0. The window can be climbed through now.");
  });
});
