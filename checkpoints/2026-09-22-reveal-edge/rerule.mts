// Re-rules batch 1's misruled rows (MISRULED-RECORDED.json, each row's own recorded request) through the real
// referee with tonight's property sentence swapped in, and applies the CURRENT gate (`computeRuling`) to every
// reply. Same swapper/foreign-model guard as `npm run referee-replay`. Never touches a database.
// usage (repo root): PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=300000 \
//   PRISONER_OLLAMA_RESIDENT_MODELS= npx tsx checkpoints/2026-09-22-reveal-edge/rerule.mts [N]
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { readThinkingMode } from "../../src/open/thinking.js";
import { findProperty } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";

const OLD = "For reveal, name the property being learned: integrity for damage, wear, rust or tampering, even when the intent calls it hidden. ";
const NEW =
  "For reveal, name the property being learned: edge for how sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the intent calls it hidden. ";
const HERE = new URL(".", import.meta.url).pathname;
const n = process.argv[2] ? Number(process.argv[2]) : 3;
const rows = JSON.parse(readFileSync(`${HERE}MISRULED-RECORDED.json`, "utf-8")) as any[];

// Declared properties as the batch's world had them: scenario objects, persons (posture, presence modelled),
// and derived objects by kind (`wire_2` is a second wire).
const isDeclared = (objectId: string, key: string): boolean => {
  if (objectId === "prisoner" || objectId === "warden") return key === "posture";
  const kind = DERIVABLE_KINDS.find((k) => objectId === k.id || objectId.startsWith(`${k.id}_`));
  if (kind) return kind.properties.some((p) => p.key === key);
  return !!findProperty(objectId, key as never);
};

const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
const thinking = readThinkingMode(process.env.PRISONER_THINKING);
const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
const allowedModels = [...new Set([model, ...residents])];
const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });
const ps = await swapper.fetchPs();
assertNoForeignModel(ps, allowedModels);
const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));
const transport = createRefereeTransport({
  baseUrl, model, thinking,
  timeoutMs: process.env.PRISONER_REFEREE_TIMEOUT_MS ? Number(process.env.PRISONER_REFEREE_TIMEOUT_MS) : undefined,
  ensureLoaded: (m) => swapper.withModel(m, async () => {}),
});
const out: any[] = [];
console.log(`rerule N=${n}, ${rows.length} rows, referee ${model}, thinking ${thinking}, ${new Date().toISOString()}`);
try {
  for (const row of rows) {
    const questions = row.request.questions.map((q: any) => {
      if (q.id !== "property") return q;
      if (!q.prompt.includes(OLD)) throw new Error(`row ${row.row}: property sentence not found`);
      return { ...q, prompt: q.prompt.replace(OLD, NEW) };
    });
    const request = { questions, sources: row.request.sources };
    const rulings = [];
    for (let i = 0; i < n; i++) {
      const result = await createTurnReader({ questions, transports: [transport] }).read(request.sources);
      const r = computeRuling(result, request, isDeclared);
      rulings.push({ keys: `${r.targetObjectId}/${r.effectKind}/${r.property}`, applicable: r.applicable });
    }
    const ok = rulings.filter((r) => r.applicable).length;
    out.push({ row: row.row, kind: row.kind, intent: row.intent, rulings, fixed: ok * 2 >= n + 1 });
    writeFileSync(`${HERE}results-RERULE.json`, JSON.stringify({ n, model, thinking, results: out }, null, 1));
    console.log(`#${String(row.row).padEnd(3)} ${row.kind.padEnd(27)} ${ok}/${n} applicable  ${rulings.map((r) => r.keys + (r.applicable ? "+" : "-")).join("  ")}`);
  }
} finally {
  await swapper.restoreResidents(residentsAtStart);
}
const fixed = out.filter((r) => r.fixed);
console.log(`\nFIXED ${fixed.length} of ${out.length}`);
for (const k of [...new Set(out.map((r) => r.kind))]) console.log(`  ${k}: ${out.filter((r) => r.kind === k && r.fixed).length} of ${out.filter((r) => r.kind === k).length}`);
