import { describe, it, expect } from "vitest";
import { describeInspection, describeObservation, describeResourceChange, describeResourceNoOp } from "../revelations.js";

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

describe("describeResourceChange / describeResourceNoOp -- own-move feedback (coordinator's fix, item 3)", () => {
  it("states a real change as before -> after", () => {
    expect(describeResourceChange("bar", "integrity", 85, 70)).toBe("bar integrity 85 -> 70");
  });

  it("states a no-op by naming the value that made it one -- never as an absence", () => {
    const text = describeResourceNoOp("lock", "integrity", 100);
    expect(text).toBe("the lock was already at integrity 100");
    for (const forbidden of ["no change", "nothing happened", "did not"]) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
  });
});
