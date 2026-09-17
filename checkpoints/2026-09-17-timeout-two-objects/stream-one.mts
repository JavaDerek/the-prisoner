// §39: the exact request the referee transport sends for one recorded ruling, sent with stream: true so
// what the model writes before a timeout can be seen. Writes <tag>-stream.txt (every chunk, with seconds
// since the start) and <tag>-summary.json. Caps at CAP_S seconds.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
const [, , dir, tag, capArg] = process.argv;
const CAP_S = Number(capArg ?? 600);
const entry = JSON.parse(readFileSync(`${dir}/req-base.json`, "utf-8"))[0];
const out = `${dir}/${tag}-stream.txt`;
writeFileSync(out, "");
let text = "";
const t0 = Date.now();
const fetchFn = (async (url: string, init: any) => {
  const body = JSON.parse(init.body);
  body.stream = true;
  writeFileSync(`${dir}/${tag}-request-body.json`, JSON.stringify(body, null, 1));
  const r = await fetch(url, { method: "POST", headers: init.headers, body: JSON.stringify(body), signal: AbortSignal.timeout(CAP_S * 1000) });
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value).split("\n")) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta ?? {};
        const piece = (delta.reasoning ?? delta.reasoning_content ?? "") + (delta.content ?? "");
        text += piece;
        appendFileSync(out, `[${((Date.now() - t0) / 1000).toFixed(1)}] ${JSON.stringify(piece)}\n`);
      }
    }
  } catch (e) { appendFileSync(out, `ERROR ${e}\n`); }
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
}) as typeof fetch;
const t = createRefereeTransport({ baseUrl: "http://doris:11434/v1", model: "qwen3:14b", timeoutMs: (CAP_S + 30) * 1000, fetchFn });
const answers = await t(entry.request);
writeFileSync(`${dir}/${tag}-summary.json`, JSON.stringify({ label: entry.label, seconds: (Date.now() - t0) / 1000, chars: text.length, answers, tail: text.slice(-2000) }, null, 1));
await fetch("http://doris:11434/api/generate", { method: "POST", body: JSON.stringify({ model: "qwen3:14b", keep_alive: 0 }) });
console.log("done", (Date.now() - t0) / 1000, "s", text.length, "chars");
