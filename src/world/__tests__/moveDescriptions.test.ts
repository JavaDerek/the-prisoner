import { describe, it, expect } from "vitest";
import { PRISONER_MOVES, WARDEN_MOVES, MOVE_DESCRIPTIONS } from "../mechanics.js";

describe("MOVE_DESCRIPTIONS -- one plain sentence per registered mechanic (item 2)", () => {
  it("every entry in PRISONER_MOVES has a non-empty description", () => {
    for (const move of PRISONER_MOVES) {
      expect(MOVE_DESCRIPTIONS[move], `missing description for ${move}`).toBeTruthy();
      expect(MOVE_DESCRIPTIONS[move].length).toBeGreaterThan(10);
    }
  });

  it("every entry in WARDEN_MOVES has a non-empty description", () => {
    for (const move of WARDEN_MOVES) {
      expect(MOVE_DESCRIPTIONS[move], `missing description for ${move}`).toBeTruthy();
      expect(MOVE_DESCRIPTIONS[move].length).toBeGreaterThan(10);
    }
  });

  it("descriptions match what the mechanics actually do -- FILE wears down the bar", () => {
    expect(MOVE_DESCRIPTIONS.FILE.toLowerCase()).toContain("bar");
  });

  it("descriptions match what the mechanics actually do -- REPLACE_BAR is refused after a cut", () => {
    expect(MOVE_DESCRIPTIONS.REPLACE_BAR.toLowerCase()).toContain("cut");
  });
});
