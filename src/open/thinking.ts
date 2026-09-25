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
 * `off` sends `chat_template_kwargs: { reasoning_strength: "none" }`.
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

/** The wire field this server honours, and the one every header names
 *  (P8). Declared here rather than beside `withReasoningStrength` below
 *  because `thinkingHeaderLine` needs it and `const` does not hoist. */
export const REASONING_STRENGTH_FIELD = "chat_template_kwargs.reasoning_strength";

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
  // constrains nothing, which is where P8's hazard lives -- a server started with
  // `--chat-template-kwargs '{"reasoning_strength":"none"}'` reasons not at all while
  // the transcript says ON.
  const effect =
    resolved.mode === "off"
      ? `the ${label} call carries \`${REASONING_STRENGTH_FIELD}: "none"\``
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
 * `off`: wraps it so every outgoing POST body gains
 * `chat_template_kwargs: { reasoning_strength: "none" }`, MERGED into any
 * `chat_template_kwargs` the caller already set rather than replacing it --
 * a caller that sets one for its own reasons must not silently lose it. A
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
    const existing = (body as Record<string, unknown>).chat_template_kwargs;
    const kwargs = typeof existing === "object" && existing !== null && !Array.isArray(existing) ? existing : {};
    return base(input, { ...init, body: JSON.stringify({ ...body, chat_template_kwargs: { ...kwargs, reasoning_strength: "none" } }) });
  };
  return wrapped;
}

/**
 * The field this server actually honours, measured 2026-09-25 03:22Z and again at 04:00Z on the identical
 * trivial prompt: `chat_template_kwargs: {"reasoning_strength": …}` moves completion tokens 33 / 51 / 60 /
 * 109 across `none` / `low` / `medium` / `high`, while `reasoning_effort: "high"` gives 33 -- the same as
 * `none`, i.e. nothing. See `docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md`.
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
export function withReasoningStrength(fetchFn: typeof fetch | undefined, strength: "none" | "low" | "medium" | "high"): typeof fetch | undefined {
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
    return base(input, { ...init, body: JSON.stringify({ ...body, chat_template_kwargs: { reasoning_strength: strength } }) });
  };
  return wrapped;
}


