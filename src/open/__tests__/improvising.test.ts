import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, listResources, getCharacter, type ReaderTransport, type ReadRequest } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, resourceIdForProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee, type Referee, type RefereeRuling } from "../referee.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { runOpenGame } from "../game.js";
import { buildOpenContext } from "../briefing.js";
import { createSuspicionImproviser, type SuspicionImproviser } from "../improvisedRuling.js";
import { createElaborationReferee } from "../elaborationReferee.js";
import type { ElaborationBandRow } from "../elaborationBands.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, EXAMINE, type ScriptedRuling } from "./helpers/scriptedReferee.js";

/**
 * PRISONER_IMPROVISE=suspicion, through the half-round and the game: an act the referee rules onto nothing (target
 * `none`) or for which `planEffect` finds no plan still happens -- and, when the warden can perceive it, a separate
 * reading may raise his suspicion by a bounded tier. Nothing else moves, and with the arm off nothing changes at all.
 */

const INSULT = "I grip the bars and shout every insult I know at Warden Croft.";
const INSULT_QUOTE = "shout every insult I know at Warden Croft";
// Today's ruling of it: nothing in the room is its target, no effect -- so nothing resolves.
const INSULT_RULING: ScriptedRuling = { target: "none", effect: "none", property: "none", magnitude: "slight", perceptibility: "audible", intentQuote: INSULT_QUOTE, descQuote: "" };
const MUTTER = "I mutter a curse under my breath, too low to carry.";
const MUTTER_RULING: ScriptedRuling = { target: "none", effect: "none", property: "none", magnitude: "slight", perceptibility: "silent", intentQuote: "mutter a curse under my breath", descQuote: "" };
// Ruled applicable (by a hand-built referee, below), but `leave` through a thing that is no way out has no plan.
const CLIMB_COT = "I climb out through the cot.";
const TABLE = { ...RULINGS, [INSULT]: INSULT_RULING, [MUTTER]: MUTTER_RULING };

type Scripted = { key: string; quote: string };
function scriptedReading(byQuestion: Record<string, Scripted>): ReaderTransport & { calls: number } {
  const transport = (async (request: ReadRequest) => {
    transport.calls += 1;
    return request.questions.flatMap((q) => {
      const s = byQuestion[q.id];
      return s ? [{ questionId: q.id, answerKey: s.key, citation: { sourceId: "intent", quote: s.quote } }] : [];
    });
  }) as unknown as ReaderTransport & { calls: number };
  transport.calls = 0;
  return transport;
}

function setup(improvise: "off" | "suspicion" = "suspicion") {
  createTestDb();
  const openWorld = buildOpenWorld({ presence: "modelled", improvise });
  const resolver = buildOpenResolver();
  const referee = createReferee([scriptedReferee(TABLE)], { isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined });
  return { w: openWorld, resolver, referee };
}

async function half(w: OpenWorld, resolver: ReturnType<typeof buildOpenResolver>, referee: Referee, principal: "prisoner" | "warden", intent: string, improviser?: SuspicionImproviser): Promise<OpenHalfRoundResult> {
  const t = principal === "prisoner" ? w.base.clock.prisonerT(1) : w.base.clock.wardenT(1);
  return runOpenHalfRound({
    openWorld: w,
    resolver,
    referee,
    principal,
    roundN: 1,
    t,
    context: buildOpenContext(w, principal, t, 1, undefined, undefined, "modelled"),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
    presenceMode: "modelled",
    ...(improviser ? { improviser } : {}),
  });
}

/** Every resource's value by name, and whether each principal is in the cell -- what "nothing else moved" is checked
 *  against. By name, never id, so two games in two throwaway databases compare. */
function snapshot(w: OpenWorld): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const r of listResources(w.base.gameId)) values[r.name] = r.value;
  values["prisoner in cell"] = getCharacter(w.base.prisonerId)?.locationId === w.base.cellId;
  values["warden in cell"] = getCharacter(w.base.wardenId)?.locationId === w.base.cellId;
  return values;
}
const suspicionKey = (_w: OpenWorld) => "warden_suspicion";
const suspicion = (w: OpenWorld) => getResource(w.base.resources.wardenSuspicion)?.value;

describe("runOpenHalfRound with an improviser (PRISONER_IMPROVISE=suspicion)", () => {
  afterEach(() => destroyTestDb());

  it("an insult the referee rules onto nothing now raises suspicion by its tier -- and nothing else moves", async () => {
    const { w, resolver, referee } = setup();
    const before = snapshot(w);
    const transport = scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } });
    const result = await half(w, resolver, referee, "prisoner", INSULT, createSuspicionImproviser([transport]));
    expect(result.ruling?.applicable).toBe(false);
    expect(result.ruling?.targetObjectId).toBe("none");
    expect(result.improvised?.tier).toBe("serious");
    expect(suspicion(w)).toBe(5);
    expect({ ...snapshot(w), [suspicionKey(w)]: before[suspicionKey(w)] }).toEqual(before);
    // The act is remembered and relayed exactly as before: no outcome of her own, nothing new perceived.
    expect(result.outcome).toBeNull();
    expect(result.perceptionForOther).toBeNull();
  });

  it("the plan === null path too: an applicable ruling with no plan is read, and raises by its tier", async () => {
    const { w, resolver } = setup();
    // Hand-built, as loop.test.ts's own plan === null case is: `leave` through a thing that is no way out.
    const verified = (sourceId: string, quote: string) => ({ citation: { sourceId, quote }, requiredSourceId: sourceId, verified: true });
    const ruling: RefereeRuling = {
      targetObjectId: "cot",
      effectKind: "leave",
      property: "none",
      magnitude: "slight",
      perceptibility: "visible",
      product: "none",
      applicable: true,
      citations: { target: verified("intent", "the cot"), effect: verified("intent", "climb out through"), property: verified("desc:cot", "cot"), product: { citation: null, requiredSourceId: "intent", verified: false } },
      raw: { answers: [], unmatched: [], rungs: [] },
      request: { questions: [], sources: [] },
    };
    const referee: Referee = { rule: async () => ruling };
    const result = await half(w, resolver, referee, "prisoner", CLIMB_COT, createSuspicionImproviser([scriptedReading({ suspicion: { key: "minor", quote: "climb out through the cot" } })]));
    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan).toBeNull();
    expect(result.improvised?.tier).toBe("minor");
    expect(suspicion(w)).toBe(2);
  });

  it("a ruled-silent act is not perceived, so nothing is asked and nothing moves", async () => {
    const { w, resolver, referee } = setup();
    const transport = scriptedReading({ suspicion: { key: "serious", quote: "mutter a curse under my breath" } });
    const result = await half(w, resolver, referee, "prisoner", MUTTER, createSuspicionImproviser([transport]));
    expect(transport.calls).toBe(0);
    expect(result.improvised?.asked).toBe(false);
    expect(suspicion(w)).toBe(0);
  });

  it("with the warden out of the cell, the insult is not perceived: nothing asked, nothing moves", async () => {
    const { w, resolver, referee } = setup();
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_MOVE", parameters: { characterId: w.base.wardenId, destinationId: w.namedLocations.corridor, description: "The warden steps out of the cell." } });
    const transport = scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } });
    const result = await half(w, resolver, referee, "prisoner", INSULT, createSuspicionImproviser([transport]));
    expect(transport.calls).toBe(0);
    expect(result.improvised?.asked).toBe(false);
    expect(suspicion(w)).toBe(0);
  });

  it("with the warden unable to see (D12), the insult is not perceived either", async () => {
    const { w, resolver, referee } = setup();
    const sight = resourceIdForProperty(w, "warden", "sight") as string;
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: sight, amount: 100, min: 0, max: 100, description: "blinded" } });
    const transport = scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } });
    await half(w, resolver, referee, "prisoner", INSULT, createSuspicionImproviser([transport]));
    expect(transport.calls).toBe(0);
    expect(suspicion(w)).toBe(0);
  });

  it("the warden's own unlisted act never touches his own suspicion: nothing is asked", async () => {
    const { w, resolver, referee } = setup();
    const transport = scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } });
    const result = await half(w, resolver, referee, "warden", INSULT, createSuspicionImproviser([transport]));
    expect(transport.calls).toBe(0);
    expect(result.improvised).toBeUndefined();
    expect(suspicion(w)).toBe(0);
  });

  it("an engine refusal does not crash the turn (an improviser handed to a world that declared nothing)", async () => {
    const { w, resolver, referee } = setup("off");
    const result = await half(w, resolver, referee, "prisoner", INSULT, createSuspicionImproviser([scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } })]));
    expect(result.improvised?.refusal).not.toBeNull();
    expect(result.refusalError).toBeNull();
    expect(suspicion(w)).toBe(0);
  });
});

describe("the elaboration route keeps its turn, first", () => {
  afterEach(() => destroyTestDb());

  // acquiring.test.ts's own dig: inapplicable today (the tile declares no integrity), acquired under the
  // elaboration arm at the hard band. An act that acquired something resolved -- it is not unlisted any more.
  const DIG_TILE = "I dig at the loose tile with the spoon's edge, scraping down through the grit to test how deep it goes.";
  const DIG_RULING: ScriptedRuling = { target: "loose_tile", effect: "wear", property: "integrity", magnitude: "moderate", perceptibility: "audible", intentQuote: "dig at the loose tile with the spoon's edge", descQuote: "a shallow hollow of dry grit about the size of a hand" };
  const HARD_ROWS: readonly ElaborationBandRow[] = [
    { status: "priced", objectId: "loose_tile", need: "integrity", band: "hard", scenarioRevision: "test", descriptionHash: "test-hash", bandSource: "model", citation: { sourceId: "desc:loose_tile", quote: "a shallow hollow of dry grit" }, model: "test-model" },
  ];
  const needTransport: ReaderTransport = async (request) => request.questions.map((q) => ({ questionId: q.id, answerKey: "integrity", citation: { sourceId: "desc:loose_tile", quote: "a shallow hollow of dry grit" } }));

  it("an act the elaboration route acquired is not also improvised: the reading is never asked", async () => {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion" });
    const resolver = buildOpenResolver();
    const referee = createReferee([scriptedReferee({ [DIG_TILE]: DIG_RULING })], { isDeclared: (objectId, key) => declaredProperty(w, objectId, key) !== undefined });
    const transport = scriptedReading({ suspicion: { key: "serious", quote: "dig at the loose tile" } });
    const t = w.base.clock.prisonerT(1);
    const result = await runOpenHalfRound({
      openWorld: w,
      resolver,
      referee,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: DIG_TILE }),
      elaborationReferee: createElaborationReferee([needTransport]),
      elaborationBands: HARD_ROWS,
      improviser: createSuspicionImproviser([transport]),
    });
    expect(result.acquired).not.toBeNull();
    expect(transport.calls).toBe(0);
    expect(result.improvised).toBeUndefined();
  });
});

describe("arm off: byte-identical to before", () => {
  afterEach(() => destroyTestDb());

  it("no improviser: the half-round carries no `improvised` field, suspicion is untouched, and the referee's own request is the same bytes", async () => {
    const off = setup("off");
    const offResult = await half(off.w, off.resolver, off.referee, "prisoner", INSULT);
    expect("improvised" in offResult).toBe(false);
    expect(suspicion(off.w)).toBe(0);
    const offRequest = JSON.stringify(offResult.ruling?.request);
    destroyTestDb();
    const on = setup("suspicion");
    const onResult = await half(on.w, on.resolver, on.referee, "prisoner", INSULT, createSuspicionImproviser([scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } })]));
    expect(JSON.stringify(onResult.ruling?.request)).toBe(offRequest);
  });
});

describe("end to end: runOpenGame against a throwaway in-memory DB, scripted throughout", () => {
  afterEach(() => destroyTestDb());

  it("a prisoner who insults the warden every round raises his suspicion by the confirmed tier each time, and nothing else moves", async () => {
    // The baseline: the identical game with the arm off. (Time moves things in every game -- guard attention decays
    // between rounds -- so "nothing else" is measured against that game, not against round 0.)
    const off = setup("off");
    await runOpenGame({
      openWorld: off.w,
      resolver: off.resolver,
      referee: off.referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I stand by the door and watch her." }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: INSULT }),
      rounds: 3,
      presenceMode: "modelled",
    });
    const before = snapshot(off.w);
    expect(before["warden_suspicion"]).toBe(0);
    destroyTestDb();

    const { w, resolver, referee } = setup();
    const transport = scriptedReading({ suspicion: { key: "outrage", quote: INSULT_QUOTE }, outrage: { key: "outrage", quote: INSULT_QUOTE } });
    const game = await runOpenGame({
      openWorld: w,
      resolver,
      referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I stand by the door and watch her." }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: INSULT }),
      rounds: 3,
      presenceMode: "modelled",
      improviser: createSuspicionImproviser([transport]),
    });
    expect(game.ended).toBeNull();
    expect(transport.calls).toBe(6); // a reading and a confirmation, per prisoner turn
    expect(game.halves.filter((h) => h.principal === "prisoner").map((h) => h.improvised?.tier)).toEqual(["outrage", "outrage", "outrage"]);
    expect(suspicion(w)).toBe(30);
    expect({ ...snapshot(w), [suspicionKey(w)]: before[suspicionKey(w)] }).toEqual(before);
  });

  it("capture still needs grounds AND evidence: suspicion past 40 from insults alone catches no one when the warden finds the bar sound", async () => {
    const { w, resolver, referee } = setup();
    const game = await runOpenGame({
      openWorld: w,
      resolver,
      referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: EXAMINE }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: INSULT }),
      rounds: 6,
      presenceMode: "modelled",
      improviser: createSuspicionImproviser([scriptedReading({ suspicion: { key: "outrage", quote: INSULT_QUOTE }, outrage: { key: "outrage", quote: INSULT_QUOTE } })]),
    });
    expect(suspicion(w)).toBe(60);
    // The warden examined the bar every round, including at 40 and 50 -- it is sound, so there is no evidence.
    expect(game.halves.filter((h) => h.principal === "warden" && h.revealFor).length).toBe(6);
    expect(game.ended).toBeNull();
  });
});
