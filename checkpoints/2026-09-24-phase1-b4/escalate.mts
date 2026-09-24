// Refusal escalation: re-ask a REFUSED ruling of a better referee, once, and say whether it
// still refuses.
//
//   PRISONER_MODEL_URL=http://localhost:8799/v1 PRISONER_ESCALATE_MODEL=claude-opus-4-6 \
//     npx tsx checkpoints/2026-09-24-phase1-b4/escalate.mts <out.csv> <referee.json...>
//
// WHY THIS EXISTS AND `referee-replay` DOES NOT DO IT. A refusal's keys say THAT a refusal
// happened and what shape it has; they do not say whose fault it is -- batch 3's own results
// proved that, with three identical `<person>/<effect>/none` rows landing in three different
// buckets once the intent was read. The one question the keys cannot answer is the one that
// matters here: **did the warden attempt something this game has not built, or did the referee
// drop a ruling a better reader would have made?** A stronger referee answering the IDENTICAL
// recorded request separates those two, and nothing else does.
//
// `npm run referee-replay` re-asks a whole transcript N times and reports per-key AGREEMENT. That
// is a consistency instrument, not this one: it prints the keys but never runs `computeRuling`, so
// it cannot say whether the fresh answers would have RESOLVED. This does, through the same
// `computeRuling` + declared-property path `audit.mts` uses, so the two always agree about what a
// refusal is.
//
// It costs one call per refusal -- about fifteen across a batch, not two hundred -- which is why a
// full second-referee arm was not worth running (the benchmark has Muse 39, Opus 41, Sonnet 42 on
// identical rows; the interesting rows are the refused ones).
//
// NO SWAPPER AND NO RESIDENT GUARD, deliberately, unlike `refereeReplayCli.ts`: the escalation
// model is served by the `claude` CLI through the model router and never occupies the GPU, so
// there is nothing to load, unload, or protect from another tenant. Running this while a batch is
// in flight is therefore safe, and is the point -- it must not wait for the card.
import { readFileSync, writeFileSync } from "node:fs";
import { createTurnReader, type ReadRequest } from "run-dmcp";
import { computeRuling } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { findObject } from "../../src/open/scenarioObjects.js";
import { DERIVABLE_KINDS } from "../../src/open/derivedObjects.js";

const [out, ...files] = process.argv.slice(2);
if (!out || files.length === 0) throw new Error("usage: escalate.mts <out.csv> <referee.json...>");

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

/** The recorded referee: replies the batch really got, replayed from the file. Identical to
 *  `audit.mts`'s, so "refused" means the same thing in both. */
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

const rows: string[] = [];
let n = 0;
let converted = 0;

for (const file of files) {
  const entries = JSON.parse(readFileSync(file, "utf-8")) as { label: string; request: ReadRequest; replies?: { content?: string }[] }[];
  for (const entry of entries) {
    if (!entry.request.questions.some((q) => q.id === "target")) continue;

    const before = computeRuling(
      await createTurnReader({ questions: entry.request.questions, transports: [recordedTransport(entry.replies ?? [])] }).read(entry.request.sources),
      entry.request,
      isDeclared,
      isPerson
    );
    if (before.applicable) continue;

    // The IDENTICAL recorded request, asked once of the escalation model. Nothing about the
    // question changes -- same questions, same sources, same answer keys -- so any difference in
    // the outcome is the reader's and only the reader's.
    const after = computeRuling(
      await createTurnReader({ questions: entry.request.questions, transports: [liveTransport] }).read(entry.request.sources),
      entry.request,
      isDeclared,
      isPerson
    );

    const m = /^round (\d+), (\w+): ([\s\S]*)$/.exec(entry.label);
    const [round, chair, intent] = m ? [m[1], m[2], m[3]] : ["?", "?", entry.label];
    if (after.applicable) converted++;
    rows.push(
      [
        String(++n),
        esc(file.split("/").pop() ?? file),
        round,
        chair,
        esc(keys(before)),
        esc(keys(after)),
        after.applicable ? "RESOLVED" : "still refused",
        // The reading this row supports, stated as a verdict rather than left to the eye:
        // a ruling a stronger reader resolves was the referee's to make and it dropped it;
        // one it also refuses is the game's -- unbuilt, or correctly refused.
        after.applicable ? "the referee dropped it" : "not the referee: unbuilt or correctly refused",
        esc(intent),
        "",
        "",
      ].join(",")
    );
    process.stderr.write(`  ${n}: ${keys(before)} -> ${keys(after)} ${after.applicable ? "RESOLVED" : "still refused"}\n`);
  }
}

writeFileSync(out, ["row,transcript,round,chair,keys_local,keys_escalated,outcome,reading,intent,your_verdict,notes", ...rows].join("\n") + "\n");
console.log(`${out}: ${n} refusals escalated to ${MODEL}, ${converted} resolved, ${n - converted} still refused`);
