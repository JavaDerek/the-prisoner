import type { OpenHalfRoundResult } from "./loop.js";
import type { EffectKind } from "./effects.js";
import type { Principal } from "../ledger/beliefs.js";

/**
 * Per-intent transcript record and §5.2 measurements (this task's brief:
 * "per intent, the referee's answers with both citations, whether each
 * citation verified, the resulting resolutions or refusals, and §5.2's
 * measurements"). Built entirely from `OpenHalfRoundResult` -- never from
 * referee prose (invariant: "Referee text and reasoning go to the
 * transcript only," and even there this module only ever reads STRUCTURED
 * fields off `RefereeRuling`, never anything free-text the referee said).
 */

/** OPEN-VARIANT.md §5.2, "Novelty": the declared table of `(object,
 *  effect)` pairs that have a closed-variant move equivalent -- content,
 *  authored here, never inferred. Everything else counts as novel.
 *
 *  OPEN-VARIANT.md §17 moved `passage` to the ways out (`door`, `window`) and
 *  left `integrity` on their parts. Every row below is integrity or edge work
 *  on a part -- what FILE, SHIM, REPLACE_BAR, SERVICE_LOCK and CHECK_LOCK did,
 *  and §17.2 still targets the part -- so none moves. No closed move set a
 *  passage, and the closed ESCAPE named no object, so no `open`/`close`/
 *  `leave` row existed for the lock or the bar before §17 and none is added
 *  for the door or the window now: one variable at a time. */
export const CLOSED_EQUIVALENTS: readonly { object: string; effect: EffectKind }[] = [
  { object: "bar", effect: "wear" }, // FILE
  { object: "bar", effect: "restore" }, // REPLACE_BAR
  { object: "bar", effect: "reveal" }, // OBSERVE's bar band
  { object: "lock", effect: "wear" }, // SHIM
  { object: "lock", effect: "restore" }, // SERVICE_LOCK
  { object: "lock", effect: "reveal" }, // CHECK_LOCK / INSPECT
  { object: "spoon", effect: "restore" }, // HONE
  { object: "spoon", effect: "reveal" }, // OBSERVE's spoon edge
  { object: "spoon", effect: "conceal" }, // CONCEAL
];

export function hasClosedEquivalent(objectId: string, effect: EffectKind): boolean {
  return CLOSED_EQUIVALENTS.some((e) => e.object === objectId && e.effect === effect);
}

export interface IntentRecord {
  principal: Principal;
  roundN: number;
  t: number;
  intent: string | null; // null on silence
  targetObjectId: string | null;
  effectKind: EffectKind | null;
  citationsVerified: { target: boolean; effect: boolean; property: boolean } | null;
  applicable: boolean;
  resolved: boolean;
  refused: boolean;
  outOfScope: boolean; // this task's brief: an intent needing `move`/`derive` does nothing, recorded as out of scope
  novel: boolean;
}

export function recordIntent(result: OpenHalfRoundResult): IntentRecord {
  const base = { principal: result.principal, roundN: result.roundN, t: result.t };
  if (result.proposal === null || result.ruling === null) {
    return {
      ...base,
      intent: null,
      targetObjectId: null,
      effectKind: null,
      citationsVerified: null,
      applicable: false,
      resolved: false,
      refused: false,
      outOfScope: false,
      novel: false,
    };
  }
  const ruling = result.ruling;
  const novel = ruling.applicable && ruling.targetObjectId !== "none" ? !hasClosedEquivalent(ruling.targetObjectId, ruling.effectKind) : false;
  return {
    ...base,
    intent: result.proposal.intent,
    targetObjectId: ruling.targetObjectId === "none" ? null : ruling.targetObjectId,
    effectKind: ruling.effectKind,
    citationsVerified: { target: ruling.citations.target.verified, effect: ruling.citations.effect.verified, property: ruling.citations.property.verified },
    applicable: ruling.applicable,
    resolved: result.outcome !== null,
    refused: result.refusalError !== null,
    outOfScope: false,
    novel,
  };
}

export interface Measurements {
  totalIntents: number;
  silences: number;
  groundedCount: number; // applicable === true
  impossibleCount: number; // a real proposal, ruling not applicable
  resolutions: number; // outcome !== null
  refusals: number;
  novelCount: number;
  /** §5.2 "Contest": a refusal followed by the SAME principal's next
   *  recorded intent naming a different (object, effect) pair -- a changed
   *  approach, mirroring the closed variant's own refusal-then-pivot count. */
  pivots: number;
  /** Internal bookkeeping -- the last REFUSED (object, effect) per
   *  principal, so the next intent from that same principal can be checked
   *  for a pivot. Exposed (not a closure) so `renderMeasurements` and tests
   *  can inspect it directly; never read by anything outside this module's
   *  own accumulator functions. */
  lastRefusalByPrincipal: Partial<Record<Principal, { targetObjectId: string | null; effectKind: EffectKind | null }>>;
}

export function newMeasurements(): Measurements {
  return {
    totalIntents: 0,
    silences: 0,
    groundedCount: 0,
    impossibleCount: 0,
    resolutions: 0,
    refusals: 0,
    novelCount: 0,
    pivots: 0,
    lastRefusalByPrincipal: {},
  };
}

/** Folds one `IntentRecord` into the running `Measurements` -- called once
 *  per half-round, in order, so `pivots` can compare each principal's
 *  intent against that SAME principal's own most recent refusal. */
export function noteIntent(measurements: Measurements, record: IntentRecord): void {
  measurements.totalIntents += 1;
  if (record.intent === null) {
    measurements.silences += 1;
    return;
  }
  if (record.applicable) measurements.groundedCount += 1;
  else measurements.impossibleCount += 1;
  if (record.resolved) measurements.resolutions += 1;
  if (record.novel) measurements.novelCount += 1;

  const lastRefusal = measurements.lastRefusalByPrincipal[record.principal];
  if (lastRefusal && (lastRefusal.targetObjectId !== record.targetObjectId || lastRefusal.effectKind !== record.effectKind)) {
    measurements.pivots += 1;
    measurements.lastRefusalByPrincipal[record.principal] = undefined;
  }

  if (record.refused) {
    measurements.refusals += 1;
    measurements.lastRefusalByPrincipal[record.principal] = { targetObjectId: record.targetObjectId, effectKind: record.effectKind };
  }
}

export function renderMeasurements(m: Measurements): string[] {
  return [
    `Total intents: ${m.totalIntents}. Silences: ${m.silences}.`,
    `Grounded (ruled possible): ${m.groundedCount}. Ruled impossible: ${m.impossibleCount}.`,
    `Resolutions: ${m.resolutions}. Refusals: ${m.refusals}.`,
    `Novel (object, effect) pairs with no closed-variant equivalent: ${m.novelCount}.`,
    `Refusals followed by a changed approach (pivots): ${m.pivots}.`,
  ];
}
