// PRISONER_IMPROVISE=suspicion -- does the separate suspicion reading (src/open/improvisedRuling.ts, commits
// 811c95f..b012824) give the tier a person would, on unlisted prisoner acts? See PREDICTION.md (committed first).
//
// Every request is built by the game's own code: `buildOpenWorld` (with `improvise: "suspicion"`), the game's own
// `runOpenGame` loop and its perceive gate, `createReferee` with the options `src/checkpoint.ts` passes (the kit's
// `refereeOptions`), and `createSuspicionImproviser` over `createRefereeTransport` exactly as `checkpoint.ts` builds
// it -- the referee's model, its thinking mode, temperature 0. Never a recorded request, never a copied harness.
//
// Two phases, one driver, serial:
//   G (reach): each item once, through the real loop with the REAL main referee, and an improviser that records
//     whether it was offered and asked but calls no model. Answers: does this act take a null path today, and does
//     the perceive gate open?
//   R (reading): three passes over every item (pass-major, so no two repeats of one item are adjacent), each
//     through the real loop on a fresh world, the referee replaced by THAT item's own phase-G ruling object (so the
//     loop's gate is computed exactly as in G), and the REAL improviser. An item the main referee did not rule onto
//     a null path in G is replayed with its G ruling's target and effect set to `none` (path "counterfactual"),
//     which is what the loop would do had the referee ruled it onto nothing. A perceivable-labelled item whose gate
//     closed is ALSO read in isolation (`improviseSuspicion` with perceivable: true), so the reading is measured.
//
// The one deviation from `checkpoint.ts`: `ensureLoaded` is a GUARD, never a swapper. The card is shared with a
// production tenant; before every call /api/ps must show exactly the referee model and nothing else, or the run
// stops. This hook runs before the request and does not touch its bytes.
//
//   npx tsx checkpoints/2026-10-16-improvise-suspicion/probe.mts --dry-run
//   npx tsx checkpoints/2026-10-16-improvise-suspicion/probe.mts --rehearse --out=/tmp/x
//   DMCP_DB_PATH=:memory: PRISONER_MODEL_URL=<url>/v1 npx tsx checkpoints/2026-10-16-improvise-suspicion/probe.mts --live
//   npx tsx checkpoints/2026-10-16-improvise-suspicion/probe.mts --score
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  args,
  armsLine,
  forbidNetwork,
  gameArms,
  isMain,
  keysOf,
  oneActOf,
  openLog,
  refereeOptions,
  renderScoreboard,
  resultsFile,
  runMode,
  takeDriverLock,
  tracing,
  type GameArms,
  type Prediction,
} from "../2026-09-28-probe-kit/kit.mts";
import { createTestDb } from "../../src/world/testDb.js";
import { buildOpenWorld } from "../../src/open/world.js";
import { buildOpenResolver } from "../../src/open/mechanics.js";
import { runOpenGame } from "../../src/open/game.js";
import { createReferee } from "../../src/open/referee.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { createSuspicionImproviser, improviseSuspicion, SUSPICION_QUESTION, OUTRAGE_QUESTION } from "../../src/open/improvisedRuling.js";
import { resolveRefereeModel } from "../../src/modelRoles.js";
import { nativeBaseUrl } from "../../src/ollamaSwap.js";
import { getResource } from "run-dmcp";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 3;
const KEYS = ["none", "minor", "serious", "outrage"] as const;

export interface Item {
  id: string;
  group: string;
  setup: "present" | "absent" | "blind";
  gate: "open" | "closed" | "referee";
  label: (typeof KEYS)[number];
  intent: string;
  reason: string;
}
export const ITEMS: Item[] = JSON.parse(readFileSync(join(DIR, "items.json"), "utf8")).items;

// The blind setup's round-1 act and its scripted ruling (sight.test.ts's own COVER_WARDEN): a substantial wear on
// the warden's sight takes it 100 -> 0, at or below SIGHT_BLIND_AT_OR_BELOW (60); recovery is slight only.
const COVER = "I throw the blanket over the warden's head.";
function coverRuling(): any {
  const cited = (quote: string) => ({ citation: { sourceId: "intent", quote }, requiredSourceId: "intent", verified: true });
  return {
    targetObjectId: "warden",
    effectKind: "wear",
    property: "sight",
    magnitude: "substantial",
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited("the warden's head"), effect: cited("throw the blanket over"), property: { citation: { sourceId: "desc:warden", quote: "x" }, requiredSourceId: "desc:warden", verified: true }, product: cited("x") },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

const targetRound = (item: Item) => (item.setup === "absent" ? 4 : item.setup === "blind" ? 2 : 1);

class Captured extends Error {
  constructor(readonly half: any) {
    super("captured");
  }
}

let dbReady = false;
function freshWorld(arms: GameArms): any {
  if (!dbReady) {
    createTestDb();
    dbReady = true;
  }
  return buildOpenWorld({ doorPrice: arms.doorPrice, presence: arms.presence, window: arms.window, harm: arms.harm, improvise: "suspicion" });
}

/** One item through the game's own loop, up to and including the prisoner's half-round on its target round. Every
 *  other half-round is silent, except the blind setup's scripted cover on round 1. `ruleItem` rules the item's own
 *  intent; it is handed the world so a real referee can be bound to it. */
async function playItem(item: Item, arms: GameArms, ruleItem: (world: any) => { rule: (text: string, perceived: any[], holding?: any[]) => Promise<any> }, improviser: any): Promise<{ half: any; world: any; suspicionBefore: number }> {
  const world = freshWorld(arms);
  const resolver = buildOpenResolver();
  const itemReferee = ruleItem(world);
  const round = targetRound(item);
  const roundOf = (context: any) => Number(/^Round (\d+) of/.exec(context.briefing)?.[1] ?? "0");
  const prisonerMind = {
    async consider(context: any) {
      const n = roundOf(context);
      if (n === round) return { intent: item.intent, line: "" };
      if (item.setup === "blind" && n === 1) return { intent: COVER, line: "" };
      return null;
    },
  };
  const wardenMind = { async consider() { return null; } };
  const referee = {
    async rule(text: string, perceived: any[], holding?: any[]) {
      if (text === COVER) return coverRuling();
      return itemReferee.rule(text, perceived, holding);
    },
  };
  let suspicionBefore = 0;
  try {
    await runOpenGame({
      openWorld: world,
      resolver,
      referee: referee as any,
      wardenMind: wardenMind as any,
      prisonerMind: prisonerMind as any,
      rounds: 12,
      presenceMode: arms.presence,
      absenceMode: arms.absence,
      harmMode: arms.harm,
      improviser,
      onHalfRound: (half: any) => {
        if (half.principal === "warden" && half.roundN === round) suspicionBefore = getResource(world.base.resources.wardenSuspicion)?.value ?? 0;
        if (half.principal === "prisoner" && half.roundN === round) throw new Captured(half);
      },
    } as any);
  } catch (err) {
    if (err instanceof Captured) return { half: err.half, world, suspicionBefore };
    throw err;
  }
  throw new Error(`${item.id}: the game ended before round ${round}`);
}

/** Phase G's improviser: records that it was offered and asked; calls no model, moves nothing. */
function recordingImproviser(): { improviser: any; asked: () => boolean } {
  let asked = false;
  return {
    asked: () => asked,
    improviser: {
      async read(_intent: string, t: number) {
        asked = true;
        return { id: `stub:t=${t}`, answer: "none", citation: { citation: null, requiredSourceId: "intent", verified: false }, raw: { answers: [], unmatched: [], rungs: [] }, request: { questions: [], sources: [] }, exchanges: [] };
      },
      async confirm() {
        throw new Error("phase G's improviser never confirms");
      },
    },
  };
}

/** What phase R plays for an item: its own G ruling where G reached a null path, else that ruling with target and
 *  effect set to `none` -- the first null path, exactly. */
function replayRuling(gRow: any): { ruling: any; path: "reached" | "counterfactual" } {
  if (gRow.reached) return { ruling: gRow.ruling, path: "reached" };
  return { ruling: { ...gRow.ruling, targetObjectId: "none", effectKind: "none", applicable: false }, path: "counterfactual" };
}

function readingSummary(r: any) {
  if (!r) return null;
  return {
    answer: r.answer,
    quote: r.citation?.citation?.quote ?? null,
    verified: r.citation?.verified ?? false,
    unmatched: r.raw?.unmatched ?? [],
    request: r.request,
    exchanges: r.exchanges,
  };
}

function improvisedSummary(i: any) {
  if (!i) return null;
  return {
    asked: i.asked,
    reading: readingSummary(i.reading),
    confirmation: i.confirmation ? { ...readingSummary(i.confirmation), confirmed: i.confirmation.confirmed } : null,
    tier: i.tier,
    amount: i.parameters?.targets?.[0]?.amount ?? null,
    outcomeOk: i.outcome ? true : null,
    refusal: i.refusal ? String(i.refusal.message ?? i.refusal).slice(0, 300) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The scoreboard (PREDICTION.md). Primary: the reading's own answer key against the label, over every R sample of a
// perceivable-labelled item (gate "open"): the loop's reading where it was asked, the isolation reading where the
// gate closed. Effective: the tier the game actually ruled (unverified -> none; unconfirmed outrage -> serious;
// gate closed -> none).

const rise = (k: string | null | undefined) => k !== null && k !== undefined && k !== "none";

export function samplesOf(rows: any[]) {
  return rows.filter((r) => r.phase === "R" && !r.error);
}

export function score(rows: any[]): string[] {
  const items = ITEMS;
  const R = samplesOf(rows);
  const G = rows.filter((r) => r.phase === "G" && !r.error);
  const open = items.filter((i) => i.gate === "open");
  const openIds = new Set(open.map((i) => i.id));
  const labelOf = (id: string) => items.find((i) => i.id === id)!.label;
  const readKey = (r: any) => (r.improvised?.asked ? r.improvised.reading?.answer : r.isolation?.reading?.answer) ?? null;
  const effKey = (r: any) => (r.improvised?.asked ? (r.improvised.tier ?? "none") : "none");
  const openSamples = R.filter((r) => openIds.has(r.item));
  const exact = openSamples.filter((r) => readKey(r) === labelOf(r.item)).length;
  const direction = openSamples.filter((r) => rise(readKey(r)) === rise(labelOf(r.item))).length;
  const effExact = openSamples.filter((r) => effKey(r) === labelOf(r.item)).length;
  const effDirection = openSamples.filter((r) => rise(effKey(r)) === rise(labelOf(r.item))).length;
  const closedItems = items.filter((i) => i.gate === "closed");
  const closedSamples = R.filter((r) => closedItems.some((i) => i.id === r.item));
  const closedOk = closedSamples.filter((r) => r.improvised && r.improvised.asked === false).length;
  const inner = items.filter((i) => i.group === "inner" || i.group === "selfclaim");
  const innerHigh = inner.filter((i) => {
    const s = openSamples.filter((r) => r.item === i.id);
    return s.length >= 2 && s.filter((r) => readKey(r) === "serious" || readKey(r) === "outrage").length * 2 > s.length;
  }).length;
  const innerSeen = inner.filter((i) => openSamples.filter((r) => r.item === i.id).length >= N).length;
  const reached = open.filter((i) => G.find((g) => g.item === i.id)?.reached).length;
  const gSeen = open.filter((i) => G.some((g) => g.item === i.id)).length;
  const total = open.length * N;

  const lines = renderScoreboard("PRISONER_IMPROVISE=suspicion -- the reading against hand labels", [
    { id: "1", text: `exact-key agreement, reading's answer vs label (predicted 38 of ${total}; holds at >= 36)`, hits: exact, seen: openSamples.length, total, bound: { atLeast: 36 } },
    { id: "2", text: `direction agreement, none vs any rise (predicted 50 of ${total}; holds at >= 48)`, hits: direction, seen: openSamples.length, total, bound: { atLeast: 48 } },
    { id: "3", text: `imperceptible setups (away / blind): never asked, ${closedItems.length * N} of ${closedItems.length * N}`, hits: closedOk, seen: closedSamples.length, total: closedItems.length * N, bound: { atLeast: closedItems.length * N } },
    { id: "KILL-a", text: `exact agreement below 30 of ${total} kills the prompt as written`, hits: exact, seen: openSamples.length, total, bound: { atLeast: 30 } },
    { id: "KILL-b", text: "any inner-state / self-claim item (I16-I20) read serious or outrage by majority kills it", hits: innerHigh, seen: innerSeen, total: inner.length, bound: { atMost: 0 } },
    { id: "r1", text: "reach: perceivable items the REAL main referee rules onto a null path (guessed 9 of 20)", hits: reached, seen: gSeen, total: open.length, bound: "report" },
    { id: "r2", text: "effective exact (the tier the game ruled: unverified -> none, unconfirmed outrage -> serious)", hits: effExact, seen: openSamples.length, total, bound: "report" },
    { id: "r3", text: "effective direction", hits: effDirection, seen: openSamples.length, total, bound: "report" },
  ]);

  lines.push("", "Confusion (reading's answer; rows = label, columns = answer), perceivable items:", "", "| label \\ read | none | minor | serious | outrage | (none read) |", "|---|---|---|---|---|---|");
  for (const l of KEYS) {
    const s = openSamples.filter((r) => labelOf(r.item) === l);
    lines.push(`| ${l} | ${KEYS.map((k) => s.filter((r) => readKey(r) === k).length).join(" | ")} | ${s.filter((r) => readKey(r) === null).length} |`);
  }
  lines.push("", "Per item (label -> reading answers by pass; [effective tier]; citation verified; confirmation):");
  for (const i of items) {
    const s = R.filter((r) => r.item === i.id).sort((a, b) => a.pass - b.pass);
    const g = G.find((x) => x.item === i.id);
    const parts = s.map((r) => {
      const rd = r.improvised?.asked ? r.improvised.reading : r.isolation?.reading;
      const conf = r.improvised?.confirmation ?? r.isolation?.confirmation;
      return `${r.improvised?.asked ? "" : r.isolation ? "iso:" : "not-asked:"}${rd?.answer ?? "-"}[${effKey(r)}]${rd ? (rd.verified ? "" : "!unverified") : ""}${conf ? `{conf:${conf.answer}${conf.confirmed ? "+" : ""}}` : ""}`;
    });
    lines.push(`- ${i.id} (${i.label}, gate ${i.gate}) G: ${g ? `${g.keys.target}/${g.keys.effect}/${g.keys.perceptibility} applicable=${g.keys.applicable} reached=${g.reached} asked=${g.asked}` : "-"} | R: ${parts.join(", ") || "-"}`);
  }
  const stable = open.filter((i) => {
    const s = openSamples.filter((r) => r.item === i.id);
    return s.length === N && new Set(s.map(readKey)).size === 1;
  }).length;
  const ms = R.flatMap((r) => [r.improvised?.reading, r.improvised?.confirmation, r.isolation?.reading, r.isolation?.confirmation].filter(Boolean).flatMap((x: any) => (x.exchanges ?? []).filter(Boolean).map((e: any) => e.ms))).sort((a, b) => a - b);
  const median = ms.length ? ms[Math.floor(ms.length / 2)] : null;
  lines.push("", `Stability: ${stable} of ${open.length} perceivable items gave the same answer on all ${N} passes.`, `Latency: ${ms.length} reading/confirmation calls, median ${median} ms, min ${ms[0]} ms, max ${ms[ms.length - 1]} ms.`);
  return lines;
}

// ---------------------------------------------------------------------------------------------------------------

async function main(argv: readonly string[]): Promise<void> {
  const a = args(argv);
  const arms = gameArms();
  if (a.has("score")) {
    for (const line of score(resultsFile(a.get("out") ?? DIR).rows())) console.log(line);
    return;
  }
  if (arms.presence !== "modelled" || arms.absence !== "cadence") throw new Error(`the setups need presence modelled and absence cadence (got ${arms.presence}/${arms.absence}): unset PRISONER_PRESENCE / PRISONER_ABSENCE`);

  if (a.has("dry-run")) {
    forbidNetwork();
    console.log(`DRY RUN -- no model is called. arms: ${armsLine(arms)}`);
    for (const item of ITEMS) {
      const rec = recordingImproviser();
      const scripted = { rule: async () => ({ ...coverRuling(), targetObjectId: "none", effectKind: "none", property: "none", magnitude: "slight", perceptibility: item.gate === "referee" ? "silent" : "audible", applicable: false }) };
      const { half, world, suspicionBefore } = await playItem(item, arms, () => scripted, rec.improviser);
      const sight = getResource(world.resourceIdFor["warden.sight"])?.value;
      console.log(`${item.id.padEnd(18)} round ${half.roundN} t=${half.t} warden sight ${sight} suspicion ${suspicionBefore} | improvised ${half.improvised ? `asked=${half.improvised.asked}` : "absent"} (expected gate ${item.gate})`);
    }
    console.log(`\nThe reading question, word for word:\n${SUSPICION_QUESTION.prompt}\n\nThe confirmation question:\n${OUTRAGE_QUESTION.prompt}`);
    return;
  }
  if (!a.has("live") && !a.has("rehearse")) throw new Error("pass --dry-run, --live, --rehearse --out=DIR or --score");

  const mode = runMode(a, DIR);
  const release = takeDriverLock("2026-10-16-improvise-suspicion", mode.lock);
  const revision = mode.revision();
  const log = openLog(mode.outDir, "run");
  const results = resultsFile(mode.outDir);
  const baseUrl = process.env.PRISONER_MODEL_URL;
  if (!baseUrl) throw new Error("set PRISONER_MODEL_URL explicitly -- a probe never guesses its endpoint");
  const refereeModel = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
  const native = nativeBaseUrl(baseUrl, process.env.PRISONER_OLLAMA_NATIVE_URL);
  const timeoutMs = process.env.PRISONER_REFEREE_TIMEOUT_MS ? Number(process.env.PRISONER_REFEREE_TIMEOUT_MS) : undefined;

  // A probe-level observer of the exact HTTP body each chat call sends (the transport keeps only the reply).
  const sent: string[] = [];
  const innerFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    if (String(input).endsWith("/chat/completions") && init?.body) sent.push(String(init.body));
    return innerFetch(input, init);
  }) as typeof fetch;
  const psNames = async () => ((await (await fetch(`${native}/api/ps`)).json()).models ?? []).map((m: any) => m.name);
  // The guard: exactly the referee model resident, alone. Never unloads, never loads.
  const guard = async (model: string) => {
    const names = await psNames();
    if (!(names.length === 1 && names[0] === model)) throw new GuardStop(`/api/ps shows [${names.join(", ")}], not exactly ${model}: stopping (shared card)`);
  };
  const transport = () => createRefereeTransport({ baseUrl, model: refereeModel, timeoutMs, ensureLoaded: guard, thinking: arms.refereeThinking as any });

  try {
    const psAtStart = await psNames();
    const meta = { type: "meta", probe: "2026-10-16-improvise-suspicion", started: new Date().toISOString(), revision, arms: armsLine(arms), improvise: "suspicion", refereeModel, refereeThinking: arms.refereeThinking, timeoutMs: timeoutMs ?? "default", psAtStart, n: N, items: ITEMS.length };
    results.append(meta);
    log(JSON.stringify(meta));
    if (!(psAtStart.length === 1 && psAtStart[0] === refereeModel)) throw new GuardStop(`/api/ps at start shows [${psAtStart.join(", ")}]; refusing to start`);

    const prior = results.rows();
    const done = new Set(prior.filter((r: any) => r.sampleId && !r.error).map((r: any) => r.sampleId));
    const gRows = new Map<string, any>(prior.filter((r: any) => r.phase === "G" && !r.error).map((r: any) => [r.item, r]));
    let errorsInARow = 0;
    const note = (row: any) => {
      errorsInARow = row.error ? errorsInARow + 1 : 0;
      if (errorsInARow >= 3) throw new Error("3 errors in a row: stopped (PREDICTION.md). Check /api/ps and the endpoint, then rerun to resume.");
    };

    // Phase G
    for (const [k, item] of ITEMS.entries()) {
      const sampleId = `G:${item.id}`;
      if (done.has(sampleId)) continue;
      const rec = recordingImproviser();
      const { transport: traced, trace } = tracing(transport());
      sent.length = 0;
      const t0 = Date.now();
      let row: any;
      try {
        const { half } = await playItem(item, arms, (world) => createReferee([traced], refereeOptions(world, arms) as any), rec.improviser);
        const reached = half.improvised !== undefined;
        row = { sampleId, phase: "G", item: item.id, at: new Date().toISOString(), intent: item.intent, keys: keysOf(half.ruling), oneAct: oneActOf(half.ruling), plan: half.plan ? { kind: half.plan.mechanic ?? half.plan.kind ?? null } : null, reached, asked: reached ? half.improvised.asked : null, ruling: half.ruling, trace, sentBodies: [...sent], secs: (Date.now() - t0) / 1000 };
      } catch (err) {
        if (err instanceof GuardStop) throw err;
        row = { sampleId, phase: "G", item: item.id, at: new Date().toISOString(), error: String(err).slice(0, 500), trace, secs: (Date.now() - t0) / 1000 };
      }
      results.append(row);
      if (!row.error) gRows.set(item.id, row);
      log(`[G ${k + 1}/${ITEMS.length}] ${item.id} -> ${row.error ? `ERROR ${row.error}` : `${row.keys.target}/${row.keys.effect}/${row.keys.perceptibility} applicable=${row.keys.applicable} reached=${row.reached} asked=${row.asked}`} (${row.secs}s)`);
      note(row);
    }

    // Phase R
    for (let pass = 1; pass <= N; pass++) {
      for (const [k, item] of ITEMS.entries()) {
        const sampleId = `R:${item.id}:${pass}`;
        if (done.has(sampleId)) continue;
        const g = gRows.get(item.id);
        if (!g) {
          log(`[R pass ${pass}] ${item.id}: no phase-G row, skipped`);
          continue;
        }
        const { ruling, path } = replayRuling(g);
        const { transport: traced } = tracing(transport());
        const improviser = createSuspicionImproviser([traced]);
        sent.length = 0;
        const t0 = Date.now();
        let row: any;
        try {
          const { half, world, suspicionBefore } = await playItem(item, arms, () => ({ rule: async () => ruling }), improviser);
          const after = getResource(world.base.resources.wardenSuspicion)?.value ?? null;
          let isolation: any = null;
          if (half.improvised && half.improvised.asked === false && item.gate === "open") {
            const w2 = freshWorld(arms);
            isolation = improvisedSummary(await improviseSuspicion({ openWorld: w2, resolver: buildOpenResolver(), improviser, intentText: item.intent, t: half.t, perceivable: true }));
          }
          row = { sampleId, phase: "R", pass, item: item.id, at: new Date().toISOString(), intent: item.intent, label: item.label, path, improvised: improvisedSummary(half.improvised), isolation, suspicionBefore, suspicionAfter: after, sentBodies: [...sent], secs: (Date.now() - t0) / 1000 };
        } catch (err) {
          if (err instanceof GuardStop) throw err;
          row = { sampleId, phase: "R", pass, item: item.id, at: new Date().toISOString(), error: String(err).slice(0, 500), secs: (Date.now() - t0) / 1000 };
        }
        results.append(row);
        const rd = row.improvised?.asked ? row.improvised.reading : row.isolation?.reading;
        const conf = row.improvised?.confirmation ?? row.isolation?.confirmation;
        log(`[R pass ${pass} ${k + 1}/${ITEMS.length}] ${item.id} (${item.label}) ${path} -> ${row.error ? `ERROR ${row.error}` : `${row.improvised?.asked ? "asked" : row.isolation ? "gate closed; isolation" : "not asked"} ${rd ? `${rd.answer} "${rd.quote ?? ""}" verified=${rd.verified}` : ""}${conf ? ` confirm=${conf.answer}/${conf.confirmed}` : ""} tier=${row.improvised?.tier ?? "-"} susp ${row.suspicionBefore}->${row.suspicionAfter}`} (${row.secs}s)`);
        note(row);
      }
      // A poll per pass: the scoreboard so far, DEAD announced the moment it is arithmetic.
      for (const line of score(results.rows()).slice(0, 14)) log(line);
    }
    for (const line of score(results.rows())) log(line);
  } finally {
    globalThis.fetch = innerFetch;
    release();
  }
}

class GuardStop extends Error {}

if (isMain(import.meta.url)) await main(process.argv.slice(2));
