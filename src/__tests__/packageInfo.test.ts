import { describe, it, expect } from "vitest";
import { pinnedDependencyVersion, ownPackageVersion } from "../packageInfo.js";

describe("pinnedDependencyVersion (item 10) -- read the real pin, never hard-code it", () => {
  it("reads mind-seam's exact pinned version from package.json", () => {
    expect(pinnedDependencyVersion("mind-seam")).toBe("0.5.0");
  });

  it("reads run-dmcp's exact pinned version from package.json", () => {
    expect(pinnedDependencyVersion("run-dmcp")).toBe("0.9.0");
  });

  it("throws, naming the package, for a dependency not declared", () => {
    expect(() => pinnedDependencyVersion("not-a-real-dependency")).toThrow(/not-a-real-dependency/);
  });
});

// HUMAN-INTENTS-DESIGN.md §8.2's report row wants "game versions" alongside
// run-dmcp's own pin -- this repository's OWN version, read the identical
// way (straight from package.json), never a hand-copied literal that could
// drift the moment someone bumps the version and forgets a second place.
describe("ownPackageVersion -- this repository's own version, read the same way", () => {
  it("reads this package's own version from package.json", () => {
    expect(ownPackageVersion()).toBe("0.1.0");
  });
});
