/**
 * D2 (docs/HUMAN-INTENTS-DESIGN.md §2, the-prisoner#29): the evidence a
 * human game keeps when the player leaves before the game ends, instead of
 * the run finishing with no trace of why -- CLAUDE.md's own rule that a bad
 * run is still evidence, applied to a player choosing to stop rather than a
 * program breaking.
 *
 * `checkpoint.ts` writes the transcript once at the end and again from its
 * own `catch` if the run throws (root CLAUDE.md hard rule 2's scratch
 * database aside, neither of those paths fires for a player who presses
 * ctrl-C, and a ctrl-D closes the terminal with no handler at all -- every
 * turn after that silently passes and the game runs to its round limit
 * looking like a loss, per the design's own §2). `checkpoint.ts` throws an
 * `AbandonedByPlayerError` into the SAME `Promise.race` its game loop
 * already awaits, from a `SIGINT` handler and from the seat's readline
 * closing -- "treat a closed readline as abandonment the same way" -- and
 * its existing `catch` block renders this section instead of the usual
 * code-fenced stack trace.
 *
 * This module is pure text and carries no I/O of its own (no `fs`, no
 * `process`), which is what makes it testable directly: `checkpoint.ts`
 * itself has no test file, by this repository's own standing pattern
 * (`checkpointTranscript.ts` is the tested half of every other transcript
 * section it renders).
 */

/** The `## Run aborted` section for a player-abandoned run: a plain
 *  sentence, never a code fence or a stack -- nothing broke. */
export function renderAbandonedSection(reason: string): string[] {
  return ["## Run aborted", "", reason];
}

/** The one reason this repository ever gives for a human-abandoned run,
 *  whichever way the player left. `roundN` is the last half-round this seat
 *  actually saw complete (0 if the game never got that far). */
export function abandonedByPlayerAtRound(roundN: number): string {
  return `abandoned by the player at round ${roundN}`;
}

/** Thrown into `checkpoint.ts`'s own `Promise.race` by its `SIGINT` handler
 *  and by the seat's readline closing under it (ctrl-D) -- never anywhere
 *  else. `checkpoint.ts`'s `catch` block renders `renderAbandonedSection`
 *  for exactly this error, and its ordinary code-fenced stack for anything
 *  else, so a real crash and a player choosing to stop are never told the
 *  same way. */
export class AbandonedByPlayerError extends Error {}
