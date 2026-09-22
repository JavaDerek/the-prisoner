// VARIANT.json = what `main` builds now (custody, §74.3 hiding, a108643), from the game's own `createReferee`.
// Batch 1's custody rows use each row's OWN recorded perception (objects and descriptions from its sidecar request --
// the wire and the persons exist there, not in a fresh world); the fresh intents and controls use `buildOpenWorld` from
// each seat, presence modelled. Other arms at default. BASE.json = the same requests with custody's wording removed
// (the take/give clause, their answer keys, and the search sentence) -- to show what the custody text moved.
// Throwaway database under /tmp (root CLAUDE.md rule 2).
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/custody-probe-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");
const { findObject } = await import("../../src/open/scenarioObjects.js");
const { DERIVABLE_KINDS } = await import("../../src/open/derivedObjects.js");

const TAKE_GIVE =
  "take (come to hold a thing that lies here or that someone else holds; the target is the thing), " +
  "give (hand a thing the actor holds to someone else who is present; the target is the thing), or none. ";
const SEARCH = " Searching a person -- patting them down, turning out what they carry -- is expose on that person.";
const here = new URL(".", import.meta.url).pathname;
createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const t0 = world.base.clock.t0;
const seats: Record<string, any> = { prisoner: computePerceivedObjects(world, "prisoner", t0, "modelled"), warden: computePerceivedObjects(world, "warden", t0, "modelled") };
// Declared properties as batch 1's world had them: persons carry posture, a derived object its kind's properties.
const propsOf = (id: string): string[] => {
  if (id === "prisoner" || id === "warden") return ["posture"];
  const kind = DERIVABLE_KINDS.find((k) => id === k.id || id.startsWith(`${k.id}_`));
  if (kind) return kind.properties.map((p) => p.key);
  return findObject(id)?.properties.map((p) => p.key) ?? [];
};
async function capture(intent: string, perceived: any[], recorded: boolean): Promise<any> {
  let captured: any = null;
  await createReferee([async (request) => ((captured = request), [])], recorded
    ? { isDeclared: (o, k) => propsOf(o).includes(k), propertiesOf: propsOf }
    : { isDeclared: (o, k) => declaredProperty(world, o, k) !== undefined, propertiesOf: (o) => declaredPropertyKeys(world, o) }).rule(intent, perceived);
  return captured;
}
const variant: any[] = [];
for (const r of JSON.parse(readFileSync(`${here}recorded.json`, "utf-8"))) variant.push({ kind: r.group, row: r.row, expect: r.expect, intent: r.intent, request: await capture(r.intent, r.perceived, true) });
for (const f of JSON.parse(readFileSync(`${here}fresh.json`, "utf-8"))) variant.push({ kind: f.group, expect: f.expect, intent: f.intent, request: await capture(f.intent, seats[f.seat], false) });
const base = variant.map((row) => ({
  ...row,
  request: {
    ...row.request,
    questions: row.request.questions.map((q: any) => {
      if (q.id === "effect") {
        if (!q.prompt.includes(TAKE_GIVE)) throw new Error("custody clause missing -- stale build");
        return { ...q, prompt: q.prompt.replace(TAKE_GIVE, "or none. ").replace(SEARCH, ""), answerKeys: q.answerKeys.filter((k: string) => k !== "take" && k !== "give") };
      }
      return q;
    }),
  },
}));
writeFileSync(`${here}BASE.json`, JSON.stringify(base, null, 1));
writeFileSync(`${here}VARIANT.json`, JSON.stringify(variant, null, 1));
console.log(`BASE.json, VARIANT.json: ${variant.length} requests each; search sentence present in ${variant.filter((r) => r.request.questions.find((q: any) => q.id === "effect").prompt.includes(SEARCH)).length}`);
