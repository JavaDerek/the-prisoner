// Does referee reasoning strength recover batch 6's wrong refusals?
// PREDICTION.md holds the pre-commit. Replays each recorded refusal request
// byte-identically at one reasoning strength and scores it through the real
// `computeRuling`. Direct to doris:11435 -- the router's 150s cap is below a
// `high` call's 163.5s. Nothing is restarted; nothing touches game state.
//
//   npx tsx checkpoints/2026-09-25-referee-thinking/probe.mts <strength> <out.jsonl> <row>...
import { readFileSync, appendFileSync, readdirSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { withReasoningStrength } from "../../src/open/thinking.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const [strengthRaw, out, ...wanted] = process.argv.slice(2);
const strength = strengthRaw as "none" | "low" | "medium" | "high" | "server" | "server-effort";
const B6 = "checkpoints/2026-09-24-phase1-b6";

const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const isPerson = (id: string): boolean => id === "prisoner" || id === "warden";

// The 22 refusal rows, read from the audit CSV the batch committed.
const csv = readFileSync(`${B6}/refusal-escalation.csv`, "utf-8");
const cells = (line: string): string[] => {
  const o: string[] = []; let c = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { o.push(c); c = ""; }
    else c += ch;
  }
  o.push(c); return o;
};
const lines = csv.split("\n").filter((l) => l.trim().length > 0);
const head = cells(lines[0]);
const rows = lines.slice(1).map((l) => Object.fromEntries(cells(l).map((v, i) => [head[i], v])) as Record<string, string>);

const dirs = ["P", "S", "T"].filter((d) => { try { readdirSync(`${B6}/${d}`); return true; } catch { return false; } });
const findEntry = (r: Record<string, string>) => {
  for (const d of dirs) {
    let raw: string;
    try { raw = readFileSync(`${B6}/${d}/${r.transcript}`, "utf-8"); } catch { continue; }
    const entries = JSON.parse(raw) as { label: string; request: ReadRequest }[];
    const hit = entries.find((e) => e.label.startsWith(`round ${r.round}, ${r.chair}:`) && e.label.includes(r.intent.slice(0, 40)));
    if (hit) return hit;
  }
  throw new Error(`row ${r.row}: no entry for ${r.transcript} round ${r.round} ${r.chair}`);
};

const transport = createRefereeTransport({
  baseUrl: process.env.PROBE_BASE_URL ?? "http://doris:11435/v1",
  model: "muse-glimmer-30b-q4_k_m",
  timeoutMs: 600_000,
  ensureLoaded: async () => {},                      // nothing is swapped; Muse is already served
  // "server": send NOTHING -- rely on the server's own start flag, exactly as
  // batch 6 did. "server-effort": b6's literal wire, which also carried the
  // no-op `reasoning_effort: "none"`.
  ...(strength === "server" ? {} : strength === "server-effort" ? { thinking: "off" as const } : { fetchFn: withReasoningStrength(undefined, strength) }),
});

for (const want of wanted) {
  const r = rows.find((x) => x.row === want);
  if (!r) throw new Error(`no row ${want}`);
  const entry = findEntry(r);
  const t0 = Date.now();
  let rec: Record<string, unknown>;
  try {
    const result = await createTurnReader({ questions: entry.request.questions, transports: [transport] }).read(entry.request.sources);
    const ruling = computeRuling(result, entry.request, isDeclared, isPerson);
    rec = {
      row: r.row, strength, chair: r.chair, round: r.round,
      recorded: r.keys_local, escalated: r.keys_escalated, outcome: r.outcome,
      keys: `${ruling.targetObjectId}/${ruling.effectKind}/${ruling.property}`,
      applicable: ruling.applicable,
      safeDefaults: result.answers.filter((a) => a.fromSafeDefault).map((a) => a.questionId),
      seconds: Math.round((Date.now() - t0) / 100) / 10, intent: r.intent,
    };
  } catch (e) {
    rec = { row: r.row, strength, error: String(e), seconds: Math.round((Date.now() - t0) / 100) / 10, intent: r.intent };
  }
  appendFileSync(out, JSON.stringify(rec) + "\n");
  console.log(`row ${r.row} ${strength}: ${rec.keys ?? rec.error} applicable=${rec.applicable} ${rec.seconds}s`);
}
