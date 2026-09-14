// Notes to self, persisted (this task's brief, item 2): each principal's
// latest "what I want to remember next turn" note, stored one row per
// (game, principal) -- upserted, never accumulated, exactly like
// `beliefs.ts`'s own store. Capped at `MAX_STORED_NOTES_LENGTH` (400) by
// truncation on write; code here never interprets what the string says.
import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { getNotes, setNotes, MAX_STORED_NOTES_LENGTH } from "../notes.js";

describe("principal notes -- latest only, per (game, principal), capped by truncation", () => {
  let world: World;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("a principal with no notes yet has none", () => {
    fresh();
    expect(getNotes(world.gameId, "prisoner")).toBeNull();
  });

  it("setNotes then getNotes round-trips the exact string", () => {
    fresh();
    setNotes(world.gameId, "prisoner", "two more shims, then escape while guard attention is low", 3);
    expect(getNotes(world.gameId, "prisoner")).toBe("two more shims, then escape while guard attention is low");
  });

  it("a later write REPLACES the earlier one -- latest only, never accumulated", () => {
    fresh();
    setNotes(world.gameId, "prisoner", "first note", 1);
    setNotes(world.gameId, "prisoner", "second note", 2);
    expect(getNotes(world.gameId, "prisoner")).toBe("second note");
    expect(getNotes(world.gameId, "prisoner")).not.toContain("first note");
  });

  it("the warden's and the prisoner's notes are independent rows", () => {
    fresh();
    setNotes(world.gameId, "prisoner", "prisoner's own note", 1);
    setNotes(world.gameId, "warden", "warden's own note", 1);
    expect(getNotes(world.gameId, "prisoner")).toBe("prisoner's own note");
    expect(getNotes(world.gameId, "warden")).toBe("warden's own note");
  });

  it("a note longer than 400 characters is truncated on write, never rejected", () => {
    fresh();
    const long = "x".repeat(500);
    setNotes(world.gameId, "warden", long, 1);
    const stored = getNotes(world.gameId, "warden");
    expect(stored).not.toBeNull();
    expect(stored?.length).toBe(MAX_STORED_NOTES_LENGTH);
    expect(stored).toBe("x".repeat(MAX_STORED_NOTES_LENGTH));
  });

  it("a note at exactly the cap is stored whole", () => {
    fresh();
    const exact = "y".repeat(MAX_STORED_NOTES_LENGTH);
    setNotes(world.gameId, "warden", exact, 1);
    expect(getNotes(world.gameId, "warden")).toBe(exact);
  });
});
