// Builds the labelled items against the request the LIVE code now produces --
// not a hand-edited recording. It asks the real `createReferee` for its own
// questions (with the production-shaped `propertiesOf`/`isDeclared` the
// checkpoint passes) through a capturing transport that answers nothing, then
// writes `{label, kind, intent, request}[]` in the replay instrument's shape.
// The same 10 items and the same labels as checkpoints/2026-09-19-selftarget,
// so the two runs are directly comparable and no label moved.
import { writeFileSync, readFileSync } from "node:fs";
import { createReferee, type ObjectPerception } from "../../src/open/referee.js";

const OBJECTS: ObjectPerception[] = [
  { id: "window", description: "A small window set high in the wall, barely a hand across. Its iron bars are set flush into the stone and welded at every crossing." },
  { id: "bar", description: "An iron bar welded into the window's grid, set flush in sound stone. It does not move." },
  { id: "door", description: "A heavy door of iron-bound planks in a stone frame. It hangs a finger's width short of its frame, and the edge of the bolt shows in the gap." },
  { id: "lock", description: "A steel lock set in the cell door, its keyhole on the corridor side and its bolt thrown across into the frame." },
  { id: "spoon", description: "A dented aluminium spoon, thin enough to bend by hand. One side of the bowl is worn flat from being scraped along the floor." },
  { id: "loose_tile", description: "A square clay floor tile beside the cot, cracked across one corner. It rocks underfoot, and beneath it is a shallow hollow of dry grit about the size of a hand. Under the grit the floor is packed earth, dry and crumbling, loose enough to scrape away by hand." },
  { id: "cot", description: "A narrow cot whose iron frame is bolted to the wall at the head and stands on two legs at the foot. The crossbar is rough with flaking paint, and the springs are held to the frame by twists of wire." },
  { id: "blanket", description: "A heavy grey wool blanket, thick and coarse, frayed along the hem, with a loose thread running down one edge." },
  { id: "bucket", description: "A tin slop bucket with a wire handle and a dented rim. It rings sharply when anything strikes it." },
  { id: "meal_tray", description: "A shallow steel tray pushed through a slot at the bottom of the door, holding a tin cup and a bowl, and collected at the next round." },
  { id: "key_ring", description: "A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks." },
  { id: "warden", description: "Warden Croft, the warden. She can be seen, heard, spoken to, or touched by anyone who shares this room with her. She is on her feet." },
  { id: "prisoner", description: "Mara Voss, the prisoner. She can be seen, heard, spoken to, or touched by anyone who shares this room with her. She is on her feet." },
];
// Exactly what `declaredPropertyKeys` returns under the presence arm.
const PROPS: Record<string, readonly string[]> = {
  window: ["passage"], bar: [], door: ["passage"], lock: ["integrity"], spoon: ["edge", "concealment"],
  loose_tile: ["concealment"], cot: ["integrity"], blanket: ["integrity"], bucket: [], meal_tray: [], key_ring: [],
  warden: ["posture"], prisoner: ["posture"],
};
const SET = JSON.parse(readFileSync(new URL("./intents.json", import.meta.url).pathname, "utf-8")) as {
  items: { group: string; intent: string; expect: string }[];
  pretence: { intent: string; expect: string }[];
};
// `PRETENCE=clause` replays the four pretence intents with the candidate clause
// appended to the effect question's person block (PREDICTION.md). Everything
// else is byte-identical to the live request.
const mode = process.argv[2] ?? "sweep";
const ITEMS: [string, string][] =
  mode === "pretence" || mode === "pretence-clause"
    ? SET.pretence.map((p) => ["P", p.intent] as [string, string])
    : SET.items.map((i) => [i.group, i.intent] as [string, string]);
const CLAUSE =
  " A feigned or performed physical act still moves the body that performs it: someone who pretends to collapse is on the floor, whatever they intend by it.";

const rows = [];
for (const [kind, intent] of ITEMS) {
  let captured: unknown = null;
  await createReferee(
    [
      async (request) => {
        if (mode === "pretence-clause") {
          const effect = request.questions.find((q) => q.id === "effect");
          if (effect === undefined) throw new Error("no effect question to add the clause to");
          (effect as { prompt: string }).prompt = effect.prompt + CLAUSE;
        }
        captured = request;
        return [];
      },
    ],
    {
      propertiesOf: (id) => PROPS[id] ?? [],
      isDeclared: (id, key) => (PROPS[id] ?? []).includes(key),
      instrumentMode: "checked",
    }
  ).rule(intent, OBJECTS);
  rows.push({ label: `${kind}: ${intent}`, kind, intent, source: "live createReferee (presence-shaped propertiesOf, instrument checked)", request: captured });
}
const out = new URL(`./C-${mode.toUpperCase()}.json`, import.meta.url).pathname;
writeFileSync(out, JSON.stringify(rows, null, 1));
const q = (rows[0].request as { questions: { id: string; answerKeys?: string[] }[] }).questions;
console.log(`L-LIVE.json ${rows.length} requests; questions ${q.map((x) => x.id).join(",")}`);
console.log(`property keys: ${JSON.stringify(q.find((x) => x.id === "property")?.answerKeys)}`);
console.log(`target keys include prisoner: ${q.find((x) => x.id === "target")?.answerKeys?.includes("prisoner")}`);
