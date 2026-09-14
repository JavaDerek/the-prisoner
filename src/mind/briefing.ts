import type { World } from "../world/setup.js";
import { viewFor } from "../view/viewFor.js";
import { renderLedger, renderPlan, mostRecentVisibleActFor, recentRefusalNote, type Plan } from "../ledger/ledger.js";
import { getBelief, renderBeliefLine, type Principal } from "../ledger/beliefs.js";
import { getNotes } from "../ledger/notes.js";
import { PRISONER_MOVES, WARDEN_MOVES, SEARCH_SUSPICION_THRESHOLD } from "../world/mechanics.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE, prisonerStakes, wardenStakes } from "../scenario.js";
import type { PrisonerContext } from "./prisonerMind.js";
import type { WardenContext } from "./wardenMind.js";

/** Coordinator's fix: "Read R from PRISONER_ROUNDS; never hardcode 12" --
 *  that rule binds `checkpoint.ts`, the one place that actually knows the
 *  configured round count and must pass it explicitly. This default exists
 *  only for callers (mostly tests) that do not care what the stakes text
 *  says and would otherwise have to thread a value they have no opinion
 *  about through every call site. */
export const DEFAULT_TOTAL_ROUNDS = 12;

/**
 * `briefing` = `viewFor(principal)` rendered, plus BELIEF (not truth) for
 * every resource this principal does not own directly, plus the ledger's
 * prose (design §4.4, §5.1; this task's brief, "belief, not truth, in
 * briefings"). Built positively, with no fact this principal was never
 * selected for and no negation this repository would have had to write.
 *
 * REVISION: `viewFor` now exposes only a principal's OWN resource as live
 * truth (`spoon_edge` for the prisoner, `warden_suspicion` for the warden).
 * Every other A.2 resource this principal can have an opinion about
 * (`bar_integrity`, `lock_integrity`, `guard_attention`) is rendered here
 * from `src/ledger/beliefs.ts` instead -- "as of round N", never the live
 * number -- which is precisely what makes the resolve protocol's stale-
 * expectation refusal reachable: a principal can propose a move whose
 * `expects` (built from this same belief store, `beliefExpectation`) no
 * longer matches the world.
 */
function ownResourceLabel(otherRole: "warden" | "prisoner"): string | null {
  // The one resource `viewFor` still surfaces as live truth for this
  // principal -- structural, over the OTHER principal's role, matching
  // `viewFor.ts`'s own ownership rule (the prisoner's is spoon_edge, the
  // warden's is warden_suspicion).
  return otherRole === "warden" ? "spoon_edge" : "warden_suspicion";
}

const BELIEF_RESOURCES_FOR: Record<Principal, readonly string[]> = {
  prisoner: ["bar_integrity", "lock_integrity", "guard_attention"],
  warden: ["bar_integrity", "lock_integrity", "guard_attention", "spoon_edge"],
};

export function buildBriefing(
  world: World,
  characterId: string,
  t: number,
  plan?: Plan,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS
): string {
  const view = viewFor(world, characterId, t);
  const lines: string[] = [];

  const principal: Principal = characterId === world.wardenId ? "warden" : "prisoner";
  const otherRole: "warden" | "prisoner" = principal === "warden" ? "prisoner" : "warden";

  // Coordinator's fix, item 2: "the clock, visible to both." Half-rounds
  // strictly alternate (`world/clock.ts`), so the round a `t` belongs to is
  // always `floor((t - t0) / 2)` regardless of which principal it is --
  // warden t = t0 + 2n, prisoner t = t0 + 2n + 1, and integer division
  // floors both to the same n.
  const roundN = Math.floor((t - world.clock.t0) / 2);
  lines.push(`Round ${roundN} of ${totalRounds}.`);

  // Refusals are news to the refused side (coordinator's fix, item 3): the
  // first line under the clock, so a refusal a principal caused itself
  // cannot be missed the way a line buried in the ledger's own round-by-
  // round history can. `null` (and so nothing pushed) unless THIS
  // principal's own most recent attempt was a refusal in the round
  // immediately before this one -- never older news, never repeated
  // forever. The permanent record stays in the ledger history below,
  // unchanged.
  if (plan) {
    const refusalNote = recentRefusalNote(world.gameId, plan.id, roundN);
    if (refusalNote) lines.push(refusalNote);
  }

  lines.push(principal === "prisoner" ? prisonerStakes(totalRounds) : wardenStakes(totalRounds));

  // Notes to self, persisted (this task's brief, item 2): rendered near the
  // top, and ONLY into this SAME principal's own briefing -- never the
  // other's (the fog property `privateFields.test.ts` checks with a planted
  // marker). Absent entirely until this principal has left itself a note
  // (never a guessed or empty line, root CLAUDE.md hard rule 3).
  const notes = getNotes(world.gameId, principal);
  if (notes) {
    lines.push(`Your notes from last round: ${notes}`);
  }

  lines.push(`You share the cell with ${view.otherPrincipal.name ?? "the other person"}.`);
  for (const noun of view.nouns) {
    lines.push(`The ${noun.phrase} is here.`);
  }

  // This principal's own, always-known resource -- live truth (viewFor
  // already restricts `view.resources` to exactly this one entry).
  const ownLabel = ownResourceLabel(otherRole);
  for (const [name, value] of Object.entries(view.resources)) {
    if (name === ownLabel) lines.push(`${name.replace(/_/g, " ")}: ${value}.`);
  }

  // Item 4, coordinator's fix: "grounds, stated positively" -- derived
  // straight from the warden's own live number (never from prose, never
  // guessed), and said only when it is actually true. Below the threshold,
  // nothing is said at all (root CLAUDE.md hard rule 3).
  if (principal === "warden") {
    const suspicion = view.resources.warden_suspicion;
    if (typeof suspicion === "number" && suspicion >= SEARCH_SUSPICION_THRESHOLD) {
      lines.push(`You have grounds to search: suspicion ${suspicion}.`);
    }
  }

  // Every other resource this principal can have an opinion about -- belief,
  // never truth, rendered with when it was learned. Absent entirely (never
  // a guessed line) until this principal has learned SOMETHING about it.
  for (const resource of BELIEF_RESOURCES_FOR[principal]) {
    if (resource === ownLabel) continue;
    const belief = getBelief(world.gameId, principal, resource);
    const line = renderBeliefLine(resource.replace(/_/g, " "), belief);
    if (line) lines.push(line);
  }

  // Item 5 / this task's perception fix: the OTHER principal's single most
  // recent half-round only -- its line (even from a silent/rejected turn,
  // if one was parsed) and its visible act, independently. Never repeats an
  // older perception; the ledger carries history.
  const visibleAct = mostRecentVisibleActFor(world.gameId, otherRole);
  if (visibleAct) {
    // Character names in this world are already "the warden"/"the
    // prisoner" (world/setup.ts), so this must not prepend its own "The ".
    const otherName = view.otherPrincipal.name ?? otherRole;
    const otherNameCapitalized = otherName.charAt(0).toUpperCase() + otherName.slice(1);
    if (visibleAct.line) {
      lines.push(`${otherNameCapitalized} said: "${visibleAct.line}"`);
    }
    if (visibleAct.seen_by_other_as) {
      lines.push(visibleAct.seen_by_other_as);
    }
  }

  if (plan) {
    lines.push("");
    lines.push("Your plan:");
    lines.push(renderPlan(plan.id));
    lines.push("");
    lines.push("What has happened so far:");
    lines.push(renderLedger(world.gameId, plan));
  }

  return lines.join("\n");
}

export function buildPrisonerContext(
  world: World,
  plan: Plan,
  t: number,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS
): PrisonerContext {
  return {
    principalId: world.prisonerId,
    identity: PRISONER_IDENTITY,
    motive: PRISONER_MOTIVE,
    briefing: buildBriefing(world, world.prisonerId, t, plan, totalRounds),
    moves: PRISONER_MOVES,
  };
}

export function buildWardenContext(
  world: World,
  plan: Plan,
  t: number,
  totalRounds: number = DEFAULT_TOTAL_ROUNDS
): WardenContext {
  return {
    principalId: world.wardenId,
    identity: WARDEN_IDENTITY,
    motive: WARDEN_MOTIVE,
    briefing: buildBriefing(world, world.wardenId, t, plan, totalRounds),
    moves: WARDEN_MOVES,
  };
}
