import { describe, it, expect } from "vitest";
import { buildD11Labels, type D11Corpus } from "../seedD11.js";

function row(overrides: Partial<D11Corpus["rows"][number]>): D11Corpus["rows"][number] {
  return {
    id: "X1",
    sourceFile: "checkpoints/x.md",
    round: 1,
    chair: "prisoner",
    intentTested: "do a thing",
    expectedKeys: null,
    expectedLabelPostD5D9: "correct",
    ...overrides,
  };
}

describe("buildD11Labels", () => {
  it("keeps expectedKeys as ground truth for a 'correct' row", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "bar", effect: "wear", property: "integrity" }, expectedLabelPostD5D9: "correct" })] });
    expect(label.expected).toMatchObject({ target: "bar", effect: "wear", property: "integrity" });
  });

  it("keeps expectedKeys as ground truth for a 'misread' row too", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "prisoner", effect: "wear", property: "posture" }, expectedLabelPostD5D9: "misread" })] });
    expect(label.expected).toMatchObject({ target: "prisoner", effect: "wear", property: "posture" });
  });

  it("drops all three fields for an 'ambiguous' row, even when expectedKeys is a clean triple", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "warden", effect: "wear", property: "posture" }, expectedLabelPostD5D9: "ambiguous" })] });
    expect(label.expected).toMatchObject({ target: null, effect: null, property: null });
  });

  it("drops all three fields for an 'unmodelled' row", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "bucket", effect: "none-or-refused", property: "none" }, expectedLabelPostD5D9: "unmodelled" })] });
    expect(label.expected).toMatchObject({ target: null, effect: null, property: null });
  });

  it("drops a field whose OWN value is compound, even on a 'correct'/'misread' row", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "cot", effect: "wear-or-derive", property: "integrity" }, expectedLabelPostD5D9: "misread" })] });
    expect(label.expected.target).toBe("cot");
    expect(label.expected.effect).toBeNull(); // compound -- never invented as one or the other.
    expect(label.expected.property).toBe("integrity");
  });

  it("never invents a label when corpus.json itself leaves expectedKeys null, even on a 'correct' row", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: null, expectedLabelPostD5D9: "correct" })] });
    expect(label.expected).toMatchObject({ target: null, effect: null, property: null });
  });

  it("always leaves product/magnitude/perceptibility/acts and every citation null -- D11 never recorded them", () => {
    const [label] = buildD11Labels({ rows: [row({ expectedKeys: { target: "bar", effect: "wear", property: "integrity" } })] });
    expect(label.expected.product).toBeNull();
    expect(label.expected.magnitude).toBeNull();
    expect(label.expected.perceptibility).toBeNull();
    expect(label.expected.acts).toBeNull();
    expect(Object.values(label.citations).every((c) => c === null)).toBe(true);
  });

  it("builds a `replay` scene naming the row's own sourceFile/round/chair, and today's default arms", () => {
    const [label] = buildD11Labels({ rows: [row({ sourceFile: "checkpoints/foo.md", round: 3, chair: "warden" })] });
    expect(label.scene).toEqual({ kind: "replay", sourceFile: "checkpoints/foo.md", round: 3, chair: "warden" });
    expect(label.refereeArms).toEqual({ elisionMode: "on", containerClauseMode: "on", instrumentMode: "off", deriveWording: "baseline" });
  });

  it("marks every row `split: test`", () => {
    const labels = buildD11Labels({ rows: [row({}), row({ id: "X2" })] });
    expect(labels.every((l) => l.split === "test")).toBe(true);
  });
});
