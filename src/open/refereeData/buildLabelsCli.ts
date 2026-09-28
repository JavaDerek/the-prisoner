// `npm run build-referee-labels` (the-prisoner#10): regenerates
// `data/referee/labels.jsonl` from this module's two seed corpora
// (`seedS3316.ts`, `seedD11.ts`). Deterministic and offline -- no model
// call, no database -- so running it twice with no code change produces a
// byte-identical file; a diff after running it is a real content change,
// never noise.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildS3316Labels } from "./seedS3316.js";
import { buildD11Labels, type D11Corpus } from "./seedD11.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const OUT_PATH = join(REPO_ROOT, "data", "referee", "labels.jsonl");
const D11_CORPUS_PATH = join(REPO_ROOT, "checkpoints", "2026-09-26-human-intents", "corpus.json");

function main(): void {
  const s3316 = buildS3316Labels();
  const corpus = JSON.parse(readFileSync(D11_CORPUS_PATH, "utf-8")) as D11Corpus;
  const d11 = buildD11Labels(corpus);
  const labels = [...s3316, ...d11];
  writeFileSync(OUT_PATH, labels.map((l) => JSON.stringify(l)).join("\n") + "\n");
  // eslint-disable-next-line no-console
  console.log(`wrote ${labels.length} labels (${s3316.length} s33.16 + ${d11.length} D11) to ${OUT_PATH}`);
}

main();
