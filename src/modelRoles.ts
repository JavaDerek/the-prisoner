/**
 * `PRISONER_SKIP_VOICE` (CLAUDE.md "Test runs skip the voice model for
 * reasoning-only work"). The voice role adds its own model call and GPU
 * swap per half-round purely to write one line of in-character dialogue for
 * a human reading the transcript afterward -- `open/mind.ts`'s own comment
 * records that "the wits call's `intent` is always what reaches the
 * referee," so voice never affects the world, the referee, or anything a
 * reasoning-only test could assert on. Skipping it collapses the voice
 * model onto the wits model, the SAME single-call path `createOpenMind`
 * already gives two equal model names -- this module only decides which
 * name reaches that check, never reimplements the collapse itself.
 *
 * Unset/"" is the default: build the configured roster, exactly every game
 * before this flag existed. Any other value is a configuration mistake,
 * never guessed past (root CLAUDE.md hard rule 3).
 */
export function readSkipVoice(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  if (raw === "1") return true;
  throw new Error(`PRISONER_SKIP_VOICE: unrecognised value ${JSON.stringify(raw)} -- must be "1" or unset`);
}

/** The voice model a run should actually configure: the wits model itself
 *  when skipping voice, the configured voice model otherwise. */
export function resolveVoiceModel(witsModel: string, configuredVoiceModel: string, skipVoice: boolean): string {
  return skipVoice ? witsModel : configuredVoiceModel;
}
