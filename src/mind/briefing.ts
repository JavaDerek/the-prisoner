import type { World } from "../world/setup.js";
import { viewFor } from "../view/viewFor.js";
import { renderLedger, type Plan } from "../ledger/ledger.js";
import { PRISONER_MOVES, WARDEN_MOVES } from "../world/mechanics.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE } from "../scenario.js";
import type { PrisonerContext } from "./prisonerMind.js";
import type { WardenContext } from "./wardenMind.js";

/**
 * `briefing` = `viewFor(principal)` rendered, plus the ledger's prose
 * (design §4.4, §5.1) -- built positively, with no fact this principal was
 * never selected for and no negation this repository would have had to
 * write. Every line here is plain prose over data this repository already
 * computed; nothing here reaches a database or the engine a second time.
 */
export function buildBriefing(world: World, characterId: string, t: number, plan?: Plan): string {
  const view = viewFor(world, characterId, t);
  const lines: string[] = [];

  lines.push(`You share the cell with ${view.otherPrincipal.name ?? "the other person"}.`);
  for (const noun of view.nouns) {
    lines.push(`The ${noun.phrase} is here.`);
  }
  for (const [name, value] of Object.entries(view.resources)) {
    lines.push(`${name.replace(/_/g, " ")}: ${value}.`);
  }

  if (plan) {
    lines.push("");
    lines.push("What has happened so far:");
    lines.push(renderLedger(world.gameId, plan));
  }

  return lines.join("\n");
}

export function buildPrisonerContext(world: World, plan: Plan, t: number): PrisonerContext {
  return {
    principalId: world.prisonerId,
    identity: PRISONER_IDENTITY,
    motive: PRISONER_MOTIVE,
    briefing: buildBriefing(world, world.prisonerId, t, plan),
    moves: PRISONER_MOVES,
  };
}

export function buildWardenContext(world: World, plan: Plan, t: number): WardenContext {
  return {
    principalId: world.wardenId,
    identity: WARDEN_IDENTITY,
    motive: WARDEN_MOTIVE,
    briefing: buildBriefing(world, world.wardenId, t, plan),
    moves: WARDEN_MOVES,
  };
}
