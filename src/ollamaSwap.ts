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
//
// REVISION (coordinator's fix, over the first real run): `expires_at`
// cannot tell a genuinely long-lived model apart from an ordinary one on
// doris -- the server reports a multi-century expiry for EVERY model it
// loads there, including one loaded by an entirely ordinary chat call, not
// only a deliberate `keep_alive: -1`. The earlier `isFarFuturePin`/
// `detectPin` inference is gone; "which models this run may touch" is now
// an explicit allowlist (`OllamaModelSwapperOptions.allowedModels`) the
// caller builds from its own configured roles plus
// `PRISONER_OLLAMA_RESIDENT_MODELS`, and "what to restore at the end" is
// whichever of that list was actually loaded when the run started --
// determined by the caller from a real `/api/ps` snapshot, by NAME only,
// and handed to `restoreResidents` rather than inferred here.
import type { OllamaPsResponse, OllamaLoadedModel } from "./ollamaStatus.js";

export type { OllamaPsResponse, OllamaLoadedModel };

const DEFAULT_POLL_INTERVAL_MS = 500;
const DEFAULT_UNLOAD_TIMEOUT_MS = 30_000;

/** Derives doris's native `/api` base from the OpenAI-compatible URL this
 *  repository already reads (`PRISONER_MODEL_URL`, which ends `/v1`).
 *  `override` (`PRISONER_OLLAMA_NATIVE_URL`) replaces the derivation
 *  entirely when given, exactly as this task's brief asks. */
export function nativeBaseUrl(modelUrl: string, override?: string): string {
  const base = override && override.length > 0 ? override : modelUrl.replace(/\/v1\/?$/, "");
  return base.replace(/\/+$/, "");
}

/** "That model belongs to someone else": a loaded model that is neither
 *  configured for this run nor listed as a resident means someone else's
 *  work is on the GPU right now. Throws, naming it, rather than swapping it
 *  out from under them. `allowedModels` is an explicit list the CALLER
 *  builds (this run's own roles plus `PRISONER_OLLAMA_RESIDENT_MODELS`) --
 *  this function infers nothing from `expires_at`, which the first real run
 *  proved cannot distinguish a deliberate pin from doris's own default. */
export function assertNoForeignModel(ps: OllamaPsResponse, allowedModels: readonly string[]): void {
  const allowed = new Set(allowedModels);
  const foreign = ps.models.filter((m) => !allowed.has(m.name));
  if (foreign.length === 0) return;
  throw new Error(
    "refusing to start: doris has a model loaded that this run did not configure and that is not listed in " +
      `PRISONER_OLLAMA_RESIDENT_MODELS -- ${foreign.map((m) => m.name).join(", ")}. That model belongs to ` +
      `someone else. Allowed for this run: ${allowedModels.join(", ") || "(none)"}.`
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
  /** Models this run is allowed to touch (unload OR load) -- this run's own
   *  configured roles plus `PRISONER_OLLAMA_RESIDENT_MODELS`, built by the
   *  caller (`checkpoint.ts`). When a model outside this list turns up
   *  loaded -- even mid-run, not only at start -- `withModel`/
   *  `restoreResidents` refuse to unload it and throw, naming it, rather
   *  than ever touching someone else's work. `undefined` (the default in
   *  every test in this file except the ones that specifically exercise
   *  this) leaves unloading unrestricted -- `checkpoint.ts`'s real run
   *  always configures it; nothing in this repository's own test suite
   *  needs the restriction to observe correct behaviour. */
  allowedModels?: readonly string[];
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

  /** Throws, naming `model`, when `allowedModels` is configured and does
   *  not include it -- "never touch a foreign model," applied at the one
   *  point this module ever unloads anything, not only at start. A no-op
   *  when `allowedModels` was never configured. */
  private assertAllowedToUnload(model: string): void {
    if (!this.opts.allowedModels) return;
    if (this.opts.allowedModels.includes(model)) return;
    throw new Error(
      `OllamaModelSwapper: refusing to unload '${model}' -- it is not configured for this run and is not ` +
        "listed in PRISONER_OLLAMA_RESIDENT_MODELS. That model belongs to someone else."
    );
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
   *  (`withModel`, `restoreResidents`) routes through this, so a swap check
   *  for one model can never interleave with another's. */
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
      this.assertAllowedToUnload(loadedModel.name);
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
   *  request of its own for the ordinary path (only `restoreResidents`
   *  does, because there is no "next call" to load it for it). */
  async withModel<T>(model: string, fn: () => Promise<T>): Promise<T> {
    return this.runExclusive(async () => {
      const unloadMs = await this.ensureLoaded(model);
      if (unloadMs !== undefined) {
        this.events.push({ model, unloadMs });
      }
      return fn();
    });
  }

  /** Resident restore (this task's brief, item 2; coordinator's fix over
   *  `restorePin`): called from `checkpoint.ts`'s own `finally`, so it runs
   *  even when the game loop above it threw. `residents` is whichever of
   *  `PRISONER_OLLAMA_RESIDENT_MODELS` the CALLER found actually loaded via
   *  a real `/api/ps` snapshot at the very start of the run -- never
   *  inferred here, and never from `expires_at`. An empty list is a no-op.
   *  Unloads whatever is currently loaded, reloads each resident with
   *  `keep_alive: -1` in order, and confirms via `/api/ps` -- BY NAME ONLY
   *  -- throwing rather than silently leaving the wrong model loaded if
   *  that confirmation fails. (On doris's own single-model hardware,
   *  `residents` in practice never holds more than one name: `/api/ps`
   *  itself can never report more than one model loaded to have found in
   *  the first place.) */
  async restoreResidents(residents: readonly string[]): Promise<void> {
    if (residents.length === 0) return;
    await this.runExclusive(async () => {
      const ps = await this.fetchPs();
      const currentNames = ps.models.map((m) => m.name);
      const alreadyRestored = currentNames.length === residents.length && residents.every((r) => currentNames.includes(r));
      if (alreadyRestored) return;

      for (const loadedModel of ps.models) {
        this.assertAllowedToUnload(loadedModel.name);
        await this.setKeepAlive(loadedModel.name, 0);
      }
      await this.pollUntilEmpty();
      for (const resident of residents) {
        await this.setKeepAlive(resident, -1);
      }

      const after = await this.fetchPs();
      const afterNames = after.models.map((m) => m.name);
      const ok = afterNames.length === residents.length && residents.every((r) => afterNames.includes(r));
      if (!ok) {
        throw new Error(
          `OllamaModelSwapper: failed to restore resident model(s) [${residents.join(", ")}] with keep_alive -1 -- ` +
            `/api/ps now shows: ${JSON.stringify(after.models)}`
        );
      }
    });
  }
}
