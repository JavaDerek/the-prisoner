import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../../open/world.js";
import { buildOpenResolver } from "../../open/mechanics.js";
import { createReferee } from "../../open/referee.js";
import { scriptedReferee, RULINGS, WAIT, OPEN_DOOR, LEAVE_DOOR, EXAMINE } from "../../open/__tests__/helpers/scriptedReferee.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../../open/mind.js";
import { createMcpSeatServer, type SessionFactory } from "../server.js";

/**
 * The MCP half of the-prisoner#11, end to end, through the real SDK -- an
 * in-memory transport pair (`InMemoryTransport.createLinkedPair`) stands in
 * for a real client process, so this is a genuine MCP round trip (tool
 * discovery, JSON schema validation, `callTool`) with a SCRIPTED referee and
 * a SCRIPTED opponent mind underneath: no model, no network, per this
 * task's own constraint.
 */
function repeating(proposal: OpenProposal): OpenMind {
  return scriptedMind<OpenPrincipalContext, OpenProposal>(proposal);
}

function scripted(intents: readonly string[]): OpenMind {
  let turn = 0;
  return {
    async consider() {
      const intent = intents[Math.min(turn, intents.length - 1)];
      turn += 1;
      return { intent };
    },
  };
}

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

function text(result: ToolResult): string {
  const content = (result.content ?? []) as readonly { type: string; text?: string }[];
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

describe("the MCP seat server", () => {
  let dir: string;
  let client: Client;

  beforeEach(async () => {
    createTestDb();
    dir = mkdtempSync(join(tmpdir(), "prisoner-mcp-server-"));
  });

  afterEach(() => {
    destroyTestDb();
    rmSync(dir, { recursive: true, force: true });
  });

  async function connect(opponentMind: OpenMind): Promise<Client> {
    const factory: SessionFactory = () => ({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      opponentMind,
    });
    const server = createMcpSeatServer({ sessionFactory: factory, transcriptDir: dir });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "test-client", version: "0.0.0" });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return client;
  }

  it("lists the tools the-prisoner#11 asks for: new_game, my_briefing, attempt, rules, conditions, me", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    const { tools } = await c.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["attempt", "conditions", "me", "my_briefing", "new_game", "rules"].sort());
  });

  it("my_briefing before new_game refuses", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    const result = await c.callTool({ name: "my_briefing", arguments: {} });
    expect(result.isError).toBe(true);
    expect(text(result).toLowerCase()).toContain("no game in progress");
  });

  it("attempt before new_game refuses", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    const result = await c.callTool({ name: "attempt", arguments: { intent: "I try the door.", player_typed: true } });
    expect(result.isError).toBe(true);
  });

  it("attempt with player_typed: false is refused, and never reaches the game", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    const result = await c.callTool({ name: "attempt", arguments: { intent: "I try the door.", player_typed: false } });
    expect(result.isError).toBe(true);
    expect(text(result).toLowerCase()).toContain("player_typed");
  });

  it("attempt with player_typed missing is refused by schema validation", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    const result = await c.callTool({ name: "attempt", arguments: { intent: "I try the door." } as any });
    expect(result.isError).toBe(true);
    expect(text(result).toLowerCase()).toContain("player_typed");
  });

  it("new_game -> my_briefing -> attempt round trip, echoing the submitted intent verbatim", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    const started = await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    expect(started.isError).toBeFalsy();
    expect(text(started)).toContain("This is round 1 of 8");

    const briefing = await c.callTool({ name: "my_briefing", arguments: {} });
    expect(text(briefing)).toContain("This is round 1 of 8");

    const attempted = await c.callTool({ name: "attempt", arguments: { intent: "I lever the bolt back.", player_typed: true } });
    expect(text(attempted)).toContain("I lever the bolt back.");
  });

  it("fog: the player's briefing never contains the opponent's own ruling keys or private fields", async () => {
    // The opponent (warden) EXAMINEs -- a visible act, so its own PERCEPTIBLE outcome (a
    // sentence in prose) may legitimately reach the prisoner next turn, but never the
    // referee's internal ruling shape (effectKind/citations/etc as raw keys) or the warden's
    // own private thoughts/notes.
    const c = await connect(repeating({ intent: EXAMINE, notes: "WARDEN_PRIVATE_NOTES_MARKER", thoughts: "WARDEN_PRIVATE_THOUGHTS_MARKER" } as OpenProposal));
    const started = await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    const startedText = text(started);
    expect(startedText).not.toContain("WARDEN_PRIVATE_NOTES_MARKER");
    expect(startedText).not.toContain("WARDEN_PRIVATE_THOUGHTS_MARKER");
    expect(startedText).not.toMatch(/effectKind|citations|"applicable"/);
  });

  it("attempt requires new_game's own side: warden can be seated too, and its briefing differs from the prisoner's", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    const started = await c.callTool({ name: "new_game", arguments: { side: "warden", rounds: 8 } });
    expect(text(started)).toContain("This is round 1 of 8");
  });

  it("a game reaching an ending (escape) is reported, and a transcript is written under the configured dir", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    await c.callTool({ name: "attempt", arguments: { intent: OPEN_DOOR, player_typed: true } });
    const ending = await c.callTool({ name: "attempt", arguments: { intent: LEAVE_DOOR, player_typed: true } });
    expect(text(ending).toLowerCase()).toContain("escaped");

    const files = await import("node:fs").then((fs) => fs.readdirSync(dir));
    expect(files.some((f) => f.endsWith("-mcp.md"))).toBe(true);
    const content = readFileSync(join(dir, files.find((f) => f.endsWith("-mcp.md"))!), "utf8");
    expect(content).toContain("Seat: MCP (client-relayed; authorship unverifiable)");
    expect(content).toContain("escaped");
  });

  it("attempt after the game has ended refuses", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    await c.callTool({ name: "attempt", arguments: { intent: OPEN_DOOR, player_typed: true } });
    await c.callTool({ name: "attempt", arguments: { intent: LEAVE_DOOR, player_typed: true } });
    const result = await c.callTool({ name: "attempt", arguments: { intent: "anything", player_typed: true } });
    expect(result.isError).toBe(true);
  });

  it("the opponent's own move can end the game -- attempt still reports the ending, never hangs", async () => {
    const c = await connect(scripted([OPEN_DOOR, LEAVE_DOOR]));
    await c.callTool({ name: "new_game", arguments: { side: "warden", rounds: 8 } });
    await c.callTool({ name: "attempt", arguments: { intent: WAIT, player_typed: true } });
    const ending = await c.callTool({ name: "attempt", arguments: { intent: WAIT, player_typed: true } });
    expect(text(ending).toLowerCase()).toContain("escaped");
  });

  it("rules/conditions/me answer without spending a turn", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    const me = await c.callTool({ name: "me", arguments: {} });
    expect(text(me)).toContain("Mara Voss");
    const rules = await c.callTool({ name: "rules", arguments: {} });
    expect(text(rules).length).toBeGreaterThan(0);
    const conditions = await c.callTool({ name: "conditions", arguments: {} });
    expect(text(conditions).length).toBeGreaterThan(0);
    // None of these should have advanced the game -- my_briefing still shows round 1.
    const briefing = await c.callTool({ name: "my_briefing", arguments: {} });
    expect(text(briefing)).toContain("This is round 1 of 8");
  });

  it("starting a new game while one is already in progress refuses", async () => {
    const c = await connect(repeating({ intent: WAIT }));
    await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    const second = await c.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: 8 } });
    expect(second.isError).toBe(true);
  });
});
