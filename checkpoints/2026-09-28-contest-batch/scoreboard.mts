// P5's scoreboard (PLAYTEST-2026-09-27-DESIGN.md §6 P5, the owner's convention): so-far, projected at N=6, and
// DEAD/OPEN for every pre-committed prediction, a dead number announced at the poll it dies. Reads only the
// structural lines `src/open/checkpointTranscript.ts` writes -- the header's arm lines, the half-round heading, the
// acted-on referee table, the absent-half marker, the outcome block's `- <way>_passage: 0 -> 1` line and the
// `## Result` line -- through the probe kit's parser. Never an intent, a thought or a note (CLAUDE.md "never
// pattern-match meaning"): a "way out" is one of the scenario's exits by id, a block is the referee's `block` key.
//
//   npx tsx checkpoints/2026-09-28-contest-batch/scoreboard.mts [<batch dir>]
//   npx tsx checkpoints/2026-09-28-contest-batch/scoreboard.mts --dry-run    # scores the playtest transcript as a
//                                                                            # fixture, to show the parser works
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, args, parseRecordedText, renderScoreboard, forbidNetwork, REPO, PLAYTEST_2026_09_27, type Prediction, type RecordedHalf } from "../2026-09-28-probe-kit/kit.mts";
import { wardenAbsentOn, ABSENT_EVERY_N_ROUNDS } from "../../src/open/briefing.js";

const HERE = dirname(fileURLToPath(import.meta.url));
export const N = 6;
/** The scenario's ways out, by id (`world.ts`'s exits), and the part each is gated on. */
const WAYS_OUT = ["window", "door"];
const PARTS = ["bar", "lock"];

export interface Game {
  arm: "A" | "B";
  file: string;
  result: "escaped" | "caught" | "timeout" | "unfinished";
  revision: string | null;
  headerProblems: string[];
  halves: (RecordedHalf & { target: string | null; effect: string | null; absent: boolean; opened: string | null })[];
}

/** The header lines `src/checkpoint.ts` prints for this batch's arms (their opening words, which name the arm). */
export function expectedHeader(arm: "A" | "B"): string[] {
  return [
    arm === "A" ? "Block: ON" : "Block: OFF",
    "Absence: CADENCE",
    "Conditions: BOTH",
    "Door: STATED",
    "Door price: MARGIN",
    "Presence: MODELLED",
    "One act: FIRST",
    "Person instrument: OFF",
    "Rounds (max): 10.",
    "Seats: both minds are models",
  ];
}

export function parseGame(text: string, file: string, arm: "A" | "B"): Game {
  const lines = text.split("\n");
  const headerProblems = expectedHeader(arm).filter((want) => !lines.some((l) => l.startsWith(want))).map((want) => `header lacks "${want}"`);
  const revision = /^Code revision: `([0-9a-f]+)` \(clean\)/m.exec(text)?.[1] ?? null;
  if (!revision) headerProblems.push("header names no single clean revision");
  const result = /^\*\*The prisoner escaped, at round \d+\.\*\*/m.test(text)
    ? "escaped"
    : /^\*\*The warden caught the prisoner, at round \d+\.\*\*/m.test(text)
      ? "caught"
      : /^\*\*Timeout after \d+ rounds/m.test(text)
        ? "timeout"
        : "unfinished";
  const halves = parseRecordedText(text, file).halves.map((h) => ({
    ...h,
    target: h.rows.find((r) => r.question === "target")?.answer ?? null,
    effect: h.rows.find((r) => r.question === "effect")?.answer ?? null,
    absent: h.body.includes("SilenceReason: `absent (cadence)`"),
    opened: WAYS_OUT.find((w) => new RegExp(`^\\s*- ${w}_passage: 0 -> 1$`, "m").test(h.body)) ?? null,
  }));
  return { arm, file, result, revision, headerProblems, halves };
}

export function readBatch(dir: string): Game[] {
  const games: Game[] = [];
  for (const arm of ["A", "B"] as const) {
    const d = join(dir, arm);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith(".md")).sort()) games.push(parseGame(readFileSync(join(d, f), "utf8"), `${arm}/${f}`, arm));
  }
  return games;
}

const wardenHalves = (g: Game) => g.halves.filter((h) => h.chair === "warden");
const prisonerHalves = (g: Game) => g.halves.filter((h) => h.chair === "prisoner");
/** The round of the first absence (D5): round 4 -- asserted against the game's own `wardenAbsentOn`. */
const FIRST_ABSENCE = ABSENT_EVERY_N_ROUNDS;
if (!wardenAbsentOn(FIRST_ABSENCE) || wardenAbsentOn(FIRST_ABSENCE - 1)) throw new Error("scoreboard: the first absence is not round ABSENT_EVERY_N_ROUNDS any more");
/** The warden's half-round in the first absence round was the one the cadence skipped (the transcript says so). */
const absentAtFirst = (g: Game) => wardenHalves(g).some((w) => w.round === FIRST_ABSENCE && w.absent);

/** R4 in play: after a way out opens, the warden's next half-round that he plays examines THAT way out. */
export function examinedOpenWayNextTurn(g: Game): boolean {
  for (const opening of prisonerHalves(g).filter((h) => h.opened)) {
    const next = wardenHalves(g).find((w) => w.round > opening.round && !w.absent);
    if (next && next.target === opening.opened && next.effect === "reveal") return true;
  }
  return false;
}

function countGames(games: Game[], test: (g: Game) => boolean): number {
  return games.filter(test).length;
}

function differenceRow(a: Game[], b: Game[]): Prediction {
  const ea = countGames(a, (g) => g.result === "escaped");
  const eb = countGames(b, (g) => g.result === "escaped");
  const ra = N - a.length;
  const rb = N - b.length;
  const best = eb + rb - ea; // B's escapes as high and A's as low as the games to come allow
  const verdict = best < 1 ? "DEAD" : ra === 0 && rb === 0 ? "MET" : eb - (ea + ra) >= 1 ? "MET" : "OPEN";
  const projected = a.length && b.length ? `${Math.round((eb / b.length - ea / a.length) * N * 10) / 10}` : "-";
  return { id: "7", text: "escapes in arm B exceed arm A by at least 1 (if not, `block` changed nothing -- reported as such)", hits: 0, seen: 0, total: N, bound: { atLeast: 1 }, custom: { soFar: `B ${eb} of ${b.length} vs A ${ea} of ${a.length}`, projected, verdict } };
}

export function score(games: Game[], opts: { quarantine: boolean } = { quarantine: true }): string[] {
  const out: string[] = [];
  const bad = games.filter((g) => g.headerProblems.length > 0 || g.result === "unfinished");
  if (bad.length > 0) {
    out.push(opts.quarantine ? "QUARANTINED (PREDICTION.md stopping rule: a header that is not its arm, or an unfinished game):" : "Header mismatches (fixture mode: nothing quarantined):");
    for (const g of bad) out.push(`- ${g.file}: ${[...g.headerProblems, ...(g.result === "unfinished" ? ["no `## Result` line"] : [])].join("; ")}`);
    out.push("");
  }
  const kept = opts.quarantine ? games.filter((g) => !bad.includes(g)) : games;
  const revisions = [...new Set(kept.map((g) => g.revision).filter(Boolean))];
  if (revisions.length > 1) out.push(`**MORE THAN ONE REVISION: ${revisions.join(", ")} -- the batch was not pinned (CLAUDE.md).**`, "");
  const a = kept.filter((g) => g.arm === "A");
  const b = kept.filter((g) => g.arm === "B");
  const row = (id: string, text: string, games: Game[], test: (g: Game) => boolean, bound: Prediction["bound"]): Prediction => ({ id, text, hits: countGames(games, test), seen: games.length, total: N, bound });
  out.push(
    ...renderScoreboard(`P5 -- the contest batch (arm A ${a.length} of ${N}, arm B ${b.length} of ${N} games in)`, [
      row("1", "arm A: the prisoner escapes in 2 to 4 of 6", a, (g) => g.result === "escaped", { atLeast: 2, atMost: 4 }),
      row("2", "arm A: the warden catches in 2 to 4 of 6", a, (g) => g.result === "caught", { atLeast: 2, atMost: 4 }),
      row("3", "arm A: timeouts at most 2 of 6", a, (g) => g.result === "timeout", { atMost: 2 }),
      row("KILL-0", "arm A: 0 escapes kills (unwinnable, back to §2) -- at least 1 survives", a, (g) => g.result === "escaped", { atLeast: 1 }),
      row("KILL-6", "arm A: 6 escapes kills (the warden's tools are inert) -- at most 5 survive", a, (g) => g.result === "escaped", { atMost: 5 }),
      row("4", "arm A: the warden rules `block` in at least 4 of 6 games", a, (g) => wardenHalves(g).some((h) => h.effect === "block"), { atLeast: 4 }),
      row("KILL-block", "arm A: `block` in 1 or fewer games kills (R2) -- at least 2 survive", a, (g) => wardenHalves(g).some((h) => h.effect === "block"), { atLeast: 2 }),
      row("5", "arm A: the warden rules `restore` in at least 2 of 6 games", a, (g) => wardenHalves(g).some((h) => h.effect === "restore"), { atLeast: 2 }),
      row("6", "arm A: at least 4 of 6 games have the warden examine an open way out on his next turn after it opens (R4 in play)", a, examinedOpenWayNextTurn, { atLeast: 4 }),
      differenceRow(a, b),
      row("8", "arm A: games with a prisoner intent ruled against `warden` (0-1 of 6, no weight)", a, (g) => prisonerHalves(g).some((h) => h.target === "warden"), "report"),
      row("9", `arm A: the prisoner's act in the first absence (round ${FIRST_ABSENCE}) is on a way out (window or door) in at least 3 of 6`, a, (g) => absentAtFirst(g) && prisonerHalves(g).some((h) => h.round === FIRST_ABSENCE && WAYS_OUT.includes(h.target ?? "")), { atLeast: 3 }),
      row("r1", `arm A: ... on a way out or its part (bar, lock) -- reported`, a, (g) => absentAtFirst(g) && prisonerHalves(g).some((h) => h.round === FIRST_ABSENCE && [...WAYS_OUT, ...PARTS].includes(h.target ?? "")), "report"),
      row("r2", "arm A: games where the prisoner acts on the door or the lock at all (§50.7 predicts 0 for a model) -- reported", a, (g) => prisonerHalves(g).some((h) => ["door", "lock"].includes(h.target ?? "")), "report"),
      row("r3", "arm B: escapes -- reported beside 7", b, (g) => g.result === "escaped", "report"),
      row("r4", "arm B: catches -- reported", b, (g) => g.result === "caught", "report"),
    ])
  );
  out.push("", "Per game:");
  for (const g of games) {
    const w = wardenHalves(g);
    out.push(
      `- ${g.file} [${g.arm}] ${g.result}; warden block ${w.filter((h) => h.effect === "block").length}, restore ${w.filter((h) => h.effect === "restore").length}, absent halves ${w.filter((h) => h.absent).length}; openings ${prisonerHalves(g).filter((h) => h.opened).map((h) => `${h.opened}@r${h.round}`).join(",") || "none"}; revision ${g.revision ?? "?"}`
    );
  }
  return out;
}

if (isMain(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (a.has("dry-run")) {
    forbidNetwork();
    console.log("P5 scoreboard DRY RUN -- scoring the owner's playtest as a one-game fixture in arm A, to exercise the parser.");
    console.log("It is not a batch game (a person in a chair, presence off): its header mismatches are the expected ones.\n");
    const fixture = parseGame(readFileSync(join(REPO, PLAYTEST_2026_09_27), "utf8"), PLAYTEST_2026_09_27, "A");
    for (const line of score([fixture], { quarantine: false })) console.log(line);
  } else {
    const dir = process.argv.slice(2).find((x) => !x.startsWith("--")) ?? HERE;
    for (const line of score(readBatch(dir))) console.log(line);
  }
}
