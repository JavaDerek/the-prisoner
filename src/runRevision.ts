import { execSync } from "node:child_process";

/**
 * The revision a run's transcript ran on, for the transcript's own header.
 *
 * Why this exists (root `CLAUDE.md` and this repository's own "run a batch from
 * a pinned commit"): a batch means identical conditions (§31), and
 * `npm run checkpoint` executes whatever the working tree says at the moment
 * each game starts. On 2026-09-17 a ten-game batch ran while branches were
 * being merged into `main`. It survived scrutiny -- the merged arms all
 * defaulted to off, and the round-one briefings were compared across the batch
 * afterwards and were identical -- but that was luck, and checking it cost an
 * hour that a line in the header would have saved. A transcript that names its
 * own revision, and says when the tree was dirty, makes the rule checkable by
 * anyone reading the evidence later instead of remembered by whoever ran it.
 *
 * The two shell calls are injected so this is testable without a repository,
 * and any failure degrades to "unknown": bookkeeping must never bring down a
 * game that is already talking to a model.
 */
export function describeRunRevision(
  head: () => string = () => execSync("git rev-parse --short HEAD", { encoding: "utf8" }),
  status: () => string = () => execSync("git status --porcelain", { encoding: "utf8" })
): string {
  try {
    const sha = head().trim();
    if (sha.length === 0) return "unknown (no revision available)";
    return status().trim().length > 0 ? `\`${sha}\` PLUS UNCOMMITTED CHANGES -- this run names no single revision` : `\`${sha}\` (clean)`;
  } catch {
    return "unknown (no revision available)";
  }
}
