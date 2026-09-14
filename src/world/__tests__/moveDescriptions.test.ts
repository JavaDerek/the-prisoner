import { describe, it, expect } from "vitest";
import {
  PRISONER_MOVES,
  WARDEN_MOVES,
  MOVE_DESCRIPTIONS,
  TIME_DECAY_RULE,
  TIME_DECAY_AMOUNT,
  ROTATE_GUARD_LEVEL,
  ESCAPE_GUARD_MAX,
  SEARCH_SUSPICION_THRESHOLD,
  SEARCH_CATCH_BAR_MAX,
  SEARCH_CATCH_LOCK_MAX,
  SEARCH_CATCH_SPOON_MIN,
} from "../mechanics.js";

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

  // Coordinator's fix, item 3: "a test that the text contains the
  // constants' current values (so a retune can't silently desync)" -- one
  // assertion per number a rule depends on, checked against the SAME
  // exported constant the mechanic itself reads (never a copied literal).
  it("ESCAPE's description states its exact conditions", () => {
    expect(MOVE_DESCRIPTIONS.ESCAPE).toContain(String(ESCAPE_GUARD_MAX));
  });

  it("SEARCH's description states its exact grounds threshold and catch conditions", () => {
    expect(MOVE_DESCRIPTIONS.SEARCH).toContain(String(SEARCH_SUSPICION_THRESHOLD));
    expect(MOVE_DESCRIPTIONS.SEARCH).toContain(String(SEARCH_CATCH_BAR_MAX));
    expect(MOVE_DESCRIPTIONS.SEARCH).toContain(String(SEARCH_CATCH_LOCK_MAX));
    expect(MOVE_DESCRIPTIONS.SEARCH).toContain(String(SEARCH_CATCH_SPOON_MIN));
  });

  it("ROTATE_GUARD's description states its exact level", () => {
    expect(MOVE_DESCRIPTIONS.ROTATE_GUARD).toContain(String(ROTATE_GUARD_LEVEL));
  });
});

describe("TIME_DECAY_RULE -- the one rule not attached to any offered move, stated to both sides anyway", () => {
  it("states the exact decay amount, from the same constant TIME_DECAY itself reads", () => {
    expect(TIME_DECAY_RULE).toContain(String(TIME_DECAY_AMOUNT));
    expect(TIME_DECAY_RULE.toLowerCase()).toContain("guard_attention");
  });
});
