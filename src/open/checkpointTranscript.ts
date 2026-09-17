import { ResolveProtocolError, type ReadRequest } from "run-dmcp";
import type { OpenHalfRoundResult } from "./loop.js";
import type { RangedCitation } from "./refereeTransport.js";
import type { OpenGameResult } from "./game.js";
import { findProperty, OPEN_OBJECTS } from "./scenarioObjects.js";
import { findKind } from "./derivedObjects.js";
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

const QUESTION_IDS = ["target", "effect", "product", "property", "magnitude", "perceptibility"] as const;

/** A citation as the human reader audits it: its source, the word range the
 *  referee named when it cited by range (OPEN-VARIANT.md §18.3), and the
 *  quote -- rebuilt from that range, or as the referee gave it. */
function citationCell(citation: RangedCitation | null | undefined): string {
  if (!citation) return "(none)";
  const range = typeof citation.from === "number" && typeof citation.to === "number" ? `, words ${citation.from}-${citation.to}` : "";
  return `${citation.sourceId}${range}: "${citation.quote}"`;
}

function refereeTable(half: OpenHalfRoundResult): string[] {
  const ruling = half.ruling;
  if (!ruling) return [];
  const verifiedFor: Record<string, boolean | undefined> = {
    target: ruling.citations.target.verified,
    effect: ruling.citations.effect.verified,
    property: ruling.citations.property.verified,
    product: ruling.effectKind === "derive" ? ruling.citations.product.verified : undefined,
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

/** Why a ruling the referee called applicable still produced no plan, as far
 *  as the ruling's OWN keys can say (the-prisoner#8). The authoritative
 *  reasons live in `planEffect`, which today returns `null` for all of them;
 *  until it returns a discriminated reason, this reports the one case the
 *  keys settle by themselves -- a `derive` whose product does not come from
 *  the target -- and otherwise says plainly that nothing was grounded,
 *  rather than inventing a reason. */
function refusalReason(ruling: NonNullable<OpenHalfRoundResult["ruling"]>): string {
  if (ruling.effectKind === "derive") {
    const kind = findKind(ruling.product);
    if (!kind) return `\`${ruling.product}\` is not a kind anything derives into`;
    if (kind.parent !== ruling.targetObjectId) {
      return `a \`${ruling.product}\` comes from the ${kind.parent.replace(/_/g, " ")}, not from the ${ruling.targetObjectId.replace(/_/g, " ")}`;
    }
  }
  return `(${ruling.targetObjectId}, ${ruling.property}) grounded nothing this scenario declares`;
}

function outcomeLines(half: OpenHalfRoundResult): string[] {
  const { ruling, plan, outcome, refusalError } = half;
  if (!ruling) return [];
  // the-prisoner#6: the resource the PLAN wrote, named by the loop from the
  // world (`OpenHalfRoundResult.resourceName`) -- not the ruling's own target
  // and property, which §19 lets diverge from it (an `open` ruled on the bar
  // writes the window's `passage`, and a transcript that said `bar_integrity`
  // hid the one value escape is decided on). The ruling's own pair is still
  // the fallback for a plan that wrote no resource at all -- `leave`, `noise`
  // -- and for a half-round that never reached a plan.
  const resourceName = half.resourceName ?? (ruling.property !== "none" ? (findProperty(ruling.targetObjectId, ruling.property)?.resourceName ?? `${ruling.targetObjectId}.${ruling.property}`) : ruling.targetObjectId);
  const lines: string[] = [];
  if (outcome) {
    lines.push(`Resolved \`${plan?.mechanic ?? "?"}\` (${ruling.effectKind}, ${ruling.magnitude}, ${ruling.perceptibility}):`);
    for (const t of outcome.transitions) lines.push(`  - ${resourceName}: ${t.previousValue} -> ${t.newValue}`);
    for (const set of outcome.sets) lines.push(`  - ${set.key}: ${String(set.previousValue)} -> ${String(set.newValue)}`);
    const result = outcome.result as { value?: unknown; left?: boolean; made?: boolean };
    if (ruling.effectKind === "reveal" && result.value !== undefined) lines.push(`  - revealed ${resourceName} = ${String(result.value)}`);
    if (ruling.effectKind === "derive") {
      if (half.derived) {
        lines.push(`  - made ${half.derived.id} (${half.derived.kindId}), held by the ${half.derived.heldBy}: ${half.derived.description}`);
        for (const c of outcome.created) lines.push(`  - created ${c.entityKind} ${c.entityId} (${c.ref})`);
        if (half.reshaped) lines.push(`  - reshaped ${half.reshaped.parent.id} (${half.reshaped.parent.kindId}): it is gone`);
        for (const d of outcome.destroyed) lines.push(`  - destroyed ${d.entityKind} ${d.entityId}`);
      } else {
        lines.push(`  - the ${ruling.targetObjectId.replace(/_/g, " ")} was already stripped; made ${ruling.product}: none`);
      }
    }
    if (ruling.effectKind === "leave") {
      const exit = ruling.targetObjectId.replace(/_/g, " ");
      lines.push(result.left ? `  - went out through the ${exit}` : `  - the ${exit} held shut`);
    }
    if (outcome.transitions.length === 0 && outcome.sets.length === 0 && outcome.created.length === 0 && ruling.effectKind !== "reveal" && ruling.effectKind !== "leave" && ruling.effectKind !== "derive") {
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
    // the-prisoner#8: `planEffect` returns a bare `null` for a dozen distinct
    // refusals, and this line used to report all of them as "(target,
    // property) is not declared in the scenario" -- which for a `derive` on a
    // product that does not come from the target is simply false, and names
    // the most-written resource in the game as undeclared. Say only what this
    // half-round's own keys establish, and never assert a pair is undeclared
    // unless that is what was actually checked.
    lines.push(`Ruled applicable, but ${refusalReason(ruling)} -- did nothing.`);
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
  if (p.candidates && p.candidates.length > 0) {
    lines.push("**Candidates:**");
    for (const c of p.candidates) lines.push(`- ${c.text}${c.reason ? ` (${c.reason})` : ""}`);
  }
  // OPEN-VARIANT.md §21: an override is shown, never silent.
  if (half.pick?.reasked !== undefined) {
    lines.push(half.pick.reasked ? `**Replan pick:** the new plan began with a seen step (${half.pick.own}), sent back once.` : "**Replan pick:** the new plan's first step was not seen.");
  } else if (half.pick) {
    lines.push(half.pick.overridden ? `**Forced pick:** overrode the mind's own intent: ${half.pick.own}` : `**Forced pick:** kept the mind's own intent.`);
    for (const v of half.pick.verdicts) lines.push(`- ${v.verdict}: ${v.candidate}`);
    for (const v of half.pick.regenerated ?? []) lines.push(`- regenerated, ${v.verdict}: ${v.candidate}`);
  }
  lines.push(`**Intent:** ${p.intent}`);
  if (p.line) lines.push(`**Line:** "${p.line}"`);
  if (p.replanned === true) lines.push(`**Replanned because:** ${p.replanBecause ?? "(no reason given)"}`);
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
const PRIVATE_FIELDS = ["thoughts", "intent", "plan", "replanBecause", "notes", "candidates"] as const;

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
      const value = h.proposal[field];
      if (typeof value === "string" && value.length >= FOG_AUDIT_MIN_LENGTH) {
        privateBy[h.principal].push({ field, text: value });
      } else if (field === "candidates" && Array.isArray(value)) {
        // Considered but not necessarily acted on -- still private until said aloud.
        for (const candidate of value) if (candidate.text.length >= FOG_AUDIT_MIN_LENGTH) privateBy[h.principal].push({ field, text: candidate.text });
      }
    }
  }
  const leaks: { roundN: number; principal: Principal; field: (typeof PRIVATE_FIELDS)[number] }[] = [];
  for (const h of halves) {
    const other: Principal = h.principal === "warden" ? "prisoner" : "warden";
    // Text this principal also wrote itself is its own to see -- including when the
    // other's text only appears inside a longer text of its own (§34.4: a warden's own
    // plan began with the very words a prisoner's later candidate used). Own texts are
    // masked out, longest first, before the other's are searched for.
    const ownTexts = new Set(privateBy[h.principal].map((p) => p.text));
    const serialized = [...ownTexts]
      .sort((a, b) => b.length - a.length)
      .reduce((text, own) => text.split(JSON.stringify(own).slice(1, -1)).join("\u0000"), JSON.stringify(h.context));
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
  // OPEN-VARIANT.md §15.4: the round each principal first perceived what a
  // container holds, read off the perceived objects each context was built
  // with. Whatever was said about it is for a human to read, never matched.
  for (const held of OPEN_OBJECTS.filter((o) => o.heldIn !== undefined)) {
    const first = (principal: Principal) => game.halves.find((h) => h.principal === principal && h.context.perceivedObjects.some((o) => o.id === held.id))?.roundN;
    const cell = (principal: Principal) => {
      const round = first(principal);
      return round === undefined ? "never" : `round ${round}`;
    };
    lines.push(`First perceived (OPEN-VARIANT.md §15.4): ${held.id} -- warden: ${cell("warden")}; prisoner: ${cell("prisoner")}.`);
  }
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

  // OPEN-VARIANT.md §22: of the prisoner turns that had a plan of its own to
  // keep, how many said an observation broke it. Never a judgement of whether
  // two plans differ in meaning -- only whether the mind said it replanned.
  let hadPlan = false;
  let withPlan = 0;
  let replanned = 0;
  for (const h of game.halves.filter((x) => x.principal === "prisoner" && x.proposal)) {
    if (hadPlan) {
      withPlan += 1;
      if (h.proposal?.replanned === true) replanned += 1;
    }
    if (h.proposal?.plan) hadPlan = true;
  }
  lines.push(`Prisoner plans (§22): replanned ${replanned} of ${withPlan} turns that had a plan, kept ${withPlan - replanned}.`);
  lines.push("");

  // OPEN-VARIANT.md §23: new plans checked at replan time.
  const checked = game.halves.filter((h) => h.principal === "prisoner" && h.pick?.reasked !== undefined);
  if (checked.length > 0) {
    const sentBack = checked.filter((h) => h.pick?.reasked);
    lines.push(`New prisoner plans checked (§23): ${checked.length}. Sent back: ${sentBack.length}. First step changed: ${sentBack.filter((h) => h.pick?.overridden).length}.`);
    lines.push("");
  }

  // OPEN-VARIANT.md §21: forced turns are novel by construction, so novelty
  // is split -- only a change on free turns says anything about the mind.
  const prisonerTurns = game.halves.map((h, i) => ({ h, novel: records[i].novel })).filter((x) => x.h.principal === "prisoner");
  const forced = prisonerTurns.filter((x) => x.h.pick?.forced && x.h.pick.reasked === undefined);
  if (forced.length > 0) {
    const free = prisonerTurns.filter((x) => !x.h.pick?.forced);
    const overridden = forced.filter((x) => x.h.pick?.overridden).length;
    // §32.1's count: the mind's own candidates had nothing unseen. A §36 regeneration
    // that then found something still counts here; it is reported on its own line.
    const stuck = forced.filter((x) => x.h.pick && (!x.h.pick.overridden || x.h.pick.regenerated !== undefined) && x.h.pick.verdicts.every((v) => v.verdict !== "unseen")).length;
    lines.push("## Pick condition (OPEN-VARIANT.md §21)");
    lines.push("");
    lines.push(`Forced prisoner turns: ${forced.length} (overridden ${overridden}, nothing unseen to force to ${stuck}). Novel: ${forced.filter((x) => x.novel).length}.`);
    const regenerated = forced.filter((x) => x.h.pick?.regenerated !== undefined);
    if (regenerated.length > 0) {
      lines.push(`Regenerated (§36): ${regenerated.length}, found something unseen ${regenerated.filter((x) => x.h.pick?.regenerated?.some((v) => v.verdict === "unseen")).length}.`);
    }
    lines.push(`Free prisoner turns: ${free.length}. Novel: ${free.filter((x) => x.novel).length}.`);
    lines.push("");
  }
  return lines;
}
