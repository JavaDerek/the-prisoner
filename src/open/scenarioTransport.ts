import { reasoningFields, type ThinkingMode } from "./thinking.js";

/**
 * the-prisoner#3, enjoyable mode's own generation call -- the free-text half
 * of scenario generation (the honesty review's own transport is
 * `createRefereeTransport`, reused as-is: it is already a generic
 * `run-dmcp` turn-reader transport with no game vocabulary of its own).
 *
 * Built the same way `refereeTransport.ts` is (this task's own precedent, its
 * header: "a plain async function in this repo that calls the configured
 * referee model through the swapper... never in run-dmcp or mind-seam"): a
 * POST to an OpenAI-compatible `/chat/completions` endpoint, `tools: []`,
 * `stream: false`, no credential. Unlike the referee, this call asks for
 * PROSE, not closed keys -- there is nothing here for `run-dmcp` to own, so
 * this module owns the whole exchange itself.
 *
 * FAILURE IS `null`, never a throw -- `generateObjectDescription`
 * (`scenarioGen.ts`) treats a `null` exactly like an empty reply: one failed
 * attempt, tried again up to `MAX_GENERATION_ATTEMPTS` times, then a fall
 * back to the authored text. The identical discipline
 * `refereeTransport.ts`'s own header states for its `[]`.
 *
 * NEVER RUN AGAINST doris IN THIS TASK. Exercised only with an injected
 * `fetchFn` (`scenarioTransport.test.ts`).
 */
export interface CreateScenarioGenerationTransportOptions {
  baseUrl: string;
  model: string;
  /** CODER-BRIEF decision 4: 0.9 by default (`PRISONER_SCENARIO_TEMPERATURE`,
   *  `scenarioMode.ts`) -- variety is the point of enjoyable mode, unlike the
   *  referee's fixed 0. Passed in, never hardcoded here, so a caller (or a
   *  test) can see exactly what temperature a given attempt asked for. */
  temperature: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  /** GPU-safe swap check (`src/ollamaSwap.ts`), mirroring
   *  `CreateRefereeTransportOptions.ensureLoaded` -- called once per
   *  generation call, before the request itself. */
  ensureLoaded?: (model: string) => Promise<void>;
  /** `thinking.ts`'s own switch, threaded through here so Muse-on-Ollama's
   *  `reasoning_effort: "none"` + `stop: ["<|eot|>"]` handling applies to the
   *  generation call exactly as it does to the referee and wits calls
   *  (CODER-BRIEF decision 4). `"on"` (the default) sends no reasoning field
   *  at all, leaving the served model's own configuration to decide. */
  thinking?: ThinkingMode;
}

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * CODER-BRIEF decision 2: fresh physical texture (material, size, wear,
 * colour, smell) that preserves every fact FACTS states, never a use, never
 * another object's name or a plural of one (the-prisoner#26/§76's own
 * lesson, generalised in run-dmcp's `docs/AUTHORING-GUIDE.md` per this
 * repository's CLAUDE.md), and never a new object. Exported so the dry-run
 * CLI (`scenarioGenCli.ts`) can print exactly the prompt a real run would
 * send, without sending it.
 */
export function buildGenerationPrompt(objectId: string, facts: string): string {
  return [
    "You are writing fresh physical texture for one object in a physical scene, for a game that regenerates the room's look every time it is played.",
    "",
    `OBJECT: ${objectId}`,
    "",
    "FACTS YOU MUST PRESERVE, unchanged in substance -- every physical fact and relationship this text states, including what is attached to what, what closes what, and anything it can do that these facts already state:",
    facts,
    "",
    "Rewrite this object's description with fresh physical texture -- material, size, wear, colour, smell -- never inventing a new fact, a use, or an effect the object produces, and never naming any other object in the scene, in the singular or the plural. " +
      "Keep every fact FACTS states, in different words if you like, but never drop, add to, or contradict one. Never introduce a new object.",
    "",
    'Reply with the description ALONE: one to three sentences, no quotation marks, no preamble, no explanation.',
  ].join("\n");
}

export type ScenarioGenerationTransport = (params: { objectId: string; facts: string; attempt: number }) => Promise<string | null>;

export function createScenarioGenerationTransport(options: CreateScenarioGenerationTransportOptions): ScenarioGenerationTransport {
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async ({ objectId, facts }) => {
    try {
      if (options.ensureLoaded) await options.ensureLoaded(options.model);
      const response = await fetchFn(`${options.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          temperature: options.temperature,
          stream: false,
          tools: [],
          messages: [{ role: "user", content: buildGenerationPrompt(objectId, facts) }],
          // thinking.ts: "off" only -- "on" (the default) never adds this key at all.
          ...(options.thinking === "off" ? reasoningFields("none") : {}),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = body.choices?.[0]?.message?.content;
      if (typeof reply !== "string") return null;
      const trimmed = reply.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  };
}
