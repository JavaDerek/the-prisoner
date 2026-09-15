import { describe, it, expect, vi } from "vitest";
import { createTurnReader, type ReadRequest } from "run-dmcp";
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

    it("§11.4's mid-sentence example is gone: a ranged citation cannot miscapitalise (OPEN-VARIANT.md §18.2)", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).not.toMatch(/middle of a sentence/i);
      expect(prompt).not.toMatch(/small first letter/i);
      expect(prompt).not.toContain("The springs are held.");
    });

    it("renders every citable source with its words numbered, a word being a maximal run of non-whitespace (OPEN-VARIANT.md §18.1)", async () => {
      const prompt = await promptFor({
        questions: RICH.questions,
        sources: [
          { id: "intent", text: "Closely  examine the bar." },
          { id: "desc:door", text: "A heavy door of iron-bound planks" },
          { id: "precedent:bar", text: "effect=reveal property=integrity magnitude=slight" },
        ],
      });
      // §18.4: the plain text first, to be read; the numbered words after, only to cite.
      expect(prompt).toContain('source "intent":\nClosely  examine the bar.\nwords: 1:Closely 2:examine 3:the 4:bar.\n');
      expect(prompt).toContain('source "desc:door":\nA heavy door of iron-bound planks\nwords: 1:A 2:heavy 3:door 4:of 5:iron-bound 6:planks\n');
      // Earlier rulings are never cited, so they are not numbered.
      expect(prompt).toContain("effect=reveal property=integrity magnitude=slight");
      expect(prompt).not.toContain("1:effect=reveal");
    });

    it("asks for citations as a word range, and keeps the character-for-character rule for a quote given instead (OPEN-VARIANT.md §18.1, §18.2)", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).toContain('"citation": {"sourceId": string, "from": number, "to": number}');
      expect(prompt).toMatch(/"quote" is copied from that source character for character/);
    });

    it("demands exact copies: capital letters and punctuation kept, no '...', never empty", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).toMatch(/capital letters/i);
      expect(prompt).toContain("...");
      expect(prompt).toMatch(/never empty/i);
    });
  });

  describe("citations by word range (OPEN-VARIANT.md §18)", () => {
    const SOURCES: ReadRequest = {
      questions: [
        { id: "target", prompt: "Which object?", answerKeys: ["door", "none"], safeDefault: "none" },
        { id: "property", prompt: "Grounded how?", answerKeys: ["passage", "none"], safeDefault: "none" },
      ],
      sources: [
        { id: "intent", text: "I push  the bolt\tback, slowly." },
        { id: "desc:door", text: "A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap." },
      ],
    };

    async function answersFor(citations: unknown[], request: ReadRequest = SOURCES) {
      const content = JSON.stringify(citations.map((citation, i) => ({ questionId: i === 0 ? "target" : "property", answerKey: i === 0 ? "door" : "passage", citation })));
      return createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content } }] }) })(request);
    }

    it("rebuilds the quote as the source sliced from the first character of word `from` to the last of word `to`, whitespace and punctuation included, and keeps the range", async () => {
      const answers = await answersFor([
        { sourceId: "intent", from: 2, to: 5 },
        { sourceId: "desc:door", from: 11, to: 11 },
      ]);
      expect(answers).toEqual([
        { questionId: "target", answerKey: "door", citation: { sourceId: "intent", quote: "push  the bolt\tback,", from: 2, to: 5 } },
        { questionId: "property", answerKey: "passage", citation: { sourceId: "desc:door", quote: "It", from: 11, to: 11 } },
      ]);
    });

    it("the rebuilt quote is exact: a span that starts mid-sentence keeps its small letter, and one that ends a sentence keeps its full stop", async () => {
      const answers = await answersFor([
        { sourceId: "desc:door", from: 21, to: 29 },
        { sourceId: "desc:door", from: 1, to: 10 },
      ]);
      expect(answers[0].citation.quote).toBe("the edge of the bolt shows in the gap.");
      expect(answers[1].citation.quote).toBe("A heavy door of iron-bound planks in a stone frame.");
    });

    it("drops a range out of bounds, reversed, non-integer, or naming a source not in the request", async () => {
      const bad = [
        { sourceId: "intent", from: 0, to: 2 },
        { sourceId: "intent", from: 1, to: 7 },
        { sourceId: "intent", from: 3, to: 2 },
        { sourceId: "intent", from: 1.5, to: 2 },
        { sourceId: "intent", from: "1", to: "2" },
        { sourceId: "intent", from: 1 },
        { sourceId: "desc:bar", from: 1, to: 1 },
        { sourceId: "[intent]", from: 1, to: 1 },
      ];
      for (const citation of bad) expect(await answersFor([citation]), JSON.stringify(citation)).toEqual([]);
    });

    it("passes a quote citation through untouched, verbatim or not -- the engine checks it byte-exact as before", async () => {
      const answers = await answersFor([
        { sourceId: "intent", quote: "push the bolt back" },
        { sourceId: "desc:door", quote: "the edge of the bolt shows in the gap" },
      ]);
      expect(answers).toEqual([
        { questionId: "target", answerKey: "door", citation: { sourceId: "intent", quote: "push the bolt back" } },
        { questionId: "property", answerKey: "passage", citation: { sourceId: "desc:door", quote: "the edge of the bolt shows in the gap" } },
      ]);
    });

    it("a ranged citation verifies through the engine's own unchanged turn reader", async () => {
      const content = JSON.stringify([
        { questionId: "target", answerKey: "door", citation: { sourceId: "intent", from: 2, to: 5 } },
        { questionId: "property", answerKey: "passage", citation: { sourceId: "desc:door", from: 21, to: 29 } },
      ]);
      const transport = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content } }] }) });
      const result = await createTurnReader({ questions: SOURCES.questions, transports: [transport] }).read(SOURCES.sources);
      expect(result.answers.map((a) => [a.answerKey, a.fromSafeDefault, a.citation?.quote])).toEqual([
        ["door", false, "push  the bolt\tback,"],
        ["passage", false, "the edge of the bolt shows in the gap."],
      ]);
    });
  });
});
