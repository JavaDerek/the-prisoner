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
}

export function describeObservation(result: ObserveResult): string {
  const parts: string[] = [];
  if (typeof result.spoonEdge === "number") {
    parts.push(`Revealed: spoon edge ${result.spoonEdge}.`);
  }
  parts.push(`The bar looks ${result.barBand}.`);
  return parts.join(" ");
}
