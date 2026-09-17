import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderConditionList, CONDITION_LIST_OPENING, type Condition } from "../conditionList.js";

// OPEN-VARIANT.md §33.15 / §34: the owner's prompt-lab structure, as a generic
// renderer any caller can feed from thresholds it already holds.
const UNLOCK: Condition = { when: ["the gate's strength is at or below 50"], then: "the gate can be pushed open", for: "Ana" };
const THREAT: Condition = { when: ["Ben's alarm is at or above 40", "Ben inspects the gate", "Ben finds its strength at or below 30"], then: "Ben stops Ana and the episode ends", for: "Ben" };

describe("renderConditionList", () => {
  it("opens with the fixed line, then a delimited, numbered list of flat if-then conditions", () => {
    expect(renderConditionList([UNLOCK, THREAT], { reader: "Ana" })).toEqual([
      CONDITION_LIST_OPENING,
      "",
      "START LIST OF CONDITIONS",
      "CONDITION 1 (for you): If the gate's strength is at or below 50, then the gate can be pushed open.",
      "CONDITION 2 (for Ben): If Ben's alarm is at or above 40, and Ben inspects the gate, and Ben finds its strength at or below 30, then Ben stops Ana and the episode ends.",
      "END LIST OF CONDITIONS",
    ]);
  });

  it("says whose each condition is from the reader's side: the same list read by the other party flips", () => {
    const lines = renderConditionList([UNLOCK, THREAT], { reader: "Ben" });
    expect(lines[3]).toMatch(/^CONDITION 1 \(for Ana\): /);
    expect(lines[4]).toMatch(/^CONDITION 2 \(for you\): /);
  });

  it("the opening line is the owner's generic sentence, verbatim", () => {
    expect(CONDITION_LIST_OPENING).toBe(
      "Whenever a condition stated below is met, the action it unlocks is available immediately. Nothing further needs to be done before attempting it."
    );
  });

  it("an empty list renders nothing at all, not an empty frame", () => {
    expect(renderConditionList([], { reader: "Ana" })).toEqual([]);
  });

  it("refuses a condition with no clause, or a clause that is blank: a condition is never implied", () => {
    expect(() => renderConditionList([{ ...UNLOCK, when: [] }], { reader: "Ana" })).toThrow(/at least one clause/);
    expect(() => renderConditionList([{ ...UNLOCK, when: ["  "] }], { reader: "Ana" })).toThrow(/blank/);
  });

  it("names nothing from this game: it can move to a shared package as a file", () => {
    const source = readFileSync(fileURLToPath(new URL("../conditionList.ts", import.meta.url)), "utf8");
    for (const word of ["prisoner", "warden", "Voss", "Croft", "cell", "bar", "spoon", "window", "escape", "catch"]) {
      expect(source.toLowerCase()).not.toMatch(new RegExp(`\\b${word.toLowerCase()}\\b`));
    }
  });
});
