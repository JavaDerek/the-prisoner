// P3 -- R3, the person: does an act done to a person WITH a thing land on the person, and as the act it is?
// (PLAYTEST-2026-09-27-DESIGN.md §3 R3 and §6 P3, corrected by RED-TEAM.md F7: target AND effect AND property must
// be `warden` / `wear` / `sight` to count; BUILD-SPEC D12.) See PREDICTION.md. Scaffolding, 2026-09-27, NOT RUN.
//
// Two arms, run in this order: the person-instrument clause OFF (the env default, `PRISONER_PERSON_INSTRUMENT`
// unset) and ON (the only override this probe makes, printed in every meta line). Every request is built on its
// own recorded context rebuilt at today's defaults -- presence `modelled`, so a person is a target key and D12's
// `sight` exists -- never the recorded round-2 request, which is the wrong arm (§68.8).
//
//   npx tsx checkpoints/2026-09-28-person-target/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-person-target/probe.mts --live
//   npx tsx checkpoints/2026-09-28-person-target/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runRefereeProbe, corpusItems, recordedIntent, PLAYTEST_2026_09_27, groupBy, renderScoreboard, type Item } from "../2026-09-28-probe-kit/kit.mts";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 5;
const G27 = PLAYTEST_2026_09_27;

/** The person-aimed rows R3 names. Only `G27-P2` carries a prediction; the rest are reported (F7: a person-aimed act
 *  that lands on the person as `noise` is still a rewrite, so their effect and property are reported with the target). */
const PERSON: Item[] = [
  { id: "G27-P2", transcript: G27, chair: "prisoner", round: 2, intent: recordedIntent(G27, "prisoner", 2), group: "scored", expect: { target: "warden", effect: "wear", property: "sight" } },
  { id: "G27-P3", transcript: G27, chair: "prisoner", round: 3, intent: recordedIntent(G27, "prisoner", 3), group: "person", expect: { target: "key_ring", effect: "take" } },
  ...corpusItems(["I25-3", "I25-5", "HB-r1", "HB-r3", "G1-r1"], (row) => ({ group: "person", expect: row.expectedKeys ?? null })),
];

/** R3's four controls, each on a context the record already has, with the object it must stay on. */
const CONTROLS: Item[] = [
  { id: "C-take", transcript: G27, chair: "prisoner", round: 1, intent: recordedIntent(G27, "prisoner", 1), group: "control", expect: { target: "blanket" } },
  { id: "C-hide-spoon", transcript: null, chair: "prisoner", round: 1, intent: "hide the spoon under the tile", group: "control", expect: { target: "spoon" } },
  ...corpusItems(["I25-1"], () => ({ group: "control", expect: { target: "blanket" } })),
  ...corpusItems(["G1-r2"], () => ({ group: "control", expect: { target: "cot" } })),
];

export const ITEMS: Item[] = [...PERSON, ...CONTROLS];

const sightOnWarden = (r: any) => r.target === "warden" && r.effect === "wear" && r.property === "sight";
const moved = (r: any, i: Item) => r.target !== (i.expect as { target: string }).target;

export function score(rows: any[], items: Item[]): string[] {
  const ok = rows.filter((r) => !r.error);
  const cell = (arm: string, id: string) => ok.filter((r) => r.arm === arm && r.item === id);
  const controls = items.filter((i) => i.group === "control");
  const controlSamples = (arm: string) => controls.flatMap((i) => cell(arm, i.id).map((r) => ({ r, i })));
  const worstControl = (arm: string) => Math.max(0, ...controls.map((i) => cell(arm, i.id).filter((r) => moved(r, i)).length));
  const worstSeen = (arm: string) => Math.max(0, ...controls.map((i) => cell(arm, i.id).length));
  const lines = renderScoreboard("P3 -- the person (F7: `warden`/`wear`/`sight` to count)", [
    { id: "1", text: "clause OFF: round 2 lands `warden`/`wear`/`sight` in at most 1 of 5", hits: cell("off", "G27-P2").filter(sightOnWarden).length, seen: cell("off", "G27-P2").length, total: N, bound: { atMost: 1 } },
    { id: "2", text: "clause ON: round 2 lands `warden`/`wear`/`sight` in at least 3 of 5", hits: cell("on", "G27-P2").filter(sightOnWarden).length, seen: cell("on", "G27-P2").length, total: N, bound: { atLeast: 3 } },
    { id: "3", text: "clause ON: controls move off their object in 0 of 20", hits: controlSamples("on").filter(({ r, i }) => moved(r, i)).length, seen: controlSamples("on").length, total: controls.length * N, bound: { atMost: 0 } },
    { id: "KILL-a", text: "clause ON: round 2 on `warden`/`wear`/`sight` in 1 or fewer of 5 kills (at least 2 survive)", hits: cell("on", "G27-P2").filter(sightOnWarden).length, seen: cell("on", "G27-P2").length, total: N, bound: { atLeast: 2 } },
    { id: "KILL-b", text: "clause ON: any one control moving in 2 or more of its 5 kills (worst control, at most 1)", hits: worstControl("on"), seen: worstSeen("on"), total: N, bound: { atMost: 1 } },
    { id: "r1", text: "clause OFF: controls moved -- reported", hits: controlSamples("off").filter(({ r, i }) => moved(r, i)).length, seen: controlSamples("off").length, total: controls.length * N, bound: "report" },
    { id: "r2", text: "clause OFF: round 2 on `warden` with any effect (F7's rewrite count) -- reported", hits: cell("off", "G27-P2").filter((r) => r.target === "warden").length, seen: cell("off", "G27-P2").length, total: N, bound: "report" },
    { id: "r3", text: "clause ON: round 2 on `warden` with any effect -- reported", hits: cell("on", "G27-P2").filter((r) => r.target === "warden").length, seen: cell("on", "G27-P2").length, total: N, bound: "report" },
  ]);
  lines.push("", "Per item and arm (target/effect/property, applicable in brackets):");
  for (const i of items) {
    for (const arm of ["off", "on"]) {
      const s = cell(arm, i.id);
      const tally = groupBy(s, (r) => `${r.target}/${r.effect}/${r.property}`);
      lines.push(`- ${i.id} [${arm}] ${s.length}/${N}: ${[...tally.entries()].map(([k, v]) => `${k} x${v.length} [${v.filter((r) => r.applicable).length}]`).join(", ") || "-"}${i.expect ? `  (expected ${JSON.stringify(i.expect)})` : ""}`);
    }
  }
  return lines;
}

if (isMain(import.meta.url)) {
  await runRefereeProbe({
    dir: DIR,
    name: "P3 person target",
    items: ITEMS,
    arms: [{ name: "off", overrides: { personInstrument: "off" } }, { name: "on", overrides: { personInstrument: "on" } }],
    n: N,
    argv: process.argv.slice(2),
    score,
    showQuestions: ["target", "property"],
    requireArms: (arms) => (arms.presence === "modelled" ? null : `presence resolves to "${arms.presence}"; a person is a target key only under "modelled" -- unset PRISONER_PRESENCE`),
  });
}
