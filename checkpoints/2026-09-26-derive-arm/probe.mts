// PRISONER_DERIVE_REPEAT arm probe (OPEN-VARIANT.md §78, D11 follow-up,
// docs/HUMAN-INTENTS-DESIGN.md). Adapts the replay pattern
// `checkpoints/2026-09-26-human-intents/probe.mts` built: state is rebuilt,
// never copied, by replaying every earlier half-round of a row's OWN source
// b7 transcript (in file order, up to but excluding the row's own turn)
// through the real `planEffect` + `resolver.resolve()` + `adoptDerivedObject`
// path, using each earlier turn's RECORDED KEYS parsed from its
// "**Referee:**" table -- never the model, and never a recorded/frozen
// request for the row itself. `buildOpenWorld` is called fresh (today's
// scenario objects, post-D5/D9), so only the MECHANICAL history replays;
// the scenario text itself is never taken from the old transcript.
//
// `--dry` never calls the transport -- it only builds each row's two arms'
// requests and prints/records whether the repeat-derive clause text is
// present, confirming the clause fires exactly where its own precondition
// (a derivable kind already has an instance in view) holds and nowhere else,
// with NO network call. `--live` rules for real, against Muse
// (`doris:11435`, `muse-glimmer-30b-q4_k_m`, thinking off), one call at a
// time, strictly serial (CLAUDE.md "one driver at a time").
//
// Two arms only (OFF, ON) -- this is a single clause, not a pair probed
// together like D6+D9 (`checkpoints/2026-09-26-arms/`). Elision, container
// clause, instrument and derive wording are held at the GAME's own shipped
// defaults throughout (read from `readXMode(undefined)`, never left
// implicit -- the `prisoner-measurement-fidelity` lesson), so only
// `repeatDeriveMode` varies between the two arms.
//
//   npx tsx checkpoints/2026-09-26-derive-arm/probe.mts --dry [--only=ID,ID,...]
//   npx tsx checkpoints/2026-09-26-derive-arm/probe.mts --live [--only=ID,ID,...]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

// CLAUDE.md hard rule 2: a throwaway /tmp file, never the default path.
process.env.DMCP_DB_PATH = `/tmp/derive-arm-probe-${process.pid}.db`;

const { initializeSchema } = await import("run-dmcp");
const { prisonerMigration } = await import(join(REPO, "src/world/schema.js"));
const { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf, nextDerivedId, adoptDerivedObject } = await import(join(REPO, "src/open/world.js"));
const { computePerceivedObjects } = await import(join(REPO, "src/open/briefing.js"));
const { createReferee, readElisionMode, readContainerClauseMode, readInstrumentMode, readDeriveWordingMode, readDeriveRepeatMode } = await import(join(REPO, "src/open/referee.js"));
const { planEffect } = await import(join(REPO, "src/open/effects.js"));
const { buildOpenResolver } = await import(join(REPO, "src/open/mechanics.js"));
const { createRefereeTransport } = await import(join(REPO, "src/open/refereeTransport.js"));

// The game's own current defaults -- explicit, never implicit (the
// `prisoner-measurement-fidelity` lesson). No env override is set for this
// run, so these resolve to: elision "on", containerClause "off",
// instrument "off", deriveWording "baseline". Only `repeatDeriveMode` is
// this probe's own variable, set per arm below, never from env.
const ELISION_MODE = readElisionMode(process.env.PRISONER_ELISION);
const CONTAINER_CLAUSE_MODE = readContainerClauseMode(process.env.PRISONER_CONTAINER_CLAUSE);
const INSTRUMENT_MODE = readInstrumentMode(process.env.PRISONER_INSTRUMENT);
const DERIVE_WORDING_MODE = readDeriveWordingMode(process.env.PRISONER_DERIVE_WORDING);
void readDeriveRepeatMode; // imported for parity with checkpoint.ts's own reads; arms are set explicitly below.

type Arm = "OFF" | "ON";
const ARMS: readonly Arm[] = ["OFF", "ON"];

type Ruling = {
  round: number;
  t: number;
  chair: "warden" | "prisoner";
  intent: string;
  target: string | null;
  effect: string | null;
  product: string | null;
  property: string | null;
  magnitude: string | null;
  applicable: boolean;
};

/** Identical table format every checkpoint transcript in this repo uses --
 *  see `checkpoints/2026-09-26-human-intents/probe.mts`'s own header for why
 *  this reads the table, never a recorded `.referee.json` request. */
function parseTranscript(path: string): Ruling[] {
  const text = readFileSync(path, "utf-8");
  const blocks = text.split(/(?=^### Round )/m).filter((b) => b.startsWith("### Round"));
  const rows: Ruling[] = [];
  for (const b of blocks) {
    const hdr = b.match(/^### Round (\d+) \(t=(\d+)\) -- the (warden|prisoner)/);
    if (!hdr) continue;
    const intentM = b.match(/\*\*Intent:\*\* (.+)/);
    const ruledM = b.match(/\*\*Ruled:\*\* (\w+)/);
    const cell = (id: string) => b.match(new RegExp("\\| " + id + " \\| `([^`]+)`"));
    rows.push({
      round: Number(hdr[1]),
      t: Number(hdr[2]),
      chair: hdr[3] as "warden" | "prisoner",
      intent: intentM?.[1]?.trim() ?? "",
      target: cell("target")?.[1] ?? null,
      effect: cell("effect")?.[1] ?? null,
      product: cell("product")?.[1] ?? null,
      property: cell("property")?.[1] ?? null,
      magnitude: cell("magnitude")?.[1] ?? null,
      applicable: ruledM?.[1] === "possible",
    });
  }
  return rows;
}

function propertyCitationQuote(text: string, round: number, chair: string): string | null {
  const blocks = text.split(/(?=^### Round )/m).filter((b) => b.startsWith("### Round"));
  const b = blocks.find((x) => x.startsWith(`### Round ${round} (t=`) && x.includes(`-- the ${chair}`));
  if (!b) return null;
  const row = b.match(/\| property \| `[^`]+` \| ([^|]+) \|/);
  const q = row?.[1]?.match(/"([^"]+)"/);
  return q?.[1] ?? null;
}

const warnings: string[] = [];

/** Applies one earlier turn's RECORDED ruling to `world`/`resolver` -- never
 *  the model. Identical scope/skip rules to `checkpoints/
 *  2026-09-26-human-intents/probe.mts`'s own `replayTurn` (reveal/noise/
 *  take/give/expose-on-person skipped: none change a perceived object's
 *  description text or the perceived-object set in this scenario). */
function replayTurn(world: any, resolver: any, rec: Ruling, transcriptPath: string, rowId: string): void {
  if (!rec.applicable || rec.target === null || rec.effect === null) return;
  if (["reveal", "noise", "take", "give"].includes(rec.effect)) return;
  const actorId = rec.chair === "prisoner" ? world.base.prisonerId : world.base.wardenId;
  const isPersonTarget = rec.target === "prisoner" || rec.target === "warden";
  if (rec.effect === "expose" && isPersonTarget) return;
  try {
    const params: Record<string, unknown> = {
      targetObjectId: rec.target,
      effectKind: rec.effect,
      property: rec.property ?? "none",
      magnitude: rec.magnitude ?? "slight",
      entityIdFor: { ...world.entityIdFor, prisoner: world.base.prisonerId, warden: world.base.wardenId },
      resourceIdFor: world.resourceIdFor,
      exits: world.exits,
      actorId,
      declaredProperty: (objectId: string, key: string) => declaredProperty(world, objectId, key),
      description: `replay: ${rec.intent}`,
    };
    if (rec.effect === "derive") {
      const productId = rec.product && rec.product !== "none" ? rec.product : null;
      if (!productId) {
        warnings.push(`${rowId}: replay round ${rec.round} ${rec.chair} was ruled derive with no product recorded -- skipped`);
        return;
      }
      const text = readFileSync(transcriptPath, "utf-8");
      const parentSpan = propertyCitationQuote(text, rec.round, rec.chair) ?? "(citation not printed in the transcript's table -- placeholder)";
      (params as any).derive = { product: productId, parentSpan, actorId, ownerLocationId: world.base.cellId, newObjectId: nextDerivedId(world, productId) };
    }
    const plan = planEffect(params as any);
    if (!plan) {
      warnings.push(`${rowId}: replay round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) produced no plan -- skipped, state may be incomplete`);
      return;
    }
    const outcome = resolver.resolve({ gameId: world.base.gameId, mechanic: plan.mechanic, parameters: plan.parameters });
    if ((plan as any).derived && outcome.result.made === true) {
      adoptDerivedObject(world, { ...(plan as any).derived, heldBy: rec.chair, outcome });
    }
  } catch (err) {
    warnings.push(`${rowId}: replay round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) threw -- skipped: ${String(err).slice(0, 200)}`);
  }
}

/**
 * The 7 rows this probe measures, drawn straight from `corpus.json`
 * (`checkpoints/2026-09-26-human-intents/`) -- never retyped from memory.
 * `kind`:
 *   - "fix": D11 misread, has a derived strip in view by replay (checked by
 *     hand, see PREDICTION.md) -- wants `target: blanket, effect: derive,
 *     property: integrity, applicable: true` under ON.
 *   - "scope": D11 misread, but its OWN game's first turn -- no derived
 *     instance exists yet, so this clause's precondition cannot fire.
 *     Reported as a scope check (OFF and ON must read identically), never a
 *     fix target.
 *   - "trap-strict": targets the ALREADY-DERIVED piece itself (the strip),
 *     not the source -- must stay `wear`/`strip` in both arms.
 *   - "trap-soft": D11's own `blanket-wear` row, pre-registered by the
 *     corpus as a genuine close call (either `wear` or `derive` on the
 *     blanket is "correct") -- reported, not scored.
 */
const ROWS: { id: string; kind: "fix" | "scope" | "trap-strict" | "trap-soft"; sourceFile: string; round: number; chair: "prisoner"; intentTested: string }[] = [
  { id: "B7-P41", kind: "fix", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T06-41-21-019Z.md", round: 5, chair: "prisoner", intentTested: "tug the thread some more" },
  { id: "B7-P44", kind: "fix", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T06-41-21-019Z.md", round: 8, chair: "prisoner", intentTested: "tug the thread again" },
  { id: "B7-P50", kind: "fix", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T06-58-52-807Z.md", round: 4, chair: "prisoner", intentTested: "tug the thread a little more" },
  { id: "B7-P11", kind: "scope", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T05-45-03-050Z.md", round: 1, chair: "prisoner", intentTested: "work the loose thread on the blanket hem" },
  { id: "B7-P47", kind: "scope", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T06-58-52-807Z.md", round: 1, chair: "prisoner", intentTested: "tug the loose thread quietly" },
  { id: "B7-P02", kind: "trap-strict", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T05-26-30-915Z.md", round: 2, chair: "prisoner", intentTested: "pull at the wool strip between my fingers" },
  { id: "B7-P15", kind: "trap-soft", sourceFile: "checkpoints/2026-09-25-phase1-b7/T/2026-09-25T05-45-03-050Z.md", round: 7, chair: "prisoner", intentTested: "pull a bit more thread from the blanket" },
];

/** Builds the world+resolver+perceived-objects for one row by replaying its
 *  prior turns from its OWN source file, exactly as both `--dry` and
 *  `--live` need -- shared so the two modes can never build two different
 *  requests for the same row. */
function buildWorldFor(row: (typeof ROWS)[number]): { world: any; perceived: any[] } {
  initializeSchema({ migrations: [prisonerMigration] });
  const world = buildOpenWorld({ presence: "modelled" });
  const resolver = buildOpenResolver();

  const abs = join(REPO, row.sourceFile);
  const all = parseTranscript(abs);
  const prior = all.filter((r) => r.round < row.round || (r.round === row.round && r.chair === "warden" && row.chair === "prisoner"));
  for (const rec of prior) replayTurn(world, resolver, rec, abs, row.id);

  const t = world.base.clock.prisonerT(row.round);
  const perceived = computePerceivedObjects(world, "prisoner", t, "modelled");
  return { world, perceived };
}

function refereeOptionsFor(world: any, arm: Arm) {
  return {
    isDeclared: (objectId: string, key: string) => declaredProperty(world, objectId, key) !== undefined,
    kindOf: (objectId: string) => derivedKindOf(world, objectId),
    propertiesOf: (objectId: string) => declaredPropertyKeys(world, objectId),
    instrumentMode: INSTRUMENT_MODE,
    deriveWording: DERIVE_WORDING_MODE,
    elisionMode: ELISION_MODE,
    containerClauseMode: CONTAINER_CLAUSE_MODE,
    repeatDeriveMode: arm === "ON" ? ("on" as const) : ("off" as const),
    oneAct: "off" as const,
  };
}

async function mainDry(only: Set<string> | null) {
  const outPath = join(HERE, "dry-run.jsonl");
  writeFileSync(outPath, "");
  const REPEAT_TEXT = "Working the target again for more of a kind of thing it has already yielded here";

  for (const row of ROWS) {
    if (only && !only.has(row.id)) continue;
    for (const arm of ARMS) {
      const { world, perceived } = buildWorldFor(row);
      let captured: { questions: readonly any[] } | null = null;
      const captor = async (request: { questions: readonly any[] }) => {
        captured = request;
        return [];
      };
      await createReferee([captor], refereeOptionsFor(world, arm)).rule(row.intentTested, perceived);
      const effectPrompt = captured ? (captured.questions.find((q: any) => q.id === "effect")?.prompt as string | undefined) : undefined;
      const clausePresent = !!effectPrompt?.includes(REPEAT_TEXT);
      const strip = perceived.find((o: any) => o.id.startsWith("strip"));
      const rec = { id: row.id, kind: row.kind, arm, perceivedStrip: strip?.id ?? null, clausePresent };
      appendFileSync(outPath, JSON.stringify(rec) + "\n");
      console.log(`${row.id.padEnd(8)} ${arm.padEnd(4)} kind=${row.kind.padEnd(11)} strip-in-view=${String(!!strip).padEnd(5)} clause-present=${clausePresent}`);
    }
  }
  writeFileSync(join(HERE, "dry-run-warnings.json"), JSON.stringify(warnings, null, 1));
  console.log(`\n${warnings.length} replay warnings (see dry-run-warnings.json). No network call made.`);
  console.log(`Written to ${outPath}`);
}

async function mainLive(only: Set<string> | null) {
  const outPath = join(HERE, "results.jsonl");
  if (!existsSync(outPath)) writeFileSync(outPath, "");
  const already = new Set(
    readFileSync(outPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => `${JSON.parse(l).arm}:${JSON.parse(l).id}`)
  );

  const transport = createRefereeTransport({
    baseUrl: "http://doris:11435/v1",
    model: "muse-glimmer-30b-q4_k_m",
    timeoutMs: 600_000,
    ensureLoaded: async () => {},
    thinking: "off",
  });

  const calls: { row: (typeof ROWS)[number]; arm: Arm }[] = [];
  for (const arm of ARMS) for (const row of ROWS) if ((!only || only.has(row.id)) && !already.has(`${arm}:${row.id}`)) calls.push({ row, arm });
  console.log(`${calls.length} calls to run (${already.size} already in ${outPath}, resumed)`);

  let n = 0;
  const started = Date.now();
  // Strictly serial: one `for` loop, `await`ed, never `Promise.all`, never a
  // second driver (CLAUDE.md "one driver at a time").
  for (const { row, arm } of calls) {
    const t0 = Date.now();
    let rec: Record<string, unknown>;
    try {
      const { world, perceived } = buildWorldFor(row);
      const ruling: any = await createReferee([transport as any], refereeOptionsFor(world, arm)).rule(row.intentTested, perceived);
      rec = {
        id: row.id,
        kind: row.kind,
        arm,
        intentTested: row.intentTested,
        applicable: ruling.applicable,
        target: ruling.targetObjectId,
        effect: ruling.effectKind,
        product: ruling.product,
        property: ruling.property,
        magnitude: ruling.magnitude,
        citations: {
          target: ruling.citations?.target?.citation?.quote ?? null,
          effect: ruling.citations?.effect?.citation?.quote ?? null,
          property: ruling.citations?.property?.citation?.quote ?? null,
        },
        secs: Math.round((Date.now() - t0) / 100) / 10,
      };
      console.log(`[${++n}/${calls.length}] ${row.id.padEnd(8)} ${arm.padEnd(4)} ${ruling.targetObjectId}/${ruling.effectKind}/${ruling.property} applicable=${ruling.applicable} (${rec.secs}s)`);
    } catch (err) {
      rec = { id: row.id, kind: row.kind, arm, intentTested: row.intentTested, error: String(err).slice(0, 500), secs: Math.round((Date.now() - t0) / 100) / 10 };
      console.log(`[${++n}/${calls.length}] ${row.id.padEnd(8)} ${arm.padEnd(4)} ERROR: ${String(err).slice(0, 200)}`);
    }
    appendFileSync(outPath, JSON.stringify(rec) + "\n");
  }
  console.log(`\ndone: ${n} calls in ${Math.round((Date.now() - started) / 1000)}s -> ${outPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith("--only="))?.split("=")[1];
  const only = onlyArg ? new Set(onlyArg.split(",")) : null;
  if (args.includes("--live")) {
    await mainLive(only);
    return;
  }
  if (!args.includes("--dry")) {
    throw new Error("probe.mts: pass --dry or --live explicitly.");
  }
  await mainDry(only);
}

await main();
