import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getDatabase, getResource, writeConstrainedValue, ConstraintViolationError, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenHalfRound, precedentTextFor, describeAttempt } from "../loop.js";
import { runOpenGame } from "../game.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import { fogAudit, renderOpenSummary } from "../checkpointTranscript.js";
import { recordIntent } from "../transcript.js";
import { getBelief } from "../../ledger/beliefs.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, WAIT, CUT_WIRE, PUSH_BOLT_WITH_WIRE, LEAVE_DOOR, TAKE_GRIT, HIDE_WIRE, BEND_WIRE, type ScriptedRuling } from "./helpers/scriptedReferee.js";

/**
 * OPEN-VARIANT.md §13: derive. A new thing from part of an existing one --
 * the parent's consumed property worn by its own wear table, an item and
 * its property resources created in the same resolution on run-dmcp 0.8.0's
 * `create` intent, described by code from authored text, perceived under
 * §10.1's concealment rule, and acted on later like any other object.
 */

const NEGATION_TOKENS = [" not ", " no ", "n't", "never", "nothing", "absence", "isn't", "doesn't", "cannot", "can't"];
function expectPositive(text: string): void {
  const lower = ` ${text.toLowerCase()} `;
  for (const token of NEGATION_TOKENS) expect(lower.includes(token), `"${text}" contains "${token}"`).toBe(false);
}

function setup(rulings: Record<string, ScriptedRuling> = RULINGS) {
  createTestDb();
  const openWorld = buildOpenWorld();
  const resolver = buildOpenResolver();
  const referee = createReferee([scriptedReferee(rulings)], { isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined });
  return { openWorld, resolver, referee };
}

async function half(w: OpenWorld, resolver: ReturnType<typeof buildOpenResolver>, referee: ReturnType<typeof createReferee>, principal: "prisoner" | "warden", intent: string, roundN: number) {
  const t = principal === "prisoner" ? w.base.clock.prisonerT(roundN) : w.base.clock.wardenT(roundN);
  return runOpenHalfRound({
    openWorld: w,
    resolver,
    referee,
    principal,
    roundN,
    t,
    context: buildOpenContext(w, principal, t, roundN),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
  });
}

function itemsOwnedBy(characterId: string): { name: string; properties: string }[] {
  return getDatabase().prepare(`SELECT name, properties FROM items WHERE owner_id = ? ORDER BY rowid`).all(characterId) as { name: string; properties: string }[];
}

describe("the referee's product question (OPEN-VARIANT.md §13.1)", () => {
  afterEach(() => destroyTestDb());

  it("asks a sixth question, product, whose keys are the kinds derivable from a perceived parent plus none, cited from the intent; the effect question names derive", async () => {
    let questions: readonly { id: string; prompt: string; answerKeys: readonly string[]; safeDefault: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I cut a length of wire from the cot.", [
      { id: "cot", description: "twists of wire" },
      { id: "bar", description: "an iron bar" },
    ]);
    const product = questions.find((q) => q.id === "product");
    expect(product).toBeDefined();
    expect(product?.answerKeys).toEqual(["wire", "none"]); // the blanket and tile are out of view
    expect(product?.safeDefault).toBe("none");
    expect(product?.prompt).toMatch(/Cite the exact words in the actor's intent/);
    const effect = questions.find((q) => q.id === "effect");
    expect(effect?.answerKeys).toContain("derive");
    expect(effect?.prompt).toContain("derive (");
  });

  it("a derive ruling with product none is not applicable; one whose product is cited from the wrong source is not applicable", async () => {
    const { referee } = setup({
      ...RULINGS,
      [CUT_WIRE]: { ...RULINGS[CUT_WIRE], product: "none" },
    });
    const ruling = await referee.rule(CUT_WIRE, [{ id: "cot", description: "the springs are held to the frame by twists of wire" }]);
    expect(ruling.effectKind).toBe("derive");
    expect(ruling.product).toBe("none");
    expect(ruling.applicable).toBe(false);

    const wrongSource: ReaderTransport = async (request) =>
      request.questions.map((q) => {
        const key = ({ target: "cot", effect: "derive", product: "wire", property: "integrity", magnitude: "moderate", perceptibility: "audible" } as Record<string, string>)[q.id];
        const citation =
          q.id === "property" || q.id === "product"
            ? { sourceId: "desc:cot", quote: "the springs are held to the frame by twists of wire" }
            : { sourceId: "intent", quote: "cut a length of wire" };
        return { questionId: q.id, answerKey: key, citation };
      });
    const badly = await createReferee([wrongSource]).rule("I cut a length of wire from the cot.", [{ id: "cot", description: "the springs are held to the frame by twists of wire" }]);
    expect(badly.citations.product.verified).toBe(false);
    expect(badly.applicable).toBe(false);
  });
});

describe("deriving, through a half-round (OPEN-VARIANT.md §13.1, §13.5)", () => {
  afterEach(() => destroyTestDb());

  it("a wire from the cot: the cot's integrity is worn by its own moderate table, an item the maker holds and its property resources are created in one resolution, the world registers it", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const cotIntegrity = w.resourceIdFor["cot.integrity"];
    const made = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);

    expect(made.ruling?.applicable).toBe(true);
    expect(made.plan?.mechanic).toBe("OPEN_DERIVE");
    expect(made.outcome?.result).toEqual(expect.objectContaining({ made: true, before: 100, after: 80 })); // cot wear moderate = 20
    expect(getResource(cotIntegrity)?.value).toBe(80);

    // One resolution: the wear, the item, its two resources.
    expect(made.outcome?.created.map((c) => c.entityKind)).toEqual(["item", "resource", "resource"]);
    expect(itemsOwnedBy(w.base.prisonerId).map((i) => i.name)).toEqual(["the spoon", "the length of wire"]);

    const record = made.derived;
    expect(record).toEqual(expect.objectContaining({ id: "wire", kindId: "wire", heldBy: "prisoner" }));
    expect(record?.description).toContain('It came away from the cot, where "the springs are held to the frame by twists of wire".');
    expect(w.derived).toEqual([record]);
    expect(w.entityIdFor.wire).toBe(made.outcome?.created[0].entityId);
    expect(w.resourceIdFor["wire.integrity"]).toEqual(expect.any(String));
    expect(w.resourceIdFor["wire.concealment"]).toEqual(expect.any(String));
    expect(w.resourceNameById[w.resourceIdFor["wire.integrity"]]).toBe("wire_integrity");
    expect(getResource(w.resourceIdFor["wire.integrity"])?.value).toBe(100);
    expect(getResource(w.resourceIdFor["wire.concealment"])?.value).toBe(0);
    expect(declaredProperty(w, "wire", "integrity")?.resourceName).toBe("wire_integrity");

    // The maker knows the new thing's state, and the parent's.
    expect(getBelief(w.base.gameId, "prisoner", "wire_integrity")?.value).toBe(100);
    expect(getBelief(w.base.gameId, "prisoner", "cot_wire_integrity")?.value).toBe(80);
  });

  it("the new resources are bounded and resolve_only, like every property in the world: a write outside a resolution is refused", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    expect(() => writeConstrainedValue({ entityId: w.resourceIdFor["wire.integrity"], key: "value", mode: "delta", value: -10 })).toThrow(ConstraintViolationError);
  });

  it("what each side is told: the maker holds it now and learns the parent's numbers; the other perceives work on the parent and nothing about the product", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const own = renderOwnOutcome(made) as string;
    expect(own).toBe("Your last attempt made a length of wire from the cot: you hold it now, as wire. The cot's integrity went from 100 to 80.");
    expectPositive(own);
    expect(made.perceptionForOther).toBe("Mara Voss works a piece loose from the cot.");
    expect(made.perceptionForOther).not.toContain("wire");
    expect(precedentTextFor({ targetObjectId: "cot", effectKind: "derive" })).toBe("A prisoner works a piece loose from the cot.");
    expectPositive(describeAttempt("warden", { targetObjectId: "blanket", effectKind: "derive" }));
  });

  it("perception (§13.3): the maker always perceives the derived object; the other does until it is concealed at 50 or more", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const t = w.base.clock.wardenT(2);
    expect(computePerceivedObjects(w, "prisoner", t).map((o) => o.id)).toContain("wire");
    expect(computePerceivedObjects(w, "warden", t).map((o) => o.id)).toContain("wire");
    expect(computePerceivedObjects(w, "warden", t).find((o) => o.id === "wire")?.description).toContain("It came away from the cot");

    const hidden = await half(w, resolver, referee, "prisoner", HIDE_WIRE, 2);
    expect(hidden.outcome?.result).toEqual(expect.objectContaining({ after: 100 }));
    const later = w.base.clock.wardenT(3);
    expect(computePerceivedObjects(w, "prisoner", later).map((o) => o.id)).toContain("wire");
    expect(computePerceivedObjects(w, "warden", later).map((o) => o.id)).not.toContain("wire");
  });

  it("a derived object takes the same generic effects later, grounded on its composed description", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const bent = await half(w, resolver, referee, "prisoner", BEND_WIRE, 2);
    expect(bent.ruling?.applicable).toBe(true);
    expect(bent.plan?.mechanic).toBe("OPEN_WEAR");
    expect(bent.outcome?.result).toEqual(expect.objectContaining({ before: 100, after: 90 }));
    expect(getResource(w.resourceIdFor["wire.integrity"])?.value).toBe(90);
  });

  it("grit from the tile consumes nothing: property none with the cited hollow, an object with concealment only, the tile untouched", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", TAKE_GRIT, 1);
    expect(made.ruling?.applicable).toBe(true);
    expect(made.outcome?.result).toEqual(expect.objectContaining({ made: true }));
    expect(made.outcome?.transitions).toEqual([]);
    expect(made.outcome?.created.map((c) => c.entityKind)).toEqual(["item", "resource"]);
    expect(made.derived?.id).toBe("grit");
    expect(renderOwnOutcome(made)).toBe("Your last attempt made a handful of grit from the loose tile: you hold it now, as grit.");
  });

  it("a second of the same kind is wire_2", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const again = await half(w, resolver, referee, "prisoner", CUT_WIRE, 2);
    expect(again.derived?.id).toBe("wire_2");
    expect(w.derived.map((d) => d.id)).toEqual(["wire", "wire_2"]);
    expect(w.resourceNameById[w.resourceIdFor["wire_2.integrity"]]).toBe("wire_2_integrity");
  });

  it("what a kind consumes is the kind's own, whatever property the referee named: grit ruled with concealment still comes away, the tile untouched (OPEN-VARIANT.md §25)", async () => {
    // §24.2: with the tile's properties listed, the live referee answered concealment for grit, every time.
    const { openWorld: w, resolver, referee } = setup({ ...RULINGS, [TAKE_GRIT]: { ...RULINGS[TAKE_GRIT], property: "concealment" } });
    const made = await half(w, resolver, referee, "prisoner", TAKE_GRIT, 1);
    expect(made.derived?.id).toBe("grit");
    expect(made.outcome?.transitions).toEqual([]);
  });

  it("a wire ruled with property none still wears the cot's integrity, the property the kind consumes (OPEN-VARIANT.md §25)", async () => {
    const { openWorld: w, resolver, referee } = setup({ ...RULINGS, [CUT_WIRE]: { ...RULINGS[CUT_WIRE], property: "none" } });
    const made = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    expect(made.derived?.id).toBe("wire");
    expect(getResource(w.resourceIdFor["cot.integrity"])?.value).toBeLessThan(100);
  });

  it("a product whose declared parent is not the target does nothing (an incoherent ruling)", async () => {
    const { openWorld: w, resolver, referee } = setup({
      ...RULINGS,
      [CUT_WIRE]: { ...RULINGS[CUT_WIRE], product: "strip" },
      [TAKE_GRIT]: { ...RULINGS[TAKE_GRIT], product: "wire" },
    });
    const wrongParent = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    expect(wrongParent.ruling?.applicable).toBe(true);
    expect(wrongParent.plan).toBeNull();
    expect(wrongParent.outcome).toBeNull();
    expect(w.derived).toEqual([]);
    const wrongParentAgain = await half(w, resolver, referee, "prisoner", TAKE_GRIT, 2);
    expect(wrongParentAgain.plan).toBeNull();
    expect(itemsOwnedBy(w.base.prisonerId)).toHaveLength(1);
  });

  it("a stripped parent yields nothing: the attempt resolves, creates nothing, and the actor is told the parent's state, positively", async () => {
    const { openWorld: w, resolver, referee } = setup();
    resolver.resolve({ gameId: w.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: w.resourceIdFor["cot.integrity"], amount: 1000, min: 0, max: 100, description: "x" } });
    const tried = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    expect(tried.outcome?.result).toEqual(expect.objectContaining({ made: false, before: 0 }));
    expect(tried.outcome?.created).toEqual([]);
    expect(tried.derived).toBeNull();
    expect(w.derived).toEqual([]);
    const own = renderOwnOutcome(tried) as string;
    expect(own).toBe("Your last attempt met the cot with its integrity at 0, already stripped.");
    expectPositive(own);
  });

  it("the transcript's intent record counts a derive as novel: no closed move makes anything", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    expect(recordIntent(made).novel).toBe(true);
  });
});

describe("a whole game: escape with a derived object (issue #4, step 4)", () => {
  afterEach(() => destroyTestDb());

  it("cut a wire, push the bolt back with it, walk out: escaped at round 3, the wire in view when it was used, every effect cited, no fog leak", async () => {
    const { openWorld: w, resolver, referee } = setup();
    let turn = 0;
    const prisonerMind: OpenMind = {
      async consider() {
        turn += 1;
        return turn === 1 ? { intent: CUT_WIRE } : turn === 2 ? { intent: PUSH_BOLT_WITH_WIRE } : { intent: LEAVE_DOOR };
      },
    };
    const game = await runOpenGame({
      openWorld: w,
      resolver,
      referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind,
      rounds: 12,
    });

    expect(game.ended).toEqual({ kind: "escaped" });
    expect(game.endedAtRound).toBe(3);

    const round2 = game.halves.find((h) => h.roundN === 2 && h.principal === "prisoner");
    expect(round2?.context.perceivedObjects.map((o) => o.id)).toContain("wire");
    expect(round2?.proposal?.intent).toContain("wire");
    expect(round2?.ruling?.effectKind).toBe("open");
    expect(round2?.outcome?.result).toEqual(expect.objectContaining({ before: 0, after: 1 }));

    const round2Warden = game.halves.find((h) => h.roundN === 2 && h.principal === "warden");
    expect(round2Warden?.context.briefing).toContain("works a piece loose from the cot");
    expect(round2Warden?.context.briefing).toContain("You perceive the wire:");

    const applied = game.halves.filter((h) => h.outcome && h.ruling);
    for (const h of applied) {
      expect(h.ruling?.citations.target.verified).toBe(true);
      expect(h.ruling?.citations.effect.verified).toBe(true);
      expect(h.ruling?.citations.property.verified).toBe(true);
    }
    expect(fogAudit(game.halves).leaks).toEqual([]);
    const summary = renderOpenSummary(game, 12).join("\n");
    // derive, open and leave all lack a closed equivalent by §5.2's declared table.
    expect(summary).toContain("Novel (object, effect) pairs with no closed-variant equivalent: 3.");
    expect(summary).toMatch(/-> derive cot\.integrity \(moderate, audible\) \*\*\(novel\)\*\*/);
  });
});
