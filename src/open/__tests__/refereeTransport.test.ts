import { describe, it, expect, vi } from "vitest";
import type { ReadRequest } from "run-dmcp";
import { createRefereeTransport } from "../refereeTransport.js";

const REQUEST: ReadRequest = {
  questions: [{ id: "target", prompt: "Which object?", answerKeys: ["bar", "none"], safeDefault: "none" }],
  sources: [{ id: "intent", text: "I file the bar." }],
};

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("createRefereeTransport (offline only -- never run against doris in this task)", () => {
  it("sends tools: [], stream: false, temperature 0, no Authorization header", async () => {
    let capturedInit: RequestInit | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      capturedInit = init;
      return { ok: true, json: async () => ({ choices: [{ message: { content: "[]" } }] }) };
    }) as unknown as typeof fetch;

    const transport = createRefereeTransport({ baseUrl: "http://localhost:11434/v1", model: "qwen2.5:14b", fetchFn });
    await transport(REQUEST);

    expect(capturedInit).toBeTruthy();
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.tools).toEqual([]);
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0);
    const headers = capturedInit?.headers as Record<string, string>;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  it("parses a JSON array of answers out of the model's message content", async () => {
    const content = JSON.stringify([
      { questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
    ]);
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({ choices: [{ message: { content } }] }),
    });
    const answers = await transport(REQUEST);
    expect(answers).toEqual([{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } }]);
  });

  it("parses a JSON array wrapped in a code fence or sentence", async () => {
    const content =
      "Here is my ruling:\n```json\n" +
      JSON.stringify([{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } }]) +
      "\n```";
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({ choices: [{ message: { content } }] }),
    });
    const answers = await transport(REQUEST);
    expect(answers.length).toBe(1);
    expect(answers[0].answerKey).toBe("bar");
  });

  it("a non-200 response returns an empty array, never throws", async () => {
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({}, false),
    });
    await expect(transport(REQUEST)).resolves.toEqual([]);
  });

  it("unparseable content returns an empty array", async () => {
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({ choices: [{ message: { content: "not json at all" } }] }),
    });
    await expect(transport(REQUEST)).resolves.toEqual([]);
  });

  it("a rejected fetch returns an empty array, never throws", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const transport = createRefereeTransport({ baseUrl: "http://localhost:11434/v1", model: "qwen2.5:14b", fetchFn });
    await expect(transport(REQUEST)).resolves.toEqual([]);
  });

  it("an answer entry missing a citation field is dropped, not returned malformed", async () => {
    const content = JSON.stringify([{ questionId: "target", answerKey: "bar" }]);
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({ choices: [{ message: { content } }] }),
    });
    await expect(transport(REQUEST)).resolves.toEqual([]);
  });

  it("calls ensureLoaded(model) before the request", async () => {
    const calls: string[] = [];
    const transport = createRefereeTransport({
      baseUrl: "http://localhost:11434/v1",
      model: "qwen2.5:14b",
      fetchFn: fakeFetch({ choices: [{ message: { content: "[]" } }] }),
      ensureLoaded: async (model) => {
        calls.push(model);
      },
    });
    await transport(REQUEST);
    expect(calls).toEqual(["qwen2.5:14b"]);
  });

  describe("the prompt it builds (OPEN-VARIANT.md §11.4: citation mechanics)", () => {
    const RICH: ReadRequest = {
      questions: [{ id: "target", prompt: "Which object?", answerKeys: ["bar", "none"], safeDefault: "none" }],
      sources: [
        { id: "intent", text: "Closely examine the bar." },
        { id: "desc:bar", text: "Rust has pitted it near the bottom." },
        { id: "precedent:bar", text: "effect=reveal property=integrity magnitude=slight" },
      ],
    };

    async function promptFor(request: ReadRequest): Promise<string> {
      let prompt = "";
      const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
        prompt = JSON.parse(init?.body as string).messages[0].content;
        return { ok: true, json: async () => ({ choices: [{ message: { content: "[]" } }] }) };
      }) as unknown as typeof fetch;
      await createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn })(request);
      return prompt;
    }

    it("never writes a source id inside brackets, which invites '[desc:bar]' as a citation", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).not.toMatch(/\[(intent|desc:bar|precedent:bar)\]/);
      expect(prompt).toContain('source "desc:bar"');
    });

    it("shows earlier rulings apart from the citable sources, and says they are never cited", async () => {
      const prompt = await promptFor(RICH);
      const citable = prompt.slice(0, prompt.indexOf("EARLIER RULINGS"));
      expect(citable).toContain('source "intent"');
      expect(citable).not.toContain("precedent:bar");
      const earlier = prompt.slice(prompt.indexOf("EARLIER RULINGS"));
      expect(earlier).toContain("effect=reveal property=integrity magnitude=slight");
      expect(earlier).toMatch(/never cite/i);
    });

    it("omits the earlier-rulings section when there are none", async () => {
      expect(await promptFor(REQUEST)).not.toContain("EARLIER RULINGS");
    });

    it("demands exact copies: capital letters and punctuation kept, no '...', never empty", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).toMatch(/capital letters/i);
      expect(prompt).toContain("...");
      expect(prompt).toMatch(/never empty/i);
    });
  });
});
