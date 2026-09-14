import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame } from "../game.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * Full short games to each ending, with scripted minds and a scripted referee
 * transport (this issue's step 1). The transport is TEST content: it keys its
 * ruling off which scripted intent it is handed, the way a real referee model
 * would read it -- production code never does this.
 */
type Script = { target: string; effect: string; property: string; magnitude: string; perceptibility: string; intentQuote: string; descQuote: string };

function scriptedReferee(byIntent: Record<string, Script>): ReaderTransport {
  return async (request) => {
    const intent = request.sources.find((s) => s.id === "intent")?.text ?? "";
    const script = byIntent[intent];
    if (!script) return []; // every question falls to its safe default: the attempt does nothing
    return request.questions.map((q) => ({
      questionId: q.id,
      answerKey: (script as Record<string, string>)[q.id],
      citation: q.id === "property" ? { sourceId: `desc:${script.target}`, quote: script.descQuote } : { sourceId: "intent", quote: script.intentQuote },
    }));
  };
}

const SCRAPE = "I scrape at the rusted base of the bar with my spoon.";
const EXAMINE = "I examine the bar closely.";
const WAIT = "I sit on the cot and wait.";

const RULINGS: Record<string, Script> = {
  [SCRAPE]: { target: "bar", effect: "wear", property: "integrity", magnitude: "substantial", perceptibility: "audible", intentQuote: "scrape at the rusted base of the bar", descQuote: "Rust has pitted it near the bottom" },
  [EXAMINE]: { target: "bar", effect: "reveal", property: "integrity", magnitude: "slight", perceptibility: "visible", intentQuote: "examine the bar closely", descQuote: "Rust has pitted it near the bottom" },
};

function repeating(proposal: OpenProposal): OpenMind {
  return scriptedMind<OpenPrincipalContext, OpenProposal>(proposal);
}

function setup() {
  createTestDb();
  const openWorld = buildOpenWorld();
  return { openWorld, resolver: buildOpenResolver(), referee: createReferee([scriptedReferee(RULINGS)]) };
}

describe("runOpenGame: the open variant's round loop, played to each ending", () => {
  afterEach(() => destroyTestDb());

  it("escape: a prisoner who keeps wearing the bar gets out once it reaches 0 and the guard has waned", async () => {
    const { openWorld, resolver, referee } = setup();
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: repeating({ intent: WAIT }),
      prisonerMind: repeating({ intent: SCRAPE, line: "Just stretching." }),
      rounds: 8,
    });

    // bar 100 -> 75 -> 50 -> 25 -> 0 on the prisoner's 4th half-round; guard 50 -> 40 -> 30 -> 20 by then.
    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(4);
    expect(game.halves.map((h) => `${h.roundN}:${h.principal}`)).toEqual([
      "1:warden", "1:prisoner", "2:warden", "2:prisoner", "3:warden", "3:prisoner", "4:warden", "4:prisoner",
    ]);
    expect(getResource(openWorld.base.resources.guardAttention)?.value).toBe(20); // three full rounds of decay, none after the end
  });

  it("catch: a warden who keeps examining the bar catches a prisoner who keeps wearing it, once suspicion gives grounds", async () => {
    const { openWorld, resolver, referee } = setup();
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: repeating({ intent: EXAMINE }),
      prisonerMind: repeating({ intent: SCRAPE }),
      rounds: 8,
    });

    // Round 2's warden examine: suspicion 30 (round 1 scrape) + floor(25/2)=12 -> 42 >= 40; bar 75 > 50.
    // Round 3's warden examine: bar 50 <= 50 with suspicion above the threshold -> caught.
    expect(game.ended).toEqual({ kind: "caught" });
    expect(game.endedAtRound).toBe(3);
    expect(game.halves.at(-1)?.principal).toBe("warden");
  });

  it("timeout: neither side gets anywhere, every round is played, the game ends with no state ending", async () => {
    const { openWorld, resolver, referee } = setup();
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: repeating({ intent: WAIT }),
      prisonerMind: repeating({ intent: WAIT }),
      rounds: 3,
    });
    expect(game.ended).toBeNull();
    expect(game.endedAtRound).toBeNull();
    expect(game.halves).toHaveLength(6);
  });

  it("news: each principal's next briefing carries its own outcome and the other's perceptible act, never the other's intent", async () => {
    const { openWorld, resolver, referee } = setup();
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: repeating({ intent: EXAMINE, notes: "WARDEN_NOTES_MARKER" }),
      prisonerMind: repeating({ intent: SCRAPE, line: "Cold tonight.", notes: "PRISONER_NOTES_MARKER" }),
      rounds: 8,
    });

    const round2Warden = game.halves.find((h) => h.roundN === 2 && h.principal === "warden")?.context.briefing ?? "";
    const round2Prisoner = game.halves.find((h) => h.roundN === 2 && h.principal === "prisoner")?.context.briefing ?? "";

    expect(round2Warden).toContain("its integrity is 100"); // its own round-1 examine
    expect(round2Warden).toContain("works at the bar"); // the prisoner's audible scrape
    expect(round2Warden).toContain('says: "Cold tonight."');
    expect(round2Warden).toContain("WARDEN_NOTES_MARKER");
    expect(round2Warden).not.toContain(SCRAPE);
    expect(round2Warden).not.toContain("PRISONER_NOTES_MARKER");

    expect(round2Prisoner).toContain("went from 100 to 75"); // its own round-1 scrape
    expect(round2Prisoner).toContain("examines the bar closely"); // the warden's visible examine this round
    expect(round2Prisoner).not.toContain(EXAMINE);
    expect(round2Prisoner).not.toContain("WARDEN_NOTES_MARKER");
  });

  it("onHalfRound sees every half-round in order, as it happens", async () => {
    const { openWorld, resolver, referee } = setup();
    const seen: string[] = [];
    await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: repeating({ intent: WAIT }),
      prisonerMind: repeating({ intent: WAIT }),
      rounds: 2,
      onHalfRound: (half) => {
        seen.push(`${half.roundN}:${half.principal}`);
      },
    });
    expect(seen).toEqual(["1:warden", "1:prisoner", "2:warden", "2:prisoner"]);
  });
});
