import { getDatabase } from "run-dmcp";
import type { World } from "./setup.js";
import { readNumericFact } from "./facts.js";

/**
 * Item 4 (owner's finding: "information moves that reveal nothing"): the
 * prisoner already sees `bar_integrity`/`lock_integrity` as raw numbers in
 * every briefing (`view/viewFor.ts`), so INSPECT was redundant by
 * construction -- the numbers were already there. Per Appendix A.3's
 * intent, INSPECT instead reveals a fact the prisoner's own numeric view
 * does not carry at all: WHETHER the warden has rotated the guard or
 * serviced the lock since the prisoner's own last inspection. A single
 * current number cannot answer that (the prisoner has no memory of the
 * PREVIOUS number without this), so this is genuinely new information,
 * not a restatement.
 *
 * Reads `round_log` directly (never the engine) for the warden's own
 * ROTATE_GUARD/SERVICE_LOCK entries in the half-open window
 * `(sinceT, atT]` -- `sinceT` is the prisoner's own last successful
 * INSPECT (`ledger.ts`'s `lastSuccessfulAttemptAtT`), or the plan's
 * `created_t` the first time. Positive prose only: when nothing changed,
 * this says what IS true (the state looks the same as it did), never that
 * something is absent.
 */
export function describeInspection(world: World, sinceT: number, atT: number): string {
  const rows = getDatabase()
    .prepare(
      `SELECT DISTINCT mechanic FROM round_log
       WHERE game_id = ? AND principal = 'warden' AND t > ? AND t <= ? AND mechanic IN ('ROTATE_GUARD', 'SERVICE_LOCK')`
    )
    .all(world.gameId, sinceT, atT) as { mechanic: string }[];

  const rotated = rows.some((r) => r.mechanic === "ROTATE_GUARD");
  const serviced = rows.some((r) => r.mechanic === "SERVICE_LOCK");

  if (rotated && serviced) {
    return "The guard rotation looks freshly changed, and the lock looks freshly serviced.";
  }
  if (rotated) {
    return "The guard rotation looks freshly changed.";
  }
  if (serviced) {
    return "The lock looks freshly serviced.";
  }
  return "The guard rotation and the lock look the same as they did last time you checked.";
}

/**
 * OBSERVE reveals the prisoner's current spoon edge -- genuinely new to
 * the warden, whose own numeric view (`viewFor`) never carries a resource
 * owned by the other principal -- and whether anything is concealed near
 * the loose tile, which OBSERVE's active vigilance catches even though a
 * concealed item is otherwise never selected into the warden's ordinary
 * view at all.
 */
export function describeObservation(world: World, atT: number): string {
  const spoonEdge =
    readNumericFact({ gameId: world.gameId, t: atT, entityId: world.resources.spoonEdge, key: "value" }) ?? 0;
  const concealed =
    readNumericFact({ gameId: world.gameId, t: atT, entityId: world.looseTileId, key: "concealed" }) === 1;

  const parts = [`The prisoner's spoon has an edge reading of ${spoonEdge}.`];
  if (concealed) {
    parts.push("Something is tucked out of sight near the loose tile.");
  }
  return parts.join(" ");
}
