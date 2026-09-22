// Replays BASE.json or VARIANT.json N times per item against the real referee
// transport, through the one-model-at-a-time swapper and foreign-model guard
// `npm run referee-replay` uses. Thinking comes from PRISONER_THINKING via
// `readThinkingMode` -- unset is ON, the game's default and the batch's setting.
// usage (repo root): PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=300000 \
//   PRISONER_OLLAMA_RESIDENT_MODELS= npx tsx checkpoints/2026-09-22-reveal-edge/replay.mts BASE|VARIANT [N]
import { readFileSync, writeFileSync } from "node:fs";
import { replayRequestDetailed } from "../../src/open/replay.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { readThinkingMode } from "../../src/open/thinking.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";

const HERE = new URL(".", import.meta.url).pathname;
const arm = process.argv[2];
if (arm !== "BASE" && arm !== "VARIANT") throw new Error("usage: replay.mts BASE|VARIANT [N]");
const n = process.argv[3] ? Number(process.argv[3]) : 5;
const rows = JSON.parse(readFileSync(`${HERE}${arm}.json`, "utf-8")) as any[];
const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
const thinking = readThinkingMode(process.env.PRISONER_THINKING);
const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS;
const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const allowedModels = [...new Set([model, ...residents])];
const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });
const ps = await swapper.fetchPs();
assertNoForeignModel(ps, allowedModels);
const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));
const transport = createRefereeTransport({ baseUrl, model, thinking, timeoutMs: timeoutMs ? Number(timeoutMs) : undefined, ensureLoaded: (m) => swapper.withModel(m, async () => {}) });
const SITES = ["target", "effect", "property"] as const;
const outPath = `${HERE}results-${arm}.json`;
const results: any[] = [];
console.log(`arm ${arm}, N=${n}, referee ${model} at ${baseUrl}, thinking ${thinking}, ${rows.length} items, ${new Date().toISOString()}`);
try {
  for (const row of rows) {
    const t0 = Date.now();
    const { replies } = await replayRequestDetailed(row.request, [transport], n);
    const counts = Object.fromEntries(SITES.map((s) => [s, tally(replies, s)]));
    const triples: Record<string, number> = {};
    for (const r of replies) {
      const k = SITES.map((s) => r.answers.find((a: any) => a.questionId === s)?.answerKey ?? "?").join("/");
      triples[k] = (triples[k] ?? 0) + 1;
    }
    results.push({ kind: row.kind, expect: row.expect, intent: row.intent, counts, triples, secs: Math.round((Date.now() - t0) / 1000) });
    writeFileSync(outPath, JSON.stringify({ arm, n, model, thinking, results }, null, 1));
    console.log(`${row.kind.padEnd(5)} expect ${row.expect.padEnd(30)} got ${JSON.stringify(triples)}  ${Math.round((Date.now() - t0) / 1000)}s`);
  }
} finally {
  await swapper.restoreResidents(residentsAtStart);
}
function tally(replies: any[], q: string): Record<string, number> {
  const c: Record<string, number> = {};
  for (const r of replies) {
    const a = r.answers.find((x: any) => x.questionId === q);
    if (a) c[a.answerKey] = (c[a.answerKey] ?? 0) + 1;
  }
  return c;
}
