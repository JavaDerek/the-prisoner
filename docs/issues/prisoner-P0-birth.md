title: Repository birth — the context over mind-seam and the conformance harness, red, before any world or mind exists

## Deliverables

- `git init`; `CLAUDE.md` from `docs/DESIGN.md` Appendix B; CI on `lint`, `typecheck`, `test:run`,
  `build`. TypeScript, vitest, double quotes (match the neighbours).
- `run-dmcp` pinned **exactly** at the version that carries #30 (0.6.0) and `mind-seam` pinned
  **exactly** at 0.1.0. Never `npm link`, never `file:`. Import `run-dmcp` and `run-dmcp/rpg` only —
  never the `/server` entries.
- `src/test-setup.ts` sets `DMCP_DB_PATH=:memory:` process-wide, as brink's does.
- `src/mind/mind.ts`: `PrisonerContext`, `PrisonerProposal`, `PrisonerMind` as **type aliases**
  over the package's `Inert`/`Proposal`/`Mind` — DESIGN §A.5. Header states the property in this
  game's terms and cites the package.
- `src/mind/__tests__/seamConformance.test.ts`: the harness of DESIGN §9.3 with
  `fields = ["briefing","identity","motive","moves","principalId"]`, `loudProposal` carrying
  prose and **no `choice`**, `actionableProposal = { intent, choice: "FILE" }`, and `pass` throwing
  `new Error("not implemented: P1")`.

## Tests first, red before any of the above compiles

- Every conformance check fails with "not implemented: P1" — the right reason. (P1 makes checks 3
  and 6 green, P2 check 4, P5 check 5.)
- Check 1 goes green in this commit once `pass` is stubbed to return a context: the field list is
  declared and enumerated here, and a sixth field turns it red.
- A `// @ts-expect-error` test that a `PrisonerContext` with a `resolver` field does not satisfy
  `InertRecord`.
- Plant a violation — an accessor on the stub context — and watch check 2 go red before trusting it.
