import type { OpenMind, OpenPrincipalContext, OpenProposal } from "./mind.js";

/**
 * A PERSON in one of the two chairs, over MCP (the-prisoner#11's second half; the terminal
 * half is `humanSeat.ts`, OPEN-VARIANT.md §47). Same lesson, same architecture: "A seat is a
 * mind, full stop" (issue #11's own comment on the terminal half) held there with no new
 * plumbing in the loop, the referee or the resolver, and it holds here for exactly the same
 * reason -- `consider(context)` is the ONE method `mind-seam`'s `Mind` requires, and nothing
 * about it says who or what answers it.
 *
 * `humanSeat.ts` answers it by asking a question on a real terminal (`ask`/`write`, injected).
 * This file answers it by handing the open question ACROSS a process boundary: `consider()`
 * records the context and returns a promise that does not resolve until some later call to
 * `submitAttempt()` -- from an MCP tool handler (`attempt`, in `src/mcp/session.ts`) driven by
 * a real client, in a real turn, arbitrarily far in wall-clock time from when `consider()` was
 * called. Nothing here talks MCP, or even knows one exists: exactly the seam's own promise,
 * that the loop, the referee and the opponent are never told which kind of mind they are
 * playing against.
 *
 * WHY NO `reconsider` (D3, HUMAN-INTENTS-DESIGN.md §3.1, the-prisoner#27): `humanSeat.ts`
 * implements it to ask a clarifying question on the spot when the referee's own TARGET
 * question fell to its safe default while EFFECT was cited ("Hide what?"). This seat does not,
 * on purpose, for this issue's first landing: a bare `OpenMind` (no `reconsider`) is exactly
 * what every model mind already is (`createOpenMind`, `mind.ts`), so `loop.ts`'s own `if
 * (mind.reconsider && ...)` guard skips it here precisely as it does for a model -- a real, if
 * unglamorous, choice: an ambiguous target reaches the player as an ordinary, possibly
 * `impossible`, ruling next turn rather than a retry prompt mid-turn. Recorded as a known gap
 * in this issue's own report, not silently faked with a method that always returns
 * `undefined`.
 */
export interface McpSeatMind extends OpenMind {
  /** The context of the turn currently open, or `null` between turns (before the first one,
   *  after a submitted one and before the next, or once the game has ended without asking
   *  this seat again). Synchronous and always current the instant `consider()` is called --
   *  `game.ts`'s own loop calls `mind.consider()` and only then awaits it, so this is already
   *  set by the time anything else in the same tick could ask. */
  pendingContext(): OpenPrincipalContext | null;
  /** Resolves with the context of the next open turn: immediately, with the CURRENT one, if a
   *  turn is already open when this is called; otherwise once `consider()` is next invoked.
   *  Never resolves twice for the same turn, and never fires for a turn already answered. */
  waitForTurn(): Promise<OpenPrincipalContext>;
  /** Answers the currently open turn with exactly `proposal` -- nothing added, nothing
   *  inferred (the same discipline `humanSeat.ts`'s own header states: "nothing is invented on
   *  the player's behalf"). Throws when no turn is open: before any game, between two turns
   *  (the opponent's automatic half-round is still in flight), or after this exact turn has
   *  already been answered once. */
  submitAttempt(proposal: OpenProposal): void;
}

export function createMcpSeatMind(): McpSeatMind {
  let pending: OpenPrincipalContext | null = null;
  let turnWaiters: ((context: OpenPrincipalContext) => void)[] = [];
  let answerTurn: ((proposal: OpenProposal | null) => void) | null = null;

  return {
    async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
      pending = context;
      const waiters = turnWaiters;
      turnWaiters = [];
      for (const waiter of waiters) waiter(context);
      try {
        return await new Promise<OpenProposal | null>((resolve) => {
          answerTurn = resolve;
        });
      } finally {
        // Defensive only: the turn is already closed by the time this runs. `submitAttempt`
        // (below) clears `pending`/`answerTurn` SYNCHRONOUSLY, the instant it is called --
        // never here, in this `finally`, which only fires on a later microtask (after
        // `resolve()` has already returned control to `submitAttempt`'s own caller). A
        // waiter that ran `waitForTurn()`/`pendingContext()` in the gap between
        // `submitAttempt` returning and this `finally` actually running must already see
        // "no turn open", not the just-answered one -- exactly what a caller does the instant
        // an MCP `attempt` tool call returns and the next `my_briefing`/`attempt` is issued.
        answerTurn = null;
        pending = null;
      }
    },
    pendingContext: () => pending,
    waitForTurn(): Promise<OpenPrincipalContext> {
      if (pending) return Promise.resolve(pending);
      return new Promise((resolve) => turnWaiters.push(resolve));
    },
    submitAttempt(proposal: OpenProposal): void {
      if (!answerTurn) {
        throw new Error("no attempt is due right now: call new_game and wait for your turn (my_briefing) before attempt, and submit at most one attempt per turn.");
      }
      const resolve = answerTurn;
      // Cleared synchronously, before `resolve()` is even called: a turn is "open"
      // (`pendingContext()` non-null, `submitAttempt` callable) for exactly the span up to
      // THIS statement, never a moment longer. `resolve()`'s own continuation of `consider()`
      // (the loop moving on to the opponent's next half-round, eventually back to this seat)
      // only ever runs afterward, as a microtask -- if `pending` were cleared there instead,
      // a caller that called `waitForTurn()` synchronously after this method returned (before
      // that microtask ran) would wrongly see the JUST-ANSWERED turn as still open.
      answerTurn = null;
      pending = null;
      resolve(proposal);
    },
  };
}
