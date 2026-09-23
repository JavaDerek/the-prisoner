// OPUS-FIRST-DESIGN.md D2: the routing shim, committed as this repository's own tool. The scratch
// `shim.mjs` that ran the 2026-09-20 ambition batch (RESULTS.md, "The routing") is the spec these
// tests pin -- route by model id, the Claude CLI translation, DeepInfra's retry-with-backoff and
// per-attempt timeout, the doris path's own per-attempt timeout with its one retry (2026-09-21),
// `/api/ps` with the resident hidden, `/api/generate` as a no-op. Every test
// runs against injected `fetchFn`/`spawnFn`/`delayFn`/`attemptSignalFn`/`killTimerFn` exactly as
// `ollamaSwap.test.ts` injects its own: no network, no `claude` process, no real timer, ever.
import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import {
  DEEPINFRA_DEFAULT_MAX_TOKENS,
  selectRoute,
  configFromEnv,
  translateClaudeRequest,
  buildClaudeArgs,
  claudeChildEnv,
  shapeClaudeReply,
  filterLoadedModels,
  handleRouterRequest,
  DEEPINFRA_BACKOFF_MS,
  type RouterConfig,
  type RouterDeps,
  type RouterChild,
  type RouterRequest,
} from "../modelRouter.js";

// ---------------------------------------------------------------- fixtures

const CONFIG: RouterConfig = {
  port: 8799,
  host: "127.0.0.1",
  dorisBaseUrl: "http://doris:11434",
  deepInfraBaseUrl: "https://api.deepinfra.com/v1/openai",
  deepInfraKey: "di-secret-key-never-logged",
  hideModels: new Set(["qwen3:14b"]),
  localBaseUrl: "",
  localModels: new Set<string>(),
  claudeCwd: "/tmp/claude-cwd",
  claudeTimeoutMs: 280_000,
  deepInfraAttemptTimeoutMs: 120_000,
  dorisAttemptTimeoutMs: 150_000,
  dumpDir: "",
};

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** A scripted fetch: each call takes the next entry, a Response or a function producing one
 *  (or throwing, or returning a never-settling promise for a hung connection). */
function scriptedFetch(script: Array<Response | ((url: string, init?: RequestInit) => Promise<Response>)>) {
  const calls: FetchCall[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const next = script.shift();
    if (next === undefined) throw new Error(`scriptedFetch: unexpected call to ${url}`);
    return typeof next === "function" ? next(url, init) : next;
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface SpawnCall {
  command: string;
  args: string[];
  options: { cwd: string; env: NodeJS.ProcessEnv };
}

/** A fake child: emits the scripted stdout and closes with the scripted code on the next tick,
 *  or -- for `hang: true` -- emits nothing until `kill` is called, then closes with code null. */
class FakeChild extends EventEmitter implements RouterChild {
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killedWith: string | undefined;
  constructor(private readonly script: { stdout?: string; stderr?: string; code?: number; hang?: boolean }) {
    super();
    if (!script.hang) {
      queueMicrotask(() => {
        if (script.stdout) this.stdout.emit("data", Buffer.from(script.stdout));
        if (script.stderr) this.stderr.emit("data", Buffer.from(script.stderr));
        this.emit("close", script.code ?? 0);
      });
    }
  }
  kill(signal?: string): boolean {
    this.killedWith = signal;
    queueMicrotask(() => this.emit("close", null));
    return true;
  }
}

function scriptedSpawn(script: Array<ConstructorParameters<typeof FakeChild>[0]>) {
  const calls: SpawnCall[] = [];
  const children: FakeChild[] = [];
  const spawnFn: RouterDeps["spawnFn"] = (command, args, options) => {
    calls.push({ command, args, options });
    const next = script.shift();
    if (next === undefined) throw new Error("scriptedSpawn: unexpected spawn");
    const child = new FakeChild(next);
    children.push(child);
    return child;
  };
  return { spawnFn, calls, children };
}

/** Deps that fail loudly on any side effect a test did not script, and record every log line. */
function deps(overrides: Partial<RouterDeps> = {}) {
  const logs: Record<string, unknown>[] = [];
  const delays: number[] = [];
  const d: RouterDeps = {
    fetchFn: (async (input: string | URL | Request) => {
      throw new Error(`unexpected fetch: ${String(input)}`);
    }) as unknown as typeof fetch,
    spawnFn: () => {
      throw new Error("unexpected spawn");
    },
    delayFn: async (ms) => {
      delays.push(ms);
    },
    attemptSignalFn: () => new AbortController().signal,
    killTimerFn: () => () => undefined,
    log: (obj) => logs.push(obj),
    nowFn: () => 1_700_000_000_000,
    reqIdFn: () => "req00001",
    env: { PATH: "/usr/bin", HOME: "/home/x" },
    writeFileFn: () => {
      throw new Error("unexpected writeFile");
    },
    ...overrides,
  };
  return { deps: d, logs, delays };
}

function post(url: string, body: unknown, headers: Record<string, string> = {}): RouterRequest {
  return { method: "POST", url, headers: { "content-type": "application/json", ...headers }, body: Buffer.from(JSON.stringify(body)) };
}

function get(url: string): RouterRequest {
  return { method: "GET", url, headers: {}, body: Buffer.alloc(0) };
}

function chatBody(model: string, extra: Record<string, unknown> = {}) {
  return {
    model,
    messages: [
      { role: "system", content: "You are the wits." },
      { role: "user", content: "The cell." },
    ],
    temperature: 0.9,
    ...extra,
  };
}

const SCHEMA = { type: "object", properties: { intent: { type: "string" } }, required: ["intent"] };

function parsed(res: { body: Buffer | string }): unknown {
  return JSON.parse(res.body.toString());
}

// ---------------------------------------------------------------- route selection

describe("selectRoute -- the one rule the whole shim turns on", () => {
  it("sends the three Claude aliases to the CLI", () => {
    expect(selectRoute("opus")).toBe("claude");
    expect(selectRoute("sonnet")).toBe("claude");
    expect(selectRoute("haiku")).toBe("claude");
  });

  it("sends any claude-* id to the CLI, so an Opus batch can pin its oracle by id (D1)", () => {
    expect(selectRoute("claude-opus-4-6")).toBe("claude");
    expect(selectRoute("claude-sonnet-5")).toBe("claude");
  });

  it("sends an org/model id to DeepInfra", () => {
    expect(selectRoute("Qwen/Qwen3-235B-A22B-Instruct-2507")).toBe("deepinfra");
  });

  it("sends everything else to doris unchanged, including the resident referee", () => {
    expect(selectRoute("qwen3:14b")).toBe("doris");
    expect(selectRoute("ancient-awakening:12b")).toBe("doris");
    expect(selectRoute("")).toBe("doris");
  });

  it("sends a model named in SHIM_LOCAL_MODELS to the local runtime, ahead of the doris default", () => {
    // 2026-09-23: doris's Ollama cannot load every GGUF worth measuring -- `muse-glimmer` is an
    // architecture its build does not know -- so such a model is served by a `llama-server` beside
    // it on another port. Naming the model is what picks that route; nothing about the id says it.
    const local = new Set(["muse-glimmer-30b"]);
    expect(selectRoute("muse-glimmer-30b", local)).toBe("local");
    expect(selectRoute("qwen3:14b", local)).toBe("doris");
    expect(selectRoute("muse-glimmer-30b")).toBe("doris");
  });

  it("never lets a local name capture a Claude or DeepInfra id, whatever is listed", () => {
    // The listed set is consulted only after the two routes that cost money or a subscription.
    const local = new Set(["claude-opus-4-6", "Qwen/Qwen3-235B-A22B-Instruct-2507"]);
    expect(selectRoute("claude-opus-4-6", local)).toBe("claude");
    expect(selectRoute("Qwen/Qwen3-235B-A22B-Instruct-2507", local)).toBe("deepinfra");
  });

  it("does not mistake a model merely named after Claude for a CLI route", () => {
    // Only the exact aliases and the `claude-` prefix: an Ollama tag like `claude:7b` stays on doris.
    expect(selectRoute("claude:7b")).toBe("doris");
    expect(selectRoute("Opus")).toBe("doris");
  });
});

// ---------------------------------------------------------------- configuration

describe("configFromEnv -- every knob is an env var, with the scratch shim's defaults", () => {
  it("defaults port 8799, loopback host, doris, and the resident referee hidden", () => {
    const c = configFromEnv({}, "/cwd");
    expect(c.port).toBe(8799);
    expect(c.host).toBe("127.0.0.1");
    expect(c.dorisBaseUrl).toBe("http://doris:11434");
    expect(c.deepInfraBaseUrl).toBe("https://api.deepinfra.com/v1/openai");
    expect([...c.hideModels]).toEqual(["qwen3:14b"]);
    expect(c.claudeCwd).toBe("/cwd");
    expect(c.deepInfraKey).toBe("");
    expect(c.dumpDir).toBe("");
    expect(c.localBaseUrl).toBe("");
    expect(c.localModels.size).toBe(0);
  });

  it("reads SHIM_LOCAL_URL and SHIM_LOCAL_MODELS, the second runtime beside doris's Ollama", () => {
    const c = configFromEnv({ SHIM_LOCAL_URL: "http://doris:11435/", SHIM_LOCAL_MODELS: "muse-glimmer-30b,other:1b," }, "/cwd");
    expect(c.localBaseUrl).toBe("http://doris:11435");
    expect([...c.localModels]).toEqual(["muse-glimmer-30b", "other:1b"]);
  });

  it("reads every SHIM_* override and the DeepInfra key from env only", () => {
    const c = configFromEnv(
      {
        SHIM_PORT: "9000",
        SHIM_HOST: "::1",
        SHIM_DORIS: "http://elsewhere:1/",
        SHIM_HIDE_MODELS: "qwen3:14b,ancient-awakening:12b,",
        SHIM_CLAUDE_CWD: "/other",
        SHIM_DUMP_DIR: "/dump",
        SHIM_CLAUDE_TIMEOUT_MS: "1000",
        SHIM_DEEPINFRA_ATTEMPT_TIMEOUT_MS: "2000",
        DEEPINFRA_API_KEY: "k",
      },
      "/cwd"
    );
    expect(c.port).toBe(9000);
    expect(c.host).toBe("::1");
    expect(c.dorisBaseUrl).toBe("http://elsewhere:1");
    expect([...c.hideModels]).toEqual(["qwen3:14b", "ancient-awakening:12b"]);
    expect(c.claudeCwd).toBe("/other");
    expect(c.dumpDir).toBe("/dump");
    expect(c.claudeTimeoutMs).toBe(1000);
    expect(c.deepInfraAttemptTimeoutMs).toBe(2000);
    expect(c.deepInfraKey).toBe("k");
  });

  it("SHIM_HIDE_MODELS= (empty) hides nothing, for a run whose every model really lives on doris", () => {
    expect(configFromEnv({ SHIM_HIDE_MODELS: "" }, "/cwd").hideModels.size).toBe(0);
  });

  it("reads SHIM_DORIS_ATTEMPT_TIMEOUT_MS, defaulting to 150s: above the slowest real doris call, inside the mind's 300s", () => {
    expect(configFromEnv({}, "/cwd").dorisAttemptTimeoutMs).toBe(150_000);
    expect(configFromEnv({ SHIM_DORIS_ATTEMPT_TIMEOUT_MS: "3000" }, "/cwd").dorisAttemptTimeoutMs).toBe(3000);
  });
});

// ---------------------------------------------------------------- Claude request translation

describe("translateClaudeRequest -- OpenAI messages become one prompt and one system prompt", () => {
  it("joins system messages into --system-prompt and the rest into -p, each with a blank line between", () => {
    const req = translateClaudeRequest({
      model: "claude-opus-4-6",
      messages: [
        { role: "system", content: "A" },
        { role: "user", content: "B" },
        { role: "assistant", content: "C" },
        { role: "system", content: "D" },
        { role: "user", content: "E" },
      ],
    });
    expect(req.model).toBe("claude-opus-4-6");
    expect(req.systemPrompt).toBe("A\n\nD");
    expect(req.prompt).toBe("B\n\nC\n\nE");
    expect(req.schema).toBeUndefined();
  });

  it("lifts response_format.json_schema.schema out for --json-schema, and only that shape", () => {
    const withSchema = translateClaudeRequest({ model: "opus", messages: [], response_format: { type: "json_schema", json_schema: { name: "x", schema: SCHEMA } } });
    expect(withSchema.schema).toEqual(SCHEMA);
    const jsonObject = translateClaudeRequest({ model: "opus", messages: [], response_format: { type: "json_object" } });
    expect(jsonObject.schema).toBeUndefined();
  });

  it("tolerates a body with no messages at all", () => {
    const req = translateClaudeRequest({ model: "opus" });
    expect(req.prompt).toBe("");
    expect(req.systemPrompt).toBe("");
  });
});

describe("buildClaudeArgs -- the invocation RESULTS.md records, verbatim", () => {
  it("is exactly: -p, --model, --output-format json, --system-prompt, --tools '', --no-session-persistence", () => {
    expect(buildClaudeArgs({ model: "claude-opus-4-6", systemPrompt: "S", prompt: "P" })).toEqual([
      "-p", "P",
      "--model", "claude-opus-4-6",
      "--output-format", "json",
      "--system-prompt", "S",
      "--tools", "",
      "--no-session-persistence",
    ]);
  });

  it("passes --system-prompt '' rather than omitting it when there is no system message", () => {
    const args = buildClaudeArgs({ model: "opus", systemPrompt: "", prompt: "P" });
    expect(args.slice(args.indexOf("--system-prompt"), args.indexOf("--system-prompt") + 2)).toEqual(["--system-prompt", ""]);
  });

  it("appends --json-schema with the schema serialised, last", () => {
    const args = buildClaudeArgs({ model: "opus", systemPrompt: "", prompt: "P", schema: SCHEMA });
    expect(args.slice(-2)).toEqual(["--json-schema", JSON.stringify(SCHEMA)]);
  });
});

describe("claudeChildEnv -- subscription auth only (brink's preflight rule, restated here, never imported)", () => {
  it("deletes ANTHROPIC_API_KEY and ANTHROPIC_AUTH_TOKEN and keeps everything else", () => {
    const env = claudeChildEnv({ PATH: "/usr/bin", ANTHROPIC_API_KEY: "sk-metered", ANTHROPIC_AUTH_TOKEN: "tok", HOME: "/h" });
    expect(env).toEqual({ PATH: "/usr/bin", HOME: "/h" });
    expect("ANTHROPIC_API_KEY" in env).toBe(false);
    expect("ANTHROPIC_AUTH_TOKEN" in env).toBe(false);
  });
});

describe("shapeClaudeReply -- the CLI's JSON result becomes one chat.completion", () => {
  const req = { model: "claude-opus-4-6", systemPrompt: "", prompt: "P", schema: SCHEMA };

  it("returns structured_output as a JSON string in choices[0].message.content when a schema was sent", () => {
    const out = shapeClaudeReply({ is_error: false, result: "prose", structured_output: { intent: "wait" }, usage: { input_tokens: 10, output_tokens: 3 } }, req, "abc", 1_700_000_000_000);
    expect(out).not.toBeNull();
    expect(out?.payload.choices[0].message.content).toBe(JSON.stringify({ intent: "wait" }));
    expect(out?.payload.choices[0].message.role).toBe("assistant");
    expect(out?.payload.choices[0].finish_reason).toBe("stop");
    expect(out?.payload.model).toBe("claude-opus-4-6");
    expect(out?.payload.id).toBe("chatcmpl-shim-abc");
    expect(out?.payload.object).toBe("chat.completion");
    expect(out?.payload.created).toBe(1_700_000_000);
    expect(out?.payload.usage).toEqual({ prompt_tokens: 10, completion_tokens: 3, total_tokens: 0 });
  });

  it("falls back to result when a schema was sent but no structured_output came back", () => {
    const out = shapeClaudeReply({ is_error: false, result: '{"intent":"x"}' }, req, "abc", 0);
    expect(out?.payload.choices[0].message.content).toBe('{"intent":"x"}');
    expect(out?.payload.usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  });

  it("returns result as-is when no schema was sent, even if structured_output is present", () => {
    const out = shapeClaudeReply({ is_error: false, result: "plain", structured_output: { a: 1 } }, { ...req, schema: undefined }, "abc", 0);
    expect(out?.payload.choices[0].message.content).toBe("plain");
  });

  it("names the model the CLI actually used, from modelUsage, so a transcript can check the pin", () => {
    const out = shapeClaudeReply({ is_error: false, result: "r", modelUsage: { "claude-opus-4-6-20260101": {} } }, { ...req, schema: undefined }, "abc", 0);
    expect(out?.cliModel).toBe("claude-opus-4-6-20260101");
  });

  it("is null for is_error true (a refusal), an empty result, or a non-object", () => {
    expect(shapeClaudeReply({ is_error: true, result: "refused" }, req, "abc", 0)).toBeNull();
    expect(shapeClaudeReply({ is_error: false, result: "" }, { ...req, schema: undefined }, "abc", 0)).toBeNull();
    expect(shapeClaudeReply({ result: "no is_error field" }, req, "abc", 0)).toBeNull();
    expect(shapeClaudeReply(null, req, "abc", 0)).toBeNull();
    expect(shapeClaudeReply("not json", req, "abc", 0)).toBeNull();
  });
});

// ---------------------------------------------------------------- the Claude route, end to end through the handler

describe("POST /v1/chat/completions -> claude CLI", () => {
  const cliOk = JSON.stringify({ is_error: false, result: "x", structured_output: { intent: "look" }, usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 4, cache_creation_input_tokens: 1 }, modelUsage: { "claude-opus-4-6": {} } });

  it("spawns `claude` with the translated args in SHIM_CLAUDE_CWD, without metered auth in its env, and shapes the reply", async () => {
    const spawn = scriptedSpawn([{ stdout: cliOk }]);
    const { deps: d, logs } = deps({ spawnFn: spawn.spawnFn, env: { PATH: "/p", ANTHROPIC_API_KEY: "metered" } });
    const body = chatBody("claude-opus-4-6", { response_format: { type: "json_schema", json_schema: { name: "wits", schema: SCHEMA } }, reasoning_effort: "high" });
    const res = await handleRouterRequest(post("/v1/chat/completions", body), CONFIG, d);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/json");
    const payload = parsed(res) as { choices: Array<{ message: { content: string } }>; model: string };
    expect(payload.model).toBe("claude-opus-4-6");
    expect(payload.choices[0].message.content).toBe(JSON.stringify({ intent: "look" }));

    expect(spawn.calls).toHaveLength(1);
    expect(spawn.calls[0].command).toBe("claude");
    expect(spawn.calls[0].args).toEqual([
      "-p", "The cell.",
      "--model", "claude-opus-4-6",
      "--output-format", "json",
      "--system-prompt", "You are the wits.",
      "--tools", "",
      "--no-session-persistence",
      "--json-schema", JSON.stringify(SCHEMA),
    ]);
    expect(spawn.calls[0].options.cwd).toBe("/tmp/claude-cwd");
    expect(spawn.calls[0].options.env).toEqual({ PATH: "/p" });

    // One JSON line per request, naming the route, the model, the attempt that succeeded, the CLI's
    // own model id and the usage -- the shape the ambition batch's logs/ were read by.
    const line = logs.find((l) => l.route === "claude" && l.status === 200);
    expect(line).toMatchObject({ reqId: "req00001", model: "claude-opus-4-6", attempt: 1, cliModel: "claude-opus-4-6", usage: { in: 5, out: 2, cache_read: 4, cache_create: 1 } });
    expect(typeof line?.ms).toBe("number");
  });

  it("retries once on an unusable reply, then serves the second attempt", async () => {
    const spawn = scriptedSpawn([{ stdout: "not json", code: 1, stderr: "boom" }, { stdout: cliOk }]);
    const { deps: d, logs } = deps({ spawnFn: spawn.spawnFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("opus")), CONFIG, d);
    expect(res.status).toBe(200);
    expect(spawn.calls).toHaveLength(2);
    expect(logs.filter((l) => l.event === "attempt-failed")).toHaveLength(1);
    expect(logs.find((l) => l.event === "attempt-failed")).toMatchObject({ route: "claude", attempt: 1, code: 1, stderr: "boom", stdout: "not json" });
    expect(logs.find((l) => l.route === "claude" && l.status === 200)?.attempt).toBe(2);
  });

  it("answers 502 after two refusals (is_error true), so a silent arm is a failed call and never an empty turn", async () => {
    const refusal = JSON.stringify({ is_error: true, result: "I can't help with that." });
    const spawn = scriptedSpawn([{ stdout: refusal }, { stdout: refusal }]);
    const { deps: d, logs } = deps({ spawnFn: spawn.spawnFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("claude-opus-5")), CONFIG, d);
    expect(res.status).toBe(502);
    const payload = parsed(res) as { error: { message: string; detail: { stdout: string } } };
    expect(payload.error.message).toMatch(/no usable reply after 2 attempts/);
    expect(payload.error.detail.stdout).toBe(refusal);
    expect(spawn.calls).toHaveLength(2);
    expect(logs.filter((l) => l.event === "attempt-failed")).toHaveLength(2);
    expect(logs.find((l) => l.route === "claude" && l.status === 502)).toBeDefined();
  });

  it("kills a hung CLI at SHIM_CLAUDE_TIMEOUT_MS and counts it as a failed attempt", async () => {
    const spawn = scriptedSpawn([{ hang: true }, { stdout: cliOk }]);
    const timerCalls: number[] = [];
    const { deps: d } = deps({
      spawnFn: spawn.spawnFn,
      // The injected timer fires at once: a real one would wait 280s.
      killTimerFn: (kill, ms) => {
        timerCalls.push(ms);
        queueMicrotask(kill);
        return () => undefined;
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("opus")), CONFIG, d);
    expect(res.status).toBe(200);
    expect(timerCalls[0]).toBe(280_000);
    expect(spawn.children[0].killedWith).toBe("SIGKILL");
  });

  it("treats a spawn error (no `claude` on PATH) as a failed attempt rather than an unhandled rejection", async () => {
    // The error is queued from inside spawnFn, so it fires only once the listeners are attached --
    // as a real ENOENT does, on the tick after `spawn` returns.
    const { deps: d } = deps({
      spawnFn: () => {
        const child = new FakeChild({ hang: true });
        queueMicrotask(() => child.emit("error", new Error("spawn claude ENOENT")));
        return child;
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("opus")), CONFIG, d);
    expect(res.status).toBe(502);
    expect((parsed(res) as { error: { detail: { code: number; stderr: string } } }).error.detail).toMatchObject({ code: -1, stderr: "Error: spawn claude ENOENT" });
  });
});

// ---------------------------------------------------------------- the DeepInfra route

describe("POST /v1/chat/completions -> DeepInfra", () => {
  const MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507";
  const ok = { id: "x", choices: [{ message: { role: "assistant", content: "{}" } }] };

  it("forwards the body byte-for-byte with the bearer key, and returns the upstream reply unchanged", async () => {
    const f = scriptedFetch([json(200, ok)]);
    const { deps: d, logs, delays } = deps({ fetchFn: f.fetchFn });
    const req = post("/v1/chat/completions", chatBody(MODEL));
    const res = await handleRouterRequest(req, CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual(ok);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe("https://api.deepinfra.com/v1/openai/chat/completions");
    expect(f.calls[0].init?.method).toBe("POST");
    expect(f.calls[0].init?.headers).toEqual({ "content-type": "application/json", authorization: "Bearer di-secret-key-never-logged" });
    // The body is forwarded as sent, except for the output budget DeepInfra needs (below).
    expect(JSON.parse(Buffer.from(f.calls[0].init?.body as Buffer).toString())).toEqual({ ...JSON.parse(req.body.toString()), max_tokens: DEEPINFRA_DEFAULT_MAX_TOKENS });
    expect(f.calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(delays).toEqual([]);
    expect(logs.find((l) => l.route === "deepinfra")).toMatchObject({ model: MODEL, attempt: 1, status: 200 });
  });

  // A slow ruling is either the model writing a lot (its own behaviour, which follows it to any host) or waiting
  // in someone else's queue (which does not). DeepInfra returns token counts on every reply; logging them is what
  // tells the two apart (`checkpoints/2026-09-22-referee-capacity/`).
  it("logs the reply's token counts beside the latency", async () => {
    const f = scriptedFetch([json(200, { choices: [{ message: { content: "[]" } }], usage: { prompt_tokens: 3210, completion_tokens: 1980 } })]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(logs.find((l) => l.route === "deepinfra")).toMatchObject({ status: 200, usage: { in: 3210, out: 1980 } });
  });

  // DeepInfra defaults `max_tokens` to the model's whole context when a request omits one, so a long
  // referee prompt is rejected outright: "This model's maximum context length is 40960 tokens. However, you
  // requested 40960 output tokens and your prompt contains 12769 characters" -- every call to
  // Qwen/Qwen3-30B-A3B failed that way in under a second (`checkpoints/2026-09-22-referee-capacity/`).
  it("supplies an output budget when the caller left one unset, and never overrides the caller's own", async () => {
    const ok = { choices: [{ message: { content: "[]" } }] };
    const f = scriptedFetch([json(200, ok), json(200, ok)]);
    const { deps: d } = deps({ fetchFn: f.fetchFn });
    await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL, { max_tokens: 64 })), CONFIG, d);
    expect(JSON.parse(Buffer.from(f.calls[0].init?.body as Buffer).toString()).max_tokens).toBe(DEEPINFRA_DEFAULT_MAX_TOKENS);
    expect(JSON.parse(Buffer.from(f.calls[1].init?.body as Buffer).toString()).max_tokens).toBe(64);
  });

  it("retries 429 engine_overloaded with the recorded backoff (3s, 6s, 12s, 24s, 30s) and serves the first success", async () => {
    const overloaded = () => json(429, { error: "engine_overloaded" });
    const f = scriptedFetch([overloaded(), overloaded(), overloaded(), json(200, ok)]);
    const { deps: d, logs, delays } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(res.status).toBe(200);
    expect(f.calls).toHaveLength(4);
    expect(delays).toEqual([3000, 6000, 12000]);
    expect(DEEPINFRA_BACKOFF_MS).toEqual([3000, 6000, 12000, 24000, 30000]);
    // Every attempt is logged so a game that needed retries is visible afterwards; a failed one carries the body.
    const attempts = logs.filter((l) => l.route === "deepinfra");
    expect(attempts.map((l) => l.attempt)).toEqual([1, 2, 3, 4]);
    expect(attempts[0]).toMatchObject({ status: 429, body: JSON.stringify({ error: "engine_overloaded" }) });
    expect(attempts[3]).not.toHaveProperty("body");
  });

  it("retries 5xx too, and gives up after the backoff table is exhausted, returning the last upstream status", async () => {
    const f = scriptedFetch(Array.from({ length: 6 }, () => json(503, { error: "down" })));
    const { deps: d, delays } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(res.status).toBe(503);
    expect(parsed(res)).toEqual({ error: "down" });
    expect(f.calls).toHaveLength(6);
    expect(delays).toEqual([3000, 6000, 12000, 24000, 30000]);
  });

  it("does not retry a 4xx that is not 429 -- a bad request stays bad", async () => {
    const f = scriptedFetch([json(400, { error: "bad" })]);
    const { deps: d, delays } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(res.status).toBe(400);
    expect(f.calls).toHaveLength(1);
    expect(delays).toEqual([]);
  });

  it("abandons a hung attempt at the per-attempt timeout as a retryable 599 (D game 1 lost a half-round to a 300s hang)", async () => {
    // The per-attempt signal is what fetch honours; injected here as one already aborted, so the
    // scripted fetch does exactly what undici does with an aborted signal -- reject -- instantly.
    const signals: number[] = [];
    const f = scriptedFetch([
      async (_url, init) => {
        expect(init?.signal?.aborted).toBe(true);
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
      json(200, ok),
    ]);
    const { deps: d, logs, delays } = deps({
      fetchFn: f.fetchFn,
      attemptSignalFn: (ms) => {
        signals.push(ms);
        return AbortSignal.abort();
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(res.status).toBe(200);
    expect(signals).toEqual([120_000, 120_000]);
    expect(delays).toEqual([3000]);
    const first = logs.find((l) => l.route === "deepinfra" && l.attempt === 1);
    expect(first?.status).toBe(599);
    expect(String(first?.body)).toMatch(/shim: attempt failed: .*aborted/);
  });

  it("answers 500 without calling anyone when DEEPINFRA_API_KEY is unset", async () => {
    const { deps: d } = deps();
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), { ...CONFIG, deepInfraKey: "" }, d);
    expect(res.status).toBe(500);
    expect((parsed(res) as { error: { message: string } }).error.message).toBe("DEEPINFRA_API_KEY unset");
  });

  it("never writes the key into a log line", async () => {
    const f = scriptedFetch([json(429, { error: "engine_overloaded" }), json(200, ok)]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    await handleRouterRequest(post("/v1/chat/completions", chatBody(MODEL)), CONFIG, d);
    expect(JSON.stringify(logs)).not.toContain("di-secret-key-never-logged");
  });
});

// ---------------------------------------------------------------- the doris route

describe("POST /v1/chat/completions -> doris, unchanged", () => {
  it("proxies the body byte-for-byte to SHIM_DORIS/v1/chat/completions with no auth header and no retry", async () => {
    const reply = { choices: [{ message: { content: "<think>..</think>{}" } }] };
    const f = scriptedFetch([json(200, reply)]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    const req = post("/v1/chat/completions", chatBody("qwen3:14b"));
    const res = await handleRouterRequest(req, CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual(reply);
    expect(f.calls[0].url).toBe("http://doris:11434/v1/chat/completions");
    expect(f.calls[0].init?.headers).toEqual({ "content-type": "application/json" });
    expect(Buffer.from(f.calls[0].init?.body as Buffer).equals(req.body)).toBe(true);
    expect(logs.find((l) => l.route === "doris")).toMatchObject({ model: "qwen3:14b", status: 200 });
  });

  it("passes an upstream error through with its status and a slice of the body in the log", async () => {
    const f = scriptedFetch([json(500, { error: "model not found" })]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("nope:1b")), CONFIG, d);
    expect(res.status).toBe(500);
    expect(logs.find((l) => l.route === "doris")).toMatchObject({ status: 500, body: JSON.stringify({ error: "model not found" }) });
  });

  it("answers 400 to a body that is not JSON", async () => {
    const { deps: d } = deps();
    const res = await handleRouterRequest({ method: "POST", url: "/v1/chat/completions", headers: {}, body: Buffer.from("{nope") }, CONFIG, d);
    expect(res.status).toBe(400);
  });

  // The per-attempt timeout and its one retry (phase1-b1, 2026-09-21: two half-rounds lost to
  // 300s hangs of the upstream fetch while doris itself never took more than 53s).
  it("a normal 200 makes exactly one fetch, carrying the per-attempt signal, and logs attempt 1", async () => {
    const signals: number[] = [];
    const f = scriptedFetch([json(200, {})]);
    const { deps: d, logs, delays } = deps({
      fetchFn: f.fetchFn,
      attemptSignalFn: (ms) => {
        signals.push(ms);
        return new AbortController().signal;
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("qwen3:14b")), CONFIG, d);
    expect(res.status).toBe(200);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(signals).toEqual([150_000]);
    expect(delays).toEqual([]);
    expect(logs.filter((l) => l.route === "doris")).toEqual([expect.objectContaining({ model: "qwen3:14b", attempt: 1, status: 200 })]);
  });

  it("abandons a hung first attempt at SHIM_DORIS_ATTEMPT_TIMEOUT_MS, tries once more, and serves the second attempt's body", async () => {
    // Injected already aborted for the first attempt only, so the scripted fetch does what undici
    // does with an aborted signal -- reject -- instantly, and the second attempt is a real call.
    const reply = { choices: [{ message: { content: "second" } }] };
    const signals: number[] = [];
    const f = scriptedFetch([
      async (_url, init) => {
        expect(init?.signal?.aborted).toBe(true);
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
      json(200, reply),
    ]);
    const { deps: d, logs } = deps({
      fetchFn: f.fetchFn,
      attemptSignalFn: (ms) => {
        signals.push(ms);
        return signals.length === 1 ? AbortSignal.abort() : new AbortController().signal;
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("qwen3:14b")), CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual(reply);
    expect(f.calls).toHaveLength(2);
    expect(signals).toEqual([150_000, 150_000]);
    const attempts = logs.filter((l) => l.route === "doris");
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ model: "qwen3:14b", attempt: 1, status: 599 });
    expect(String(attempts[0].body)).toMatch(/shim: attempt failed: .*aborted/);
    expect(attempts[1]).toMatchObject({ model: "qwen3:14b", attempt: 2, status: 200 });
    expect(logs.find((l) => l.route === "error")).toBeUndefined();
  });

  it("answers 502 naming both attempts when the second hangs too, so the mind sees a failed call and not 300s of silence", async () => {
    const f = scriptedFetch([
      async () => {
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
      async () => {
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
    ]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn, attemptSignalFn: () => AbortSignal.abort() });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("qwen3:14b")), CONFIG, d);
    expect(res.status).toBe(502);
    expect(f.calls).toHaveLength(2);
    const message = (parsed(res) as { error: { message: string } }).error.message;
    expect(message).toMatch(/doris/);
    expect(message).toMatch(/2 attempts/);
    expect(message).toMatch(/150000ms/);
    expect(message).toMatch(/aborted/);
    expect(logs.filter((l) => l.route === "doris").map((l) => [l.attempt, l.status])).toEqual([
      [1, 599],
      [2, 599],
    ]);
    expect(logs.find((l) => l.route === "error")).toMatchObject({ path: "/v1/chat/completions" });
  });

  it("never retries an HTTP error status from doris: that is doris's real answer, served as-is", async () => {
    const f = scriptedFetch([json(500, { error: "model not found" })]);
    const { deps: d, logs, delays } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("nope:1b")), CONFIG, d);
    expect(res.status).toBe(500);
    expect(parsed(res)).toEqual({ error: "model not found" });
    expect(f.calls).toHaveLength(1);
    expect(delays).toEqual([]);
    expect(logs.filter((l) => l.route === "doris")).toEqual([expect.objectContaining({ attempt: 1, status: 500 })]);
  });

  it("dumps the raw request to SHIM_DUMP_DIR when configured, named by time, request id and model", async () => {
    const f = scriptedFetch([json(200, {})]);
    const writes: Array<{ path: string; data: Buffer }> = [];
    const { deps: d } = deps({ fetchFn: f.fetchFn, writeFileFn: (path, data) => writes.push({ path, data }) });
    const req = post("/v1/chat/completions", chatBody("qwen3:14b"));
    await handleRouterRequest(req, { ...CONFIG, dumpDir: "/dump" }, d);
    expect(writes).toHaveLength(1);
    expect(writes[0].path).toBe("/dump/2023-11-14T22-13-20-000Z-req00001-qwen3_14b.json");
    expect(writes[0].data.equals(req.body)).toBe(true);
  });

  it("a failing dump never fails the request", async () => {
    const f = scriptedFetch([json(200, {})]);
    const { deps: d } = deps({
      fetchFn: f.fetchFn,
      writeFileFn: () => {
        throw new Error("EACCES");
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("qwen3:14b")), { ...CONFIG, dumpDir: "/dump" }, d);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------- /api/ps and /api/generate

describe("POST /v1/chat/completions -> a local runtime beside doris (SHIM_LOCAL_URL)", () => {
  // Batch 3's referee is a GGUF doris's Ollama build cannot load at all ("unknown model
  // architecture: 'muse-glimmer'"), served by `llama-server` on another port of the same machine.
  // Only the chat call moves: `/api/ps` still asks the real Ollama, so the swapper's
  // foreign-model guard still sees what it would have seen (`checkpoints/2026-09-23-phase1-b3/`).
  const LOCAL: RouterConfig = { ...CONFIG, localBaseUrl: "http://doris:11435", localModels: new Set(["muse-glimmer-30b"]) };

  it("proxies the body byte-for-byte to SHIM_LOCAL_URL/v1/chat/completions and logs it as its own route", async () => {
    const reply = { choices: [{ message: { content: "[]" } }] };
    const f = scriptedFetch([json(200, reply)]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    const req = post("/v1/chat/completions", chatBody("muse-glimmer-30b"));
    const res = await handleRouterRequest(req, LOCAL, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual(reply);
    expect(f.calls[0].url).toBe("http://doris:11435/v1/chat/completions");
    expect(Buffer.from(f.calls[0].init?.body as Buffer).equals(req.body)).toBe(true);
    expect(logs.find((l) => l.route === "local")).toMatchObject({ model: "muse-glimmer-30b", status: 200, attempt: 1 });
  });

  it("gets the same one retry of a hung attempt the doris path has, for the same reason", async () => {
    const f = scriptedFetch([
      async (_url, init) => {
        expect(init?.signal?.aborted).toBe(true);
        throw new DOMException("The operation was aborted", "TimeoutError");
      },
      json(200, { ok: true }),
    ]);
    let first = true;
    const { deps: d, logs } = deps({
      fetchFn: f.fetchFn,
      attemptSignalFn: () => {
        if (!first) return new AbortController().signal;
        first = false;
        return AbortSignal.abort();
      },
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("muse-glimmer-30b")), LOCAL, d);
    expect(res.status).toBe(200);
    expect(f.calls).toHaveLength(2);
    expect(logs.filter((l) => l.route === "local").map((l) => l.attempt)).toEqual([1, 2]);
  });

  it("leaves /api/ps pointed at the real Ollama, so the foreign-model guard still fires", async () => {
    const f = scriptedFetch([json(200, { models: [{ name: "somebody-elses:70b" }] })]);
    const { deps: d } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest({ method: "GET", url: "/api/ps", headers: {}, body: Buffer.alloc(0) }, LOCAL, d);
    expect(f.calls[0].url).toBe("http://doris:11434/api/ps");
    expect(parsed(res)).toEqual({ models: [{ name: "somebody-elses:70b" }] });
  });
});

describe("filterLoadedModels -- hide the resident, show everyone else", () => {
  const loaded = (name: string) => ({ name, size: 1, size_vram: 1, expires_at: "2300-01-01T00:00:00Z" });

  it("removes exactly the configured models and reports both lists", () => {
    const out = filterLoadedModels({ models: [loaded("qwen3:14b"), loaded("someone-elses:70b")] }, new Set(["qwen3:14b"]));
    expect(out.real).toEqual(["qwen3:14b", "someone-elses:70b"]);
    expect(out.shown.map((m) => m.name)).toEqual(["someone-elses:70b"]);
  });

  it("copes with a reply that has no models field", () => {
    expect(filterLoadedModels({}, new Set(["qwen3:14b"]))).toEqual({ real: [], shown: [] });
  });
});

describe("GET /api/ps", () => {
  it("serves doris's real /api/ps with the resident referee removed, so the swapper never unloads it to make room for a model that is not on doris", async () => {
    const f = scriptedFetch([json(200, { models: [{ name: "qwen3:14b", size: 1, size_vram: 1, expires_at: "x" }] })]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(get("/api/ps"), CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual({ models: [] });
    expect(f.calls[0].url).toBe("http://doris:11434/api/ps");
    expect(f.calls[0].init?.method).toBe("GET");
    expect(logs.find((l) => l.route === "ps")).toMatchObject({ real: ["qwen3:14b"], shown: [] });
  });

  it("still shows any OTHER loaded model, so the foreign-model guard fires exactly as it would without the shim", async () => {
    const other = { name: "someone-elses:70b", size: 2, size_vram: 2, expires_at: "y" };
    const f = scriptedFetch([json(200, { models: [{ name: "qwen3:14b", size: 1, size_vram: 1, expires_at: "x" }, other] })]);
    const { deps: d } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(get("/api/ps"), CONFIG, d);
    expect(parsed(res)).toEqual({ models: [other] });
  });

  it("serves an empty list when doris answers with something that is not JSON", async () => {
    const f = scriptedFetch([new Response("<html>", { status: 502 })]);
    const { deps: d } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(get("/api/ps"), CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual({ models: [] });
  });
});

describe("POST /api/generate", () => {
  it("is a no-op 200 that never reaches doris: the swapper only uses it to set keep_alive, and doris's pin is left exactly as found", async () => {
    const { deps: d, logs } = deps();
    const res = await handleRouterRequest(post("/api/generate", { model: "qwen3:14b", keep_alive: 0 }), CONFIG, d);
    expect(res.status).toBe(200);
    expect(parsed(res)).toEqual({ model: "qwen3:14b", done: true, shim: "no-op" });
    expect(logs.find((l) => l.route === "generate-noop")).toMatchObject({ model: "qwen3:14b", keep_alive: 0 });
  });
});

// ---------------------------------------------------------------- everything else

describe("passthrough and errors", () => {
  it("proxies any other /api or /v1 path to doris with method, query and content-type intact", async () => {
    const f = scriptedFetch([json(200, { models: [] })]);
    const { deps: d, logs } = deps({ fetchFn: f.fetchFn });
    const res = await handleRouterRequest(get("/api/tags?x=1"), CONFIG, d);
    expect(res.status).toBe(200);
    expect(f.calls[0].url).toBe("http://doris:11434/api/tags?x=1");
    expect(f.calls[0].init?.method).toBe("GET");
    expect(f.calls[0].init?.body).toBeUndefined();
    expect(logs.find((l) => l.route === "doris-passthrough")).toMatchObject({ path: "/api/tags", status: 200 });
  });

  it("answers 404 off /api and /v1", async () => {
    const { deps: d } = deps();
    expect((await handleRouterRequest(get("/"), CONFIG, d)).status).toBe(404);
  });

  it("turns a thrown upstream failure into a 502 with the error named, and logs it", async () => {
    const { deps: d, logs } = deps({
      fetchFn: (async () => {
        throw new Error("ECONNREFUSED");
      }) as unknown as typeof fetch,
    });
    const res = await handleRouterRequest(post("/v1/chat/completions", chatBody("qwen3:14b")), CONFIG, d);
    expect(res.status).toBe(502);
    expect((parsed(res) as { error: { message: string } }).error.message).toMatch(/ECONNREFUSED/);
    expect(logs.find((l) => l.route === "error")).toMatchObject({ path: "/v1/chat/completions" });
  });
});
