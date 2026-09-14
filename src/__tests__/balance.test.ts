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
import { buildResolver, checkGameEnd, ESCAPE_GUARD_MAX, SEARCH_SUSPICION_THRESHOLD, isWardenAway } from "../world/mechanics.js";
import { authorPlan, renderLedger, mostRecentWardenMechanic, type Plan } from "../ledger/ledger.js";
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

  it("coordinator's fix, item 2(a) -- a prisoner who files ONLY while the warden is away ESCAPES against a warden who alternates OBSERVE and CHECK_LOCK", async () => {
    fresh();
    // The warden alternates a cell move (OBSERVE) and an away move
    // (CHECK_LOCK), oblivious to what the prisoner is doing -- it never
    // adapts, so this is purely the presence rule's own effect, not a
    // reactive warden being outsmarted move-by-move.
    let wardenTurn = 0;
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => {
      wardenTurn += 1;
      return wardenTurn % 2 === 1 ? "OBSERVE" : "CHECK_LOCK";
    });
    // The prisoner FILEs only when the warden's own last logged move was
    // AWAY (never while watched, so warden_suspicion never rises and
    // SEARCH never gets grounds); once the bar is worn through, it waits
    // out guard_attention's own ordinary time-decay and escapes -- success
    // depends only on the guard, never on presence (coordinator's fix,
    // item 2's own "keep it simple" instruction).
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => {
      const barIntegrity = getResource(world.resources.barIntegrity)?.value ?? 100;
      const guard = getResource(world.resources.guardAttention)?.value ?? 100;
      const cutEnough = barIntegrity <= 0;
      if (cutEnough && guard < ESCAPE_GUARD_MAX) return "ESCAPE";
      if (cutEnough) return "WAIT";
      const away = isWardenAway(mostRecentWardenMechanic(world.gameId) ?? "");
      return away ? "FILE" : "WAIT";
    });

    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    let ended: ReturnType<typeof checkGameEnd> = null;
    let endedAtRound = -1;
    for (let n = 1; n <= 40 && !ended; n++) {
      await runRound({ world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker });
      ended = checkGameEnd(world, world.clock.prisonerT(n));
      if (ended) endedAtRound = n;
    }

    expect(ended).toEqual({ kind: "escaped" });
    expect(endedAtRound).toBeGreaterThan(0);
    // REVISION (evidence becomes grounds, this task's brief item 1): FILE's
    // own DIRECT suspicion bump still never fires while away -- that gate is
    // unchanged and unit-tested on its own in mechanics.test.ts. But OBSERVE
    // is a SEPARATE, orthogonal evidence channel: every OBSERVE this warden
    // makes can still notice the bar has worn down since its own last
    // belief, so warden_suspicion CAN legitimately rise here now, and does.
    // What still holds is the point this test exists to prove: this
    // scripted warden never ADAPTS to that suspicion (it only ever
    // alternates OBSERVE/CHECK_LOCK, never SEARCH), so grounds existing is
    // not the same as grounds being used, and the escape still succeeds.
  });

  it("coordinator's fix, item 2(b) -- a prisoner who files while WATCHED (the warden never leaves the cell) is CAUGHT", async () => {
    fresh();
    // The warden only ever uses cell moves (OBSERVE, then SEARCH once it
    // has grounds) -- always present, always watching.
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => {
      const suspicion = getResource(world.resources.wardenSuspicion)?.value ?? 0;
      return suspicion >= SEARCH_SUSPICION_THRESHOLD ? "SEARCH" : "OBSERVE";
    });
    // The prisoner files relentlessly regardless of presence -- exactly the
    // mistake item 2(a)'s prisoner avoids.
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => "FILE");

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

  it("the covert REPLACE_BAR irony path (coordinator's fix, item 1 -- SET moves declare no expects): prisoner FILE, warden OBSERVE, warden's FIRST REPLACE_BAR succeeds covertly, prisoner FILE refused with the cause naming the warden's REPLACE_BAR, and its belief updates", async () => {
    fresh();
    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    // Round 1: the prisoner FILEs (bar 100 -> 85). Its OWN belief updates
    // immediately, from its own outcome (channel a).
    const t1 = world.clock.prisonerT(1);
    const fileMind = { async consider() { return { intent: "file", choice: "FILE" } as PrisonerProposal; } };
    await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 1, t: t1, context: buildPrisonerContext(world, prisonerPlan, t1), mind: fileMind, tracker: prisonerTracker });
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 85, asOfRound: 1 });

    // The warden OBSERVEs -- sees the bar only as a band ("worn"), never an
    // exact number. Purely narrative motivation now: REPLACE_BAR is a SET
    // move (`EXPECTS_RESOURCE_FOR_MOVE`, `ledger/beliefs.ts`) and declares no
    // expectation on the prior value at all, so the warden's own belief
    // (accurate or not) plays no part in whether it succeeds.
    const tw1 = world.clock.wardenT(2);
    const observeMind = { async consider() { return { intent: "observe", choice: "OBSERVE" } as WardenProposal; } };
    const observeHalf = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 2, t: tw1, context: buildWardenContext(world, wardenPlan, tw1), mind: observeMind, tracker: wardenTracker });
    expect(observeHalf.result.kind).toBe("resolved");

    // The warden's FIRST REPLACE_BAR succeeds directly -- covert (this
    // task's revision: it happens while the prisoner is in the yard). The
    // bar resets to 100; the prisoner is never told.
    const tw2 = world.clock.wardenT(3);
    const replaceMind = { async consider() { return { intent: "replace the bar", choice: "REPLACE_BAR" } as WardenProposal; } };
    const replaceHalf = await runHalfRound({ world, resolver, plan: wardenPlan, principal: "warden", roundN: 3, t: tw2, context: buildWardenContext(world, wardenPlan, tw2), mind: replaceMind, tracker: wardenTracker });
    expect(replaceHalf.result.kind).toBe("resolved");
    expect(getResource(world.resources.barIntegrity)?.value).toBe(100);
    // Still stale: the covert act did not touch the prisoner's belief.
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 85, asOfRound: 1 });

    // The prisoner FILEs again, expecting its own stale belief (85) --
    // refused. This IS the intended dramatic-irony beat: the prisoner is
    // contradicted by the WARDEN's covert act, never by its own.
    const t2 = world.clock.prisonerT(4);
    const fileAgainMind = { async consider() { return { intent: "file again", choice: "FILE" } as PrisonerProposal; } };
    const half = await runHalfRound({ world, resolver, plan: prisonerPlan, principal: "prisoner", roundN: 4, t: t2, context: buildPrisonerContext(world, prisonerPlan, t2), mind: fileAgainMind, tracker: prisonerTracker });

    expect(half.result.kind).toBe("refused");
    // The refusal reveals the truth into the prisoner's own belief.
    expect(getBelief(world.gameId, "prisoner", "bar_integrity")).toEqual({ value: 100, asOfRound: 4 });

    // The ledger names WHOSE act caused the refusal -- the warden's
    // REPLACE_BAR, never the prisoner's own.
    const rendered = renderLedger(world.gameId, prisonerPlan);
    expect(rendered).toContain("warden's REPLACE_BAR");
  });

  it("coordinator's fix, item 1(a) -- evidence becomes grounds: a QUIET shimmer against a warden who CHECK_LOCKs every other round GETS GROUNDS, then is CAUGHT by SEARCH", async () => {
    fresh();
    // SHIM itself stays silent regardless (no direct suspicion bump, ever,
    // present or away) -- this is the exact gap item 1 exists to close: the
    // warden's own thoughts, from a real run, were "I can't directly raise
    // suspicion." Finding the damage is what closes it now.
    let wardenTurn = 0;
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => {
      const suspicion = getResource(world.resources.wardenSuspicion)?.value ?? 0;
      if (suspicion >= SEARCH_SUSPICION_THRESHOLD) return "SEARCH";
      wardenTurn += 1;
      return wardenTurn % 2 === 1 ? "CHECK_LOCK" : "WAIT";
    });
    // A truly naive prisoner: shims every single turn, never checking
    // whether it is already done or whether escaping is now possible.
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => "SHIM");

    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    let ended: ReturnType<typeof checkGameEnd> = null;
    let endedAtRound = -1;
    let sawGrounds = false;
    for (let n = 1; n <= 20 && !ended; n++) {
      await runRound({ world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker });
      if ((getResource(world.resources.wardenSuspicion)?.value ?? 0) >= SEARCH_SUSPICION_THRESHOLD) sawGrounds = true;
      ended = checkGameEnd(world, world.clock.prisonerT(n));
      if (ended) endedAtRound = n;
    }

    expect(sawGrounds).toBe(true);
    expect(ended).toEqual({ kind: "caught" });
    expect(endedAtRound).toBeGreaterThan(0);
  });

  it("coordinator's fix, item 1(b) -- a shimmer who INSPECTs first and times its shims around the warden's checks can still ESCAPE", async () => {
    fresh();
    // The SAME warden script as item 1(a) -- every other round CHECK_LOCK,
    // reactive SEARCH once it has grounds.
    let wardenTurn = 0;
    const wardenMind = adaptiveMind<WardenContext, WardenProposal>(() => {
      const suspicion = getResource(world.resources.wardenSuspicion)?.value ?? 0;
      if (suspicion >= SEARCH_SUSPICION_THRESHOLD) return "SEARCH";
      wardenTurn += 1;
      return wardenTurn % 2 === 1 ? "CHECK_LOCK" : "WAIT";
    });
    // The smart prisoner: opens with INSPECT (learns the true lock and
    // guard, costing it one round it could have spent shimming), which
    // shifts every later shim off the warden's own check parity -- so its
    // FINAL shim always lands on a round the warden does NOT check, and the
    // warden's next check (which crosses the grounds threshold) reveals a
    // cell that is ALREADY fully open. The prisoner's own turn that SAME
    // round is then free to escape, one full warden turn before a reactive
    // SEARCH ever gets a chance to fire.
    let prisonerTurn = 0;
    const prisonerMind = adaptiveMind<PrisonerContext, PrisonerProposal>(() => {
      prisonerTurn += 1;
      const lock = getResource(world.resources.lockIntegrity)?.value ?? 100;
      const guard = getResource(world.resources.guardAttention)?.value ?? 100;
      if (lock <= 0 && guard < ESCAPE_GUARD_MAX) return "ESCAPE";
      if (prisonerTurn === 1) return "INSPECT";
      return "SHIM";
    });

    const wardenTracker = newSilenceTracker();
    const prisonerTracker = newSilenceTracker();

    let ended: ReturnType<typeof checkGameEnd> = null;
    let endedAtRound = -1;
    for (let n = 1; n <= 20 && !ended; n++) {
      await runRound({ world, resolver, prisonerPlan, wardenPlan, n, wardenMind, prisonerMind, wardenTracker, prisonerTracker });
      ended = checkGameEnd(world, world.clock.prisonerT(n));
      if (ended) endedAtRound = n;
    }

    expect(ended).toEqual({ kind: "escaped" });
    expect(endedAtRound).toBeGreaterThan(0);
  });
});
