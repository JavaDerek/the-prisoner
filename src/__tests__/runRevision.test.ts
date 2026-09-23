import { describe, it, expect } from "vitest";
import { describeRunRevision } from "../runRevision.js";

// CLAUDE.md, "Run a batch from a pinned commit": a batch means identical
// conditions, and `npm run checkpoint` executes whatever the working tree says
// at the moment each game starts. On 2026-09-17 a ten-game batch ran while
// branches were being merged into `main`; it survived scrutiny, but only
// because the briefings were compared afterwards by hand. A transcript that
// names its own revision makes that rule checkable instead of remembered.
describe("describeRunRevision", () => {
  it("names the commit, and says plainly when the tree had uncommitted changes", () => {
    expect(describeRunRevision(() => "abc1234", () => "")).toBe("`abc1234` (clean)");
    expect(describeRunRevision(() => "abc1234", () => " M src/open/world.ts\n")).toBe("`abc1234` PLUS UNCOMMITTED CHANGES -- this run names no single revision");
  });

  // 2026-09-23, `checkpoints/2026-09-23-phase1-b3/RESULTS.md`: every transcript of a ten-game batch
  // read PLUS UNCOMMITTED CHANGES although no tracked file differed from the pinned commit. A run
  // WRITES ITS OWN TRANSCRIPTS into `checkpoints/`, inside the tree it is checking, so it makes
  // itself dirty by round one and this line could never read `(clean)` for a real batch -- which is
  // the one case it exists for. `node_modules` is ignored for the same reason: a pinned worktree is
  // given one (a symlink, or its own install) purely so it can run.
  it("ignores the run's own transcripts and node_modules -- a batch must not dirty its own provenance", () => {
    const untracked = "?? checkpoints/2026-09-23T13-51-27-780Z.md\n?? checkpoints/2026-09-23T13-51-27-780Z.referee.json\n?? node_modules\n";
    expect(describeRunRevision(() => "abc1234", () => untracked)).toBe("`abc1234` (clean)");
  });

  it("PLANTED VIOLATION: a tracked source change is still reported, however many transcripts sit beside it", () => {
    const mixed = "?? checkpoints/2026-09-23T13-51-27-780Z.md\n M src/open/referee.ts\n?? node_modules\n";
    expect(describeRunRevision(() => "abc1234", () => mixed)).toBe("`abc1234` PLUS UNCOMMITTED CHANGES -- this run names no single revision");
  });

  it("PLANTED VIOLATION: an untracked file that is NOT a transcript or node_modules is still reported", () => {
    // A stray script or a half-written arm in the tree is exactly what this line is for.
    expect(describeRunRevision(() => "abc1234", () => "?? src/open/scratchArm.ts\n")).toBe(
      "`abc1234` PLUS UNCOMMITTED CHANGES -- this run names no single revision"
    );
  });

  it("does not ignore a TRACKED change to a committed checkpoint file", () => {
    // Editing a recorded transcript is the one thing this repository never does (`checkpoints/`
    // are committed unedited, bad runs included), so it must not hide behind the same rule.
    expect(describeRunRevision(() => "abc1234", () => " M checkpoints/2026-09-22-phase1-b2/RESULTS.md\n")).toBe(
      "`abc1234` PLUS UNCOMMITTED CHANGES -- this run names no single revision"
    );
  });

  it("never brings a run down over its own bookkeeping", () => {
    expect(
      describeRunRevision(
        () => {
          throw new Error("not a git repository");
        },
        () => ""
      )
    ).toBe("unknown (no revision available)");
  });
});
