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

  it("a question id written the way the prompt lists it, id \"target\", is read as that question -- only when it names one the request asked (OPEN-VARIANT.md §33.16)", async () => {
    // §33.16: qwen3:14b copied the prompt's own `- id "target":` line into 2 of 78 replies; every answer
    // was dropped and the whole ruling fell to its safe defaults, on an intent it had judged correctly.
    const content = JSON.stringify([
      { questionId: 'id "target"', answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
      { questionId: 'id "effect"', answerKey: "wear", citation: { sourceId: "intent", quote: "file" } },
      { questionId: "id target", answerKey: "bar", citation: { sourceId: "intent", quote: "bar" } },
      { questionId: 'id "target" ', answerKey: "bar", citation: { sourceId: "intent", quote: "bar" } },
    ]);
    const transport = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content } }] }) });
    const answers = await transport(REQUEST);
    // Anything else is handed on exactly as it came, for the engine to ignore as before.
    expect(answers.map((a) => a.questionId)).toEqual(["target", 'id "effect"', "id target", 'id "target" ']);
    expect(answers[0]).toEqual({ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } });
  });

  it("a stray quote after a number, which stops the reply parsing, is dropped -- only when the reply does not parse as it came (OPEN-VARIANT.md §37)", async () => {
    // §37: qwen3:14b answered "Attempt to pry the bar out of the mortar using the spoon" correctly and
    // closed its last citation `"to": 12"}`, 3 of 3 at temperature 0; the whole ruling fell to its safe
    // defaults. Syntax only: a quote directly after a number, before , } or ].
    const content =
      '[{"questionId": "target", "answerKey": "bar", "citation": {"sourceId": "intent", "from": 2, "to": 3}}, ' +
      '{"questionId": "effect", "answerKey": "wear", "citation": {"sourceId": "intent", "from": 1, "to": 1"}}]';
    const transport = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content } }] }) });
    const answers = await transport(REQUEST);
    expect(answers.map((a) => [a.questionId, a.answerKey])).toEqual([
      ["target", "bar"],
      ["effect", "wear"],
    ]);

    // A reply that parses is never touched, even where a string itself ends in digits and a quote.
    const valid = JSON.stringify([{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file 2" } }]);
    const untouched = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content: valid } }] }) });
    await expect(untouched(REQUEST)).resolves.toEqual([{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file 2" } }]);

    // Any other broken JSON is still no answers at all.
    const broken = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: fakeFetch({ choices: [{ message: { content: '[{"questionId": "target", "answerKey": "bar",}]' } }] }) });
    await expect(broken(REQUEST)).resolves.toEqual([]);
  });

  it("keeps its last exchange -- the raw reply, the HTTP status, any error, and how long it took (OPEN-VARIANT.md §38)", async () => {
    const content = '[{"questionId": "target", "answerKey": "bar", "citation": {"sourceId": "intent", "from": 3, "to": 3}}]';
    const transport = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) })) as unknown as typeof fetch });
    expect(transport.lastExchange()).toBeUndefined();
    await transport(REQUEST);
    expect(transport.lastExchange()).toMatchObject({ status: 200, content });
    expect(typeof transport.lastExchange()?.ms).toBe("number");

    const refused = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn: (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch });
    await refused(REQUEST);
    expect(refused.lastExchange()).toMatchObject({ status: 500 });

    const aborted = createRefereeTransport({
      baseUrl: "http://x",
      model: "m",
      fetchFn: (async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }) as unknown as typeof fetch,
    });
    await expect(aborted(REQUEST)).resolves.toEqual([]);
    expect(aborted.lastExchange()?.error).toMatch(/TimeoutError/);
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

  // OPEN-VARIANT.md §64.7, WORLD-ELABORATION-DESIGN.md §4.8: the thinking
  // switch. `on` (unset, the default) is byte-identical to every batch
  // recorded before this arm existed -- pinned directly against a captured
  // body, not just "does not contain the field".
  describe("PRISONER_THINKING (§64.7)", () => {
    async function capturedBody(thinking?: "on" | "off"): Promise<Record<string, unknown>> {
      let capturedInit: RequestInit | undefined;
      const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
        capturedInit = init;
        return { ok: true, json: async () => ({ choices: [{ message: { content: "[]" } }] }) };
      }) as unknown as typeof fetch;
      const transport = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn, ...(thinking ? { thinking } : {}) });
      await transport(REQUEST);
      return JSON.parse(capturedInit?.body as string);
    }

    it("off: sends reasoning_effort: 'none'", async () => {
      const body = await capturedBody("off");
      expect(body.reasoning_effort).toBe("none");
    });

    it("on, and unset: the request body is byte-identical -- no reasoning_effort key at all", async () => {
      const withoutOption = await capturedBody(undefined);
      const explicitOn = await capturedBody("on");
      expect(withoutOption).not.toHaveProperty("reasoning_effort");
      expect(explicitOn).toEqual(withoutOption);
    });
  });

  describe("the prompt it builds (OPEN-VARIANT.md §11.4: citation mechanics)", () => {
    const RICH: ReadRequest = {
      questions: [{ id: "target", prompt: "Which object?", answerKeys: ["bar", "none"], safeDefault: "none" }],
      sources: [
        { id: "intent", text: "Closely examine the bar." },
        { id: "desc:bar", text: "Rust has pitted it near the bottom." },
        // referee.ts never sends a source shaped like this any more
        // (§18.6/§18.7), but this transport treats every source uniformly
        // regardless of what a caller names it -- there is no id this
        // transport singles out.
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

    it("OPEN-VARIANT.md §18.6/§18.7: never shows an EARLIER RULINGS block, and treats every source as an ordinary citable one -- dropped for good, not just unused, after prompt rewording (§18.7) failed to stop the referee copying one intent's ruling onto a different one", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).not.toContain("EARLIER RULINGS");
      expect(prompt).not.toMatch(/never cite/i);
      expect(prompt).toContain('source "precedent:bar"'); // an ordinary source now, cited like any other
      expect(await promptFor(REQUEST)).not.toContain("EARLIER RULINGS");
    });

    it("§11.4's mid-sentence example is gone: a ranged citation cannot miscapitalise (OPEN-VARIANT.md §18.2)", async () => {
      const prompt = await promptFor(RICH);
      expect(prompt).not.toMatch(/middle of a sentence/i);
      expect(prompt).not.toMatch(/small first letter/i);
      expect(prompt).not.toContain("The springs are held.");
    });

    it("renders every source with its words numbered, a word being a maximal run of non-whitespace (OPEN-VARIANT.md §18.1)", async () => {
      const prompt = await promptFor({
        questions: RICH.questions,
        sources: [
          { id: "intent", text: "Closely  examine the bar." },
          { id: "desc:door", text: "A heavy door of iron-bound planks" },
        ],
      });
      // §18.4: the plain text first, to be read; the numbered words after, only to cite.
      expect(prompt).toContain('source "intent":\nClosely  examine the bar.\nwords: 1:Closely 2:examine 3:the 4:bar.\n');
      expect(prompt).toContain('source "desc:door":\nA heavy door of iron-bound planks\nwords: 1:A 2:heavy 3:door 4:of 5:iron-bound 6:planks\n');
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

    it("a range whose end runs past the last word is clamped to it: the referee's own first word stands, the span ends where the source does (OPEN-VARIANT.md §30)", async () => {
      // §29.1/§30: "Climb through the window" is four words, and the referee cited 3-7; the whole answer
      // was dropped, so seven attempts to leave were ruled against an object the referee had named.
      const answers = await answersFor([{ sourceId: "intent", from: 3, to: 7 }]);
      expect(answers).toEqual([{ questionId: "target", answerKey: "door", citation: { sourceId: "intent", quote: "the bolt\tback, slowly.", from: 3, to: 6 } }]);
    });

    it("drops a range out of bounds, reversed, non-integer, or naming a source not in the request", async () => {
      const bad = [
        { sourceId: "intent", from: 0, to: 2 },
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
