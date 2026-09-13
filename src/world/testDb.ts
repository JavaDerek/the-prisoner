import type Database from "better-sqlite3";
import { closeDatabase, getDatabase, initializeSchema } from "run-dmcp";
import { prisonerMigration } from "./schema.js";

/**
 * Test fixture mirroring run-dmcp's own `src/db/__tests__/testDb.ts` (not
 * exported from the published package, so reimplemented here against the
 * public API): a clean, fully migrated, isolated in-memory database per
 * test, including this repository's own migration.
 *
 * `getDatabase()` caches one connection at module scope inside run-dmcp;
 * without resetting it between tests, every test in one process would share
 * a single in-memory database and bleed state into each other. `afterEach`
 * must call `destroyTestDb()`, not only the next test's `createTestDb()`, so
 * a failed or skipped test never leaks its connection forward.
 *
 * `src/test-setup.ts` sets `DMCP_DB_PATH=:memory:` process-wide as the
 * outer safety net (this repository's CLAUDE.md); this fixture re-asserts
 * it so a test file that imports it directly, without vitest's global
 * setup, is equally safe.
 */
export function createTestDb(): Database.Database {
  process.env.DMCP_DB_PATH = ":memory:";
  const db = getDatabase();
  initializeSchema({ migrations: [prisonerMigration] });
  return db;
}

export function destroyTestDb(): void {
  closeDatabase();
}
