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

  it("describes plan as one required array, never a separate choice field (coordinator's fix)", () => {
    const prompt = buildPrisonerPrompt(context);
    expect(prompt).not.toContain('"choice"');
    expect(prompt).toContain('"plan"');
    expect(prompt.toLowerCase()).toContain("first");
  });
});

describe("coercePrisonerProposal -- plan REQUIRED, one array, plan[0] is this turn's move (coordinator's fix)", () => {
  it("rejects a proposal with no plan at all -- item 5(c)", () => {
    const result = coercePrisonerProposal({ intent: "look around" }, context);
    expect(result).toBeNull();
  });

  it("derives choice from plan[0] and keeps the plan", () => {
    const result = coercePrisonerProposal({ intent: "file the bar", plan: ["FILE", "CONCEAL"] }, context);
    expect(result).toEqual({ intent: "file the bar", choice: "FILE", plan: ["FILE", "CONCEAL"] });
  });

  it("a single-entry plan is valid: choice is that entry, plan is that one entry", () => {
    const result = coercePrisonerProposal({ intent: "wait it out", plan: ["WAIT"] }, context);
    expect(result).toEqual({ intent: "wait it out", choice: "WAIT", plan: ["WAIT"] });
  });

  it("rejects the whole proposal when plan[0] names a move never offered", () => {
    const result = coercePrisonerProposal({ intent: "search the warden", plan: ["SEARCH"] }, context);
    expect(result).toBeNull();
  });

  it("rejects a proposal with no intent at all, regardless of plan", () => {
    const result = coercePrisonerProposal({ plan: ["FILE"] }, context);
    expect(result).toBeNull();
  });

  it("rejects when plan is present but empty", () => {
    expect(coercePrisonerProposal({ intent: "x", plan: [] }, context)).toBeNull();
  });

  it("rejects when plan is not an array at all", () => {
    expect(coercePrisonerProposal({ intent: "x", plan: "FILE" }, context)).toBeNull();
  });

  describe("item 5(b): plan[0] matches by exact equality after ASCII uppercasing", () => {
    it('{"plan":["hone","FILE"]} yields choice HONE', () => {
      const result = coercePrisonerProposal({ intent: "hone then file", plan: ["hone", "FILE"] }, context);
      expect(result).toEqual({ intent: "hone then file", choice: "HONE", plan: ["HONE", "FILE"] });
    });

    it("this is a literal character transformation, not fuzzy matching -- a real substring is still rejected", () => {
      expect(coercePrisonerProposal({ intent: "x", plan: ["fil"] }, context)).toBeNull();
      expect(coercePrisonerProposal({ intent: "x", plan: ["FILE "] }, context)).toBeNull(); // trailing space survives uppercasing
    });
  });

  describe("truncation: a later invalid entry truncates the plan, but plan[0] is always kept", () => {
    it("keeps plan[0] and everything valid before the first invalid entry", () => {
      const result = coercePrisonerProposal({ intent: "x", plan: ["HONE", "FILE", "SEARCH", "CONCEAL"] }, context);
      expect(result).toEqual({ intent: "x", choice: "HONE", plan: ["HONE", "FILE"] });
    });

    it("more than 6 entries: only the first 6 are ever read", () => {
      const eight = ["HONE", "FILE", "HONE", "FILE", "HONE", "FILE", "HONE", "FILE"];
      const result = coercePrisonerProposal({ intent: "x", plan: eight }, context);
      expect(result?.plan).toHaveLength(6);
      expect(result?.plan).toEqual(eight.slice(0, 6));
    });
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
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "wait quietly", plan: ["WAIT"] }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const proposal = await mind.consider(context);
    expect(proposal).toEqual({ intent: "wait quietly", choice: "WAIT", plan: ["WAIT"] });
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

  it("a plan[0] naming a move not offered is silence with reason 'rejected'", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", plan: ["SEARCH"] }) } }] }), {
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

  it("a missing plan entirely is silence with reason 'rejected'", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x" }) } }] }), {
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
    expect(await mind.consider(context)).toBeNull();
    expect(silenced).toBe("rejected");
  });

  it("sends response_format: json_object (mind-seam@0.3.0)", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      expect(body.response_format).toEqual({ type: "json_object" });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "wait", plan: ["WAIT"] }) } }] }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });
    const mind = createPrisonerMind({ baseUrl: "http://offline.invalid", model: "test-model", fetchFn: fetchFn as unknown as typeof fetch });
    await mind.consider(context);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("createPrisonerMind's onSilence detail (mind-seam@0.3.0) -- retires this repository's own raw-answer side channel", () => {
  it("passes detail.text and detail.parsed through on a 'rejected' silence -- this IS the model's raw answer, no side channel needed", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x", plan: ["SEARCH"] }) } }] }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    let capturedDetail: { text?: string; parsed?: unknown } | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (_reason, _context, detail) => (capturedDetail = detail),
    });
    const proposal = await mind.consider(context);
    expect(proposal).toBeNull();
    expect(capturedDetail?.parsed).toEqual({ intent: "x", plan: ["SEARCH"] });
    expect(capturedDetail?.text).toContain("SEARCH");
  });

  it("passes detail.text (but no detail.parsed) on an 'unparseable' silence -- previously blank in this repository's own transcripts", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not json at all, sorry" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    );
    let capturedReason: string | undefined;
    let capturedDetail: { text?: string; parsed?: unknown } | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      model: "test-model",
      fetchFn: fetchFn as unknown as typeof fetch,
      onSilence: (reason, _context, detail) => {
        capturedReason = reason;
        capturedDetail = detail;
      },
    });
    expect(await mind.consider(context)).toBeNull();
    expect(capturedReason).toBe("unparseable");
    expect(capturedDetail?.text).toContain("not json at all");
    expect(capturedDetail?.parsed).toBeUndefined();
  });

  it("passes no detail at all for 'unreachable'", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    let called = false;
    let capturedDetail: unknown;
    const mind = createPrisonerMind({
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
