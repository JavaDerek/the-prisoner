import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { PERSON_PROPERTY_KEYS, rulingPropertyAnswerKeys, type EffectKind } from "../effects.js";
import { createReferee, readPersonInstrumentMode, type Referee, type RefereeRuling, type ObjectPerception } from "../referee.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { renderOwnOutcome } from "../perception.js";
import { buildHumanTurnRow } from "../turnReport.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import { findProperty, OPEN_PERSONS, SIGHT_BLIND_AT_OR_BELOW, POSTURE_ON_HER_FEET_ABOVE } from "../scenarioObjects.js";
import type { Principal } from "../../ledger/beliefs.js";
import type { PresenceMode } from "../briefing.js";
import { renderSeatSituation, type OpenPrincipalContext, type OpenProposal } from "../mind.js";
import { precedentTextFor, KNOWN_APPROACH_SUSPICION_BUMP } from "../loop.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/**
 * PLAYTEST-2026-09-27 D12 (design R3, RED-TEAM.md F2): a person's `sight`. Covering someone's head is a wear on
 * her sight; at or below `SIGHT_BLIND_AT_OR_BELOW` she cannot see: the other's acts reach her as nothing, she
 * keeps nothing against a take, her own close examination refuses, and her block does not hold. Recovery is
 * slight only (the owner's decision), so one substantial cover outlasts one clearing.
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

async function act(w: OpenWorld, principal: Principal, roundN: number, r: RefereeRuling, presenceMode: PresenceMode = "modelled"): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? w.base.clock.wardenT(roundN) : w.base.clock.prisonerT(roundN);
  const referee: Referee = { rule: async () => r };
  return runOpenHalfRound({ openWorld: w, resolver: buildOpenResolver(), referee, principal, roundN, t, context: buildOpenContext(w, principal, t, roundN, 12, {}, presenceMode), mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }), presenceMode });
}

function sightOf(w: OpenWorld, who: Principal, t: number): number | null {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: w.resourceIdFor[`${who}.sight`], key: "value" });
}

function setTo(w: OpenWorld, resourceId: string, value: number): void {
  const current = getResource(resourceId)?.value ?? 0;
  const r = buildOpenResolver();
  if (value < current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId, amount: current - value, min: 0, max: 100, description: "set" } });
  if (value > current) r.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: value - current, min: 0, max: 100, description: "set" } });
}

const COVER_WARDEN = ruling("warden", "wear", "sight", "substantial");

describe("sight as a person's property (D12)", () => {
  afterEach(() => destroyTestDb());

  it("each person declares sight: 0-100 from 100, worn 10/50/100, restored 10/10/10, read ascending", () => {
    expect(PERSON_PROPERTY_KEYS).toEqual(["posture", "sight"]);
    expect(SIGHT_BLIND_AT_OR_BELOW).toBe(60);
    for (const person of OPEN_PERSONS) {
      const sight = person.properties.find((p) => p.key === "sight");
      expect(sight).toMatchObject({ resourceName: `${person.id}_sight`, min: 0, max: 100, initialValue: 100, wear: { slight: 10, moderate: 50, substantial: 100 }, restore: { slight: 10, moderate: 10, substantial: 10 } });
      expect(sight?.readRanges).toEqual([
        { atOrBelow: 60, text: "Something covers her head; she cannot see." },
        { atOrBelow: 100, text: "Her eyes are on the cell." },
      ]);
    }
  });

  it("is built under the presence arm, like posture, and read in the person's description", () => {
    createTestDb();
    const off = buildOpenWorld();
    expect(off.resourceIdFor["warden.sight"]).toBeUndefined();
    destroyTestDb();
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    expect(getResource(w.resourceIdFor["warden.sight"])?.value).toBe(100);
    const t = w.base.clock.prisonerT(1);
    const warden = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(warden?.description).toContain("Her eyes are on the cell.");
    setTo(w, w.resourceIdFor["warden.sight"], 60);
    const covered = computePerceivedObjects(w, "prisoner", t, "modelled").find((o) => o.id === "warden");
    expect(covered?.description).toContain("Something covers her head; she cannot see.");
  });

  it("the ruling may name sight only when a person is in view", () => {
    expect(rulingPropertyAnswerKeys(false)).not.toContain("sight");
    expect(rulingPropertyAnswerKeys(true)).toContain("sight");
  });

  it("covering his head is a wear on his sight, and gives grounds at once (D13)", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const cover = await act(w, "prisoner", 1, COVER_WARDEN);
    expect(sightOf(w, "warden", cover.t)).toBe(0);
    // Changed on purpose, 2026-09-27 (D13, the owner's answer to §80): an act on the warden's own body gives
    // grounds (40) and then its own substantial bump (+30). This asserted 0 under the §56 person exemption.
    expect(readNumericFact({ gameId: w.base.gameId, t: cover.t, entityId: w.base.resources.wardenSuspicion, key: "value" })).toBe(70);
  });

  it("recovery is slight only: one clearing after a substantial cover leaves her blind", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "prisoner", 1, COVER_WARDEN);
    const clear = await act(w, "warden", 2, ruling("warden", "restore", "sight", "substantial"));
    expect(sightOf(w, "warden", clear.t)).toBe(10);
  });
});

describe("what blindness does (D12 a-d)", () => {
  afterEach(() => destroyTestDb());

  it("(a) the other's non-silent act reaches a blind principal as nothing", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "prisoner", 1, COVER_WARDEN);
    const dig = await act(w, "prisoner", 2, ruling("bar", "wear", "integrity"));
    expect(dig.outcome).not.toBeNull();
    expect(dig.perceptionForOther).toBeNull();
  });

  it("(a) and a seeing principal still perceives it", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const dig = await act(w, "prisoner", 1, ruling("bar", "wear", "integrity"));
    expect(dig.perceptionForOther).toEqual(expect.any(String));
  });

  it("(b) a blind holder keeps nothing: the key ring comes off a standing, blinded warden", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "prisoner", 1, COVER_WARDEN);
    const take = await act(w, "prisoner", 2, ruling("key_ring", "take"));
    expect(take.outcome?.result.taken).toBe(true);
  });

  it("(b) a seeing holder on her feet keeps it, as before", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const take = await act(w, "prisoner", 1, ruling("key_ring", "take"));
    expect(take.outcome?.result.taken).toBe(false);
  });

  it("(c) a blind actor's close examination refuses, reveals no value, and is no catch", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    await act(w, "prisoner", 1, COVER_WARDEN);
    const look = await act(w, "warden", 2, ruling("bar", "reveal", "integrity"));
    expect(look.outcome?.result.blind).toBe(true);
    expect(look.outcome?.result.value).toBeUndefined();
    expect(look.revealFor).toBeNull();
    expect(renderOwnOutcome(look)).toContain("You cannot see the bar: something covers your head.");
    expect(renderOpenHalfRound(look).join("\n")).toContain("the warden cannot see: nothing revealed");
  });

  it("(d) a blind blocker does not hold the way out", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "open" } });
    await act(w, "warden", 1, ruling("window", "block"));
    w.base.clock.prisonerT(1);
    setTo(w, w.resourceIdFor["warden.sight"], SIGHT_BLIND_AT_OR_BELOW);
    expect(POSTURE_ON_HER_FEET_ABOVE).toBe(75);
    const leave = await act(w, "prisoner", 1, ruling("window", "leave"));
    expect(leave.outcome?.result.left).toBe(true);
  });

  it("(d) one point above the line, the block holds", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.window.passageResourceId, wayOut: "window", open: true, min: 0, max: 1, description: "open" } });
    await act(w, "warden", 1, ruling("window", "block"));
    w.base.clock.prisonerT(1);
    setTo(w, w.resourceIdFor["warden.sight"], SIGHT_BLIND_AT_OR_BELOW + 1);
    const leave = await act(w, "prisoner", 1, ruling("window", "leave"));
    expect(leave.outcome?.result.left).toBe(false);
  });
});

describe("D14: no suspicion accrues while the warden is blind (owner, 2026-09-27, §80)", () => {
  afterEach(() => destroyTestDb());
  const suspicion = (w: OpenWorld, t: number) => readNumericFact({ gameId: w.base.gameId, t, entityId: w.base.resources.wardenSuspicion, key: "value" }) ?? 0;

  it("the act that blinds him is charged in full (he felt it); her dig on the next half-round adds nothing", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const cover = await act(w, "prisoner", 1, COVER_WARDEN);
    expect(sightOf(w, "warden", cover.t)).toBe(0);
    expect(suspicion(w, cover.t)).toBe(70);
    const dig = await act(w, "prisoner", 2, ruling("bar", "wear", "integrity", "substantial"));
    expect(dig.outcome).not.toBeNull();
    expect(suspicion(w, dig.t)).toBe(70);
  });

  it("the gate is the same line as perception: at SIGHT_BLIND_AT_OR_BELOW nothing accrues, one point above it the bump lands", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    setTo(w, w.resourceIdFor["warden.sight"], SIGHT_BLIND_AT_OR_BELOW);
    const blind = await act(w, "prisoner", 1, ruling("bar", "wear", "integrity"));
    expect(suspicion(w, blind.t)).toBe(0);
    setTo(w, w.resourceIdFor["warden.sight"], SIGHT_BLIND_AT_OR_BELOW + 1);
    const seen = await act(w, "prisoner", 2, ruling("bar", "wear", "integrity"));
    expect(suspicion(w, seen.t)).toBe(10);
  });

  it("a known approach is not recognised by a man who cannot see it", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    setTo(w, w.resourceIdFor["warden.sight"], SIGHT_BLIND_AT_OR_BELOW);
    const dig = ruling("bar", "wear", "integrity", "slight");
    const t = w.base.clock.prisonerT(1);
    const h = await runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee: { rule: async () => dig },
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1, 12, {}, "modelled"),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }),
      presenceMode: "modelled",
      knownApproaches: [{ text: precedentTextFor(dig), suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP }],
    });
    expect(h.outcome).not.toBeNull();
    expect(suspicion(w, h.t)).toBe(0);
  });

  it("both chairs are told: while he cannot see, nothing she does is seen", () => {
    const context: OpenPrincipalContext = { principalId: "p1", identity: "x", motive: "x", briefing: "Round 1 of 12.", perceivedObjects: [] };
    for (const [self, other] of [[PRISONER_NAME, WARDEN_NAME], [WARDEN_NAME, PRISONER_NAME]] as const) {
      expect(renderSeatSituation(self, other, context).split("\n")).toContain(`While ${WARDEN_NAME} cannot see, nothing ${PRISONER_NAME} does is seen.`);
    }
  });
});

describe("the referee under a person in view (D12)", () => {
  const BAR: ObjectPerception = { id: "bar", description: "One of five vertical iron bars." };
  const CROFT: ObjectPerception = { id: "warden", description: "Warden Croft, the warden." };
  const withPersons = (id: string): readonly string[] => (id === "prisoner" || id === "warden" ? ["posture", "sight"] : id === "bar" ? ["integrity"] : []);
  async function questions(perceived: readonly ObjectPerception[], options: Parameters<typeof createReferee>[1] = {}): Promise<readonly { id: string; prompt: string; answerKeys: readonly string[] }[]> {
    let qs: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    const transport: ReaderTransport = async (request) => {
      qs = request.questions;
      return [];
    };
    await createReferee([transport], { propertiesOf: withPersons, ...options }).rule("I throw the blanket over Croft.", perceived);
    return qs;
  }
  const EFFECT_SENTENCE = " Covering someone's eyes or head so they cannot see is wear on that person; clearing one's own eyes or head is restore on the actor herself.";
  const INSTRUMENT_SENTENCE = " An act done to a person with a thing -- striking, covering, blinding, restraining, tying -- names the person; the thing is only what it is done with.";

  it("names sight in the property question and the covering reading in the effect question, with a person in view", async () => {
    const qs = await questions([BAR, CROFT]);
    expect(qs.find((q) => q.id === "property")?.prompt).toContain("sight (whether a person can see, 100 clear, 0 blind), ");
    expect(qs.find((q) => q.id === "property")?.answerKeys).toContain("sight");
    expect(qs.find((q) => q.id === "effect")?.prompt).toContain(EFFECT_SENTENCE);
  });

  it("with no person in view, none of it (the PIN's own condition)", async () => {
    const qs = await questions([BAR]);
    expect(qs.find((q) => q.id === "property")?.prompt).not.toContain("sight");
    expect(qs.find((q) => q.id === "property")?.answerKeys).not.toContain("sight");
    expect(qs.find((q) => q.id === "effect")?.prompt).not.toContain("Covering someone's eyes");
  });

  it("readPersonInstrumentMode: off unless asked; on only adds the target clause, and only with a person in view", async () => {
    expect(readPersonInstrumentMode(undefined)).toBe("off");
    expect(readPersonInstrumentMode("")).toBe("off");
    expect(readPersonInstrumentMode("on")).toBe("on");
    expect(() => readPersonInstrumentMode("yes")).toThrow(/PRISONER_PERSON_INSTRUMENT/);
    expect((await questions([BAR, CROFT])).find((q) => q.id === "target")?.prompt).not.toContain(INSTRUMENT_SENTENCE);
    expect((await questions([BAR, CROFT], { personInstrumentMode: "on" })).find((q) => q.id === "target")?.prompt).toContain(INSTRUMENT_SENTENCE);
    expect((await questions([BAR], { personInstrumentMode: "on" })).find((q) => q.id === "target")?.prompt).not.toContain(INSTRUMENT_SENTENCE);
  });
});

describe("the turn report row names the persons in view (D12, design R3)", () => {
  afterEach(() => destroyTestDb());

  it("personsInView: the ids among perceivedObjects that are persons", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const half = await act(w, "prisoner", 1, ruling("bar", "reveal", "integrity"));
    const row = buildHumanTurnRow(half, { runDmcp: "x", game: "y", codeRevision: "z" });
    expect(row.personsInView.sort()).toEqual(["prisoner", "warden"]);
    expect(findProperty("bar", "integrity")).toBeDefined();
  });
});
