<!-- Filed as brink-workshop #106 on 2026-09-13, replacing #105 (closed). Kept here as the record. -->
title: Migrate the rival-mind seam onto the published mind-seam package (exact pin, four green commits)

Replaces #105, which said the rival-mind seam stays here and only a paragraph changes. The owner decided
otherwise: the seam is extracted into a published, zero-dependency package (`mind-seam`), brink migrates
onto it, and a second game becomes its second consumer. Design: `~/rpg/the-prisoner/docs/DESIGN.md` §2,
§3, §8, §9.

**Depends on `mind-seam@0.1.0` being on npm.** Never `npm link`, never `file:`; pin exactly, no caret.
Nothing here bumps `run-dmcp`.

## What moves out, what stays

| file | after |
|---|---|
| `src/rivals/mind.ts` | shrinks: `RivalContext`/`RivalProposal` as type aliases over the package's `Inert`/`Proposal`; `RivalMind = Mind<RivalContext, RivalProposal>`; `SILENT_MIND` and `scriptedRivalMind` re-exported from the package so no test changes |
| `src/gm/local/rivalMind.ts` | shrinks: keeps `buildRivalPrompt` (capital names, archetype sketch — content), `coerceRivalProposal` (over the package's `coerceProposal`), the three constants, and `createLocalRivalMind(options)` with its exact current signature, now `createLocalMind({ prompt, coerce, onSilence: log.warn, ...options })`; deletes its own `fetch`, `safeParse` and the null-on-failure `try/catch` — that is the wire, and it is the package's |
| `wake.ts`, `seatAgent.ts`, `archetypes.ts`, `turn.ts` | stay — brink's input, brink's table, content, brink's orchestration |
| `cli.ts`, `playSession.ts`, `systemPrompt.ts`, `gm/local/openAiChat.ts` | unchanged as files. `openAiChat.ts` is the GM's wire (#97) **and today also the rival's transport** — `rivalMind.ts:41` imports its `sendChatCompletion`. After M3 the rival stops importing it; `backend.ts` stays its caller |

## Four commits, each green

- **M1** — `npm install --save-exact mind-seam@0.1.0`. Add `src/rivals/__tests__/seamConformance.test.ts` running the package's `seamConformance()` against a brink harness (fields `["archetype","backstory","briefing","seatId"]`; `pass` = seed board, RUSSIA/CHINA agent-controlled, `runRivalTurnPass` with a reading engaging RUSSIA; snapshot = prestige × 3, DEFCON, four alignments; `privateAct` = a seat-scoped fact `buildBriefing` **renders as text**, scoped to CHINA for "withheld" and to RUSSIA for "shown" (not a secret — `briefing.ts` reads no secrets, so a secret fails check 4's positive control; if no string-rendered seat-scoped fact exists, declare `privateAct: { unsupported: "..." }` and file that as a brink finding, together with `turn.test.ts`'s #37 fog test having no positive control); `wire.create` = `createLocalRivalMind`; no `actionableProposal`). **Red first:** write the harness before converting `RivalContext`/`RivalProposal` from `interface` to `type` — `npm run typecheck` fails because an interface has no implicit index signature and is not assignable to `InertRecord`. Convert; green. All six checks pass on the first green run, which is the point.
- **M2** — `mind.ts` re-declares over the package. **Red first:** a test that `SILENT_MIND` from `./mind.js` `toBe` the package's.
- **M3** — `rivalMind.ts` on `createLocalMind`. Stops importing `./openAiChat.js`; deletes `safeParse`. **Red first:** a syntactic scan asserting the module does not import `./openAiChat.js` and contains no `JSON.parse(` — red today on both. (Not a `fetch(` scan: the file has no `fetch` of its own, so that test would be green before the change.) `rivalMind.test.ts` is unchanged and still asserts `tools: []`, `stream: false`, no `Authorization`, null on every failure, temperature > 0.
- **M4** — docs: `CLAUDE.md`'s `rivals/` line and the pin gotcha; `docs/RUN-DMCP.md` if it lists dependencies.

## Why #37 and #97 cannot regress

Every test that proves #37 — the fog tests and the "cannot write state" snapshots in `turn.test.ts`, `rivalMindsWiring.test.ts`, `rivalTurnPass.test.ts`, `rivalMindsSection.test.ts` — runs unchanged at every commit, and the conformance suite adds a sharper fog check on top. Nothing on #97's path (`backend.ts`, `openAiChat.ts`, `toolSurface.ts`, `enforcedResource.test.ts`) is in the diff.
