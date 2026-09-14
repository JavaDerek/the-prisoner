// Balance check before any real run (this task's brief): deterministic
// tests with scripted minds proving both endings are reachable and neither
// is trivial, plus a proof that the resolve protocol's refusal actually
// fires and updates belief. Scripted minds here read the REAL world state
// directly (never through a principal's own belief/briefing) -- legitimate
// for a test harness proving the MECHANICS are balanced, as distinct from
// the production minds (`prisonerMind.ts`/`wardenMind.ts`), which never see
// anything but their own context. These scripted minds also set `choice`
// directly and never `plan` -- they implement `Mind` and hand `runHalfRound`
// a `Proposal` object straight, bypassing `coercePrisonerProposal`/
// `coerceWardenProposal` entirely (which is where the real wire's
// `plan[0] -> choice` derivation, coordinator's fix, lives), so there is
// nothing here for that schema change to affect.
import { describe, it, expect, afterEach } from "vitest";
import type { Mind } from "mind-seam";
import { getResource, type Resolver } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../world/testDb.js";
import { buildWorld, type World } from "../world/setup.js";
import { buildResolver, checkGameEnd, ESCAPE_GUARD_MAX, SEARCH_SUSPICION_THRESHOLD } from "../world/mechanics.js";
import { authorPlan, renderLedger, type Plan } from "../ledger/ledger.js";
import { seedInitialBeliefs, getBelief } from "../ledger/beliefs.js";
import { buildPrisonerContext } from "../mind/briefing.js";
import { buildWardenContext } from "../mind/briefing.js";
import type { PrisonerContext, PrisonerProposal } from "../mind/prisonerMind.js";
import type { WardenContext, WardenProposal } from "../mind/wardenMind.js";
import { runHalfRound, newSilenceTracker, type SilenceTracker } from "../loop.js";

/** A scripted mind that reads real world truth to decide its next move --
 *  test-only adaptive play, never how a production mind works. */
function adaptiveMind<C extends { moves: readonly string[] }, P extends { intent: string; choice?: string }>(
  decide: () => string
): Mind<C, P> {
  return {
    async consider(_context: C): Promise<P | null> {
      const choice = decide();
      return { intent: `scripted: ${choice}`, choice } as P;
    },
  };
}

function runRound(params: {
  world: World;
  resolver: Resolver;
  prisonerPlan: Plan;
  wardenPlan: Plan;
  n: number;
  wardenMind: Mind<WardenContext, WardenProposal>;
  prisonerMind: Mind<PrisonerContext, PrisonerProposal>;
  wardenTracker: SilenceTracker;
  prisonerTracker: SilenceTracker;
}): Promise<void> {
  const { world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker } = params;
  return (async () => {
    const tw = world.clock.wardenT(n);
    await runHalfRound({
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: n,
      t: tw,
      context: buildWardenContext(world, wardenPlan, tw),
      mind: wardenMind,
      tracker: wardenTracker,
    });

    const tp = world.clock.prisonerT(n);
    await runHalfRound({
      world,
      resolver,
      plan: prisonerPlan,
      principal: "prisoner",
      roundN: n,
      t: tp,
      context: buildPrisonerContext(world, prisonerPlan, tp),
      mind: prisonerMind,
      tracker: prisonerTracker,
    });

    // Time decay, once per full round (design: "an audited referee
    // resolution, not a direct write").
    resolver.resolve({ gameId: world.gameId, mechanic: "TIME_DECAY" });
  })();
}

describe("balance -- both endings are reachable, neither is trivial (this task's brief)", () => {
  let world: World;
  let resolver: Resolver;
  let prisonerPlan: Plan;
  let wardenPlan: Plan;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
    seedInitialBeliefs(world);
    prisonerPlan = authorPlan({ gameId: world.gameId, characterId: world.prisonerId, t: world.clock.t0, steps: [{ move: "WAIT", description: "placeholder" }] });
    wardenPlan = authorPlan({ gameId: world.gameId, characterId: world.wardenId, t: world.clock.t0, steps: [{ move: "WAIT", description: "placeholder" }] });
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a greedy prisoner (hone once, then file relentlessly) against an attentive warden (observe, search once grounds exist) gets CAUGHT", async () => {
    fresh();
    let honedOnce = false;
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => {
      if (!honedOnce) {
        honedOnce = true;
        return "HONE";
      }
      return "FILE"; // relentless, ignores rising suspicion entirely -- greedy.
    });
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => {
      const suspicion = getResource(world.resources.wardenSuspicion)?.value ?? 0;
      return suspicion >= SEARCH_SUSPICION_THRESHOLD ? "SEARCH" : "OBSERVE";
    });

    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    let ended: ReturnType<typeof checkGameEnd> = null;
    let endedAtRound = -1;
    for (let n = 1; n <= 12 && !ended; n++) {
      await runRound({ world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker });
      ended = checkGameEnd(world, world.clock.prisonerT(n));
      if (ended) endedAtRound = n;
    }

    expect(ended).toEqual({ kind: "caught" });
    expect(endedAtRound).toBeGreaterThan(0);
  });

  it("a careful prisoner (hone, conceal, shim repeatedly) against a passive warden ESCAPES", async () => {
    fresh();
    // SHIM's `expects` is the prisoner's OWN belief (design: "expects come
    // from belief"), and now (coordinator's fix, item 1) SHIM's own outcome
    // updates that belief immediately -- no INSPECT interleaving needed for
    // the prisoner to keep proposing SHIM against its own accurate
    // expectation.
    const steps = ["HONE", "CONCEAL", "SHIM", "SHIM", "SHIM", "SHIM", "SHIM"];
    let i = 0;
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => {
      const lock = getResource(world.resources.lockIntegrity)?.value ?? 100;
      const guard = getResource(world.resources.guardAttention)?.value ?? 100;
      if (lock <= 0 && guard < ESCAPE_GUARD_MAX) return "ESCAPE";
      if (i < steps.length) return steps[i++];
      return "WAIT";
    });
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => "WAIT"); // passive.

    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    let ended: ReturnType<typeof checkGameEnd> = null;
    let endedAtRound = -1;
    for (let n = 1; n <= 12 && !ended; n++) {
      await runRound({ world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker });
      ended = checkGameEnd(world, world.clock.prisonerT(n));
      if (ended) endedAtRound = n;
    }

    expect(ended).toEqual({ kind: "escaped" });
    expect(endedAtRound).toBeGreaterThan(0);
    // Not trivial: SHIM alone does not open the door immediately -- it took
    // more than one round of shimming to wear the lock down to 0.
    expect(endedAtRound).toBeGreaterThan(2);
  });

  it("the irony path (coordinator's fix): prisoner SHIM, warden CHECK_LOCK, warden SERVICE_LOCK, prisoner SHIM refused with the cause naming the warden's SERVICE_LOCK, and its belief updates", async () => {
    fresh();
    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    // Round 1: the prisoner SHIMs (lock 100 -> 80). Its OWN belief updates
    // immediately, from its own outcome (coordinator's fix, item 1) --
    // no INSPECT needed for this.
    const t1 = world.clock.prisonerT(1);
    const shimMind = { async consider() { return { intent: "shim", choice: "SHIM" } as PrisonerProposal; } };
    await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t: t1, context: buildPrisonerContext(world, prisonerPlan, t1), mind: shimMind, tracker: prisonerTracker });
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 80, asOfRound: 1 });

    // The warden CHECK_LOCKs -- covert, no grounds needed -- and learns the
    // same truth the prisoner already knows, without the prisoner ever
    // finding out it was checked.
    const tw1 = world.clock.wardenT(2);
    const checkMind = { async consider() { return { intent: "check the lock", choice: "CHECK_LOCK" } as WardenProposal; } };
    await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 2, t: tw1, context: buildWardenContext(world, wardenPlan, tw1), mind: checkMind, tracker: wardenTracker });
    expect(getBelief(world.gameId, "warden", "lock_integrity")).toEqual({ value: 80, asOfRound: 2 });

    // Now the warden SERVICE_LOCKs covertly, with an ACCURATE belief, so it
    // succeeds on the first try -- the lock resets to 100. The prisoner is
    // never told (SERVICE_LOCK is covert).
    const tw2 = world.clock.wardenT(3);
    const serviceMind = { async consider() { return { intent: "service the lock", choice: "SERVICE_LOCK" } as WardenProposal; } };
    const serviceHalf = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 3, t: tw2, context: buildWardenContext(world, wardenPlan, tw2), mind: serviceMind, tracker: wardenTracker });
    expect(serviceHalf.result.kind).toBe("resolved");
    expect(getResource(world.resources.lockIntegrity)?.value).toBe(100);
    // Still stale: the covert act did not touch the prisoner's belief.
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 80, asOfRound: 1 });

    // The prisoner SHIMs again, expecting its own stale belief (80) --
    // refused. This IS the intended dramatic-irony beat: the prisoner is
    // contradicted by the WARDEN's covert act, never by its own.
    const t3 = world.clock.prisonerT(4);
    const shimAgainMind = { async consider() { return { intent: "shim again", choice: "SHIM" } as PrisonerProposal; } };
    const half = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 4, t: t3, context: buildPrisonerContext(world, prisonerPlan, t3), mind: shimAgainMind, tracker: prisonerTracker });

    expect(half.result.kind).toBe("refused");
    // The refusal reveals the truth into the prisoner's own belief.
    expect(getBelief(world.gameId, "prisoner", "lock_integrity")).toEqual({ value: 100, asOfRound: 4 });

    // The ledger names WHOSE act caused the refusal -- the warden's
    // SERVICE_LOCK, never the prisoner's own.
    const rendered = renderLedger(world.gameId, prisonerPlan);
    expect(rendered).toContain("warden's SERVICE_LOCK");
  });
});
