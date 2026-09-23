// Referee capacity check (PREDICTION.md). usage (repo root):
//   PRISONER_MODEL_URL=<url> PRISONER_REFEREE_TIMEOUT_MS=300000 PRISONER_OLLAMA_RESIDENT_MODELS= \
//   npx tsx checkpoints/2026-09-22-referee-capacity/run.mts <referee model id> <N>
// Every row's MAIN request is built by today's `createReferee` from the row's own recorded perception; each reply goes
// through today's `computeRuling`. The one-act rows are the separate call exactly as probed. Never touches a database.
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { createReferee, computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { readThinkingMode } from "../../src/open/thinking.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";

const HERE = new URL(".", import.meta.url).pathname;
const model = process.argv[2];
const n = Number(process.argv[3] ?? "1");
if (!model) throw new Error("usage: run.mts <model> <N>");
const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels: [model] });
if (!model.startsWith("claude-")) assertNoForeignModel(await swapper.fetchPs(), [model]);
const transport = createRefereeTransport({
  baseUrl, model, thinking: readThinkingMode(process.env.PRISONER_THINKING),
  timeoutMs: Number(process.env.PRISONER_REFEREE_TIMEOUT_MS ?? "300000"),
  ensureLoaded: model.startsWith("claude-") ? async () => {} : (m) => swapper.withModel(m, async () => {}),
});
const safe = model.replace(/[^a-z0-9.]/gi, "_");
const out: any = { model, n, started: new Date().toISOString(), rows: [], oneAct: [] };
const save = () => writeFileSync(`${HERE}results-${safe}.json`, JSON.stringify(out, null, 1));

const ONLY = (process.env.ROWS ?? "").split(",").map((x) => x.trim()).filter(Boolean); // optional subset, e.g. ROWS=b2#5,b1#13
const rows = (JSON.parse(readFileSync(`${HERE}rows.json`, "utf-8")) as { id: string; intent: string; perceived: { id: string; description: string }[]; accept: string[] }[]).filter(
  (r) => ONLY.length === 0 || ONLY.includes(r.id)
);
for (const row of rows) {
  let request: any = null;
  await createReferee([async (r) => ((request = r), [])], { isDeclared, propertiesOf: propsOf }).rule(row.intent, row.perceived);
  const tries = [];
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    const result = await createTurnReader({ questions: request.questions, transports: [transport] }).read(request.sources);
    const r = computeRuling(result, request, isDeclared, (id) => id === "prisoner" || id === "warden");
    const keys = `${r.targetObjectId}/${r.effectKind}`;
    tries.push({ keys, property: r.property, applicable: r.applicable, right: row.accept.includes(keys) && r.applicable, secs: Math.round((Date.now() - t0) / 1000) });
  }
  const right = tries.filter((t) => t.right).length * 2 > n;
  out.rows.push({ id: row.id, accept: row.accept, tries, right });
  save();
  console.log(`${row.id.padEnd(7)} ${right ? "RIGHT" : "wrong"}  ${tries.map((t) => `${t.keys}/${t.property}${t.applicable ? "+" : "-"}`).join("  ")}  ${tries.map((t) => t.secs).join(",")}s`);
}
const acts = (ONLY.length > 0 ? [] : JSON.parse(readFileSync(`${HERE}one-act.json`, "utf-8")) as { id: string; expect: string; intent: string; request: ReadRequest }[]);
for (const a of acts) {
  const answers = [];
  for (let i = 0; i < n; i++) {
    const result = await createTurnReader({ questions: a.request.questions, transports: [transport] }).read(a.request.sources);
    answers.push(result.answers.find((x) => x.questionId === "acts")?.answerKey ?? "?");
  }
  const right = answers.filter((x) => x === a.expect).length * 2 > n;
  out.oneAct.push({ id: a.id, expect: a.expect, answers, right });
  save();
  console.log(`${a.id.padEnd(7)} ${right ? "RIGHT" : "wrong"}  expect ${a.expect}  got ${answers.join(",")}  ${a.intent.slice(0, 60)}`);
}
console.log(`\n${model}: main ${out.rows.filter((r: any) => r.right).length}/${out.rows.length} right; one-act ${out.oneAct.filter((r: any) => r.right).length}/${out.oneAct.length}`);
