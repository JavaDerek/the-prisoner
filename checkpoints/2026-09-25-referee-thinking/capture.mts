// Stage 1 of the bottom row: what does the SHIPPED referee do with intents that
// should not resolve? PREDICTION-4.md holds the pre-commit.
//   npx tsx .../capture.mts <requests.json> <out.jsonl>
import { readFileSync, appendFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const [inFile, out] = process.argv.slice(2);
const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const k = DERIVABLE_KINDS.find((x) => id === x.id || id.startsWith(`${x.id}_`));
  if (k) return k.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string) => propsOf(o).includes(k);
const isPerson = (id: string) => id === "prisoner" || id === "warden";
// PREDICTION-4.md tier 2: the way out and its parts. Naming one of these on an
// intent that names no object is the harmful capture SS68.5 measured.
const ESCAPE = new Set(["window", "bar", "door", "lock"]);

const rows = JSON.parse(readFileSync(inFile, "utf-8")) as { label: string; kind: string; intent: string; request: ReadRequest }[];
const live = createRefereeTransport({ baseUrl: "http://doris:11435/v1", model: "muse-glimmer-30b-q4_k_m", timeoutMs: 600_000, ensureLoaded: async () => {} });

const score = async (r: (typeof rows)[number], pass: number) => {
  const t0 = Date.now();
  const ruling = computeRuling(await createTurnReader({ questions: r.request.questions, transports: [live] }).read(r.request.sources), r.request, isDeclared, isPerson);
  const keys = `${ruling.targetObjectId}/${ruling.effectKind}/${ruling.property}`;
  const rec = { pass, kind: r.kind, intent: r.intent, keys, applicable: ruling.applicable,
    tier1: r.kind !== "OBJECT" && ruling.applicable,
    tier2: r.kind !== "OBJECT" && ruling.applicable && ESCAPE.has(ruling.targetObjectId),
    seconds: Math.round((Date.now() - t0) / 100) / 10 };
  appendFileSync(out, JSON.stringify(rec) + "\n");
  console.log(`[${pass}] ${r.kind.padEnd(8)} ${keys.padEnd(30)} ${rec.tier2 ? "CAPTURE" : rec.tier1 ? "resolved" : ""}  ${r.intent.slice(0, 44)}`);
  return rec;
};

const all = [];
for (const r of rows) all.push(await score(r, 1));
const t1 = all.filter((x) => x.tier1).length, t2 = all.filter((x) => x.tier2).length;
const ctl = all.filter((x) => x.kind === "OBJECT");
console.log(`\nnon-controls ${all.length - ctl.length}: tier1 resolved ${t1}, tier2 CAPTURES ${t2}`);
console.log(`controls ${ctl.length}: applicable ${ctl.filter((x) => x.applicable).length}`);

// PREDICTION-4.md band 4: a 6-row repeat, first six rows, same keys expected.
console.log(`\n=== determinism repeat (6 rows) ===`);
let same = 0;
for (const r of rows.slice(0, 6)) { const b = await score(r, 2); if (b.keys === all[rows.indexOf(r)].keys) same++; }
console.log(`repeat agreement ${same}/6`);
