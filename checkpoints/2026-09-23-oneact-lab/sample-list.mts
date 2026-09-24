// The LIST form of the one-act call, on the same seeded sample as `sample.mts`, so the two are
// comparable. The model is asked for one line per effect, `<effect> -> <object>`, in the engine's
// own vocabulary; the POLICY then lives here, in code, where it is a function and not a clause a
// model may or may not honour:
//
//   - an entry whose effect is a reposition is DROPPED (the owner's "overrule" rule, 2026-09-23:
//     intra-room movement is not an act, whatever its stated purpose -- in IF everything in the
//     room is in scope and there is no travel within it);
//   - an entry that only handles the object of another entry is DROPPED (picking a thing up to
//     examine it is one effect, and the referee's own `effect` answer already reads it that way);
//   - what survives is counted, and two or more is `several`.
//
// `sample.mts` asked for a bare number with the same rules stated in prose, and scored 55% flagged
// against a 22% baseline -- every bad flag a body movement the prompt had told it to ignore. That
// is the experiment this one exists to answer: whether the rule works better applied than asked.
import { readFileSync, writeFileSync } from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const n = Number(process.argv[2] ?? "20");
const tries = Number(process.argv[3] ?? "2");
const seed = Number(process.argv[4] ?? "20260923");

const QUESTION =
  "List every effect this person attempts, one per line, in the form \"<effect> -> <object>\". " +
  "The effects are: wear, restore, reveal, conceal, expose, noise, open, close, leave, take, give, move-person, " +
  "and reposition-self (the actor moving her own body within the room: standing, stepping, crouching, lying down, " +
  "crawling, leaning, turning, or going over to something). " +
  "Name every one you see, INCLUDING reposition-self, and name the object each acts on. " +
  "Looking for several details on one thing is ONE reveal of it. Speaking, watching and waiting are not effects " +
  "and are not listed. Answer with the lines and nothing else.";

type Row = { game: string; round: number; chair: string; intent: string; recorded: string; ruling: string };
const data = JSON.parse(readFileSync(`${HERE}oneact-data.json`, "utf-8")) as { rows: Row[] };

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

type Entry = { effect: string; object: string };

/** The policy, in code. Returns what survives and why each dropped entry went. */
function reduce(entries: Entry[]): { kept: Entry[]; dropped: { entry: Entry; why: string }[] } {
  const kept: Entry[] = [];
  const dropped: { entry: Entry; why: string }[] = [];
  const objectsActedOn = new Set(entries.filter((e) => e.effect !== "reposition-self" && e.effect !== "take").map((e) => e.object));
  for (const e of entries) {
    if (e.effect === "reposition-self") {
      dropped.push({ entry: e, why: "reposition" });
      continue;
    }
    // Handling the very thing another effect acts on: picking the spoon up to examine the spoon.
    if (e.effect === "take" && objectsActedOn.has(e.object)) {
      dropped.push({ entry: e, why: "handling the object of another effect" });
      continue;
    }
    kept.push(e);
  }
  return { kept, dropped };
}

function parse(raw: string): Entry[] {
  return raw
    .split("\n")
    .map((l) => l.trim().replace(/^[-*\d.\s]+/, ""))
    .filter((l) => l.includes("->"))
    .map((l) => {
      const [a, b] = l.split("->");
      return { effect: a.trim().toLowerCase().replace(/[^a-z-]/g, ""), object: (b ?? "").trim().toLowerCase() };
    })
    .filter((e) => e.effect.length > 0);
}

async function ask(intent: string): Promise<{ raw: string; entries: Entry[] }> {
  const res = await fetch("http://doris:11435/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "muse-glimmer-30b-q4_k_m",
      temperature: 0,
      max_tokens: 1800,
      stream: false,
      chat_template_kwargs: { reasoning_strength: "none" },
      messages: [{ role: "user", content: `${QUESTION}\n\nIntent: "${intent}"` }],
    }),
  });
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (json.choices?.[0]?.message?.content ?? "").trim();
  return { raw, entries: parse(raw) };
}

const out: any[] = [];
for (const [i, row] of sample.entries()) {
  const runs = [];
  for (let t = 0; t < tries; t++) {
    const { raw, entries } = await ask(row.intent);
    const { kept, dropped } = reduce(entries);
    runs.push({ raw, entries, kept: kept.length, dropped: dropped.length, listed: entries.length });
  }
  const verdicts = runs.map((r) => (r.kept > 1 ? "several" : "one"));
  const stable = new Set(verdicts).size === 1;
  out.push({ ...row, runs, verdict: stable ? verdicts[0] : "UNSTABLE", stable });
  console.log(
    `${String(i + 1).padStart(2)} r${String(row.round).padEnd(2)} ${row.chair.padEnd(8)} ` +
      `recorded=${row.recorded.padEnd(7)} now=${(stable ? verdicts[0] : "UNSTABLE").padEnd(8)} ` +
      `listed=[${runs.map((r) => r.listed).join(",")}] kept=[${runs.map((r) => r.kept).join(",")}]  ${row.intent.slice(0, 48)}`
  );
  writeFileSync(`${HERE}sample-list-results.json`, JSON.stringify({ seed, n, tries, question: QUESTION, rows: out }, null, 1));
}

const several = out.filter((r) => r.verdict === "several").length;
const unstable = out.filter((r) => !r.stable).length;
const listedTotal = out.reduce((a, r) => a + r.runs[0].listed, 0);
const keptTotal = out.reduce((a, r) => a + r.runs[0].kept, 0);
console.log(`\nsample of ${out.length} (seed ${seed}) -- the SAME rows sample.mts used`);
console.log(`flag rate NOW: ${several}/${out.length} = ${Math.round((several / out.length) * 100)}%`);
console.log(`  bare-number form: 55%   batch 3 recorded: 22%   batch 2: 45%`);
console.log(`unstable across ${tries} tries: ${unstable}`);
console.log(`entries listed: ${listedTotal}, kept after the code-side rule: ${keptTotal} (dropped ${listedTotal - keptTotal})`);
