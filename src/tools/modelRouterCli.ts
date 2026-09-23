// `npm run model-router` (OPUS-FIRST-DESIGN.md D2): the routing shim, started for real. Everything
// that decides anything is in `modelRouter.ts` and tested there against injected side effects;
// this file only supplies the real ones -- env, `fetch`, `spawn`, timers, stdout -- and listens.
// Configuration is by env alone (`configFromEnv`): SHIM_PORT (8799), SHIM_HOST (127.0.0.1),
// SHIM_DORIS (http://doris:11434), SHIM_HIDE_MODELS (qwen3:14b), SHIM_CLAUDE_CWD (this cwd),
// SHIM_DUMP_DIR (unset: no dumps), SHIM_LOCAL_URL / SHIM_LOCAL_MODELS (unset: no local route),
// DEEPINFRA_API_KEY (read here, sent as a bearer header, and never written or logged anywhere).
import { configFromEnv, createModelRouterServer, defaultRouterDeps } from "./modelRouter.js";

const config = configFromEnv(process.env, process.cwd());
const deps = defaultRouterDeps();
const server = createModelRouterServer(config, deps);
server.listen({ port: config.port, host: config.host }, () =>
  deps.log({ event: "listening", port: config.port, host: config.host, doris: config.dorisBaseUrl, hide: [...config.hideModels], local: config.localBaseUrl || "unset", localModels: [...config.localModels], claudeCwd: config.claudeCwd, deepInfraKey: config.deepInfraKey ? "set" : "unset" })
);
