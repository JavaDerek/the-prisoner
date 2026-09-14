import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { renderOpenHalfRound, renderOpenSummary, refereeRequestsFor, fogAudit } from "../checkpointTranscript.js";
import type { OpenHalfRoundResult } from "../loop.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, SCRAPE, EXAMINE, OPEN_DOOR, LEAVE_DOOR } from "./helpers/scriptedReferee.js";

const IMPOSSIBLE = "I pray for the walls to fall.";

async function playCatchGame(): Promise<OpenGameResult> {
  createTestDb();
  const openWorld = buildOpenWorld();
  let prisonerTurn = 0;
  // Turn 1 is ruled impossible (not in RULINGS); later turns scrape the bar.
  const prisonerMind = {
    async consider(): Promise<OpenProposal> {
      prisonerTurn += 1;
      return prisonerTurn === 1
        ? { intent: IMPOSSIBLE, thoughts: "PRISONER_THOUGHTS_MARKER", notes: "PRISONER_NOTES_MARKER" }
        : { intent: SCRAPE, line: "Cold tonight." };
    },
  };
  return runOpenGame({
    openWorld,
    resolver: buildOpenResolver(),
    referee: createReferee([scriptedReferee(RULINGS)]),
    wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: EXAMINE, thoughts: "WARDEN_THOUGHTS_MARKER" }),
    prisonerMind,
    rounds: 8,
  });
}

function find(game: OpenGameResult, roundN: number, principal: "warden" | "prisoner"): OpenHalfRoundResult {
  const half = game.halves.find((h) => h.roundN === roundN && h.principal === principal);
  if (!half) throw new Error(`no half-round ${roundN} ${principal}`);
  return half;
}

describe("open checkpoint transcript", () => {
  afterEach(() => destroyTestDb());

  it("a ruled half-round shows the briefing, the intent, every referee answer with its citation and whether it verified, and the outcome", async () => {
    const game = await playCatchGame();
    const text = renderOpenHalfRound(find(game, 2, "prisoner")).join("\n");
    expect(text).toContain("the prisoner");
    expect(text).toContain("**Briefing given, verbatim:**");
    expect(text).toContain(`**Intent:** ${SCRAPE}`);
    expect(text).toContain("| target | `bar` | intent: \"scrape at the rusted base of the bar\" | yes |");
    expect(text).toContain("| property | `integrity` | desc:bar: \"Rust has pitted it near the bottom\" | yes |");
    expect(text).toContain("**Ruled:** possible");
    expect(text).toContain("bar_integrity: 100 -> 75");
    expect(text).toContain("**Actor learns:**");
    expect(text).toContain("**Other perceives:**");
  });

  it("an impossible ruling shows the safe defaults and the positive reason the actor is given", async () => {
    const game = await playCatchGame();
    const text = renderOpenHalfRound(find(game, 1, "prisoner")).join("\n");
    expect(text).toContain("**Ruled:** impossible");
    expect(text).toContain("| target | `none` | (none) | no |");
    expect(text).toContain("within your reach are:");
  });

  it("offers the reader rejected are shown with their reason, and questions the referee offered nothing for are named", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I scrape the bar with my spoon.";
    // Property is offered with a paraphrased quote; perceptibility is never offered at all.
    const transport = async (request: { questions: readonly { id: string }[] }) =>
      request.questions
        .filter((q) => q.id !== "perceptibility")
        .map((q) => ({
          questionId: q.id,
          answerKey: { target: "bar", effect: "wear", property: "integrity", magnitude: "slight" }[q.id] as string,
          citation: q.id === "property" ? { sourceId: "desc:bar", quote: "PARAPHRASED_RUST_QUOTE" } : { sourceId: "intent", quote: "scrape the bar" },
        }));
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([transport]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
      rounds: 1,
    });
    const text = renderOpenHalfRound(find(game, 1, "prisoner")).join("\n");
    expect(text).toMatch(/property: rejected \(\S+\) `integrity`, desc:bar: "PARAPHRASED_RUST_QUOTE"/);
    expect(text).toContain("No offer from the referee for: perceptibility.");
  });

  it("a silent half-round shows its reason and raw text", () => {
    const text = renderOpenHalfRound(
      { principal: "warden", t: 2, roundN: 1, context: { principalId: "w", identity: "", motive: "", briefing: "B", perceivedObjects: [] }, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null },
      { reason: "unparseable", text: "RAW_MODEL_TEXT" }
    ).join("\n");
    expect(text).toContain("**Silence.** SilenceReason: `unparseable`");
    expect(text).toContain("RAW_MODEL_TEXT");
  });

  it("referee requests: one entry per ruled half-round, labelled, carrying the exact request for replay", async () => {
    const game = await playCatchGame();
    const requests = refereeRequestsFor(game.halves);
    expect(requests.length).toBe(game.halves.length);
    expect(requests[1].label).toBe(`round 1, prisoner: ${IMPOSSIBLE}`);
    expect(requests[1].request.sources.find((s) => s.id === "intent")?.text).toBe(IMPOSSIBLE);
    expect(requests[1].request.questions.map((q) => q.id)).toEqual(["target", "effect", "property", "magnitude", "perceptibility"]);
  });

  it("fog audit: no context holds the other principal's private text -- and a planted leak is caught", async () => {
    const game = await playCatchGame();
    expect(fogAudit(game.halves)).toEqual({ checked: game.halves.length, leaks: [] });

    const planted = game.halves.map((h) =>
      h.roundN === 2 && h.principal === "warden" ? { ...h, context: { ...h.context, briefing: `${h.context.briefing} PRISONER_NOTES_MARKER` } } : h
    );
    expect(fogAudit(planted).leaks).toEqual([{ roundN: 2, principal: "warden", field: "notes" }]);
  });

  it("fog audit: text BOTH principals wrote themselves is theirs to see, never a leak", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const same = { intent: "I sit on the cot and wait.", notes: "IDENTICAL_NOTES_BOTH_SIDES" };
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(same),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>(same),
      rounds: 2,
    });
    expect(fogAudit(game.halves).leaks).toEqual([]);
  });

  it("summary: the measurements, every impossible and novel intent listed, the result and the fog audit", async () => {
    const game = await playCatchGame();
    const text = renderOpenSummary(game).join("\n");
    expect(text).toContain("**The warden caught the prisoner, at round 4.**");
    expect(text).toContain("Ruled impossible: 1.");
    expect(text).toContain(`round 1, prisoner: ${IMPOSSIBLE}`);
    expect(text).toContain("Novel (object, effect) pairs with no closed-variant equivalent: 0.");
    expect(text).toContain("Fog audit: 7 contexts checked, 0 leaks.");
  });

  it("a half-round that leaves the cell shows the move, not '(no state changed)' (OPEN-VARIANT.md §12)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    let turn = 0;
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I wait." }),
      prisonerMind: { async consider() { turn += 1; return { intent: turn === 1 ? OPEN_DOOR : LEAVE_DOOR }; } },
      rounds: 3,
    });
    const text = renderOpenHalfRound(find(game, 2, "prisoner")).join("\n");
    expect(text).toContain("went out through the door");
    expect(text).toContain(`location_id: ${openWorld.base.cellId} -> ${openWorld.exits.lock.destinationId}`);
    expect(text).not.toContain("(no state changed)");
    expect(renderOpenSummary(game).join("\n")).toContain("**The prisoner escaped, at round 2.**");
  });
});

