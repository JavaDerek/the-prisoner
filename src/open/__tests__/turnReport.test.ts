import { describe, it, expect } from "vitest";
import type { OpenHalfRoundResult } from "../loop.js";
import type { RefereeRuling } from "../referee.js";
import { classifyCapture, buildHumanTurnRow, humanTurnRowsFor, renderHumanTurnRows, type HumanTurnRow, type TurnReportVersions } from "../turnReport.js";

/**
 * docs/HUMAN-INTENTS-DESIGN.md §8.2, §9 step 9, the-prisoner#43: one report
 * row per human half-round. `classifyCapture`/`buildHumanTurnRow` are pure
 * functions of an `OpenHalfRoundResult` (plus, for the row, the versions the
 * caller already knows once per run) -- built and tested here exactly as
 * `checkpointTranscript.test.ts`'s own `halfWithRuling` builds a half by
 * hand, never through a live model or a real database.
 */

const VERSIONS: TurnReportVersions = { runDmcp: "0.9.0", game: "0.1.0", codeRevision: "`abc1234` (clean)" };

/** A minimal, fully-answered `RefereeRuling` -- the shape `humanSeat.test.ts`'s
 *  own `ruling()` helper uses, generalised so each test overrides only what
 *  it is about. */
function makeRuling(overrides: Partial<RefereeRuling> = {}): RefereeRuling {
  return {
    targetObjectId: "bar",
    effectKind: "wear",
    property: "integrity",
    magnitude: "moderate",
    perceptibility: "audible",
    product: "none",
    applicable: true,
    citations: {
      target: { citation: { sourceId: "intent", quote: "bar" }, requiredSourceId: "intent", verified: true },
      effect: { citation: { sourceId: "intent", quote: "scrape" }, requiredSourceId: "intent", verified: true },
      property: { citation: { sourceId: "desc:bar", quote: "Rust has pitted it" }, requiredSourceId: "desc:bar", verified: true },
      product: { citation: null, requiredSourceId: null, verified: false },
    },
    raw: {
      answers: [
        { questionId: "target", answerKey: "bar", fromSafeDefault: false, answeredByRung: 0, citation: { sourceId: "intent", quote: "bar" }, rejected: [] },
        { questionId: "effect", answerKey: "wear", fromSafeDefault: false, answeredByRung: 0, citation: { sourceId: "intent", quote: "scrape" }, rejected: [] },
      ],
      unmatched: [],
    },
    request: { questions: [{ id: "target", prompt: "p", answerKeys: ["bar", "none"], safeDefault: "none" }], sources: [{ id: "intent", text: "scrape the bar" }] },
    ...overrides,
  };
}

/** An unread-target ruling: the referee's TARGET fell to its safe default
 *  while EFFECT is cited from the intent -- exactly `targetUnreadWithEffectCited`'s
 *  own condition (referee.ts), built the structural way rather than asserted
 *  by name. */
function unreadTargetRuling(): RefereeRuling {
  return makeRuling({
    targetObjectId: "none",
    applicable: false,
    citations: {
      target: { citation: null, requiredSourceId: null, verified: false },
      effect: { citation: { sourceId: "intent", quote: "hide" }, requiredSourceId: "intent", verified: true },
      property: { citation: null, requiredSourceId: null, verified: false },
      product: { citation: null, requiredSourceId: null, verified: false },
    },
    raw: {
      answers: [
        { questionId: "target", answerKey: "none", fromSafeDefault: true, answeredByRung: null, citation: null, rejected: [] },
        { questionId: "effect", answerKey: "conceal", fromSafeDefault: false, answeredByRung: 0, citation: { sourceId: "intent", quote: "hide" }, rejected: [] },
      ],
      unmatched: [],
    },
  });
}

/** A full `OpenHalfRoundResult`, every field present, so each test overrides
 *  only what it is about -- the same discipline `checkpointTranscript.test.ts`'s
 *  own `halfWithRuling` helper uses. */
function baseHalf(overrides: Partial<OpenHalfRoundResult> = {}): OpenHalfRoundResult {
  return {
    principal: "prisoner",
    t: 1,
    roundN: 1,
    context: { principalId: "p", identity: "You are Mara Voss.", motive: "Get out.", briefing: "Round 1 of 12.", perceivedObjects: [{ id: "bar", description: "Rust has pitted it near the bottom." }] },
    proposal: { intent: "scrape the bar" },
    ruling: makeRuling(),
    plan: null,
    outcome: null,
    refusalError: null,
    perceptionForOther: null,
    revealFor: null,
    derived: null,
    reshaped: null,
    pick: null,
    resourceName: null,
    elaboration: null,
    acquired: null,
    reconsidered: null,
    ...overrides,
  } as OpenHalfRoundResult;
}

describe("classifyCapture -- structural, never from English (D11's §8.2 field)", () => {
  it("a turn where the player typed nothing is 'none'", () => {
    expect(classifyCapture(baseHalf({ proposal: null, ruling: null }))).toBe("none");
  });

  it("a retype (D3's reconsidered record present) is 'player-retype', however the retype itself ruled", () => {
    const half = baseHalf({
      ruling: makeRuling(),
      outcome: null, // the retype's own ruling could still fail to resolve; player-retype outranks it
      reconsidered: { firstRuling: unreadTargetRuling(), firstIntent: "hide" },
    });
    expect(classifyCapture(half)).toBe("player-retype");
  });

  it("an unread target with the effect cited, and no retype, is 'unread-target' (Infocom's 'Hide what?')", () => {
    const half = baseHalf({ ruling: unreadTargetRuling(), reconsidered: null });
    expect(classifyCapture(half)).toBe("unread-target");
  });

  it("an applicable ruling that never resolved (D8's declared-space refusal, plan === null) is 'refusal'", () => {
    const half = baseHalf({ ruling: makeRuling({ applicable: true }), plan: null, outcome: null, reconsidered: null });
    expect(classifyCapture(half)).toBe("refusal");
  });

  it("a ruling the referee found nothing to ground (applicable: false, not an unread-target shape) is 'refusal'", () => {
    const half = baseHalf({
      ruling: makeRuling({
        applicable: false,
        citations: {
          target: { citation: null, requiredSourceId: null, verified: false },
          effect: { citation: null, requiredSourceId: null, verified: false },
          property: { citation: null, requiredSourceId: null, verified: false },
          product: { citation: null, requiredSourceId: null, verified: false },
        },
      }),
      outcome: null,
      reconsidered: null,
    });
    expect(classifyCapture(half)).toBe("refusal");
  });

  it("a resolved outcome is 'none'", () => {
    const half = baseHalf({ ruling: makeRuling(), outcome: { eventId: "e1", transitions: [], result: {} } as unknown as OpenHalfRoundResult["outcome"], reconsidered: null });
    expect(classifyCapture(half)).toBe("none");
  });
});

describe("buildHumanTurnRow -- §8.2's row, from the half and the run's own versions", () => {
  it("carries the intent verbatim, the ruling's request/raw/citations, and the versions given", () => {
    const half = baseHalf();
    const row = buildHumanTurnRow(half, VERSIONS);
    expect(row.intent).toBe("scrape the bar");
    expect(row.ruling).not.toBeNull();
    expect(row.ruling?.request).toBe(half.ruling?.request);
    expect(row.ruling?.raw).toBe(half.ruling?.raw);
    expect(row.ruling?.citations).toBe(half.ruling?.citations);
    expect(row.versions).toEqual(VERSIONS);
    expect(row.outcomeWordingRead).toBe("post-D1");
    expect(row.label).toBeNull();
  });

  it("a did-nothing turn carries an empty intent, no ruling, and no reason told", () => {
    const row = buildHumanTurnRow(baseHalf({ proposal: null, ruling: null }), VERSIONS);
    expect(row.intent).toBe("");
    expect(row.ruling).toBeNull();
    expect(row.reasonTold).toBeNull();
    expect(row.captured).toBe("none");
  });

  it("reasonTold is D1's own sentence (renderOwnOutcome), not a second rendering of the ruling", () => {
    // none/noise/none, resolved -- perception.test.ts's own known-good sentence for this shape.
    const half = baseHalf({
      principal: "warden",
      proposal: { intent: "call out" },
      ruling: makeRuling({
        targetObjectId: "none",
        effectKind: "noise",
        property: "none",
        citations: {
          target: { citation: null, requiredSourceId: null, verified: false },
          effect: { citation: { sourceId: "intent", quote: "call out" }, requiredSourceId: "intent", verified: true },
          property: { citation: null, requiredSourceId: null, verified: false },
          product: { citation: null, requiredSourceId: null, verified: false },
        },
      }),
      plan: { mechanic: "OPEN_WEAR", parameters: {}, resourceId: null } as unknown as OpenHalfRoundResult["plan"],
      outcome: { eventId: "e1", transitions: [], result: {} } as unknown as OpenHalfRoundResult["outcome"],
    });
    const row = buildHumanTurnRow(half, VERSIONS);
    expect(row.reasonTold).toBe("You set about making a noise. Your last attempt made a sound.");
  });

  it("classifies captured the same way classifyCapture does, from the same half", () => {
    const half = baseHalf({ ruling: unreadTargetRuling(), reconsidered: null });
    expect(buildHumanTurnRow(half, VERSIONS).captured).toBe(classifyCapture(half));
  });
});

describe("humanTurnRowsFor -- only the seated principal's own halves, in order", () => {
  it("keeps only the human seat's halves, model-batch halves untouched", () => {
    const wardenHalf = baseHalf({ principal: "warden", roundN: 1 });
    const prisonerHalf = baseHalf({ principal: "prisoner", roundN: 1, proposal: { intent: "scrape the bar" } });
    const rows = humanTurnRowsFor([wardenHalf, prisonerHalf], "prisoner", VERSIONS);
    expect(rows).toHaveLength(1);
    expect(rows[0].intent).toBe("scrape the bar");
  });

  it("is empty when the seated principal never took a turn", () => {
    expect(humanTurnRowsFor([baseHalf({ principal: "warden" })], "prisoner", VERSIONS)).toHaveLength(0);
  });
});

describe("renderHumanTurnRows -- one JSON object per line, rewritten whole (D2's own discipline)", () => {
  it("renders one row per line, in order, each a parseable JSON object", () => {
    const rows: HumanTurnRow[] = [
      buildHumanTurnRow(baseHalf({ proposal: { intent: "first" } }), VERSIONS),
      buildHumanTurnRow(baseHalf({ proposal: { intent: "second" }, ruling: null }), VERSIONS),
    ];
    const text = renderHumanTurnRows(rows);
    const lines = text.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]) as HumanTurnRow).intent).toBe("first");
    expect((JSON.parse(lines[1]) as HumanTurnRow).intent).toBe("second");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("an empty game (no rows yet) renders an empty file, not a stray newline or bracket", () => {
    expect(renderHumanTurnRows([])).toBe("");
  });
});
