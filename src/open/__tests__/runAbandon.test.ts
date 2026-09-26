import { describe, it, expect } from "vitest";
import { renderAbandonedSection, abandonedByPlayerAtRound, AbandonedByPlayerError } from "../runAbandon.js";

// D2 (docs/HUMAN-INTENTS-DESIGN.md §2, the-prisoner#29): a human game's own
// "Run aborted" section -- pure text, no code fence, no stack -- for the two
// ways a player leaves before the game ends: ctrl-C and a closed terminal
// (ctrl-D). checkpoint.ts is the only caller (it is the one place that can
// catch a signal or write a file); this module is what makes the WORDING
// testable without spinning up a real process or a real game.
describe("D2: the human-abandoned-run section (docs/HUMAN-INTENTS-DESIGN.md §2)", () => {
  it("renders a plain '## Run aborted' section with the given reason, no code fence", () => {
    expect(renderAbandonedSection("abandoned by the player at round 7")).toEqual(["## Run aborted", "", "abandoned by the player at round 7"]);
  });

  it("the reason names the round, and is byte-identical whichever way the player left (§3.2: 'treat a closed readline as abandonment the same way')", () => {
    expect(abandonedByPlayerAtRound(7)).toBe("abandoned by the player at round 7");
    expect(abandonedByPlayerAtRound(1)).toBe("abandoned by the player at round 1");
    expect(abandonedByPlayerAtRound(0)).toBe("abandoned by the player at round 0");
  });

  it("AbandonedByPlayerError carries the reason as its own message, and is a real Error (so it prints like one if ever uncaught)", () => {
    const err = new AbandonedByPlayerError(abandonedByPlayerAtRound(3));
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("abandoned by the player at round 3");
  });
});
