import { witness, type Ledger, type Precedent } from "mother-of-invention";
import type { OpenHalfRoundResult } from "./loop.js";
import { describeAttempt } from "./loop.js";
import { WARDEN_NAME } from "../scenario.js";

/**
 * The precedent condition (mother-of-invention's first mechanism): Warden
 * Croft has run this block for eleven years, so what earlier prisoners were
 * seen trying in this cell is Croft's experience -- and Voss knows Croft has
 * it. The obvious approach goes stale inside the fiction, never by a rule
 * forbidding it.
 *
 * What is recorded is what the warden PERCEIVED of each prisoner attempt
 * (`describeAttempt`, the same sentence `perceptionForOther` carries), with a
 * role-neutral actor so it reads truly in a later game. Never the intent: the
 * warden did not hear the prisoner's thoughts, and every way of scraping the
 * bar is one perceived act. An attempt the warden could not perceive (silent,
 * refused, ruled impossible) was never seen, so it is never recorded.
 */

const PRIOR_PRISONER = "A prisoner";

export function recordGame(ledger: Ledger, episode: string, halves: readonly OpenHalfRoundResult[]): Ledger {
  let next = ledger;
  for (const half of halves) {
    if (half.principal !== "prisoner" || half.perceptionForOther === null || half.ruling === null) continue;
    next = witness(next, { episode, actor: "prisoner", observer: "warden", text: describeAttempt("prisoner", half.ruling, PRIOR_PRISONER) });
  }
  return next;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function precedentLines(precedents: readonly Precedent[]): { prisoner: string[]; warden: string[] } {
  if (precedents.length === 0) return { prisoner: [], warden: [] };
  const items = precedents.map((p) => `- ${p.text} (seen ${plural(p.times, "time")}, in ${plural(p.episodes, "earlier attempt")})`);
  return {
    prisoner: [`${WARDEN_NAME} has run this block for eleven years. In earlier escape attempts from this cell, ${WARDEN_NAME} has seen these, and knows them on sight:`, ...items],
    warden: ["You have seen earlier prisoners in this cell try these, and know them on sight:", ...items],
  };
}
