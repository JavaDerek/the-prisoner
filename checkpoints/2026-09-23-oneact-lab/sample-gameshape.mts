// v3's rules in the GAME'S OWN answer shape -- a closed `one`/`several` key with a citation, asked
// exactly as `refereeTransport.ts` asks it -- on the same seeded 50. The 98% recorded in RESULTS.md
// was measured on a question that asks for a NUMBER; this repository does not ship a prompt whose
// measured form differs from its running form, so this is the number that decides whether it lands.
import { readFileSync, writeFileSync } from "node:fs";
const HERE = new URL(".", import.meta.url).pathname;
const n = Number(process.argv[2] ?? "50"), tries = Number(process.argv[3] ?? "2"), seed = 50505050;
const QUESTION = (JSON.parse(readFileSync(`${HERE}game-shape-v3.json`, "utf-8")) as { prompt: string }).prompt;
type Row = { n: number; game: number; round: number; chair: string; intent: string; recorded: string };
const rows = (JSON.parse(readFileSync("/Users/derekferguson/prisoner-prompt-lab/lab-data.json", "utf-8")) as { rows: Row[] }).rows;
let s = seed >>> 0;
const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pool = [...rows];
for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
const sample = pool.slice(0, n);
async function ask(intent: string): Promise<string> {
  const words = intent.split(/\s+/).filter(Boolean);
  const numbered = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
  const content =
    `Answer the question below about the actor's intent.\n\nThe actor's intent (source id "intent"), word by word:\n${numbered}\n\n` +
    `Question (id "acts"): ${QUESTION}\n\n` +
    `Answer with a JSON array of one object: [{"questionId": "acts", "answerKey": "one" | "several", ` +
    `"citation": {"sourceId": "intent", "from": <first word number>, "to": <last word number>}}]. ` +
    `Answer with the JSON array and nothing else.`;
  const res = await fetch("http://doris:11435/v1/chat/completions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "muse-glimmer-30b-q4_k_m", temperature: 0, max_tokens: 1800, stream: false,
      chat_template_kwargs: { reasoning_strength: "none" }, messages: [{ role: "user", content }] }),
  });
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const t = j.choices?.[0]?.message?.content ?? "";
  try { return JSON.parse(t.slice(t.indexOf("["), t.lastIndexOf("]") + 1))[0].answerKey; } catch { return "?"; }
}
const out: any[] = [];
for (const [i, row] of sample.entries()) {
  const runs: string[] = [];
  for (let t = 0; t < tries; t++) runs.push(await ask(row.intent));
  const stable = new Set(runs).size === 1;
  out.push({ ...row, runs, verdict: stable ? runs[0] : "UNSTABLE", stable });
  console.log(`${String(i + 1).padStart(2)} #${String(row.n).padEnd(4)} rec=${row.recorded.padEnd(7)} now=${(stable ? runs[0] : "UNSTABLE").padEnd(8)} [${runs.join(",")}]  ${row.intent.slice(0, 46)}`);
  writeFileSync(`${HERE}sample-gameshape-results.json`, JSON.stringify({ seed, n, tries, question: QUESTION, rows: out }, null, 1));
}
const sev = out.filter((r) => r.verdict === "several").length;
console.log(`\nflag rate: ${sev}/${out.length} = ${Math.round((sev / out.length) * 100)}%   unstable: ${out.filter((r) => !r.stable).length}`);
