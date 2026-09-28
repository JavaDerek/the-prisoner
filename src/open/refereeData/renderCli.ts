// `npm run render-referee-data -- <labels.jsonl> <out.jsonl>` (the-prisoner#10):
// renders every `train`-split label in <labels.jsonl> into LoRA-trainer
// chat-messages JSONL (`{"messages": [...]}` per line, the Unsloth-style
// format the issue names). Writes a second, aligned sidecar
// `<out>.meta.jsonl` carrying each row's label id, which "part" it is
// (`main`/`acts`) and its prompt hash -- kept OUT of the primary file so a
// trainer that reads it literally never sees an unexpected key.
//
// `test`-split labels are never rendered (see `render.ts`'s own
// `renderTrainingExamples`); this CLI reports how many were refused so a
// caller can see the filter did something.
//
// Touches no database and calls no model: replaying a `replay`-scene label
// needs run-dmcp's schema, so `DMCP_DB_PATH` is set here, defensively,
// before any such label is resolved (root CLAUDE.md hard rule 2 -- never a
// default path; `:memory:` unless the caller already set one).
process.env.DMCP_DB_PATH = process.env.DMCP_DB_PATH ?? ":memory:";

import { readFileSync, writeFileSync } from "node:fs";
import { renderTrainingExamples } from "./render.js";
import type { RefereeLabel } from "./types.js";

async function main(): Promise<void> {
  const [, , labelsPath, outPath] = process.argv;
  if (!labelsPath || !outPath) {
    console.error("usage: render-referee-data <labels.jsonl> <out.jsonl>");
    process.exitCode = 1;
    return;
  }
  const labels: RefereeLabel[] = readFileSync(labelsPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as RefereeLabel);

  const { examples, refusedTestCount } = await renderTrainingExamples(labels);

  writeFileSync(outPath, examples.map((e) => JSON.stringify({ messages: e.messages })).join("\n") + (examples.length > 0 ? "\n" : ""));
  const metaPath = outPath.replace(/\.jsonl$/, "") + ".meta.jsonl";
  writeFileSync(metaPath, examples.map((e) => JSON.stringify({ labelId: e.labelId, part: e.part, promptHash: e.promptHash, questionIds: e.questionIds })).join("\n") + (examples.length > 0 ? "\n" : ""));

  // eslint-disable-next-line no-console
  console.log(`rendered ${examples.length} example(s) from ${labels.length} label(s) -> ${outPath} (+ ${metaPath}). Refused ${refusedTestCount} test-split label(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
