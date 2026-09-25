// Serial replay of batch 6's GROUNDED rulings. PREDICTION-3.md holds the pre-commit.
// Post-hoc against committed JSON: nothing runs live, nothing touches game state.
//   npx tsx checkpoints/2026-09-25-referee-thinking/grounded.mts <out.jsonl>
import { readFileSync, appendFileSync, readdirSync, existsSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const out = process.argv[2];
const B6 = "checkpoints/2026-09-24-phase1-b6";
const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const k = DERIVABLE_KINDS.find((x) => id === x.id || id.startsWith(`${x.id}_`));
  if (k) return k.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string) => propsOf(o).includes(k);
const isPerson = (id: string) => id === "prisoner" || id === "warden";
const keys = (r: ReturnType<typeof computeRuling>) => `${r.targetObjectId}/${r.effectKind}/${r.property}`;

const recorded = (replies: { content?: string }[]) => {
  const q = replies.map((r) => r.content ?? "");
  return createRefereeTransport({ baseUrl: "http://recorded", model: "recorded", ensureLoaded: async () => {},
    fetchFn: (async () => new Response(JSON.stringify({ choices: [{ message: { content: q.shift() ?? "" } }] }),
      { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch });
};
const live = createRefereeTransport({
  baseUrl: "http://doris:11435/v1", model: "muse-glimmer-30b-q4_k_m",
  timeoutMs: 600_000, ensureLoaded: async () => {},   // b6's wire: server flag only, no per-request kwargs
});

// Pass 1: the grounded population, from the recorded replies. No model is called.
type Item = { file: string; label: string; request: ReadRequest; before: string };
const pool: Item[] = [];
for (const d of ["P", "S", "T"]) {
  const dir = `${B6}/${d}`;
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".referee.json")).sort()) {
    const entries = JSON.parse(readFileSync(`${dir}/${f}`, "utf-8")) as { label: string; request: ReadRequest; replies?: { content?: string }[] }[];
    for (const e of entries) {
      if (!e.request.questions.some((q) => q.id === "target")) continue;
      const r = computeRuling(await createTurnReader({ questions: e.request.questions, transports: [recorded(e.replies ?? [])] }).read(e.request.sources), e.request, isDeclared, isPerson);
      if (!r.applicable) continue;                     // the 22 refusals are already done
      pool.push({ file: `${d}/${f}`, label: e.label, request: e.request, before: keys(r) });
    }
  }
}
console.log(`grounded population: ${pool.length}`);

let n = 0, agree = 0, becameRefusal = 0;
for (const it of pool) {
  const t0 = Date.now();
  let rec: Record<string, unknown>;
  try {
    const after = computeRuling(await createTurnReader({ questions: it.request.questions, transports: [live] }).read(it.request.sources), it.request, isDeclared, isPerson);
    const same = keys(after) === it.before;
    n++; if (same) agree++; if (!after.applicable) becameRefusal++;
    rec = { i: n, file: it.file, label: it.label, before: it.before, after: keys(after), agree: same,
            applicableAfter: after.applicable, seconds: Math.round((Date.now() - t0) / 100) / 10 };
  } catch (e) { rec = { i: ++n, file: it.file, label: it.label, before: it.before, error: String(e), seconds: Math.round((Date.now() - t0) / 100) / 10 }; }
  appendFileSync(out, JSON.stringify(rec) + "\n");
  if (n % 10 === 0) console.log(`${n}/${pool.length} agree=${agree} (${(agree / n * 100).toFixed(0)}%) becameRefusal=${becameRefusal}`);
  // PREDICTION-3.md stopping rule.
  if (n === 100 && (n - agree) / n > 0.30) { console.log(`STOPPING RULE: ${((n - agree) / n * 100).toFixed(0)}% disagree at 100`); break; }
}
console.log(`DONE ${n} scored, agree ${agree} (${(agree / n * 100).toFixed(1)}%), becameRefusal ${becameRefusal}`);
