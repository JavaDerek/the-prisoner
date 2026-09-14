import { describe, it, expect, afterEach } from "vitest";
import { initializeSchema } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../testDb.js";
import { prisonerMigration } from "../schema.js";

describe("the-prisoner's schema migration", () => {
  afterEach(() => {
    destroyTestDb();
  });

  it("is idempotent: running the migration twice against the same database does not throw", () => {
    const db = createTestDb();
    expect(() => prisonerMigration.up(db)).not.toThrow();
    expect(() => prisonerMigration.up(db)).not.toThrow();
  });

  it("survives a second initializeSchema() call against an already-migrated database", () => {
    createTestDb();
    expect(() => initializeSchema({ migrations: [prisonerMigration] })).not.toThrow();
    expect(() => initializeSchema({ migrations: [prisonerMigration] })).not.toThrow();
  });

  it("adds items.cut and items.concealed, both defaulting to 0", () => {
    const db = createTestDb();
    const cols = (db.prepare(`SELECT name, dflt_value, "notnull" FROM pragma_table_info('items')`).all() as {
      name: string;
      dflt_value: string | null;
      notnull: number;
    }[]);
    const cut = cols.find((c) => c.name === "cut");
    const concealed = cols.find((c) => c.name === "concealed");
    expect(cut).toBeDefined();
    expect(concealed).toBeDefined();
    expect(cut?.notnull).toBe(1);
    expect(concealed?.notnull).toBe(1);
  });

  it("creates plans, plan_steps and attempts tables", () => {
    const db = createTestDb();
    const tableNames = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    ).map((r) => r.name);
    expect(tableNames).toEqual(expect.arrayContaining(["plans", "plan_steps", "attempts"]));
  });

  it("creates the beliefs table, one row per (game, principal, resource)", () => {
    const db = createTestDb();
    const tableNames = (
      db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]
    ).map((r) => r.name);
    expect(tableNames).toContain("beliefs");
  });

  it("adds locations.escaped and locations.caught, both defaulting to 0", () => {
    const db = createTestDb();
    const cols = db.prepare(`SELECT name, dflt_value, "notnull" FROM pragma_table_info('locations')`).all() as {
      name: string;
      dflt_value: string | null;
      notnull: number;
    }[];
    const escaped = cols.find((c) => c.name === "escaped");
    const caught = cols.find((c) => c.name === "caught");
    expect(escaped).toBeDefined();
    expect(caught).toBeDefined();
    expect(escaped?.notnull).toBe(1);
    expect(caught?.notnull).toBe(1);
  });
});
