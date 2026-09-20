// The sweep, rebuilt against the DEFAULT world -- the one a player actually
// gets. The first run used the Dig cell's recorded request, which carries the
// WELDED-window arm, and the owner's live game exposed the difference: "fake a
// heart attack" read none/noise/none 5/5 in the welded world and ruled
// prisoner/wear/posture (100 -> 50) in the default one.
//
// So nothing is hand-copied here. The perceived objects come from the game's
// own `buildOpenWorld` + `computePerceivedObjects`, and the referee is built
// with the same `declaredPropertyKeys`/`declaredProperty` the checkpoint wires
// up. A throwaway database under /tmp, exactly as `npm run checkpoint` does it
// (root CLAUDE.md hard rule 2) -- never a default path, and it is deleted after.
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/sweep-default-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");

createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const t0 = world.base.clock.t0;
const perceived = computePerceivedObjects(world, "prisoner", t0, "modelled");
console.log(`perceived (${perceived.length}): ${perceived.map((o) => o.id).join(", ")}`);
console.log(`window text: ${perceived.find((o) => o.id === "window")?.description.slice(0, 70)}...`);

const SET = JSON.parse(readFileSync(new URL("./intents.json", import.meta.url).pathname, "utf-8")) as {
  items: { group: string; intent: string }[];
  pretence: { intent: string }[];
};
const mode = process.argv[2] ?? "sweep";
const ITEMS = mode === "pretence" ? SET.pretence.map((p) => ["P", p.intent] as const) : SET.items.map((i) => [i.group, i.intent] as const);

const rows = [];
for (const [kind, intent] of ITEMS) {
  let captured: unknown = null;
  await createReferee(
    [
      async (request) => {
        captured = request;
        return [];
      },
    ],
    {
      isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
      propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
      instrumentMode: "off",
    }
  ).rule(intent, perceived);
  rows.push({ label: `${kind}: ${intent}`, kind, intent, source: "live default world (presence modelled)", request: captured });
}
const out = new URL(`./A-${mode.toUpperCase()}.json`, import.meta.url).pathname;
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`${out.split("/").pop()} ${rows.length} requests`);
