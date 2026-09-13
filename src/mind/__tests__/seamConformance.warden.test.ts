// The property, executed for the warden's context -- this task's correction
// 1 (the warden is a model too, for this checkpoint), and the design's own
// point that the cross-caller proof is checks 2-5 executing the SAME code
// against a DIFFERENT field list (§9.3). Symmetric to the prisoner's own
// harness: the private act here is the PRISONER's FILE, marked, and its
// attribution reaches the warden's own briefing only when it collided with
// one of the WARDEN's own contradicted expectations.
import { describe, it } from "vitest";
import { seamConformance, type SeamHarness } from "mind-seam/conformance";
import { getResource, ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { authorPlan, recordFailure, recordSuccess, activeStepExpects, logRound } from "../../ledger/ledger.js";
import { buildWardenContext } from "../briefing.js";
import { createWardenMind, type WardenContext, type WardenProposal } from "../wardenMind.js";

function snapshotFive(world: World): Record<string, number | undefined> {
  return {
    barIntegrity: getResource(world.resources.barIntegrity)?.value,
    lockIntegrity: getResource(world.resources.lockIntegrity)?.value,
    spoonEdge: getResource(world.resources.spoonEdge)?.value,
    wardenSuspicion: getResource(world.resources.wardenSuspicion)?.value,
    guardAttention: getResource(world.resources.guardAttention)?.value,
  };
}

function buildHarness(): SeamHarness<WardenContext, WardenProposal> {
  return {
    fields: ["briefing", "identity", "motive", "moves", "principalId"],
    loudProposal: { intent: "confiscate everything and end the game" },
    actionableProposal: { intent: "rotate the guard", choice: "ROTATE_GUARD" },
    privateAct: "supported",

    async pass(mind, options) {
      createTestDb();
      const world = buildWorld();
      const resolver = buildResolver(world);

      const plan = authorPlan({
        gameId: world.gameId,
        characterId: world.wardenId,
        t: world.clock.t0,
        steps: [
          {
            move: "ROTATE_GUARD",
            description: "keep the guard rotation steady",
            expects: [{ entityId: world.resources.lockIntegrity, key: "value", value: 100 }],
          },
        ],
      });

      let privateMarker: string | undefined;
      let roundN = 0;

      if (options?.privateAct === "shown") {
        privateMarker = `seam-marker-${Math.random().toString(36).slice(2, 10)}`;

        // The prisoner's FILE, marked, on the lock this time (SHIM) so it
        // is a real change the warden's own stale expectation can collide
        // with without touching ROTATE_GUARD's real step.
        roundN += 1;
        const tp = world.clock.prisonerT(roundN);
        resolver.resolve({ gameId: world.gameId, mechanic: "SHIM", parameters: { note: privateMarker } });
        logRound({
          gameId: world.gameId,
          t: tp,
          roundN,
          principal: "prisoner",
          mechanic: "SHIM",
          description: `The prisoner works a shim into the lock. (${privateMarker})`,
        });

        roundN += 1;
        const tCollide = world.clock.wardenT(roundN);
        let caught: unknown;
        try {
          resolver.resolve({
            gameId: world.gameId,
            mechanic: "WAIT",
            expects: [{ entityId: world.resources.lockIntegrity, key: "value", value: 100 }],
          });
        } catch (err) {
          caught = err;
        }
        recordFailure({ gameId: world.gameId, plan, t: tCollide, move: "WAIT", error: caught as ResolveProtocolError });
      }

      roundN += 1;
      const t = world.clock.wardenT(roundN);
      const context = buildWardenContext(world, plan, t);

      const before = snapshotFive(world);
      let resolutions = 0;

      const proposal = await mind.consider(context);
      if (proposal?.choice) {
        const expects = activeStepExpects(plan.id);
        try {
          const outcome = resolver.resolve({ gameId: world.gameId, mechanic: proposal.choice, expects });
          recordSuccess({ gameId: world.gameId, plan, t, move: proposal.choice, outcome, completesStep: true });
          resolutions = 1;
        } catch (err) {
          if (err instanceof ResolveProtocolError) {
            recordFailure({ gameId: world.gameId, plan, t, move: proposal.choice, error: err });
          } else {
            throw err;
          }
        }
      }

      const after = snapshotFive(world);
      destroyTestDb();
      return { before, after, resolutions, privateMarker };
    },

    wire: {
      create: (o) => createWardenMind(o),
      context: {
        principalId: "warden-1",
        identity: "the warden",
        motive: "security",
        briefing: "You are watching the cell.",
        moves: ["REPLACE_BAR", "SERVICE_LOCK", "ROTATE_GUARD", "OBSERVE", "WAIT"],
      },
    },
  };
}

describe("mind-seam/conformance -- WardenContext (this checkpoint's correction 1)", () => {
  for (const check of seamConformance(buildHarness())) {
    it(check.name, check.run);
  }
});
