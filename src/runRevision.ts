import { execSync } from "node:child_process";

/**
 * The untracked paths a RUN creates by running, which therefore say nothing
 * about the code it ran (`checkpoints/2026-09-23-phase1-b3/RESULTS.md`).
 *
 * Batch 3 was run from a worktree pinned at `3fd875e` with no tracked file
 * differing from it, and every one of its ten transcripts still read PLUS
 * UNCOMMITTED CHANGES. The cause is circular: `checkpoint.ts` WRITES ITS OWN
 * TRANSCRIPT into `checkpoints/`, inside the tree this function inspects, so a
 * real batch dirties itself at round one and the `(clean)` case -- the one
 * case the line exists to report -- became unreachable. `node_modules` is the
 * same shape: a pinned worktree is handed one (a symlink, or its own install)
 * purely so it can run at all.
 *
 * ONLY untracked (`??`) entries are forgiven, and only under these paths. A
 * TRACKED change to anything, `checkpoints/` included, is still reported: this
 * repository commits its transcripts unedited, bad runs and all, so an edit to
 * one is exactly the kind of thing a reader must be told about.
 */
const RUN_CREATED_PREFIXES = ["checkpoints/", "node_modules"];

function dirtyLines(status: string): string[] {
  return status
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      if (!line.startsWith("??")) return true;
      const path = line.slice(2).trim().replace(/^"|"$/g, "");
      return !RUN_CREATED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix));
    });
}

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
    return dirtyLines(status()).length > 0 ? `\`${sha}\` PLUS UNCOMMITTED CHANGES -- this run names no single revision` : `\`${sha}\` (clean)`;
  } catch {
    return "unknown (no revision available)";
  }
}
