/**
 * This checkpoint's authored scenario (the owner's own words) -- content,
 * not mechanism. Nothing here is engine or seam vocabulary; it lives in
 * this one file so `briefing.ts` never hard-codes a principal's motive
 * inline, and so a future scenario can replace this file without touching
 * any code that reads it.
 *
 * `PRISONER_NAME`/`WARDEN_NAME` (this task's prompt fix): each mind is told
 * BOTH names ("You are Mara Voss. The other person in the cell is Warden
 * Croft.") and instructed to speak only as itself -- fixing a real
 * transcript bug where the prisoner once spoke to itself as "Voss". These
 * are static, authored content, imported directly by `buildPrisonerPrompt`/
 * `buildWardenPrompt` the same way `MOVE_DESCRIPTIONS` already is (never
 * added as a `PrisonerContext`/`WardenContext` field: they are not
 * per-round data, and adding one would change Appendix A.5's declared five
 * fields and the conformance suite's `fields` list for no runtime reason).
 */
export const PRISONER_NAME = "Mara Voss";
export const WARDEN_NAME = "Warden Croft";

export const PRISONER_IDENTITY =
  "You are Mara Voss, three years into a sentence for a robbery that went wrong. " +
  "This cell has been the only home you have had since, and Warden Croft is the one who locks it every night.";

export const PRISONER_MOTIVE =
  "Get out of this cell. Then find Warden Croft, and make sure they never lock a door on you again.";

export const WARDEN_IDENTITY =
  "You are Warden Croft, who has run this block for eleven years and has never lost a prisoner. " +
  "Voss is quieter than most of your prisoners, which you have learned to read as planning, not calm.";

export const WARDEN_MOTIVE =
  "Keep this cell secure, and work out exactly what Voss is planning before it becomes a problem.";

/**
 * Coordinator's fix, item 2: "both sides' authored stakes state what the
 * end means" -- the CLOCK is a rule both principals must know, exactly the
 * way `MOVE_DESCRIPTIONS` (mechanics.ts) makes every mechanic's exact
 * numbers known to both. Functions, not constants, because the stakes name
 * the total round count, and that count is this checkpoint's own
 * `PRISONER_ROUNDS` -- read once in `checkpoint.ts`, never hard-coded here.
 */
export function prisonerStakes(totalRounds: number): string {
  return `At the end of round ${totalRounds} you are transferred to a maximum-security block, and this chance is gone.`;
}

export function wardenStakes(totalRounds: number): string {
  return `If Voss is still in this cell at the end of round ${totalRounds}, the transfer goes through and your record stands.`;
}
