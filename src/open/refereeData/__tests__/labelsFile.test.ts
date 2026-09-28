import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreLabels } from "../scorer.js";
import type { RefereeLabel } from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..", "..");
const LABELS_PATH = join(REPO_ROOT, "data", "referee", "labels.jsonl");

/** The checked-in labels file itself (the-prisoner#10's "Done when"): this
 *  is the regression that would catch a future edit silently breaking the
 *  shipped data, or a seed generator producing something the scorer cannot
 *  even build a request for. Run `npm run build-referee-labels` to
 *  regenerate the file this test reads. */
describe("data/referee/labels.jsonl", () => {
  const labels: RefereeLabel[] = readFileSync(LABELS_PATH, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as RefereeLabel);

  it("has the expected shape: 121 rows (26 s33.16 + 95 D11), every one split=test, ids unique", () => {
    expect(labels).toHaveLength(121);
    expect(labels.every((l) => l.split === "test")).toBe(true);
    expect(new Set(labels.map((l) => l.id)).size).toBe(labels.length);
    expect(labels.filter((l) => l.id.startsWith("s33.16-"))).toHaveLength(26);
  });

  it("every label carries provenance naming a labeller and an explicit audited flag", () => {
    for (const l of labels) {
      expect(l.provenance.labeller.length).toBeGreaterThan(0);
      expect(typeof l.provenance.audited).toBe("boolean");
      expect(l.provenance.source.length).toBeGreaterThan(0);
    }
  });

  it("the scorer's --dry-run builds a real request for every single row without error", async () => {
    const report = await scoreLabels(labels);
    expect(report.dryRun).toBe(true);
    expect(report.scoredCount).toBe(0); // a dry run never learns an answer to compare -- see scorer.ts.
    expect(report.skippedTrainCount).toBe(0); // the shipped file is all `test`.
    // The 16 D11 rows this task's own "never invent a label" rule leaves fully
    // unlabelled (ambiguous/unmodelled/mixed rows, and rows corpus.json itself
    // never filled in) -- see seedD11.ts's header.
    expect(report.skippedUnlabelledCount).toBe(16);
  }, 30_000);
});
