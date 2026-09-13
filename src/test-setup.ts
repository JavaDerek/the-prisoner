// Process-wide: never touch a real database, in any test. Mirrors
// brink-workshop's own test setup and this repository's CLAUDE.md.
//
// Set before any test imports run-dmcp's db/connection module, which
// resolves DMCP_DB_PATH lazily on first `getDatabase()` call -- so it is
// safe to set here even though vitest's setupFiles run once per worker
// rather than once per test file.
process.env.DMCP_DB_PATH = ":memory:";
