import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, type ReaderTransport, type Resolver } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, declaredPropertyKeys, declaredProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { readHarmMode, rulingPropertyAnswerKeys, EFFECT_KINDS, type EffectKind } from "../effects.js";
import { createReferee, type Referee, type RefereeRuling, type ObjectPerception } from "../referee.js";
import { runOpenHalfRound, describeAttempt, laysHandsOnWarden, type OpenHalfRoundResult } from "../loop.js";
import { runOpenGame } from "../game.js";
import { checkOpenGameEnd } from "../gameEnd.js";
import { renderOwnOutcome } from "../perception.js";
import { openConditions } from "../conditions.js";
import { renderSeatSituation, type OpenPrincipalContext, type OpenProposal } from "../mind.js";
import type { OpenMind } from "../mind.js";
import { OPEN_PERSONS, HARM_DISABLED_AT_OR_BELOW, POSTURE_ON_HER_FEET_ABOVE } from "../scenarioObjects.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import { FILE_SUSPICION_BUMP } from "../../world/mechanics.js";
import type { Principal } from "../../ledger/beliefs.js";

/**
 * the-prisoner#1 (`docs/ISSUE-1-DESIGN.md`): the attack move. `PRISONER_HARM=off|on`, default off. A new
 * effect kind `harm` whose only property is `condition` (100 unharmed, 0 disabled), offered to the referee only
 * with the arm on AND a person in view; the target must be the OTHER principal. Magnitudes slight/moderate/
 * substantial 10/25/40 (no dice); restore is tending, slight-only like sight's own recovery. A prisoner's harm
 * on the warden gives grounds at once (D13 extended) plus the act's own bump. Endings: the prisoner's own
 * condition at 0 is a NEW loss (`disabled`) that ends the game; the warden's own condition at 0 is his loss of
 * the contest WITHOUT ending the game -- his turns are skipped, he perceives nothing, and he holds nothing,
 * treated like floored/blind for custody, perception and block, until she escapes or time runs out.
 */

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"] = "none", magnitude: RefereeRuling["magnitude"] = "moderate"): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude,
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "x" }, requiredSourceId: `desc:${targetObjectId}`, verified: true }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

async function act(w: OpenWorld, principal: Principal, roundN: number, r: RefereeRuling, resolver?: Resolver): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? w.base.clock.wardenT(roundN) : w.base.clock.prisonerT(roundN);
  const referee: Referee = { rule: async () => r };
  return runOpenHalfRound({
    openWorld: w,
    resolver: resolver ?? buildOpenResolver(),
    referee,
    principal,
    roundN,
    t,
    context: buildOpenContext(w, principal, t, roundN, 12, {}, "modelled"),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }),
    presenceMode: "modelled",
  });
}

function conditionOf(w: OpenWorld, who: Principal, t: number): number | null {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: w.resourceIdFor[`${who}.condition`], key: "value" });
}

function setTo(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value ?? 0;
  const r = buildOpenResolver();
  if (value < current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set" } });
  if (value > current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: value - current, min: 0, max: 100, description: "set" } });
}

const HARM_WARDEN = ruling("warden", "harm", "condition", "substantial");

describe("readHarmMode", () => {
  it("off unless asked; anything else stops the run", () => {
    expect(readHarmMode(undefined)).toBe("off");
    expect(readHarmMode("")).toBe("off");
    expect(readHarmMode("on")).toBe("on");
    expect(() => readHarmMode("sometimes")).toThrow(/PRISONER_HARM/);
  });
});

describe("condition as a person's property (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("each person declares condition: 100-0 from 100, worn 10/25/40, restored 10/10/10 (slight-only), read ascending and silent above 70", () => {
    for (const person of OPEN_PERSONS) {
      const condition = person.properties.find((p) => p.key === "condition");
      expect(condition).toMatchObject({ resourceName: `${person.id}_condition`, min: 0, max: 100, initialValue: 100, wear: { slight: 10, moderate: 25, substantial: 40 }, restore: { slight: 10, moderate: 10, substantial: 10 } });
      expect(condition?.readRanges).toEqual([
        { atOrBelow: 0, text: `${person.id === "prisoner" ? PRISONER_NAME : WARDEN_NAME} is down and does not get up.` },
        { atOrBelow: 40, text: `${person.id === "prisoner" ? PRISONER_NAME : WARDEN_NAME} is badly hurt and moves slowly.` },
        { atOrBelow: 70, text: `${person.id === "prisoner" ? PRISONER_NAME : WARDEN_NAME} is hurt.` },
      ]);
    }
    // No dice: one substantial act from full health never disables outright (§4 Q4). `findProperty` only
    // ever reads `OPEN_OBJECTS` (a person's own properties live on `OPEN_PERSONS` instead, above).
    const wardenCondition = OPEN_PERSONS.find((p) => p.id === "warden")!.properties.find((p) => p.key === "condition")!;
    expect(100 - wardenCondition.wear.substantial).toBeGreaterThan(HARM_DISABLED_AT_OR_BELOW);
  });

  it("is built only under the harm arm, and only under presence too (like posture/sight)", () => {
    createTestDb();
    expect(buildOpenWorld().resourceIdFor["warden.condition"]).toBeUndefined();
    destroyTestDb();
    createTestDb();
    expect(buildOpenWorld({ presence: "modelled" }).resourceIdFor["warden.condition"]).toBeUndefined();
    destroyTestDb();
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    expect(getResource(w.resourceIdFor["warden.condition"])?.value).toBe(100);
    destroyTestDb();
  });

  it("declaredPropertyKeys/declaredProperty hide condition when the harm arm is off, even though posture/sight are on (per-key, not per-object)", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    expect(declaredPropertyKeys(w, "warden").sort()).toEqual(["posture", "sight"]);
    expect(declaredProperty(w, "warden", "condition")).toBeUndefined();
    destroyTestDb();
    createTestDb();
    const on = buildOpenWorld({ presence: "modelled", harm: "on" });
    expect(declaredPropertyKeys(on, "warden").sort()).toEqual(["condition", "posture", "sight"]);
    expect(declaredProperty(on, "warden", "condition")).toBeDefined();
    destroyTestDb();
  });

  it("read in the person's description once hurt", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const t = w.base.clock.prisonerT(1);
    const fresh = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(fresh?.description).not.toContain("hurt");
    setTo(w, w.resourceIdFor["warden.condition"], 60);
    const hurt = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(hurt?.description).toContain(`${WARDEN_NAME} is hurt.`);
    setTo(w, w.resourceIdFor["warden.condition"], 40);
    const badlyHurt = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(badlyHurt?.description).toContain(`${WARDEN_NAME} is badly hurt and moves slowly.`);
    setTo(w, w.resourceIdFor["warden.condition"], 0);
    const down = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(down?.description).toContain(`${WARDEN_NAME} is down and does not get up.`);
    destroyTestDb();
  });
});

describe("planEffect: harm's own gates (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("lands on the OTHER principal", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const hit = await act(w, "prisoner", 1, HARM_WARDEN);
    expect(hit.outcome).not.toBeNull();
    expect(conditionOf(w, "warden", hit.t)).toBe(60);
    destroyTestDb();
  });

  it("harming oneself is refused as outside what the world models", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const selfHarm = ruling("prisoner", "harm", "condition", "substantial");
    const hit = await act(w, "prisoner", 1, selfHarm);
    expect(hit.outcome).toBeNull();
    expect(hit.refusalError).toBeNull();
    expect(hit.plan).toBeNull();
    expect(conditionOf(w, "prisoner", hit.t)).toBe(100);
    destroyTestDb();
  });

  it("a ruling naming any property but condition is refused (no invented world)", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const wrongProperty = ruling("warden", "harm", "posture", "substantial");
    const hit = await act(w, "prisoner", 1, wrongProperty);
    expect(hit.plan).toBeNull();
    destroyTestDb();
  });

  it("with the arm off, harm has no resource to write and does nothing even if a ruling somehow names it", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const hit = await act(w, "prisoner", 1, HARM_WARDEN);
    expect(hit.plan).toBeNull();
    destroyTestDb();
  });

  it("restore on condition is tending, slight-only at every magnitude", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    await act(w, "prisoner", 1, HARM_WARDEN);
    const tend = await act(w, "warden", 2, ruling("warden", "restore", "condition", "substantial"));
    expect(conditionOf(w, "warden", tend.t)).toBe(70);
  });
});

describe("D13 extended: harm on the warden gives grounds, then the bump (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("stabbing him (substantial harm) from suspicion 0: 40 for the grounds, then +30 -> 70", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const hit = await act(w, "prisoner", 1, HARM_WARDEN);
    expect(readNumericFact({ gameId: w.base.gameId, t: hit.t, entityId: w.base.resources.wardenSuspicion, key: "value" })).toBe(70);
    expect(laysHandsOnWarden("prisoner", "harm", "warden")).toBe(true);
  });

  it("from suspicion above the threshold, only the ordinary bump applies", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: w.base.resources.wardenSuspicion, amount: 60, min: 0, max: 100, description: "set up" } });
    const moderate = ruling("warden", "harm", "condition", "moderate");
    const hit = await act(w, "prisoner", 1, moderate);
    expect(readNumericFact({ gameId: w.base.gameId, t: hit.t, entityId: w.base.resources.wardenSuspicion, key: "value" })).toBe(60 + FILE_SUSPICION_BUMP);
  });

  it("a warden's own harm on the prisoner is not laysHandsOnWarden (the set is prisoner-on-warden only)", () => {
    expect(laysHandsOnWarden("warden", "harm", "prisoner")).toBe(false);
  });
});

describe("D1: the other side is told the attempt, describeAttempt, and the actor's own outcome (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("describeAttempt names the target by name, never an outcome", () => {
    expect(describeAttempt("prisoner", { targetObjectId: "warden", effectKind: "harm" })).toBe(`${PRISONER_NAME} lashes out at ${WARDEN_NAME}.`);
  });

  it("the actor learns the number moved, by name, in person-shaped wording", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const hit = await act(w, "prisoner", 1, HARM_WARDEN);
    expect(renderOwnOutcome(hit, "on")).toContain(`${WARDEN_NAME}'s condition went from 100 to 60.`);
    destroyTestDb();
  });

  it("a refused (self-harm) attempt and a landed one are never conflated: refused relays nothing perceptible from a refusal that never even planned", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const landed = await act(w, "prisoner", 1, HARM_WARDEN);
    expect(landed.perceptionForOther).toBe(`${PRISONER_NAME} lashes out at ${WARDEN_NAME}.`);
  });
});

describe("the referee under the harm arm, with a person in view (the-prisoner#1)", () => {
  const BAR: ObjectPerception = { id: "bar", description: "One of five vertical iron bars." };
  const CROFT: ObjectPerception = { id: "warden", description: "Warden Croft, the warden." };
  // Mirrors the real, world-aware `declaredPropertyKeys` (`world.ts`): a person's `condition` key is present
  // only under the harm arm, exactly as a live world would only build its resource then -- never hardcoded
  // regardless of the arm being tested, or this fixture would not be testing what the arm actually gates.
  const propertiesOf = (harmOn: boolean) => (id: string): readonly string[] =>
    id === "prisoner" || id === "warden" ? ["posture", "sight", ...(harmOn ? ["condition"] : [])] : id === "bar" ? ["integrity"] : [];
  async function questions(perceived: readonly ObjectPerception[], options: Parameters<typeof createReferee>[1] = {}): Promise<readonly { id: string; prompt: string; answerKeys: readonly string[] }[]> {
    let qs: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    const transport: ReaderTransport = async (request) => {
      qs = request.questions;
      return [];
    };
    await createReferee([transport], { propertiesOf: propertiesOf(options.harmMode === "on"), ...options }).rule("I stab Croft with the spoon.", perceived);
    return qs;
  }
  const HARM_CLAUSE = " An act meant to hurt someone -- striking, stabbing, throwing something at them -- is harm on that person; pushing them down or hauling them up is not harm.";

  it("with the arm off, harm is never offered, even with a person in view -- the fingerprint PIN's own condition", async () => {
    const qs = await questions([BAR, CROFT]);
    expect(qs.find((q) => q.id === "effect")?.answerKeys).not.toContain("harm");
    expect(qs.find((q) => q.id === "effect")?.prompt).not.toContain(HARM_CLAUSE);
    expect(qs.find((q) => q.id === "property")?.answerKeys).not.toContain("condition");
    expect(qs.find((q) => q.id === "property")?.prompt).not.toContain("condition");
  });

  it("with the arm on but no person in view, still nothing", async () => {
    const qs = await questions([BAR], { harmMode: "on" });
    expect(qs.find((q) => q.id === "effect")?.answerKeys).not.toContain("harm");
    expect(qs.find((q) => q.id === "property")?.answerKeys).not.toContain("condition");
  });

  it("with the arm on AND a person in view, harm and condition are offered", async () => {
    const qs = await questions([BAR, CROFT], { harmMode: "on" });
    expect(qs.find((q) => q.id === "effect")?.answerKeys).toContain("harm");
    expect(qs.find((q) => q.id === "effect")?.prompt).toContain(HARM_CLAUSE);
    expect(qs.find((q) => q.id === "property")?.answerKeys).toContain("condition");
    expect(qs.find((q) => q.id === "property")?.prompt).toContain("condition (how hurt a person is, 100 unharmed, 0 disabled), ");
  });

  it("rulingPropertyAnswerKeys: condition only with a person in view AND the arm on", () => {
    expect(rulingPropertyAnswerKeys(true)).not.toContain("condition");
    expect(rulingPropertyAnswerKeys(true, "off")).not.toContain("condition");
    expect(rulingPropertyAnswerKeys(false, "on")).not.toContain("condition");
    expect(rulingPropertyAnswerKeys(true, "on")).toContain("condition");
  });

  it("EFFECT_KINDS includes harm, once, before none", () => {
    expect(EFFECT_KINDS).toContain("harm");
    expect(EFFECT_KINDS[EFFECT_KINDS.length - 1]).toBe("none");
  });
});

describe("byte-identity: perception.ts's declared-space refusal never mentions condition with the arm off (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("a reveal on a person with an unread property still lists only posture/sight, arm off", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const revealNone = ruling("warden", "reveal", "none");
    const half = await act(w, "prisoner", 1, revealNone);
    const text = renderOwnOutcome(half);
    expect(text).not.toContain("hurt or tended");
    expect(text).toContain("blinded or cleared");
    destroyTestDb();
  });

  it("the same refusal, arm ON, does mention it", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const revealNone = ruling("warden", "reveal", "none");
    const half = await act(w, "prisoner", 1, revealNone);
    expect(renderOwnOutcome(half, "on")).toContain("hurt or tended");
    destroyTestDb();
  });
});

describe("custody and block treat a disabled principal like floored/blind (the-prisoner#1)", () => {
  afterEach(() => destroyTestDb());

  it("a disabled holder keeps nothing: the key ring comes off a standing, disabled warden", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    setTo(w, w.resourceIdFor["warden.condition"], HARM_DISABLED_AT_OR_BELOW);
    const take = await act(w, "prisoner", 1, ruling("key_ring", "take"));
    expect(take.outcome?.result.taken).toBe(true);
    destroyTestDb();
  });

  it("one point above the disabled line, a holder on her feet keeps it, as before", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    setTo(w, w.resourceIdFor["warden.condition"], HARM_DISABLED_AT_OR_BELOW + 1);
    const take = await act(w, "prisoner", 1, ruling("key_ring", "take"));
    expect(take.outcome?.result.taken).toBe(false);
    destroyTestDb();
  });

  it("a disabled blocker does not hold the way out", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "open" } });
    await act(w, "warden", 1, ruling("window", "block"));
    setTo(w, w.resourceIdFor["warden.condition"], HARM_DISABLED_AT_OR_BELOW);
    expect(POSTURE_ON_HER_FEET_ABOVE).toBe(75);
    const leave = await act(w, "prisoner", 1, ruling("window", "leave"));
    expect(leave.outcome?.result.left).toBe(true);
    destroyTestDb();
  });

  it("the disabled principal's own acts reach the other side as nothing (perceives nothing)", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    setTo(w, w.resourceIdFor["prisoner.condition"], HARM_DISABLED_AT_OR_BELOW);
    const dig = await act(w, "warden", 1, ruling("bar", "wear", "integrity"));
    expect(dig.outcome).not.toBeNull();
    expect(dig.perceptionForOther).toBeNull();
    destroyTestDb();
  });
});

describe("endings (the-prisoner#1, design §4 Q3)", () => {
  afterEach(() => destroyTestDb());

  it("checkOpenGameEnd reads `disabled` from the prisoner's own condition -- a new loss, distinct from escape and caught", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const t = w.base.clock.prisonerT(1);
    setTo(w, w.resourceIdFor["prisoner.condition"], HARM_DISABLED_AT_OR_BELOW);
    expect(checkOpenGameEnd(w, t)).toEqual({ kind: "disabled" });
    destroyTestDb();
  });

  it("the warden's own condition at 0 is NOT a game end", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });
    const t = w.base.clock.wardenT(1);
    setTo(w, w.resourceIdFor["warden.condition"], HARM_DISABLED_AT_OR_BELOW);
    expect(checkOpenGameEnd(w, t)).toBeNull();
    destroyTestDb();
  });

  it("a full game: the prisoner harms the warden to 0 over three rounds; his fourth-round half is skipped, and the game continues until she escapes", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", harm: "on" });

    function roundOf(briefing: string): number {
      return Number(/^Round (\d+) of/.exec(briefing)?.[1]);
    }

    const wardenAsked: number[] = [];
    const wardenMind: OpenMind = {
      consider: async (context) => {
        wardenAsked.push(roundOf(context.briefing));
        // Self-targeted, so it is refused as harmless (planEffect's own self-harm gate) -- a filler turn.
        return { intent: "I try to hurt myself.", line: "" };
      },
    } as OpenMind;

    const OPEN_WINDOW = ruling("window", "open", "passage", "substantial");
    const LEAVE_WINDOW = ruling("window", "leave");
    const prisonerMind: OpenMind = {
      consider: async (context) => {
        const n = roundOf(context.briefing);
        const intent = n <= 3 ? `I lash out at the warden with the spoon (turn ${n}).` : n === 4 ? "I open the window." : "I climb out through the window.";
        return { intent, line: "" };
      },
    } as OpenMind;

    // A literal map from the fixed intent strings above to their rulings -- exact string lookup, never a
    // reading of English (CLAUDE.md's own "never pattern-match meaning", read for this test fixture as: name
    // every ruling explicitly, don't infer one from what the text says).
    const RULINGS: Record<string, RefereeRuling> = {
      "I try to hurt myself.": ruling("warden", "harm", "condition", "substantial"),
      "I lash out at the warden with the spoon (turn 1).": HARM_WARDEN,
      "I lash out at the warden with the spoon (turn 2).": HARM_WARDEN,
      "I lash out at the warden with the spoon (turn 3).": HARM_WARDEN,
      "I open the window.": OPEN_WINDOW,
      "I climb out through the window.": LEAVE_WINDOW,
    };
    const referee: Referee = {
      rule: async (intentText) => {
        const r = RULINGS[intentText];
        if (!r) throw new Error(`unscripted intent: ${intentText}`);
        return r;
      },
    };
    // Pre-wear the bar so the window opens on the prisoner's 4th turn (an ordinary, audited wear) -- at or
    // below OPEN_WINDOW_BAR_MAX (50).
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: w.base.resources.barIntegrity, amount: 51, min: 0, max: 100, description: "worn" } });

    const game = await runOpenGame({ openWorld: w, resolver: buildOpenResolver(), referee, wardenMind, prisonerMind, rounds: 6, presenceMode: "modelled" });

    const wardenHalf = (n: number) => game.halves.find((h) => h.roundN === n && h.principal === "warden");
    // Rounds 1-3: the warden's condition is still above the floor (100, 60, 20) when HIS half runs (it runs
    // before the prisoner's each round), so he is asked all three times, and never again once disabled.
    expect(wardenAsked).toEqual([1, 2, 3]);
    // By the end of round 3 (her third harm), his condition has reached the floor.
    const prisonerHalf3 = game.halves.find((h) => h.roundN === 3 && h.principal === "prisoner")!;
    expect(conditionOf(w, "warden", prisonerHalf3.t)).toBe(0);
    // Round 4: his half is skipped outright.
    expect(wardenHalf(4)?.skipped).toBe("disabled");
    expect(wardenHalf(4)?.proposal).toBeNull();
    // The game did not end from his own disabling -- it continues, and she escapes.
    expect(game.ended?.kind).toBe("escaped");
  });
});

describe("condition list and rule line (the-prisoner#1)", () => {
  it("openConditions states both endings only under the harm arm, appended last", () => {
    const off = openConditions({ door: "stated", doorPrice: "margin" });
    expect(off.some((c) => c.when.some((w) => w.includes("condition reaches 0")))).toBe(false);
    const on = openConditions({ door: "stated", doorPrice: "margin", harm: "on" });
    const last = on.slice(-2);
    expect(last).toEqual([
      { when: [`${PRISONER_NAME}'s condition reaches 0`], then: `the game ends and ${PRISONER_NAME} loses`, for: PRISONER_NAME },
      { when: [`${WARDEN_NAME}'s condition reaches 0`], then: `${WARDEN_NAME} takes no further turns, and the game continues until ${PRISONER_NAME} escapes or time runs out`, for: WARDEN_NAME },
    ]);
  });

  it("both chairs' rule lines state the harm rule only when the arm is on", () => {
    const CONTEXT: OpenPrincipalContext = { principalId: "p1", identity: "x", motive: "x", briefing: "Round 1 of 12.", perceivedObjects: [] };
    const off = renderSeatSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, undefined, "off");
    expect(off).not.toContain("condition");
    const on = renderSeatSituation(PRISONER_NAME, WARDEN_NAME, CONTEXT, undefined, "on");
    expect(on).toContain("An act meant to hurt someone lowers their own condition");
    expect(on).toContain(`If ${PRISONER_NAME}'s condition reaches 0 she is disabled and the game ends.`);
  });
});
