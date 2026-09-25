import { describe, it, expect, vi } from "vitest";
import { readThinkingMode, withThinking, resolveRefereeThinking, resolveWitsThinking, thinkingHeaderLine } from "../thinking.js";

// OPEN-VARIANT.md §64.7, WORLD-ELABORATION-DESIGN.md §4.8: `off` reproduces
// §64.7's finding as a real, runnable arm -- `reasoning_effort: "none"` on
// the model calls that matter. `on` (the default, every batch recorded
// before this arm existed) must leave the outgoing request untouched: the
// D3 lesson, applied here as a literal identity check, not just "looks the
// same".
describe("readThinkingMode: PRISONER_THINKING (§64.7)", () => {
  it("leaves thinking on unless asked", () => {
    expect(readThinkingMode(undefined)).toBe("on");
    expect(readThinkingMode("")).toBe("on");
    expect(readThinkingMode("on")).toBe("on");
  });

  it("turns it off when asked for", () => {
    expect(readThinkingMode("off")).toBe("off");
  });

  it("stops the run rather than guessing", () => {
    expect(() => readThinkingMode("none")).toThrow(/PRISONER_THINKING/);
    expect(() => readThinkingMode("none")).toThrow(/"on"/);
  });
});

describe("withThinking", () => {
  it("on: returns the SAME fetchFn, unwrapped -- not even a pass-through wrapper", () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    expect(withThinking(fetchFn, "on")).toBe(fetchFn);
  });

  it("on with no fetchFn: still undefined, never defaults to a wrapper around global fetch", () => {
    expect(withThinking(undefined, "on")).toBeUndefined();
  });

  it("off: adds chat_template_kwargs.reasoning_strength 'none' to the body, preserving every other field", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const wrapped = withThinking(fetchFn, "off") as typeof fetch;
    await wrapped("http://x/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "m", temperature: 0, stream: false, tools: [], messages: [{ role: "user", content: "hi" }] }),
    });

    const body = JSON.parse(capturedInit?.body as string);
    // P8: `reasoning_effort` is a NO-OP on the llama-server serving Muse-Glimmer
    // (measured 2026-09-25: `high` returns the same 33 tokens as `none`). The field
    // this server honours is `chat_template_kwargs.reasoning_strength`.
    expect(body.chat_template_kwargs).toEqual({ reasoning_strength: "none" });
    expect(body.reasoning_effort).toBeUndefined();
    expect(body.model).toBe("m");
    expect(body.temperature).toBe(0);
    expect(body.stream).toBe(false);
    expect(body.tools).toEqual([]);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("off: MERGES into an existing chat_template_kwargs rather than replacing it", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const wrapped = withThinking(fetchFn, "off") as typeof fetch;
    await wrapped("http://x/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "m", chat_template_kwargs: { enable_thinking: true } }),
    });

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.chat_template_kwargs).toEqual({ enable_thinking: true, reasoning_strength: "none" });
  });

  it("off: falls back to global fetch when no fetchFn is given (never throws building the wrapper)", () => {
    expect(() => withThinking(undefined, "off")).not.toThrow();
  });

  it("off: a non-JSON or non-object body passes through untouched, never throws", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const wrapped = withThinking(fetchFn, "off") as typeof fetch;
    await wrapped("http://x", { method: "POST", body: "not json" });
    expect(capturedInit?.body).toBe("not json");

    await wrapped("http://x", { method: "GET" });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

// OPEN-VARIANT.md §68.1, §68.5, §64.7: the referee and the wits call need
// OPPOSITE defaults -- thinking changes referee RULINGS a great deal
// (19/29 object-less intents wrongly ruled `open` at OFF, 1/29 at ON) but
// nothing measurable for the wits DECISION, at ~8x cost per call. One
// shared `PRISONER_THINKING` switch could not hold both, so each role gets
// its own variable and its own default, with `PRISONER_THINKING` kept as a
// legacy override for BOTH roles -- recorded batches, CLAUDE.md and
// transcript headers all document `PRISONER_THINKING=off` invocations, and
// those must keep meaning exactly what they meant.
describe("resolveRefereeThinking: PRISONER_REFEREE_THINKING (§68.1)", () => {
  // 2026-09-25, `checkpoints/2026-09-25-referee-thinking/RESULTS-3-4.md`: SS68.1/SS68.5
  // were measured on `qwen3:14b` and DO NOT TRANSFER to Muse-Glimmer, the model every
  // local chair now runs. Serially, over 22 rows, `none` produced 6 correct resolutions
  // and 0 false ones; `high` produced 3 correct and 1 false, and broke 4 of the 6 rows
  // `none` gets right, at 3-5x the cost. The default flips with the evidence.
  it("defaults to OFF when nothing is set -- SS68.1's 'on' did not transfer to Muse-Glimmer", () => {
    expect(resolveRefereeThinking(undefined, undefined)).toEqual({ mode: "off", source: "default" });
    expect(resolveRefereeThinking("", "")).toEqual({ mode: "off", source: "default" });
  });

  it("the role-specific variable sets it", () => {
    expect(resolveRefereeThinking("off", undefined)).toEqual({ mode: "off", source: "role" });
    expect(resolveRefereeThinking("on", undefined)).toEqual({ mode: "on", source: "role" });
  });

  it("falls back to the legacy PRISONER_THINKING when the role variable is unset", () => {
    expect(resolveRefereeThinking(undefined, "off")).toEqual({ mode: "off", source: "legacy" });
    expect(resolveRefereeThinking("", "off")).toEqual({ mode: "off", source: "legacy" });
  });

  it("the role-specific variable overrides the legacy one when both are set", () => {
    expect(resolveRefereeThinking("on", "off")).toEqual({ mode: "on", source: "role" });
    expect(resolveRefereeThinking("off", "on")).toEqual({ mode: "off", source: "role" });
  });

  it("stops the run rather than guessing, naming PRISONER_REFEREE_THINKING", () => {
    expect(() => resolveRefereeThinking("sure", undefined)).toThrow(/PRISONER_REFEREE_THINKING/);
    expect(() => resolveRefereeThinking("sure", undefined)).toThrow(/"on"/);
  });

  it("an invalid legacy value also stops the run, naming PRISONER_THINKING", () => {
    expect(() => resolveRefereeThinking(undefined, "sure")).toThrow(/PRISONER_THINKING/);
  });
});

describe("resolveWitsThinking: PRISONER_WITS_THINKING (§68.1, §64.7)", () => {
  it("defaults to off when nothing is set -- the behavioural change this arm makes", () => {
    expect(resolveWitsThinking(undefined, undefined)).toEqual({ mode: "off", source: "default" });
    expect(resolveWitsThinking("", "")).toEqual({ mode: "off", source: "default" });
  });

  it("the role-specific variable sets it", () => {
    expect(resolveWitsThinking("on", undefined)).toEqual({ mode: "on", source: "role" });
    expect(resolveWitsThinking("off", undefined)).toEqual({ mode: "off", source: "role" });
  });

  it("falls back to the legacy PRISONER_THINKING when the role variable is unset", () => {
    expect(resolveWitsThinking(undefined, "on")).toEqual({ mode: "on", source: "legacy" });
  });

  it("the role-specific variable overrides the legacy one when both are set", () => {
    expect(resolveWitsThinking("off", "on")).toEqual({ mode: "off", source: "role" });
  });

  it("stops the run rather than guessing, naming PRISONER_WITS_THINKING", () => {
    expect(() => resolveWitsThinking("sure", undefined)).toThrow(/PRISONER_WITS_THINKING/);
  });
});

describe("thinkingHeaderLine: per-role transcript reporting (§68.1)", () => {
  it("names the role-specific variable when that is what set it", () => {
    const line = thinkingHeaderLine("referee", { mode: "off", source: "role" });
    expect(line).toContain("Thinking (referee): OFF");
    expect(line).toContain("PRISONER_REFEREE_THINKING=off");
    // P8 fix 1: the header names the FIELD AND VALUE actually sent, never a word
    // standing for them -- a header that says OFF must be checkable against the wire.
    expect(line).toContain('chat_template_kwargs.reasoning_strength: "none"');
    expect(line).not.toContain("reasoning_effort");
  });

  it("names the legacy variable, and says it applies to both roles, when that is what set it", () => {
    const line = thinkingHeaderLine("wits", { mode: "on", source: "legacy" });
    expect(line).toContain("Thinking (wits): ON");
    expect(line).toContain("PRISONER_THINKING=on");
    expect(line).toContain("both roles");
  });

  it("ON says the request constrains NOTHING, so the served model's own configuration decides", () => {
    // P8's live hazard stated in the header itself: with no field on the request, a
    // server started with `--chat-template-kwargs '{"reasoning_strength":"none"}'`
    // reasons not at all while the transcript says ON.
    const line = thinkingHeaderLine("referee", { mode: "on", source: "role" });
    expect(line).toContain("Thinking (referee): ON");
    expect(line).toContain("no reasoning field is sent");
    expect(line).toContain("served model's own configuration");
  });

  it("says 'the default' when neither variable was set", () => {
    const line = thinkingHeaderLine("wits", { mode: "off", source: "default" });
    expect(line).toContain("Thinking (wits): OFF");
    expect(line).toContain("the default");
  });
});
