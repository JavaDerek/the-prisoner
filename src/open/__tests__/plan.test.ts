import { describe, it, expect, afterEach, vi } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenGame } from "../game.js";
import { buildOpenBriefing } from "../briefing.js";
import { createOpenMind, type OpenMind, type OpenPrincipalContext, type OpenProposal } from "../mind.js";
import { renderOpenHalfRound, renderOpenSummary, fogAudit } from "../checkpointTranscript.js";
import { scriptedReferee, RULINGS, SCRAPE, WAIT } from "./helpers/scriptedReferee.js";

// OPEN-VARIANT.md §22: plan, act, observe -- a plan persists, and only an observation breaks it.
describe("the plan is carried forward (§22)", () => {
  afterEach(() => destroyTestDb());

  it("a plan in the news renders into the briefing", () => {
    createTestDb();
    const world = buildOpenWorld();
    const briefing = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 2, 12, { plan: "Wear the bar through, then leave by the window." });
    expect(briefing).toContain("Your plan, from your last turn: Wear the bar through, then leave by the window.");
  });

  it("in a game, each principal's own plan reaches its own next briefing, never the other's, and survives a silent turn", async () => {
    createTestDb();
    let turn = 0;
    const prisonerMind: OpenMind = {
      async consider() {
        turn += 1;
        if (turn === 2) return null;
        return { intent: SCRAPE, plan: `PRISONER_PLAN_${turn}` };
      },
    };
    const game = await runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT, plan: "WARDEN_PLAN" }),
      prisonerMind,
      rounds: 3,
    });
    const briefing = (roundN: number, principal: "prisoner" | "warden") => game.halves.find((h) => h.roundN === roundN && h.principal === principal)?.context.briefing ?? "";
    expect(briefing(1, "prisoner")).not.toContain("Your plan");
    expect(briefing(2, "prisoner")).toContain("PRISONER_PLAN_1");
    expect(briefing(3, "prisoner")).toContain("PRISONER_PLAN_1"); // round 2 was silent
    expect(briefing(2, "warden")).toContain("WARDEN_PLAN");
    for (const h of game.halves.filter((x) => x.principal === "warden")) expect(h.context.briefing).not.toContain("PRISONER_PLAN");
    expect(fogAudit(game.halves).leaks).toEqual([]);
  });
});

describe("replanning names the observation that broke the plan (§22)", () => {
  afterEach(() => destroyTestDb());

  function capture(answer: Record<string, unknown>) {
    const seen = { prompt: "" };
    const fetchFn = vi.fn(async (_url: unknown, init?: RequestInit) => {
      seen.prompt = JSON.parse((init?.body as string) ?? "{}").messages[0].content as string;
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }) };
    }) as unknown as typeof fetch;
    return { seen, mind: createOpenMind({ baseUrl: "http://x", selfName: "Mara Voss", otherName: "Warden Croft", model: "m", fetchFn }) };
  }
  const CONTEXT: OpenPrincipalContext = { principalId: "p", identity: "i", motive: "m", briefing: "b", perceivedObjects: [{ id: "bar", description: "A bar." }] };

  it("the prompt tells the mind to keep its plan unless an observation breaks it, and asks for replanBecause", async () => {
    const { seen, mind } = capture({ thoughts: "t", candidates: [{ text: "a", reason: "r" }, { text: "b", reason: "r" }], intent: "i", line: "", plan: "p", replanBecause: "", notes: "n" });
    await mind.consider(CONTEXT);
    expect(seen.prompt).toContain('"replanBecause"');
    expect(seen.prompt).toMatch(/next step of your plan/i);
    expect(seen.prompt).toMatch(/only when something you have observed/i);
  });

  it("a stated reason is carried on the proposal; an empty one means the plan was kept", async () => {
    const replanned = await capture({ thoughts: "t", intent: "i", line: "", plan: "p2", replanBecause: "The warden examined the bar.", notes: "n" }).mind.consider(CONTEXT);
    expect(replanned?.replanBecause).toBe("The warden examined the bar.");
    const kept = await capture({ thoughts: "t", intent: "i", line: "", plan: "p", replanBecause: "  ", notes: "n" }).mind.consider(CONTEXT);
    expect(kept?.replanBecause).toBeUndefined();
  });

  it("the transcript shows a replan's reason, and the summary counts kept and replanned plans", async () => {
    createTestDb();
    let turn = 0;
    const prisonerMind: OpenMind = {
      async consider() {
        turn += 1;
        return turn === 2 ? { intent: SCRAPE, plan: "p2", replanBecause: "The bar would not give." } : { intent: SCRAPE, plan: "p1" };
      },
    };
    const game = await runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind,
      rounds: 3,
    });
    const round2 = game.halves.find((h) => h.roundN === 2 && h.principal === "prisoner");
    expect(renderOpenHalfRound(round2 as NonNullable<typeof round2>).join("\n")).toContain("**Replanned because:** The bar would not give.");
    expect(renderOpenSummary(game, 3).join("\n")).toContain("Prisoner plans (§22): replanned 1 of 2 turns that had a plan, kept 1.");
  });
});
