import { describe, it, expect, vi } from "vitest";
import { createOpenMind, renderSeatSituation, ONE_ACT_RULE, type OpenPrincipalContext } from "../mind.js";
import { assertSeatIsPlayable, createHumanSeatMind, readSeatMode, readViewMode, wrapText, wrapWidth, PLAY_BLOCK_POLICY, SEAT_COMMANDS, type ViewMode } from "../humanSeat.js";
import { proseBlocks, RULES_PARAGRAPH_LEAD } from "../proseView.js";
import { CONDITION_LIST_OPENING } from "../conditionList.js";
import type { Narrator } from "../narrator.js";
import { openConditions } from "../conditions.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import type { RefereeRuling } from "../referee.js";

const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: "Round 1 of 12.\nbar integrity: 100 (as of round 1)",
  perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
};

/** §1.1 wraps every view's `write` path, so a long phrase this suite checks
 *  for verbatim can land split across two written lines at whatever column
 *  the wrap happened to fall on. `dewrap` undoes exactly that and nothing
 *  else: a single `\n` (the kind wrapping inserts in place of a space) goes
 *  back to a space, while a real paragraph break (`\n\n`, never touched by
 *  wrapping) is left alone -- so a test can still assert on a whole
 *  sentence without pinning it to one particular terminal width. */
function dewrap(text: string): string {
  return text.replace(/([^\n])\n(?!\n)/g, "$1 ");
}

/** A scripted player: each question is answered by the next line, in order. */
function player(...lines: string[]): { ask: (prompt: string) => Promise<string | undefined>; asked: string[] } {
  const asked: string[] = [];
  let i = 0;
  return { asked, ask: async (prompt: string) => (asked.push(prompt), lines[i++]) };
}

function seat(
  lines: string[],
  options: { conditions?: ReturnType<typeof openConditions>; view?: ViewMode; narrator?: Narrator; selfName?: string; otherName?: string } = {}
) {
  const written: string[] = [];
  const { ask, asked } = player(...lines);
  const mind = createHumanSeatMind({
    selfName: options.selfName ?? PRISONER_NAME,
    otherName: options.otherName ?? WARDEN_NAME,
    ask,
    write: (text) => written.push(text),
    ...(options.conditions ? { conditions: options.conditions } : {}),
    ...(options.view ? { view: options.view } : {}),
    ...(options.narrator ? { narrator: options.narrator } : {}),
  });
  return { mind, written, asked };
}

/** D3 (HUMAN-INTENTS-DESIGN.md §3.1, the-prisoner#27): a minimal ruling for
 *  `reconsider`, which reads only `effectKind` -- every other field is
 *  filler this test never inspects. */
function ruling(effectKind: RefereeRuling["effectKind"]): RefereeRuling {
  return {
    targetObjectId: "none",
    effectKind,
    property: "none",
    magnitude: "moderate",
    perceptibility: "silent",
    product: "none",
    applicable: false,
    citations: {
      target: { citation: null, requiredSourceId: null, verified: false },
      effect: { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true },
      property: { citation: null, requiredSourceId: null, verified: false },
      product: { citation: null, requiredSourceId: null, verified: false },
    },
    raw: { answers: [{ questionId: "target", answerKey: "none", fromSafeDefault: true, answeredByRung: null, citation: null, rejected: [] }], unmatched: [] },
    request: { questions: [], sources: [] },
  };
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

// OPEN-VARIANT.md §74.1: the player is told the one-act rule exactly as the model is.
describe("the seat states the one-act rule (OPEN-VARIANT.md §74.1)", () => {
  it("writes the model's own one-act sentence before asking, in every view", async () => {
    for (const view of ["raw", "prose"] as const) {
      const written: string[] = [];
      const { ask } = player("wait");
      await createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view }).consider(CONTEXT);
      expect(dewrap(written.join("\n"))).toContain(ONE_ACT_RULE);
    }
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
    const second = dewrap(written.join("\n"));
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

  // The owner's blind game (`checkpoints/2026-09-21-human-blind/`): the door
  // stood open rounds 7-10 and the screen showed it once. A way out -- an
  // object that declares `passage` -- stays on screen while it differs from
  // how the player first saw it.
  it("keeps a way out on screen every round it stands changed, and holds an ordinary object back once told", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view: "prose" });
    const shut = { id: "door", description: "A heavy door of iron-bound planks." };
    const open = { id: "door", description: "A heavy door of iron-bound planks. It stands open now." };
    const bar = { id: "bar", description: "One of five vertical iron bars." };
    await mind.consider({ ...CONTEXT, perceivedObjects: [bar, shut] });
    await mind.consider({ ...laterContext, perceivedObjects: [bar, open] });
    written.length = 0;
    await mind.consider({ ...laterContext, perceivedObjects: [bar, open] });
    const third = dewrap(written.join("\n"));
    expect(third).toContain("It stands open now.");
    expect(third).not.toContain("One of five vertical iron bars.");
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
    // Wrapped, not the bare `renderSeatSituation` string: §1.1 wraps every
    // view's `write` path, so the raw view's CONTENT stays byte-identical to
    // the model's own prompt while its LINE BREAKS do not -- the guard this
    // test exists for (never holding anything back) is unaffected either way.
    expect(written.join("\n")).toContain(wrapText(renderSeatSituation(PRISONER_NAME, WARDEN_NAME, laterContext), wrapWidth(process.stdout.columns)));
    expect(written.join("\n")).not.toContain("held back");
  });

  it('typing "raw" reprints everything in full, however much the prose view has held back', async () => {
    const written: string[] = [];
    const { ask } = player("wait", "raw", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t), view: "prose" });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider(laterContext);
    expect(written.join("\n")).toContain(wrapText(renderSeatSituation(PRISONER_NAME, WARDEN_NAME, laterContext), wrapWidth(process.stdout.columns)));
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
    const shown = dewrap(written.join("\n"));
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
    const second = dewrap(written.join("\n"));
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
    const shown = dewrap(written.join("\n"));
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

// docs/SEAT-UI-AND-CAPTURE-SWEEP.md §1.1, verbatim from the owner's own
// screenshot at 189 columns: "the words don't wrap properly" -- the terminal
// hard-wrapped mid-word ("cra/cked", "V/oss"). Wrapping now happens on word
// boundaries, in the seat's own write path, so every view gets it for free.
describe("word wrapping (§1.1): on word boundaries, capped at 100, never inside a word", () => {
  it("the width is the terminal's own columns, capped at 100, and 80 with no terminal at all", () => {
    expect(wrapWidth(undefined)).toBe(80);
    expect(wrapWidth(60)).toBe(60);
    expect(wrapWidth(189)).toBe(100);
  });

  it("wraps a long line on word boundaries -- every line fits, and every word survives whole and in order", () => {
    const long = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
    const wrapped = wrapText(long, 20);
    for (const line of wrapped.split("\n")) expect(line.length).toBeLessThanOrEqual(20);
    // Un-wrapping (spaces for the breaks we inserted) recovers the original
    // words in the original order -- nothing was dropped, added, or reordered.
    expect(wrapped.replace(/\n/g, " ")).toBe(long);
  });

  it("a word longer than the width goes on its own line, unbroken -- never hyphenated or split", () => {
    const hugeWord = "a".repeat(150);
    const lines = wrapText(`before ${hugeWord} after`, 20).split("\n");
    expect(lines).toContain(hugeWord);
  });

  it("preserves blank lines and existing line breaks -- it only ever ADDS a break, never moves one", () => {
    const text = "first paragraph, short.\n\nsecond paragraph, also short.";
    expect(wrapText(text, 80)).toBe(text);
  });

  it("the seat wraps everything it writes, in every view -- no written line ever exceeds the capped width", async () => {
    const { mind, written } = seat(["I test the bar.", ""], { conditions: openConditions() });
    await mind.consider(CONTEXT);
    for (const chunk of written) for (const line of chunk.split("\n")) expect(line.length).toBeLessThanOrEqual(100);
  });
});

// docs/SEAT-UI-AND-CAPTURE-SWEEP.md §1.2: Infocom's own -- a stable status
// line, drawn once per turn, immediately above the prompt. CRITICAL: it may
// carry ONLY what THIS principal knows -- warden suspicion is fog the
// prisoner is never shown, and this line is built from her own context
// alone, never from world state she has no reading of.
describe("the status line (§1.2): a stable band, built only from this principal's own context", () => {
  it("shows the round (from her own briefing), the cell, what she holds, and whether the other principal is here", async () => {
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(CONTEXT);
    expect(dewrap(written.join("\n"))).toContain("Round 1 of 12 | the cell | holding: nothing | Warden Croft is here");
  });

  // docs/CUSTODY-DESIGN.md: custody moves who holds a thing, so the line reads
  // the context's own `holding` -- the engine's owner at t, filled in by
  // `buildOpenContext` -- and no longer the authored starting map (OWNER_OF).
  it("names what she holds, from the context's own holding -- the engine's owner at t, not a second guess at it", async () => {
    const withSpoon: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: [...CONTEXT.perceivedObjects, { id: "spoon", description: "A bent institutional spoon." }], holding: ["spoon"] };
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(withSpoon);
    expect(dewrap(written.join("\n"))).toContain("holding: spoon");
  });

  it("PLANTED VIOLATION: a thing she perceives but no longer holds -- the spoon, taken from her -- is not listed, whatever the starting map says", async () => {
    const spoonTaken: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: [...CONTEXT.perceivedObjects, { id: "spoon", description: "A bent institutional spoon." }], holding: [] };
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(spoonTaken);
    expect(dewrap(written.join("\n"))).toContain("holding: nothing");
  });

  it("names the WARDEN's own held object when she is the one seated -- never the prisoner's", async () => {
    const wardenSees: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: [...CONTEXT.perceivedObjects, { id: "key_ring", description: "A heavy iron ring of keys." }], holding: ["key_ring"] };
    const { mind, written } = seat(["I watch the door.", ""], { selfName: WARDEN_NAME, otherName: PRISONER_NAME });
    await mind.consider(wardenSees);
    expect(dewrap(written.join("\n"))).toContain("holding: key_ring");
  });

  it("never leaks warden suspicion, even if it were somehow present in this principal's own briefing text", async () => {
    // The raw view legitimately says "suspicion" already -- the STATE-BASED
    // RULES every principal is told name the mechanic generically ("warden
    // suspicion rises..."), and that is not fog. What must never appear is
    // the STATUS LINE carrying the live number, so this plants the
    // violation directly (the prisoner's own context never carries this
    // line in practice -- `buildOpenBriefing` only renders it for the
    // warden) and checks the one line this feature adds, not the whole raw
    // dump the model already reads unchanged.
    const leaky: OpenPrincipalContext = { ...CONTEXT, briefing: `${CONTEXT.briefing}\nwarden suspicion: 40.` };
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(leaky);
    const statusLines = dewrap(written.join("\n"))
      .split("\n")
      .filter((line) => line.includes(" | holding: "));
    expect(statusLines.length).toBeGreaterThan(0);
    for (const line of statusLines) expect(line).not.toMatch(/suspicion/i);
  });

  it("reads the other principal's presence back from the SAME sentence her own briefing already states, never inferring it", async () => {
    const apart: OpenPrincipalContext = { ...CONTEXT, briefing: `${CONTEXT.briefing}\nWarden Croft is not here right now.` };
    const { mind, written } = seat(["I test the bar.", ""]);
    await mind.consider(apart);
    expect(dewrap(written.join("\n"))).toContain("Warden Croft is not here");
  });

  it("draws the status line as the very last thing before the prompt -- nothing else follows it (§1.3)", async () => {
    const trace: string[] = [];
    const { ask } = player("wait");
    const mind = createHumanSeatMind({
      selfName: PRISONER_NAME,
      otherName: WARDEN_NAME,
      write: (t) => trace.push(`WRITE:${t}`),
      ask: async (p) => (trace.push(`ASK:${p}`), await ask(p)),
    });
    await mind.consider(CONTEXT);
    const firstAsk = trace.findIndex((entry) => entry.startsWith("ASK:"));
    const writesBeforeIt = trace.slice(0, firstAsk).filter((entry) => entry.startsWith("WRITE:"));
    expect(writesBeforeIt.at(-1)).toContain(" | holding: ");
  });

  // A real status bar does not disappear the moment a no-turn command is
  // used. The owner's own smoke test: `holding` then `desc <id>` each print
  // their answer and re-ask "What do you do?" -- and the status line used to
  // be drawn only once, before the FIRST ask, so it scrolled away and every
  // later prompt in that same turn sat there with no band above it.
  it("redraws the status line immediately before EVERY prompt in the turn, not just the first (§1.2, re-draw)", async () => {
    const trace: string[] = [];
    const withSpoon: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: [...CONTEXT.perceivedObjects, { id: "spoon", description: "A bent institutional spoon." }], holding: ["spoon"] };
    const { ask } = player("holding", "desc bar", "I test the bar.");
    const mind = createHumanSeatMind({
      selfName: PRISONER_NAME,
      otherName: WARDEN_NAME,
      write: (t) => trace.push(`WRITE:${t}`),
      ask: async (p) => (trace.push(`ASK:${p}`), await ask(p)),
    });
    expect(await mind.consider(withSpoon)).toEqual({ intent: "I test the bar." });

    // Every ASK in the trace has the status line as the WRITE immediately
    // before it -- not merely present somewhere earlier in the turn.
    const askIndices = trace.reduce<number[]>((acc, entry, i) => (entry.startsWith("ASK:") ? [...acc, i] : acc), []);
    expect(askIndices.length).toBe(3); // "What do you do?" asked three times: holding, desc, then the real intent.
    for (const i of askIndices) expect(trace[i - 1]).toContain(" | holding: ");
  });
});

// docs/SEAT-UI-AND-CAPTURE-SWEEP.md §1.3: "the input area moves" -- the raw
// view reprints all thirteen objects every turn by design, so the owner was
// never told the delta view (`PRISONER_VIEW=prose`) exists and holds the
// standing world back after the first read. Told once, in the opening
// banner, never repeated -- and never told at all once she is already on a
// view that already does it.
describe("the opening banner (§1.3): PRISONER_VIEW=prose, mentioned once, on the first turn only", () => {
  it("tells the player about PRISONER_VIEW=prose on the very first turn, under the default raw view", async () => {
    const { mind, written } = seat(["wait", ""]);
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toMatch(/PRISONER_VIEW=prose/);
  });

  it("never repeats the banner on a later turn", async () => {
    const written: string[] = [];
    const { ask } = player("wait", "wait");
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t) });
    await mind.consider(CONTEXT);
    written.length = 0;
    await mind.consider(CONTEXT);
    expect(written.join("\n")).not.toMatch(/PRISONER_VIEW=prose/);
  });

  it("says nothing about it once the player is already on the prose or narrated view -- she does not need telling twice", async () => {
    const prose = seat(["wait", ""], { view: "prose" });
    await prose.mind.consider(CONTEXT);
    expect(prose.written.join("\n")).not.toMatch(/PRISONER_VIEW=prose/);

    const narrated = seat(["wait", ""], { view: "narrated", narrator: scriptedNarrator("A hush sits over the cell.") });
    await narrated.mind.consider(CONTEXT);
    expect(narrated.written.join("\n")).not.toMatch(/PRISONER_VIEW=prose/);
  });
});

// docs/SEAT-UI-AND-CAPTURE-SWEEP.md §1.4 (D4): round 3 of the owner's own
// game was spent on "what am I holding now?", which reached the referee as
// an intent and was refused. A small fixed set of no-turn info commands, on
// the EXACT pattern `raw`/`say`/`plan` already set: literal tokens this
// repository defined, compared literally, answered by the seat from what it
// already has, never forwarded to the referee.
describe("no-turn info commands (§1.4): holding, look, conditions, help", () => {
  it('"holding" answers from the same declared ownership the status line uses, costs no turn, and is never forwarded', async () => {
    const withSpoon: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: [...CONTEXT.perceivedObjects, { id: "spoon", description: "A bent institutional spoon." }], holding: ["spoon"] };
    const { mind, written, asked } = seat(["holding", "I test the bar."]);
    expect(await mind.consider(withSpoon)).toEqual({ intent: "I test the bar." });
    expect(written.join("\n")).toContain("spoon: A bent institutional spoon.");
    expect(asked.length).toBe(2);
  });

  it('"holding" says so plainly when she is holding nothing', async () => {
    const { mind, written } = seat(["holding", "I test the bar."]);
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toMatch(/not holding anything/i);
  });

  // "look" was rejected as the command token itself: `reveal` (one of the
  // referee's own ten effect kinds) is a real, ruled, turn-costing action,
  // and "look" is its most natural English verb -- recorded real-game
  // intents include "Look closely at the bar to assess its current state."
  // An interceptor keyed on the bare word "look" would silently swallow
  // that into a free re-read of the description instead of a ruling. `desc`
  // cannot collide with an action verb, which is the whole point of it.
  it('an intent beginning with "look" reaches the referee UNTOUCHED -- examining is a real, ruled action ("reveal"), and must never be swallowed by a meta command', async () => {
    const { mind } = seat(["look closely at the bar", "look under the loose_tile"]);
    await expect(mind.consider(CONTEXT)).resolves.toEqual({ intent: "look closely at the bar" });
  });

  it('"desc <id>" answers that object\'s own description -- the SAME text the referee itself is handed -- costs no turn, and is never forwarded', async () => {
    const { mind, written, asked } = seat(["desc bar", "I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(written.join("\n")).toContain("bar: One of five vertical iron bars.");
    expect(asked.length).toBe(2);
  });

  it('"desc" matches the id case-insensitively -- a literal membership test against the perceived list, never English understanding', async () => {
    const { mind, written } = seat(["desc BAR", "I test the bar."]);
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toContain("One of five vertical iron bars.");
  });

  it('"desc" with an id that is not exactly one she perceives is refused by the seat, naming what IS here -- never forwarded as an intent (it is unambiguously meta either way)', async () => {
    const { mind, written } = seat(["desc unicorn", "I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    const shown = written.join("\n");
    expect(shown).toMatch(/nothing here is called that/i);
    expect(shown).toContain("bar");
  });

  it('a bare "desc" with no argument lists the ids she perceives, spending nothing', async () => {
    const { mind, written } = seat(["desc", "I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(written.join("\n")).toContain("bar");
  });

  it('"conditions" reprints the SAME condition list this chair was given (§34), costs no turn', async () => {
    const { mind, written, asked } = seat(["conditions", "I test the bar."], { conditions: openConditions() });
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(dewrap(written.join("\n"))).toContain("can open the window");
    expect(asked.length).toBe(2);
  });

  it('"conditions" says plainly when this chair was given none', async () => {
    const { mind, written } = seat(["conditions", "I test the bar."]);
    await mind.consider(CONTEXT);
    expect(written.join("\n")).toMatch(/no condition list/i);
  });

  it('"help" lists the command set, costs no turn, and is never forwarded', async () => {
    const { mind, written, asked } = seat(["help", "I test the bar."]);
    expect(await mind.consider(CONTEXT)).toEqual({ intent: "I test the bar." });
    const shown = written.join("\n");
    for (const token of ["say", "plan", "raw", "holding", "desc", "conditions", "help"]) expect(shown).toContain(token);
    expect(asked.length).toBe(2);
  });

  it("the prompt's own hint mentions the commands without becoming a wall of text", async () => {
    const { mind, asked } = seat(["I test the bar."]);
    await mind.consider(CONTEXT);
    expect(asked[0]).toMatch(/help/);
    expect(asked[0].length).toBeLessThan(200);
  });
});

/**
 * `PRISONER_VIEW=play`: the same data as `prose`, laid out for a PERSON.
 *
 * The owner played a real game under `prose` (2026-09-25) and the first turn
 * was ~70 lines in which the one thing that had happened -- the warden
 * examining the bar and speaking -- sat fourth of eight blocks, under the
 * full condition list (including the warden's own four win conditions,
 * stated in thresholds), the whole object catalogue, and the mechanics
 * paragraph. `prose` is behaving exactly as the-prisoner#21 specifies: a
 * re-presentation that drops nothing. This view keeps that promise by a
 * different route -- NOTHING is removed from the player's reach, it is moved
 * one keystroke away -- and is therefore a fourth view rather than a change
 * to `prose`, whose completeness test still pins the old behaviour.
 */
describe("the play view", () => {
  const PLAY_CONTEXT: OpenPrincipalContext = {
    principalId: "p1",
    identity: "You are Mara Voss, three years into a sentence.",
    motive: "Get out of this cell.",
    briefing: "Round 1 of 12.\nbar integrity: 100 (as of round 0).\nWarden Croft examines the bar closely.",
    perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
  };
  const LATER_CONTEXT: OpenPrincipalContext = { ...PLAY_CONTEXT, briefing: "Round 2 of 12.\nbar integrity: 90 (as of round 2).\nCroft steps out into the corridor." };

  it("PRISONER_VIEW=play is a fourth view, and anything else still stops the run", () => {
    expect(readViewMode("play")).toBe("play");
    expect(() => readViewMode("playing")).toThrow(/PRISONER_VIEW/);
  });

  it("puts the turn's news ABOVE the standing scene -- the inversion that made prose unreadable", async () => {
    const { mind, written } = seat(["I test the bar."], { view: "play", conditions: openConditions() });
    await mind.consider(PLAY_CONTEXT);
    const shown = dewrap(written.join("\n"));
    expect(shown).toContain("This is round 1 of 12.");
    expect(shown.indexOf("This is round 1 of 12.")).toBeLessThan(shown.indexOf("In the cell around you:"));
  });

  it("never prints the condition list or the mechanics paragraph on a turn", async () => {
    const { mind, written } = seat(["I test the bar."], { view: "play", conditions: openConditions() });
    await mind.consider(PLAY_CONTEXT);
    const shown = dewrap(written.join("\n"));
    expect(shown).not.toContain(CONDITION_LIST_OPENING);
    expect(shown).not.toContain(RULES_PARAGRAPH_LEAD);
  });

  it('"rules" prints the mechanics paragraph on demand, and costs no turn', async () => {
    const { mind, written, asked } = seat(["rules", "I test the bar."], { view: "play", conditions: openConditions() });
    expect(await mind.consider(PLAY_CONTEXT)).toEqual({ intent: "I test the bar." });
    expect(dewrap(written.join("\n"))).toContain(RULES_PARAGRAPH_LEAD);
    expect(asked.length).toBe(2);
  });

  it('"me" prints who you are and what you want, and costs no turn', async () => {
    const { mind, written, asked } = seat(["me", "I test the bar."], { view: "play", conditions: openConditions() });
    expect(await mind.consider(PLAY_CONTEXT)).toEqual({ intent: "I test the bar." });
    const shown = dewrap(written.join("\n"));
    expect(shown).toContain("You are Mara Voss, three years into a sentence.");
    expect(shown).toContain("Get out of this cell.");
    expect(asked.length).toBe(2);
  });

  it("classifies EVERY block the prose view can compose: shown, or behind a command that exists", () => {
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, PLAY_CONTEXT, openConditions());
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) expect(PLAY_BLOCK_POLICY[block.kind]).toBeDefined();
    for (const target of Object.values(PLAY_BLOCK_POLICY)) {
      if (target !== "shown") expect(SEAT_COMMANDS).toContain(target);
    }
  });

  it("says how the game works ONCE, not every turn", async () => {
    const { mind, written } = seat(["I test the bar.", "I test it again."], { view: "play", conditions: openConditions() });
    await mind.consider(PLAY_CONTEXT);
    const firstTurn = dewrap(written.join("\n"));
    written.length = 0;
    await mind.consider(LATER_CONTEXT);
    const secondTurn = dewrap(written.join("\n"));
    expect(firstTurn).toContain("there is no fixed list of moves");
    expect(secondTurn).not.toContain("there is no fixed list of moves");
    expect(secondTurn).toContain("This is round 2 of 12.");
  });

  it("leaves `prose` untouched: it still carries the conditions and the rules, as #21 requires", async () => {
    const { mind, written } = seat(["I test the bar."], { view: "prose", conditions: openConditions() });
    await mind.consider(PLAY_CONTEXT);
    const shown = dewrap(written.join("\n"));
    expect(shown).toContain(CONDITION_LIST_OPENING);
    expect(shown).toContain(RULES_PARAGRAPH_LEAD);
  });
});

// D4 (docs/HUMAN-INTENTS-DESIGN.md §3.2, the-prisoner#29): `checkpoint.ts`'s
// own "(X has taken a turn.)" line goes through the seat's own `notify`, not
// a bare `console.log`, so a write that arrives while a question is open --
// a bug under the serial loop (§3.2, red team point 11.4), never a case this
// seat designs for -- is written and counted instead of corrupting whatever
// is on screen. The readline pause/resume itself (checkpoint.ts's own `ask`)
// needs a real terminal and is verified separately, by hand, through a pty.
describe("the human seat's write ownership (D4, docs/HUMAN-INTENTS-DESIGN.md §3.2)", () => {
  it("starts at zero mid-question writes, and a write between turns (no question open) is not counted", () => {
    const written: string[] = [];
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask: async () => undefined, write: (t) => written.push(t) });
    expect(mind.midQuestionWrites()).toBe(0);
    mind.notify("(Warden Croft has taken a turn.)");
    expect(written).toContain("(Warden Croft has taken a turn.)");
    expect(mind.midQuestionWrites()).toBe(0);
  });

  it("a write that arrives WHILE a question is open is written through the same `write` AND counted, never dropped", async () => {
    const written: string[] = [];
    let resolveAsk: ((v: string | undefined) => void) | undefined;
    const ask = () => new Promise<string | undefined>((resolve) => { resolveAsk = resolve; });
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t) });

    // `consider` runs synchronously up to its own `await ask(...)`, so by the
    // time this call returns a pending promise, the question is already open.
    const pending = mind.consider(CONTEXT);
    expect(mind.midQuestionWrites()).toBe(0);

    mind.notify("(Warden Croft has taken a turn.)");
    expect(mind.midQuestionWrites()).toBe(1);
    expect(written.some((line) => line.includes("Warden Croft has taken a turn"))).toBe(true);

    resolveAsk?.(undefined); // let the turn finish -- Enter, do nothing
    await pending;
    expect(mind.midQuestionWrites()).toBe(1); // the turn finishing does not itself count as a write

    // Between turns again: the question closed when `ask` resolved, so a
    // second notification here is not mid-question.
    mind.notify("(Warden Croft has taken another turn.)");
    expect(mind.midQuestionWrites()).toBe(1);
  });

  it("the SECOND question in a turn (the say/plan follow-up) is tracked as open too, not just the first", async () => {
    const written: string[] = [];
    const resolvers: ((v: string | undefined) => void)[] = [];
    const ask = () => new Promise<string | undefined>((resolve) => resolvers.push(resolve));
    const mind = createHumanSeatMind({ selfName: PRISONER_NAME, otherName: WARDEN_NAME, ask, write: (t) => written.push(t) });
    const pending = mind.consider(CONTEXT);
    expect(mind.midQuestionWrites()).toBe(0);

    resolvers[0]?.("say"); // bare "say" at the main prompt -- costs no turn, asks a second question
    while (resolvers.length < 2) await Promise.resolve(); // flush microtasks until the second `ask` fires

    mind.notify("(Warden Croft has taken a turn.)");
    expect(mind.midQuestionWrites()).toBe(1);

    resolvers[1]?.("hello"); // answers the "say" prompt -- the loop then asks a THIRD time for the actual intent
    while (resolvers.length < 3) await Promise.resolve();
    resolvers[2]?.(undefined); // Enter -- do nothing this turn

    const proposal = await pending;
    expect(proposal).toBeNull();
    expect(mind.midQuestionWrites()).toBe(1); // still exactly the one write from mid-question two
  });
});

describe("D3: reconsider (HUMAN-INTENTS-DESIGN.md §3.1, §11.5, the-prisoner#27)", () => {
  it("asks once, phrased from the ruling's own effect kind, and returns the retype VERBATIM", async () => {
    const { mind, asked, written } = seat(["hide myself under the blanket"]);
    expect(typeof mind.reconsider).toBe("function");
    const retype = await mind.reconsider?.(ruling("conceal"));
    expect(retype).toBe("hide myself under the blanket");
    expect(asked).toHaveLength(1);
    const question = dewrap(asked[0]);
    expect(question).toContain("That was read as hiding something, but not what.");
    expect(question).toContain("Say it another way, or press Enter to let it stand.");
    // The seat composes nothing on the player's behalf (this file's own
    // header, rule 2): the retype reaches the caller exactly as typed, with
    // no rewording, no quoting, nothing added.
    expect(written.join("\n")).not.toContain("hide myself under the blanket");
  });

  it("Enter (or any blank answer) lets the first ruling stand: returns undefined, never invents a retype", async () => {
    const { mind } = seat([""]);
    const retype = await mind.reconsider?.(ruling("open"));
    expect(retype).toBeUndefined();
  });

  it("the question names the effect actually ruled, not a fixed word -- 'wear' asks differently from 'open'", async () => {
    const wear = seat(["scrape at it again"]);
    await wear.mind.reconsider?.(ruling("wear"));
    expect(dewrap(wear.asked[0])).toContain("wearing something down");

    const open = seat(["pry at it again"]);
    await open.mind.reconsider?.(ruling("open"));
    expect(dewrap(open.asked[0])).toContain("opening something");
  });

  it("is never present on a model mind -- only the human seat implements it", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "x" }) } }] }),
    })) as unknown as typeof fetch;
    const model = createOpenMind({ baseUrl: "http://x", selfName: PRISONER_NAME, otherName: WARDEN_NAME, model: "m", fetchFn });
    expect((model as { reconsider?: unknown }).reconsider).toBeUndefined();
  });
});
