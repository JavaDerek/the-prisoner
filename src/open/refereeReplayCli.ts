// `npm run referee-replay -- <transcript> [N]` (this task's brief). Reads a
// JSON file of recorded referee requests -- `{label: string, request:
// ReadRequest}[]`, exactly what `referee.ts`'s `RefereeRuling.request`
// carries per ruling, one entry per intent a real open-mode game recorded
// -- and re-asks each request `N` times (default 5) against the real
// referee transport, reporting per-key agreement (OPEN-VARIANT.md §5.2).
//
// Real runs go through the same one-model-at-a-time swapper and resident
// guard as `npm run checkpoint` (CLAUDE.md, "Real games use one model at a
// time"): a model loaded that is neither the referee nor listed in
// PRISONER_OLLAMA_RESIDENT_MODELS stops the replay, and residents found
// loaded at the start are restored at the end.
import { readFileSync } from "node:fs";
import type { ReadRequest } from "run-dmcp";
import { replayTranscript, renderReplayReport } from "./replay.js";
import { createRefereeTransport } from "./refereeTransport.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../ollamaSwap.js";
import { resolveRefereeModel } from "../modelRoles.js";

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
  const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
  const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS ?? process.env.PRISONER_THINK_TIMEOUT_MS;
  const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  const allowedModels = [...new Set([model, ...residents])];
  const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels });

  const ps = await swapper.fetchPs();
  assertNoForeignModel(ps, allowedModels);
  const residentsAtStart = ps.models.map((m) => m.name).filter((name) => residents.includes(name));

  const transport = createRefereeTransport({
    baseUrl,
    model,
    timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
    ensureLoaded: (m) => swapper.withModel(m, async () => {}),
  });

  try {
    const replayed = await replayTranscript(entries, [transport], n);
    for (const line of renderReplayReport(replayed)) {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  } finally {
    await swapper.restoreResidents(residentsAtStart);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
