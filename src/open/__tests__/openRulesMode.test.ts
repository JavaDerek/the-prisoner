import { describe, it, expect } from "vitest";
import { readOpenRulesMode, openRulesHeaderLine } from "../openRulesMode.js";

describe("PRISONER_OPEN_RULES (the-prisoner#5)", () => {
  it("defaults to fixed under PRISONER_MODE=benchmark", () => {
    expect(readOpenRulesMode(undefined, "benchmark")).toBe("fixed");
    expect(readOpenRulesMode("", "benchmark")).toBe("fixed");
  });

  it("defaults to engine under PRISONER_MODE=enjoyable", () => {
    expect(readOpenRulesMode(undefined, "enjoyable")).toBe("engine");
    expect(readOpenRulesMode("", "enjoyable")).toBe("engine");
  });

  it("accepts an explicit fixed under either mode", () => {
    expect(readOpenRulesMode("fixed", "benchmark")).toBe("fixed");
    expect(readOpenRulesMode("fixed", "enjoyable")).toBe("fixed");
  });

  it("accepts an explicit engine only under enjoyable", () => {
    expect(readOpenRulesMode("engine", "enjoyable")).toBe("engine");
  });

  it("refuses engine under benchmark, like the other mode guards", () => {
    expect(() => readOpenRulesMode("engine", "benchmark")).toThrow(/PRISONER_OPEN_RULES=engine needs PRISONER_MODE=enjoyable/);
  });

  it("refuses an unrecognised value", () => {
    expect(() => readOpenRulesMode("loose", "enjoyable")).toThrow(/PRISONER_OPEN_RULES/);
  });

  it("prints a distinct header line per mode, naming the env var and the issue", () => {
    expect(openRulesHeaderLine("fixed")).toMatch(/^Open rules: FIXED/);
    expect(openRulesHeaderLine("fixed")).toMatch(/the-prisoner#5/);
    expect(openRulesHeaderLine("engine")).toMatch(/^Open rules: ENGINE/);
    expect(openRulesHeaderLine("engine")).toMatch(/never pool with a fixed-rules batch/);
  });
});
