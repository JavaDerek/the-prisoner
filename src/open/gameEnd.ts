import { readNumericFact } from "../world/facts.js";
import {
  ESCAPE_GUARD_MAX,
  SEARCH_SUSPICION_THRESHOLD,
  SEARCH_CATCH_BAR_MAX,
  SEARCH_CATCH_LOCK_MAX,
  SEARCH_CATCH_SPOON_MIN,
} from "../world/mechanics.js";
import { resourceIdForProperty, type OpenWorld } from "./world.js";

/**
 * Game end, open mode (OPEN-VARIANT.md §9.3, this revision note written
 * BEFORE this file, per this task's brief). Both endings stay conditions
 * on STATE, exactly as the closed variant's own `checkGameEnd`
 * (`src/world/mechanics.ts`) is -- called by a caller BETWEEN half-rounds,
 * never embedded in a mechanic, never something a referee rules on.
 */
export type OpenGameEnd = { kind: "escaped" | "caught" } | null;

/** Escape: the bar's integrity or the lock's integrity has reached 0 (the
 *  closed variant's own "opening" condition), AND `guard_attention` is
 *  below `ESCAPE_GUARD_MAX` -- read live, off the SAME shared resources the
 *  open world reuses from the closed variant's `World` (no new resource). */
export function checkOpenEscape(openWorld: OpenWorld, t: number): boolean {
  const gameId = openWorld.base.gameId;
  const bar = readNumericFact({ gameId, t, entityId: openWorld.base.resources.barIntegrity, key: "value" });
  const lock = readNumericFact({ gameId, t, entityId: openWorld.base.resources.lockIntegrity, key: "value" });
  const guard = readNumericFact({ gameId, t, entityId: openWorld.base.resources.guardAttention, key: "value" });
  const opening = (bar !== null && bar <= 0) || (lock !== null && lock <= 0);
  return opening && guard !== null && guard < ESCAPE_GUARD_MAX;
}

/** Catch: checked only right after a WARDEN's `reveal` resolves, against
 *  the object/property/value that reveal JUST returned -- never a scan of
 *  every resource on every half-round, mirroring how the closed variant's
 *  own SEARCH is a deliberate act, not a passive check. `warden_suspicion`
 *  (live) must already meet `SEARCH_SUSPICION_THRESHOLD` (grounds), and the
 *  revealed value must cross the closed variant's own per-property
 *  threshold. */
export function checkOpenCatch(
  openWorld: OpenWorld,
  t: number,
  reveal: { objectId: string; property: string; value: number }
): boolean {
  const suspicion = readNumericFact({ gameId: openWorld.base.gameId, t, entityId: openWorld.base.resources.wardenSuspicion, key: "value" });
  if (suspicion === null || suspicion < SEARCH_SUSPICION_THRESHOLD) return false;

  if (reveal.objectId === "bar" && reveal.property === "integrity") return reveal.value <= SEARCH_CATCH_BAR_MAX;
  if (reveal.objectId === "lock" && reveal.property === "integrity") return reveal.value <= SEARCH_CATCH_LOCK_MAX;
  if (reveal.objectId === "spoon" && reveal.property === "edge") {
    const concealmentId = resourceIdForProperty(openWorld, "spoon", "concealment");
    const concealment = concealmentId ? readNumericFact({ gameId: openWorld.base.gameId, t, entityId: concealmentId, key: "value" }) : null;
    const unconcealed = concealment === null || concealment < 50;
    return reveal.value >= SEARCH_CATCH_SPOON_MIN && unconcealed;
  }
  return false;
}

/** Combines both checks the way a caller (a future open-mode checkpoint
 *  script) would use them between half-rounds -- escape is checked
 *  unconditionally; catch only when `reveal` is supplied (i.e. this
 *  half-round's resolution was a warden `reveal`). Escape is checked
 *  first: an opening the prisoner has already reached wins even if the
 *  SAME half-round happened to also be a warden reveal that would
 *  otherwise catch them (the prisoner's own state change came first in the
 *  timeline). */
export function checkOpenGameEnd(openWorld: OpenWorld, t: number, reveal?: { objectId: string; property: string; value: number }): OpenGameEnd {
  if (checkOpenEscape(openWorld, t)) return { kind: "escaped" };
  if (reveal && checkOpenCatch(openWorld, t, reveal)) return { kind: "caught" };
  return null;
}
