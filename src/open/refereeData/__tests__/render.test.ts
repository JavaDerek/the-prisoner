import { describe, it, expect } from "vitest";
import { renderLabel, renderTrainingExamples } from "../render.js";
import { buildS3316Labels } from "../seedS3316.js";
import type { RefereeLabel } from "../types.js";

function trainLabel(overrides: Partial<RefereeLabel> = {}): RefereeLabel {
  const [base] = buildS3316Labels();
  return { ...base, id: "t1", split: "train", ...overrides };
}

describe("renderLabel", () => {
  it("renders a train-split label into a user/assistant example built through the real prompt builder", async () => {
    const [examples] = [await renderLabel(trainLabel())];
    expect(examples).toHaveLength(1);
    const [example] = examples;
    expect(example.labelId).toBe("t1");
    expect(example.part).toBe("main");
    expect(example.messages).toHaveLength(2);
    expect(example.messages[0].role).toBe("user");
    expect(example.messages[0].content).toContain("SOURCES (the only text you may cite):");
    expect(example.messages[0].content).toContain("Remove the bar");
    expect(example.messages[1].role).toBe("assistant");
    const assistant = JSON.parse(example.messages[1].content) as { questionId: string; answerKey: string }[];
    expect(assistant.find((a) => a.questionId === "target")?.answerKey).toBe("bar");
    expect(assistant.find((a) => a.questionId === "effect")?.answerKey).toBe("open");
    expect(example.promptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(example.questionIds).toEqual(["target", "effect", "product", "property", "magnitude", "perceptibility"]);
  });

  it("throws (never silently drops) a label whose citation is not verbatim in its declared source", async () => {
    const bad = trainLabel({ citations: { ...trainLabel().citations, target: { sourceId: "intent", quote: "the door that was never named here" } } });
    await expect(renderLabel(bad)).rejects.toThrow(/safe default|fell to/);
  });

  it("throws a label whose expected answer key is not legal for that question", async () => {
    const bad = trainLabel({ expected: { ...trainLabel().expected, effect: "not-a-real-effect" } });
    await expect(renderLabel(bad)).rejects.toThrow(/not one of this question's legal keys/);
  });

  it("throws a label missing an expected answer for a question the request actually asks", async () => {
    const bad = trainLabel({ expected: { ...trainLabel().expected, magnitude: null } });
    await expect(renderLabel(bad)).rejects.toThrow(/no expected answer for question "magnitude"/);
  });

  it("also renders a second 'acts' example when expected.acts is set", async () => {
    const label = trainLabel({
      expected: { ...trainLabel().expected, acts: "several" },
      citations: { ...trainLabel().citations, acts: { sourceId: "intent", quote: "Remove the bar" } },
    });
    const examples = await renderLabel(label);
    expect(examples.map((e) => e.part)).toEqual(["main", "acts"]);
    const acts = examples[1];
    expect(acts.questionIds).toEqual(["acts"]);
    const assistant = JSON.parse(acts.messages[1].content) as { questionId: string; answerKey: string }[];
    expect(assistant[0].answerKey).toBe("several");
  });
});

describe("renderTrainingExamples", () => {
  it("refuses to write any test-split label into training output, even mixed with train rows", async () => {
    const labels: RefereeLabel[] = [trainLabel({ id: "train-1" }), { ...trainLabel({ id: "test-1" }), split: "test" }];
    const { examples, refusedTestCount } = await renderTrainingExamples(labels);
    expect(examples.map((e) => e.labelId)).toEqual(["train-1"]);
    expect(examples.some((e) => e.labelId === "test-1")).toBe(false);
    expect(refusedTestCount).toBe(1);
  });

  it("refuses every label when the whole file is test-split, producing zero examples", async () => {
    const { examples, refusedTestCount } = await renderTrainingExamples(buildS3316Labels());
    expect(examples).toEqual([]);
    expect(refusedTestCount).toBe(26);
  });
});

describe("every §33.16 seed label (regression, even though they are test-split)", () => {
  it("passes run-dmcp's own createTurnReader citation check via renderLabel", async () => {
    for (const label of buildS3316Labels()) {
      await expect(renderLabel(label), `label ${label.id} should render cleanly`).resolves.toBeDefined();
    }
  });
});
