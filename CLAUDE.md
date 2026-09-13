# The Prisoner — Claude Context

## What this is

A model-driven prisoner and a model-driven warden play a two-principal, one-room, physical game
through `run-dmcp`'s resolve protocol — the resolve protocol's first production caller, and the
second consumer of the extracted `mind-seam` rival-mind seam. `docs/DESIGN.md` is the authority;
section numbers in comments here refer to it. Draft issues for each landing-order step are in
`docs/issues/`.

## TypeScript only

Depends on the published `run-dmcp` and the published `mind-seam`, each at an **exact pin** (no
caret) — never linked, never `file:`. Import `run-dmcp` and `run-dmcp/rpg` (mechanism), never
`run-dmcp/server` or `run-dmcp/rpg/server` (assembly). `~/rpg` is not a monorepo (root `CLAUDE.md`):
nothing here is wired into `run-dmcp`, `mind-seam`, or `brink-workshop` by anything but a version
number in `package.json`.

## TDD is mandatory

Write the failing test first, confirm it fails for the right reason, then implement. The
conformance harness (once `mind-seam` is published) exists before any mind or world does, red with
"not implemented"; a guard is validated by planting a violation and watching it go red before it is
trusted.

## The mind cannot write

Not a rule to remember: `PrisonerContext`/`WardenContext` are `type` aliases over `mind-seam`'s
`InertRecord`, `assertInert` runs at the seam, and the loop's only write path is
`resolver.resolve()`. If you find yourself adding a field that could reach storage, `tsc` will
refuse it (`C extends InertRecord`), and if you cast past `tsc`, the conformance suite's check 2
will.

## Never pattern-match meaning

The warden's commands and the prisoner's `choice` are both closed sets; `choice` is validated by
literal membership in a list this repository wrote, inside this repository's own `coerce`. Free
text, if ever added, goes through the engine's turn reader (`createTurnReader`), cited against a
caller-declared answer set — never a regex, never a scan of generated prose for meaning.

## Never run against a real database

`DMCP_DB_PATH=:memory:` is set process-wide in `src/test-setup.ts`, exactly as brink-workshop's own
tests do. No test in this repository touches a file on disk. The one exception is `npm run
checkpoint` (Phase B), which uses a fresh scratch file under `/tmp` or `:memory:` — never a default
path — per root `CLAUDE.md`'s hard rule 2 for this whole workspace.

## Vocabulary

This repository's words — warden, prisoner, cell, bar, file, spoon, custody — are its own and must
never reach `run-dmcp` or `mind-seam`. An engine or seam issue filed from here describes the game
structurally ("two principals, one location, contended physical state"), never in this game's own
terms.

## Custody is out, for now

`run-dmcp`'s `IntendedChange` is numeric-only until engine issue E3 lands. SEARCH, CONFISCATE, and
any mechanic that would move an item's owner are out of scope. Do not move ownership outside
`resolver.resolve()` to work around this — that is a second write path, and the engine records
decisions, it does not make them anywhere but at that one choke point.
