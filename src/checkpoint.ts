// The checkpoint (this task's brief; design §10 lands this as P6, but with
// the warden a model too, per correction 1 -- P6's human CLI is out of
// scope here). Five rounds = ten half-rounds, warden at even t, prisoner at
// odd t, both minds against a local OpenAI-compatible endpoint. Writes a
// Markdown transcript to checkpoints/<ISO timestamp>.md.
//
// The database is a fresh scratch file under /tmp -- never a default path
// (root CLAUDE.md hard rule 2 for this whole workspace) -- set before any
// run-dmcp function is called (imports alone do nothing; see run-dmcp's own
// library/application split).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getDatabase,
  ResolveProtocolError,
  ConstraintViolationError,
  type Outcome,
  type Contradiction,
} from "run-dmcp";
import type { SilenceReason } from "mind-seam";
import { buildWorld, type World } from "./world/setup.js";
import { buildResolver, declareCutIfJustCut } from "./world/mechanics.js";
import { authorPlan, recordSuccess, recordFailure, activeStepExpects, logRound, renderLedger, type Plan } from "./ledger/ledger.js";
import { buildPrisonerContext, buildWardenContext } from "./mind/briefing.js";
import { createPrisonerMind, type PrisonerProposal } from "./mind/prisonerMind.js";
import { createWardenMind, type WardenProposal } from "./mind/wardenMind.js";

const dbPath = process.env.PRISONER_CHECKPOINT_DB ?? `/tmp/the-prisoner-checkpoint-${Date.now()}.db`;
process.env.DMCP_DB_PATH = dbPath;

const MODEL_URL = process.env.PRISONER_MODEL_URL ?? "http://localhost:11434/v1";
const MODEL = process.env.PRISONER_MODEL ?? "qwen2.5:14b";
const THINK_TIMEOUT_MS = process.env.PRISONER_THINK_TIMEOUT_MS
  ? Number(process.env.PRISONER_THINK_TIMEOUT_MS)
  : undefined;
const ROUNDS = 5;

interface Timing {
  round: number;
  principal: "warden" | "prisoner";
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

function resolutionDescription(eventId: string): string | null {
  const row = getDatabase().prepare(`SELECT description FROM events WHERE id = ?`).get(eventId) as
    | { description: string | null }
    | undefined;
  return row?.description ?? null;
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
    return `resolve protocol refused (${error.reason}):\n` + contradictions.map((c) => `  - ${describeContradiction(world, c)}`).join("\n");
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

async function runHalfRound(params: {
  transcript: string[];
  world: World;
  resolver: ReturnType<typeof buildResolver>;
  plan: Plan;
  principal: "warden" | "prisoner";
  roundN: number;
  t: number;
  briefing: string;
  proposal: PrisonerProposal | WardenProposal | null;
  silenceReason: SilenceReason | undefined;
  silenceStreak: number;
}): Promise<void> {
  const { transcript, world, resolver, plan, principal, roundN, t, briefing, proposal, silenceReason, silenceStreak } = params;

  transcript.push(`### Half-round ${t - world.clock.t0} (t=${t}) -- the ${principal}`);
  transcript.push("");
  transcript.push("**Briefing given, verbatim:**");
  transcript.push("```");
  transcript.push(briefing);
  transcript.push("```");

  if (proposal === null) {
    transcript.push(`**Silence.** SilenceReason: \`${silenceReason ?? "unknown"}\` (consecutive: ${silenceStreak}).`);
    if (silenceStreak >= 2) {
      transcript.push(
        `**LOUD:** the ${principal}'s endpoint (${MODEL_URL}, model ${MODEL}) has been silent for ${silenceStreak} consecutive half-rounds. Last reason: \`${silenceReason}\`.`
      );
    }
    transcript.push("");
    return;
  }

  transcript.push(`**Intent:** ${proposal.intent}`);
  if (proposal.line) transcript.push(`**Line:** "${proposal.line}"`);

  if (!proposal.choice) {
    transcript.push("**No choice offered -- this half-round passes with no proposal to resolve.**");
    transcript.push("");
    return;
  }

  transcript.push(`**Choice:** ${proposal.choice}`);
  const expects = activeStepExpects(plan.id);
  try {
    const outcome = resolver.resolve({ gameId: world.gameId, mechanic: proposal.choice, expects });
    recordSuccess({ gameId: world.gameId, plan, t, move: proposal.choice, outcome, completesStep: true });
    logRound({
      gameId: world.gameId,
      t,
      roundN,
      principal,
      mechanic: proposal.choice,
      description: resolutionDescription(outcome.eventId),
    });
    declareCutIfJustCut(world, outcome);
    transcript.push("**Outcome:**");
    transcript.push("```");
    transcript.push(describeOutcome(world, outcome));
    transcript.push("```");
  } catch (err) {
    if (err instanceof ResolveProtocolError || err instanceof ConstraintViolationError) {
      recordFailure({ gameId: world.gameId, plan, t, move: proposal.choice, error: err });
      transcript.push("**Refused:**");
      transcript.push("```");
      transcript.push(describeRefusal(world, err));
      transcript.push("```");
    } else {
      throw err;
    }
  }
  transcript.push("");
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

  let wardenSilenceStreak = 0;
  let prisonerSilenceStreak = 0;
  let lastWardenSilenceReason: SilenceReason | undefined;
  let lastPrisonerSilenceReason: SilenceReason | undefined;
  const timings: Timing[] = [];

  const wardenMind = createWardenMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason) => {
      lastWardenSilenceReason = reason;
    },
  });
  const prisonerMind = createPrisonerMind({
    baseUrl: MODEL_URL,
    model: MODEL,
    timeoutMs: THINK_TIMEOUT_MS,
    onSilence: (reason) => {
      lastPrisonerSilenceReason = reason;
    },
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
      "(`mind-seam@0.1.0`), both resolved through `run-dmcp`'s resolve protocol. The prisoner's " +
      'authored plan: hone the spoon, file at the bar repeatedly, then hide the evidence. The ' +
      "warden's: watch closely, rotate the guard, service the lock."
  );
  transcript.push("");
  transcript.push(`Model: \`${MODEL}\` at \`${MODEL_URL}\`. Think timeout: ${THINK_TIMEOUT_MS ?? "package default (12000ms)"}.`);
  transcript.push(`Database: \`${dbPath}\` (scratch, never the default path).`);
  transcript.push("");
  transcript.push("## Rounds");
  transcript.push("");

  for (let n = 1; n <= ROUNDS; n++) {
    transcript.push(`## Round ${n}`);
    transcript.push("");

    const tw = world.clock.wardenT(n);
    const wardenContext = buildWardenContext(world, wardenPlan, tw);
    const wStart = performance.now();
    const wardenProposal = await wardenMind.consider(wardenContext);
    const wMs = performance.now() - wStart;
    wardenSilenceStreak = wardenProposal === null ? wardenSilenceStreak + 1 : 0;
    timings.push({ round: n, principal: "warden", ms: wMs, silent: wardenProposal === null });
    await runHalfRound({
      transcript,
      world,
      resolver,
      plan: wardenPlan,
      principal: "warden",
      roundN: n,
      t: tw,
      briefing: wardenContext.briefing,
      proposal: wardenProposal,
      silenceReason: lastWardenSilenceReason,
      silenceStreak: wardenSilenceStreak,
    });

    const tp = world.clock.prisonerT(n);
    const prisonerContext = buildPrisonerContext(world, prisonerPlan, tp);
    const pStart = performance.now();
    const prisonerProposal = await prisonerMind.consider(prisonerContext);
    const pMs = performance.now() - pStart;
    prisonerSilenceStreak = prisonerProposal === null ? prisonerSilenceStreak + 1 : 0;
    timings.push({ round: n, principal: "prisoner", ms: pMs, silent: prisonerProposal === null });
    await runHalfRound({
      transcript,
      world,
      resolver,
      plan: prisonerPlan,
      principal: "prisoner",
      roundN: n,
      t: tp,
      briefing: prisonerContext.briefing,
      proposal: prisonerProposal,
      silenceReason: lastPrisonerSilenceReason,
      silenceStreak: prisonerSilenceStreak,
    });
  }

  transcript.push("## Final state");
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

  console.log(`Transcript written to ${file}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Calls: ${timings.length}, silent: ${silentCount}, timeoutMs: ${THINK_TIMEOUT_MS ?? 12000}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
