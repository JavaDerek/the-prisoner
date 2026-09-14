import { describe, it, expect } from "vitest";
import { pinnedDependencyVersion } from "../packageInfo.js";

describe("pinnedDependencyVersion (item 10) -- read the real pin, never hard-code it", () => {
  it("reads mind-seam's exact pinned version from package.json", () => {
    expect(pinnedDependencyVersion("mind-seam")).toBe("0.2.0");
  });

  it("reads run-dmcp's exact pinned version from package.json", () => {
    expect(pinnedDependencyVersion("run-dmcp")).toBe("0.6.0");
  });

  it("throws, naming the package, for a dependency not declared", () => {
    expect(() => pinnedDependencyVersion("not-a-real-dependency")).toThrow(/not-a-real-dependency/);
  });
});
