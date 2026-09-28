// P-DE -- draft-then-extract vs one-pass, for the referee's six-question closed-key call (the-prisoner#9 SS1;
// docs/OSS-AND-DCCD-VERDICTS.md "DCCD"). Scaffolding, 2026-09-28, NOT RUN.
//
// #9 SS1 could not verify the branded "Draft-Conditioned Constrained Decoding"/"KL-Projection Tax" claim (see the
// verdicts doc), but the underlying idea it rests on is real: Tam et al. 2024, "Let Me Speak Freely? A Study on the
// Impact of Format Restrictions on Performance of Large Language Models" (arXiv:2408.02442), found that forcing a
// model straight into a structured answer measurably hurts reasoning-heavy tasks on smaller models, and that the
// ordinary mitigation is to let the model reason in free text FIRST and make a second, constrained call that
// extracts the structure from its own draft. This probe measures that mitigation against this repository's own
// referee, on the D11 corpus (`checkpoints/2026-09-26-human-intents/corpus.json`, 95 rows, pre-registered
// `expectedKeys`/`expectedLabelPostD5D9`), the same corpus #9 SS1 names.
//
// TWO ARMS, per rebuilt row (`../2026-09-28-probe-kit/kit.mts`, so nothing here duplicates a harness --
// `prisoner-measurement-fidelity`):
//   `one-pass`      -- the referee exactly as the game calls it: one call, closed answer keys, verbatim citations.
//   `draft-extract` -- an UNCONSTRAINED call first (no answer-key list, no citation format, just "reason in prose
//                      about these questions over these sources"), then the ORDINARY constrained call with that
//                      prose added as one more citable source (`id: "draft"`). Implemented ENTIRELY as a transport
//                      wrapper (`draftExtract`, below) -- exactly `checkpoints/2026-09-28-request-order/probe.mts`'s
//                      `intentLast` shape -- so no `src/` file changes and the game's shipped referee is untouched;
//                      this is a probe-only arm, not a new `PRISONER_*` switch.
//
// Both arms run with `oneAct: "off"` (a deliberate override of today's shipped default, `"first"`, matching
// `checkpoints/2026-09-26-human-intents/probe.mts`'s and `checkpoints/2026-09-26-arms/probe.mts`'s own precedent):
// the one-act reading is its own single-question call over the intent alone (`readOneAct`, `src/open/referee.ts`),
// orthogonal to what #9 SS1 asks about (the six-question closed-key call) and already measured on its own terms by
// P1 (`checkpoints/2026-09-28-first-act/`). Wrapping it too would add an unrelated extra draft call per row and
// muddy what this probe is isolating. A combined draft-extract-under-oneAct=first measurement is a follow-on this
// probe does not attempt.
//
// `--dry-run` builds every request, including the draft call's own prompt bytes, WITHOUT sending anything --
// `forbidNetwork()` (kit.mts) replaces `fetch` with a function that throws, and `draftText` below checks the same
// `--dry-run` flag itself and returns a labelled placeholder instead of calling `fetch`, so a dry run can never
// reach the network even though the draft call is not part of the `ReaderTransport` ladder `forbidNetwork` guards
// automatically.
//
//   npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --live
//   npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMain, REPO, D11_CORPUS, runRefereeProbe, corpusItems, renderScoreboard, type Item, type Prediction } from "../2026-09-28-probe-kit/kit.mts";
import { resolveRefereeModel } from "../../src/modelRoles.js";
import { reasoningFields } from "../../src/open/thinking.js";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 1;

// Read once, not per row: whether this process was invoked with --dry-run decides whether `draftText` may touch
// the network at all (see the header). Checked directly on argv, the same way every other 2026-09-28 probe reads
// its own mode before `runRefereeProbe` parses it a second time internally.
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------------------------------------------
// The D11 corpus, all 95 rows, carrying `expectedKeys`/`expectedLabelPostD5D9` onto each Item.

const CORPUS_IDS: string[] = JSON.parse(readFileSync(join(REPO, D11_CORPUS), "utf8")).rows.map((r: any) => r.id);
if (CORPUS_IDS.length !== 95) throw new Error(`P-DE: expected the D11 corpus's 95 rows, found ${CORPUS_IDS.length} -- has corpus.json changed?`);

export const ITEMS: Item[] = corpusItems(CORPUS_IDS, (row) => ({
  expectedKeys: row.expectedKeys as Record<string, string> | null,
  expectedLabel: row.expectedLabelPostD5D9 as string,
}));

// ---------------------------------------------------------------------------------------------------------------
// The draft-extract arm.

/** The SAME sources and questions the real six-question call would see (`src/open/refereeTransport.ts`'s own
 *  `buildPrompt`), asked in prose instead of JSON: no answer-key list to pick from, no citation format, and an
 *  explicit instruction not to give a final verdict yet. This is the "unconstrained" half of Tam et al.'s
 *  mitigation -- a plain reasoning pass the ordinary constrained call (below) then reads as one more source. */
function buildDraftPrompt(request: { questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[]; sources: readonly { id: string; text: string }[] }): string {
  const sourceBlocks = request.sources.flatMap((s) => [`source "${s.id}":`, s.text, ""]);
  const questionLines = request.questions.map((q) => `- ${q.id}: ${q.prompt}`);
  return [
    "You are reasoning about one attempted action in a physical scene, as a referee -- not a character.",
    "Think step by step, in plain prose, about each question below, quoting the exact source text that supports",
    "your reasoning as you go. Do NOT answer in JSON, do NOT pick a final answer key, and do NOT give a verdict --",
    "a separate step will ask you for the closed answer afterward. Just reason.",
    "",
    "SOURCES (the only text you may cite):",
    "",
    ...sourceBlocks,
    "QUESTIONS TO REASON ABOUT (not yet to answer):",
    ...questionLines,
  ].join("\n");
}

let draftCallsMade = 0;
/** The draft call itself: a raw, unconstrained request to the SAME referee model, at the SAME temperature (0) and
 *  thinking mode (off, CLAUDE.md "thinking is OFF everywhere") the real transport uses -- built here, not in
 *  `src/`, because this arm is probe-only (CLAUDE.md: a `src/` change would need its own default-off arm; this
 *  needs none, since it is a transport wrapper). `--dry-run` never calls it: it returns a labelled placeholder so
 *  the augmented request's SHAPE (a `draft` source exists, in the right place) is still visible without a byte of
 *  network traffic, matching this file's header. */
async function draftText(request: Parameters<typeof buildDraftPrompt>[0]): Promise<string> {
  draftCallsMade += 1;
  if (DRY_RUN) return "(dry run: draft call not made -- network forbidden, see this file's header)";
  const baseUrl = process.env.PRISONER_MODEL_URL;
  if (!baseUrl) throw new Error("P-DE --live needs PRISONER_MODEL_URL set (the referee's own endpoint)");
  const model = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
  const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS ? Number(process.env.PRISONER_REFEREE_TIMEOUT_MS) : 300_000;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      stream: false,
      tools: [],
      messages: [{ role: "user", content: buildDraftPrompt(request) }],
      ...reasoningFields("none"),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return `(draft call failed: HTTP ${response.status})`;
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? "(draft call returned no content)";
}

/** The draft-extract wrapper: makes the unconstrained draft call, then hands the ORDINARY constrained request --
 *  with the draft added as one more source, nothing else touched -- to the real transport. Every existing
 *  citation still verifies against its original source exactly as before; the draft is simply one more thing the
 *  referee model may (or may not) choose to cite. */
export function draftExtract(transport: any): any {
  const wrapped = async (request: any) => {
    const draft = await draftText(request);
    const augmented = { ...request, sources: [...request.sources, { id: "draft", text: draft }] };
    return transport(augmented);
  };
  (wrapped as any).lastExchange = () => transport.lastExchange?.();
  return wrapped;
}

// ---------------------------------------------------------------------------------------------------------------
// Scoring: matches expectedKeys with D11's own "-or-" alternate reading (`corpus.json`'s "wear-or-derive" style,
// scored as a match against either alternative -- literally what `human-intents/RESULTS.md` did by hand).

const KEYS = ["target", "effect", "property"] as const;

function matchesExpected(ruling: any, expected: Record<string, string> | null): boolean | null {
  if (!expected) return null; // no pre-registered expectation (I25-3/I25-5): not scored either way here.
  if (!ruling || ruling.error) return false;
  for (const k of KEYS) {
    const want = expected[k];
    if (want === undefined) continue;
    if (!want.split("-or-").includes(String(ruling[k]))) return false;
  }
  return true;
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}

export function score(rows: any[], items: Item[]): string[] {
  const ok = rows.filter((r) => !r.error);
  const of = (arm: string, id: string) => ok.find((r) => r.arm === arm && r.item === id);
  // Only rows with a pre-registered `expectedKeys` (88 of 95) are scored for improvement/regression; the other 7
  // (I25-3, I25-5, and five more `expectedKeys: null` rows -- see corpus.json) are reported separately, unscored.
  const scorable = items.filter((i) => (i as any).expectedKeys !== null);
  const paired = scorable.filter((i) => of("one-pass", i.id) && of("draft-extract", i.id));
  const matches = (arm: string, i: Item) => matchesExpected(of(arm, i.id), (i as any).expectedKeys) === true;
  const improved = paired.filter((i) => !matches("one-pass", i) && matches("draft-extract", i));
  const regressed = paired.filter((i) => matches("one-pass", i) && !matches("draft-extract", i));
  const done = paired.length === scorable.length;

  const secsOf = (arm: string) => ok.filter((r) => r.arm === arm).map((r) => r.secs as number).filter((x) => typeof x === "number");
  const onePassSecs = secsOf("one-pass");
  const draftSecs = secsOf("draft-extract");
  const timeLine =
    onePassSecs.length && draftSecs.length
      ? `median one-pass ${median(onePassSecs)}s vs draft-extract ${median(draftSecs)}s (${Math.round((median(draftSecs) / median(onePassSecs)) * 10) / 10}x); draft-extract makes 2 model calls per row where one-pass makes 1`
      : "no timing yet (results.jsonl empty or incomplete)";

  const bar1: Prediction = { id: "1", text: "draft-extract improves >= 5 of the 88 scorable rows (matches expectedKeys where one-pass did not)", hits: improved.length, seen: paired.length, total: scorable.length, bound: { atLeast: 5 } };
  const bar2: Prediction = { id: "2", text: "draft-extract regresses at most 1 row (a previously-matching row stops matching -- a harmful false positive)", hits: regressed.length, seen: paired.length, total: scorable.length, bound: { atMost: 1 } };
  const killImprove: Prediction = { id: "KILL-improve", text: "fewer than 2 rows improve -- the mitigation is not doing anything worth its cost", hits: improved.length, seen: paired.length, total: scorable.length, bound: { atLeast: 2 } };
  const killRegress: Prediction = { id: "KILL-regress", text: "2 or more rows regress -- draft-extract introduces MORE misreads than the 1 the primary bar tolerates", hits: regressed.length, seen: paired.length, total: scorable.length, bound: { atMost: 1 } };

  const lines = renderScoreboard("P-DE -- draft-then-extract vs one-pass (the-prisoner#9 SS1)", [bar1, bar2, killImprove, killRegress]);
  lines.push("", `Time cost: ${timeLine}.`);
  lines.push("", done ? "All 88 scorable rows are in." : `${paired.length} of ${scorable.length} scorable rows in so far.`);
  if (improved.length) lines.push("", "Improved (one-pass missed, draft-extract matched):", ...improved.map((i) => `- ${i.id}: one-pass ${JSON.stringify(matchesExpected(of("one-pass", i.id), null))} -> draft-extract matched ${JSON.stringify((i as any).expectedKeys)}`));
  if (regressed.length) lines.push("", "Regressed (one-pass matched, draft-extract missed) -- the harmful case:", ...regressed.map((i) => `- ${i.id}: expected ${JSON.stringify((i as any).expectedKeys)}, draft-extract gave ${JSON.stringify({ target: of("draft-extract", i.id)?.target, effect: of("draft-extract", i.id)?.effect, property: of("draft-extract", i.id)?.property })}`));
  const unscored = items.filter((i) => (i as any).expectedKeys === null);
  lines.push("", `Unscored (no pre-registered expectedKeys, reported not gated): ${unscored.map((i) => i.id).join(", ")}.`);
  return lines;
}

if (isMain(import.meta.url)) {
  await runRefereeProbe({
    dir: DIR,
    name: "P-DE draft-extract",
    items: ITEMS,
    arms: [
      { name: "one-pass", overrides: { oneAct: "off" } },
      { name: "draft-extract", overrides: { oneAct: "off" }, wrapTransport: draftExtract },
    ],
    n: N,
    argv: process.argv.slice(2),
    score,
    showQuestions: ["source:draft"],
  });
  if (process.argv.includes("--dry-run")) console.log(`\n${draftCallsMade} draft call(s) attempted (0 sent -- dry run).`);
}
