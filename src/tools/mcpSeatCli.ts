// `npm run mcp-seat` (the-prisoner#11's MCP half): the thin MCP server, started for real, over
// stdio. Everything that decides anything is in `src/mcp/server.ts` (the tool surface) and
// `src/mcp/liveConfig.ts` (env -> a real referee/opponent mind/swapper, read exactly as
// `checkpoint.ts` reads them) -- this file only supplies the real transport and the process-level
// bookkeeping `checkpoint.ts`'s own `main()` does at its top: a fresh scratch database (root
// CLAUDE.md's hard rule 2 -- never the default path), and restoring whatever model was resident
// on the GPU before this run (CLAUDE.md's "Local play is all-Muse": the card is shared with Shep).
//
// STDOUT IS THE MCP TRANSPORT under stdio -- `StdioServerTransport` reads JSON-RPC from stdin and
// writes it to stdout. Nothing in this file (or anything it calls while the server is connected)
// may `console.log`; every diagnostic here goes to stderr instead, exactly as `npm run
// model-router` (`modelRouterCli.ts`) keeps its own stdout reserved for the one line per request
// it documents in CLAUDE.md.
import { initializeSchema } from "run-dmcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { prisonerMigration } from "../world/schema.js";
import { createMcpSeatServer } from "../mcp/server.js";
import { buildLiveSessionFactory } from "../mcp/liveConfig.js";

const dbPath = process.env.PRISONER_CHECKPOINT_DB ?? `/tmp/the-prisoner-mcp-seat-${Date.now()}.db`;
process.env.DMCP_DB_PATH = dbPath;
// Never touch the default database (root CLAUDE.md hard rule 2): a fresh scratch file, exactly as
// `checkpoint.ts`'s own `main()` sets up, before any run-dmcp function is called.
initializeSchema({ migrations: [prisonerMigration] });

const ROUNDS = process.env.PRISONER_ROUNDS ? Number(process.env.PRISONER_ROUNDS) : 12;

async function main(): Promise<void> {
  const live = buildLiveSessionFactory();
  await live.assertNoForeignModelLoaded();
  live.restoreOnExit();

  const server = createMcpSeatServer({ sessionFactory: live.factory, defaultRounds: ROUNDS });
  await server.connect(new StdioServerTransport());
  console.error(`the-prisoner mcp-seat: listening on stdio (database: ${dbPath}, default rounds: ${ROUNDS}).`);
}

main().catch((err) => {
  console.error("the-prisoner mcp-seat: failed to start:", err);
  process.exitCode = 1;
});
