import { describe, it, expect } from "vitest";
import type { OpenObjectSpec } from "../scenarioObjects.js";
import {
  descriptionHash,
  acquirablePairs,
  elaborationBandProblems,
  assertElaborationBandsReady,
  lookupBand,
  isAuthorSet,
  isModelRead,
  type ElaborationBandRow,
  type ModelPricedRow,
  type AuthorPricedRow,
  type ReviewRow,
} from "../elaborationBands.js";

const BAR: OpenObjectSpec = {
  id: "bar",
  heldBy: "the window",
  description: "An iron bar, thumb-thick, pitted with rust near the bottom where it meets old mortar.",
  properties: [{ key: "integrity", resourceName: "bar_integrity", min: 0, max: 100, initialValue: 100, wear: { slight: 1, moderate: 1, substantial: 1 }, restore: { slight: 1, moderate: 1, substantial: 1 } }],
};
const BUCKET: OpenObjectSpec = {
  id: "bucket",
  heldBy: "the floor",
  description: "A tin slop bucket with a wire handle. It rings sharply when struck.",
  properties: [],
};
const FIXTURE_OBJECTS: readonly OpenObjectSpec[] = [BAR, BUCKET];

describe("descriptionHash (this task's brief: a hash of the description a row was read from)", () => {
  it("is deterministic and changes when the text changes", () => {
    const a = descriptionHash("the bar is rusted");
    const b = descriptionHash("the bar is rusted");
    const c = descriptionHash("the bar is polished");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("acquirablePairs (WORLD-ELABORATION-DESIGN.md §4.2a: every (object, need) the object does not already declare)", () => {
  it("skips a need the object already declares, and skips an object with no properties at all only for that need", () => {
    const pairs = acquirablePairs(FIXTURE_OBJECTS);
    // BAR already declares `integrity` -- not a candidate for its own acquisition.
    expect(pairs.some((p) => p.objectId === "bar" && p.need === "integrity")).toBe(false);
    // BAR does not declare `edge`, `concealment` or `passage` -- all three are acquirable.
    expect(pairs.filter((p) => p.objectId === "bar").map((p) => p.need).sort()).toEqual(["concealment", "edge", "passage"]);
    // BUCKET declares nothing at all -- every one of the four `need` kinds is acquirable.
    expect(pairs.filter((p) => p.objectId === "bucket").map((p) => p.need).sort()).toEqual(["concealment", "edge", "integrity", "passage"]);
  });

  it("never offers posture -- a person's key, never an object's (§2: never a person as the target)", () => {
    const pairs = acquirablePairs(FIXTURE_OBJECTS);
    expect(pairs.some((p) => p.need === "posture")).toBe(false);
  });
});

function modelRow(objectId: string, need: ElaborationBandRow["need"], descriptionHashValue: string): ModelPricedRow {
  return {
    status: "priced",
    bandSource: "model",
    objectId,
    need,
    band: "hard",
    citation: { sourceId: `desc:${objectId}`, quote: "rusted" },
    model: "test-model",
    scenarioRevision: "abc1234 (clean)",
    descriptionHash: descriptionHashValue,
  };
}

describe("elaborationBandProblems / assertElaborationBandsReady (§9 row P1's own red tests)", () => {
  it("an empty table reports every acquirable pair as missing, and the arm refuses to start", () => {
    const problems = elaborationBandProblems([], FIXTURE_OBJECTS);
    expect(problems.length).toBe(acquirablePairs(FIXTURE_OBJECTS).length);
    expect(problems.every((p) => p.reason === "missing")).toBe(true);
    expect(() => assertElaborationBandsReady([], FIXTURE_OBJECTS)).toThrow(/bar\.edge \(missing\)/);
  });

  it("a review row is reported, and the arm refuses to start while it stands", () => {
    const review: ReviewRow = {
      status: "review",
      objectId: "bar",
      need: "edge",
      model: "test-model",
      scenarioRevision: "abc1234 (clean)",
      descriptionHash: descriptionHash(BAR.description),
      replies: [
        { band: "hard", citation: { sourceId: "desc:bar", quote: "rusted" } },
        { band: "ruinous", citation: { sourceId: "desc:bar", quote: "thumb-thick" } },
      ],
    };
    const rows: ElaborationBandRow[] = [
      review,
      modelRow("bar", "concealment", descriptionHash(BAR.description)),
      modelRow("bar", "passage", descriptionHash(BAR.description)),
      modelRow("bucket", "integrity", descriptionHash(BUCKET.description)),
      modelRow("bucket", "edge", descriptionHash(BUCKET.description)),
      modelRow("bucket", "concealment", descriptionHash(BUCKET.description)),
      modelRow("bucket", "passage", descriptionHash(BUCKET.description)),
    ];
    const problems = elaborationBandProblems(rows, FIXTURE_OBJECTS);
    expect(problems).toEqual([{ objectId: "bar", need: "edge", reason: "review" }]);
    expect(() => assertElaborationBandsReady(rows, FIXTURE_OBJECTS)).toThrow(/bar\.edge \(review\)/);
  });

  it("a changed description makes a priced row stale, and the arm refuses to start", () => {
    const staleHash = descriptionHash("an OLDER description, before this object's text changed");
    const rows: ElaborationBandRow[] = [
      modelRow("bar", "edge", staleHash), // stale: does not match BAR.description's live hash
      modelRow("bar", "concealment", descriptionHash(BAR.description)),
      modelRow("bar", "passage", descriptionHash(BAR.description)),
      modelRow("bucket", "integrity", descriptionHash(BUCKET.description)),
      modelRow("bucket", "edge", descriptionHash(BUCKET.description)),
      modelRow("bucket", "concealment", descriptionHash(BUCKET.description)),
      modelRow("bucket", "passage", descriptionHash(BUCKET.description)),
    ];
    const problems = elaborationBandProblems(rows, FIXTURE_OBJECTS);
    expect(problems).toEqual([{ objectId: "bar", need: "edge", reason: "stale" }]);
    expect(() => assertElaborationBandsReady(rows, FIXTURE_OBJECTS)).toThrow(/bar\.edge \(stale\)/);
  });

  it("a fully priced, fresh table has no problems and the arm does not refuse", () => {
    const rows: ElaborationBandRow[] = acquirablePairs(FIXTURE_OBJECTS).map(({ objectId, need }) => {
      const object = FIXTURE_OBJECTS.find((o) => o.id === objectId);
      if (!object) throw new Error(`fixture missing ${objectId}`);
      return modelRow(objectId, need, descriptionHash(object.description));
    });
    expect(elaborationBandProblems(rows, FIXTURE_OBJECTS)).toEqual([]);
    expect(() => assertElaborationBandsReady(rows, FIXTURE_OBJECTS)).not.toThrow();
  });

  it("an author-set row carries its comment, is not stale or under review, and reads back as author-set -- never model-read", () => {
    const authored: AuthorPricedRow = {
      status: "priced",
      bandSource: "author",
      objectId: "bar",
      need: "edge",
      band: "ruinous",
      citation: null,
      model: null,
      scenarioRevision: "abc1234 (clean)",
      descriptionHash: descriptionHash(BAR.description),
      comment: "The N=5 replay split 3 hard / 2 ruinous (see checkpoints/2026-09-19.price-world.referee.json); set to ruinous by hand, the more conservative reading, 2026-09-19.",
    };
    const rows: ElaborationBandRow[] = [
      authored,
      modelRow("bar", "concealment", descriptionHash(BAR.description)),
      modelRow("bar", "passage", descriptionHash(BAR.description)),
      modelRow("bucket", "integrity", descriptionHash(BUCKET.description)),
      modelRow("bucket", "edge", descriptionHash(BUCKET.description)),
      modelRow("bucket", "concealment", descriptionHash(BUCKET.description)),
      modelRow("bucket", "passage", descriptionHash(BUCKET.description)),
    ];
    expect(elaborationBandProblems(rows, FIXTURE_OBJECTS)).toEqual([]);
    expect(() => assertElaborationBandsReady(rows, FIXTURE_OBJECTS)).not.toThrow();

    const readBack = rows.find((r) => r.objectId === "bar" && r.need === "edge");
    if (!readBack) throw new Error("fixture missing bar.edge");
    expect(isAuthorSet(readBack)).toBe(true);
    expect(isModelRead(readBack)).toBe(false);
    expect((readBack as AuthorPricedRow).comment).toContain("set to ruinous by hand");
    expect(lookupBand("bar", "edge", rows)).toBe("ruinous");
  });

  it("lookupBand returns undefined for a review row or a missing pair -- never a guessed price", () => {
    expect(lookupBand("bar", "edge", [])).toBeUndefined();
    const review: ReviewRow = {
      status: "review",
      objectId: "bar",
      need: "edge",
      model: "test-model",
      scenarioRevision: "abc1234 (clean)",
      descriptionHash: descriptionHash(BAR.description),
      replies: [{ band: "hard", citation: null }],
    };
    expect(lookupBand("bar", "edge", [review])).toBeUndefined();
  });
});
