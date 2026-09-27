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
import { runOpenHalfRound, describeAttempt, precedentTextFor, type OpenHalfRoundResult } from "../loop.js";
import { OPEN_OBJECTS, POSTURE_STANDING } from "../scenarioObjects.js";
import { setBelief } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { PRISONER_NAME } from "../../scenario.js";

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
