import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../../open/world.js";
import { buildOpenResolver } from "../../open/mechanics.js";
import { createReferee } from "../../open/referee.js";
import { scriptedReferee, RULINGS, WAIT, OPEN_DOOR, LEAVE_DOOR } from "../../open/__tests__/helpers/scriptedReferee.js";
import { scriptedMind } from "mind-seam";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../../open/mind.js";
import { createGameSession } from "../session.js";
import { McpTranscriptWriter } from "../transcript.js";

// `McpTranscriptWriter` (the-prisoner#11's MCP half): reuses `checkpoint.ts`'s own rendering
// functions (`renderOpenHalfRound`/`renderOpenSummary`), never a hand-written re-rendering, and
// writes into a directory the TEST controls, never this repository's own committed
// `checkpoints/` -- CLAUDE.md commits transcripts unedited, so a test run must never leave one
// behind for a real batch to be confused by.

function repeating(proposal: OpenProposal): OpenMind {
  return scriptedMind<OpenPrincipalContext, OpenProposal>(proposal);
}

describe("McpTranscriptWriter", () => {
  let dir: string;

  beforeEach(() => {
    createTestDb();
    dir = mkdtempSync(join(tmpdir(), "prisoner-mcp-transcript-"));
  });

  afterEach(() => {
    destroyTestDb();
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a header marking the seat as MCP, client-relayed and unverifiable, on construction", () => {
    const writer = new McpTranscriptWriter({ side: "prisoner", rounds: 8, dir });
    const content = readFileSync(writer.path, "utf8");
    expect(content).toContain("Seat: MCP (client-relayed; authorship unverifiable)");
    expect(content).toContain("NEVER pool this transcript with a model batch");
  });

  it("appends each half-round, in order, using checkpoint.ts's own renderer", async () => {
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const referee = createReferee([scriptedReferee(RULINGS)]);
    const writer = new McpTranscriptWriter({ side: "prisoner", rounds: 8, dir });
    const session = createGameSession({
      side: "prisoner",
      rounds: 8,
      openWorld,
      resolver,
      referee,
      opponentMind: repeating({ intent: WAIT }),
      onHalfRound: (half) => writer.onHalfRound(half),
    });

    let event = await session.waitForNext();
    session.submitAttempt(OPEN_DOOR);
    event = await session.waitForNext();
    session.submitAttempt(LEAVE_DOOR);
    event = await session.waitForNext();
    expect(event.kind).toBe("ended");

    const path = event.kind === "ended" ? writer.finish(event.result) : "";
    const content = readFileSync(path, "utf8");
    expect(content).toContain("the warden");
    expect(content).toContain("the prisoner");
    expect(content).toContain("## Result");
    expect(content).toContain("escaped");
  });
});
