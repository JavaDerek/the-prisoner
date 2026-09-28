import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestDb, destroyTestDb } from "../../../world/testDb.js";
import { resolveScene } from "../scene.js";
import type { D11Corpus } from "../seedD11.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..", "..");

/** Golden fixture: `checkpoints/2026-09-26-human-intents/dry-run.jsonl`,
 *  already checked into the repo, records the perceived-object id SET
 *  `probe.mts`'s own replay produced for every one of D11's 95 rows. This
 *  module ports that same replay logic (`scene.ts`'s header says so); this
 *  test is the mechanical check that the port still agrees with the
 *  original, proven-correct run, for a sample covering a transcript
 *  replay, a no-transcript (round-1 default) row, and a row that needs a
 *  derived object (`strip`/`strip_2`) already in view. */
function goldenPerceivedIds(id: string): readonly string[] {
  const lines = readFileSync(join(REPO_ROOT, "checkpoints", "2026-09-26-human-intents", "dry-run.jsonl"), "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { id: string; perceivedIds: string[] });
  const row = lines.find((l) => l.id === id);
  if (!row) throw new Error(`fixture row ${id} not found`);
  return row.perceivedIds;
}

function corpusRow(id: string) {
  const corpus = JSON.parse(readFileSync(join(REPO_ROOT, "checkpoints", "2026-09-26-human-intents", "corpus.json"), "utf-8")) as D11Corpus;
  const row = corpus.rows.find((r) => r.id === id);
  if (!row) throw new Error(`corpus row ${id} not found`);
  return row;
}

describe("resolveScene", () => {
  afterEach(() => destroyTestDb());

  describe("static", () => {
    it("looks up today's scenarioObjects.ts text by id, never a copy", () => {
      const { perceived, warnings } = resolveScene({ kind: "static", perceivedObjectIds: ["bar", "window"] }, "Remove the bar", {});
      expect(warnings).toEqual([]);
      expect(perceived.map((o) => o.id)).toEqual(["bar", "window"]);
      const bar = perceived.find((o) => o.id === "bar");
      expect(bar?.description).toContain("Rust has pitted it near the bottom");
      // The pre-#26 plural ("Iron bars cross it") must NOT appear -- this is
      // exactly the staleness the static scene exists to avoid.
      expect(perceived.find((o) => o.id === "window")?.description).not.toContain("Iron bars");
    });

    it("throws on an id not declared in scenarioObjects.ts", () => {
      expect(() => resolveScene({ kind: "static", perceivedObjectIds: ["not-a-real-object"] }, "x", {})).toThrow(/unknown scenario object/);
    });

    it("passes refereeArms through unchanged, defaulting to createReferee's own bare defaults when omitted", () => {
      const { refereeOptions } = resolveScene({ kind: "static", perceivedObjectIds: ["bar"] }, "x", { elisionMode: "on" });
      expect(refereeOptions.elisionMode).toBe("on");
      expect(refereeOptions.containerClauseMode).toBeUndefined();
    });
  });

  describe("replay", () => {
    it("matches the recorded dry-run.jsonl perceived-id set for a transcript replay row", () => {
      createTestDb();
      const row = corpusRow("G1-r2");
      const { perceived, warnings } = resolveScene({ kind: "replay", sourceFile: row.sourceFile, round: row.round, chair: row.chair }, row.intentTested, {});
      expect(perceived.map((o) => o.id).sort()).toEqual([...goldenPerceivedIds("G1-r2")].sort());
      expect(warnings).toEqual([]);
    });

    it("matches the recorded set for a no-transcript row (round-1 default state)", () => {
      createTestDb();
      const row = corpusRow("I25-1");
      expect(row.sourceFile).toBeNull();
      const { perceived } = resolveScene({ kind: "replay", sourceFile: row.sourceFile, round: row.round, chair: row.chair }, row.intentTested, {});
      expect(perceived.map((o) => o.id).sort()).toEqual([...goldenPerceivedIds("I25-1")].sort());
    });

    it("matches the recorded set for a row needing an already-derived object in view (strip, strip_2)", () => {
      createTestDb();
      const row = corpusRow("B7-P04");
      const { perceived } = resolveScene({ kind: "replay", sourceFile: row.sourceFile, round: row.round, chair: row.chair }, row.intentTested, {});
      expect(perceived.map((o) => o.id).sort()).toEqual([...goldenPerceivedIds("B7-P04")].sort());
      expect(perceived.map((o) => o.id)).toContain("strip_2");
    });

    it("builds isDeclared/kindOf/propertiesOf from the rebuilt world, not the static scenario table", () => {
      createTestDb();
      const row = corpusRow("B7-P04");
      const { refereeOptions } = resolveScene({ kind: "replay", sourceFile: row.sourceFile, round: row.round, chair: row.chair }, row.intentTested, {});
      // strip_2 is a derived object -- `declaredProperty` (static table) has never
      // heard of it, so this only passes if the WORLD's own lookup is wired in.
      expect(refereeOptions.isDeclared?.("strip_2", "concealment")).toBe(true);
      expect(refereeOptions.kindOf?.("strip_2")).toBe("strip");
    });
  });
});
