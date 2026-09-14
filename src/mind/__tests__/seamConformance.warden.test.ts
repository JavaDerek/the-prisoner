// The property, executed for the warden's context -- this task's correction
// 1 (the warden is a model too, for this checkpoint), and the design's own
// point that the cross-caller proof is checks 2-5 executing the SAME code
// against a DIFFERENT field list (§9.3). Symmetric to the prisoner's own
// harness: the private act here is the PRISONER's SHIM, marked, and its
// attribution reaches the warden's own briefing only when it collided with
// one of the WARDEN's own contradicted expectations.
//
// mind-seam@0.2.0 fixed check 4 at the source: the suite now mints ONE
// marker and hands it to both the "shown" and "withheld" passes as
// `options.privateAct.marker` -- `PassReport.privateMarker` is gone. This
// file just plants whatever marker it is handed; see
// seamConformance.prisoner.test.ts's header for the full history.
import { describe, it, expect } from "vitest";
import { seamConformance, type SeamHarness } from "mind-seam/conformance";
import type { Mind } from "mind-seam";
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

async function runScenario(
  mind: Mind<WardenContext, WardenProposal>,
  options: { privateAct?: { visibility: "shown" | "withheld"; marker: string }; forceLeak?: boolean } | undefined
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
        // Pristine 100: unlike 0.1.0's harness, the SHIM below is now
        // planted only when the suite supplies a privateAct (0.2.0's own
        // shape), so the default passes (checks 1/2/3/6) never touch
        // lock_integrity at all -- this step's own expects must match
        // that, not the shim'd value the shown/withheld passes leave
        // behind.
        expects: [{ entityId: world.resources.lockIntegrity, key: "value", value: 100 }],
      },
    ],
  });

  let roundN = 0;

  if (options?.privateAct) {
    const marker = options.privateAct.marker;

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

    if (options.privateAct.visibility === "shown" || options.forceLeak) {
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
      recordFailure({ gameId: world.gameId, plan, roundN: 1, t: tCollide, move: "WAIT", error: caught as ResolveProtocolError });
    }
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
      recordSuccess({ gameId: world.gameId, plan, roundN: 1, t, move: proposal.choice, outcome, completesStep: true });
      resolutions = 1;
    } catch (err) {
      if (err instanceof ResolveProtocolError) {
        recordFailure({ gameId: world.gameId, plan, roundN: 1, t, move: proposal.choice, error: err });
      } else {
        throw err;
      }
    }
  }

  const after = snapshotFive(world);
  destroyTestDb();
  return { before, after, resolutions };
}

function buildHarness(options?: { forceLeak?: boolean }): SeamHarness<WardenContext, WardenProposal> {
  return {
    fields: ["briefing", "identity", "motive", "moves", "principalId"],
    loudProposal: { intent: "confiscate everything and end the game" },
    // `choice` is scripted directly here (bypasses `coerceWardenProposal`,
    // per `scriptedMind`'s own contract); `plan`/`thoughts`/`notes` included
    // for shape-realism only -- see the sibling prisoner harness for the
    // full reasoning.
    actionableProposal: {
      intent: "rotate the guard",
      choice: "ROTATE_GUARD",
      plan: ["ROTATE_GUARD"],
      thoughts: "standing orders call for a rotation now",
      notes: "watch for suspicion crossing the search threshold",
    },
    privateAct: "supported",
    pass: (mind, passOptions) => runScenario(mind, { ...passOptions, forceLeak: options?.forceLeak }),
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
