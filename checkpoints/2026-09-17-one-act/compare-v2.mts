// §40: acts / target / effect per intent with the acts question, against today's prompt (§33.16's
// recorded replies and §39's base runs, re-read through today's transport).
import { readFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
const S16 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16";
const T39 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-timeout-two-objects";
const D = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-one-act";
async function reread(log: any[], reqs: any[]) {
  const by: Record<string, string[]> = {};
  for (const x of log) {
    const req = reqs.find((r: any) => r.label === x.label).request;
    const intent = req.sources.find((s: any) => s.id === "intent").text;
    const fetchFn = (async () => new Response(JSON.stringify({ choices: [{ message: { content: x.content ?? "" } }] }), { status: 200 })) as typeof fetch;
    const r = await createTurnReader({ questions: req.questions, transports: [createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn })] }).read(req.sources);
    const g = (id: string) => { const a = r.answers.find((a: any) => a.questionId === id); return a ? `${a.answerKey}${a.citation ? "" : "?"}` : "-"; };
    (by[intent] ??= []).push(x.content == null ? "TIMEOUT" : `${req.questions[0].id === "acts" ? g("acts") + " " : ""}${g("target")}/${g("effect")}`);
  }
  return by;
}
const base = {
  ...(await reread(JSON.parse(readFileSync(`${S16}/qwen3-raw-replies-N3.json`, "utf-8")), JSON.parse(readFileSync(`${S16}/requests-26-intents.json`, "utf-8")))),
  ...(await reread(JSON.parse(readFileSync(`${T39}/base/capture-base.json`, "utf-8")), JSON.parse(readFileSync(`${T39}/base/req-base.json`, "utf-8")))),
};
const acts = await reread(JSON.parse(readFileSync(`${D}/acts-v2/capture-acts-v2.json`, "utf-8")), JSON.parse(readFileSync(`${D}/acts-v2/req-base.json`, "utf-8")));
for (const intent of Object.keys(acts)) console.log(`${intent}\n     today: ${(base[intent] ?? ["(not run)"]).join(", ")}\n     acts:  ${acts[intent].join(", ")}`);
