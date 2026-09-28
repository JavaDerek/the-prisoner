import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, wayOutIndex, wayOutAt, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext, type PresenceMode } from "../briefing.js";
import { EFFECT_KINDS, effectRequiresProperty, planEffect, readBlockMode, type EffectKind } from "../effects.js";
import { createReferee, type Referee, type RefereeRuling } from "../referee.js";
import { runOpenHalfRound, describeAttempt, suspicionEligible, precedentTextFor, type OpenHalfRoundResult } from "../loop.js";
import { renderOwnOutcome } from "../perception.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import { openConditions } from "../conditions.js";
import { findProperty, POSTURE_ON_HER_FEET_ABOVE, SIGHT_BLIND_AT_OR_BELOW } from "../scenarioObjects.js";
import { PRISONER_NAME, WARDEN_NAME, WARDEN_PRONOUNS } from "../../scenario.js";
import type { Principal } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * PLAYTEST-2026-09-27 D4' (RED-TEAM.md F4, F11): `block` -- stand in a way
 * out so nobody passes through it -- as an OCCUPATION. The blocker's own
 * `${principal}_blocking` resource holds the way out's 1-based index (the
 * `*_held_in` pattern, never a `set` on the item, which run-dmcp refuses for
 * a key that is not a live column). The block lapses the moment her next
 * RESOLVED act is anything else; a silent or inapplicable turn keeps it.
 */

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"] = "none", extra: Partial<RefereeRuling> = {}): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude: "moderate",
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: {
      target: cited,
      effect: cited,
      property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "Rust has pitted it near the bottom" }, requiredSourceId: `desc:${targetObjectId}`, verified: true },
      product: cited,
    },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
    ...extra,
  };
}

const BLOCK_WINDOW = ruling("window", "block");
const BLOCK_DOOR = ruling("door", "block");
const EXAMINE_BAR = ruling("bar", "reveal", "integrity");
const LEAVE_WINDOW = ruling("window", "leave");

async function act(w: OpenWorld, principal: Principal, roundN: number, r: RefereeRuling | null, presenceMode: PresenceMode = "modelled", applicable = true): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? w.base.clock.wardenT(roundN) : w.base.clock.prisonerT(roundN);
  const referee: Referee = { rule: async () => (r ? { ...r, applicable } : r) as RefereeRuling };
  return runOpenHalfRound({
    openWorld: w,
    resolver: buildOpenResolver(),
    referee,
    principal,
    roundN,
    t,
    context: buildOpenContext(w, principal, t, roundN, 12, {}, presenceMode),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>(r === null ? null : { intent: "I do it." }),
    presenceMode,
  });
}

function set(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value ?? 0;
  const resolver = buildOpenResolver();
  if (value < current) resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set" } });
  else if (value > current) resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: value - current, min: 0, max: 100, description: "set" } });
}

function openWindow(w: OpenWorld): void {
  buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "open" } });
}

function blockingOf(w: OpenWorld, principal: Principal, t: number): number | null {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: w.blocking[principal], key: "value" });
}

describe("block: the effect key (D4')", () => {
  it("is a closed effect key, names no property, and raises no suspicion", () => {
    expect(EFFECT_KINDS).toContain("block");
    expect(EFFECT_KINDS[EFFECT_KINDS.length - 1]).toBe("none");
    expect(effectRequiresProperty("block")).toBe(false);
    expect(suspicionEligible("block")).toBe(false);
  });

  it("readBlockMode: on unless asked; off is today's request; anything else stops the run", () => {
    expect(readBlockMode(undefined)).toBe("on");
    expect(readBlockMode("")).toBe("on");
    expect(readBlockMode("on")).toBe("on");
    expect(readBlockMode("off")).toBe("off");
    expect(() => readBlockMode("yes")).toThrow(/PRISONER_BLOCK/);
  });

  it("the effect question offers block only under blockMode on; a bare referee's request is today's", async () => {
    const capture = (): { transport: ReaderTransport; effect: () => { prompt: string; answerKeys: readonly string[] } | undefined } => {
      let questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
      return {
        transport: async (request) => {
          questions = request.questions;
          return [];
        },
        effect: () => questions.find((q) => q.id === "effect"),
      };
    };
    const window = { id: "window", description: "A small window set in the wall." };
    const bare = capture();
    await createReferee([bare.transport]).rule("I stand in the window.", [window]);
    expect(bare.effect()?.answerKeys).not.toContain("block");
    expect(bare.effect()?.prompt).not.toContain("block (");
    const on = capture();
    await createReferee([on.transport], { blockMode: "on" }).rule("I stand in the window.", [window]);
    expect(on.effect()?.answerKeys).toContain("block");
    expect(on.effect()?.prompt).toContain("block (stand in a way out so nobody passes through it; the target is the way out)");
    // Only the key and its one clause differ.
    expect(on.effect()?.prompt.replace("block (stand in a way out so nobody passes through it; the target is the way out), ", "")).toBe(bare.effect()?.prompt);
  });

  it("is grounded like custody: target and effect cited from the intent, no property citation needed", async () => {
    const transport: ReaderTransport = async (request) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey: q.id === "target" ? "window" : q.id === "effect" ? "block" : q.id === "magnitude" ? "moderate" : q.id === "perceptibility" ? "visible" : "none",
        citation: { sourceId: "intent", quote: q.id === "target" ? "the window" : "stand in" },
      }));
    const r = await createReferee([transport], { blockMode: "on" }).rule("I stand in the window.", [{ id: "window", description: "A small window set in the wall." }]);
    expect(r.effectKind).toBe("block");
    expect(r.applicable).toBe(true);
  });

  it("describes the attempt, and the precedent text follows from it", () => {
    // The-prisoner#34, changed on purpose: built from the actor's own declared pronoun now, so the
    // warden's own attempt reads "himself" (it used to say "herself" whoever planted themselves).
    expect(describeAttempt("warden", { targetObjectId: "window", effectKind: "block" })).toBe(`${WARDEN_NAME} plants himself in the window.`);
    expect(precedentTextFor({ targetObjectId: "door", effectKind: "block" })).toBe("A prisoner plants herself in the door.");
  });
});

describe("the blocking resources (D4', RED-TEAM.md F4)", () => {
  afterEach(() => destroyTestDb());

  it("one per principal, always built -- presence off too -- at 0, bounded over the ways out", () => {
    for (const presence of ["off", "modelled"] as const) {
      createTestDb();
      const w = buildOpenWorld({ presence });
      for (const p of ["prisoner", "warden"] as const) {
        const r = getResource(w.blocking[p]);
        expect(r?.name).toBe(`${p}_blocking`);
        expect(r?.value).toBe(0);
        expect(r?.minValue).toBe(0);
        expect(r?.maxValue).toBeGreaterThanOrEqual(Object.keys(w.exits).length);
      }
      destroyTestDb();
    }
  });

  it("wayOutIndex / wayOutAt: a fixed 1-based order over the exits, 0 for anything else", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(Object.keys(w.exits)).toEqual(["door", "window"]);
    expect(wayOutIndex(w, "door")).toBe(1);
    expect(wayOutIndex(w, "window")).toBe(2);
    expect(wayOutIndex(w, "bar")).toBe(0);
    expect(wayOutAt(w, 2)).toBe("window");
    expect(wayOutAt(w, 0)).toBeUndefined();
  });

  it("a block on something that is not a way out is no plan at all (no invented world)", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const common = { effectKind: "block" as const, property: "none" as const, magnitude: "moderate" as const, entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.wardenId, description: "d", block: { actorResourceId: w.blocking.warden, wayOutIndex: { door: 1, window: 2 }, max: 2, blockers: [] } };
    expect(planEffect({ ...common, targetObjectId: "bar" })).toBeNull();
    expect(planEffect({ ...common, targetObjectId: "cot" })).toBeNull();
    expect(planEffect({ ...common, targetObjectId: "window" })?.mechanic).toBe("OPEN_BLOCK");
  });
});

describe("a block is an occupation (D4', RED-TEAM.md F11)", () => {
  afterEach(() => destroyTestDb());

  it("a leave through a blocked way out is refused, and says why", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    const blocked = await act(w, "warden", 1, BLOCK_WINDOW);
    expect(blocked.plan?.mechanic).toBe("OPEN_BLOCK");
    expect(blockingOf(w, "warden", blocked.t)).toBe(2);
    expect(renderOwnOutcome(blocked)).toContain("You stand in the window; nobody passes while you hold it.");
    // The-prisoner#34, changed on purpose (see "describes the attempt" above).
    expect(blocked.perceptionForOther).toBe(`${WARDEN_NAME} plants himself in the window.`);

    const leave = await act(w, "prisoner", 1, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(false);
    expect(leave.outcome?.result.held).toBe("blocked");
    expect(renderOwnOutcome(leave)).toContain(`Your last attempt met ${WARDEN_NAME} standing in the window: you are still in the cell.`);
  });

  it("the transcript prints the OPEN_BLOCK resolution", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const blocked = await act(w, "warden", 1, BLOCK_WINDOW);
    const text = renderOpenHalfRound(blocked).join("\n");
    expect(text).toContain("Resolved `OPEN_BLOCK`");
    expect(text).toContain("warden_blocking: 0 -> 2");
  });

  it("succeeds when the blocker is crouched (C1's own line)", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW);
    w.base.clock.prisonerT(1);
    set(w, w.resourceIdFor["warden.posture"], POSTURE_ON_HER_FEET_ABOVE);
    const leave = await act(w, "prisoner", 1, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(true);
  });

  it("holds while she stands just above the line", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW);
    w.base.clock.prisonerT(1);
    set(w, w.resourceIdFor["warden.posture"], POSTURE_ON_HER_FEET_ABOVE + 1);
    const leave = await act(w, "prisoner", 1, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(false);
  });

  it("succeeds when the blocker is elsewhere", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "open" } });
    await act(w, "warden", 1, BLOCK_WINDOW);
    w.base.clock.prisonerT(1);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_LEAVE", parameters: { characterId: w.base.wardenId, passageResourceId: w.exits.door.passageResourceId, integrityResourceId: w.exits.door.integrityResourceId, destinationId: w.namedLocations.corridor, description: "out" } });
    const leave = await act(w, "prisoner", 1, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(true);
  });

  it("lapses when the blocker's next resolved act is something else", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW);
    const examined = await act(w, "warden", 2, EXAMINE_BAR);
    expect(examined.blockLapsed).toBe("window");
    expect(blockingOf(w, "warden", examined.t)).toBe(0);
    expect(renderOpenHalfRound(examined).join("\n")).toContain("the warden steps out of the window");
    const leave = await act(w, "prisoner", 2, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(true);
  });

  it("a second block on another way out clears the first", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW);
    const door = await act(w, "warden", 2, BLOCK_DOOR);
    expect(blockingOf(w, "warden", door.t)).toBe(1);
    const leave = await act(w, "prisoner", 2, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(true);
  });

  it("blocking the same way out again keeps it, with no lapse", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "warden", 1, BLOCK_WINDOW);
    const again = await act(w, "warden", 2, BLOCK_WINDOW);
    expect(again.blockLapsed).toBeUndefined();
    expect(blockingOf(w, "warden", again.t)).toBe(2);
  });

  it("a silent turn keeps it; so does an inapplicable ruling", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW);
    const silent = await act(w, "warden", 2, null);
    expect(silent.proposal).toBeNull();
    expect(blockingOf(w, "warden", silent.t)).toBe(2);
    const inapplicable = await act(w, "warden", 3, EXAMINE_BAR, "modelled", false);
    expect(inapplicable.outcome).toBeNull();
    expect(blockingOf(w, "warden", inapplicable.t)).toBe(2);
    const leave = await act(w, "prisoner", 3, LEAVE_WINDOW);
    expect(leave.outcome?.result.left).toBe(false);
  });

  it("the blocker's own leave clears it too", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "warden", 1, BLOCK_WINDOW);
    const leave = await act(w, "warden", 2, ruling("door", "leave"));
    expect(leave.blockLapsed).toBe("window");
    expect(blockingOf(w, "warden", leave.t)).toBe(0);
  });

  it("holds under presence off too (no posture modelled counts as on her feet)", async () => {
    createTestDb();
    const w = buildOpenWorld();
    openWindow(w);
    await act(w, "warden", 1, BLOCK_WINDOW, "off");
    const leave = await act(w, "prisoner", 1, LEAVE_WINDOW, "off");
    expect(leave.outcome?.result.left).toBe(false);
  });
});

describe("the block and restore conditions (D4', D4b), asserted against the world", () => {
  afterEach(() => destroyTestDb());

  it("render only under blockMode on, after every existing condition, so the catch numbering is unchanged", () => {
    expect(openConditions({ block: "off" })).toEqual(openConditions());
    const on = openConditions({ block: "on" });
    expect(on.slice(0, openConditions().length)).toEqual(openConditions());
    expect(on.slice(openConditions().length)).toEqual([
      // The-prisoner#34, changed on purpose: built from `WARDEN_PRONOUNS` now (discrepancy 8).
      { when: [`${WARDEN_NAME} stands in a way out`, `${WARDEN_NAME} is on ${WARDEN_PRONOUNS.possessive} feet`, `${WARDEN_NAME} can see`], then: `${PRISONER_NAME} cannot leave through it`, for: WARDEN_NAME },
      { when: ["the bar's integrity is below 100"], then: `${WARDEN_NAME} can mend it`, for: WARDEN_NAME },
      { when: ["the lock's integrity is below 100"], then: `${WARDEN_NAME} can mend it`, for: WARDEN_NAME },
    ]);
    // Welded: the bar has no integrity to mend.
    expect(JSON.stringify(openConditions({ block: "on", window: "welded" }))).not.toContain("bar's integrity is below");
  });

  it("the restore conditions: bar and lock both declare a restore table up to 100", () => {
    for (const part of ["bar", "lock"] as const) {
      const p = findProperty(part, "integrity");
      expect(p?.max).toBe(100);
      expect(p?.restore.slight).toBeGreaterThan(0);
    }
  });

  it("the block condition's two gates are the mechanic's own lines", () => {
    expect(POSTURE_ON_HER_FEET_ABOVE).toBe(75);
    expect(SIGHT_BLIND_AT_OR_BELOW).toBe(60);
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const plan = planEffect({ targetObjectId: "window", effectKind: "leave", property: "none", magnitude: "slight", entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.prisonerId, description: "d", block: { actorResourceId: w.blocking.prisoner, wayOutIndex: { door: 1, window: 2 }, max: 2, blockers: [] } });
    expect(plan?.parameters).toMatchObject({ wayOutIndex: 2, standsAbove: POSTURE_ON_HER_FEET_ABOVE, seesAbove: SIGHT_BLIND_AT_OR_BELOW });
  });
});
