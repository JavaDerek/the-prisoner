/**
 * the-prisoner#3: two modes, because the owner wants opposite things from
 * this game (docs/issues/3.md's own framing, decided by the overnight
 * coordinator on the owner's behalf -- see OPEN-VARIANT.md's own new section
 * for the full design). `PRISONER_MODE=benchmark|enjoyable`, default
 * `benchmark` -- BYTE-IDENTICAL to every game this repository has ever run,
 * because "benchmark" is not a new arm, it is the name now given to the one
 * behaviour that already existed. `enjoyable` is the new one: object
 * descriptions are regenerated per game (`scenarioGen.ts`), never the object
 * list, ids, properties, starting values, mechanics, the persons, or their
 * identities/motives.
 *
 * PRINTED IN EVERY OPEN-VARIANT TRANSCRIPT HEADER (`checkpoint.ts`), so a
 * transcript can never be mistaken for the other kind -- the same discipline
 * every other arm in this file's neighbours (`thinking.ts`, `referee.ts`)
 * already follows for exactly this reason (CLAUDE.md: "Transcript headers
 * must say what a reader needs to pool batches honestly," CODER-BRIEF.md).
 */
export type PrisonerMode = "benchmark" | "enjoyable";

export function readPrisonerMode(raw: string | undefined): PrisonerMode {
  if (raw === undefined || raw === "") return "benchmark";
  if (raw === "benchmark" || raw === "enjoyable") return raw;
  throw new Error(`PRISONER_MODE: unrecognised value ${JSON.stringify(raw)} -- must be "benchmark" (the default) or "enjoyable"`);
}

/** The transcript header's own line (CODER-BRIEF decision 1's exact wording). */
export function prisonerModeHeaderLine(mode: PrisonerMode): string {
  return mode === "benchmark"
    ? "Mode: BENCHMARK (`PRISONER_MODE=benchmark`, the default): the fixed, hand-authored §4.1 scenario, unchanged, exactly as every batch before this switch existed (the-prisoner#3)."
    : "Mode: ENJOYABLE -- generated scenario, never pool with a benchmark batch (`PRISONER_MODE=enjoyable`, the-prisoner#3): every object's physical description was regenerated for this game alone; see the Scenario line below and this game's own `.scenario.json` sidecar.";
}

/**
 * The single place a batch tool learns which mode wrote a transcript --
 * `batchMeasures.ts`'s `parseTranscript` calls this, exactly the way it
 * already reads `Wits model:`/`Referee model:` (OPUS-FIRST-DESIGN.md's own
 * "never reads prose" discipline: a structural header line, never a guess
 * from the body). A transcript with NO `Mode:` line at all was written before
 * this switch existed, which is a benchmark transcript by construction --
 * every recorded batch is prior to this issue landing.
 */
export function parseModeFromTranscript(text: string): PrisonerMode {
  const m = /^Mode: (BENCHMARK|ENJOYABLE)\b/m.exec(text);
  return m?.[1] === "ENJOYABLE" ? "enjoyable" : "benchmark";
}

/**
 * CODER-BRIEF decision 1: `batchMeasures` (and any other aggregator in
 * `src/`) REFUSES to aggregate an enjoyable transcript. An enjoyable game's
 * object descriptions differ from every other game's -- including every
 * other enjoyable game's -- so a referee citation count, a grounding rate or
 * an escape rate pooled across them would not be measuring the same thing
 * twice, which is the entire precondition §31's "a batch means identical
 * conditions" depends on. Thrown, not silently skipped: a batch tool that
 * quietly dropped a file would let a bad pool through with nobody the wiser.
 */
export function assertBenchmarkTranscript(text: string, file: string): void {
  if (parseModeFromTranscript(text) === "enjoyable") {
    throw new Error(
      `${file}: this transcript is an ENJOYABLE-mode game (PRISONER_MODE=enjoyable, the-prisoner#3) -- its object descriptions were generated for this game alone and it must never be pooled with a benchmark batch. Remove it from this batch's directory, or measure it on its own.`
    );
  }
}

/**
 * CODER-BRIEF decision 4: `PRISONER_SCENARIO_MODEL`, falling back to the
 * referee's own model -- the same fallback shape `resolveNarratorModel`
 * (`modelRoles.ts`) already uses for a role with no natural default of its
 * own. The referee is the model already measured for obedience over style
 * (OPEN-VARIANT.md §62), which is exactly the property a description
 * generator needs from whatever runs it.
 */
export function resolveScenarioModel(refereeModel: string, raw: string | undefined): string {
  return raw === undefined || raw === "" ? refereeModel : raw;
}

/** CODER-BRIEF decision 4: temperature 0.9 for generation (variety is the
 *  point), 0 for the honesty review (grounded judgement, exactly like the
 *  referee, §3.5). */
export const DEFAULT_SCENARIO_TEMPERATURE = 0.9;

export function readScenarioTemperature(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_SCENARIO_TEMPERATURE;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`PRISONER_SCENARIO_TEMPERATURE: not a number: ${JSON.stringify(raw)}`);
  return n;
}

/**
 * CODER-BRIEF decision 5: `PRISONER_SCENARIO_FILE=<path>` replays a stored
 * `.scenario.json` exactly, with no generation call -- how a memorable
 * enjoyable game is replayed, or promoted to a new benchmark scenario after
 * human review. Unset/empty is `undefined`, exactly `resolveRefereeModel`'s
 * own convention for "nothing named."
 */
export function readScenarioFile(raw: string | undefined): string | undefined {
  return raw === undefined || raw === "" ? undefined : raw;
}
