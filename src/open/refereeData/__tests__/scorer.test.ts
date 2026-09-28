import { describe, it, expect } from "vitest";
import type { ReaderTransport } from "run-dmcp";
import { scoreLabels } from "../scorer.js";
import { buildS3316Labels } from "../seedS3316.js";
import type { RefereeLabel } from "../types.js";

/** A scripted transport that answers exactly what a label's OWN expected
 *  answers say (via its citations), the way a "perfect" referee would --
 *  and one that always answers something else, to exercise disagreement
 *  reporting. */
function perfectTransport(labelsById: Map<string, RefereeLabel>): ReaderTransport {
  return async (request) => {
    const intent = request.sources.find((s) => s.id === "intent")?.text ?? "";
    const label = [...labelsById.values()].find((l) => l.intentText === intent);
    if (!label) return [];
    return request.questions.map((q) => {
      const key = q.id as keyof RefereeLabel["expected"];
      const answerKey = label.expected[key] as string;
      const citation = label.citations[key];
      return { questionId: q.id, answerKey, citation: citation ? { sourceId: citation.sourceId, quote: citation.quote ?? "" } : { sourceId: "intent", quote: intent } };
    });
  };
}

const alwaysWrong: ReaderTransport = async (request) =>
  request.questions.map((q) => ({ questionId: q.id, answerKey: q.safeDefault, citation: { sourceId: "intent", quote: request.sources[0].text } }));

describe("scoreLabels", () => {
  it("dry-run builds every request and sends nothing -- zero scored, no disagreements", async () => {
    const report = await scoreLabels(buildS3316Labels());
    expect(report.dryRun).toBe(true);
    expect(report.scoredCount).toBe(0);
    expect(report.disagreements).toEqual([]);
  });

  it("scores a perfect transport as 100% on every question, for every label with something to score", async () => {
    const labels = buildS3316Labels();
    const byId = new Map(labels.map((l) => [l.id, l]));
    const report = await scoreLabels(labels, { transport: perfectTransport(byId) });
    expect(report.dryRun).toBe(false);
    expect(report.scoredCount).toBe(26);
    expect(report.disagreements).toEqual([]);
    for (const t of report.tallies) expect(t.correct).toBe(t.total);
  });

  it("reports X of N and lists every disagreement when the transport disagrees", async () => {
    const labels = buildS3316Labels().slice(0, 1); // "Remove the bar" -> expected target=bar, effect=open, ...
    const report = await scoreLabels(labels, { transport: alwaysWrong });
    expect(report.scoredCount).toBe(1);
    const targetTally = report.tallies.find((t) => t.questionId === "target");
    expect(targetTally).toEqual({ questionId: "target", correct: 0, total: 1 });
    expect(report.disagreements.some((d) => d.labelId === "s33.16-01" && d.questionId === "target" && d.expected === "bar" && d.got === "none")).toBe(true);
  });

  it("skips train-split labels and test-split labels with no expected answer at all", async () => {
    const labels: RefereeLabel[] = [
      { ...buildS3316Labels()[0], split: "train" },
      { ...buildS3316Labels()[1], expected: { target: null, effect: null, product: null, property: null, magnitude: null, perceptibility: null, acts: null } },
    ];
    const report = await scoreLabels(labels, { transport: alwaysWrong });
    expect(report.skippedTrainCount).toBe(1);
    expect(report.skippedUnlabelledCount).toBe(1);
    expect(report.scoredCount).toBe(0);
  });
});
