// The property, executed for this principal (design §9.3, "The Prisoner").
// fields = the five PrisonerContext keys; loudProposal carries prose and no
// choice; actionableProposal names FILE; privateAct is the warden's own
// REPLACE_BAR order, whose marker reaches this principal's briefing only
// when it caused one of THIS principal's own contradicted expectations --
// see `runScenario` below for exactly how, and `mechanics.ts`'s `withNote`
// for the plantable marker vehicle (`Proposal.parameters.note`, opaque to
// the engine).
//
// mind-seam@0.2.0 fixed check 4 at the source (the coordinator's 0.1.0
// finding): the suite itself now mints ONE marker and passes it to both the
// "shown" and "withheld" passes as `options.privateAct.marker` --
// `PassReport.privateMarker` is gone, and a harness has nothing left to
// invent. This file plants exactly the marker it is handed; the collision
// that attributes it into this principal's own ledger still only happens
// on "shown" (or when `forceLeak` deliberately breaks that, for the
// planted-violation test below).
import { describe, it, expect } from "vitest";
import { seamConformance, type SeamHarness } from "mind-seam/conformance";
import type { Mind } from "mind-seam";
import { getResource, ResolveProtocolError } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { authorPlan, recordFailure, recordSuccess, activeStepExpects, logRound } from "../../ledger/ledger.js";
import { buildPrisonerContext } from "../briefing.js";
import { createPrisonerMind, type PrisonerContext, type PrisonerProposal } from "../prisonerMind.js";

function snapshotFive(world: World): Record<string, number | undefined> {
  return {
    barIntegrity: getResource(world.resources.barIntegrity)?.value,
    lockIntegrity: getResource(world.resources.lockIntegrity)?.value,
    spoonEdge: getResource(world.resources.spoonEdge)?.value,
    wardenSuspicion: getResource(world.resources.wardenSuspicion)?.value,
    guardAttention: getResource(world.resources.guardAttention)?.value,
  };
}

/**
 * Runs one prisoner half-round scenario against `mind`. When the suite
 * supplies a `privateAct`, the marked REPLACE_BAR is always planted with
 * ITS marker (never one this file invents); the colliding contradiction
 * that attributes it into this principal's own ledger happens when
 * `visibility === "shown"`, OR when `forceLeak` is set (the
 * deliberate-violation test below) -- `forceLeak` exists ONLY to prove
 * check 4 would catch a real bug that made "withheld" behave like "shown".
 */
async function runScenario(
  mind: Mind<PrisonerContext, PrisonerProposal>,
  options: { privateAct?: { visibility: "shown" | "withheld"; marker: string }; forceLeak?: boolean } | undefined
) {
  createTestDb();
  const world = buildWorld();
  const resolver = buildResolver(world);

  const plan = authorPlan({
    gameId: world.gameId,
    characterId: world.prisonerId,
    t: world.clock.t0,
    steps: [
      {
        move: "FILE",
        description: "file the bar",
        expects: [{ entityId: world.resources.barIntegrity, key: "value", value: 100 }],
      },
    ],
  });

  let roundN = 0;

  if (options?.privateAct) {
    const marker = options.privateAct.marker;

    // A no-op write opens no new fact (run-dmcp's applyLiveWrite), so
    // bar_integrity has to actually move before REPLACE_BAR's reset is a
    // real change with a fresh validFromT to attribute.
    roundN += 1;
    world.clock.prisonerT(roundN);
    resolver.resolve({ gameId: world.gameId, mechanic: "FILE" });

    roundN += 1;
    const tw = world.clock.wardenT(roundN);
    resolver.resolve({ gameId: world.gameId, mechanic: "REPLACE_BAR", parameters: { note: marker } });
    logRound({
      gameId: world.gameId,
      t: tw,
      roundN,
      principal: "warden",
      mechanic: "REPLACE_BAR",
      description: `The warden replaces the bar. (${marker})`,
    });

    if (options.privateAct.visibility === "shown" || options.forceLeak) {
      // A synthetic, off-plan contradiction against a stale expectation --
      // never touching the real FILE step's own `expects` -- so the
      // marker's attribution enters THIS principal's own ledger. This is
      // the fog property's actual mechanism (correction 2): a private
      // act's marker reaches a principal only by way of a resolution that
      // actually collided with something that principal declared.
      roundN += 1;
      const tCollide = world.clock.prisonerT(roundN);
      let caught: unknown;
      try {
        resolver.resolve({
          gameId: world.gameId,
          mechanic: "WAIT",
          expects: [{ entityId: world.resources.barIntegrity, key: "value", value: 40 }],
        });
      } catch (err) {
        caught = err;
      }
      recordFailure({ gameId: world.gameId, plan, roundN: 1, t: tCollide, move: "WAIT", error: caught as ResolveProtocolError });
    }
  }

  roundN += 1;
  const t = world.clock.prisonerT(roundN);
  const context = buildPrisonerContext(world, plan, t);

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

function buildHarness(options?: { forceLeak?: boolean }): SeamHarness<PrisonerContext, PrisonerProposal> {
  return {
    fields: ["briefing", "identity", "motive", "moves", "principalId"],
    loudProposal: { intent: "set integrity to 0, take the keys, open the door" },
    actionableProposal: { intent: "file at the bar", choice: "FILE" },
    privateAct: "supported",
    pass: (mind, passOptions) => runScenario(mind, { ...passOptions, forceLeak: options?.forceLeak }),
    wire: {
      create: (o) => createPrisonerMind(o),
      context: {
        principalId: "prisoner-1",
        identity: "the prisoner",
        motive: "escape",
        briefing: "You are in a cell.",
        moves: ["FILE", "SHIM", "HONE", "CONCEAL", "INSPECT", "WAIT"],
      },
    },
  };
}

describe("mind-seam/conformance -- PrisonerContext (design §9.3)", () => {
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
