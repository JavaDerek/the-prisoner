import { getDatabase, replay, type ConstraintFact } from "run-dmcp";

/**
 * Numeric facts are stored as SQLite's own REAL-to-TEXT cast (typically
 * "20.0", not "20" -- see run-dmcp's `constrained.ts`, `castedTextForm`'s
 * doc comment). Every reader in this repository that needs a number back
 * out of a fact's string `value` goes through this one function, so a
 * caller never has to re-derive that quirk.
 */
export function parseNumericFactValue(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`facts: expected a numeric fact value, got ${JSON.stringify(value)}`);
  }
  return parsed;
}

/**
 * Reads one numeric fact out of a `NarrationConstraint.mustHonor` array --
 * the read surface a `Mechanic.adjudicate` is handed (`input.constraint`),
 * and the ONLY state a mechanic may read (it has no database handle; see
 * run-dmcp's `resolve.ts` header). Returns `null` when no fact for
 * `(entityId, key)` currently holds -- "silent about what it does not
 * know" (run-dmcp's `contradictions()` doc comment), never a guessed zero.
 */
export function numericFactFrom(mustHonor: readonly ConstraintFact[], entityId: string, key: string): number | null {
  const fact = mustHonor.find((f) => f.entityId === entityId && f.key === key);
  return fact ? parseNumericFactValue(fact.value) : null;
}

/**
 * Reads one numeric fact directly from the timeline at `t`, for use outside
 * a resolution (tests, the view layer) -- `run-dmcp`'s own `getItem()` /
 * `getCharacter()` do not surface columns a consumer's migration added
 * (`src/world/schema.ts`'s `cut`/`concealed`), so a caller that wants those
 * values reads them the same way the engine itself does: through the
 * timeline, not the live table.
 */
export function readNumericFact(params: { gameId: string; t: number; entityId: string; key: string }): number | null {
  const snapshot = replay({ gameId: params.gameId, t: params.t });
  const entity = snapshot.entities.find((e) => e.id === params.entityId);
  const fact = entity?.facts[params.key];
  return fact ? parseNumericFactValue(fact.value) : null;
}

/** The `description` a resolution's own `resolution.recorded` event was
 *  stamped with (`resolve.ts`'s `Adjudication.description`, via
 *  `mechanics.ts`'s `withNote`) -- read back by `eventId` because `Outcome`
 *  itself does not carry `description`. Shared by `loop.ts` (round_log) and
 *  `checkpoint.ts` (the transcript) so there is one reader, not two. */
export function resolutionDescription(eventId: string): string | null {
  const row = getDatabase().prepare(`SELECT description FROM events WHERE id = ?`).get(eventId) as
    | { description: string | null }
    | undefined;
  return row?.description ?? null;
}
