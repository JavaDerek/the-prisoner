title: The mind on the local box — createPrisonerMind over the package's wire, choice by membership, silence that will become loud

## Scope

DESIGN §7.3–§7.5. `createPrisonerMind({ baseUrl, model, temperature?, timeoutMs?, fetchFn?,
onSilence? })` = the package's `createLocalMind` with this game's two pure functions:

- `buildPrisonerPrompt(context)` — identity, motive, briefing, and the `moves` list as the closed
  set to answer from; asks for `{ intent, line?, choice? }`; forbids deciding an outcome. Exported
  so a test reads it with no server.
- `coercePrisonerProposal(raw, context)` — the package's `coerceProposal` for `intent`/`line`, then
  `choice` kept only if it is a member of `context.moves` by literal equality; otherwise `null`
  (a proposal that names a move we did not offer is a broken answer, not a quiet prisoner).

The base URL comes from this repository's own environment variable, by a name that resolves from
anywhere you play; never a raw LAN address, never in the tree. `onSilence` feeds P6's counter.

## Tests first, all offline with an injected fetch

- Conformance check 5 goes green in this commit: `tools: []`, `stream: false`, no `Authorization`,
  every failure `null`.
- `choice ∉ moves` → `null` and `onSilence("rejected")`; `choice` absent → a proposal with no
  choice (the loop treats it as `WAIT`-less silence — P6 decides); `choice ∈ moves` → kept.
- The prompt contains the briefing, identity, motive and every move, and nothing else from the
  process (no game id, no path, no other principal's anything) — asserted on the string.
- The wire's own behaviours are **not** re-tested here beyond check 5; they are the package's.
