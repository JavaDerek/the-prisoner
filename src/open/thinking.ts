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

export function readThinkingMode(raw: string | undefined): ThinkingMode {
  if (raw === undefined || raw === "") return "on";
  if (raw === "on" || raw === "off") return raw;
  throw new Error(`PRISONER_THINKING: unrecognised value ${JSON.stringify(raw)} -- must be "off" or "on" (the default)`);
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
