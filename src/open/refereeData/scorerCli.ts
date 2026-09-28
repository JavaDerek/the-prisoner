// `npm run score-referee -- <labels.jsonl> [--dry-run]` (the-prisoner#10):
// rules every `test`-split label in <labels.jsonl> through a real referee
// against an OpenAI-compatible endpoint and reports X of N per question,
// with every disagreement listed. Reuses `refereeTransport.ts`'s real
// transport and `ollamaSwap.ts`'s one-model-at-a-time swapper, exactly the
// way `refereeReplayCli.ts` does, so a live run here goes through the same
// GPU-safety machinery every other real run in this repository does.
//
//   PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_MODEL=qwen3:14b \
//     npm run score-referee -- data/referee/labels.jsonl
//
// `--dry-run` builds every request and sends nothing (no lock, no swapper,
// no network) -- see `scorer.ts`'s own `scoreLabels`. Live mode takes
// `/tmp/the-prisoner-one-driver.lock` (CLAUDE.md "One driver at a time")
// and refuses if another driver holds it.
process.env.DMCP_DB_PATH = process.env.DMCP_DB_PATH ?? ":memory:";

import { readFileSync } from "node:fs";
import { scoreLabels, renderScoreReport } from "./scorer.js";
import { takeDriverLock } from "./lock.js";
import { createRefereeTransport } from "../refereeTransport.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../ollamaSwap.js";
import { resolveRefereeModel } from "../../modelRoles.js";
import type { RefereeLabel } from "./types.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const labelsPath = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  if (!labelsPath) {
    console.error("usage: score-referee <labels.jsonl> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const labels: RefereeLabel[] = readFileSync(labelsPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RefereeLabel);

  if (dryRun) {
    const report = await scoreLabels(labels);
    // eslint-disable-next-line no-console
    for (const line of renderScoreReport(report)) console.log(line);
    return;
  }

  const release = takeDriverLock("score-referee");
  try {
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
      const report = await scoreLabels(labels, { transport });
      // eslint-disable-next-line no-console
      for (const line of renderScoreReport(report)) console.log(line);
    } finally {
      await swapper.restoreResidents(residentsAtStart);
    }
  } finally {
    release();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
