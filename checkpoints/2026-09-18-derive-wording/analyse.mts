/**
 * Tabulates the derive-wording batch (§51, issue #18, the owner's D2): does
 * `PRISONER_DERIVE_WORDING=sharpened` change REAL games, or only the re-ruling
 * of one recorded intent (§51.6)?
 *
 * Counts, per game, from the transcript itself: how many of the prisoner's
 * half-rounds the REFEREE ruled `derive`, how many things the world actually
 * made, and how the game ended. The derive count comes from the referee's own
 * answer table, never from anything in her prose.
 *
 * Usage: npx tsx checkpoints/2026-09-18-derive-wording/analyse.mts [files...]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CHECKPOINTS = join(process.cwd(), "checkpoints");

function transcripts(): string[] {
  const given = process.argv.slice(2);
  if (given.length > 0) return given;
  return readdirSync(CHECKPOINTS)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(CHECKPOINTS, f))
    .filter((f) => readFileSync(f, "utf8").includes("Derive wording:"));
}

function prisonerHalves(text: string): string[] {
  const parts = text.split(/^### Round \d+ \(t=\d+\) -- the /m).slice(1);
  return parts.filter((p) => p.startsWith("prisoner"));
}

const rows = transcripts()
  .map((file) => {
    const text = readFileSync(file, "utf8");
    const halves = prisonerHalves(text);
    const escaped = text.match(/\*\*The prisoner escaped, at round (\d+)\.\*\*/);
    const caught = text.match(/caught the prisoner, at round (\d+)/i);
    return {
      arm: /Derive wording: SHARPENED/.test(text) ? "sharpened" : "baseline",
      ending: escaped ? "escaped" : caught ? "caught" : "timeout",
      round: Number(escaped?.[1] ?? caught?.[1] ?? 0) || null,
      // The referee's own answers, per prisoner half-round.
      derivesRuled: halves.filter((h) => /\| effect \| `derive`/.test(h)).length,
      wearRuled: halves.filter((h) => /\| effect \| `wear`/.test(h)).length,
      // What the world actually holds at the end.
      made: Number(text.match(/Made this game: (\d+)\./)?.[1] ?? 0),
      turns: halves.length,
      stamp: file.split("/").pop()!.replace(".md", ""),
    };
  })
  .sort((a, b) => a.arm.localeCompare(b.arm) || a.stamp.localeCompare(b.stamp));

console.log("arm        end      rnd turns derive wear made  stamp");
for (const r of rows) {
  console.log(
    `${r.arm.padEnd(10)} ${r.ending.padEnd(8)} ${String(r.round ?? "-").padStart(3)} ${String(r.turns).padStart(5)} ` +
      `${String(r.derivesRuled).padStart(6)} ${String(r.wearRuled).padStart(4)} ${String(r.made).padStart(4)}  ${r.stamp}`
  );
}

for (const arm of [...new Set(rows.map((r) => r.arm))]) {
  const a = rows.filter((r) => r.arm === arm);
  const sum = (f: (r: (typeof rows)[number]) => number) => a.reduce((s, r) => s + f(r), 0);
  console.log(
    `\n${arm}: ${a.length} games, ${sum((r) => r.derivesRuled)} derive rulings and ${sum((r) => r.wearRuled)} wear rulings over ` +
      `${sum((r) => r.turns)} prisoner turns, ${sum((r) => r.made)} things actually made, ` +
      `escaped ${a.filter((r) => r.ending === "escaped").length}, caught ${a.filter((r) => r.ending === "caught").length}`
  );
}
