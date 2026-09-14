// Configurable model roles, fog property (this task's brief, item 1: "add a
// planted-marker test that the other principal's private data never
// reaches either call"). `privateFields.test.ts` already proves this for
// `thoughts`/`notes` in general (against `scriptedMind`, principal-
// agnostic to wits/voice); this file re-proves it specifically for the
// two-call path, at the level that actually matters here -- the literal
// HTTP request bodies `createPrisonerMind`/`createWardenMind` send once
// wits and voice are split across two real `createLocalMind` calls, for
// BOTH the wits call and the voice call independently. The positive
// control (without which absence proves nothing) is the marker reaching
// the SAME principal's own next wits prompt.
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { authorPlan } from "../../ledger/ledger.js";
import { buildPrisonerContext, buildWardenContext } from "../briefing.js";
import { runHalfRound, newSilenceTracker } from "../../loop.js";
import { createWardenMind } from "../wardenMind.js";
import { createPrisonerMind } from "../prisonerMind.js";
import type { Resolver } from "run-dmcp";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
function chatBody(content: unknown): unknown {
  return { choices: [{ message: { content: JSON.stringify(content) } }] };
}

describe("configurable model roles -- the other principal's private data never reaches either call", () => {
  let world: World;
  let resolver: Resolver;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a marker in the warden's notes never appears in the prisoner's wits OR voice request bodies, but does reach the warden's own next wits request", async () => {
    fresh();
    const marker = `role-fog-marker-${Math.random().toString(36).slice(2, 10)}`;

    const wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });
    const prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "wait" }] });

    // Round 1: the warden, run through the REAL dual-model composition
    // (wits-model / voice-model), leaves itself a note carrying the marker.
    const wardenFetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "warden-wits") {
        return jsonResponse(chatBody({ thoughts: "planning", plan: ["WAIT"], notes: `remember: ${marker}` }));
      }
      return jsonResponse(chatBody({ intent: "wait and watch", line: "" }));
    }) as unknown as typeof fetch;

    const wardenMind = createWardenMind({ baseUrl: "http://offline.invalid", witsModel: "warden-wits", voiceModel: "warden-voice", fetchFn: wardenFetch });
    const t1 = world.clock.wardenT(1);
    const wardenHalf = await runHalfRound({
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: 1,
      t: t1,
      context: buildWardenContext(world, wardenPlan, t1),
      mind: wardenMind,
      tracker: newSilenceTracker(),
    });
    expect(wardenHalf.result.kind).toBe("resolved");

    // The prisoner's very next half-round, ALSO through the real dual-model
    // composition -- every request body sent (wits AND voice) is captured.
    const prisonerRequestBodies: string[] = [];
    const prisonerFetch = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      prisonerRequestBodies.push(JSON.stringify(body));
      if (body.model === "prisoner-wits") {
        return jsonResponse(chatBody({ thoughts: "thinking", plan: ["WAIT"], notes: "nothing yet" }));
      }
      return jsonResponse(chatBody({ intent: "wait quietly", line: "" }));
    }) as unknown as typeof fetch;

    const prisonerMind = createPrisonerMind({ baseUrl: "http://offline.invalid", witsModel: "prisoner-wits", voiceModel: "prisoner-voice", fetchFn: prisonerFetch });
    const prisonerContext = buildPrisonerContext(world, prisonerPlan, world.clock.prisonerT(1));
    await runHalfRound({
      world,
      resolver,
      plan: prisonerPlan,
      principal: "prisoner",
      roundN: 1,
      t: world.clock.prisonerT(1),
      context: prisonerContext,
      mind: prisonerMind,
      tracker: newSilenceTracker(),
    });

    expect(prisonerRequestBodies).toHaveLength(2); // wits AND voice both actually ran
    for (const body of prisonerRequestBodies) {
      expect(body).not.toContain(marker);
    }

    // Positive control: the warden's OWN next wits request carries it.
    const wardenWitsRequests: string[] = [];
    const wardenFetch2 = (async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      if (body.model === "warden-wits") wardenWitsRequests.push(JSON.stringify(body));
      if (body.model === "warden-wits") {
        return jsonResponse(chatBody({ thoughts: "still planning", plan: ["WAIT"], notes: "still nothing" }));
      }
      return jsonResponse(chatBody({ intent: "wait", line: "" }));
    }) as unknown as typeof fetch;
    const wardenMind2 = createWardenMind({ baseUrl: "http://offline.invalid", witsModel: "warden-wits", voiceModel: "warden-voice", fetchFn: wardenFetch2 });
    await runHalfRound({
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: 2,
      t: world.clock.wardenT(2),
      context: buildWardenContext(world, wardenPlan, world.clock.wardenT(2)),
      mind: wardenMind2,
      tracker: newSilenceTracker(),
    });
    expect(wardenWitsRequests).toHaveLength(1);
    expect(wardenWitsRequests[0]).toContain(marker);
  });
});
