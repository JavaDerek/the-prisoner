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
