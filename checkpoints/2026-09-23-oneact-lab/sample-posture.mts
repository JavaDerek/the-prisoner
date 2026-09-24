// The POSTURE rule on a random 50 of batch 3's intents (the owner's rule, 2026-09-23: intra-room
// travel is no act, a CHANGE of posture is one -- what Infocom did, and what the engine's own
// three-valued `posture` property already encodes).
//
//   npx tsx checkpoints/2026-09-23-oneact-lab/sample-posture.mts <n> <tries> [seed]
//
// The rate to expect is NOT the old 22%: 29% of the batch's intents contain a real posture change,
// 41 of them recorded `one`, so this rule implies about 44% by construction. A result near 44% means
// the wording is applying the rule; near 22% means it is ignoring posture; well above 50% means it is
// counting posture WORDS (standing, leaning) rather than posture CHANGES, which is the failure mode
// the two earlier formulations had.
import { readFileSync, writeFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const n = Number(process.argv[2] ?? "50");
const tries = Number(process.argv[3] ?? "2");
const seed = Number(process.argv[4] ?? "50505050");

const PROMPT = (JSON.parse(readFileSync(`${HERE}posture-prompt.json`, "utf-8")) as { prompt: string }).prompt;
type Row = { n: number; game: number; round: number; chair: string; intent: string; recorded: string; ruling: string };
const rows = (JSON.parse(readFileSync("/Users/derekferguson/prisoner-prompt-lab/lab-data.json", "utf-8")) as { rows: Row[] }).rows;

let s = seed >>> 0;
const rnd = (): number => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pool = [...rows];
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const sample = pool.slice(0, n);

const POSTURE_CHANGE = /\b(sit down|sits down|sit on|sit back|sitting on|sitting down|crouch|crouching|kneel|kneeling|lie down|lying down|lower myself|lower my|drop to the floor|drop to my knees|sink to|settle onto|get up|stand up|rise from|rising from|straighten up|push myself up)\b/i;

async function ask(intent: string): Promise<number | null> {
  const res = await fetch("http://doris:11435/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "muse-glimmer-30b-q4_k_m", temperature: 0, max_tokens: 1800, stream: false,
      chat_template_kwargs: { reasoning_strength: "none" },
      messages: [{ role: "user", content: PROMPT.replaceAll("{{INTENT}}", intent) }],
    }),
  });
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const m = (j.choices?.[0]?.message?.content ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

const out: any[] = [];
for (const [i, row] of sample.entries()) {
  const nums: (number | null)[] = [];
  for (let t = 0; t < tries; t++) nums.push(await ask(row.intent));
  const verdicts = nums.map((x) => (x === null ? "?" : x > 1 ? "several" : "one"));
  const stable = new Set(verdicts).size === 1;
  const posture = POSTURE_CHANGE.test(row.intent);
  out.push({ ...row, nums, verdict: stable ? verdicts[0] : "UNSTABLE", stable, posture });
  console.log(
    `${String(i + 1).padStart(2)} #${String(row.n).padEnd(4)} g${row.game}·r${String(row.round).padEnd(2)} ${row.chair.padEnd(8)} ` +
      `rec=${row.recorded.padEnd(7)} now=${(stable ? verdicts[0] : "UNSTABLE").padEnd(8)} [${nums.join(",")}] ` +
      `${posture ? "POSTURE " : "        "} ${row.intent.slice(0, 44)}`
  );
  writeFileSync(`${HERE}sample-posture-results.json`, JSON.stringify({ seed, n, tries, prompt: PROMPT, rows: out }, null, 1));
}

const clean = out.filter((r) => r.stable && r.verdict !== "?");
const sev = clean.filter((r) => r.verdict === "several").length;
const withP = clean.filter((r) => r.posture);
const sevWithP = withP.filter((r) => r.verdict === "several").length;
const noP = clean.filter((r) => !r.posture);
const sevNoP = noP.filter((r) => r.verdict === "several").length;
console.log(`\nrandom ${out.length} (seed ${seed}), ${out.filter((r) => !r.stable).length} unstable`);
console.log(`flag rate: ${sev}/${clean.length} = ${Math.round((sev / clean.length) * 100)}%   (posture rule implies ~44%; the old rule gave 22%)`);
console.log(`  rows WITH a posture change: ${sevWithP}/${withP.length} flagged = ${withP.length ? Math.round((sevWithP / withP.length) * 100) : 0}%  -- the rule says these SHOULD flag`);
console.log(`  rows without one:           ${sevNoP}/${noP.length} flagged = ${noP.length ? Math.round((sevNoP / noP.length) * 100) : 0}%  -- these flag only if genuinely compound`);
