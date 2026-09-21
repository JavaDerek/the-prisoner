// `npm run measures -- <batch dir> [--arms Q,O,D] [--residue target/effect,...]`
// (OPUS-FIRST-DESIGN.md §2, §3.3, §5.2). Reads `<dir>/<arm>/*.md` and the
// `.referee.json` beside each, and prints `batchMeasures.ts`'s markdown to
// stdout. All the counting is in `batchMeasures.ts`, over transcript text;
// this file only walks the directory. With no `--arms`, every subdirectory
// that holds a transcript is an arm, in name order -- except `discarded`,
// which a batch keeps for games that are NOT part of it (its RESULTS.md and
// count.mts both leave it out); name it in `--arms` to measure it anyway.
//
// `checkpoints/2026-09-20-ambition/count.mts` is the committed record of that
// batch and is left as it is; this tool reproduces its per-arm table exactly
// (pinned by `__tests__/batchMeasures.test.ts`) and adds the rest.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseMeasuresArgs, parseRefereeReplies, parseTranscript, renderBatchMeasures, type Game } from "./batchMeasures.js";

function transcriptsIn(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && statSync(join(dir, f)).isFile())
    .sort();
}

function main(argv: readonly string[]): number {
  let args;
  try {
    args = parseMeasuresArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  const { dir, residue } = args;
  const arms =
    args.arms ??
    readdirSync(dir)
      .filter((d) => d !== "discarded" && statSync(join(dir, d)).isDirectory() && transcriptsIn(join(dir, d)).length > 0)
      .sort();
  const games: Game[] = [];
  for (const arm of arms) {
    const armDir = join(dir, arm);
    if (!existsSync(armDir)) {
      process.stderr.write(`no such arm directory: ${armDir}\n`);
      return 2;
    }
    for (const f of transcriptsIn(armDir)) {
      const sidecar = join(armDir, f.replace(/\.md$/, ".referee.json"));
      // A transcript without its sidecar still counts; only the lost-rulings
      // section has nothing to compare it against.
      const replies = existsSync(sidecar) ? parseRefereeReplies(readFileSync(sidecar, "utf8")) : [];
      games.push({ arm, transcript: parseTranscript(readFileSync(join(armDir, f), "utf8"), `${arm}/${f}`), replies });
    }
  }
  process.stdout.write(`# Batch measures: \`${dir}\` (arms ${arms.join(", ")})\n\n`);
  process.stdout.write(renderBatchMeasures(games, { residue }));
  process.stdout.write("\n");
  return 0;
}

process.exitCode = main(process.argv.slice(2));
