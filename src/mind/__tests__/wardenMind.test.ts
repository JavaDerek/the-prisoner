import { describe, it, expect, vi } from "vitest";
import { buildWardenPrompt, coerceWardenProposal, createWardenMind, type WardenContext } from "../wardenMind.js";
import { MOVE_DESCRIPTIONS, WARDEN_MOVES } from "../../world/mechanics.js";

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

  it("describes plan as one required array, never a separate choice field (coordinator's fix)", () => {
    const prompt = buildWardenPrompt(context);
    expect(prompt).not.toContain('"choice"');
    expect(prompt).toContain('"plan"');
  });
});

describe("coerceWardenProposal -- plan REQUIRED, one array, plan[0] is this turn's move (coordinator's fix)", () => {
  it("rejects a proposal with no plan at all", () => {
    expect(coerceWardenProposal({ intent: "watch the cell" }, context)).toBeNull();
  });

  it("derives choice from plan[0] and keeps the plan", () => {
    expect(coerceWardenProposal({ intent: "replace the bar", plan: ["REPLACE_BAR", "WAIT"] }, context)).toEqual({
      intent: "replace the bar",
      choice: "REPLACE_BAR",
      plan: ["REPLACE_BAR", "WAIT"],
    });
  });

  it("rejects the whole proposal when plan[0] names a move never offered", () => {
    expect(coerceWardenProposal({ intent: "file it myself", plan: ["FILE"] }, context)).toBeNull();
  });

  it("matches plan[0] by exact equality after ASCII uppercasing", () => {
    expect(coerceWardenProposal({ intent: "observe", plan: ["observe"] }, context)).toEqual({
      intent: "observe",
      choice: "OBSERVE",
      plan: ["OBSERVE"],
    });
  });

  it("truncates at the first invalid later entry, keeping plan[0]", () => {
    expect(coerceWardenProposal({ intent: "x", plan: ["OBSERVE", "FILE", "WAIT"] }, context)).toEqual({
      intent: "x",
      choice: "OBSERVE",
      plan: ["OBSERVE"],
    });
  });
});

describe("createWardenMind -- the wire, offline", () => {
  it("sends tools: [], stream: false, no Authorization header", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      expect(body.tools).toEqual([]);
      expect(body.stream).toBe(false);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "observe", plan: ["OBSERVE"] }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const proposal = await mind.consider(context);
    expect(proposal).toEqual({ intent: "observe", choice: "OBSERVE", plan: ["OBSERVE"] });
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

  it("a missing plan is silence with reason 'rejected'", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x" }) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    let silenced: string | undefined;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (reason) => (silenced = reason),
    });
    expect(await mind.consider(context)).toBeNull();
    expect(silenced).toBe("rejected");
  });

  it("sends a strict json_schema response_format built from WARDEN_MOVES (mind-seam@0.4.0)", async () => {
    // See prisonerMind.test.ts's sibling test for why the body is captured
    // OUTSIDE the mock callback rather than asserted inside it.
    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "observe", plan: ["OBSERVE"] }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const mind = createWardenMind({ baseUrl: "http://offline.invalid", model: "test-model", fetchFn: fetchFn as unknown as typeof fetch });
    await mind.consider(context);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const responseFormat = capturedBody?.response_format as { type: string; json_schema: { name: string; strict: boolean; schema: { properties: { plan: { items: { enum: string[] } } } } } };
    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.name).toBe("proposal");
    expect(responseFormat.json_schema.strict).toBe(true);
    expect(responseFormat.json_schema.schema.properties.plan.items.enum).toEqual(WARDEN_MOVES);
  });
});

describe("createWardenMind's onSilence detail (mind-seam@0.3.0) -- retires this repository's own raw-answer side channel", () => {
  it("passes detail.text and detail.parsed through on a 'rejected' silence", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", plan: ["FILE"] }) } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    let capturedDetail: { text?: string; parsed?: unknown } | undefined;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (_reason, _context, detail) => (capturedDetail = detail),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(capturedDetail?.parsed).toEqual({ intent: "x", plan: ["FILE"] });
    expect(capturedDetail?.text).toContain("FILE");
  });

  it("passes no detail at all when the wire fails before any JSON is parsed (a non-200 status)", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 503 }));
    let called = false;
    let capturedDetail: unknown;
    const mind = createWardenMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (_reason, _context, detail) => {
        called = true;
        capturedDetail = detail;
      },
    });
    await mind.consider(context);
    expect(called).toBe(true);
    expect(capturedDetail).toBeUndefined();
  });
});
