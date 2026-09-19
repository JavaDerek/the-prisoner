import { describe, it, expect } from "vitest";
import { recordIntent, newMeasurements, noteIntent, hasClosedEquivalent, CLOSED_EQUIVALENTS } from "../transcript.js";
import type { OpenHalfRoundResult } from "../loop.js";
import type { RefereeRuling } from "../referee.js";

function verifiedCitation(sourceId: string, quote: string) {
  return { citation: { sourceId, quote }, requiredSourceId: sourceId, verified: true };
}

function ruling(over: Partial<RefereeRuling>): RefereeRuling {
  return {
    targetObjectId: "bar",
    effectKind: "wear",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "audible",
    product: "none",
    applicable: true,
    citations: {
      target: verifiedCitation("intent", "x"),
      effect: verifiedCitation("intent", "x"),
      property: verifiedCitation("desc:bar", "x"),
      product: verifiedCitation("intent", "x"),
    },
    raw: { answers: [], unmatched: [] },
    request: { questions: [], sources: [] },
    ...over,
  };
}

function half(over: Partial<OpenHalfRoundResult>): OpenHalfRoundResult {
  return {
    principal: "prisoner",
    t: 1,
    roundN: 1,
    context: { principalId: "p", identity: "", motive: "", briefing: "", perceivedObjects: [] },
    proposal: { intent: "file the bar" },
    ruling: ruling({}),
    plan: null,
    outcome: null,
    refusalError: null,
    derived: null,
    reshaped: null, pick: null,
    perceptionForOther: null,
    revealFor: null,
    resourceName: null,
    elaboration: null,
    acquired: null,
    ...over,
  };
}

describe("CLOSED_EQUIVALENTS / hasClosedEquivalent (OPEN-VARIANT.md §5.2, novelty)", () => {
  it("a FILE-shaped wear on the bar has a closed equivalent", () => {
    expect(hasClosedEquivalent("bar", "wear")).toBe(true);
  });
  it("wearing the cot's wire has no closed-variant equivalent -- it is novel", () => {
    expect(hasClosedEquivalent("cot", "wear")).toBe(false);
  });
  it("the declared table is non-empty content", () => {
    expect(CLOSED_EQUIVALENTS.length).toBeGreaterThan(0);
  });
});

describe("recordIntent", () => {
  it("silence records a null intent, not applicable, not resolved", () => {
    const record = recordIntent(half({ proposal: null, ruling: null }));
    expect(record.intent).toBeNull();
    expect(record.applicable).toBe(false);
    expect(record.resolved).toBe(false);
  });

  it("an applicable, resolved wear on the bar is grounded and NOT novel", () => {
    const record = recordIntent(half({ outcome: { transitions: [] } as never }));
    expect(record.applicable).toBe(true);
    expect(record.resolved).toBe(true);
    expect(record.novel).toBe(false);
  });

  it("an applicable effect on an object with no closed equivalent is novel", () => {
    const record = recordIntent(half({ ruling: ruling({ targetObjectId: "cot" }) }));
    expect(record.novel).toBe(true);
  });

  it("an inapplicable ruling is never counted as novel (nothing happened to be novel about)", () => {
    const record = recordIntent(half({ ruling: ruling({ targetObjectId: "none", applicable: false }) }));
    expect(record.novel).toBe(false);
  });
});

describe("measurements accumulation", () => {
  it("counts grounded vs impossible, resolutions, refusals, novelty, and pivots", () => {
    const m = newMeasurements();

    // Round 1: prisoner grounded and resolved (bar wear -- has closed equivalent).
    noteIntent(m, recordIntent(half({ principal: "prisoner", outcome: {} as never })));
    // Round 2: prisoner refused (bar wear again).
    noteIntent(m, recordIntent(half({ principal: "prisoner", outcome: null, refusalError: {} as never })));
    // Round 3: same prisoner, DIFFERENT target -- a pivot.
    noteIntent(m, recordIntent(half({ principal: "prisoner", ruling: ruling({ targetObjectId: "cot" }), outcome: {} as never })));
    // Round 4: an inapplicable (impossible) intent.
    noteIntent(m, recordIntent(half({ principal: "warden", ruling: ruling({ applicable: false, targetObjectId: "none" }) })));
    // Round 5: a silence.
    noteIntent(m, recordIntent(half({ principal: "warden", proposal: null, ruling: null })));

    expect(m.totalIntents).toBe(5);
    expect(m.silences).toBe(1);
    expect(m.groundedCount).toBe(3); // rounds 1, 2 (still applicable, just refused), 3
    expect(m.impossibleCount).toBe(1); // round 4
    expect(m.resolutions).toBe(2); // rounds 1 and 3
    expect(m.refusals).toBe(1); // round 2
    expect(m.novelCount).toBe(1); // round 3 (cot has no closed equivalent)
    expect(m.pivots).toBe(1); // round 3 changed target after round 2's refusal
  });
});
