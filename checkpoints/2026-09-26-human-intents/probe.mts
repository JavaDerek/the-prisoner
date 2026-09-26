// Finalized harness for D11 (docs/HUMAN-INTENTS-DESIGN.md SS7, the-prisoner#25).
// Rebuilds each corpus.json row's referee REQUEST via `buildOpenWorld` at the
// row's own recorded round -- never a copied/recorded request
// (`prisoner-measurement-fidelity`) -- and, under `--live`, rules on it
// through Muse, strictly one call at a time (CLAUDE.md "one driver at a
// time"). `--dry` never calls the transport, only builds the request.
//
// State is rebuilt, not copied, by REPLAYING every earlier half-round of the
// SAME recorded transcript (both chairs, in file order, up to but excluding
// the row's own turn) through the real `planEffect` + `resolver.resolve()` +
// `adoptDerivedObject` path, using each earlier turn's RECORDED KEYS (parsed
// from the transcript's own "**Referee:**" table) -- never the model, and
// never that turn's own frozen request. Reveal/noise/take/give/expose-on-
// person are skipped during replay: none of them change a perceived
// object's DESCRIPTION TEXT or the perceived-object SET in this scenario
// (only open/close's `passage` and a person's `posture` have `reads`/
// `readRanges`, and only `derive` adds a new perceived object), so skipping
// them is a correctness argument, not a shortcut taken for convenience --
// stated here so the orchestrator can check it rather than discover it.
//
// The referee is built with `elisionMode`/`containerClauseMode`/
// `instrumentMode`/`deriveWording` read from the SAME env vars
// `checkpoint.ts` reads (`PRISONER_ELISION`, `PRISONER_CONTAINER_CLAUSE`,
// `PRISONER_INSTRUMENT`, `PRISONER_DERIVE_WORDING`) rather than left
// implicit -- `createReferee`'s own BARE constructor default for elision is
// `"off"`, which is NOT the game's shipped default (`"on"`, since D6 landed,
// OPEN-VARIANT.md §77); leaving it implicit would have measured a referee
// nobody plays with. `oneAct` stays explicit `"off"`, matching
// `checkpoints/2026-09-26-arms/probe.mts`'s own precedent: a second reader
// call this measurement does not also need to prove, and no row's label
// depends on the one-act flag.
//
//   npx tsx checkpoints/2026-09-26-human-intents/probe.mts --dry [--only=ID,ID,...]
//   npx tsx checkpoints/2026-09-26-human-intents/probe.mts --live [--only=ID,ID,...]
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

// CLAUDE.md hard rule 2: a throwaway /tmp file, never the default path.
process.env.DMCP_DB_PATH = `/tmp/human-intents-probe-${process.pid}.db`;

const { initializeSchema } = await import("run-dmcp");
const { prisonerMigration } = await import(join(REPO, "src/world/schema.js"));
const {
  buildOpenWorld,
  declaredProperty,
  declaredPropertyKeys,
  derivedKindOf,
  nextDerivedId,
  adoptDerivedObject,
} = await import(join(REPO, "src/open/world.js"));
const { computePerceivedObjects } = await import(join(REPO, "src/open/briefing.js"));
const {
  createReferee,
  readElisionMode,
  readContainerClauseMode,
  readInstrumentMode,
  readDeriveWordingMode,
} = await import(join(REPO, "src/open/referee.js"));
const { planEffect } = await import(join(REPO, "src/open/effects.js"));
const { buildOpenResolver } = await import(join(REPO, "src/open/mechanics.js"));
const { createRefereeTransport } = await import(join(REPO, "src/open/refereeTransport.js"));

// The game's own current defaults (checkpoint.ts's own reads), computed once.
// No env override is set for this run, so these resolve to: elision "on",
// containerClause "off", instrument "off", deriveWording "baseline".
const ELISION_MODE = readElisionMode(process.env.PRISONER_ELISION);
const CONTAINER_CLAUSE_MODE = readContainerClauseMode(process.env.PRISONER_CONTAINER_CLAUSE);
const INSTRUMENT_MODE = readInstrumentMode(process.env.PRISONER_INSTRUMENT);
const DERIVE_WORDING_MODE = readDeriveWordingMode(process.env.PRISONER_DERIVE_WORDING);

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

/** Parses one checkpoint transcript's half-round blocks in file order. Reads
 *  the SAME markdown table format every transcript in this repo uses
 *  (`### Round N (t=T) -- the CHAIR`, `**Intent:**`, the `**Referee:**`
 *  table, `**Ruled:**`) -- never a recorded `.referee.json` request, per
 *  this file's own header. */
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

/** The parent span a derive's composed description quotes -- best-effort:
 *  the property row's own cited quote, when the table's citation cell
 *  carries one; a generic placeholder otherwise (this draft never asks the
 *  model, so it cannot re-derive a citation that was not printed). Logged
 *  either way so a placeholder is visible, never silent. */
function propertyCitationQuote(text: string, round: number, chair: string): string | null {
  const blocks = text.split(/(?=^### Round )/m).filter((b) => b.startsWith("### Round"));
  const b = blocks.find((x) => x.startsWith(`### Round ${round} (t=`) && x.includes(`-- the ${chair}`));
  if (!b) return null;
  const row = b.match(/\| property \| `[^`]+` \| ([^|]+) \|/);
  const q = row?.[1]?.match(/"([^"]+)"/);
  return q?.[1] ?? null;
}

type Warning = { rowId: string; note: string };
const warnings: Warning[] = [];

/** Applies one earlier turn's RECORDED ruling to `world`/`resolver` -- never
 *  the model. Reveal/noise/take/give/expose-on-person are structurally
 *  skipped (see this file's header); every other effect goes through the
 *  real `planEffect` + `resolver.resolve()`, exactly as `runOpenHalfRound`
 *  (`src/open/loop.ts`) would, so a replayed state is produced by the
 *  game's own mechanism, not a second, hand-rolled one. */
function replayTurn(world: any, resolver: any, rec: Ruling, transcriptPath: string, rowIdForWarnings: string): void {
  if (!rec.applicable || rec.target === null || rec.effect === null) return;
  if (["reveal", "noise", "take", "give"].includes(rec.effect)) return; // no perception impact -- see header
  const actorId = rec.chair === "prisoner" ? world.base.prisonerId : world.base.wardenId;
  const isPersonTarget = rec.target === "prisoner" || rec.target === "warden";
  if (rec.effect === "expose" && isPersonTarget) return; // a search -- custody, no perception impact
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
        warnings.push({ rowId: rowIdForWarnings, note: `replay: round ${rec.round} ${rec.chair} was ruled derive with no product recorded -- skipped` });
        return;
      }
      const text = readFileSync(transcriptPath, "utf-8");
      const parentSpan = propertyCitationQuote(text, rec.round, rec.chair) ?? "(citation not printed in the transcript's table -- placeholder)";
      params.derive = {
        product: productId,
        parentSpan,
        actorId,
        ownerLocationId: world.base.cellId,
        newObjectId: nextDerivedId(world, productId),
      };
    }
    const plan = planEffect(params as any);
    if (!plan) {
      warnings.push({ rowId: rowIdForWarnings, note: `replay: round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) produced no plan (declined by "no invented world") -- skipped, state may be incomplete` });
      return;
    }
    const outcome = resolver.resolve({ gameId: world.base.gameId, mechanic: plan.mechanic, parameters: plan.parameters });
    if (plan.derived && outcome.result.made === true) {
      adoptDerivedObject(world, { ...plan.derived, heldBy: rec.chair, outcome });
    }
  } catch (err) {
    warnings.push({ rowId: rowIdForWarnings, note: `replay: round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) threw during replay -- skipped: ${String(err).slice(0, 200)}` });
  }
}

/** Builds the world+resolver+perceived-objects for one row by replaying its
 *  prior turns, exactly as both `--dry` and `--live` need. Shared so the two
 *  modes can never build two different requests for the same row. */
function buildWorldFor(row: any): { world: any; resolver: any; perceived: any[] } {
  initializeSchema({ migrations: [prisonerMigration] });
  const world = buildOpenWorld({ presence: "modelled" });
  const resolver = buildOpenResolver();

  if (row.sourceFile) {
    const abs = join(REPO, row.sourceFile);
    const all = parseTranscript(abs);
    // Every entry strictly BEFORE this row's own (round, chair) in file
    // order (file order already interleaves warden/prisoner by half-round).
    const ownIndex = all.findIndex((r) => r.round === row.round && r.chair === row.chair && r.intent.slice(0, 30) === (row.intentTested === row.originalIntent ? row.intentTested : (row.originalIntent ?? row.intentTested)).slice(0, 30));
    const cut = ownIndex >= 0 ? ownIndex : all.findIndex((r) => r.round === row.round && r.chair === row.chair);
    const prior = cut >= 0 ? all.slice(0, cut) : all.filter((r) => r.round < row.round || (r.round === row.round && r.chair === "warden" && row.chair === "prisoner"));
    for (const rec of prior) replayTurn(world, resolver, rec, abs, row.id);
  }

  const clock = world.base.clock;
  const t = row.chair === "prisoner" ? clock.prisonerT(row.round || 1) : clock.wardenT(row.round || 1);
  const perceived = computePerceivedObjects(world, row.chair, t, "modelled");
  return { world, resolver, perceived };
}

/** The SAME `createReferee` options `checkpoint.ts` wires into its own real
 *  game (`isDeclared`/`kindOf`/`propertiesOf` bound to this row's own
 *  rebuilt `world`, plus every mode read from this run's env at module load
 *  -- see the header). `oneAct` stays off (see header). */
function refereeOptionsFor(world: any) {
  return {
    isDeclared: (objectId: string, key: string) => declaredProperty(world, objectId, key) !== undefined,
    kindOf: (objectId: string) => derivedKindOf(world, objectId),
    propertiesOf: (objectId: string) => declaredPropertyKeys(world, objectId),
    instrumentMode: INSTRUMENT_MODE,
    deriveWording: DERIVE_WORDING_MODE,
    elisionMode: ELISION_MODE,
    containerClauseMode: CONTAINER_CLAUSE_MODE,
    oneAct: "off" as const,
  };
}

async function buildRequestFor(row: any): Promise<{ perceivedIds: string[]; questionIds: string[]; sourceIds: string[]; propertyLine: string | undefined }> {
  const { world, perceived } = buildWorldFor(row);

  let captured: { questions: readonly any[]; sources: readonly any[] } | null = null;
  const captor = async (request: { questions: readonly any[]; sources: readonly any[] }) => {
    captured = request;
    return [];
  };
  const referee = createReferee([captor], refereeOptionsFor(world));
  await referee.rule(row.intentTested, perceived);

  return {
    perceivedIds: perceived.map((o: any) => o.id),
    questionIds: captured ? captured.questions.map((q: any) => q.id) : [],
    sourceIds: captured ? captured.sources.map((s: any) => s.id) : [],
    propertyLine: captured ? (captured.questions.find((q: any) => q.id === "property")?.prompt as string | undefined) : undefined,
  };
}

/** `--live` only: builds the SAME request (`buildWorldFor`) and rules on it
 *  for real, against Muse, one row at a time. Returns the full ruling plus
 *  citation text so `RESULTS.md` can be written from `results.jsonl` alone
 *  without re-deriving anything. */
async function ruleLiveFor(row: any, transport: (request: unknown) => Promise<readonly unknown[]>): Promise<Record<string, unknown>> {
  const { world, perceived } = buildWorldFor(row);
  const referee = createReferee([transport as any], refereeOptionsFor(world));
  const ruling: any = await referee.rule(row.intentTested, perceived);
  return {
    applicable: ruling.applicable,
    target: ruling.targetObjectId,
    effect: ruling.effectKind,
    product: ruling.product,
    property: ruling.property,
    magnitude: ruling.magnitude,
    perceptibility: ruling.perceptibility,
    citations: {
      target: ruling.citations?.target?.citation?.quote ?? null,
      targetVerified: ruling.citations?.target?.verified ?? null,
      effect: ruling.citations?.effect?.citation?.quote ?? null,
      effectVerified: ruling.citations?.effect?.verified ?? null,
      property: ruling.citations?.property?.citation?.quote ?? null,
      propertyVerified: ruling.citations?.property?.verified ?? null,
    },
  };
}

async function mainDry(only: Set<string> | null) {
  const corpus = JSON.parse(readFileSync(join(HERE, "corpus.json"), "utf-8")) as { rows: any[] };
  const outPath = join(HERE, "dry-run.jsonl");
  writeFileSync(outPath, "");

  let ok = 0, failed = 0;
  for (const row of corpus.rows) {
    if (only && !only.has(row.id)) continue;
    try {
      const built = await buildRequestFor(row);
      appendFileSync(outPath, JSON.stringify({ id: row.id, source: row.source, ok: true, ...built }) + "\n");
      console.log(`OK   ${row.id.padEnd(10)} perceived=${built.perceivedIds.length} intent="${row.intentTested.slice(0, 60)}"`);
      ok++;
    } catch (err) {
      appendFileSync(outPath, JSON.stringify({ id: row.id, source: row.source, ok: false, error: String(err).slice(0, 500) }) + "\n");
      console.log(`FAIL ${row.id.padEnd(10)} ${String(err).slice(0, 160)}`);
      failed++;
    }
  }
  writeFileSync(join(HERE, "dry-run-warnings.json"), JSON.stringify(warnings, null, 1));
  console.log(`\n${ok} rebuilt, ${failed} failed, ${warnings.length} replay warnings (see dry-run-warnings.json)`);
  console.log(`Requests (ids only, no model call) written to ${outPath}`);
}

/** `--live`: one process, one request at a time, against Muse
 *  (`doris:11435`, `muse-glimmer-30b-q4_k_m`, thinking off), a single `for`
 *  loop `await`ed serially (never `Promise.all`, never a second driver --
 *  CLAUDE.md "One driver at a time, or the referee is not deterministic").
 *  Appends one JSON line per row to `results.jsonl` as it goes, so a
 *  ctrl-C or a crash mid-run leaves a partial, still-usable file (the same
 *  discipline D2 gave the human seat). Never aborts the whole run on one
 *  row's error -- logs it and continues, per the owner's standing "record
 *  and continue" rule. */
async function mainLive(only: Set<string> | null) {
  const corpus = JSON.parse(readFileSync(join(HERE, "corpus.json"), "utf-8")) as { rows: any[] };
  const outPath = join(HERE, "results.jsonl");
  if (!existsSync(outPath)) writeFileSync(outPath, "");
  const already = new Set(
    readFileSync(outPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l).id as string)
  );

  const transport = createRefereeTransport({
    baseUrl: "http://doris:11435/v1",
    model: "muse-glimmer-30b-q4_k_m",
    timeoutMs: 600_000,
    ensureLoaded: async () => {},
    thinking: "off",
  });

  const rows = corpus.rows.filter((r) => (!only || only.has(r.id)) && !already.has(r.id));
  console.log(`${rows.length} rows to run (${already.size} already in ${outPath}, resumed)`);

  let n = 0;
  const started = Date.now();
  for (const row of rows) {
    const t0 = Date.now();
    let rec: Record<string, unknown>;
    try {
      const ruling = await ruleLiveFor(row, transport as any);
      rec = { id: row.id, source: row.source, intentTested: row.intentTested, ...ruling, secs: Math.round((Date.now() - t0) / 100) / 10 };
      console.log(
        `[${++n}/${rows.length}] ${row.id.padEnd(10)} ${ruling.target}/${ruling.effect}/${ruling.property} mag=${ruling.magnitude} applicable=${ruling.applicable} (${rec.secs}s)`
      );
    } catch (err) {
      rec = { id: row.id, source: row.source, intentTested: row.intentTested, error: String(err).slice(0, 500), secs: Math.round((Date.now() - t0) / 100) / 10 };
      console.log(`[${++n}/${rows.length}] ${row.id.padEnd(10)} ERROR: ${String(err).slice(0, 200)}`);
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
