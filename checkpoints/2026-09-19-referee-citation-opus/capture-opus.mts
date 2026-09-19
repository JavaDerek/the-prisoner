// Is the referee's citation apparatus load-bearing at the Opus rung?
//
// §33.16 built the closed-key + verbatim-citation apparatus because a 14B
// invents keys and cites text that is not in the source. run-dmcp's turn
// reader DISCARDS an uncited answer and falls back to that question's safe
// default. So the apparatus has a cost (a discarded answer becomes a default)
// and a benefit (a fabricated answer never lands), and which dominates is a
// property of the model, not of the design.
//
// One run answers it, because every discard is observable:
//   - uncited == 0 everywhere        -> costs nothing, protects nothing here
//   - uncited answers were CORRECT   -> the apparatus is losing right answers
//   - uncited answers were WRONG     -> it is still earning its keep
//
// Corpus: §33.16's own 26 controls, expected key encoded in each label, so
// this is directly comparable to qwen2.5's eight-version sweep and
// qwen3:14b's 24/26 on the identical intents.
//
// ONE ASYMMETRY, RECORDED NOT HIDDEN: the referee transport sends
// temperature 0 (OPEN-VARIANT.md §3.5, deliberately not caller-configurable).
// The Claude CLI has no temperature flag, so at this rung the referee runs at
// the model's default sampling. §3.5's determinism does NOT hold here, and
// any agreement number from this run must not be compared with a doris one.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createTurnReader } from "/Users/derekferguson/rpg/the-prisoner/node_modules/run-dmcp/dist/index.js";
import { createRefereeTransport } from "/Users/derekferguson/rpg/the-prisoner/src/open/refereeTransport.ts";

const HERE = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-19-referee-citation-opus";
const CORPUS =
  "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16/requests-26-intents.json";

const [, , modelArg, nArg, tagArg] = process.argv;
const model = modelArg ?? "opus";
const N = Number(nArg ?? 3);
// A filename tag, so two runs of the SAME model under different conditions do
// not overwrite each other. Never fold a condition into the model name -- it
// is sent to the server verbatim and a made-up name 404s every call.
const tag = tagArg ? `${model}-${tagArg}` : model;
const BASE = process.env.PRISONER_MODEL_URL ?? "http://localhost:8799/v1";

const entries = JSON.parse(readFileSync(CORPUS, "utf-8")) as { label: string; request: any }[];
const progress = `${HERE}/capture-${tag}-N${N}.log`;
const log: any[] = [];

appendFileSync(progress, `# ${entries.length} intents x N=${N} on ${model} via ${BASE}\n`);
appendFileSync(progress, `# temperature 0 is NOT in force at this rung (CLI has no flag)\n`);

for (const entry of entries) {
  // The expected key is in the label: "[expect open] Remove the bar".
  const expected = /\[expect (\w+)\]/.exec(entry.label)?.[1] ?? "?";
  for (let i = 0; i < N; i++) {
    let raw: any = null, status = 0, err: any = null;
    const t0 = Date.now();
    const fetchFn = (async (url: any, init: any) => {
      try {
        const r = await fetch(url, init);
        status = r.status;
        raw = await r.text();
        return new Response(raw, { status: r.status });
      } catch (e) { err = String(e); throw e; }
    }) as typeof fetch;

    const t = createRefereeTransport({ baseUrl: BASE, model, timeoutMs: 600000, fetchFn });
    let offered: any = null;
    const reader = createTurnReader({
      questions: entry.request.questions,
      transports: [async (req: any) => (offered = await t(req))],
    });

    let result: any = null;
    try { result = await reader.read(entry.request.sources); }
    catch (e) { err = `${err ?? ""} read:${String(e)}`; }

    let content: any = null;
    try { content = JSON.parse(raw).choices?.[0]?.message?.content; } catch {}

    const answers = result?.answers ?? [];
    const uncited = answers.filter((a: any) => !a.citation).map((a: any) => a.questionId);
    const effect = answers.find((a: any) => a.questionId === "effect")?.answerKey;

    // What the model ACTUALLY said for `effect` before the citation check ran.
    // This is the whole point: if it was discarded, was it right?
    let offeredEffect: any = null;
    try {
      const o = (offered ?? []).find((a: any) => a.questionId === "effect");
      offeredEffect = o ? { key: o.answerKey, citation: o.citation ?? null } : null;
    } catch {}

    const line =
      `${entry.label} #${i + 1}: expected=${expected} final=${effect} ` +
      `offered=${offeredEffect?.key ?? "-"} cited=${offeredEffect?.citation ? "y" : "n"} ` +
      `${((Date.now() - t0) / 1000).toFixed(1)}s http=${status} uncited=[${uncited.join(",")}]` +
      (err ? ` err=${err}` : "");
    appendFileSync(progress, line + "\n");
    log.push({ label: entry.label, expected, i, status, err, content, offered, offeredEffect, answers, uncited, finalEffect: effect });
    writeFileSync(`${HERE}/capture-${tag}-N${N}.json`, JSON.stringify(log, null, 1));
  }
}
appendFileSync(progress, "done\n");
