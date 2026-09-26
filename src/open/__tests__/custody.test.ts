import { describe, it, expect, afterEach } from "vitest";
import { getResource, type ReadRequest, type TransportAnswer, type ReaderTransport } from "run-dmcp";
import { scriptedMind } from "mind-seam";
import { runOpenHalfRound } from "../loop.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import { declaredProperty, declaredPropertyKeys, derivedKindOf } from "../world.js";
import type { PresenceMode } from "../briefing.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, CUT_WIRE, BEND_HOOK, type ScriptedRuling } from "./helpers/scriptedReferee.js";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { currentT } from "../../world/clock.js";
import { readFactValue, readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { computePerceivedObjects, buildOpenContext, holderAt, OWNER_OF } from "../briefing.js";
import { OPEN_OBJECTS, POSTURE_STANDING, POSTURE_CROUCHED, POSTURE_LYING } from "../scenarioObjects.js";
import { EFFECT_KINDS, effectRequiresProperty, planEffect, type EffectPlan } from "../effects.js";
import { createReferee, type ObjectPerception } from "../referee.js";
import { describeAttempt } from "../loop.js";
import { renderOwnOutcome } from "../perception.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/**
 * docs/CUSTODY-DESIGN.md (C1 decided A, 2026-09-22): who holds a thing can
 * change. Two new effect keys -- `take` (the thing's owner becomes the actor)
 * and `give` (the thing's owner becomes the other principal, who must be
 * present) -- each targeting the THING, never the place or the person; and a
 * search, which is the existing `expose` aimed at a PERSON: every thing she
 * holds loses its concealment. The one decision: a thing another person holds
 * can be taken only while that holder is not on her feet -- while her description no longer reads "She is on
 * her feet." (posture 75 or below, the same band boundary the words use).
 */

function scriptedTransport(answers: Record<string, { answerKey: string; citation: { sourceId: string; quote: string } }>): ReaderTransport {
  return async (request: ReadRequest): Promise<readonly TransportAnswer[]> => {
    const offered: TransportAnswer[] = [];
    for (const q of request.questions) {
      const scripted = answers[q.id];
      if (scripted) offered.push({ questionId: q.id, answerKey: scripted.answerKey, citation: scripted.citation });
    }
    return offered;
  };
}

const TRAY: ObjectPerception = { id: "meal_tray", description: "A shallow steel tray pushed through a slot at the bottom of the door." };
const KEYS: ObjectPerception = { id: "key_ring", description: "A heavy iron ring on Croft's belt holding four keys." };
const CROFT: ObjectPerception = { id: "warden", description: "Warden Croft, the warden. She is on her feet." };
const withPersons = (id: string): readonly string[] => (id === "prisoner" || id === "warden" ? ["posture"] : []);

describe("custody's two effect keys (docs/CUSTODY-DESIGN.md)", () => {
  it("take and give are closed effect keys, and neither names a property", () => {
    expect(EFFECT_KINDS).toContain("take");
    expect(EFFECT_KINDS).toContain("give");
    expect(effectRequiresProperty("take")).toBe(false);
    expect(effectRequiresProperty("give")).toBe(false);
    // `none` stays last: it is the "nothing applies" key, not an effect.
    expect(EFFECT_KINDS[EFFECT_KINDS.length - 1]).toBe("none");
  });

  it("the effect question offers take and give, each in one generic clause", async () => {
    let questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I pick up the tray.", [TRAY]);
    const effect = questions.find((q) => q.id === "effect");
    expect(effect?.answerKeys).toContain("take");
    expect(effect?.answerKeys).toContain("give");
    expect(effect?.prompt).toContain("take (");
    expect(effect?.prompt).toContain("give (");
    // The new clauses are generic mechanism: no game noun in either.
    const clauses = (effect?.prompt ?? "").slice((effect?.prompt ?? "").indexOf("take ("), (effect?.prompt ?? "").indexOf(", or none."));
    for (const noun of ["warden", "prisoner", "cell", "Croft", "Voss", "spoon", "key"]) expect(clauses).not.toContain(noun);
  });
});

describe("custody's grounding: target and effect cited from the intent, no property (docs/CUSTODY-DESIGN.md)", () => {
  const take = (overrides: Record<string, { answerKey: string; citation: { sourceId: string; quote: string } } | undefined> = {}) => {
    const base: Record<string, { answerKey: string; citation: { sourceId: string; quote: string } }> = {
      target: { answerKey: "meal_tray", citation: { sourceId: "intent", quote: "pick up the tray" } },
      effect: { answerKey: "take", citation: { sourceId: "intent", quote: "pick up the tray" } },
      // What a referee naturally answers for an act that needs no property:
      // none, cited from the actor's own words.
      property: { answerKey: "none", citation: { sourceId: "intent", quote: "pick up the tray" } },
      magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "pick up the tray" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "pick up the tray" } },
    };
    const merged: Record<string, { answerKey: string; citation: { sourceId: string; quote: string } }> = {};
    for (const [k, v] of Object.entries({ ...base, ...overrides })) if (v) merged[k] = v;
    return scriptedTransport(merged);
  };

  it("a take with property none, cited from the intent, is applicable: it is never blocked for lacking a property", async () => {
    const ruling = await createReferee([take()]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.effectKind).toBe("take");
    expect(ruling.property).toBe("none");
    expect(ruling.applicable).toBe(true);
  });

  it("a take whose property answer fell to its safe default, with no citation at all, is applicable too", async () => {
    const ruling = await createReferee([take({ property: undefined })]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.applicable).toBe(true);
  });

  it("a give is grounded the same way", async () => {
    const give = scriptedTransport({
      target: { answerKey: "meal_tray", citation: { sourceId: "intent", quote: "hand the tray" } },
      effect: { answerKey: "give", citation: { sourceId: "intent", quote: "hand the tray" } },
      property: { answerKey: "none", citation: { sourceId: "intent", quote: "hand the tray" } },
      magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "hand the tray" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "hand the tray" } },
    });
    const ruling = await createReferee([give]).rule("I hand the tray over.", [TRAY]);
    expect(ruling.effectKind).toBe("give");
    expect(ruling.applicable).toBe(true);
  });

  it("PLANTED VIOLATION: a take whose EFFECT citation is not from the intent is not applicable", async () => {
    const ruling = await createReferee([take({ effect: { answerKey: "take", citation: { sourceId: "desc:meal_tray", quote: "A shallow steel tray" } } })]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.citations.effect.verified).toBe(false);
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: a take whose effect answer is missing altogether is not applicable", async () => {
    const ruling = await createReferee([take({ effect: undefined })]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.effectKind).toBe("none");
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: a take with target none is not applicable -- unlike a noise, custody always moves a named thing", async () => {
    const ruling = await createReferee([take({ target: { answerKey: "none", citation: { sourceId: "intent", quote: "pick up the tray" } } })]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.targetObjectId).toBe("none");
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: a take whose TARGET citation is not from the intent is not applicable", async () => {
    const ruling = await createReferee([take({ target: { answerKey: "meal_tray", citation: { sourceId: "desc:meal_tray", quote: "A shallow steel tray" } } })]).rule("I pick up the tray.", [TRAY]);
    expect(ruling.applicable).toBe(false);
  });
});

describe("a search is expose on a person (docs/CUSTODY-DESIGN.md)", () => {
  const search = (property: { answerKey: string; citation: { sourceId: string; quote: string } }) =>
    scriptedTransport({
      target: { answerKey: "warden", citation: { sourceId: "intent", quote: "pat Croft down" } },
      effect: { answerKey: "expose", citation: { sourceId: "intent", quote: "pat Croft down" } },
      property,
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "pat Croft down" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "pat Croft down" } },
    });

  it("expose on a person with property none, cited from the intent, is applicable -- a person declares no concealment to name", async () => {
    const ruling = await createReferee([search({ answerKey: "none", citation: { sourceId: "intent", quote: "pat Croft down" } })], { propertiesOf: withPersons }).rule("I pat Croft down.", [KEYS, CROFT]);
    expect(ruling.effectKind).toBe("expose");
    expect(ruling.targetObjectId).toBe("warden");
    expect(ruling.applicable).toBe(true);
  });

  it("PLANTED VIOLATION: expose on an OBJECT still needs its concealment named and grounded in its description", async () => {
    const onObject = scriptedTransport({
      target: { answerKey: "meal_tray", citation: { sourceId: "intent", quote: "turn the tray over" } },
      effect: { answerKey: "expose", citation: { sourceId: "intent", quote: "turn the tray over" } },
      property: { answerKey: "none", citation: { sourceId: "intent", quote: "turn the tray over" } },
      magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "turn the tray over" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "turn the tray over" } },
    });
    const ruling = await createReferee([onObject], { propertiesOf: withPersons }).rule("I turn the tray over.", [TRAY, CROFT]);
    expect(ruling.applicable).toBe(false);
  });

  it("the effect question says a search is expose on the person searched, only when a person is in view", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    const capture: ReaderTransport = async (request) => {
      questions = request.questions;
      return [];
    };
    await createReferee([capture], { propertiesOf: withPersons }).rule("I pat Croft down.", [KEYS, CROFT]);
    expect(questions.find((q) => q.id === "effect")?.prompt).toContain("is expose on that person");
    await createReferee([capture]).rule("I pick up the tray.", [TRAY]);
    expect(questions.find((q) => q.id === "effect")?.prompt).not.toContain("is expose on that person");
  });
});

describe("custody's sentences: what the other perceives, and the refused attempt's phrase (docs/CUSTODY-DESIGN.md)", () => {
  it("describeAttempt names the attempt on the thing, and a search on the person, by name", () => {
    expect(describeAttempt("prisoner", { targetObjectId: "key_ring", effectKind: "take" })).toBe(`${PRISONER_NAME} reaches for the key ring.`);
    expect(describeAttempt("warden", { targetObjectId: "meal_tray", effectKind: "give" })).toBe(`${WARDEN_NAME} holds out the meal tray.`);
    expect(describeAttempt("warden", { targetObjectId: "prisoner", effectKind: "expose" })).toBe(`${WARDEN_NAME} searches ${PRISONER_NAME}.`);
    // An expose on an object is unchanged.
    expect(describeAttempt("prisoner", { targetObjectId: "loose_tile", effectKind: "expose" })).toBe(`${PRISONER_NAME} brings the loose tile into view.`);
  });

  it("a refused take or give names the attempt in the actor's own outcome, and a refused search names the person", () => {
    const refused = (effectKind: "take" | "give" | "expose", target: string) =>
      renderOwnOutcome({
        principal: "prisoner",
        t: 1,
        roundN: 1,
        context: { principalId: "p", identity: "", motive: "", briefing: "", perceivedObjects: [TRAY, CROFT] },
        pick: null,
        proposal: { intent: "I do it." },
        ruling: {
          targetObjectId: target,
          effectKind,
          property: "none",
          magnitude: "slight",
          perceptibility: "visible",
          product: "none",
          applicable: false,
          citations: {
            target: { citation: null, requiredSourceId: "intent", verified: false },
            effect: { citation: null, requiredSourceId: "intent", verified: false },
            property: { citation: null, requiredSourceId: null, verified: false },
            product: { citation: null, requiredSourceId: "intent", verified: false },
          },
          raw: { answers: [], unmatched: [] } as never,
          request: { questions: [], sources: [] },
        },
        plan: null,
        outcome: null,
        refusalError: null,
        perceptionForOther: null,
        revealFor: null,
        derived: null,
        reshaped: null,
        resourceName: null,
        elaboration: null,
        acquired: null,
        reconsidered: null,
      });
    expect(refused("take", "meal_tray")).toContain("as an attempt to take the meal tray");
    expect(refused("give", "meal_tray")).toContain("as an attempt to hand over the meal tray");
    expect(refused("expose", "warden")).toContain(`as an attempt to search ${WARDEN_NAME}`);
    // Grounded by the actor's words alone, so the reason names only them --
    // never a property, and never a description that grounds nothing here.
    expect(refused("take", "meal_tray")).toContain("its grounds in your words left unverified");
    expect(refused("expose", "warden")).toContain("its grounds in your words left unverified");
    expect(refused("expose", "warden")).not.toContain("which property");
  });
});

/**
 * The engine write: one `set` leg on the item's own `owner_id`/`owner_type`
 * through `resolve()` -- the change kind `OPEN_LEAVE` already uses for a
 * character's `location_id`. Every gate reads the world the mechanic is
 * handed at t, never a map this repository keeps.
 */
describe("custody resolves through resolve(): one set of the item's owner (docs/CUSTODY-DESIGN.md)", () => {
  afterEach(() => destroyTestDb());

  function world(presence: "off" | "modelled" = "modelled"): OpenWorld {
    createTestDb();
    return buildOpenWorld({ presence });
  }
  const idOf = (w: OpenWorld, who: "prisoner" | "warden") => (who === "prisoner" ? w.base.prisonerId : w.base.wardenId);
  const ownerOf = (w: OpenWorld, objectId: string) => {
    const t = currentT(w.base.gameId);
    const entityId = w.entityIdFor[objectId];
    return { id: readFactValue({ gameId: w.base.gameId, t, entityId, key: "owner_id" }), type: readFactValue({ gameId: w.base.gameId, t, entityId, key: "owner_type" }) };
  };
  function planCustody(w: OpenWorld, effectKind: "take" | "give" | "expose", target: string, actor: "prisoner" | "warden", perceived?: readonly string[]) {
    const other = actor === "prisoner" ? "warden" : "prisoner";
    return planEffect({
      targetObjectId: target,
      effectKind,
      property: "none",
      magnitude: "slight",
      entityIdFor: { ...w.entityIdFor, prisoner: w.base.prisonerId, warden: w.base.wardenId },
      resourceIdFor: w.resourceIdFor,
      exits: w.exits,
      actorId: idOf(w, actor),
      custody: {
        otherId: idOf(w, other),
        perceived: perceived ?? computePerceivedObjects(w, actor, currentT(w.base.gameId), "modelled").map((o) => o.id),
        postureOf: Object.fromEntries((["prisoner", "warden"] as const).flatMap((p) => (w.resourceIdFor[`${p}.posture`] ? [[idOf(w, p), w.resourceIdFor[`${p}.posture`]]] : []))),
      },
      description: "x",
    });
  }
  function resolvePlan(w: OpenWorld, plan: EffectPlan | null) {
    if (!plan) throw new Error("no plan");
    return buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: plan.mechanic, parameters: plan.parameters });
  }
  function setPosture(w: OpenWorld, who: "prisoner" | "warden", value: number) {
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: w.resourceIdFor[`${who}.posture`], amount: POSTURE_STANDING - value, min: 0, max: 100, description: "down" } });
  }

  it("take of a thing lying in the room: its owner becomes the actor, by a set of owner_id and owner_type", () => {
    const w = world();
    expect(ownerOf(w, "meal_tray")).toEqual({ id: w.base.cellId, type: "location" });
    const plan = planCustody(w, "take", "meal_tray", "prisoner");
    expect(plan?.mechanic).toBe("OPEN_TAKE");
    const outcome = resolvePlan(w, plan);
    expect(outcome.result.taken).toBe(true);
    expect(outcome.sets.map((s) => s.key).sort()).toEqual(["owner_id", "owner_type"]);
    expect(ownerOf(w, "meal_tray")).toEqual({ id: w.base.prisonerId, type: "character" });
  });

  it("PLANTED VIOLATION (C1 = A): take of a thing another person holds while she is on her feet changes nothing", () => {
    const w = world();
    const outcome = resolvePlan(w, planCustody(w, "take", "key_ring", "prisoner"));
    expect(outcome.result.taken).toBe(false);
    expect(outcome.result.refused).toBe("holder-on-her-feet");
    expect(outcome.sets).toEqual([]);
    expect(ownerOf(w, "key_ring")).toEqual({ id: w.base.wardenId, type: "character" });
  });

  it("C1 = A: the same take succeeds once the holder is crouched, and once she is on the floor", () => {
    const w = world();
    setPosture(w, "warden", POSTURE_CROUCHED);
    expect(resolvePlan(w, planCustody(w, "take", "key_ring", "prisoner")).result.taken).toBe(true);
    expect(ownerOf(w, "key_ring")).toEqual({ id: w.base.prisonerId, type: "character" });

    // And back: she takes it from a prisoner lying on the floor.
    setPosture(w, "prisoner", POSTURE_LYING);
    expect(resolvePlan(w, planCustody(w, "take", "key_ring", "warden")).result.taken).toBe(true);
    expect(ownerOf(w, "key_ring")).toEqual({ id: w.base.wardenId, type: "character" });
  });

  // C1 = A is "not on her feet", and the description is what says so: posture 76-99 still reads "She is on
  // her feet." (the readRanges), so a stumble to 90 must not hand over the keys. The line is the same band
  // boundary the words use, never a second number.
  it("C1 = A: a holder whose description still says she is on her feet (a stumble, posture 90) keeps what she holds; at the crouched band's top (75) she does not", () => {
    const w = world();
    setPosture(w, "warden", 90);
    expect(resolvePlan(w, planCustody(w, "take", "key_ring", "prisoner")).result.refused).toBe("holder-on-her-feet");
    setPosture(w, "warden", 75);
    expect(resolvePlan(w, planCustody(w, "take", "key_ring", "prisoner")).result.taken).toBe(true);
  });

  it("C1 = A with presence off: no posture is modelled, so every holder counts as on her feet and keeps what she holds", () => {
    const w = world("off");
    const plan = planCustody(w, "take", "key_ring", "prisoner", computePerceivedObjects(w, "prisoner", currentT(w.base.gameId)).map((o) => o.id));
    expect(resolvePlan(w, plan).result.taken).toBe(false);
    expect(ownerOf(w, "key_ring").id).toBe(w.base.wardenId);
  });

  it("PLANTED VIOLATION: take of a thing the actor does not perceive plans nothing", () => {
    const w = world();
    // The banknotes lie in the hollow under the tile, which starts down: nobody perceives them.
    expect(computePerceivedObjects(w, "prisoner", currentT(w.base.gameId), "modelled").map((o) => o.id)).not.toContain("banknotes");
    expect(planCustody(w, "take", "banknotes", "prisoner")).toBeNull();
    // The planted half: the same take, handed a perceived list that includes it, does plan.
    expect(planCustody(w, "take", "banknotes", "prisoner", ["banknotes"])?.mechanic).toBe("OPEN_TAKE");
  });

  it("a person, a way out and a way out's part are never things that change hands", () => {
    const w = world();
    expect(planCustody(w, "take", "warden", "prisoner")).toBeNull();
    expect(planCustody(w, "take", "door", "prisoner")).toBeNull();
    expect(planCustody(w, "take", "lock", "prisoner")).toBeNull();
    expect(planCustody(w, "give", "window", "prisoner")).toBeNull();
  });

  it("give: the thing's owner becomes the other principal, who is present", () => {
    const w = world();
    const plan = planCustody(w, "give", "spoon", "prisoner");
    expect(plan?.mechanic).toBe("OPEN_GIVE");
    const outcome = resolvePlan(w, plan);
    expect(outcome.result.given).toBe(true);
    expect(ownerOf(w, "spoon")).toEqual({ id: w.base.wardenId, type: "character" });
  });

  it("PLANTED VIOLATION: give with nobody present changes nothing", () => {
    const w = world();
    // The warden steps out through the door: a `set` of her location through the same protocol.
    const door = w.exits.door;
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "open" } });
    resolvePlan(w, planEffect({ targetObjectId: "door", effectKind: "leave", property: "none", magnitude: "slight", entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.wardenId, description: "out" }));
    const outcome = resolvePlan(w, planCustody(w, "give", "spoon", "prisoner"));
    expect(outcome.result.given).toBe(false);
    expect(outcome.result.refused).toBe("recipient-absent");
    expect(ownerOf(w, "spoon").id).toBe(w.base.prisonerId);
  });

  it("PLANTED VIOLATION: give of a thing the actor does not hold changes nothing", () => {
    const w = world();
    const outcome = resolvePlan(w, planCustody(w, "give", "meal_tray", "prisoner"));
    expect(outcome.result.given).toBe(false);
    expect(outcome.result.refused).toBe("not-held");
    expect(ownerOf(w, "meal_tray").id).toBe(w.base.cellId);
  });

  it("search (expose on a person): every thing she holds loses its concealment; a thing she does not hold keeps its own", () => {
    const w = world();
    const spoonConcealment = w.resourceIdFor["spoon.concealment"];
    const tileConcealment = w.resourceIdFor["loose_tile.concealment"];
    const value = (id: string) => readNumericFact({ gameId: w.base.gameId, t: currentT(w.base.gameId), entityId: id, key: "value" });
    // She hides the spoon on herself.
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: spoonConcealment, amount: 100, min: 0, max: 100, description: "hide" } });
    expect(computePerceivedObjects(w, "warden", currentT(w.base.gameId), "modelled").map((o) => o.id)).not.toContain("spoon");
    const tileBefore = value(tileConcealment);

    const plan = planCustody(w, "expose", "prisoner", "warden");
    expect(plan?.mechanic).toBe("OPEN_SEARCH");
    const outcome = resolvePlan(w, plan);
    expect(outcome.result.uncovered).toEqual(["spoon"]);
    expect(value(spoonConcealment)).toBe(0);
    expect(value(tileConcealment)).toBe(tileBefore);
    expect(computePerceivedObjects(w, "warden", currentT(w.base.gameId), "modelled").map((o) => o.id)).toContain("spoon");
  });

  it("PLANTED VIOLATION: a search of a person the actor does not perceive plans nothing", () => {
    const w = world();
    expect(planCustody(w, "expose", "prisoner", "warden", ["bar"])).toBeNull();
  });

  it("an expose on an object is exactly what it was: a wear on its own concealment", () => {
    const w = world();
    const plan = planEffect({ targetObjectId: "loose_tile", effectKind: "expose", property: "concealment", magnitude: "substantial", entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.prisonerId, description: "x" });
    expect(plan?.mechanic).toBe("OPEN_WEAR");
  });
});

/**
 * Every read of who holds what comes from the engine at t -- the item's own
 * owner columns, read the way presence reads `location_id` -- and `OWNER_OF`
 * is only the authored starting state. Each test below would pass against the
 * old static map only if custody never happened; each one makes it happen.
 */
describe("who holds what is read from the engine at t (docs/CUSTODY-DESIGN.md)", () => {
  afterEach(() => destroyTestDb());

  const resolver = () => buildOpenResolver();
  const now = (w: OpenWorld) => currentT(w.base.gameId);
  const seen = (w: OpenWorld, who: "prisoner" | "warden") => computePerceivedObjects(w, who, now(w), "modelled").map((o) => o.id);
  /** Moves a thing to a character through the resolve protocol: given by the
   *  one who holds it, or taken from where it lies (C1 has its own tests above). */
  function handTo(w: OpenWorld, objectId: string, who: "prisoner" | "warden") {
    const idOf = (p: "prisoner" | "warden") => (p === "prisoner" ? w.base.prisonerId : w.base.wardenId);
    const holder = holderAt(w, objectId, now(w));
    const itemId = w.entityIdFor[objectId];
    const outcome = holder
      ? resolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_GIVE", parameters: { itemId, actorId: idOf(holder), recipientId: idOf(who), description: "x" } })
      : resolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_TAKE", parameters: { itemId, actorId: idOf(who), postureOf: {}, keptAtOrAbove: POSTURE_STANDING, description: "x" } });
    expect(outcome.sets.length).toBe(2);
  }
  function setConcealment(w: OpenWorld, objectId: string, value: number) {
    const resourceId = w.resourceIdFor[`${objectId}.concealment`];
    const before = readNumericFact({ gameId: w.base.gameId, t: now(w), entityId: resourceId, key: "value" }) ?? 0;
    resolver().resolve({ gameId: w.base.gameId, mechanic: value >= before ? "OPEN_RESTORE" : "OPEN_WEAR", parameters: { resourceId, amount: Math.abs(value - before), min: 0, max: 100, description: "x" } });
  }

  it("OWNER_OF is exactly the engine's own starting state, and nothing more", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    for (const spec of OPEN_OBJECTS) expect(holderAt(w, spec.id, now(w)), spec.id).toBe(OWNER_OF[spec.id] ?? null);
  });

  it("a thing handed over is perceived by its new holder even while concealed, and no longer by the one who hid it", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    setConcealment(w, "spoon", 100);
    expect(seen(w, "warden")).not.toContain("spoon");
    handTo(w, "spoon", "warden");
    expect(holderAt(w, "spoon", now(w))).toBe("warden");
    expect(seen(w, "warden")).toContain("spoon");
    expect(seen(w, "prisoner")).not.toContain("spoon");
  });

  it("a thing taken from the room travels with its holder: when she leaves, it leaves with her", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    handTo(w, "meal_tray", "warden");
    expect(seen(w, "prisoner")).toContain("meal_tray");
    resolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_PASSAGE", parameters: { resourceId: w.exits.door.passageResourceId, wayOut: "door", open: true, min: 0, max: 1, description: "open" } });
    resolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_LEAVE", parameters: { characterId: w.base.wardenId, passageResourceId: w.exits.door.passageResourceId, integrityResourceId: w.exits.door.integrityResourceId, destinationId: w.exits.door.destinationId, description: "out" } });
    expect(seen(w, "prisoner")).not.toContain("meal_tray");
    expect(seen(w, "warden")).toContain("meal_tray");
  });

  it("a thing taken out of its container is no longer hidden by that container", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    setConcealment(w, "loose_tile", 0);
    expect(seen(w, "prisoner")).toContain("banknotes");
    handTo(w, "banknotes", "prisoner");
    setConcealment(w, "loose_tile", 100);
    expect(seen(w, "prisoner")).toContain("banknotes");
  });

  it("the context carries what this principal holds at t, for the seat's holding line -- never shown to a model", () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    expect(buildOpenContext(w, "warden", now(w), 1).holding).toEqual(["key_ring"]);
    expect(buildOpenContext(w, "prisoner", now(w), 1).holding).toEqual(["spoon"]);
    handTo(w, "key_ring", "prisoner");
    expect(buildOpenContext(w, "prisoner", now(w), 1, 12, {}, "modelled").holding).toEqual(["spoon", "key_ring"]);
    expect(buildOpenContext(w, "warden", now(w), 1, 12, {}, "modelled").holding).toEqual([]);
  });
});

/**
 * Through a whole half-round: mind -> referee -> plan -> resolve() -> what
 * each side learns. The referee is scripted (test content only; production
 * code never keys on prose), exactly as every other loop test here.
 */
describe("custody through a half-round (docs/CUSTODY-DESIGN.md)", () => {
  afterEach(() => destroyTestDb());

  const TAKE_TRAY = "I pick up the tray.";
  const TAKE_TRAY_QUIETLY = "I slide the tray toward me without a sound.";
  const SNATCH_KEYS = "I snatch the key ring from Croft's belt.";
  const GIVE_WIRE = "I hand the wire to Croft.";
  const PAT_DOWN = "I pat Voss down.";
  const custodyRulings: Record<string, ScriptedRuling> = {
    ...RULINGS,
    [TAKE_TRAY]: { target: "meal_tray", effect: "take", property: "none", magnitude: "moderate", perceptibility: "visible", intentQuote: "pick up the tray", descQuote: "A shallow steel tray" },
    [TAKE_TRAY_QUIETLY]: { target: "meal_tray", effect: "take", property: "none", magnitude: "slight", perceptibility: "silent", intentQuote: "slide the tray toward me", descQuote: "A shallow steel tray" },
    [SNATCH_KEYS]: { target: "key_ring", effect: "take", property: "none", magnitude: "moderate", perceptibility: "visible", intentQuote: "snatch the key ring", descQuote: "A heavy iron ring" },
    [GIVE_WIRE]: { target: "wire", effect: "give", property: "none", magnitude: "slight", perceptibility: "visible", intentQuote: "hand the wire to Croft", descQuote: "A length of stiff iron wire" },
    [PAT_DOWN]: { target: "prisoner", effect: "expose", property: "none", magnitude: "moderate", perceptibility: "visible", intentQuote: "pat Voss down", descQuote: "Mara Voss, the prisoner" },
  };

  function setup(presence: PresenceMode = "off") {
    createTestDb();
    const openWorld = buildOpenWorld({ presence });
    const resolver = buildOpenResolver();
    const referee = createReferee([scriptedReferee(custodyRulings)], {
      isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined,
      kindOf: (id) => derivedKindOf(openWorld, id),
      propertiesOf: (id) => declaredPropertyKeys(openWorld, id),
    });
    return { w: openWorld, resolver, referee, presence };
  }
  async function half(s: ReturnType<typeof setup>, principal: "prisoner" | "warden", intent: string, roundN: number) {
    const t = principal === "prisoner" ? s.w.base.clock.prisonerT(roundN) : s.w.base.clock.wardenT(roundN);
    return runOpenHalfRound({
      openWorld: s.w,
      resolver: s.resolver,
      referee: s.referee,
      principal,
      roundN,
      t,
      context: buildOpenContext(s.w, principal, t, roundN, 12, {}, s.presence),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
      presenceMode: s.presence,
    });
  }
  const suspicion = (w: OpenWorld) => getResource(w.base.resources.wardenSuspicion)?.value;

  it("a visible take by the prisoner: she holds the thing, the other perceives the reach, and suspicion rises by the ordinary magnitude bump", async () => {
    const s = setup();
    const result = await half(s, "prisoner", TAKE_TRAY, 1);
    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan?.mechanic).toBe("OPEN_TAKE");
    expect(holderAt(s.w, "meal_tray", currentT(s.w.base.gameId))).toBe("prisoner");
    expect(result.perceptionForOther).toBe(`${PRISONER_NAME} reaches for the meal tray.`);
    expect(suspicion(s.w)).toBe(10);
    // D1 (HUMAN-INTENTS-DESIGN.md §2, §11.1, the-prisoner#26), changed on
    // purpose: every outcome now opens with what was ruled, as fiction --
    // batch 8 starts after this commit.
    expect(renderOwnOutcome(result)).toBe("You set about taking the meal tray. Your last attempt took the meal tray: you hold it now.");
    const transcript = renderOpenHalfRound(result).join("\n");
    expect(transcript).toContain("  - owner_id: ");
    expect(transcript).toContain("  - taken: the prisoner holds the meal tray");
    expect(transcript).not.toContain("(no state changed)");
    // And her next context says so, for the seat's holding line.
    const t = s.w.base.clock.prisonerT(2);
    expect(buildOpenContext(s.w, "prisoner", t, 2).holding).toEqual(["spoon", "meal_tray"]);
  });

  it("a silent take bumps nothing, and a take by the warden bumps nothing -- unchanged suspicion rules", async () => {
    const s = setup();
    await half(s, "prisoner", TAKE_TRAY_QUIETLY, 1);
    expect(holderAt(s.w, "meal_tray", currentT(s.w.base.gameId))).toBe("prisoner");
    expect(suspicion(s.w)).toBe(0);

    const t = setup();
    await half(t, "warden", TAKE_TRAY, 1);
    expect(holderAt(t.w, "meal_tray", currentT(t.w.base.gameId))).toBe("warden");
    expect(suspicion(t.w)).toBe(0);
  });

  it("PLANTED VIOLATION (C1 = A): snatching the key ring off a standing warden changes nothing, and she is told the holder is on her feet and keeps it", async () => {
    const s = setup("modelled");
    const result = await half(s, "prisoner", SNATCH_KEYS, 1);
    expect(result.plan?.mechanic).toBe("OPEN_TAKE");
    expect(result.outcome?.result.taken).toBe(false);
    expect(holderAt(s.w, "key_ring", currentT(s.w.base.gameId))).toBe("warden");
    // D1, changed on purpose (see the comment above the "visible take" test).
    expect(renderOwnOutcome(result)).toBe(`You set about taking the key ring. Your last attempt reached for the key ring, but ${WARDEN_NAME} is on her feet and keeps it.`);
    // The reach was still seen: an attempt, like a leave that meets a shut door.
    expect(result.perceptionForOther).toBe(`${PRISONER_NAME} reaches for the key ring.`);
    expect(renderOpenHalfRound(result).join("\n")).toContain("kept: the holder is on her feet");
  });

  it("PLANTED VIOLATION: a take ruled on a way out plans nothing, and the transcript says what that null establishes", async () => {
    const TAKE_DOOR = "I lift the door off its hinges and carry it.";
    const s = setup();
    s.referee = createReferee([scriptedReferee({ ...custodyRulings, [TAKE_DOOR]: { target: "door", effect: "take", property: "none", magnitude: "substantial", perceptibility: "audible", intentQuote: "lift the door off its hinges", descQuote: "A heavy door" } })]);
    const result = await half(s, "prisoner", TAKE_DOOR, 1);
    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan).toBeNull();
    expect(result.outcome).toBeNull();
    expect(suspicion(s.w)).toBe(0);
    expect(renderOpenHalfRound(result).join("\n")).toContain("Ruled applicable, but the door is out of the actor's reach, a person, or fixed in place as a way out -- did nothing.");
  });

  it("a give's transcript names the new holder", async () => {
    const s = setup();
    await half(s, "prisoner", CUT_WIRE, 1);
    const given = await half(s, "prisoner", GIVE_WIRE, 2);
    expect(renderOpenHalfRound(given).join("\n")).toContain("  - given: the warden holds the wire");
  });

  it("a thing made and handed over is held by the one it was handed to: a reshaping by her leaves the product in her hands, read from the engine", async () => {
    const s = setup();
    await half(s, "prisoner", CUT_WIRE, 1);
    expect(holderAt(s.w, "wire", currentT(s.w.base.gameId))).toBe("prisoner");
    const given = await half(s, "prisoner", GIVE_WIRE, 2);
    expect(given.outcome?.result.given).toBe(true);
    // D1, changed on purpose (see the comment above the "visible take" test).
    expect(renderOwnOutcome(given)).toBe(`You set about handing over the wire. Your last attempt handed the wire to ${WARDEN_NAME}: she holds it now.`);
    expect(holderAt(s.w, "wire", currentT(s.w.base.gameId))).toBe("warden");

    const bent = await half(s, "warden", BEND_HOOK, 3);
    expect(bent.derived?.id).toBe("hook");
    expect(bent.derived?.heldBy).toBe("warden");
    expect(holderAt(s.w, "hook", currentT(s.w.base.gameId))).toBe("warden");
  });

  it("a search through the loop: the warden pats the prisoner down and perceives what she had hidden on her", async () => {
    const s = setup("modelled");
    await half(s, "prisoner", "I tuck the spoon into my sleeve.", 1); // unscripted: does nothing
    buildOpenResolver().resolve({ gameId: s.w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: s.w.resourceIdFor["spoon.concealment"], amount: 100, min: 0, max: 100, description: "hide" } });
    const before = buildOpenContext(s.w, "warden", s.w.base.clock.wardenT(2), 2, 12, {}, "modelled");
    expect(before.perceivedObjects.map((o) => o.id)).not.toContain("spoon");

    const searched = await half(s, "warden", PAT_DOWN, 2);
    expect(searched.ruling?.applicable).toBe(true);
    expect(searched.plan?.mechanic).toBe("OPEN_SEARCH");
    // D1, changed on purpose (see the comment above the "visible take" test).
    expect(renderOwnOutcome(searched)).toBe(`You set about searching ${PRISONER_NAME}. Your search of ${PRISONER_NAME} turned up: spoon.`);
    expect(searched.perceptionForOther).toBe(`${WARDEN_NAME} searches ${PRISONER_NAME}.`);
    const after = buildOpenContext(s.w, "warden", s.w.base.clock.wardenT(3), 3, 12, {}, "modelled");
    expect(after.perceivedObjects.map((o) => o.id)).toContain("spoon");
  });
});
