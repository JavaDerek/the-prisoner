import { witness, type Ledger, type Precedent } from "mother-of-invention";
import type { OpenHalfRoundResult } from "./loop.js";
import { precedentTextFor, KNOWN_APPROACH_SUSPICION_BUMP, type KnownApproach } from "./loop.js";
import { RESOURCE_MAX } from "../world/setup.js";
import { WARDEN_NAME } from "../scenario.js";
import { findKind } from "./derivedObjects.js";

/**
 * The precedent condition (mother-of-invention's first mechanism): Warden
 * Croft has run this block for eleven years, so what earlier prisoners were
 * seen trying in this cell is Croft's experience -- and Voss knows Croft has
 * it. The obvious approach goes stale inside the fiction, never by a rule
 * forbidding it: a known approach is noticed however quietly it is done and
 * costs a jump in suspicion (`loop.ts`, OPEN-VARIANT.md §11.3), and the
 * briefing states exactly that consequence, and nothing more.
 *
 * What is recorded is what the warden PERCEIVED of each prisoner attempt
 * (`describeAttempt`, the same sentence `perceptionForOther` carries), with a
 * role-neutral actor so it reads truly in a later game. Never the intent: the
 * warden did not hear the prisoner's thoughts, and every way of scraping the
 * bar is one perceived act. An attempt the warden could not perceive (silent,
 * refused, ruled impossible) was never seen, so it is never recorded.
 */

export function recordGame(ledger: Ledger, episode: string, halves: readonly OpenHalfRoundResult[]): Ledger {
  let next = ledger;
  for (const text of seenAttempts(halves)) next = witness(next, { episode, actor: "prisoner", observer: "warden", text });
  return next;
}

/** What the warden saw of the prisoner's attempts in these half-rounds, in
 *  the ledger's own words, one entry per attempt. The pick condition reads
 *  it mid-game (OPEN-VARIANT.md §21), so "seen" there and here never differ. */
export function seenAttempts(halves: readonly OpenHalfRoundResult[]): string[] {
  const texts: string[] = [];
  for (const half of halves) {
    if (half.principal !== "prisoner" || half.perceptionForOther === null || half.ruling === null) continue;
    // A reshaping the warden could not see reached it as noise (§14.4): heard, never seen.
    if (half.reshaped && !half.reshaped.seenByOther) continue;
    const reshapeOf = half.reshaped ? findKind(half.reshaped.parent.kindId)?.label : undefined;
    texts.push(precedentTextFor(half.ruling, reshapeOf));
  }
  return texts;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * The staleness price (OPEN-VARIANT.md §42). §41 found that no information
 * handed to a mind can make the obvious approach a worse choice while it is
 * still the winning one, so this makes it cost what its own precedent is
 * worth: the more separate prisoners the warden has watched try it, the more
 * noticing it costs.
 *
 * `episodes`, not `times`: distinct earlier attempts are what makes an
 * approach stale, while `times` counts sightings and inflates with mere
 * repetition inside one game (the committed ledger's worst entry is 76
 * sightings across 19 attempts).
 *
 * Capped at `RESOURCE_MAX`, and that cap is not decoration: `warden_suspicion`
 * is a `bounded` resource, and run-dmcp REJECTS an out-of-bounds write rather
 * than clamping it (`mechanics.ts`'s own note). A price above the bound would
 * also be a briefing that states a consequence the world cannot deliver,
 * which is the one thing this condition has never done.
 */
export function stalenessBump(precedent: Precedent): number {
  return Math.min(KNOWN_APPROACH_SUSPICION_BUMP * precedent.episodes, RESOURCE_MAX);
}

export type PrecedentPrice = "flat" | "stale";

/** `flat` unless asked otherwise: the price a known approach has always cost,
 *  so every batch before 2026-09-17 remains the comparison it was. `stale`
 *  is §42's arm, and it becomes the default only if a batch says it should --
 *  the D3 lesson, applied to the mechanism that came after it. Anything else
 *  stops the run rather than guessing. */
export function readPrecedentPrice(raw: string | undefined): PrecedentPrice {
  if (raw === undefined || raw === "") return "flat";
  if (raw === "flat" || raw === "stale") return raw;
  throw new Error(`PRISONER_PRECEDENT_PRICE: unrecognised value ${JSON.stringify(raw)} -- must be "stale" or "flat" (the default)`);
}

export function precedentLines(
  precedents: readonly Precedent[],
  options: { price?: "flat" | "stale" } = {}
): { prisoner: string[]; warden: string[]; known: KnownApproach[] } {
  if (precedents.length === 0) return { prisoner: [], warden: [], known: [] };
  const stale = options.price === "stale";
  const priceOf = (p: Precedent) => (stale ? stalenessBump(p) : KNOWN_APPROACH_SUSPICION_BUMP);
  // Under `stale` the price differs per line, so the one global sentence the
  // flat arm ends with would be false: each line carries its own instead.
  const items = precedents.map(
    (p) => `- ${p.text} (seen ${plural(p.times, "time")}, in ${plural(p.episodes, "earlier attempt")})` + (stale ? ` -- suspicion jumps by ${priceOf(p)}` : "")
  );
  // A consequence, stated as the rule it is (loop.ts enforces it), never a
  // prohibition: an old approach stays open, and costs what it costs.
  const consequence = stale
    ? "notices however quietly it is done, and warden suspicion jumps at once by what that approach is worth -- the more prisoners have been seen trying it, the more it costs:"
    : `notices however quietly it is done, and warden suspicion jumps by ${KNOWN_APPROACH_SUSPICION_BUMP} at once:`;
  const ownConsequence = stale
    ? "you notice however quietly it is done, and your suspicion jumps at once by what that approach is worth -- the more prisoners you have seen trying it, the more it costs:"
    : `you notice however quietly it is done, and your suspicion jumps by ${KNOWN_APPROACH_SUSPICION_BUMP} at once:`;
  return {
    prisoner: [
      `${WARDEN_NAME} has run this block for eleven years. In earlier escape attempts from this cell, ${WARDEN_NAME} has seen these, and knows them on sight. ` +
        `Whatever ${WARDEN_NAME} knows on sight, ${WARDEN_NAME} ${consequence}`,
      ...items,
    ],
    warden: [`You have seen earlier prisoners in this cell try these, and know them on sight. Whatever you know on sight, ${ownConsequence}`, ...items],
    known: precedents.map((p) => ({ text: p.text, suspicionBump: priceOf(p) })),
  };
}
