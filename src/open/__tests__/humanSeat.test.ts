import { describe, it, expect, vi } from "vitest";
import { createOpenMind, renderSeatSituation, type OpenPrincipalContext } from "../mind.js";
import { assertSeatIsPlayable, createHumanSeatMind, readSeatMode, readViewMode, type ViewMode } from "../humanSeat.js";
import type { Narrator } from "../narrator.js";
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

function seat(lines: string[], options: { conditions?: ReturnType<typeof openConditions>; view?: ViewMode; narrator?: Narrator } = {}) {
  const written: string[] = [];
  const { ask, asked } = player(...lines);
  const mind = createHumanSeatMind({
    selfName: PRISONER_NAME,
    otherName: WARDEN_NAME,
    ask,
    write: (text) => written.push(text),
    ...(options.conditions ? { conditions: options.conditions } : {}),
    ...(options.view ? { view: options.view } : {}),
    ...(options.narrator ? { narrator: options.narrator } : {}),
  });
  return { mind, written, asked };
}

/** A narrator stand-in: fixed script, and it never touches a network --
 *  exactly `mind-seam`'s own `scriptedMind` reasoning applied to `narrator.ts`'s
 *  `Narrator` interface, which is not itself a `Mind`. */
function scriptedNarrator(script: string | null): Narrator {
  return { narrate: async () => script };
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

  it("ONE question in the ordinary case: what the player types is the intent, and nothing else is asked", async () => {
    const { mind, asked } = seat(["I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(asked.length).toBe(1);
  });

  it("the prompt offers the affordances rather than demanding them: say, plan, raw", async () => {
    const { mind, asked } = seat(["I test the bar."]);
    await mind.consider(CONTEXT);
    expect(asked[0]).toContain('"say"');
    expect(asked[0]).toContain('"plan"');
    expect(asked[0]).toContain('"raw"');
  });

  it('"say <words>" carries them as `line` and asks again, so speaking costs no turn and no extra question', async () => {
    const spoke = seat(["say Long night, warden.", "I test the bar."]);
    expect(await spoke.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", line: "Long night, warden." });
    expect(spoke.asked.length).toBe(2);
  });

  it('a bare "say" asks what to say, then returns to the one question -- and blank keeps the field off', async () => {
    const spoke = seat(["say", "Long night, warden.", "I test the bar."]);
    expect(await spoke.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", line: "Long night, warden." });
    expect(spoke.asked[1]).toContain(WARDEN_NAME);

    const quiet = seat(["say", "   ", "I test the bar."]);
    expect(await quiet.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
  });

  it("silence is the default: a player who never types say gets no `line` field at all", async () => {
    const { mind } = seat(["I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
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

  it('takes a plan only when the player asks to set one ("plan <words>", or a bare "plan"), and invents neither a plan nor a `replanned` they did not give (§22)', async () => {
    const inline = seat(["plan work the bar until it gives", "I test the bar."]);
    expect(await inline.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", plan: "work the bar until it gives" });

    const prompted = seat(["plan", "work the bar until it gives", "I test the bar."]);
    expect(await prompted.mind.consider(CONTEXT)).toEqual({ intent: "I test the bar.", plan: "work the bar until it gives" });
  });

  it("both affordances in one turn, in either order, still spend no turn and reach the referee once", async () => {
    const { mind } = seat(["plan get her off her feet", "say Are you all right?", "drop to the ground and clutch my chest"]);
    expect(await mind.consider(CONTEXT)).toEqual({
      intent: "drop to the ground and clutch my chest",
      line: "Are you all right?",
      plan: "get her off her feet",
    });
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
  it("unset or 'raw' is today's view; 'prose' and 'narrated' (D3) are recognised; anything else stops the run", () => {
    expect(readViewMode(undefined)).toBe("raw");
    expect(readViewMode("")).toBe("raw");
    expect(readViewMode("raw")).toBe("raw");
    expect(readViewMode("prose")).toBe("prose");
    expect(readViewMode("narrated")).toBe("narrated");
    expect(() => readViewMode("fiction")).toThrow(/PRISONER_VIEW/);
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
    expect(asked.filter((p) => p.startsWith("What do you do?")).length).toBe(2);
  });
});

// D3 (2026-09-18), route 2 of the-prisoner#21: the narrator model, a switch
// beside "raw"/"prose", human seat only, no model prompt ever touched.
describe("PRISONER_VIEW=narrated -- the narrator model, shown only once verified (D3)", () => {
  it("shows the narrator's own prose once it is given a verified narration", async () => {
    const narrator = scriptedNarrator("A hush sits over the cell tonight.");
    const { mind, written } = seat(["I test the bar.", ""], { view: "narrated", narrator });
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toContain("A hush sits over the cell tonight.");
  });

  it("falls back to the prose view when the narrator returns null -- a failed verification or a silent model, never shown to the player as an error", async () => {
    const narrator = scriptedNarrator(null);
    const { mind, written } = seat(["I test the bar.", ""], { view: "narrated", narrator });
    await mind.consider(CONTEXT);
    const shown = written.join("\n");
    // The prose view's own rendering of the same data, not the raw labelled blocks.
    expect(shown).not.toContain("- bar: One of five vertical iron bars.");
    expect(shown).toContain("One of five vertical iron bars.");
  });

  it("typing 'raw' still reprints the raw NPC view on demand under 'narrated', exactly as under 'prose'", async () => {
    const narrator = scriptedNarrator("A hush sits over the cell tonight.");
    const { mind, written, asked } = seat(["raw", "I test the bar.", ""], { view: "narrated", narrator });
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(written.join("\n")).toContain("- bar: One of five vertical iron bars.");
    expect(asked.filter((p) => p.startsWith("What do you do?")).length).toBe(2);
  });

  it("'narrated' with no narrator configured is a configuration error, caught at construction, never guessed past", () => {
    expect(() => seat(["I test the bar.", ""], { view: "narrated" })).toThrow(/narrator/i);
  });
});

// 2026-09-18, from the first real `PRISONER_VIEW=narrated` game: "I can
// barely even read this." The seat re-printed the identical world every
// round -- conditions, objects, identity, rules -- and the two or three
// sentences that were new sat in the middle of it. `deltaView.ts` holds back
// a standing block the player has ALREADY been shown with that exact text.
describe("the prose view holds back the standing world once the player has read it (deltaView.ts)", () => {
  const laterContext: OpenPrincipalContext = {
    ...CONTEXT,
    briefing: "Round 2 of 12.\nbar integrity: 100 (as of round 1)\nYour last attempt worked on the bar.",
  };

  it("shows the whole world on the first turn, and holds the unmoved parts back on the second", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view: "prose" });

    await mind.consider(CONTEXT);
    const first = written.join("\n");
    expect(first).toContain("You are Mara Voss.");
    expect(first).toContain("One of five vertical iron bars.");

    written.length = 0;
    await mind.consider(laterContext);
    const second = written.join("\n");
    // The turn's own state, every turn: the clock, the news, the belief and
    // its stamp -- the fog this seat exists to put a person inside.
    expect(second).toContain("This is round 2 of 12.");
    expect(second).toContain("Your last attempt worked on the bar.");
    expect(second).toContain("as of round 1");
    // The standing world, read once.
    expect(second).not.toContain("You are Mara Voss.");
    expect(second).not.toContain("One of five vertical iron bars.");
    expect(second).toContain("held back");
  });

  it("shows an object again the moment its description moves", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view: "prose" });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider({ ...laterContext, perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars, bright where it has been scraped." }] });
    expect(written.join("\n")).toContain("bright where it has been scraped");
  });

  // The rule this whole module lives under (OPEN-VARIANT.md §47, CLAUDE.md's
  // "how, never what"): the raw view is the model's own prompt opening, byte
  // for byte, and nothing here may touch it -- neither as the default view
  // nor as the on-demand escape hatch a player types "raw" for.
  it("never holds anything back from the raw view, on any turn", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t) });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider(laterContext);
    expect(written.join("\n")).toContain(renderSeatSituation(PRISONER_NAME, WARDEN_NAME, laterContext));
    expect(written.join("\n")).not.toContain("held back");
  });

  it('typing "raw" reprints everything in full, however much the prose view has held back', async () => {
    const written: string[] = [];
    const { ask } = player("wait", "raw", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view: "prose" });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider(laterContext);
    expect(written.join("\n")).toContain(renderSeatSituation(PRISONER_NAME, WARDEN_NAME, laterContext));
    expect(written.join("\n")).toContain("One of five vertical iron bars.");
  });
});

// OPEN-VARIANT.md §60: a narration may leave objects and conditions out of the
// scene, which is what freed it to be prose. The conditions are the rules of
// the game, so the seat shows them by code instead -- once, through the same
// delta -- rather than leaving the rulebook to a narrator's discretion.
describe("narrated: the narrator gets the room, the rulebook is shown by code (§60)", () => {
  const CONDITIONS = openConditions();
  const SCENE = "The cell is quiet. Round 1 of 12, and the bar's integrity was 100 when you last looked, back in round 1.";

  it("shows the conditions in full alongside the first narration, however little the narration says", async () => {
    const { mind, written } = seat(["wait", "", ""], { view: "narrated", narrator: scriptedNarrator(SCENE), conditions: CONDITIONS });
    await mind.consider(CONTEXT);
    const shown = written.join("\n");
    expect(shown).toContain(SCENE);
    expect(shown).toContain("condition 1, for you.");
  });

  it("holds the conditions back on a later turn, leaving the narration to carry the round on its own", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait");
    const mind = createHumanSeatMind({
      selfName: PRISONER_NAME,
      otherName: WARDEN_NAME,
      ask,
      write: (t) => written.push(t),
      view: "narrated",
      narrator: scriptedNarrator(SCENE),
      conditions: CONDITIONS,
    });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider({ ...CONTEXT, briefing: "Round 2 of 12.\nbar integrity: 100 (as of round 1)" });
    const second = written.join("\n");
    expect(second).toContain(SCENE);
    expect(second).not.toContain("condition 1, for you.");
  });

  it("falls back to the full prose view when a narration is rejected, with nothing about the conditions lost", async () => {
    const { mind, written } = seat(["wait", "", ""], { view: "narrated", narrator: scriptedNarrator(null), conditions: CONDITIONS });
    await mind.consider(CONTEXT);
    const shown = written.join("\n");
    expect(shown).toContain("condition 1, for you.");
    expect(shown).toContain("One of five vertical iron bars.");
  });
});

// §61: the narration replaces the SCENE and nothing else. Every number the
// player plays against is rendered by code above it, which is what let the
// verifier stop discarding prose for failing to recite the clock.
describe("narrated: code renders state, the model renders the room (§61)", () => {
  const SCENE = "The cell is quiet. Iron bars cross the window, and one of them is rusted through at the foot.";

  it("shows the clock, the news and every belief with its stamp by code, whatever the narration says", async () => {
    const { mind, written } = seat(["wait", "", ""], { view: "narrated", narrator: scriptedNarrator(SCENE) });
    // A belief line as `briefing.ts` actually renders one, trailing period and
    // all -- CONTEXT's own is a shorthand older tests share, which
    // `parseBriefing` keeps verbatim as news rather than reading as a belief.
    await mind.consider({ ...CONTEXT, briefing: "Round 1 of 12.\nbar integrity: 100 (as of round 1)." });
    const shown = written.join("\n");
    expect(shown).toContain(SCENE);
    expect(shown).toContain("This is round 1 of 12.");
    expect(shown).toContain("Your last word on the bar integrity was 100, as of round 1.");
  });

  it("leaves the object catalogue to the narration -- the one block a model is better at", async () => {
    const { mind, written } = seat(["wait", "", ""], { view: "narrated", narrator: scriptedNarrator(SCENE) });
    await mind.consider(CONTEXT);
    expect(written.join("\n")).not.toContain("The bar: One of five vertical iron bars.");
  });

  it('"raw" still reaches the full catalogue the narration chose not to list', async () => {
    const { mind, written } = seat(["raw", "wait", "", ""], { view: "narrated", narrator: scriptedNarrator(SCENE) });
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toContain("One of five vertical iron bars.");
  });
});
