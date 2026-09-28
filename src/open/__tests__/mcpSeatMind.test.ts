import { describe, it, expect } from "vitest";
import { createMcpSeatMind } from "../mcpSeatMind.js";
import type { OpenPrincipalContext } from "../mind.js";

// the-prisoner#11's MCP half: a seat is a mind, full stop (the terminal half's own lesson,
// carried over here) -- this mind's `consider()` is called by the SAME loop that calls every
// other mind's, and must behave identically from the loop's own point of view: it returns a
// promise that resolves once told what to do, and never before. The difference from
// `humanSeat.ts` is only WHO tells it and HOW: here, an MCP tool handler (`attempt`) supplies
// the answer, handed across as a resolved promise rather than typed at a `readline` prompt.

const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: "Round 1 of 12.",
  perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
};

const CONTEXT_2: OpenPrincipalContext = { ...CONTEXT, briefing: "Round 2 of 12." };

describe("createMcpSeatMind: an OpenMind whose consider() awaits an externally-supplied answer", () => {
  it("pendingContext() is null before any turn is asked", () => {
    const seat = createMcpSeatMind();
    expect(seat.pendingContext()).toBeNull();
  });

  it("consider() sets the pending context synchronously, before the promise it returns ever settles", async () => {
    const seat = createMcpSeatMind();
    const proposalPromise = seat.consider(CONTEXT);
    // Synchronous, because `game.ts`/`loop.ts` must be able to ask "is a turn open right now?"
    // the instant `consider()` is invoked -- an MCP tool call that lands in the same tick (or
    // a fraction of one later) as the opponent's own automatic half-round must see it.
    expect(seat.pendingContext()).toBe(CONTEXT);
    seat.submitAttempt({ intent: "wait" });
    await expect(proposalPromise).resolves.toEqual({ intent: "wait" });
  });

  it("submitAttempt resolves consider()'s promise with exactly the proposal given, never more", async () => {
    const seat = createMcpSeatMind();
    const proposalPromise = seat.consider(CONTEXT);
    seat.submitAttempt({ intent: "I try the door.", line: "Quiet now." });
    await expect(proposalPromise).resolves.toEqual({ intent: "I try the door.", line: "Quiet now." });
  });

  it("pendingContext() clears once the turn's proposal has been submitted", async () => {
    const seat = createMcpSeatMind();
    const proposalPromise = seat.consider(CONTEXT);
    seat.submitAttempt({ intent: "wait" });
    await proposalPromise;
    expect(seat.pendingContext()).toBeNull();
  });

  it("submitAttempt refuses when no turn is open (no game, or between turns)", () => {
    const seat = createMcpSeatMind();
    expect(() => seat.submitAttempt({ intent: "wait" })).toThrow(/no attempt is due/i);
  });

  it("submitAttempt refuses a second answer to the same turn (the first already resolved it)", async () => {
    const seat = createMcpSeatMind();
    const proposalPromise = seat.consider(CONTEXT);
    seat.submitAttempt({ intent: "first" });
    await proposalPromise;
    expect(() => seat.submitAttempt({ intent: "second" })).toThrow(/no attempt is due/i);
  });

  it("waitForTurn() resolves immediately when a turn is already open", async () => {
    const seat = createMcpSeatMind();
    const proposalPromise = seat.consider(CONTEXT);
    await expect(seat.waitForTurn()).resolves.toBe(CONTEXT);
    seat.submitAttempt({ intent: "wait" });
    await proposalPromise;
  });

  it("waitForTurn() resolves only once consider() is next called, when no turn is open yet", async () => {
    const seat = createMcpSeatMind();
    let resolved: OpenPrincipalContext | null = null;
    const waiter = seat.waitForTurn().then((ctx) => {
      resolved = ctx;
    });
    // Give any stray microtask a chance to run -- it must NOT have resolved yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBeNull();

    const proposalPromise = seat.consider(CONTEXT);
    await waiter;
    expect(resolved).toBe(CONTEXT);
    seat.submitAttempt({ intent: "wait" });
    await proposalPromise;
  });

  it("a full round trip across two turns, exactly as the game loop drives it", async () => {
    const seat = createMcpSeatMind();

    const first = seat.consider(CONTEXT);
    expect(seat.pendingContext()).toBe(CONTEXT);
    seat.submitAttempt({ intent: "I wait." });
    expect(await first).toEqual({ intent: "I wait." });
    expect(seat.pendingContext()).toBeNull();

    const second = seat.consider(CONTEXT_2);
    expect(seat.pendingContext()).toBe(CONTEXT_2);
    seat.submitAttempt({ intent: "I try the window." });
    expect(await second).toEqual({ intent: "I try the window." });
  });

  it("has no reconsider method: D3's retry-on-ambiguous-target flow is a known gap for this seat, not silently faked", () => {
    const seat = createMcpSeatMind();
    expect(seat.reconsider).toBeUndefined();
  });
});
