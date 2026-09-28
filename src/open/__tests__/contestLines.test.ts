import { describe, it, expect, afterEach } from "vitest";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact, readFactValue } from "../../world/facts.js";
import { buildOpenWorld, readDoorPrice, OPEN_DOOR_LOCK_MARGIN, OPEN_WINDOW_BAR_MAX, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { readPresenceMode, readAbsenceMode, wardenAbsentOn } from "../briefing.js";
import { readBlockMode, type EffectKind } from "../effects.js";
import { openConditions, readConditionsMode, readDoorMode } from "../conditions.js";
import { renderConditionList } from "../conditionList.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { renderOwnOutcome } from "../perception.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import type { Referee, RefereeRuling } from "../referee.js";
import type { OpenMind, OpenProposal } from "../mind.js";
import type { OpenHalfRoundResult } from "../loop.js";
import { PRISONER_NAME, WARDEN_NAME, WARDEN_SHORT_NAME, PRISONER_SHORT_NAME } from "../../scenario.js";
import { SEARCH_SUSPICION_THRESHOLD } from "../../world/mechanics.js";
import type { Principal } from "../../ledger/beliefs.js";

/**
 * PLAYTEST-2026-09-27 review of the contest mechanics (BUILD-SPEC landing step 4: D4' + D4b, D11, D12, D5 and the
 * D2/D3/D6' defaults) against RED-TEAM.md §2's turn arithmetic. Every line here is PLAYED through the real
 * `runOpenGame` (so `runOpenHalfRound`, the resolver, the catch and the escape checks are the ones a game runs),
 * with scripted minds and a scripted referee that hands back a fixed ruling per intent -- test content only; no
 * production code reads an intent.
 *
 * Under the new defaults, each asserted against its env reader so the test cannot drift from what a real game
 * gets: presence modelled, conditions both, door margin + stated, block on, absence cadence.
 *
 * Numbers used throughout (scenarioObjects.ts): the bar wears 8/15/25, the lock 10/20/35; the window opens at bar
 * <= 50 (OPEN_WINDOW_BAR_MAX), the door at lock <= 60 (OPEN_DOOR_LOCK_MARGIN); a visible moderate prisoner act
 * is +10 suspicion; a warden reveal that finds a value below his belief is +floor(drop / 2); grounds at 40; the
 * warden acts first every round; he is out on every fourth round.
 */

// ---- the defaults, as a real game reads them -------------------------------------------------------------

const PRESENCE = readPresenceMode(undefined);
const ABSENCE = readAbsenceMode(undefined);
const DOOR_PRICE = readDoorPrice(undefined);
const DOOR = readDoorMode(undefined);
const CONDITIONS = readConditionsMode(undefined);
const BLOCK = readBlockMode(undefined);

// ---- a scripted referee: one fixed ruling per intent -------------------------------------------------------

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"] = "none", magnitude: RefereeRuling["magnitude"] = "moderate", perceptibility: RefereeRuling["perceptibility"] = "visible"): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude,
    perceptibility,
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "x" }, requiredSourceId: `desc:${targetObjectId}`, verified: true }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

const DIG = "I dig at the mortar round the bar.";
const OPEN_WINDOW = "I pull the bar free and push the window open.";
const LEAVE_WINDOW = "I climb out through the window.";
const WEAR_LOCK = "I work the lock with the spoon.";
const OPEN_DOOR = "I lever the bolt back and pull the door open.";
const LEAVE_DOOR = "I slip out through the door.";
const EXAMINE_BAR = "I examine the bar closely.";
const EXAMINE_WINDOW = "I look the window over closely.";
const BLOCK_WINDOW = "I stand in the window.";
const CLOSE_WINDOW = "I shut the window.";
const CLOSE_DOOR = "I bolt the door.";
const COVER_HIM = "I throw the blanket over Croft's head.";
const COVER_HIM_LIGHTLY = "I flick the blanket at Croft's face.";
const CLEAR_EYES = "I pull the blanket off my head.";
const TRIP_HIM = "I shove Croft to the floor.";
const TAKE_KEYS = "I snatch the key ring from Croft's belt.";
const WAIT = "I watch Voss from the doorway.";

const TABLE: Record<string, RefereeRuling> = {
  [DIG]: ruling("bar", "wear", "integrity"),
  [OPEN_WINDOW]: ruling("window", "open", "passage"),
  [LEAVE_WINDOW]: ruling("window", "leave"),
  [WEAR_LOCK]: ruling("lock", "wear", "integrity"),
  [OPEN_DOOR]: ruling("door", "open", "passage"),
  [LEAVE_DOOR]: ruling("door", "leave"),
  [EXAMINE_BAR]: ruling("bar", "reveal", "integrity", "slight"),
  [EXAMINE_WINDOW]: ruling("window", "reveal", "passage", "slight"),
  [BLOCK_WINDOW]: ruling("window", "block"),
  [CLOSE_WINDOW]: ruling("window", "close", "passage"),
  [CLOSE_DOOR]: ruling("door", "close", "passage"),
  [COVER_HIM]: ruling("warden", "wear", "sight", "moderate"),
  [COVER_HIM_LIGHTLY]: ruling("warden", "wear", "sight", "slight"),
  [CLEAR_EYES]: ruling("warden", "restore", "sight", "slight"),
  [TRIP_HIM]: ruling("warden", "wear", "posture", "moderate"),
  [TAKE_KEYS]: ruling("key_ring", "take"),
  [WAIT]: ruling("none", "noise", "none", "slight", "silent"),
};

const referee: Referee = {
  rule: async (intent) => {
    const r = TABLE[intent];
    if (!r) throw new Error(`the scripted referee has no ruling for ${JSON.stringify(intent)}`);
    return r;
  },
};

// ---- scripted minds, keyed on the round their own briefing names -------------------------------------------

function roundOf(briefing: string): number {
  return Number(/^Round (\d+) of/.exec(briefing)?.[1]);
}

/** A mind that answers from a per-round script; `null` (or a round the script leaves out) is a silent turn. A
 *  mind asked on a round it is not in the cell for would be a bug in the cadence, so the warden's refuses one. */
function byRound(principal: Principal, script: (n: number) => string | OpenProposal | null): OpenMind {
  return {
    consider: async (context) => {
      const n = roundOf(context.briefing);
      if (principal === "warden" && ABSENCE === "cadence" && wardenAbsentOn(n)) throw new Error(`the absent warden was asked on round ${n}`);
      const answer = script(n);
      if (answer === null) return null;
      return typeof answer === "string" ? { intent: answer } : answer;
    },
  } as OpenMind;
}

// ---- the world and its readings ---------------------------------------------------------------------------

function newWorld(): OpenWorld {
  createTestDb();
  return buildOpenWorld({ doorPrice: DOOR_PRICE, presence: PRESENCE });
}

async function play(w: OpenWorld, wardenMind: OpenMind, prisonerMind: OpenMind, rounds = 30): Promise<OpenGameResult> {
  return runOpenGame({ openWorld: w, resolver: buildOpenResolver(), referee, wardenMind, prisonerMind, rounds, presenceMode: PRESENCE, absenceMode: ABSENCE });
}

function half(game: OpenGameResult, n: number, who: Principal): OpenHalfRoundResult {
  const h = game.halves.find((x) => x.roundN === n && x.principal === who);
  if (!h) throw new Error(`no ${who} half-round in round ${n}`);
  return h;
}

function suspicionAt(w: OpenWorld, t: number): number {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: w.base.resources.wardenSuspicion, key: "value" }) ?? 0;
}

function valueAt(w: OpenWorld, resourceId: string, t: number): number | null {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: resourceId, key: "value" });
}

/** A starting state laid down through the resolver before play (never a direct write), for a line that begins
 *  part-way through the arithmetic. */
function wearTo(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value as number;
  if (current > value) buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set up" } });
}

describe("the defaults this file plays under (D2, D3, D6', D4', D5)", () => {
  it("are what a real game reads with no variable set", () => {
    expect({ PRESENCE, ABSENCE, DOOR_PRICE, DOOR, CONDITIONS, BLOCK }).toEqual({ PRESENCE: "modelled", ABSENCE: "cadence", DOOR_PRICE: "margin", DOOR: "stated", CONDITIONS: "both", BLOCK: "on" });
  });
});

describe("Line B (RED-TEAM.md §2): every dig unseen, the window opened unseen, and out at round 21", () => {
  afterEach(() => destroyTestDb());

  it("escapes at round 21 with suspicion never at grounds; his round-4/8/12/16/20 half-rounds were skipped", async () => {
    const w = newWorld();
    const absentDigs = [4, 8, 12, 16];
    const prisoner = byRound("prisoner", (n) => (absentDigs.includes(n) ? DIG : n === 20 ? OPEN_WINDOW : n === 21 ? LEAVE_WINDOW : null));
    // He examines the bar every present turn -- the design's condition 4 -- and the window on his return at 21.
    const warden = byRound("warden", (n) => (n === 21 ? EXAMINE_WINDOW : EXAMINE_BAR));
    const game = await play(w, warden, prisoner);

    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(21);
    for (const n of [4, 8, 12, 16, 20]) {
      expect(half(game, n, "warden").skipped).toBe("absent");
      expect(half(game, n, "warden").proposal).toBeNull();
    }
    // Every dig landed, unseen: the bar is 40 after round 16, and nothing she did reached him.
    expect(valueAt(w, w.base.resources.barIntegrity, half(game, 16, "prisoner").t)).toBe(40);
    for (const n of [...absentDigs, 20]) expect(half(game, n, "prisoner").perceptionForOther).toBeNull();
    expect(half(game, 20, "prisoner").outcome?.result.opened).toBe(true);
    // Four looks at a bar one dig lower than he last saw it: +7 each, 28 in all -- never 40.
    // (Read up to his round-21 look: her leave itself is a visible act and bumps, but she is already out.)
    const suspicions = game.halves.filter((h) => h.roundN < 21 || h.principal === "warden").map((h) => suspicionAt(w, h.t));
    expect(Math.max(...suspicions)).toBe(28);
    expect(Math.max(...suspicions)).toBeLessThan(SEARCH_SUSPICION_THRESHOLD);
    // Round 21: he finds the window standing open, without grounds -- no catch -- and she leaves.
    expect(half(game, 21, "warden").revealFor).toEqual({ objectId: "window", property: "passage", value: 1 });
    expect(half(game, 21, "prisoner").outcome?.result.left).toBe(true);
  });
});

describe("Line A (RED-TEAM.md §2): digging in his presence, he examines the bar each turn", () => {
  afterEach(() => destroyTestDb());

  it("suspicion crosses 40 in round 3, and the window she opens in his presence is caught on his next turn", async () => {
    const w = newWorld();
    // Dig 1-4 (round 4 unseen), open in round 5 in front of him.
    const prisoner = byRound("prisoner", (n) => (n <= 4 ? DIG : n === 5 ? OPEN_WINDOW : LEAVE_WINDOW));
    const warden = byRound("warden", (n) => (n <= 5 ? EXAMINE_BAR : EXAMINE_WINDOW));
    const game = await play(w, warden, prisoner);

    // r1 dig +10; r2 look 100->85 +7, dig +10; r3 look 85->70 +7, dig +10 = 44 (his round-0 belief is the prior).
    expect(suspicionAt(w, half(game, 1, "prisoner").t)).toBe(10);
    expect(suspicionAt(w, half(game, 2, "prisoner").t)).toBe(27);
    expect(suspicionAt(w, half(game, 3, "warden").t)).toBe(34);
    expect(suspicionAt(w, half(game, 3, "prisoner").t)).toBe(44);
    // r4 unseen (no bump). r5 his look finds 40 against his round-3 belief of 70 (he was out in round 4), so
    // +15, not RED-TEAM.md §2's +7 (the table compares against 55, a value he never saw); bar 40 is above the
    // catch's 30. Her open +10.
    expect(suspicionAt(w, half(game, 4, "prisoner").t)).toBe(44);
    expect(half(game, 5, "warden").revealFor?.value).toBe(40);
    expect(suspicionAt(w, half(game, 5, "warden").t)).toBe(59);
    expect(half(game, 5, "prisoner").outcome?.result.opened).toBe(true);
    expect(suspicionAt(w, half(game, 5, "prisoner").t)).toBe(69);
    // r6: he examines the open window with grounds -- caught before she can leave.
    expect(game.ended).toEqual({ kind: "caught" });
    expect(game.endedAtRound).toBe(6);
    expect(game.halves.at(-1)?.principal).toBe("warden");
  });
});

describe("a block is an occupation, played (D4', RED-TEAM.md F11, Line D)", () => {
  afterEach(() => destroyTestDb());

  it("he blocks at round 1; his examination at round 2 lapses it, and she leaves through the open window", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "set up" } });
    const warden = byRound("warden", (n) => (n === 1 ? BLOCK_WINDOW : EXAMINE_BAR));
    const prisoner = byRound("prisoner", () => LEAVE_WINDOW);
    const game = await play(w, warden, prisoner);

    expect(half(game, 1, "prisoner").outcome?.result).toMatchObject({ left: false, held: "blocked" });
    expect(half(game, 2, "warden").blockLapsed).toBe("window");
    expect(valueAt(w, w.blocking.warden, half(game, 2, "warden").t)).toBe(0);
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(2);
  });

  it("he re-blocks every turn: the window is held, but the door is not -- two lock wears to 60, open, leave", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "set up" } });
    const warden = byRound("warden", () => BLOCK_WINDOW);
    // r1 the window (held); r2, r3 the lock to 60; r4 (he is out) she waits; r5 open the door; r6 out through it.
    const script: Record<number, string | null> = { 1: LEAVE_WINDOW, 2: WEAR_LOCK, 3: WEAR_LOCK, 4: null, 5: OPEN_DOOR, 6: LEAVE_DOOR };
    const prisoner = byRound("prisoner", (n) => script[n] ?? null);
    const game = await play(w, warden, prisoner);

    expect(half(game, 1, "prisoner").outcome?.result).toMatchObject({ left: false, held: "blocked" });
    expect(valueAt(w, w.base.resources.lockIntegrity, half(game, 3, "prisoner").t)).toBe(OPEN_DOOR_LOCK_MARGIN);
    expect(half(game, 5, "prisoner").outcome?.result.opened).toBe(true);
    for (const n of [1, 2, 3, 5, 6]) {
      expect(half(game, n, "warden").blockLapsed).toBeUndefined();
      expect(valueAt(w, w.blocking.warden, half(game, n, "prisoner").t)).toBe(2);
    }
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(6);
    expect(half(game, 6, "prisoner").ruling?.targetObjectId).toBe("door");
    // A warden who only blocks never looks, so nothing can catch her -- though four visible acts at +10 (the
    // refused leave included: a leave met by a block still resolved) have given him grounds by round 6.
    expect(suspicionAt(w, half(game, 6, "warden").t)).toBe(40);
  });

  it("the cadence lifts a block: a blocker in the corridor holds nothing, so an open window is free on round 4", async () => {
    // Not a defect -- D4' reads the blocker's location live, and D5 moves him out -- but it is what makes Line D
    // (block the window at round 1) a losing line for him under the defaults: RED-TEAM.md F1's lock-out is gone.
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "set up" } });
    const warden = byRound("warden", () => BLOCK_WINDOW);
    const prisoner = byRound("prisoner", () => LEAVE_WINDOW);
    const game = await play(w, warden, prisoner);

    for (const n of [1, 2, 3]) expect(half(game, n, "prisoner").outcome?.result).toMatchObject({ left: false, held: "blocked" });
    // Out of the cell, and out of the window with it (his block lapsed as the cadence moved him).
    expect(valueAt(w, w.blocking.warden, half(game, 4, "prisoner").t)).toBe(0);
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(4);
  });

  it("being moved out by the cadence ends his block: back on round 5 with a silent turn, he is not in the window", async () => {
    // D4' (an occupation; "leaving clears it") applied to the one departure that is not his own act: D5's move to
    // the corridor. Without this his resource still read 2 on his return, and a silent turn -- which keeps a block
    // he is standing in -- put him back in a window he walked away from, with no act of his.
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "set up" } });
    const warden = byRound("warden", (n) => (n === 3 ? BLOCK_WINDOW : null));
    const prisoner = byRound("prisoner", (n) => (n === 3 || n === 5 ? LEAVE_WINDOW : null));
    const game = await play(w, warden, prisoner, 5);

    expect(half(game, 3, "prisoner").outcome?.result).toMatchObject({ left: false, held: "blocked" });
    const out = half(game, 4, "warden");
    expect(out.skipped).toBe("absent");
    expect(out.blockLapsed).toBe("window");
    expect(valueAt(w, w.blocking.warden, out.t)).toBe(0);
    expect(renderOpenHalfRound(out).join("\n")).toContain("Resolved `OPEN_BLOCK` first: the warden steps out of the window (warden_blocking -> 0).");
    expect(half(game, 5, "warden").proposal).toBeNull();
    expect(half(game, 5, "prisoner").outcome?.result.left).toBe(true);
    expect(game.endedAtRound).toBe(5);
  });
});

describe("close refuses on a spent part (D11, RED-TEAM.md F3), played", () => {
  afterEach(() => destroyTestDb());

  it("the window: her open, his close refused (bar at 40), she leaves; his refused close costs her nothing", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : CLOSE_WINDOW));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? OPEN_WINDOW : LEAVE_WINDOW));
    const game = await play(w, warden, prisoner);

    const close = half(game, 2, "warden");
    expect(close.outcome?.result).toMatchObject({ shut: false, partId: "bar" });
    expect(valueAt(w, w.exits.window.passageResourceId as string, close.t)).toBe(1);
    expect(renderOwnOutcome(close)).toContain("The window cannot be shut: the bar is out of it.");
    // She is told the attempt, never the outcome (D1).
    expect(close.perceptionForOther).toBe(`${WARDEN_NAME} works to shut the window.`);
    // Her open was +10; his refused close adds nothing.
    expect(suspicionAt(w, half(game, 1, "prisoner").t)).toBe(10);
    expect(suspicionAt(w, close.t)).toBe(10);
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(2);
  });

  it("the door under margin: her open at lock 60, his bolt refused once the ring is off his belt, she leaves", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.lockIntegrity, OPEN_DOOR_LOCK_MARGIN);
    // Changed on purpose, 2026-09-27 (D15): the key ring lifts the gate for its holder -- see the next line -- so
    // D11's door line is now the line of a warden who has lost it.
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_GIVE", parameters: { itemId: w.entityIdFor.key_ring, actorId: w.base.wardenId, recipientId: w.base.prisonerId, description: "set up" } });
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : CLOSE_DOOR));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? OPEN_DOOR : LEAVE_DOOR));
    const game = await play(w, warden, prisoner);

    const close = half(game, 2, "warden");
    expect(close.outcome?.result).toMatchObject({ shut: false, partId: "lock" });
    expect(renderOwnOutcome(close)).toContain("The door cannot be bolted: the lock will not hold.");
    expect(suspicionAt(w, close.t)).toBe(suspicionAt(w, half(game, 1, "prisoner").t));
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(2);
  });

  it("D15, corrected 2026-09-27: the ring lifts the OPEN gate only -- his bolt of the door she opened at lock 60 is refused, F3's loop stays closed", async () => {
    // The owner's answer was "a held ring opens the door", not "bolts it": D11's close gate binds the key's holder
    // like anyone else, so her open lands, his bolt is refused, and she leaves.
    const w = newWorld();
    wearTo(w, w.base.resources.lockIntegrity, OPEN_DOOR_LOCK_MARGIN);
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : CLOSE_DOOR));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? OPEN_DOOR : LEAVE_DOOR));
    const game = await play(w, warden, prisoner, 2);

    expect(half(game, 1, "prisoner").outcome?.result.opened).toBe(true);
    const close = half(game, 2, "warden");
    expect(close.outcome?.result).toMatchObject({ shut: false, partId: "lock" });
    expect(valueAt(w, w.exits.door.passageResourceId as string, close.t)).toBe(1);
    expect(half(game, 2, "prisoner").outcome?.result.left).toBe(true);
    expect(game.ended?.kind).toBe("escaped");
  });

  it("the F3 loop cannot happen: at every bar value, her open lands exactly when his close is refused", async () => {
    for (const bar of [100, 70, 55, OPEN_WINDOW_BAR_MAX + 1, OPEN_WINDOW_BAR_MAX, 40, 10]) {
      const w = newWorld();
      wearTo(w, w.base.resources.barIntegrity, bar);
      const warden = byRound("warden", (n) => (n === 1 ? WAIT : CLOSE_WINDOW));
      // Round 2 is a silent turn for her, so the game runs on to read his close.
      const prisoner = byRound("prisoner", (n) => (n === 1 ? OPEN_WINDOW : null));
      const game = await play(w, warden, prisoner, 2);
      // D7a: a refused open wears the bar by the ruled magnitude, so read the bar as he met it.
      const opened = half(game, 1, "prisoner").outcome?.result.opened === true;
      const close = half(game, 2, "warden").outcome?.result as { shut?: boolean; after?: number };
      const shut = close.shut !== false && close.after === 0;
      expect({ bar, opened, shut: opened ? shut : "n/a" }).toEqual({ bar, opened: bar <= OPEN_WINDOW_BAR_MAX, shut: opened ? false : "n/a" });
      destroyTestDb();
    }
  });
});

describe("the blind line (D12, external review F1), played", () => {
  afterEach(() => destroyTestDb());

  it("covered moderate (100 -> 50), he clears to 60 (still blind) and to 70; she opens unseen and is out before he can look", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    const sight = w.resourceIdFor["warden.sight"];
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : CLEAR_EYES));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? COVER_HIM : n === 2 ? OPEN_WINDOW : LEAVE_WINDOW));
    const game = await play(w, warden, prisoner);

    expect(valueAt(w, sight, half(game, 1, "prisoner").t)).toBe(50);
    // Changed on purpose, 2026-09-27 (D13, the owner's answer to §80): a hand on his body gives grounds at once,
    // 40, then the moderate +10. This asserted 0 under the §56 person rule.
    expect(suspicionAt(w, half(game, 1, "prisoner").t)).toBe(50);
    // Restore is slight only: +10 -> 60, which is still blind (<= SIGHT_BLIND_AT_OR_BELOW).
    expect(valueAt(w, sight, half(game, 2, "warden").t)).toBe(60);
    const open = half(game, 2, "prisoner");
    expect(open.outcome?.result.opened).toBe(true);
    expect(open.perceptionForOther).toBeNull();
    // Changed on purpose, 2026-09-27 (D14, the owner's answer to §80.4 question 1): a blind warden perceives
    // nothing, so nothing accrues -- her open adds nothing to the 50 his covering gave him. This asserted +10
    // "as built", when the bump read presence alone.
    expect(suspicionAt(w, open.t)).toBe(50);
    // Round 3: his second clearing takes him to 70 -- he can see -- but that was his act; she leaves.
    expect(valueAt(w, sight, half(game, 3, "warden").t)).toBe(70);
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(3);
  });

  it("had he looked instead of clearing, a blind look returns nothing and cannot catch", async () => {
    const w = newWorld();
    wearTo(w, w.base.resources.barIntegrity, 40);
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : EXAMINE_WINDOW));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? COVER_HIM : n === 2 ? OPEN_WINDOW : null));
    const game = await play(w, warden, prisoner, 3);
    const look = half(game, 3, "warden");
    expect(look.outcome?.result.blind).toBe(true);
    expect(look.revealFor).toBeNull();
    expect(game.ended).toBeNull();
  });

  it("a slight cover (100 -> 90) does nothing: he still sees her act and his look still reads", async () => {
    const w = newWorld();
    const sight = w.resourceIdFor["warden.sight"];
    const warden = byRound("warden", (n) => (n === 1 ? WAIT : EXAMINE_BAR));
    const prisoner = byRound("prisoner", (n) => (n === 1 ? COVER_HIM_LIGHTLY : DIG));
    const game = await play(w, warden, prisoner, 3);
    expect(valueAt(w, sight, half(game, 1, "prisoner").t)).toBe(90);
    expect(half(game, 2, "warden").revealFor).toEqual({ objectId: "bar", property: "integrity", value: 100 });
    expect(half(game, 2, "prisoner").perceptionForOther).toBe(`${PRISONER_NAME} works at the bar.`);
  });
});

describe("the key ring (RED-TEAM.md F12), closed by D15 (owner, 2026-09-27)", () => {
  afterEach(() => destroyTestDb());

  // Changed on purpose, 2026-09-27 (D15, the owner's answer to §80.4 question 2): both lines here asserted the
  // standing gap "as built" -- the ring opened nothing, for her or for him. The ring now lifts the door's gate
  // for whoever holds it, read from the ring's own owner column at resolution time.
  it("taken from a crouched warden, it opens the door at lock 100, and she is out while he is away", async () => {
    const w = newWorld();
    const warden = byRound("warden", () => WAIT);
    const prisoner = byRound("prisoner", (n) => (n === 1 ? TRIP_HIM : n === 2 ? TAKE_KEYS : n === 3 ? OPEN_DOOR : LEAVE_DOOR));
    const game = await play(w, warden, prisoner, 5);

    expect(valueAt(w, w.resourceIdFor["warden.posture"], half(game, 1, "prisoner").t)).toBe(50);
    expect(half(game, 2, "prisoner").outcome?.result.taken).toBe(true);
    expect(half(game, 3, "prisoner").outcome?.result).toMatchObject({ opened: true, withKey: true });
    expect(valueAt(w, w.base.resources.lockIntegrity, half(game, 3, "prisoner").t)).toBe(100);
    // D13: tripping him gave grounds at once (50), the take +10, the open +10 -- a watching warden with a reason
    // to look, who spent every turn waiting.
    expect(suspicionAt(w, half(game, 3, "prisoner").t)).toBe(70);
    expect(half(game, 4, "prisoner").outcome?.result.left).toBe(true);
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(4);
  });

  it("the warden, holding it, opens his own door under margin, and the lock is untouched", async () => {
    const w = newWorld();
    const warden = byRound("warden", (n) => (n === 1 ? OPEN_DOOR : WAIT));
    const prisoner = byRound("prisoner", () => null);
    const game = await play(w, warden, prisoner, 1);
    expect(half(game, 1, "warden").outcome?.result.opened).toBe(true);
    expect(valueAt(w, w.base.resources.lockIntegrity, half(game, 1, "warden").t)).toBe(100);
  });

  it("without it she is refused at lock 100, as before (D7a wears the lock instead)", async () => {
    const w = newWorld();
    const warden = byRound("warden", () => WAIT);
    const prisoner = byRound("prisoner", () => OPEN_DOOR);
    const game = await play(w, warden, prisoner, 1);
    expect(half(game, 1, "prisoner").outcome?.result.opened).toBe(false);
    expect(valueAt(w, w.base.resources.lockIntegrity, half(game, 1, "prisoner").t)).toBe(80);
  });
});

describe("absence and the spoken line (D5, mechanics deviation 5), played", () => {
  afterEach(() => destroyTestDb());

  it("an absent warden says and does nothing that reaches her; her round-4 act and line do not reach him", async () => {
    const w = newWorld();
    const warden = byRound("warden", (n) => ({ intent: WAIT, line: `Round ${n}, Voss.` }));
    const prisoner = byRound("prisoner", (n) => ({ intent: DIG, line: `Round ${n}, Warden.` }));
    const game = await play(w, warden, prisoner, 5);

    // Round 4: his half is skipped; her briefing carries nothing of his (her round-3 news came before).
    expect(half(game, 4, "warden").skipped).toBe("absent");
    const hers4 = half(game, 4, "prisoner").context.briefing;
    expect(hers4).not.toContain(`${WARDEN_SHORT_NAME} says:`);
    // Round 3's line reached her in round 3 (he spoke before she acted), and round 5's reaches her in round 5.
    expect(half(game, 3, "prisoner").context.briefing).toContain(`${WARDEN_SHORT_NAME} says: "Round 3, Voss."`);
    expect(half(game, 5, "prisoner").context.briefing).toContain(`${WARDEN_SHORT_NAME} says: "Round 5, Voss."`);
    // His round-5 briefing: her round-3 line (queued while he was out), never her round-4 line or act.
    const his5 = half(game, 5, "warden").context.briefing;
    expect(his5).toContain(`${PRISONER_SHORT_NAME} says: "Round 3, Warden."`);
    expect(his5).not.toContain("Round 4, Warden.");
    expect(his5.split("\n").filter((l) => l === half(game, 3, "prisoner").perceptionForOther)).toHaveLength(1);
  });

  it("a warden who walks out by his own act is seen going; once out, his act and his line do not reach her", async () => {
    const w = newWorld();
    // The door stands open (set up directly; since D15 he could also open it himself with the ring).
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "set up" } });
    const warden = byRound("warden", (n) => (n === 1 ? { intent: LEAVE_DOOR, line: "Back soon." } : { intent: CLOSE_DOOR, line: "Still here, Voss." }));
    const prisoner = byRound("prisoner", () => null);
    const game = await play(w, warden, prisoner, 2);

    const going = half(game, 1, "warden");
    expect(going.outcome?.result.left).toBe(true);
    expect(readFactValue({ gameId: w.base.gameId, t: going.t, entityId: w.base.wardenId, key: "location_id" })).toBe(w.namedLocations.corridor);
    const hers1 = half(game, 1, "prisoner").context.briefing;
    expect(hers1).toContain(going.perceptionForOther as string);
    expect(hers1).toContain(`${WARDEN_SHORT_NAME} says: "Back soon."`);
    const hers2 = half(game, 2, "prisoner").context.briefing;
    expect(hers2).toContain(`${WARDEN_NAME} is not here right now.`);
    expect(hers2).not.toContain("Still here, Voss.");
    expect(half(game, 2, "warden").perceptionForOther).toBeNull();
  });
});

describe("the condition lists both chairs read under the defaults (D3, D6', D4', D4b)", () => {
  const conditions = openConditions({ door: DOOR, doorPrice: DOOR_PRICE, block: BLOCK });

  it("the prisoner's list, exactly", () => {
    expect(renderConditionList(conditions, { reader: PRISONER_NAME }).filter((l) => l.startsWith("CONDITION "))).toEqual([
      `CONDITION 1 (for you): If the bar's integrity is at or below 50, then ${PRISONER_NAME} can open the window.`,
      `CONDITION 2 (for you): If the lock's integrity is at or below 60, then ${PRISONER_NAME} can open the door.`,
      `CONDITION 3 (for you): If a way out stands open, then ${PRISONER_NAME} can leave the cell through it, and she has escaped.`,
      `CONDITION 4 (for ${WARDEN_NAME}): If warden suspicion is at or above 40, and ${WARDEN_NAME} closely examines the bar, and ${WARDEN_NAME} finds its integrity at or below 30, then ${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends.`,
      `CONDITION 5 (for ${WARDEN_NAME}): If warden suspicion is at or above 40, and ${WARDEN_NAME} closely examines the lock, and ${WARDEN_NAME} finds its integrity at or below 40, then ${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends.`,
      `CONDITION 6 (for ${WARDEN_NAME}): If warden suspicion is at or above 40, and ${WARDEN_NAME} closely examines the spoon, and the spoon is out in the open, and ${WARDEN_NAME} finds its edge at or above 20, then ${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends.`,
      `CONDITION 7 (for ${WARDEN_NAME}): If warden suspicion is at or above 40, and ${WARDEN_NAME} closely examines a way out, and ${WARDEN_NAME} finds it standing open, then ${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends.`,
      `CONDITION 8 (for ${WARDEN_NAME}): If ${WARDEN_NAME} stands in a way out, and ${WARDEN_NAME} is on her feet, and ${WARDEN_NAME} can see, then ${PRISONER_NAME} cannot leave through it.`,
      `CONDITION 9 (for ${WARDEN_NAME}): If the bar's integrity is below 100, then ${WARDEN_NAME} can mend it.`,
      `CONDITION 10 (for ${WARDEN_NAME}): If the lock's integrity is below 100, then ${WARDEN_NAME} can mend it.`,
      // D15 (changed on purpose, 2026-09-27): the key ring, stated to both chairs for both holders.
      `CONDITION 11 (for ${WARDEN_NAME}): If ${WARDEN_NAME} holds the key ring, then ${WARDEN_NAME} can open the door.`,
      `CONDITION 12 (for you): If ${PRISONER_NAME} holds the key ring, then ${PRISONER_NAME} can open the door.`,
    ]);
  });

  it("the warden's list is the same twelve, read from his side", () => {
    const his = renderConditionList(conditions, { reader: WARDEN_NAME }).filter((l) => l.startsWith("CONDITION "));
    expect(his).toHaveLength(12);
    expect(his[1]).toBe(`CONDITION 2 (for ${PRISONER_NAME}): If the lock's integrity is at or below 60, then ${PRISONER_NAME} can open the door.`);
    expect(his[7]).toBe(`CONDITION 8 (for you): If ${WARDEN_NAME} stands in a way out, and ${WARDEN_NAME} is on her feet, and ${WARDEN_NAME} can see, then ${PRISONER_NAME} cannot leave through it.`);
    expect(his.slice(8)).toEqual([
      `CONDITION 9 (for you): If the bar's integrity is below 100, then ${WARDEN_NAME} can mend it.`,
      `CONDITION 10 (for you): If the lock's integrity is below 100, then ${WARDEN_NAME} can mend it.`,
      `CONDITION 11 (for you): If ${WARDEN_NAME} holds the key ring, then ${WARDEN_NAME} can open the door.`,
      `CONDITION 12 (for ${PRISONER_NAME}): If ${PRISONER_NAME} holds the key ring, then ${PRISONER_NAME} can open the door.`,
    ]);
  });

  it("the catch conditions keep their numbers (4-7) with the block conditions on or off", () => {
    const catches = (list: ReturnType<typeof openConditions>) => list.map((c, i) => [i + 1, c] as const).filter(([, c]) => c.then.includes("catches")).map(([i]) => i);
    expect(catches(conditions)).toEqual([4, 5, 6, 7]);
    expect(catches(openConditions({ door: DOOR, doorPrice: DOOR_PRICE, block: "off" }))).toEqual([4, 5, 6, 7]);
  });
});
