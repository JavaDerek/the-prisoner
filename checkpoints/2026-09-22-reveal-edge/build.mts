// Builds BASE.json and VARIANT.json from intents.json. Nothing hand-copied: the
// perceived objects come from the game's own `buildOpenWorld` +
// `computePerceivedObjects` (the warden's seat, presence modelled), the referee is
// built with the checkpoint's own declared-property wiring and every other arm at
// its DEFAULT (instrument unasked, derive wording baseline) -- the arms Phase 1
// batch 1 ran. The variant is the base request with ONE sentence of the property
// question replaced, and the build fails if that sentence is not found.
// Throwaway database under /tmp (root CLAUDE.md hard rule 2).
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/reveal-edge-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");

const OLD = "For reveal, name the property being learned: integrity for damage, wear, rust or tampering, even when the intent calls it hidden. ";
const NEW =
  "For reveal, name the property being learned: edge for how sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the intent calls it hidden. ";

createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const perceived = computePerceivedObjects(world, "warden", world.base.clock.t0, "modelled");
console.log(`perceived (${perceived.length}): ${perceived.map((o) => o.id).join(", ")}`);
console.log(`window text: ${perceived.find((o) => o.id === "window")?.description.slice(0, 70)}...`);

const { items } = JSON.parse(readFileSync(new URL("./intents.json", import.meta.url).pathname, "utf-8")) as { items: { group: string; expect: string; intent: string }[] };
const base = [];
for (const item of items) {
  let captured: any = null;
  await createReferee([async (request) => ((captured = request), [])], {
    isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
    propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
  }).rule(item.intent, perceived);
  base.push({ label: `${item.group}: ${item.intent}`, kind: item.group, expect: item.expect, intent: item.intent, request: captured });
}
const variant = base.map((row) => {
  const questions = row.request.questions.map((q: any) => {
    if (q.id !== "property") return q;
    if (!q.prompt.includes(OLD)) throw new Error("variant sentence not found in the property prompt -- the build is stale");
    return { ...q, prompt: q.prompt.replace(OLD, NEW) };
  });
  return { ...row, request: { ...row.request, questions } };
});
const here = new URL(".", import.meta.url).pathname;
writeFileSync(`${here}BASE.json`, JSON.stringify(base, null, 1));
writeFileSync(`${here}VARIANT.json`, JSON.stringify(variant, null, 1));
console.log(`BASE.json, VARIANT.json: ${base.length} requests each`);
