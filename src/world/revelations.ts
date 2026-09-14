/**
 * REVISION (this task's brief, "belief, not truth"): INSPECT and OBSERVE now
 * return the values they reveal directly in the mechanic's own `result`
 * (`world/mechanics.ts`), so the ledger's "note" text for each is built
 * straight from that result -- never by re-scanning `round_log` for a
 * freshness signal, which was the old (pre-revision) approach when INSPECT
 * revealed nothing numeric at all. Positive prose only.
 */

export interface InspectResult {
  lockIntegrity: number;
  guardAttention: number;
}

export function describeInspection(result: InspectResult): string {
  return `Revealed: lock integrity ${result.lockIntegrity}, guard attention ${result.guardAttention}.`;
}

export interface ObserveResult {
  barBand: string;
  spoonEdge?: number;
  /** Evidence becomes grounds (coordinator's fix, item 1): the raw
   *  `bar_integrity` the mechanic itself read to compute its own evidence
   *  check and to render `barBand` -- read by `loop.ts` alone, to update
   *  the warden's own belief store entry so a later OBSERVE only detects
   *  FURTHER wear. Never rendered here: `describeObservation` below reads
   *  only `barBand`/`spoonEdge`, so this number never reaches any ledger
   *  note or prompt as a number -- the mind is still only ever told the
   *  band. */
  barIntegrity: number;
}

export function describeObservation(result: ObserveResult): string {
  const parts: string[] = [];
  if (typeof result.spoonEdge === "number") {
    parts.push(`Revealed: spoon edge ${result.spoonEdge}.`);
  }
  parts.push(`The bar looks ${result.barBand}.`);
  return parts.join(" ");
}

/**
 * Own-move feedback (coordinator's fix, item 3): "each principal's ledger
 * line for its own move states what changed, positively." Pure formatters
 * over numbers the CALLER (`loop.ts`) already read from the outcome's own
 * transitions (a change) or the live resource (a no-op) -- never a database
 * read here, and never phrased as an absence: a no-op names the value that
 * made it one, it does not say nothing happened.
 */
export function describeResourceChange(subject: string, quality: string, before: number, after: number): string {
  return `${subject} ${quality} ${before} -> ${after}`;
}

export function describeResourceNoOp(subject: string, quality: string, value: number): string {
  return `the ${subject} was already at ${quality} ${value}`;
}
