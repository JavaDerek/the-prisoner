// §39: target/effect per intent, today's prompt (§33.16's recorded qwen3 replies re-read through today's
// transport, plus this morning's base runs for the two two-act intents) against the "first" sentence.
import { readFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
const S16 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16";
const D = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-timeout-two-objects";
async function reread(log: any[], reqs: any[]) {
  const by: Record<string, string[]> = {};
  for (const x of log) {
    const req = reqs.find((r: any) => r.label === x.label).request;
    const intent = req.sources.find((s: any) => s.id === "intent").text;
    const fetchFn = (async () => new Response(JSON.stringify({ choices: [{ message: { content: x.content ?? "" } }] }), { status: 200 })) as typeof fetch;
    const r = await createTurnReader({ questions: req.questions, transports: [createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn })] }).read(req.sources);
    const g = (id: string) => r.answers.find((a: any) => a.questionId === id)?.answerKey;
    (by[intent] ??= []).push(x.content == null ? "TIMEOUT" : `${g("target")}/${g("effect")}`);
  }
  return by;
}
const base = {
  ...(await reread(JSON.parse(readFileSync(`${S16}/qwen3-raw-replies-N3.json`, "utf-8")), JSON.parse(readFileSync(`${S16}/requests-26-intents.json`, "utf-8")))),
  ...(await reread(JSON.parse(readFileSync(`${D}/base/capture-base.json`, "utf-8")), JSON.parse(readFileSync(`${D}/base/req-base.json`, "utf-8")))),
};
const first = await reread(JSON.parse(readFileSync(`${D}/first/capture-first.json`, "utf-8")), JSON.parse(readFileSync(`${D}/first/req-base.json`, "utf-8")));
let changed = 0;
for (const intent of Object.keys(first)) {
  const b = (base[intent] ?? []).join(", "), f = first[intent].join(", ");
  const mark = b === f ? "  " : "**";
  if (b !== f) changed++;
  console.log(`${mark} ${intent}\n     today: ${b}\n     first: ${f}`);
}
console.log(`${changed} of ${Object.keys(first).length} intents read differently`);
