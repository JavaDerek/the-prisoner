// P1 -- R5, the first act (docs/PLAYTEST-2026-09-27-DESIGN.md §3 R5 and §6 P1; BUILD-SPEC D7). See PREDICTION.md
// beside this file. Scaffolding, written 2026-09-27, NOT RUN.
//
// Every item is ruled by a referee built exactly as a game builds it (`kit.mts` `refereeOptions`, env readers --
// `PRISONER_ONE_ACT` must resolve to `first`, the default since 2026-09-27, or this probe measures nothing and
// refuses to start), on the perceived objects of its OWN recorded context, rebuilt by replaying that transcript's
// earlier half-rounds through `runOpenGame` at today's defaults (`kit.mts` `rebuildContext`). The tracing
// transport records every call, so a truncated ruling's own keys are kept even when it did not apply (the ruling
// the referee returns keeps them only when it did) -- which is what the stopping rule needs.
//
//   npx tsx checkpoints/2026-09-28-first-act/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-first-act/probe.mts --live
//   npx tsx checkpoints/2026-09-28-first-act/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runRefereeProbe, corpusItems, recordedIntent, PLAYTEST_2026_09_27, groupBy, majority, renderScoreboard, type Item } from "../2026-09-28-probe-kit/kit.mts";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 3;

/** The three compounds, each with the FIRST act's keys (R5's measure). */
const COMPOUNDS: Item[] = [
  ...corpusItems(["HB-r2", "HB-r10"], (row) => ({ group: "compound", expect: row.id === "HB-r2" ? { target: "door", effect: "open" } : { target: "warden", effect: "wear", property: "posture" } })),
  { id: "G27-P8", transcript: PLAYTEST_2026_09_27, chair: "prisoner", round: 8, intent: recordedIntent(PLAYTEST_2026_09_27, "prisoner", 8), group: "compound", expect: { target: "window", effect: "open" } },
];

/** The controls R5 names: corpus rows that read as compound and are one act, and this game's warden round 7 (the
 *  false positive the one-act reader flagged in play). The design counts "12"; it names these 11 -- see
 *  PREDICTION.md. */
const CONTROLS: Item[] = [
  ...corpusItems(["B7-P18", "B7-P23", "B7-P36", "B7-P48", "B7-P58", "B7-P59", "B7-P60", "B7-P61", "B7-W04", "B7-W07"], () => ({ group: "control" })),
  { id: "G27-W7", transcript: PLAYTEST_2026_09_27, chair: "warden", round: 7, intent: recordedIntent(PLAYTEST_2026_09_27, "warden", 7), group: "control" },
];

export const ITEMS: Item[] = [...COMPOUNDS, ...CONTROLS];

const matches = (row: any, expect: Record<string, string>) => Object.entries(expect).every(([k, v]) => row[k] === v);
/** A truncated call: a six-question call on text other than the item's own intent (`kit.mts` `tracing`). */
const truncatedCall = (row: any) => (row.trace ?? []).find((c: any) => c.questionIds.includes("target") && c.intent !== row.intent) ?? null;
const attempted = (row: any) => !!row.oneAct?.attempted;
const changed = (row: any) => attempted(row) && ["target", "effect", "property"].some((k) => row[k] !== row.oneAct.fullRuling?.[k]);

/** The STOP rule's count: compounds whose majority of samples cut the intent and found the first act inapplicable. */
export function splitInapplicableCount(rows: any[], items: Item[]): { hits: number; seen: number } {
  const by = groupBy(rows.filter((r) => !r.error), (r) => r.item);
  const v = items.filter((i) => i.group === "compound").map((i) => majority(by.get(i.id) ?? [], N, (r) => truncatedCall(r) !== null && !attempted(r))).filter((x) => x !== null) as boolean[];
  return { hits: v.filter(Boolean).length, seen: v.length };
}

export function score(rows: any[], items: Item[]): string[] {
  const by = groupBy(rows.filter((r) => !r.error), (r) => r.item);
  const compounds = items.filter((i) => i.group === "compound");
  const controls = items.filter((i) => i.group === "control");
  const verdicts = (list: Item[], test: (r: any, i: Item) => boolean) => list.map((i) => majority(by.get(i.id) ?? [], N, (r) => test(r, i))).filter((v) => v !== null) as boolean[];
  const firstAct = verdicts(compounds, (r, i) => attempted(r) && matches(r, i.expect as Record<string, string>));
  const splitInapplicable = verdicts(compounds, (r) => truncatedCall(r) !== null && !attempted(r));
  const noSplit = verdicts(compounds, (r) => truncatedCall(r) === null);
  const controlChanged = verdicts(controls, (r) => changed(r));
  const controlFlagged = verdicts(controls, (r) => r.oneAct?.flagged === true);
  const count = (v: boolean[]) => v.filter(Boolean).length;
  const lines = renderScoreboard("P1 -- the first act (item verdict = majority of its N=3 samples)", [
    { id: "1", text: "compounds rule the first act after truncation: 3 of 3", hits: count(firstAct), seen: firstAct.length, total: compounds.length, bound: { atLeast: 3 } },
    { id: "2", text: "controls flagged `several` AND the ruling changed: at most 1 (design: of 12; 11 named)", hits: count(controlChanged), seen: controlChanged.length, total: controls.length, bound: { atMost: 1 } },
    { id: "KILL", text: "controls changed: 3 or more kills (i.e. at most 2 survive)", hits: count(controlChanged), seen: controlChanged.length, total: controls.length, bound: { atMost: 2 } },
    { id: "STOP", text: "compounds whose truncated ruling was inapplicable: 2 or more stops (at most 1)", hits: count(splitInapplicable), seen: splitInapplicable.length, total: compounds.length, bound: { atMost: 1 } },
    { id: "r1", text: "compounds with no split at all (the reader said one, or cited from word 1) -- reported", hits: count(noSplit), seen: noSplit.length, total: compounds.length, bound: "report" },
    { id: "r2", text: "controls flagged `several` whatever happened next -- reported (§74.1's one-in-four)", hits: count(controlFlagged), seen: controlFlagged.length, total: controls.length, bound: "report" },
  ]);
  lines.push("", "Per item (samples in; first-act keys / truncated text):");
  for (const i of items) {
    const s = by.get(i.id) ?? [];
    lines.push(`- ${i.id} (${i.group}): ${s.length}/${N} -- ${s.map((r) => `${r.target}/${r.effect}/${r.property}${attempted(r) ? ` [first: "${r.oneAct.attempted.text}"]` : r.oneAct?.flagged ? " [flagged, full ruling stood]" : ""}`).join("; ")}`);
  }
  return lines;
}

if (isMain(import.meta.url)) {
  await runRefereeProbe({
    dir: DIR,
    name: "P1 first act",
    items: ITEMS,
    arms: [{ name: "first" }],
    n: N,
    argv: process.argv.slice(2),
    score,
    showQuestions: ["effect"],
    // PREDICTION.md's STOP: checked once the three compounds (listed first) are in.
    stopWhen: (rows, items) => {
      const { hits } = splitInapplicableCount(rows, items);
      return hits >= 2 ? `${hits} of 3 compounds cut the intent and ruled the first act inapplicable -- the controls are not run` : null;
    },
    requireArms: (arms) => (arms.oneAct === "first" ? null : `PRISONER_ONE_ACT resolves to "${arms.oneAct}"; P1 measures the "first" arm -- unset it`),
  });
}
