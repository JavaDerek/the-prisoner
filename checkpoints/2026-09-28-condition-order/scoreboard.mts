// the-prisoner#23's scoreboard: does the ORDER of the prisoner's condition list decide her route? Reads only the
// structural lines `src/open/checkpointTranscript.ts` writes -- the half-round heading and the acted-on referee
// table's `target` row -- through the probe kit's parser (`parseRecordedText`, borrowed read-only from
// `../2026-09-28-probe-kit/kit.mts`; nothing here depends on that kit's `GameArms`, which predates this arm).
// Never an intent, a thought or a note is classified by code (CLAUDE.md "never pattern-match meaning"): a route
// is one of the scenario's ids, read from the referee's own closed `target` key, never from English.
//
// The three measures PREDICTION.md asks for, per game:
//   1. the round of the prisoner's FIRST ruling targeting the door route (door/lock/key_ring, D15) vs the
//      window route (window/bar) -- whichever comes first, and whether the other route is ever reached at all
//   2. the count of her rulings on each route
//   3. her round-1 plan, printed VERBATIM for a human to read -- never classified in code (the issue's own
//      constraint: "score the plan" here means "show the plan", because a plan's route is a judgement about
//      prose, not a lookup in a closed key)
//
//   npx tsx checkpoints/2026-09-28-condition-order/scoreboard.mts [<batch dir>]
//   npx tsx checkpoints/2026-09-28-condition-order/scoreboard.mts --dry-run    # scores an existing transcript as
//                                                                              # a parser fixture, to show it works
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, args, parseRecordedText, REPO, type RecordedHalf } from "../2026-09-28-probe-kit/kit.mts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** D15 (2026-09-27): a held key ring also opens the door, so it is a third door route (PREDICTION.md says so
 *  explicitly, per the task). */
const DOOR_ROUTE = ["door", "lock", "key_ring"];
const WINDOW_ROUTE = ["window", "bar"];

export type Route = "door" | "window" | "other";
export function routeOf(target: string | null): Route {
  if (target === null) return "other";
  if (DOOR_ROUTE.includes(target)) return "door";
  if (WINDOW_ROUTE.includes(target)) return "window";
  return "other";
}

export interface Game {
  arm: "A" | "B";
  file: string;
  revision: string | null;
  headerProblems: string[];
  order: "window-first" | "door-first" | null;
  prisonerHalves: (RecordedHalf & { target: string | null; route: Route })[];
  round1Plan: string | null;
}

/** The header lines `src/checkpoint.ts` prints for this batch's arms (their opening words, which name the arm). */
export function expectedHeader(arm: "A" | "B"): string[] {
  return [
    "Presence: MODELLED",
    "Absence: CADENCE",
    "Conditions: BOTH",
    "Door: STATED",
    "Door price: MARGIN",
    "Block: ON",
    "One act: FIRST",
    "Person instrument: OFF",
    arm === "A" ? "Condition order: WINDOW-FIRST" : "Condition order: DOOR-FIRST",
    "Rounds (max): 10.",
  ];
}

export function parseGame(text: string, file: string, arm: "A" | "B"): Game {
  const lines = text.split("\n");
  const headerProblems = expectedHeader(arm)
    .filter((want) => !lines.some((l) => l.startsWith(want)))
    .map((want) => `header lacks "${want}"`);
  const revision = /^Code revision: `([0-9a-f]+)` \(clean\)/m.exec(text)?.[1] ?? null;
  if (!revision) headerProblems.push("header names no single clean revision");
  const order = /^Condition order: WINDOW-FIRST/m.test(text) ? "window-first" : /^Condition order: DOOR-FIRST/m.test(text) ? "door-first" : null;
  const halves = parseRecordedText(text, file).halves;
  const prisonerHalves = halves
    .filter((h) => h.chair === "prisoner")
    .map((h) => {
      const target = h.rows.find((r) => r.question === "target")?.answer ?? null;
      return { ...h, target, route: routeOf(target) };
    });
  const round1Plan = prisonerHalves.find((h) => h.round === 1)?.plan ?? null;
  return { arm, file, revision, headerProblems, order, prisonerHalves, round1Plan };
}

export function readBatch(dir: string): Game[] {
  const games: Game[] = [];
  for (const arm of ["A", "B"] as const) {
    const d = join(dir, arm);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)
      .filter((x) => x.endsWith(".md"))
      .sort())
      games.push(parseGame(readFileSync(join(d, f), "utf8"), `${arm}/${f}`, arm));
  }
  return games;
}

/** The round of the game's first ruling on EACH route (null if that route is never ruled against), so a reader
 *  can see directly which one she reached first -- the issue's own question. */
export function firstRulingRounds(g: Game): { door: number | null; window: number | null } {
  const firstOf = (route: Route) => g.prisonerHalves.find((h) => h.route === route)?.round ?? null;
  return { door: firstOf("door"), window: firstOf("window") };
}

export function routeCounts(g: Game): { door: number; window: number; other: number } {
  return {
    door: g.prisonerHalves.filter((h) => h.route === "door").length,
    window: g.prisonerHalves.filter((h) => h.route === "window").length,
    other: g.prisonerHalves.filter((h) => h.route === "other").length,
  };
}

export function score(games: Game[]): string[] {
  const out: string[] = [];
  const bad = games.filter((g) => g.headerProblems.length > 0);
  if (bad.length > 0) {
    out.push("HEADER MISMATCH (not the arm this batch's PREDICTION.md names -- reported, not scored with the rest):");
    for (const g of bad) out.push(`- ${g.file}: ${g.headerProblems.join("; ")}`);
    out.push("");
  }
  const revisions = [...new Set(games.map((g) => g.revision).filter(Boolean))];
  if (revisions.length > 1) out.push(`**MORE THAN ONE REVISION: ${revisions.join(", ")} -- the batch was not pinned (CLAUDE.md).**`, "");

  const byArm = (arm: "A" | "B") => games.filter((g) => g.arm === arm);
  const a = byArm("A");
  const b = byArm("B");
  const firstDoorAtOrBefore1 = (gs: Game[]) => gs.filter((g) => { const r = firstRulingRounds(g); return r.door !== null && (r.window === null || r.door <= r.window); }).length;

  out.push(
    "## the-prisoner#23 -- condition order",
    "",
    `arm A (window-first): ${a.length} games. arm B (door-first): ${b.length} games.`,
    "",
    `arm A: her FIRST route ruling is the door in ${firstDoorAtOrBefore1(a)} of ${a.length} (prediction: <=1 of 4).`,
    `arm B: her FIRST route ruling is the door in ${firstDoorAtOrBefore1(b)} of ${b.length} (prediction, if order decides: >=3 of 4).`,
    ""
  );

  out.push("Per game:");
  for (const g of games) {
    const r = firstRulingRounds(g);
    const c = routeCounts(g);
    out.push(
      `- ${g.file} [${g.arm}, order=${g.order ?? "?"}] first door ruling: round ${r.door ?? "never"}; first window ruling: round ${r.window ?? "never"}; ` +
        `rulings door=${c.door} window=${c.window} other=${c.other}; revision ${g.revision ?? "?"}`
    );
  }

  out.push("", "Round-1 plans, verbatim (NOT classified by code -- read them yourself; a plan's route is a judgement about prose):");
  for (const g of games) {
    out.push(`- ${g.file} [${g.arm}]: ${g.round1Plan ?? "(no round-1 plan recorded -- a human seat, or a plan-less first turn)"}`);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const a = args(process.argv.slice(2));
  if (a.has("dry-run")) {
    const fixture = a.get("dry-run") ?? "checkpoints/2026-09-28T01-09-16-356Z.md";
    console.log(`the-prisoner#23 scoreboard DRY RUN -- scoring ${fixture} as a one-game fixture in arm A, to exercise the parser.`);
    console.log("It is not a batch game (a human seat, presence off is not this batch's arm): header mismatches below are expected.\n");
    const text = readFileSync(join(REPO, fixture), "utf8");
    for (const line of score([parseGame(text, fixture, "A")])) console.log(line);
  } else {
    const dir = process.argv.slice(2).find((x) => !x.startsWith("--")) ?? HERE;
    for (const line of score(readBatch(dir))) console.log(line);
  }
}
