import { describe, it, expect } from "vitest";
import type { ReadRequest, ReaderTransport } from "run-dmcp";
import { replayRequest, replayTranscript, renderReplayReport } from "../replay.js";

const REQUEST: ReadRequest = {
  questions: [
    { id: "target", prompt: "?", answerKeys: ["bar", "lock", "none"], safeDefault: "none" },
    { id: "magnitude", prompt: "?", answerKeys: ["slight", "moderate", "substantial"], safeDefault: "slight" },
  ],
  sources: [{ id: "intent", text: "file the bar" }],
};

describe("replayRequest (this task's brief: §5.2's consistency metric)", () => {
  it("a fully deterministic transport agrees 100% of the time on every question", async () => {
    const transport: ReaderTransport = async (request) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey: q.id === "target" ? "bar" : "moderate",
        citation: { sourceId: "intent", quote: "file the bar" },
      }));

    const report = await replayRequest(REQUEST, [transport], 5);
    expect(report).toEqual([
      { questionId: "target", mostCommonKey: "bar", agreementRate: 1, sampleSize: 5 },
      { questionId: "magnitude", mostCommonKey: "moderate", agreementRate: 1, sampleSize: 5 },
    ]);
  });

  it("an inconsistent transport shows partial agreement", async () => {
    let call = 0;
    const transport: ReaderTransport = async (request) => {
      call += 1;
      const magnitude = call % 2 === 0 ? "moderate" : "slight";
      return request.questions.map((q) => ({
        questionId: q.id,
        answerKey: q.id === "target" ? "bar" : magnitude,
        citation: { sourceId: "intent", quote: "file the bar" },
      }));
    };

    const report = await replayRequest(REQUEST, [transport], 10);
    const magnitudeAgreement = report.find((r) => r.questionId === "magnitude");
    expect(magnitudeAgreement?.agreementRate).toBe(0.5);
    expect(["slight", "moderate"]).toContain(magnitudeAgreement?.mostCommonKey);
  });

  it("an empty transport list agrees 100% on every safe default", async () => {
    const report = await replayRequest(REQUEST, [], 3);
    expect(report).toEqual([
      { questionId: "target", mostCommonKey: "none", agreementRate: 1, sampleSize: 3 },
      { questionId: "magnitude", mostCommonKey: "slight", agreementRate: 1, sampleSize: 3 },
    ]);
  });

  it("rejects a non-positive-integer n", async () => {
    await expect(replayRequest(REQUEST, [], 0)).rejects.toThrow();
    await expect(replayRequest(REQUEST, [], -1)).rejects.toThrow();
    await expect(replayRequest(REQUEST, [], 1.5)).rejects.toThrow();
  });
});

describe("replayTranscript / renderReplayReport", () => {
  it("replays several labelled requests and renders a report naming §5.3's 80% target", async () => {
    const transport: ReaderTransport = async (request) =>
      request.questions.map((q) => ({ questionId: q.id, answerKey: q.safeDefault, citation: { sourceId: "intent", quote: "file the bar" } }));

    const replayed = await replayTranscript([{ label: "intent #1", request: REQUEST }], [transport], 4);
    const report = renderReplayReport(replayed);
    expect(report.join("\n")).toContain("intent #1");
    expect(report.join("\n")).toContain("80%");
  });
});
