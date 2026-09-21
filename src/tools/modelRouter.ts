// The routing shim, committed (OPUS-FIRST-DESIGN.md D2). It was rebuilt from scratch twice
// (2026-09-19, 2026-09-21) as a file in a scratch directory, and every Opus batch's reproducibility
// depended on it; `checkpoints/2026-09-20-ambition/RESULTS.md` ("The routing, and what went wrong
// with it") is the record its behaviour is pinned to. It is this game's own harness -- TypeScript,
// touches no storage, belongs to neither engine nor seam -- so it lives here, under `src/` where
// typecheck, lint and vitest reach it (D2 said `tools/model-router.mts`; `rootDir` is `src`).
//
// It speaks OpenAI `/v1/chat/completions` on localhost and routes by the request's `model`, so the
// minds (`PRISONER_MODEL_URL`) need no new code to talk to a model that does not live on doris:
//   - `opus` / `sonnet` / `haiku`, or any `claude-*` id -> the keyless `claude` CLI in print mode,
//     which authenticates with the subscription and nothing else (below);
//   - a model containing `/` (an org/model id such as `Qwen/...`) -> DeepInfra's OpenAI-compatible
//     endpoint, with retry-with-backoff, because it answers `engine_overloaded` about one call in
//     three and a silent arm measures nothing;
//   - everything else -> doris `/v1/chat/completions`, proxied unchanged.
//
// It also serves the two Ollama-native calls `src/ollamaSwap.ts` makes, because the one-model
// swapper runs on EVERY real run and would otherwise unload the resident referee to "make room"
// for a model that is not on doris at all:
//   - GET  /api/ps       -> doris's real `/api/ps` with `SHIM_HIDE_MODELS` removed. Every OTHER
//                           model is passed through, so `assertNoForeignModel` still fires for a
//                           model that belongs to someone else. (The transcript header therefore
//                           reads "(no models loaded)" on such a run; the real state is in the
//                           shim's own log.)
//   - POST /api/generate -> no-op 200. The swapper only uses it to set `keep_alive`; doris's pin
//                           is left exactly as found.
//
// Subscription auth only: `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are deleted from the
// child's environment before `claude` is spawned, so a metered key in the shell can never route a
// batch around the subscription and onto a bill. brink-workshop's `src/gm/claudeCli/backend.ts`
// states the same rule for the same reason (its preflight refuses to spawn at all); it is restated
// here rather than imported, because nothing in `~/rpg` is wired to anything else (root CLAUDE.md).
// `DEEPINFRA_API_KEY` is read from env, sent as a bearer header, and appears nowhere else -- not in
// a log line, not in a dump, not in an error body.
//
// Every side effect is injected (`RouterDeps`) exactly as `ollamaSwap.ts` injects `fetchFn` and
// `delayFn`, so the whole thing is tested offline and instantly: no port, no network, no `claude`
// process, no real timer. `modelRouterCli.ts` is the only file that supplies the real ones.
import { spawn as nodeSpawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { OllamaLoadedModel } from "../ollamaStatus.js";

// ---------------------------------------------------------------- configuration

export const DEFAULT_PORT = 8799;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_DORIS = "http://doris:11434";
export const DEFAULT_DEEPINFRA = "https://api.deepinfra.com/v1/openai";
/** The resident referee (`DEFAULT_REFEREE_MODEL`, §33.16) -- the model a Claude or DeepInfra
 *  batch still needs loaded on doris the whole time. */
export const DEFAULT_HIDE_MODELS = "qwen3:14b";
/** Well inside the mind's own 300s timeout, so a hung CLI is the shim's failure, reported as
 *  such, not the mind's silence. */
const DEFAULT_CLAUDE_TIMEOUT_MS = 280_000;
/** D game 1 (19:35Z) lost a whole half-round to one DeepInfra retry whose connection hung for
 *  300s. A hung attempt is abandoned here and counted as retryable instead. */
const DEFAULT_DEEPINFRA_ATTEMPT_TIMEOUT_MS = 120_000;

export interface RouterConfig {
  port: number;
  host: string;
  dorisBaseUrl: string;
  deepInfraBaseUrl: string;
  deepInfraKey: string;
  hideModels: ReadonlySet<string>;
  claudeCwd: string;
  claudeTimeoutMs: number;
  deepInfraAttemptTimeoutMs: number;
  dumpDir: string;
}

/** Every knob is an env var; `cwd` is the process's, the default `--cwd` for the CLI. */
export function configFromEnv(env: NodeJS.ProcessEnv, cwd: string): RouterConfig {
  return {
    port: Number(env.SHIM_PORT ?? DEFAULT_PORT),
    host: env.SHIM_HOST ?? DEFAULT_HOST,
    dorisBaseUrl: (env.SHIM_DORIS ?? DEFAULT_DORIS).replace(/\/+$/, ""),
    deepInfraBaseUrl: DEFAULT_DEEPINFRA,
    deepInfraKey: env.DEEPINFRA_API_KEY ?? "",
    hideModels: new Set((env.SHIM_HIDE_MODELS ?? DEFAULT_HIDE_MODELS).split(",").filter(Boolean)),
    claudeCwd: env.SHIM_CLAUDE_CWD ?? cwd,
    claudeTimeoutMs: Number(env.SHIM_CLAUDE_TIMEOUT_MS ?? DEFAULT_CLAUDE_TIMEOUT_MS),
    deepInfraAttemptTimeoutMs: Number(env.SHIM_DEEPINFRA_ATTEMPT_TIMEOUT_MS ?? DEFAULT_DEEPINFRA_ATTEMPT_TIMEOUT_MS),
    dumpDir: env.SHIM_DUMP_DIR ?? "",
  };
}

// ---------------------------------------------------------------- route selection

export type Route = "claude" | "deepinfra" | "doris";

const CLAUDE_ALIASES: ReadonlySet<string> = new Set(["opus", "sonnet", "haiku"]);

/** Exact aliases and the `claude-` prefix only: an Ollama tag that happens to be named after
 *  Claude (`claude:7b`) is a doris model like any other. */
export function selectRoute(model: string): Route {
  if (CLAUDE_ALIASES.has(model) || model.startsWith("claude-")) return "claude";
  if (model.includes("/")) return "deepinfra";
  return "doris";
}

// ---------------------------------------------------------------- injected side effects

/** The slice of `ChildProcess` this module uses; `node:child_process`'s `spawn` with piped
 *  stdout/stderr satisfies it structurally, and a test fakes it with three EventEmitters. */
export interface RouterChild {
  stdout: { on(event: "data", fn: (chunk: Buffer) => void): unknown };
  stderr: { on(event: "data", fn: (chunk: Buffer) => void): unknown };
  on(event: "close", fn: (code: number | null) => void): unknown;
  on(event: "error", fn: (err: Error) => void): unknown;
  kill(signal?: NodeJS.Signals): boolean;
}

export type RouterSpawnFn = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; stdio: ["ignore", "pipe", "pipe"] }
) => RouterChild;

export type RouterLogFn = (line: Record<string, unknown>) => void;

export interface RouterDeps {
  fetchFn: typeof fetch;
  spawnFn: RouterSpawnFn;
  /** Backoff between DeepInfra attempts. Injectable so every test runs instantly. */
  delayFn: (ms: number) => Promise<void>;
  /** The per-attempt signal handed to `fetchFn` on the DeepInfra path. The real one is
   *  `AbortSignal.timeout`; a test injects one already aborted and fetch rejects at once. */
  attemptSignalFn: (ms: number) => AbortSignal;
  /** Schedules `kill` after `ms` and returns the cancel; the real one is setTimeout/clearTimeout. */
  killTimerFn: (kill: () => void, ms: number) => () => void;
  log: RouterLogFn;
  nowFn: () => number;
  reqIdFn: () => string;
  /** The parent environment the `claude` child inherits, minus metered auth (`claudeChildEnv`). */
  env: NodeJS.ProcessEnv;
  writeFileFn: (path: string, data: Buffer) => void;
}

/** One JSON line per request on stdout, the way the ambition batch's `logs/` were read. Not
 *  `console.log`: this is the tool's output, not a diagnostic. */
export function stdoutLog(line: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ t: new Date().toISOString(), ...line }) + "\n");
}

export function defaultRouterDeps(): RouterDeps {
  return {
    fetchFn: fetch,
    spawnFn: (command, args, options) => nodeSpawn(command, args, options),
    delayFn: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    attemptSignalFn: (ms) => AbortSignal.timeout(ms),
    killTimerFn: (kill, ms) => {
      const timer = setTimeout(kill, ms);
      return () => clearTimeout(timer);
    },
    log: stdoutLog,
    nowFn: () => Date.now(),
    reqIdFn: () => randomUUID().slice(0, 8),
    env: process.env,
    writeFileFn: (path, data) => writeFileSync(path, data),
  };
}

// ---------------------------------------------------------------- the Claude CLI path

interface ChatMessage {
  role?: unknown;
  content?: unknown;
}

/** The parts of an OpenAI chat-completions body this module reads. `temperature`,
 *  `reasoning_effort` and `tools` are ignored on the Claude path -- the CLI has no such knobs --
 *  and forwarded untouched on the other two. */
export interface ChatCompletionBody {
  model?: unknown;
  messages?: unknown;
  response_format?: unknown;
}

export interface ClaudeRequest {
  model: string;
  systemPrompt: string;
  prompt: string;
  schema?: unknown;
}

function contentOf(m: ChatMessage): string {
  return typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "");
}

/** OpenAI messages become one `--system-prompt` (every system message) and one `-p` (everything
 *  else, in order), and `response_format.json_schema.schema` becomes `--json-schema`. */
export function translateClaudeRequest(body: ChatCompletionBody): ClaudeRequest {
  const messages: ChatMessage[] = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
  const systemPrompt = messages.filter((m) => m.role === "system").map(contentOf).join("\n\n");
  const prompt = messages.filter((m) => m.role !== "system").map(contentOf).join("\n\n");
  const rf = body.response_format as { type?: unknown; json_schema?: { schema?: unknown } } | undefined;
  const schema = rf?.type === "json_schema" ? rf.json_schema?.schema : undefined;
  return { model: String(body.model ?? ""), systemPrompt, prompt, schema };
}

/** The invocation RESULTS.md records, verbatim. `--system-prompt ""` is passed rather than
 *  omitted so the CLI's own default system prompt never reaches a measured run. `--tools ""`:
 *  a mind, not a coding agent. */
export function buildClaudeArgs(req: ClaudeRequest): string[] {
  const args = [
    "-p", req.prompt,
    "--model", req.model,
    "--output-format", "json",
    "--system-prompt", req.systemPrompt,
    "--tools", "",
    "--no-session-persistence",
  ];
  if (req.schema !== undefined) args.push("--json-schema", JSON.stringify(req.schema));
  return args;
}

/** Never let a metered key route a batch around the subscription. */
export function claudeChildEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const child = { ...env };
  delete child.ANTHROPIC_API_KEY;
  delete child.ANTHROPIC_AUTH_TOKEN;
  return child;
}

interface CliRun {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runClaude(req: ClaudeRequest, config: RouterConfig, deps: RouterDeps): Promise<CliRun> {
  return new Promise((resolve) => {
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let child: RouterChild;
    try {
      child = deps.spawnFn("claude", buildClaudeArgs(req), { cwd: config.claudeCwd, env: claudeChildEnv(deps.env), stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: -1, stdout: "", stderr: String(e) });
      return;
    }
    const cancelKill = deps.killTimerFn(() => child.kill("SIGKILL"), config.claudeTimeoutMs);
    child.stdout.on("data", (b) => out.push(b));
    child.stderr.on("data", (b) => err.push(b));
    child.on("close", (code) => {
      cancelKill();
      resolve({ code, stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() });
    });
    child.on("error", (e) => {
      cancelKill();
      resolve({ code: -1, stdout: "", stderr: String(e) });
    });
  });
}

export interface ChatCompletionPayload {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: "assistant"; content: string }; finish_reason: "stop" }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface CliUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface CliResultJson {
  is_error?: unknown;
  result?: unknown;
  structured_output?: unknown;
  usage?: CliUsage;
  modelUsage?: Record<string, unknown>;
}

export interface ShapedClaudeReply {
  payload: ChatCompletionPayload;
  usage: CliUsage | undefined;
  /** The model id the CLI itself reports having used, so a transcript can check the pin (D1). */
  cliModel: string;
}

/** The CLI's `--output-format json` result becomes one `chat.completion`. With a schema,
 *  `structured_output` is the reply, serialised, because that is what the mind will `JSON.parse`;
 *  without one, `result` is. Null for anything unusable -- a refusal (`is_error: true`, which is
 *  how Opus 5's safeguards answer the wits prompt, §69), an empty result, or not the CLI's JSON at
 *  all -- and the caller decides whether to try again. */
export function shapeClaudeReply(parsed: unknown, req: ClaudeRequest, reqId: string, nowMs: number): ShapedClaudeReply | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as CliResultJson;
  if (r.is_error !== false) return null;
  const content =
    req.schema !== undefined && r.structured_output !== undefined ? JSON.stringify(r.structured_output) : r.result;
  if (typeof content !== "string" || content.length === 0) return null;
  return {
    usage: r.usage,
    cliModel: Object.keys(r.modelUsage ?? {}).join(","),
    payload: {
      id: `chatcmpl-shim-${reqId}`,
      object: "chat.completion",
      created: Math.floor(nowMs / 1000),
      model: req.model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: r.usage?.input_tokens ?? 0,
        completion_tokens: r.usage?.output_tokens ?? 0,
        total_tokens: 0,
      },
    },
  };
}

interface ClaudeOutcome {
  status: number;
  payload: unknown;
  attempt?: number;
  usage?: CliUsage;
  cliModel?: string;
}

/** A retry of one: a CLI failure is usually transient (a rate-limit blip, a killed child), and a
 *  second refusal is a real one. Two is also what the ambition batch ran with. */
const CLAUDE_ATTEMPTS = 2;

async function claudeCompletion(body: ChatCompletionBody, reqId: string, config: RouterConfig, deps: RouterDeps): Promise<ClaudeOutcome> {
  const req = translateClaudeRequest(body);
  let last: { code: number | null; stderr: string; stdout: string } | undefined;
  for (let attempt = 1; attempt <= CLAUDE_ATTEMPTS; attempt++) {
    const run = await runClaude(req, config, deps);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(run.stdout);
    } catch {
      /* not the CLI's JSON; falls through as a failed attempt */
    }
    const shaped = shapeClaudeReply(parsed, req, reqId, deps.nowFn());
    if (shaped) return { status: 200, attempt, usage: shaped.usage, cliModel: shaped.cliModel, payload: shaped.payload };
    last = { code: run.code, stderr: run.stderr.slice(0, 2000), stdout: run.stdout.slice(0, 2000) };
    deps.log({ reqId, route: "claude", event: "attempt-failed", attempt, ...last });
  }
  return { status: 502, payload: { error: { message: `claude CLI produced no usable reply after ${CLAUDE_ATTEMPTS} attempts`, detail: last } } };
}

// ---------------------------------------------------------------- proxy paths

interface ProxyResult {
  status: number;
  contentType: string;
  buf: Buffer;
}

async function proxy(deps: RouterDeps, url: string, method: string, headers: Record<string, string>, body: Buffer | undefined, signal?: AbortSignal): Promise<ProxyResult> {
  const r = await deps.fetchFn(url, {
    method,
    headers,
    // A Buffer is a Uint8Array, but this @types/node's `BodyInit` will not take it by name.
    body: method === "GET" || method === "HEAD" || body === undefined ? undefined : new Uint8Array(body),
    ...(signal ? { signal } : {}),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, contentType: r.headers.get("content-type") ?? "application/json", buf };
}

/** DeepInfra's backoff: bounded well inside the mind's own 300s timeout even when every attempt
 *  is used (75s of waiting plus the attempts themselves). */
export const DEEPINFRA_BACKOFF_MS: readonly number[] = [3000, 6000, 12000, 24000, 30000];

async function deepInfraCompletion(bodyBuf: Buffer, model: string, reqId: string, started: number, config: RouterConfig, deps: RouterDeps): Promise<ProxyResult> {
  const url = `${config.deepInfraBaseUrl}/chat/completions`;
  const headers = { "content-type": "application/json", authorization: `Bearer ${config.deepInfraKey}` };
  let r: ProxyResult;
  for (let attempt = 1; ; attempt++) {
    try {
      r = await proxy(deps, url, "POST", headers, bodyBuf, deps.attemptSignalFn(config.deepInfraAttemptTimeoutMs));
    } catch (e) {
      // A hung or refused connection is a retryable failure of THIS attempt, never the request's
      // answer -- 599 is outside any status DeepInfra sends, so a log reader can tell them apart.
      r = { status: 599, contentType: "application/json", buf: Buffer.from(JSON.stringify({ error: { message: `shim: attempt failed: ${String(e)}` } })) };
    }
    const retryable = r.status === 429 || r.status >= 500;
    deps.log({ reqId, route: "deepinfra", model, attempt, status: r.status, ms: deps.nowFn() - started, ...(r.status !== 200 ? { body: r.buf.toString().slice(0, 300) } : {}) });
    if (!retryable || attempt > DEEPINFRA_BACKOFF_MS.length) return r;
    await deps.delayFn(DEEPINFRA_BACKOFF_MS[attempt - 1]);
  }
}

// ---------------------------------------------------------------- /api/ps

export interface FilteredLoadedModels {
  /** Every model doris really has loaded, by name -- logged, never served. */
  real: string[];
  shown: OllamaLoadedModel[];
}

/** Hide exactly the configured residents; everything else passes through so the swapper's
 *  foreign-model guard sees what it would have seen without the shim. */
export function filterLoadedModels(ps: { models?: OllamaLoadedModel[] }, hide: ReadonlySet<string>): FilteredLoadedModels {
  const models = ps.models ?? [];
  return { real: models.map((m) => m.name), shown: models.filter((m) => !hide.has(m.name)) };
}

// ---------------------------------------------------------------- the request handler

export interface RouterRequest {
  method: string;
  /** Path and query, as `IncomingMessage.url` gives it. */
  url: string;
  headers: Record<string, string | undefined>;
  body: Buffer;
}

export interface RouterResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer | string;
}

function reply(status: number, body: unknown, headers: Record<string, string> = {}): RouterResponse {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  return { status, headers: { "content-type": "application/json", ...headers }, body: data };
}

function dumpRequest(config: RouterConfig, deps: RouterDeps, reqId: string, model: string, bodyBuf: Buffer): void {
  if (!config.dumpDir) return;
  const stamp = new Date(deps.nowFn()).toISOString().replace(/[:.]/g, "-");
  try {
    deps.writeFileFn(`${config.dumpDir}/${stamp}-${reqId}-${model.replace(/[^A-Za-z0-9]/g, "_")}.json`, bodyBuf);
  } catch {
    /* a dump is a convenience for reading prompts afterwards; it never fails the request */
  }
}

async function chatCompletions(bodyBuf: Buffer, reqId: string, started: number, config: RouterConfig, deps: RouterDeps): Promise<RouterResponse> {
  let body: ChatCompletionBody;
  try {
    body = JSON.parse(bodyBuf.toString()) as ChatCompletionBody;
  } catch {
    return reply(400, { error: { message: "bad json" } });
  }
  const model = String(body.model ?? "");
  dumpRequest(config, deps, reqId, model, bodyBuf);
  switch (selectRoute(model)) {
    case "claude": {
      const r = await claudeCompletion(body, reqId, config, deps);
      deps.log({
        reqId,
        route: "claude",
        model,
        status: r.status,
        ms: deps.nowFn() - started,
        attempt: r.attempt,
        cliModel: r.cliModel,
        usage: r.usage && { in: r.usage.input_tokens, cache_create: r.usage.cache_creation_input_tokens, cache_read: r.usage.cache_read_input_tokens, out: r.usage.output_tokens },
      });
      return reply(r.status, r.payload);
    }
    case "deepinfra": {
      if (!config.deepInfraKey) return reply(500, { error: { message: "DEEPINFRA_API_KEY unset" } });
      const r = await deepInfraCompletion(bodyBuf, model, reqId, started, config, deps);
      return reply(r.status, r.buf, { "content-type": r.contentType });
    }
    case "doris": {
      const r = await proxy(deps, `${config.dorisBaseUrl}/v1/chat/completions`, "POST", { "content-type": "application/json" }, bodyBuf);
      deps.log({ reqId, route: "doris", model, status: r.status, ms: deps.nowFn() - started, ...(r.status !== 200 ? { body: r.buf.toString().slice(0, 500) } : {}) });
      return reply(r.status, r.buf, { "content-type": r.contentType });
    }
  }
}

/** The whole shim as one function of a request, so it is tested without a port. */
export async function handleRouterRequest(req: RouterRequest, config: RouterConfig, deps: RouterDeps): Promise<RouterResponse> {
  const reqId = deps.reqIdFn();
  const started = deps.nowFn();
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      return await chatCompletions(req.body, reqId, started, config, deps);
    }
    if (url.pathname === "/api/ps" && req.method === "GET") {
      const r = await proxy(deps, `${config.dorisBaseUrl}/api/ps`, "GET", {}, undefined);
      let ps: { models?: OllamaLoadedModel[] } = {};
      try {
        ps = JSON.parse(r.buf.toString()) as { models?: OllamaLoadedModel[] };
      } catch {
        /* doris unreachable or not JSON: serve an empty list rather than fail the swapper's poll */
      }
      const { real, shown } = filterLoadedModels(ps, config.hideModels);
      deps.log({ reqId, route: "ps", real, shown: shown.map((m) => m.name), ms: deps.nowFn() - started });
      return reply(200, { models: shown });
    }
    if (url.pathname === "/api/generate" && req.method === "POST") {
      let body: { model?: unknown; keep_alive?: unknown } = {};
      try {
        body = JSON.parse(req.body.toString()) as typeof body;
      } catch {
        /* still a no-op */
      }
      deps.log({ reqId, route: "generate-noop", model: body.model, keep_alive: body.keep_alive });
      return reply(200, { model: body.model, done: true, shim: "no-op" });
    }
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/v1/")) {
      const r = await proxy(deps, `${config.dorisBaseUrl}${url.pathname}${url.search}`, req.method, { "content-type": req.headers["content-type"] ?? "application/json" }, req.body);
      deps.log({ reqId, route: "doris-passthrough", path: url.pathname, status: r.status, ms: deps.nowFn() - started });
      return reply(r.status, r.buf, { "content-type": r.contentType });
    }
    return reply(404, { error: { message: "not found" } });
  } catch (e) {
    deps.log({ reqId, route: "error", path: url.pathname, error: String(e), ms: deps.nowFn() - started });
    return reply(502, { error: { message: String(e) } });
  }
}

// ---------------------------------------------------------------- the HTTP server

/** The `node:http` wrapper around `handleRouterRequest`; not listening until the caller says so.
 *  Only `modelRouterCli.ts` calls this with real deps. */
export function createModelRouterServer(config: RouterConfig, deps: RouterDeps = defaultRouterDeps()): Server {
  return createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      void handleRouterRequest({ method: req.method ?? "GET", url: req.url ?? "/", headers: req.headers as Record<string, string | undefined>, body: Buffer.concat(chunks) }, config, deps).then((out) => {
        res.writeHead(out.status, out.headers);
        res.end(out.body);
      });
    });
  });
}
