import { describe, it, expect, vi } from "vitest";
import { buildPrisonerPrompt, coercePrisonerProposal, createPrisonerMind, type PrisonerContext } from "../prisonerMind.js";
import { MOVE_DESCRIPTIONS } from "../../world/mechanics.js";

const context: PrisonerContext = {
  principalId: "prisoner-1",
  identity: "the prisoner in this cell",
  motive: "to escape",
  briefing: "The intact bar is here.\nbar integrity: 100.",
  moves: ["FILE", "SHIM", "HONE", "CONCEAL", "INSPECT", "WAIT"],
};

describe("buildPrisonerPrompt -- pure, built from context alone", () => {
  it("contains the briefing, identity, motive and every move", () => {
    const prompt = buildPrisonerPrompt(context);
    expect(prompt).toContain(context.identity);
    expect(prompt).toContain(context.motive);
    expect(prompt).toContain(context.briefing);
    for (const move of context.moves) {
      expect(prompt).toContain(move);
    }
  });

  it("contains nothing else from the process -- no game id, no path, no raw entity ids", () => {
    const prompt = buildPrisonerPrompt(context);
    expect(prompt).not.toContain(process.cwd());
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/); // no UUID leaks
  });

  it("describes every move (item 2) -- not just its bare name", () => {
    const prompt = buildPrisonerPrompt(context);
    for (const move of context.moves) {
      expect(prompt).toContain(MOVE_DESCRIPTIONS[move]);
    }
  });
});

describe("coercePrisonerProposal -- choice by literal membership only", () => {
  it("keeps a proposal with no choice at all", () => {
    const result = coercePrisonerProposal({ intent: "look around" }, context);
    expect(result).toEqual({ intent: "look around" });
  });

  it("keeps a proposal whose choice is a member of moves", () => {
    const result = coercePrisonerProposal({ intent: "file the bar", choice: "FILE" }, context);
    expect(result).toEqual({ intent: "file the bar", choice: "FILE" });
  });

  it("rejects the whole proposal when choice names a move never offered", () => {
    const result = coercePrisonerProposal({ intent: "search the warden", choice: "SEARCH" }, context);
    expect(result).toBeNull();
  });

  it("rejects a proposal with no intent at all, regardless of choice", () => {
    const result = coercePrisonerProposal({ choice: "FILE" }, context);
    expect(result).toBeNull();
  });

  it("never pattern-matches: a choice that is a substring or case-variant of a real move is rejected", () => {
    expect(coercePrisonerProposal({ intent: "x", choice: "file" }, context)).toBeNull();
    expect(coercePrisonerProposal({ intent: "x", choice: "FILE " }, context)).toBeNull();
  });
});

describe("createPrisonerMind -- the wire, offline", () => {
  it("sends tools: [], stream: false, no Authorization header", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      expect(body.tools).toEqual([]);
      expect(body.stream).toBe(false);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(Object.keys(headers).some((h) => h.toLowerCase() === "authorization")).toBe(false);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "wait quietly", choice: "WAIT" } ) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const proposal = await mind.consider(context);
    expect(proposal).toEqual({ intent: "wait quietly", choice: "WAIT" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("every failure is null: unreachable", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    let silenced: string | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (reason) => (silenced = reason),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(silenced).toBe("unreachable");
  });

  it("a choice naming a move not offered is silence with reason 'rejected'", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", choice: "SEARCH" }) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    let silenced: string | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (reason) => (silenced = reason),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(silenced).toBe("rejected");
  });
});

describe("createPrisonerMind's onRawAnswer -- item 9's side channel, owned by the caller", () => {
  it("captures the raw parsed answer when the wire's coerce rejects it (choice not in moves)", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", choice: "SEARCH" }) } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    let captured: unknown;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onRawAnswer: (raw) => (captured = raw),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(captured).toEqual({ intent: "x", choice: "SEARCH" });
  });

  it("captures the raw answer on a successful call too (the caller decides what to do with it)", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "wait" }) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    let captured: unknown;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onRawAnswer: (raw) => (captured = raw),
    });
    await mind.consider(context);
    expect(captured).toEqual({ intent: "wait" });
  });

  it("is never called when the wire fails before any JSON is parsed (unreachable) -- there is no raw object to invent", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    let called = false;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onRawAnswer: () => (called = true),
    });
    await mind.consider(context);
    expect(called).toBe(false);
  });
});
