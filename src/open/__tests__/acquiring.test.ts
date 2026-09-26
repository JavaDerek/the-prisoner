import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import type { ReaderTransport } from "run-dmcp";
import { getResource, getDatabase } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, resourceIdForProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee, type Referee } from "../referee.js";
import { createElaborationReferee } from "../elaborationReferee.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { runOpenGame } from "../game.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import { fogAudit } from "../checkpointTranscript.js";
import { getBelief } from "../../ledger/beliefs.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";
import type { ElaborationBandRow, DifficultyBand, ModelPricedRow } from "../elaborationBands.js";
import { scriptedReferee, RULINGS, WAIT, type ScriptedRuling } from "./helpers/scriptedReferee.js";

/**
 * WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2: `OPEN_ACQUIRE` -- the play-time
 * elaboration request (P1b) turned into an actual acquisition, in one audited
 * resolution. Exercises the tests §9 row P2 names must go red first (see the
 * per-test comments below for what each one is standing in for).
 */

// A base ruling that WOULD be applicable (target perceived, effect and
// magnitude cited) but names a property (`integrity`) the loose tile does
// not declare -- OPEN-VARIANT.md §1.4's second null path (`plan === null`,
// "no invented world"), exactly the route §4.1 names for elaboration.
const DIG_TILE = "I dig at the loose tile with the spoon's edge, scraping down through the grit to test how deep it goes.";
const DIG_RULING: ScriptedRuling = {
  target: "loose_tile",
  effect: "wear",
  property: "integrity",
  magnitude: "moderate",
  perceptibility: "audible",
  intentQuote: "dig at the loose tile with the spoon's edge",
  descQuote: "a shallow hollow of dry grit about the size of a hand",
};

// A SECOND intent, ruled not-applicable (`effect: "none"`) but still naming
// `loose_tile` as its target -- §1.4's FIRST null path, used to reach
// `tryAcquire`'s own "never twice" guard directly even once `integrity` is
// already declared (once declared, `DIG_TILE` itself would just become an
// ordinary OPEN_WEAR through `planEffect`, never reaching elaboration again
// at all -- which is the correct behaviour, §2's "Tier 1 makes acquirable
// facts actionable on first contact", but proves nothing about the guard).
const POKE_TILE = "I poke thoughtfully at the loose tile, unsure what else to try.";
const POKE_RULING: ScriptedRuling = {
  target: "loose_tile",
  effect: "none",
  property: "none",
  magnitude: "slight",
  perceptibility: "silent",
  intentQuote: "poke thoughtfully at the loose tile",
  descQuote: "a shallow hollow of dry grit about the size of a hand",
};

function bandRow(band: DifficultyBand, over: Partial<ModelPricedRow> = {}): ElaborationBandRow {
  return {
    status: "priced",
    objectId: "loose_tile",
    need: "integrity",
    band,
    scenarioRevision: "test",
    descriptionHash: "test-hash",
    bandSource: "model",
    citation: { sourceId: "desc:loose_tile", quote: "a shallow hollow of dry grit" },
    model: "test-model",
    ...over,
  };
}

const HARD_ROWS: readonly ElaborationBandRow[] = [bandRow("hard")];

/** Scripted elaboration transport: always answers `need: integrity`, cited
 *  from the tile's own description -- mirrors `elaborationReferee.test.ts`'s
 *  own `scriptedTransport`. */
function needTransport(need: string, quote: string): ReaderTransport {
  return async (request) =>
    request.questions.map((q) => ({
      questionId: q.id,
      answerKey: need,
      citation: { sourceId: "desc:loose_tile", quote },
    }));
}

function setup(rulings: Record<string, ScriptedRuling> = { ...RULINGS, [DIG_TILE]: DIG_RULING }) {
  createTestDb();
  const openWorld = buildOpenWorld();
  const resolver = buildOpenResolver();
  const referee = createReferee([scriptedReferee(rulings)], { isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined });
  return { openWorld, resolver, referee };
}

async function half(
  w: OpenWorld,
  resolver: ReturnType<typeof buildOpenResolver>,
  referee: Referee,
  principal: "prisoner" | "warden",
  intent: string,
  roundN: number,
  options: { need?: string; quote?: string; elaborationBands?: readonly ElaborationBandRow[]; forcedElaborationBand?: DifficultyBand } = {}
): Promise<OpenHalfRoundResult> {
  const t = principal === "prisoner" ? w.base.clock.prisonerT(roundN) : w.base.clock.wardenT(roundN);
  const elaborationReferee = createElaborationReferee([needTransport(options.need ?? "integrity", options.quote ?? "a shallow hollow of dry grit")]);
  return runOpenHalfRound({
    openWorld: w,
    resolver,
    referee,
    principal,
    roundN,
    t,
    context: buildOpenContext(w, principal, t, roundN),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
    elaborationReferee,
    elaborationBands: options.elaborationBands ?? HARD_ROWS,
    ...(options.forcedElaborationBand ? { forcedElaborationBand: options.forcedElaborationBand } : {}),
  });
}

describe("OPEN_ACQUIRE, through a half-round (WORLD-ELABORATION-DESIGN.md §4.4, §9 row P2)", () => {
  afterEach(() => destroyTestDb());

  it("acquires loose_tile.integrity at the hard band: created at 100, worn by the ruled (moderate) magnitude to 90 in the SAME resolution, suspicion bumped, registered into the world, belief stamped", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);

    // `integrity` is not declared on loose_tile: `referee.ts`'s own
    // `propertyNamedWhenRequired` already folds "declared" into applicability,
    // so this is §1.4's FIRST null path -- `considerElaboration` is called
    // from there exactly as it is from the second (`plan === null`) path.
    expect(made.ruling?.applicable).toBe(false);
    expect(made.plan).toBeNull();
    expect(made.elaboration?.need).toBe("integrity");
    expect(made.acquired).toEqual(expect.objectContaining({ objectId: "loose_tile", need: "integrity", band: "hard", builtBand: "hard", bandSource: "model", startValue: 90, resourceName: "loose_tile_integrity" }));
    expect(made.outcome).not.toBeNull();

    // The resource itself: created at the band's initial (100), then worn
    // (hard band, moderate = 10) to 90, in ONE resolution -- one `resolution.recorded`
    // event caused both, never two.
    const resourceId = resourceIdForProperty(w, "loose_tile", "integrity");
    expect(resourceId).toEqual(expect.any(String));
    expect(getResource(resourceId as string)?.value).toBe(90);

    // Registered into the world exactly like a §4.1 property: perceived,
    // targeted, believed about.
    expect(declaredProperty(w, "loose_tile", "integrity")).toEqual(expect.objectContaining({ key: "integrity", resourceName: "loose_tile_integrity", min: 0, max: 100, initialValue: 100 }));
    expect(getBelief(w.base.gameId, "prisoner", "loose_tile_integrity")?.value).toBe(90);

    // Ordinary suspicion bump, exactly as OPEN_WEAR's own moderate bump (10) --
    // no elaboration-specific bump.
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(10);
  });

  // §9 row P2: "provenance on the event (causes.mechanic = 'OPEN_ACQUIRE')" --
  // the engine's OWN mechanism (Outcome.mechanic, set from the resolution's
  // own `causes.mechanic` at record time), never a field this repository adds.
  it("provenance: the outcome names OPEN_ACQUIRE as its mechanic, with no new field needed for it", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);
    expect(made.outcome?.mechanic).toBe("OPEN_ACQUIRE");
    expect(made.outcome?.result.mechanic).toBe("OPEN_ACQUIRE");
    const row = getDatabase().prepare(`SELECT causes FROM events WHERE id = ?`).get(made.outcome?.eventId) as { causes: string };
    expect(JSON.parse(row.causes).mechanic).toBe("OPEN_ACQUIRE");
  });

  it("the result object OPEN_ACQUIRE's own resolution returns", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);
    expect(made.outcome?.result).toEqual(expect.objectContaining({ mechanic: "OPEN_ACQUIRE", acquired: true, need: "integrity", band: "hard", bandSource: "model", startValue: 90 }));
  });

  // §9 row P2: "the band comes from the table, never from a ruling" -- the
  // intent and the referee's own citations say nothing about a band at all;
  // only `elaborationBands` (a build-time table) decides it. Proven by
  // swapping the table's own row and observing the applied band move with
  // it, with the intent held byte-identical.
  it("the band comes from the table, never from a ruling: an identical intent acquires whatever band the table holds", async () => {
    const trivial = setup();
    const madeTrivial = await half(trivial.openWorld, trivial.resolver, trivial.referee, "prisoner", DIG_TILE, 1, { elaborationBands: [bandRow("trivial")] });
    expect(madeTrivial.acquired?.band).toBe("trivial");
    expect(madeTrivial.acquired?.startValue).toBe(0); // trivial: initial 20, wear moderate 20 -> 0.

    const ruinous = setup();
    const madeRuinous = await half(ruinous.openWorld, ruinous.resolver, ruinous.referee, "prisoner", DIG_TILE, 1, { elaborationBands: [bandRow("ruinous")] });
    expect(madeRuinous.acquired?.band).toBe("ruinous");
    expect(madeRuinous.acquired?.startValue).toBe(98); // ruinous: initial 100, wear moderate 2 -> 98.
  });

  // §9 row P2: "a second acquisition of the same (object, property) pair is
  // refused in code."
  it("never twice: once acquired, a second elaboration on the same pair acquires nothing", async () => {
    const { openWorld: w, resolver, referee } = setup({ ...RULINGS, [DIG_TILE]: DIG_RULING, [POKE_TILE]: POKE_RULING });
    const first = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);
    expect(first.acquired).not.toBeNull();

    // Round 2: a DIFFERENT, not-applicable intent naming the same target, so
    // elaboration fires again and `tryAcquire`'s own guard is what refuses
    // it -- never merely "the referee didn't ask."
    const second = await half(w, resolver, referee, "prisoner", POKE_TILE, 2);
    expect(second.ruling?.applicable).toBe(false);
    expect(second.elaboration?.need).toBe("integrity");
    expect(second.acquired).toBeNull();
    expect(w.acquired).toHaveLength(1);
    // The resource was not touched again by the second attempt.
    const resourceId = resourceIdForProperty(w, "loose_tile", "integrity");
    expect(getResource(resourceId as string)?.value).toBe(90);
  });

  // §9 row P2: "atomic rollback when the suspicion leg violates a bound
  // (nothing acquired)." warden_suspicion is already bounded [0,100] from
  // world setup (`world/setup.ts`); OPEN_ACQUIRE's own suspicion leg is an
  // UNCLAMPED delta (`mechanics.ts`), so pushing it past 100 is rejected by
  // the engine's existing registered constraint, and the whole resolution
  // -- including the create and the wear -- rolls back.
  it("atomic rollback: a substantial acquisition that would push warden_suspicion past 100 acquires nothing at all", async () => {
    const { openWorld: w, resolver, referee } = setup({ ...RULINGS, [DIG_TILE]: { ...DIG_RULING, magnitude: "substantial" } });
    // Substantial bump is 30 (FAILED_ESCAPE_SUSPICION_BUMP); push suspicion to 90 first.
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: w.base.resources.wardenSuspicion, amount: 90, min: 0, max: 100, description: "x" } });
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(90);

    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);

    expect(made.acquired).toBeNull();
    expect(made.outcome).toBeNull();
    // Nothing acquired: no resource, no world registration, suspicion untouched.
    expect(resourceIdForProperty(w, "loose_tile", "integrity")).toBeUndefined();
    expect(w.acquired).toHaveLength(0);
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(90);
    expect(getBelief(w.base.gameId, "prisoner", "loose_tile_integrity")).toBeNull();
  });

  it("no priced row for the pair: nothing acquired", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { elaborationBands: [] });
    expect(made.acquired).toBeNull();
  });

  it("a built band of impossible, with no override: nothing acquired", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { elaborationBands: [bandRow("impossible")] });
    expect(made.acquired).toBeNull();
  });

  // D8 (docs/HUMAN-INTENTS-DESIGN.md §2, the-prisoner#28), changed on
  // purpose: `need: none` means no property was cited for the acquisition,
  // so the wear ruling's own `property` answer falls to its default -- D8's
  // own trigger -- and the actor is told the declared-space catalogue
  // (the tile's one declared property, `concealment`, plus the two
  // structural capabilities) instead of the old "met the loose tile as it
  // is: <description>" tail.
  it("need: none acquires nothing, and the actor is told the declared-space refusal", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { need: "none" });
    expect(made.acquired).toBeNull();
    const own = renderOwnOutcome(made);
    // D1 (HUMAN-INTENTS-DESIGN.md §2, §11.1, the-prisoner#26), changed on
    // purpose: every outcome now opens with what was ruled, as fiction --
    // batch 8 starts after this commit.
    expect(own).toBe("You set about wearing at the loose tile. The loose tile has nothing to wear down. It can be hidden or uncovered, struck, taken.");
  });

  it("an unverified need citation (cited from the wrong source) acquires nothing", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const badTransport: ReaderTransport = async (request) =>
      request.questions.map((q) => ({ questionId: q.id, answerKey: "integrity", citation: { sourceId: "intent", quote: "dig at the loose tile" } }));
    const t = w.base.clock.prisonerT(1);
    const made = await runOpenHalfRound({
      openWorld: w,
      resolver,
      referee,
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: DIG_TILE }),
      elaborationReferee: createElaborationReferee([badTransport]),
      elaborationBands: HARD_ROWS,
    });
    expect(made.elaboration?.citation.verified).toBe(false);
    expect(made.acquired).toBeNull();
  });

  it("a need this scenario has not authored band-numbers content for (no bandNumbersFor row) acquires nothing", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, {
      need: "concealment",
      quote: "a shallow hollow of dry grit",
      elaborationBands: [bandRow("hard", { need: "concealment" })],
    });
    expect(made.elaboration?.need).toBe("concealment");
    expect(made.acquired).toBeNull();
  });

  // §9 row P2: "the `PRISONER_ELABORATE_BAND` override recorded in the
  // header" -- proven here at the data level: the applied band moves, the
  // built band still reads what the table said.
  it("PRISONER_ELABORATE_BAND forces which band applies; the table's own (built) band is still carried, never silently replaced", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { forcedElaborationBand: "ruinous" });
    expect(made.acquired?.band).toBe("ruinous");
    expect(made.acquired?.builtBand).toBe("hard");
    expect(made.acquired?.startValue).toBe(98); // ruinous wear moderate = 2, from 100.
  });

  it("PRISONER_ELABORATE_BAND=impossible forces a refusal even against a built priced band", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { forcedElaborationBand: "impossible" });
    expect(made.acquired).toBeNull();
  });
});

// §9 row P2: "a start value renders nothing; a worn value renders its line."
describe("empty at the start value, its own line once worn (WORLD-ELABORATION-DESIGN.md §4.3's authoring rule)", () => {
  afterEach(() => destroyTestDb());

  it("after acquisition (already worn in the same resolution) the worn line shows; restored back to the band's initial value, it reads as nothing again", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1);
    expect(made.acquired?.startValue).toBe(90);

    const t2 = w.base.clock.wardenT(2);
    const wornDescription = computePerceivedObjects(w, "warden", t2).find((o) => o.id === "loose_tile")?.description;
    expect(wornDescription).toContain("The packed grit beneath is scraped, and gives slowly.");

    // Restore it fully back to the band's own initial value (100) -- an
    // ORDINARY OPEN_RESTORE, now actionable through `declaredProperty` like
    // any other property (§2: "Tier 1 makes acquirable facts actionable on
    // first contact").
    const resourceId = resourceIdForProperty(w, "loose_tile", "integrity") as string;
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: 100, min: 0, max: 100, description: "x" } });
    expect(getResource(resourceId)?.value).toBe(100);

    const t3 = w.base.clock.wardenT(3);
    const restoredDescription = computePerceivedObjects(w, "warden", t3).find((o) => o.id === "loose_tile")?.description;
    expect(restoredDescription).not.toContain("The packed grit beneath is scraped");
    // Exactly the base description plus its own (unrelated) concealment reading, nothing about integrity.
    expect(restoredDescription?.startsWith("A square clay floor tile")).toBe(true);
  });
});

// §9 row P2: "a route opens through leave when integrity reaches the
// declared threshold" -- ELABORABLE_EXITS (`acquirableProperties.ts`):
// `loose_tile -> corridor, openWhenIntegrityAtMost: 0`.
describe("a route through the elaborated floor (WORLD-ELABORATION-DESIGN.md §4.3's ELABORABLE_EXITS)", () => {
  afterEach(() => destroyTestDb());

  it("acquiring loose_tile.integrity at the trivial band wears it straight to 0 in one resolution, opening a route to the corridor that leave can use", async () => {
    const { openWorld: w, resolver, referee } = setup();
    expect(w.exits.loose_tile).toBeUndefined();

    const made = await half(w, resolver, referee, "prisoner", DIG_TILE, 1, { elaborationBands: [bandRow("trivial")] });
    expect(made.acquired?.startValue).toBe(0); // trivial: initial 20, wear moderate 20 -> 0, exactly the declared threshold.
    expect(w.exits.loose_tile).toEqual(expect.objectContaining({ part: "loose_tile", passageResourceId: null, destinationId: w.namedLocations.corridor, openWhenPartAtMost: 0 }));

    const LEAVE_TILE = "I squeeze down through the hole where the tile was and into the corridor beyond.";
    const rulings = { ...RULINGS, [DIG_TILE]: DIG_RULING, [LEAVE_TILE]: { target: "loose_tile", effect: "leave", property: "none", magnitude: "slight", perceptibility: "visible", intentQuote: "squeeze down through the hole", descQuote: "a shallow hollow of dry grit about the size of a hand" } };
    const refereeWithLeave = createReferee([scriptedReferee(rulings)], { isDeclared: (objectId, key) => declaredProperty(w, objectId, key) !== undefined });
    const left = await half(w, resolver, refereeWithLeave, "prisoner", LEAVE_TILE, 2);
    expect(left.ruling?.applicable).toBe(true);
    expect(left.plan?.mechanic).toBe("OPEN_LEAVE");
    expect(left.outcome?.result).toEqual(expect.objectContaining({ left: true, destinationId: w.namedLocations.corridor }));
  });
});

// §9 row P2: "fog audit clean."
describe("fog audit stays clean through a full game that elaborates (WORLD-ELABORATION-DESIGN.md §9 row P2)", () => {
  afterEach(() => destroyTestDb());

  it("a short game with a real acquisition in it still audits clean, exactly as `deriving.test.ts`'s own whole-game test does", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const rulings = { ...RULINGS, [DIG_TILE]: DIG_RULING };
    const referee = createReferee([scriptedReferee(rulings)], { isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined });
    const elaborationReferee = createElaborationReferee([needTransport("integrity", "a shallow hollow of dry grit")]);

    let turn = 0;
    const prisonerMind: OpenMind = {
      async consider() {
        turn += 1;
        return turn === 1 ? { intent: DIG_TILE, thoughts: "digging for a way out", notes: "the tile gave a little" } : { intent: WAIT };
      },
    };
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind,
      rounds: 3,
      elaborationReferee,
      elaborationBands: HARD_ROWS,
    });

    expect(game.halves.some((h) => h.acquired?.objectId === "loose_tile")).toBe(true);
    expect(fogAudit(game.halves).leaks).toEqual([]);
  });
});
