// All intents x N through the real referee transport + turn reader, keeping every raw reply,
// flagging rulings where a question fell back to its safe default with no citation.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";
const [, , S, model, nArg, tag] = process.argv; const N = Number(nArg);
const entries = JSON.parse(readFileSync(`${S}/req-base.json`, "utf-8"));
const log: any[] = []; const progress = `${S}/capture-${tag}.log`;
for (const entry of entries) {
  for (let i = 0; i < N; i++) {
    let raw: any = null, status = 0, err: any = null; const t0 = Date.now();
    const fetchFn = (async (url: any, init: any) => {
      try { const r = await fetch(url, init); status = r.status; raw = await r.text(); return new Response(raw, { status: r.status }); }
      catch (e) { err = String(e); throw e; }
    }) as typeof fetch;
    const t = createRefereeTransport({ baseUrl: "http://doris:11434/v1", model, timeoutMs: 180000, fetchFn });
    let offered: any = null;
    const reader = createTurnReader({ questions: entry.request.questions, transports: [async (req: any) => (offered = await t(req))] });
    const result = await reader.read(entry.request.sources);
    let content = null; try { content = JSON.parse(raw).choices?.[0]?.message?.content; } catch {}
    const uncited = result.answers.filter((a: any) => !a.citation).map((a: any) => a.questionId);
    const effect = result.answers.find((a: any) => a.questionId === "effect")?.answerKey;
    const line = `${entry.label} #${i + 1}: effect=${effect} ${((Date.now() - t0) / 1000).toFixed(1)}s http=${status} err=${err} offered=${offered?.length} uncited=[${uncited.join(",")}]`;
    appendFileSync(progress, line + "\n");
    log.push({ label: entry.label, i, status, err, content, offered, answers: result.answers, uncited });
    writeFileSync(`${S}/capture-${tag}.json`, JSON.stringify(log, null, 1));
  }
}
appendFileSync(progress, "done\n");
await fetch("http://doris:11434/api/generate", { method: "POST", body: JSON.stringify({ model, keep_alive: 0 }) });
