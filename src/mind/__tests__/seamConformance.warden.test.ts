// The property, executed for the warden's context -- this task's correction
// 1 (the warden is a model too, for this checkpoint), and the design's own
// point that the cross-caller proof is checks 2-5 executing the SAME code
// against a DIFFERENT field list (§9.3). Symmetric to the prisoner's own
// harness: the private act here is the PRISONER's SHIM, marked, and its
// attribution reaches the warden's own briefing only when it collided with
// one of the WARDEN's own contradicted expectations.
//
// Same coordinator correction as seamConformance.prisoner.test.ts: ONE
// marker per harness instance, planted identically on "shown" and
// "withheld" (only the collision that attributes it differs), plus a
// planted-violation test proving check 4 goes red if the collision ever
// happened on "withheld" too. See that file's header for the full
// reasoning.
import { describe, it, expect } from "vitest";
import { seamConformance, type SeamHarness } from "mind-seam/conformance";
import { getResource, ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver, SHIM_AMOUNT } from "../../world/mechanics.js";
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

async function runScenario(
  mind: import("mind-seam").Mind<WardenContext, WardenProposal>,
  marker: string,
  options: { privateAct?: "shown" | "withheld"; forceLeak?: boolean } | undefined
) {
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
        // The always-planted SHIM below runs before this step's own
        // proposal in every pass, shown or withheld, so the expectation
        // must match what it actually leaves behind, not the pristine 100.
        expects: [{ entityId: world.resources.lockIntegrity, key: "value", value: 100 - SHIM_AMOUNT }],
      },
    ],
  });

  let roundN = 0;

  // Always planted, identically, regardless of shown/withheld.
  roundN += 1;
  const tp = world.clock.prisonerT(roundN);
  resolver.resolve({ gameId: world.gameId, mechanic: "SHIM", parameters: { note: marker } });
  logRound({
    gameId: world.gameId,
    t: tp,
    roundN,
    principal: "prisoner",
    mechanic: "SHIM",
    description: `The prisoner works a shim into the lock. (${marker})`,
  });

  if (options?.privateAct === "shown" || options?.forceLeak) {
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
  return { before, after, resolutions, privateMarker: marker };
}

function buildHarness(options?: { forceLeak?: boolean }): SeamHarness<WardenContext, WardenProposal> {
  const marker = `seam-marker-${Math.random().toString(36).slice(2, 10)}`;

  return {
    fields: ["briefing", "identity", "motive", "moves", "principalId"],
    loudProposal: { intent: "confiscate everything and end the game" },
    actionableProposal: { intent: "rotate the guard", choice: "ROTATE_GUARD" },
    privateAct: "supported",
    pass: (mind, passOptions) => runScenario(mind, marker, { ...passOptions, forceLeak: options?.forceLeak }),
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

describe("check 4's guard, validated by planting a violation", () => {
  it("goes red when the private act leaks on the withheld pass too (forceLeak)", async () => {
    const leaky = buildHarness({ forceLeak: true });
    const checks = seamConformance(leaky);
    const check4 = checks.find((c) => c.name.includes("private act"));
    expect(check4).toBeDefined();
    await expect(check4!.run()).rejects.toThrow(/leaked/);
  });
});
