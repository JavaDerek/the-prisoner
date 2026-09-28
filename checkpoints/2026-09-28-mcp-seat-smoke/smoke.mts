// the-prisoner#11: one live end-to-end run of `npm run mcp-seat` through a real stdio MCP client -- the
// server spawned exactly as Claude Code would spawn it, the model opponent and referee real (doris, all-Muse).
// Not a measurement and never pooled: the "player" is this script, typing three fixed intents a person typed in
// the 2026-09-28 game. It proves the verbs, the fog and the verbatim echo against a live model, nothing more.
//
// usage (one driver, from a pinned worktree): npx tsx checkpoints/2026-09-28-mcp-seat-smoke/smoke.mts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const INTENTS = ["dig at the bars with the spoon", "get the blanket", "dig at the bars with the spoon"];

function text(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

const transport = new StdioClientTransport({
  command: "npm",
  args: ["run", "--silent", "mcp-seat"],
  env: { ...process.env, PRISONER_SKIP_VOICE: "1" } as Record<string, string>,
  stderr: "inherit",
});
const client = new Client({ name: "mcp-seat-smoke", version: "0.0.1" });
await client.connect(transport);
const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name).join(", "));

const refused = await client.callTool({ name: "attempt", arguments: { intent: "look around", player_typed: true } });
console.log("\n== attempt before new_game ==\n" + text(refused));

console.log("\n== new_game ==\n" + text(await client.callTool({ name: "new_game", arguments: { side: "prisoner", rounds: INTENTS.length } })));
console.log("\n== my_briefing ==\n" + text(await client.callTool({ name: "my_briefing", arguments: {} })));
const noConfirm = await client.callTool({ name: "attempt", arguments: { intent: INTENTS[0], player_typed: false } });
console.log("\n== attempt with player_typed: false ==\n" + text(noConfirm));

for (const [i, intent] of INTENTS.entries()) {
  const t0 = Date.now();
  const r = await client.callTool({ name: "attempt", arguments: { intent, player_typed: true } });
  console.log(`\n== attempt ${i + 1} (${Math.round((Date.now() - t0) / 1000)} s): ${JSON.stringify(intent)} ==\n` + text(r));
}
await client.close();
