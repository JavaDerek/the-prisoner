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

/** Short forms, for a sentence that addresses or refers to a principal a
 *  second time without repeating the full name (this task's brief, the
 *  voice prompt fix: "Croft hears every word"). Derived from the same
 *  constants above, so a future name change can never desync them. */
export const PRISONER_SHORT_NAME = PRISONER_NAME.split(" ").pop() as string;
export const WARDEN_SHORT_NAME = WARDEN_NAME.split(" ").pop() as string;

/**
 * The-prisoner#34: discrepancy 8 (docs/ARCHITECTURE.md) was two authors picking two different
 * literal pronouns for the same person -- `PRISONER_MOTIVE` said "they", the D4'/D12 reading bands
 * (`scenarioObjects.ts`) said "her" for BOTH principals (copied from the prisoner's own bands), and
 * the playtest documents and the owner's own typed intents ("so he can't see") said "he" for Croft.
 * One declaration per principal, here, so every generated sentence about a person BUILDS from it --
 * never a second literal choice made where it happens to be written.
 *
 * DECISION (the coordinator, on the owner's behalf, overnight 2026-09-27/28): Warden Croft is
 * "he/him/his/himself"; Mara Voss is "she/her/her/herself". The owner writes "he" for Croft
 * throughout CLAUDE.md and the playtest docs and typed "so he can't see" in play; the scenario's own
 * `PRISONER_MOTIVE` said "they" and the warden's authored person description said "She" -- neither of
 * those was ever an owner decision to keep, just whoever wrote that sentence first.
 *
 * `PrincipalId` duplicates `ledger/beliefs.ts`'s own `Principal` (that file's own comment: "avoids a
 * `loop.ts` <-> `beliefs.ts` import cycle") rather than importing it, so `scenario.ts` -- imported
 * from everywhere -- gains no dependency on the ledger at all.
 */
export type PrincipalId = "prisoner" | "warden";

export interface Pronouns {
  readonly subject: string; // she / he
  readonly object: string; // her / him
  readonly possessive: string; // her / his
  readonly reflexive: string; // herself / himself
}

export const PRISONER_PRONOUNS: Pronouns = { subject: "she", object: "her", possessive: "her", reflexive: "herself" };
export const WARDEN_PRONOUNS: Pronouns = { subject: "he", object: "him", possessive: "his", reflexive: "himself" };

export function pronounsFor(principal: PrincipalId): Pronouns {
  return principal === "prisoner" ? PRISONER_PRONOUNS : WARDEN_PRONOUNS;
}

export const PRISONER_IDENTITY =
  "You are Mara Voss, three years into a sentence for a robbery that went wrong. " +
  "This cell has been the only home you have had since, and Warden Croft is the one who locks it every night.";

export const PRISONER_MOTIVE =
  // The-prisoner#34: "they" (every batch before this) is gone -- built from `WARDEN_PRONOUNS` now,
  // never a second literal choice.
  `Get out of this cell. Then find Warden Croft, and make sure ${WARDEN_PRONOUNS.subject} never locks a door on you again.`;

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
