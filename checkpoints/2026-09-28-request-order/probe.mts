// P7 -- the request order (optional, last): does putting the intent LAST among the referee's sources, so the stable
// descriptions form a prefix the server can reuse, take time off a ruling without changing it?
// (PLAYTEST-2026-09-27-DESIGN.md §3 R7 "Waiting" and §6 P7; RED-TEAM.md §3's R7 row: "the prefix cache covers one
// line".) See PREDICTION.md. Scaffolding, 2026-09-27, NOT RUN.
//
// The game's request lists the intent FIRST (`referee.ts` `buildSources`; `refereeTransport.ts` renders sources in
// order). There is no game arm for the other order and this probe adds none (no `src/` change): the `intent-last`
// arm is a transport wrapper that moves the `intent` source to the end of `request.sources` before the real
// transport renders it. The reader verifies citations by source id, so the order cannot change what verifies --
// only what the model reads first. Both arms rule the playtest's twenty half-rounds in game order, each on its own
// context rebuilt at today's defaults, one block per arm (`intent-first`, then `intent-last`), because a prefix
// cache helps consecutive calls, and interleaving the arms would evict it.
//
//   npx tsx checkpoints/2026-09-28-request-order/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-request-order/probe.mts --live
//   npx tsx checkpoints/2026-09-28-request-order/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runRefereeProbe, parseRecordedGame, PLAYTEST_2026_09_27, renderScoreboard, type Item, type Prediction } from "../2026-09-28-probe-kit/kit.mts";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 1;

/** The playtest's twenty half-rounds, in the order they were played. */
export const ITEMS: Item[] = parseRecordedGame(PLAYTEST_2026_09_27)
  .halves.filter((h) => h.intent !== null && h.round <= 10)
  .map((h) => ({ id: `r${h.round}-${h.chair}`, transcript: PLAYTEST_2026_09_27, chair: h.chair, round: h.round, intent: h.intent as string }));
if (ITEMS.length !== 20) throw new Error(`P7: expected the playtest's 20 half-rounds, found ${ITEMS.length}`);

/** The intent moved to the end of the sources, nothing else touched. */
export function intentLast(transport: any): any {
  const wrapped = async (request: any) => transport({ ...request, sources: [...request.sources.filter((s: any) => s.id !== "intent"), ...request.sources.filter((s: any) => s.id === "intent")] });
  (wrapped as any).lastExchange = () => transport.lastExchange?.();
  return wrapped;
}

const KEYS = ["target", "effect", "property", "product", "magnitude", "perceptibility"];
/** The six-question call's own time: the transport's `ms` when it keeps one, else the wall time. */
const mainMs = (r: any): number | null => {
  const call = (r.trace ?? []).find((c: any) => c.questionIds.includes("target") && c.intent === r.intent);
  return call ? (call.exchangeMs ?? call.ms) : null;
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function score(rows: any[]): string[] {
  const ok = rows.filter((r) => !r.error);
  const of = (arm: string, id: string) => ok.find((r) => r.arm === arm && r.item === id);
  const paired = ITEMS.filter((i) => of("intent-first", i.id) && of("intent-last", i.id));
  const differing = paired.filter((i) => KEYS.some((k) => of("intent-first", i.id)[k] !== of("intent-last", i.id)[k]));
  const first = paired.map((i) => mainMs(of("intent-first", i.id))).filter((x): x is number => x !== null);
  const last = paired.map((i) => mainMs(of("intent-last", i.id))).filter((x): x is number => x !== null);
  const cut = first.length && last.length ? 1 - median(last) / median(first) : NaN;
  const done = paired.length === ITEMS.length;
  const pct = Number.isNaN(cut) ? "-" : `${Math.round(cut * 1000) / 10}% (median ${median(first)} ms -> ${median(last)} ms)`;
  const timeRow = (id: string, text: string, pass: (c: number) => boolean): Prediction => ({
    id,
    text,
    hits: 0,
    seen: 0,
    total: ITEMS.length,
    bound: "report",
    custom: { soFar: `${paired.length} pairs: ${pct}`, projected: "-", verdict: !done || Number.isNaN(cut) ? "OPEN" : pass(cut) ? "MET" : "DEAD" },
  });
  const lines = renderScoreboard("P7 -- the request order (one ruling per half-round per arm; time = the six-question call's)", [
    timeRow("1", "intent-last takes at least 20% off the median ruling time", (c) => c >= 0.2),
    timeRow("KILL", "less than 10% off kills (at least 10% survives)", (c) => c >= 0.1),
    { id: "HOLD", text: "rulings identical in both orders on all 20 (any difference: the order is a batch boundary and is held)", hits: differing.length, seen: paired.length, total: ITEMS.length, bound: { atMost: 0 } },
  ]);
  lines.push("", "Verdicts on the time rows are given only when all 20 pairs are in: a median is not projected.");
  if (differing.length) lines.push("", "Differing rulings:", ...differing.map((i) => `- ${i.id}: ${KEYS.map((k) => `${k} ${of("intent-first", i.id)[k]}->${of("intent-last", i.id)[k]}`).join(", ")}`));
  return lines;
}

if (isMain(import.meta.url)) {
  await runRefereeProbe({
    dir: DIR,
    name: "P7 request order",
    items: ITEMS,
    arms: [{ name: "intent-first" }, { name: "intent-last", wrapTransport: intentLast }],
    n: N,
    argv: process.argv.slice(2),
    score,
  });
}
