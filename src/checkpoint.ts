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
import { mkdirSync, writeFileSync } from "node:fs";
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
import { fetchLoadedModelsSummary } from "./ollamaStatus.js";
import {
  runHalfRound,
  newSilenceTracker,
  noteSilenceReason,
  loudSilenceMessage,
  type Principal,
  type HalfRoundResult,
} from "./loop.js";

const dbPath = process.env.PRISONER_CHECKPOINT_DB ?? `/tmp/the-prisoner-checkpoint-${Date.now()}.db`;
process.env.DMCP_DB_PATH = dbPath;
// Never touch the default database (root CLAUDE.md hard rule 2): this is a
// fresh scratch file, and initializeSchema brings up both run-dmcp's own
// tables and this repository's own in the same startup pass.
initializeSchema({ migrations: [prisonerMigration] });

const MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const MODEL = process.env.PRISONER_MODEL ?? "qwen2.5:14b";
const THINK_TIMEOUT_MS = process.env.PRISONER_THINK_TIMEOUT_MS
  ? Number(process.env.PRISONER_THINK_TIMEOUT_MS)
  : undefined;
const ROUNDS = process.env.PRISONER_ROUNDS ? Number(process.env.PRISONER_ROUNDS) : 12;

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
      lines.push(`**${loudSilenceMessage(half.principal, MODEL_URL, MODEL, r.reason, 2)}**`);
    }
  } else {
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

  // Short OPENING plans only (this task's brief: "authored plans are only
  // starting intentions; give the warden standing orders plus a short
  // opening plan") -- both minds can extend/replace the rest via their own
  // `plan` proposal field (`src/ledger/ledger.ts`'s `revisePlan`) as the
  // game actually unfolds, over up to ROUNDS rounds.
  const prisonerPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.prisonerId,
    t: world.clock.t0,
    steps: [
      { move: "HONE", description: "Hone the spoon into something sharper." },
      { move: "FILE", description: "File at the bar." },
      { move: "FILE", description: "Keep filing at the bar." },
    ],
  });
  const wardenPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.wardenId,
    t: world.clock.t0,
    steps: [
      // Standing orders: watch by default; the warden's own plan revision
      // is how it escalates to SEARCH/ROTATE_GUARD once suspicion warrants
      // it.
      { move: "OBSERVE", description: "Watch the prisoner closely." },
      { move: "OBSERVE", description: "Keep watching." },
      { move: "ROTATE_GUARD", description: "Rotate the guard." },
    ],
  });

  const wardenTracker = newSilenceTracker();
  const prisonerTracker = newSilenceTracker();
  const timings: Timing[] = [];
  const stats: RunStats = { refusals: [], planRevisions: [], silences: [] };

  const wardenMind = createWardenMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason, _context, detail) => noteSilenceReason(wardenTracker, reason, detail),
  });
  const prisonerMind = createPrisonerMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason, _context, detail) => noteSilenceReason(prisonerTracker, reason, detail),
  });

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
  transcript.push(`Model: \`${MODEL}\` at \`${MODEL_URL}\`. Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}.`);
  transcript.push(`Rounds (max): ${ROUNDS}.`);
  transcript.push(`Database: \`${dbPath}\` (scratch, never the default path).`);
  const loadedAtStart = await fetchLoadedModelsSummary(MODEL_URL);
  transcript.push(`Models loaded on doris at start (/api/ps): ${loadedAtStart}`);
  transcript.push("");
  transcript.push("## Rounds");
  transcript.push("");

  let ended: GameEnd = null;
  let endedAtRound = -1;

  for (let n = 1; n <= ROUNDS && !ended; n++) {
    transcript.push(`## Round ${n}`);
    transcript.push("");

    const tw = world.clock.wardenT(n);
    const wardenContext = buildWardenContext(world, wardenPlan, tw);
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
    transcript.push(...renderHalfRound(world, wardenHalf));

    ended = checkGameEnd(world, tw);
    if (ended) {
      endedAtRound = n;
    } else {
      const tp = world.clock.prisonerT(n);
      const prisonerContext = buildPrisonerContext(world, prisonerPlan, tp);
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

  const loadedAtEnd = await fetchLoadedModelsSummary(MODEL_URL);

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
  transcript.push(`Silences: ${stats.silences.length}.`);
  for (const s of stats.silences) {
    const text = s.text !== undefined ? JSON.stringify(s.text) : "(no text)";
    const parsed = s.parsed !== undefined ? JSON.stringify(s.parsed) : "(no parsed answer)";
    transcript.push(`  - round ${s.round}, ${s.principal}, reason ${s.reason ?? "unknown"}, text: ${text}, parsed: ${parsed}`);
  }
  transcript.push("");
  transcript.push("### Model call timings");
  transcript.push("");
  for (const timing of timings) {
    transcript.push(`- round ${timing.round}, ${timing.principal}: ${timing.ms.toFixed(0)}ms${timing.silent ? " (silent)" : ""}`);
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
  console.log(`Calls: ${timings.length}, silent: ${silentCount}, refusals: ${stats.refusals.length}, plan revisions: ${stats.planRevisions.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
