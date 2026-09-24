// Batch 6's scoreboard: every pre-committed prediction, with a PROJECTION column.
//
//   npx tsx checkpoints/2026-09-24-phase1-b6/scoreboard.mts <batch dir>
//
// WHY A PROJECTION COLUMN (the owner, 2026-09-22): a running batch reported as
// "3 of 4 so far" tells a reader nothing about whether the prediction survives.
// Beside it goes the linear extrapolation to N=10 and a DEAD/OPEN verdict, so
// a prediction that can no longer be reached from the games remaining is
// announced AT THAT POLL rather than discovered in the results file (the
// owner, 2026-09-21).
//
// DEAD is arithmetic, not judgement. A prediction with a ceiling (`at most k`)
// dies when the count so far already exceeds k -- no remaining game can lower
// it. A prediction with a floor (`at least k`) dies when the count so far plus
// every game still to play cannot reach k. Nothing else is called dead.
//
// It reads the same transcripts `npm run measures` reads and computes nothing
// the transcripts do not already say, except the four things §5.2 has no line
// for: intents at the 600-character cap, blanket targets, the re-try rate and
// final barIntegrity. Those four are the only bespoke code here, and each one
// names the prediction it serves.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "checkpoints/2026-09-24-phase1-b6";
const N = 10; // games per arm, PREDICTION.md

interface Turn {
  round: number;
  chair: "warden" | "prisoner";
  intent: string;
  effect: string;
  target: string;
  property: string;
  novel: boolean;
  possible: boolean;
}

interface Game {
  file: string;
  arm: "P" | "S";
  turns: Turn[];
  intents: number;
  silences: number;
  grounded: number;
  refusals: number;
  novelPairs: number;
  resolutionRefusals: number;
  barIntegrity: number;
  escaped: boolean;
  caught: boolean;
  minutes: number;
}

// `- round 3, prisoner: <intent> -> restore spoon.edge (slight, audible) **(novel)**; grounding ...`
const RULED = /^- round (\d+), (warden|prisoner): (.*?) -> (\S+) (\S+?)\.(\S+) \(([^)]*)\)( \*\*\(novel\)\*\*)?(;|$)/;

function parseGame(file: string, text: string): Game {
  const arm: "P" | "S" = text.includes("PROSE SEAT (`PRISONER_PROSE_SEAT=prisoner`)") ? "P" : "S";
  const turns: Turn[] = [];
  let section: "possible" | "impossible" | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("### Ruled possible")) { section = "possible"; continue; }
    if (line.startsWith("### Ruled impossible")) { section = "impossible"; continue; }
    if (line.startsWith("### Refusals") || line.startsWith("## ")) { section = null; continue; }
    if (section === null) continue;
    const m = RULED.exec(line);
    if (!m) continue;
    turns.push({
      round: Number(m[1]),
      chair: m[2] as "warden" | "prisoner",
      intent: m[3],
      effect: m[4],
      target: m[5],
      property: m[6],
      novel: Boolean(m[8]),
      possible: section === "possible",
    });
  }
  const num = (re: RegExp, d = 0) => { const m = re.exec(text); return m ? Number(m[1]) : d; };
  // Per-round wall times, summed: the transcript's own timing section, so a
  // game killed by the watchdog reports the minutes it actually ran.
  const ms = [...text.matchAll(/^- round \d+, (?:warden|prisoner): (\d+)ms$/gm)].reduce((a, m) => a + Number(m[1]), 0);
  return {
    file,
    arm,
    turns,
    intents: num(/Total intents: (\d+)\./),
    silences: num(/Total intents: \d+\. Silences: (\d+)\./),
    grounded: num(/Grounded \(ruled possible\): (\d+)\./),
    // THE REFUSAL COUNT IS `Ruled impossible`, NOT the line that says
    // "Refusals". Checked against batch 4, whose RESULTS report 5 refusals in
    // 192 rulings: summing `Ruled impossible` over its ten transcripts gives
    // exactly 5, while summing its `Refusals:` line gives 0. That line counts
    // RESOLUTION refusals -- the engine declining a change the referee already
    // grounded -- which is a different event and was zero all batch.
    refusals: num(/Grounded \(ruled possible\): \d+\. Ruled impossible: (\d+)\./),
    resolutionRefusals: num(/Resolutions: \d+\. Refusals: (\d+)\./),
    novelPairs: num(/Novel \(object, effect\) pairs with no closed-variant equivalent: (\d+)\./),
    barIntegrity: num(/^- barIntegrity: (\d+)$/m, 100),
    escaped: /\*\*(Escaped|The prisoner escapes)/i.test(text) || /Result[\s\S]{0,120}escape/i.test(text),
    caught: /Result[\s\S]{0,120}caught/i.test(text),
    minutes: Math.round(ms / 60000),
  };
}

function prisoner(g: Game) { return g.turns.filter((t) => t.chair === "prisoner"); }

/** Prediction 2: `coerceProposal` hard-slices at exactly 600 characters. */
function capped(g: Game) { return prisoner(g).filter((t) => t.intent.length >= 600).length; }

/** Prediction 6b: the GOOD exemplar names the blanket and arm S never sees it. */
function blanketTurns(g: Game) { return prisoner(g).filter((t) => t.target === "blanket").length; }

/** Prediction 7: a (target, effect) pair re-tried in a LATER round of the same
 *  game after an earlier attempt was ruled impossible or moved no property. */
function retries(g: Game) {
  const seen = new Map<string, boolean>(); // pair -> did it ever work
  let n = 0;
  for (const t of prisoner(g).sort((a, b) => a.round - b.round)) {
    const key = `${t.target}.${t.effect}`;
    if (seen.has(key) && seen.get(key) === false) n += 1;
    if (!seen.has(key) || seen.get(key) === false) seen.set(key, t.possible && t.property !== "none");
  }
  return n;
}

function distinct<T>(xs: T[]) { return new Set(xs).size; }

/** TWO DIFFERENT NUMBERS, and PREDICTION.md 6a means the second.
 *
 *  The transcript's own `Novel (object, effect) pairs...` line counts novel
 *  RULINGS -- one game scored 6 because six of its twenty turns carried a
 *  `**(novel)**` tag, several of them the same pair on consecutive rounds.
 *  Prediction 6a says "distinct novel pairs pooled", which is the set, not the
 *  count: a seat that opens the same door on eight rounds reached once.
 *  Batch 4 pooled 68 novel rulings and far fewer distinct pairs, so reporting
 *  one as the other would inflate every arm by roughly an order of magnitude.
 *  Both are printed; 6a is scored on `distinctNovelPairs`. */
function novelRulings(gs: Game[]) { return gs.flatMap(prisoner).filter((t) => t.novel); }
function distinctNovelPairs(gs: Game[], dropBlanket = false) {
  return distinct(novelRulings(gs).filter((t) => !dropBlanket || t.target !== "blanket").map((t) => `${t.target}.${t.effect}`));
}

const games: Game[] = [];
for (const armDir of ["P", "S"]) {
  const d = join(dir, armDir);
  let files: string[] = [];
  try { files = readdirSync(d).filter((f) => f.endsWith(".md") && statSync(join(d, f)).isFile()); } catch { continue; }
  for (const f of files) games.push(parseGame(f, readFileSync(join(d, f), "utf8")));
}

const P = games.filter((g) => g.arm === "P");
const S = games.filter((g) => g.arm === "S");

/** so-far / projected-at-N / verdict, for a count that accumulates over games. */
function row(label: string, arm: Game[], count: number, bound: { at_most?: number; at_least?: number }, unit = "", setValued = false) {
  const done = arm.length;
  // A DISTINCT-PAIR COUNT IS A SET AND DOES NOT EXTRAPOLATE. Doubling the
  // games does not double the pairs -- the set saturates as the arm revisits
  // ground it has already covered -- so a linear projection on it would be
  // straightforwardly wrong and would read as confident. Those rows print no
  // projection at all rather than a number a reader might believe.
  const projected = done === 0 || setValued ? NaN : (count / done) * N;
  let verdict = "open";
  if (bound.at_most !== undefined) {
    if (count > bound.at_most) verdict = "**DEAD**";
    else if (done === N) verdict = "held";
  }
  if (bound.at_least !== undefined) {
    const remaining = N - done;
    if (count + remaining * perGameCeiling(label) < bound.at_least) verdict = "**DEAD**";
    else if (count >= bound.at_least) verdict = "held";
  }
  const proj = Number.isNaN(projected) ? "--" : projected.toFixed(1);
  return `| ${label} | ${count}${unit} of ${done} games | ${proj} | ${verdict} |`;
}

/** The most a single further game could add to a count -- used only to decide
 *  whether an `at least` prediction is already unreachable. Deliberately
 *  generous: a prediction is called dead only when NO remaining game could
 *  save it. */
function perGameCeiling(label: string) {
  if (label.includes("games")) return 1; // a per-game yes/no
  return 10; // a per-intent count: at most ten prisoner turns a game
}

const L: string[] = [];
L.push(`# Batch 6 scoreboard -- ${new Date().toISOString()}`);
L.push("");
L.push(`Arm P (prose seat): **${P.length} of ${N}** games. Arm S (schema seat): **${S.length} of ${N}**.`);
L.push("");
L.push("## Per arm, so far");
L.push("");
L.push("| | arm P (prose) | arm S (schema) |");
L.push("|---|---|---|");
const pair = (f: (a: Game[]) => string) => `| ${f(P)} | ${f(S)} |`;
const mean = (a: Game[], f: (g: Game) => number) => (a.length === 0 ? "--" : (a.reduce((s, g) => s + f(g), 0) / a.length).toFixed(2));
const sum = (a: Game[], f: (g: Game) => number) => a.reduce((s, g) => s + f(g), 0);
L.push(`| games | ${P.length} | ${S.length} |`);
L.push(`| prisoner intents | ${sum(P, (g) => prisoner(g).length)} | ${sum(S, (g) => prisoner(g).length)} |`);
L.push(`| prisoner silences | ${sum(P, (g) => g.silences)} | ${sum(S, (g) => g.silences)} |`);
L.push(`| grounded (pooled) | ${sum(P, (g) => g.grounded)} | ${sum(S, (g) => g.grounded)} |`);
L.push(`| refusals (ruled impossible) | ${sum(P, (g) => g.refusals)} | ${sum(S, (g) => g.refusals)} |`);
L.push(`| novel RULINGS (the transcript's own line) | ${sum(P, (g) => g.novelPairs)} | ${sum(S, (g) => g.novelPairs)} |`);
L.push(`| **distinct novel PAIRS (pooled) -- 6a** | ${distinctNovelPairs(P)} | ${distinctNovelPairs(S)} |`);
L.push(`| **distinct novel pairs, blanket dropped -- 6b** | ${distinctNovelPairs(P, true)} | ${distinctNovelPairs(S, true)} |`);
L.push(`| blanket-targeted turns | ${sum(P, blanketTurns)} | ${sum(S, blanketTurns)} |`);
L.push(`| games targeting blanket | ${P.filter((g) => blanketTurns(g) > 0).length} | ${S.filter((g) => blanketTurns(g) > 0).length} |`);
L.push(`| intents at the 600-char cap | ${sum(P, capped)} | ${sum(S, capped)} |`);
L.push(`| distinct effect kinds (pooled) | ${distinct(P.flatMap((g) => prisoner(g).map((t) => t.effect)))} | ${distinct(S.flatMap((g) => prisoner(g).map((t) => t.effect)))} |`);
L.push(`| distinct targets / game (mean) | ${mean(P, (g) => distinct(prisoner(g).map((t) => t.target)))} | ${mean(S, (g) => distinct(prisoner(g).map((t) => t.target)))} |`);
L.push(`| **final barIntegrity (mean)** | ${mean(P, (g) => g.barIntegrity)} | ${mean(S, (g) => g.barIntegrity)} |`);
L.push(`| **games with bar damaged (<100)** | ${P.filter((g) => g.barIntegrity < 100).length} | ${S.filter((g) => g.barIntegrity < 100).length} |`);
L.push(`| re-try rate | ${P.length ? (sum(P, retries) / Math.max(1, sum(P, (g) => prisoner(g).length)) * 100).toFixed(1) + "%" : "--"} | ${S.length ? (sum(S, retries) / Math.max(1, sum(S, (g) => prisoner(g).length)) * 100).toFixed(1) + "%" : "--"} |`);
L.push(`| median game minutes | ${P.length ? [...P.map((g) => g.minutes)].sort((a, b) => a - b)[Math.floor(P.length / 2)] : "--"} | ${S.length ? [...S.map((g) => g.minutes)].sort((a, b) => a - b)[Math.floor(S.length / 2)] : "--"} |`);
L.push("");
L.push("Reported and NOT predicted on (batch 4: they cannot separate arms at N=10):");
L.push(`escapes P ${P.filter((g) => g.escaped).length} / S ${S.filter((g) => g.escaped).length}; catches P ${P.filter((g) => g.caught).length} / S ${S.filter((g) => g.caught).length}.`);
L.push("");
L.push("## Pre-committed predictions");
L.push("");
L.push("| prediction | so far | projected at 10 | verdict |");
L.push("|---|---|---|---|");
L.push(row("1. P silences at most 8 of ~100", P, sum(P, (g) => g.silences), { at_most: 8 }));
L.push(row("1. S silences at most 3 of ~100", S, sum(S, (g) => g.silences), { at_most: 3 }));
L.push(row("2. P intents at cap, 1 to 25", P, sum(P, capped), { at_most: 25 }));
L.push(row("2. S intents at cap = 0", S, sum(S, capped), { at_most: 0 }));
L.push(row("5. P games with bar damaged, at least 4", P, P.filter((g) => g.barIntegrity < 100).length, { at_least: 4 }));
L.push(row("5. S games with bar damaged, at most 2", S, S.filter((g) => g.barIntegrity < 100).length, { at_most: 2 }));
L.push(row("6a. P distinct novel pairs at least 6", P, distinctNovelPairs(P), { at_least: 6 }, "", true));
L.push(row("6a. S distinct novel pairs at most 5", S, distinctNovelPairs(S), { at_most: 5 }, "", true));
L.push(row("6b. P games targeting blanket, at least 3", P, P.filter((g) => blanketTurns(g) > 0).length, { at_least: 3 }));
L.push(row("6b. S games targeting blanket, at most 1", S, S.filter((g) => blanketTurns(g) > 0).length, { at_most: 1 }));
L.push(row("9. new unbuilt classes at most 3 (pooled)", [...P, ...S], 0, { at_most: 3 }));
L.push("");
L.push("Predictions 3, 4, 7, 8 and 10 are ratios or bands over the finished arms and are read from the");
L.push("per-arm table above; they are scored in RESULTS.md, not called dead mid-batch.");
L.push("");
L.push("Prediction 5 power note, pre-committed: at 4-vs-0 this is suggestive, NOT significant.");
L.push("Only a split of 5 or more against 0 is a result at this N (Fisher exact, 5v0 -> p~0.033).");
process.stdout.write(L.join("\n") + "\n");
