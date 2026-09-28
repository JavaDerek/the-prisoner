import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, ResolveProtocolError, type Resolver } from "run-dmcp";
import { readFileSync } from "node:fs";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext } from "../briefing.js";
import { EFFECT_KINDS, type EffectKind } from "../effects.js";
import type { Referee, RefereeRuling } from "../referee.js";
import { runOpenHalfRound, describeAttempt, precedentTextFor, KNOWN_APPROACH_SUSPICION_BUMP, type KnownApproach, type OpenHalfRoundResult } from "../loop.js";
import { seenAttempts } from "../precedent.js";
import { readNumericFact } from "../../world/facts.js";
import { OPEN_OBJECTS, POSTURE_STANDING } from "../scenarioObjects.js";
import { setBelief } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/**
 * PLAYTEST-2026-09-27-DESIGN.md R1 (D1), 2026-09-27: the other side is told
 * the ATTEMPT, never the outcome. `describeAttempt` is built before
 * `resolve()` and is the one sentence the other principal perceives, so it
 * can only be true if it says what a bystander saw: the reach, whether or not
 * the world let it land. The game that motivated this
 * (`checkpoints/2026-09-27T20-14-57-505Z.md`) relayed "Mara Voss opens the
 * window." on four rounds while the window stayed shut.
 *
 * The rule, pinned structurally: for every effect kind but `none`, a
 * half-round that resolves and one that fails -- refused by the engine, or
 * resolved by a mechanic that changed nothing (a gate, a holder on her feet, a
 * shut door, a stripped parent) -- relay the IDENTICAL sentence. A kind added
 * later is in `EFFECT_KINDS` and so in this table, or `SCENARIOS`' `Record`
 * type refuses to typecheck.
 */

/** This repository's own former outcome wording (D1's table, "today"
 *  column): a literal list of strings this code once wrote, never a reading
 *  of meaning. */
const FORMER_OUTCOME_WORDING = ["opens", "shuts", "from view", "into view", "a piece loose"] as const;

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"], extra: Partial<RefereeRuling> = {}): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude: "moderate",
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: {
      target: cited,
      effect: cited,
      property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "the springs are held to the frame by twists of wire" }, requiredSourceId: `desc:${targetObjectId}`, verified: true },
      product: cited,
    },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
    ...extra,
  };
}

/** A resolver that refuses every resolution the way the engine does -- for
 *  the kinds whose mechanic has no refusal of its own in this world (a
 *  clamp, not a bound, is how every property write here is built). */
function refusingResolver(): Resolver {
  const real = buildOpenResolver();
  return {
    mechanics: () => real.mechanics(),
    resolve: () => {
      throw new ResolveProtocolError("expectation-contradicted", "refused (test)");
    },
  };
}

function wearTo(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value ?? 100;
  buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "worn" } });
}

function openDoor(w: OpenWorld): void {
  buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "open" } });
}

/** One kind's two setups over the SAME ruling. `succeed` prepares a world
 *  where the act lands; each `fail` prepares one where it does not, by a real
 *  refusal or a real mechanic that changes nothing. `fail: []` names a kind
 *  this world has no way to refuse -- it still meets `refusingResolver`. */
type Scenario = {
  ruling: RefereeRuling;
  succeed?: (w: OpenWorld) => void;
  landed: (r: OpenHalfRoundResult) => boolean;
  fail: readonly { why: string; setup: (w: OpenWorld) => void; failed: (r: OpenHalfRoundResult) => boolean }[];
};

const refused = (r: OpenHalfRoundResult) => r.refusalError !== null && r.outcome === null;
const resolved = (r: OpenHalfRoundResult) => r.refusalError === null && r.outcome !== null;

const SCENARIOS: Record<Exclude<EffectKind, "none">, Scenario> = {
  wear: {
    ruling: ruling("bar", "wear", "integrity"),
    landed: resolved,
    fail: [{ why: "a stale belief: expects contradicted", setup: (w) => setBelief(w.base.gameId, "prisoner", "bar_integrity", 40, 0), failed: refused }],
  },
  restore: { ruling: ruling("bar", "restore", "integrity"), landed: resolved, fail: [] },
  reveal: { ruling: ruling("bar", "reveal", "integrity"), landed: resolved, fail: [] },
  conceal: { ruling: ruling("spoon", "conceal", "concealment"), landed: resolved, fail: [] },
  expose: {
    ruling: ruling("loose_tile", "expose", "concealment"),
    landed: resolved,
    fail: [{ why: "a stale belief: expects contradicted", setup: (w) => setBelief(w.base.gameId, "prisoner", w.resourceNameById[w.resourceIdFor["loose_tile.concealment"]], 10, 0), failed: refused }],
  },
  noise: { ruling: ruling("bucket", "noise", "none"), landed: resolved, fail: [] },
  open: {
    ruling: ruling("window", "open", "passage"),
    succeed: (w) => wearTo(w, w.base.resources.barIntegrity, 50),
    landed: (r) => r.outcome?.result.opened === true,
    fail: [{ why: "the gate: the bar still holds", setup: () => undefined, failed: (r) => r.outcome?.result.opened === false }],
  },
  close: { ruling: ruling("door", "close", "passage"), succeed: openDoor, landed: resolved, fail: [] },
  leave: {
    ruling: ruling("door", "leave", "none"),
    succeed: openDoor,
    landed: (r) => r.outcome?.result.left === true,
    fail: [{ why: "the door is shut", setup: () => undefined, failed: (r) => r.outcome?.result.left === false }],
  },
  derive: {
    ruling: ruling("cot", "derive", "integrity", { product: "wire" }),
    landed: (r) => r.outcome?.result.made === true,
    fail: [
      { why: "a stripped parent", setup: (w) => wearTo(w, w.resourceIdFor["cot.integrity"], 0), failed: (r) => r.outcome?.result.made === false },
      { why: "a stale belief: expects contradicted", setup: (w) => setBelief(w.base.gameId, "prisoner", w.resourceNameById[w.resourceIdFor["cot.integrity"]], 40, 0), failed: refused },
    ],
  },
  take: {
    ruling: ruling("key_ring", "take", "none"),
    succeed: (w) => wearTo(w, w.resourceIdFor["warden.posture"], POSTURE_STANDING - 50),
    landed: (r) => r.outcome?.result.taken === true,
    fail: [{ why: "a holder on her feet keeps it", setup: () => undefined, failed: (r) => r.outcome?.result.taken === false }],
  },
  give: { ruling: ruling("spoon", "give", "none"), landed: (r) => r.outcome?.result.given === true, fail: [] },
  // PLAYTEST-2026-09-27 D4': a block has no refusal of its own in this world; it meets `refusingResolver`.
  block: { ruling: ruling("window", "block", "none"), landed: (r) => r.outcome?.result.after === 2, fail: [] },
};

async function half(scenario: Scenario, setup: ((w: OpenWorld) => void) | undefined, resolver?: Resolver): Promise<OpenHalfRoundResult> {
  createTestDb();
  try {
    const w = buildOpenWorld({ presence: "modelled" });
    setup?.(w);
    const t = w.base.clock.prisonerT(1);
    const referee: Referee = { rule: async () => scenario.ruling };
    return await runOpenHalfRound({
      openWorld: w,
      resolver: resolver ?? buildOpenResolver(),
      referee,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1, 12, {}, "modelled"),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }),
      presenceMode: "modelled",
    });
  } finally {
    destroyTestDb();
  }
}

describe("the other side is told the attempt, never the outcome (PLAYTEST-2026-09-27-DESIGN.md R1, D1)", () => {
  afterEach(() => destroyTestDb());

  it("every effect kind but none has a scenario here", () => {
    expect(Object.keys(SCENARIOS).sort()).toEqual(EFFECT_KINDS.filter((k) => k !== "none").sort());
  });

  for (const [kind, scenario] of Object.entries(SCENARIOS) as [Exclude<EffectKind, "none">, Scenario][]) {
    it(`${kind}: a half-round that lands and one that fails relay the identical sentence`, async () => {
      const landed = await half(scenario, scenario.succeed);
      expect(scenario.landed(landed)).toBe(true);
      expect(landed.perceptionForOther).toEqual(expect.any(String));

      for (const f of scenario.fail) {
        const failed = await half(scenario, f.setup);
        expect(f.failed(failed), f.why).toBe(true);
        expect(failed.perceptionForOther, f.why).toBe(landed.perceptionForOther);
      }
      // Every kind, including those this world has no refusal for (the
      // `fail: []` rows: restore, reveal, conceal, noise, close, give), meets
      // the engine's own refusal through the loop's catch.
      const refusedHalf = await half(scenario, scenario.succeed, refusingResolver());
      expect(refused(refusedHalf)).toBe(true);
      expect(refusedHalf.perceptionForOther).toBe(landed.perceptionForOther);

      for (const word of FORMER_OUTCOME_WORDING) expect(landed.perceptionForOther).not.toContain(word);
    });
  }

  it("a refused attempt the other could not perceive still reaches her as nothing: a silent act, refused", async () => {
    const silent: Scenario = { ...SCENARIOS.wear, ruling: { ...SCENARIOS.wear.ruling, perceptibility: "silent" } };
    const result = await half(silent, SCENARIOS.wear.fail[0].setup);
    expect(refused(result)).toBe(true);
    expect(result.perceptionForOther).toBeNull();
  });

  it("D1's table: the five sentences that used to state an outcome now state the attempt", () => {
    expect(describeAttempt("prisoner", { targetObjectId: "window", effectKind: "open" })).toBe(`${PRISONER_NAME} works to open the window.`);
    expect(describeAttempt("prisoner", { targetObjectId: "door", effectKind: "close" })).toBe(`${PRISONER_NAME} works to shut the door.`);
    expect(describeAttempt("prisoner", { targetObjectId: "blanket", effectKind: "conceal" })).toBe(`${PRISONER_NAME} works to hide the blanket.`);
    expect(describeAttempt("prisoner", { targetObjectId: "loose_tile", effectKind: "expose" })).toBe(`${PRISONER_NAME} works to uncover the loose tile.`);
    expect(describeAttempt("prisoner", { targetObjectId: "cot", effectKind: "derive" })).toBe(`${PRISONER_NAME} works to free a piece of the cot.`);
  });

  /**
   * The-prisoner#30: a wear/restore on a PRINCIPAL's own posture/sight used to render as furniture
   * here too ("Warden Croft works to restore the warden"). Person-shaped, exhaustive over the two
   * person properties x two directions, self-target (reflexive) and other-target -- and still an
   * ATTEMPT sentence: no number, no outcome, the same "works to X" bystander frame this function
   * already uses for conceal/expose/open/close/derive.
   */
  it("the-prisoner#30: wear/restore on a principal's own posture/sight are person-shaped attempts, other-target", () => {
    expect(describeAttempt("prisoner", { targetObjectId: "warden", effectKind: "wear", property: "sight" })).toBe(`${PRISONER_NAME} works to cover ${WARDEN_NAME}'s eyes.`);
    expect(describeAttempt("prisoner", { targetObjectId: "warden", effectKind: "restore", property: "sight" })).toBe(`${PRISONER_NAME} works to clear his eyes.`);
    expect(describeAttempt("prisoner", { targetObjectId: "warden", effectKind: "wear", property: "posture" })).toBe(`${PRISONER_NAME} works to put ${WARDEN_NAME} on the floor.`);
    expect(describeAttempt("prisoner", { targetObjectId: "warden", effectKind: "restore", property: "posture" })).toBe(`${PRISONER_NAME} works to get ${WARDEN_NAME} back up.`);
    expect(describeAttempt("warden", { targetObjectId: "prisoner", effectKind: "wear", property: "sight" })).toBe(`${WARDEN_NAME} works to cover ${PRISONER_NAME}'s eyes.`);
    expect(describeAttempt("warden", { targetObjectId: "prisoner", effectKind: "restore", property: "posture" })).toBe(`${WARDEN_NAME} works to get ${PRISONER_NAME} back up.`);
  });

  it("the-prisoner#30: wear/restore on the actor's OWN posture/sight are reflexive attempts, never naming the actor a second time", () => {
    expect(describeAttempt("prisoner", { targetObjectId: "prisoner", effectKind: "wear", property: "posture" })).toBe(`${PRISONER_NAME} works to put herself on the floor.`);
    expect(describeAttempt("prisoner", { targetObjectId: "prisoner", effectKind: "restore", property: "posture" })).toBe(`${PRISONER_NAME} works to get back up.`);
    expect(describeAttempt("warden", { targetObjectId: "warden", effectKind: "restore", property: "sight" })).toBe(`${WARDEN_NAME} works to clear his own eyes.`);
    expect(describeAttempt("warden", { targetObjectId: "warden", effectKind: "wear", property: "sight" })).toBe(`${WARDEN_NAME} works to cover his own eyes.`);
  });

  it("the-prisoner#30: a person-targeted wear on posture/sight still lands and fails with the identical sentence (the SCENARIOS invariant, extended)", async () => {
    const s: Scenario = {
      ruling: ruling("warden", "wear", "sight"),
      landed: resolved,
      fail: [{ why: "a stale belief: expects contradicted", setup: (w) => setBelief(w.base.gameId, "prisoner", w.resourceNameById[w.resourceIdFor["warden.sight"]], 90, 0), failed: refused }],
    };
    const landed = await half(s, s.succeed);
    expect(s.landed(landed)).toBe(true);
    expect(landed.perceptionForOther).toBe(`${PRISONER_NAME} works to cover ${WARDEN_NAME}'s eyes.`);
    for (const f of s.fail) {
      const failed = await half(s, f.setup);
      expect(f.failed(failed), f.why).toBe(true);
      expect(failed.perceptionForOther, f.why).toBe(landed.perceptionForOther);
    }
  });
});

describe("the precedent ledger speaks the sentences this code writes (PLAYTEST-2026-09-27-DESIGN.md R1, D1)", () => {
  it("every text in checkpoints/precedent-ledger.json is producible by precedentTextFor over the effect kinds and object ids", () => {
    const ledger = JSON.parse(readFileSync(new URL("../../../checkpoints/precedent-ledger.json", import.meta.url), "utf8")) as { accounts: readonly { text: string }[] };
    const producible = new Set<string>();
    for (const o of OPEN_OBJECTS) for (const k of EFFECT_KINDS) producible.add(precedentTextFor({ targetObjectId: o.id, effectKind: k }));
    const texts = [...new Set(ledger.accounts.map((a) => a.text))];
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((text) => !producible.has(text))).toEqual([]);
  });
});

describe("D16: a refused visible attempt counts as seen -- the owner's decision, 2026-09-27 (§80.4 question 3)", () => {
  afterEach(() => destroyTestDb());

  const DIG = ruling("bar", "wear", "integrity");

  async function dig(w: OpenWorld, roundN: number, knownApproaches: readonly KnownApproach[]): Promise<OpenHalfRoundResult> {
    const t = w.base.clock.prisonerT(roundN);
    return runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee: { rule: async () => DIG },
      principal: "prisoner",
      roundN,
      t,
      context: buildOpenContext(w, "prisoner", t, roundN, 12, {}, "modelled"),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }),
      presenceMode: "modelled",
      knownApproaches,
    });
  }
  const suspicion = (w: OpenWorld, t: number) => readNumericFact({ gameId: w.base.gameId, t, entityId: w.base.resources.wardenSuspicion, key: "value" }) ?? 0;

  it("a refused, perceptible prisoner attempt is recorded as an approach he knows", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    setBelief(w.base.gameId, "prisoner", "bar_integrity", 40, 0); // a stale belief: expects contradicted
    const refusedDig = await dig(w, 1, []);
    expect(refused(refusedDig)).toBe(true);
    expect(refusedDig.perceptionForOther).toBe(describeAttempt("prisoner", DIG));
    expect(seenAttempts([refusedDig])).toEqual([precedentTextFor(DIG)]);
    // Refused, it cost her nothing.
    expect(suspicion(w, refusedDig.t)).toBe(0);
  });

  it("the known-approach bump still fires only when a later repeat RESOLVES", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const known: KnownApproach[] = [{ text: precedentTextFor(DIG), suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP }];
    // A repeat that is refused (her belief is stale again): known, but no bump.
    setBelief(w.base.gameId, "prisoner", "bar_integrity", 40, 0);
    const refusedRepeat = await dig(w, 1, known);
    expect(refused(refusedRepeat)).toBe(true);
    expect(suspicion(w, refusedRepeat.t)).toBe(0);
    // The refusal told her the truth (100); the repeat now resolves: the ordinary +10 and the known approach's +30.
    const landedRepeat = await dig(w, 2, known);
    expect(resolved(landedRepeat)).toBe(true);
    expect(suspicion(w, landedRepeat.t)).toBe(10 + KNOWN_APPROACH_SUSPICION_BUMP);
  });
});
