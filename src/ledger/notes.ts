import { getDatabase } from "run-dmcp";
import type { Principal } from "./beliefs.js";

/**
 * Notes to self, persisted (this task's brief, item 2): a stateless
 * half-round sees its own ledger of PAST acts, never its own past
 * REASONING, so a mind cannot carry a strategy ("two more shims, then
 * escape while guard attention is low") from one turn to the next on its
 * own. This store is the caller-side fix -- one row per (game, principal),
 * upserted, latest only, exactly the same shape as `beliefs.ts`'s own
 * store and for the same reason: a note is current intention, not history
 * (`round_log`/`attempts` already carry history).
 *
 * Code in this repository never reads what `notes` SAYS -- it is opaque
 * prose a mind writes for its own later self, rendered verbatim into that
 * SAME principal's own next briefing only (`briefing.ts`) and capped here,
 * on write, purely to bound how much of it a future prompt carries.
 */

export const MAX_STORED_NOTES_LENGTH = 400;

export function setNotes(gameId: string, principal: Principal, notes: string, updatedRound: number): void {
  const capped = notes.length > MAX_STORED_NOTES_LENGTH ? notes.slice(0, MAX_STORED_NOTES_LENGTH) : notes;
  getDatabase()
    .prepare(
      `INSERT INTO principal_notes (game_id, principal, notes, updated_round)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(game_id, principal) DO UPDATE SET
         notes = excluded.notes,
         updated_round = excluded.updated_round
       WHERE excluded.updated_round >= principal_notes.updated_round`
    )
    .run(gameId, principal, capped, updatedRound);
}

interface NotesRow {
  notes: string;
}

/** `null` when this principal has never left itself a note -- never a
 *  guessed or empty default (root CLAUDE.md hard rule 3). */
export function getNotes(gameId: string, principal: Principal): string | null {
  const row = getDatabase()
    .prepare(`SELECT notes FROM principal_notes WHERE game_id = ? AND principal = ?`)
    .get(gameId, principal) as NotesRow | undefined;
  return row?.notes ?? null;
}
