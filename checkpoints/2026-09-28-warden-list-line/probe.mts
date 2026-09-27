// P4 -- R4 x R1, the 2x2: does the warden's condition LIST (vs rule sentences) decide whether he examines the open
// window, and does the OUTCOME sentence ("opens the window") vs the ATTEMPT sentence ("works to open the window")
// only colour his notes? (PLAYTEST-2026-09-27-DESIGN.md §3 R1 M2, R4 and §6 P4; RED-TEAM.md F6: the list's
// prediction is borrowed from §34.3, which measured a TRUE line on qwen3:14b.) See PREDICTION.md. Scaffolding,
// written 2026-09-27, NOT RUN.
//
// One context -- the warden at round 10 of the owner's playtest, window standing open, suspicion 95 -- REBUILT at
// today's defaults (`kit.mts` `rebuildContext`), then shown four ways:
//   shape: `list` (the condition list, `openConditions` at today's door/block arms) or `sentences` (no list: the
//          rule sentences `mind.ts` states instead) -- the only difference `PRISONER_CONDITIONS` makes to his prompt;
//   line:  `attempt` (today's D1 sentence, as the game renders it) or `outcome` (the pre-D1 sentence, quoted from
//          the playtest's own `**Other perceives:**` line for the same act). A literal swap of one line this
//          repository wrote, asserted to have happened.
// `--with-round6` adds R1's M2 as the design first wrote it (round 6, window SHUT, list, both lines): reported only
// unless the owner pre-registers it (PREDICTION.md).
//
// Hand labels (never code reading English): `--labels-template` prints every sample's notes and plan with two
// empty fields; the owner fills them into LABELS.json beside this file and `--score` counts them.
//
//   npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --dry-run [--with-round6]
//   npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --live   [--with-round6]
//   npx tsx checkpoints/2026-09-28-warden-list-line/probe.mts --score | --labels-template
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runMindProbe, parseRecordedGame, resultsFile, PLAYTEST_2026_09_27, renderScoreboard, args, type MindCell, type Prediction } from "../2026-09-28-probe-kit/kit.mts";
import { describeAttempt } from "../../src/open/loop.js";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 10;

/** Today's sentence for the prisoner's window open, from the game's own `describeAttempt`. */
export const ATTEMPT_LINE = describeAttempt("prisoner", { targetObjectId: "window", effectKind: "open" });
/** The pre-D1 sentence for the same act, quoted from the playtest (its round-9 prisoner half-round). */
export const OUTCOME_LINE = (() => {
  const half = parseRecordedGame(PLAYTEST_2026_09_27).halves.find((h) => h.chair === "prisoner" && h.round === 9);
  const line = half?.otherPerceives ?? "";
  if (line !== "Mara Voss opens the window.") throw new Error(`P4: the playtest's round-9 line is ${JSON.stringify(line)}, not the outcome sentence this probe quotes`);
  return line;
})();

function withLine(line: "attempt" | "outcome") {
  return (context: any) => {
    if (line === "attempt") {
      if (!context.briefing.split("\n").includes(ATTEMPT_LINE)) throw new Error(`P4: the rebuilt briefing has no "${ATTEMPT_LINE}" line`);
      return context;
    }
    const lines = context.briefing.split("\n");
    const at = lines.indexOf(ATTEMPT_LINE);
    if (at < 0) throw new Error(`P4: the rebuilt briefing has no "${ATTEMPT_LINE}" line to swap`);
    lines[at] = OUTCOME_LINE;
    return { ...context, briefing: lines.join("\n") };
  };
}

export const CELLS: MindCell[] = [
  { name: "list-outcome", round: 10, chair: "warden", conditions: "list", transform: withLine("outcome") },
  { name: "list-attempt", round: 10, chair: "warden", conditions: "list", transform: withLine("attempt") },
  { name: "sentences-outcome", round: 10, chair: "warden", conditions: "sentences", transform: withLine("outcome") },
  { name: "sentences-attempt", round: 10, chair: "warden", conditions: "sentences", transform: withLine("attempt") },
];
export const ROUND6_CELLS: MindCell[] = [
  { name: "r6-list-outcome", round: 6, chair: "warden", conditions: "list", transform: withLine("outcome") },
  { name: "r6-list-attempt", round: 6, chair: "warden", conditions: "list", transform: withLine("attempt") },
];

type Labels = Record<string, { notesSayOpened?: boolean | null; planKeepsSuspicionLow?: boolean | null }>;
function readLabels(): Labels {
  const path = join(DIR, "LABELS.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as Labels) : {};
}

const windowLook = (r: any) => r.target === "window" && r.effect === "reveal";

/** |a - b| at the end can be as small as the gap still closable by the samples to come; DEAD when even that
 *  exceeds the bound. */
function differenceRow(id: string, text: string, a: any[], b: any[], bound: number): Prediction {
  const ha = a.filter(windowLook).length;
  const hb = b.filter(windowLook).length;
  const ra = N - a.length;
  const rb = N - b.length;
  const lo = ha - (hb + rb);
  const hi = ha + ra - hb;
  const minAbs = lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));
  const done = ra === 0 && rb === 0;
  const verdict = minAbs > bound ? "DEAD" : done ? "MET" : "OPEN";
  return { id, text, hits: 0, seen: 0, total: N, bound: { atMost: bound }, custom: { soFar: `${ha} of ${a.length} vs ${hb} of ${b.length}`, projected: a.length && b.length ? `${Math.round(Math.abs((ha / a.length - hb / b.length) * N) * 10) / 10}` : "-", verdict } };
}

export function score(rows: any[]): string[] {
  const ok = rows.filter((r) => !r.error);
  const cell = (name: string) => ok.filter((r) => r.cell === name);
  const labels = readLabels();
  const labelled = (name: string, key: "notesSayOpened" | "planKeepsSuspicionLow") => cell(name).filter((r) => typeof labels[r.sampleId]?.[key] === "boolean");
  const labelHits = (name: string, key: "notesSayOpened" | "planKeepsSuspicionLow") => labelled(name, key).filter((r) => labels[r.sampleId][key] === true).length;
  const looks = (name: string, text: string, bound: Prediction["bound"], id: string): Prediction => ({ id, text, hits: cell(name).filter(windowLook).length, seen: cell(name).length, total: N, bound });
  const label = (name: string, key: "notesSayOpened" | "planKeepsSuspicionLow", text: string, bound: Prediction["bound"], id: string): Prediction => ({ id, text, hits: labelHits(name, key), seen: labelled(name, key).length, total: N, bound });
  const lines = renderScoreboard("P4 -- the 2x2 at round 10 (window examined = the referee's `window`/`reveal`; notes and plan = the owner's labels)", [
    looks("list-outcome", "list x outcome line: window examined in at least 8 of 10 (borrowed, F6)", { atLeast: 8 }, "1a"),
    looks("list-attempt", "list x attempt line: window examined in at least 8 of 10 (borrowed, F6)", { atLeast: 8 }, "1b"),
    looks("sentences-outcome", "sentences x outcome line: window examined in at most 2 of 10", { atMost: 2 }, "2a"),
    looks("sentences-attempt", "sentences x attempt line: window examined in at most 2 of 10", { atMost: 2 }, "2b"),
    differenceRow("3a", "list: the line moves examination by at most 2 of 10", cell("list-outcome"), cell("list-attempt"), 2),
    differenceRow("3b", "sentences: the line moves examination by at most 2 of 10", cell("sentences-outcome"), cell("sentences-attempt"), 2),
    label("list-outcome", "notesSayOpened", "list x outcome: notes say she opened it, at least 8 of 10 (labels)", { atLeast: 8 }, "4a"),
    label("sentences-outcome", "notesSayOpened", "sentences x outcome: notes say she opened it, at least 8 of 10 (labels)", { atLeast: 8 }, "4b"),
    label("list-attempt", "notesSayOpened", "list x attempt: notes say she opened it, at most 2 of 10 (labels; see PREDICTION: confounded at round 10)", { atMost: 2 }, "4c"),
    label("sentences-attempt", "notesSayOpened", "sentences x attempt: notes say she opened it, at most 2 of 10 (labels; confounded at round 10)", { atMost: 2 }, "4d"),
    label("sentences-outcome", "planKeepsSuspicionLow", "sentences x outcome: plan keeps suspicion low, at least 5 of 10 (labels)", { atLeast: 5 }, "5a"),
    label("sentences-attempt", "planKeepsSuspicionLow", "sentences x attempt: plan keeps suspicion low, at least 5 of 10 (labels)", { atLeast: 5 }, "5b"),
    label("list-outcome", "planKeepsSuspicionLow", "list x outcome: plan keeps suspicion low, at most 1 of 10 (labels)", { atMost: 1 }, "5c"),
    label("list-attempt", "planKeepsSuspicionLow", "list x attempt: plan keeps suspicion low, at most 1 of 10 (labels)", { atMost: 1 }, "5d"),
    looks("list-outcome", "KILL (model choice): list x outcome under 5 of 10 (at least 5 survive)", { atLeast: 5 }, "KILL-a"),
    looks("list-attempt", "KILL (model choice): list x attempt under 5 of 10 (at least 5 survive)", { atLeast: 5 }, "KILL-b"),
    { ...label("r6-list-outcome", "notesSayOpened", "round 6 (window shut) x outcome: notes say she opened it -- R1's M2, reported", "report", "r1") },
    { ...label("r6-list-attempt", "notesSayOpened", "round 6 (window shut) x attempt: notes say she opened it -- R1's M2, reported", "report", "r2") },
  ]);
  lines.push("", "Per cell: target/effect counts, silences:");
  for (const c of [...CELLS, ...ROUND6_CELLS]) {
    const s = cell(c.name);
    if (s.length === 0) continue;
    const tally = new Map<string, number>();
    for (const r of s.filter((x) => x.intent)) tally.set(`${r.target}/${r.effect}`, (tally.get(`${r.target}/${r.effect}`) ?? 0) + 1);
    lines.push(`- ${c.name}: ${s.length}/${N} -- ${[...tally.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}; silences ${s.filter((x) => !x.intent).length}`);
  }
  const unlabelled = ok.filter((r) => r.intent && !(r.sampleId in labels)).length;
  if (unlabelled > 0) lines.push("", `${unlabelled} sample(s) are not labelled yet: run --labels-template and fill LABELS.json by hand.`);
  return lines;
}

/** Every sample's notes and plan, with the two fields a person fills. Nothing is pre-filled. */
function labelsTemplate(): string {
  const rows = resultsFile(DIR).rows().filter((r: any) => r.sampleId && r.intent);
  const out: Record<string, unknown> = {};
  for (const r of rows) out[r.sampleId] = { notes: r.notes ?? "", plan: r.plan ?? "", notesSayOpened: null, planKeepsSuspicionLow: null };
  return JSON.stringify(out, null, 2);
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (args(argv).has("labels-template")) {
    console.log(labelsTemplate());
  } else {
    const cells = args(argv).has("with-round6") ? [...CELLS, ...ROUND6_CELLS] : CELLS;
    await runMindProbe({ dir: DIR, name: "P4 warden list x line", transcript: PLAYTEST_2026_09_27, cells, n: N, argv, score });
  }
}
