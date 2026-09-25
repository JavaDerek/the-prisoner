// `strategy.ts`'s tests, written before the module (docs/STRATEGY-DESIGN.md §3.7, §6 step 3).
//
// THE FIRST TEST IN THIS FILE IS THE BYTE-IDENTITY GUARD, and it is first on purpose: the whole point
// of an off-by-default module is that every recorded batch stays poolable with everything run after it.
// `thinking.ts` earned that guarantee by returning `fetchFn` completely untouched under its default; this
// module earns it by never being reached at all unless a switch is set, and the guard is what proves it
// rather than asserting it in a comment.
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOptionsPrompt, buildCommitPrompt, coerceStrategy, chooseStrategy, readStrategyMode, strategyHeaderBlock, revisionWouldFireAt, revisionHeaderLine, OPTIONS_ASK, type StrategyOption } from "../strategy.js";
import { withReasoningStrength } from "../thinking.js";

const IDS = ["alpha", "beta", "gamma", "delta"] as const;
const OPTIONS: StrategyOption[] = [
  { n: 1, text: "Work the first thing" },
  { n: 2, text: "Work the second thing" },
  { n: 3, text: "Work the third thing" },
];

describe("the switch, and the guard that the module is unreachable without it", () => {
  it("reads unset and empty as off, and throws on anything it does not know", () => {
    expect(readStrategyMode(undefined)).toBe("off");
    expect(readStrategyMode("")).toBe("off");
    expect(readStrategyMode("fixed")).toBe("fixed");
    expect(readStrategyMode("revise")).toBe("revise");
    // The `readPickCondition` pattern (§3.7): a typo is a stopped run, never a silent default.
    expect(() => readStrategyMode("on")).toThrow(/PRISONER_STRATEGY/);
    expect(() => readStrategyMode("yes")).toThrow(/"fixed"/);
  });

  it("prints the OFF header line when off, and a block naming the field and strength when on", () => {
    expect(strategyHeaderBlock("off", null)).toBe("Strategy: OFF (baseline).");
    const block = strategyHeaderBlock("fixed", {
      options: OPTIONS,
      chosen: 2,
      sentence: "Work the second thing until it gives.",
      targets: ["beta"],
      reasoningField: "chat_template_kwargs.reasoning_strength",
      reasoningStrength: "high",
      optionsTokens: 608,
      commitTokens: 4492,
      rawOptions: { content: "[...]", reasoning: "" },
      rawCommit: { content: '{"chosen":2}', reasoning: "thinking..." },
    });
    // The strength AND the field, because §1.1 found a switch that named a field the server ignores.
    expect(block).toContain("chat_template_kwargs.reasoning_strength");
    expect(block).toContain("high");
    expect(block).toContain("2");
    expect(block).toContain("beta");
    expect(block).toContain("Work the second thing until it gives.");
    // Both raw replies, so a gate failure in game 1 is readable as what it was (§3.2).
    expect(block).toContain('{"chosen":2}');
    expect(block).toContain("thinking...");
  });
});

describe("the reasoning wrapper", () => {
  it("adds chat_template_kwargs, which is the field this server actually honours", async () => {
    let sent: unknown = null;
    const fake: typeof fetch = async (_input, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    };
    const wrapped = withReasoningStrength(fake, "high");
    await wrapped!("http://x/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "m", messages: [] }) });
    expect(sent).toMatchObject({ model: "m", chat_template_kwargs: { reasoning_strength: "high" } });
    // NOT reasoning_effort: that field is a measured no-op here (§1.1) and sending it would restate the bug.
    expect(sent).not.toHaveProperty("reasoning_effort");
  });

  it("leaves a body it cannot parse completely alone rather than inventing a failure", async () => {
    const bodies: (string | undefined)[] = [];
    const fake: typeof fetch = async (_i, init) => {
      bodies.push(init?.body as string | undefined);
      return new Response("{}", { status: 200 });
    };
    const wrapped = withReasoningStrength(fake, "high");
    await wrapped!("http://x", { method: "POST", body: "not json" });
    await wrapped!("http://x", { method: "POST", body: JSON.stringify([1, 2]) });
    expect(bodies).toEqual(["not json", "[1,2]"]);
  });
});

describe("the prompts", () => {
  const situation = "You are in a room.\nWhat you can currently reach or perceive:\n- alpha: a thing";

  it("puts the situation first and asks for a list, choosing nothing", () => {
    const p = buildOptionsPrompt(situation);
    expect(p.startsWith(situation)).toBe(true);
    expect(p).toContain(OPTIONS_ASK);
    expect(p).toMatch(/choose nothing/i);
  });

  it("fixes the numbers to the options, so a shuffled list still identifies them", () => {
    const p = buildCommitPrompt(situation, [OPTIONS[2]!, OPTIONS[0]!, OPTIONS[1]!]);
    // Shown third-first, but each line keeps its own number.
    expect(p.indexOf("3. Work the third thing")).toBeLessThan(p.indexOf("1. Work the first thing"));
    expect(p).toContain("2. Work the second thing");
    expect(p).toMatch(/at most 200 characters/);
  });

  it("carries a precedent block only when one is given, under the same switch as the turn prompt", () => {
    expect(buildOptionsPrompt(situation)).not.toContain("Previously");
    const withPrecedent = buildOptionsPrompt(situation, ["Previously: someone tried the first thing."]);
    expect(withPrecedent).toContain("Previously: someone tried the first thing.");
  });
});

describe("coerceStrategy", () => {
  it("takes a well-formed object", () => {
    const s = coerceStrategy('{"chosen":2,"strategy":"Keep at the second thing.","targets":["beta"]}', OPTIONS, IDS);
    expect(s).toEqual({ chosen: 2, sentence: "Keep at the second thing.", targets: ["beta"] });
  });

  it("finds the object inside a wrapped or chattered reply -- the red team's first point", () => {
    const wrapped = [
      'Sure, here is my choice:\n{"chosen":1,"strategy":"One.","targets":["alpha"]}',
      '```json\n{"chosen":1,"strategy":"One.","targets":["alpha"]}\n```',
      '{"chosen":1,"strategy":"One.","targets":["alpha"]}\n\nLet me know if you want another.',
    ];
    for (const raw of wrapped) expect(coerceStrategy(raw, OPTIONS, IDS)?.chosen).toBe(1);
  });

  it("rejects an index outside the fixed list, and never guesses one", () => {
    expect(coerceStrategy('{"chosen":9,"strategy":"x","targets":["alpha"]}', OPTIONS, IDS)).toBeNull();
    expect(coerceStrategy('{"chosen":0,"strategy":"x","targets":["alpha"]}', OPTIONS, IDS)).toBeNull();
    expect(coerceStrategy('{"strategy":"x","targets":["alpha"]}', OPTIONS, IDS)).toBeNull();
  });

  it("is null when no id survives membership -- the one thing that makes a strategy uncheckable", () => {
    expect(coerceStrategy('{"chosen":1,"strategy":"x","targets":["nothing_like_this"]}', OPTIONS, IDS)).toBeNull();
    expect(coerceStrategy('{"chosen":1,"strategy":"x","targets":[]}', OPTIONS, IDS)).toBeNull();
  });

  it("matches ids case-insensitively and drops duplicates, keeping at most two", () => {
    const s = coerceStrategy('{"chosen":1,"strategy":"x","targets":["ALPHA","alpha","Beta","gamma"]}', OPTIONS, IDS);
    expect(s?.targets).toEqual(["alpha", "beta"]);
  });

  it("caps the sentence at 200 characters rather than rejecting a long one", () => {
    const long = "x".repeat(400);
    const s = coerceStrategy(JSON.stringify({ chosen: 1, strategy: long, targets: ["alpha"] }), OPTIONS, IDS);
    expect(s?.sentence).toHaveLength(200);
  });

  it("reads every reply the 2026-09-24 commit probe actually recorded", () => {
    // §6 step 3(h): the twelve real replies, so the chatter trap is a test that passes before game 1
    // rather than a discovery in it. The probe's own options were five, numbered 1-5.
    const here = fileURLToPath(new URL(".", import.meta.url));
    const path = join(here, "..", "..", "..", "checkpoints", "2026-09-24-strategy-commit-probe", "replies.jsonl");
    const lines = readFileSync(path, "utf8").trim().split("\n");
    expect(lines).toHaveLength(12);
    const five: StrategyOption[] = [1, 2, 3, 4, 5].map((n) => ({ n, text: `option ${n}` }));
    const ids = ["window", "bar", "door", "lock", "spoon", "loose_tile", "cot", "blanket", "bucket", "meal_tray", "key_ring", "banknotes"];
    for (const line of lines) {
      const rec = JSON.parse(line) as { content: string };
      // The recorded `content` is truncated to 160 chars in that probe, so a cut-off reply is expected
      // for some rows; what must never happen is a THROW.
      expect(() => coerceStrategy(rec.content, five, ids)).not.toThrow();
    }
    // At least the un-truncated majority must actually read, or the coercion is not doing its job.
    const read = lines.filter((l) => coerceStrategy((JSON.parse(l) as { content: string }).content, five, ids) !== null);
    expect(read.length).toBeGreaterThanOrEqual(8);
  });
});

describe("chooseStrategy", () => {
  const context = { situation: "You are in a room.", objectIds: IDS };

  it("makes two calls, the first at none and the second at the strength it was given", async () => {
    const asked: { reasoning: string }[] = [];
    const strategy = await chooseStrategy({
      context,
      reasoningStrength: "high",
      ask: async (_prompt, opts) => {
        asked.push({ reasoning: opts.reasoning });
        return asked.length === 1
          ? { content: '[{"text":"Work alpha"},{"text":"Work beta"}]', reasoning: "", tokens: 10 }
          : { content: '{"chosen":2,"strategy":"Beta it is.","targets":["beta"]}', reasoning: "thought", tokens: 20 };
      },
    });
    expect(asked.map((a) => a.reasoning)).toEqual(["none", "high"]);
    expect(strategy?.chosen).toBe(2);
    expect(strategy?.targets).toEqual(["beta"]);
    expect(strategy?.options).toHaveLength(2);
    expect(strategy?.rawCommit.reasoning).toBe("thought");
  });

  it("collapses exact duplicate options, keeping the first (§20.1's rule)", async () => {
    const strategy = await chooseStrategy({
      context,
      reasoningStrength: "high",
      ask: async (_p, opts) =>
        opts.reasoning === "none"
          ? { content: '[{"text":"Same"},{"text":"Same"},{"text":"Other"}]', reasoning: "", tokens: 1 }
          : { content: '{"chosen":2,"strategy":"s","targets":["alpha"]}', reasoning: "", tokens: 1 },
    });
    expect(strategy?.options.map((o) => o.text)).toEqual(["Same", "Other"]);
  });

  it("is null when the options call yields nothing, and never asks the second question", async () => {
    let calls = 0;
    const strategy = await chooseStrategy({
      context,
      reasoningStrength: "high",
      ask: async () => {
        calls++;
        return { content: "I would rather not.", reasoning: "", tokens: 1 };
      },
    });
    expect(strategy).toBeNull();
    expect(calls).toBe(1);
  });

  it("is null when the commit call cannot be coerced, rather than inventing a strategy", async () => {
    const strategy = await chooseStrategy({
      context,
      reasoningStrength: "high",
      ask: async (_p, opts) =>
        opts.reasoning === "none"
          ? { content: '[{"text":"Work alpha"}]', reasoning: "", tokens: 1 }
          : { content: "no object here at all", reasoning: "", tokens: 1 },
    });
    expect(strategy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// (e) and (g): the briefing line, and adherence. Both are byte-identity guards first.
import { buildOpenBriefing } from "../briefing.js";
import { buildOpenWorld } from "../world.js";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { currentT } from "../../world/clock.js";
import { buildOpenContext } from "../briefing.js";
import { renderSeatSituation } from "../mind.js";
import { seedInitialBeliefs } from "../../ledger/beliefs.js";
import { adherenceByGame, parseTranscript } from "../batchMeasures.js";

describe("the briefing line (D5)", () => {
  afterEach(() => destroyTestDb());

  function briefing(news: Parameters<typeof buildOpenBriefing>[5]) {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    seedInitialBeliefs(w.base);
    return buildOpenBriefing(w, "prisoner", w.base.clock.prisonerT(1), 1, 10, news, "modelled");
  }

  it("is byte-identical with no strategy -- the guard that every recorded batch stays poolable", () => {
    // The same guarantee `thinking.ts` gives by returning fetchFn untouched: with the switch off there is
    // no line, no blank line, and no whitespace difference, so an OFF game's prompt cannot have drifted.
    expect(briefing({})).toBe(briefing({ strategy: undefined }));
    expect(briefing({})).not.toContain("Your strategy for this game");
  });

  it("renders exactly one line, beside where the plan line goes", () => {
    const b = briefing({ strategy: "Work the second thing until it gives." });
    expect(b).toContain("Your strategy for this game: Work the second thing until it gives.");
    expect(b.split("\n").filter((l) => l.startsWith("Your strategy for this game:"))).toHaveLength(1);
  });

  it("is shown unchanged whether or not the turn also carries a plan", () => {
    const withBoth = briefing({ strategy: "Hold the line.", plan: "Keep scraping." });
    expect(withBoth).toContain("Your strategy for this game: Hold the line.");
    expect(withBoth).toContain("Your plan, from your last turn: Keep scraping.");
  });
});

describe("adherenceByGame (§3.4)", () => {
  // A minimal transcript in the real shape: the header block this module prints, then rounds.
  const transcript = (targets: string, rounds: { target: string; ruled?: string }[]) =>
    [
      "# Checkpoint",
      "Wits model: `m`",
      "Referee model: `m`",
      `Chosen: 2. Declared targets: ${targets}.`,
      "",
      ...rounds.flatMap((r, i) => [
        `### Round ${i + 1} (t=${i + 1}) -- the prisoner`,
        "",
        "| question | answer | citation | verbatim |",
        "|---|---|---|---|",
        `| target | \`${r.target}\` | "x" | yes |`,
        `| effect | \`wear\` | "x" | yes |`,
        `**Ruled ${r.ruled ?? "possible"}.**`,
        "",
      ]),
    ].join("\n");

  it("counts a turn on-strategy only when the referee's own target is a declared id", () => {
    const t = parseTranscript(transcript("bar, spoon", [{ target: "bar" }, { target: "spoon" }, { target: "cot" }]));
    const a = adherenceByGame([{ arm: "T", transcript: t, replies: [] }])[0]!;
    expect(a.onStrategy).toBe(2);
    expect(a.offStrategy).toBe(1);
    expect(a.refused).toBe(0);
    // Refused turns are IN the denominator (§3.4), so the share is over every graded prisoner turn.
    expect(a.share).toBeCloseTo(2 / 3);
  });

  it("puts a refusal in the denominator and reports it separately, never as off-strategy", () => {
    const t = parseTranscript(transcript("bar", [{ target: "bar" }, { target: "none", ruled: "impossible" }]));
    const a = adherenceByGame([{ arm: "T", transcript: t, replies: [] }])[0]!;
    expect(a.onStrategy).toBe(1);
    expect(a.refused).toBe(1);
    expect(a.offStrategy).toBe(0);
    expect(a.share).toBeCloseTo(1 / 2);
  });

  it("reports null targets for a game with no strategy block, so an OFF arm is not scored as 0%", () => {
    const t = parseTranscript("# Checkpoint\nWits model: `m`\nReferee model: `m`\nStrategy: OFF (baseline).\n");
    const a = adherenceByGame([{ arm: "P", transcript: t, replies: [] }])[0]!;
    expect(a.targets).toBeNull();
    expect(a.share).toBeNull();
  });
});

describe("the revision trigger, logged even when off (§3.5, red team point 3)", () => {
  const t = (...stalls: boolean[]) => stalls.map((stalled) => ({ stalled }));

  it("fires on the third consecutive stalled turn and names that round", () => {
    expect(revisionWouldFireAt(t(true, true, true))).toBe(3);
    expect(revisionWouldFireAt(t(false, true, true, true, false))).toBe(4);
  });

  it("never fires when the run is broken, however many stalls there are in total", () => {
    expect(revisionWouldFireAt(t(true, true, false, true, true, false, true, true))).toBe("never");
    expect(revisionWouldFireAt([])).toBe("never");
  });

  it("reports the first firing only, because the cap is once a game", () => {
    expect(revisionWouldFireAt(t(true, true, true, true, true, true))).toBe(3);
  });

  it("prints a line either way, so every game in the arm says something", () => {
    expect(revisionHeaderLine(4)).toBe("Revision would have fired: round 4");
    expect(revisionHeaderLine("never")).toBe("Revision would have fired: never");
  });
});

describe("the clock trap the strategy step fell into (batch 7 game 1, 05:24Z)", () => {
  afterEach(() => destroyTestDb());

  it("wardenT and prisonerT MOVE the clock; t0 does not -- which is why the step reads t0", () => {
    // Batch 7's first game died before round 1: the strategy step called `prisonerT(1)` to get a time for
    // `buildOpenContext`, which moved the story clock to t0+3, and `runOpenGame`'s own first call (the
    // warden at t0+2) then hit run-dmcp's "t never runs backwards" rule. These accessors read like getters
    // and are not, so the property is pinned here rather than left to a comment.
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    seedInitialBeliefs(w.base);
    const { clock, gameId } = { clock: w.base.clock, gameId: w.base.gameId };
    const t0 = clock.t0;
    expect(currentT(gameId)).toBe(t0);
    // Reading t0 as many times as you like moves nothing.
    expect(clock.t0).toBe(t0);
    expect(currentT(gameId)).toBe(t0);
    // Asking for a half-round's time moves the clock there, as a side effect of the read.
    expect(clock.prisonerT(1)).toBe(t0 + 3);
    expect(currentT(gameId)).toBe(t0 + 3);
    // And that is exactly what made the warden's own first half-round impossible afterwards.
    expect(() => clock.wardenT(1)).toThrow(/never runs backwards/);
  });

  it("the pre-episode situation is the same at t0 as at the prisoner's round-1 t, on a fresh world", () => {
    // Why the fix does not change what the model reads, which is what §5.1's cross-batch claim needs:
    // nothing has happened on a fresh world, so the two renderings are byte-identical. The probe rendered
    // at prisonerT(1); the batch renders at t0; they agree.
    createTestDb();
    const a = buildOpenWorld({ presence: "modelled" });
    seedInitialBeliefs(a.base);
    const atT0 = renderSeatSituation("Voss", "Croft", buildOpenContext(a, "prisoner", a.base.clock.t0, 1, 10, {}, "modelled"));
    destroyTestDb();
    createTestDb();
    const b = buildOpenWorld({ presence: "modelled" });
    seedInitialBeliefs(b.base);
    const atRound1 = renderSeatSituation("Voss", "Croft", buildOpenContext(b, "prisoner", b.base.clock.prisonerT(1), 1, 10, {}, "modelled"));
    expect(atT0).toBe(atRound1);
  });
});
