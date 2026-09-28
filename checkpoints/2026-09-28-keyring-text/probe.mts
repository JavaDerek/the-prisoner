// the-prisoner#31 -- the key ring's authored belt is gone; every held object's current holder is now stated
// by CODE (`briefing.ts`'s `describedAsItStands`), appended from `ownershipAt`, never by authored prose. See
// OPEN-VARIANT.md §81. This probe follows P6's own pattern (`../2026-09-28-texture-replay/probe.mts`): every
// row this repository has RECORDED a ruling for that targeted the key ring or the spoon, ruled twice on its
// own rebuilt context --
//   `old` -- the perceived list as it read before this fix: the key ring's authored text put back to its
//            literal pre-#31 string (`OLD_KEY_RING_BASE` below, a literal edit of this repository's own past
//            text -- read nowhere live, so a later rewording of the NEW text cannot leave this probe
//            comparing against something stale on that side), and every holder-reading suffix this fix
//            appends (`the-prisoner`'s own three fixed sentences, read live from `scenario.ts`'s names, never
//            hardcoded) stripped from every object's description, on every item;
//   `new` -- the descriptions as the game builds them today.
// Everything else in the two requests is identical. See PREDICTION.md. Scaffolding, 2026-09-28, NOT RUN.
//
//   npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --live
//   npx tsx checkpoints/2026-09-28-keyring-text/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, args, runRefereeProbe, corpusItems, recordedIntent, groupBy, renderScoreboard, type Item } from "../2026-09-28-probe-kit/kit.mts";
import { findObject } from "../../src/open/scenarioObjects.js";
import { PRISONER_SHORT_NAME, WARDEN_SHORT_NAME } from "../../src/scenario.js";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 3;

/** The key ring's own authored text before this fix (`git show` on this repository's own tree before the
 *  commit landing the-prisoner#31 -- OPEN-VARIANT.md §81 quotes it verbatim). A literal edit, on purpose,
 *  the same way P6's `PRE_D9_WINDOW_LINE` is: the OLD side of a text-change replay is never read live, since
 *  the whole point is comparing against what used to be sent, not against whatever the tree says today. */
export const OLD_KEY_RING_TEXT =
  "A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks.";
const NEW_KEY_RING_TEXT = findObject("key_ring")?.description ?? "";
if (!NEW_KEY_RING_TEXT) throw new Error("the-prisoner#31 replay: scenarioObjects.ts no longer declares a key_ring object -- has it been renamed?");
if (NEW_KEY_RING_TEXT === OLD_KEY_RING_TEXT) throw new Error("the-prisoner#31 replay: the key ring's authored text still matches the pre-fix string -- has the fix been reverted?");

/** The three sentences `describedAsItStands` appends for a thing's current holder (OPEN-VARIANT.md §81),
 *  read live from `scenario.ts`'s own names so a future rename cannot leave this probe stripping the wrong
 *  words. `"You hold it."` never carries a name and needs no lookup. */
const HOLDER_SUFFIXES = ["You hold it.", `${PRISONER_SHORT_NAME} holds it.`, `${WARDEN_SHORT_NAME} holds it.`];

const changedBy = new Map<string, boolean>();
/** The perceived list as it read before the-prisoner#31: the key ring's own base text put back, and every
 *  object's holder-reading suffix (there is only ever one per object, appended last) stripped -- on every
 *  item, not only the ones that name the key ring or the spoon, because a rebuilt context can perceive
 *  several held things at once (§81: "any held item has the mirror problem"). */
function oldText(objects: any[], item: Item): any[] {
  let changed = false;
  const out = objects.map((o) => {
    let d: string = o.description;
    const suffix = HOLDER_SUFFIXES.find((s) => d.endsWith(` ${s}`));
    if (suffix) d = d.slice(0, d.length - suffix.length - 1);
    if (o.id === "key_ring" && d === NEW_KEY_RING_TEXT) d = OLD_KEY_RING_TEXT;
    if (d !== o.description) changed = true;
    return d === o.description ? o : { ...o, description: d };
  });
  changedBy.set(item.id, changed);
  return out;
}

/** #31's own two recorded rows (OPEN-VARIANT.md §81): the exact transcripts and rounds the issue was filed
 *  from, both a `key_ring`/`take` ruling ("grab"/"take ... keys"). Round and chair confirmed against each
 *  transcript's own `### Round N (t=...) -- the prisoner` heading. */
const T28 = "checkpoints/2026-09-28T01-09-16-356Z.md";
const G27 = "checkpoints/2026-09-27T20-14-57-505Z.md";
const RECORDED_ROWS: Item[] = [
  { id: "T28-r7", transcript: T28, chair: "prisoner", round: 7, intent: recordedIntent(T28, "prisoner", 7), group: "recorded-take" },
  { id: "G27-r3", transcript: G27, chair: "prisoner", round: 3, intent: recordedIntent(G27, "prisoner", 3), group: "recorded-take" },
];

/** The D11 corpus's own take intents on the key ring or the spoon (`checkpoints/2026-09-26-human-intents/
 *  corpus.json`): every row whose RECORDED ruling targeted one of the two with effect `take` or `reveal`
 *  (an examine). Two rows meet it; none is `reveal` -- the corpus has no examine of either object recorded. */
const CORPUS_ROWS: Item[] = [
  ...corpusItems(["B7-P14"], () => ({ group: "corpus-take" })), // key_ring/take: "reach the wool up toward the key ring"
  ...corpusItems(["B7-P27"], () => ({ group: "corpus-take" })), // spoon/take: "pick up the spoon from the tray"
];

/** The design's items: #31's own two recorded rows, plus the D11 corpus's two take rows on the same two
 *  objects. Every item the task's brief named ("every recorded ruling that targeted the key ring or the
 *  spoon" in the two named transcripts, "plus take/examine intents on them from the D11 corpus, if any"). */
export const ITEMS: Item[] = [...RECORDED_ROWS, ...CORPUS_ROWS];

/** An arm's modal keys for one item: the answer at least 2 of N=3 samples gave, or null (no majority). */
function modal(samples: any[], keys: string[]): string | null {
  if (samples.length < N) return null;
  const tally = groupBy(samples, (r) => keys.map((k) => r[k]).join("/"));
  const [best] = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
  return best && best[1].length * 2 > N ? best[0] : null;
}

export function score(rows: any[]): string[] {
  const items = ITEMS;
  const ok = rows.filter((r) => !r.error);
  const cell = (arm: string, id: string) => ok.filter((r) => r.arm === arm && r.item === id);
  const complete = items.filter((i) => cell("old", i.id).length >= N && cell("new", i.id).length >= N);
  const differs = (i: Item, keys: string[]) => modal(cell("old", i.id), keys) !== modal(cell("new", i.id), keys);
  const noMajority = complete.filter((i) => [modal(cell("old", i.id), ["target", "effect"]), modal(cell("new", i.id), ["target", "effect"])].includes(null));
  const targetEffect = complete.filter((i) => differs(i, ["target", "effect"])).length;
  const property = complete.filter((i) => !differs(i, ["target", "effect"]) && differs(i, ["property"])).length;
  const lines = renderScoreboard("the-prisoner#31 -- the key ring text replay, old vs new (an item's keys = the majority of its N=3)", [
    { id: "1", text: "rows whose target or effect changes: 0", hits: targetEffect, seen: complete.length, total: items.length, bound: { atMost: 0 } },
    { id: "2", text: "rows whose property (only) changes: at most 2", hits: property, seen: complete.length, total: items.length, bound: { atMost: 2 } },
    { id: "KILL", text: "3 or more rows change target or effect -- the appended text moves what the referee thinks an act IS", hits: targetEffect, seen: complete.length, total: items.length, bound: { atMost: 2 } },
    { id: "r1", text: "rows with no majority in an arm (counted as a change above) -- reported", hits: noMajority.length, seen: complete.length, total: items.length, bound: "report" },
  ]);
  lines.push("", "Per item: old -> new (target/effect/property majority):");
  for (const i of items) lines.push(`- ${i.id} [${i.group}]: ${modal(cell("old", i.id), ["target", "effect", "property"]) ?? "-"} -> ${modal(cell("new", i.id), ["target", "effect", "property"]) ?? "-"}`);
  return lines;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  await runRefereeProbe({
    dir: DIR,
    name: "the-prisoner#31 key ring text replay",
    items: ITEMS,
    arms: [{ name: "old", perceived: oldText }, { name: "new" }],
    n: N,
    argv,
    score,
    showQuestions: ["source:desc:key_ring", "source:desc:spoon"],
  });
  if (args(argv).has("dry-run")) {
    const same = ITEMS.filter((i) => changedBy.get(i.id) === false).map((i) => i.id);
    console.log(`\nRequests that differ between old and new: ${ITEMS.length - same.length} of ${ITEMS.length}.${same.length ? ` Identical in both arms: ${same.join(", ")}.` : ""}`);
  }
}
