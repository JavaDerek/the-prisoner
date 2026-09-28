import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { OpenWorld } from "../open/world.js";
import type { Resolver } from "run-dmcp";
import type { Referee } from "../open/referee.js";
import type { OpenMind } from "../open/mind.js";
import type { Condition } from "../open/conditionList.js";
import type { PresenceMode, AbsenceMode } from "../open/briefing.js";
import type { ElaborationReferee } from "../open/elaborationReferee.js";
import type { Principal as OpenPrincipal } from "../ledger/beliefs.js";
import { createGameSession, type GameSession } from "./session.js";
import { McpTranscriptWriter } from "./transcript.js";

/**
 * The MCP half of the-prisoner#11: a thin server over `src/mcp/session.ts`'s
 * `GameSession`, exposing exactly the verbs the issue asks for --
 * `new_game`, `my_briefing`, `attempt`, plus the play view's own no-turn
 * commands (`rules`/`conditions`/`me`) -- so a person can play either chair
 * from any MCP client against a model in the other, as the proving caller
 * for run-dmcp#38 (see this issue's own final report for how each verb maps
 * onto that issue's engine pieces).
 *
 * WHAT THIS FILE DOES NOT DO: build a referee, an opponent mind, or a world
 * from environment variables. That is `SessionFactory`'s job, injected by
 * the caller -- `src/mcp/liveConfig.ts` for a real run (`npm run mcp-seat`),
 * a scripted one for `server.test.ts`. This keeps the file importable, and
 * fully testable through the real SDK's in-memory transport, without ever
 * calling a model (this task's own constraint).
 *
 * ONE GAME AT A TIME: this server holds a single `GameSession`, matching an
 * MCP stdio server's own shape (one client, one conversation) and
 * OPEN-VARIANT.md §75's standing rule that a referee's determinism does not
 * survive two drivers sharing one server -- there is only ever one driver
 * here regardless, but the same discipline (never two games contending for
 * one referee/swapper) is worth keeping as this server's own invariant, not
 * only the batch runner's.
 *
 * FOG: every text this server RETURNS to a tool call is either
 * `GameSession.briefingText()`/`meText()`/`rulesText()`/`conditionsText()` --
 * each already scoped to the player's own `OpenPrincipalContext`
 * (`session.ts`'s own header) -- or a plain end-of-game sentence naming who
 * won. Nothing here ever serialises a `RefereeRuling`, an `OpenHalfRoundResult`,
 * or the opponent's own proposal into a tool result. The full transcript
 * (both sides, every ruling) is written to disk for a human to read
 * afterward (`McpTranscriptWriter`), never handed back through a tool call.
 */
export interface SessionFactoryResult {
  openWorld: OpenWorld;
  resolver: Resolver;
  referee: Referee;
  opponentMind: OpenMind;
  conditions?: readonly Condition[];
  presenceMode?: PresenceMode;
  absenceMode?: AbsenceMode;
  elaborationReferee?: ElaborationReferee;
  /** Named for the transcript header only -- never read by the engine itself. */
  transcriptMeta?: { refereeModel?: string; opponentModel?: string; modelUrl?: string };
}

export type SessionFactory = (args: { side: OpenPrincipal; rounds: number }) => SessionFactoryResult | Promise<SessionFactoryResult>;

export interface CreateMcpSeatServerOptions {
  sessionFactory: SessionFactory;
  defaultRounds?: number;
  /** `false` skips writing a transcript file entirely -- used by nothing in
   *  production; kept for a caller (a future test harness) that wants the
   *  server with no filesystem side effect at all. Default: write one. */
  writeTranscript?: boolean;
  /** Overrides where a transcript is written -- `server.test.ts`'s own way
   *  of never touching this repository's committed `checkpoints/` dir.
   *  Production leaves this unset, which is `checkpoints/` under the
   *  process's own working directory, exactly where `npm run checkpoint`
   *  writes (`McpTranscriptWriter`'s own default). */
  transcriptDir?: string;
}

function textResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }] };
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const NEW_GAME_DESCRIPTION =
  "Start a new game of The Prisoner (open variant, the-prisoner#11) with the human player in one chair and a model in the other. " +
  "`side` is which chair the PLAYER sits in ('prisoner' or 'warden'); the model plays the other chair automatically. `rounds` is an " +
  "optional maximum round count. Ask the human player which side they want and relay their answer verbatim -- do not choose a side " +
  "or a round count on their behalf. Only one game may be in progress at a time.";

const MY_BRIEFING_DESCRIPTION =
  "Show the human player their current situation: what just happened, their notes and plan, what they believe, and the room around " +
  "them -- the SAME view a person playing this game at a terminal sees (the-prisoner's PRISONER_VIEW=play). Call this after new_game " +
  "and after every attempt to see what changed. Never summarise, shorten or reword this for the player -- show it to them as given, " +
  "since it is the evidence a human playtest of this game depends on.";

const ATTEMPT_DESCRIPTION =
  "Submit the HUMAN PLAYER's own attempt for this turn, in their own words, EXACTLY as they typed or said it to you -- never composed, " +
  "paraphrased, summarised or improved by you (the calling model). `intent` must be the player's verbatim text. `line` is an optional " +
  "sentence they want spoken aloud in character; also verbatim, or omitted. Set `player_typed` to true ONLY when you are relaying the " +
  "human's own words -- never set it true for an intent you generated yourself, and never guess what the player would try. This server " +
  "cannot verify who actually typed the words behind this call; every transcript it writes is marked in its own header as MCP, " +
  "client-relayed, authorship unverifiable, and must never be treated as -- or pooled with -- a model-vs-model batch or a verified human " +
  "one. The result echoes back exactly what was submitted, so the player can check it was received correctly, followed by their next " +
  "briefing (or the game's ending).";

const RULES_DESCRIPTION = "The cell's standing rules (how suspicion moves, what counts as escape). Costs no turn.";
const CONDITIONS_DESCRIPTION = "This chair's own win/loss conditions, if the game states them as a list. Costs no turn.";
const ME_DESCRIPTION = "Who the player's character is, and what they want. Costs no turn.";

export function createMcpSeatServer(options: CreateMcpSeatServerOptions): McpServer {
  const server = new McpServer({ name: "the-prisoner-mcp-seat", version: "0.1.0" });
  const defaultRounds = options.defaultRounds ?? 12;
  const writeTranscript = options.writeTranscript ?? true;

  let session: GameSession | null = null;
  let writer: McpTranscriptWriter | null = null;

  /** The text a tool call reports after any event that may have just ended the game: the
   *  ending sentence (via `briefingText()`, which already covers that case) plus, exactly
   *  once, where the transcript landed. Takes the session explicitly (never the outer,
   *  reassignable `session` variable) so a caller can only ever reach this with the one it
   *  already knows is non-null. */
  function finishIfEnded(current: GameSession): string {
    const body = current.briefingText();
    const ended = current.endedResult();
    if (ended && writer) {
      const path = writer.finish(ended);
      writer = null;
      return `${body}\n\n(Transcript written to ${path}.)`;
    }
    return body;
  }

  server.registerTool(
    "new_game",
    { description: NEW_GAME_DESCRIPTION, inputSchema: { side: z.enum(["prisoner", "warden"]), rounds: z.number().int().positive().optional() } },
    async ({ side, rounds }): Promise<CallToolResult> => {
      if (session && !session.isEnded()) {
        return errorResult("A game is already in progress. This server plays one game at a time -- finish it (to an ending or the round limit) before starting another.");
      }
      const roundCount = rounds ?? defaultRounds;
      const built = await options.sessionFactory({ side, rounds: roundCount });
      session = createGameSession({
        side,
        rounds: roundCount,
        openWorld: built.openWorld,
        resolver: built.resolver,
        referee: built.referee,
        opponentMind: built.opponentMind,
        ...(built.conditions ? { conditions: built.conditions } : {}),
        ...(built.presenceMode ? { presenceMode: built.presenceMode } : {}),
        ...(built.absenceMode ? { absenceMode: built.absenceMode } : {}),
        ...(built.elaborationReferee ? { elaborationReferee: built.elaborationReferee } : {}),
        onHalfRound: (half) => writer?.onHalfRound(half),
      });
      writer = writeTranscript
        ? new McpTranscriptWriter({
            side,
            rounds: roundCount,
            ...(options.transcriptDir ? { dir: options.transcriptDir } : {}),
            ...(built.transcriptMeta?.refereeModel ? { refereeModel: built.transcriptMeta.refereeModel } : {}),
            ...(built.transcriptMeta?.opponentModel ? { opponentModel: built.transcriptMeta.opponentModel } : {}),
            ...(built.transcriptMeta?.modelUrl ? { modelUrl: built.transcriptMeta.modelUrl } : {}),
          })
        : null;

      await session.waitForNext();
      return textResult(`Game started. You are the ${side}.\n\n${finishIfEnded(session)}`);
    }
  );

  server.registerTool("my_briefing", { description: MY_BRIEFING_DESCRIPTION, inputSchema: {} }, async (): Promise<CallToolResult> => {
    if (!session) return errorResult("No game in progress. Call new_game first.");
    return textResult(session.briefingText());
  });

  server.registerTool(
    "attempt",
    {
      description: ATTEMPT_DESCRIPTION,
      inputSchema: { intent: z.string().min(1), player_typed: z.boolean(), line: z.string().min(1).optional() },
    },
    async ({ intent, player_typed, line }): Promise<CallToolResult> => {
      if (!player_typed) {
        return errorResult(
          "Refused: player_typed must be true. This tool exists for a human player, and this server cannot verify authorship -- " +
            "set player_typed:true only when `intent` (and `line`, if given) is the player's own text, relayed verbatim, never a " +
            "client-composed guess at what they would try."
        );
      }
      if (!session) return errorResult("No game in progress. Call new_game first.");
      try {
        session.submitAttempt(intent, line);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
      await session.waitForNext();
      const spoken = line ? ` (said aloud: "${line}")` : "";
      return textResult(`You submitted: "${intent}"${spoken}\n\n${finishIfEnded(session)}`);
    }
  );

  server.registerTool("rules", { description: RULES_DESCRIPTION, inputSchema: {} }, async (): Promise<CallToolResult> => {
    if (!session) return errorResult("No game in progress. Call new_game first.");
    return textResult(session.rulesText());
  });

  server.registerTool("conditions", { description: CONDITIONS_DESCRIPTION, inputSchema: {} }, async (): Promise<CallToolResult> => {
    if (!session) return errorResult("No game in progress. Call new_game first.");
    return textResult(session.conditionsText());
  });

  server.registerTool("me", { description: ME_DESCRIPTION, inputSchema: {} }, async (): Promise<CallToolResult> => {
    if (!session) return errorResult("No game in progress. Call new_game first.");
    return textResult(session.meText());
  });

  return server;
}
