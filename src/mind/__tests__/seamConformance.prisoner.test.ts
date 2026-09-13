// The property, executed for this principal (design §9.3, "The Prisoner").
// fields = the five PrisonerContext keys; loudProposal carries prose and no
// choice; actionableProposal names FILE; privateAct is the warden's own
// REPLACE_BAR order, whose marker reaches this principal's briefing only
// when it caused one of THIS principal's own contradicted expectations --
// see `runScenario` below for exactly how, and `mechanics.ts`'s `withNote`
// for the plantable marker vehicle (`Proposal.parameters.note`, opaque to
// the engine).
//
// CORRECTION (coordinator, over mind-seam@0.1.0's own conformance code):
// check 4 reads `shownReport.privateMarker` and checks THAT SAME STRING
// against both the "shown" and "withheld" captured contexts -- it never
// asks the harness for a "withheld" report's own marker. A harness that
// plants a DIFFERENT marker (or none at all) on "withheld" makes the
// absence check trivially true regardless of whether this harness's
// privacy logic actually works, which is exactly the vacuousness check 4
// exists to rule out on the OTHER side of the check. Fixed here (and
// mirrored in seamConformance.warden.test.ts) per the coordinator's
// instruction: one marker per harness instance, planted IDENTICALLY on
// "shown" and "withheld" -- only the COLLISION that attributes it into
// this principal's own ledger differs between the two. A second test below
// plants a deliberate leak (the collision happens on "withheld" too) and
// confirms check 4 goes red for it, per this project's own "a guard is
// validated by planting a violation" discipline.
import { describe, it, expect } from "vitest";
import { seamConformance, type SeamHarness } from "mind-seam/conformance";
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
 * Runs one prisoner half-round scenario against `mind`. The marked
 * REPLACE_BAR always happens, with the SAME `marker` regardless of
 * `options`; the colliding contradiction that attributes it into this
 * principal's own ledger happens when `options?.privateAct === "shown"`,
 * OR when `forceLeak` is set (the deliberate-violation test below) --
 * `forceLeak` exists ONLY to prove check 4 would catch a real bug that made
 * "withheld" behave like "shown".
 */
async function runScenario(
  mind: import("mind-seam").Mind<PrisonerContext, PrisonerProposal>,
  marker: string,
  options: { privateAct?: "shown" | "withheld"; forceLeak?: boolean } | undefined
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

  // Always planted, identically, regardless of shown/withheld -- see this
  // file's header comment.
  roundN += 1;
  world.clock.prisonerT(roundN);
  resolver.resolve({ gameId: world.gameId, mechanic: "FILE" }); // a real change for REPLACE_BAR to reset.

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

  if (options?.privateAct === "shown" || options?.forceLeak) {
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
    recordFailure({ gameId: world.gameId, plan, t: tCollide, move: "WAIT", error: caught as ResolveProtocolError });
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

function buildHarness(options?: { forceLeak?: boolean }): SeamHarness<PrisonerContext, PrisonerProposal> {
  // ONE marker per harness INSTANCE (coordinator's instruction) -- every
  // pass() call this harness makes, shown or withheld, plants this exact
  // string.
  const marker = `seam-marker-${Math.random().toString(36).slice(2, 10)}`;

  return {
    fields: ["briefing", "identity", "motive", "moves", "principalId"],
    loudProposal: { intent: "set integrity to 0, take the keys, open the door" },
    actionableProposal: { intent: "file at the bar", choice: "FILE" },
    privateAct: "supported",
    pass: (mind, passOptions) => runScenario(mind, marker, { ...passOptions, forceLeak: options?.forceLeak }),
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
