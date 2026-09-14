// The doris GPU-sharing protocol, made mechanical (this task's brief, item
// 2): doris holds only one big model at a time, so before any call to model
// M this module reads `/api/ps`, and if M is not already the sole loaded
// model, unloads everything (`keep_alive: 0`) and polls `/api/ps` until it
// is empty -- bounded, so a stuck unload fails loudly instead of silently
// proceeding with two models loaded. Every test below runs against an
// injected `fetchFn` and injected `delayFn`/`nowFn`, so none of it ever
// touches a real clock or a real network.
//
// REVISION (coordinator's fix over the first real run): `expires_at` cannot
// tell a genuinely pinned model apart from an ordinary one on doris -- the
// server reports a multi-century expiry for EVERY model it loads, including
// `qwen3:14b` loaded by an ordinary chat call, not only a deliberate
// `keep_alive: -1`. The old `isFarFuturePin`/`detectPin` inference is
// removed entirely (it was simply wrong against the real server); "which
// models this run may touch" is now an explicit list -- this run's own
// configured models plus `PRISONER_OLLAMA_RESIDENT_MODELS` -- and "which
// models to restore at the end" is whichever of THAT resident list was
// actually loaded when the run started, passed in by the caller
// (`checkpoint.ts`) rather than inferred from any `/api/ps` field.
import { describe, it, expect, vi } from "vitest";
import { OllamaModelSwapper, nativeBaseUrl, assertNoForeignModel, type OllamaPsResponse } from "../ollamaSwap.js";

function psResponse(models: OllamaPsResponse["models"]): Response {
  return new Response(JSON.stringify({ models }), { status: 200, headers: { "content-type": "application/json" } });
}

function model(name: string, expiresAt = "2026-09-14T08:05:00.000Z") {
  return { name, size: 1, size_vram: 1, expires_at: expiresAt };
}

describe("nativeBaseUrl -- derives the native /api base from the OpenAI-compatible /v1 URL", () => {
  it("strips a trailing /v1", () => {
    expect(nativeBaseUrl("http://doris:11434/v1")).toBe("http://doris:11434");
  });

  it("strips a trailing /v1/", () => {
    expect(nativeBaseUrl("http://doris:11434/v1/")).toBe("http://doris:11434");
  });

  it("leaves a URL with no /v1 well enough alone", () => {
    expect(nativeBaseUrl("http://doris:11434")).toBe("http://doris:11434");
  });

  it("PRISONER_OLLAMA_NATIVE_URL overrides the derivation entirely", () => {
    expect(nativeBaseUrl("http://doris:11434/v1", "http://elsewhere:9999")).toBe("http://elsewhere:9999");
  });
});

describe("assertNoForeignModel -- 'that model belongs to someone else' (coordinator's fix: allowedModels is an explicit list, never inferred from expires_at)", () => {
  it("passes when nothing is loaded", () => {
    expect(() => assertNoForeignModel({ models: [] }, ["qwen3:14b"])).not.toThrow();
  });

  it("passes when the loaded model is one of this run's own configured roles", () => {
    expect(() => assertNoForeignModel({ models: [model("qwen3:14b")] }, ["qwen3:14b", "ancient-awakening:12b"])).not.toThrow();
  });

  it("passes when the loaded model is listed as a resident, even though it is not one of this run's own roles", () => {
    expect(() => assertNoForeignModel({ models: [model("ancient-awakening:12b")] }, ["qwen3:14b", "ancient-awakening:12b"])).not.toThrow();
  });

  it("a far-future expires_at grants NO special allowance any more -- only membership in the passed-in list does", () => {
    expect(() => assertNoForeignModel({ models: [model("someone-elses-model", "2318-01-01T00:00:00Z")] }, ["qwen3:14b"])).toThrow(
      /someone-elses-model/
    );
  });

  it("throws, naming the model, when a foreign model is loaded", () => {
    expect(() => assertNoForeignModel({ models: [model("someone-elses-model")] }, ["qwen3:14b"])).toThrow(/someone-elses-model/);
  });
});

/** A tiny in-memory Ollama double: tracks loaded models and answers
 *  /api/ps and /api/generate the way the real server would for the shapes
 *  this module sends. `unloadDelayCalls` lets a test make the model take a
 *  few polls to actually disappear (a real unload is not instant). */
function fakeOllama(initial: { name: string; expiresAt?: string }[] = [], unloadDelayPolls = 0) {
  let loaded = initial.map((m) => ({ name: m.name, size: 1, size_vram: 1, expires_at: m.expiresAt ?? "2026-09-14T08:05:00.000Z" }));
  const calls: { url: string; body?: unknown }[] = [];
  let unloading = false;
  let countdown = unloadDelayPolls;

  const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url: u, body });
    if (u.endsWith("/api/ps")) {
      if (unloading) {
        if (countdown > 0) {
          countdown -= 1;
          return psResponse(loaded); // not yet unloaded
        }
        loaded = [];
        unloading = false;
      }
      return psResponse(loaded);
    }
    if (u.endsWith("/api/generate")) {
      const b = body as { model: string; keep_alive: number };
      if (b.keep_alive === 0) {
        if (unloadDelayPolls > 0) {
          unloading = true;
        } else {
          loaded = loaded.filter((m) => m.name !== b.model);
        }
      } else {
        loaded = [{ name: b.model, size: 1, size_vram: 1, expires_at: b.keep_alive === -1 ? "2318-01-01T00:00:00Z" : "2026-09-14T08:05:00Z" }];
      }
      return new Response("{}", { status: 200 });
    }
    throw new Error(`unexpected URL ${u}`);
  }) as unknown as typeof fetch;

  return { fetchFn, calls, getLoaded: () => loaded };
}

describe("OllamaModelSwapper.withModel -- unload order, polling, no overlap", () => {
  it("proceeds with no unload at all when M is already the sole loaded model", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "qwen3:14b" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });

    let ran = false;
    await swapper.withModel("qwen3:14b", async () => {
      ran = true;
    });

    expect(ran).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/api/generate"))).toBe(false);
    expect(swapper.swapEvents).toHaveLength(0);
  });

  it("unloads every loaded model before proceeding when M is not the sole one loaded", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "ancient-awakening:12b" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });

    await swapper.withModel("qwen3:14b", async () => {});

    const unloadCall = calls.find((c) => c.url.endsWith("/api/generate"));
    expect(unloadCall?.body).toEqual({ model: "ancient-awakening:12b", keep_alive: 0 });
    expect(swapper.swapEvents).toHaveLength(1);
    expect(swapper.swapEvents[0].model).toBe("qwen3:14b");
    expect(swapper.swapEvents[0].unloadMs).toBeGreaterThanOrEqual(0);
  });

  it("unloads when nothing at all was loaded (the call itself will load M) -- polling is immediately satisfied", async () => {
    const { fetchFn, calls } = fakeOllama([]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });

    let ran = false;
    await swapper.withModel("qwen3:14b", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/api/generate") && (c.body as { keep_alive: number }).keep_alive === 0)).toBe(false);
  });

  it("polls /api/ps until it reports empty before proceeding", async () => {
    const { fetchFn } = fakeOllama([{ name: "ancient-awakening:12b" }], 3);
    let delays = 0;
    const swapper = new OllamaModelSwapper({
      nativeBaseUrl: "http://doris:11434",
      fetchFn,
      delayFn: async () => {
        delays += 1;
      },
      pollIntervalMs: 10,
    });

    await swapper.withModel("qwen3:14b", async () => {});
    expect(delays).toBeGreaterThanOrEqual(3);
  });

  it("gives up loudly after the timeout, and never proceeds with the call", async () => {
    const fetchFn = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.endsWith("/api/ps")) return psResponse([model("stuck-model")]);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    let time = 0;
    const swapper = new OllamaModelSwapper({
      nativeBaseUrl: "http://doris:11434",
      fetchFn,
      nowFn: () => {
        time += 1000;
        return time;
      },
      delayFn: async () => {},
      unloadTimeoutMs: 5000,
      pollIntervalMs: 100,
    });

    let ran = false;
    await expect(
      swapper.withModel("qwen3:14b", async () => {
        ran = true;
      })
    ).rejects.toThrow(/timed out|timeout/i);
    expect(ran).toBe(false);
  });

  it("never allows two model calls to be in flight at once", async () => {
    const order: string[] = [];
    const fetchFn = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.endsWith("/api/ps")) return psResponse([]);
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });

    async function slowCall(name: string, ms: number) {
      order.push(`${name}-start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name}-end`);
    }

    const a = swapper.withModel("model-a", () => slowCall("a", 20));
    const b = swapper.withModel("model-b", () => slowCall("b", 5));
    await Promise.all([a, b]);

    // "a" must fully finish (start AND end) before "b" starts at all --
    // never interleaved, regardless of which is individually slower.
    expect(order).toEqual(["a-start", "a-end", "b-start", "b-end"]);
  });

  it("(coordinator's fix) refuses to unload a model that is loaded but not in allowedModels -- never touches a foreign model even mid-run", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "someone-elses-model" }]);
    const swapper = new OllamaModelSwapper({
      nativeBaseUrl: "http://doris:11434",
      fetchFn,
      delayFn: async () => {},
      allowedModels: ["qwen3:14b", "ancient-awakening:12b"],
    });

    let ran = false;
    await expect(
      swapper.withModel("qwen3:14b", async () => {
        ran = true;
      })
    ).rejects.toThrow(/someone-elses-model/);
    expect(ran).toBe(false);
    expect(calls.some((c) => c.url.endsWith("/api/generate"))).toBe(false);
  });

  it("with allowedModels configured, unloading a model that IS in the list still works normally", async () => {
    const { fetchFn } = fakeOllama([{ name: "ancient-awakening:12b" }]);
    const swapper = new OllamaModelSwapper({
      nativeBaseUrl: "http://doris:11434",
      fetchFn,
      delayFn: async () => {},
      allowedModels: ["qwen3:14b", "ancient-awakening:12b"],
    });

    let ran = false;
    await swapper.withModel("qwen3:14b", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it("with no allowedModels configured at all, unloading is unrestricted (defence in depth only -- checkpoint.ts always configures it)", async () => {
    const { fetchFn } = fakeOllama([{ name: "anything-at-all" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });
    let ran = false;
    await swapper.withModel("qwen3:14b", async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});

describe("OllamaModelSwapper.restoreResidents -- 'finally', even after a thrown error (coordinator's fix: replaces restorePin)", () => {
  it("does nothing when there were no residents loaded at start", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "qwen3:14b" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });
    await swapper.restoreResidents([]);
    expect(calls).toHaveLength(0);
  });

  it("is a no-op when the resident model is already the sole one loaded", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "ancient-awakening:12b" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });
    await swapper.restoreResidents(["ancient-awakening:12b"]);
    expect(calls.filter((c) => c.url.endsWith("/api/generate"))).toHaveLength(0);
  });

  it("unloads the current model and reloads the resident one with keep_alive -1", async () => {
    const { fetchFn, calls, getLoaded } = fakeOllama([{ name: "qwen3:14b" }]);
    const swapper = new OllamaModelSwapper({
      nativeBaseUrl: "http://doris:11434",
      fetchFn,
      delayFn: async () => {},
      allowedModels: ["qwen3:14b", "ancient-awakening:12b"],
    });

    await swapper.restoreResidents(["ancient-awakening:12b"]);

    const generateCalls = calls.filter((c) => c.url.endsWith("/api/generate")).map((c) => c.body);
    expect(generateCalls).toEqual([
      { model: "qwen3:14b", keep_alive: 0 },
      { model: "ancient-awakening:12b", keep_alive: -1 },
    ]);
    expect(getLoaded()).toEqual([{ name: "ancient-awakening:12b", size: 1, size_vram: 1, expires_at: "2318-01-01T00:00:00Z" }]);
  });

  it("throws when the restore cannot be confirmed via /api/ps afterward (by NAME only -- never by expires_at)", async () => {
    // A stateful double whose unload works normally, but whose "load"
    // stubbornly reports the WRONG model afterward -- simulating a server
    // that did not actually honor the reload, which restoreResidents must
    // catch by re-reading /api/ps rather than trusting its own request
    // succeeded.
    let loaded = [model("wrong-model")];
    const fetchFn = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/api/ps")) return psResponse(loaded);
      if (u.endsWith("/api/generate")) {
        const body = JSON.parse(init?.body as string) as { model: string; keep_alive: number };
        loaded = body.keep_alive === 0 ? [] : [model("wrong-model")];
        return new Response("{}", { status: 200 });
      }
      throw new Error(`unexpected URL ${u}`);
    }) as unknown as typeof fetch;
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });
    await expect(swapper.restoreResidents(["ancient-awakening:12b"])).rejects.toThrow(/restore/i);
  });

  it("runs even after withModel's own call threw -- the caller's finally, proven end to end", async () => {
    // A DIFFERENT model resident at start than the one `withModel` needs,
    // so both the swap-in (unload the resident) AND the eventual restore
    // (reload the resident) each have real work to do -- proving the
    // `finally` fires, not merely that it was reachable.
    const { fetchFn, calls } = fakeOllama([{ name: "resident-model" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });

    let restoreRan = false;
    try {
      try {
        await swapper.withModel("qwen3:14b", async () => {
          throw new Error("boom -- the actual model call failed");
        });
      } finally {
        await swapper.restoreResidents(["resident-model"]);
        restoreRan = true;
      }
    } catch (err) {
      expect((err as Error).message).toContain("boom");
    }
    expect(restoreRan).toBe(true);
    const loadCalls = calls.filter((c) => c.url.endsWith("/api/generate") && (c.body as { keep_alive: number }).keep_alive === -1);
    expect(loadCalls.map((c) => (c.body as { model: string }).model)).toEqual(["resident-model"]);
  });

  it("sends a load request for every resident in the list, in order (doris itself only ever reports 0 or 1 loaded models, so a real run's own list has at most one entry; this proves the loop itself, not multi-model hardware)", async () => {
    const { fetchFn, calls } = fakeOllama([{ name: "model-a" }]);
    const swapper = new OllamaModelSwapper({ nativeBaseUrl: "http://doris:11434", fetchFn, delayFn: async () => {} });
    await expect(swapper.restoreResidents(["model-a", "model-b"])).rejects.toThrow(/restore/i);
    const loadCalls = calls
      .filter((c) => c.url.endsWith("/api/generate") && (c.body as { keep_alive: number }).keep_alive === -1)
      .map((c) => (c.body as { model: string }).model);
    expect(loadCalls).toEqual(["model-a", "model-b"]);
  });
});
