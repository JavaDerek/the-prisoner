// BASE.json / VARIANT.json from intents.json. Perceived objects from the game's own `buildOpenWorld` +
// `computePerceivedObjects`, from each intent's own seat, presence modelled; the referee built with the
// checkpoint's declared-property wiring and every other arm at its DEFAULT. VARIANT = BASE plus the `acts`
// question below, appended after `perceptibility`. Throwaway database under /tmp (root CLAUDE.md rule 2).
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/one-act-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");

export const ACTS_QUESTION = {
  id: "acts",
  prompt:
    "Does the intent attempt ONE act or SEVERAL? An act is one thing done to or with one thing in the room: working on it, " +
    "examining it, hiding it, opening or closing it, going out through it, or striking or moving a person. Answer several " +
    "when the intent does one such thing and then another -- examining two objects, blinding someone and then opening a " +
    "door, opening a way out and then going through it. Answer one when it does a single such thing, however it is " +
    "described: a tool used on something is one act, and speaking, watching, waiting, or moving within the room alongside " +
    "the act does not count as another. Cite the exact words in the actor's intent that show the second act, or, for one, " +
    "the words that describe the act.",
  answerKeys: ["one", "several"],
  safeDefault: "one",
};

createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const t0 = world.base.clock.t0;
const seats = { prisoner: computePerceivedObjects(world, "prisoner", t0, "modelled"), warden: computePerceivedObjects(world, "warden", t0, "modelled") };
console.log(`prisoner perceives: ${seats.prisoner.map((o) => o.id).join(", ")}`);
console.log(`window text: ${seats.prisoner.find((o) => o.id === "window")?.description.slice(0, 70)}...`);
const { items } = JSON.parse(readFileSync(new URL("./intents.json", import.meta.url).pathname, "utf-8")) as { items: { group: string; seat: "prisoner" | "warden"; expect: string; intent: string }[] };
const base = [];
for (const item of items) {
  let captured: any = null;
  await createReferee([async (request) => ((captured = request), [])], {
    isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
    propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
  }).rule(item.intent, seats[item.seat]);
  base.push({ kind: item.group, seat: item.seat, expect: item.expect, intent: item.intent, request: captured });
}
const variant = base.map((row) => ({ ...row, request: { ...row.request, questions: [...row.request.questions, ACTS_QUESTION] } }));
const here = new URL(".", import.meta.url).pathname;
writeFileSync(`${here}BASE.json`, JSON.stringify(base, null, 1));
writeFileSync(`${here}VARIANT.json`, JSON.stringify(variant, null, 1));
console.log(`BASE.json, VARIANT.json: ${base.length} requests each`);
