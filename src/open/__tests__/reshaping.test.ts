import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { emptyLedger, beginEpisode } from "mother-of-invention";
import { getDatabase, getResource, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, derivedKindOf, nextDerivedId, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee, type Referee } from "../referee.js";
import { runOpenHalfRound, precedentTextFor, KNOWN_APPROACH_SUSPICION_BUMP } from "../loop.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import { recordGame } from "../precedent.js";
import { getBelief } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, CUT_WIRE, BEND_WIRE, HIDE_WIRE, BEND_HOOK, TWIST_CORD, TEAR_STRIP } from "./helpers/scriptedReferee.js";

/**
 * OPEN-VARIANT.md §14: reshaping a held thing. A kind whose parent is a kind
 * (§14.1) and which replaces its parent (§14.2): one resolution destroys the
 * parent item and its resources and creates the product, held by whoever
 * held the parent, carrying over every property both kinds declare.
 */

const NEGATION_TOKENS = [" not ", " no ", "n't", "never", "nothing", "absence", "isn't", "doesn't", "cannot", "can't"];
function expectPositive(text: string): void {
  const lower = ` ${text.toLowerCase()} `;
  for (const token of NEGATION_TOKENS) expect(lower.includes(token), `"${text}" contains "${token}"`).toBe(false);
}

function setup(transports?: ReaderTransport[]) {
  createTestDb();
  const openWorld = buildOpenWorld();
  const resolver = buildOpenResolver();
  const referee = createReferee(transports ?? [scriptedReferee(RULINGS)], {
    isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined,
    kindOf: (objectId) => derivedKindOf(openWorld, objectId),
  });
  return { openWorld, resolver, referee };
}

async function half(w: OpenWorld, resolver: ReturnType<typeof buildOpenResolver>, referee: Referee, principal: "prisoner" | "warden", intent: string, roundN: number, knownApproaches?: readonly string[]) {
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
    ...(knownApproaches ? { knownApproaches: knownApproaches.map((text) => ({ text, suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP })) } : {}),
  });
}

function itemsOwnedBy(characterId: string): string[] {
  return (getDatabase().prepare(`SELECT name FROM items WHERE owner_id = ? ORDER BY rowid`).all(characterId) as { name: string }[]).map((r) => r.name);
}

describe("the referee's product keys for a kind whose parent is a kind (OPEN-VARIANT.md §14.1)", () => {
  afterEach(() => destroyTestDb());

  it("offers hook when a derived object of kind wire is perceived, whatever its id, mapped by the recorded kind; never by the id's spelling", async () => {
    let questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    const capture: ReaderTransport = async (request) => {
      questions = request.questions;
      return [];
    };
    const kinds: Record<string, string> = { wire_2: "wire", hook_like: "strip" };
    await createReferee([capture], { kindOf: (id) => kinds[id] }).rule("I bend it.", [
      { id: "wire_2", description: "a wire" },
      { id: "hook_like", description: "a strip" },
    ]);
    expect(questions.find((q) => q.id === "product")?.answerKeys).toEqual(["hook", "cord", "none"]);
    expect(questions.find((q) => q.id === "product")?.prompt).toContain("hook (a hook, from the length of wire)");
    expect(questions.find((q) => q.id === "effect")?.prompt).toContain("a hook from the length of wire");

    await createReferee([capture]).rule("I bend it.", [{ id: "wire", description: "a wire" }]);
    expect(questions.find((q) => q.id === "product")?.answerKeys).toEqual(["none"]); // no kind known: nothing inferred from the id
  });
});

describe("reshaping, through a half-round (OPEN-VARIANT.md §14.2)", () => {
  afterEach(() => destroyTestDb());

  it("a hook from the wire: one resolution destroys the wire's item and resources and creates the hook, held by the wire's holder; the world forgets the wire", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const wireItem = w.entityIdFor.wire;
    const wireResources = [w.resourceIdFor["wire.integrity"], w.resourceIdFor["wire.concealment"]];

    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 2);
    expect(bent.ruling?.applicable).toBe(true);
    expect(bent.plan?.mechanic).toBe("OPEN_DERIVE");
    expect(bent.outcome?.transitions).toEqual([]);
    expect(bent.outcome?.destroyed.map((d) => d.entityId).sort()).toEqual([wireItem, ...wireResources].sort());
    expect(bent.outcome?.created.map((c) => c.entityKind)).toEqual(["item", "resource", "resource"]);
    for (const id of wireResources) expect(getResource(id)).toBeFalsy();

    expect(bent.derived).toEqual(expect.objectContaining({ id: "hook", kindId: "hook", heldBy: "prisoner" }));
    expect(bent.derived?.description).toBe(
      'A length of stiff iron wire about a hand long, bent back on itself at one end into a narrow hook, the rust flaked away along the bend. It came away from the length of wire, where "with a kink at one end".'
    );
    expect(bent.reshaped?.parent.id).toBe("wire");
    expect(w.derived.map((d) => d.id)).toEqual(["hook"]);
    expect(w.entityIdFor.wire).toBeUndefined();
    expect(w.resourceIdFor["wire.integrity"]).toBeUndefined();
    expect(derivedKindOf(w, "wire")).toBeUndefined();
    expect(itemsOwnedBy(w.base.prisonerId)).toEqual(["the spoon", "the hook"]);
  });

  it("every property both kinds declare carries its current value over (§14.2)", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    await half(w, resolver, referee, "prisoner", BEND_WIRE, 2); // integrity 100 -> 90
    await half(w, resolver, referee, "prisoner", HIDE_WIRE, 3); // concealment 0 -> 100
    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 4);
    expect(bent.derived?.id).toBe("hook");
    expect(getResource(w.resourceIdFor["hook.integrity"])?.value).toBe(90);
    expect(getResource(w.resourceIdFor["hook.concealment"])?.value).toBe(100);
    expect(getBelief(w.base.gameId, "prisoner", "hook_integrity")?.value).toBe(90);
    expect(getBelief(w.base.gameId, "prisoner", "hook_concealment")?.value).toBe(100);
  });

  it("a cord from the strip, the same way", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", TEAR_STRIP, 1);
    const twisted = await half(w, resolver, referee, "prisoner", TWIST_CORD, 2);
    expect(twisted.derived?.id).toBe("cord");
    expect(w.derived.map((d) => d.id)).toEqual(["cord"]);
    expect(renderOwnOutcome(twisted)).toBe("Your last attempt made a cord from the strip of wool: you hold it now, as cord, and the strip of wool is gone.");
  });

  it("the product's declared parent must be the target's recorded kind; a §4.1 object is never a kind's parent; a reshape with a property named still reshapes (§25)", async () => {
    const wrongKind = setup([
      scriptedReferee({
        ...RULINGS,
        [BEND_HOOK]: { ...RULINGS[BEND_HOOK], target: "strip" },
        [TWIST_CORD]: { ...RULINGS[TWIST_CORD], property: "integrity", target: "strip" },
        [CUT_WIRE + " again"]: { ...RULINGS[BEND_HOOK], target: "cot" },
      }),
    ]);
    await half(wrongKind.openWorld, wrongKind.resolver, wrongKind.referee, "prisoner", TEAR_STRIP, 1);
    const hookFromStrip = await half(wrongKind.openWorld, wrongKind.resolver, wrongKind.referee, "prisoner", BEND_HOOK, 2);
    expect(hookFromStrip.plan).toBeNull();
    const cordWithProperty = await half(wrongKind.openWorld, wrongKind.resolver, wrongKind.referee, "prisoner", TWIST_CORD, 3);
    expect(cordWithProperty.derived?.kindId).toBe("cord");
    const hookFromCot = await half(wrongKind.openWorld, wrongKind.resolver, wrongKind.referee, "prisoner", CUT_WIRE + " again", 4);
    expect(hookFromCot.plan).toBeNull();
    expect(wrongKind.openWorld.derived.map((d) => d.kindId)).toEqual(["cord"]);
  });

  it("a destroyed object's id is never reused: the next wire after a reshaped one is wire_2", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    await half(w, resolver, referee, "prisoner", BEND_HOOK, 2);
    expect(nextDerivedId(w, "wire")).toBe("wire_2");
    const again = await half(w, resolver, referee, "prisoner", CUT_WIRE, 3);
    expect(again.derived?.id).toBe("wire_2");
    expect(w.resourceNameById[w.resourceIdFor["wire_2.integrity"]]).toBe("wire_2_integrity");
  });

  it("the reshaped parent can no longer be acted on", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    await half(w, resolver, referee, "prisoner", BEND_HOOK, 2);
    const later = await half(w, resolver, referee, "prisoner", BEND_WIRE, 3);
    expect(later.context.perceivedObjects.map((o) => o.id)).not.toContain("wire");
    expect(later.outcome).toBeNull();
  });

  it("whoever held the parent holds the product: the warden reshaping the prisoner's wire leaves the hook with the prisoner", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const bent = await half(w, resolver, referee, "warden", BEND_HOOK, 2);
    expect(bent.derived).toEqual(expect.objectContaining({ id: "hook", heldBy: "prisoner" }));
    expect(itemsOwnedBy(w.base.prisonerId)).toEqual(["the spoon", "the hook"]);
    const own = renderOwnOutcome(bent) as string;
    expect(own).toBe("Your last attempt made a hook from the length of wire: Voss holds it now, as hook, and the length of wire is gone.");
    expectPositive(own);
  });
});

describe("reshaping: perception, precedent, suspicion (OPEN-VARIANT.md §14.4)", () => {
  afterEach(() => destroyTestDb());

  it("the actor is told it holds the product and the parent is gone; the other, perceiving the parent, perceives work on it; the destroyed wire leaves both briefings", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 2);
    const own = renderOwnOutcome(bent) as string;
    expect(own).toBe("Your last attempt made a hook from the length of wire: you hold it now, as hook, and the length of wire is gone.");
    expectPositive(own);
    expect(bent.perceptionForOther).toBe("Mara Voss works at the length of wire.");
    expect(bent.reshaped?.seenByOther).toBe(true);

    const t = w.base.clock.wardenT(3);
    for (const principal of ["prisoner", "warden"] as const) {
      const briefing = buildOpenContext(w, principal, t, 3).briefing;
      expect(briefing).not.toContain("You perceive the wire:");
      expect(briefing).not.toMatch(/^wire integrity:/m); // the cot's own "cot wire integrity" stays
      expect(briefing).toContain("You perceive the hook:");
      expect(computePerceivedObjects(w, principal, t).map((o) => o.id)).not.toContain("wire");
    }
  });

  it("when the other cannot perceive the parent, it perceives the act as noise, nothing about either object, and nothing is recorded as seen", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    await half(w, resolver, referee, "prisoner", HIDE_WIRE, 2);
    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 3);
    expect(bent.derived?.id).toBe("hook");
    expect(bent.reshaped?.seenByOther).toBe(false);
    expect(bent.perceptionForOther).toBe("Mara Voss works at something out of view.");
    expectPositive(bent.perceptionForOther as string);
    expect(bent.perceptionForOther).not.toContain("wire");
    expect(bent.perceptionForOther).not.toContain("hook");
    expect(recordGame(beginEpisode(emptyLedger(), "g1"), "g1", [bent]).accounts).toEqual([]);
  });

  it("precedent names the parent kind: A prisoner reshapes a length of wire. -- recorded when seen, and a known one costs the jump", async () => {
    expect(precedentTextFor({ targetObjectId: "wire", effectKind: "derive" }, "length of wire")).toBe("A prisoner reshapes a length of wire.");
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const suspicionBefore = getResource(w.base.resources.wardenSuspicion)?.value as number;
    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 2, ["A prisoner reshapes a length of wire."]);
    expect(recordGame(beginEpisode(emptyLedger(), "g1"), "g1", [bent]).accounts.map((a) => a.text)).toEqual(["A prisoner reshapes a length of wire."]);
    // audible slight derive bump 5, plus the known approach.
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(suspicionBefore + 5 + KNOWN_APPROACH_SUSPICION_BUMP);
  });

  it("the transcript shows what was reshaped and what the resolution destroyed", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", CUT_WIRE, 1);
    const wireItem = w.entityIdFor.wire;
    const bent = await half(w, resolver, referee, "prisoner", BEND_HOOK, 2);
    const text = renderOpenHalfRound(bent).join("\n");
    expect(text).toContain("made hook (hook), held by the prisoner");
    expect(text).toContain("reshaped wire (wire): it is gone");
    expect(text).toContain(`destroyed item ${wireItem}`);
  });
});
