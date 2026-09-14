// Configurable model roles for the prisoner (this task's brief, item 1).
// `createPrisonerMind` grows two optional fields, `witsModel`/`voiceModel`:
// when absent (only `model` given) or equal, this is a NO-OP -- the exact
// same single-call code path `prisonerMind.test.ts` already exercises
// (`buildPrisonerPrompt`, `PRISONER_PROPOSAL_SCHEMA`, `coercePrisonerProposal`,
// untouched). When they differ, `createPrisonerMind` composes two calls
// through `composeRoleMind` (`roleMind.test.ts` covers that composition
// generically; this file covers the prisoner's own wits/voice schemas,
// prompts, and coercers, plus the default-equivalence proof itself).
import { describe, it, expect, vi } from "vitest";
import { createPrisonerMind, type PrisonerContext } from "../prisonerMind.js";
import { PRISONER_MOVES } from "../../world/mechanics.js";

const context: PrisonerContext = {
  principalId: "prisoner-1",
  identity: "the prisoner in this cell",
  motive: "to escape",
  briefing: "The intact bar is here.\nbar integrity: 100.",
  moves: ["FILE", "SHIM", "HONE", "CONCEAL", "INSPECT", "WAIT"],
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function chatBody(content: unknown): unknown {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

describe("default behaviour: witsModel === voiceModel (or only `model` given) -- ONE call, unchanged", () => {
  it("`model` alone: exactly one fetch call, the same body createPrisonerMind has always sent", async () => {
    let calls = 0;
    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls += 1;
      capturedBody = JSON.parse(init?.body as string);
      return jsonResponse(chatBody({ thoughts: "t", intent: "wait", line: "", plan: ["WAIT"], notes: "n" }));
    });
    const mind = createPrisonerMind({ baseUrl: "http://offline.invalid", model: "test-model", fetchFn: fetchFn as unknown as typeof fetch });
    const result = await mind.consider(context);

    expect(calls).toBe(1);
    expect(capturedBody?.model).toBe("test-model");
    const responseFormat = capturedBody?.response_format as { json_schema: { schema: { required: string[] } } };
    expect(responseFormat.json_schema.schema.required).toEqual(["thoughts", "intent", "line", "plan", "notes"]);
    expect(result).toEqual({ thoughts: "t", intent: "wait", choice: "WAIT", plan: ["WAIT"], notes: "n" });
    expect(result).not.toHaveProperty("witsModel");
    expect(result).not.toHaveProperty("voiceModel");
  });

  it("witsModel === voiceModel behaves identically to `model` alone: one call, same body shape", async () => {
    let calls = 0;
    let capturedBody: Record<string, unknown> | undefined;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      calls += 1;
      capturedBody = JSON.parse(init?.body as string);
      return jsonResponse(chatBody({ thoughts: "t", intent: "wait", line: "", plan: ["WAIT"], notes: "n" }));
    });
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      witsModel: "same-model",
      voiceModel: "same-model",
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const result = await mind.consider(context);

    expect(calls).toBe(1);
    expect(capturedBody?.model).toBe("same-model");
    const responseFormat = capturedBody?.response_format as { json_schema: { schema: { required: string[] } } };
    expect(responseFormat.json_schema.schema.required).toEqual(["thoughts", "intent", "line", "plan", "notes"]);
    expect(result).toEqual({ thoughts: "t", intent: "wait", choice: "WAIT", plan: ["WAIT"], notes: "n" });
  });
});

describe("wits and voice name different models -- two calls, composed", () => {
  function twoModelFetch(onCall?: (model: string, body: Record<string, unknown>) => void) {
    return vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      onCall?.(body.model as string, body);
      if (body.model === "wits-model") {
        return jsonResponse(chatBody({ thoughts: "planning to file", plan: ["FILE"], notes: "watch suspicion" }));
      }
      return jsonResponse(chatBody({ intent: "file at the bar", line: "You'll never keep me in here." }));
    }) as unknown as typeof fetch;
  }

  it("makes exactly two calls, one per model, and combines the result", async () => {
    const models: string[] = [];
    const fetchFn = twoModelFetch((m) => models.push(m));
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      fetchFn,
    });
    const result = await mind.consider(context);

    expect(models).toEqual(["wits-model", "voice-model"]);
    expect(result).toMatchObject({
      choice: "FILE",
      plan: ["FILE"],
      thoughts: "planning to file",
      notes: "watch suspicion",
      intent: "file at the bar",
      line: "You'll never keep me in here.",
      witsModel: "wits-model",
      voiceModel: "voice-model",
    });
    expect(result?.witsMs).toBeGreaterThanOrEqual(0);
    expect(result?.voiceMs).toBeGreaterThanOrEqual(0);
  });

  it("the wits schema asks only for thoughts/plan/notes -- no intent, no line", async () => {
    let witsBody: Record<string, unknown> | undefined;
    const fetchFn = twoModelFetch((m, body) => {
      if (m === "wits-model") witsBody = body;
    });
    const mind = createPrisonerMind({ baseUrl: "http://offline.invalid", witsModel: "wits-model", voiceModel: "voice-model", fetchFn });
    await mind.consider(context);

    const schema = (witsBody?.response_format as { json_schema: { schema: { required: string[]; properties: Record<string, unknown> } } })
      .json_schema.schema;
    expect(schema.required).toEqual(["thoughts", "plan", "notes"]);
    expect(Object.keys(schema.properties)).toEqual(["thoughts", "plan", "notes"]);
    expect(schema.properties.plan).toMatchObject({ items: { enum: PRISONER_MOVES } });
  });

  it("the voice schema asks only for intent/line, and the voice context carries the decision but not the move list", async () => {
    let voiceBody: Record<string, unknown> | undefined;
    const fetchFn = twoModelFetch((m, body) => {
      if (m === "voice-model") voiceBody = body;
    });
    const mind = createPrisonerMind({ baseUrl: "http://offline.invalid", witsModel: "wits-model", voiceModel: "voice-model", fetchFn });
    await mind.consider(context);

    const schema = (voiceBody?.response_format as { json_schema: { schema: { required: string[]; properties: Record<string, unknown> } } })
      .json_schema.schema;
    expect(schema.required).toEqual(["intent", "line"]);
    expect(Object.keys(schema.properties)).toEqual(["intent", "line"]);

    const prompt = (voiceBody?.messages as { content: string }[])[0].content;
    expect(prompt).toContain("FILE"); // the chosen move
    expect(prompt).toContain("planning to file"); // wits' own thoughts
    expect(prompt).toContain(context.briefing);
    expect(prompt).toContain(context.identity);
    // Never a second choice to make.
    expect(prompt.toLowerCase()).not.toContain("your possible moves are exactly these");
  });

  it("a voice silence: the turn still resolves with the wits decision and an empty line, recorded as a voice silence", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") {
        return jsonResponse(chatBody({ thoughts: "planning to file", plan: ["FILE"], notes: "n" }));
      }
      throw new Error("ECONNREFUSED"); // voice endpoint down
    }) as unknown as typeof fetch;

    let voiceSilenceReason: string | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      fetchFn,
      onVoiceSilence: (reason) => (voiceSilenceReason = reason),
    });
    const result = await mind.consider(context);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ choice: "FILE", plan: ["FILE"], intent: "", line: "", voiceSilenceReason: "unreachable" });
    expect(voiceSilenceReason).toBe("unreachable");
  });

  it("a wits (decision) silence is still a full silence -- voice is never called", async () => {
    let voiceCalled = false;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "voice-model") voiceCalled = true;
      return jsonResponse(chatBody({})); // no plan at all -> wits rejected
    }) as unknown as typeof fetch;

    let onSilenceReason: string | undefined;
    const mind = createPrisonerMind({
      baseUrl: "http://offline.invalid",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      fetchFn,
      onSilence: (reason) => (onSilenceReason = reason),
    });
    const result = await mind.consider(context);

    expect(result).toBeNull();
    expect(voiceCalled).toBe(false);
    expect(onSilenceReason).toBe("rejected");
  });
});
