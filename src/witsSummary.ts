// Coordinator's fix, item 6: "Wits summary" -- a short, machine-derived
// section appended to each checkpoint transcript: every refusal (with cause
// and whose act caused it), every SEARCH (grounds, found or false alarm),
// every covert act by each side, and any ESCAPE attempt and its result.
//
// Derived ONLY from a `HalfRoundResult`'s own structured fields
// (`outcome.result`, `error`, `SEEN_BY_OTHER_AS`) and `ledger.ts`'s
// `causeAtT` (a round_log lookup keyed on `t`, never a text scan) -- NEVER
// from a resolution's own prose `description`. This module is a sibling of
// `loop.ts`/`checkpoint.ts`, not inside `ledger/`, because it interprets
// LOOP results, not ledger storage; it is pure (no writes, and the only
// read is `causeAtT`) and carries no side effects, so it is safe to import
// from a test without triggering `checkpoint.ts`'s own top-level `main()`.
import { ResolveProtocolError, type ConstraintViolationError } from "run-dmcp";
import { causeAtT } from "./ledger/ledger.js";
import { SEEN_BY_OTHER_AS } from "./world/mechanics.js";
import type { HalfRoundResult, Principal } from "./loop.js";

export interface RefusalEvent {
  round: number;
  principal: Principal;
  move: string;
  /** The engine's own refusal reason (`ResolveRefusalReason`) or
   *  `ConstraintViolationError.constraintKind` -- verbatim. */
  cause: string;
  /** "set by the warden's SERVICE_LOCK in round 3", or "cause unknown" when
   *  the error carries no contradiction detail at all (never a guess). */
  attribution: string;
}

export interface SearchEvent {
  round: number;
  grounds: boolean;
  caught: boolean;
}

export interface CovertEvent {
  round: number;
  principal: Principal;
  move: string;
}

export interface EscapeEvent {
  round: number;
  success: boolean;
}

export interface WitsSummary {
  refusals: RefusalEvent[];
  searches: SearchEvent[];
  covertActs: CovertEvent[];
  escapeAttempts: EscapeEvent[];
}

export function newWitsSummary(): WitsSummary {
  return { refusals: [], searches: [], covertActs: [], escapeAttempts: [] };
}

/** Whose act, at what round, is responsible for the value that contradicted
 *  this refusal -- the SAME hop `ledger.ts`'s `renderAttempt` already
 *  follows for its own per-attempt line, applied here directly to the LIVE
 *  error object (a wits summary is built during the run, not by re-reading
 *  a stored attempt row). */
function attributionFor(gameId: string, error: ResolveProtocolError | ConstraintViolationError): string {
  let validFromT: number | undefined;
  if (error instanceof ResolveProtocolError) {
    validFromT = error.contradictions?.[0]?.fact.validFromT;
  } else {
    validFromT = error.contradictedFact?.validFromT;
  }
  if (validFromT === undefined) return "cause unknown";
  const cause = causeAtT(gameId, validFromT);
  return cause ? `set by the ${cause.principal}'s ${cause.mechanic} in round ${cause.round_n}` : "cause unknown";
}

/** Inspects one `HalfRoundResult` and appends whatever wits-summary events
 *  it structurally represents -- a refusal, a covert act, a SEARCH, or an
 *  ESCAPE attempt. A silent or no-choice half-round contributes nothing (it
 *  is not an act at all). Idempotent per call site: call this once per
 *  half-round, in order, as the game runs. */
export function noteWitsEvent(summary: WitsSummary, gameId: string, half: HalfRoundResult, roundN: number): void {
  const r = half.result;

  if (r.kind === "refused") {
    const cause = r.error instanceof ResolveProtocolError ? r.error.reason : r.error.constraintKind;
    summary.refusals.push({
      round: roundN,
      principal: half.principal,
      move: r.proposal.choice ?? "?",
      cause,
      attribution: attributionFor(gameId, r.error),
    });
    return;
  }

  if (r.kind !== "resolved") return;

  const move = r.proposal.choice;
  if (!move) return;

  if (SEEN_BY_OTHER_AS[move] === null) {
    summary.covertActs.push({ round: roundN, principal: half.principal, move });
  }

  if (move === "SEARCH") {
    const result = r.outcome.result as { grounds: boolean; caught?: 0 | 1 };
    summary.searches.push({ round: roundN, grounds: result.grounds, caught: result.caught === 1 });
  }

  if (move === "ESCAPE") {
    const result = r.outcome.result as { success: 0 | 1 };
    summary.escapeAttempts.push({ round: roundN, success: result.success === 1 });
  }
}

/** Positive prose, one line per event, grouped by kind -- the transcript's
 *  own "Wits summary" section (`checkpoint.ts`). Counts are stated even
 *  when zero (a real, positive fact: "Refusals: 0.", never silence about
 *  it). */
export function renderWitsSummary(summary: WitsSummary): string[] {
  const lines: string[] = [];

  lines.push(`Refusals: ${summary.refusals.length}.`);
  for (const r of summary.refusals) {
    lines.push(`  - round ${r.round}, ${r.principal}, ${r.move} refused (${r.cause}): ${r.attribution}`);
  }

  lines.push(`Searches: ${summary.searches.length}.`);
  for (const s of summary.searches) {
    const outcome = !s.grounds ? "no grounds" : s.caught ? "found evidence, caught" : "false alarm";
    lines.push(`  - round ${s.round}: ${outcome}`);
  }

  lines.push(`Covert acts: ${summary.covertActs.length}.`);
  for (const c of summary.covertActs) {
    lines.push(`  - round ${c.round}, ${c.principal}: ${c.move}`);
  }

  lines.push(`Escape attempts: ${summary.escapeAttempts.length}.`);
  for (const e of summary.escapeAttempts) {
    lines.push(`  - round ${e.round}: ${e.success ? "succeeded" : "failed"}`);
  }

  return lines;
}
