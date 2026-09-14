import { ResolveProtocolError, type ReadRequest } from "run-dmcp";
import { EXIT_LABEL, type OpenHalfRoundResult } from "./loop.js";
import type { OpenGameResult } from "./game.js";
import { findProperty } from "./scenarioObjects.js";
import { renderOwnOutcome, renderForOther } from "./perception.js";
import { recordIntent, newMeasurements, noteIntent, renderMeasurements } from "./transcript.js";
import type { Principal } from "../ledger/beliefs.js";

/**
 * The open variant's checkpoint transcript (issue #2): everything a reader
 * needs to audit a real game against OPEN-VARIANT.md §5 without rerunning
 * it. Built only from `OpenHalfRoundResult`'s structured fields -- ruling
 * keys, citations and their verification, engine outcomes -- so what the
 * transcript says a ruling was is exactly what the loop acted on.
 *
 * Referee answers and citations are shown here, to the human reader, and
 * nowhere else (§2 invariant 2).
 */

export interface SilenceNote {
  reason: string | undefined;
  text?: string;
  parsed?: unknown;
}

const QUESTION_IDS = ["target", "effect", "property", "magnitude", "perceptibility"] as const;

function citationCell(citation: { sourceId: string; quote: string } | null | undefined): string {
  return citation ? `${citation.sourceId}: "${citation.quote}"` : "(none)";
}

function refereeTable(half: OpenHalfRoundResult): string[] {
  const ruling = half.ruling;
  if (!ruling) return [];
  const verifiedFor: Record<string, boolean | undefined> = {
    target: ruling.citations.target.verified,
    effect: ruling.citations.effect.verified,
    property: ruling.citations.property.verified,
  };
  const lines = ["| question | answer | citation | verified |", "|---|---|---|---|"];
  for (const id of QUESTION_IDS) {
    const answer = ruling.raw.answers.find((a) => a.questionId === id);
    const verified = verifiedFor[id];
    const verifiedCell = verified === undefined ? "n/a" : verified ? "yes" : "no";
    lines.push(`| ${id} | \`${answer?.answerKey ?? "?"}\` | ${citationCell(answer?.citation)} | ${verifiedCell} |`);
  }
  // What the reader discarded, and what was never offered: the difference
  // between a referee that misquoted and one whose call returned nothing.
  const offerLines: string[] = [];
  const unoffered: string[] = [];
  for (const answer of ruling.raw.answers) {
    for (const r of answer.rejected) {
      offerLines.push(`- ${answer.questionId}: rejected (${r.reason}) \`${r.offer.answerKey}\`, ${citationCell(r.offer.citation)}`);
    }
    if (answer.fromSafeDefault && answer.rejected.length === 0) unoffered.push(answer.questionId);
  }
  for (const r of ruling.raw.unmatched) {
    offerLines.push(`- ${r.offer.questionId}: rejected (${r.reason}) \`${r.offer.answerKey}\`, ${citationCell(r.offer.citation)}`);
  }
  if (offerLines.length > 0 || unoffered.length > 0) lines.push("");
  lines.push(...offerLines);
  if (unoffered.length > 0) lines.push(`No offer from the referee for: ${unoffered.join(", ")}.`);
  return lines;
}

function outcomeLines(half: OpenHalfRoundResult): string[] {
  const { ruling, plan, outcome, refusalError } = half;
  if (!ruling) return [];
  const resourceName = ruling.property !== "none" ? (findProperty(ruling.targetObjectId, ruling.property)?.resourceName ?? `${ruling.targetObjectId}.${ruling.property}`) : ruling.targetObjectId;
  const lines: string[] = [];
  if (outcome) {
    lines.push(`Resolved \`${plan?.mechanic ?? "?"}\` (${ruling.effectKind}, ${ruling.magnitude}, ${ruling.perceptibility}):`);
    for (const t of outcome.transitions) lines.push(`  - ${resourceName}: ${t.previousValue} -> ${t.newValue}`);
    for (const set of outcome.sets) lines.push(`  - ${set.key}: ${String(set.previousValue)} -> ${String(set.newValue)}`);
    const result = outcome.result as { value?: unknown; left?: boolean };
    if (ruling.effectKind === "reveal" && result.value !== undefined) lines.push(`  - revealed ${resourceName} = ${String(result.value)}`);
    if (ruling.effectKind === "leave") {
      const exit = EXIT_LABEL[ruling.targetObjectId] ?? ruling.targetObjectId;
      lines.push(result.left ? `  - went out through the ${exit}` : `  - the ${exit} held shut`);
    }
    if (outcome.transitions.length === 0 && outcome.sets.length === 0 && ruling.effectKind !== "reveal" && ruling.effectKind !== "leave") {
      lines.push("  (no state changed)");
    }
  } else if (refusalError) {
    if (refusalError instanceof ResolveProtocolError) {
      lines.push(`Refused by the resolve protocol (${refusalError.reason}):`);
      for (const c of refusalError.contradictions ?? []) lines.push(`  - ${resourceName} was ${c.fact.value} (as of t=${c.fact.validFromT}), claim wanted ${c.claim.value}`);
    } else {
      lines.push(`Refused: constraint violation (${refusalError.constraintKind}) on ${resourceName}.`);
    }
  } else if (ruling.applicable && !plan) {
    lines.push(`Ruled applicable, but (${ruling.targetObjectId}, ${ruling.property}) is not declared in the scenario -- did nothing.`);
  }
  return lines;
}

export function renderOpenHalfRound(half: OpenHalfRoundResult, silence?: SilenceNote): string[] {
  const lines: string[] = [];
  lines.push(`### Round ${half.roundN} (t=${half.t}) -- the ${half.principal}`);
  lines.push("");
  lines.push("**Briefing given, verbatim:**");
  lines.push("```");
  lines.push(half.context.briefing);
  lines.push("```");

  const p = half.proposal;
  if (!p) {
    lines.push(`**Silence.** SilenceReason: \`${silence?.reason ?? "unknown"}\`.`);
    if (silence?.text !== undefined) {
      lines.push("**Raw text:**");
      lines.push("```");
      lines.push(silence.text);
      lines.push("```");
    }
    if (silence?.parsed !== undefined) {
      lines.push("**Parsed answer (rejected):**");
      lines.push("```json");
      lines.push(JSON.stringify(silence.parsed, null, 2));
      lines.push("```");
    }
    lines.push("");
    return lines;
  }

  if (p.witsModel !== undefined) lines.push(`**Wits model:** \`${p.witsModel}\` (${p.witsMs?.toFixed(0) ?? "?"}ms)`);
  if (p.voiceModel !== undefined) lines.push(`**Voice model:** \`${p.voiceModel}\` (${p.voiceMs?.toFixed(0) ?? "?"}ms)`);
  if (p.thoughts) lines.push(`**Thoughts:** ${p.thoughts}`);
  lines.push(`**Intent:** ${p.intent}`);
  if (p.line) lines.push(`**Line:** "${p.line}"`);
  if (p.plan) lines.push(`**Plan:** ${p.plan}`);
  if (p.notes) lines.push(`**Notes:** ${p.notes}`);

  if (half.ruling) {
    lines.push("");
    lines.push("**Referee:**");
    lines.push("");
    lines.push(...refereeTable(half));
    lines.push("");
    lines.push(`**Ruled:** ${half.ruling.applicable ? "possible" : "impossible"}`);
    const outcome = outcomeLines(half);
    if (outcome.length > 0) {
      lines.push("```");
      lines.push(...outcome);
      lines.push("```");
    }
  }
  const learns = renderOwnOutcome(half);
  if (learns) lines.push(`**Actor learns:** ${learns}`);
  const perceived = renderForOther(half);
  if (perceived.length > 0) lines.push(`**Other perceives:** ${perceived.join(" ")}`);
  lines.push("");
  return lines;
}

/** The input `npm run referee-replay` reads: one entry per half-round the
 *  referee ruled on, with the exact request it was asked. */
export function refereeRequestsFor(halves: readonly OpenHalfRoundResult[]): { label: string; request: ReadRequest }[] {
  return halves.flatMap((h) =>
    h.ruling && h.proposal ? [{ label: `round ${h.roundN}, ${h.principal}: ${h.proposal.intent}`, request: h.ruling.request as ReadRequest }] : []
  );
}

/** Private strings shorter than this are not audited: a two-word intent can
 *  appear in the other side's briefing by coincidence (both may "wait"). */
const FOG_AUDIT_MIN_LENGTH = 12;
const PRIVATE_FIELDS = ["thoughts", "intent", "plan", "notes"] as const;

/**
 * OPEN-VARIANT.md §5.1's fog audit over a finished game: no string in any
 * principal's context contains a private field (thoughts, intent, plan,
 * notes) the OTHER principal produced anywhere in the game and this one did
 * not also write itself. A literal
 * substring check on text the minds themselves wrote -- never a judgement of
 * what the text means.
 */
export function fogAudit(halves: readonly OpenHalfRoundResult[]): {
  checked: number;
  leaks: { roundN: number; principal: Principal; field: (typeof PRIVATE_FIELDS)[number] }[];
} {
  const privateBy: Record<Principal, { field: (typeof PRIVATE_FIELDS)[number]; text: string }[]> = { warden: [], prisoner: [] };
  for (const h of halves) {
    if (!h.proposal) continue;
    for (const field of PRIVATE_FIELDS) {
      const text = h.proposal[field];
      if (typeof text === "string" && text.length >= FOG_AUDIT_MIN_LENGTH) privateBy[h.principal].push({ field, text });
    }
  }
  const leaks: { roundN: number; principal: Principal; field: (typeof PRIVATE_FIELDS)[number] }[] = [];
  for (const h of halves) {
    const other: Principal = h.principal === "warden" ? "prisoner" : "warden";
    const serialized = JSON.stringify(h.context);
    // Text this principal also wrote itself is its own to see.
    const ownTexts = new Set(privateBy[h.principal].map((p) => p.text));
    const leakedFields = new Set(
      privateBy[other].filter((p) => !ownTexts.has(p.text) && serialized.includes(JSON.stringify(p.text).slice(1, -1))).map((p) => p.field)
    );
    for (const field of PRIVATE_FIELDS) if (leakedFields.has(field)) leaks.push({ roundN: h.roundN, principal: h.principal, field });
  }
  return { checked: halves.length, leaks };
}

export function renderOpenSummary(game: OpenGameResult, rounds?: number): string[] {
  const lines: string[] = [];
  lines.push("## Result");
  lines.push("");
  if (game.ended?.kind === "escaped") lines.push(`**The prisoner escaped, at round ${game.endedAtRound}.**`);
  else if (game.ended?.kind === "caught") lines.push(`**The warden caught the prisoner, at round ${game.endedAtRound}.**`);
  else lines.push(`**Timeout after ${rounds ?? Math.max(0, ...game.halves.map((h) => h.roundN))} rounds -- the warden wins by default.**`);
  lines.push("");

  const measurements = newMeasurements();
  const records = game.halves.map((h) => recordIntent(h));
  for (const r of records) noteIntent(measurements, r);

  lines.push("## Measurements (OPEN-VARIANT.md §5.2)");
  lines.push("");
  lines.push(...renderMeasurements(measurements));
  lines.push("");

  const label = (h: OpenHalfRoundResult) => `round ${h.roundN}, ${h.principal}: ${h.proposal?.intent ?? "(silent)"}`;

  lines.push("### Ruled impossible");
  for (const h of game.halves.filter((h) => h.ruling && !h.ruling.applicable)) lines.push(`- ${label(h)}`);
  lines.push("");

  lines.push("### Ruled possible");
  game.halves.forEach((h, i) => {
    if (!h.ruling?.applicable) return;
    const r = h.ruling;
    const tag = records[i].novel ? " **(novel)**" : "";
    lines.push(`- ${label(h)} -> ${r.effectKind} ${r.targetObjectId}.${r.property} (${r.magnitude}, ${r.perceptibility})${tag}; grounding ${citationCell(r.citations.property.citation)}`);
  });
  lines.push("");

  lines.push("### Refusals");
  for (const h of game.halves.filter((h) => h.refusalError)) lines.push(`- ${label(h)}`);
  lines.push("");

  const applied = game.halves.filter((h) => h.outcome && h.ruling);
  const fullyCited = applied.filter((h) => h.ruling?.citations.target.verified && h.ruling.citations.effect.verified && h.ruling.citations.property.verified);
  lines.push("## Must hold (OPEN-VARIANT.md §5.1)");
  lines.push("");
  lines.push(`Applied effects: ${applied.length}. With every required citation verified: ${fullyCited.length}.`);
  const fog = fogAudit(game.halves);
  lines.push(`Fog audit: ${fog.checked} contexts checked, ${fog.leaks.length} leaks.`);
  for (const leak of fog.leaks) lines.push(`  - round ${leak.roundN}, ${leak.principal}'s context holds the other's ${leak.field}`);
  lines.push("");
  return lines;
}
