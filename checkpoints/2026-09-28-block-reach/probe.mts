// P2 -- R2, reach: does a Muse warden, told `block` by his own condition list, reach for it? (PLAYTEST-2026-09-27-
// DESIGN.md §3 R2 and §6 P2, with RED-TEAM.md F13's corrected round-5 context and §4's prior; BUILD-SPEC D4', D4b.)
// See PREDICTION.md beside this file. Scaffolding, written 2026-09-27, NOT RUN.
//
// Three warden contexts from the owner's playtest (checkpoints/2026-09-27T20-14-57-505Z.md), each REBUILT at
// today's defaults by replaying that game's earlier half-rounds, with their recorded keys, through `runOpenGame`
// (`kit.mts` `rebuildContext`) -- so suspicion, beliefs, news, notes and plan are the world's own today, never
// copied out of the transcript. The warden mind is built as `checkpoint.ts` builds it (conditions per
// `PRISONER_CONDITIONS`, `both` by default, which gives him the list with `block` and the two restores); each
// sample's intent is ruled by a referee built as a game builds it. Counted on the referee's closed keys only.
//
//   npx tsx checkpoints/2026-09-28-block-reach/probe.mts --dry-run [--omit=prisoner:2]
//   npx tsx checkpoints/2026-09-28-block-reach/probe.mts --live   [--omit=prisoner:2]
//   npx tsx checkpoints/2026-09-28-block-reach/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runMindProbe, PLAYTEST_2026_09_27, groupBy, renderScoreboard, type MindCell } from "../2026-09-28-probe-kit/kit.mts";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 10;

export const CELLS: MindCell[] = [
  { name: "r5", round: 5, chair: "warden", conditions: "env" },
  { name: "r9", round: 9, chair: "warden", conditions: "env" },
  { name: "r10", round: 10, chair: "warden", conditions: "env" },
];

const ruled = (rows: any[]) => rows.filter((r) => r.intent);
const count = (rows: any[], test: (r: any) => boolean) => ruled(rows).filter(test).length;
const isBlock = (r: any) => r.effect === "block";
const isRestore = (r: any) => r.effect === "restore";
const windowLook = (r: any) => r.target === "window" && r.effect === "reveal";

export function score(rows: any[]): string[] {
  const by = groupBy(rows.filter((r) => !r.error), (r) => r.cell);
  const r5 = by.get("r5") ?? [];
  const r9 = by.get("r9") ?? [];
  const r10 = by.get("r10") ?? [];
  const lines = renderScoreboard("P2 -- block reach (counts over the referee's effect key; a silence counts as a sample that chose nothing)", [
    { id: "1", text: "round 5: `block` ruled in at least 4 of 10", hits: r5.filter(isBlock).length, seen: r5.length, total: N, bound: { atLeast: 4 } },
    { id: "KILL", text: "round 5: `block` 0 of 10 kills (i.e. at least 1 survives)", hits: r5.filter(isBlock).length, seen: r5.length, total: N, bound: { atLeast: 1 } },
    { id: "r1", text: "round 5: `restore` ruled (the design: at least 1 of 10, reported)", hits: r5.filter(isRestore).length, seen: r5.length, total: N, bound: "report" },
    { id: "2", text: "round 10: the window examined (`window`/`reveal`) in at least 6 of 10", hits: r10.filter(windowLook).length, seen: r10.length, total: N, bound: { atLeast: 6 } },
    { id: "3", text: "round 10: `block` in at most 3 of 10", hits: r10.filter(isBlock).length, seen: r10.length, total: N, bound: { atMost: 3 } },
    { id: "r2", text: "round 9: `block` -- reported", hits: r9.filter(isBlock).length, seen: r9.length, total: N, bound: "report" },
    { id: "r3", text: "round 9: `restore` -- reported", hits: r9.filter(isRestore).length, seen: r9.length, total: N, bound: "report" },
    { id: "r4", text: "round 9: the window examined -- reported", hits: r9.filter(windowLook).length, seen: r9.length, total: N, bound: "report" },
  ]);
  lines.push("", "Per cell: effect/target counts (applicable in brackets), silences:");
  for (const cell of CELLS) {
    const s = by.get(cell.name) ?? [];
    const tally = groupBy(ruled(s), (r) => `${r.target}/${r.effect}`);
    const parts = [...tally.entries()].map(([k, v]) => `${k} ${v.length} [${v.filter((r) => r.applicable).length}]`);
    lines.push(`- ${cell.name}: ${s.length}/${N} -- ${parts.join(", ") || "(none yet)"}; silences ${s.length - ruled(s).length}; errors ${rows.filter((r) => r.cell === cell.name && r.error).length}`);
  }
  lines.push("", "Candidates are in results.jsonl for hand reading (design §1.4: rounds 9 and 10 named a block unprompted); no code reads them.");
  return lines;
}

if (isMain(import.meta.url)) {
  await runMindProbe({ dir: DIR, name: "P2 block reach", transcript: PLAYTEST_2026_09_27, cells: CELLS, n: N, argv: process.argv.slice(2), score });
}
