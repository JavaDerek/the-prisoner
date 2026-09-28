import type { ReaderTransport } from "run-dmcp";
import { createReferee, type RefereeRuling } from "../referee.js";
import { resolveScene } from "./scene.js";
import type { RefereeLabel, RefereeQuestionId } from "./types.js";

/**
 * The scorer (the-prisoner#10): rules every `test`-split label through a
 * REAL referee (`createReferee` + a transport the caller supplies -- this
 * module never calls a model itself, mirroring `refereeReplayCli.ts`'s own
 * split between mechanism and transport) and reports X of N per question,
 * with every disagreement listed. `--dry-run` (`scoreLabels`'s own
 * `dryRun` option) builds every request through the SAME `resolveScene` +
 * `createReferee` path and sends nothing -- a scripted transport that
 * returns `[]`, never a network call -- so a labels file can be checked
 * end to end before anyone touches doris.
 */

export type ScoredQuestionId = Exclude<RefereeQuestionId, "acts">;
const SCORED_QUESTIONS: readonly ScoredQuestionId[] = ["target", "effect", "product", "property", "magnitude", "perceptibility"];

export interface Disagreement {
  labelId: string;
  questionId: ScoredQuestionId;
  expected: string;
  got: string;
}

export interface QuestionTally {
  questionId: ScoredQuestionId;
  correct: number;
  total: number;
}

export interface ScoreReport {
  /** Labels actually ruled on (`split === "test"` and at least one
   *  non-null expected answer). */
  scoredCount: number;
  /** `test`-split labels with every expected answer `null` -- nothing to
   *  score, per the issue's own "have the scorer skip it". */
  skippedUnlabelledCount: number;
  /** `train`-split labels in the input, never scored (this file's job is
   *  measuring a referee against held-out cases, not against its own
   *  training data). */
  skippedTrainCount: number;
  tallies: readonly QuestionTally[];
  disagreements: readonly Disagreement[];
  /** Present only when `dryRun` -- every label's request was built and
   *  nothing was sent. */
  dryRun: boolean;
}

function rulingAnswer(ruling: RefereeRuling, questionId: ScoredQuestionId): string {
  switch (questionId) {
    case "target":
      return ruling.targetObjectId;
    case "effect":
      return ruling.effectKind;
    case "product":
      return ruling.product;
    case "property":
      return ruling.property;
    case "magnitude":
      return ruling.magnitude;
    case "perceptibility":
      return ruling.perceptibility;
  }
}

function expectedFor(label: RefereeLabel, questionId: ScoredQuestionId): string | null {
  return label.expected[questionId];
}

export interface ScoreOptions {
  /** Omit (or pass `undefined`) for `--dry-run`: a captor that sends
   *  nothing is used in that case, and `scoredCount`/`tallies`/
   *  `disagreements` stay all-zero/empty because a dry run never learns an
   *  answer to compare against. */
  transport?: ReaderTransport;
}

export async function scoreLabels(labels: readonly RefereeLabel[], options: ScoreOptions = {}): Promise<ScoreReport> {
  const dryRun = !options.transport;
  const transport: ReaderTransport = options.transport ?? (async () => []);

  let skippedTrainCount = 0;
  let skippedUnlabelledCount = 0;
  let scoredCount = 0;
  const disagreements: Disagreement[] = [];
  const totals = new Map<ScoredQuestionId, { correct: number; total: number }>(SCORED_QUESTIONS.map((q) => [q, { correct: 0, total: 0 }]));

  for (const label of labels) {
    if (label.split !== "test") {
      skippedTrainCount++;
      continue;
    }
    const hasAnyExpectation = SCORED_QUESTIONS.some((q) => expectedFor(label, q) !== null);
    if (!hasAnyExpectation) {
      skippedUnlabelledCount++;
      continue;
    }

    const { perceived, refereeOptions } = resolveScene(label.scene, label.intentText, label.refereeArms);
    const referee = createReferee([transport], { ...refereeOptions, oneAct: "off" });
    const ruling = await referee.rule(label.intentText, perceived);

    if (dryRun) continue; // request built, nothing to compare -- see `ScoreOptions.transport`'s own comment.

    scoredCount++;
    for (const questionId of SCORED_QUESTIONS) {
      const expected = expectedFor(label, questionId);
      if (expected === null) continue;
      const got = rulingAnswer(ruling, questionId);
      const tally = totals.get(questionId);
      if (!tally) continue;
      tally.total++;
      if (got === expected) tally.correct++;
      else disagreements.push({ labelId: label.id, questionId, expected, got });
    }
  }

  return {
    scoredCount,
    skippedUnlabelledCount,
    skippedTrainCount,
    tallies: SCORED_QUESTIONS.map((q) => ({ questionId: q, ...(totals.get(q) ?? { correct: 0, total: 0 }) })),
    disagreements,
    dryRun,
  };
}

export function renderScoreReport(report: ScoreReport): string[] {
  const lines: string[] = [];
  if (report.dryRun) {
    lines.push(`Dry run: every request built, nothing sent. skippedTrain=${report.skippedTrainCount}, skippedUnlabelled(no expectation)=${report.skippedUnlabelledCount}.`);
    return lines;
  }
  lines.push(`Scored ${report.scoredCount} test-split label(s) (skipped ${report.skippedTrainCount} train, ${report.skippedUnlabelledCount} unlabelled).`);
  for (const t of report.tallies) {
    if (t.total === 0) continue;
    lines.push(`  - ${t.questionId}: ${t.correct} of ${t.total} (${((t.correct / t.total) * 100).toFixed(1)}%)`);
  }
  if (report.disagreements.length > 0) {
    lines.push("Disagreements:");
    for (const d of report.disagreements) lines.push(`  - ${d.labelId} ${d.questionId}: expected "${d.expected}", got "${d.got}"`);
  }
  return lines;
}
