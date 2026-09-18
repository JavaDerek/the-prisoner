import { describe, it, expect } from "vitest";
import { renderProseSituation } from "../proseView.js";
import { renderSeatSituation, type OpenPrincipalContext } from "../mind.js";
import { openConditions } from "../conditions.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

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
    // part of what the raw view tells the player too.
    expect(prose).toContain("CONDITION 1");
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
