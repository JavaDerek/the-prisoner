// Grounded-ruling escalation: re-ask a random sample of rulings that RESOLVED,
// and say whether a better referee reads them the same way.
//
//   PRISONER_MODEL_URL=http://localhost:8799/v1 PRISONER_ESCALATE_MODEL=claude-opus-4-6 \
//     npx tsx checkpoints/2026-09-24-phase1-b6/escalate-grounded.mts <out.csv> <n> <seed> <referee.json...>
//
// WHY THIS EXISTS, and it is `../2026-09-24-phase1-b4/escalate.mts`'s hole stated
// as code. That tool escalates REFUSALS -- 5 of 192 rulings in batch 4. The other
// 187 were grounded and NOTHING HAS EVER CHECKED ONE. A ruling that is
// confidently wrong but well-formed is invisible to a refusal audit: the referee
// names an effect, cites a verbatim quote, the world changes, and no one asks
// whether it was right. Batch 6 makes that worse, not better -- all three chairs
// are one model, so every intent is graded by the weights that wrote it, and no
// number of games fixes that. Only an outside opinion does.
//
// WHAT IT ASKS, AND WHAT IT DOES NOT. The refusal tool asks a yes/no question:
// does a stronger reader resolve this at all? For a grounded ruling that question
// is already answered, so this one compares the KEYS -- target, effect, property,
// and magnitude beside them. A disagreement is not automatically an error: two
// competent readers can key "scrape the mortar under the bar" as `wear bar` or
// `open window.passage` and both be defensible. So every row carries the two
// readings and an empty `your_verdict` column, and the CSV is evidence for a
// person, never a score this file computes. `agreement` here means the keys
// matched, nothing more.
//
// SAMPLED, WITH THE SEED RECORDED. Exhaustive escalation of ~200 grounded
// rulings is ~200 Opus calls per batch and would make an audit into a fixture;
// the handoff's instruction is a standing practice, not a second referee. The
// seed is an argument and is printed into the CSV's own filename line, so the
// identical sample can be drawn again -- an audit whose sample cannot be
// reproduced is an anecdote.
//
// POST-HOC AND OUT OF THE LOOP, PERMANENTLY. The referee's ruling IS the game's
// decision. A second opinion inline would need a tie-break rule, and that is a
// new mechanic rather than an audit. Like the refusal tool it runs against the
// committed `referee.json`, so nothing runs live, nothing touches the GPU, and
// it is safe to run while a batch is still in flight.
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const [out, nRaw, seedRaw, ...files] = process.argv.slice(2);
if (!out || !nRaw || !seedRaw || files.length === 0) {
  throw new Error("usage: escalate-grounded.mts <out.csv> <sample size> <seed> <referee.json...>");
}
const SAMPLE = Number(nRaw);
const SEED = Number(seedRaw);

const BASE_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:8799/v1";
const MODEL = process.env.PRISONER_ESCALATE_MODEL ?? "claude-opus-4-6";
const TIMEOUT_MS = Number(process.env.PRISONER_REFEREE_TIMEOUT_MS ?? 300000);

const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
const isDeclared = (o: string, k: string): boolean => propsOf(o).includes(k);
const isPerson = (id: string): boolean => id === "prisoner" || id === "warden";

/** Identical to `escalate.mts`'s, so "grounded" means the same thing in both. */
const recordedTransport = (replies: { content?: string }[]) => {
  const queue = replies.map((r) => r.content ?? "");
  return createRefereeTransport({
    baseUrl: "http://recorded",
    model: "recorded",
    ensureLoaded: async () => {},
    fetchFn: (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: queue.shift() ?? "" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
  });
};

const liveTransport = createRefereeTransport({ baseUrl: BASE_URL, model: MODEL, timeoutMs: TIMEOUT_MS, ensureLoaded: async () => {} });

const keys = (r: ReturnType<typeof computeRuling>): string => `${r.targetObjectId}/${r.effectKind}/${r.property}`;
const esc = (s: string): string => `"${String(s).replace(/"/g, '""')}"`;

/** mulberry32: a named, seeded PRNG, so the sample is a function of the seed
 *  and not of Node's Math.random or of the order the shell globbed the files. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pass 1: every grounded ruling, with its recorded keys. No model is called.
interface Row { file: string; label: string; request: ReadRequest; replies: { content?: string }[]; before: ReturnType<typeof computeRuling>; }
const grounded: Row[] = [];
for (const file of files.slice().sort()) {
  const entries = JSON.parse(readFileSync(file, "utf-8")) as { label: string; request: ReadRequest; replies?: { content?: string }[] }[];
  for (const entry of entries) {
    if (!entry.request.questions.some((q) => q.id === "target")) continue;
    const replies = entry.replies ?? [];
    const before = computeRuling(
      await createTurnReader({ questions: entry.request.questions, transports: [recordedTransport(replies)] }).read(entry.request.sources),
      entry.request,
      isDeclared,
      isPerson
    );
    if (!before.applicable) continue; // refusals are the OTHER tool's job
    grounded.push({ file, label: entry.label, request: entry.request, replies, before });
  }
}

// Pass 2: a seeded sample of them, each re-asked once of the escalation model.
// Files are sorted and the population is built before any sampling, so the same
// seed over the same transcripts draws the same rows whatever order the shell
// passed them in.
const rand = rng(SEED);
const pool = grounded.slice();
for (let i = pool.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [pool[i], pool[j]] = [pool[j], pool[i]];
}
const sample = pool.slice(0, Math.min(SAMPLE, pool.length));

const rows: string[] = [];
let n = 0;
let agreed = 0;
for (const r of sample) {
  const after = computeRuling(
    await createTurnReader({ questions: r.request.questions, transports: [liveTransport] }).read(r.request.sources),
    r.request,
    isDeclared,
    isPerson
  );
  const same = keys(r.before) === keys(after);
  if (same) agreed++;
  const m = /^round (\d+), (\w+): ([\s\S]*)$/.exec(r.label);
  const [round, chair, intent] = m ? [m[1], m[2], m[3]] : ["?", "?", r.label];
  rows.push(
    [
      String(++n),
      esc(r.file.split("/").pop() ?? r.file),
      round,
      chair,
      esc(keys(r.before)),
      esc(keys(after)),
      esc(r.before.magnitude ?? ""),
      esc(after.magnitude ?? ""),
      after.applicable ? (same ? "AGREES" : "DIFFERENT KEYS") : "ESCALATION REFUSED",
      esc(intent),
      "",
      "",
    ].join(",")
  );
  process.stderr.write(`  ${n}/${sample.length}: ${keys(r.before)} -> ${keys(after)} ${same ? "agrees" : "DIFFERS"}\n`);
}

writeFileSync(
  out,
  [
    `# seed=${SEED} sample=${sample.length} of ${grounded.length} grounded rulings, model=${MODEL}`,
    "row,transcript,round,chair,keys_local,keys_escalated,magnitude_local,magnitude_escalated,outcome,intent,your_verdict,notes",
    ...rows,
  ].join("\n") + "\n"
);
console.log(
  `${out}: ${n} of ${grounded.length} grounded rulings escalated to ${MODEL} (seed ${SEED}); ` +
    `${agreed} same keys, ${n - agreed} different. A DIFFERENT KEYS row is not an error -- it is a row for a person to read.`
);
