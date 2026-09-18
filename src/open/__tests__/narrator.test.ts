import { describe, it, expect, vi } from "vitest";
import { buildNarratorFacts, verifyNarration, createNarrator, type NarrationViolation } from "../narrator.js";
import type { OpenPrincipalContext } from "../mind.js";
import type { Condition } from "../conditionList.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenContext } from "../briefing.js";
import { openConditions } from "../conditions.js";
import { renderProseSituation } from "../proseView.js";
import { seedInitialBeliefs } from "../../ledger/beliefs.js";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";

/**
 * The-prisoner#21 route 2 (D3): a narrator model, over the SAME structured
 * data the prose view composes from -- richer prose, but the one genuinely
 * dangerous failure mode the issue itself names is a narrator that invents a
 * detail the player then acts on. `verifyNarration` is the check that makes
 * that failure catchable: a verifier over (data, narration), never a second
 * model call second-guessing the first.
 *
 * `conditions: []` throughout (rather than omitting it) so these fixtures
 * never depend on `world/mechanics.ts`'s or `open/world.ts`'s own numeric
 * constants, which `mind.ts`'s `stateBasedRules` folds into the rule lines
 * whenever no condition list is given -- a fixture coupled to those numbers
 * would break the moment either constant changed for an unrelated reason.
 */
const NO_CONDITIONS: readonly Condition[] = [];

const MINI_CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: ["Round 4 of 30.", "bar integrity: 80 (as of round 2)."].join("\n"),
  perceivedObjects: [{ id: "door", description: "A heavy door of iron-bound planks. It stands open now." }],
};

const CLEAN_NARRATION =
  "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80, as of round 2. " +
  "The door stands open before you, its frame catching the light.";

function facts(context = MINI_CONTEXT, conditions: readonly Condition[] = NO_CONDITIONS) {
  return buildNarratorFacts(PRISONER_NAME, WARDEN_NAME, context, conditions);
}

function verify(narration: string, context = MINI_CONTEXT, conditions: readonly Condition[] = NO_CONDITIONS, extra: { knownWorldLabels?: readonly string[] } = {}) {
  return verifyNarration(facts(context, conditions), narration, { selfName: PRISONER_NAME, otherName: WARDEN_NAME, ...extra });
}

function kinds(violations: readonly NarrationViolation[]): string[] {
  return violations.map((v) => v.kind);
}

describe("verifyNarration -- a checker over (data, narration), the-prisoner#21 route 2", () => {
  it("a narration that states every fact, verbatim numbers and stamps, and invents nothing: zero violations", () => {
    expect(verify(CLEAN_NARRATION)).toEqual([]);
  });

  it("invents a number that appears nowhere in the data it was given", () => {
    const violations = verify(CLEAN_NARRATION + " You notice 7 fresh scratches scored into the frame.");
    expect(kinds(violations)).toContain("invented-number");
    expect(violations.find((v) => v.kind === "invented-number")?.detail).toContain("7");
  });

  it("drops a belief's stamp (the value survives, the 'as of round N' does not)", () => {
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80. The door stands open before you.";
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "dropped-belief" && v.detail.includes("stamp"))).toBe(true);
  });

  it("drops a belief entirely -- never mentions it at all", () => {
    const narration = "You are Mara Voss. It is round 4 of 30. The door stands open before you.";
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "dropped-belief" && v.detail.includes("bar integrity"))).toBe(true);
  });

  it("contradicts the data -- states a different number for a belief than the belief holds", () => {
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 85, as of round 2. The door stands open before you.";
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "contradicts-belief" && v.detail.includes("85") && v.detail.includes("80"))).toBe(true);
  });

  it("names an object outside what this principal was given the moment a wider catalogue is supplied", () => {
    const clean = verify(CLEAN_NARRATION, MINI_CONTEXT, NO_CONDITIONS, { knownWorldLabels: ["door", "torch"] });
    expect(kinds(clean)).not.toContain("invented-object");

    const violations = verify(CLEAN_NARRATION + " A torch flickers in a sconce by the wall.", MINI_CONTEXT, NO_CONDITIONS, { knownWorldLabels: ["door", "torch"] });
    expect(violations.some((v) => v.kind === "invented-object" && v.detail.includes("torch"))).toBe(true);
  });

  it("without a wider catalogue, invented-object never fires -- it cannot claim what it was not told", () => {
    const violations = verify(CLEAN_NARRATION + " A torch flickers in a sconce by the wall.");
    expect(kinds(violations)).not.toContain("invented-object");
  });

  it("drops a perceived object -- never mentions it at all", () => {
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80, as of round 2.";
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "dropped-object" && v.detail.includes("door"))).toBe(true);
  });

  it("drops the clock -- never states the round or the total rounds", () => {
    const narration = "You are Mara Voss. Your last word on the bar integrity was 80, as of round 2. The door stands open before you.";
    const violations = verify(narration);
    expect(kinds(violations)).toContain("dropped-clock");
  });

  it("drops a condition's threshold number", () => {
    const conditions: readonly Condition[] = [{ when: ["the bar's integrity is at or below 50"], then: "the window opens", for: PRISONER_NAME }];
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80, as of round 2. The door stands open before you. Once the bar gives way enough, the window opens for you.";
    const violations = verify(narration, MINI_CONTEXT, conditions);
    expect(violations.some((v) => v.kind === "dropped-condition" && v.detail.includes("50"))).toBe(true);
  });

  it("keeps a condition's threshold number -- no dropped-condition violation", () => {
    const conditions: readonly Condition[] = [{ when: ["the bar's integrity is at or below 50"], then: "the window opens", for: PRISONER_NAME }];
    const narration = CLEAN_NARRATION + " Once the bar's integrity falls to 50 or below, the window will open for you.";
    const violations = verify(narration, MINI_CONTEXT, conditions);
    expect(kinds(violations)).not.toContain("dropped-condition");
  });

  it("contradicts the data -- says a way out stands closed when the data describes it standing open", () => {
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80, as of round 2. The door stands closed and shut before you.";
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "contradicts-state" && v.detail.includes("door"))).toBe(true);
  });

  it("contradicts the data -- says a way out stands open when the data never describes it as open", () => {
    const context: OpenPrincipalContext = { ...MINI_CONTEXT, perceivedObjects: [{ id: "door", description: "A heavy door of iron-bound planks in a stone frame." }] };
    const narration = "You are Mara Voss. It is round 4 of 30. Your last word on the bar integrity was 80, as of round 2. The door stands open before you.";
    const violations = verify(narration, context);
    expect(violations.some((v) => v.kind === "contradicts-state" && v.detail.includes("door"))).toBe(true);
  });

  it("speaks for the other principal -- narrates their private mind, which this principal is never given", () => {
    const narration = CLEAN_NARRATION + ` ${WARDEN_NAME} decides she has seen enough for tonight.`;
    const violations = verify(narration);
    expect(violations.some((v) => v.kind === "speaks-for-other" && v.detail.includes(WARDEN_NAME))).toBe(true);
  });

  it("does not flag ordinary, already-given news about the other principal that carries no mind-state verb", () => {
    const narration = CLEAN_NARRATION + ` ${WARDEN_NAME} walks the corridor outside, keys jingling at her belt.`;
    const violations = verify(narration);
    expect(kinds(violations)).not.toContain("speaks-for-other");
  });

  it("narrates an outcome -- asserts what happens next, which only the referee decides", () => {
    const narration = CLEAN_NARRATION + " You slip through and you succeed in reaching the corridor beyond.";
    const violations = verify(narration);
    expect(kinds(violations)).toContain("narrates-outcome");
  });

  it("a plausible false sentence with no checkable number, object or outcome word slips through -- the documented limit of this checker", () => {
    // "the corridor is quiet" (docs/OPEN-VARIANT.md's own honesty requirement):
    // nothing here is a number, a known object label, an outcome phrase, or a
    // mind-state verb about the other principal, so nothing catches it.
    const narration = CLEAN_NARRATION + " The corridor beyond is quiet tonight.";
    expect(verify(narration)).toEqual([]);
  });
});

describe("createNarrator -- the model role, verified before it ever reaches a player", () => {
  function fakeFetch(content: string): typeof fetch {
    return vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
    })) as unknown as typeof fetch;
  }

  it("returns the model's narration once it passes verification, and loads the model first", async () => {
    const ensureLoaded = vi.fn(async () => {});
    const narrator = createNarrator({
      baseUrl: "http://x",
      model: "narrator-model",
      fetchFn: fakeFetch(JSON.stringify({ narration: CLEAN_NARRATION })),
      ensureLoaded,
    });
    const result = await narrator.narrate(PRISONER_NAME, WARDEN_NAME, MINI_CONTEXT, NO_CONDITIONS);
    expect(result).toBe(CLEAN_NARRATION);
    expect(ensureLoaded).toHaveBeenCalledWith("narrator-model");
  });

  it("discards a narration that fails verification, returns null, and reports the violations -- never reaches the player", async () => {
    const onRejected = vi.fn();
    const badNarration = CLEAN_NARRATION + " You notice 7 fresh scratches scored into the frame.";
    const narrator = createNarrator({
      baseUrl: "http://x",
      model: "narrator-model",
      fetchFn: fakeFetch(JSON.stringify({ narration: badNarration })),
      onRejected,
    });
    const result = await narrator.narrate(PRISONER_NAME, WARDEN_NAME, MINI_CONTEXT, NO_CONDITIONS);
    expect(result).toBeNull();
    expect(onRejected).toHaveBeenCalledTimes(1);
    const [violations, raw] = onRejected.mock.calls[0] as [NarrationViolation[], string];
    expect(violations.some((v) => v.kind === "invented-number")).toBe(true);
    expect(raw).toBe(badNarration);
  });

  it("a model answer with no usable narration is silence, not a violation", async () => {
    const onSilence = vi.fn();
    const onRejected = vi.fn();
    const narrator = createNarrator({
      baseUrl: "http://x",
      model: "narrator-model",
      fetchFn: fakeFetch(JSON.stringify({ narration: "   " })),
      onSilence,
      onRejected,
    });
    const result = await narrator.narrate(PRISONER_NAME, WARDEN_NAME, MINI_CONTEXT, NO_CONDITIONS);
    expect(result).toBeNull();
    expect(onRejected).not.toHaveBeenCalled();
    expect(onSilence).toHaveBeenCalled();
  });
});

// Calibration, and the check that matters most before trusting a rejector at
// runtime: a verifier strict enough to reject everything is a verifier that
// silently turns this feature off. The deterministic prose view (§53) is
// known-good narration of exactly these facts -- built from them by code, so
// it invents nothing and drops nothing -- and it must pass clean. If a future
// check makes this fail, that check is too strict, not the prose view.
describe("the verifier, calibrated against known-good narration", () => {
  it("finds nothing to complain about in the deterministic prose view's own output", () => {
    createTestDb();
    try {
      const world = buildOpenWorld();
      seedInitialBeliefs(world.base);
      const conditions = openConditions();
      for (const round of [1, 3]) {
        const context = buildOpenContext(world, "prisoner", world.base.clock.prisonerT(round), round, 30, {
          ...(round > 1 ? { ownOutcome: "Your last attempt worked on the bar: its integrity went from 100 to 85." } : {}),
          fromOther: round > 1 ? ["Warden Croft examines the lock closely."] : [],
          ...(round > 1 ? { plan: "work the mortar until the bar gives" } : {}),
        });
        const facts = buildNarratorFacts(PRISONER_NAME, WARDEN_NAME, context, conditions);
        const prose = renderProseSituation(PRISONER_NAME, WARDEN_NAME, context, conditions);
        expect(verifyNarration(facts, prose, { selfName: PRISONER_NAME, otherName: WARDEN_NAME })).toEqual([]);
      }
    } finally {
      destroyTestDb();
    }
  });
});
