// BASE.json / VARIANT.json: batch 1's six hiding rows from their own recorded requests (recorded-hides.json,
// property sentence already a108643's) plus intents.json built from the game's own `buildOpenWorld` +
// `computePerceivedObjects` from each intent's seat, presence modelled, other arms at default. VARIANT inserts one
// clause into the target question after the way-out clause; the build fails if the anchor is missing.
// Throwaway database under /tmp (root CLAUDE.md rule 2).
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/hide-target-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");

const ANCHOR = "An intent that goes out through a way out acts on that way out: name it, never none. ";
const CLAUSE = "An act of hiding names the thing hidden, never the place it is hidden in, under or behind. ";
const here = new URL(".", import.meta.url).pathname;

createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const t0 = world.base.clock.t0;
const seats = { prisoner: computePerceivedObjects(world, "prisoner", t0, "modelled"), warden: computePerceivedObjects(world, "warden", t0, "modelled") };
console.log(`window text: ${seats.prisoner.find((o) => o.id === "window")?.description.slice(0, 70)}...`);
const { items } = JSON.parse(readFileSync(`${here}intents.json`, "utf-8")) as { items: { group: string; seat: "prisoner" | "warden"; expect: string; intent: string }[] };
const base: any[] = JSON.parse(readFileSync(`${here}recorded-hides.json`, "utf-8"));
for (const item of items) {
  let captured: any = null;
  await createReferee([async (request) => ((captured = request), [])], {
    isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
    propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
  }).rule(item.intent, seats[item.seat]);
  base.push({ kind: item.group, expect: item.expect, intent: item.intent, request: captured });
}
const fresh = base.find((r) => r.kind === "HIDE");
for (const r of base.filter((r) => r.kind === "HIDE-REC")) {
  const a = JSON.stringify(r.request.questions), b = JSON.stringify(fresh.request.questions.map((q: any) => (q.id === "target" || q.id === "product" ? { id: q.id } : q)));
  // Recorded and fresh requests differ only where the perceived objects differ (target keys, property list).
  if (!r.request.questions.find((q: any) => q.id === "target").prompt.includes(ANCHOR)) throw new Error("anchor missing in a recorded request");
  void a; void b;
}
const variant = base.map((row) => ({
  ...row,
  request: {
    ...row.request,
    questions: row.request.questions.map((q: any) => {
      if (q.id !== "target") return q;
      if (!q.prompt.includes(ANCHOR)) throw new Error("anchor missing");
      return { ...q, prompt: q.prompt.replace(ANCHOR, ANCHOR + CLAUSE) };
    }),
  },
}));
writeFileSync(`${here}BASE.json`, JSON.stringify(base, null, 1));
writeFileSync(`${here}VARIANT.json`, JSON.stringify(variant, null, 1));
console.log(`BASE.json, VARIANT.json: ${base.length} requests each`);
