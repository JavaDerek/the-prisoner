import { describe, it, expect, afterEach } from "vitest";
import { ConstraintViolationError, getResource, listConstraints, type ImprovisedRulingParameters, type ReaderTransport, type ReadRequest } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import {
  readImproviseMode,
  SUSPICION_TIERS,
  SUSPICION_IMPROVISED_RULING,
  improvisedSuspicionParameters,
  createSuspicionImproviser,
  improviseSuspicion,
} from "../improvisedRuling.js";

/**
 * "Unlisted is not impossible" (run-dmcp's AUTHORING-GUIDE.md, NPC-MINDS-ARCHITECTURE.md §3.5): an act the referee
 * rules onto nothing may still receive a bounded improvised ruling -- here, on `warden_suspicion` alone, raise only,
 * with the owner's caps (minor 2 / serious 5 / outrage 10, outrage confirmed by a second call). These tests pin the
 * DATA and the MAPPING; the separate reading and the half-round wiring have their own describe blocks below.
 */

describe("PRISONER_IMPROVISE (readImproviseMode)", () => {
  it("is off unless asked, so every recorded batch is unchanged", () => {
    expect(readImproviseMode(undefined)).toBe("off");
    expect(readImproviseMode("")).toBe("off");
    expect(readImproviseMode("off")).toBe("off");
  });

  it("accepts suspicion, the one arm", () => {
    expect(readImproviseMode("suspicion")).toBe("suspicion");
  });

  it("throws on anything else, naming the variable", () => {
    expect(() => readImproviseMode("on")).toThrow(/PRISONER_IMPROVISE/);
  });
});

describe("the suspicion tiers (owner's caps, 2026-10-16)", () => {
  it("are minor 2, serious 5, outrage 10 -- and only outrage needs a confirmation", () => {
    expect(SUSPICION_TIERS).toEqual([
      { key: "minor", cap: 2 },
      { key: "serious", cap: 5 },
      { key: "outrage", cap: 10, requiresConfirmation: true },
    ]);
  });

  it("keep even an outrage below the grounds threshold, so no single improvised act can by itself give grounds for a catch", () => {
    // SEARCH_SUSPICION_THRESHOLD is 40 (world/mechanics.ts); a catch still needs it AND evidence (gameEnd.ts).
    expect(Math.max(...SUSPICION_TIERS.map((t) => t.cap))).toBeLessThan(40);
  });
});

describe("improvisedSuspicionParameters -- the game's own mapping, raise only", () => {
  const base = { resourceId: "res-suspicion", citedAct: "shout insults at the warden", current: 0, max: 100 };

  it("maps each tier to its cap, as a positive amount on the suspicion value", () => {
    const minor = improvisedSuspicionParameters({ ...base, tier: "minor" }) as ImprovisedRulingParameters;
    expect(minor.targets).toEqual([{ entityId: "res-suspicion", key: "value", tier: "minor", amount: 2 }]);
    expect(improvisedSuspicionParameters({ ...base, tier: "serious" })?.targets[0].amount).toBe(5);
    expect(improvisedSuspicionParameters({ ...base, tier: "outrage", confirmation: "confirm-1" })?.targets[0].amount).toBe(10);
  });

  it("records the cited act verbatim, a rationale naming the tier, and the confirmation only where given", () => {
    const minor = improvisedSuspicionParameters({ ...base, tier: "minor" }) as ImprovisedRulingParameters;
    expect(minor.citedAct).toBe("shout insults at the warden");
    expect(minor.rationale).toMatch(/minor/);
    expect(minor.confirmation).toBeUndefined();
    expect(minor.precedentKey).toBeUndefined();
    const outrage = improvisedSuspicionParameters({ ...base, tier: "outrage", confirmation: "confirm-1" }) as ImprovisedRulingParameters;
    expect(outrage.confirmation).toBe("confirm-1");
  });

  it("refuses to build an outrage without a confirmation -- the engine would refuse it too, but the game never asks", () => {
    expect(() => improvisedSuspicionParameters({ ...base, tier: "outrage" })).toThrow(/confirmation/);
  });

  it("moves no further than the value's own headroom: a cap is a ceiling, not a quota, and the bound would refuse the excess", () => {
    expect(improvisedSuspicionParameters({ ...base, tier: "serious", current: 98 })?.targets[0].amount).toBe(2);
    expect(improvisedSuspicionParameters({ ...base, tier: "minor", current: 100 })).toBeNull();
  });

  it("never yields a zero or negative amount, whatever it is handed", () => {
    for (const tier of ["minor", "serious"] as const) {
      for (const current of [0, 1, 50, 99, 100, 120]) {
        const p = improvisedSuspicionParameters({ ...base, tier, current });
        if (p) expect(p.targets.every((t) => t.amount > 0)).toBe(true);
      }
    }
  });
});

describe("buildOpenWorld({ improvise }) -- the declaration", () => {
  afterEach(() => destroyTestDb());

  it("off (the default) declares nothing new on warden_suspicion: bounded and resolve_only, as before", () => {
    createTestDb();
    const w = buildOpenWorld();
    const kinds = listConstraints(w.base.gameId, w.base.resources.wardenSuspicion).map((c) => c.kind).sort();
    expect(kinds).toEqual(["bounded", "resolve_only"]);
  });

  it("suspicion declares warden_suspicion improvisable with the three tiers, and monotonic non-decreasing", () => {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion" });
    const constraints = listConstraints(w.base.gameId, w.base.resources.wardenSuspicion);
    const improvisable = constraints.find((c) => c.kind === "improvisable");
    expect(improvisable?.tiers?.map((t) => ({ key: t.key, cap: t.cap, requiresConfirmation: t.requiresConfirmation }))).toEqual([
      { key: "minor", cap: 2, requiresConfirmation: false },
      { key: "serious", cap: 5, requiresConfirmation: false },
      { key: "outrage", cap: 10, requiresConfirmation: true },
    ]);
    expect(constraints.find((c) => c.kind === "monotonic")?.direction).toBe("increasing");
  });

  it("declares NOTHING else improvisable -- the escape gates, the spoon, every person's state stay out of reach", () => {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion", presence: "modelled", harm: "on" });
    const improvisable = listConstraints(w.base.gameId).filter((c) => c.kind === "improvisable");
    expect(improvisable.flatMap((c) => c.resourceIds)).toEqual([w.base.resources.wardenSuspicion]);
  });
});

describe("the engine holds the declaration (run-dmcp 0.11.0's improvised_ruling, through the game's resolver)", () => {
  afterEach(() => destroyTestDb());

  function setup() {
    createTestDb();
    const w = buildOpenWorld({ improvise: "suspicion", presence: "modelled" });
    return { w, resolver: buildOpenResolver() };
  }
  const suspicion = (w: ReturnType<typeof buildOpenWorld>) => getResource(w.base.resources.wardenSuspicion)?.value;
  const rule = (resolver: ReturnType<typeof buildOpenResolver>, gameId: string, parameters: ImprovisedRulingParameters) =>
    resolver.resolve({ gameId, mechanic: SUSPICION_IMPROVISED_RULING, parameters: parameters as unknown as Record<string, unknown> });
  const refusal = (fn: () => unknown): ConstraintViolationError => {
    try {
      fn();
    } catch (err) {
      if (err instanceof ConstraintViolationError) return err;
      throw err;
    }
    throw new Error("expected a refusal");
  };

  it("lands a mapped minor ruling as +2", () => {
    const { w, resolver } = setup();
    rule(resolver, w.base.gameId, improvisedSuspicionParameters({ resourceId: w.base.resources.wardenSuspicion, citedAct: "spit", tier: "minor", current: 0, max: 100 }) as ImprovisedRulingParameters);
    expect(suspicion(w)).toBe(2);
  });

  it("refuses a negative ruling structurally (monotonic), even one inside the cap -- talk never lowers suspicion", () => {
    const { w, resolver } = setup();
    rule(resolver, w.base.gameId, improvisedSuspicionParameters({ resourceId: w.base.resources.wardenSuspicion, citedAct: "spit", tier: "serious", current: 0, max: 100 }) as ImprovisedRulingParameters);
    const err = refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: w.base.resources.wardenSuspicion, tier: "minor", amount: -2 }], rationale: "calmed", citedAct: "I am harmless" }));
    expect(err.constraintKind).toBe("monotonic");
    expect(suspicion(w)).toBe(5);
  });

  it("refuses over-cap and an unconfirmed outrage, as kind improvisable", () => {
    const { w, resolver } = setup();
    const id = w.base.resources.wardenSuspicion;
    expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "minor", amount: 3 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("over-cap");
    expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "outrage", amount: 10 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("confirmation-required");
    expect(suspicion(w)).toBe(0);
  });

  it("refuses any improvised ruling on an escape gate (not-improvisable)", () => {
    const { w, resolver } = setup();
    for (const [object, key] of [["bar", "integrity"], ["lock", "integrity"], ["door", "passage"], ["window", "passage"], ["spoon", "edge"], ["prisoner", "posture"], ["warden", "sight"]] as const) {
      const id = resourceIdForProperty(w, object, key) as string;
      expect(id, `${object}.${key}`).toBeTruthy();
      expect(refusal(() => rule(resolver, w.base.gameId, { targets: [{ entityId: id, tier: "minor", amount: 1 }], rationale: "r", citedAct: "a" })).improvisation?.rule).toBe("not-improvisable");
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The separate reading (the project's measured lesson: reading works only as a SEPARATE small call) and the
// orchestration that turns it into at most one ruling.
// ---------------------------------------------------------------------------------------------------------------

const INSULT = "I grip the bars and shout every insult I know at Warden Croft.";
const INSULT_QUOTE = "shout every insult I know at Warden Croft";

type Scripted = { key: string; quote: string };
/** A scripted transport for the improvisation readers: answers each question by its id from a table the TEST wrote,
 *  cited from the intent -- and counts how often it was asked. */
function scriptedReading(byQuestion: Record<string, Scripted>): ReaderTransport & { calls: number; requests: ReadRequest[] } {
  const transport = (async (request: ReadRequest) => {
    transport.calls += 1;
    transport.requests.push(request);
    return request.questions.flatMap((q) => {
      const s = byQuestion[q.id];
      return s ? [{ questionId: q.id, answerKey: s.key, citation: { sourceId: "intent", quote: s.quote } }] : [];
    });
  }) as unknown as ReaderTransport & { calls: number; requests: ReadRequest[] };
  transport.calls = 0;
  transport.requests = [];
  return transport;
}

describe("createSuspicionImproviser -- two separate one-question reads, the intent the only source", () => {
  it("asks ONE question with the four closed keys, safe default none, and nothing but the intent as a source", async () => {
    const transport = scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } });
    const reading = await createSuspicionImproviser([transport]).read(INSULT, 7);
    expect(transport.calls).toBe(1);
    const request = transport.requests[0];
    expect(request.questions.map((q) => q.id)).toEqual(["suspicion"]);
    expect(request.questions[0].answerKeys).toEqual(["none", "minor", "serious", "outrage"]);
    expect(request.questions[0].safeDefault).toBe("none");
    expect(request.sources).toEqual([{ id: "intent", text: INSULT }]);
    expect(reading.answer).toBe("serious");
    expect(reading.citation.verified).toBe(true);
    expect(reading.citation.citation?.quote).toBe(INSULT_QUOTE);
    expect(reading.id).toBe("improvise:t=7:suspicion");
  });

  it("a citation that is not the actor's verbatim words does not verify", async () => {
    const transport = scriptedReading({ suspicion: { key: "serious", quote: "threatens to kill him" } });
    const reading = await createSuspicionImproviser([transport]).read(INSULT, 7);
    expect(reading.citation.verified).toBe(false);
  });

  it("the confirmation is its own call with its own question, outrage or lesser, safe default lesser", async () => {
    const transport = scriptedReading({ outrage: { key: "outrage", quote: INSULT_QUOTE } });
    const confirmation = await createSuspicionImproviser([transport]).confirm(INSULT, 7);
    const request = transport.requests[0];
    expect(request.questions.map((q) => q.id)).toEqual(["outrage"]);
    expect(request.questions[0].answerKeys).toEqual(["outrage", "lesser"]);
    expect(request.questions[0].safeDefault).toBe("lesser");
    expect(request.sources).toEqual([{ id: "intent", text: INSULT }]);
    expect(confirmation.confirmed).toBe(true);
    expect(confirmation.id).toBe("improvise:t=7:outrage");
  });

  it("an unverified outrage does not confirm", async () => {
    const confirmation = await createSuspicionImproviser([scriptedReading({ outrage: { key: "outrage", quote: "not in the intent" } })]).confirm(INSULT, 7);
    expect(confirmation.confirmed).toBe(false);
  });
});

describe("improviseSuspicion -- at most one ruling, raise only, never a crash", () => {
  afterEach(() => destroyTestDb());

  function setup(options: { improvise?: "off" | "suspicion" } = { improvise: "suspicion" }) {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled", ...options });
    return { w, resolver: buildOpenResolver() };
  }
  const suspicion = (w: ReturnType<typeof buildOpenWorld>) => getResource(w.base.resources.wardenSuspicion)?.value;
  const run = (w: ReturnType<typeof buildOpenWorld>, resolver: ReturnType<typeof buildOpenResolver>, transport: ReaderTransport, perceivable = true) =>
    improviseSuspicion({ openWorld: w, resolver, improviser: createSuspicionImproviser([transport]), intentText: INSULT, t: w.base.clock.prisonerT(1), perceivable });

  it("an act the warden cannot perceive raises nothing -- and no model is even asked", async () => {
    const { w, resolver } = setup();
    const transport = scriptedReading({ suspicion: { key: "outrage", quote: INSULT_QUOTE }, outrage: { key: "outrage", quote: INSULT_QUOTE } });
    const result = await run(w, resolver, transport, false);
    expect(transport.calls).toBe(0);
    expect(result).toEqual(expect.objectContaining({ asked: false, reading: null, tier: null, outcome: null, refusal: null }));
    expect(suspicion(w)).toBe(0);
  });

  it("none resolves nothing", async () => {
    const { w, resolver } = setup();
    const result = await run(w, resolver, scriptedReading({ suspicion: { key: "none", quote: INSULT_QUOTE } }));
    expect(result.asked).toBe(true);
    expect(result.tier).toBeNull();
    expect(result.outcome).toBeNull();
    expect(suspicion(w)).toBe(0);
  });

  it("an ungrounded tier (citation not verbatim) resolves nothing", async () => {
    const { w, resolver } = setup();
    const result = await run(w, resolver, scriptedReading({ suspicion: { key: "serious", quote: "words she never wrote" } }));
    expect(result.tier).toBeNull();
    expect(suspicion(w)).toBe(0);
  });

  it("minor raises by 2 and serious by 5, recording the cited act and rationale on the resolution", async () => {
    const minor = setup();
    const m = await run(minor.w, minor.resolver, scriptedReading({ suspicion: { key: "minor", quote: INSULT_QUOTE } }));
    expect(m.tier).toBe("minor");
    expect(suspicion(minor.w)).toBe(2);
    expect(m.outcome?.result).toEqual(expect.objectContaining({ citedAct: INSULT_QUOTE, confirmation: null, precedentKey: null }));
    expect(String(m.outcome?.result.rationale)).toMatch(/tier minor/);
    destroyTestDb();
    const serious = setup();
    await run(serious.w, serious.resolver, scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } }));
    expect(suspicion(serious.w)).toBe(5);
  });

  it("outrage CONFIRMED by the second call raises by 10, passing the confirming reading's id as the confirmation", async () => {
    const { w, resolver } = setup();
    const transport = scriptedReading({ suspicion: { key: "outrage", quote: INSULT_QUOTE }, outrage: { key: "outrage", quote: INSULT_QUOTE } });
    const result = await run(w, resolver, transport);
    expect(transport.calls).toBe(2);
    expect(result.tier).toBe("outrage");
    expect(result.confirmation?.confirmed).toBe(true);
    expect(result.outcome?.result.confirmation).toBe(result.confirmation?.id);
    expect(suspicion(w)).toBe(10);
  });

  it("outrage NOT confirmed falls back to serious (+5), and says so in the rationale", async () => {
    const { w, resolver } = setup();
    const transport = scriptedReading({ suspicion: { key: "outrage", quote: INSULT_QUOTE }, outrage: { key: "lesser", quote: INSULT_QUOTE } });
    const result = await run(w, resolver, transport);
    expect(transport.calls).toBe(2);
    expect(result.confirmation?.confirmed).toBe(false);
    expect(result.tier).toBe("serious");
    expect(result.outcome?.result.confirmation).toBeNull();
    expect(String(result.outcome?.result.rationale)).toMatch(/not confirmed/);
    expect(suspicion(w)).toBe(5);
  });

  it("an engine refusal is recorded, not thrown: the turn goes on and nothing moved", async () => {
    // A world built with the arm OFF declares nothing improvisable, so the engine refuses the ruling outright.
    const { w, resolver } = setup({ improvise: "off" });
    const result = await run(w, resolver, scriptedReading({ suspicion: { key: "serious", quote: INSULT_QUOTE } }));
    expect(result.tier).toBe("serious");
    expect(result.outcome).toBeNull();
    expect(result.refusal).toBeInstanceOf(ConstraintViolationError);
    expect((result.refusal as ConstraintViolationError).improvisation?.rule).toBe("not-improvisable");
    expect(suspicion(w)).toBe(0);
  });
});
