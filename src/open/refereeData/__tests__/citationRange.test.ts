import { describe, it, expect } from "vitest";
import { quoteToRange } from "../citationRange.js";

describe("quoteToRange", () => {
  it("finds a single word", () => {
    expect(quoteToRange("Remove the bar", "bar")).toEqual({ from: 3, to: 3 });
  });

  it("finds a multi-word span", () => {
    expect(quoteToRange("Remove the bar", "the bar")).toEqual({ from: 2, to: 3 });
  });

  it("finds the whole text", () => {
    expect(quoteToRange("Remove the bar", "Remove the bar")).toEqual({ from: 1, to: 3 });
  });

  it("is case- and punctuation-sensitive, since sourceWords never normalises", () => {
    expect(quoteToRange("Remove the bar.", "the bar")).toEqual(null); // "bar." != "bar"
    expect(quoteToRange("Remove the bar.", "the bar.")).toEqual({ from: 2, to: 3 });
  });

  it("returns null for a quote that is not a contiguous run of the source's own words", () => {
    expect(quoteToRange("Remove the bar", "bar the")).toEqual(null);
    expect(quoteToRange("Remove the bar", "a door")).toEqual(null);
  });
});
