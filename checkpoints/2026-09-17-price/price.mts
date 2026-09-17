// §42's measure: on turns where NOTHING is forcing her, does she choose an approach the warden has
// already seen -- and does pricing that approach by its own staleness change the answer?
//
// mother-of-invention#2's bar is free-turn behaviour, so this batch runs with pick OFF: every prisoner
// turn is her own choice. The question is not whether she escapes (§41.4: the obvious approach wins),
// it is what she reaches for when the obvious approach is expensive and she has been told the price.
//
// Reading only, and it classifies by the transcript's own records rather than by reading intents:
//   * the approach she actually took is the sentence the WARDEN perceived ("Mara Voss works at the
//     bar."), rendered role-neutral the way the ledger records it ("A prisoner works at the bar.") --
//     this is `precedentTextFor`'s own output, printed in the transcript as "Other perceives";
//   * whether that approach was known, and what it cost, comes from the precedent block the transcript
//     prints in its own header, which is what the minds were actually shown.
// An act the warden could not perceive is no approach it recognises (§14.4), so it is charged nothing
// and counted as unseen here, exactly as the loop treats it.
import { readFileSync } from "node:fs";

const KNOWN_APPROACH_SUSPICION_BUMP = 30; // loop.ts's constant, and `flat`'s price for anything known
const RESOURCE_MAX = 100; // the bound `stalenessBump` caps at

type Game = { file: string; arm: string; result: string; turns: { round: string; approach: string | null; known: boolean; price: number; intent: string }[] };

function parse(file: string): Game {
  const text = readFileSync(file, "utf-8");
  const arm = text.match(/Precedent price: ([A-Z]+)/)?.[1] ?? "(none named)";
  const result = text.match(/## Result\n\n\*\*(.*?)\*\*/)?.[1] ?? "(no result)";
  // The precedent block the minds were shown, from the transcript's own header.
  const episodesOf = new Map<string, number>();
  for (const m of text.matchAll(/^- (.+?) \(times (\d+), episodes (\d+), last .+\)$/gm)) episodesOf.set(m[1], Number(m[3]));

  const turns: Game["turns"] = [];
  for (const h of text.split(/^### Round /m).slice(1)) {
    const head = h.split("\n")[0];
    if (!head.includes("-- the prisoner")) continue;
    const perceived = h.match(/\*\*Other perceives:\*\* (.*)/)?.[1] ?? null;
    // The perception line can carry the voice line after it ("Mara Voss works at the bar. Voss says:
    // ..."), and only the first sentence is what `describeAttempt` wrote, so take that alone. Then
    // role-neutral, as the ledger records it: the actor's name becomes "A prisoner".
    const sentence = perceived?.match(/^(.*?\.)(?:\s|$)/)?.[1] ?? perceived;
    const approach = sentence && !/could not|nothing/i.test(sentence) ? sentence.replace(/^[A-Z][a-z]+ [A-Z][a-z]+/, "A prisoner") : null;
    const episodes = approach ? episodesOf.get(approach) : undefined;
    turns.push({
      round: head.match(/^(\d+)/)?.[1] ?? "?",
      approach,
      known: episodes !== undefined,
      price: episodes === undefined ? 0 : arm === "STALE" ? Math.min(KNOWN_APPROACH_SUSPICION_BUMP * episodes, RESOURCE_MAX) : KNOWN_APPROACH_SUSPICION_BUMP,
      intent: h.match(/\*\*Intent:\*\* (.*)/)?.[1] ?? "(silent)",
    });
  }
  return { file: file.split("/").pop() ?? file, arm, result, turns };
}

const byArm = new Map<string, { games: number; turns: number; known: number; firstKnown: number; charged: number }>();
for (const file of process.argv.slice(2)) {
  const g = parse(file);
  console.log(`\n== ${g.file}  price ${g.arm}\n   ${g.result}`);
  for (const t of g.turns) {
    const tag = t.approach === null ? "unperceived" : t.known ? `KNOWN, cost ${t.price}` : "unseen";
    console.log(`   r${t.round.padStart(2)} [${tag}] ${t.intent}`);
    if (t.approach && t.known) console.log(`        as: ${t.approach}`);
  }
  const stats = byArm.get(g.arm) ?? { games: 0, turns: 0, known: 0, firstKnown: 0, charged: 0 };
  stats.games++;
  stats.turns += g.turns.length;
  stats.known += g.turns.filter((t) => t.known).length;
  if (g.turns[0]?.known) stats.firstKnown++;
  stats.charged += g.turns.reduce((sum, t) => sum + t.price, 0);
  byArm.set(g.arm, stats);
}

console.log("\n-- free turns spent on an approach the warden has already seen");
for (const [arm, s] of byArm) {
  console.log(
    `   ${arm}: ${s.games} games, ${s.turns} prisoner turns, ${s.known} on a known approach (${Math.round((100 * s.known) / s.turns)}%), ` +
      `round 1 on a known approach in ${s.firstKnown}/${s.games}, total suspicion charged for precedent ${s.charged}`
  );
}
