import { declareTimeAxis, setStoryTime, currentStoryTime, type T } from "run-dmcp";

/**
 * The half-round counter (design §6.1, Appendix A.6): `t` is a `counter`
 * axis, unit `half-round`. The warden acts at even `t`, the prisoner at odd
 * `t` -- a half-round axis the game never re-cuts, so §14's invariance
 * property holds (design §6.1).
 *
 * `declareTimeAxis` must run before the first *consequential* write, but it
 * cannot run before `createGame()` itself: creating a game is already a
 * write (its own `games` row is a projected table), and that write bootstraps
 * the default `sequence` axis before any caller can act at all -- a known,
 * documented engine floor (run-dmcp's `clock.ts`, `declareTimeAxis`'s own
 * doc comment: "such a game's declared axis has a floor above zero"). This
 * repository's own floor is therefore whatever `t` sits at immediately after
 * `createGame()` returns -- call it `t0` -- rather than 0.
 *
 * Every entity this repository authors (the cell, both characters, every
 * item and resource) is created AFTER `declareTimeAxis` has moved the game
 * onto the `counter` axis, so none of those creations advances `t` further
 * (run-dmcp's projection triggers only auto-advance `current_t` `WHERE
 * axis_kind = 'sequence'` -- see `projection.ts`'s `buildInsertTrigger`).
 * The whole world is therefore authored at one instant, `t0`, and every
 * half-round from then on is this repository's own hand on the clock via
 * `setStoryTime`, never the engine's.
 *
 * Half-rounds are numbered from 1: the warden's nth half-round sits at
 * `t0 + 2n`, the prisoner's at `t0 + 2n + 1` -- both always `> t0`, so
 * `setStoryTime`'s "t never runs backwards" rule is satisfied by
 * construction, and the parity the design calls for ("warden even,
 * prisoner odd") holds relative to `t0`, which is the honest reading of
 * "even"/"odd" once the engine's own floor is accounted for.
 */
export interface HalfRoundClock {
  gameId: string;
  t0: T;
  /** Moves the clock to the warden's nth half-round (n >= 1) and returns the `t` it landed on. */
  wardenT(n: number): T;
  /** Moves the clock to the prisoner's nth half-round (n >= 1) and returns the `t` it landed on. */
  prisonerT(n: number): T;
}

export function declareHalfRoundAxis(gameId: string): HalfRoundClock {
  const declared = declareTimeAxis({ gameId, axis: { kind: "counter", unit: "half-round" } });
  const t0 = declared.t;

  function moveTo(t: T): T {
    setStoryTime({ gameId, t });
    return t;
  }

  return {
    gameId,
    t0,
    wardenT(n: number): T {
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`declareHalfRoundAxis: half-round index must be a positive integer, got ${n}`);
      }
      return moveTo(t0 + 2 * n);
    },
    prisonerT(n: number): T {
      if (!Number.isInteger(n) || n < 1) {
        throw new Error(`declareHalfRoundAxis: half-round index must be a positive integer, got ${n}`);
      }
      return moveTo(t0 + 2 * n + 1);
    },
  };
}

/** Whether `t` (an already-declared half-round `t`) belongs to the warden
 *  (even offset from `t0`) or the prisoner (odd offset). Test-only helper --
 *  the loop itself always knows whose half-round it just moved to, because
 *  it is the one that called `wardenT`/`prisonerT`. */
export function principalAt(t0: T, t: T): "warden" | "prisoner" {
  const offset = t - t0;
  if (offset <= 0 || !Number.isInteger(offset)) {
    throw new Error(`principalAt: t=${t} is not a half-round after t0=${t0}`);
  }
  return offset % 2 === 0 ? "warden" : "prisoner";
}

export function currentT(gameId: string): T {
  const story = currentStoryTime(gameId);
  if (!story) {
    throw new Error(`principalAt: game '${gameId}' has no timeline clock yet`);
  }
  return story.t;
}
