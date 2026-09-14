// GPU-safe model swapping (this task's brief, item 2). Ollama-specific --
// deliberately a small module of THIS repository, not `mind-seam` (which
// knows no vendor, no base URL, no keep_alive) and not `run-dmcp` (which
// knows nothing about models at all). doris (the owner's RTX 4090) holds
// only one big model at a time; anything that calls two models without this
// module in between would silently thrash the GPU or -- worse -- serve one
// mind's request against the OTHER mind's still-loading weights.
//
// The one invariant this file exists to hold: "never proceed with two
// models loaded." `OllamaModelSwapper.withModel(model, fn)` is the only
// entry point that matters -- before `fn` (the actual chat-completions
// call) runs, it confirms `model` is the SOLE model `/api/ps` reports, and
// if not, unloads everything (`keep_alive: 0`) and polls until `/api/ps` is
// empty, bounded by a timeout that throws (loudly -- never absorbed into an
// ordinary model silence; see `src/mind/roleMind.ts`'s own header for why
// this module is deliberately wired OUTSIDE `createLocalMind`'s fetchFn).
// Every call is additionally serialized behind one mutex, so two
// `withModel` calls -- even for different models -- can never overlap.
import type { OllamaPsResponse, OllamaLoadedModel } from "./ollamaStatus.js";

export type { OllamaPsResponse, OllamaLoadedModel };

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_UNLOAD_TIMEOUT_MS = 30_000;
/** keep_alive: -1 reports an expiry this far beyond "now" in the real
 *  server (design's own worked example: `2318-12-25...`, decades out) --
 *  used only to tell a genuine pin apart from an ordinary few-minutes
 *  keep_alive, never to predict the server's own exact encoding. */
const FAR_FUTURE_YEARS_AHEAD = 50;

/** Derives doris's native `/api` base from the OpenAI-compatible URL this
 *  repository already reads (`PRISONER_MODEL_URL`, which ends `/v1`).
 *  `override` (`PRISONER_OLLAMA_NATIVE_URL`) replaces the derivation
 *  entirely when given, exactly as this task's brief asks. */
export function nativeBaseUrl(modelUrl: string, override?: string): string {
  const base = override && override.length > 0 ? override : modelUrl.replace(/\/v1\/?$/, "");
  return base.replace(/\/+$/, "");
}

/** `true` only for an expiry decades beyond `referenceNow` -- keep_alive
 *  -1's own tell. An unparseable expiry is never treated as a pin (never a
 *  guess dressed up as a positive fact). */
export function isFarFuturePin(expiresAt: string, referenceNow: Date = new Date()): boolean {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getUTCFullYear() - referenceNow.getUTCFullYear() >= FAR_FUTURE_YEARS_AHEAD;
}

/** The pinned model at the moment `ps` was taken -- exactly one model
 *  loaded, with a far-future expiry -- or `null`. Two or more models loaded
 *  is never a pin: keep_alive -1 is this repository's own convention for
 *  "the owner pinned this deliberately," and that reading only holds when
 *  it is the only thing loaded. */
export function detectPin(ps: OllamaPsResponse): { name: string } | null {
  if (ps.models.length !== 1) return null;
  const only = ps.models[0];
  return isFarFuturePin(only.expires_at) ? { name: only.name } : null;
}

/** "That model belongs to someone else" (this task's brief, item 2): a
 *  loaded model this run did not configure and that is not pinned means
 *  someone else's work is on the GPU right now. Throws, naming it, rather
 *  than swapping it out from under them. */
export function assertNoForeignModel(ps: OllamaPsResponse, configuredModels: readonly string[]): void {
  const allowed = new Set(configuredModels);
  const pin = detectPin(ps);
  if (pin) allowed.add(pin.name);
  const foreign = ps.models.filter((m) => !allowed.has(m.name));
  if (foreign.length === 0) return;
  throw new Error(
    "refusing to start: doris has a model loaded that this run did not configure and that is not pinned -- " +
      `${foreign.map((m) => m.name).join(", ")}. That model belongs to someone else. ` +
      `Configured for this run: ${configuredModels.join(", ") || "(none)"}.`
  );
}

/** One completed swap: `model` is what this run needed loaded; `unloadMs`
 *  is the wall time spent unloading whatever was there and polling
 *  `/api/ps` until empty. Recorded only when a swap actually happened --
 *  `withModel` finding `model` already the sole loaded model adds nothing
 *  here (this task's brief, item 3: "swap timings ... separately" from
 *  ordinary per-call timings, which `src/mind/roleMind.ts` already
 *  measures as the wall time of the call that follows). */
export interface SwapEvent {
  model: string;
  unloadMs: number;
}

export interface OllamaModelSwapperOptions {
  nativeBaseUrl: string;
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  unloadTimeoutMs?: number;
  /** Injectable so every test runs offline and instantly -- never a real
   *  `setTimeout` wait in this repository's own test suite. */
  delayFn?: (ms: number) => Promise<void>;
  /** Injectable clock, for the timeout test to advance time deterministically
   *  without a real wall-clock wait. */
  nowFn?: () => number;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OllamaModelSwapper {
  private mutex: Promise<void> = Promise.resolve();
  private readonly events: SwapEvent[] = [];

  constructor(private readonly opts: OllamaModelSwapperOptions) {}

  get swapEvents(): readonly SwapEvent[] {
    return this.events;
  }

  async fetchPs(): Promise<OllamaPsResponse> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    const response = await fetchFn(`${this.opts.nativeBaseUrl}/api/ps`);
    if (!response.ok) {
      throw new Error(`OllamaModelSwapper: /api/ps returned HTTP ${response.status}`);
    }
    return (await response.json()) as OllamaPsResponse;
  }

  private async setKeepAlive(model: string, keepAlive: number): Promise<void> {
    const fetchFn = this.opts.fetchFn ?? fetch;
    await fetchFn(`${this.opts.nativeBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, keep_alive: keepAlive }),
    });
  }

  private now(): number {
    return (this.opts.nowFn ?? (() => performance.now()))();
  }

  private async pollUntilEmpty(): Promise<void> {
    const delayFn = this.opts.delayFn ?? defaultDelay;
    const timeoutMs = this.opts.unloadTimeoutMs ?? DEFAULT_UNLOAD_TIMEOUT_MS;
    const intervalMs = this.opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const start = this.now();
    for (;;) {
      const ps = await this.fetchPs();
      if (ps.models.length === 0) return;
      if (this.now() - start > timeoutMs) {
        throw new Error(
          `OllamaModelSwapper: timed out after ${timeoutMs}ms waiting for every model to unload -- ` +
            `still loaded: ${ps.models.map((m) => m.name).join(", ")}. Refusing to proceed with two models loaded.`
        );
      }
      await delayFn(intervalMs);
    }
  }

  /** Serializes `fn` behind one mutex -- this task's brief: "serialize:
   *  never allow two model calls in flight." Every public entry point
   *  (`withModel`, `restorePin`) routes through this, so a swap check for
   *  one model can never interleave with another's. */
  private async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.mutex;
    let release!: () => void;
    this.mutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /** `undefined` when no swap was needed (M was already the sole model);
   *  otherwise the wall time the unload-and-poll took. */
  private async ensureLoaded(model: string): Promise<number | undefined> {
    const ps = await this.fetchPs();
    if (ps.models.length === 1 && ps.models[0].name === model) return undefined;
    const start = this.now();
    for (const loadedModel of ps.models) {
      await this.setKeepAlive(loadedModel.name, 0);
    }
    await this.pollUntilEmpty();
    return this.now() - start;
  }

  /** Before any call to `model`: read `/api/ps`; if `model` is already the
   *  only thing loaded, proceed; otherwise unload everything and poll until
   *  `/api/ps` is empty (bounded -- see `pollUntilEmpty`), THEN proceed.
   *  `fn` itself is what actually loads `model` (an ordinary chat-
   *  completions call against it) -- this module issues no separate load
   *  request of its own for the ordinary path (only `restorePin` does,
   *  because there is no "next call" to load it for it). */
  async withModel<T>(model: string, fn: () => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const unloadMs = await this.ensureLoaded(model);
      if (unloadMs !== undefined) {
        this.events.push({ model, unloadMs });
      }
      return fn();
    });
  }

  /** Pin restore (this task's brief, item 2): called from `checkpoint.ts`'s
   *  own `finally`, so it runs even when the game loop above it threw.
   *  `pin` is whatever `detectPin` found at the very start of the run, or
   *  `null` if nothing was pinned then (a no-op). Unloads whatever is
   *  currently loaded, reloads the pinned model with `keep_alive: -1`, and
   *  confirms via `/api/ps` -- throwing, never silently leaving the wrong
   *  model loaded, if that confirmation fails. */
  async restorePin(pin: { name: string } | null): Promise<void> {
    if (!pin) return;
    await this.runExclusive(async () => {
      const ps = await this.fetchPs();
      const alreadyRestored = ps.models.length === 1 && ps.models[0].name === pin.name && isFarFuturePin(ps.models[0].expires_at);
      if (alreadyRestored) return;

      for (const loadedModel of ps.models) {
        await this.setKeepAlive(loadedModel.name, 0);
      }
      await this.pollUntilEmpty();
      await this.setKeepAlive(pin.name, -1);

      const after = await this.fetchPs();
      const ok = after.models.length === 1 && after.models[0].name === pin.name && isFarFuturePin(after.models[0].expires_at);
      if (!ok) {
        throw new Error(
          `OllamaModelSwapper: failed to restore pinned model '${pin.name}' with keep_alive -1 -- ` +
            `/api/ps now shows: ${JSON.stringify(after.models)}`
        );
      }
    });
  }
}
