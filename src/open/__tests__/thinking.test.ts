import { describe, it, expect, vi } from "vitest";
import { readThinkingMode, withThinking } from "../thinking.js";

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
