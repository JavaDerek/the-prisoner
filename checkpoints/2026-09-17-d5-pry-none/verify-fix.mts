// §37 controls: every recorded raw referee reply read through the transport before the fix and after,
// through the engine's turn reader. Any difference is printed; the fix must change only replies that did
// not parse. Replies: §33.16's 78 (qwen3:14b, 26 intents x 3) and this morning's 3 on the pry wording.
import { readFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport as after } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
import { createRefereeTransport as before } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.head.tmp.ts";
const S16 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16";
const D5 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-17-d5-pry-none";
const sets = [
  { log: JSON.parse(readFileSync(`${S16}/qwen3-raw-replies-N3.json`, "utf-8")), reqs: JSON.parse(readFileSync(`${S16}/requests-26-intents.json`, "utf-8")) },
  { log: JSON.parse(readFileSync(`${D5}/capture-pry.json`, "utf-8")), reqs: JSON.parse(readFileSync(`${D5}/req-base.json`, "utf-8")) },
];
async function read(make: typeof after, req: any, content: string) {
  const fetchFn = (async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })) as typeof fetch;
  const result = await createTurnReader({ questions: req.questions, transports: [make({ baseUrl: "http://x", model: "m", fetchFn })] }).read(req.sources);
  return result.answers.map((a: any) => `${a.questionId}=${a.answerKey}${a.citation ? "" : "?"}`).join(" ");
}
let changed = 0, total = 0;
for (const { log, reqs } of sets) {
  for (const x of log) {
    total++;
    const req = reqs.find((r: any) => r.label === x.label).request;
    const b = await read(before, req, x.content), a = await read(after, req, x.content);
    if (a !== b) { changed++; console.log(`${x.label} #${x.i + 1}\n  before: ${b}\n  after:  ${a}`); }
  }
}
console.log(`${changed} of ${total} recorded replies read differently`);
