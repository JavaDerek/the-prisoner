import { describe, it, expect } from "vitest";
import { summarizeLoadedModels, fetchLoadedModelsSummary } from "../ollamaStatus.js";

describe("summarizeLoadedModels -- the doris GPU-sharing protocol's own record", () => {
  it("summarizes each loaded model's name, VRAM size and expiry", () => {
    const summary = summarizeLoadedModels({
      models: [
        {
          name: "ancient-awakening:12b",
          size: 13135962438,
          size_vram: 13135962438,
          expires_at: "2318-12-25T03:35:06.160747448Z",
        },
      ],
    });
    expect(summary).toContain("ancient-awakening:12b");
    expect(summary).toContain("13135962438");
    expect(summary).toContain("2318-12-25");
  });

  it("says plainly when nothing is loaded, rather than an empty string", () => {
    expect(summarizeLoadedModels({ models: [] })).toContain("no models loaded");
  });

  it("lists more than one model if more than one is somehow loaded", () => {
    const summary = summarizeLoadedModels({
      models: [
        { name: "a:1b", size: 1, size_vram: 1, expires_at: "2026-01-01T00:00:00Z" },
        { name: "b:2b", size: 2, size_vram: 2, expires_at: "2026-01-01T00:00:00Z" },
      ],
    });
    expect(summary).toContain("a:1b");
    expect(summary).toContain("b:2b");
  });
});

describe("fetchLoadedModelsSummary -- never throws, always offline in tests", () => {
  it("queries /api/ps at the root, not under /v1", async () => {
    let requestedUrl: string | undefined;
    const fetchFn = (async (url: unknown) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify({ models: [] }), { status: 200 });
    }) as unknown as typeof fetch;

    await fetchLoadedModelsSummary("http://doris:11434/v1", fetchFn);
    expect(requestedUrl).toBe("http://doris:11434/api/ps");
  });

  it("reports a non-200 status rather than throwing", async () => {
    const fetchFn = (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch;
    const summary = await fetchLoadedModelsSummary("http://doris:11434/v1", fetchFn);
    expect(summary).toContain("503");
  });

  it("reports a network failure rather than throwing", async () => {
    const fetchFn = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const summary = await fetchLoadedModelsSummary("http://doris:11434/v1", fetchFn);
    expect(summary).toContain("ECONNREFUSED");
  });
});
