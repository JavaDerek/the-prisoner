import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderOpenHalfRound, renderOpenSummary } from "../open/checkpointTranscript.js";
import type { OpenHalfRoundResult } from "../open/loop.js";
import type { OpenGameResult } from "../open/game.js";
import type { Principal as OpenPrincipal } from "../ledger/beliefs.js";
import { describeRunRevision } from "../runRevision.js";

/**
 * The MCP seat's own transcript writer (the-prisoner#11's MCP half). Reuses
 * the SAME rendering functions `checkpoint.ts`'s own writer does
 * (`renderOpenHalfRound`/`renderOpenSummary`, `src/open/checkpointTranscript.ts`)
 * -- never a second, hand-written rendering of a half-round or a game's
 * ending. What is NOT reused is `checkpoint.ts`'s own `mkdirSync`/
 * `writeFileSync` plumbing: that file has never factored those two calls out
 * into anything importable (they sit inline, repeated at several points in
 * one 1600-line script), so this module's own copy of them is the one small
 * duplicate this issue's report names -- see the final report for the
 * alternative considered (patching `checkpoint.ts` to export a writer) and
 * why it was not taken for a first landing.
 *
 * THE HEADER MARKS ITSELF (this task's own guard requirement): every
 * transcript this writer produces opens with `Seat: MCP (client-relayed;
 * authorship unverifiable)`, in the same place and the same spirit
 * `checkpoint.ts`'s own `HUMAN SEAT` line marks a terminal game -- CLAUDE.md's
 * rule that a transcript with a person in it must never be pooled with a
 * model batch applies here with a sharper edge: this server cannot verify
 * that the words behind `attempt` were typed by a person at all, only that
 * an MCP client SAID `player_typed: true`.
 */
export interface McpTranscriptOptions {
  side: OpenPrincipal;
  rounds: number;
  refereeModel?: string;
  opponentModel?: string;
  modelUrl?: string;
  /** Where to write -- defaults to `checkpoints/` under the CURRENT working
   *  directory, exactly where `npm run checkpoint` writes. Overridable so a
   *  test never touches this repository's own committed `checkpoints/` dir. */
  dir?: string;
}

export class McpTranscriptWriter {
  private readonly lines: string[] = [];
  private readonly filePath: string;
  private readonly rounds: number;

  constructor(options: McpTranscriptOptions) {
    this.rounds = options.rounds;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = options.dir ?? join(process.cwd(), "checkpoints");
    this.filePath = join(dir, `${stamp}-mcp.md`);

    this.lines.push("# The Prisoner -- checkpoint transcript (open variant, MCP seat)", "");
    this.lines.push(`Generated: ${new Date().toISOString()}`, "");
    this.lines.push(
      "Seat: MCP (client-relayed; authorship unverifiable) -- the-prisoner#11's MCP half. " +
        `${options.side === "prisoner" ? "The prisoner" : "The warden"} was played through an MCP client's ` +
        "`attempt` tool call, confirmed `player_typed: true`; this server cannot verify that the words it " +
        "received were typed by a person rather than composed by the client's own model. NEVER pool this " +
        "transcript with a model batch (CLAUDE.md): it is neither a model-vs-model game nor a verified human one."
    );
    this.lines.push(`Rounds (max): ${options.rounds}.`);
    if (options.modelUrl) this.lines.push(`Model URL: ${options.modelUrl}.`);
    if (options.opponentModel) this.lines.push(`Opponent model: \`${options.opponentModel}\`.`);
    if (options.refereeModel) this.lines.push(`Referee model: \`${options.refereeModel}\`.`);
    this.lines.push(`Code revision: ${describeRunRevision()}`);
    this.lines.push("", "## Rounds", "");
    this.flush();
  }

  /** One half-round, either side, in the order played -- the transcript
   *  carries BOTH sides (as every checkpoint transcript does; that is not a
   *  fog leak: the transcript is a record for a person to read afterward,
   *  never what a live tool call hands back to the MCP client mid-game). */
  onHalfRound(half: OpenHalfRoundResult): void {
    this.lines.push(...renderOpenHalfRound(half));
    this.flush();
  }

  /** Appends the game's own ending summary and returns the path written to. */
  finish(game: OpenGameResult): string {
    this.lines.push(...renderOpenSummary(game, this.rounds));
    this.flush();
    return this.filePath;
  }

  get path(): string {
    return this.filePath;
  }

  private flush(): void {
    mkdirSync(join(this.filePath, ".."), { recursive: true });
    writeFileSync(this.filePath, this.lines.join("\n") + "\n");
  }
}
