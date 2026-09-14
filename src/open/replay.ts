import { createTurnReader, type ReadRequest, type ReaderTransport } from "run-dmcp";

/**
 * The replay tool (this task's brief: "A replay tool for §5.2's consistency
 * metric... re-asks the referee the recorded requests N times and reports
 * per-key agreement"; OPEN-VARIANT.md §3.5/§5.2). Re-running a RECORDED
 * `ReadRequest` (the exact questions and sources a real half-round actually
 * built) is what makes this a genuine consistency check: the same state,
 * the same intent, asked again -- never a fresh scenario the referee might
 * legitimately answer differently for an honest reason.
 */
export interface KeyAgreement {
  questionId: string;
  /** The most frequently returned answer key across the N replays. */
  mostCommonKey: string;
  /** `mostCommonKey`'s share of N -- 1.0 means every replay agreed. */
  agreementRate: number;
  sampleSize: number;
}

/** Re-asks ONE recorded request `n` times against `transports`, and reports
 *  per-question agreement. A question every replay answered with its
 *  `safeDefault` (because every rung was exhausted) still counts -- 100%
 *  agreement on the safe default is a real, meaningful consistency result,
 *  not a run this function should special-case away. */
export async function replayRequest(request: ReadRequest, transports: readonly ReaderTransport[], n: number): Promise<KeyAgreement[]> {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`replayRequest: n must be a positive integer, got ${JSON.stringify(n)}`);
  }
  const tally = new Map<string, Map<string, number>>();
  for (const q of request.questions) tally.set(q.id, new Map());

  for (let i = 0; i < n; i++) {
    const reader = createTurnReader({ questions: request.questions, transports });
    const result = await reader.read(request.sources);
    for (const answer of result.answers) {
      const counts = tally.get(answer.questionId);
      if (!counts) continue; // defensive: an answer for a question this request never asked.
      counts.set(answer.answerKey, (counts.get(answer.answerKey) ?? 0) + 1);
    }
  }

  return request.questions.map((q) => {
    const counts = tally.get(q.id) ?? new Map<string, number>();
    let bestKey = q.safeDefault;
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }
    return { questionId: q.id, mostCommonKey: bestKey, agreementRate: bestCount / n, sampleSize: n };
  });
}

/** One transcript's worth of recorded requests, replayed and reported --
 *  the shape `refereeReplayCli.ts` reads off a saved transcript file and
 *  the shape a unit test exercises directly, without touching the
 *  filesystem or a real transport. */
export interface ReplayedIntent {
  label: string;
  agreements: readonly KeyAgreement[];
}

export async function replayTranscript(
  requests: readonly { label: string; request: ReadRequest }[],
  transports: readonly ReaderTransport[],
  n: number
): Promise<ReplayedIntent[]> {
  const out: ReplayedIntent[] = [];
  for (const { label, request } of requests) {
    out.push({ label, agreements: await replayRequest(request, transports, n) });
  }
  return out;
}

export function renderReplayReport(replayed: readonly ReplayedIntent[]): string[] {
  const lines: string[] = [];
  for (const entry of replayed) {
    lines.push(`## ${entry.label}`);
    for (const a of entry.agreements) {
      lines.push(`  - ${a.questionId}: "${a.mostCommonKey}" agreed ${(a.agreementRate * 100).toFixed(0)}% of ${a.sampleSize} replays.`);
    }
  }
  const allAgreements = replayed.flatMap((e) => e.agreements);
  const overall = allAgreements.length > 0 ? allAgreements.reduce((sum, a) => sum + a.agreementRate, 0) / allAgreements.length : 0;
  lines.push("");
  lines.push(`Overall mean agreement across every question, every intent: ${(overall * 100).toFixed(1)}%.`);
  lines.push(`§5.3's target: at least 80%.`);
  return lines;
}
