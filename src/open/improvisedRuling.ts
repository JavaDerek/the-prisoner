import { declareImprovisableConstraint, declareMonotonicConstraint, IMPROVISED_RULING, type ImprovisedRulingParameters } from "run-dmcp";

/**
 * "Unlisted is not impossible" (run-dmcp's `docs/AUTHORING-GUIDE.md`, 2026-10-16; NPC-MINDS-ARCHITECTURE.md §3.5;
 * brink-workshop's OPEN-WORLD-RULINGS-DESIGN.md §4-§5): an act the referee rules onto nothing -- target `none`, or a
 * ruling `planEffect` finds no plan for -- still happens. Today it touches nothing and is remembered. Under
 * `PRISONER_IMPROVISE=suspicion` it may ALSO receive one bounded improvised ruling, through run-dmcp 0.11.0's
 * `improvisedRulingMechanic`, on exactly one value: `warden_suspicion`.
 *
 * WHY ONLY SUSPICION, AND ONLY UP. SOCIAL-INTENTS.md's gap 3 refused, by name, any effect that writes the warden's
 * mind from the prisoner's say-so: "a prisoner who can write the warden's beliefs can win by assertion". This does
 * not reopen it. Suspicion is raised by what the warden can PERCEIVE of an act (the loop gates it on presence,
 * sight, condition and the referee's own perceptibility key before any model is asked), never lowered by talk --
 * the mapping below only ever builds a positive amount, and the declaration makes that structural by declaring the
 * value monotonic non-decreasing. Nothing in the open variant ever lowers `warden_suspicion` (its only writes are
 * `bumpWardenSuspicion`'s clamped raise and `OPEN_ACQUIRE`'s positive delta; the closed variant's SEARCH reset is a
 * different world builder and never sees this declaration), so the monotonic constraint breaks nothing.
 *
 * THE HARD STAKES STAY OUT OF REACH. No other value is declared improvisable: the bar, the lock, both ways out's
 * passage, the key ring, every person's posture, sight, condition and containment, the spoon's edge and every
 * concealment. A value without the declaration can never receive an improvised ruling from any caller -- that is the
 * engine's own structural guarantee, and the tests pin that each escape gate is refused `not-improvisable`. Even the
 * outrage cap (10) is a quarter of the grounds threshold (40), and a catch still needs grounds AND evidence on a
 * warden's own reveal (`gameEnd.ts`), so no single improvised act can end a game.
 */

/** `PRISONER_IMPROVISE=off | suspicion`. `off` (the default) is byte-identical to every batch recorded before this
 *  arm existed: no declaration, no separate reading, no header line. */
export type ImproviseMode = "off" | "suspicion";

export function readImproviseMode(raw: string | undefined): ImproviseMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "suspicion") return raw;
  throw new Error(`PRISONER_IMPROVISE: unrecognised value ${JSON.stringify(raw)} -- must be "suspicion" or "off" (the default)`);
}

/** The tiers a reading may name, besides `none` (which rules nothing). */
export type SuspicionTier = "minor" | "serious" | "outrage";

/** The owner's caps (2026-10-16, the same 2 / 5 / 10 Brink's D3 decided for its soft levers): how far ONE ruling may
 *  move the warden's suspicion. Data the engine enforces, not prose asking a model to be modest. Only the top tier
 *  needs a confirmation from a second, separate call. */
export const SUSPICION_TIERS: readonly { readonly key: SuspicionTier; readonly cap: number; readonly requiresConfirmation?: true }[] = [
  { key: "minor", cap: 2 },
  { key: "serious", cap: 5 },
  { key: "outrage", cap: 10, requiresConfirmation: true },
];

/** The name the engine's mechanic is registered under in `buildOpenResolver` -- the engine's own default. */
export const SUSPICION_IMPROVISED_RULING = IMPROVISED_RULING;

/** Declares `warden_suspicion` improvisable under the three tiers, and monotonic non-decreasing. Called only by
 *  `buildOpenWorld` under the arm. */
export function declareImprovisableSuspicion(gameId: string, resourceId: string): void {
  declareImprovisableConstraint({ gameId, resourceId, factKey: "value", tiers: SUSPICION_TIERS.map((t) => ({ key: t.key, cap: t.cap, requiresConfirmation: t.requiresConfirmation === true })) });
  declareMonotonicConstraint({ gameId, resourceId, direction: "increasing" });
}

function capOf(tier: SuspicionTier): number {
  const found = SUSPICION_TIERS.find((t) => t.key === tier);
  if (!found) throw new Error(`improvisedRuling: no tier ${JSON.stringify(tier)}`);
  return found.cap;
}

/** The rationale recorded on the resolution, built by code from keys alone -- never from the actor's words. */
export function suspicionRationale(tier: SuspicionTier, note?: string): string {
  return `The warden grows more suspicious (improvised ruling, tier ${tier}): no listed mechanic covers this act, and a separate reading of what he perceives of it ruled it ${tier}${note ? `; ${note}` : ""}.`;
}

/**
 * The game's own mapping from a tier to the ruling's parameters. RAISE ONLY: the amount is the tier's cap, cut to the
 * value's remaining headroom below its bound -- a cap is a ceiling, not a quota, and the `bounded` constraint
 * `warden_suspicion` has carried since world setup would refuse the excess rather than clamp it. `null` when there
 * is no headroom left, so nothing is asked of the engine at all. Never a zero or negative amount.
 */
export function improvisedSuspicionParameters(input: {
  resourceId: string;
  tier: SuspicionTier;
  /** The value's live reading, and its declared upper bound. */
  current: number;
  max: number;
  /** The verbatim words of the act, as the reading cited them. */
  citedAct: string;
  /** The confirming reading's id; required for `outrage`. */
  confirmation?: string;
  /** Appended to the rationale (e.g. why an unconfirmed outrage was ruled serious). */
  note?: string;
}): ImprovisedRulingParameters | null {
  if (input.tier === "outrage" && !input.confirmation) throw new Error("improvisedRuling: an outrage ruling needs a confirmation reference from a second, separate reading");
  const amount = Math.min(capOf(input.tier), input.max - input.current);
  if (!(amount > 0)) return null;
  return {
    targets: [{ entityId: input.resourceId, key: "value", tier: input.tier, amount }],
    rationale: suspicionRationale(input.tier, input.note),
    citedAct: input.citedAct,
    ...(input.confirmation ? { confirmation: input.confirmation } : {}),
  };
}
