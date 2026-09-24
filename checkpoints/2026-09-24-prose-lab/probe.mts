// The prose-seat probe: ask ONE model the SAME prompt N times and measure what comes back.
//
//   npx tsx checkpoints/2026-09-24-prose-lab/probe.mts \
//     --prompt <file> --model <id> --url <base> --n <N> --out <file.json> [--exemplar <file>]
//
// Every number this session reported came from a throwaway in /tmp that was edited twice with
// `sed` while it ran. This is that script, committed, so a later run is comparable to an earlier
// one and a finding can be re-checked rather than re-remembered.
//
// WHAT IT MEASURES, and what each measure is and is not:
//
//   clean       -- no flag fired. The flags are the failures the models ACTUALLY produced on this
//                  scene (narrating an outcome, writing the other principal, inventing state,
//                  running past the 600-char cap), checked literally. Triage, never a verdict:
//                  the same rule the refusal audit follows.
//   approaches  -- distinct tool->target pairs, and their entropy. This is DIVERSIFICATION, not
//                  innovation: every object it can name is one the prompt already lists, because
//                  the referee can only ground an act on an authored object. It cannot tell "tried
//                  the tile instead of the bar" from "turned the cot into a lockpick". The measure
//                  for the second is the transcripts' own novel (object, effect) pairs, and that
//                  only exists once games run.
//   parrot      -- 5-gram overlap with a supplied exemplar. An intent that reproduces the worked
//                  example is a lost turn: measured at 4/20 when the exemplar stands alone, 1/20
//                  with the named rules beside it, 0/20 when the example points at an object no
//                  win condition mentions.
//   repurposed  -- an object used as something its own description does not suggest. Crude and
//                  hand-checkable by design; it exists to say WHICH replies to read.
import { readFileSync, writeFileSync } from "node:fs";

const arg = (k: string, d?: string): string => {
  const i = process.argv.indexOf(`--${k}`);
  if (i < 0 || !process.argv[i + 1]) {
    if (d !== undefined) return d;
    throw new Error(`missing --${k}`);
  }
  return process.argv[i + 1];
};

const CAP = 600; // `coerceProposal`'s own cap: past this an intent is hard-sliced mid-word.
const prompt = readFileSync(arg("prompt"), "utf8");
const model = arg("model");
const url = arg("url");
const n = Number(arg("n", "20"));
const out = arg("out");
const exemplarPath = arg("exemplar", "");
const exemplar = exemplarPath ? readFileSync(exemplarPath, "utf8").trim() : "";

const words = (s: string): string[] => s.toLowerCase().match(/[a-z']+/g) ?? [];
const grams = (s: string, k = 5): Set<string> => {
  const w = words(s);
  return new Set(Array.from({ length: Math.max(0, w.length - k + 1) }, (_, i) => w.slice(i, i + k).join(" ")));
};
const EX = grams(exemplar);
const parrotShare = (s: string): number => {
  if (EX.size === 0) return 0;
  let hit = 0;
  for (const g of grams(s)) if (EX.has(g)) hit++;
  return hit / EX.size;
};

const flagsOf = (s: string): string[] => {
  const f: string[] = [];
  if (/^(Turn \d+\s*:|Turn Report)/i.test(s.trim())) f.push("heading");
  if (/\b(Croft|the warden)\b[^.]{0,60}\b(says|exclaims|grunts|snaps|eyes|replies|shouts|nods|steps|watches|laughs)\b/i.test(s)) f.push("writes the other");
  if (/\b(integrity|suspicion|attention|edge)\s*:\s*-?\d+/i.test(s)) f.push("invents state");
  if (s.length > CAP) f.push("over cap");
  return f;
};
const approachOf = (raw: string): string => {
  const s = raw.toLowerCase();
  const tool = /\bspoon\b/.test(s) ? "spoon" : /\bblanket\b/.test(s) ? "blanket" : /\b(finger|hand|thumb|nail|foot|toe)/.test(s) ? "hands" : /\bwire\b/.test(s) ? "wire" : "other";
  const target = /\b(bar|mortar|rust)\b/.test(s) ? "bar/mortar" : /\b(tile|grit|floor|earth)\b/.test(s) ? "tile/floor" : /\b(lock|door|bolt)\b/.test(s) ? "lock/door" : /\bcot\b/.test(s) ? "cot" : /\b(blanket|thread)\b/.test(s) ? "blanket" : /\bwindow\b/.test(s) ? "window" : "other";
  return `${tool}->${target}`;
};
const REPURPOSE: Record<string, RegExp> = {
  "blanket as tool": /blanket[^.]{0,60}\b(rub|scrape|abrad|against|wrap|muffle|pad)\b/i,
  "wire from the cot": /\bwire\b/i,
  "spoon reshaped": /\b(bend|flatten|sharpen|hone|reshape)\w*\b[^.]{0,30}\bspoon\b|\bspoon\b[^.]{0,30}\b(bend|flat|sharpen)/i,
  "thread used": /\bthread\b/i,
  "body as tool": /\b(fingernail|nails|teeth|toe|heel|elbow)\b/i,
};

const rows: { i: number; ms: number; text: string; flags: string[]; clean: boolean; approach: string; parrot: number; repurposed: string[] }[] = [];
for (let i = 0; i < n; i++) {
  const t0 = Date.now();
  let text = "";
  try {
    const res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.9, stream: false }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = (((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "").trim();
  } catch (e) {
    text = "";
    process.stderr.write(`  ${i + 1}/${n} ERROR ${String((e as Error).message)}\n`);
  }
  const f = text ? flagsOf(text) : ["ERROR"];
  const rep = Object.entries(REPURPOSE).filter(([, rx]) => rx.test(text)).map(([k]) => k);
  rows.push({ i: i + 1, ms: Date.now() - t0, text, flags: f, clean: f.length === 0, approach: approachOf(text), parrot: parrotShare(text), repurposed: rep });
  process.stderr.write(`  ${i + 1}/${n} ${String(text.length).padStart(4)}ch ${f.length ? f.join(",") : "CLEAN"}${rows[i].parrot > 0.5 ? " PARROT" : ""}\n`);
}

writeFileSync(out, JSON.stringify({ model, url, n, prompt: arg("prompt"), exemplar: exemplarPath, rows }, null, 1));
const clean = rows.filter((r) => r.clean).length;
const parrots = rows.filter((r) => r.parrot > 0.5).length;
const counts = new Map<string, number>();
for (const r of rows) counts.set(r.approach, (counts.get(r.approach) ?? 0) + 1);
const H = [...counts.values()].reduce((s, v) => s - (v / n) * Math.log2(v / n), 0);
// eslint-disable-next-line no-console
console.log(`${model}: clean ${clean}/${n} (${Math.round((100 * clean) / n)}%), ${counts.size} approaches, entropy ${H.toFixed(2)}b, parrot ${parrots}/${n}, repurposed ${rows.filter((r) => r.repurposed.length).length}/${n} -> ${out}`);
