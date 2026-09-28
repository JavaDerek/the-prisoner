import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../../open/world.js";
import { buildOpenResolver } from "../../open/mechanics.js";
import { createReferee } from "../../open/referee.js";
import { scriptedReferee, RULINGS, WAIT, OPEN_DOOR, LEAVE_DOOR, EXAMINE } from "../../open/__tests__/helpers/scriptedReferee.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../../open/mind.js";
import { createGameSession } from "../session.js";

// This module has no network, no MCP SDK -- it is the pure engine wiring
// underneath `src/mcp/server.ts` (the-prisoner#11's MCP half): a `GameSession`
// runs `runOpenGame` with an MCP seat mind (`mcpSeatMind.ts`) in one chair and
// a caller-supplied opponent in the other, and exposes exactly what a tool
// handler needs: whether a turn is open, what it says, and a way to answer
// it. Testing it directly, without the SDK in the way, is how the round trip
// (the-prisoner#11's own test list) gets checked without a live model.

function repeating(proposal: OpenProposal): OpenMind {
  return scriptedMind<OpenPrincipalContext, OpenProposal>(proposal);
}

function scripted(intents: readonly string[]): OpenMind {
  let turn = 0;
  return {
    async consider() {
      const intent = intents[Math.min(turn, intents.length - 1)];
      turn += 1;
      return { intent };
    },
  };
}

function setup() {
  createTestDb();
  return { openWorld: buildOpenWorld(), resolver: buildOpenResolver(), referee: createReferee([scriptedReferee(RULINGS)]) };
}

describe("createGameSession: the engine underneath the MCP seat", () => {
  afterEach(() => destroyTestDb());

  it("starts with no turn open until the opponent's automatic half-round (if any) finishes", async () => {
    const { openWorld, resolver, referee } = setup();
    // The prisoner is the seat; the warden (opponent) goes first each round.
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    expect(session.pendingContext()).toBeNull();
    const event = await session.waitForNext();
    expect(event.kind).toBe("turn");
    if (event.kind === "turn") {
      expect(event.context.principalId).toBe(openWorld.base.prisonerId);
    }
  });

  it("a pending context is exactly this seat's own OpenPrincipalContext -- nothing extra, nothing from the other side", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: EXAMINE }) });
    await session.waitForNext();
    const context = session.pendingContext();
    expect(context).not.toBeNull();
    expect(Object.keys(context as object).sort()).toEqual(["briefing", "holding", "identity", "motive", "perceivedObjects", "principalId"].sort());
  });

  it("submitAttempt before any turn is open refuses", () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    expect(() => session.submitAttempt("I wait.")).toThrow();
  });

  it("briefingText(), before any turn, says so rather than returning an empty string", () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    expect(session.briefingText().length).toBeGreaterThan(0);
  });

  it("briefingText() once a turn is open is the play view of this seat's own context (createPlayView)", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    await session.waitForNext();
    const text = session.briefingText();
    expect(text).toContain("This is round 1 of 8");
    // `identity` (which names the principal) is one of the three blocks the `play` view holds
    // behind a no-turn command (`PLAY_BLOCK_POLICY` in `humanSeat.ts`) rather than showing every
    // turn -- so the player's own name is deliberately NOT here; it is what a `me` tool call
    // would answer (not yet wired to a session method in this test).
    expect(text).toContain("In the cell around you:");
  });

  it("a full escape, driven one attempt at a time (the-prisoner#11's own round trip)", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });

    let event = await session.waitForNext();
    expect(event.kind).toBe("turn");
    session.submitAttempt(OPEN_DOOR, "Just stretching.");

    event = await session.waitForNext();
    expect(event.kind).toBe("turn");
    session.submitAttempt(LEAVE_DOOR);

    event = await session.waitForNext();
    expect(event.kind).toBe("ended");
    if (event.kind === "ended") {
      expect(event.result.ended).toEqual({ kind: "escaped" });
    }
    expect(session.isEnded()).toBe(true);
    expect(session.briefingText().toLowerCase()).toContain("escaped");
  });

  it("the opponent's own move can end the game without the seat ever being asked again", async () => {
    const { openWorld, resolver, referee } = setup();
    // The seat is the WARDEN here; the opponent (prisoner) escapes on its second turn.
    const session = createGameSession({ side: "warden", rounds: 8, openWorld, resolver, referee, opponentMind: scripted([OPEN_DOOR, LEAVE_DOOR]) });

    let event = await session.waitForNext();
    expect(event.kind).toBe("turn");
    session.submitAttempt(WAIT); // round 1 warden turn -- does nothing

    event = await session.waitForNext();
    expect(event.kind).toBe("turn"); // round 2 warden turn
    session.submitAttempt(WAIT);

    event = await session.waitForNext(); // the prisoner's round-2 turn (LEAVE_DOOR) ends the game
    expect(event.kind).toBe("ended");
    if (event.kind === "ended") expect(event.result.ended).toEqual({ kind: "escaped" });
    expect(() => session.submitAttempt(WAIT)).toThrow();
  });

  it("submitAttempt refuses once the game has ended", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    await session.waitForNext();
    session.submitAttempt(OPEN_DOOR);
    await session.waitForNext();
    session.submitAttempt(LEAVE_DOOR);
    await session.waitForNext();
    expect(() => session.submitAttempt("anything")).toThrow();
  });

  it("records every half-round played, both sides, for the transcript writer", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    await session.waitForNext();
    session.submitAttempt(OPEN_DOOR);
    await session.waitForNext();
    session.submitAttempt(LEAVE_DOOR);
    await session.waitForNext();
    expect(session.halves.map((h) => h.principal)).toEqual(["warden", "prisoner", "warden", "prisoner"]);
  });

  it("the WARDEN can be the seat too -- the seat is a chair, not a fixed principal", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "warden", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    const event = await session.waitForNext();
    expect(event.kind).toBe("turn");
    if (event.kind === "turn") expect(event.context.principalId).toBe(openWorld.base.wardenId);
    expect(session.briefingText()).toContain("This is round 1 of 8");
  });

  it("meText()/rulesText()/conditionsText() answer the no-turn commands the play view holds back", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    await session.waitForNext();
    expect(session.meText()).toContain("Mara Voss");
    expect(session.rulesText().length).toBeGreaterThan(0);
    // No `conditions` were configured for this session, so the fallback line applies.
    expect(session.conditionsText()).toBe("This chair has no condition list.");
  });

  it("meText()/rulesText() still answer from the last-seen context between turns (the opponent's half-round in flight)", async () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    await session.waitForNext();
    session.submitAttempt(OPEN_DOOR);
    // Between this submit and the next `waitForNext`, no turn is pending -- but `me`/`rules`
    // should still answer from the last turn this seat actually saw, not go blank.
    expect(session.pendingContext()).toBeNull();
    expect(session.meText()).toContain("Mara Voss");
  });

  it("meText()/rulesText()/conditionsText() before any turn has ever been open say so plainly", () => {
    const { openWorld, resolver, referee } = setup();
    const session = createGameSession({ side: "prisoner", rounds: 8, openWorld, resolver, referee, opponentMind: repeating({ intent: WAIT }) });
    expect(session.meText()).toMatch(/no game in progress/i);
    expect(session.rulesText()).toMatch(/no game in progress/i);
    expect(session.conditionsText()).toMatch(/no game in progress/i);
  });
});
