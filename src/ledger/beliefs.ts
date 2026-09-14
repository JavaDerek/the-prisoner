import { getDatabase, type Expectation } from "run-dmcp";
import type { World } from "../world/setup.js";

/** Avoids a `loop.ts` <-> `beliefs.ts` import cycle -- structurally the same
 *  two-member set `loop.ts`'s own `Principal` is, never imported from there. */
export type Principal = "warden" | "prisoner";

/**
 * Belief, not truth, in briefings (this task's brief). Each principal's
 * numbers come from what IT knows -- its own move's outcome, its own
 * information moves, the OTHER principal's visible acts, or a refusal that
 * reveals the contradicted truth (design: "Expectations come from belief").
 * One row per (game, principal, resource), upserted -- a belief is current
 * knowledge, not a history; `round_log`/`attempts` already carry history.
 *
 * A resource nobody has ever told this principal about is simply absent
 * here -- `getBelief` returns `null`, never a guessed default (root
 * CLAUDE.md hard rule 3, "say what is, never what is absent"). The one
 * exception is the world's own KNOWN starting truths, seeded once at round 0
 * by `seedInitialBeliefs` -- both principals genuinely do know the cell
 * starts with an intact bar and a serviced lock, because that is the
 * scenario itself, not a deduction either of them had to make.
 */

export interface Belief {
  value: number;
  asOfRound: number;
}

/** The resources this store ever tracks -- every A.2 resource a principal
 *  can come to believe something about (never `warden_suspicion` for the
 *  prisoner, who has no channel to learn it, and never `spoon_edge` for the
 *  prisoner, who always knows it directly and so never needs a stored
 *  belief for it -- see `viewFor.ts`). */
export type BeliefResource = "bar_integrity" | "lock_integrity" | "guard_attention" | "spoon_edge";

export function setBelief(gameId: string, principal: Principal, resource: string, value: number, asOfRound: number): void {
  getDatabase()
    .prepare(
      `INSERT INTO beliefs (game_id, principal, resource, value, as_of_round)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(game_id, principal, resource) DO UPDATE SET
         value = excluded.value,
         as_of_round = excluded.as_of_round
       WHERE excluded.as_of_round >= beliefs.as_of_round`
    )
    .run(gameId, principal, resource, value, asOfRound);
}

interface BeliefRow {
  value: number;
  as_of_round: number;
}

export function getBelief(gameId: string, principal: Principal, resource: string): Belief | null {
  const row = getDatabase()
    .prepare(`SELECT value, as_of_round FROM beliefs WHERE game_id = ? AND principal = ? AND resource = ?`)
    .get(gameId, principal, resource) as BeliefRow | undefined;
  return row ? { value: row.value, asOfRound: row.as_of_round } : null;
}

/**
 * Positive prose, with when it was learned -- e.g. "bar integrity: 85 (as
 * of round 3)." `null` when there is nothing to render (never a guess).
 *
 * Coordinator's fix, item 4 ("beliefs that drift show their age honestly"):
 * this function deliberately computes NOTHING beyond what was actually
 * learned -- no projected/decayed value for `guard_attention` even though
 * both prompts now state the exact decay rule (`TIME_DECAY_RULE`,
 * mechanics.ts). The mind has the rule; reasoning from a stale number and a
 * known rate to "what it probably is now" is the mind's own job, not this
 * repository's -- adding that projection here would be a second, unaudited
 * guess sitting next to the belief store's one honest one.
 */
export function renderBeliefLine(label: string, belief: Belief | null): string | null {
  if (!belief) return null;
  return `${label}: ${belief.value} (as of round ${belief.asOfRound}).`;
}

/** The world's own known starting truths, at round 0 -- the one place this
 *  store is seeded from truth rather than from an update channel, because
 *  the scenario's starting state is common knowledge to both principals by
 *  construction (design Appendix A.2's own initial values). */
export function seedInitialBeliefs(world: World): void {
  setBelief(world.gameId, "prisoner", "bar_integrity", 100, 0);
  setBelief(world.gameId, "prisoner", "lock_integrity", 100, 0);
  setBelief(world.gameId, "prisoner", "guard_attention", 50, 0);
  setBelief(world.gameId, "warden", "bar_integrity", 100, 0);
  setBelief(world.gameId, "warden", "lock_integrity", 100, 0);
  setBelief(world.gameId, "warden", "guard_attention", 50, 0);
  setBelief(world.gameId, "warden", "spoon_edge", 0, 0);
}

/**
 * Which resource a move's `expects` is built against, and which principal's
 * belief it reads. Deliberately excludes every move that depends on
 * `guard_attention` (it drifts every round -- `expects` is equality-only and
 * would misfire on ordinary time decay) and every move whose outcome the
 * mechanic itself adjudicates from truth (ESCAPE, SEARCH, OBSERVE, INSPECT).
 *
 * REVISION (coordinator's fix, item 1: "SET moves declare no expectation on
 * the old value"): only FILE and SHIM remain. Both are DELTA moves -- their
 * outcome is `current - amount`, read from the mechanic's own live
 * `input.constraint` at adjudication time, so a stale belief about the
 * PRIOR value is exactly what makes the acting principal's own next delta
 * collide with reality; that collision is the prisoner's irony (the ledger
 * example: FILE against a bar the warden covertly reset). REPLACE_BAR and
 * SERVICE_LOCK are SET moves -- their outcome is a fixed `100` regardless of
 * the current value, so declaring `expects` from the warden's OWN belief
 * bought nothing but refusing an uninformed warden exactly when it most
 * wanted to act (an OBSERVE-only "the bar looks worn" could never earn it
 * an accurate belief, since OBSERVE deliberately gives only a band -- see
 * `world/mechanics.ts`'s `barBand`). REPLACE_BAR keeps its OWN refusal once
 * the bar's `cut` fact is open -- that is the irreversible constraint doing
 * its job (`declareCutIfJustCut`), never a belief, and is untouched here.
 *
 * Exported for one second, purely cosmetic use (this task's brief, item 3):
 * `ledger.ts`'s refusal rendering turns a refused move's own key ("value")
 * into a friendly resource name ("bar integrity") by reading THIS table --
 * never a second, redeclared mapping. It is never used there to build or
 * check an expectation, only to label one already resolved.
 */
export const EXPECTS_RESOURCE_FOR_MOVE: Partial<Record<string, BeliefResource>> = {
  FILE: "bar_integrity",
  SHIM: "lock_integrity",
};

/**
 * Evidence becomes grounds (coordinator's fix, item 1): which belief
 * resource a WARDEN move's own evidence check reads its "prior belief"
 * from -- CHECK_LOCK reads `lock_integrity`, OBSERVE reads `bar_integrity`.
 * `loop.ts` reads this table to compute the `priorBelief` it passes into
 * `resolver.resolve()` as an opaque parameter (the mechanic itself has no
 * database handle and never touches the belief store); after a successful
 * resolution `loop.ts` also writes the newly revealed true value back into
 * this SAME belief entry, so a later check only detects FURTHER change,
 * never rediscovers the same drop forever. A separate table from
 * `EXPECTS_RESOURCE_FOR_MOVE` on purpose: expects-gating is about the
 * ACTING principal's own preconditions for a SET/DELTA move; evidence is
 * about what a warden's own READ move teaches it, and the two move sets
 * barely overlap (CHECK_LOCK/OBSERVE never appear in the other table).
 */
export const EVIDENCE_RESOURCE_FOR_MOVE: Partial<Record<string, BeliefResource>> = {
  CHECK_LOCK: "lock_integrity",
  OBSERVE: "bar_integrity",
};

function entityIdForResource(world: World, resource: BeliefResource): string {
  switch (resource) {
    case "bar_integrity":
      return world.resources.barIntegrity;
    case "lock_integrity":
      return world.resources.lockIntegrity;
    case "guard_attention":
      return world.resources.guardAttention;
    case "spoon_edge":
      return world.resources.spoonEdge;
  }
}

/** Design: "Each consequential move declares `expects` built from the
 *  acting principal's current belief of the values the move depends on."
 *  `undefined` when the move declares no belief-based expectation at all,
 *  OR when the principal has no belief yet for the resource it would
 *  otherwise expect on -- never a guessed value standing in for one. */
export function beliefExpectation(world: World, principal: Principal, move: string): readonly Expectation[] | undefined {
  const resource = EXPECTS_RESOURCE_FOR_MOVE[move];
  if (!resource) return undefined;
  const belief = getBelief(world.gameId, principal, resource);
  if (!belief) return undefined;
  return [{ entityId: entityIdForResource(world, resource), key: "value", value: belief.value }];
}
