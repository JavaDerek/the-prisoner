import { describe, it, expect } from "vitest";
import {
  readPrisonerMode,
  prisonerModeHeaderLine,
  parseModeFromTranscript,
  assertBenchmarkTranscript,
  resolveScenarioModel,
  readScenarioTemperature,
  DEFAULT_SCENARIO_TEMPERATURE,
  readScenarioFile,
} from "../scenarioMode.js";

// the-prisoner#3: the mode switch, byte-identical to today's behaviour when
// unset (CODER-BRIEF's decision 1) -- `benchmark` is not a new arm, it is the
// name given to what every batch already ran.
describe("readPrisonerMode", () => {
  it("defaults to benchmark, unset or empty", () => {
    expect(readPrisonerMode(undefined)).toBe("benchmark");
    expect(readPrisonerMode("")).toBe("benchmark");
  });
  it("accepts benchmark and enjoyable", () => {
    expect(readPrisonerMode("benchmark")).toBe("benchmark");
    expect(readPrisonerMode("enjoyable")).toBe("enjoyable");
  });
  it("throws on anything else, naming the offending value", () => {
    expect(() => readPrisonerMode("fun")).toThrow(/PRISONER_MODE/);
    expect(() => readPrisonerMode("fun")).toThrow(/"fun"/);
  });
});

describe("prisonerModeHeaderLine", () => {
  it("names the default plainly, for a reader who has never seen the switch", () => {
    expect(prisonerModeHeaderLine("benchmark")).toMatch(/^Mode: BENCHMARK/);
  });
  it("carries an explicit pooling warning for enjoyable mode", () => {
    const line = prisonerModeHeaderLine("enjoyable");
    expect(line).toMatch(/^Mode: ENJOYABLE/);
    expect(line).toMatch(/never pool.*with a benchmark batch/i);
  });
});

describe("parseModeFromTranscript / assertBenchmarkTranscript (batchMeasures' own guard)", () => {
  it("reads BENCHMARK from a header line", () => {
    expect(parseModeFromTranscript("Mode: BENCHMARK (`PRISONER_MODE=benchmark`, the default).")).toBe("benchmark");
  });
  it("reads ENJOYABLE from a header line", () => {
    expect(parseModeFromTranscript("Mode: ENJOYABLE -- generated scenario, never pool with a benchmark batch.")).toBe("enjoyable");
  });
  it("a transcript recorded before this switch existed has no Mode line, and reads as benchmark", () => {
    expect(parseModeFromTranscript("# The Prisoner -- checkpoint transcript (open variant)\n\nWits model: `x`.")).toBe("benchmark");
  });
  it("assertBenchmarkTranscript passes silently for benchmark and for a mode-less (pre-switch) transcript", () => {
    expect(() => assertBenchmarkTranscript("Mode: BENCHMARK (the default).", "a.md")).not.toThrow();
    expect(() => assertBenchmarkTranscript("no mode line at all", "a.md")).not.toThrow();
  });
  it("assertBenchmarkTranscript throws a clear message naming the file for an enjoyable transcript", () => {
    expect(() => assertBenchmarkTranscript("Mode: ENJOYABLE -- generated scenario, never pool with a benchmark batch.", "checkpoints/x/game.md")).toThrow(
      /checkpoints\/x\/game\.md/
    );
    expect(() => assertBenchmarkTranscript("Mode: ENJOYABLE -- generated scenario, never pool with a benchmark batch.", "checkpoints/x/game.md")).toThrow(
      /enjoyable/i
    );
  });
});

describe("resolveScenarioModel (PRISONER_SCENARIO_MODEL, falls back to the referee's)", () => {
  it("falls back to the referee model when unset or empty", () => {
    expect(resolveScenarioModel("qwen3:14b", undefined)).toBe("qwen3:14b");
    expect(resolveScenarioModel("qwen3:14b", "")).toBe("qwen3:14b");
  });
  it("takes an explicit override", () => {
    expect(resolveScenarioModel("qwen3:14b", "muse-glimmer:30b")).toBe("muse-glimmer:30b");
  });
});

describe("readScenarioTemperature (PRISONER_SCENARIO_TEMPERATURE, default 0.9)", () => {
  it("defaults to 0.9, unset or empty", () => {
    expect(readScenarioTemperature(undefined)).toBe(DEFAULT_SCENARIO_TEMPERATURE);
    expect(readScenarioTemperature("")).toBe(DEFAULT_SCENARIO_TEMPERATURE);
    expect(DEFAULT_SCENARIO_TEMPERATURE).toBe(0.9);
  });
  it("parses a number", () => {
    expect(readScenarioTemperature("1.1")).toBe(1.1);
    expect(readScenarioTemperature("0")).toBe(0);
  });
  it("throws naming the offending value when it is not a number", () => {
    expect(() => readScenarioTemperature("hot")).toThrow(/PRISONER_SCENARIO_TEMPERATURE/);
  });
});

describe("readScenarioFile (PRISONER_SCENARIO_FILE)", () => {
  it("is undefined when unset or empty", () => {
    expect(readScenarioFile(undefined)).toBeUndefined();
    expect(readScenarioFile("")).toBeUndefined();
  });
  it("passes a path through unchanged", () => {
    expect(readScenarioFile("checkpoints/x/game.scenario.json")).toBe("checkpoints/x/game.scenario.json");
  });
});
