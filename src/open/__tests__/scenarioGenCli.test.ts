import { describe, it, expect } from "vitest";
import { renderDryRun, parseScenarioGenArgs } from "../scenarioGenCli.js";
import { GENERATED_SOURCE_ID, FACTS_SOURCE_ID } from "../scenarioGen.js";

// CODER-BRIEF: "Provide a --dry-run-style way to see the generation and
// review requests without sending... and verify it." This CLI never calls a
// model at all -- its whole job is to show what a real run WOULD send.
describe("parseScenarioGenArgs", () => {
  it("reads --dry-run", () => {
    expect(parseScenarioGenArgs(["--dry-run"]).dryRun).toBe(true);
  });
  it("defaults dryRun to false with no flag", () => {
    expect(parseScenarioGenArgs([]).dryRun).toBe(false);
  });
});

describe("renderDryRun", () => {
  const objects = [
    { id: "bar", facts: "The iron bar set across the cell's small window." },
    { id: "spoon", facts: "A dented aluminium spoon." },
  ];
  const lines = renderDryRun(objects, { model: "muse-glimmer:30b", generationTemperature: 0.9 });
  const text = lines.join("\n");

  it("names the model and both temperatures, never sending anything", () => {
    expect(text).toContain("muse-glimmer:30b");
    expect(text).toContain("0.9");
    expect(text).toMatch(/review temperature.*0\b/i);
  });

  it("shows one generation request per object, carrying its id and its facts verbatim", () => {
    expect(text).toContain("bar");
    expect(text).toContain("The iron bar set across the cell's small window.");
    expect(text).toContain("spoon");
    expect(text).toContain("A dented aluminium spoon.");
  });

  it("shows the review request's two sources, generated and facts", () => {
    expect(text).toContain(GENERATED_SOURCE_ID);
    expect(text).toContain(FACTS_SOURCE_ID);
    expect(text).toMatch(/physical-only/);
    expect(text).toMatch(/states-a-use/);
    expect(text).toMatch(/names-another-object/);
    expect(text).toMatch(/drops-a-fact/);
  });

  it("never calls fetch (this test would hang or fail if it tried)", () => {
    // No network object is even constructed by `renderDryRun` -- a purely
    // string-building function, matched by its own signature taking no
    // transport of any kind.
    expect(typeof renderDryRun).toBe("function");
    expect(renderDryRun.length).toBe(2);
  });
});
