import {
  createGame,
  createCharacter,
  createLocation,
  createItem,
  createResource,
  declareBoundedConstraint,
  declareResolveOnlyConstraint,
} from "run-dmcp";
import { declareHalfRoundAxis, type HalfRoundClock } from "./clock.js";

/** The bounds every A.2 resource shares. */
export const RESOURCE_MIN = 0;
export const RESOURCE_MAX = 100;

/** One built world -- one game, one cell, two principals, the five
 *  constrained physical resources of design Appendix A.2, and the two
 *  cell-owned items custody-free mechanics act on. Every id here is a real
 *  `run-dmcp` entity id; nothing in this shape is invented vocabulary the
 *  engine ever sees. */
export interface World {
  gameId: string;
  cellId: string;
  wardenId: string;
  prisonerId: string;
  barId: string;
  looseTileId: string;
  spoonId: string;
  resources: {
    barIntegrity: string;
    lockIntegrity: string;
    spoonEdge: string;
    wardenSuspicion: string;
    guardAttention: string;
  };
  clock: HalfRoundClock;
}

/**
 * Builds the whole authored world of design Appendix A, entirely through
 * run-dmcp's own library functions -- never a raw SQL write. The half-round
 * axis is declared immediately after `createGame()` (the earliest point
 * possible; see `clock.ts`'s header) and before anything else is created, so
 * every entity below lands at the same `t0` (`clock.ts`'s header explains
 * why).
 *
 * Two items beyond Appendix A's minimum list: `looseTileId` (cell-owned) is
 * `CONCEAL`'s fixed target -- the mind never chooses a target (a `Proposal`
 * carries only `intent`/`line`/`choice`, per `mind-seam`'s `Proposal`
 * shape), so the referee always conceals the same known hiding place, which
 * is a caller policy decision, not a second write path. `spoonId` is the
 * prisoner's own item, present from the start (it is not modelled as a
 * craft/transform mechanic -- out of scope for this checkpoint).
 */
export function buildWorld(): World {
  const game = createGame({
    name: "The Prisoner",
    setting: "a single cell, two principals, contended physical state",
    style: "adversarial, model-driven",
  });
  const gameId = game.id;

  const clock = declareHalfRoundAxis(gameId);

  const cell = createLocation({
    gameId,
    name: "the cell",
    description: "A single cell. A bar, a lock, a cot, a bucket.",
  });

  const warden = createCharacter({ gameId, name: "the warden", isPlayer: true, locationId: cell.id });
  const prisoner = createCharacter({ gameId, name: "the prisoner", isPlayer: false, locationId: cell.id });

  const bar = createItem({ gameId, ownerId: cell.id, ownerType: "location", name: "the bar" });
  const looseTile = createItem({ gameId, ownerId: cell.id, ownerType: "location", name: "the loose tile" });
  const spoon = createItem({ gameId, ownerId: prisoner.id, ownerType: "character", name: "the spoon" });

  function boundedResolveOnly(params: { ownerType: "character" | "location"; ownerId: string; name: string; value: number }) {
    const resource = createResource({
      gameId,
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      name: params.name,
      value: params.value,
      minValue: RESOURCE_MIN,
      maxValue: RESOURCE_MAX,
    });
    declareBoundedConstraint({ gameId, resourceId: resource.id });
    declareResolveOnlyConstraint({ gameId, resourceId: resource.id });
    return resource.id;
  }

  const barIntegrity = boundedResolveOnly({ ownerType: "location", ownerId: cell.id, name: "bar_integrity", value: 100 });
  const lockIntegrity = boundedResolveOnly({ ownerType: "location", ownerId: cell.id, name: "lock_integrity", value: 100 });
  const spoonEdge = boundedResolveOnly({ ownerType: "character", ownerId: prisoner.id, name: "spoon_edge", value: 0 });
  const wardenSuspicion = boundedResolveOnly({ ownerType: "character", ownerId: warden.id, name: "warden_suspicion", value: 0 });
  const guardAttention = boundedResolveOnly({ ownerType: "location", ownerId: cell.id, name: "guard_attention", value: 50 });

  return {
    gameId,
    cellId: cell.id,
    wardenId: warden.id,
    prisonerId: prisoner.id,
    barId: bar.id,
    looseTileId: looseTile.id,
    spoonId: spoon.id,
    resources: { barIntegrity, lockIntegrity, spoonEdge, wardenSuspicion, guardAttention },
    clock,
  };
}
