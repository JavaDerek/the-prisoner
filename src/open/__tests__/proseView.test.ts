import { describe, it, expect } from "vitest";
import { renderProseSituation, proseBlocks, MAX_PROSE_LINE_LENGTH, isExemptFromLineLength } from "../proseView.js";
import { renderSeatSituation, type OpenPrincipalContext } from "../mind.js";
import { openConditions } from "../conditions.js";
import type { Condition } from "../conditionList.js";
import { PRISONER_NAME, WARDEN_NAME, prisonerStakes, wardenStakes } from "../../scenario.js";
import { OPEN_OBJECTS } from "../scenarioObjects.js";

/**
 * The-prisoner#21: a human-fiction view of a turn, for the player only, that
 * changes nothing about what the player knows. `renderProseSituation` is a
 * SECOND, deterministic rendering of the exact same `OpenPrincipalContext`
 * `renderSeatSituation` (mind.ts) already renders for the model's own
 * prompt -- composed by code, no model call, nothing invented.
 *
 * The mid-game fixture below deliberately carries several beliefs with
 * DIFFERENT "as of round" stamps, a condition list, and news from both the
 * other principal and this principal's own last attempt -- the shape the
 * issue names as the real risk: a future edit that quietly drops one of
 * these while the prose still "reads fine".
 */
const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss, three years into a sentence for a robbery that went wrong.",
  motive: "Get out of this cell. Then find Warden Croft, and make sure they never lock a door on you again.",
  briefing: [
    "Round 4 of 30.",
    "Warden Croft examines the bar closely.",
    'Croft says: "That bar\'s seen a lot of years..."',
    "At the end of round 30 you are transferred to a maximum-security block, and this chance is gone.",
    "Your notes from last round: watch for a moment alone with the wire.",
    "Your plan, from your last turn: work the lock loose, then try the door.",
    "bar integrity: 92 (as of round 2).",
    "lock integrity: 78 (as of round 3).",
    "guard attention: 40 (as of round 1).",
  ].join("\n"),
  perceivedObjects: [
    { id: "door", description: "A heavy door of iron-bound planks in a stone frame. It stands open now." },
    { id: "lock", description: "A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame." },
    { id: "loose_tile", description: "A square clay floor tile beside the cot, cracked across one corner." },
  ],
};

describe("the prose view (the-prisoner#21)", () => {
  it("is prose -- paragraphs, not the raw view's bulleted labelled blocks", () => {
    const conditions = openConditions();
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);
    const raw = renderSeatSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);
    expect(prose).not.toBe(raw);
    // The raw view's own object-list line shape (`- <id>: <description>`) must not survive verbatim.
    expect(prose).not.toMatch(/^- door:/m);
    expect(prose).not.toMatch(/^- lock:/m);
    // The raw view's own condition-list scaffolding must not survive either
    // -- the owner's complaint (§48) named this as the most prompt-shaped
    // part of the seat's view.
    expect(prose).not.toContain("START LIST OF CONDITIONS");
    expect(prose).not.toMatch(/CONDITION \d+ \(for /);
  });

  it("lays out the conditions one per line, and the objects one per line -- a player must be able to scan for one without reading the rest (review round 2)", () => {
    const conditions = openConditions();
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);

    // Every condition sentence is its OWN line, immediately after the lead.
    for (let i = 0; i < conditions.length; i++) {
      expect(prose).toMatch(new RegExp(`^Once .* -- condition ${i + 1}, for .+\\.$`, "m"));
    }
    // Every perceived object is its OWN line, immediately after the lead.
    for (const o of CONTEXT.perceivedObjects) {
      expect(prose).toMatch(new RegExp(`^The ${o.id.replace(/_/g, " ")}: `, "m"));
    }
  });

  it(`keeps every line of the prose at or under ${MAX_PROSE_LINE_LENGTH} characters, except the closing rules paragraph and the round-and-news paragraph (named explicitly, not by a wildcard) -- a wall of text is the regression this pins`, () => {
    // The full, real object list (not the 3-object test fixture) and the
    // real condition list -- the scale at which the pre-fix version actually
    // failed (a 1200+ character condition line, a 1700+ character object
    // line), so this test would have caught it.
    const realContext: OpenPrincipalContext = { ...CONTEXT, perceivedObjects: OPEN_OBJECTS.map((o) => ({ id: o.id, description: o.description })) };
    const conditions = openConditions();
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, realContext, conditions);

    const lines = prose.split("\n").filter((line) => line.length > 0);
    // Sanity: this fixture actually exercises both list paragraphs.
    expect(lines.length).toBeGreaterThan(conditions.length + OPEN_OBJECTS.length);

    for (const line of lines) {
      if (isExemptFromLineLength(line)) continue;
      expect(line.length).toBeLessThanOrEqual(MAX_PROSE_LINE_LENGTH);
    }
  });

  it("never calls a model -- it is a pure function of the same context the raw view renders", () => {
    // No fetchFn, no baseUrl, nothing async: if this compiles and returns
    // synchronously it made no model call.
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, openConditions());
    expect(typeof prose).toBe("string");
  });

  it("carries every belief line's number AND its stamp, and every perceived object's id or description -- the completeness floor this issue exists to pin", () => {
    const conditions = openConditions();
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);

    // Three beliefs, three DIFFERENT stamps -- each value and each stamp must
    // survive, not just one of the two (the issue's own example of a defect:
    // "prose drops a stamp or softens a number").
    expect(prose).toContain("92");
    expect(prose).toContain("round 2");
    expect(prose).toContain("78");
    expect(prose).toContain("round 3");
    expect(prose).toContain("40");
    expect(prose).toContain("round 1");

    // Every perceived object: its id (however spaced) or its full authored
    // description must appear somewhere.
    for (const o of CONTEXT.perceivedObjects) {
      const spacedId = o.id.replace(/_/g, " ");
      expect(prose.includes(spacedId) || prose.includes(o.description)).toBe(true);
    }

    // A state reading ("It stands open now.") is a FACT, not decoration --
    // it must not be silently dropped either.
    expect(prose).toContain("It stands open now.");

    // The condition list, the clock, the news, and identity/motive are all
    // part of what the raw view tells the player too. (Every threshold
    // number and every attribution the conditions carry is pinned more
    // rigorously by the dedicated test below.)
    expect(prose).toContain("the bar's integrity is at or below 50");
    expect(prose).toMatch(/for you/);
    expect(prose).toContain("round 4");
    expect(prose).toContain("30");
    expect(prose).toContain("Warden Croft examines the bar closely.");
    expect(prose).toContain("Croft says:");
    expect(prose).toContain("transferred to a maximum-security block");
    expect(prose).toContain("watch for a moment alone with the wire");
    expect(prose).toContain("work the lock loose, then try the door");
    expect(prose).toContain("Mara Voss");
    expect(prose).toContain("Get out of this cell");
  });

  it("proses the conditions into sentences, but keeps every threshold number and every attribution -- (for you)/(for Warden Croft) is load-bearing (§44: she cites conditions by number and reasons about whose they are)", () => {
    // A custom, distinct-numbers condition list (never `openConditions()`'s
    // own numbers, which happen to reuse 40 for both a threshold and a
    // belief stamp elsewhere in this fixture) -- so this test could not pass
    // by coincidence.
    const conditions: Condition[] = [
      { when: ["the rope's fray is at or above 77"], then: "Mara Voss can climb the rope", for: PRISONER_NAME },
      {
        when: ["warden suspicion is at or above 63", "Warden Croft searches the mattress"],
        then: "Warden Croft catches Mara Voss and the game ends",
        for: WARDEN_NAME,
      },
    ];
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, conditions);

    // Every threshold number in every clause.
    expect(prose).toContain("77");
    expect(prose).toContain("63");
    // Every clause of a multi-clause condition, not just the first.
    expect(prose).toContain("warden suspicion is at or above 63");
    expect(prose).toContain("Warden Croft searches the mattress");
    // Every outcome, verbatim.
    expect(prose).toContain("Mara Voss can climb the rope");
    expect(prose).toContain("Warden Croft catches Mara Voss and the game ends");
    // Attribution survives in both directions: "you" for the reader's own
    // condition, the other party's name for the other's.
    expect(prose).toMatch(/for you/);
    expect(prose).toContain(`for ${WARDEN_NAME}`);
    // Numbered, so a player can still cite one by number as she does in §44.
    expect(prose).toMatch(/condition 1\b/);
    expect(prose).toMatch(/condition 2\b/);
    // Never the raw view's own labelled block.
    expect(prose).not.toContain("START LIST OF CONDITIONS");
    expect(prose).not.toMatch(/CONDITION \d+ \(for /);
  });

  it("keeps a briefing line that matches none of this module's known templates verbatim, in place, rather than dropping it silently", () => {
    // A future edit to `buildOpenBriefing` could add a line shape this
    // module has never seen. The `other` bucket is the safety net: anything
    // unrecognised is kept, not summarised or discarded.
    const context: OpenPrincipalContext = {
      ...CONTEXT,
      briefing: [
        "Round 4 of 30.",
        "A brand-new kind of briefing line this module has never been taught to recognise.",
        "At the end of round 30 you are transferred to a maximum-security block, and this chance is gone.",
      ].join("\n"),
    };
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, context, undefined);
    expect(prose).toContain("A brand-new kind of briefing line this module has never been taught to recognise.");
  });

  it("does not invent anything: every sentence traces to identity, motive, briefing or a perceived object's own description", () => {
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, openConditions());
    // No narrator flourishes this repository forbids: weather, sounds, or a
    // claim about what the other principal is thinking.
    expect(prose).not.toMatch(/rain|weather|sunlight|footsteps echo|Croft (thinks|feels|wonders)/i);
  });

  it("renders the warden's own live suspicion, not a stamped belief, when this chair is the warden's", () => {
    const wardenContext: OpenPrincipalContext = {
      ...CONTEXT,
      identity: "You are Warden Croft, who has run this block for eleven years and has never lost a prisoner.",
      motive: "Keep this cell secure, and work out exactly what Voss is planning before it becomes a problem.",
      briefing: ["Round 4 of 30.", "warden suspicion: 55.", "You have grounds to search: suspicion 55."].join("\n"),
    };
    const prose = renderProseSituation(WARDEN_NAME, PRISONER_NAME, wardenContext, undefined);
    expect(prose).toContain("55");
  });
});

/**
 * D10-1 (PLAYTEST-2026-09-27-DESIGN.md R7, the coordinator's decision file):
 * the checkpoint transcript's rounds 5-10 repeated the SAME stakes sentence
 * every round, folded anonymously into the news paragraph. `parseBriefing`
 * now recognises this repository's own two stakes templates
 * (`scenario.ts`'s `prisonerStakes`/`wardenStakes`) -- literal templates,
 * never a reading of what they mean -- as their own `stakes` block, so
 * `deltaView.ts` can hold it back after the first turn (D10-1's own decision;
 * see `deltaView.test.ts`) instead of repeating it as anonymous news forever.
 */
describe("D10-1: the stakes line is its own block, recognised by this repository's own literal template", () => {
  it("pulls the prisoner's own stakes sentence out of the news paragraph and into a `stakes` block", () => {
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, CONTEXT, openConditions());
    const stakes = blocks.find((b) => b.kind === "stakes");
    expect(stakes?.text).toBe(prisonerStakes(30));
    const news = blocks.find((b) => b.kind === "news");
    expect(news?.text).not.toContain("transferred to a maximum-security block");
  });

  it("recognises the warden's own stakes sentence the same way", () => {
    const wardenContext: OpenPrincipalContext = {
      ...CONTEXT,
      identity: "You are Warden Croft.",
      motive: "Keep this cell secure.",
      briefing: ["Round 4 of 30.", wardenStakes(30)].join("\n"),
    };
    const blocks = proseBlocks(WARDEN_NAME, PRISONER_NAME, wardenContext, undefined);
    expect(blocks.find((b) => b.kind === "stakes")?.text).toBe(wardenStakes(30));
    expect(blocks.find((b) => b.kind === "news")?.text).not.toContain("transfer goes through");
  });

  it("a briefing with no round line yet (so the exact total-rounds template cannot be known) still keeps the line, verbatim, as news -- never dropped", () => {
    const noRound: OpenPrincipalContext = { ...CONTEXT, briefing: "A brand-new kind of line this module has never seen." };
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, noRound, undefined);
    expect(blocks.find((b) => b.kind === "stakes")).toBeUndefined();
    expect(blocks.find((b) => b.kind === "news")?.text).toContain("A brand-new kind of line this module has never seen.");
  });

  it("still carries the stakes sentence in the full prose join -- completeness, never dropped by moving it to its own block", () => {
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, openConditions());
    expect(prose).toContain(prisonerStakes(30));
  });
});

/**
 * D10-2 (PLAYTEST-2026-09-27-DESIGN.md R7): the motivating transcript's
 * six-line belief block repeated whole every round. The `knowledge` block
 * becomes a real list block -- a lead line plus one `ProseItem` per belief,
 * keyed by its resource label -- so `deltaView.ts` can hold back an
 * UNCHANGED belief the same way it already holds back an unchanged
 * perceived object (`deltaView.test.ts` pins the delta side of this; this
 * file pins that `proseBlocks` hands it the items to work with).
 */
describe("D10-2: the knowledge block is a list, one item per belief", () => {
  it("gives every belief its own item, keyed by its resource label", () => {
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, CONTEXT, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    expect(knowledge?.items).toBeDefined();
    const keys = knowledge?.items?.map((i) => i.key) ?? [];
    expect(keys).toContain("bar integrity");
    expect(keys).toContain("lock integrity");
    expect(keys).toContain("guard attention");
    const barItem = knowledge?.items?.find((i) => i.key === "bar integrity");
    expect(barItem?.text).toContain("92");
    expect(barItem?.text).toContain("round 2");
  });

  it("keeps the warden's own suspicion line as its own item, separate from the belief items", () => {
    const wardenContext: OpenPrincipalContext = {
      ...CONTEXT,
      identity: "You are Warden Croft.",
      motive: "Keep this cell secure.",
      briefing: ["Round 4 of 30.", "warden suspicion: 55.", "You have grounds to search: suspicion 55.", "bar integrity: 92 (as of round 2)."].join("\n"),
    };
    const blocks = proseBlocks(WARDEN_NAME, PRISONER_NAME, wardenContext, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    const items = knowledge?.items ?? [];
    expect(items.length).toBe(2);
    const suspicionItem = items.find((i) => i.text.includes("suspicion 55"));
    expect(suspicionItem).toBeDefined();
    expect(suspicionItem?.text).toContain("enough to search her cell outright");
    expect(items.find((i) => i.key === "bar integrity")?.text).toContain("92");
  });

  it("still carries every belief's number and stamp in the full prose join -- completeness, unaffected by becoming a list", () => {
    const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, openConditions());
    expect(prose).toContain("92");
    expect(prose).toContain("round 2");
    expect(prose).toContain("78");
    expect(prose).toContain("round 3");
    expect(prose).toContain("40");
    expect(prose).toContain("round 1");
  });
});

/**
 * D10-3 (PLAYTEST-2026-09-27-DESIGN.md R7): a belief whose property declares
 * `reads`/`readRanges` (`scenarioObjects.ts`) reads as the WORDS she was last
 * told, quoted, rather than the raw number -- the door/window's own passage
 * property is a boolean in effect (0 shut, 1 open), and reading "1" tells a
 * player nothing a number-blind reading of the model's own prompt would not
 * already cost her. A numeric-only property (the bar's own `integrity`, as
 * of this build) keeps today's sentence.
 *
 * Checked against the block's own `.text` (not `.items`) so these tests hold
 * whether or not `knowledge` has yet become a list block (D10-2, a separate
 * decision): `listBlock` folds every item's text into `.text` unchanged, so
 * this is never a second, shape-dependent assertion.
 */
describe("D10-3: a belief on a `reads`/`readRanges` property reads as words", () => {
  it("renders the door's passage belief as the quoted words, not the raw 0/1", () => {
    const context: OpenPrincipalContext = { ...CONTEXT, briefing: ["Round 4 of 30.", "door passage: 1 (as of round 3)."].join("\n") };
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, context, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    expect(knowledge?.text).toContain('Your last word on the door passage, as of round 3, was: "It stands open now."');
  });

  it("a passage belief at a value with no `reads` entry (shut, 0) falls back to the numeric sentence", () => {
    const context: OpenPrincipalContext = { ...CONTEXT, briefing: ["Round 4 of 30.", "door passage: 0 (as of round 3)."].join("\n") };
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, context, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    expect(knowledge?.text).toContain("Your last word on the door passage was 0, as of round 3.");
  });

  it("a numeric-only property (bar integrity, as of this build) keeps today's plain sentence", () => {
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, CONTEXT, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    expect(knowledge?.text).toContain("Your last word on the bar integrity was 92, as of round 2.");
  });

  it("a belief label matching no known object property (a future/derived resource) falls back to the numeric sentence rather than crashing", () => {
    const context: OpenPrincipalContext = { ...CONTEXT, briefing: ["Round 4 of 30.", "some future thing: 7 (as of round 1)."].join("\n") };
    const blocks = proseBlocks(PRISONER_NAME, WARDEN_NAME, context, undefined);
    const knowledge = blocks.find((b) => b.kind === "knowledge");
    expect(knowledge?.text).toContain("Your last word on the some future thing was 7, as of round 1.");
  });
});
