import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact, readFactValue } from "../../world/facts.js";
import { buildOpenWorld, OPEN_DOOR_LOCK_MARGIN, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext } from "../briefing.js";
import type { EffectKind } from "../effects.js";
import type { Referee, RefereeRuling } from "../referee.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { openConditions } from "../conditions.js";
import { renderConditionList } from "../conditionList.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import type { Principal } from "../../ledger/beliefs.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/**
 * D15, the owner's answer to OPEN-VARIANT.md §80.4 question 2 (RED-TEAM.md F12), 2026-09-27: a held key ring
 * lifts the door's gate for whoever holds it. The holder is read at resolution time from the ring's own
 * `owner_id`/`owner_type` -- the engine's columns, as custody reads them -- so the key opens (and bolts) the door
 * whatever the lock's integrity; everyone else is gated as before. The window has no key.
 */

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"] = "none", magnitude: RefereeRuling["magnitude"] = "moderate"): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude,
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "x" }, requiredSourceId: `desc:${targetObjectId}`, verified: true }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

async function act(w: OpenWorld, principal: Principal, roundN: number, r: RefereeRuling): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? w.base.clock.wardenT(roundN) : w.base.clock.prisonerT(roundN);
  const referee: Referee = { rule: async () => r };
  return runOpenHalfRound({ openWorld: w, resolver: buildOpenResolver(), referee, principal, roundN, t, context: buildOpenContext(w, principal, t, roundN, 12, {}, "modelled"), mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }), presenceMode: "modelled" });
}

function valueAt(w: OpenWorld, resourceId: string, t: number): number | null {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: resourceId, key: "value" });
}

function wearTo(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value as number;
  if (current > value) buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set up" } });
}

function marginWorld(): OpenWorld {
  createTestDb();
  return buildOpenWorld({ presence: "modelled", doorPrice: "margin" });
}

describe("D15: the key ring lifts the door's gate for whoever holds it", () => {
  afterEach(() => destroyTestDb());

  it("the world names the door's key: the key ring, and the door's part is the lock; the window has none", () => {
    const w = marginWorld();
    expect(w.entityIdFor.key_ring).toBeTruthy();
    expect(w.keyOf).toEqual({ door: w.entityIdFor.key_ring });
    expect(w.exits.door.part).toBe("lock");
    expect(w.keyOf.window).toBeUndefined();
  });

  it("the warden, holding the ring, opens the door at lock 100 under margin; the lock is untouched", async () => {
    const w = marginWorld();
    const open = await act(w, "warden", 1, ruling("door", "open", "passage"));
    expect(open.outcome?.result.opened).toBe(true);
    expect(valueAt(w, w.exits.door.passageResourceId as string, open.t)).toBe(1);
    expect(valueAt(w, w.base.resources.lockIntegrity, open.t)).toBe(100);
  });

  it("the warden, holding the ring, bolts the door even with the lock at the gate (D11 lifted for the holder)", async () => {
    const w = marginWorld();
    wearTo(w, w.base.resources.lockIntegrity, OPEN_DOOR_LOCK_MARGIN);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "set up" } });
    const close = await act(w, "warden", 1, ruling("door", "close", "passage"));
    expect(close.outcome?.result.shut).not.toBe(false);
    expect(valueAt(w, w.exits.door.passageResourceId as string, close.t)).toBe(0);
  });

  it("the prisoner without it is refused at lock 100, as before (D7a wears the lock instead)", async () => {
    const w = marginWorld();
    const open = await act(w, "prisoner", 1, ruling("door", "open", "passage"));
    expect(open.outcome?.result.opened).toBe(false);
    expect(valueAt(w, w.base.resources.lockIntegrity, open.t)).toBe(80);
  });

  it("the prisoner who took it from a crouched warden opens the door at lock 100", async () => {
    const w = marginWorld();
    wearTo(w, w.resourceIdFor["warden.posture"], 50);
    const take = await act(w, "prisoner", 1, ruling("key_ring", "take"));
    expect(take.outcome?.result.taken).toBe(true);
    expect(readFactValue({ gameId: w.base.gameId, t: take.t, entityId: w.entityIdFor.key_ring, key: "owner_id" })).toBe(w.base.prisonerId);
    const open = await act(w, "prisoner", 2, ruling("door", "open", "passage"));
    expect(open.outcome?.result.opened).toBe(true);
    // And the warden, who no longer holds it, is gated like anyone else.
    const shut = await act(w, "warden", 3, ruling("door", "close", "passage"));
    expect(shut.outcome?.result.shut).not.toBe(false);
    const again = await act(w, "warden", 4, ruling("door", "open", "passage"));
    expect(again.outcome?.result.opened).toBe(false);
  });

  it("the ring opens only its own way out: the window is gated on the bar for the ring's holder too", async () => {
    const w = marginWorld();
    const open = await act(w, "warden", 1, ruling("window", "open", "passage"));
    expect(open.outcome?.result.opened).toBe(false);
  });
});

describe("D15, stated to both chairs as true rules of the world", () => {
  const WARDEN_KEY = `If ${WARDEN_NAME} holds the key ring, then ${WARDEN_NAME} can open the door.`;
  const PRISONER_KEY = `If ${PRISONER_NAME} holds the key ring, then ${PRISONER_NAME} can open the door.`;
  const lines = (reader: string, door: "stated" | "unstated") => renderConditionList(openConditions({ door, doorPrice: "margin", block: "on" }), { reader }).filter((l) => l.startsWith("CONDITION "));

  it("under a stated door, both conditions appear in both lists, after every existing one", () => {
    for (const reader of [PRISONER_NAME, WARDEN_NAME]) {
      const list = lines(reader, "stated");
      expect(list).toHaveLength(12);
      expect(list[10]).toMatch(new RegExp(`^CONDITION 11 \\(for [^)]+\\): ${WARDEN_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      expect(list[11]).toMatch(new RegExp(`^CONDITION 12 \\(for [^)]+\\): ${PRISONER_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    }
  });

  it("the catch conditions keep their numbers (4-7)", () => {
    const list = openConditions({ door: "stated", doorPrice: "margin", block: "on" });
    expect(list.map((c, i) => [i + 1, c] as const).filter(([, c]) => c.then.includes("catches")).map(([i]) => i)).toEqual([4, 5, 6, 7]);
  });

  it("under an unstated door, neither appears (the door is unstated)", () => {
    for (const reader of [PRISONER_NAME, WARDEN_NAME]) expect(lines(reader, "unstated").join("\n")).not.toContain("key ring");
  });
});
