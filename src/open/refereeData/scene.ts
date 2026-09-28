import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeSchema, type Resolver } from "run-dmcp";
import { prisonerMigration } from "../../world/schema.js";
import { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf, nextDerivedId, adoptDerivedObject, type OpenWorld } from "../world.js";
import { computePerceivedObjects } from "../briefing.js";
import { findObject, OPEN_PERSONS } from "../scenarioObjects.js";
import { planEffect } from "../effects.js";
import { buildOpenResolver } from "../mechanics.js";
import type { ObjectPerception, DeclaredPropertyCheck, KindOf, PropertiesOf } from "../referee.js";
import type { LabelRefereeArms, LabelScene } from "./types.js";

/** The options `createReferee` needs to rule on a resolved scene faithfully
 *  -- never left implicit (`checkpoints/2026-09-28-probe-kit/kit.mts`'s own
 *  "prisoner-measurement-fidelity" lesson: a referee built with an arm left
 *  at its bare default measures a referee nobody plays with). */
export interface SceneRefereeOptions {
  isDeclared?: DeclaredPropertyCheck;
  kindOf?: KindOf;
  propertiesOf?: PropertiesOf;
  instrumentMode?: "off" | "checked";
  deriveWording?: "baseline" | "sharpened";
  elisionMode?: "off" | "on";
  containerClauseMode?: "off" | "on";
}

export interface ResolvedScene {
  perceived: readonly ObjectPerception[];
  refereeOptions: SceneRefereeOptions;
  /** Non-fatal notes from replaying a transcript's prior turns (an earlier
   *  turn's ruling produced no plan, or replay itself threw) -- surfaced so
   *  a caller can log them, never silent, mirroring `probe.mts`'s own
   *  `dry-run-warnings.json`. Empty for a `static` scene, which replays
   *  nothing. */
  warnings: readonly string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");

function staticScene(perceivedObjectIds: readonly string[], arms: LabelRefereeArms): ResolvedScene {
  const perceived: ObjectPerception[] = perceivedObjectIds.map((id) => {
    const spec = findObject(id) ?? OPEN_PERSONS.find((p) => p.id === id);
    if (!spec) throw new Error(`refereeData/scene: unknown scenario object or person id "${id}" -- not in scenarioObjects.ts`);
    return { id, description: spec.description };
  });
  return {
    perceived,
    refereeOptions: { elisionMode: arms.elisionMode, containerClauseMode: arms.containerClauseMode, instrumentMode: arms.instrumentMode, deriveWording: arms.deriveWording },
    warnings: [],
  };
}

/** One half-round, parsed from a checkpoint transcript's own markdown table
 *  -- the SAME format every transcript in this repo uses (`### Round N
 *  (t=T) -- the CHAIR`, `**Intent:**`, the `**Referee:**` table,
 *  `**Ruled:**`). Ported from `checkpoints/2026-09-26-human-intents/
 *  probe.mts`'s own `parseTranscript`/`Ruling`, which this module reuses
 *  rather than re-deriving: that harness's `dry-run.jsonl` already recorded
 *  95/95 successful rebuilds against this exact logic
 *  (`__tests__/replayScene.test.ts` checks a sample against it). */
interface RecordedTurn {
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
}

function parseTranscript(path: string): RecordedTurn[] {
  const text = readFileSync(path, "utf-8");
  const blocks = text.split(/(?=^### Round )/m).filter((b) => b.startsWith("### Round"));
  const rows: RecordedTurn[] = [];
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

/** The parent span a derive's composed description quotes -- best-effort,
 *  ported from `probe.mts`'s own function of the same job: the property
 *  row's own cited quote, when the table's citation cell carries one, else
 *  a placeholder (this never asks a model to re-derive a citation the
 *  transcript did not print). */
function propertyCitationQuote(text: string, round: number, chair: string): string | null {
  const blocks = text.split(/(?=^### Round )/m).filter((b) => b.startsWith("### Round"));
  const b = blocks.find((x) => x.startsWith(`### Round ${round} (t=`) && x.includes(`-- the ${chair}`));
  if (!b) return null;
  const row = b.match(/\| property \| `[^`]+` \| ([^|]+) \|/);
  const q = row?.[1]?.match(/"([^"]+)"/);
  return q?.[1] ?? null;
}

/** Applies one earlier turn's RECORDED ruling to `world`/`resolver` -- never
 *  the model. Ported from `probe.mts`'s own `replayTurn`: reveal/noise/
 *  take/give/expose-on-person are structurally skipped because none of them
 *  change a perceived object's description text or the perceived-object
 *  set in this scenario (only open/close's `passage` and a person's
 *  `posture`/`sight` have `reads`/`readRanges`, and only `derive` adds a
 *  perceived object). */
function replayTurn(world: OpenWorld, resolver: Resolver, rec: RecordedTurn, transcriptPath: string, warnings: string[]): void {
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
        warnings.push(`replay: round ${rec.round} ${rec.chair} was ruled derive with no product recorded -- skipped`);
        return;
      }
      const text = readFileSync(transcriptPath, "utf-8");
      const parentSpan = propertyCitationQuote(text, rec.round, rec.chair) ?? "(citation not printed in the transcript's table -- placeholder)";
      params.derive = { product: productId, parentSpan, actorId, ownerLocationId: world.base.cellId, newObjectId: nextDerivedId(world, productId) };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors probe.mts's own cast: planEffect's params type is a large inline literal not worth re-deriving here.
    const plan = planEffect(params as any);
    if (!plan) {
      warnings.push(`replay: round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) produced no plan (declined by "no invented world") -- skipped, state may be incomplete`);
      return;
    }
    const outcome = resolver.resolve({ gameId: world.base.gameId, mechanic: plan.mechanic, parameters: plan.parameters });
    if (plan.derived && outcome.result.made === true) {
      adoptDerivedObject(world, { ...plan.derived, heldBy: rec.chair, outcome });
    }
  } catch (err) {
    warnings.push(`replay: round ${rec.round} ${rec.chair} (${rec.target}/${rec.effect}/${rec.property}) threw during replay -- skipped: ${String(err).slice(0, 200)}`);
  }
}

/** Rebuilds the world+resolver+perceived-objects for one `replay` scene by
 *  replaying its prior turns -- ported from `probe.mts`'s own
 *  `buildWorldFor`. `sourceFile: null` (no transcript survives) rebuilds at
 *  the game's own round-1 default state, per `docs/HUMAN-INTENTS-DESIGN.md`
 *  §7.2's documented exception. */
function replayScene(scene: Extract<LabelScene, { kind: "replay" }>, intentText: string, arms: LabelRefereeArms): ResolvedScene {
  initializeSchema({ migrations: [prisonerMigration] });
  const world = buildOpenWorld({ presence: "modelled" });
  const resolver = buildOpenResolver();
  const warnings: string[] = [];

  if (scene.sourceFile) {
    const abs = join(REPO_ROOT, scene.sourceFile);
    const all = parseTranscript(abs);
    const ownIndex = all.findIndex((r) => r.round === scene.round && r.chair === scene.chair && r.intent.slice(0, 30) === intentText.slice(0, 30));
    const cut = ownIndex >= 0 ? ownIndex : all.findIndex((r) => r.round === scene.round && r.chair === scene.chair);
    const prior = cut >= 0 ? all.slice(0, cut) : all.filter((r) => r.round < scene.round || (r.round === scene.round && r.chair === "warden" && scene.chair === "prisoner"));
    for (const rec of prior) replayTurn(world, resolver, rec, abs, warnings);
  }

  const clock = world.base.clock;
  const t = scene.chair === "prisoner" ? clock.prisonerT(scene.round || 1) : clock.wardenT(scene.round || 1);
  const perceived = computePerceivedObjects(world, scene.chair, t, "modelled");

  return {
    perceived,
    refereeOptions: {
      isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
      kindOf: (objectId) => derivedKindOf(world, objectId),
      propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
      elisionMode: arms.elisionMode,
      containerClauseMode: arms.containerClauseMode,
      instrumentMode: arms.instrumentMode,
      deriveWording: arms.deriveWording,
    },
    warnings,
  };
}

/** Resolves a label's `scene` into the perceived objects and referee
 *  options a real `createReferee(...).rule(intentText, perceived)` call
 *  needs -- the single place both the renderer and the scorer go through,
 *  so neither one can build a scene the other would disagree about. */
export function resolveScene(scene: LabelScene, intentText: string, arms: LabelRefereeArms): ResolvedScene {
  if (scene.kind === "static") return staticScene(scene.perceivedObjectIds, arms);
  return replayScene(scene, intentText, arms);
}
