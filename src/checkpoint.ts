// The checkpoint (this task's brief; design §10 lands this as P6, but with
// the warden a model too, per correction 1 -- P6's human CLI is out of
// scope here). Five rounds = ten half-rounds, warden at even t, prisoner at
// odd t, both minds against a local OpenAI-compatible endpoint, driven by
// `src/loop.ts`'s `runHalfRound` -- the same function `src/__tests__/
// loop.test.ts` exercises deterministically with scripted minds. Writes a
// Markdown transcript to checkpoints/<ISO timestamp>.md.
//
// The database is a fresh scratch file under /tmp -- never a default path
// (root CLAUDE.md hard rule 2 for this whole workspace) -- set before any
// run-dmcp function is called (imports alone do nothing; see run-dmcp's own
// library/application split).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDatabase, initializeSchema, ResolveProtocolError, type Outcome, type Contradiction, type ConstraintViolationError } from "run-dmcp";
import { buildWorld, type World } from "./world/setup.js";
import { buildResolver } from "./world/mechanics.js";
import { prisonerMigration } from "./world/schema.js";
import { authorPlan, renderLedger } from "./ledger/ledger.js";
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
// tables and this repository's own (plans/plan_steps/attempts/round_log,
// the items.cut/concealed columns) in the same startup pass -- exactly what
// world/testDb.ts's createTestDb() does for tests, reproduced here because
// this script never runs through vitest's setup.
initializeSchema({ migrations: [prisonerMigration] });

const MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const MODEL = process.env.PRISONER_MODEL ?? "qwen2.5:14b";
const THINK_TIMEOUT_MS = process.env.PRISONER_THINK_TIMEOUT_MS
  ? Number(process.env.PRISONER_THINK_TIMEOUT_MS)
  : undefined;
const ROUNDS = 5;

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

/** Item 9: the checkpoint's own side channel (see prisonerMind.ts's/
 *  wardenMind.ts's `onRawAnswer` for the wire-side half). Reset before
 *  every `mind.consider()` call this script makes and read immediately
 *  after, so a stale answer from a previous round can never be mistaken
 *  for this one's. */
interface RawAnswerHolder {
  captured: boolean;
  raw: unknown;
}

function freshRawAnswerHolder(): RawAnswerHolder {
  return { captured: false, raw: undefined };
}

function renderHalfRound(world: World, half: HalfRoundResult, rawAnswer: RawAnswerHolder): string[] {
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
    if (r.reason === "rejected") {
      // Item 9: the model's raw parsed answer, verbatim -- never a guess
      // at what it "must have meant". `rejected` means coerce DID see a
      // parsed object (a choice outside `moves`, or some other shape
      // coerce refused), so there is always something captured here; if
      // there genuinely were not, this says so rather than inventing one.
      lines.push("**Raw answer (rejected):**");
      lines.push("```json");
      lines.push(rawAnswer.captured ? JSON.stringify(rawAnswer.raw, null, 2) : "(no raw answer was captured)");
      lines.push("```");
    }
    if (r.loud) {
      lines.push(`**${loudSilenceMessage(half.principal, MODEL_URL, MODEL, r.reason, 2)}**`);
    }
  } else {
    lines.push(`**Intent:** ${r.proposal.intent}`);
    if (r.proposal.line) lines.push(`**Line:** "${r.proposal.line}"`);
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

  const prisonerPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.prisonerId,
    t: world.clock.t0,
    steps: [
      { move: "HONE", description: "Hone the spoon into something sharper." },
      { move: "FILE", description: "File at the bar." },
      { move: "FILE", description: "Keep filing at the bar." },
      { move: "FILE", description: "File until it gives." },
      { move: "CONCEAL", description: "Hide the evidence under the loose tile." },
    ],
  });
  const wardenPlan = authorPlan({
    gameId: world.gameId,
    characterId: world.wardenId,
    t: world.clock.t0,
    steps: [
      { move: "OBSERVE", description: "Watch the prisoner closely." },
      { move: "ROTATE_GUARD", description: "Rotate the guard." },
      { move: "OBSERVE", description: "Watch again." },
      { move: "SERVICE_LOCK", description: "Service the lock." },
      { move: "OBSERVE", description: "Keep watching." },
    ],
  });

  const wardenTracker = newSilenceTracker();
  const prisonerTracker = newSilenceTracker();
  const timings: Timing[] = [];

  // Item 9: mutable holders the checkpoint owns; reset before each round's
  // call, read right after. `onRawAnswer` fires from inside coerce
  // (prisonerMind.ts/wardenMind.ts), which is the only place with the raw
  // parsed object.
  let wardenRawAnswer = freshRawAnswerHolder();
  let prisonerRawAnswer = freshRawAnswerHolder();

  const wardenMind = createWardenMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason) => noteSilenceReason(wardenTracker, reason),
    onRawAnswer: (raw) => (wardenRawAnswer = { captured: true, raw }),
  });
  const prisonerMind = createPrisonerMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason) => noteSilenceReason(prisonerTracker, reason),
    onRawAnswer: (raw) => (prisonerRawAnswer = { captured: true, raw }),
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
      `\`run-dmcp@${pinnedDependencyVersion("run-dmcp")}\`'s resolve protocol. The prisoner's ` +
      "authored plan: hone the spoon, file at the bar repeatedly, then hide the evidence. The " +
      "warden's: watch closely, rotate the guard, service the lock."
  );
  transcript.push("");
  transcript.push(`Model: \`${MODEL}\` at \`${MODEL_URL}\`. Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}.`);
  transcript.push(`Database: \`${dbPath}\` (scratch, never the default path).`);
  // The doris GPU-sharing protocol (this session's own instruction): doris
  // holds only one big model at a time, so every run records what
  // /api/ps showed loaded, at start and end -- generated by the run
  // itself, never added after the fact.
  const loadedAtStart = await fetchLoadedModelsSummary(MODEL_URL);
  transcript.push(`Models loaded on doris at start (/api/ps): ${loadedAtStart}`);
  transcript.push("");
  transcript.push("## Rounds");
  transcript.push("");

  for (let n = 1; n <= ROUNDS; n++) {
    transcript.push(`## Round ${n}`);
    transcript.push("");

    const tw = world.clock.wardenT(n);
    const wardenContext = buildWardenContext(world, wardenPlan, tw);
    wardenRawAnswer = freshRawAnswerHolder();
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
    transcript.push(...renderHalfRound(world, wardenHalf, wardenRawAnswer));

    const tp = world.clock.prisonerT(n);
    const prisonerContext = buildPrisonerContext(world, prisonerPlan, tp);
    prisonerRawAnswer = freshRawAnswerHolder();
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
    transcript.push(...renderHalfRound(world, prisonerHalf, prisonerRawAnswer));
  }

  const loadedAtEnd = await fetchLoadedModelsSummary(MODEL_URL);

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
  transcript.push("### Model call timings and silence counts");
  transcript.push("");
  transcript.push(`Total calls: ${timings.length}. Silent: ${silentCount}. Timeout used: ${THINK_TIMEOUT_MS ?? 12000}ms.`);
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
  console.log(`Calls: ${timings.length}, silent: ${silentCount}, timeoutMs: ${THINK_TIMEOUT_MS ?? 12000}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
