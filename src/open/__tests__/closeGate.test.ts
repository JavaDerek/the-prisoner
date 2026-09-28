import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, OPEN_DOOR_LOCK_MARGIN, type OpenWorld, type DoorPriceMode } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext } from "../briefing.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { renderOwnOutcome } from "../perception.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import type { Referee, RefereeRuling } from "../referee.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * PLAYTEST-2026-09-27 D11 (RED-TEAM.md F3), a physical fix with no arm: `close` on a way out whose part is at or
 * under its open gate refuses. A window whose bar is out has nothing to shut; a door whose lock is worn past its
 * gate cannot be bolted. A way out with no gate closes as it always has.
 */

function closeRuling(target: "window" | "door"): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId: target,
    effectKind: "close",
    property: "passage",
    magnitude: "moderate",
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { ...cited, requiredSourceId: `desc:${target}`, citation: { sourceId: `desc:${target}`, quote: "x" } }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

function set(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value ?? 0;
  const r = buildOpenResolver();
  if (value < current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set" } });
  if (value > current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: value - current, min: 0, max: 100, description: "set" } });
}

function open(w: OpenWorld, wayOut: "window" | "door"): void {
  buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits[wayOut].passageResourceId, wayOut, open: true, min: 0, max: 1, description: "open" } });
}

async function wardenCloses(w: OpenWorld, wayOut: "window" | "door"): Promise<OpenHalfRoundResult> {
  const t = w.base.clock.wardenT(1);
  const referee: Referee = { rule: async () => closeRuling(wayOut) };
  return runOpenHalfRound({ openWorld: w, resolver: buildOpenResolver(), referee, principal: "warden", roundN: 1, t, context: buildOpenContext(w, "warden", t, 1, 12), mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I shut it." }) });
}

function world(doorPrice?: DoorPriceMode): OpenWorld {
  createTestDb();
  return buildOpenWorld(doorPrice ? { doorPrice } : {});
}

describe("close refuses on a spent part (D11, RED-TEAM.md F3)", () => {
  afterEach(() => destroyTestDb());

  it("a window whose bar is at 40 cannot be shut, and the actor is told why", async () => {
    const w = world();
    set(w, w.base.resources.barIntegrity, 40);
    open(w, "window");
    const half = await wardenCloses(w, "window");
    expect(half.outcome?.result).toMatchObject({ shut: false, partId: "bar" });
    expect(getResource(w.exits.window.passageResourceId as string)?.value).toBe(1);
    expect(renderOwnOutcome(half)).toContain("The window cannot be shut: the bar is out of it.");
    expect(renderOpenHalfRound(half).join("\n")).toContain("the window would not shut: the bar is at or under its gate");
  });

  it("a window whose bar still holds above the gate shuts as today", async () => {
    const w = world();
    set(w, w.base.resources.barIntegrity, 55);
    open(w, "window");
    const half = await wardenCloses(w, "window");
    expect(getResource(w.exits.window.passageResourceId as string)?.value).toBe(0);
    expect(renderOwnOutcome(half)).toContain("Your last attempt shut the window.");
  });

  it("a door under margin with the lock at its gate cannot be bolted -- by a warden who has lost the key ring", async () => {
    const w = world("margin");
    set(w, w.base.resources.lockIntegrity, OPEN_DOOR_LOCK_MARGIN);
    open(w, "door");
    // Changed on purpose, 2026-09-27 (D15, the owner's answer to §80.4 question 2): the key ring lifts the gate
    // for its holder, and he starts with it on his belt, so this line now needs it out of his hands first.
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_GIVE", parameters: { itemId: w.entityIdFor.key_ring, actorId: w.base.wardenId, recipientId: w.base.prisonerId, description: "set up" } });
    const half = await wardenCloses(w, "door");
    expect(half.outcome?.result).toMatchObject({ shut: false, partId: "lock" });
    expect(getResource(w.exits.door.passageResourceId as string)?.value).toBe(1);
    expect(renderOwnOutcome(half)).toContain("The door cannot be bolted: the lock will not hold.");
  });

  it("D15: with the key ring on his belt, he bolts it whatever the lock", async () => {
    const w = world("margin");
    set(w, w.base.resources.lockIntegrity, OPEN_DOOR_LOCK_MARGIN);
    open(w, "door");
    const half = await wardenCloses(w, "door");
    expect(half.outcome?.result.shut).toBeUndefined();
    expect(half.outcome?.result.withKey).toBe(true);
    expect(getResource(w.exits.door.passageResourceId as string)?.value).toBe(0);
  });

  it("a door under free (no gate) closes as today, whatever the lock", async () => {
    const w = world("free");
    set(w, w.base.resources.lockIntegrity, 0);
    open(w, "door");
    const half = await wardenCloses(w, "door");
    expect(getResource(w.exits.door.passageResourceId as string)?.value).toBe(0);
    expect(half.outcome?.result.shut).toBeUndefined();
  });

  it("a refused close wears nothing: D7a's wear-on-refusal is the open's alone", async () => {
    const w = world();
    set(w, w.base.resources.barIntegrity, 40);
    open(w, "window");
    const half = await wardenCloses(w, "window");
    expect(half.plan?.parameters.wearOnRefusal).toBeUndefined();
    expect(getResource(w.base.resources.barIntegrity)?.value).toBe(40);
  });
});
