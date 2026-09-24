import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseTranscript,
  parseRefereeReplies,
  lostRulings,
  escapesAsAnswered,
  reachByArm,
  reachByChair,
  competenceByChair,
  shortCitations,
  refusalAudit,
  parseResidue,
  parseMeasuresArgs,
  renderBatchMeasures,
  type Game,
} from "../batchMeasures.js";

// Hand-written excerpts in exactly the shape `checkpointTranscript.ts` writes:
// the half-round heading, the referee table, the `**Ruled:**` line, the
// `## Result` line and the §22 plans line. Prose (thoughts, intents, lines)
// is deliberately nonsense here -- nothing below may read it.
const HEADER = [
  "# The Prisoner -- checkpoint transcript (open variant)",
  "",
  "Wits model: `test-wits`. Voice model: `test-voice`. Referee model: `test-referee`. At `http://nowhere/v1`.",
  "",
  "## Rounds",
  "",
].join("\n");

function table(rows: [string, string, string, string][]): string {
  return ["| question | answer | citation | verified |", "|---|---|---|---|", ...rows.map(([q, a, c, v]) => `| ${q} | \`${a}\` | ${c} | ${v} |`)].join("\n");
}

const GAME_A = [
  HEADER,
  "### Round 1 (t=3) -- the warden",
  "",
  "**Intent:** lorem ipsum",
  "**Replanned because:** First turn.",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "bar", 'intent, words 3-3: "bar"', "yes"],
    ["effect", "reveal", 'intent, words 1-2: "examine the"', "yes"],
    ["product", "none", 'intent, words 1-2: "examine the"', "n/a"],
    ["property", "integrity", 'desc:bar, words 20-38: "Rust has pitted it near the bottom."', "yes"],
    ["magnitude", "moderate", 'intent, words 4-5: "grip it"', "n/a"],
    ["perceptibility", "visible", 'intent, words 6-7: "in view"', "n/a"],
  ]),
  "",
  "**Ruled:** possible",
  "**Actor learns:** lorem",
  "",
  "### Round 1 (t=4) -- the prisoner",
  "",
  "**Intent:** lorem ipsum",
  "**Replanned because:** First turn.",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "door", 'intent, words 60-60: "gap"', "yes"],
    ["effect", "open", 'intent, words 70-73: "push it back toward"', "yes"],
    ["product", "none", 'intent, words 70-73: "push it back toward"', "n/a"],
    ["property", "passage", 'desc:door, words 28-28: "the"', "yes"],
    ["magnitude", "moderate", 'intent, words 51-52: "flat worn"', "n/a"],
    ["perceptibility", "silent", 'intent, words 34-48: "keeping my hand low"', "n/a"],
  ]),
  "",
  "**Ruled:** possible",
  "",
  "### Round 2 (t=5) -- the warden",
  "",
  "**Intent:** lorem ipsum",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "spoon", 'intent, words 1-3: "Confiscate the spoon"', "yes"],
    ["effect", "none", 'intent, words 1-4: "Confiscate the spoon from"', "yes"],
    ["product", "none", 'intent, words 1-4: "Confiscate the spoon from"', "n/a"],
    ["property", "none", 'desc:spoon, words 1-3: "A dented aluminium"', "yes"],
    ["magnitude", "moderate", 'intent, words 8-11: "pick it up off"', "n/a"],
    ["perceptibility", "visible", 'intent, words 30-33: "my eyes on Voss"', "n/a"],
  ]),
  "",
  "- product: rejected (empty-quote) `none`, none: \"\"",
  "",
  "**Ruled:** impossible",
  "",
  "### Round 2 (t=6) -- the prisoner",
  "",
  "**Voice silence.** SilenceReason: `timeout`.",
  "**Intent:** lorem ipsum",
  "**Replanned because:** The door is open.",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "none", "(none)", "no"],
    ["effect", "none", "(none)", "no"],
    ["product", "none", "(none)", "n/a"],
    ["property", "none", "(none)", "no"],
    ["magnitude", "slight", "(none)", "n/a"],
    ["perceptibility", "silent", "(none)", "n/a"],
  ]),
  "",
  "No offer from the referee for: target, effect, product, property, magnitude, perceptibility.",
  "",
  "**Ruled:** impossible",
  "",
  "## Result",
  "",
  "**Timeout after 2 rounds -- the warden wins by default.**",
  "",
  "## Measurements (OPEN-VARIANT.md §5.2)",
  "",
  "Total intents: 4. Silences: 0.",
  "",
  "Prisoner plans (§22): replanned 1 of 1 turns that had a plan, kept 0.",
  "",
].join("\n");

const GAME_B = [
  HEADER,
  "### Round 1 (t=3) -- the warden",
  "",
  "**Silence.** SilenceReason: `timeout`.",
  "",
  "### Round 1 (t=4) -- the prisoner",
  "",
  "**Intent:** lorem ipsum",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "warden", 'intent, words 2-3: "past Croft"', "yes"],
    ["effect", "wear", 'intent, words 1-1: "Rub"', "no"],
    ["product", "none", 'intent, words 1-1: "Rub"', "n/a"],
    ["property", "posture", 'desc:warden, words 4-6: "on her feet"', "yes"],
    ["magnitude", "moderate", 'intent, words 4-5: "hard shove"', "n/a"],
    ["perceptibility", "visible", 'intent, words 6-7: "in view"', "n/a"],
  ]),
  "",
  "**Ruled:** possible",
  "",
  "### Round 2 (t=5) -- the warden",
  "",
  "**Intent:** lorem ipsum",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "bar", 'intent, words 12-12: "bar"', "yes"],
    ["effect", "reveal", 'intent, words 1-2: "check the"', "yes"],
    ["product", "none", 'intent, words 1-2: "check the"', "n/a"],
    ["property", "integrity", 'desc:bar, words 20-21: "Rust has"', "yes"],
    ["magnitude", "slight", 'intent, words 4-5: "a glance"', "n/a"],
    ["perceptibility", "visible", 'intent, words 6-7: "in view"', "n/a"],
  ]),
  "",
  "**Ruled:** possible",
  "",
  "### Round 2 (t=6) -- the prisoner",
  "",
  "**Intent:** lorem ipsum",
  "**Plan:** dolor sit amet",
  "",
  "**Referee:**",
  "",
  table([
    ["target", "door", 'intent, words 36-42: "through the open doorway into the corridor."', "yes"],
    ["effect", "leave", 'intent, words 36-42: "through the open doorway into the corridor."', "yes"],
    ["product", "none", 'intent, words 36-42: "through the open doorway into the corridor."', "n/a"],
    ["property", "passage", 'desc:door, words 32-33: "open now."', "yes"],
    ["magnitude", "substantial", 'intent, words 35-35: "sprint"', "n/a"],
    ["perceptibility", "visible", 'intent, words 36-42: "through the open doorway into the corridor."', "n/a"],
  ]),
  "",
  "**Ruled:** possible",
  "",
  "## Result",
  "",
  "**The prisoner escaped, at round 2.**",
  "",
  "## Measurements (OPEN-VARIANT.md §5.2)",
  "",
  "Total intents: 3. Silences: 1.",
  "",
  "Prisoner plans (§22): replanned 0 of 1 turns that had a plan, kept 1.",
  "",
].join("\n");

function games(): Game[] {
  return [
    { arm: "X", transcript: parseTranscript(GAME_A, "X/a.md"), replies: [] },
    { arm: "X", transcript: parseTranscript(GAME_B, "X/b.md"), replies: [] },
  ];
}

describe("parseTranscript -- structural lines only", () => {
  it("reads the header, every half-round heading, the ruling keys and the verified column", () => {
    const t = parseTranscript(GAME_A, "X/a.md");
    expect(t.wits).toBe("test-wits");
    expect(t.referee).toBe("test-referee");
    expect(t.escaped).toBe(false);
    expect(t.halves).toHaveLength(4);
    const [w1, p1, w2, p2] = t.halves;
    expect(w1).toMatchObject({ round: 1, principal: "warden", silence: false, voiceSilence: false, hadPlan: true, replanned: true });
    expect(w1.ruling).toMatchObject({ target: "bar", effect: "reveal", property: "integrity", magnitude: "moderate", ruled: "possible" });
    expect(w1.ruling?.rows.map((r) => r.verified)).toEqual(["yes", "yes", "n/a", "yes", "n/a", "n/a"]);
    expect(w1.ruling?.rows[0].citation).toEqual({ sourceId: "intent", from: 3, to: 3, quote: "bar" });
    expect(p1.ruling).toMatchObject({ target: "door", effect: "open", property: "passage" });
    expect(w2).toMatchObject({ hadPlan: true, replanned: false });
    expect(w2.ruling).toMatchObject({ target: "spoon", effect: "none", ruled: "impossible", rejected: ["product"] });
    expect(p2).toMatchObject({ voiceSilence: true, replanned: true });
    expect(p2.ruling).toMatchObject({ target: "none", effect: "none", ruled: "impossible" });
    expect(p2.ruling?.rows[0].citation).toBeNull();
    expect(t.printedPlans).toEqual({ replanned: 1, withPlan: 1, kept: 0 });
  });

  it("a half-round with no referee table is a decision silence, never a refusal", () => {
    const t = parseTranscript(GAME_B, "X/b.md");
    expect(t.escaped).toBe(true);
    expect(t.halves[0]).toMatchObject({ round: 1, principal: "warden", silence: true, ruling: null });
    expect(t.halves.filter((h) => h.ruling).length).toBe(3);
  });
});

describe("reach family (OPUS-FIRST-DESIGN.md §5.2)", () => {
  it("per arm reproduces count.mts's five columns", () => {
    const r = reachByArm(games());
    expect(r.games).toBe(2);
    expect(r.intents).toBe(7);
    expect(r.silences).toBe(1);
    // game A: bar, door, spoon = 3; game B: warden, bar, door = 3.
    expect(r.meanDistinctTargets).toBeCloseTo(3);
    expect(r.personTargetGames).toBe(1);
    // game A: reveal, open = 2; game B: wear, reveal, leave = 3.
    expect(r.meanDistinctEffects).toBeCloseTo(2.5);
    expect(r.grounded).toBe(5);
    expect(r.refused).toBe(2);
    expect(r.escapes).toBe(1);
  });

  it("per chair: distinct targets, person targets, effects, route finding, first contact, residue", () => {
    const p = reachByChair(games(), "prisoner", parseResidue("spoon/none,none/none"));
    expect(p.intents).toBe(4);
    expect(p.distinctTargets).toEqual(["door", "warden"]);
    expect(p.meanDistinctTargets).toBeCloseTo(1.5); // A: door; B: warden, door
    expect(p.personTargets).toBe(1);
    expect(p.distinctEffects).toEqual(["leave", "open", "wear"]);
    expect(p.grounded).toBe(3);
    expect(p.refused).toBe(1);
    // Route finding is `property: passage`, the referee's own key -- never the word "door".
    expect(p.routeFinding).toBe(2);
    expect(p.firstContact).toEqual({ door: { meanRound: 1.5, games: 2 }, warden: { meanRound: 1, games: 1 } });
    expect(p.residueRefusals).toBe(1); // A r2 prisoner: none/none

    const w = reachByChair(games(), "warden", parseResidue("spoon/none"));
    expect(w.intents).toBe(3);
    expect(w.distinctTargets).toEqual(["bar", "spoon"]);
    expect(w.personTargets).toBe(0);
    expect(w.routeFinding).toBe(0);
    expect(w.firstContact).toEqual({ bar: { meanRound: 1.5, games: 2 }, spoon: { meanRound: 2, games: 1 } });
    expect(w.residueRefusals).toBe(1);
    expect(w.silences).toBe(1);
  });
});

describe("competence family (§5.2), all structural", () => {
  it("plans, target none, unverified citations, silences, verified rate -- per chair", () => {
    const p = competenceByChair(games(), "prisoner");
    // A: r1 had a plan; r2 replanned (1 of 1). B: r1 had a plan; r2 kept (0 of 1).
    expect(p.plans).toEqual({ withPlan: 2, replanned: 1, kept: 1 });
    // The printed §22 line agrees with the marker count in both games.
    expect(p.printedPlansAgree).toBe(true);
    expect(p.targetNone).toBe(1);
    // A r2 (three `no`s) and B r1 (effect `no`).
    expect(p.rulingsWithUnverified).toBe(2);
    expect(p.decisionSilences).toBe(0);
    expect(p.voiceSilences).toBe(1);
    // yes/no cells only: A r1 3 yes; A r2 3 no; B r1 2 yes 1 no; B r2 3 yes.
    expect(p.verified).toEqual({ yes: 8, total: 12 });

    const w = competenceByChair(games(), "warden");
    expect(w.plans).toEqual({ withPlan: 1, replanned: 0, kept: 1 }); // B's warden r1 was silent, so only A's r2 had a plan to keep
    expect(w.decisionSilences).toBe(1);
    expect(w.voiceSilences).toBe(0);
    expect(w.targetNone).toBe(0);
    expect(w.verified).toEqual({ yes: 9, total: 9 });
  });
});

describe("§3.3 -- citations that are a single word of three letters or fewer", () => {
  it("lists every such row with its keys and counts distinct rulings", () => {
    const s = shortCitations(games());
    const quotes = s.rows.map((r) => `${r.file} r${r.round} ${r.principal} ${r.question}=${r.answer} "${r.quote}"`);
    expect(quotes).toEqual([
      'X/a.md r1 warden target=bar "bar"',
      'X/a.md r1 prisoner target=door "gap"',
      'X/a.md r1 prisoner property=passage "the"',
      'X/b.md r1 prisoner effect=wear "Rub"',
      'X/b.md r1 prisoner product=none "Rub"',
      'X/b.md r2 warden target=bar "bar"',
    ]);
    expect(s.rulings).toBe(4);
    expect(s.totalRulings).toBe(7);
  });
});

describe("refusal audit list (§2)", () => {
  it("one row per refused ruling, keys only, label column empty", () => {
    const rows = refusalAudit(games());
    expect(rows).toEqual([
      { arm: "X", file: "X/a.md", round: 2, principal: "warden", target: "spoon", effect: "none", property: "none", magnitude: "moderate", ruled: "impossible", label: "" },
      { arm: "X", file: "X/a.md", round: 2, principal: "prisoner", target: "none", effect: "none", property: "none", magnitude: "slight", ruled: "impossible", label: "" },
    ]);
  });
});

describe("lost rulings (RESULTS.md bug 1): the .referee.json reply vs what the transcript recorded", () => {
  const replyJson = JSON.stringify([
    {
      label: "round 1, warden: lorem",
      request: {},
      replies: [{ ms: 1, status: 200, content: '[{"questionId": "id \\"target\\"", "answerKey": "bar", "citation": {"sourceId": "intent", "from": 3, "to": 3}}, {"questionId": "effect", "answerKey": "reveal", "citation": {"sourceId": "intent", "from": 1, "to": 2}}]' }],
    },
    {
      label: "round 1, prisoner: lorem",
      request: {},
      replies: [{ ms: 1, status: 200, content: '[{"questionId": "target", "answerKey": "door", "citation": {"sourceId": "intent", "from": 60, "to": 60}}, {"questionId": "effect", "answerKey": "open", "citation": {"sourceId": "intent", "from": 70, "to": 73}}]' }],
    },
    {
      label: "round 2, warden: lorem",
      request: {},
      // A rejected product offer is not lost: the transcript says it was rejected.
      replies: [{ ms: 1, status: 200, content: '[{"questionId": "target", "answerKey": "spoon", "citation": {"sourceId": "intent", "from": 1, "to": 3}}, {"questionId": "effect", "answerKey": "none", "citation": {"sourceId": "intent", "from": 1, "to": 4}}, {"questionId": "product", "answerKey": "spoon", "citation": {"sourceId": "intent", "from": 1, "to": 1}}]' }],
    },
    {
      label: "round 2, prisoner: lorem",
      request: {},
      // The exact malformation that cost §69's batch an escape: a stray quote after the last index and `}]}`.
      replies: [{ ms: 1, status: 200, content: '[{"questionId": "target", "answerKey": "door", "citation": {"sourceId": "intent", "from": 18, "to": 22}}, {"questionId": "effect", "answerKey": "leave", "citation": {"sourceId": "intent", "from": 18, "to": 22"}]}' }],
    },
  ]);

  it("parses strict and malformed replies down to their answer keys", () => {
    const replies = parseRefereeReplies(replyJson);
    expect(replies.map((r) => r.parse)).toEqual(["strict", "strict", "strict", "lenient"]);
    expect(replies[0]).toMatchObject({ round: 1, principal: "warden", answers: { target: "bar", effect: "reveal" } });
    expect(replies[3]).toMatchObject({ round: 2, principal: "prisoner", answers: { target: "door", effect: "leave" } });
  });

  it("flags only the half-round whose recorded keys differ from the answered keys without a rejection", () => {
    const t = parseTranscript(GAME_A, "X/a.md");
    const lost = lostRulings(t, parseRefereeReplies(replyJson));
    expect(lost).toEqual([
      { file: "X/a.md", round: 2, principal: "prisoner", question: "target", answered: "door", recorded: "none" },
      { file: "X/a.md", round: 2, principal: "prisoner", question: "effect", answered: "leave", recorded: "none" },
    ]);
  });

  it("escapes as answered: recorded escapes plus games that lost a `leave` the referee answered", () => {
    const gs: Game[] = [
      { arm: "X", transcript: parseTranscript(GAME_A, "X/a.md"), replies: parseRefereeReplies(replyJson) },
      { arm: "X", transcript: parseTranscript(GAME_B, "X/b.md"), replies: [] },
    ];
    expect(escapesAsAnswered(gs)).toEqual({ recorded: 1, lostLeaves: 1 });
    const md = renderBatchMeasures(gs);
    expect(md).toContain("| X | 1 | 1 | 2 |");
  });
});

describe("CLI arguments", () => {
  it("dir, --arms and --residue", () => {
    expect(parseMeasuresArgs(["checkpoints/x"])).toEqual({ dir: "checkpoints/x", arms: null, residue: [] });
    expect(parseMeasuresArgs(["checkpoints/x", "--arms", "Q,O", "--residue", "spoon/none,meal_tray/none"])).toEqual({
      dir: "checkpoints/x",
      arms: ["Q", "O"],
      residue: [
        { target: "spoon", effect: "none" },
        { target: "meal_tray", effect: "none" },
      ],
    });
    expect(() => parseMeasuresArgs([])).toThrow(/batch dir/);
    expect(() => parseResidue("spoon")).toThrow(/target\/effect/);
  });
});

describe("renderBatchMeasures", () => {
  it("prints every section as markdown", () => {
    const md = renderBatchMeasures(games(), { residue: parseResidue("spoon/none") });
    for (const heading of ["## Per arm", "## Reach, per chair", "## First contact", "## Competence, per chair", "## Short citations (§3.3)", "## Refusal audit list (§2)", "## Lost rulings"]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain("| X | `test-wits` | 2 | 7 | 1 | 3.00 | 1 of 2 | 2.50 | 5 | 2 | 1 |");
    expect(md).toContain("| X | `X/a.md` | 2 | warden | spoon | none | none | moderate | impossible |  |");
  });
});

// The validation the brief demands: on the committed §69 batch, the per-arm
// reach table must reproduce `checkpoints/2026-09-20-ambition/count.mts`'s
// numbers exactly. Reads committed files only; writes nothing.
describe("reproduces count.mts on checkpoints/2026-09-20-ambition", () => {
  const dir = join(process.cwd(), "checkpoints", "2026-09-20-ambition");
  const load = (arm: string): Game[] =>
    readdirSync(join(dir, arm))
      .filter((f) => f.endsWith(".md"))
      .sort()
      .map((f) => ({
        arm,
        transcript: parseTranscript(readFileSync(join(dir, arm, f), "utf8"), `${arm}/${f}`),
        replies: parseRefereeReplies(readFileSync(join(dir, arm, f.replace(/\.md$/, ".referee.json")), "utf8")),
      }));

  it.each([
    ["Q", 1.8, 5, 2.2, 36, 4, 0],
    ["O", 2.5, 1, 2.6, 28, 12, 1],
    ["D", 2.1, 1, 2.2, 33, 7, 0],
  ])("arm %s", (arm, targets, person, effects, grounded, refused, escapes) => {
    const r = reachByArm(load(arm));
    expect(r.games).toBe(10);
    expect(r.intents).toBe(40);
    expect(r.meanDistinctTargets).toBeCloseTo(targets);
    expect(r.personTargetGames).toBe(person);
    expect(r.meanDistinctEffects).toBeCloseTo(effects);
    expect(r.grounded).toBe(grounded);
    expect(r.refused).toBe(refused);
    expect(r.escapes).toBe(escapes);
  });

  it("finds exactly bug 1's lost ruling in arm O and none elsewhere", () => {
    const lost = ["Q", "O", "D"].flatMap((arm) => load(arm).flatMap((g) => lostRulings(g.transcript, g.replies)));
    expect(lost.map((l) => `${l.file} r${l.round} ${l.principal} ${l.question}: ${l.answered} -> ${l.recorded}`)).toEqual([
      "O/2026-09-21T20-19-28-723Z.md r2 prisoner target: door -> none",
      "O/2026-09-21T20-19-28-723Z.md r2 prisoner effect: leave -> none",
    ]);
  });
});

/**
 * Two chairs, two models (phase 1 batch 4, `src/modelRoles.ts`): a game whose
 * principals run different minds prints a line per chair instead of the single
 * `Wits model:` line every earlier batch printed (`openModelHeaderLines`). The
 * measures table's "wits model" column read only that one line, so a mixed
 * batch measured as `?` -- the column that exists to say which model produced
 * the rows, silent on the only batch where it is not obvious.
 */
describe("the wits model of a two-chair transcript", () => {
  const mixed = [
    "# The Prisoner -- checkpoint transcript (open variant)",
    "",
    "Prisoner's chair -- wits model: `claude-opus-4-6`. Voice model: `claude-opus-4-6`.",
    "Warden's chair -- wits model: `muse-glimmer-30b-q4_k_m`. Voice model: `muse-glimmer-30b-q4_k_m`.",
    "Referee model: `muse-glimmer-30b-q4_k_m`. At `http://localhost:8799/v1`.",
    "",
  ].join("\n");

  it("names both chairs, prisoner first, so the column can never say `?` on a mixed batch", () => {
    expect(parseTranscript(mixed).wits).toBe("claude-opus-4-6 (prisoner) / muse-glimmer-30b-q4_k_m (warden)");
  });

  it("still reads the single-line header every earlier batch printed", () => {
    const single = "Wits model: `claude-opus-4-6`. Voice model: `claude-opus-4-6`. Referee model: `muse-glimmer-30b-q4_k_m`. At `http://localhost:8799/v1`.";
    expect(parseTranscript(single).wits).toBe("claude-opus-4-6");
  });

  it("reads the referee model from a two-chair header too", () => {
    expect(parseTranscript(mixed).referee).toBe("muse-glimmer-30b-q4_k_m");
  });
});
