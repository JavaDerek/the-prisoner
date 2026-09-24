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

/** The pair of models one chair's mind calls: the wits call that decides
 *  (its `intent` is the only thing that ever reaches the referee) and the
 *  voice call that speaks a line for a reader. `createOpenMind` and the
 *  closed minds already collapse to their single-call path when the two are
 *  equal, so this type never needs a "one model" case of its own. */
export interface SeatModels {
  readonly wits: string;
  readonly voice: string;
}

/**
 * `PRISONER_PRISONER_MODEL` / `PRISONER_WARDEN_MODEL` (2026-09-24, phase 1
 * batch 4): which model sits in ONE chair. Until this existed a game had a
 * single `PRISONER_WITS_MODEL`/`PRISONER_VOICE_MODEL` pair for both
 * principals, so the batch that puts a local 30B in the warden's chair
 * against an Opus prisoner -- one variable moved, everything else batch 3's
 * -- could not be expressed at all.
 *
 * `fallback` is the pair the run already resolved from
 * `PRISONER_WITS_MODEL` / `PRISONER_MODEL` / the default, so an unset chair
 * is that chain unchanged, which is how every game before this flag existed
 * stays byte-identical. Empty is unset, as `resolveRefereeModel` already
 * treats it -- a driver that passes `PRISONER_WARDEN_MODEL="$WARDEN"` with
 * `WARDEN` empty means "the default chair," never a model named "".
 *
 * A named model takes the WHOLE chair, voice included. A warden thinking on
 * the 4090 but speaking through Opus would spend the arm's money on a line
 * of dialogue that by construction never reaches the referee, and the arm
 * would stop being "one model, two roles" (`docs/OPEN-VARIANT.md`).
 */
export function resolveSeatModels(raw: string | undefined, fallback: SeatModels): SeatModels {
  if (raw === undefined || raw === "") return fallback;
  return { wits: raw, voice: raw };
}

/** Every distinct model name the two chairs will call, in the order the
 *  prisoner's chair then the warden's names them. This is what joins the
 *  swapper's `allowedModels` and the foreign-model guard's roster: a model
 *  a chair is going to call but nothing listed would be read as "that model
 *  belongs to someone else" and stop the run. Two chairs on the same pair
 *  collapse to exactly the one-chair roster, so an unset run's guard is
 *  unchanged. */
export function seatModelNames(prisoner: SeatModels, warden: SeatModels): string[] {
  return [...new Set([prisoner.wits, prisoner.voice, warden.wits, warden.voice])];
}

/** Whether both chairs are on the same models -- every recorded batch
 *  before batch 4, and the condition under which the header below must not
 *  move by a single byte. */
function chairsAgree(prisoner: SeatModels, warden: SeatModels): boolean {
  return prisoner.wits === warden.wits && prisoner.voice === warden.voice;
}

/** The two chairs, each on its own line, for a header that can no longer
 *  honestly say "the model". */
function chairLines(prisoner: SeatModels, warden: SeatModels): string[] {
  return [
    `Prisoner's chair -- wits model: \`${prisoner.wits}\`. Voice model: \`${prisoner.voice}\`.`,
    `Warden's chair -- wits model: \`${warden.wits}\`. Voice model: \`${warden.voice}\`.`,
  ];
}

/**
 * The open variant's transcript header lines for the model roles. Factored
 * out of `checkpoint.ts` for the reason `elaborationHeaderLine` was: that
 * module runs its game at load and cannot be imported by a test, and this
 * header is the only place a reader learns which model sat in which chair.
 *
 * With both chairs on the same pair this is ONE line and it is batch 3's
 * own, byte for byte -- pinned in `__tests__/modelRoles.test.ts` against the
 * recorded text, because a header that drifts silently makes every earlier
 * batch un-poolable for a reason nobody can see. When the chairs differ the
 * single `Wits model:` line is gone entirely rather than shown alongside:
 * a line naming one wits model in a two-model game is a claim a reader
 * would act on.
 */
export function openModelHeaderLines(args: { prisoner: SeatModels; warden: SeatModels; refereeModel: string; modelUrl: string }): string[] {
  const { prisoner, warden, refereeModel, modelUrl } = args;
  if (chairsAgree(prisoner, warden)) {
    return [`Wits model: \`${prisoner.wits}\`. Voice model: \`${prisoner.voice}\`. Referee model: \`${refereeModel}\`. At \`${modelUrl}\`.`];
  }
  return [...chairLines(prisoner, warden), `Referee model: \`${refereeModel}\`. At \`${modelUrl}\`.`];
}

/**
 * The closed variant's header lines, on the same rule: byte-identical to
 * what it printed before per-seat models existed whenever the chairs agree
 * -- one `Model:` line on the single-call path, the recorded three-line
 * wits/voice form otherwise -- and both chairs named when they differ.
 * `thinkTimeout` arrives already rendered (a number, or the package's own
 * default spelled out), so this stays a pure string function.
 */
export function closedModelHeaderLines(args: { prisoner: SeatModels; warden: SeatModels; modelUrl: string; thinkTimeout: string }): string[] {
  const { prisoner, warden, modelUrl, thinkTimeout } = args;
  if (chairsAgree(prisoner, warden)) {
    if (prisoner.wits === prisoner.voice) {
      return [`Model: \`${prisoner.wits}\` at \`${modelUrl}\`. Think timeout: ${thinkTimeout}.`];
    }
    return [
      `Wits model: \`${prisoner.wits}\` at \`${modelUrl}\`.`,
      `Voice model: \`${prisoner.voice}\` at \`${modelUrl}\`.`,
      `Think timeout: ${thinkTimeout}.`,
    ];
  }
  return [...chairLines(prisoner, warden), `At \`${modelUrl}\`. Think timeout: ${thinkTimeout}.`];
}

/** Which chair, if any, is a PROSE seat (`src/open/proseMind.ts`): asked one
 *  question and taken at its word, instead of asked for one JSON object with
 *  eight fields. `humanSeat.ts` already made this change for a person and
 *  recorded why -- a fixed field order "forced the player to pre-classify
 *  their own action before the referee ever saw any of it" -- and the model
 *  chair never got it. Unset is every game ever recorded; anything
 *  unrecognised throws rather than being guessed past. */
export type ProseSeat = "off" | "prisoner" | "warden";
export function readProseSeat(raw: string | undefined): ProseSeat {
  if (raw === undefined || raw === "") return "off";
  if (raw === "prisoner" || raw === "warden") return raw;
  throw new Error(`PRISONER_PROSE_SEAT: unrecognised value ${JSON.stringify(raw)} -- must be "prisoner", "warden" or unset`);
}
