/**
 * The thinking switch (OPEN-VARIANT.md §64.7, WORLD-ELABORATION-DESIGN.md
 * §4.8). §64.7's finding, outside the game, was run by hitting the raw
 * endpoint directly with `reasoning_effort: "none"` on the SAME prompt: a
 * mind doing zero deliberation notices an advertised property and considers
 * the act at the same rate as one burning thousands of characters of
 * reasoning (8/10 against 9/10, noise at that n) -- in 4.4s instead of
 * 15-25s. This module makes that a real, runnable arm.
 *
 * `on` (unset, the default) is every batch recorded before this arm
 * existed: `reasoning_effort` stays unset on the request, exactly as today.
 * `off` sends `reasoning_effort: "none"`.
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
 * TWO ROLES, OPPOSITE DEFAULTS (OPEN-VARIANT.md §68.1, §68.5, §64.7):
 * §68.1/§68.5 measured that `PRISONER_THINKING` changes the REFEREE's
 * rulings a great deal -- at OFF the referee grabs at objects (19 of 29
 * object-less intents ruled `open` on the escape route); at ON it correctly
 * answers `none` (1 of 29). §64.7 separately measured that thinking makes
 * no measurable difference to the WITS call's decision while costing ~8x
 * per call. One shared switch could not hold both a "must stay on" role and
 * a "should default off" role at once, so each gets its own variable and
 * its own default: `PRISONER_REFEREE_THINKING` defaults `on`,
 * `PRISONER_WITS_THINKING` defaults `off`.
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

const ROLE_DEFAULT: Record<ThinkingRole, ThinkingMode> = {
  referee: "on",
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

/** `PRISONER_REFEREE_THINKING`, default `on` (§68.1 above). */
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
  const effect =
    resolved.mode === "off"
      ? `the ${label} call carries \`reasoning_effort: "none"\``
      : `\`reasoning_effort\` stays unset on the ${label} call`;
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
 * `off`: wraps it so every outgoing POST body gains `reasoning_effort:
 * "none"`. A body that is not JSON, or not a JSON object, passes through
 * untouched rather than throwing -- this wrapper never invents a reason a
 * call should fail that the call itself did not already have.
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
    return base(input, { ...init, body: JSON.stringify({ ...body, reasoning_effort: "none" }) });
  };
  return wrapped;
}

/**
 * The field this server actually honours, measured 2026-09-25 03:22Z and again at 04:00Z on the identical
 * trivial prompt: `chat_template_kwargs: {"reasoning_strength": …}` moves completion tokens 33 / 51 / 60 /
 * 109 across `none` / `low` / `medium` / `high`, while `reasoning_effort: "high"` gives 33 -- the same as
 * `none`, i.e. nothing. See `docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md`.
 *
 * DELIBERATELY BESIDE `withThinking` AND NOT INSIDE IT. That function's semantics are pinned by the header
 * lines of every recorded batch: `Thinking (wits): OFF` means "the request carried `reasoning_effort:
 * "none"`", and rewriting it to send a different field would make those recorded headers describe a wire
 * fact that never happened. So the bug is filed against `withThinking` and fixed for its own callers
 * there; this is a new wrapper for a new caller that needs a STRENGTH rather than a boolean, and it names
 * the field it sends so a transcript can print it.
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

/** The wire field `withReasoningStrength` sends, for a transcript header that must name it rather than
 *  describe it (§1.1's lesson). */
export const REASONING_STRENGTH_FIELD = "chat_template_kwargs.reasoning_strength";
