// D6 (HUMAN-INTENTS-DESIGN.md §5) and D9 (§6.2) arms, probed together, per
// PREDICTION.md beside this file. Never a recorded request or a copied
// harness (`prisoner-measurement-fidelity`): every item's request is built
// fresh from `buildOpenWorld` + `computePerceivedObjects` at the game's own
// default round-1 state, through the SAME closures `checkpoint.ts` wires
// into its own `createReferee` call. STRICTLY ONE REQUEST AT A TIME: a
// single `for` loop, `await`ed, never `Promise.all`.
//
//   npx tsx checkpoints/2026-09-26-arms/probe.mts --dry              # no model call, prints the three arms' prompts for one item
//   npx tsx checkpoints/2026-09-26-arms/probe.mts --live [id,id,...] # real calls against doris:11435; default = every item
import { writeFileSync, appendFileSync, existsSync } from "node:fs";

process.env.DMCP_DB_PATH = ":memory:";

const { createTestDb } = await import("../../src/world/testDb.js");
const { currentT } = await import("../../src/world/clock.js");
const { readNumericFact } = await import("../../src/world/facts.js");
const { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");
const { planEffect } = await import("../../src/open/effects.js");
const { buildOpenResolver } = await import("../../src/open/mechanics.js");
const { PERSON_CONTAINERS, CONTAINMENT_HIDDEN_AT_OR_ABOVE, personContainerIndex } = await import("../../src/open/scenarioObjects.js");
const { createRefereeTransport } = await import("../../src/open/refereeTransport.js");

type ArmName = "OFF" | "D6" | "D6D9";
const ARMS: Record<ArmName, { elisionMode: "off" | "on"; containerClauseMode: "off" | "on" }> = {
  OFF: { elisionMode: "off", containerClauseMode: "off" },
  D6: { elisionMode: "on", containerClauseMode: "off" },
  D6D9: { elisionMode: "on", containerClauseMode: "on" },
};

type Group = "S" | "O" | "T" | "C" | "P" | "N" | "F";
const ITEMS: { id: string; group: Group; intent: string }[] = [
  { id: "S1", group: "S", intent: "hide" },
  { id: "S2", group: "S", intent: "hide myself" },
  { id: "S3", group: "S", intent: "cover myself up" },
  { id: "S4", group: "S", intent: "try to conceal myself" },
  { id: "O1", group: "O", intent: "push Croft to the floor" },
  { id: "T1", group: "T", intent: "hide the spoon under the tile" },
  { id: "T2", group: "T", intent: "crouch by the window" },
  { id: "C1", group: "C", intent: "hide under the blanket" },
  { id: "C2", group: "C", intent: "get under the blanket" },
  { id: "C3", group: "C", intent: "crawl under the cot to hide" },
  { id: "P1", group: "P", intent: "pull the blanket over myself" },
  { id: "N1", group: "N", intent: "hide the spoon under the blanket" },
  { id: "F1", group: "F", intent: "hide the prisoner under the blanket" },
];

/** A fresh world (its own gameId, in the shared :memory: db) and the
 *  prisoner's own perceived objects at round-1 default state -- built once
 *  per (item, arm) so a resolved effect in one item/arm never leaks into
 *  another's. */
function freshPrisonerView() {
  const world = buildOpenWorld({ presence: "modelled" });
  const t = world.base.clock.t0;
  const perceived = computePerceivedObjects(world, "prisoner", t, "modelled");
  return { world, perceived };
}

function buildReferee(transports: readonly ((request: unknown) => Promise<readonly unknown[]>)[], arm: ArmName, world: unknown) {
  return createReferee(transports as never, {
    isDeclared: (objectId: string, key: string) => declaredProperty(world as never, objectId, key) !== undefined,
    kindOf: (objectId: string) => derivedKindOf(world as never, objectId),
    propertiesOf: (objectId: string) => declaredPropertyKeys(world as never, objectId),
    elisionMode: ARMS[arm].elisionMode,
    containerClauseMode: ARMS[arm].containerClauseMode,
  });
}

const mode = process.argv[2];

if (mode === "--dry") {
  // No model call: prints the target/effect prompts for C1 ("hide under the
  // blanket") under all three arms, so the clause text can be read before
  // any model sees it.
  createTestDb();
  const { world, perceived } = freshPrisonerView();
  for (const arm of Object.keys(ARMS) as ArmName[]) {
    let captured: { questions: readonly { id: string; prompt: string }[] } | null = null;
    await buildReferee(
      [
        async (request) => {
          captured = request as never;
          return [];
        },
      ],
      arm,
      world
    ).rule("hide under the blanket", perceived);
    console.log(`\n=== ${arm} ===`);
    console.log("target:", captured!.questions.find((q) => q.id === "target")?.prompt);
    console.log("effect:", captured!.questions.find((q) => q.id === "effect")?.prompt);
  }
  process.exit(0);
}

if (mode !== "--live") {
  console.error("usage: probe.mts --dry | --live [id,id,...]");
  process.exit(1);
}

const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const outPath = new URL("./results.jsonl", import.meta.url).pathname;
if (!existsSync(outPath)) writeFileSync(outPath, "");

const transport = createRefereeTransport({
  baseUrl: "http://doris:11435/v1",
  model: "muse-glimmer-30b-q4_k_m",
  timeoutMs: 600_000,
  ensureLoaded: async () => {},
  thinking: "off",
});

// One shared :memory: db for the whole run -- `buildOpenWorld()` per item
// below creates its own fresh `gameId` inside it, so items never share
// resolved state even though the connection is one and the same.
createTestDb();

let n = 0;
const started = Date.now();
for (const arm of Object.keys(ARMS) as ArmName[]) {
  for (const item of ITEMS) {
    if (only && !only.has(item.id)) continue;
    const { world, perceived } = freshPrisonerView();
    const t0 = Date.now();
    let rec: Record<string, unknown>;
    try {
      const ruling = await buildReferee([transport], arm, world).rule(item.intent, perceived);
      const containedCheck: Record<string, unknown> = {};
      // D9's own "actor contained after resolution" check: only meaningful
      // when the ruling actually landed on a person-container's concealment.
      if (ruling.applicable && ruling.effectKind === "conceal" && ruling.property === "concealment" && PERSON_CONTAINERS.includes(ruling.targetObjectId)) {
        const plan = planEffect({
          targetObjectId: ruling.targetObjectId,
          effectKind: "conceal",
          property: "concealment",
          magnitude: ruling.magnitude,
          entityIdFor: { ...(world as { entityIdFor: Record<string, string> }).entityIdFor, prisoner: (world as { base: { prisonerId: string } }).base.prisonerId, warden: (world as { base: { wardenId: string } }).base.wardenId },
          resourceIdFor: (world as { resourceIdFor: Record<string, string> }).resourceIdFor,
          exits: (world as { exits: unknown }).exits,
          actorId: (world as { base: { prisonerId: string } }).base.prisonerId,
          custody: {
            otherId: (world as { base: { wardenId: string } }).base.wardenId,
            perceived: perceived.map((o: { id: string }) => o.id),
            postureOf: {},
            heldInOf: Object.fromEntries(
              (["prisoner", "warden"] as const).flatMap((p) => {
                const rid = (world as { personHeldIn: Record<string, string> }).personHeldIn[p];
                const pid = p === "prisoner" ? (world as { base: { prisonerId: string } }).base.prisonerId : (world as { base: { wardenId: string } }).base.wardenId;
                return rid ? [[pid, rid]] : [];
              })
            ),
          },
          description: `arms probe: ${item.intent}`,
        } as never);
        if (plan) {
          buildOpenResolver().resolve({ gameId: (world as { base: { gameId: string } }).base.gameId, mechanic: (plan as { mechanic: string }).mechanic, parameters: (plan as { parameters: unknown }).parameters });
          const gameId = (world as { base: { gameId: string } }).base.gameId;
          const resourceId = (world as { personHeldIn: Record<string, string> }).personHeldIn.prisoner;
          const value = resourceId ? readNumericFact({ gameId, t: currentT(gameId), entityId: resourceId, key: "value" }) : null;
          containedCheck.containmentResourceValue = value;
          containedCheck.expectedContainerIndex = personContainerIndex(ruling.targetObjectId);
          containedCheck.contained = value !== null && value === personContainerIndex(ruling.targetObjectId);
          containedCheck.hiddenAtOrAbove = CONTAINMENT_HIDDEN_AT_OR_ABOVE;
        } else {
          containedCheck.plan = "null (declined -- no invented world)";
        }
      }
      rec = {
        arm,
        id: item.id,
        group: item.group,
        intent: item.intent,
        applicable: ruling.applicable,
        target: ruling.targetObjectId,
        effect: ruling.effectKind,
        property: ruling.property,
        magnitude: ruling.magnitude,
        perceptibility: ruling.perceptibility,
        citations: {
          target: ruling.citations.target.citation?.quote ?? null,
          targetVerified: ruling.citations.target.verified,
          effect: ruling.citations.effect.citation?.quote ?? null,
          effectVerified: ruling.citations.effect.verified,
          property: ruling.citations.property.citation?.quote ?? null,
          propertyVerified: ruling.citations.property.verified,
        },
        ...containedCheck,
        secs: Math.round((Date.now() - t0) / 100) / 10,
      };
    } catch (err) {
      rec = { arm, id: item.id, group: item.group, intent: item.intent, error: String(err).slice(0, 300), secs: Math.round((Date.now() - t0) / 100) / 10 };
    }
    n++;
    appendFileSync(outPath, JSON.stringify(rec) + "\n");
    console.log(
      `[${n}] ${arm} ${item.id} (${item.group}): ${rec.target ?? "ERR"}/${rec.effect ?? ""}/${rec.property ?? ""} mag=${rec.magnitude ?? ""} ` +
        `applicable=${rec.applicable ?? "?"} contained=${rec.contained ?? "n/a"} ${rec.secs}s`
    );
  }
}
console.log(`\ndone: ${n} calls in ${Math.round((Date.now() - started) / 1000)}s -> ${outPath}`);
