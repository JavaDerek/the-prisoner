// Batch 7's scoreboard: every pre-committed prediction, with a PROJECTION column.
//
// EVERYTHING ABOVE THE OUTPUT SECTION IS BATCH 6's FILE, COPIED BYTE FOR BYTE, and that is the point.
// Band 5's baseline is b6's "prisoner refusals (= turns with no keys)" -- P 2 of 70, 2.9% -- which is a
// STRICTER population than "the referee refused this turn": a refusal that still named keys is keyed.
// Re-deriving that definition here by hand would have been a second opinion about what the baseline
// means, and the comparison is cross-batch, so the parser has to be the same parser.
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

const dir = process.argv[2] ?? "checkpoints/2026-09-25-phase1-b7";
const N = 7; // games, PREDICTION.md (arm T only)

interface Turn {
  round: number;
  chair: "warden" | "prisoner";
  intent: string;
  effect: string;
  target: string;
  property: string;
  novel: boolean;
  possible: boolean;
  /** A REFUSED turn prints no `-> effect target.property` suffix, so its keys
   *  are not in the transcript at all. It is still an intent the prisoner
   *  made, and prediction 7 is defined ON failed turns, so it must be counted
   *  -- but it cannot be matched by pair. See `keysKnown`. */
  keysKnown: boolean;
}

interface Game {
  file: string;
  arm: string;
  /** PREDICTION.md stopping rule 2: the header block `checkpoint.ts` prints when and only when the step
   *  ran. A game without it did not run arm T, whatever the driver's log says. */
  strategyOn: boolean;
  /** §3.4's declared ids, read from the header the game printed -- null when no block was printed. */
  strategyTargets: string[] | null;
  /** §3.5's logged trigger: the round revision WOULD have fired, under an arm where it never does. */
  revisionAt: string;
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
// A REFUSED turn, which prints the intent and NOTHING ELSE -- no effect, no
// target, no property. Checked across all ten of batch 4's transcripts: not one
// refused line carries a key. Matching only `RULED` silently dropped every
// refusal from the population, which understated prisoner intents by exactly
// the refusal count (batch 4 read 92 where the measures table says 95) and,
// worse, made prediction 7 unmeasurable -- the re-try rate is DEFINED on turns
// that failed, and the failed turns were the ones being discarded.
const REFUSED = /^- round (\d+), (warden|prisoner): (.*)$/;

function parseGame(file: string, text: string): Game {
  const arm = "T"; // one arm this batch; the header check is a stopping rule, applied below
  const turns: Turn[] = [];
  let section: "possible" | "impossible" | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("### Ruled possible")) { section = "possible"; continue; }
    if (line.startsWith("### Ruled impossible")) { section = "impossible"; continue; }
    if (line.startsWith("### Refusals") || line.startsWith("## ")) { section = null; continue; }
    if (section === null) continue;
    const m = RULED.exec(line);
    if (m) {
      turns.push({
        round: Number(m[1]),
        chair: m[2] as "warden" | "prisoner",
        intent: m[3],
        effect: m[4],
        target: m[5],
        property: m[6],
        novel: Boolean(m[8]),
        possible: section === "possible",
        keysKnown: true,
      });
      continue;
    }
    const r = section === "impossible" ? REFUSED.exec(line) : null;
    if (!r) continue;
    turns.push({
      round: Number(r[1]),
      chair: r[2] as "warden" | "prisoner",
      intent: r[3],
      effect: "?",
      target: "?",
      property: "?",
      novel: false,
      possible: false,
      keysKnown: false,
    });
  }
  const strategyOn = /^Strategy: ON \(`PRISONER_STRATEGY=/m.test(text);
  const targetsM = /^Chosen: \d+\. Declared targets: (.+)\.$/m.exec(text);
  const strategyTargets = targetsM ? targetsM[1]!.split(",").map((x) => x.trim()).filter((x) => x.length > 0) : null;
  const revisionAt = /^Revision would have fired: (.+)$/m.exec(text)?.[1] ?? "not logged";
  const num = (re: RegExp, d = 0) => { const m = re.exec(text); return m ? Number(m[1]) : d; };
  // Per-round wall times, summed: the transcript's own timing section, so a
  // game killed by the watchdog reports the minutes it actually ran.
  const ms = [...text.matchAll(/^- round \d+, (?:warden|prisoner): (\d+)ms$/gm)].reduce((a, m) => a + Number(m[1]), 0);
  return {
    file,
    arm,
    strategyOn,
    strategyTargets,
    revisionAt,
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
  for (const t of prisoner(g).filter((x) => x.keysKnown).sort((a, b) => a.round - b.round)) {
    const key = `${t.target}.${t.effect}`;
    if (seen.has(key) && seen.get(key) === false) n += 1;
    if (!seen.has(key) || seen.get(key) === false) seen.set(key, t.possible && t.property !== "none");
  }
  return n;
}

/** REPORTED, NOT PRE-COMMITTED. The owner's hypothesis has two halves --
 *  "repeating herself, re-trying what already failed" -- and `retries` above
 *  only measures the second. P game 1 showed why that is not enough: the
 *  prose seat worked the same bar with the same effect on rounds 3, 4, 5, 6
 *  and 7, which is repetition by any reading, and scored a re-try rate of 0.0%
 *  because every one of those turns was ruled possible and moved the bar. A
 *  productive repeat and a stuck one are different findings and the scoreboard
 *  should not collapse them, so both are printed. No band was pre-committed on
 *  this one and none is invented now; it is evidence for the memory question
 *  in RESULTS.md, not a prediction being scored. */
function repeats(g: Game) {
  const seen = new Set<string>();
  let n = 0;
  for (const t of prisoner(g).filter((x) => x.keysKnown).sort((a, b) => a.round - b.round)) {
    const key = `${t.target}.${t.effect}`;
    if (seen.has(key)) n += 1;
    seen.add(key);
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
function keyed(gs: Game[]) { return gs.flatMap(prisoner).filter((t) => t.keysKnown).length; }
function unkeyed(gs: Game[]) { return gs.flatMap(prisoner).filter((t) => !t.keysKnown).length; }
function distinctNovelPairs(gs: Game[], dropBlanket = false) {
  return distinct(novelRulings(gs).filter((t) => !dropBlanket || t.target !== "blanket").map((t) => `${t.target}.${t.effect}`));
}

const games: Game[] = [];
{
  const d = join(dir, "T");
  let files: string[] = [];
  try { files = readdirSync(d).filter((f) => f.endsWith(".md") && statSync(join(d, f)).isFile()).sort(); } catch { /* none yet */ }
  for (const f of files) games.push(parseGame(f, readFileSync(join(d, f), "utf8")));
}

/** PREDICTION.md stopping rule 2: a game whose header does not print `Strategy: ON` did not run arm T and
 *  is discarded. Checked here rather than trusted, because the driver's own log cannot prove what the
 *  process did -- the same reason batch 6 put the seat check in the transcript header. */
const T = games.filter((g) => g.strategyOn);
const discarded = games.filter((g) => !g.strategyOn);

const prisonerTurns = (gs: Game[]) => gs.flatMap(prisoner);
const pct = (n: number, d: number) => (d === 0 ? "--" : `${((n / d) * 100).toFixed(1)}%`);

/** §3.4's adherence, recomputed here from the SAME parse the rest of this file uses, so band 1 and band 5
 *  are counted over one population. Refused turns are in the denominator (§3.4). */
function adherence(g: Game) {
  const ids = g.strategyTargets;
  const turns = prisoner(g);
  const on = ids === null ? 0 : turns.filter((t) => t.keysKnown && ids.includes(t.target)).length;
  return { on, graded: turns.length, ids };
}

const L: string[] = [];
L.push(`# Batch 7 scoreboard -- ${new Date().toISOString()}`);
L.push("");
L.push(`Arm T (prose seat + \`PRISONER_STRATEGY=fixed\`): **${T.length} of ${N}** games.${discarded.length ? ` **${discarded.length} discarded** (no \`Strategy: ON\` header, stopping rule 2).` : ""}`);
L.push("");
L.push("## Per game");
L.push("");
L.push("| game | declared targets | condition-listed | derived an object | adherence | turns with no keys | final barIntegrity | minutes |");
L.push("|---|---|---|---|---|---|---|---|");
const COND = ["bar", "lock", "spoon", "door", "window"];
for (const g of T) {
  const a = adherence(g);
  const turns = prisoner(g);
  const derived = turns.some((t) => t.effect === "derive");
  const condListed = (a.ids ?? []).some((i: string) => COND.includes(i));
  L.push(
    `| \`${g.file.slice(0, 19)}\` | ${(a.ids ?? ["--"]).join(", ")} | ${condListed ? "yes" : "no"} | ${derived ? "yes" : "no"} | ` +
      `${a.on}/${a.graded} (${pct(a.on, a.graded)}) | ${turns.filter((t) => !t.keysKnown).length} | ${g.barIntegrity} | ${g.minutes} |`
  );
}
L.push("");
L.push("## Pre-committed bands");
L.push("");
L.push("| band | so far | projected at 7 | verdict |");
L.push("|---|---|---|---|");

const allTurns = prisonerTurns(T);
const onTotal = T.reduce((s, g) => s + adherence(g).on, 0);
const gradedTotal = allTurns.length;
const remainingTurns = (N - T.length) * 10;

// Band 1: at-least on a RATE. Dead when even a perfect run of the remaining turns cannot reach it.
const band1Need = 0.607;
const band1Max = gradedTotal + remainingTurns === 0 ? 0 : (onTotal + remainingTurns) / (gradedTotal + remainingTurns);
const band1Now = gradedTotal === 0 ? 0 : onTotal / gradedTotal;
L.push(
  `| **1 (primary)** adherence >= 60.7% | **${pct(onTotal, gradedTotal)}** (${onTotal} of ${gradedTotal}) | ${pct(onTotal, gradedTotal)} | ` +
    `${band1Max < band1Need ? "**DEAD**" : T.length === N ? (band1Now >= band1Need ? "held" : "**failed**") : "open"} |`
);

// Band 5: at-most on a RATE, over the batch's full 70 turns. Dead once the count exceeds the ceiling.
const noKeys = allTurns.filter((t) => !t.keysKnown).length;
const band5Ceiling = Math.floor(0.08 * N * 10); // 5 of 70
L.push(
  `| **5** refusals (turns with no keys) <= 8% | **${noKeys} of ${gradedTotal}** (${pct(noKeys, gradedTotal)}) | ${((noKeys / Math.max(1, T.length)) * N).toFixed(1)} of 70 | ` +
    `${noKeys > band5Ceiling ? "**DEAD**" : T.length === N ? "held" : `open (ceiling ${band5Ceiling}, ${band5Ceiling - noKeys} left)`} |`
);

// Band 2: distinct targets per game, the SCOREBOARD's pooled definition (PREDICTION.md says so explicitly).
const dtPerGame = T.length === 0 ? 0 : T.reduce((s, g) => s + distinct(prisoner(g).filter((t) => t.keysKnown).map((t) => t.target)), 0) / T.length;
L.push(`| **2** distinct targets/game in 2.0-3.5 | **${dtPerGame.toFixed(2)}** | ${dtPerGame.toFixed(2)} | ${T.length === N ? (dtPerGame >= 2 && dtPerGame <= 3.5 ? "held" : "**failed**") : "open"} |`);

// Band 3: depth, ONLY over games whose strategy named the bar. Denominator reported, never pooled.
const barGames = T.filter((g) => (g.strategyTargets ?? []).includes("bar"));
const deep = barGames.filter((g) => g.barIntegrity <= 84).length;
L.push(
  `| **3** >= 2 of 7 bar-strategy games end barIntegrity <= 84 | **${deep} of ${barGames.length}** games that named the bar | ${barGames.length === 0 ? "--" : ((deep / barGames.length) * N).toFixed(1)} | ` +
    `${barGames.length <= 1 ? `open (denominator ${barGames.length} -- unfalsifiable at this N if it stays here)` : deep >= 2 ? "held" : T.length === N ? "**failed**" : "open"} |`
);

// Band 4: RETIRED to a count (PREDICTION.md).
const wasted = T.filter((g) => !prisoner(g).some((t) => t.keysKnown && t.possible && COND.includes(t.target) && t.property !== "none")).length;
L.push(`| 4 wasted games (**retired, count only**) | ${wasted} of ${T.length} | -- | reported |`);

// Band 6: repeat rate -- any re-use of an (object, effect) pair within a game.
function repeatRate(gs: Game[]) {
  const ts = gs.flatMap((g) => prisoner(g).filter((t) => t.keysKnown).map((t) => `${g.file}|${t.target}.${t.effect}`));
  const seen = new Set<string>();
  let repeats = 0;
  for (const k of ts) { if (seen.has(k)) repeats++; else seen.add(k); }
  return ts.length === 0 ? 0 : (repeats / ts.length) * 100;
}
const rr = repeatRate(T);
L.push(`| **6** repeat rate < 41.4%, band <= 30% | **${rr.toFixed(1)}%** | ${rr.toFixed(1)}% | ${T.length === N ? (rr <= 30 ? "held" : "**failed**") : "open"} |`);

// Band 7: novel pairs, reported, no band.
L.push(`| 7 distinct novel (object, effect) pairs | ${distinctNovelPairs(T)} | -- | reported, no band |`);

// Band 8: strategy-call health.
const withStrategy = T.filter((g) => g.strategyTargets !== null).length;
L.push(`| **8** both calls succeed in >= 6 of 7 games | **${withStrategy} of ${T.length}** | ${T.length === 0 ? "--" : ((withStrategy / T.length) * N).toFixed(1)} | ${withStrategy + (N - T.length) < 6 ? "**DEAD**" : T.length === N ? (withStrategy >= 6 ? "held" : "**failed**") : "open"} |`);

// Band 9: wall clock.
const mins = T.map((g) => g.minutes).sort((a, b) => a - b);
const median = mins.length === 0 ? 0 : mins[Math.floor(mins.length / 2)]!;
L.push(`| **9** median game < 45 min, none > 90 | median **${median}**, max ${Math.max(0, ...mins)} | -- | ${median < 45 && Math.max(0, ...mins) <= 90 ? (T.length === N ? "held" : "open") : "**failed**"} |`);

L.push("");
L.push("Reported and NOT predicted on (the brief's rule, and b4's finding): escapes and catches.");
L.push(`Escapes: ${T.filter((g) => g.escaped).length} of ${T.length}.`);
L.push("");
L.push("Revision trigger (§3.5, logged under `fixed`, never acted on):");
for (const g of T) L.push(`- \`${g.file.slice(0, 19)}\`: ${g.revisionAt}`);

// eslint-disable-next-line no-console
console.log(L.join("\n"));
