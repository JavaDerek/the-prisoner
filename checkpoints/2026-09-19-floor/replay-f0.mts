// F0's instrument, steps 3 and 4: replay one arm of build-requests.py's files N
// times per item against the real referee transport, through the same
// one-model-at-a-time swapper and foreign-model guard `npm run referee-replay`
// uses, and report per item the most-common key and agreement at the three
// sites this probe measures -- `target`, `effect`, `property` -- plus every
// citation at each, which the CLI alone cannot show. A recorded instrument in
// the shape of checkpoints/2026-09-19-uncovered/replay-v0.mts, not repository
// code; it imports the repository's own replay and transport and adds nothing to
// either. Never touches a database.
//
// usage (from the repository root):
//   PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_THINKING=off \
//   PRISONER_REFEREE_TIMEOUT_MS=180000 PRISONER_OLLAMA_RESIDENT_MODELS= \
//   npx tsx checkpoints/2026-09-19-floor/replay-f0.mts OFF|ON [N]
//
// Thinking is OFF here, unlike V0: the owner's finding (§67.5, and the search
// REPORT's own re-run) is that it makes no measurable difference on this task
// and is ~8x slower. The transport's default is ON, so this passes it through
// explicitly via `readThinkingMode`.
import { readFileSync, writeFileSync } from "node:fs";
import type { ReadRequest } from "run-dmcp";
import { replayRequestDetailed } from "../../src/open/replay.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { readThinkingMode } from "../../src/open/thinking.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";

type Row = { label: string; kind: string; intent: string; source: string; request: ReadRequest };

const SITES = ["target", "effect", "property"] as const;

const HERE = new URL(".", import.meta.url).pathname;
const arm = process.argv[2];
if (arm !== "OFF" && arm !== "ON") {
  console.error("usage: replay-f0.mts OFF|ON [N]");
  process.exit(1);
}
const n = process.argv[3] ? Number(process.argv[3]) : 5;
const rows = JSON.parse(readFileSync(`${HERE}F-${arm}.json`, "utf-8")) as Row[];

const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
const thinking = readThinkingMode(process.env.PRISONER_THINKING);
const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS ?? process.env.PRISONER_THINK_TIMEOUT_MS;
const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((m) => m.trim()).filter((m) => m.length > 0);
const allowedModels = [...new Set([model, ...residents])];
const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });
const ps = await swapper.fetchPs();
assertNoForeignModel(ps, allowedModels);
const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));
const transport = createRefereeTransport({
  baseUrl,
  model,
  thinking,
  timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
  ensureLoaded: (m) => swapper.withModel(m, async () => {}),
});

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outPath = `${HERE}results-${arm}-${model.replace(/[^a-z0-9.]/gi, "_")}-${stamp}.json`;
const results: unknown[] = [];
const started = Date.now();
console.log(`F0 arm ${arm}, N=${n}, referee ${model} at ${baseUrl}, thinking ${thinking}, ${rows.length} items, started ${new Date(started).toISOString()}`);
console.log(`kind target       effect       property     agree(t/e/p)   secs  intent`);

try {
  for (const row of rows) {
    const t0 = Date.now();
    const { agreements, replies } = await replayRequestDetailed(row.request, [transport], n);
    const at = Object.fromEntries(
      SITES.map((s) => {
        const a = agreements.find((x) => x.questionId === s);
        return [s, { key: a?.mostCommonKey, agreement: a?.agreementRate, counts: tally(replies, s), cites: cites(replies, s) }];
      })
    );
    const rec = {
      label: row.label, kind: row.kind, intent: row.intent, source: row.source, arm,
      target: at.target, effect: at.effect, property: at.property,
      perQuestion: Object.fromEntries(agreements.map((a) => [a.questionId, { key: a.mostCommonKey, agreement: a.agreementRate }])),
      replies: replies.map((r) => r.answers.map((a) => ({ q: a.questionId, key: a.answerKey, cite: a.citation?.quote, fromDefault: a.fromSafeDefault, rejected: a.rejected.length }))),
      secs: Math.round((Date.now() - t0) / 1000),
    };
    results.push(rec);
    writeFileSync(outPath, JSON.stringify({ arm, n, model, baseUrl, thinking, started: new Date(started).toISOString(), results }, null, 1));
    const pct = (s: (typeof SITES)[number]) => Math.round(((at[s].agreement as number) ?? 0) * 100);
    console.log(
      `${row.kind}    ${String(at.target.key).padEnd(12)} ${String(at.effect.key).padEnd(12)} ${String(at.property.key).padEnd(12)} ` +
        `${pct("target")}/${pct("effect")}/${pct("property")}%`.padEnd(14) +
        ` ${String(rec.secs).padStart(4)}  ${row.intent.slice(0, 60)}`
    );
  }
} finally {
  await swapper.restoreResidents(residentsAtStart);
}

function tally(replies: { answers: { questionId: string; answerKey: string }[] }[], q: string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of replies) {
    const a = r.answers.find((x) => x.questionId === q);
    if (a) c[a.answerKey] = (c[a.answerKey] ?? 0) + 1;
  }
  return c;
}
function cites(replies: { answers: { questionId: string; answerKey: string; citation?: { quote?: string } }[] }[], q: string): string[] {
  return replies.map((r) => r.answers.find((x) => x.questionId === q)?.citation?.quote ?? "").filter((s) => s.length > 0);
}

// The arm's own reading. The kill numbers (PREDICTION.md) compare ON against
// OFF, which `score-f0.py` does across both result files; what is printed here
// is one arm's counts only, so an arm can be read as it lands.
const digs = (results as { kind: string; target: { key: string }; effect: { key: string }; property: { key: string } }[]).filter((r) => r.kind === "D");
const onFloorWear = digs.filter((r) => r.target.key === "floor" && r.effect.key === "wear");
console.log("");
console.log(`arm ${arm}: digs reading target=floor AND effect=wear: ${onFloorWear.length}/${digs.length}`);
console.log(`arm ${arm}: digs also reading property=integrity: ${onFloorWear.filter((r) => r.property.key === "integrity").length}/${digs.length}`);
console.log(`results: ${outPath}  (${Math.round((Date.now() - started) / 60000)} min)`);
