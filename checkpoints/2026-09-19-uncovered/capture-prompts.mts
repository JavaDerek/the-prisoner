// Captures the BYTE-EXACT prompt V0 sent for every request in V-K.json and
// V-Q.json, by running the real referee transport with an intercepting
// fetchFn (the prompt-lab pattern: no model is called, nothing is loaded),
// and pairs each prompt with what the run actually got back (the five parsed
// replies from results-<form>-*.json). Writes one file for the lab page:
//   ~/prisoner-prompt-lab/uncovered-prompts.json
// usage: npx tsx checkpoints/2026-09-19-uncovered/capture-prompts.mts
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import type { ReadRequest } from "run-dmcp";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";

const HERE = new URL(".", import.meta.url).pathname;
type Row = { label: string; kind: string; site: string; source: string; request: ReadRequest };

const out: Record<string, unknown[]> = {};
for (const form of ["K", "Q"] as const) {
  const rows = JSON.parse(readFileSync(`${HERE}V-${form}.json`, "utf-8")) as Row[];
  const resultsFile = readdirSync(HERE).filter((f) => f.startsWith(`results-${form}-`)).sort().at(-1);
  const results = resultsFile ? (JSON.parse(readFileSync(`${HERE}${resultsFile}`, "utf-8")) as { results: { label: string; replies: unknown[]; siteQuestion: string; perQuestion: unknown }[] }).results : [];
  const siteQuestion = form === "K" ? { effect: "effect", product: "product" } : { effect: "coverage", product: "product_coverage" };

  const captured: unknown[] = [];
  for (const row of rows) {
    let prompt = "";
    const transport = createRefereeTransport({
      baseUrl: "http://capture.invalid/v1",
      model: "capture",
      fetchFn: (async (_url: unknown, init: { body: string }) => {
        prompt = (JSON.parse(init.body) as { messages: { content: string }[] }).messages[0].content;
        throw new Error("captured, not sent");
      }) as unknown as typeof fetch,
    });
    await transport(row.request);
    if (!prompt) throw new Error(`no prompt captured for ${row.label}`);
    const got = results.find((r) => r.label === row.label);
    captured.push({
      label: row.label, kind: row.kind, site: row.site, siteQuestion: siteQuestion[row.site as "effect" | "product"],
      source: row.source, prompt, sources: row.request.sources, questions: row.request.questions.map((q) => ({ id: q.id, answerKeys: q.answerKeys })),
      v0: got ? { replies: got.replies, perQuestion: got.perQuestion, resultsFile } : null,
    });
  }
  out[form] = captured;
}
const target = `${homedir()}/prisoner-prompt-lab/uncovered-prompts.json`;
writeFileSync(target, JSON.stringify(out, null, 1));
console.log(`wrote ${target}: K ${out.K.length}, Q ${out.Q.length}`);
