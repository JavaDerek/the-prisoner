/**
 * Tabulates the door-price batch (§50, issue #19) from the transcripts
 * themselves, so the reading is reproducible rather than remembered.
 *
 * Reads every checkpoint transcript given on the command line (or every one
 * whose header names a door-price arm) and reports, per game: the arm, which
 * way out was actually opened, the round the game ended and how, the warden's
 * final suspicion, and -- the measure §46 should have used -- how many of the
 * prisoner's own half-rounds the REFEREE ruled against the door or its lock.
 * That last one is structural: it counts the referee's own `target` answers,
 * never a phrase in her prose.
 *
 * Usage: npx tsx checkpoints/2026-09-18-door-price/analyse.mts [files...]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Row = {
  stamp: string;
  arm: string;
  stated: boolean;
  ending: string;
  round: number | null;
  exit: string;
  suspicion: number | null;
  bar: number | null;
  lock: number | null;
  doorTargets: number;
  windowTargets: number;
  rev: string;
};

const CHECKPOINTS = join(process.cwd(), "checkpoints");

function transcripts(): string[] {
  const given = process.argv.slice(2);
  if (given.length > 0) return given;
  return readdirSync(CHECKPOINTS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(CHECKPOINTS, f))
    .filter((f) => readFileSync(f, "utf8").includes("Door price:"));
}

/** Half-rounds, split on the transcript's own round headers, so a target
 *  answer is attributed to the principal whose half-round it was. */
function prisonerHalves(text: string): string[] {
  const parts = text.split(/^### Round \d+ \(t=\d+\) -- the /m).slice(1);
  return parts.filter((p) => p.startsWith("prisoner"));
}

function countTarget(halves: string[], objectId: string): number {
  return halves.filter((h) => new RegExp(`\\| target \\| \`${objectId}\``).test(h)).length;
}

function num(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  return m ? Number(m[1]) : null;
}

function row(file: string): Row {
  const text = readFileSync(file, "utf8");
  const halves = prisonerHalves(text);
  const escaped = text.match(/\*\*The prisoner escaped, at round (\d+)\.\*\*/);
  const caught = text.match(/caught[^\n]*at round (\d+)/i);
  const timeout = text.match(/\*\*Timeout after (\d+) rounds/);
  const through = text.match(/out of the cell, through the (\w+)/);
  const opened = [...text.matchAll(/- (window|door)_passage: 0 -> 1/g)].map((m) => m[1]);
  return {
    stamp: file.split("/").pop()!.replace(".md", ""),
    arm: /Door price: THRESHOLD/.test(text) ? "threshold" : "free",
    stated: /Door: STATED/.test(text),
    ending: escaped ? "escaped" : caught ? "caught" : "timeout",
    round: Number(escaped?.[1] ?? caught?.[1] ?? timeout?.[1] ?? 0) || null,
    exit: through?.[1] ?? (opened.length > 0 ? `${opened.join("+")} (opened, not used)` : "-"),
    suspicion: num(text, /- wardenSuspicion: (\d+)/),
    bar: num(text, /- barIntegrity: (\d+)/),
    lock: num(text, /- lockIntegrity: (\d+)/),
    doorTargets: countTarget(halves, "door") + countTarget(halves, "lock"),
    windowTargets: countTarget(halves, "window") + countTarget(halves, "bar"),
    // Recorded since `runRevision.ts`: a batch that cannot name one revision
    // is not a batch (CLAUDE.md). Older transcripts predate the header.
    rev: text.match(/Code revision: `?([0-9a-f]{7,})`?/)?.[1] ?? "pre-header",
  };
}

const rows = transcripts().map(row).sort((a, b) => a.arm.localeCompare(b.arm) || a.stamp.localeCompare(b.stamp));
console.log("arm        stated end      rnd exit                 susp bar lock doorT winT  rev        stamp");
for (const r of rows) {
  console.log(
    `${r.arm.padEnd(10)} ${String(r.stated).padEnd(6)} ${r.ending.padEnd(8)} ${String(r.round ?? "-").padStart(3)} ` +
      `${r.exit.padEnd(20)} ${String(r.suspicion ?? "-").padStart(4)} ${String(r.bar ?? "-").padStart(3)} ${String(r.lock ?? "-").padStart(4)} ` +
      `${String(r.doorTargets).padStart(5)} ${String(r.windowTargets).padStart(4)}  ${r.rev.padEnd(10)} ${r.stamp}`
  );
}

for (const arm of ["free", "threshold"]) {
  const a = rows.filter((r) => r.arm === arm);
  if (a.length === 0) continue;
  const doorExits = a.filter((r) => r.exit.startsWith("door")).length;
  const escapes = a.filter((r) => r.ending === "escaped");
  const mean = (xs: number[]) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : "-");
  console.log(
    `\n${arm}: ${a.length} games, escaped ${escapes.length}, out through the door ${doorExits}, ` +
      `mean escape round ${mean(escapes.map((r) => r.round ?? 0))}, mean final suspicion ${mean(a.map((r) => r.suspicion ?? 0))}, ` +
      `games where she aimed at the door or lock at all ${a.filter((r) => r.doorTargets > 0).length}`
  );
}
