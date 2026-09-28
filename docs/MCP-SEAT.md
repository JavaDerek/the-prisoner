# The MCP seat (the-prisoner#11's MCP half)

`OPEN-VARIANT.md` §84 is the pointer here. This document is the detail: the verbs, how each maps
onto the engine pieces JavaDerek/run-dmcp#38 proposes, what building this taught about each, how to
connect a client, and what is out of scope for this first landing.

## What this is

A thin MCP server (`npm run mcp-seat`, `src/tools/mcpSeatCli.ts`) so a person can play either chair
of The Prisoner's open variant from any MCP client, against a model in the other chair, ruled by the
same referee every batch runs. It is the second consumer of "a seat is a mind" — the-prisoner#11's
own terminal half (`PRISONER_HUMAN=prisoner|warden`, `src/open/humanSeat.ts`, §47) proved that a
human seat is an ordinary `OpenMind` implementation and nothing more; this seat (`src/open/
mcpSeatMind.ts`) is a second implementation of the identical interface, whose `consider()` waits on
an MCP tool call instead of a `readline` prompt. The loop (`src/open/game.ts`), the referee and the
resolver do not know, and do not need to.

**It is a proving caller, not a finished product.** run-dmcp#38 sketches a set of engine pieces for
letting an autonomous or human principal act asynchronously against a shared world. Nothing in
run-dmcp implements that yet. Building the MCP seat here, entirely in this repository's own words
(cell, warden, prisoner — never exported upward, per this repository's CLAUDE.md), is how those
pieces get pressure-tested against a real client before anything is designed into the engine itself.

## The verbs

| Tool | Arguments | What it does |
|---|---|---|
| `new_game` | `side: "prisoner" \| "warden"`, `rounds?: number` | Starts one game with the player in `side`'s chair and a model in the other. Refuses if a game is already in progress. |
| `my_briefing` | *(none)* | Returns the player's current situation: the same `play`-view rendering (`PRISONER_VIEW=play`, §"play is the view to hand a person") the terminal seat shows — news first, then the room, with the standing rules/conditions/identity behind the three commands below. |
| `attempt` | `intent: string`, `player_typed: boolean`, `line?: string` | Submits the player's turn. Runs it through the referee and the resolver, then runs the opponent's automatic half-round(s) until it is the player's turn again (or the game ends), and returns the player's next briefing (or the ending). |
| `rules` | *(none)* | The cell's standing rules. Costs no turn. |
| `conditions` | *(none)* | This chair's own win/loss conditions, if the game states them as a list. Costs no turn. |
| `me` | *(none)* | Who the player's character is, and what they want. Costs no turn. |

One server holds one game at a time (an MCP stdio server is already one client, one conversation;
see "Scope and gaps" for why this is a floor, not an accidental limit).

## The guard, and why it has teeth

The client's own model sits between the human player and this server — nothing stops a calling model
from composing a plausible intent instead of relaying the player's real one. Three things push back,
none of them a proof:

1. **Every tool description tells the client to relay the player's own words verbatim** and never to
   decide or improve on their behalf (see each tool's `description` in `src/mcp/server.ts`).
2. **`attempt` requires `player_typed: true`.** Missing it is a schema validation error before the
   handler ever runs; `false` is refused explicitly, with a message naming why. Neither reaches the
   game.
3. **`attempt`'s own result echoes the submitted `intent` (and `line`, if given) back verbatim**, so
   a human reading the conversation can check that what reached the referee is what they actually
   said.

**None of this can be verified server-side.** A client that ignores its own tool description and
sets `player_typed: true` on a self-composed intent is indistinguishable, from this server's point of
view, from a real human relaying their own words. Every transcript this server writes says so in its
own header — `Seat: MCP (client-relayed; authorship unverifiable)` — and must never be pooled with a
model-vs-model batch or treated as a verified human game, exactly as CLAUDE.md already requires for
the terminal seat, with a sharper edge: the terminal seat's player is a person at a keyboard, and this
one might not be.

## Fog

Every string a tool call returns comes from `GameSession`'s own `briefingText`/`rulesText`/
`conditionsText`/`meText` (`src/mcp/session.ts`), each built from the player's own
`OpenPrincipalContext` — the identical, already-fog-checked object a model mind in that chair would
receive (OPEN-VARIANT.md's invariant: a mind never learns what it could not perceive). Nothing here
serialises a `RefereeRuling`, an `OpenHalfRoundResult`, or the opponent's own proposal into a tool
result. The full two-sided transcript (every ruling, both principals) is written to
`checkpoints/<stamp>-mcp.md` for a person to read afterward, through the same rendering functions
`checkpoint.ts` itself uses (`renderOpenHalfRound`/`renderOpenSummary`) — never through a tool call.

## Mapping onto run-dmcp#38, and what this build learned

| this game's verb | #38's piece | what building it taught |
|---|---|---|
| `my_briefing` | **#18, a per-principal view** | The raw `OpenPrincipalContext` is not what a person needs handed to them — a *rendering* of it is, and that rendering wants its own turn-to-turn state (the "shown once" delta, `src/open/deltaView.ts`) so the standing world is not repeated every turn. `createPlayView` (`src/open/humanSeat.ts`) already had to solve this for the terminal seat; the MCP seat reuses it rather than a second implementation. **If #18 designs a per-principal view as a pure function of the current state, it will need a second design pass for a REPEATED view over a turn sequence** — a live per-principal view is not stateless once a human is reading it. |
| `attempt` | **#39, intent in / ruling out** | The engine-shaped part (`referee.rule` → `resolver.resolve`) needed nothing new for MCP — the same call the terminal seat and every model mind already make. What MCP added sits entirely OUTSIDE that boundary: authorship confirmation (`player_typed`), verbatim echo, and the transcript's own unverifiable-authorship marker. **This is a clean negative finding for #39: "who is allowed to submit this intent, and how do we know" is a caller concern, not something the engine's intent-in/ruling-out contract needs to carry.** |
| the opponent's automatic half-round, between one `attempt` and the next | **#40, "a principal is due to act"** | The MCP seat's `consider()` (`src/open/mcpSeatMind.ts`) returns a promise that can stay pending for an arbitrary, real-world span — seconds for a fast player, or however long an MCP conversation sits idle. Nothing about the loop changes because of this; `runOpenGame` never learns the difference between a model's few-second HTTP round trip and a human's five-minute one. **This is the clearest evidence for #40: "due to act" should be designed as an indefinitely-pending callback/promise the engine awaits, never a bounded, poll-or-timeout request** — a real player is not a slow model. |
| `rules` / `conditions` / `me` | **#41, rules as declared data** | These three tools needed no new engine call at all: they are pure reads over data the game already declares (`openConditions`, the stakes/rules text `proseBlocks` composes) through `PlayView.blockText`. **That a wholly separate caller (this server) could expose them for free is itself evidence for #41's premise** — a scenario's declared rules are data the engine already owns, not something computed per turn, so any caller with read access to the same declarations can show them. |

**One structural finding that applies to more than one piece.** This server holds exactly one game,
with its own world, resolver and referee instance, never sharing a referee across two games —
independently of OPEN-VARIANT §75's finding that two DRIVERS sharing one referee/server make its
rulings non-deterministic under concurrent load. If #38's eventual engine serves several games at
once, each game's own referee (and the swapper beneath it, on a shared GPU) needs to be a separate
instance per game, not a pooled or shared one; this server's own shape (one `GameSession` = one
world + one resolver + one referee) is the pattern worth carrying forward, not an accident of scope.

## What is out of scope for this landing

Deliberately thin, and named rather than silently assumed away (`src/mcp/liveConfig.ts`'s own
header):

- **No `reconsider` (D3's "Hide what?" retry).** The terminal seat asks a clarifying question when
  the referee's target falls to its safe default while the effect is cited from the intent. The MCP
  seat has no such method — a bare `OpenMind`, exactly like a model — so an ambiguous target reaches
  the player as an ordinary (possibly `impossible`) ruling next turn, never a retry prompt. Worth
  building if a real MCP game shows this costing turns the way it did before D3 landed for the
  terminal seat.
- **The precedent condition, the pick condition, the play-time elaboration referee, the prose seat,
  the narrator (`PRISONER_VIEW=narrated`), and the strategy pre-commitment step are not wired.**
  `my_briefing` always renders the `play` view; there is no `PRISONER_VIEW` equivalent for an MCP
  client yet. Any of these could be added the same way `liveConfig.ts` already reads every other arm
  — through the identical `read*Mode` functions `checkpoint.ts` reads, so a later addition tracks
  CLAUDE.md's defaults automatically.
- **One game at a time, one process.** A second `new_game` call while one is in progress is refused.
  Multiple concurrent games would need one `GameSession` (and one referee/swapper) per game, per the
  finding above.
- **Process-exit cleanup covers SIGINT/SIGTERM only**, not a hard kill or a crash — the same gap
  `checkpoint.ts`'s own `finally` block would have under either, restoring a resident model
  (`PRISONER_OLLAMA_RESIDENT_MODELS`, e.g. Shep's `muse-glimmer:30b`) only on a clean shutdown.

## Connecting a client

Start the server from this repository, pointed at a real model endpoint exactly as `npm run
checkpoint` would be (CLAUDE.md's "Local play is all-Muse" applies here too — do not point
`PRISONER_MODEL_URL` at doris while a batch or another tenant needs the card):

```bash
PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
  npm run mcp-seat
```

### Claude Code

```bash
claude mcp add the-prisoner -- npm run --prefix /absolute/path/to/the-prisoner mcp-seat
```

Add environment variables with repeated `-e`/`--env` flags (exact flag names depend on your Claude
Code version — check `claude mcp add --help`), for example:

```bash
claude mcp add the-prisoner \
  -e PRISONER_MODEL_URL=http://doris:11434/v1 \
  -e PRISONER_OLLAMA_RESIDENT_MODELS=muse-glimmer:30b \
  -- npm run --prefix /absolute/path/to/the-prisoner mcp-seat
```

### Claude Desktop

Add an entry to `claude_desktop_config.json`'s `mcpServers`, pointing directly at the CLI script so
no working directory needs to be inferred:

```json
{
  "mcpServers": {
    "the-prisoner": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/the-prisoner/src/tools/mcpSeatCli.ts"],
      "env": {
        "PRISONER_MODEL_URL": "http://doris:11434/v1",
        "PRISONER_OLLAMA_RESIDENT_MODELS": "muse-glimmer:30b"
      }
    }
  }
}
```

Once connected, ask the assistant to call `new_game` with your chosen side, then `my_briefing`, and
play a turn at a time through `attempt` — reminding it, if needed, that `intent` must be your own
words, not its guess at what you would try.
