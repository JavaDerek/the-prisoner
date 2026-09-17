// Can a prisoner who reads CONDITION 6 plan around it? (OPEN-VARIANT.md §44.)
//
// Condition 6 is the one written for the OTHER party: "If warden suspicion is at or above 40, and
// Warden Croft closely examines a way out, and Warden Croft finds it standing open, then Warden Croft
// catches Mara Voss and the game ends." She reads it every turn, marked `(for Warden Croft)`, from
// §34.1's fix for whose-condition-is-whose. It describes the one gap her own plan must cross: opening
// a way out is one act and leaving through it is another, so exactly one warden turn falls between.
//
// Reading only. It prints, per game, her own thoughts/intent/plan/notes on the turn she opens the way
// out and the turns either side of it -- her reasoning in her own words, never a code judgement about
// it -- plus the two numbers that decide whether her stated mitigation was available: whether she
// cites the condition at all, and the suspicion the game ended at, against the 40 the condition needs.
// Works on any arm's transcript; the header names the arm.
import { readFileSync } from "node:fs";

const SUSPICION_THRESHOLD = 40; // SEARCH_SUSPICION_THRESHOLD, the figure conditions 3-6 all open with

let games = 0;
let citing = 0;
let endedAboveThreshold = 0;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf-8");
  const arm = text.match(/Conditions: [A-Z]+/)?.[0] ?? "(no arm named)";
  const result = text.match(/## Result\n\n\*\*(.*?)\*\*/)?.[1] ?? "(no result)";
  const halves = text.split(/^### Round /m).slice(1);
  const prisoner = halves.filter((h) => h.split("\n")[0].includes("-- the prisoner"));
  // Her own words only: what SHE wrote, so the citation count is hers and not the briefing's.
  const hers = prisoner.map((h) => ["Thoughts", "Intent", "Plan", "Notes"].map((k) => h.match(new RegExp(`\\*\\*${k}:\\*\\* (.*)`))?.[1] ?? "").join(" ")).join(" ");
  // "Condition 6", and also the forms she actually writes: "Conditions 2 or 6", "conditions 3-6".
  const cites = /conditions?\s*(?:[0-9]+\s*(?:,|or|and|-|to)\s*)*6\b/i.test(hers);
  const finalSuspicion = Number([...text.matchAll(/^warden suspicion: (\d+)/gm)].at(-1)?.[1] ?? "0");
  games++;
  if (cites) citing++;
  if (finalSuspicion >= SUSPICION_THRESHOLD) endedAboveThreshold++;

  console.log(`\n== ${file.split("/").pop()}  ${arm}\n   ${result}`);
  console.log(`   cites condition 6 in her own words: ${cites ? "YES" : "no"}; ended at suspicion ${finalSuspicion} (conditions 3-6 need ${SUSPICION_THRESHOLD})`);
  const openedAt = prisoner.findIndex((h) => /_passage: 0 -> 1/.test(h) || /worked the bar free/.test(h));
  if (openedAt === -1) {
    console.log("   (no way out was opened)");
    continue;
  }
  for (const [label, h] of [
    ["the turn before opening", prisoner[openedAt - 1]],
    ["the opening turn", prisoner[openedAt]],
    ["the turn after, in the gap", prisoner[openedAt + 1]],
  ] as const) {
    if (!h) continue;
    console.log(`   -- ${label} (r${h.split("\n")[0].match(/^(\d+)/)?.[1]})`);
    for (const key of ["Thoughts", "Intent", "Plan", "Notes"]) {
      const v = h.match(new RegExp(`\\*\\*${key}:\\*\\* (.*)`))?.[1];
      if (v) console.log(`      ${key}: ${v}`);
    }
  }
}
console.log(`\n-- totals: ${games} games; ${citing} cite condition 6 unprompted; ${endedAboveThreshold} ended at or above suspicion ${SUSPICION_THRESHOLD}, the figure her stated mitigation was to stay below.`);
