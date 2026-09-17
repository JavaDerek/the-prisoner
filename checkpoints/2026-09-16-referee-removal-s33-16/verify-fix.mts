import { readFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
const S = process.argv[2];
const log = JSON.parse(readFileSync(`${S}/capture-q3.json`, "utf-8"));
const reqs = JSON.parse(readFileSync(`${S}/req-base.json`, "utf-8"));
let changed = 0;
for (const x of log) {
  const req = reqs.find((r: any) => r.label === x.label).request;
  const fetchFn = (async () => new Response(JSON.stringify({ choices: [{ message: { content: x.content } }] }), { status: 200 })) as typeof fetch;
  const t = createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn });
  const result = await createTurnReader({ questions: req.questions, transports: [t] }).read(req.sources);
  const now = result.answers.map((a: any) => `${a.questionId}=${a.answerKey}${a.citation ? "" : "?"}`).join(" ");
  const before = x.answers.map((a: any) => `${a.questionId}=${a.answerKey}${a.citation ? "" : "?"}`).join(" ");
  if (now !== before) { changed++; console.log(`${x.label} #${x.i + 1}\n  before: ${before}\n  now:    ${now}`); }
}
console.log(`${changed} of ${log.length} recorded replies read differently`);
