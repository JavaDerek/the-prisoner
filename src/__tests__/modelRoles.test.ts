import { describe, it, expect, afterEach } from "vitest";
import { readSkipVoice, resolveVoiceModel, resolveRefereeModel } from "../modelRoles.js";

/**
 * `PRISONER_SKIP_VOICE` (CLAUDE.md "Test runs skip the voice model for
 * reasoning-only work"): the voice role's line never reaches the referee
 * (`open/mind.ts`: "the wits call's `intent` is always what reaches the
 * referee"), so a run testing reasoning rather than producing a readable
 * transcript can collapse voice onto the wits model for free.
 */
describe("PRISONER_SKIP_VOICE", () => {
  const original = process.env.PRISONER_SKIP_VOICE;

  afterEach(() => {
    if (original === undefined) delete process.env.PRISONER_SKIP_VOICE;
    else process.env.PRISONER_SKIP_VOICE = original;
  });

  it("defaults to false when unset -- every game before this flag existed is unchanged", () => {
    expect(readSkipVoice(undefined)).toBe(false);
  });

  it("defaults to false when set to the empty string", () => {
    expect(readSkipVoice("")).toBe(false);
  });

  it("recognises '1'", () => {
    expect(readSkipVoice("1")).toBe(true);
  });

  it("throws on an unrecognised value -- never silently falls back", () => {
    expect(() => readSkipVoice("true")).toThrow(/PRISONER_SKIP_VOICE/);
  });
});

describe("resolveVoiceModel", () => {
  it("skipping voice collapses it onto the wits model, regardless of what was configured", () => {
    expect(resolveVoiceModel("qwen3:14b", "ancient-awakening:12b", true)).toBe("qwen3:14b");
  });

  it("not skipping voice keeps the configured voice model", () => {
    expect(resolveVoiceModel("qwen3:14b", "ancient-awakening:12b", false)).toBe("ancient-awakening:12b");
  });
});

/**
 * OPEN-VARIANT.md §33.16: on the unchanged referee prompt, qwen3:14b rules an
 * attempt to remove a part as the way out opening (24 of 26 controls), where
 * qwen2.5:14b rules it wear and no rewording fixed that without breaking
 * leave. The owner made qwen3:14b the default (2026-09-16).
 */
describe("the referee model", () => {
  it("defaults to qwen3:14b when PRISONER_REFEREE_MODEL is unset or empty", () => {
    expect(resolveRefereeModel(undefined)).toBe("qwen3:14b");
    expect(resolveRefereeModel("")).toBe("qwen3:14b");
  });

  it("uses the model a run names", () => {
    expect(resolveRefereeModel("qwen2.5:14b")).toBe("qwen2.5:14b");
  });
});
