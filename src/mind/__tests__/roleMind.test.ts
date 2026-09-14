// Configurable model roles, at the generic level (this task's brief, item
// 1): `composeRoleMind` is what `prisonerMind.ts`/`wardenMind.ts` use
// whenever wits and voice name DIFFERENT models -- this file exercises it
// directly, against a tiny fake context/schema, so the composition itself
// (two calls, in order, combined, silence handled two different ways) is
// proven once, generically, rather than only ever observed through a real
// game's own shapes.
import { describe, it, expect, vi } from "vitest";
import type { InertRecord } from "mind-seam";
import { composeRoleMind, type RoleContext } from "../roleMind.js";

interface FakeContext extends RoleContext {
  readonly extra: string;
}

const WITS_SCHEMA: InertRecord = {
  type: "object",
  properties: { thoughts: { type: "string" }, plan: { type: "array", items: { type: "string" } }, notes: { type: "string" } },
  required: ["thoughts", "plan", "notes"],
  additionalProperties: false,
};
const VOICE_SCHEMA: InertRecord = {
  type: "object",
  properties: { intent: { type: "string" }, line: { type: "string" } },
  required: ["intent", "line"],
  additionalProperties: false,
};

function baseContext(): FakeContext {
  return { principalId: "p1", identity: "id", motive: "mot", briefing: "brief", moves: ["A", "B"], extra: "x" };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function chatBody(content: unknown): unknown {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

function buildMind(fetchFn: typeof fetch, extra?: Partial<Parameters<typeof composeRoleMind<FakeContext>>[0]>) {
  return composeRoleMind<FakeContext>(
    {
      baseUrl: "http://offline.invalid",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      witsSchema: WITS_SCHEMA,
      voiceSchema: VOICE_SCHEMA,
      buildWitsPrompt: (ctx) => `WITS:${ctx.briefing}`,
      buildVoicePrompt: (ctx) => `VOICE:${ctx.briefing}:${ctx.decision.choice}:${ctx.decision.thoughts ?? ""}`,
      coerceWits: (raw) => {
        const r = raw as { plan?: string[]; thoughts?: string; notes?: string };
        if (!r.plan || r.plan.length === 0) return null;
        return { intent: "", choice: r.plan[0], plan: r.plan, thoughts: r.thoughts, notes: r.notes };
      },
      coerceVoice: (raw) => {
        const r = raw as { intent?: string; line?: string };
        if (!r.intent) return null;
        return { intent: r.intent, line: r.line };
      },
      fetchFn,
      ...extra,
    },
    (context, wits) => ({
      principalId: context.principalId,
      identity: context.identity,
      motive: context.motive,
      briefing: context.briefing,
      decision: { choice: wits.choice ?? "", thoughts: wits.thoughts },
    }),
    (_context, wits, voice, meta) => ({
      intent: voice?.intent ?? "",
      line: voice?.line ?? "",
      choice: wits.choice,
      plan: wits.plan,
      thoughts: wits.thoughts,
      notes: wits.notes,
      witsMs: meta.witsMs,
      voiceMs: meta.voiceMs,
      voiceSilenceReason: meta.voiceSilenceReason,
    })
  );
}

describe("composeRoleMind -- two sequential calls, combined", () => {
  it("calls wits first, then voice with the decision, and combines both into one proposal", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      calls.push({ url: String(url), body });
      if (body.model === "wits-model") {
        return jsonResponse(chatBody({ thoughts: "thinking hard", plan: ["A", "B"], notes: "remember this" }));
      }
      return jsonResponse(chatBody({ intent: "doing A", line: "I will do A." }));
    }) as unknown as typeof fetch;

    const mind = buildMind(fetchFn);
    const result = await mind.consider(baseContext());

    expect(calls).toHaveLength(2);
    expect(calls[0].body.model).toBe("wits-model");
    expect(calls[1].body.model).toBe("voice-model");

    // The voice prompt saw the decision (chosen move + thoughts), not the
    // raw wits schema fields -- proven by the fake prompt builder encoding
    // exactly that.
    const voiceMessage = calls[1].body.messages as { content: string }[];
    expect(voiceMessage[0].content).toContain("VOICE:brief:A:thinking hard");

    expect(result).toMatchObject({ intent: "doing A", line: "I will do A.", choice: "A", plan: ["A", "B"], thoughts: "thinking hard", notes: "remember this" });
    expect(result?.witsMs).toBeGreaterThanOrEqual(0);
    expect(result?.voiceMs).toBeGreaterThanOrEqual(0);
  });

  it("a wits silence is a full silence -- voice is never called", async () => {
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      calls.push(body.model);
      return jsonResponse(chatBody({})); // no plan -> coerceWits returns null
    }) as unknown as typeof fetch;

    const mind = buildMind(fetchFn);
    const result = await mind.consider(baseContext());

    expect(result).toBeNull();
    expect(calls).toEqual(["wits-model"]);
  });

  it("a voice silence still resolves the turn: wits decision kept, empty line, reason recorded separately", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") {
        return jsonResponse(chatBody({ thoughts: "t", plan: ["A"], notes: "n" }));
      }
      return jsonResponse(chatBody({})); // no intent -> coerceVoice returns null -> "rejected"
    }) as unknown as typeof fetch;

    const mind = buildMind(fetchFn);
    const result = await mind.consider(baseContext());

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ intent: "", line: "", choice: "A", plan: ["A"], voiceSilenceReason: "rejected" });
  });

  it("onWitsSilence/onVoiceSilence fire independently, naming their own call's reason", async () => {
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "wits-model") return jsonResponse(chatBody({ thoughts: "t", plan: ["A"], notes: "n" }));
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    let witsReason: string | undefined;
    let voiceReason: string | undefined;
    const mind = buildMind(fetchFn, {
      onWitsSilence: (r) => (witsReason = r),
      onVoiceSilence: (r) => (voiceReason = r),
    });
    await mind.consider(baseContext());

    expect(witsReason).toBeUndefined();
    expect(voiceReason).toBe("unreachable");
  });

  it("ensureLoaded is called with each sub-call's own model, before that call, and its error propagates (never swallowed into a silence)", async () => {
    const ensureLoadedCalls: string[] = [];
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      return jsonResponse(chatBody(body.model === "wits-model" ? { thoughts: "t", plan: ["A"], notes: "n" } : { intent: "i", line: "l" }));
    }) as unknown as typeof fetch;

    const mind = buildMind(fetchFn, {
      ensureLoaded: async (model: string) => {
        ensureLoadedCalls.push(model);
      },
    });
    await mind.consider(baseContext());
    expect(ensureLoadedCalls).toEqual(["wits-model", "voice-model"]);
  });

  it("a thrown ensureLoaded error propagates out of consider() uncaught -- loud, not a silence", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(chatBody({ thoughts: "t", plan: ["A"], notes: "n" }))) as unknown as typeof fetch;
    const mind = buildMind(fetchFn, {
      ensureLoaded: async () => {
        throw new Error("OllamaModelSwapper: timed out");
      },
    });
    await expect(mind.consider(baseContext())).rejects.toThrow(/timed out/);
  });
});
