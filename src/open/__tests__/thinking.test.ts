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

  it("off: adds reasoning_effort: 'none' to the outgoing JSON body, preserving every other field", async () => {
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
    expect(body.reasoning_effort).toBe("none");
    expect(body.model).toBe("m");
    expect(body.temperature).toBe(0);
    expect(body.stream).toBe(false);
    expect(body.tools).toEqual([]);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
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
  it("defaults to on when nothing is set", () => {
    expect(resolveRefereeThinking(undefined, undefined)).toEqual({ mode: "on", source: "default" });
    expect(resolveRefereeThinking("", "")).toEqual({ mode: "on", source: "default" });
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
    expect(line).toContain('reasoning_effort: "none"');
  });

  it("names the legacy variable, and says it applies to both roles, when that is what set it", () => {
    const line = thinkingHeaderLine("wits", { mode: "on", source: "legacy" });
    expect(line).toContain("Thinking (wits): ON");
    expect(line).toContain("PRISONER_THINKING=on");
    expect(line).toContain("both roles");
  });

  it("says 'the default' when neither variable was set", () => {
    const line = thinkingHeaderLine("wits", { mode: "off", source: "default" });
    expect(line).toContain("Thinking (wits): OFF");
    expect(line).toContain("the default");
  });
});
