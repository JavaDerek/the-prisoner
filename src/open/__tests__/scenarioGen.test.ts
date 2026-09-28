import { describe, it, expect } from "vitest";
import type { ReaderTransport } from "run-dmcp";
import {
  generateObjectDescription,
  generateScenario,
  reviewDescription,
  passesReview,
  requiredHonestySource,
  descriptionOverridesFrom,
  scenarioObjectFacts,
  GENERATED_SOURCE_ID,
  FACTS_SOURCE_ID,
  MAX_GENERATION_ATTEMPTS,
  type ScenarioGenerationTransport,
  type ScenarioObjectFact,
} from "../scenarioGen.js";
import { OPEN_OBJECTS } from "../scenarioObjects.js";

const FACT: ScenarioObjectFact = { id: "bar", facts: "The iron bar set across the cell's small window, about as thick as a thumb." };

/** A scripted turn reader transport (CODER-BRIEF: "scripted transports only,
 *  no model calls") that answers the one honesty question with a fixed key
 *  and citation, exactly the style `referee.test.ts` scripts a rung. */
function scriptedReview(answerKey: string, sourceId: string, quote: string): ReaderTransport {
  return async (request) => request.questions.map((q) => ({ questionId: q.id, answerKey, citation: { sourceId, quote } }));
}

describe("requiredHonestySource", () => {
  it("requires the GENERATED text for physical-only, states-a-use and names-another-object", () => {
    expect(requiredHonestySource("physical-only")).toBe(GENERATED_SOURCE_ID);
    expect(requiredHonestySource("states-a-use")).toBe(GENERATED_SOURCE_ID);
    expect(requiredHonestySource("names-another-object")).toBe(GENERATED_SOURCE_ID);
  });
  it("requires the FACTS text for drops-a-fact -- the missing span cannot be quoted from text that dropped it", () => {
    expect(requiredHonestySource("drops-a-fact")).toBe(FACTS_SOURCE_ID);
  });
});

describe("reviewDescription (run-dmcp's createTurnReader, closed keys + verbatim citation)", () => {
  it("passes physical-only cited from the generated text", async () => {
    const review = await reviewDescription("A dented tin cup, cold to the touch.", FACT.facts, [scriptedReview("physical-only", GENERATED_SOURCE_ID, "cold to the touch")]);
    expect(review.answerKey).toBe("physical-only");
    expect(review.verified).toBe(true);
    expect(passesReview(review)).toBe(true);
  });

  it("fails states-a-use even when cited, because physical-only is the only passing key", async () => {
    const review = await reviewDescription("A bar you could pry the window open with.", FACT.facts, [
      scriptedReview("states-a-use", GENERATED_SOURCE_ID, "pry the window open with"),
    ]);
    expect(review.answerKey).toBe("states-a-use");
    expect(review.verified).toBe(true);
    expect(passesReview(review)).toBe(false);
  });

  it("names-another-object fails, cited from the generated text", async () => {
    const review = await reviewDescription("A bar, much like the loose_tile beside it.", FACT.facts, [
      scriptedReview("names-another-object", GENERATED_SOURCE_ID, "loose_tile"),
    ]);
    expect(passesReview(review)).toBe(false);
    expect(review.citation?.sourceId).toBe(GENERATED_SOURCE_ID);
  });

  it("drops-a-fact fails, cited from the FACTS text (what the generated text left out)", async () => {
    const review = await reviewDescription("A bar, dull grey.", FACT.facts, [scriptedReview("drops-a-fact", FACTS_SOURCE_ID, "about as thick as a thumb")]);
    expect(passesReview(review)).toBe(false);
    expect(review.citation?.sourceId).toBe(FACTS_SOURCE_ID);
  });

  it("a physical-only answer cited from the WRONG source does not verify, and does not pass", async () => {
    // Code verifies the citation is verbatim and from the right source; it never judges meaning
    // (CLAUDE.md, "Never pattern-match meaning") -- a pass claimed against the facts text instead of
    // the generated text is not grounded, whatever the key says.
    const review = await reviewDescription("A dented tin cup.", FACT.facts, [scriptedReview("physical-only", FACTS_SOURCE_ID, "about as thick as a thumb")]);
    expect(review.verified).toBe(false);
    expect(passesReview(review)).toBe(false);
  });

  it("an unreachable review (no transports) falls to the safe default, which is never physical-only", async () => {
    const review = await reviewDescription("Anything.", FACT.facts, []);
    expect(review.answerKey).not.toBe("physical-only");
    expect(passesReview(review)).toBe(false);
  });
});

describe("generateObjectDescription (retry up to 3 attempts, then fall back)", () => {
  it("accepts the first attempt that passes review", async () => {
    let calls = 0;
    const generate: ScenarioGenerationTransport = async () => {
      calls += 1;
      return "A dented tin cup, cold to the touch.";
    };
    const object = await generateObjectDescription(FACT, generate, [scriptedReview("physical-only", GENERATED_SOURCE_ID, "cold to the touch")]);
    expect(object.accepted).toBe(true);
    expect(object.description).toBe("A dented tin cup, cold to the touch.");
    expect(calls).toBe(1);
    expect(object.attempts).toHaveLength(1);
  });

  it("regenerates on a rejected attempt, up to 3 attempts total", async () => {
    let calls = 0;
    const generate: ScenarioGenerationTransport = async () => {
      calls += 1;
      return calls < 3 ? "A bar you could pry the window open with." : "A dull grey bar, pitted with rust.";
    };
    // Fails states-a-use the first two times, passes physical-only the third.
    let reviewCalls = 0;
    const review: ReaderTransport = async (request) => {
      reviewCalls += 1;
      return reviewCalls < 3
        ? request.questions.map((q) => ({ questionId: q.id, answerKey: "states-a-use", citation: { sourceId: GENERATED_SOURCE_ID, quote: "pry the window open with" } }))
        : request.questions.map((q) => ({ questionId: q.id, answerKey: "physical-only", citation: { sourceId: GENERATED_SOURCE_ID, quote: "pitted with rust" } }));
    };
    const object = await generateObjectDescription(FACT, generate, [review]);
    expect(object.accepted).toBe(true);
    expect(object.description).toBe("A dull grey bar, pitted with rust.");
    expect(calls).toBe(3);
    expect(object.attempts).toHaveLength(3);
    expect(object.attempts[0].review?.answerKey).toBe("states-a-use");
    expect(object.attempts[2].review?.answerKey).toBe("physical-only");
  });

  it("falls back to the authored facts text after MAX_GENERATION_ATTEMPTS rejections, and records it", async () => {
    expect(MAX_GENERATION_ATTEMPTS).toBe(3);
    const generate: ScenarioGenerationTransport = async () => "A bar you could pry the window open with.";
    const object = await generateObjectDescription(FACT, generate, [scriptedReview("states-a-use", GENERATED_SOURCE_ID, "pry the window open with")]);
    expect(object.accepted).toBe(false);
    expect(object.description).toBe(FACT.facts);
    expect(object.attempts).toHaveLength(MAX_GENERATION_ATTEMPTS);
  });

  it("an unreachable generation call (null) counts as a failed attempt and moves on", async () => {
    let calls = 0;
    const generate: ScenarioGenerationTransport = async () => {
      calls += 1;
      return calls < 2 ? null : "A dull grey bar, pitted with rust.";
    };
    const object = await generateObjectDescription(FACT, generate, [scriptedReview("physical-only", GENERATED_SOURCE_ID, "pitted with rust")]);
    expect(object.accepted).toBe(true);
    expect(object.attempts[0].generated).toBeNull();
    expect(object.attempts[0].review).toBeNull();
  });
});

describe("generateScenario (every object in the given list)", () => {
  it("builds one GeneratedObject per input, carrying the model/temperatures/timestamp", async () => {
    const generate: ScenarioGenerationTransport = async ({ objectId }) => `Fresh texture for ${objectId}.`;
    const scenario = await generateScenario({
      objects: [FACT, { id: "spoon", facts: "A dented aluminium spoon." }],
      model: "test-model",
      generationTemperature: 0.9,
      reviewTemperature: 0,
      generate,
      reviewTransports: [scriptedReview("physical-only", GENERATED_SOURCE_ID, "Fresh texture")],
      now: () => new Date("2026-09-28T00:00:00.000Z"),
    });
    expect(scenario.mode).toBe("enjoyable");
    expect(scenario.model).toBe("test-model");
    expect(scenario.generationTemperature).toBe(0.9);
    expect(scenario.reviewTemperature).toBe(0);
    expect(scenario.generatedAt).toBe("2026-09-28T00:00:00.000Z");
    expect(scenario.objects.map((o) => o.id)).toEqual(["bar", "spoon"]);
    expect(scenario.objects.every((o) => o.accepted)).toBe(true);
  });
});

describe("descriptionOverridesFrom", () => {
  it("maps object id to the description the game will actually use", async () => {
    const generate: ScenarioGenerationTransport = async ({ objectId }) => `Fresh texture for ${objectId}.`;
    const scenario = await generateScenario({
      objects: [FACT],
      model: "test-model",
      generationTemperature: 0.9,
      reviewTemperature: 0,
      generate,
      reviewTransports: [scriptedReview("physical-only", GENERATED_SOURCE_ID, "Fresh")],
    });
    expect(descriptionOverridesFrom(scenario)).toEqual({ bar: "Fresh texture for bar." });
  });
});

describe("scenarioObjectFacts (the fixed §4.1 list, unchanged in id or property)", () => {
  it("carries every OPEN_OBJECTS id, with its authored description as the facts to preserve", () => {
    const facts = scenarioObjectFacts();
    expect(facts.map((f) => f.id)).toEqual(OPEN_OBJECTS.map((o) => o.id));
    for (const f of facts) {
      const spec = OPEN_OBJECTS.find((o) => o.id === f.id);
      expect(f.facts).toBe(spec?.description);
    }
  });
});
