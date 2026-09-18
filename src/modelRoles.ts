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

/** OPEN-VARIANT.md §33.16: the referee model when a run names none. On the
 *  unchanged referee prompt qwen3:14b rules an attempt to remove a way out's
 *  part as `open` (24 of 26 controls); qwen2.5:14b rules it `wear`, and no
 *  rewording fixed that without breaking `leave`. */
export const DEFAULT_REFEREE_MODEL = "qwen3:14b";

/** `PRISONER_REFEREE_MODEL`, or the default when unset or empty. Shared by
 *  the checkpoint and the replay tool, so a replay rules with the referee a
 *  game would. */
export function resolveRefereeModel(raw: string | undefined): string {
  return raw === undefined || raw === "" ? DEFAULT_REFEREE_MODEL : raw;
}

/** `PRISONER_NARRATOR_MODEL` (the-prisoner#21 route 2, `src/open/narrator.ts`):
 *  the-narrator role, configured exactly like wits/voice/referee -- one
 *  model, resolved the same way, never a second endpoint or a second swap
 *  discipline. Unset or empty defaults to the VOICE model, not the wits
 *  model: the voice role is already "the natural home for the prose
 *  `ancient-awakening` already writes well" (issue #21), so a narrator with
 *  no model of its own re-uses that same role rather than inventing a third
 *  default to keep track of. */
export function resolveNarratorModel(voiceModel: string, raw: string | undefined): string {
  return raw === undefined || raw === "" ? voiceModel : raw;
}
