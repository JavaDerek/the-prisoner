// the-prisoner#35 -- the warden's half-round grew from ~50s to 56-91s under the 2026-09-27 defaults. The
// coordinator's own measurement from the two transcripts (`checkpoints/2026-09-27T20-14-57-505Z.*` old defaults,
// `checkpoints/2026-09-28T01-09-16-356Z.*` new defaults) found the referee's own call unchanged (median 27.9s ->
// 28.5s) and the one-act call unchanged (5.4 -> 6.2s); the growth is entirely in the remainder -- the warden's
// WITS call, median 14.6s -> 35.0s -- while the warden's VISIBLE wits output (thoughts+candidates+intent+line+
// plan+notes) stayed the same length (median 1684 -> 1749 chars). This probe isolates whether that growth is
// hidden reasoning tokens (CLAUDE.md "Local play is all-Muse... thinking is OFF everywhere", the 2026-09-27
// correction: on Ollama `reasoning_effort: "none"` HIDES Muse's reasoning from the parser, it does not stop it)
// or prompt size (twelve conditions now on the warden's own side, D3; two persons with posture/sight, D2/D12;
// the absence line, D5; the laying-hands line, D13).
//
// See PREDICTION.md beside this file, written before any call. Scaffolding, written 2026-09-27/28, NOT RUN.
//
// WITS-ONLY: no referee ruling is made on the mind's live proposal (the referee's own call is already measured
// unchanged, and a proposal here is never acted on) -- only the warden's `createOpenWardenMind().consider()` call
// is timed. `--dry-run` builds every request with the network forbidden (`forbidNetwork`, `kit.mts`); `--live`
// makes real calls, one driver at a time, resumable via `results.jsonl`; `--score` prints the medians.
//
//   npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --dry-run
//   PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
//   PRISONER_THINK_TIMEOUT_MS=300000 npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --live
//   npx tsx checkpoints/2026-09-28-warden-wits-time/probe.mts --score
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isMain,
  args,
  gameArms,
  rebuildContext,
  conditionsFor,
  forbidNetwork,
  takeDriverLock,
  pinnedRevision,
  openLog,
  resultsFile,
  armsLine,
  DRIVER_LOCK,
  MAX_ERRORS_IN_A_ROW,
  type GameArms,
  type RebuiltContext,
} from "../2026-09-28-probe-kit/kit.mts";
import { createOpenWardenMind, type OpenProposal } from "../../src/open/mind.js";
import { DEFAULT_MIND_MODEL, resolveSeatModels } from "../../src/modelRoles.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";

const DIR = dirname(fileURLToPath(import.meta.url));

/** The one game whose header the coordinator measured against
 * (`checkpoints/2026-09-27T20-14-57-505Z.md`): new defaults, human prisoner, model warden. */
export const TRANSCRIPT = "checkpoints/2026-09-28T01-09-16-356Z.md";

/** The warden's own seven half-rounds ("Half-round timings" in the transcript; rounds 4 and 8 are the absence
 *  cadence's silent turns and are not among them). */
export const ROUNDS = [1, 2, 3, 5, 6, 7, 9] as const;

export const N = 2;

/** The pre-2026-09-27 values of the seven arms CLAUDE.md's "Defaults changed on 2026-09-27" names, restricted to
 *  the ones that can reach the WARDEN's own wits prompt (`conditionsFor`, `stateBasedRules`, `renderSeatSituation`,
 *  `insertAbsenceLine`). `oneAct` is included for arm-fidelity with CLAUDE.md's own list, but see PREDICTION.md --
 *  `ONE_ACT_RULE` is an unconditional constant in both `buildOpenWitsPrompt` and `buildOpenSingleCallPrompt`
 *  (`mind.ts`), and `rebuildContext`'s own referee always replays history at `oneAct: "off"` regardless of this
 *  arm, so it cannot move the rebuilt context's briefing either. It is set here for the record, not because it is
 *  expected to matter. */
export const OLD_PROMPT_ARMS: Partial<GameArms> = {
  presence: "off",
  absence: "off",
  conditions: "list",
  door: "unstated",
  doorPrice: "free",
  block: "off",
  oneAct: "checked",
};

export type ArmName = "new" | "old";

function armsFor(name: ArmName): GameArms {
  return gameArms(process.env, name === "old" ? OLD_PROMPT_ARMS : {});
}

/** Sum of the lengths of exactly the fields the coordinator named "the warden's VISIBLE wits output": what a
 *  reader of the checkpoint transcript, or another mind, ever sees again -- never the hidden reasoning tokens
 *  Ollama's glimmer parser discards when thinking is off (CLAUDE.md's 2026-09-27 correction). Candidates are
 *  JSON-stringified (a list of `{text, reason}` objects, not a single string). This is the whole formula; nothing
 *  is estimated or inferred from it. */
export function visibleChars(p: OpenProposal): number {
  return (p.thoughts ?? "").length + JSON.stringify(p.candidates ?? []).length + p.intent.length + (p.line ?? "").length + (p.plan ?? "").length + (p.notes ?? "").length;
}

/** One HTTP exchange as the wits call actually sent and received it -- captured at the FETCH seam, below
 *  `mind-seam`'s own wire (`createLocalMind`, `node_modules/mind-seam/dist/wire/localMind.js`), which reads only
 *  `body.choices[0].message.content` and never `body.usage`. Ollama's `/v1/chat/completions` reports `usage` as
 *  eval counts INCLUDING tokens its parser discards before handing back `content` -- confirmed by reading
 *  `refereeTransport.ts` and `mind-seam`'s wire above, neither of which reads or drops that field; it simply never
 *  reaches either caller today, so it has never been recorded before this probe. */
export interface CallRecord {
  ms: number;
  status: number;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  contentLength: number | null;
}

/** Wraps the real `fetch` so the raw response body is read once, parsed for timing/usage, and handed back to the
 *  caller as an equivalent fresh `Response` -- `mind-seam`'s wire calls `.text()` on what this returns, so it must
 *  still behave like an ordinary `Response`, not a consumed one. Pushes one `CallRecord` per call onto `trace`. */
function instrumentedFetch(trace: CallRecord[]): typeof fetch {
  return async (input, init) => {
    const t0 = performance.now();
    const response = await fetch(input as any, init as any);
    const text = await response.text();
    const ms = Math.round(performance.now() - t0);
    let usage: CallRecord["usage"] = null;
    let contentLength: number | null = null;
    try {
      const body = JSON.parse(text) as { usage?: CallRecord["usage"]; choices?: { message?: { content?: string } }[] };
      usage = body.usage ?? null;
      const content = body.choices?.[0]?.message?.content;
      contentLength = typeof content === "string" ? content.length : null;
    } catch {
      // left null: an unparseable body is reported as such by mind-seam's own silence path, not by this wrapper.
    }
    trace.push({ ms, status: response.status, usage, contentLength });
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

/** A captor `fetchFn` for `--dry-run`: never opens a socket, returns one well-formed proposal so
 *  `mind.consider()` completes and the request it built (and only that request) can be inspected. */
function dryRunCaptor(captured: { prompt: string | null }): typeof fetch {
  return (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    captured.prompt = body.messages?.map((m: { content: string }) => m.content).join("\n") ?? null;
    const content = JSON.stringify({
      thoughts: "dry-run", candidates: [{ text: "a", reason: "b" }, { text: "c", reason: "d" }],
      intent: "dry-run intent", line: "", plan: "dry-run plan", replanned: false, replanBecause: "", notes: "dry-run notes",
    });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 0, completion_tokens: 0 } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

async function buildWardenMind(arms: GameArms, context: RebuiltContext["context"], baseUrl: string, fetchFn: typeof fetch, ensureLoaded: (m: string) => Promise<void>, timeoutMs: number | undefined, wits: string, voice: string) {
  const conditions = conditionsFor("warden", arms);
  return createOpenWardenMind({
    baseUrl,
    witsModel: wits,
    voiceModel: voice,
    timeoutMs,
    ensureLoaded,
    thinking: arms.witsThinking as any,
    fetchFn,
    ...(conditions ? { conditions } : {}),
  });
}

// ---------------------------------------------------------------------------------------------------------------

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function score(rows: any[]): string[] {
  const out: string[] = ["## the-prisoner#35 -- warden wits call: ms / prompt_tokens / completion_tokens / visible chars", ""];
  out.push("| arm | n | median ms | median prompt_tokens | median completion_tokens | median visible chars |");
  out.push("|---|---|---|---|---|---|");
  const byArm = new Map<string, any[]>();
  for (const r of rows) {
    if (!r.sampleId || r.error) continue;
    byArm.set(r.arm, [...(byArm.get(r.arm) ?? []), r]);
  }
  const meds: Record<string, { ms: number | null; pt: number | null; ct: number | null; vc: number | null }> = {};
  for (const arm of ["new", "old"]) {
    const rs = byArm.get(arm) ?? [];
    const ms = median(rs.map((r) => r.ms).filter((x) => typeof x === "number"));
    const pt = median(rs.map((r) => r.usage?.prompt_tokens).filter((x) => typeof x === "number"));
    const ct = median(rs.map((r) => r.usage?.completion_tokens).filter((x) => typeof x === "number"));
    const vc = median(rs.map((r) => r.visibleChars).filter((x) => typeof x === "number"));
    meds[arm] = { ms, pt, ct, vc };
    out.push(`| ${arm} | ${rs.length} | ${ms ?? "-"} | ${pt ?? "-"} | ${ct ?? "-"} | ${vc ?? "-"}|`);
  }
  const errors = rows.filter((r) => r.sampleId && r.error);
  out.push("", `Errors: ${errors.length}${errors.length ? " -- " + errors.map((e) => e.sampleId).join(", ") : ""}.`);
  const n = meds.new, o = meds.old;
  if (n?.ms != null && o?.ms != null && n.ct != null && o.ct != null && n.vc != null && o.vc != null && n.pt != null && o.pt != null) {
    const ctRatio = o.ct === 0 ? null : n.ct / o.ct;
    const vcRatio = o.vc === 0 ? null : n.vc / o.vc;
    const ptRatio = o.pt === 0 ? null : n.pt / o.pt;
    out.push("", `new/old ratios: ms x${(n.ms / o.ms).toFixed(2)}, prompt_tokens x${ptRatio?.toFixed(2) ?? "n/a"}, completion_tokens x${ctRatio?.toFixed(2) ?? "n/a"}, visible chars x${vcRatio?.toFixed(2) ?? "n/a"}.`);
    const hiddenReasoning = ctRatio !== null && vcRatio !== null && ctRatio >= 1.5 && vcRatio < 1.2;
    const promptSize = ptRatio !== null && ptRatio >= 1.5 && !(ctRatio !== null && ctRatio >= 1.5);
    out.push(
      hiddenReasoning
        ? "PREDICTION: MET as hidden reasoning -- completion tokens grew >=1.5x while visible chars grew <1.2x."
        : promptSize
          ? "PREDICTION: MET as prompt size -- prompt tokens grew >=1.5x and completion tokens did not."
          : "PREDICTION: NEITHER band fired as stated -- read the raw ratios above by hand."
    );
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const a = args(process.argv.slice(2));
  const onlyRaw = a.get("only")?.split(",") ?? null;
  const items: { arm: ArmName; round: number }[] = [];
  for (const arm of ["new", "old"] as ArmName[]) for (const round of ROUNDS) items.push({ arm, round });
  const items2 = onlyRaw ? items.filter((it) => onlyRaw.includes(`${it.arm}:${it.round}`)) : items;

  if (a.has("score")) {
    for (const line of score(resultsFile(a.get("out") ?? DIR).rows().filter((r: any) => r.sampleId || r.type === "meta"))) console.log(line);
    return;
  }

  const dry = a.has("dry-run");
  if (!dry && !a.has("live")) throw new Error("warden-wits-time: pass --dry-run, --live or --score");

  if (dry) {
    forbidNetwork();
    console.log("the-prisoner#35 warden wits time DRY RUN -- no model is called; the network is forbidden in this process.");
    console.log(`new arms: ${armsLine(armsFor("new"))}`);
    console.log(`old arms (overrides ${JSON.stringify(OLD_PROMPT_ARMS)}): ${armsLine(armsFor("old"))}`);
    let built = 0;
    for (const { arm, round } of items2) {
      const armsArg = armsFor(arm);
      const rebuilt = await rebuildContext({ transcript: TRANSCRIPT, chair: "warden", round, arms: armsArg });
      const conditions = conditionsFor("warden", armsArg);
      for (let s = 1; s <= N; s++) {
        const captured = { prompt: null as string | null };
        const mind = await buildWardenMind(armsArg, rebuilt.context, "http://dry-run.invalid/v1", dryRunCaptor(captured), async () => {}, undefined, "dry-run", "dry-run");
        await mind.consider(rebuilt.context);
        built += 1;
        if (s === 1) {
          console.log(
            `${arm}:${round} sample ${s} -- conditions ${conditions ? "list" : "sentences"}, prompt ${captured.prompt?.length ?? 0} chars, ` +
              `replay ${rebuilt.halvesReplayed} half-rounds, ${rebuilt.divergences.length} divergences, ${rebuilt.warnings.length} warnings`
          );
          for (const d of rebuilt.divergences) console.log(`  DIVERGENCE ${arm}:${round}: ${d}`);
          for (const w of rebuilt.warnings) console.log(`  WARNING ${arm}:${round}: ${w}`);
        }
      }
    }
    console.log(`\n${items2.length} contexts x N=${N}: ${built} requests built, none sent. A live run makes exactly ${built} warden wits calls (no referee ruling).`);
    return;
  }

  // --live
  const baseUrl = process.env.PRISONER_MODEL_URL;
  if (!baseUrl) throw new Error("--live: set PRISONER_MODEL_URL explicitly (http://doris:11434/v1 for the local card) -- a probe never guesses its endpoint");
  const seat = resolveSeatModels(process.env.PRISONER_WARDEN_MODEL, { wits: process.env.PRISONER_WITS_MODEL ?? DEFAULT_MIND_MODEL, voice: process.env.PRISONER_VOICE_MODEL ?? DEFAULT_MIND_MODEL });
  const residents = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const allowed = [...new Set([seat.wits, seat.voice, ...residents])];
  const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL), allowedModels: allowed });
  const ps = await swapper.fetchPs();
  assertNoForeignModel(ps, allowed);
  const residentsAtStart = ps.models.map((m: any) => m.name).filter((n: string) => residents.includes(n));
  const ensureLoaded = (m: string) => swapper.withModel(m, async () => {});
  const thinkTimeout = process.env.PRISONER_THINK_TIMEOUT_MS ? Number(process.env.PRISONER_THINK_TIMEOUT_MS) : undefined;

  const release = takeDriverLock("the-prisoner#35 warden wits time", DRIVER_LOCK);
  const revision = pinnedRevision(a.has("allow-dirty"));
  const log = openLog(DIR, "run");
  const results = resultsFile(DIR);
  try {
    const meta = {
      type: "meta",
      probe: "the-prisoner#35 warden wits time",
      started: new Date().toISOString(),
      revision,
      transcript: TRANSCRIPT,
      rounds: ROUNDS,
      n: N,
      oldOverrides: OLD_PROMPT_ARMS,
      models: `wits ${seat.wits}, voice ${seat.voice} (single-call path expected: they are equal)`,
      psAtStart: ps.models.map((m: any) => m.name),
    };
    results.append(meta);
    log(JSON.stringify(meta));
    let k = 0;
    let errorsInARow = 0;
    for (const { arm, round } of items2) {
      const armsArg = armsFor(arm);
      const rebuilt = await rebuildContext({ transcript: TRANSCRIPT, chair: "warden", round, arms: armsArg });
      for (let s = 1; s <= N; s++) {
        k += 1;
        const sampleId = `${arm}:${round}:${s}`;
        if (results.done.has(sampleId)) continue;
        const trace: CallRecord[] = [];
        const mind = await buildWardenMind(armsArg, rebuilt.context, baseUrl, instrumentedFetch(trace), ensureLoaded, thinkTimeout, seat.wits, seat.voice);
        const t0 = Date.now();
        let row: Record<string, unknown>;
        try {
          const proposal = await mind.consider(rebuilt.context);
          const call = trace[0] ?? null;
          row = {
            sampleId,
            arm,
            round,
            sample: s,
            ms: call?.ms ?? null,
            status: call?.status ?? null,
            usage: call?.usage ?? null,
            contentLength: call?.contentLength ?? null,
            visibleChars: proposal ? visibleChars(proposal) : null,
            silent: proposal === null,
            intentPreview: proposal?.intent?.slice(0, 120) ?? null,
            replay: { halves: rebuilt.halvesReplayed, divergences: rebuilt.divergences, warnings: rebuilt.warnings },
            secs: (Date.now() - t0) / 1000,
          };
        } catch (err) {
          row = { sampleId, arm, round, sample: s, error: String(err).slice(0, 500), secs: (Date.now() - t0) / 1000 };
        }
        results.append(row);
        log(`[${k}/${items2.length * N}] ${sampleId} -> ${row.error ? `ERROR ${row.error}` : `${row.ms}ms usage=${JSON.stringify(row.usage)} visible=${row.visibleChars}`} (${row.secs}s)`);
        errorsInARow = row.error ? errorsInARow + 1 : 0;
        if (errorsInARow >= MAX_ERRORS_IN_A_ROW) throw new Error(`${MAX_ERRORS_IN_A_ROW} errors in a row: stopped. Check /api/ps and the endpoint, then rerun to resume.`);
      }
    }
    for (const line of score(results.rows().filter((r: any) => r.sampleId))) log(line);
  } finally {
    await swapper.restoreResidents(residentsAtStart);
    release();
  }
}

if (isMain(import.meta.url)) {
  await main();
}

export { score };
