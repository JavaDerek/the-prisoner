// Warden presence (coordinator's fix, item 2): "watching and checking can't
// happen at once." OBSERVE being free and always-on meant the prisoner
// always saw "the warden watching closely" and always hid -- a standoff.
// Every warden move now declares WHERE it happens: in the cell (present,
// watching) or away (corridor/yard -- absent, not watching, not hearing).
import { describe, it, expect } from "vitest";
import { WARDEN_PRESENCE, WARDEN_PRESENCE_RULE, isWardenAway, wardenAwayLine, WARDEN_MOVES } from "../mechanics.js";

describe("WARDEN_PRESENCE -- one table, beside MOVE_DESCRIPTIONS, saying where each warden move happens", () => {
  it("every registered warden move has a presence entry", () => {
    for (const move of WARDEN_MOVES) {
      expect(WARDEN_PRESENCE[move], `missing presence for ${move}`).toBeDefined();
    }
  });

  it("OBSERVE, SEARCH, ROTATE_GUARD and WAIT are IN THE CELL -- present, watching", () => {
    for (const move of ["OBSERVE", "SEARCH", "ROTATE_GUARD", "WAIT"]) {
      expect(WARDEN_PRESENCE[move]?.location).toBe("cell");
      expect(isWardenAway(move)).toBe(false);
    }
  });

  it("CHECK_LOCK and SERVICE_LOCK are in the corridor; REPLACE_BAR is in the yard -- all AWAY", () => {
    expect(WARDEN_PRESENCE.CHECK_LOCK?.location).toBe("corridor");
    expect(WARDEN_PRESENCE.SERVICE_LOCK?.location).toBe("corridor");
    expect(WARDEN_PRESENCE.REPLACE_BAR?.location).toBe("yard");
    for (const move of ["CHECK_LOCK", "SERVICE_LOCK", "REPLACE_BAR"]) {
      expect(isWardenAway(move)).toBe(true);
    }
  });

  it("a move never registered for the warden (e.g. a prisoner move) is never away -- isWardenAway is never true for a name this table has no opinion about", () => {
    expect(isWardenAway("FILE")).toBe(false);
    expect(isWardenAway("NOT_A_REAL_MOVE")).toBe(false);
  });

  it("every AWAY move carries a positive authored away-line -- never a negation ('isn't watching')", () => {
    for (const move of ["CHECK_LOCK", "SERVICE_LOCK", "REPLACE_BAR"]) {
      const line = wardenAwayLine(move);
      expect(line, `missing away-line for ${move}`).toBeTruthy();
      expect(line?.toLowerCase()).not.toContain("isn't");
      expect(line?.toLowerCase()).not.toContain("not watching");
      expect(line?.toLowerCase()).not.toContain("no longer");
    }
  });

  it("a cell move has no away-line at all", () => {
    expect(wardenAwayLine("OBSERVE")).toBeUndefined();
    expect(wardenAwayLine("WAIT")).toBeUndefined();
  });

  it("REPLACE_BAR's away-line names the yard; CHECK_LOCK/SERVICE_LOCK's names the corridor", () => {
    expect(wardenAwayLine("REPLACE_BAR")?.toLowerCase()).toContain("yard");
    expect(wardenAwayLine("CHECK_LOCK")?.toLowerCase()).toContain("corridor");
    expect(wardenAwayLine("SERVICE_LOCK")?.toLowerCase()).toContain("corridor");
  });
});

describe("WARDEN_PRESENCE_RULE -- rules known to both, tied to the table by a test (never a hand-typed duplicate)", () => {
  it("names every registered warden move -- a retune of the table can never desync the rule text", () => {
    for (const move of WARDEN_MOVES) {
      expect(WARDEN_PRESENCE_RULE).toContain(move);
    }
  });

  it("states both halves of the rule positively -- the prisoner knows corridor/yard work leaves the cell unwatched; the warden knows leaving means not hearing", () => {
    const lower = WARDEN_PRESENCE_RULE.toLowerCase();
    expect(lower).toContain("cell");
    expect(lower).toContain("corridor");
    expect(lower).toContain("yard");
    expect(lower).toContain("hears nothing");
  });
});
