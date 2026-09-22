import { describe, it, expect } from "vitest";
import type { ReadRequest, TransportAnswer, ReaderTransport } from "run-dmcp";
import { EFFECT_KINDS, effectRequiresProperty } from "../effects.js";
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
 * can be taken only while that holder is not on her feet (posture below 100).
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
