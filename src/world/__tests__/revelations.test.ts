import { describe, it, expect } from "vitest";
import { describeInspection, describeObservation } from "../revelations.js";

/**
 * REVISION: INSPECT/OBSERVE reveal exact numbers directly in the mechanic's
 * own result now (design Appendix A.4), so these formatters are pure
 * functions over that result -- no database, no round_log scan.
 */
describe("describeInspection -- pure prose over INSPECT's own result", () => {
  it("states both revealed numbers positively", () => {
    const text = describeInspection({ lockIntegrity: 65, guardAttention: 40 });
    expect(text).toContain("lock integrity 65");
    expect(text).toContain("guard attention 40");
  });
});

describe("describeObservation -- pure prose over OBSERVE's own result", () => {
  it("states the spoon edge when present, and the bar's band", () => {
    const text = describeObservation({ spoonEdge: 30, barBand: "worn" });
    expect(text).toContain("spoon edge 30");
    expect(text).toContain("bar looks worn");
  });

  it("says nothing about the spoon edge when it is absent (concealed)", () => {
    const text = describeObservation({ barBand: "intact" });
    expect(text).not.toContain("spoon edge");
    expect(text).toContain("bar looks intact");
  });
});
