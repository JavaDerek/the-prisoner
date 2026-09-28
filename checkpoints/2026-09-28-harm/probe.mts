// the-prisoner#1 -- the attack move: does `harm` on `condition` pull real human attack intents away from
// `wear`/`posture`, without pulling ordinary physical acts on the warden INTO `harm`? See PREDICTION.md.
// Scaffolding, 2026-09-28, NOT RUN. Coordinating session, under the owner's overnight delegation.
//
// Two arms, run in this order: `PRISONER_HARM=off` (the default, byte-identical to every batch before this
// issue) and `PRISONER_HARM=on`. Every request is built on its own context -- five real human attack intents
// rebuilt at today's defaults (presence `modelled`, so the warden is a target key) plus seven controls that
// must NOT become harm, none of them copied from a recorded request (§68.8: the wrong arm).
//
//   npx tsx checkpoints/2026-09-28-harm/probe.mts --dry-run
//   npx tsx checkpoints/2026-09-28-harm/probe.mts --live
//   npx tsx checkpoints/2026-09-28-harm/probe.mts --score
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, runRefereeProbe, corpusItems, renderScoreboard, groupBy, type Item } from "../2026-09-28-probe-kit/kit.mts";

const DIR = dirname(fileURLToPath(import.meta.url));
export const N = 3;

/**
 * the five real human attack intents `docs/ISSUE-1-DESIGN-BRIEF.md` §2 names, verbatim from
 * `checkpoints/2026-09-26-human-intents/corpus.json`: two different games, four phrasings. None carries a
 * source transcript this game can replay -- HB is the human-blind game, I25 is issue #25's abandoned game --
 * so each is rebuilt on a FRESH world (silent history), round as recorded.
 */
export const ATTACKS: Item[] = corpusItems(["HB-r1", "HB-r3", "HB-r10", "I25-3", "I25-5"], () => ({ group: "attack" }));

/** Controls that must NOT become harm: two real corpus rows (a self-directed collapse, a dig at the bar) and
 *  five synthetic ones for shapes the corpus does not contain, each on a fresh round-1 world. Every synthetic
 *  intent is this task's own words, chosen to be UNAMBIGUOUS about which existing effect it should keep landing
 *  on -- the whole point of a control is that its answer is already known. */
export const CONTROLS: Item[] = [
  ...corpusItems(["G1-r1"], () => ({ group: "control", expect: { target: "prisoner", effect: "wear", property: "posture" } })),
  ...corpusItems(["I25-7"], () => ({ group: "control", expect: { target: "bar", effect: "wear", property: "integrity" } })),
  { id: "C-push-down", transcript: null, chair: "prisoner", round: 1, intent: "push the warden down", group: "control", expect: { target: "warden", effect: "wear", property: "posture" } },
  { id: "C-cover-head", transcript: null, chair: "prisoner", round: 1, intent: "pull the blanket over the warden's head so he can't see", group: "control", expect: { target: "warden", effect: "wear", property: "sight" } },
  { id: "C-take-keys", transcript: null, chair: "prisoner", round: 1, intent: "take the key ring off the warden's belt", group: "control", expect: { target: "key_ring", effect: "take" } },
  { id: "C-search", transcript: null, chair: "prisoner", round: 1, intent: "search the warden, pat him down", group: "control", expect: { target: "warden", effect: "expose" } },
  { id: "C-examine", transcript: null, chair: "prisoner", round: 1, intent: "examine the warden closely, looking for a way to get past him", group: "control", expect: { target: "warden", effect: "reveal" } },
  { id: "C-call-out", transcript: null, chair: "prisoner", round: 1, intent: "call out to the warden, ask him for water", group: "control", expect: { target: "warden", effect: "noise" } },
];

export const ITEMS: Item[] = [...ATTACKS, ...CONTROLS];

const landedHarm = (r: any) => r.target === "warden" && r.effect === "harm" && r.property === "condition";

/** The most common `target/effect` pair among a control's samples in one arm -- categorical, so "changed" is
 *  string inequality between arms, never a boolean test. `null` with no samples yet. */
function modeKey(samples: readonly any[]): string | null {
  if (samples.length === 0) return null;
  const tally = groupBy(samples, (r: any) => `${r.target}/${r.effect}`);
  return [...tally.entries()].sort((a, b) => b[1].length - a[1].length)[0][0];
}

export function score(rows: any[], items: Item[]): string[] {
  const ok = rows.filter((r) => !r.error);
  const cell = (arm: string, id: string) => ok.filter((r) => r.arm === arm && r.item === id);
  const attacks = items.filter((i) => i.group === "attack");
  const controls = items.filter((i) => i.group === "control");

  const attackLandedItems = attacks.filter((i) => {
    const s = cell("on", i.id);
    return s.length >= N && s.filter(landedHarm).length * 2 > s.length; // majority of N
  });
  const attacksSeen = attacks.filter((i) => cell("on", i.id).length >= N).length;

  const changedControls = controls.filter((i) => {
    const off = modeKey(cell("off", i.id));
    const on = modeKey(cell("on", i.id));
    return off !== null && on !== null && off !== on;
  });
  const controlsSeen = controls.filter((i) => cell("off", i.id).length >= N && cell("on", i.id).length >= N).length;

  const lines = renderScoreboard("the attack move -- harm vs. the ordinary vocabulary (the-prisoner#1)", [
    { id: "1", text: "arm ON: at least 4 of 5 real attack intents rule warden/harm/condition (majority of N)", hits: attackLandedItems.length, seen: attacksSeen, total: attacks.length, bound: { atLeast: 4 } },
    { id: "2", text: "at most 1 of 8 controls changes its target/effect between arms (majority of N each)", hits: changedControls.length, seen: controlsSeen, total: controls.length, bound: { atMost: 1 } },
    { id: "KILL-a", text: "arm ON: 2 or fewer of 5 attacks land warden/harm/condition kills (harm fails to separate itself)", hits: attackLandedItems.length, seen: attacksSeen, total: attacks.length, bound: { atLeast: 3 } },
    { id: "KILL-b", text: "2 or more of 8 controls change between arms kills (harm captures ordinary acts)", hits: changedControls.length, seen: controlsSeen, total: controls.length, bound: { atMost: 1 } },
    { id: "r1", text: "arm OFF: how the same 5 attacks rule today (wear/posture per HUMAN-INTENTS-DESIGN.md §6.1, reported)", hits: attacks.filter((i) => { const s = cell("off", i.id); return s.length >= N && s.filter((r) => r.target === "warden" && r.effect === "wear" && r.property === "posture").length * 2 > s.length; }).length, seen: attacks.filter((i) => cell("off", i.id).length >= N).length, total: attacks.length, bound: "report" },
  ]);
  lines.push("", "Per item and arm (target/effect/property, applicable in brackets, N samples):");
  for (const i of items) {
    for (const arm of ["off", "on"]) {
      const s = cell(arm, i.id);
      const tally = groupBy(s, (r) => `${r.target}/${r.effect}/${r.property}`);
      lines.push(`- ${i.id} [${arm}] ${s.length}/${N}: ${[...tally.entries()].map(([k, v]) => `${k} x${v.length} [${v.filter((r) => r.applicable).length}]`).join(", ") || "-"}${i.expect ? `  (expected to stay ${JSON.stringify(i.expect)})` : ""}`);
    }
  }
  return lines;
}

if (isMain(import.meta.url)) {
  await runRefereeProbe({
    dir: DIR,
    name: "the attack move (the-prisoner#1)",
    items: ITEMS,
    arms: [{ name: "off", overrides: { harm: "off" } }, { name: "on", overrides: { harm: "on" } }],
    n: N,
    argv: process.argv.slice(2),
    score,
    showQuestions: ["target", "effect", "property"],
    requireArms: (arms) => (arms.presence === "modelled" ? null : `presence resolves to "${arms.presence}"; a person is a target key only under "modelled" -- unset PRISONER_PRESENCE`),
  });
}
