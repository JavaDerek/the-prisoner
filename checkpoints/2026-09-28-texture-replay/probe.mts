// P6 -- R7's texture and the window's open line, replayed (PLAYTEST-2026-09-27-DESIGN.md §3 R7 and §6 P6;
// BUILD-SPEC D9, which landed with this replay PENDING, `6995117`). See PREDICTION.md. Scaffolding, 2026-09-27,
// NOT RUN.
//
// D9 changed two texts the referee reads as sources: the bar gained three `readRanges` bands (70/55/40) appended
// to `desc:bar`, and the window's open line became "It stands open now: the bar is out, and the gap is wide enough
// to climb through." This probe rules the rows R7 names on their own rebuilt contexts twice:
//   `pre-D9` -- the perceived descriptions as they read before `6995117`: the bar's band sentence removed from the
//              end of its description and the window's open line put back to "...the bar is out of its widest
//              gap." Both are literal edits of this repository's own strings, the new ones read from
//              `scenarioObjects.ts` itself (so a later rewording cannot leave this probe testing stale text);
//   `D9`     -- the descriptions as the game builds them today.
// Everything else in the two requests is identical. The dry run reports which rows' requests differ at all.
//
//   npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --dry-run [--with-at-band]
//   npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --live    [--with-at-band]
//   npx tsx checkpoints/2026-09-28-texture-replay/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, args, runRefereeProbe, corpusItems, recordedIntent, PLAYTEST_2026_09_27, groupBy, renderScoreboard, type Item } from "../2026-09-28-probe-kit/kit.mts";
import { findProperty } from "../../src/open/scenarioObjects.js";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 3;

/** The window's open line before D9 (`git show 6995117 -- src/open/scenarioObjects.ts`, the `-` line). */
export const PRE_D9_WINDOW_LINE = "It stands open now: the bar is out of its widest gap.";
const D9_WINDOW_LINE = findProperty("window", "passage")?.reads?.[1] ?? "";
const BAR_BANDS = (findProperty("bar", "integrity")?.readRanges ?? []).map((r) => r.text);
if (!D9_WINDOW_LINE || BAR_BANDS.length !== 3) throw new Error("P6: D9's window line or the bar's three bands are not in scenarioObjects.ts -- has D9 moved?");

const changedBy = new Map<string, boolean>();
/** The perceived list as it read before D9: literal edits of the two strings D9 changed, nothing else. */
function preD9(objects: any[], item: Item): any[] {
  let changed = false;
  const out = objects.map((o) => {
    let d: string = o.description;
    if (o.id === "bar") {
      const band = BAR_BANDS.find((b) => d.endsWith(` ${b}`));
      if (band) d = d.slice(0, d.length - band.length - 1);
    }
    if (o.id === "window" && d.includes(D9_WINDOW_LINE)) d = d.replace(D9_WINDOW_LINE, PRE_D9_WINDOW_LINE);
    if (d !== o.description) changed = true;
    return d === o.description ? o : { ...o, description: d };
  });
  changedBy.set(item.id, changed);
  return out;
}

const D1 = "checkpoints/2026-09-16T02-57-03-181Z.md";
const D2 = "checkpoints/2026-09-16T03-02-00-241Z.md";
const D3 = "checkpoints/2026-09-16T03-07-14-995Z.md";
/** §33.7's nine climb-outs (batch D, OPEN-VARIANT §33.4), each on its own game's rebuilt context. */
const CLIMBS: Item[] = ([
  ["D1-r7", D1, 7],
  ["D1-r8", D1, 8],
  ["D1-r9", D1, 9],
  ["D2-r10", D2, 10],
  ["D3-r19", D3, 19],
  ["D3-r20", D3, 20],
  ["D3-r21", D3, 21],
  ["D3-r22", D3, 22],
  ["D3-r23", D3, 23],
] as const).map(([id, transcript, round]) => ({ id, transcript, chair: "prisoner", round, intent: recordedIntent(transcript, "prisoner", round), group: "climb" }));

// R7's named D11 shape groups: bar-open, bar-wear, window-open, warden-bar-reveal.
const D11_ROWS: Item[] = [
  ...corpusItems(["B7-P33", "B7-P36", "B7-P61"], () => ({ group: "bar-open" })),
  ...corpusItems(["B7-P31"], () => ({ group: "bar-wear" })),
  ...corpusItems(["B7-P26", "B7-P28", "B7-P29"], () => ({ group: "window-open" })),
  ...corpusItems(["B7-W01", "B7-W04", "B7-W06", "B7-W07", "B7-W09"], () => ({ group: "warden-bar-reveal" })),
];

/** The design's P6 rows: the D11 rows on their own contexts, §33.7's climbs, and this game's round 10. */
export const ITEMS: Item[] = [...D11_ROWS, ...CLIMBS, { id: "G27-P10", transcript: PLAYTEST_2026_09_27, chair: "prisoner", round: 10, intent: recordedIntent(PLAYTEST_2026_09_27, "prisoner", 10), group: "climb" }];

/** `--with-at-band` (the scaffolding's addition, reported unless the owner pre-registers it): on their own
 *  contexts most D11 rows see the bar above 70, where D9 adds nothing and both arms send the same request. These
 *  are the same twelve texts ruled where the bar reads its 40 band -- this game's round 9, the prisoner's or the
 *  warden's context by the row's own chair, window shut. */
export const AT_BAND: Item[] = D11_ROWS.map((i) => ({ ...i, id: `${i.id}@40`, transcript: PLAYTEST_2026_09_27, round: 9, group: `${i.group}@40`, atBand: true }));

/** An arm's modal keys for one item: the answer at least 2 of N=3 samples gave, or null (no majority). */
function modal(samples: any[], keys: string[]): string | null {
  if (samples.length < N) return null;
  const tally = groupBy(samples, (r) => keys.map((k) => r[k]).join("/"));
  const [best] = [...tally.entries()].sort((a, b) => b[1].length - a[1].length);
  return best && best[1].length * 2 > N ? best[0] : null;
}

export function score(rows: any[]): string[] {
  // Always every item, so rows a `--with-at-band` run wrote are scored whether or not this poll passed the flag.
  const all = [...ITEMS, ...AT_BAND];
  const items = ITEMS;
  const band = AT_BAND;
  const ok = rows.filter((r) => !r.error);
  const cell = (arm: string, id: string) => ok.filter((r) => r.arm === arm && r.item === id);
  const complete = items.filter((i) => cell("pre-D9", i.id).length >= N && cell("D9", i.id).length >= N);
  const differs = (i: Item, keys: string[]) => modal(cell("pre-D9", i.id), keys) !== modal(cell("D9", i.id), keys);
  const noMajority = complete.filter((i) => [modal(cell("pre-D9", i.id), ["target", "effect"]), modal(cell("D9", i.id), ["target", "effect"])].includes(null));
  const targetEffect = complete.filter((i) => differs(i, ["target", "effect"])).length;
  const property = complete.filter((i) => !differs(i, ["target", "effect"]) && differs(i, ["property"])).length;
  const lines = renderScoreboard("P6 -- the texture replay, pre-D9 vs D9 text (an item's keys = the majority of its N=3)", [
    { id: "1", text: "rows whose target or effect changes: 0", hits: targetEffect, seen: complete.length, total: items.length, bound: { atMost: 0 } },
    { id: "2", text: "rows whose property (only) changes: at most 2", hits: property, seen: complete.length, total: items.length, bound: { atMost: 2 } },
    { id: "KILL", text: "3 or more rows change target or effect (the bands are reworded) -- at most 2 survive", hits: targetEffect, seen: complete.length, total: items.length, bound: { atMost: 2 } },
    { id: "r1", text: "rows with no majority in an arm (counted as a change above) -- reported", hits: noMajority.length, seen: complete.length, total: items.length, bound: "report" },
    { id: "r2", text: "climb-outs ruled `leave` under D9 (§33.7 had 9 of 9 with the old line) -- reported", hits: items.filter((i) => i.group === "climb" && modal(cell("D9", i.id), ["effect"]) === "leave").length, seen: items.filter((i) => i.group === "climb" && cell("D9", i.id).length >= N).length, total: items.filter((i) => i.group === "climb").length, bound: "report" },
  ]);
  const bandDone = band.filter((i) => cell("pre-D9", i.id).length >= N && cell("D9", i.id).length >= N);
  lines.push(
    "",
    `At the 40 band (--with-at-band, reported): ${bandDone.filter((i) => differs(i, ["target", "effect"])).length} of ${bandDone.length} rows change target or effect; ${bandDone.filter((i) => !differs(i, ["target", "effect"]) && differs(i, ["property"])).length} change property only.`
  );
  lines.push("", "Per item: pre-D9 -> D9 (target/effect/property majority):");
  for (const i of all) lines.push(`- ${i.id} [${i.group}]: ${modal(cell("pre-D9", i.id), ["target", "effect", "property"]) ?? "-"} -> ${modal(cell("D9", i.id), ["target", "effect", "property"]) ?? "-"}`);
  return lines;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  await runRefereeProbe({
    dir: DIR,
    name: "P6 texture replay",
    items: args(argv).has("with-at-band") ? [...ITEMS, ...AT_BAND] : ITEMS,
    arms: [{ name: "pre-D9", perceived: preD9 }, { name: "D9" }],
    n: N,
    argv,
    score,
    showQuestions: ["source:desc:bar", "source:desc:window"],
  });
  if (args(argv).has("dry-run")) {
    const built = args(argv).has("with-at-band") ? [...ITEMS, ...AT_BAND] : ITEMS;
    const same = built.filter((i) => changedBy.get(i.id) === false).map((i) => i.id);
    console.log(`\nRequests that differ between pre-D9 and D9: ${built.length - same.length} of ${built.length}.${same.length ? ` Identical in both arms (the bar above 70, the window shut): ${same.join(", ")}.` : ""}`);
  }
}
