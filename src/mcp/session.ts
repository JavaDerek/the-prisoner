import type { Resolver } from "run-dmcp";
import type { OpenWorld } from "../open/world.js";
import type { Referee } from "../open/referee.js";
import type { OpenMind, OpenPrincipalContext } from "../open/mind.js";
import { createPlayView, type PlayView } from "../open/humanSeat.js";
import { createMcpSeatMind } from "../open/mcpSeatMind.js";
import { runOpenGame, type OpenGameResult } from "../open/game.js";
import type { OpenHalfRoundResult } from "../open/loop.js";
import type { PresenceMode, AbsenceMode } from "../open/briefing.js";
import type { Condition } from "../open/conditionList.js";
import type { ElaborationReferee } from "../open/elaborationReferee.js";
import type { Principal as OpenPrincipal } from "../ledger/beliefs.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";

/**
 * The engine underneath the MCP seat (the-prisoner#11's MCP half). No MCP
 * SDK import here on purpose: `src/mcp/server.ts` is a thin translation from
 * MCP tool calls to the three methods below, and this file is what the
 * round-trip test exercises directly, with a scripted referee and a
 * scripted opponent mind, never a network call (this task's own constraint:
 * no model may be called while building this).
 *
 * ARCHITECTURE (the coordinator's decision, and issue #11's own terminal-half
 * lesson carried over): "a seat is a mind." `GameSession` runs the SAME
 * `runOpenGame` every checkpoint runs, with an `McpSeatMind` (`mcpSeatMind.ts`)
 * in the player's chair and a caller-supplied `OpenMind` (a real model, in
 * production; a scripted one, in a test) in the other. The loop, the
 * referee and the resolver never know one chair is a person typing through
 * an MCP client rather than a model on the local card.
 */
export interface GameSessionConfig {
  /** Which chair the PLAYER sits in. The other chair is `opponentMind`. */
  side: OpenPrincipal;
  rounds: number;
  openWorld: OpenWorld;
  resolver: Resolver;
  referee: Referee;
  /** The model (or, in a test, scripted) mind in the chair the player did
   *  NOT choose. Built by the caller -- this module never constructs one,
   *  so it never has to know whether that means a real endpoint or a script. */
  opponentMind: OpenMind;
  /** OPEN-VARIANT.md §34: the condition list both chairs' prompts and the
   *  MCP seat's own `play` view read from. Absent: no condition list --
   *  the pre-§34 baseline (`live.ts`'s own default matches the game's
   *  2026-09-27 default of `both` instead, see that module's own comment). */
  conditions?: readonly Condition[];
  presenceMode?: PresenceMode;
  absenceMode?: AbsenceMode;
  elaborationReferee?: ElaborationReferee;
  /** Called once per half-round played, EITHER side -- for a transcript
   *  writer (`checkpointWriter.ts`) to accumulate from, exactly like
   *  `checkpoint.ts`'s own `onHalfRound`. Never a channel a tool result is
   *  built from: fog is kept by `GameSession` only ever handing a TOOL
   *  caller the SEAT's own `OpenPrincipalContext`, never a half-round of
   *  either side (see `pendingContext`/`briefingText` below). */
  onHalfRound?: (half: OpenHalfRoundResult) => void;
}

export type SessionEvent = { kind: "turn"; context: OpenPrincipalContext } | { kind: "ended"; result: OpenGameResult };

function endingText(side: OpenPrincipal, result: OpenGameResult): string {
  if (!result.ended) {
    return `Timeout after ${result.endedAtRound ?? "every"} round(s): neither side reached an ending. The warden wins by default.`;
  }
  if (result.ended.kind === "escaped") {
    return side === "prisoner" ? `You escaped, at round ${result.endedAtRound}. The game is over.` : `${PRISONER_NAME} escaped, at round ${result.endedAtRound}. The game is over -- you did not stop her in time.`;
  }
  return side === "warden" ? `You caught ${PRISONER_NAME}, at round ${result.endedAtRound}. The game is over.` : `${WARDEN_NAME} caught you, at round ${result.endedAtRound}. The game is over.`;
}

/**
 * One MCP game: one seat, one opponent, one referee, one resolver, run to an
 * ending or a round limit. `waitForNext` is the ONE place this class ever
 * awaits anything from the loop -- a race between "the seat's own next turn
 * opened" and "the game ended without asking the seat again" (the second
 * arm matters: the OPPONENT's move can end the game mid-round, and the seat
 * is never asked another question after that -- OPEN-VARIANT.md's own loop
 * shape, `game.ts`).
 */
export class GameSession {
  readonly side: OpenPrincipal;
  readonly selfName: string;
  readonly otherName: string;
  readonly halves: OpenHalfRoundResult[] = [];
  private readonly seat = createMcpSeatMind();
  private readonly playView: PlayView;
  private readonly gamePromise: Promise<OpenGameResult>;
  private ended: OpenGameResult | null = null;
  /** The last context this seat was actually shown -- kept so `meText`/`rulesText`/
   *  `conditionsText` (below) can still answer between two turns, while the opponent's
   *  half-round is in flight and `pendingContext()` is `null`. Identity, the rules and the
   *  condition list never change turn to turn, so answering from the last-seen one rather
   *  than refusing until the next turn opens costs nothing true. */
  private lastContext: OpenPrincipalContext | null = null;

  constructor(config: GameSessionConfig) {
    this.side = config.side;
    this.selfName = config.side === "prisoner" ? PRISONER_NAME : WARDEN_NAME;
    this.otherName = config.side === "prisoner" ? WARDEN_NAME : PRISONER_NAME;
    this.playView = createPlayView(this.selfName, this.otherName, config.conditions);
    const wardenMind = config.side === "warden" ? this.seat : config.opponentMind;
    const prisonerMind = config.side === "prisoner" ? this.seat : config.opponentMind;
    this.gamePromise = runOpenGame({
      openWorld: config.openWorld,
      resolver: config.resolver,
      referee: config.referee,
      wardenMind,
      prisonerMind,
      rounds: config.rounds,
      ...(config.presenceMode ? { presenceMode: config.presenceMode } : {}),
      ...(config.absenceMode ? { absenceMode: config.absenceMode } : {}),
      ...(config.elaborationReferee ? { elaborationReferee: config.elaborationReferee } : {}),
      onHalfRound: (half) => {
        this.halves.push(half);
        config.onHalfRound?.(half);
      },
    }).then((result) => {
      this.ended = result;
      return result;
    });
    // A game that ends by throwing (a referee/model call failing outright, not merely a
    // silent turn -- silence is an ordinary `OpenHalfRoundResult`, never a rejection) must
    // not become an unhandled rejection just because no tool call has awaited this promise
    // yet. `waitForNext` still awaits the SAME promise and sees the SAME rejection when a
    // caller actually asks; this only stops Node from complaining about the one nobody has
    // asked about yet, the identical discipline `checkpoint.ts`'s own abandon signal uses.
    this.gamePromise.catch(() => {});
  }

  /** Resolves once EITHER this seat's own next turn is open, or the game has
   *  ended (whichever happens first) -- see this class's own header. */
  async waitForNext(): Promise<SessionEvent> {
    if (this.ended) return { kind: "ended", result: this.ended };
    const event = await Promise.race([
      this.seat.waitForTurn().then((context): SessionEvent => ({ kind: "turn", context })),
      this.gamePromise.then((result): SessionEvent => ({ kind: "ended", result })),
    ]);
    if (event.kind === "turn") this.lastContext = event.context;
    return event;
  }

  /** This seat's own currently open context, or `null` between turns (the
   *  opponent's half-round may still be in flight, or the game has ended). */
  pendingContext(): OpenPrincipalContext | null {
    return this.seat.pendingContext();
  }

  isEnded(): boolean {
    return this.ended !== null;
  }

  endedResult(): OpenGameResult | null {
    return this.ended;
  }

  /** `my_briefing`'s own text: the SAME `play` rendering the terminal seat
   *  shows (`createPlayView`, `humanSeat.ts`) of this seat's own pending
   *  context, or -- once the game has ended -- a plain sentence naming who
   *  won, never a second information set and never the other side's own
   *  ruling or outcome (OPEN-VARIANT.md's fog: `pendingContext()` above is
   *  already this principal's own view, so nothing more needs withholding
   *  here). */
  briefingText(): string {
    const context = this.seat.pendingContext();
    if (context) return this.playView.render(context);
    if (this.ended) return endingText(this.side, this.ended);
    return `Waiting on ${this.otherName}'s turn to finish -- call my_briefing again shortly.`;
  }

  /** `me`/`rules`/`conditions`: the no-turn commands `PLAY_BLOCK_POLICY` (`humanSeat.ts`) holds
   *  the identity/rules/condition-list blocks behind, mirroring the terminal seat's own
   *  `me`/`rules`/`conditions` tokens exactly -- same accessor (`PlayView.blockText`), same
   *  fallback wording, so an MCP game and a terminal game answer these identically. Answered
   *  from `lastContext` (see its own comment) so a call between two turns still works. */
  meText(): string {
    const context = this.pendingContext() ?? this.lastContext;
    if (!context) return "No game in progress yet -- call new_game first.";
    const identity = this.playView.blockText(context, "identity");
    return identity.length > 0 ? identity : `You are ${this.selfName}.`;
  }

  rulesText(): string {
    const context = this.pendingContext() ?? this.lastContext;
    if (!context) return "No game in progress yet -- call new_game first.";
    const rules = this.playView.blockText(context, "rules");
    return rules.length > 0 ? rules : "This cell has no standing rules beyond what you can see.";
  }

  conditionsText(): string {
    const context = this.pendingContext() ?? this.lastContext;
    if (!context) return "No game in progress yet -- call new_game first.";
    const conditions = this.playView.blockText(context, "conditions");
    return conditions.length > 0 ? conditions : "This chair has no condition list.";
  }

  /** `attempt`'s own write path: answers the currently open turn with
   *  exactly `intent`/`line`, verbatim (`mcpSeatMind.ts`'s own rule -- "nothing
   *  invented on the player's behalf"). Throws when there is no open turn to
   *  answer: before `new_game`'s first turn is ready, between two turns
   *  while the opponent's half-round is in flight, or after the game has
   *  ended. */
  submitAttempt(intent: string, line?: string): void {
    if (this.ended) throw new Error("this game has already ended -- call new_game to start another one.");
    if (this.seat.pendingContext() === null) {
      throw new Error("it is not your turn right now -- call my_briefing (or wait) until it shows your situation, then attempt.");
    }
    this.seat.submitAttempt({ intent, ...(line !== undefined ? { line } : {}) });
  }
}

export function createGameSession(config: GameSessionConfig): GameSession {
  return new GameSession(config);
}
