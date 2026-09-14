import { describe, it, expect, vi } from "vitest";
import { buildWardenPrompt, coerceWardenProposal, createWardenMind, type WardenContext } from "../wardenMind.js";
import { MOVE_DESCRIPTIONS } from "../../world/mechanics.js";

const context: WardenContext = {
  principalId: "warden-1",
  identity: "the warden responsible for this cell",
  motive: "to keep the prisoner secure",
  briefing: "The intact bar is here.\nbar integrity: 100.",
  moves: ["REPLACE_BAR", "SERVICE_LOCK", "ROTATE_GUARD", "OBSERVE", "WAIT"],
};

describe("buildWardenPrompt -- pure, built from context alone", () => {
  it("contains the briefing, identity, motive and every move", () => {
    const prompt = buildWardenPrompt(context);
    expect(prompt).toContain(context.identity);
    expect(prompt).toContain(context.motive);
    expect(prompt).toContain(context.briefing);
    for (const move of context.moves) {
      expect(prompt).toContain(move);
    }
  });

  it("contains nothing else from the process -- no game id, no path, no raw entity ids", () => {
    const prompt = buildWardenPrompt(context);
    expect(prompt).not.toContain(process.cwd());
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it("describes every move (item 2) -- not just its bare name", () => {
    const prompt = buildWardenPrompt(context);
    for (const move of context.moves) {
      expect(prompt).toContain(MOVE_DESCRIPTIONS[move]);
    }
  });
});

describe("coerceWardenProposal -- choice REQUIRED, by literal membership only", () => {
  it("rejects a proposal with no choice at all -- choice is now required (this task's prompt fix)", () => {
    expect(coerceWardenProposal({ intent: "watch the cell" }, context)).toBeNull();
  });

  it("keeps a proposal whose choice is a member of moves", () => {
    expect(coerceWardenProposal({ intent: "replace the bar", choice: "REPLACE_BAR" }, context)).toEqual({
      intent: "replace the bar",
      choice: "REPLACE_BAR",
    });
  });

  it("rejects the whole proposal when choice names a move never offered", () => {
    expect(coerceWardenProposal({ intent: "file it myself", choice: "FILE" }, context)).toBeNull();
  });
});

describe("createWardenMind -- the wire, offline", () => {
  it("sends tools: [], stream: false, no Authorization header", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      expect(body.tools).toEqual([]);
      expect(body.stream).toBe(false);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "observe", choice: "OBSERVE" }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const proposal = await mind.consider(context);
    expect(proposal).toEqual({ intent: "observe", choice: "OBSERVE" });
  });

  it("every failure is null: a non-200 status", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 503 }));
    let silenced: string | undefined;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (reason) => (silenced = reason),
    });
    expect(await mind.consider(context)).toBeNull();
    expect(silenced).toBe("status");
  });
});

describe("createWardenMind's onRawAnswer -- item 9's side channel, owned by the caller", () => {
  it("captures the raw parsed answer when the wire's coerce rejects it (choice not in moves)", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", choice: "FILE" }) } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    let captured: unknown;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onRawAnswer: (raw) => (captured = raw),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(captured).toEqual({ intent: "x", choice: "FILE" });
  });

  it("is never called when the wire fails before any JSON is parsed", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 503 }));
    let called = false;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onRawAnswer: () => (called = true),
    });
    await mind.consider(context);
    expect(called).toBe(false);
  });
});
