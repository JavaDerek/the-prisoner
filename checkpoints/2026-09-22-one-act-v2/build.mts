// BASE.json / VARIANT.json from intents.json, built from what `main` builds NOW (custody's take/give in the
// effect question, a108643's property sentence) -- the text that would ship. Perceived objects from the game's own
// `buildOpenWorld` + `computePerceivedObjects` from each intent's seat, presence modelled, other arms at default.
// VARIANT = BASE plus the revised `acts` question (appended) and, when HIDE_CLAUSE=1, §74.3's hiding clause in the
// target question. Throwaway database under /tmp (root CLAUDE.md rule 2).
import { writeFileSync, readFileSync } from "node:fs";
process.env.DMCP_DB_PATH = `/tmp/one-act-v2-${Date.now()}.db`;
const { createTestDb } = await import("../../src/world/testDb.js");
const { buildOpenWorld, declaredPropertyKeys, declaredProperty } = await import("../../src/open/world.js");
const { computePerceivedObjects } = await import("../../src/open/briefing.js");
const { createReferee } = await import("../../src/open/referee.js");

export const ACTS_QUESTION = {
  id: "acts",
  prompt:
    "Does the intent attempt ONE act or SEVERAL? An act is one thing done to or with one thing in the room: working on it, " +
    "examining it, hiding it, taking or handing it over, opening or closing it, going out through it, or striking or moving a " +
    "person. Answer several only when the intent does one such thing and then another -- examining two objects, blinding " +
    "someone and then opening a door, opening a way out and then going through it. Answer one when it does a single such " +
    "thing, however it is described: a tool used on something is one act; hiding a thing somewhere is one act on the thing, " +
    "and the place is only where it goes; and speaking, watching someone, waiting, or moving within the room alongside the act " +
    "is never another act -- examining something while watching someone or talking to them is one act. Cite the exact words " +
    "in the actor's intent that show the second act, or, for one, the words that describe the act.",
  answerKeys: ["one", "several"],
  safeDefault: "one",
};
const ANCHOR = "An intent that goes out through a way out acts on that way out: name it, never none. ";
const HIDE = "An act of hiding names the thing hidden, never the place it is hidden in, under or behind. ";
const withHide = process.env.HIDE_CLAUSE === "1";

createTestDb();
const world = buildOpenWorld({ presence: "modelled" });
const t0 = world.base.clock.t0;
const seats = { prisoner: computePerceivedObjects(world, "prisoner", t0, "modelled"), warden: computePerceivedObjects(world, "warden", t0, "modelled") };
console.log(`window text: ${seats.prisoner.find((o) => o.id === "window")?.description.slice(0, 70)}...  hide clause: ${withHide}`);
const here = new URL(".", import.meta.url).pathname;
const { items } = JSON.parse(readFileSync(`${here}intents.json`, "utf-8")) as { items: { group: string; seat: "prisoner" | "warden"; expect: string; expectKeys?: string; intent: string }[] };
const base = [];
for (const item of items) {
  let captured: any = null;
  await createReferee([async (request) => ((captured = request), [])], {
    isDeclared: (objectId, key) => declaredProperty(world, objectId, key) !== undefined,
    propertiesOf: (objectId) => declaredPropertyKeys(world, objectId),
  }).rule(item.intent, seats[item.seat]);
  if (!captured.questions.find((q: any) => q.id === "effect").prompt.includes("take (")) throw new Error("effect question lacks take -- not the custody build");
  base.push({ kind: item.group, seat: item.seat, expect: item.expect, expectKeys: item.expectKeys, intent: item.intent, request: captured });
}
const variant = base.map((row) => ({
  ...row,
  request: {
    ...row.request,
    questions: [
      ...row.request.questions.map((q: any) => {
        if (q.id !== "target" || !withHide) return q;
        if (!q.prompt.includes(ANCHOR)) throw new Error("anchor missing");
        return { ...q, prompt: q.prompt.replace(ANCHOR, ANCHOR + HIDE) };
      }),
      ACTS_QUESTION,
    ],
  },
}));
writeFileSync(`${here}BASE.json`, JSON.stringify(base, null, 1));
writeFileSync(`${here}VARIANT.json`, JSON.stringify(variant, null, 1));
console.log(`BASE.json, VARIANT.json: ${base.length} requests each`);
