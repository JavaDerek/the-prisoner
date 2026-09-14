// `npm run referee-replay -- <transcript> [N]` (this task's brief). Reads a
// JSON file of recorded referee requests -- `{label: string, request:
// ReadRequest}[]`, exactly what `referee.ts`'s `RefereeRuling.request`
// carries per ruling, one entry per intent a real open-mode game recorded
// -- and re-asks each request `N` times (default 5) against the real
// referee transport, reporting per-key agreement (OPEN-VARIANT.md §5.2).
//
// NEVER RUN AGAINST doris IN THIS TASK (the brief's own hard stop) -- this
// script is complete and exercised by `replay.test.ts` with a scripted
// transport; nobody has invoked it against a real model as part of this
// work.
import { readFileSync } from "node:fs";
import type { ReadRequest } from "run-dmcp";
import { replayTranscript, renderReplayReport } from "./replay.js";
import { createRefereeTransport } from "./refereeTransport.js";

async function main(): Promise<void> {
  const [, , transcriptPath, nArg] = process.argv;
  if (!transcriptPath) {
    console.error("usage: referee-replay <transcript.json> [N]");
    process.exitCode = 1;
    return;
  }
  const n = nArg ? Number(nArg) : 5;

  const raw = readFileSync(transcriptPath, "utf-8");
  const entries = JSON.parse(raw) as { label: string; request: ReadRequest }[];

  const baseUrl = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
  const model = process.env.PRISONER_REFEREE_MODEL ?? "qwen2.5:14b";
  const transport = createRefereeTransport({ baseUrl, model });

  const replayed = await replayTranscript(entries, [transport], n);
  for (const line of renderReplayReport(replayed)) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
