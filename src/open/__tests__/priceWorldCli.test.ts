import { describe, it, expect } from "vitest";
import type { ReadRequest, ReaderTransport, TransportAnswer } from "run-dmcp";
import type { OpenObjectSpec } from "../scenarioObjects.js";
import { descriptionHash, type AuthorPricedRow, type ElaborationBandRow, type ModelPricedRow } from "../elaborationBands.js";
import { replayTranscript, renderReplayReport } from "../replay.js";
import { buildDifficultyRequest, priceAcquirableFact, mergeElaborationBands, spliceGeneratedRows } from "../priceWorldCli.js";

const BAR: OpenObjectSpec = {
  id: "bar",
  heldBy: "the window",
  description: "An iron bar, thumb-thick, pitted with rust near the bottom where it meets old mortar.",
  properties: [],
};

/** The same scripted-transport discipline `referee.test.ts` and
 *  `replay.test.ts` already use -- never a real network call, never `npm
 *  run format`-reformatted, matching this repository's own style. */
function scriptedTransport(reply: (call: number) => { answerKey: string; citation: { sourceId: string; quote: string } } | undefined): ReaderTransport {
  let call = 0;
  return async (request: ReadRequest): Promise<readonly TransportAnswer[]> => {
    call += 1;
    const scripted = reply(call);
    if (!scripted) return [];
    return request.questions.map((q) => ({ questionId: q.id, answerKey: scripted.answerKey, citation: scripted.citation }));
  };
}

describe("buildDifficultyRequest (WORLD-ELABORATION-DESIGN.md §4.2a)", () => {
  it("has exactly one question, one source, and no intent -- the price is read from the description ALONE", () => {
    const request = buildDifficultyRequest(BAR, "edge");
    expect(request.questions).toHaveLength(1);
    expect(request.questions[0].id).toBe("difficulty");
    expect(request.questions[0].answerKeys).toEqual(["trivial", "hard", "ruinous", "impossible"]);
    expect(request.questions[0].safeDefault).toBe("impossible");
    expect(request.sources).toEqual([{ id: "desc:bar", text: BAR.description }]);
    // No source or question text anywhere carries an actor's intent -- there is none to carry.
    expect(JSON.stringify(request)).not.toContain('"intent"');
  });
});

describe("priceAcquirableFact -- the build-time read, replayed N=5 on the spot (§9 row P1's own red tests)", () => {
  it("a scripted reader with AGREEING replies is written as data, with its citation", async () => {
    const transport = scriptedTransport(() => ({ answerKey: "hard", citation: { sourceId: "desc:bar", quote: "pitted with rust" } }));
    const priced = await priceAcquirableFact(BAR, "edge", [transport], "test-model", "abc1234 (clean)", 5);

    expect(priced.row.status).toBe("priced");
    const row = priced.row as ModelPricedRow;
    expect(row.bandSource).toBe("model");
    expect(row.band).toBe("hard");
    expect(row.citation).toEqual({ sourceId: "desc:bar", quote: "pitted with rust" });
    expect(row.model).toBe("test-model");
    expect(row.scenarioRevision).toBe("abc1234 (clean)");
    expect(row.descriptionHash).toBe(descriptionHash(BAR.description));
    expect(priced.replies).toHaveLength(5);
  });

  it("a scripted reader with DISAGREEING replies is written as review, carrying all five answers and citations", async () => {
    const transport = scriptedTransport((call) =>
      call % 2 === 0
        ? { answerKey: "hard", citation: { sourceId: "desc:bar", quote: "pitted with rust" } }
        : { answerKey: "ruinous", citation: { sourceId: "desc:bar", quote: "thumb-thick" } }
    );
    const priced = await priceAcquirableFact(BAR, "edge", [transport], "test-model", "abc1234 (clean)", 5);

    expect(priced.row.status).toBe("review");
    if (priced.row.status !== "review") throw new Error("unreachable");
    expect(priced.row.replies).toHaveLength(5);
    expect(priced.row.replies.map((r) => r.band).sort()).toEqual(["hard", "hard", "ruinous", "ruinous", "ruinous"]);
    for (const reply of priced.row.replies) expect(reply.citation).not.toBeNull();
  });

  it("a reader that never offers a valid citation still agrees on the safe default -- written as data with a null citation", async () => {
    const transport = scriptedTransport(() => undefined); // no offer at all -> every rung falls to safeDefault
    const priced = await priceAcquirableFact(BAR, "edge", [transport], "test-model", "abc1234 (clean)", 5);

    expect(priced.row.status).toBe("priced");
    const row = priced.row as ModelPricedRow;
    expect(row.band).toBe("impossible");
    expect(row.citation).toBeNull();
  });

  it("the build run is logged in the same sidecar shape the referee's own requests use, and is replayable by the same tool", async () => {
    const transport = scriptedTransport(() => ({ answerKey: "hard", citation: { sourceId: "desc:bar", quote: "pitted with rust" } }));
    const priced = await priceAcquirableFact(BAR, "edge", [transport], "test-model", "abc1234 (clean)", 5);

    // Exactly the shape `refereeRequestsFor` produces and `refereeReplayCli.ts` reads back:
    // `{label, request, replies}[]`, round-trippable through JSON.
    const sidecarEntry = { label: priced.label, request: priced.request, replies: priced.replies };
    expect(sidecarEntry.label).toBe("price-world: bar.edge");
    const roundTripped = JSON.parse(JSON.stringify([sidecarEntry])) as { label: string; request: ReadRequest }[];

    // The SAME replay tooling `npm run referee-replay` uses re-checks it.
    const replayed = await replayTranscript(roundTripped, [transport], 3);
    const report = renderReplayReport(replayed);
    expect(report.join("\n")).toContain("price-world: bar.edge");
    expect(report.join("\n")).toContain("difficulty");
  });
});

describe("mergeElaborationBands (§4.2a: an author's hand-set row survives a re-run)", () => {
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
    comment: "set by hand after a 3/2 split, 2026-09-19",
  };
  const freshModelRow: ModelPricedRow = {
    status: "priced",
    bandSource: "model",
    objectId: "bar",
    need: "edge",
    band: "hard",
    citation: { sourceId: "desc:bar", quote: "pitted with rust" },
    model: "test-model",
    scenarioRevision: "def5678 (clean)",
    descriptionHash: descriptionHash(BAR.description),
  };

  it("a fresh model-read row never overwrites an existing author-set row for the same pair", () => {
    const merged = mergeElaborationBands([authored], [freshModelRow]);
    expect(merged).toEqual([authored]);
  });

  it("an author row for a pair the fresh run did not touch is still carried forward", () => {
    const merged = mergeElaborationBands([authored], []);
    expect(merged).toEqual([authored]);
  });

  it("a fresh row for a pair with no existing author row is taken as-is", () => {
    const merged = mergeElaborationBands([], [freshModelRow]);
    expect(merged).toEqual([freshModelRow]);
  });
});

describe("spliceGeneratedRows (rewrites only the text between elaborationBands.ts's own markers)", () => {
  const FIXTURE_FILE = ["export const X = 1;", "", "export const ELABORATION_BANDS = [", "  // price-world: generated rows start", "  // price-world: generated rows end", "];", ""].join("\n");

  it("leaves everything outside the markers untouched", () => {
    const rows: ElaborationBandRow[] = [];
    const out = spliceGeneratedRows(FIXTURE_FILE, rows);
    expect(out).toContain("export const X = 1;");
    expect(out).toContain("export const ELABORATION_BANDS = [");
  });

  it("writes a row's fields as a legal object literal between the markers, round-trippable back to the same data", () => {
    const row: ModelPricedRow = {
      status: "priced",
      bandSource: "model",
      objectId: "bar",
      need: "edge",
      band: "hard",
      citation: { sourceId: "desc:bar", quote: "pitted with rust" },
      model: "test-model",
      scenarioRevision: "abc1234 (clean)",
      descriptionHash: descriptionHash(BAR.description),
    };
    const out = spliceGeneratedRows(FIXTURE_FILE, [row]);
    const start = out.indexOf("generated rows start") + "generated rows start".length;
    const end = out.indexOf("// price-world: generated rows end");
    const body = out.slice(start, end).trim().replace(/,$/, "");
    expect(JSON.parse(body)).toEqual(row);
  });

  it("throws, naming the file, when the markers are missing", () => {
    expect(() => spliceGeneratedRows("export const ELABORATION_BANDS = [];", [])).toThrow(/elaborationBands\.ts/);
  });
});
