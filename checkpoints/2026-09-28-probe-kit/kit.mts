// The shared harness for the 2026-09-28 probes P1-P7 (docs/PLAYTEST-2026-09-27-DESIGN.md §6, corrected by
// docs/PLAYTEST-2026-09-27-RED-TEAM.md §4, F6, F7, F13). Scaffolding only: written 2026-09-27, NOT RUN. The
// owner runs each probe on or after 2026-09-28, one driver at a time, from a pinned commit.
//
// WHY ONE KIT, NOT SEVEN COPIES. Two earlier failures are the reason (`prisoner-measurement-fidelity`,
// OPEN-VARIANT §68.8): a probe that replayed a RECORDED request measured the wrong arm, and a probe that
// COPIED a harness built its referee with `createReferee`'s bare defaults -- the D11 fidelity bug, where
// elision was "off" in the probe and "on" in every game. Everything a probe sends is therefore built here, once:
//
//   1. The world is `buildOpenWorld` at the game's own env readers (`gameArms`), never a hand-built fixture.
//   2. A context is REBUILT, never copied: the recorded transcript's prior half-rounds are played again through
//      the game's own `runOpenGame` loop -- its own suspicion bumps, evidence, beliefs, news, notes and plans --
//      with each recorded mind replaced by its recorded proposal and the referee replaced by a transport that
//      answers the RECORDED keys (`rebuildContext`). Nothing is copied out of a transcript except the words each
//      principal wrote and the keys the referee chose; every number a briefing shows is the world's, today.
//   3. The live referee and minds are built with exactly the options `src/checkpoint.ts` wires (`refereeOptions`,
//      `conditionsFor`, `liveModels`), read from the same env variables through the same `read*Mode` functions.
//
// `--dry-run` everywhere: `forbidNetwork()` replaces `fetch` with a function that throws, so a dry run that
// reached for a model would fail loudly instead of quietly calling one. Every probe's dry run is exercised by
// `src/open/__tests__/probes2026-09-28.test.ts`, so this scaffolding cannot rot silently between now and its run.
//
// Never pattern-match meaning (CLAUDE.md): nothing here reads English to decide anything. Every count a scorer
// makes is over the referee's closed keys; the two predictions that are about what a mind WROTE (P4's notes and
// plan) are hand-labelled by the owner into LABELS.json, and the scorer only counts the labels.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// CLAUDE.md "Never run against a real database": set before any run-dmcp call resolves its connection.
process.env.DMCP_DB_PATH = ":memory:";

import { createTestDb } from "../../src/world/testDb.js";
import { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf, readDoorPrice, readWindowMode } from "../../src/open/world.js";
import { readPresenceMode, readAbsenceMode, absenceRuleLine } from "../../src/open/briefing.js";
import {
  createReferee,
  readPersonInstrumentMode,
  readInstrumentMode,
  readDeriveWordingMode,
  readOneActMode,
  readElisionMode,
  readContainerClauseMode,
  readDeriveRepeatMode,
} from "../../src/open/referee.js";
import { readBlockMode, readHarmMode } from "../../src/open/effects.js";
import { openConditions, readConditionsMode, readDoorMode } from "../../src/open/conditions.js";
import { buildOpenResolver } from "../../src/open/mechanics.js";
import { runOpenGame } from "../../src/open/game.js";
import { createRefereeTransport } from "../../src/open/refereeTransport.js";
import { createOpenPrisonerMind, createOpenWardenMind } from "../../src/open/mind.js";
import { resolveRefereeThinking, resolveWitsThinking } from "../../src/open/thinking.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "../../src/ollamaSwap.js";
import { DEFAULT_MIND_MODEL, resolveRefereeModel, resolveVoiceModel, readSkipVoice, resolveSeatModels, seatModelNames } from "../../src/modelRoles.js";
import { describeRunRevision } from "../../src/runRevision.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../src/scenario.js";

export const KIT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO = join(KIT_DIR, "..", "..");

/** The owner's playtest the whole design is about (PLAYTEST-2026-09-27-DESIGN.md §0). */
export const PLAYTEST_2026_09_27 = "checkpoints/2026-09-27T20-14-57-505Z.md";
/** The D11 corpus (HUMAN-INTENTS-DESIGN.md §7): row ids, source transcripts and rounds. */
export const D11_CORPUS = "checkpoints/2026-09-26-human-intents/corpus.json";

export type Principal = "warden" | "prisoner";

// ---------------------------------------------------------------------------------------------------------------
// The game's arms, read from the env exactly as `src/checkpoint.ts` reads them.

export interface GameArms {
  presence: ReturnType<typeof readPresenceMode>;
  absence: ReturnType<typeof readAbsenceMode>;
  conditions: ReturnType<typeof readConditionsMode>;
  door: ReturnType<typeof readDoorMode>;
  doorPrice: ReturnType<typeof readDoorPrice>;
  window: ReturnType<typeof readWindowMode>;
  block: ReturnType<typeof readBlockMode>;
  personInstrument: ReturnType<typeof readPersonInstrumentMode>;
  /** the-prisoner#1, additive (2026-09-28): a new referee-side arm, the same shape as `block`/`personInstrument`
   *  above -- read from the same env var `src/checkpoint.ts` reads, so a probe's arm is never a hand-typed guess
   *  at the game's own default. */
  harm: ReturnType<typeof readHarmMode>;
  oneAct: ReturnType<typeof readOneActMode>;
  instrument: ReturnType<typeof readInstrumentMode>;
  deriveWording: ReturnType<typeof readDeriveWordingMode>;
  elision: ReturnType<typeof readElisionMode>;
  containerClause: ReturnType<typeof readContainerClauseMode>;
  deriveRepeat: ReturnType<typeof readDeriveRepeatMode>;
  refereeThinking: string;
  witsThinking: string;
}

/** Every arm a game reads, through the game's own readers (each throws on an unrecognised value). A probe
 *  overrides an arm only by passing `overrides`, and the override is printed in its meta line -- never by
 *  setting a variable the reader of the results cannot see. */
export function gameArms(env: NodeJS.ProcessEnv = process.env, overrides: Partial<GameArms> = {}): GameArms {
  const arms: GameArms = {
    presence: readPresenceMode(env.PRISONER_PRESENCE),
    absence: readAbsenceMode(env.PRISONER_ABSENCE),
    conditions: readConditionsMode(env.PRISONER_CONDITIONS),
    door: readDoorMode(env.PRISONER_DOOR),
    doorPrice: readDoorPrice(env.PRISONER_DOOR_PRICE),
    window: readWindowMode(env.PRISONER_WINDOW),
    block: readBlockMode(env.PRISONER_BLOCK),
    personInstrument: readPersonInstrumentMode(env.PRISONER_PERSON_INSTRUMENT),
    harm: readHarmMode(env.PRISONER_HARM),
    oneAct: readOneActMode(env.PRISONER_ONE_ACT),
    instrument: readInstrumentMode(env.PRISONER_INSTRUMENT),
    deriveWording: readDeriveWordingMode(env.PRISONER_DERIVE_WORDING),
    elision: readElisionMode(env.PRISONER_ELISION),
    containerClause: readContainerClauseMode(env.PRISONER_CONTAINER_CLAUSE),
    deriveRepeat: readDeriveRepeatMode(env.PRISONER_DERIVE_REPEAT),
    refereeThinking: resolveRefereeThinking(env.PRISONER_REFEREE_THINKING, env.PRISONER_THINKING).mode,
    witsThinking: resolveWitsThinking(env.PRISONER_WITS_THINKING, env.PRISONER_THINKING).mode,
  };
  return { ...arms, ...overrides };
}

/** A fresh world at these arms, in the probe's own in-memory database (one database, a fresh gameId per world). */
let dbReady = false;
export function freshWorld(arms: GameArms): any {
  if (!dbReady) {
    createTestDb();
    dbReady = true;
  }
  return buildOpenWorld({ doorPrice: arms.doorPrice, presence: arms.presence, window: arms.window, harm: arms.harm });
}

/** The options `src/checkpoint.ts`'s `mainOpen` passes `createReferee`, bound to THIS world. */
export function refereeOptions(world: any, arms: GameArms): Record<string, unknown> {
  return {
    isDeclared: (objectId: string, key: string) => declaredProperty(world, objectId, key) !== undefined,
    kindOf: (objectId: string) => derivedKindOf(world, objectId),
    propertiesOf: (objectId: string) => declaredPropertyKeys(world, objectId),
    instrumentMode: arms.instrument,
    deriveWording: arms.deriveWording,
    elisionMode: arms.elision,
    containerClauseMode: arms.containerClause,
    repeatDeriveMode: arms.deriveRepeat,
    oneAct: arms.oneAct,
    blockMode: arms.block,
    personInstrumentMode: arms.personInstrument,
    harmMode: arms.harm,
  };
}

/** The condition list a chair's mind is given, exactly as `src/checkpoint.ts` decides it: the warden only under
 *  `both`, the prisoner under anything but `off`. `undefined` means rule sentences (`mind.ts`'s `stateBasedRules`). */
export function conditionsFor(principal: Principal, arms: GameArms): any[] | undefined {
  const on = principal === "warden" ? arms.conditions === "both" : arms.conditions !== "off";
  return on ? openConditions({ door: arms.door, doorPrice: arms.doorPrice, window: arms.window, block: arms.block, harm: arms.harm }) : undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Recorded transcripts: the words each principal wrote, and the keys the referee chose. Nothing else is read.

export interface RecordedRow {
  question: string;
  answer: string;
  citation: { sourceId: string; quote: string } | null;
}
export interface RecordedHalf {
  round: number;
  chair: Principal;
  intent: string | null;
  line?: string;
  plan?: string;
  notes?: string;
  replanned?: boolean;
  replanBecause?: string;
  rows: RecordedRow[];
  ruled: "possible" | "impossible" | null;
  /** The `**Other perceives:**` line as the game printed it -- this repository's own output, quoted. */
  otherPerceives?: string;
  /** The half-round's whole section, for a scorer that reads one more structural line (P5's outcome block). */
  body: string;
}
export interface RecordedGame {
  file: string;
  rounds: number;
  halves: RecordedHalf[];
}

const HEADING = /^### Round (\d+) \(t=\d+\) -- the (warden|prisoner)$/gm;
// The referee table row `checkpointTranscript.ts` writes, as `batchMeasures.ts` reads it.
const ROW = /^\| (\w+) \| `([^`]*)` \| (.*) \| (yes|no|n\/a) \|$/gm;
const CELL = /^(\S+?)(?:, words (\d+)-(\d+))?: "([\s\S]*)"$/;

/** Structural lines only (the `checkpointTranscript.ts` format): the half-round heading, `**Intent:**`,
 *  `**Line:**`, `**Plan:**`, `**Notes:**`, `**Replanned because:**`, the table after `**Referee:**` (the ruling
 *  the half-round ACTED on -- a D3 reconsideration's first reading is printed before that marker and skipped),
 *  and `**Ruled:**`. */
export function parseRecordedGame(relPath: string): RecordedGame {
  return parseRecordedText(readFileSync(join(REPO, relPath), "utf8"), relPath);
}

/** `parseRecordedGame` over text already read (P5's scoreboard reads transcripts from its own arm directories). */
export function parseRecordedText(text: string, relPath: string): RecordedGame {
  const rounds = Number(/^Rounds \(max\): (\d+)\./m.exec(text)?.[1] ?? "12");
  const parts = text.split(HEADING);
  const halves: RecordedHalf[] = [];
  for (let i = 1; i + 2 <= parts.length; i += 3) {
    const round = Number(parts[i]);
    const chair = parts[i + 1] as Principal;
    const body = (parts[i + 2] ?? "").split(/^## /m)[0];
    const one = (re: RegExp) => re.exec(body)?.[1];
    const refAt = body.indexOf("**Referee:**");
    const ruledAt = body.indexOf("**Ruled:**", refAt);
    const table = refAt >= 0 ? body.slice(refAt, ruledAt >= 0 ? ruledAt : undefined) : "";
    const rows: RecordedRow[] = [];
    for (const m of table.matchAll(ROW)) {
      const c = m[3] === "(none)" ? null : CELL.exec(m[3]);
      rows.push({ question: m[1], answer: m[2], citation: c ? { sourceId: c[1], quote: c[4] } : null });
    }
    const replanBecause = one(/^\*\*Replanned because:\*\* (.*)$/m);
    halves.push({
      round,
      chair,
      intent: one(/^\*\*Intent:\*\* (.*)$/m) ?? null,
      ...(one(/^\*\*Line:\*\* "(.*)"$/m) !== undefined ? { line: one(/^\*\*Line:\*\* "(.*)"$/m) } : {}),
      ...(one(/^\*\*Plan:\*\* (.*)$/m) !== undefined ? { plan: one(/^\*\*Plan:\*\* (.*)$/m) } : {}),
      ...(one(/^\*\*Notes:\*\* (.*)$/m) !== undefined ? { notes: one(/^\*\*Notes:\*\* (.*)$/m) } : {}),
      ...(replanBecause !== undefined ? { replanned: true, replanBecause } : {}),
      rows,
      ruled: (one(/^\*\*Ruled:\*\* (possible|impossible)/m) as RecordedHalf["ruled"]) ?? null,
      ...(one(/^\*\*Other perceives:\*\* (.*)$/m) !== undefined ? { otherPerceives: one(/^\*\*Other perceives:\*\* (.*)$/m) } : {}),
      body,
    });
  }
  return { file: relPath, rounds, halves };
}

/** A transport that answers the RECORDED keys for one half-round. A recorded quote that is no longer in its
 *  source (a description the world now words differently) is replaced by the whole source text -- still
 *  verbatim, so the recorded key stands -- and reported, never hidden. */
function recordedTransport(half: RecordedHalf, warn: (w: string) => void) {
  return async (request: { questions: readonly { id: string; answerKeys: readonly string[] }[]; sources: readonly { id: string; text: string }[] }) => {
    const intentText = request.sources.find((s) => s.id === "intent")?.text ?? "";
    return request.questions.map((q) => {
      const row = half.rows.find((r) => r.question === q.id);
      const answerKey = row?.answer ?? "none";
      if (!q.answerKeys.includes(answerKey)) warn(`round ${half.round} ${half.chair}: recorded ${q.id} \`${answerKey}\` is not an answer key today`);
      let citation = { sourceId: "intent", quote: intentText };
      if (row?.citation) {
        const src = request.sources.find((s) => s.id === row.citation!.sourceId);
        if (src && src.text.includes(row.citation.quote)) citation = { sourceId: src.id, quote: row.citation.quote };
        else if (src) {
          citation = { sourceId: src.id, quote: src.text };
          warn(`round ${half.round} ${half.chair}: ${q.id}'s recorded quote is not in ${src.id} today -- cited the whole source`);
        } else warn(`round ${half.round} ${half.chair}: ${q.id}'s recorded source ${row.citation.sourceId} is not perceived today`);
      }
      return { questionId: q.id, answerKey, citation };
    });
  };
}

class Captured extends Error {
  constructor(readonly context: any) {
    super("captured");
  }
}

export interface RebuiltContext {
  world: any;
  context: any;
  arms: GameArms;
  warnings: string[];
  /** Per replayed half-round: whether the replay's own ruling applied where the recorded one did. */
  divergences: string[];
  halvesReplayed: number;
}

/**
 * The context a principal would be handed at `round`, rebuilt by playing the recorded game's earlier half-rounds
 * again through `runOpenGame` at `arms` -- each mind replaced by its recorded proposal, the referee by its
 * recorded keys (one-act reading off: the recorded keys are already the acted-on ones). Stops at the target
 * half-round and returns the context the game built for it.
 *
 * `historyAbsence` (default `"off"`): the recorded games had no absence cadence, so their warden turns on rounds
 * 4 and 8 exist and were played. Replaying them under `cadence` would skip turns the record depends on (this
 * game's round-8 look is the +30 of evidence behind round 9's suspicion 90, RED-TEAM.md F1). So history is
 * replayed with the cadence off, and when the probe's arms say `cadence`, the standing rule line the game would
 * print (`absenceRuleLine()`) is inserted after the presence line of the captured briefing, exactly where
 * `buildOpenBriefing` puts it. Pass `"cadence"` to replay history under the cadence instead (turns the record
 * holds on absent rounds are then skipped, as a real game would skip them).
 *
 * `transcript: null` rebuilds a fresh world with every earlier half-round silent (a corpus row with no source
 * transcript).
 */
export async function rebuildContext(params: {
  transcript: string | null;
  chair: Principal;
  round: number;
  arms: GameArms;
  rounds?: number;
  historyAbsence?: "off" | "cadence";
  /** Recorded half-rounds to replay as silent instead (`--omit=prisoner:2`), for an owner who decides a recorded
   *  ruling should not stand in today's world. Printed in every meta line; empty by default. */
  omit?: readonly { chair: Principal; round: number }[];
}): Promise<RebuiltContext> {
  const { chair, round, arms } = params;
  const recorded = params.transcript ? parseRecordedGame(params.transcript) : { file: "(none)", rounds: params.rounds ?? 30, halves: [] };
  const world = freshWorld(arms);
  const resolver = buildOpenResolver();
  const warnings: string[] = [];
  const divergences: string[] = [];
  let current: RecordedHalf | null = null;
  let replayed = 0;

  const scripted = (principal: Principal) => ({
    async consider(context: any) {
      const n = Number(/^Round (\d+) of/.exec(context.briefing)?.[1] ?? "0");
      if (principal === chair && n === round) throw new Captured(context);
      const omitted = (params.omit ?? []).some((o) => o.chair === principal && o.round === n);
      const half = omitted ? null : (recorded.halves.find((h) => h.chair === principal && h.round === n) ?? null);
      current = half;
      if (!half || half.intent === null) return null;
      replayed += 1;
      return {
        intent: half.intent,
        line: half.line ?? "",
        ...(half.plan !== undefined ? { plan: half.plan } : {}),
        ...(half.notes !== undefined ? { notes: half.notes } : {}),
        ...(half.replanned ? { replanned: true, replanBecause: half.replanBecause } : {}),
      };
    },
  });
  // A fresh referee per ruling: no cache can serve one half-round's recorded keys to another.
  const referee = {
    async rule(intentText: string, perceived: any[]) {
      const half = current;
      if (!half) throw new Error("rebuildContext: the referee was asked with no recorded half-round in hand");
      const r = await createReferee([recordedTransport(half, (w) => warnings.push(w)) as any], { ...refereeOptions(world, arms), oneAct: "off" } as any).rule(intentText, perceived);
      const recordedApplied = half.ruled === "possible";
      if (r.applicable !== recordedApplied) divergences.push(`round ${half.round} ${half.chair}: recorded ${half.ruled}, replayed ${r.applicable ? "possible" : "impossible"} (${half.rows.find((x) => x.question === "target")?.answer}/${half.rows.find((x) => x.question === "effect")?.answer})`);
      return r;
    },
  };

  let captured: any = null;
  try {
    await runOpenGame({
      openWorld: world,
      resolver,
      referee: referee as any,
      wardenMind: scripted("warden") as any,
      prisonerMind: scripted("prisoner") as any,
      rounds: params.rounds ?? recorded.rounds,
      presenceMode: arms.presence,
      absenceMode: params.historyAbsence ?? "off",
    });
  } catch (err) {
    if (!(err instanceof Captured)) throw err;
    captured = err.context;
  }
  if (!captured) throw new Error(`rebuildContext: ${recorded.file} ended before round ${round}, ${chair} -- nothing to capture`);
  const withLine = arms.absence === "cadence" && (params.historyAbsence ?? "off") === "off" ? { ...captured, briefing: insertAbsenceLine(captured.briefing) } : captured;
  return { world, context: withLine, arms, warnings, divergences, halvesReplayed: replayed };
}

/** `buildOpenBriefing` puts the cadence line right after the presence line; this puts it in the same place. A
 *  literal check for this repository's own two presence sentences, nothing else. */
export function insertAbsenceLine(briefing: string): string {
  const lines = briefing.split("\n");
  const presence = [`${PRISONER_NAME} is here with you.`, `${WARDEN_NAME} is here with you.`, `${PRISONER_NAME} is not here right now.`, `${WARDEN_NAME} is not here right now.`];
  const at = lines.findIndex((l) => presence.includes(l));
  if (at < 0 || lines.includes(absenceRuleLine())) return briefing;
  lines.splice(at + 1, 0, absenceRuleLine());
  return lines.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Requests: the exact bytes a model would be sent, without sending them.

/** Every request one `rule()` makes, captured by a transport that answers nothing (so the one-act reading and
 *  the six-question reading are both captured, and nothing is split). */
export async function captureRefereeRequests(world: any, arms: GameArms, intent: string, perceived: any[], wrap?: (transport: any) => any): Promise<any[]> {
  const requests: any[] = [];
  const captor = async (request: any) => {
    requests.push(request);
    return [];
  };
  // A probe-local transport arm (P7) wraps the captor exactly as it wraps the real transport, so the dry run
  // shows the bytes' order the live run would send.
  await createReferee([(wrap ? wrap(captor) : captor) as any], refereeOptions(world, arms) as any).rule(intent, perceived);
  return requests;
}

/** A transport wrapper that records every exchange it carries -- which intent text each call ruled on and the
 *  keys that came back. Under `oneAct: first` this is how a probe sees the truncated ruling's own keys (D7),
 *  which the returned ruling keeps only when it applied. */
export interface TraceEntry {
  questionIds: string[];
  intent: string;
  answers: { questionId: string; answerKey: string }[];
  /** Wall time of the call as this process saw it, and the transport's own `ms` when it keeps one (P7). */
  ms: number;
  exchangeMs: number | null;
}
export function tracing(transport: any): { transport: any; trace: TraceEntry[] } {
  const trace: TraceEntry[] = [];
  const wrapped = async (request: any) => {
    const t0 = performance.now();
    const answers = await transport(request);
    trace.push({
      questionIds: request.questions.map((q: any) => q.id),
      intent: request.sources.find((s: any) => s.id === "intent")?.text ?? "",
      answers: Array.isArray(answers) ? answers.map((a: any) => ({ questionId: a.questionId, answerKey: a.answerKey })) : [],
      ms: Math.round(performance.now() - t0),
      exchangeMs: transport.lastExchange?.()?.ms ?? null,
    });
    return answers;
  };
  (wrapped as any).lastExchange = () => transport.lastExchange?.();
  return { transport: wrapped, trace };
}

/** The keys of a ruling, flat, for a results row. */
export function keysOf(r: any): Record<string, unknown> {
  if (!r) return {};
  return {
    target: r.targetObjectId,
    effect: r.effectKind,
    property: r.property,
    product: r.product,
    magnitude: r.magnitude,
    perceptibility: r.perceptibility,
    applicable: r.applicable,
    citations: {
      target: r.citations?.target?.citation?.quote ?? null,
      targetVerified: r.citations?.target?.verified ?? null,
      effect: r.citations?.effect?.citation?.quote ?? null,
      effectVerified: r.citations?.effect?.verified ?? null,
      property: r.citations?.property?.citation?.quote ?? null,
      propertyVerified: r.citations?.property?.verified ?? null,
    },
  };
}

/** The one-act record of a ruling (D7): the answer, whether it flagged, and -- when the first act was attempted --
 *  its words and the whole intent's own keys. */
export function oneActOf(r: any): Record<string, unknown> | null {
  const o = r?.oneAct;
  if (!o) return null;
  return {
    answer: o.answer,
    flagged: o.flagged,
    ...(o.attempted ? { attempted: o.attempted, fullRuling: keysOf(o.fullRuling) } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Live mode: the models, built exactly as `src/checkpoint.ts` builds them, through its swapper and guard.

export interface LiveModels {
  describe: string[];
  refereeTransport(): any;
  mind(principal: Principal, conditions: any[] | undefined, onSilence?: (reason: string, detail?: { text?: string }) => void): any;
  finish(): Promise<void>;
}

export async function liveModels(env: NodeJS.ProcessEnv, arms: GameArms): Promise<LiveModels> {
  const baseUrl = env.PRISONER_MODEL_URL;
  if (!baseUrl) throw new Error("live run: set PRISONER_MODEL_URL explicitly (http://doris:11434/v1 for the local card) -- a probe never guesses its endpoint");
  const refereeModel = resolveRefereeModel(env.PRISONER_REFEREE_MODEL);
  const wits = env.PRISONER_WITS_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL;
  const voice = resolveVoiceModel(wits, env.PRISONER_VOICE_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(env.PRISONER_SKIP_VOICE));
  const seats = { prisoner: resolveSeatModels(env.PRISONER_PRISONER_MODEL, { wits, voice }), warden: resolveSeatModels(env.PRISONER_WARDEN_MODEL, { wits, voice }) };
  const residents = (env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const allowed = [...new Set([...seatModelNames(seats.prisoner, seats.warden), refereeModel, ...residents])];
  const swapper = new OllamaModelSwapper({ nativeBaseUrl: nativeBaseUrl(baseUrl, env.PRISONER_OLLAMA_NATIVE_URL), allowedModels: allowed });
  const ps = await swapper.fetchPs();
  assertNoForeignModel(ps, allowed);
  const residentsAtStart = ps.models.map((m: any) => m.name).filter((n: string) => residents.includes(n));
  const ensureLoaded = (m: string) => swapper.withModel(m, async () => {});
  const thinkTimeout = env.PRISONER_THINK_TIMEOUT_MS ? Number(env.PRISONER_THINK_TIMEOUT_MS) : undefined;
  const refereeTimeout = env.PRISONER_REFEREE_TIMEOUT_MS ? Number(env.PRISONER_REFEREE_TIMEOUT_MS) : thinkTimeout;
  return {
    describe: [
      `endpoint ${baseUrl}; referee ${refereeModel}; warden ${seats.warden.wits}/${seats.warden.voice}; prisoner ${seats.prisoner.wits}/${seats.prisoner.voice}`,
      `thinking referee=${arms.refereeThinking} wits=${arms.witsThinking}; timeouts think=${thinkTimeout ?? "default"} referee=${refereeTimeout ?? "default"}`,
      `/api/ps at start: ${ps.models.map((m: any) => m.name).join(", ") || "none"}`,
    ],
    refereeTransport: () => createRefereeTransport({ baseUrl, model: refereeModel, timeoutMs: refereeTimeout, ensureLoaded, thinking: arms.refereeThinking as any }),
    mind: (principal, conditions, onSilence) =>
      (principal === "warden" ? createOpenWardenMind : createOpenPrisonerMind)({
        baseUrl,
        witsModel: seats[principal].wits,
        voiceModel: seats[principal].voice,
        timeoutMs: thinkTimeout,
        ensureLoaded,
        thinking: arms.witsThinking as any,
        ...(onSilence ? { onSilence: (reason: string, _c: unknown, detail?: { text?: string }) => onSilence(reason, detail) } : {}),
        ...(conditions ? { conditions } : {}),
      }),
    finish: () => swapper.restoreResidents(residentsAtStart),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Discipline: no network in a dry run; one driver; a pinned commit; results appended as they come.

export function forbidNetwork(): void {
  globalThis.fetch = (async () => {
    throw new Error("dry run: the network is forbidden (checkpoints/2026-09-28-probe-kit/kit.mts forbidNetwork)");
  }) as typeof fetch;
}

/**
 * `--rehearse --out=DIR`: the whole `--live` path -- swapper, guard, transports, minds, results, log, scoreboard --
 * against an IN-PROCESS stand-in for the model server, so the live code is exercised by `npm test` without a
 * socket ever opening. The stand-in answers `/api/ps` with the default model loaded, and every chat completion
 * with something well-formed and meaningless: a referee reply picks each question's FIRST answer key and cites the
 * intent's first word; a mind reply proposes one fixed intent. Nothing it returns is evidence of anything, and a
 * rehearsal writes only under `--out`, never beside the probe.
 */
export const REHEARSAL_INTENT = "Examine the window closely.";
export function installRehearsalFetch(): void {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  globalThis.fetch = (async (input: string | URL, init?: { body?: string }) => {
    const url = String(input);
    if (url.endsWith("/api/ps")) return json({ models: [{ name: DEFAULT_MIND_MODEL }] });
    if (url.endsWith("/api/generate")) return json({});
    if (url.endsWith("/chat/completions")) {
      const body = JSON.parse(init?.body ?? "{}");
      const prompt: string = (body.messages ?? []).map((m: any) => m.content).join("\n");
      let content: string;
      if (prompt.startsWith("You are ruling on one attempted action")) {
        const answers = [...prompt.matchAll(/^- id "([^"]+)": .* Answer with exactly one of: (.+)\.$/gm)].map((m) => ({
          questionId: m[1],
          answerKey: m[2].split(", ")[0],
          citation: { sourceId: "intent", from: 1, to: 1 },
        }));
        content = JSON.stringify(answers);
      } else {
        content = JSON.stringify({
          thoughts: "rehearsal",
          candidates: [
            { text: REHEARSAL_INTENT, reason: "rehearsal" },
            { text: "Wait.", reason: "rehearsal" },
          ],
          intent: REHEARSAL_INTENT,
          line: "",
          plan: "rehearsal",
          replanned: false,
          replanBecause: "",
          notes: "rehearsal",
        });
      }
      return json({ choices: [{ message: { content } }], usage: { completion_tokens: 1 } });
    }
    throw new Error(`rehearsal: no stand-in for ${url}`);
  }) as typeof fetch;
}

/** How a run is being made: `live` (the real thing), `rehearse` (the live path against the in-process stand-in),
 *  and where it writes and which lock it takes. */
export function runMode(a: ReturnType<typeof args>, probeDir: string): { rehearse: boolean; outDir: string; lock: string; revision: () => string } {
  const rehearse = a.has("rehearse");
  if (!rehearse) return { rehearse, outDir: probeDir, lock: DRIVER_LOCK, revision: () => pinnedRevision(a.has("allow-dirty")) };
  const out = a.get("out");
  if (!out) throw new Error("--rehearse needs --out=DIR: a rehearsal never writes beside the probe");
  mkdirSync(out, { recursive: true });
  installRehearsalFetch();
  process.env.PRISONER_MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://rehearsal.invalid/v1";
  return { rehearse, outDir: out, lock: join(out, "driver.lock"), revision: () => `rehearsal (${describeRunRevision()})` };
}

/** CLAUDE.md "One driver at a time": the same lock directory every 2026-09-28 probe and `run-batch.sh` take. A
 *  second driver finds it and stops before calling anything. `mkdir` is atomic in both node and bash. */
export const DRIVER_LOCK = "/tmp/the-prisoner-one-driver.lock";
export function takeDriverLock(label: string, lock: string = DRIVER_LOCK): () => void {
  try {
    mkdirSync(lock);
  } catch {
    const holder = existsSync(join(lock, "holder")) ? readFileSync(join(lock, "holder"), "utf8") : "unknown";
    throw new Error(`another driver holds ${lock} (${holder.trim()}): one driver at a time (CLAUDE.md). Remove it only if you know that driver is dead.`);
  }
  writeFileSync(join(lock, "holder"), `${label} pid ${process.pid} since ${new Date().toISOString()}\n`);
  const release = () => rmSync(lock, { recursive: true, force: true });
  process.on("exit", release);
  return release;
}

/** CLAUDE.md "Run a batch from a pinned commit": the revision the run names, and a refusal when it names none. */
export function pinnedRevision(allowDirty: boolean): string {
  const rev = describeRunRevision();
  if (!rev.endsWith("(clean)") && !allowDirty) throw new Error(`the tree is not clean (${rev}): run from a pinned commit, or pass --allow-dirty and say so in RESULTS.md`);
  return rev;
}

/** A probe's run log under its own `logs/` (named `.txt`: `*.log` is gitignored) plus the console. */
export function openLog(dir: string, name: string): (line: string) => void {
  mkdirSync(join(dir, "logs"), { recursive: true });
  const file = join(dir, "logs", `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  return (line: string) => {
    console.log(line);
    appendFileSync(file, line + "\n");
  };
}

/** `results.jsonl`, appended one row at a time so a crash leaves a usable partial file; returns the ids already
 *  there so a rerun resumes rather than repeats. */
export function resultsFile(dir: string): { append(row: Record<string, unknown>): void; done: Set<string>; rows(): any[] } {
  const path = join(dir, "results.jsonl");
  const read = () => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  return {
    append: (row) => appendFileSync(path, JSON.stringify(row) + "\n"),
    done: new Set(read().filter((r: any) => r.sampleId).map((r: any) => r.sampleId as string)),
    rows: read,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The scoreboard convention (the owner, 2026-09-21/22): so-far, projected at N, and DEAD/OPEN at every poll.

export interface Prediction {
  id: string;
  text: string;
  /** Items (samples, or games) counted so far, and how many of them meet the prediction's condition. */
  hits: number;
  seen: number;
  /** The pre-registered N. */
  total: number;
  /** `atLeast k`, `atMost k`, or `between [a, b]`; `report` carries no bound (reported, no weight). */
  bound: { atLeast?: number; atMost?: number } | "report";
  /** A prediction that is not a count of hits (P4's difference between two cells) brings its own columns. */
  custom?: { soFar: string; projected: string; verdict: "DEAD" | "OPEN" | "MET" | "REPORT" };
}

/** DEAD is arithmetic, never judgement: an `atMost k` dies when hits already exceed k; an `atLeast k` dies when
 *  hits plus every item still to come cannot reach k. A dead prediction is ANNOUNCED on the poll it dies. */
export function verdict(p: Prediction): "DEAD" | "OPEN" | "MET" | "REPORT" {
  if (p.custom) return p.custom.verdict;
  if (p.bound === "report") return "REPORT";
  const remaining = Math.max(0, p.total - p.seen);
  if (p.bound.atMost !== undefined && p.hits > p.bound.atMost) return "DEAD";
  if (p.bound.atLeast !== undefined && p.hits + remaining < p.bound.atLeast) return "DEAD";
  if (remaining === 0) return "MET";
  // A floor already reached with no ceiling can no longer die.
  if (p.bound.atMost === undefined && p.bound.atLeast !== undefined && p.hits >= p.bound.atLeast) return "MET";
  return "OPEN";
}

export function renderScoreboard(title: string, predictions: Prediction[]): string[] {
  const out = [`## ${title}`, "", "| id | prediction | so far | projected at N | verdict |", "|---|---|---|---|---|"];
  for (const p of predictions) {
    const projected = p.custom?.projected ?? (p.seen === 0 ? "-" : `${Math.round((p.hits / p.seen) * p.total * 10) / 10} of ${p.total}`);
    out.push(`| ${p.id} | ${p.text} | ${p.custom?.soFar ?? `${p.hits} of ${p.seen}`} | ${projected} | ${verdict(p)} |`);
  }
  const dead = predictions.filter((p) => verdict(p) === "DEAD");
  out.push("");
  out.push(dead.length === 0 ? "No prediction is dead at this poll." : `**DEAD AT THIS POLL: ${dead.map((p) => p.id).join(", ")}** -- announce it now and apply the stopping rule (the owner, 2026-09-21).`);
  return out;
}

/** `--flag=value` and bare `--flag` from argv. */
export function args(argv: readonly string[]): { has(flag: string): boolean; get(flag: string): string | undefined } {
  return {
    has: (flag) => argv.includes(`--${flag}`) || argv.some((a) => a.startsWith(`--${flag}=`)),
    get: (flag) => argv.find((a) => a.startsWith(`--${flag}=`))?.split("=").slice(1).join("="),
  };
}

/** One printable line of the arms a run used -- the first line of every results file and log. */
export function armsLine(arms: GameArms): string {
  return Object.entries(arms)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
}

// ---------------------------------------------------------------------------------------------------------------
// Two runners: referee-only probes (P1, P3, P6, P7) and mind-then-referee probes (P2, P4). One CLI shape for all:
//
//   npx tsx <probe>.mts --dry-run [--only=ID,ID]          build and print every request; no network, no lock
//   npx tsx <probe>.mts --live [--only=ID,ID] [--allow-dirty]   the real run: one driver, serial, appends results.jsonl
//   npx tsx <probe>.mts --score                           the scoreboard over results.jsonl (and LABELS.json if any)

export interface Item {
  id: string;
  transcript: string | null;
  chair: Principal;
  round: number;
  intent: string;
  [key: string]: unknown;
}

export interface RefereeArm {
  name: string;
  /** Arms this cell overrides; each is printed in the meta line. Only referee-side arms may differ here. */
  overrides?: Partial<GameArms>;
  /** A probe-local change to what the referee is SHOWN (P6's pre-D9 descriptions), applied to the perceived list. */
  perceived?: (objects: any[], item: Item) => any[];
  /** A probe-local change to the request's byte order (P7), applied inside the transport. */
  wrapTransport?: (transport: any) => any;
}

/** `--omit=prisoner:2,warden:4` -> half-rounds of the owner's playtest replayed as silent (`rebuildContext`). */
export function omitArg(a: ReturnType<typeof args>): { chair: Principal; round: number }[] {
  return (a.get("omit") ?? "")
    .split(",")
    .filter(Boolean)
    .map((x) => {
      const [chair, round] = x.split(":");
      if ((chair !== "prisoner" && chair !== "warden") || !Number.isInteger(Number(round))) throw new Error(`--omit: "${x}" is not chair:round`);
      return { chair: chair as Principal, round: Number(round) };
    });
}

/** A run stops after this many errored samples in a row (every PREDICTION.md's stopping rule). */
export const MAX_ERRORS_IN_A_ROW = 3;

// the-prisoner#1, additive (2026-09-28): `harm` gates a resource `buildOpenWorld` creates (like the others
// here), so a probe that varies it -- as this issue's own probe does -- must bust the rebuilt-context cache on
// it too, or a later arm silently reuses an earlier arm's world (built without the resource it needs).
const WORLD_ARMS: readonly (keyof GameArms)[] = ["presence", "absence", "doorPrice", "window", "harm"];

async function contextFor(cache: Map<string, RebuiltContext>, item: Item, arms: GameArms, omit: readonly { chair: Principal; round: number }[] = []): Promise<RebuiltContext> {
  const key = `${item.transcript}|${item.chair}|${item.round}|${WORLD_ARMS.map((k) => arms[k]).join(",")}|${JSON.stringify(omit)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // `--omit` names half-rounds of the owner's playtest only (the one game whose round-2 ruling it exists for).
  const built = await rebuildContext({ transcript: item.transcript, chair: item.chair, round: item.round, arms, omit: item.transcript === PLAYTEST_2026_09_27 ? omit : [] });
  cache.set(key, built);
  return built;
}

export async function runRefereeProbe(opts: {
  dir: string;
  name: string;
  items: Item[];
  arms: RefereeArm[];
  n: number;
  argv: readonly string[];
  score: (rows: any[], items: Item[]) => string[];
  /** Ids of questions whose full prompt the dry run prints for the first item of each arm. */
  showQuestions?: string[];
  /** A check on the resolved arms that must hold or the probe measures nothing (P1 needs `oneAct: first`). */
  requireArms?: (arms: GameArms) => string | null;
  /** A pre-registered stopping rule, checked after every completed item: a reason stops the run there. */
  stopWhen?: (rows: any[], items: Item[]) => string | null;
}): Promise<void> {
  const a = args(opts.argv);
  const only = a.get("only")?.split(",") ?? null;
  const items = opts.items.filter((i) => !only || only.includes(i.id));
  const base = gameArms();
  const cache = new Map<string, RebuiltContext>();
  const omit = omitArg(a);

  if (a.has("score")) {
    const rows = resultsFile(a.get("out") ?? opts.dir).rows().filter((r: any) => r.sampleId);
    for (const line of opts.score(rows, opts.items)) console.log(line);
    return;
  }
  const dry = a.has("dry-run");
  if (!dry && !a.has("live") && !a.has("rehearse")) throw new Error(`${opts.name}: pass --dry-run, --live, --rehearse --out=DIR or --score`);

  if (dry) {
    forbidNetwork();
    console.log(`${opts.name} DRY RUN -- no model is called; the network is forbidden in this process.`);
    console.log(`arms (env): ${armsLine(base)}${omit.length ? `; omitted from the playtest's history: ${omit.map((o) => `${o.chair}:${o.round}`).join(",")}` : ""}`);
    let requests = 0;
    for (const arm of opts.arms) {
      const arms = { ...base, ...(arm.overrides ?? {}) };
      const problem = opts.requireArms?.(arms);
      if (problem) throw new Error(`${opts.name}: ${problem}`);
      console.log(`\n=== arm ${arm.name}${arm.overrides ? ` (overrides: ${JSON.stringify(arm.overrides)})` : ""}, N=${opts.n} per item`);
      let first = true;
      for (const item of items) {
        const built = await contextFor(cache, item, arms, omit);
        const perceived = arm.perceived ? arm.perceived(built.context.perceivedObjects, item) : built.context.perceivedObjects;
        const reqs = await captureRefereeRequests(built.world, arms, item.intent, perceived, arm.wrapTransport);
        requests += reqs.length;
        const main = reqs[0];
        const effect = main.questions.find((q: any) => q.id === "effect");
        console.log(
          `${item.id.padEnd(12)} ${item.chair} r${item.round} "${item.intent.slice(0, 70)}" | perceived ${perceived.map((o: any) => o.id).join(",")} | calls ${reqs.map((r: any) => r.questions.map((q: any) => q.id).join("+")).join(" ; ")} | effect keys ${effect?.answerKeys.join(",")}` +
            (built.divergences.length || built.warnings.length ? ` | replay: ${built.divergences.length} divergences, ${built.warnings.length} warnings` : "")
        );
        if (first) {
          console.log(`  [${arm.name}] source order sent: ${main.sources.map((x: any) => x.id).join(", ")}`);
          for (const id of (opts.showQuestions ?? []).filter((x) => !x.startsWith("source:"))) {
            const q = main.questions.find((x: any) => x.id === id);
            console.log(`  [${arm.name}] question ${id}: ${q ? q.prompt : "(not asked)"}`);
          }
          for (const s of main.sources.filter((x: any) => x.id !== "intent" && (opts.showQuestions ?? []).includes(`source:${x.id}`))) console.log(`  [${arm.name}] ${s.id}: ${s.text}`);
          first = false;
        }
      }
    }
    console.log(`\n${items.length} items x ${opts.arms.length} arm(s): ${requests} requests built, none sent. A live run makes ${items.length * opts.arms.length * opts.n} rulings (plus the one-act call each makes under oneAct=first).`);
    return;
  }

  // --live (or --rehearse: the same path against the in-process stand-in)
  const mode = runMode(a, opts.dir);
  const release = takeDriverLock(opts.name, mode.lock);
  const revision = mode.revision();
  const log = openLog(mode.outDir, "run");
  const results = resultsFile(mode.outDir);
  const live = await liveModels(process.env, base);
  try {
    const meta = { type: "meta", probe: opts.name, started: new Date().toISOString(), revision, arms: armsLine(base), omit, cells: opts.arms.map((c) => ({ name: c.name, overrides: c.overrides ?? {} })), n: opts.n, models: live.describe };
    results.append(meta);
    log(JSON.stringify(meta));
    let k = 0;
    let errorsInARow = 0;
    const total = items.length * opts.arms.length * opts.n;
    outer: for (const arm of opts.arms) {
      const arms = { ...base, ...(arm.overrides ?? {}) };
      const problem = opts.requireArms?.(arms);
      if (problem) throw new Error(`${opts.name}: ${problem}`);
      for (const item of items) {
        const built = await contextFor(cache, item, arms, omit);
        const perceived = arm.perceived ? arm.perceived(built.context.perceivedObjects, item) : built.context.perceivedObjects;
        for (let s = 1; s <= opts.n; s++) {
          k += 1;
          const sampleId = `${arm.name}:${item.id}:${s}`;
          if (results.done.has(sampleId)) continue;
          const raw = live.refereeTransport();
          const { transport, trace } = tracing(arm.wrapTransport ? arm.wrapTransport(raw) : raw);
          const t0 = Date.now();
          let row: Record<string, unknown>;
          try {
            // One request at a time: a fresh referee per sample, awaited, never `Promise.all` (CLAUDE.md).
            const ruling = await createReferee([transport], refereeOptions(built.world, arms) as any).rule(item.intent, perceived);
            row = { sampleId, arm: arm.name, item: item.id, sample: s, intent: item.intent, ...keysOf(ruling), oneAct: oneActOf(ruling), trace, secs: (Date.now() - t0) / 1000 };
          } catch (err) {
            row = { sampleId, arm: arm.name, item: item.id, sample: s, intent: item.intent, error: String(err).slice(0, 500), trace, secs: (Date.now() - t0) / 1000 };
          }
          results.append(row);
          log(`[${k}/${total}] ${sampleId} -> ${row.error ? `ERROR ${row.error}` : `${row.target}/${row.effect}/${row.property} applicable=${row.applicable}${(row.oneAct as any)?.attempted ? ` first-act="${(row.oneAct as any).attempted.text}"` : ""}`} (${row.secs}s)`);
          errorsInARow = row.error ? errorsInARow + 1 : 0;
          if (errorsInARow >= MAX_ERRORS_IN_A_ROW) throw new Error(`${MAX_ERRORS_IN_A_ROW} errors in a row: stopped. Check /api/ps and the endpoint, then rerun to resume.`);
        }
        const stop = opts.stopWhen?.(results.rows().filter((r: any) => r.sampleId), opts.items);
        if (stop) {
          log(`STOPPING RULE FIRED: ${stop}`);
          break outer;
        }
      }
    }
    for (const line of opts.score(results.rows().filter((r: any) => r.sampleId), opts.items)) log(line);
  } finally {
    await live.finish();
    release();
  }
}

export interface MindCell {
  name: string;
  round: number;
  chair: Principal;
  /** `env`: the game's own decision (`conditionsFor`); `list`: the condition list; `sentences`: rule sentences. */
  conditions: "env" | "list" | "sentences";
  /** A probe-local, literal change to the rebuilt context (P4's line). */
  transform?: (context: any) => any;
}

export async function runMindProbe(opts: {
  dir: string;
  name: string;
  transcript: string;
  cells: MindCell[];
  n: number;
  argv: readonly string[];
  score: (rows: any[]) => string[];
}): Promise<void> {
  const a = args(opts.argv);
  const only = a.get("only")?.split(",") ?? null;
  const cells = opts.cells.filter((c) => !only || only.includes(c.name));
  const arms = gameArms();
  const cache = new Map<string, RebuiltContext>();
  const conditionsOf = (cell: MindCell) =>
    cell.conditions === "env" ? conditionsFor(cell.chair, arms) : cell.conditions === "list" ? openConditions({ door: arms.door, doorPrice: arms.doorPrice, window: arms.window, block: arms.block, harm: arms.harm }) : undefined;
  const omit = omitArg(a);
  const contextOf = async (cell: MindCell) => {
    const built = await contextFor(cache, { id: cell.name, transcript: opts.transcript, chair: cell.chair, round: cell.round, intent: "" }, arms, omit);
    return { built, context: cell.transform ? cell.transform(built.context) : built.context };
  };

  if (a.has("score")) {
    for (const line of opts.score(resultsFile(a.get("out") ?? opts.dir).rows().filter((r: any) => r.sampleId))) console.log(line);
    return;
  }
  const dry = a.has("dry-run");
  if (!dry && !a.has("live") && !a.has("rehearse")) throw new Error(`${opts.name}: pass --dry-run, --live, --rehearse --out=DIR or --score`);

  if (dry) {
    forbidNetwork();
    console.log(`${opts.name} DRY RUN -- no model is called; the network is forbidden in this process.`);
    console.log(`arms (env): ${armsLine(arms)}`);
    for (const cell of cells) {
      const { built, context } = await contextOf(cell);
      // The mind's own prompt, built by the mind's own code: a fetch that captures the body and answers nothing.
      let prompt = "";
      const captor = (async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        prompt = body.messages?.map((m: any) => m.content).join("\n---\n") ?? "";
        return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200, headers: { "content-type": "application/json" } });
      }) as unknown as typeof fetch;
      const conditions = conditionsOf(cell);
      const mind = (cell.chair === "warden" ? createOpenWardenMind : createOpenPrisonerMind)({ baseUrl: "http://dry-run.invalid/v1", model: "dry-run", fetchFn: captor, thinking: arms.witsThinking as any, ...(conditions ? { conditions } : {}) });
      await mind.consider(context);
      const reqs = await captureRefereeRequests(built.world, arms, "(the intent the mind writes)", context.perceivedObjects);
      console.log(`\n=== cell ${cell.name}: ${cell.chair}, round ${cell.round}, conditions ${cell.conditions}${conditions ? " (list)" : " (rule sentences)"}, N=${opts.n}`);
      console.log(`replay: ${built.halvesReplayed} half-rounds, ${built.divergences.length} divergences, ${built.warnings.length} warnings${omit.length ? `; omitted ${omit.map((o) => `${o.chair}:${o.round}`).join(",")}` : ""}`);
      for (const o of context.perceivedObjects) console.log(`  perceived ${o.id}: ${o.description}`);
      console.log(`referee calls per sample: ${reqs.map((r: any) => r.questions.map((q: any) => q.id).join("+")).join(" ; ")}; effect keys ${reqs[0].questions.find((q: any) => q.id === "effect")?.answerKeys.join(",")}`);
      console.log("--- the mind's prompt, verbatim ---");
      console.log(prompt);
    }
    console.log(`\n${cells.length} cells built, no request sent. A live run makes ${cells.length * opts.n} mind calls and as many rulings (plus one one-act call each under oneAct=first).`);
    return;
  }

  const mode = runMode(a, opts.dir);
  const release = takeDriverLock(opts.name, mode.lock);
  const revision = mode.revision();
  const log = openLog(mode.outDir, "run");
  const results = resultsFile(mode.outDir);
  const live = await liveModels(process.env, arms);
  try {
    const meta = { type: "meta", probe: opts.name, started: new Date().toISOString(), revision, arms: armsLine(arms), omit, cells: opts.cells.map((c) => ({ name: c.name, round: c.round, conditions: c.conditions, transformed: !!c.transform })), n: opts.n, models: live.describe };
    results.append(meta);
    log(JSON.stringify(meta));
    let k = 0;
    let errorsInARow = 0;
    const total = cells.length * opts.n;
    for (const cell of cells) {
      const { built, context } = await contextOf(cell);
      for (let s = 1; s <= opts.n; s++) {
        k += 1;
        const sampleId = `${cell.name}:${s}`;
        if (results.done.has(sampleId)) continue;
        let silence: { reason: string; text?: string } | null = null;
        const mind = live.mind(cell.chair, conditionsOf(cell), (reason, detail) => (silence = { reason, ...(detail?.text ? { text: detail.text.slice(0, 2000) } : {}) }));
        const t0 = Date.now();
        let row: Record<string, unknown>;
        try {
          const proposal = await mind.consider(context);
          if (!proposal) {
            row = { sampleId, cell: cell.name, sample: s, silence, secs: (Date.now() - t0) / 1000 };
          } else {
            const raw = live.refereeTransport();
            const { transport, trace } = tracing(raw);
            const ruling = await createReferee([transport], refereeOptions(built.world, arms) as any).rule(proposal.intent, context.perceivedObjects);
            row = {
              sampleId,
              cell: cell.name,
              sample: s,
              intent: proposal.intent,
              line: proposal.line,
              thoughts: proposal.thoughts,
              candidates: proposal.candidates,
              plan: proposal.plan,
              notes: proposal.notes,
              ...keysOf(ruling),
              oneAct: oneActOf(ruling),
              trace,
              secs: (Date.now() - t0) / 1000,
            };
          }
        } catch (err) {
          row = { sampleId, cell: cell.name, sample: s, error: String(err).slice(0, 500), secs: (Date.now() - t0) / 1000 };
        }
        results.append(row);
        log(`[${k}/${total}] ${sampleId} -> ${row.error ? `ERROR ${row.error}` : row.intent ? `${row.target}/${row.effect}/${row.property} "${String(row.intent).slice(0, 80)}"` : `silence ${JSON.stringify(row.silence)}`} (${row.secs}s)`);
        errorsInARow = row.error ? errorsInARow + 1 : 0;
        if (errorsInARow >= MAX_ERRORS_IN_A_ROW) throw new Error(`${MAX_ERRORS_IN_A_ROW} errors in a row: stopped. Check /api/ps and the endpoint, then rerun to resume.`);
      }
    }
    for (const line of opts.score(results.rows().filter((r: any) => r.sampleId))) log(line);
  } finally {
    await live.finish();
    release();
  }
}

/** Items from the D11 corpus by id, with the corpus's own tested text. */
export function corpusItems(ids: readonly string[], extra: (row: any) => Record<string, unknown> = () => ({})): Item[] {
  const rows: any[] = JSON.parse(readFileSync(join(REPO, D11_CORPUS), "utf8")).rows;
  return ids.map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) throw new Error(`corpus row ${id} not found in ${D11_CORPUS}`);
    return { id, transcript: row.sourceFile ?? null, chair: row.chair, round: row.round, intent: row.intentTested, ...extra(row) };
  });
}

/** A recorded half-round's own intent, from a transcript (this game's rows are not in the D11 corpus). */
export function recordedIntent(transcript: string, chair: Principal, round: number): string {
  const half = parseRecordedGame(transcript).halves.find((h) => h.chair === chair && h.round === round);
  if (!half?.intent) throw new Error(`${transcript}: no intent recorded at round ${round}, ${chair}`);
  return half.intent;
}

/** Group sample rows by a key, for the scorers. */
export function groupBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    out.set(k, [...(out.get(k) ?? []), r]);
  }
  return out;
}

/** An item's majority verdict over its N samples: true when more than half of its N meet `test`; `null` while
 *  fewer than N samples are in. Majority of the PRE-REGISTERED N, so a partial item never scores early. */
export function majority<T>(samples: readonly T[], n: number, test: (r: T) => boolean): boolean | null {
  if (samples.length < n) return null;
  return samples.filter(test).length * 2 > n;
}

/** True when `moduleUrl` is the script node was asked to run (symlinks resolved: `/tmp` is `/private/tmp` here). */
export function isMain(moduleUrl: string): boolean {
  try {
    return process.argv[1] !== undefined && realpathSync(fileURLToPath(moduleUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
