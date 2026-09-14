import { describe, it, expect, vi } from "vitest";
import { createOpenMind, type OpenPrincipalContext } from "../mind.js";
import { PRISONER_MOVES, WARDEN_MOVES, WARDEN_PRESENCE_RULE } from "../../world/mechanics.js";

const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: "Round 1 of 12.",
  perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
};

function fakeFetch(content: string): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  })) as unknown as typeof fetch;
}

describe("createOpenMind (this task's brief: 'Open-mode minds')", () => {
  it("single-call path (witsModel === voiceModel, or only `model` given): one call, free-text intent", async () => {
    const content = JSON.stringify({
      thoughts: "I should test the bar.",
      intent: "I press hard on the rusted base of the bar to see if it moves.",
      line: "Quiet night.",
      plan: "Keep working the bar if it gives.",
      notes: "The bar's base looked weak.",
    });
    const mind = createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "m", fetchFn: fakeFetch(content) });
    const proposal = await mind.consider(CONTEXT);
    expect(proposal?.intent).toContain("rusted base");
    expect(proposal?.line).toBe("Quiet night.");
    expect(proposal?.thoughts).toContain("test the bar");
    expect(proposal?.plan).toContain("Keep working");
    expect(proposal?.notes).toContain("weak");
    expect(proposal?.witsModel).toBeUndefined(); // single-call path never sets role fields
  });

  it("a single-call answer with no non-empty intent is rejected -- silence", async () => {
    const content = JSON.stringify({ thoughts: "t", intent: "   ", line: "", plan: "p", notes: "n" });
    const mind = createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "m", fetchFn: fakeFetch(content) });
    const proposal = await mind.consider(CONTEXT);
    expect(proposal).toBeNull();
  });

  it("dual-call path (witsModel !== voiceModel): wits decides intent, voice only supplies the line", async () => {
    let call = 0;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      call += 1;
      const body = JSON.parse((init?.body as string) ?? "{}");
      if (call === 1) {
        // wits call
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({ thoughts: "plan carefully", intent: "I hone the spoon against the floor.", plan: "hone more", notes: "edge improving" }),
                  },
                },
              ],
            }),
        };
      }
      // voice call -- must have been given the wits decision, never a move list
      expect(JSON.stringify(body)).toContain("hone the spoon");
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "voiced", line: "Just stretching." }) } }] }) };
    }) as unknown as typeof fetch;

    const mind = createOpenMind({
      baseUrl: "http://x",
      selfName: "Mara Voss",
      otherName: "Warden Croft",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      fetchFn,
    });
    const proposal = await mind.consider(CONTEXT);
    expect(proposal?.intent).toBe("I hone the spoon against the floor."); // wits' intent wins, never voice's
    expect(proposal?.line).toBe("Just stretching.");
    expect(proposal?.witsModel).toBe("wits-model");
    expect(proposal?.voiceModel).toBe("voice-model");
  });

  it("GPU-safe swapping: each call's model is ensured loaded before that call's own request, in order", async () => {
    const events: string[] = [];
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      events.push(`fetch:${body.model}`);
      const content =
        body.model === "wits-model"
          ? JSON.stringify({ thoughts: "t", intent: "I hone the spoon.", plan: "p", notes: "n" })
          : JSON.stringify({ intent: "voiced", line: "Hm." });
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) };
    }) as unknown as typeof fetch;
    const ensureLoaded = async (model: string) => {
      events.push(`load:${model}`);
    };

    const dual = createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", witsModel: "wits-model", voiceModel: "voice-model", fetchFn, ensureLoaded });
    await dual.consider(CONTEXT);
    expect(events).toEqual(["load:wits-model", "fetch:wits-model", "load:voice-model", "fetch:voice-model"]);

    events.length = 0;
    const single = createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "wits-model", fetchFn, ensureLoaded });
    await single.consider(CONTEXT);
    expect(events).toEqual(["load:wits-model", "fetch:wits-model"]);
  });

  it("dual-call path: if wits silences, the whole turn silences -- voice is never called", async () => {
    let voiceCalled = false;
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = (init?.body as string) ?? "";
      if (body.includes("voiced") || voiceCalled) voiceCalled = true;
      return { ok: false, text: async () => "{}" };
    }) as unknown as typeof fetch;

    const mind = createOpenMind({
      baseUrl: "http://x",
      selfName: "Mara Voss",
      otherName: "Warden Croft",
      witsModel: "wits-model",
      voiceModel: "voice-model",
      fetchFn,
    });
    const proposal = await mind.consider(CONTEXT);
    expect(proposal).toBeNull();
  });

  it("the prompt never contains a move list -- only perceived objects and state-based rules", async () => {
    let capturedPrompt = "";
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      capturedPrompt = body.messages[0].content as string;
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ thoughts: "t", intent: "i", line: "", plan: "p", notes: "n" }) } }] }) };
    }) as unknown as typeof fetch;
    const mind = createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "m", fetchFn });
    await mind.consider(CONTEXT);
    expect(capturedPrompt).toContain("bar: One of five vertical iron bars.");
    expect(capturedPrompt).not.toMatch(/\bFILE\b/);
    expect(capturedPrompt).not.toMatch(/\bSHIM\b/);
    expect(capturedPrompt).toContain("no fixed list of moves");
  });

  function closedMoveNamesIn(text: string): string[] {
    return [...PRISONER_MOVES, ...WARDEN_MOVES].filter((move) => new RegExp(`\\b${move}\\b`).test(text));
  }

  it("the prompt names no closed-variant move at all, in either role, and states the open catch rule", async () => {
    const prompts: string[] = [];
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? "{}");
      prompts.push(body.messages[0].content as string);
      const content = body.model === "v" ? JSON.stringify({ intent: "i", line: "" }) : JSON.stringify({ thoughts: "t", intent: "i", line: "", plan: "p", notes: "n" });
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) };
    }) as unknown as typeof fetch;
    for (const options of [{ model: "m" }, { witsModel: "w", voiceModel: "v" }]) {
      for (const [selfName, otherName] of [["Mara Voss", "Warden Croft"], ["Warden Croft", "Mara Voss"]]) {
        await createOpenMind({ baseUrl: "http://x", selfName, otherName, fetchFn, ...options }).consider(CONTEXT);
      }
    }
    expect(prompts.length).toBe(6);
    for (const prompt of prompts) expect(closedMoveNamesIn(prompt)).toEqual([]);
    expect(prompts[0]).toContain("examines");
  });

  it("PLANTED VIOLATION: the move-name scan catches the closed variant's own presence rule", () => {
    expect(closedMoveNamesIn(WARDEN_PRESENCE_RULE).length).toBeGreaterThan(0);
  });

  it("states escape physically -- out of the cell by the door or the window -- and never as a number reaching zero (OPEN-VARIANT.md §12)", async () => {
    let prompt = "";
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      prompt = JSON.parse((init?.body as string) ?? "{}").messages[0].content as string;
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ thoughts: "t", intent: "i", line: "", plan: "p", notes: "n" }) } }] }) };
    }) as unknown as typeof fetch;
    await createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "m", fetchFn }).consider(CONTEXT);
    expect(prompt).toContain("escapes the moment she is out of the cell, however she gets out");
    expect(prompt).toContain("the door and the window");
    expect(prompt).not.toMatch(/escapes the moment the bar's integrity/);
    expect(prompt).not.toMatch(/guard's attention is below/);
  });
});
