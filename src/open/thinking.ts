import type { ReasoningStrength } from "./strategy.js";

/**
 * The thinking switch (OPEN-VARIANT.md §64.7, WORLD-ELABORATION-DESIGN.md
 * §4.8). §64.7's finding, outside the game, was run by hitting the raw
 * endpoint directly with `reasoning_effort: "none"` on the SAME prompt: a
 * mind doing zero deliberation notices an advertised property and considers
 * the act at the same rate as one burning thousands of characters of
 * reasoning (8/10 against 9/10, noise at that n) -- in 4.4s instead of
 * 15-25s. This module makes that a real, runnable arm.
 *
 * `on` sends NO reasoning field, so the served model's own configuration decides.
 * `off` sends `reasoning_effort: "none"` and `stop: ["<|eot|>"]`.
 *
 * THE FIELD CHANGED BACK, 2026-09-26: MUSE MOVED TO OLLAMA. Muse-Glimmer is now served by
 * doris's Ollama as `muse-glimmer:30b` (the same resident copy Shep uses), not by a
 * llama-server on :11435. Ollama's `/v1` reads `reasoning_effort` and IGNORES
 * `chat_template_kwargs` -- the mirror image of P8 below. Measured 2026-09-26 on one trivial
 * prompt at temperature 0: no field 128 completion tokens / 470 chars of reasoning;
 * `chat_template_kwargs.reasoning_strength: "none"` 131 / 491 (nothing); `reasoning_effort`
 * none 74 / 0, low 58 / 149, medium 109 / 365, high 131 / 491. So on Ollama Muse REASONS
 * unless asked not to, and the old field would have printed `OFF` over a reasoning model.
 * Second Ollama fact: with reasoning off, JSON-mode output ends in a literal `<|eot|>`
 * (`{ "answer": 391 }<|eot|>`), which breaks every schema-constrained mind call; `stop`
 * removes it. Shep found and fixed the same token the same day. Do not add `<|eom|>` -- it
 * also closes Muse's reasoning channel and empties the reply when reasoning is on.
 *
 * THE FIELD CHANGED, 2026-09-25 (`docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md`).
 * This used to send `reasoning_effort`, which the llama-server serving Muse-Glimmer
 * IGNORES -- measured on one trivial prompt at temperature 0, `reasoning_effort: "high"`
 * returns the same 33 completion tokens as `none`, while
 * `chat_template_kwargs.reasoning_strength` moves them 33 / 51 / 60 / 109 across
 * none / low / medium / high. What actually held reasoning off across batches 3-7 was
 * the server's own start flag, so every `Thinking: OFF` header was true for the wrong
 * reason and a server restarted WITHOUT that flag would have printed the same line while
 * the models reasoned freely. A per-request value OVERRIDES the start flag (measured), so
 * this needs no change to how the machine is run.
 *
 * TWO CALLERS, ONE SWITCH, DIFFERENT SEAMS: the referee's own transport
 * (`refereeTransport.ts`) builds its request body directly, so it reads
 * this module's `ThinkingMode` and adds the field itself. The wits mind
 * goes through `mind-seam`'s `createLocalMind`, whose request body is fixed
 * and never this repository's to edit (root `~/rpg/CLAUDE.md`: never modify
 * a published, exactly-pinned package) -- but it accepts an injectable
 * `fetchFn`, which is the one seam this module can act through. `withThinking`
 * is that wrapper, used by `mind.ts` for the wits call only: the voice call
 * writes one line of flavour text nothing else reads (CLAUDE.md's own "Test
 * runs skip the voice model for reasoning-only work") and is never wrapped.
 */
export type ThinkingMode = "on" | "off";

/** The wire field Ollama honours, and the one every header names (P8, and
 *  the 2026-09-26 move above). Declared here rather than beside
 *  `withReasoningStrength` below because `thinkingHeaderLine` needs it and
 *  `const` does not hoist. */
export const REASONING_FIELD = "reasoning_effort";

/** Muse's end-of-turn token, which leaks into content on Ollama when reasoning is off. */
export const END_OF_TURN_STOP = "<|eot|>";

/**
 * Ollama 0.34.4's glimmer parser (`model/parsers/glimmer.go`) returns no
 * `ThinkingClose` when thinking is off, and the server applies a request's
 * JSON-schema grammar from the first token whenever `ThinkingClose` is empty
 * ("none when the response starts in content"). A glimmer response never
 * starts in content: the prompt ends `<|start|>assistant` and the model must
 * write ` to=user<|message|>` first. With the grammar already binding, Muse
 * sometimes writes that header INSIDE the first string field; the parser
 * takes everything before `<|message|>` as a header and drops it, and the
 * reply arrives as `{","candidates":...}` -- `thoughts` gone, unparseable.
 * Measured 2026-09-27: 4 of 6 on the two worst requests, 3 of 10 wits calls
 * live; with the schema withheld, 12 of 12 complete, bare JSON, no fences
 * (`docs/issues/prisoner-P9-muse-schema-with-thinking-off.md`).
 *
 * So thinking-off calls to Muse go WITHOUT `response_format`. Named by model
 * rather than runtime because the fault is in the parser Ollama binds to this
 * model family, and because withholding a schema from any other model would
 * change it for nothing -- a Claude seat's schema becomes the CLI's
 * `--json-schema`. Thinking ON needs nothing: the grammar waits for the header.
 * Remove this when Ollama's `GlimmerParser.ThinkingClose` returns its header
 * markers whether or not thinking is emitted.
 */
export function withholdsSchemaWhenThinkingOff(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("muse-glimmer");
}

/** The transcript line that says a run's thinking-off calls went without their
 *  schema, or `null` when none did -- so a batch across this change can tell. */
export function schemaWithheldHeaderLine(models: readonly string[], witsThinking: ThinkingMode): string | null {
  const affected = [...new Set(models.filter(withholdsSchemaWhenThinkingOff))];
  if (witsThinking !== "off" || affected.length === 0) return null;
  return (
    `Schema withheld: thinking-off wits calls to ${affected.map((m) => `\`${m}\``).join(", ")} are sent without ` +
    "`response_format` (Ollama's glimmer parser drops the first field under a schema with thinking off, P9)."
  );
}

/** Drops `response_format` when `withholdsSchemaWhenThinkingOff` says so. */
function withoutSchemaForMuse(body: Record<string, unknown>): Record<string, unknown> {
  if (!withholdsSchemaWhenThinkingOff(body.model) || !("response_format" in body)) return body;
  const { response_format: _withheld, ...rest } = body;
  return rest;
}

/** The fields every reasoning-controlled request adds: the strength, and the
 *  `<|eot|>` stop MERGED onto whatever `stop` the caller already set (a
 *  string or a list), never replacing it. */
export function reasoningFields(strength: ReasoningStrength, existingStop?: unknown): { reasoning_effort: ReasoningStrength; stop: string[] } {
  const prior = typeof existingStop === "string" ? [existingStop] : Array.isArray(existingStop) ? existingStop.filter((x): x is string => typeof x === "string") : [];
  return { reasoning_effort: strength, stop: prior.includes(END_OF_TURN_STOP) ? prior : [...prior, END_OF_TURN_STOP] };
}

/** Parses one raw env value for a named `PRISONER_*_THINKING` variable.
 *  Unset/empty returns `undefined` -- "not specified" -- rather than
 *  guessing a mode, which is what lets `resolveThinkingFor` below tell "not
 *  set" apart from a value that happens to equal a role's own default; that
 *  distinction is what the legacy fallback (below) depends on. Any other
 *  value throws naming the OFFENDING variable, so a typo in either a
 *  per-role variable or the legacy one is caught at the variable that
 *  actually has it, never a generic message. */
function parseThinkingMode(raw: string | undefined, varName: string): ThinkingMode | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "on" || raw === "off") return raw;
  throw new Error(`${varName}: unrecognised value ${JSON.stringify(raw)} -- must be "off" or "on" (the default)`);
}

export function readThinkingMode(raw: string | undefined): ThinkingMode {
  return parseThinkingMode(raw, "PRISONER_THINKING") ?? "on";
}

/**
 * TWO ROLES, ONE VARIABLE EACH (OPEN-VARIANT.md §68.1, §68.5, §64.7).
 * §68.1/§68.5 measured on `qwen3:14b` that thinking changes the REFEREE's
 * rulings a great deal -- at OFF the referee grabs at objects (19 of 29
 * object-less intents ruled `open` on the escape route); at ON it correctly
 * answers `none` (1 of 29). §64.7 separately measured that thinking makes
 * no measurable difference to the WITS call's decision while costing ~8x
 * per call. The two roles could differ, so each gets its own variable.
 *
 * BOTH NOW DEFAULT `off`. The referee's `on` default was qwen3's finding, and
 * 2026-09-25 measured that it does not transfer to Muse-Glimmer -- see
 * `ROLE_DEFAULT` below, which carries the numbers. The per-role split is kept
 * because the roles are still separately controllable and the evidence for
 * each is separate; it is no longer a split in the DEFAULTS.
 *
 * `PRISONER_THINKING` keeps working as a legacy override for BOTH roles --
 * recorded batches, `CLAUDE.md` and transcript headers all document
 * invocations like `PRISONER_THINKING=off`, and those must keep meaning
 * exactly what they meant. Precedence, per role: the role-specific variable
 * if set, else `PRISONER_THINKING` if set, else that role's own default.
 */
export type ThinkingRole = "referee" | "wits";

const ROLE_VAR: Record<ThinkingRole, string> = {
  referee: "PRISONER_REFEREE_THINKING",
  wits: "PRISONER_WITS_THINKING",
};

/** REFEREE FLIPPED TO `off`, 2026-09-25
 *  (`checkpoints/2026-09-25-referee-thinking/RESULTS-3-4.md`, PREDICTION-2's band 2).
 *  The `on` default above encoded SS68.1/SS68.5, both measured on `qwen3:14b`. They do
 *  NOT transfer to `muse-glimmer-30b-q4_k_m`, which every local chair now runs: replayed
 *  serially over 22 rows, `none` produced 6 correct resolutions and 0 false ones, while
 *  `high` produced 3 correct and 1 FALSE (a deliberate do-nothing turn resolved as
 *  `bar/reveal/integrity`) and broke 4 of the 6 rows `none` gets right -- at 3-5x the cost.
 *  Reasoning is not neutral-but-slow on this referee; it is worse in both directions.
 *  Every recorded batch set this off explicitly, so no transcript's meaning changes. */
const ROLE_DEFAULT: Record<ThinkingRole, ThinkingMode> = {
  referee: "off",
  wits: "off",
};

export type ThinkingSource = "role" | "legacy" | "default";

/** What a role's thinking mode resolved to, AND which variable decided it
 *  -- the second field exists only so `thinkingHeaderLine` below can name
 *  it; nothing that wires a transport needs anything but `.mode`. */
export interface ResolvedThinking {
  readonly mode: ThinkingMode;
  readonly source: ThinkingSource;
}

function resolveThinkingFor(role: ThinkingRole, roleRaw: string | undefined, legacyRaw: string | undefined): ResolvedThinking {
  const roleValue = parseThinkingMode(roleRaw, ROLE_VAR[role]);
  if (roleValue !== undefined) return { mode: roleValue, source: "role" };
  const legacyValue = parseThinkingMode(legacyRaw, "PRISONER_THINKING");
  if (legacyValue !== undefined) return { mode: legacyValue, source: "legacy" };
  return { mode: ROLE_DEFAULT[role], source: "default" };
}

/** `PRISONER_REFEREE_THINKING`, default `off` (`ROLE_DEFAULT` above). */
export function resolveRefereeThinking(refereeRaw: string | undefined, legacyRaw: string | undefined): ResolvedThinking {
  return resolveThinkingFor("referee", refereeRaw, legacyRaw);
}

/** `PRISONER_WITS_THINKING`, default `off` (§64.7 above). */
export function resolveWitsThinking(witsRaw: string | undefined, legacyRaw: string | undefined): ResolvedThinking {
  return resolveThinkingFor("wits", witsRaw, legacyRaw);
}

const ROLE_LABEL: Record<ThinkingRole, string> = { referee: "referee", wits: "wits" };

/** One transcript header line per role (`checkpoint.ts`), naming the
 *  resolved mode AND which variable produced it, so a reader of an old
 *  transcript (one line, `PRISONER_THINKING` only) and a new one (two
 *  lines, either variable, or neither) can both tell exactly what a batch
 *  ran. */
export function thinkingHeaderLine(role: ThinkingRole, resolved: ResolvedThinking): string {
  const label = ROLE_LABEL[role];
  // P8 fix 1: name the FIELD AND VALUE actually sent, never a word standing for them.
  // `OFF` is now checkable against the wire; `ON` says plainly that the request
  // constrains nothing, which is where P8's hazard lives -- the served model's own
  // default decides (Muse on Ollama reasons by default).
  const effect =
    resolved.mode === "off"
      ? `the ${label} call carries \`${REASONING_FIELD}: "none"\``
      : `no reasoning field is sent on the ${label} call, so the served model's own configuration decides ` +
        `(a server start flag can hold reasoning off while this line says ON)`;
  const setting = resolved.mode === "off" ? "OFF" : "ON";
  const via =
    resolved.source === "role"
      ? `\`${ROLE_VAR[role]}=${resolved.mode}\``
      : resolved.source === "legacy"
        ? `legacy \`PRISONER_THINKING=${resolved.mode}\`, applies to both roles`
        : "the default";
  return `Thinking (${label}): ${setting} (${via}): ${effect} (OPEN-VARIANT.md §68.1, §64.7).`;
}

/**
 * `on`: returns `fetchFn` completely untouched -- not even a pass-through
 * wrapper -- so the request `mind-seam` sends is byte-identical to every
 * batch recorded before this arm existed, by construction rather than by
 * inspection.
 *
 * `off`: wraps it so every outgoing POST body gains `reasoningFields("none")`
 * -- `reasoning_effort: "none"` and the `<|eot|>` stop, MERGED into any `stop`
 * the caller already set rather than replacing it -- a caller that sets one
 * for its own reasons must not silently lose it. A
 * body that is not JSON, or not a JSON object, passes through untouched
 * rather than throwing -- this wrapper never invents a reason a call should
 * fail that the call itself did not already have.
 */
export function withThinking(fetchFn: typeof fetch | undefined, mode: ThinkingMode): typeof fetch | undefined {
  if (mode === "on") return fetchFn;
  const base = fetchFn ?? fetch;
  const wrapped: typeof fetch = async (input, init) => {
    if (typeof init?.body !== "string") return base(input, init);
    let body: unknown;
    try {
      body = JSON.parse(init.body);
    } catch {
      return base(input, init);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return base(input, init);
    const record = body as Record<string, unknown>;
    return base(input, { ...init, body: JSON.stringify({ ...withoutSchemaForMuse(record), ...reasoningFields("none", record.stop) }) });
  };
  return wrapped;
}

/**
 * The field Ollama actually honours: `reasoning_effort` (measured 2026-09-26, header above). Until
 * 2026-09-26 this sent `chat_template_kwargs.reasoning_strength`, which was the right field for the
 * llama-server Muse ran on then (measured 2026-09-25: 33 / 51 / 60 / 109 tokens across none / low /
 * medium / high, `reasoning_effort` a no-op) -- see `docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md`.
 *
 * STILL BESIDE `withThinking` AND NOT INSIDE IT, for a smaller reason than before. P8 is now fixed:
 * `withThinking` sends this same field, so the two no longer disagree about the wire. What keeps them
 * separate is that they take different things -- `withThinking` takes a BOOLEAN mode and only ever sends
 * `none`, while this takes a STRENGTH and is the seam a caller needs when it wants `low`/`medium`/`high`
 * (the strategy step's commit call, `checkpoint.ts`). Collapsing them would make the boolean caller able
 * to ask for a strength it has no vocabulary for.
 *
 * The old note here said `withThinking` could not be changed because recorded headers pinned its meaning
 * to `reasoning_effort`. Those headers are already written and unchanged; what was actually pinned was a
 * wire fact that did nothing, which is exactly why P8 called the fix urgent rather than cosmetic.
 */
export function withReasoningStrength(fetchFn: typeof fetch | undefined, strength: ReasoningStrength): typeof fetch | undefined {
  const base = fetchFn ?? fetch;
  const wrapped: typeof fetch = async (input, init) => {
    if (typeof init?.body !== "string") return base(input, init);
    let body: unknown;
    try {
      body = JSON.parse(init.body);
    } catch {
      return base(input, init);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return base(input, init);
    const record = body as Record<string, unknown>;
    const sent = strength === "none" ? withoutSchemaForMuse(record) : record;
    return base(input, { ...init, body: JSON.stringify({ ...sent, ...reasoningFields(strength, record.stop) }) });
  };
  return wrapped;
}


