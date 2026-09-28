import type { PrisonerMode } from "./scenarioMode.js";

/**
 * the-prisoner#5: the referee's effect vocabulary, as a mode-coupled arm
 * (CODER-BRIEF, coordinator's decision). `fixed` (the default outside
 * `PRISONER_MODE=enjoyable`) is the eleven named effects `effects.ts` has
 * always offered -- byte-identical to every batch ever recorded, exactly
 * the discipline `PRISONER_MODE` itself follows (§83.2: "benchmark is not a
 * new arm"). `engine` is the new one: the referee rules in run-dmcp's own
 * five change kinds (`write`/`set`/`transfer`/`create`/`destroy`, plus
 * `reveal`, which is no change at all -- OPEN-VARIANT.md's new section
 * below), and code maps the answer onto this repository's existing
 * mechanics.
 *
 * Coupled to `PRISONER_MODE` the same way `PRISONER_SCENARIO_FILE` is
 * coupled to it (§83.2, `checkpoint.ts`'s own guard): open-world RULES are
 * one more thing `PRISONER_MODE=enjoyable` unlocks (§83.8, "no second mode
 * variable"), so `engine` is refused outright under `PRISONER_MODE=benchmark`
 * -- a benchmark batch's whole point is that every game plays by the exact
 * same rulebook, game after game, which loosening the vocabulary would
 * break as surely as a generated description would (§83.1).
 */
export type OpenRulesMode = "fixed" | "engine";

export function readOpenRulesMode(raw: string | undefined, mode: PrisonerMode): OpenRulesMode {
  if (raw === undefined || raw === "") return mode === "enjoyable" ? "engine" : "fixed";
  if (raw !== "fixed" && raw !== "engine") {
    throw new Error(`PRISONER_OPEN_RULES: unrecognised value ${JSON.stringify(raw)} -- must be "engine" or "fixed"`);
  }
  if (raw === "engine" && mode !== "enjoyable") {
    throw new Error(`PRISONER_OPEN_RULES=engine needs PRISONER_MODE=enjoyable (it is "${mode}"): set PRISONER_MODE=enjoyable, or unset PRISONER_OPEN_RULES.`);
  }
  return raw;
}

/** Printed in every open-variant transcript header (`checkpoint.ts`), right
 *  after the `Mode:` line -- the same discipline `prisonerModeHeaderLine`
 *  follows, for the same reason: a reader must be able to tell, from the
 *  header alone, whether a transcript's rulings came from the fixed
 *  eleven-effect vocabulary or the looser engine-terms one, which is never
 *  safe to pool with a fixed-rules batch. */
export function openRulesHeaderLine(rules: OpenRulesMode): string {
  return rules === "fixed"
    ? "Open rules: FIXED (`PRISONER_OPEN_RULES=fixed`, the default outside PRISONER_MODE=enjoyable): the eleven named effects (effects.ts), unchanged, exactly as every batch before this switch existed (the-prisoner#5)."
    : "Open rules: ENGINE -- the referee rules in run-dmcp's own change kinds, mapped by code onto this game's mechanics; never pool with a fixed-rules batch (`PRISONER_OPEN_RULES=engine`, default under PRISONER_MODE=enjoyable, the-prisoner#5). See docs/OPEN-VARIANT.md's mapping table.";
}
