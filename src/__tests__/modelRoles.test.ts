import { describe, it, expect, afterEach } from "vitest";
import {
  readSkipVoice,
  resolveVoiceModel,
  resolveRefereeModel,
  resolveSeatModels,
  seatModelNames,
  openModelHeaderLines,
  closedModelHeaderLines,
  readProseSeat,
} from "../modelRoles.js";

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

/**
 * Per-seat mind models (2026-09-24, batch 4): the batch that puts a local
 * 30B in the WARDEN's chair against an Opus prisoner needs two different
 * minds in one game, and until now `checkpoint.ts` had one pair of model
 * names for both chairs. `PRISONER_PRISONER_MODEL` and
 * `PRISONER_WARDEN_MODEL` name a chair's model; unset, every game is
 * byte-identical to the one it would have been before these existed, which
 * is what the fingerprint tests below check rather than take on trust.
 */
describe("resolveSeatModels", () => {
  const fallback = { wits: "claude-opus-4-6", voice: "claude-opus-4-6" } as const;

  it("unset leaves the chair on the configured pair -- the same object shape, byte for byte", () => {
    expect(resolveSeatModels(undefined, fallback)).toEqual({ wits: "claude-opus-4-6", voice: "claude-opus-4-6" });
  });

  it("empty is unset, exactly as PRISONER_REFEREE_MODEL treats it", () => {
    expect(resolveSeatModels("", fallback)).toEqual({ wits: "claude-opus-4-6", voice: "claude-opus-4-6" });
  });

  it("a named model takes the WHOLE chair, wits and voice both", () => {
    // Not only the wits call: a warden whose wits ran on the 4090 and whose
    // voice ran on Opus would spend the arm's money on a line of dialogue
    // that never reaches the referee (`open/mind.ts`), and the batch would
    // no longer be "one model, two roles".
    expect(resolveSeatModels("muse-glimmer-30b-q4_k_m", fallback)).toEqual({
      wits: "muse-glimmer-30b-q4_k_m",
      voice: "muse-glimmer-30b-q4_k_m",
    });
  });

  it("keeps a configured voice model for the chair that names no model of its own", () => {
    expect(resolveSeatModels(undefined, { wits: "qwen3:14b", voice: "ancient-awakening:12b" })).toEqual({
      wits: "qwen3:14b",
      voice: "ancient-awakening:12b",
    });
  });
});

describe("seatModelNames", () => {
  it("two chairs on the same pair name exactly what one chair named -- the swapper's roster is unchanged", () => {
    const pair = { wits: "qwen3:14b", voice: "ancient-awakening:12b" } as const;
    expect(seatModelNames(pair, pair)).toEqual(["qwen3:14b", "ancient-awakening:12b"]);
  });

  it("a second model in the warden's chair joins the roster, so the foreign-model guard does not stop the run", () => {
    expect(
      seatModelNames({ wits: "claude-opus-4-6", voice: "claude-opus-4-6" }, { wits: "muse-glimmer-30b-q4_k_m", voice: "muse-glimmer-30b-q4_k_m" })
    ).toEqual(["claude-opus-4-6", "muse-glimmer-30b-q4_k_m"]);
  });
});

describe("the open variant's model header", () => {
  const opus = { wits: "claude-opus-4-6", voice: "claude-opus-4-6" } as const;

  it("is byte-identical to batch 3's own header line when both chairs agree", () => {
    expect(
      openModelHeaderLines({ prisoner: opus, warden: opus, refereeModel: "muse-glimmer-30b-q4_k_m", modelUrl: "http://localhost:8799/v1" })
    ).toEqual(["Wits model: `claude-opus-4-6`. Voice model: `claude-opus-4-6`. Referee model: `muse-glimmer-30b-q4_k_m`. At `http://localhost:8799/v1`."]);
  });

  it("is byte-identical to an older two-role header when the chairs agree on a wits/voice split", () => {
    const split = { wits: "qwen3:14b", voice: "ancient-awakening:12b" } as const;
    expect(openModelHeaderLines({ prisoner: split, warden: split, refereeModel: "qwen2.5:14b", modelUrl: "http://doris:11434/v1" })).toEqual([
      "Wits model: `qwen3:14b`. Voice model: `ancient-awakening:12b`. Referee model: `qwen2.5:14b`. At `http://doris:11434/v1`.",
    ]);
  });

  it("names BOTH chairs when they differ, and never a single 'Wits model:' line a reader could pool with a one-model batch", () => {
    const muse = { wits: "muse-glimmer-30b-q4_k_m", voice: "muse-glimmer-30b-q4_k_m" } as const;
    const lines = openModelHeaderLines({ prisoner: opus, warden: muse, refereeModel: "muse-glimmer-30b-q4_k_m", modelUrl: "http://localhost:8799/v1" });
    expect(lines).toEqual([
      "Prisoner's chair -- wits model: `claude-opus-4-6`. Voice model: `claude-opus-4-6`.",
      "Warden's chair -- wits model: `muse-glimmer-30b-q4_k_m`. Voice model: `muse-glimmer-30b-q4_k_m`.",
      "Referee model: `muse-glimmer-30b-q4_k_m`. At `http://localhost:8799/v1`.",
    ]);
    expect(lines.some((l) => l.startsWith("Wits model:"))).toBe(false);
  });
});

describe("the closed variant's model header", () => {
  const qwen = { wits: "qwen3:14b", voice: "qwen3:14b" } as const;

  it("is byte-identical to a recorded single-model header when both chairs agree and voice is the wits model", () => {
    expect(closedModelHeaderLines({ prisoner: qwen, warden: qwen, modelUrl: "http://doris:11434/v1", thinkTimeout: "60000" })).toEqual([
      "Model: `qwen3:14b` at `http://doris:11434/v1`. Think timeout: 60000.",
    ]);
  });

  it("keeps the recorded three-line form when the chairs agree on a wits/voice split", () => {
    const split = { wits: "qwen3:14b", voice: "ancient-awakening:12b" } as const;
    expect(closedModelHeaderLines({ prisoner: split, warden: split, modelUrl: "http://doris:11434/v1", thinkTimeout: "package default (12000ms)" })).toEqual([
      "Wits model: `qwen3:14b` at `http://doris:11434/v1`.",
      "Voice model: `ancient-awakening:12b` at `http://doris:11434/v1`.",
      "Think timeout: package default (12000ms).",
    ]);
  });

  it("names both chairs when they differ", () => {
    expect(
      closedModelHeaderLines({
        prisoner: qwen,
        warden: { wits: "muse-glimmer-30b-q4_k_m", voice: "muse-glimmer-30b-q4_k_m" },
        modelUrl: "http://doris:11434/v1",
        thinkTimeout: "60000",
      })
    ).toEqual([
      "Prisoner's chair -- wits model: `qwen3:14b`. Voice model: `qwen3:14b`.",
      "Warden's chair -- wits model: `muse-glimmer-30b-q4_k_m`. Voice model: `muse-glimmer-30b-q4_k_m`.",
      "At `http://doris:11434/v1`. Think timeout: 60000.",
    ]);
  });
});

/**
 * The prose seat switch (2026-09-24). Which chair, if any, is asked ONE
 * question instead of an eight-field JSON object (`src/open/proseMind.ts`).
 * Unset is every game ever recorded.
 */
describe("PRISONER_PROSE_SEAT", () => {
  it("defaults to off when unset or empty -- every recorded game is unchanged", () => {
    expect(readProseSeat(undefined)).toBe("off");
    expect(readProseSeat("")).toBe("off");
  });

  it("names a chair", () => {
    expect(readProseSeat("prisoner")).toBe("prisoner");
    expect(readProseSeat("warden")).toBe("warden");
  });

  it("throws on anything else -- never guessed past (root CLAUDE.md hard rule 3)", () => {
    expect(() => readProseSeat("both")).toThrow(/PRISONER_PROSE_SEAT/);
    expect(() => readProseSeat("1")).toThrow(/PRISONER_PROSE_SEAT/);
  });
});
