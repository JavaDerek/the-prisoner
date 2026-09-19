// V0's instrument, steps 3 and 4 (WORLD-ELABORATION-DESIGN-2.md §4.1): replay
// one of build-requests.py's files N times per request against the real
// referee transport, through the same one-model-at-a-time swapper and foreign-
// model guard `npm run referee-replay` uses, and report per item the
// most-common key at its labelled site, its agreement, and every `uncovered`
// citation -- the spans the CLI alone cannot show. A recorded instrument in the
// shape of checkpoints/2026-09-18-instrument-derive/rerule.mts, not repository
// code; it imports the repository's own replay and transport and adds nothing
// to either. Never touches a database.
//
// usage (from the repository root, the owner's run, detached):
//   PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=180000 \
//   PRISONER_OLLAMA_RESIDENT_MODELS= \
//   npx tsx checkpoints/2026-09-19-uncovered/replay-v0.mts K [N]
//   ... replay-v0.mts Q [N]
// Optional: PRISONER_REFEREE_MODEL=qwen3.5:27b for §4.6's second model.
// Thinking is the transport's default (ON), the setting every game's referee
// runs at (§1.10).
import { readFileSync, writeFileSync } from "node:fs";
import type { ReadRequest } from "run-dmcp";
import { replayRequestDetailed } from "../../src/open/replay.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";

type Row = { label: string; kind: string; site: "effect" | "product"; source: string; request: ReadRequest };

const HERE = new URL(".", import.meta.url).pathname;
const form = process.argv[2];
if (form !== "K" && form !== "Q") {
  console.error("usage: replay-v0.mts K|Q [N]");
  process.exit(1);
}
const n = process.argv[3] ? Number(process.argv[3]) : 5;
// Which question carries the reading at each site, per form (§4.3).
const SITE_QUESTION: Record<string, Record<Row["site"], string>> = {
  K: { effect: "effect", product: "product" },
  Q: { effect: "coverage", product: "product_coverage" },
};

const rows = JSON.parse(readFileSync(`${HERE}V-${form}.json`, "utf-8")) as Row[];

const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS ?? process.env.PRISONER_THINK_TIMEOUT_MS;
const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((m) => m.trim()).filter((m) => m.length > 0);
const allowedModels = [...new Set([model, ...residents])];
const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });
const ps = await swapper.fetchPs();
assertNoForeignModel(ps, allowedModels);
const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));
const transport = createRefereeTransport({ baseUrl, model, timeoutMs: timeoutMs ? Number(timeoutMs) : undefined, ensureLoaded: (m) => swapper.withModel(m, async () => {}) });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${HERE}results-${form}-${model.replace(/[^a-z0-9.]/gi, "_")}-${stamp}.json`;
const results: unknown[] = [];
const started = Date.now();
console.log(`V0 form ${form}, N=${n}, referee ${model} at ${baseUrl}, ${rows.length} requests, started ${new Date(started).toISOString()}`);

try {
  for (const row of rows) {
    const qid = SITE_QUESTION[form][row.site];
    const t0 = Date.now();
    const { agreements, replies } = await replayRequestDetailed(row.request, [transport], n);
    const site = agreements.find((a) => a.questionId === qid);
    const siteAnswers = replies.map((r) => r.answers.find((a) => a.questionId === qid));
    const uncoveredCites = siteAnswers.filter((a) => a?.answerKey === "uncovered").map((a) => a?.citation);
    const uncoveredCount = uncoveredCites.length;
    const perQuestion = Object.fromEntries(agreements.map((a) => [a.questionId, { key: a.mostCommonKey, agreement: a.agreementRate }]));
    const rec = {
      label: row.label, kind: row.kind, site: row.site, siteQuestion: qid, source: row.source,
      readsUncovered: site?.mostCommonKey === "uncovered", uncoveredCount, agreementAtSite: site?.agreementRate,
      mostCommonAtSite: site?.mostCommonKey, uncoveredCitations: uncoveredCites, perQuestion,
      replies: replies.map((r) => r.answers.map((a) => ({ q: a.questionId, key: a.answerKey, cite: a.citation, fromDefault: a.fromSafeDefault, rejected: a.rejected.length }))),
      secs: Math.round((Date.now() - t0) / 1000),
    };
    results.push(rec);
    writeFileSync(outPath, JSON.stringify({ form, n, model, baseUrl, started: new Date(started).toISOString(), results }, null, 1));
    const cites = uncoveredCites.map((c) => `"${c?.quote}"`).join(" | ");
    console.log(`${row.kind} ${row.site.padEnd(7)} ${qid.padEnd(16)} ${String(site?.mostCommonKey).padEnd(11)} ${Math.round((site?.agreementRate ?? 0) * 100)}%  unc ${uncoveredCount}/${n}  ${rec.secs}s  ${row.label.slice(0, 60)}${cites ? "  <- " + cites : ""}`);
  }
} finally {
  await swapper.restoreResidents(residentsAtStart);
}

// The gate's own numbers (§4.5), on the recorded items only; supplement and
// excluded reported beside them, never pooled.
const rec = (k: string) => (results as { kind: string }[]).filter((r) => r.kind === k) as Array<{ readsUncovered: boolean; uncoveredCount: number; agreementAtSite: number; label: string }>;
const U = rec("U"), C = rec("C"), N = rec("N"), S = rec("S"), X = rec("X");
const counted = [...U, ...C, ...N];
const recall = U.filter((r) => r.readsUncovered).length;
const precisionFails = [...C, ...N].filter((r) => r.readsUncovered);
const flags = [...C, ...N].filter((r) => !r.readsUncovered && r.uncoveredCount >= 2);
const stable = counted.filter((r) => (r.agreementAtSite ?? 0) >= 0.8).length;
console.log("");
console.log(`RECALL (recorded U): ${recall}/${U.length} read uncovered  [kill: < 3/4]`);
console.log(`PRECISION (C+N): ${precisionFails.length}/${C.length + N.length} read uncovered  [kill: any]${precisionFails.length ? "  -> " + precisionFails.map((r) => r.label.slice(0, 50)).join("; ") : ""}`);
console.log(`INSTABILITY FLAGS (C+N with >=2/${n} uncovered, not majority): ${flags.length}${flags.length ? "  -> " + flags.map((r) => r.label.slice(0, 50)).join("; ") : ""}`);
console.log(`STABILITY: ${stable}/${counted.length} counted items at >= 80% agreement at site  [kill: < 80% of items]`);
console.log(`SUPPLEMENT (invented, reported separately): ${S.filter((r) => r.readsUncovered).length}/${S.length} read uncovered`);
console.log(`EXCLUDED (reported, never counted): ${X.map((r) => `${r.label.slice(11, 50)} -> ${r.readsUncovered ? "uncovered" : "covered"} (${r.uncoveredCount}/${n})`).join("; ")}`);
const dead = recall < 3 || precisionFails.length > 0 || stable / counted.length < 0.8;
console.log(`VERDICT for form ${form} on ${model}: ${dead ? "DEAD" : "ALIVE"} (§4.5)`);
console.log(`results: ${outPath}  (${Math.round((Date.now() - started) / 60000)} min)`);
