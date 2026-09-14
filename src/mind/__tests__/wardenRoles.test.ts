// Configurable model roles for the warden -- mirrors
// `prisonerRoles.test.ts`. `roleMind.test.ts` already proves the generic
// composition; this file proves the warden's OWN wits/voice schemas use
// WARDEN_MOVES (not PRISONER_MOVES) and that the default (single-model)
// path is untouched, the same two things `prisonerRoles.test.ts` proves for
// the prisoner.
import { describe, it, expect, vi } from "vitest";
import { createWardenMind, type WardenContext } from "../wardenMind.js";
import { WARDEN_MOVES } from "../../world/mechanics.js";

const context: WardenContext = {
  principalId: "warden-1",
  identity: "the warden",
  motive: "keep the cell secure",
  briefing: "The prisoner is here.",
  moves: WARDEN_MOVES as unknown as string[],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function chatBody(content: unknown): unknown {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

describe("default behaviour: witsModel === voiceModel -- ONE call, unchanged", () => {
  it("`model` alone: exactly one fetch call", async () => {
    let calls = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(init?.body as string);
      expect(body.model).toBe("test-model");
      return jsonResponse(chatBody({ thoughts: "t", intent: "watch", line: "", plan: ["WAIT"], notes: "n" }));
    });
    const mind = createWardenMind({ baseUrl: "http://offline.invalid", model: "test-model", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await mind.consider(context);
    expect(calls).toBe(1);
    expect(result).toEqual({ thoughts: "t", intent: "watch", choice: "WAIT", plan: ["WAIT"], notes: "n" });
  });
});

describe("wits and voice name different models", () => {
  function twoModelFetch() {
    return vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") {
        return jsonResponse(chatBody({ thoughts: "grounds to search", plan: ["SEARCH"], notes: "n" }));
      }
      return jsonResponse(chatBody({ intent: "search the cell", line: "I know you're hiding something." }));
    }) as unknown as typeof fetch;
  }

  it("composes two calls into one proposal, naming both models", async () => {
    const mind = createWardenMind({ baseUrl: "http://offline.invalid", witsModel: "wits-model", voiceModel: "voice-model", fetchFn: twoModelFetch() });
    const result = await mind.consider(context);
    expect(result).toMatchObject({
      choice: "SEARCH",
      plan: ["SEARCH"],
      intent: "search the cell",
      line: "I know you're hiding something.",
      witsModel: "wits-model",
      voiceModel: "voice-model",
    });
  });

  it("the wits schema's plan enum is WARDEN_MOVES, not PRISONER_MOVES", async () => {
    let witsBody: Record<string, unknown> | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") witsBody = body;
      if (body.model === "wits-model") return jsonResponse(chatBody({ thoughts: "t", plan: ["WAIT"], notes: "n" }));
      return jsonResponse(chatBody({ intent: "i", line: "l" }));
    }) as unknown as typeof fetch;
    const mind = createWardenMind({ baseUrl: "http://offline.invalid", witsModel: "wits-model", voiceModel: "voice-model", fetchFn });
    await mind.consider(context);

    const schema = (witsBody?.response_format as { json_schema: { schema: { properties: { plan: { items: { enum: string[] } } } } } }).json_schema
      .schema;
    expect(schema.properties.plan.items.enum).toEqual(WARDEN_MOVES);
  });

  it("a voice silence still resolves with the wits decision and empty line", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") return jsonResponse(chatBody({ thoughts: "t", plan: ["OBSERVE"], notes: "n" }));
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const mind = createWardenMind({ baseUrl: "http://offline.invalid", witsModel: "wits-model", voiceModel: "voice-model", fetchFn });
    const result = await mind.consider(context);
    expect(result).toMatchObject({ choice: "OBSERVE", intent: "", line: "", voiceSilenceReason: "unreachable" });
  });
});
