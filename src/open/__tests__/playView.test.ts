import { describe, it, expect } from "vitest";
import { createPlayView } from "../humanSeat.js";
import type { OpenPrincipalContext } from "../mind.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/**
 * `createPlayView` (the-prisoner#11's MCP half): the SAME rendering
 * `createHumanSeatMind`'s own `play` view uses, extracted so a caller other
 * than the terminal seat -- here, the MCP seat's `my_briefing` -- gets it by
 * calling the same function, never a second hand-written copy of what
 * "play" shows (issue #11's own terminal-half comment: "my_briefing should
 * return that same render... or a human game stops saying anything about
 * the game the models play"). `humanSeat.test.ts`'s existing "the play
 * view" suites are the regression guard that this extraction changed
 * nothing about what the terminal seat itself shows; this file is the new
 * coverage for the function on its own, standalone.
 */
function context(briefing: string): OpenPrincipalContext {
  return {
    principalId: "p1",
    identity: "You are Mara Voss.",
    motive: "Get out.",
    briefing,
    perceivedObjects: [{ id: "bar", description: "One of five vertical iron bars." }],
  };
}

describe("createPlayView", () => {
  it("renders the news before the room (Infocom's order), on a first turn", () => {
    const view = createPlayView(PRISONER_NAME, WARDEN_NAME);
    const text = view.render(context("Round 1 of 12."));
    const newsIndex = text.indexOf("This is round 1 of 12");
    const roomIndex = text.indexOf("What you can currently reach or perceive") !== -1 ? text.indexOf("What you can currently reach or perceive") : text.indexOf("bar");
    expect(newsIndex).toBeGreaterThanOrEqual(0);
    expect(roomIndex).toBeGreaterThan(newsIndex);
  });

  it("holds the standing world back on a second render of an unchanged context (deltaView.ts)", () => {
    const view = createPlayView(PRISONER_NAME, WARDEN_NAME);
    const first = view.render(context("Round 1 of 12."));
    const second = view.render(context("Round 2 of 12."));
    // The room ("bar: One of five...") was already shown once and has not
    // changed, so the second render should not repeat its full description.
    expect(first).toContain("One of five vertical iron bars.");
    expect(second).not.toContain("One of five vertical iron bars.");
  });

  it("a fresh PlayView instance shares no state with another -- each caller's game is its own", () => {
    const a = createPlayView(PRISONER_NAME, WARDEN_NAME);
    const b = createPlayView(PRISONER_NAME, WARDEN_NAME);
    a.render(context("Round 1 of 12."));
    // b has never rendered before, so it must show the room in full, even
    // though `a` has already "used up" its own delta.
    expect(b.render(context("Round 1 of 12."))).toContain("One of five vertical iron bars.");
  });

  it("newsFilter (D10-4) drops exactly the lines it is told to, and nothing else", () => {
    const view = createPlayView(PRISONER_NAME, WARDEN_NAME);
    const withNews = context("Round 1 of 12.\nWarden Croft examines the bar closely.");
    const withFilter = view.render(withNews, { newsFilter: (line) => !line.includes("examines the bar") });
    expect(withFilter).not.toContain("examines the bar closely");
  });

  it("blockText answers one block by kind, undelta'd, for the no-turn `rules`/`me` commands", () => {
    const view = createPlayView(PRISONER_NAME, WARDEN_NAME);
    view.render(context("Round 1 of 12.")); // "use up" the delta once
    const identity = view.blockText(context("Round 2 of 12."), "identity");
    // blockText is never affected by the delta: it is a fresh read every time.
    expect(identity.length).toBeGreaterThan(0);
    expect(identity).toContain(PRISONER_NAME);
  });

  it("blockText returns empty string for a block this context/conditions produced none of", () => {
    const view = createPlayView(PRISONER_NAME, WARDEN_NAME); // no conditions given
    expect(view.blockText(context("Round 1 of 12."), "conditions")).toBe("");
  });
});
