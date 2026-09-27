import { describe, it, expect, afterEach } from "vitest";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenBriefing, principalLocation, readAbsenceMode, checkAbsenceMode, absenceRuleLine, wardenAbsentOn, ABSENT_EVERY_N_ROUNDS } from "../briefing.js";
import { runOpenGame } from "../game.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import type { Referee, RefereeRuling } from "../referee.js";
import type { OpenMind } from "../mind.js";
import { PRISONER_SHORT_NAME, WARDEN_NAME } from "../../scenario.js";
import { TIME_DECAY_AMOUNT } from "../../world/mechanics.js";

/**
 * PLAYTEST-2026-09-27 D5 (design §2's presence rhythm, RED-TEAM.md F10's two consequences): under
 * `PRISONER_ABSENCE=cadence` the warden is out of the cell on every round n with n % 4 === 0. The game moves him
 * by an audited `OPEN_MOVE` (no exit is opened or used), skips his half-round entirely (no wits call, no
 * referee call), and moves him back before his next half-round. Both chairs are told the rule every turn.
 */

const DIG: RefereeRuling = (() => {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId: "bar",
    effectKind: "wear",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { citation: { sourceId: "desc:bar", quote: "x" }, requiredSourceId: "desc:bar", verified: true }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  } as RefereeRuling;
})();

function roundOf(briefing: string): number {
  return Number(/^Round (\d+) of/.exec(briefing)?.[1]);
}

/** A warden that is silent every round, and fails the test outright if it is ever asked on an absent round. */
const wardenMind: OpenMind = {
  consider: async (context) => {
    if (wardenAbsentOn(roundOf(context.briefing))) throw new Error(`the absent warden was asked on round ${roundOf(context.briefing)}`);
    return null;
  },
} as OpenMind;

const prisonerMind: OpenMind = { consider: async () => ({ intent: "I scrape at the bar.", line: "" }) } as unknown as OpenMind;
const referee: Referee = { rule: async () => DIG };

describe("readAbsenceMode (D5)", () => {
  it("cadence unless asked; off is today's; anything else stops the run", () => {
    expect(readAbsenceMode(undefined)).toBe("cadence");
    expect(readAbsenceMode("")).toBe("cadence");
    expect(readAbsenceMode("off")).toBe("off");
    expect(() => readAbsenceMode("sometimes")).toThrow(/PRISONER_ABSENCE/);
  });

  it("cadence needs presence modelled, and says so", () => {
    expect(() => checkAbsenceMode("cadence", "off")).toThrow(/PRISONER_ABSENCE=cadence needs PRISONER_PRESENCE=modelled/);
    expect(() => checkAbsenceMode("cadence", "modelled")).not.toThrow();
    expect(() => checkAbsenceMode("off", "off")).not.toThrow();
  });

  it("the warden is out on every round divisible by the constant", () => {
    expect(ABSENT_EVERY_N_ROUNDS).toBe(4);
    expect([1, 2, 3, 4, 5, 8, 12].map(wardenAbsentOn)).toEqual([false, false, false, true, false, true, true]);
  });
});

describe("the absence cadence in play (D5)", () => {
  afterEach(() => destroyTestDb());

  it("runOpenGame refuses cadence with presence off", async () => {
    createTestDb();
    const w = buildOpenWorld();
    await expect(runOpenGame({ openWorld: w, resolver: buildOpenResolver(), referee, wardenMind, prisonerMind, rounds: 1, absenceMode: "cadence" })).rejects.toThrow(/PRISONER_PRESENCE=modelled/);
  });

  async function play(w: OpenWorld, rounds: number) {
    return runOpenGame({ openWorld: w, resolver: buildOpenResolver(), referee, wardenMind, prisonerMind, rounds, presenceMode: "modelled", absenceMode: "cadence" });
  }

  it("the warden is in the corridor on round 4 and back in the cell on round 5; his round-4 half is skipped", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const game = await play(w, 5);
    const at = (n: number, who: "warden" | "prisoner") => game.halves.find((h) => h.roundN === n && h.principal === who)!;
    expect(principalLocation(w, "warden", at(4, "warden").t)).toBe(w.namedLocations.corridor);
    expect(principalLocation(w, "warden", at(4, "prisoner").t)).toBe(w.namedLocations.corridor);
    expect(principalLocation(w, "warden", at(5, "warden").t)).toBe(w.base.cellId);
    expect(principalLocation(w, "warden", at(3, "warden").t)).toBe(w.base.cellId);
    const skipped = at(4, "warden");
    expect(skipped.proposal).toBeNull();
    expect(skipped.skipped).toBe("absent");
    expect(renderOpenHalfRound(skipped).join("\n")).toContain("SilenceReason: `absent (cadence)`");
    // No exit was opened for it: the door is as it was.
    expect(getResource(w.exits.door.passageResourceId as string)?.value).toBe(0);
  });

  it("the prisoner's round-4 act reaches the warden as nothing and raises no suspicion", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const game = await play(w, 5);
    const dig4 = game.halves.find((h) => h.roundN === 4 && h.principal === "prisoner")!;
    const dig3 = game.halves.find((h) => h.roundN === 3 && h.principal === "prisoner")!;
    expect(dig4.outcome).not.toBeNull();
    expect(dig4.perceptionForOther).toBeNull();
    const suspicion = (t: number) => readNumericFact({ gameId: w.base.gameId, t, entityId: w.base.resources.wardenSuspicion, key: "value" });
    expect(suspicion(dig4.t)).toBe(suspicion(dig3.t));
    expect(dig3.perceptionForOther).toEqual(expect.any(String));
    // Round 5: he hears of round 3's dig (queued while he was out), never of round 4's.
    const back = game.halves.find((h) => h.roundN === 5 && h.principal === "warden")!;
    expect(back.context.briefing.split("\n").filter((l) => l === dig3.perceptionForOther).length).toBe(1);
  });

  it("time decay still runs once per round, the absent round included", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const before = getResource(w.base.resources.guardAttention)?.value as number;
    await play(w, 3);
    const three = getResource(w.base.resources.guardAttention)?.value as number;
    expect(three).toBe(before - 3 * TIME_DECAY_AMOUNT);
    destroyTestDb();
    createTestDb();
    const w2 = buildOpenWorld({ presence: "modelled" });
    await play(w2, 4);
    expect(getResource(w2.base.resources.guardAttention)?.value).toBe(Math.max(0, before - 4 * TIME_DECAY_AMOUNT));
  });
});

describe("the standing rule line (D5)", () => {
  afterEach(() => destroyTestDb());

  it("is built from the constant", () => {
    expect(absenceRuleLine()).toBe(`${WARDEN_NAME} is out of the cell on round 4, and every fourth round after; while out, nothing ${PRISONER_SHORT_NAME} does is seen or heard.`);
  });

  it("both briefings carry it beside the presence line under cadence; neither does under off", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const t = w.base.clock.wardenT(1);
    for (const who of ["warden", "prisoner"] as const) {
      const lines = buildOpenBriefing(w, who, t, 1, 12, {}, "modelled", "cadence").split("\n");
      const presence = lines.findIndex((l) => l.endsWith("is here with you."));
      expect(lines[presence + 1]).toBe(absenceRuleLine());
      expect(buildOpenBriefing(w, who, t, 1, 12, {}, "modelled", "off")).not.toContain(absenceRuleLine());
    }
  });
});
