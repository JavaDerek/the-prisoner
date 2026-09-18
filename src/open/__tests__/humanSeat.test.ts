import { describe, it, expect, vi } from "vitest";
import { createOpenMind, renderSeatSituation, type OpenPrincipalContext } from "../mind.js";
import { assertSeatIsPlayable, createHumanSeatMind, readSeatMode, readViewMode, type ViewMode } from "../humanSeat.js";
import { openConditions } from "../conditions.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: "Round 1 of 12.\nbar integrity: 100 (as of round 1)",
  perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
};

/** A scripted player: each question is answered by the next line, in order. */
function player(...lines: string[]): { ask: (prompt: string) => Promise<string | undefined>; asked: string[] } {
  const asked: string[] = [];
  let i = 0;
  return { asked, ask: async (prompt: string) => (asked.push(prompt), lines[i++]) };
}

function seat(lines: string[], options: { conditions?: ReturnType<typeof openConditions>; view?: ViewMode } = {}) {
  const written: string[] = [];
  const { ask, asked } = player(...lines);
  const mind = createHumanSeatMind({
    selfName: PRISONER_NAME,
    otherName: WARDEN_NAME,
    ask,
    write: (text) => written.push(text),
    ...(options.conditions ? { conditions: options.conditions } : {}),
    ...(options.view ? { view: options.view } : {}),
  });
  return { mind, written, asked };
}

// the-prisoner#11's terminal half: a person in one of the two chairs, through the same
// seam, ruled by the same referee, against the same model opponent.
describe("the human seat", () => {
  it("PRISONER_HUMAN: unset seats nobody, 'prisoner'/'warden' seat a person, anything else stops the run", () => {
    expect(readSeatMode(undefined)).toBe("off");
    expect(readSeatMode("")).toBe("off");
    expect(readSeatMode("prisoner")).toBe("prisoner");
    expect(readSeatMode("warden")).toBe("warden");
    expect(() => readSeatMode("me")).toThrow(/PRISONER_HUMAN/);
  });

  it("refuses to seat a person where nothing can be typed -- a pipe or a redirect, not a terminal", () => {
    // Learned from the first real run: with stdin not a terminal, `readline` closes
    // before the first question, every turn becomes "do nothing", and the game plays
    // itself out in silence looking like a game rather than a misconfiguration.
    expect(() => assertSeatIsPlayable("prisoner", { isTty: false })).toThrow(/terminal/i);
    expect(() => assertSeatIsPlayable("prisoner", { isTty: true })).not.toThrow();
    expect(() => assertSeatIsPlayable("off", { isTty: false })).not.toThrow();
  });

  it("shows the player the situation the model's OWN prompt opens with, byte for byte -- so the view cannot drift from the prompt", async () => {
    let modelPrompt = "";
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      modelPrompt = JSON.parse((init?.body as string) ?? "{}").messages[0].content as string;
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x" }) } }] }) };
    }) as unknown as typeof fetch;
    const conditions = openConditions();
    await createOpenMind({ baseUrl: "http://x", selfName: PRISONER_NAME, otherName: WARDEN_NAME, model: "m", fetchFn, conditions }).consider(CONTEXT);

    const view = renderSeatSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);
    expect(modelPrompt.startsWith(view)).toBe(true);
    // And what is the model's alone stays the model's: no answer format, no JSON.
    expect(view).not.toMatch(/JSON|candidates|REQUIRED/);
  });

  it("what the player types is the intent, trimmed, and they see their own briefing and their own objects", async () => {
    const { mind, written } = seat(["  I wedge the spoon's edge into the mortar under the bar.  ", ""]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I wedge the spoon's edge into the mortar under the bar." });
    const shown = written.join("\n");
    expect(shown).toContain("bar integrity: 100 (as of round 1)");
    expect(shown).toContain("One of five vertical iron bars.");
  });

  it("a line spoken aloud is asked for separately and carried as `line`; silence leaves the field off", async () => {
    const spoke = seat(["I test the bar.", "Long night, warden."]);
    expect(await spoke.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", line: "Long night, warden." });
    expect(spoke.asked.length).toBe(3);

    const quiet = seat(["I test the bar.", "   "]);
    expect(await quiet.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
  });

  it("an empty intent is a turn spent doing nothing -- a silent half-round, and no further questions", async () => {
    const { mind, asked } = seat([""]);
    expect(await mind.consider(CONTEXT)).toBeNull();
    expect(asked.length).toBe(1);
  });

  it("end of input (ctrl-D) ends the turn rather than hanging or inventing an intent", async () => {
    const { mind } = seat([]);
    expect(await mind.consider(CONTEXT)).toBeNull();
  });

  it("takes a plan when the player types one, and invents neither a plan nor a `replanned` they did not give (§22)", async () => {
    const { mind } = seat(["I test the bar.", "", "work the bar until it gives"]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", plan: "work the bar until it gives" });
  });

  it("gives the player the condition list when the game gives this chair one -- the same list the model would read (§34)", async () => {
    const { mind, written } = seat(["I look at the window.", ""], { conditions: openConditions() });
    await mind.consider(CONTEXT);
    const shown = written.join("\n");
    expect(shown).toContain("can open the window");
    expect(shown).toContain("(for you)");
  });
});

// the-prisoner#21: a human-fiction view of a turn, for the player only, that
// changes nothing about what the player knows.
describe("PRISONER_VIEW chooses how the seat is shown -- never what it is shown", () => {
  it("unset or 'raw' is today's view; 'prose' is the new one; anything else stops the run", () => {
    expect(readViewMode(undefined)).toBe("raw");
    expect(readViewMode("")).toBe("raw");
    expect(readViewMode("raw")).toBe("raw");
    expect(readViewMode("prose")).toBe("prose");
    expect(() => readViewMode("narrated")).toThrow(/PRISONER_VIEW/);
  });

  it("defaults to the raw view -- no `view` option changes nothing from before this issue", async () => {
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toContain("- bar: One of five vertical iron bars.");
  });

  it("view: 'prose' shows the fiction view instead of the raw labelled blocks", async () => {
    const { mind, written } = seat(["I test the bar.", ""], { view: "prose" });
    await mind.consider(CONTEXT);
    const shown = written.join("\n");
    expect(shown).not.toContain("- bar: One of five vertical iron bars.");
    expect(shown).toContain("One of five vertical iron bars.");
  });

  it("typing 'raw' at the intent prompt reprints the raw NPC view on demand and asks again, spending nothing", async () => {
    const { mind, written, asked } = seat(["raw", "I test the bar.", ""], { view: "prose" });
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(written.join("\n")).toContain("- bar: One of five vertical iron bars.");
    expect(asked.filter((p) => p.startsWith("What do you try this turn?")).length).toBe(2);
  });
});
