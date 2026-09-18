// The checkpoint (this task's brief; design §10 lands this as P6, but with
// the warden a model too, per correction 1 -- P6's human CLI is out of
// scope here). Up to PRISONER_ROUNDS full rounds (default 12), warden at
// even t, prisoner at odd t, both minds against a local OpenAI-compatible
// endpoint, driven by `src/loop.ts`'s `runHalfRound` -- the same function
// `src/__tests__/loop.test.ts` and `src/__tests__/balance.test.ts` exercise
// deterministically with scripted minds. Writes a Markdown transcript to
// checkpoints/<ISO timestamp>.md.
//
// REVISION (this task's brief, "a battle of wits, not two scripts"): the
// game now has real stakes (ESCAPE/SEARCH, an end condition), belief
// (not truth) in each briefing, and minds that can revise their own plan.
// This script's job grows to match: seed initial belief, run time decay
// once per full round (an audited referee resolution -- design), check for
// the game's end after every half-round, and record refusals, plan
// revisions and silences richly enough that a reader can tell whether the
// two sides actually contested anything.
//
// The database is a fresh scratch file under /tmp -- never a default path
// (root CLAUDE.md hard rule 2 for this whole workspace) -- set before any
// run-dmcp function is called (imports alone do nothing; see run-dmcp's own
// library/application split).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDatabase, initializeSchema, ResolveProtocolError, type Outcome, type Contradiction, type ConstraintViolationError } from "run-dmcp";
import { buildWorld, type World } from "./world/setup.js";
import { buildResolver, checkGameEnd, type GameEnd } from "./world/mechanics.js";
import { prisonerMigration } from "./world/schema.js";
import { authorPlan, renderLedger } from "./ledger/ledger.js";
import { seedInitialBeliefs } from "./ledger/beliefs.js";
import { resolutionDescription } from "./world/facts.js";
import { buildPrisonerContext, buildWardenContext } from "./mind/briefing.js";
import { createPrisonerMind } from "./mind/prisonerMind.js";
import { createWardenMind } from "./mind/wardenMind.js";
import { pinnedDependencyVersion } from "./packageInfo.js";
import { describeRunRevision } from "./runRevision.js";
import { readSkipVoice, resolveVoiceModel, resolveRefereeModel, resolveNarratorModel } from "./modelRoles.js";
import { summarizeLoadedModels, type OllamaPsResponse } from "./ollamaStatus.js";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel } from "./ollamaSwap.js";
import {
  runHalfRound,
  newSilenceTracker,
  noteSilenceReason,
  loudSilenceMessage,
  type Principal,
  type HalfRoundResult,
} from "./loop.js";
import { newWitsSummary, noteWitsEvent, renderWitsSummary } from "./witsSummary.js";
import { getVariant } from "./variant.js";
import { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf, readDoorPrice, OPEN_DOOR_LOCK_MAX, OPEN_DOOR_LOCK_MARGIN } from "./open/world.js";
import { buildOpenResolver } from "./open/mechanics.js";
import { OPEN_OBJECTS } from "./open/scenarioObjects.js";
import { createReferee, readInstrumentMode, readDeriveWordingMode } from "./open/referee.js";
import { readPresenceMode } from "./open/briefing.js";
import { createRefereeTransport } from "./open/refereeTransport.js";
import { createOpenPrisonerMind, createOpenWardenMind } from "./open/mind.js";
import { runOpenGame } from "./open/game.js";
import { renderOpenHalfRound, renderOpenSummary, refereeRequestsFor, type SilenceNote } from "./open/checkpointTranscript.js";
import type { Principal as OpenPrincipal } from "./ledger/beliefs.js";
import { emptyLedger, beginEpisode, seenBefore, parseLedger } from "mother-of-invention";
import { recordGame, precedentLines, readPrecedentPrice } from "./open/precedent.js";
import { KNOWN_APPROACH_SUSPICION_BUMP } from "./open/loop.js";
import { openConditions, readConditionsMode, readDoorMode } from "./open/conditions.js";
import { readPickCondition } from "./open/pickCondition.js";
import { readWardenMode, passiveWardenMind } from "./open/passiveWarden.js";
import { readSeatMode, readViewMode, createHumanSeatMind, assertSeatIsPlayable } from "./open/humanSeat.js";
import { createNarrator, formatViolationTally } from "./open/narrator.js";
import { PRISONER_NAME, WARDEN_NAME } from "./scenario.js";
import { createInterface } from "node:readline/promises";

const dbPath = process.env.PRISONER_CHECKPOINT_DB ?? `/tmp/the-prisoner-checkpoint-${Date.now()}.db`;
process.env.DMCP_DB_PATH = dbPath;
// Never touch the default database (root CLAUDE.md hard rule 2): this is a
// fresh scratch file, and initializeSchema brings up both run-dmcp's own
// tables and this repository's own in the same startup pass.
initializeSchema({ migrations: [prisonerMigration] });

const MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
/**
 * Configurable model roles (this task's brief, item 1): `PRISONER_MODEL`
 * alone, or `PRISONER_WITS_MODEL`/`PRISONER_VOICE_MODEL` set to the SAME
 * value, is exactly today's behaviour -- `createPrisonerMind`/
 * `createWardenMind` collapse to their original single-call path whenever
 * the two resolved names are equal (`prisonerMind.ts`/`wardenMind.ts`).
 */
const DEFAULT_MODEL = "qwen2.5:14b";
const MODEL = process.env.PRISONER_MODEL;
const WITS_MODEL = process.env.PRISONER_WITS_MODEL ?? MODEL ?? DEFAULT_MODEL;
// `PRISONER_SKIP_VOICE` (`modelRoles.ts`, CLAUDE.md "Test runs skip the
// voice model for reasoning-only work"): collapses voice onto the wits
// model for a run that doesn't need a readable transcript.
const VOICE_MODEL = resolveVoiceModel(WITS_MODEL, process.env.PRISONER_VOICE_MODEL ?? MODEL ?? DEFAULT_MODEL, readSkipVoice(process.env.PRISONER_SKIP_VOICE));
const MODEL_LABEL = WITS_MODEL === VOICE_MODEL ? WITS_MODEL : `${WITS_MODEL} (wits) / ${VOICE_MODEL} (voice)`;
const THINK_TIMEOUT_MS = process.env.PRISONER_THINK_TIMEOUT_MS
  ? Number(process.env.PRISONER_THINK_TIMEOUT_MS)
  : undefined;
const ROUNDS = process.env.PRISONER_ROUNDS ? Number(process.env.PRISONER_ROUNDS) : 12;

/** GPU-safe model swapping (this task's brief, item 2): one shared swapper
 *  for every mind call this run makes, so its own mutex genuinely covers
 *  "never allow two model calls in flight" across both principals and both
 *  roles, not just within one. `NATIVE_BASE_URL` is `PRISONER_MODEL_URL`
 *  with a trailing `/v1` stripped, or `PRISONER_OLLAMA_NATIVE_URL` verbatim
 *  when set.
 *
 *  Coordinator's fix, over the first real run: doris reports a multi-
 *  century `expires_at` for EVERY model it loads, not only one this run
 *  itself pinned with `keep_alive: -1` -- `expires_at` cannot tell those
 *  apart, so it is never used for this guard any more. `RESIDENT_MODELS`
 *  (`PRISONER_OLLAMA_RESIDENT_MODELS`, comma-separated) names models this
 *  run is allowed to find already loaded and must restore afterward, even
 *  though they are not one of ITS OWN roles -- typically the model the
 *  owner keeps resident between runs. `ALLOWED_MODELS` (this run's own
 *  roles plus the residents) is what `assertNoForeignModel` and the
 *  swapper's own unload guard check against; nothing else loaded is ever
 *  touched. */
const NATIVE_BASE_URL = nativeBaseUrl(MODEL_URL, process.env.PRISONER_OLLAMA_NATIVE_URL);
const RESIDENT_MODELS = (process.env.PRISONER_OLLAMA_RESIDENT_MODELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
const VARIANT = getVariant();
/** Open variant only (OPEN-VARIANT.md §8.1): the referee is its own model,
 *  swapped like the other two. */
const REFEREE_MODEL = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
const REFEREE_TIMEOUT_MS = process.env.PRISONER_REFEREE_TIMEOUT_MS ? Number(process.env.PRISONER_REFEREE_TIMEOUT_MS) : THINK_TIMEOUT_MS;
/** Open variant only: the precedent condition (`src/open/precedent.ts`). Set
 *  to a ledger file (created if absent) to show both minds what the warden
 *  has already seen prisoners try in earlier games, and to add this game's
 *  perceived attempts afterwards. Unset: the baseline, unchanged. */
const PRECEDENT_LEDGER = process.env.PRISONER_PRECEDENT_LEDGER;
const PRECEDENT_LIMIT = 10;
/** Open variant only: the pick condition (`src/open/pickCondition.ts`,
 *  OPEN-VARIANT.md §21). Unset: the baseline, unchanged. */
const PICK = readPickCondition(process.env.PRISONER_PICK);
/** Open variant only: `passive` takes the warden out of the question
 *  (`src/open/passiveWarden.ts`, OPEN-VARIANT.md §26). Unset: the model warden. */
const WARDEN_MODE = readWardenMode(process.env.PRISONER_WARDEN);
/** Open variant only: the prisoner's mind gets the thresholds as a condition
 *  list (`src/open/conditions.ts`, OPEN-VARIANT.md §34) unless told otherwise.
 *  Unset: `list`, the default since D3. `off` is the old rule-sentence baseline. */
const CONDITIONS = readConditionsMode(process.env.PRISONER_CONDITIONS);
/** Open variant only: whether her conditions state the cell's other way out
 *  (`src/open/conditions.ts`, OPEN-VARIANT.md §46). Unstated unless asked. */
const DOOR = readDoorMode(process.env.PRISONER_DOOR);
/** Open variant only: whether the door's passage is gated on the lock
 *  (`src/open/world.ts`, OPEN-VARIANT.md §50, issue #19). Free unless asked. */
const DOOR_PRICE = readDoorPrice(process.env.PRISONER_DOOR_PRICE);
/** Open variant only: the referee's seventh question, naming the instrument
 *  an act uses (`src/open/referee.ts`, OPEN-VARIANT.md §51, the-prisoner#17).
 *  Off unless asked -- an arm, not a new default (the D3 lesson, §40.1). */
const INSTRUMENT = readInstrumentMode(process.env.PRISONER_INSTRUMENT);
const PRESENCE = readPresenceMode(process.env.PRISONER_PRESENCE);
/** Open variant only: the effect question's sharpened derive/wear wording
 *  (`src/open/referee.ts`, OPEN-VARIANT.md §51, the-prisoner#18). Baseline
 *  (the pre-existing text) unless asked -- the same D3 lesson. */
const DERIVE_WORDING = readDeriveWordingMode(process.env.PRISONER_DERIVE_WORDING);
/** A PERSON in one of the two chairs (`src/open/humanSeat.ts`, the-prisoner#11):
 *  `PRISONER_HUMAN=prisoner|warden`. Unset is two models, which every recorded
 *  batch is -- and a transcript with a person in it says so, so it can never be
 *  pooled with one. Open variant only: the closed variant offers a move list. */
const SEAT = readSeatMode(process.env.PRISONER_HUMAN);
/** the-prisoner#21: how the human seat's own situation is shown, never what
 *  it is shown (`src/open/humanSeat.ts`, `src/open/proseView.ts`).
 *  `PRISONER_VIEW=raw` (unset, the default) is byte-identical to every
 *  batch before this issue; `prose` is deterministic prose composed by code
 *  from the identical data. No-op with no seat: read regardless so a
 *  misconfigured value is caught even in a model-vs-model run. */
const VIEW = readViewMode(process.env.PRISONER_VIEW);
/** D3 (2026-09-18), the-prisoner#21 route 2: `PRISONER_NARRATOR_MODEL`, the
 *  narrator role `src/open/narrator.ts` calls when `VIEW === "narrated"`.
 *  Configured exactly like the other roles, defaulting to the VOICE model
 *  (`modelRoles.ts`'s own comment: the role that already writes prose well
 *  here) rather than a third default to keep track of. Read unconditionally,
 *  same reasoning as `VIEW` itself: a misconfigured value is caught even in
 *  a run that never seats a person. */
const NARRATOR_MODEL = resolveNarratorModel(VOICE_MODEL, process.env.PRISONER_NARRATOR_MODEL);
/** Open variant only: how a known approach is priced (`src/open/precedent.ts`,
 *  OPEN-VARIANT.md §42). `flat` unless asked, so earlier batches stay comparable. */
const PRECEDENT_PRICE = readPrecedentPrice(process.env.PRISONER_PRECEDENT_PRICE);
// The narrator only ever calls a model when a person is seated AND asked for
// the narrated view -- added to the allowed/swapped roster only then, so a
// run that never uses it never has to account for it in `/api/ps`.
const NARRATOR_IN_USE = VARIANT === "open" && SEAT !== "off" && VIEW === "narrated";
const CONFIGURED_MODELS = [...new Set([WITS_MODEL, VOICE_MODEL, ...(VARIANT === "open" ? [REFEREE_MODEL] : []), ...(NARRATOR_IN_USE ? [NARRATOR_MODEL] : [])])];
const ALLOWED_MODELS = [...new Set([...CONFIGURED_MODELS, ...RESIDENT_MODELS])];
const swapper = new OllamaModelSwapper({ nativeBaseUrl: NATIVE_BASE_URL, allowedModels: ALLOWED_MODELS });
const ensureLoaded = (model: string): Promise<void> => swapper.withModel(model, async () => {});

async function safePsSummary(): Promise<{ ps: OllamaPsResponse | null; summary: string }> {
  try {
    const ps = await swapper.fetchPs();
    return { ps, summary: summarizeLoadedModels(ps) };
  } catch (err) {
    return { ps: null, summary: `(could not query /api/ps: ${err instanceof Error ? err.message : String(err)})` };
  }
}

interface Timing {
  round: number;
  principal: Principal;
  ms: number;
  silent: boolean;
}

function entityLabel(world: World, id: string): string {
  const names: Record<string, string> = {
    [world.cellId]: "the cell",
    [world.wardenId]: "the warden",
    [world.prisonerId]: "the prisoner",
    [world.barId]: "the bar",
    [world.looseTileId]: "the loose tile",
    [world.spoonId]: "the spoon",
    [world.resources.barIntegrity]: "bar_integrity",
    [world.resources.lockIntegrity]: "lock_integrity",
    [world.resources.spoonEdge]: "spoon_edge",
    [world.resources.wardenSuspicion]: "warden_suspicion",
    [world.resources.guardAttention]: "guard_attention",
  };
  return names[id] ?? id;
}

function describeOutcome(world: World, outcome: Outcome): string {
  const lines: string[] = [];
  const description = resolutionDescription(outcome.eventId);
  if (description) lines.push(description);
  for (const t of outcome.transitions) {
    lines.push(`  - ${entityLabel(world, t.entityId)}.${t.key}: ${t.previousValue} -> ${t.newValue}`);
  }
  if (outcome.transitions.length === 0) lines.push("  (no state changed)");
  return lines.join("\n");
}

function describeContradiction(world: World, c: Contradiction): string {
  return (
    `${entityLabel(world, c.fact.entityId)}.${c.fact.key} was ${c.fact.value}` +
    ` (as of t=${c.fact.validFromT}, opened by event ${c.fact.openedByEventId ?? "unknown"})` +
    `, claim wanted ${c.claim.value}`
  );
}

function describeRefusal(world: World, error: ResolveProtocolError | ConstraintViolationError): string {
  if (error instanceof ResolveProtocolError) {
    const contradictions = error.contradictions ?? [];
    return (
      `resolve protocol refused (${error.reason}):\n` +
      contradictions.map((c) => `  - ${describeContradiction(world, c)}`).join("\n")
    );
  }
  const fact = error.contradictedFact;
  return (
    `constraint violation (${error.constraintKind}) on ${entityLabel(world, error.resourceId)}` +
    (fact ? `: ${fact.key} holds '${fact.value}' as of t=${fact.validFromT}, opened by ${fact.openedByEventId ?? "unknown"}` : "")
  );
}

function finalResourceValues(world: World): string[] {
  const db = getDatabase();
  const lines: string[] = [];
  for (const [name, id] of Object.entries(world.resources)) {
    const row = db.prepare(`SELECT value FROM resources WHERE id = ?`).get(id) as { value: number } | undefined;
    lines.push(`- ${name}: ${row?.value}`);
  }
  return lines;
}

/**
 * Tallies this task's report requirements as the run goes -- never
 * recomputed after the fact from prose, always from the same
 * `HalfRoundResult` the transcript itself renders from.
 *
 * `mind-seam@0.3.0`: this repository's own raw-answer side channel
 * (`onRawAnswer`) is retired. `SilenceDetail.text` is present for BOTH
 * `"unparseable"` and `"rejected"` (the old side channel could only ever
 * report the latter, because it fired inside `coerce`, which only runs once
 * JSON parsing has already succeeded) and `SilenceDetail.parsed` for
 * `"rejected"` IS the model's raw parsed answer -- there is nothing left
 * for a side channel to add.
 */
interface RunStats {
  refusals: { round: number; principal: Principal; move: string; cause: string }[];
  planRevisions: { round: number; principal: Principal; moves: readonly string[] }[];
  silences: { round: number; principal: Principal; reason: string | undefined; text: string | undefined; parsed: unknown }[];
  /** Configurable model roles (this task's brief, item 1): a VOICE failure
   *  -- separate from `silences` above, which is exclusively DECISION
   *  (wits) silence. The turn still resolved; this is purely a report. */
  voiceSilences: { round: number; principal: Principal; reason: string | undefined; text: string | undefined }[];
  /** Item 3: per-call wall time, one entry per sub-call actually made, so
   *  totals can be reported separately for wits vs. voice. Empty on the
   *  default (single-call) path. */
  roleCallTimings: { round: number; principal: Principal; role: "wits" | "voice"; model: string; ms: number }[];
}

function noteStats(stats: RunStats, half: HalfRoundResult, roundN: number): void {
  const r = half.result;
  if (r.kind === "refused") {
    const cause = r.error instanceof ResolveProtocolError ? r.error.reason : r.error.constraintKind;
    stats.refusals.push({ round: roundN, principal: half.principal, move: r.proposal.choice ?? "?", cause });
  }
  if (r.kind === "silent") {
    stats.silences.push({ round: roundN, principal: half.principal, reason: r.reason, text: r.detail?.text, parsed: r.detail?.parsed });
  }
  if (half.planRevision && half.planRevision.length > 0) {
    stats.planRevisions.push({ round: roundN, principal: half.principal, moves: half.planRevision });
  }
  if (r.kind !== "silent") {
    const p = r.proposal;
    if (p.witsModel !== undefined && p.witsMs !== undefined) {
      stats.roleCallTimings.push({ round: roundN, principal: half.principal, role: "wits", model: p.witsModel, ms: p.witsMs });
    }
    if (p.voiceModel !== undefined && p.voiceMs !== undefined) {
      stats.roleCallTimings.push({ round: roundN, principal: half.principal, role: "voice", model: p.voiceModel, ms: p.voiceMs });
    }
    if (p.voiceSilenceReason !== undefined) {
      stats.voiceSilences.push({ round: roundN, principal: half.principal, reason: p.voiceSilenceReason, text: p.voiceSilenceText });
    }
  }
}

function renderHalfRound(world: World, half: HalfRoundResult): string[] {
  const lines: string[] = [];
  lines.push(`### Half-round ${half.t - world.clock.t0} (t=${half.t}) -- the ${half.principal}`);
  lines.push("");
  lines.push("**Briefing given, verbatim:**");
  lines.push("```");
  lines.push(half.context.briefing);
  lines.push("```");

  const r = half.result;
  if (r.kind === "silent") {
    lines.push(`**Silence.** SilenceReason: \`${r.reason ?? "unknown"}\`.`);
    // Shown for every silence that has one (unparseable AND rejected --
    // `mind-seam@0.3.0` widens this past the old rejected-only side
    // channel, which left "unparseable" blank in every earlier transcript).
    if (r.detail?.text !== undefined) {
      lines.push(`**Raw text (${r.reason}):**`);
      lines.push("```");
      lines.push(r.detail.text);
      lines.push("```");
    }
    if (r.reason === "rejected" && r.detail?.parsed !== undefined) {
      lines.push("**Parsed answer (rejected):**");
      lines.push("```json");
      lines.push(JSON.stringify(r.detail.parsed, null, 2));
      lines.push("```");
    }
    if (r.loud) {
      lines.push(`**${loudSilenceMessage(half.principal, MODEL_URL, MODEL_LABEL, r.reason, 2)}**`);
    }
  } else {
    // Configurable model roles (this task's brief, items 1 and 3): which
    // model produced which part, its own call time, and any swap wall time
    // incurred right before it -- present ONLY on the two-call path
    // (`witsModel`/`voiceModel` are unset on the single-call/default path,
    // so none of this renders there, which is how "identical transcripts"
    // in the default case stays true).
    if (r.proposal.witsModel !== undefined) {
      const swap = r.proposal.witsSwapMs !== undefined ? `, swap ${r.proposal.witsSwapMs.toFixed(0)}ms` : "";
      lines.push(`**Wits model:** \`${r.proposal.witsModel}\` (${r.proposal.witsMs?.toFixed(0) ?? "?"}ms${swap})`);
    }
    if (r.proposal.voiceModel !== undefined) {
      const swap = r.proposal.voiceSwapMs !== undefined ? `, swap ${r.proposal.voiceSwapMs.toFixed(0)}ms` : "";
      lines.push(`**Voice model:** \`${r.proposal.voiceModel}\` (${r.proposal.voiceMs?.toFixed(0) ?? "?"}ms${swap})`);
    }
    if (r.proposal.voiceSilenceReason !== undefined) {
      lines.push(
        `**Voice silence.** SilenceReason: \`${r.proposal.voiceSilenceReason}\` -- the wits decision above was kept; line left empty.`
      );
      if (r.proposal.voiceSilenceText !== undefined) {
        lines.push("**Voice raw text:**");
        lines.push("```");
        lines.push(r.proposal.voiceSilenceText);
        lines.push("```");
      }
    }
    // Private thoughts, first (this task's brief, item 1): rendered in the
    // TRANSCRIPT only -- never stored, never fed into any context.
    if (r.proposal.thoughts) lines.push(`**Thoughts:** ${r.proposal.thoughts}`);
    lines.push(`**Intent:** ${r.proposal.intent}`);
    if (r.proposal.line) lines.push(`**Line:** "${r.proposal.line}"`);
    // Coordinator's fix, item 2: only shown when the plan actually CHANGED
    // (`half.planRevision`, set only by `loop.ts`'s `planNoteFor` when it
    // differs from what was already pending) -- never `r.proposal.plan`
    // itself, which is present on every successfully coerced proposal now
    // (`plan[0]` is always this turn's move) and would otherwise claim a
    // "revision" every single half-round.
    if (half.planRevision && half.planRevision.length > 0) {
      lines.push(`**Plan revision:** ${half.planRevision.join(" -> ")}`);
    }
    // Notes to self (this task's brief, item 2): rendered here too, so a
    // reader can see what was persisted -- `briefing.ts` renders the same
    // string back near the top of this principal's OWN next briefing.
    if (r.proposal.notes) lines.push(`**Notes:** ${r.proposal.notes}`);
    if (r.kind === "no-choice") {
      lines.push("**No choice offered -- this half-round passes with no proposal to resolve.**");
    } else if (r.kind === "resolved") {
      lines.push(`**Choice:** ${r.proposal.choice}`);
      lines.push("**Outcome:**");
      lines.push("```");
      lines.push(describeOutcome(world, r.outcome));
      lines.push("```");
    } else {
      lines.push(`**Choice:** ${r.proposal.choice}`);
      lines.push("**Refused:**");
      lines.push("```");
      lines.push(describeRefusal(world, r.error));
      lines.push("```");
    }
  }
  lines.push("");
  return lines;
}

async function main(): Promise<void> {
  const world = buildWorld();
  const resolver = buildResolver(world);
  seedInitialBeliefs(world);

  // Mind-owned opening plans (coordinator's fix, finding (a): the authored
  // opening plan -- hone, file, file, file, conceal -- steered EVERY
  // prisoner onto the loud FILE path before it ever got a turn to decide
  // anything, which is also why no refusal could occur: a mind that never
  // reaches a genuine decision point never has a stale belief of its own to
  // collide with). A single NEUTRAL first step each -- INSPECT for the
  // prisoner, OBSERVE for the warden, both already the least committal move
  // either side has (no state change, no suspicion). Both minds already
  // revise their own plan every turn (`proposal.plan`, `src/ledger/
  // ledger.ts`'s `revisePlan`); the route from here -- when to file, when to
  // shim, when to search -- is now entirely theirs, chosen from motive, the
  // stated rules, and their own persisted notes, never authored content
  // steering them onto one path.
  const prisonerPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.prisonerId,
    t: world.clock.t0,
    steps: [{ move: "INSPECT", description: "INSPECT" }],
  });
  const wardenPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.wardenId,
    t: world.clock.t0,
    steps: [{ move: "OBSERVE", description: "OBSERVE" }],
  });

  const wardenTracker = newSilenceTracker();
  const prisonerTracker = newSilenceTracker();
  const timings: Timing[] = [];
  const stats: RunStats = { refusals: [], planRevisions: [], silences: [], voiceSilences: [], roleCallTimings: [] };
  const wits = newWitsSummary();

  // GPU-safe swapping (this task's brief, item 2): `ensureLoaded` is only
  // ever a real swap check here, in the one script that talks to doris --
  // every unit test constructs these minds without it. Both principals
  // share the SAME `swapper`, so its mutex covers every call this run
  // makes, not just one principal's.
  const wardenMind = createWardenMind({
    baseUrl: MODEL_URL,
    witsModel: WITS_MODEL,
    voiceModel: VOICE_MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    ensureLoaded,
    onSilence: (reason, _context, detail) => noteSilenceReason(wardenTracker, reason, detail),
  });
  const prisonerMind = createPrisonerMind({
    baseUrl: MODEL_URL,
    witsModel: WITS_MODEL,
    voiceModel: VOICE_MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    ensureLoaded,
    onSilence: (reason, _context, detail) => noteSilenceReason(prisonerTracker, reason, detail),
  });

  // "That model belongs to someone else" (this task's brief, item 2): read
  // /api/ps BEFORE playing a single half-round. A model loaded that this
  // run neither configured nor lists in PRISONER_OLLAMA_RESIDENT_MODELS
  // stops the run outright (`assertNoForeignModel` throws, uncaught --
  // loud, never a silent no-op). A `/api/ps` that cannot be reached at all
  // is reported but does not itself stop the run (the very first mind call
  // will fail loudly on its own if doris is really unreachable).
  //
  // Coordinator's fix: `residentsAtStart` -- what `restoreResidents` puts
  // back in the `finally` below -- is whichever of THIS run's own resident
  // list was actually found loaded, by NAME only. Never `expires_at`: the
  // first real run showed every model doris loads gets a multi-century
  // expiry, pinned or not, so it carries no information here at all.
  const { ps: initialPs, summary: loadedAtStart } = await safePsSummary();
  if (initialPs) assertNoForeignModel(initialPs, ALLOWED_MODELS);
  const residentsAtStart = initialPs ? initialPs.models.map((m) => m.name).filter((name) => RESIDENT_MODELS.includes(name)) : [];

  const transcript: string[] = [];
  transcript.push("# The Prisoner -- checkpoint transcript");
  transcript.push("");
  transcript.push(`Generated: ${new Date().toISOString()}`);
  transcript.push("");
  transcript.push("## Scenario");
  transcript.push("");
  transcript.push(
    "One cell. A warden and a prisoner, both model-driven, both proposing through the same seam " +
      `(\`mind-seam@${pinnedDependencyVersion("mind-seam")}\`), both resolved through ` +
      `\`run-dmcp@${pinnedDependencyVersion("run-dmcp")}\`'s resolve protocol. Belief, not truth, in ` +
      "each briefing; the warden wins by catching the prisoner or by the clock running out, the " +
      "prisoner wins by escaping. Both minds may revise their own plan as the game unfolds."
  );
  transcript.push("");
  if (WITS_MODEL === VOICE_MODEL) {
    transcript.push(`Model: \`${MODEL_LABEL}\` at \`${MODEL_URL}\`. Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}.`);
  } else {
    // Configurable model roles (this task's brief, item 1): two models,
    // named separately -- never rendered as a single "Model:" line, so a
    // reader can never mistake this for the single-call default.
    transcript.push(`Wits model: \`${WITS_MODEL}\` at \`${MODEL_URL}\`.`);
    transcript.push(`Voice model: \`${VOICE_MODEL}\` at \`${MODEL_URL}\`.`);
    transcript.push(`Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}.`);
  }
  transcript.push(`Rounds (max): ${ROUNDS}.`);
  transcript.push(`Database: \`${dbPath}\` (scratch, never the default path).`);
  transcript.push(`Code revision: ${describeRunRevision()}`);
  transcript.push(`Models loaded on doris at start (/api/ps): ${loadedAtStart}`);
  if (residentsAtStart.length > 0) transcript.push(`Resident at start: ${residentsAtStart.map((n) => `\`${n}\``).join(", ")}.`);
  transcript.push("");
  transcript.push("## Rounds");
  transcript.push("");

  let ended: GameEnd = null;
  let endedAtRound = -1;

  // Pin restore, in a `finally` (this task's brief, item 2): whatever the
  // GPU held pinned (keep_alive -1) when THIS run started must be back and
  // pinned when it ends, whether the game finished normally, ended early,
  // or the round loop below threw. `pinAtStart` is `null` on the ordinary
  // case (nothing was pinned), making this a no-op (`restorePin` returns
  // immediately).
  try {
    for (let n = 1; n <= ROUNDS && !ended; n++) {
      transcript.push(`## Round ${n}`);
      transcript.push("");

      const tw = world.clock.wardenT(n);
      const wardenContext = buildWardenContext(world, wardenPlan, tw, ROUNDS);
      const wStart = performance.now();
      const wardenHalf = await runHalfRound({
        world,
        resolver,
        plan: wardenPlan,
        principal: "warden",
        roundN: n,
        t: tw,
        context: wardenContext,
        mind: wardenMind,
        tracker: wardenTracker,
      });
      timings.push({ round: n, principal: "warden", ms: performance.now() - wStart, silent: wardenHalf.result.kind === "silent" });
      noteStats(stats, wardenHalf, n);
      noteWitsEvent(wits, world.gameId, wardenHalf, n);
      transcript.push(...renderHalfRound(world, wardenHalf));

      ended = checkGameEnd(world, tw);
      if (ended) {
        endedAtRound = n;
      } else {
        const tp = world.clock.prisonerT(n);
        const prisonerContext = buildPrisonerContext(world, prisonerPlan, tp, ROUNDS);
        const pStart = performance.now();
        const prisonerHalf = await runHalfRound({
          world,
          resolver,
          plan: prisonerPlan,
          principal: "prisoner",
          roundN: n,
          t: tp,
          context: prisonerContext,
          mind: prisonerMind,
          tracker: prisonerTracker,
        });
        timings.push({ round: n, principal: "prisoner", ms: performance.now() - pStart, silent: prisonerHalf.result.kind === "silent" });
        noteStats(stats, prisonerHalf, n);
        noteWitsEvent(wits, world.gameId, prisonerHalf, n);
        transcript.push(...renderHalfRound(world, prisonerHalf));

        ended = checkGameEnd(world, tp);
        if (ended) endedAtRound = n;
      }

      if (!ended) {
        // Time decay, once per full round -- an audited referee resolution
        // (design), never a direct write.
        resolver.resolve({ gameId: world.gameId, mechanic: "TIME_DECAY" });
      }
    }

    const { summary: loadedAtEnd } = await safePsSummary();

    transcript.push("## Result");
    transcript.push("");
    if (ended?.kind === "escaped") {
      transcript.push(`**The prisoner escaped, at round ${endedAtRound}.**`);
    } else if (ended?.kind === "caught") {
      transcript.push(`**The warden caught the prisoner, at round ${endedAtRound}.**`);
    } else {
      transcript.push(`**Timeout after ${ROUNDS} rounds -- the warden wins by default.**`);
    }
    transcript.push("");

    transcript.push("## Final state");
    transcript.push("");
    transcript.push(`Models loaded on doris at end (/api/ps): ${loadedAtEnd}`);
    transcript.push("");
    transcript.push("### Constrained resources");
    transcript.push(...finalResourceValues(world));
    transcript.push("");
    transcript.push("### Prisoner's ledger");
    transcript.push("```");
    transcript.push(renderLedger(world.gameId, prisonerPlan));
    transcript.push("```");
    transcript.push("");
    transcript.push("### Warden's ledger");
    transcript.push("```");
    transcript.push(renderLedger(world.gameId, wardenPlan));
    transcript.push("```");
    transcript.push("");

    const silentCount = timings.filter((t) => t.silent).length;
    transcript.push("### Summary");
    transcript.push("");
    transcript.push(`Total half-round calls: ${timings.length}. Silent: ${silentCount}. Timeout used: ${THINK_TIMEOUT_MS ?? 12000}ms.`);
    transcript.push(`Refusals: ${stats.refusals.length}.`);
    for (const r of stats.refusals) {
      transcript.push(`  - round ${r.round}, ${r.principal}, ${r.move}: ${r.cause}`);
    }
    transcript.push(`Plan revisions: ${stats.planRevisions.length}.`);
    for (const p of stats.planRevisions) {
      transcript.push(`  - round ${p.round}, ${p.principal}: ${p.moves.join(" -> ")}`);
    }
    transcript.push(`Silences (decision): ${stats.silences.length}.`);
    for (const s of stats.silences) {
      const text = s.text !== undefined ? JSON.stringify(s.text) : "(no text)";
      const parsed = s.parsed !== undefined ? JSON.stringify(s.parsed) : "(no parsed answer)";
      transcript.push(`  - round ${s.round}, ${s.principal}, reason ${s.reason ?? "unknown"}, text: ${text}, parsed: ${parsed}`);
    }
    // Configurable model roles (this task's brief, item 1): a VOICE silence
    // is counted and listed SEPARATELY from a decision silence above -- the
    // turn still resolved in every one of these; only the line stayed
    // empty. Always printed (even "0") the same way every other count here
    // is, never omitted (root CLAUDE.md hard rule 3).
    transcript.push(`Silences (voice): ${stats.voiceSilences.length}.`);
    for (const s of stats.voiceSilences) {
      const text = s.text !== undefined ? JSON.stringify(s.text) : "(no text)";
      transcript.push(`  - round ${s.round}, ${s.principal}, reason ${s.reason ?? "unknown"}, text: ${text}`);
    }
    transcript.push("");
    // Coordinator's fix, item 6: a short, machine-derived section -- every
    // refusal with its cause and whose act caused it, every SEARCH, every
    // covert act by each side, and any ESCAPE attempt -- built ONLY from
    // structured HalfRoundResult fields, never from a resolution's own prose
    // (`witsSummary.ts`).
    transcript.push("### Wits summary");
    transcript.push("");
    transcript.push(...renderWitsSummary(wits, world.gameId));
    transcript.push("");
    transcript.push("### Model call timings");
    transcript.push("");
    for (const timing of timings) {
      transcript.push(`- round ${timing.round}, ${timing.principal}: ${timing.ms.toFixed(0)}ms${timing.silent ? " (silent)" : ""}`);
    }

    // Configurable model roles (this task's brief, item 3): which model
    // produced which part, per-call, and the totals -- present only when
    // the two-call path actually ran (`stats.roleCallTimings` stays empty
    // on the default single-call path).
    if (stats.roleCallTimings.length > 0) {
      transcript.push("");
      transcript.push("### Role call timings (wits vs. voice)");
      transcript.push("");
      for (const t of stats.roleCallTimings) {
        transcript.push(`- round ${t.round}, ${t.principal}, ${t.role} (\`${t.model}\`): ${t.ms.toFixed(0)}ms`);
      }
      for (const role of ["wits", "voice"] as const) {
        const calls = stats.roleCallTimings.filter((t) => t.role === role);
        const mean = calls.length > 0 ? calls.reduce((sum, t) => sum + t.ms, 0) / calls.length : 0;
        transcript.push(`Total ${role} calls: ${calls.length}. Mean ${role} call time: ${mean.toFixed(0)}ms.`);
      }
    }

    // GPU-safe swapping (this task's brief, item 2 and 3): every unload
    // this run actually performed, with its own wall time, plus totals --
    // empty on a run that only ever used one model throughout (nothing to
    // swap between).
    transcript.push("");
    transcript.push("### GPU swaps");
    transcript.push("");
    const swapEvents = swapper.swapEvents;
    transcript.push(`Swap count: ${swapEvents.length}.`);
    for (const event of swapEvents) {
      transcript.push(`  - loaded \`${event.model}\`, unload+poll wall time: ${event.unloadMs.toFixed(0)}ms.`);
    }
    if (swapEvents.length > 0) {
      const meanUnloadMs = swapEvents.reduce((sum, e) => sum + e.unloadMs, 0) / swapEvents.length;
      const totalUnloadMs = swapEvents.reduce((sum, e) => sum + e.unloadMs, 0);
      transcript.push(`Mean unload+poll wall time: ${meanUnloadMs.toFixed(0)}ms. Total: ${totalUnloadMs.toFixed(0)}ms.`);
    }

    const dir = join(process.cwd(), "checkpoints");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
    writeFileSync(file, transcript.join("\n") + "\n");

    // eslint-disable-next-line no-console
    console.log(`Transcript written to ${file}`);
    // eslint-disable-next-line no-console
    console.log(`Database: ${dbPath}`);
    // eslint-disable-next-line no-console
    console.log(`Result: ${ended?.kind ?? "timeout"} at round ${endedAtRound > 0 ? endedAtRound : ROUNDS}`);
    // eslint-disable-next-line no-console
    console.log(
      `Calls: ${timings.length}, silent: ${silentCount}, refusals: ${stats.refusals.length}, plan revisions: ${stats.planRevisions.length}, voice silences: ${stats.voiceSilences.length}, swaps: ${swapEvents.length}`
    );
  } finally {
    // Resident restore (this task's brief, item 2): runs whether the loop
    // above finished normally or threw. `restoreResidents` itself is a
    // no-op when `residentsAtStart` is empty (nothing resident was loaded
    // when this run began).
    await swapper.restoreResidents(residentsAtStart);
  }
}

/**
 * The open variant's checkpoint (issue #2): the same scratch database, model
 * roles, swapper and resident guard as `main()` above, with `runOpenGame`
 * in place of the closed round loop. Writes the Markdown transcript and,
 * beside it, `<same name>.referee.json` -- every referee request, the input
 * `npm run referee-replay` reads for §5.2's consistency measurement.
 */
async function mainOpen(): Promise<void> {
  const openWorld = buildOpenWorld({ doorPrice: DOOR_PRICE, presence: PRESENCE });
  const resolver = buildOpenResolver();
  const referee = createReferee(
    [createRefereeTransport({ baseUrl: MODEL_URL, model: REFEREE_MODEL, timeoutMs: REFEREE_TIMEOUT_MS, ensureLoaded })],
    // Objects derived in this game (OPEN-VARIANT.md §13) are targets too.
    {
      isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined,
      kindOf: (objectId) => derivedKindOf(openWorld, objectId),
      propertiesOf: (objectId) => declaredPropertyKeys(openWorld, objectId),
      instrumentMode: INSTRUMENT,
      deriveWording: DERIVE_WORDING,
    }
  );

  const lastSilence: Record<OpenPrincipal, SilenceNote | undefined> = { warden: undefined, prisoner: undefined };
  // the-prisoner#20: this variant never passed `onVoiceSilence` at all, so a
  // voice call that timed out, came back unparseable, or (since §52) ended
  // mid-clause left an empty line and no trace of why -- including §52's own
  // rule, which would have been invisible in the evidence it exists to
  // produce. Recorded per principal, rendered on the half-round that acted.
  const lastVoiceSilence: Record<OpenPrincipal, SilenceNote | undefined> = { warden: undefined, prisoner: undefined };
  let voiceSilenceCount = 0;
  const mindOptions = (principal: OpenPrincipal) => ({
    baseUrl: MODEL_URL,
    witsModel: WITS_MODEL,
    voiceModel: VOICE_MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    ensureLoaded,
    onSilence: (reason: string, _context: unknown, detail?: { text?: string; parsed?: unknown }) => {
      lastSilence[principal] = { reason, text: detail?.text, parsed: detail?.parsed };
    },
    onVoiceSilence: (reason: string, _context: unknown, detail?: { text?: string; parsed?: unknown }) => {
      lastVoiceSilence[principal] = { reason, text: detail?.text, parsed: detail?.parsed };
      voiceSilenceCount += 1;
    },
  });
  // A person in one of the two chairs (the-prisoner#11): the same seam, the same referee,
  // the same opponent -- only this one mind is a terminal, and it is shown exactly what the
  // model in that chair would have been shown (`humanSeat.ts`).
  const rl = SEAT === "off" ? null : createInterface({ input: process.stdin, output: process.stdout });
  let inputClosed = false;
  rl?.on("close", () => {
    inputClosed = true;
  });
  // D3 (2026-09-18), the-prisoner#21 route 2: the narrator role, built only
  // when it can actually be called (`NARRATOR_IN_USE`) -- the human seat
  // only, never wired anywhere a model prompt is built. `narratorRejections`
  // is the run's own count of narrations `verifyNarration` caught and
  // discarded before a player ever saw them -- "a liability the player never
  // sees is a liability that cannot mislead them," but it must still be
  // counted and recorded where a transcript will show it (this task's brief).
  let narratorRejections = 0;
  let narratorSilences = 0;
  const narratorRejectionKinds = new Map<string, number>();
  // §60: narrations the player DID see, with the catalogue they chose to leave
  // out counted anyway. This is the number that says whether freeing the scene
  // bought readable prose or only a looser checker.
  let narratorShownWithGaps = 0;
  const narratorObservedKinds = new Map<string, number>();
  const narrator = NARRATOR_IN_USE
    ? createNarrator({
        baseUrl: MODEL_URL,
        model: NARRATOR_MODEL,
        timeoutMs: THINK_TIMEOUT_MS,
        ensureLoaded,
        // The authored catalogue only (not `openWorld.derived`, which grows
        // during play and this narrator is constructed once, before any
        // round runs) -- enough for `verifyNarration`'s `invented-object`
        // check to catch a narration that leaks a real object this
        // principal does not currently perceive.
        knownWorldLabels: OPEN_OBJECTS.map((o) => o.id.replace(/_/g, " ")),
        // The player is told NOTHING here, by design: the fallback to the
        // prose view is already silent and seamless, and the first human
        // `narrated` game (2026-09-18) printed a line of violation kinds
        // above the view every single round, in front of the one person the
        // view exists for. The evidence is kept -- tallied by kind, into the
        // transcript's own narrator section, where a run can be read.
        onRejected: (violations) => {
          narratorRejections += 1;
          for (const v of violations) narratorRejectionKinds.set(v.kind, (narratorRejectionKinds.get(v.kind) ?? 0) + 1);
        },
        onObserved: (violations) => {
          narratorShownWithGaps += 1;
          for (const v of violations) narratorObservedKinds.set(v.kind, (narratorObservedKinds.get(v.kind) ?? 0) + 1);
        },
        onSilence: () => {
          narratorSilences += 1;
        },
      })
    : undefined;
  const seatMind = (selfName: string, otherName: string, conditions: ReturnType<typeof openConditions> | undefined) =>
    createHumanSeatMind({
      selfName,
      otherName,
      ask: async (prompt: string) => {
        if (!rl || inputClosed) return undefined;
        try {
          return await rl.question(prompt);
        } catch {
          return undefined; // the terminal closed mid-question (ctrl-D)
        }
      },
      // eslint-disable-next-line no-console
      write: (text: string) => console.log(text),
      ...(conditions ? { conditions } : {}),
      view: VIEW,
      ...(narrator ? { narrator } : {}),
    });

  const modelWarden = () =>
    WARDEN_MODE === "passive" ? passiveWardenMind() : createOpenWardenMind({ ...mindOptions("warden"), ...(CONDITIONS === "both" ? { conditions: openConditions({ door: DOOR, doorPrice: DOOR_PRICE }) } : {}) });
  const wardenMind = SEAT === "warden" ? seatMind(WARDEN_NAME, PRISONER_NAME, CONDITIONS === "both" ? openConditions({ door: DOOR, doorPrice: DOOR_PRICE }) : undefined) : modelWarden();
  const prisonerMind =
    SEAT === "prisoner"
      ? seatMind(PRISONER_NAME, WARDEN_NAME, CONDITIONS === "off" ? undefined : openConditions({ door: DOOR, doorPrice: DOOR_PRICE }))
      : createOpenPrisonerMind({ ...mindOptions("prisoner"), ...(CONDITIONS === "off" ? {} : { conditions: openConditions({ door: DOOR, doorPrice: DOOR_PRICE }) }) });

  const { ps: initialPs, summary: loadedAtStart } = await safePsSummary();
  if (initialPs) assertNoForeignModel(initialPs, ALLOWED_MODELS);
  const residentsAtStart = initialPs ? initialPs.models.map((m) => m.name).filter((name) => RESIDENT_MODELS.includes(name)) : [];

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const precedentLedger = PRECEDENT_LEDGER
    ? beginEpisode(existsSync(PRECEDENT_LEDGER) ? parseLedger(JSON.parse(readFileSync(PRECEDENT_LEDGER, "utf8"))) : emptyLedger(), stamp)
    : null;
  const precedents = precedentLedger ? seenBefore(precedentLedger, { observer: "warden", actor: "prisoner", episode: stamp, limit: PRECEDENT_LIMIT }) : [];
  const precedent = precedentLedger ? precedentLines(precedents, { price: PRECEDENT_PRICE }) : undefined;

  const transcript: string[] = [];
  transcript.push("# The Prisoner -- checkpoint transcript (open variant)");
  transcript.push("");
  transcript.push(`Generated: ${new Date().toISOString()}`);
  transcript.push("");
  transcript.push("## Scenario");
  transcript.push("");
  transcript.push(
    `One cell. A warden and a prisoner, ${SEAT === "off" ? "both model-driven" : "one model-driven and one played by a person"}, each proposing a free-text intent through ` +
      `\`mind-seam@${pinnedDependencyVersion("mind-seam")}\`; a separate referee model rules on each intent in closed ` +
      `keys with verbatim citations through \`run-dmcp@${pinnedDependencyVersion("run-dmcp")}\`'s turn reader, and every ` +
      "effect resolves through its resolve protocol (docs/OPEN-VARIANT.md). Warden presence is not modelled in O1 (§9.3)."
  );
  transcript.push("");
  transcript.push(`Wits model: \`${WITS_MODEL}\`. Voice model: \`${VOICE_MODEL}\`. Referee model: \`${REFEREE_MODEL}\`. At \`${MODEL_URL}\`.`);
  transcript.push(`Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}. Referee timeout: ${REFEREE_TIMEOUT_MS ?? "default (12000ms)"}.`);
  transcript.push(`Rounds (max): ${ROUNDS}.`);
  transcript.push(`Database: \`${dbPath}\` (scratch, never the default path).`);
  transcript.push(`Code revision: ${describeRunRevision()}`);
  transcript.push(`Models loaded at start (/api/ps): ${loadedAtStart}`);
  if (residentsAtStart.length > 0) transcript.push(`Resident at start: ${residentsAtStart.map((n) => `\`${n}\``).join(", ")}.`);
  transcript.push(`Referee requests for replay: \`checkpoints/${stamp}.referee.json\`.`);
  if (precedentLedger) {
    transcript.push(
      `Precedent condition: ON. Ledger \`${PRECEDENT_LEDGER}\`, ${precedentLedger.episodes.length - 1} earlier episode(s); ` +
        `${precedents.length} precedent(s) shown to both minds every turn (limit ${PRECEDENT_LIMIT}):`
    );
    for (const p of precedents) transcript.push(`- ${p.text} (times ${p.times}, episodes ${p.episodes}, last ${p.lastEpisode})`);
    transcript.push(
      PRECEDENT_PRICE === "stale"
        ? `Precedent price: STALE (\`PRISONER_PRECEDENT_PRICE=stale\`): each known approach costs ${KNOWN_APPROACH_SUSPICION_BUMP} per earlier attempt that tried it, capped at the bound, instead of a flat ${KNOWN_APPROACH_SUSPICION_BUMP} (§42).`
        : `Precedent price: FLAT (the default): every known approach costs ${KNOWN_APPROACH_SUSPICION_BUMP}, whatever its precedent. The pre-§42 baseline.`
    );
  } else {
    transcript.push("Precedent condition: OFF (baseline).");
  }
  transcript.push(
    PICK
      ? PICK.onReplan
        ? `Pick condition: ON (\`PRISONER_PICK=${process.env.PRISONER_PICK}\`): a new prisoner plan whose first step the warden has seen, in earlier games or this one, is sent back once (§23).`
        : `Pick condition: ON (\`PRISONER_PICK=${process.env.PRISONER_PICK}\`): every even-numbered prisoner turn is forced off anything the warden has seen, in earlier games or this one (§21).`
      : "Pick condition: OFF (baseline)."
  );
  transcript.push(
    WARDEN_MODE === "passive"
      ? "Warden: PASSIVE (`PRISONER_WARDEN=passive`): attempts nothing every turn, no model or referee call; the prisoner's briefing is unchanged (§26)."
      : "Warden: the model warden."
  );
  transcript.push(
    CONDITIONS === "both"
      ? "Conditions: BOTH (`PRISONER_CONDITIONS=both`): both minds get the thresholds as a condition list at the top of their wits prompts, each read from its own side, not as rule sentences (§34.3)."
      : CONDITIONS === "list"
        ? "Conditions: LIST (the default): the prisoner's thresholds are stated as a condition list at the top of her wits prompt, not as rule sentences; the warden's prompt is unchanged (§34)."
        : "Conditions: OFF (`PRISONER_CONDITIONS=off`): thresholds stated as rule sentences. The pre-D3 baseline, now an arm."
  );
  transcript.push(
    DOOR === "stated"
      ? "Door: STATED (`PRISONER_DOOR=stated`): her conditions also say the door can be opened with no threshold to meet, which is what the world declares (§46). The catch conditions are numbered 4-7 under this arm."
      : "Door: UNSTATED (the default): only the window is stated as a way she can open. The cell's other exit is named in no condition of her own."
  );
  transcript.push(
    DOOR_PRICE === "threshold"
      ? `Door price: THRESHOLD (\`PRISONER_DOOR_PRICE=threshold\`): the door is gated on the lock's integrity at or below ${OPEN_DOOR_LOCK_MAX}, exactly like the window on the bar (§50, issue #19).`
      : DOOR_PRICE === "margin"
        ? `Door price: MARGIN (\`PRISONER_DOOR_PRICE=margin\`): the door is gated on the lock's integrity at or below ${OPEN_DOOR_LOCK_MARGIN} -- the lowest gate that leaves a wear step where the door is openable and the lock is still safe to be found at, which ${OPEN_DOOR_LOCK_MAX} did not (§50.5).`
        : "Door price: FREE (the default): the door's passage has no threshold to meet, today's behaviour, unchanged."
  );
  transcript.push(
    INSTRUMENT === "checked"
      ? "Instrument: CHECKED (`PRISONER_INSTRUMENT=checked`): a seventh referee question names the instrument an act uses, from the objects this principal perceives or holds, none, or absent (a tool named that is none of those); absent is ruled impossible (§51, the-prisoner#17)."
      : "Instrument: UNASKED (the default): the referee is never asked what tool an act uses (§51, the-prisoner#17)."
  );
  transcript.push(
    PRESENCE === "modelled"
      ? "Presence: MODELLED (`PRISONER_PRESENCE=modelled`): perception, warden_suspicion and what each principal can perceive of the other's acts are gated on whether they currently share a location; a perceived principal is a legal referee target, and a noise ruled at one reaches their own next briefing by name, and each principal carries its own bounded `posture` -- 100 on her feet, 50 crouched, 0 on the floor -- which the other perceives in words and which raises no suspicion (§55, §56, issue #22)."
      : "Presence: OFF (the default): both principals are always treated as present to each other, and no person carries a declared state, as every batch before this gap recorded (§55, §56, issue #22)."
  );
  transcript.push(
    DERIVE_WORDING === "sharpened"
      ? "Derive wording: SHARPENED (`PRISONER_DERIVE_WORDING=sharpened`): the effect question adds an explicit keep-the-piece test distinguishing derive from wear (§51, the-prisoner#18)."
      : "Derive wording: BASELINE (the default): the effect question's original derive/wear wording, unchanged (§51, the-prisoner#18)."
  );
  transcript.push(
    SEAT === "off"
      ? "Seats: both minds are models, as every recorded batch is."
      : `HUMAN SEAT (\`PRISONER_HUMAN=${SEAT}\`): ${SEAT === "prisoner" ? PRISONER_NAME : WARDEN_NAME} was played by a person at a terminal, shown exactly ` +
        "what the model in that chair would have been shown (`src/open/humanSeat.ts`). NOT a model-vs-model game: never pool it with one as evidence."
  );
  if (SEAT !== "off") {
    transcript.push(
      VIEW === "narrated"
        ? `View: NARRATED (\`PRISONER_VIEW=narrated\`, D3): the human seat's own situation was shown as prose from a narrator model (\`${NARRATOR_MODEL}\`, \`src/open/narrator.ts\`) over the SAME data \`prose\` composes from, but ONLY once \`verifyNarration\` found nothing wrong with it -- a rejected or silent narration fell back to the deterministic prose view instead (\`src/open/proseView.ts\`), never shown to the player as an error. The player could type "raw" at any intent prompt to see the raw view on demand.`
        : VIEW === "prose"
          ? "View: PROSE (`PRISONER_VIEW=prose`): the human seat's own situation was shown as deterministic prose composed by code (`src/open/proseView.ts`, the-prisoner#21), never a different information set than the raw view below -- the player could type \"raw\" at any intent prompt to see it on demand."
          : "View: RAW (the default): the human seat's own situation was shown exactly as the model's own prompt opens, unchanged since before the-prisoner#21."
    );
    if (VIEW === "narrated") {
      transcript.push(
        `Narrator model: \`${NARRATOR_MODEL}\` (\`PRISONER_NARRATOR_MODEL\`, defaults to the voice model). ` +
          "See docs/OPEN-VARIANT.md's own section on this switch for what `verifyNarration` checks, and what it plainly cannot."
      );
    }
  }
  transcript.push("");
  // The authored descriptions, once: every referee citation in this file quotes
  // one of them (`desc:<id>: "..."`), and every mind reads them each turn, so a
  // transcript that does not carry them cannot be checked on its own. Each
  // half-round below adds only the descriptions that have CHANGED from these
  // (`perceivedLines`, §49's own consequence).
  transcript.push("## Objects as authored");
  transcript.push("");
  for (const object of OPEN_OBJECTS) transcript.push(`- \`${object.id}\`: ${object.description}`);
  transcript.push("");
  transcript.push("## Rounds");
  transcript.push("");

  const timings: string[] = [];
  let halfStart = performance.now();
  const dir = join(process.cwd(), "checkpoints");
  const file = join(dir, `${stamp}.md`);
  let written = false;
  try {
    const game = await runOpenGame({
      openWorld,
      resolver,
      referee,
      wardenMind,
      prisonerMind,
      rounds: ROUNDS,
      presenceMode: PRESENCE,
      ...(precedent ? { precedent } : {}),
      ...(PICK ? { pick: PICK } : {}),
      onHalfRound: (half) => {
        const ms = performance.now() - halfStart;
        timings.push(`- round ${half.roundN}, ${half.principal}: ${ms.toFixed(0)}ms${half.proposal ? "" : " (silent)"}`);
        const passive = WARDEN_MODE === "passive" && half.principal === "warden" ? { reason: "passive warden (§26)" } : undefined;
        transcript.push(...renderOpenHalfRound(half, half.proposal ? undefined : (passive ?? lastSilence[half.principal]), lastVoiceSilence[half.principal]));
        lastSilence[half.principal] = undefined;
        lastVoiceSilence[half.principal] = undefined;
        // With a person in a chair the screen must tell them nothing their briefing would
        // not: the model run's per-half "possible / impossible" line is the other side's
        // outcome, which is exactly what the fog exists to withhold. They learn a turn
        // happened -- the clock is visible anyway -- and nothing more.
        // eslint-disable-next-line no-console
        console.log(
          SEAT === "off"
            ? `round ${half.roundN} ${half.principal}: ${half.proposal ? (half.ruling?.applicable ? "possible" : "impossible") : "silent"} (${ms.toFixed(0)}ms)`
            : half.principal === SEAT
              ? ""
              : `(${half.principal === "warden" ? WARDEN_NAME : PRISONER_NAME} has taken a turn.)`
        );
        halfStart = performance.now();
      },
    });

    const { summary: loadedAtEnd } = await safePsSummary();
    transcript.push(...renderOpenSummary(game, ROUNDS));
    transcript.push("## Final state");
    transcript.push("");
    transcript.push(`Models loaded at end (/api/ps): ${loadedAtEnd}`);
    transcript.push("");
    transcript.push("### Resources");
    transcript.push(...finalResourceValues(openWorld.base));
    transcript.push("");
    transcript.push("### Derived objects (OPEN-VARIANT.md §13)");
    transcript.push("");
    transcript.push(`Made this game: ${openWorld.derived.length}.`);
    for (const d of openWorld.derived) transcript.push(`- ${d.id} (${d.kindId}), held by the ${d.heldBy}: ${d.description}`);
    // OPEN-VARIANT.md §14.2: reshaped into something else during the game.
    for (const d of openWorld.destroyed) transcript.push(`- ${d.id} (${d.kindId}), reshaped and gone: ${d.description}`);
    transcript.push("");
    transcript.push("### Half-round timings");
    transcript.push(...timings);
    transcript.push("");
    if (VIEW === "narrated") {
      transcript.push("### Narrator (D3, the-prisoner#21 route 2)");
      transcript.push("");
      transcript.push(
        `Narrator calls rejected by \`verifyNarration\` (fell back to the prose view): ${narratorRejections}. ` +
          `Silent (empty/unparseable/timed out, never reached the checker): ${narratorSilences}. ` +
          `Violations by kind: ${formatViolationTally(narratorRejectionKinds)}.`
      );
      transcript.push("");
      transcript.push(
        `Narrations SHOWN that left part of the catalogue out (§60, never a fault): ${narratorShownWithGaps}. ` +
          `What they left out, by kind: ${formatViolationTally(narratorObservedKinds)}.`
      );
      transcript.push("");
    }
    transcript.push("### GPU swaps");
    transcript.push("");
    const swapEvents = swapper.swapEvents;
    transcript.push(`Swap count: ${swapEvents.length}.`);
    if (swapEvents.length > 0) {
      const totalUnloadMs = swapEvents.reduce((sum, e) => sum + e.unloadMs, 0);
      transcript.push(`Mean unload+poll wall time: ${(totalUnloadMs / swapEvents.length).toFixed(0)}ms. Total: ${totalUnloadMs.toFixed(0)}ms.`);
    }

    mkdirSync(dir, { recursive: true });
    writeFileSync(file, transcript.join("\n") + "\n");
    written = true;
    writeFileSync(join(dir, `${stamp}.referee.json`), JSON.stringify(refereeRequestsFor(game.halves), null, 2) + "\n");
    if (precedentLedger && PRECEDENT_LEDGER) {
      // Only a finished game adds to the warden's experience.
      writeFileSync(PRECEDENT_LEDGER, JSON.stringify(recordGame(precedentLedger, stamp, game.halves), null, 2) + "\n");
      // eslint-disable-next-line no-console
      console.log(`Precedent ledger updated: ${PRECEDENT_LEDGER}`);
    }
    // eslint-disable-next-line no-console
    console.log(`Transcript written to ${file}`);
    // eslint-disable-next-line no-console
    console.log(`Result: ${game.ended?.kind ?? "timeout"} at round ${game.endedAtRound ?? ROUNDS}`);
    // the-prisoner#20: counted here as well as rendered per half-round, so a
    // run whose voice model misbehaved says so without reading the transcript.
    // eslint-disable-next-line no-console
    console.log(`Voice silences: ${voiceSilenceCount}`);
    if (VIEW === "narrated") {
      // D3, the-prisoner#21 route 2: printed regardless of whether either
      // count is zero, same reasoning as Voice silences above -- a run whose
      // narrator misbehaved says so without reading the transcript.
      // eslint-disable-next-line no-console
      console.log(`Narrator rejections: ${narratorRejections}. Narrator silences: ${narratorSilences}.`);
    }
  } catch (err) {
    // A bad run is still evidence (CLAUDE.md: transcripts committed unedited,
    // including bad runs): write what was played, and why it stopped.
    if (!written) {
      transcript.push("## Run aborted");
      transcript.push("");
      transcript.push("```");
      transcript.push(err instanceof Error ? (err.stack ?? err.message) : String(err));
      transcript.push("```");
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, transcript.join("\n") + "\n");
      // eslint-disable-next-line no-console
      console.log(`Partial transcript written to ${file}`);
    }
    throw err;
  } finally {
    rl?.close();
    await swapper.restoreResidents(residentsAtStart);
  }
}

assertSeatIsPlayable(SEAT, { isTty: process.stdin.isTTY === true });

if (SEAT !== "off" && VARIANT !== "open") {
  throw new Error('PRISONER_HUMAN needs PRISONER_VARIANT=open: in the closed variant a mind picks from a move list, so there is nothing for a person to type.');
}

(VARIANT === "open" ? mainOpen() : main()).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
