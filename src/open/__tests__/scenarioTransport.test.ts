import { describe, it, expect, vi } from "vitest";
import { createScenarioGenerationTransport, buildGenerationPrompt } from "../scenarioTransport.js";

// OFFLINE ONLY, exactly `refereeTransport.test.ts`'s own header: never run
// against doris in this task (CODER-BRIEF: "You must NOT call any model or
// touch the GPU").
function fakeFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({ ok, json: async () => body })) as unknown as typeof fetch;
}

describe("buildGenerationPrompt", () => {
  it("carries the object id and the facts to preserve, and asks for physical texture only", () => {
    const prompt = buildGenerationPrompt("bar", "The iron bar set across the cell's small window.");
    expect(prompt).toContain("bar");
    expect(prompt).toContain("The iron bar set across the cell's small window.");
    expect(prompt).toMatch(/never.*a use/i);
    expect(prompt).toMatch(/never naming any other object/i);
  });
});

describe("createScenarioGenerationTransport (offline only)", () => {
  it("sends the configured temperature, tools: [], stream: false, no Authorization header", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "A dented tin cup." } }] }) };
    }) as unknown as typeof fetch;

    const transport = createScenarioGenerationTransport({ baseUrl: "http://localhost:11434/v1", model: "muse-glimmer:30b", temperature: 0.9, fetchFn });
    const result = await transport({ objectId: "bar", facts: "The iron bar.", attempt: 1 });

    expect(result).toBe("A dented tin cup.");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.temperature).toBe(0.9);
    expect(body.tools).toEqual([]);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("muse-glimmer:30b");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("trims the reply and returns it verbatim otherwise", async () => {
    const transport = createScenarioGenerationTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "m",
      temperature: 0.9,
      fetchFn: fakeFetch({ choices: [{ message: { content: "  A dull grey bar.  \n" } }] }),
    });
    expect(await transport({ objectId: "bar", facts: "x", attempt: 1 })).toBe("A dull grey bar.");
  });

  it("a non-200 response returns null, never throws", async () => {
    const transport = createScenarioGenerationTransport({ baseUrl: "http://localhost:11434/v1", model: "m", temperature: 0.9, fetchFn: fakeFetch({}, false) });
    expect(await transport({ objectId: "bar", facts: "x", attempt: 1 })).toBeNull();
  });

  it("an empty or missing reply returns null", async () => {
    const transport = createScenarioGenerationTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "m",
      temperature: 0.9,
      fetchFn: fakeFetch({ choices: [{ message: { content: "   " } }] }),
    });
    expect(await transport({ objectId: "bar", facts: "x", attempt: 1 })).toBeNull();
  });

  it("a thrown fetch (timeout, network error) returns null, never throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    const transport = createScenarioGenerationTransport({ baseUrl: "http://localhost:11434/v1", model: "m", temperature: 0.9, fetchFn });
    expect(await transport({ objectId: "bar", facts: "x", attempt: 1 })).toBeNull();
  });

  it("calls ensureLoaded with the configured model before the request -- the one-model-at-a-time swapper", async () => {
    const calls: string[] = [];
    const transport = createScenarioGenerationTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "muse-glimmer:30b",
      temperature: 0.9,
      fetchFn: fakeFetch({ choices: [{ message: { content: "text" } }] }),
      ensureLoaded: async (m) => {
        calls.push(m);
      },
    });
    await transport({ objectId: "bar", facts: "x", attempt: 1 });
    expect(calls).toEqual(["muse-glimmer:30b"]);
  });

  it("thinking off adds reasoning_effort: none and the <|eot|> stop, exactly like the referee transport", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "text" } }] }) };
    }) as unknown as typeof fetch;
    const transport = createScenarioGenerationTransport({ baseUrl: "http://localhost:11434/v1", model: "m", temperature: 0.9, fetchFn, thinking: "off" });
    await transport({ objectId: "bar", facts: "x", attempt: 1 });
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.reasoning_effort).toBe("none");
    expect(body.stop).toContain("<|eot|>");
  });

  it("thinking on (default) sends no reasoning field at all", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "text" } }] }) };
    }) as unknown as typeof fetch;
    const transport = createScenarioGenerationTransport({ baseUrl: "http://localhost:11434/v1", model: "m", temperature: 0.9, fetchFn });
    await transport({ objectId: "bar", facts: "x", attempt: 1 });
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.reasoning_effort).toBeUndefined();
  });
});
