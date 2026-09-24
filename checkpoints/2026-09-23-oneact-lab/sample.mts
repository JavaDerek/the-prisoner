// A sample of batch 3's own intents, asked the EFFECTS question instead of the game's one-act
// question (this checkpoint's `RESULTS.md` records where the wording came from).
//
//   npx tsx checkpoints/2026-09-23-oneact-lab/sample.mts <n> <tries> [seed]
//
// Seeded so the sample is the same every time it is run, and the composition is printed, because a
// sample drawn to flatter a formulation measures nothing. The recorded answers are shown beside the
// new ones but are NOT scored against: batch 3's own `several` labels were audited by hand and
// several of them are wrong (RESULTS.md, "why the keys cannot tell you"). What this measures is the
// FLAG RATE against the recorded 22%, and it lists every disagreement for the owner to judge.
import { readFileSync, writeFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const n = Number(process.argv[2] ?? "20");
const tries = Number(process.argv[3] ?? "2");
const seed = Number(process.argv[4] ?? "20260923");

const QUESTION =
  "How many separate EFFECTS does this person attempt? An effect is one of: wearing a thing down, " +
  "restoring or sharpening it, revealing what is true of it by examining it, concealing something, " +
  "exposing something hidden, making a noise, opening or closing a way out, going out through one, " +
  "taking or handing over a thing, or moving a person. Examining counts as ONE effect (revealing), " +
  "even though it changes nothing. Looking for several details on one thing is still one. Going over " +
  "to a thing, bending, sitting or picking it up is getting ready, not an effect of its own; speaking, " +
  "watching and waiting are not effects. Answer with a single number and nothing else.";

type Row = { game: string; round: number; chair: string; intent: string; recorded: string; ruling: string };
const data = JSON.parse(readFileSync(`${HERE}oneact-data.json`, "utf-8")) as { rows: Row[] };

// Mulberry32: a seeded shuffle, so "the sample" is a fact and not a choice made per run.
let s = seed >>> 0;
const rnd = (): number => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pool = [...data.rows];
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const sample = pool.slice(0, n);

async function ask(intent: string): Promise<{ raw: string; num: number | null }> {
  const res = await fetch("http://doris:11435/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "muse-glimmer-30b-q4_k_m",
      temperature: 0,
      max_tokens: 1600,
      stream: false,
      chat_template_kwargs: { reasoning_strength: "none" },
      messages: [{ role: "user", content: `${QUESTION}\n\nIntent: "${intent}"` }],
    }),
  });
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim();
  const m = raw.match(/\d+/);
  return { raw, num: m ? Number(m[0]) : null };
}

const out: any[] = [];
for (const [i, row] of sample.entries()) {
  const runs = [];
  for (let t = 0; t < tries; t++) runs.push(await ask(row.intent));
  const verdicts = runs.map((r) => (r.num === null ? "?" : r.num > 1 ? "several" : "one"));
  const stable = new Set(verdicts).size === 1;
  const verdict = stable ? verdicts[0] : "UNSTABLE";
  out.push({ ...row, nums: runs.map((r) => r.num), verdict, stable });
  console.log(
    `${String(i + 1).padStart(2)} r${String(row.round).padEnd(2)} ${row.chair.padEnd(8)} ` +
      `recorded=${row.recorded.padEnd(7)} now=${verdict.padEnd(8)} [${runs.map((r) => r.num).join(",")}]  ${row.intent.slice(0, 58)}`
  );
  writeFileSync(`${HERE}sample-results.json`, JSON.stringify({ seed, n, tries, question: QUESTION, rows: out }, null, 1));
}

const several = out.filter((r) => r.verdict === "several").length;
const unstable = out.filter((r) => !r.stable).length;
const recSeveral = out.filter((r) => r.recorded === "several").length;
const moved = out.filter((r) => r.stable && r.verdict !== r.recorded);
console.log(`\nsample of ${out.length} (seed ${seed}), composition: ${recSeveral} recorded 'several', ${out.length - recSeveral} recorded 'one'`);
console.log(`flag rate NOW: ${several}/${out.length} = ${Math.round((several / out.length) * 100)}%   (batch 3 recorded: 22%, batch 2: 45%)`);
console.log(`unstable across ${tries} tries: ${unstable}`);
console.log(`\ndisagreements with the recorded answer (${moved.length}) -- these are the rows to judge by hand:`);
for (const r of moved) console.log(`  r${r.round} ${r.chair}: recorded ${r.recorded} -> now ${r.verdict}  | ${r.intent.slice(0, 96)}`);
