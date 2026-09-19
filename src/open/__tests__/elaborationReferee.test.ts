import { describe, it, expect } from "vitest";
import type { ReadRequest, TransportAnswer, ReaderTransport } from "run-dmcp";
import { createElaborationReferee, computeElaborationRuling, readElaborateMode, elaborationHeaderLine } from "../elaborationReferee.js";
import type { ObjectPerception } from "../referee.js";

const LOOSE_TILE: ObjectPerception = {
  id: "loose_tile",
  description: "A tile near the wall that rocks slightly underfoot, over a hollow of dry grit.",
};

/** Mirrors `referee.test.ts`'s own `scriptedTransport` exactly -- a
 *  transport that answers every question with a given map of questionId ->
 *  {answerKey, citation}. */
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

describe("the elaboration request (WORLD-ELABORATION-DESIGN.md §4.1/§4.2, §9 row P1b)", () => {
  it("one question, `need`, sourced from the intent and the target's own description only", async () => {
    const transport = scriptedTransport({
      need: { answerKey: "passage", citation: { sourceId: "desc:loose_tile", quote: "a hollow of dry grit" } },
    });
    const referee = createElaborationReferee([transport]);
    const ruling = await referee.rule("I try to lift the loose tile.", LOOSE_TILE);

    expect(ruling.targetObjectId).toBe("loose_tile");
    expect(ruling.need).toBe("passage");
    expect(ruling.citation.verified).toBe(true);
    expect(ruling.citation.requiredSourceId).toBe("desc:loose_tile");
    expect(ruling.request.questions.map((q) => q.id)).toEqual(["need"]);
    expect(ruling.request.sources.map((s) => s.id)).toEqual(["intent", "desc:loose_tile"]);
    expect(ruling.request.sources.find((s) => s.id === "intent")?.text).toBe("I try to lift the loose tile.");
  });

  it("§4.2: the answer keys are the scenario's own property vocabulary plus none -- never a fifth kind", async () => {
    const referee = createElaborationReferee([]);
    const ruling = await referee.rule("I try to lift the loose tile.", LOOSE_TILE);
    expect(ruling.request.questions[0].answerKeys).toEqual(["integrity", "edge", "concealment", "passage", "none"]);
  });

  it("safe default is `none`: no transport answers, the ladder falls through, and the citation is unverified", async () => {
    const referee = createElaborationReferee([]);
    const ruling = await referee.rule("I try to lift the loose tile.", LOOSE_TILE);
    expect(ruling.need).toBe("none");
    expect(ruling.citation.verified).toBe(false);
  });

  it("PLANTED VIOLATION: a `need` citation naming the INTENT instead of the target's own description is rejected -- never a legal source for this answer", async () => {
    const transport = scriptedTransport({
      need: { answerKey: "passage", citation: { sourceId: "intent", quote: "I try to lift the loose tile." } },
    });
    const referee = createElaborationReferee([transport]);
    const ruling = await referee.rule("I try to lift the loose tile.", LOOSE_TILE);
    expect(ruling.citation.verified).toBe(false);
  });

  it("computeElaborationRuling is pure and unit-testable against a hand-built ReaderResult, exactly mirroring referee.ts's own computeRuling", () => {
    const request = { questions: [], sources: [] };
    const result = {
      answers: [
        {
          questionId: "need",
          answerKey: "integrity",
          citation: { sourceId: "desc:bar", quote: "Rust has pitted it" },
          answeredByRung: 0,
          fromSafeDefault: false,
          rejected: [],
        },
      ],
      unmatched: [],
    };
    const ruling = computeElaborationRuling(result as never, request, "bar");
    expect(ruling.targetObjectId).toBe("bar");
    expect(ruling.need).toBe("integrity");
    expect(ruling.citation.verified).toBe(true);
  });
});

describe("readElaborateMode: PRISONER_ELABORATE (§4.7)", () => {
  it("unset (and empty) is off", () => {
    expect(readElaborateMode(undefined)).toBe("off");
    expect(readElaborateMode("")).toBe("off");
  });
  it("'property' and 'off' are both legal", () => {
    expect(readElaborateMode("property")).toBe("property");
    expect(readElaborateMode("off")).toBe("off");
  });
  it("anything else throws, naming the env var", () => {
    expect(() => readElaborateMode("object")).toThrow(/PRISONER_ELABORATE/);
    expect(() => readElaborateMode("wat")).toThrow(/unrecognised value/);
  });
});

describe("elaborationHeaderLine: the transcript header line, off is NO LINE AT ALL (§4.7)", () => {
  it("off: null -- not even a line saying so, so a transcript under `off` stays byte-identical to every one recorded before this arm existed", () => {
    expect(elaborationHeaderLine("off")).toBeNull();
  });
  it("property: a line naming the arm", () => {
    const line = elaborationHeaderLine("property");
    expect(line).not.toBeNull();
    expect(line).toContain("Elaboration: property");
    expect(line).toContain("PRISONER_ELABORATE=property");
  });
});
