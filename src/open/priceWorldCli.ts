// `npm run price-world` (WORLD-ELABORATION-DESIGN.md §4.2a, §9 row P1). Run
// ONCE per scenario revision, at build time, BEFORE any game and with no
// intent in existence anywhere -- this file never imports anything that
// could hand it one. For every `(object, need)` pair `elaborationBands.ts`'s
// `acquirablePairs` names, it asks one `difficulty` question of the target's
// own authored description alone, replays it N=5 times on the spot through
// `replay.ts`'s shared N-times loop (never a second copy of it), and writes
// the result into `elaborationBands.ts` itself: full agreement becomes a
// `model`-sourced priced row with its citation; anything less becomes a
// `review` row for the author to set by hand. See `elaborationBands.ts`'s
// own header for the row shapes and the whole point (the price is read
// before play, so an actor's words can never reach it).
//
// Real runs go through the SAME one-model-at-a-time swapper and resident
// guard as `npm run checkpoint` / `npm run referee-replay` (CLAUDE.md, "Real
// games use one model at a time"): a model loaded that is neither the
// referee nor listed in PRISONER_OLLAMA_RESIDENT_MODELS stops the run, and
// residents found loaded at the start are restored at the end.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadRequest, ReaderQuestion, ReaderSource, ReaderTransport, ReaderResult } from "run-dmcp";
import { OPEN_OBJECTS, findObject, type OpenObjectSpec, type OpenPropertyKey } from "./scenarioObjects.js";
import { replayRequestDetailed } from "./replay.js";
import { createRefereeTransport } from "./refereeTransport.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../ollamaSwap.js";
import { resolveRefereeModel } from "../modelRoles.js";
import { describeRunRevision } from "../runRevision.js";
import {
  DIFFICULTY_BANDS,
  descriptionHash,
  acquirablePairs,
  isAuthorSet,
  ELABORATION_BANDS,
  type ElaborationBandRow,
  type DifficultyBand,
  type BandCitation,
} from "./elaborationBands.js";

/** §4.2a's own N -- "each request is replayed N=5 on the spot". Not
 *  configurable: this is the number the design fixes agreement against, and
 *  a caller wanting a different N is asking a different question. */
const N = 5;

/** The one build-time question, per object per `need` kind (§4.2a's table).
 *  Built exactly the way `referee.ts` builds its own request -- a single
 *  source, `desc:<object>`, the object's own authored text and nothing
 *  else. No `intent` source exists here at all: this function cannot leak
 *  an actor's words into a price because it never receives any. */
export function buildDifficultyRequest(object: OpenObjectSpec, need: OpenPropertyKey): ReadRequest {
  const questions: ReaderQuestion[] = [
    {
      id: "difficulty",
      prompt:
        `From this description alone -- the object's own authored text, and nothing an actor might later say -- if a person with ` +
        `ordinary means set out to wear through this thing's ${need}, how much work is it: trivial (a turn or two), hard (many turns), ` +
        `ruinous (real, and longer than a game), or impossible (something in the material, the fixing, or the position rules it out)? ` +
        "Cite the exact words in the description that support your answer.",
      answerKeys: [...DIFFICULTY_BANDS],
      safeDefault: "impossible",
    },
  ];
  const sources: ReaderSource[] = [{ id: `desc:${object.id}`, text: object.description }];
  return { questions, sources };
}

/** One priced (or unpriced) pair, plus the sidecar entry the checkpoint's
 *  own `.referee.json` shape already uses (`refereeRequestsFor`,
 *  `checkpointTranscript.ts`) -- `label`/`request` alone is what
 *  `replay.ts`'s `replayTranscript` and `refereeReplayCli.ts` read; `replies`
 *  rides along for a human auditing the build run's raw replies, the same
 *  role `RefereeExchangeRecord` plays in a real game's sidecar. */
export interface PricedPair {
  row: ElaborationBandRow;
  label: string;
  request: ReadRequest;
  replies: readonly ReaderResult[];
}

/** Asks, replays and decides ONE `(object, need)` pair. Pure with respect to
 *  the filesystem -- every test in this task exercises this function
 *  directly, with a scripted `transports` list, never touching
 *  `elaborationBands.ts` on disk. */
export async function priceAcquirableFact(
  object: OpenObjectSpec,
  need: OpenPropertyKey,
  transports: readonly ReaderTransport[],
  model: string,
  scenarioRevision: string,
  n: number = N
): Promise<PricedPair> {
  const request = buildDifficultyRequest(object, need);
  const { agreements, replies } = await replayRequestDetailed(request, transports, n);
  const agreement = agreements.find((a) => a.questionId === "difficulty");
  if (!agreement) throw new Error(`price-world: no agreement reported for ${object.id}.${need} -- the reader is misconfigured`);

  const hash = descriptionHash(object.description);
  const label = `price-world: ${object.id}.${need}`;
  const rawAnswers = replies.map((r) => {
    const answer = r.answers.find((a) => a.questionId === "difficulty");
    if (!answer) throw new Error(`price-world: no answer for ${object.id}.${need} -- the reader is misconfigured`);
    return { band: answer.answerKey as DifficultyBand, citation: answer.citation as BandCitation | null };
  });

  // §4.2a: "a key with full agreement (5/5) is written... as data, with its
  // citation." Every replay agreed on the SAME accepted answer key, so any
  // one of them that actually carries a citation is that agreed row's own
  // citation; `null` only when every replay fell to the safe default with
  // nothing to cite at all (legal for `impossible` -- see `BandCitation`'s
  // own doc comment).
  if (agreement.agreementRate === 1) {
    const citation = rawAnswers.find((a) => a.citation !== null)?.citation ?? null;
    const row: ElaborationBandRow = {
      status: "priced",
      bandSource: "model",
      objectId: object.id,
      need,
      band: agreement.mostCommonKey as DifficultyBand,
      citation,
      model,
      scenarioRevision,
      descriptionHash: hash,
    };
    return { row, label, request, replies };
  }

  // §4.2a: "a key below full agreement is written as `review` with all five
  // answers and citations".
  const row: ElaborationBandRow = {
    status: "review",
    objectId: object.id,
    need,
    model,
    scenarioRevision,
    descriptionHash: hash,
    replies: rawAnswers,
  };
  return { row, label, request, replies };
}

/** §4.2a: an author's hand-set row survives a re-run untouched. For every
 *  pair the fresh run priced, an existing `AuthorPricedRow` for that SAME
 *  pair wins outright; `price-world` never overwrites a hand-set price with
 *  a model-read or review one. An author row for a pair the fresh run did
 *  not touch (the object has since grown that property, say) still belongs
 *  in the file, so it is carried forward too. */
export function mergeElaborationBands(existing: readonly ElaborationBandRow[], fresh: readonly ElaborationBandRow[]): ElaborationBandRow[] {
  const merged: ElaborationBandRow[] = fresh.map((row) => {
    const authored = existing.find((e) => e.objectId === row.objectId && e.need === row.need && isAuthorSet(e));
    return authored ?? row;
  });
  for (const row of existing) {
    if (isAuthorSet(row) && !merged.some((m) => m.objectId === row.objectId && m.need === row.need)) merged.push(row);
  }
  return merged;
}

const START_MARKER = "// price-world: generated rows start";
const END_MARKER = "// price-world: generated rows end";

/** Rewrites ONLY the text between `elaborationBands.ts`'s own two marker
 *  comments (see that file's header) to hold `rows`, leaving every other
 *  line -- every type, every function, every comment -- byte for byte
 *  untouched. Each row is serialised with `JSON.stringify`: a JSON object
 *  literal is already legal TypeScript object-literal syntax (every key and
 *  string value double-quoted), so no bespoke pretty-printer is needed and
 *  none of this file's own row types are re-typed here as a second source
 *  of truth. Throws, naming the file, rather than silently doing nothing,
 *  when the markers are not found -- a moved or renamed marker must fail
 *  loudly, not leave `price-world` writing nothing and reporting success. */
export function spliceGeneratedRows(fileText: string, rows: readonly ElaborationBandRow[]): string {
  const startIdx = fileText.indexOf(START_MARKER);
  const endIdx = fileText.indexOf(END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("elaborationBands.ts: missing the price-world marker comments -- refusing to rewrite a file it cannot safely splice");
  }
  const before = fileText.slice(0, startIdx + START_MARKER.length);
  const after = fileText.slice(endIdx);
  const body = rows.map((r) => "  " + JSON.stringify(r) + ",").join("\n");
  return `${before}\n${body}${body.length > 0 ? "\n" : ""}  ${after}`;
}

async function main(): Promise<void> {
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

  const scenarioRevision = describeRunRevision();
  const pairs = acquirablePairs(OPEN_OBJECTS);
  const fresh: ElaborationBandRow[] = [];
  const sidecar: { label: string; request: ReadRequest; replies: readonly ReaderResult[] }[] = [];

  try {
    for (const { objectId, need } of pairs) {
      const object = findObject(objectId);
      if (!object) throw new Error(`price-world: ${objectId} is not a declared object`);
      const priced = await priceAcquirableFact(object, need, [transport], model, scenarioRevision, N);
      fresh.push(priced.row);
      sidecar.push({ label: priced.label, request: priced.request, replies: priced.replies });
      const summary = priced.row.status === "priced" ? priced.row.band : "REVIEW (disagreement)";
      // eslint-disable-next-line no-console
      console.log(`${priced.label}: ${summary}`);
    }
  } finally {
    await swapper.restoreResidents(residentsAtStart);
  }

  const filePath = fileURLToPath(new URL("./elaborationBands.ts", import.meta.url));
  const currentText = readFileSync(filePath, "utf-8");
  const merged = mergeElaborationBands(ELABORATION_BANDS, fresh);
  writeFileSync(filePath, spliceGeneratedRows(currentText, merged));

  const dir = "checkpoints";
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(dir, `${stamp}.price-world.referee.json`), JSON.stringify(sidecar, null, 2) + "\n");

  const needingReview = merged.filter((r) => r.status === "review").length;
  // eslint-disable-next-line no-console
  console.log(`Wrote ${merged.length} row(s) to ${filePath}.`);
  // eslint-disable-next-line no-console
  console.log(`Build run logged to checkpoints/${stamp}.price-world.referee.json (replayable by npm run referee-replay).`);
  if (needingReview > 0) {
    // eslint-disable-next-line no-console
    console.log(`${needingReview} row(s) need the author's review before a game may start (elaborationBandProblems / assertElaborationBandsReady).`);
  }
}

// Run only when this file is the actual entry point (`tsx
// src/open/priceWorldCli.ts`), never when a test imports the testable
// functions above -- the same discipline that keeps every other CLI's
// logic (`replay.ts`, `refereeTransport.ts`) importable without a network
// call firing as a side effect of `import`.
if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
