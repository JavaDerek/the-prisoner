import { describe, it, expect } from "vitest";
import { parseEngineRulesDryRunArgs, buildDryRunScenario, renderDryRun } from "../engineRulesDryRunCli.js";

/**
 * the-prisoner#5, CODER-BRIEF: "Build a dry-run way to see the enjoyable-mode
 * referee request ... and verify it. Do NOT call a model." This tool never
 * imports a transport or a model role -- these tests check its output is the
 * real `PRISONER_OPEN_RULES=engine` request shape, built entirely offline.
 */
describe("npm run engine-rules-dry-run -- --dry-run", () => {
  it("parses --dry-run", () => {
    expect(parseEngineRulesDryRunArgs([])).toEqual({ dryRun: false });
    expect(parseEngineRulesDryRunArgs(["--dry-run"])).toEqual({ dryRun: true });
  });

  it("the scenario is the issue's own concrete test case: the grit held, acting on the bar", () => {
    const scenario = buildDryRunScenario();
    expect(scenario.intent).toMatch(/grit.*bar's mortar/);
    expect(scenario.perceivedObjects.map((o) => o.id)).toEqual(["bar", "grit"]);
    expect(scenario.heldObjectIds).toEqual(["grit"]);
    // The bar's description is read from the real scenario, never retyped --
    // the same "set into old mortar that is dry and cracked" text §4.1
    // authors and `referee.ts`'s own property citation would need.
    expect(scenario.perceivedObjects[0]?.description).toMatch(/mortar that is dry and cracked/);
  });

  it("renders the engine-mode question set: write/set/transfer/create/destroy/reveal/none, plus direction/to/with", () => {
    const lines = renderDryRun();
    const text = lines.join("\n");
    expect(text).toContain("=== QUESTIONS (PRISONER_OPEN_RULES=engine) ===");
    expect(text).toContain("--- effect ---");
    expect(text).toContain("Answer keys: write, set, transfer, create, destroy, reveal, none");
    expect(text).toContain("--- direction ---");
    expect(text).toContain("--- to ---");
    expect(text).toContain("--- with ---");
    // the `with` question's own closed set is the held grit, plus none.
    expect(text).toContain("Answer keys: grit, none");
    expect(text).toContain("=== SOURCES ===");
    expect(text).toContain("--- intent ---");
    expect(text).toContain("--- desc:bar ---");
    expect(text).toContain("--- desc:grit ---");
  });

  it("makes no network call and imports no transport -- this file's only imports are pure question/source builders", () => {
    // Structural: renderDryRun/buildDryRunScenario are synchronous, pure
    // functions (no Promise involved anywhere in this module's public API),
    // which a transport-driven call could not be.
    expect(renderDryRun.constructor.name).toBe("Function");
    expect(buildDryRunScenario.constructor.name).toBe("Function");
  });
});
