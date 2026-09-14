import type { SchemaMigration } from "run-dmcp";

/**
 * This repository's own tables and columns, brought up through run-dmcp's
 * `initializeSchema({ migrations })` hook (design §4.4, §A) so they live in
 * the same database, under the same startup rules, as the engine's own
 * tables -- never a second `schema.ts`.
 *
 * `up()` MUST be idempotent: it runs on every startup (root CLAUDE.md's
 * neighbours all follow this, and run-dmcp's own migrations do too --
 * `try { ALTER TABLE ... } catch {}` for a column, `CREATE TABLE IF NOT
 * EXISTS` for a table).
 *
 * Two kinds of change here:
 *
 *   1. Two plain columns added to run-dmcp's own `items` table --
 *      `cut` and `concealed`. Both are projected automatically the moment
 *      they exist (run-dmcp's `installProjectionTriggers()` reads a
 *      table's live columns fresh from `pragma_table_info` on every
 *      startup, after every migration -- including this one -- has run;
 *      see run-dmcp's CLAUDE.md, "the timeline writes itself"). Both
 *      default to 0 (not cut / not concealed) so every item has a defined,
 *      positive value from the moment it is created -- "the bar is intact",
 *      "the loose tile lies flush" -- rather than an absent fact.
 *
 *      This is a deliberate departure from Appendix A.3's "a character that
 *      does not know has no fact" pattern for the *knowledge* facts
 *      (`knows_<key>`): those are NOT modelled as columns here at all. See
 *      `src/world/mechanics.ts`'s header comment for why, and the
 *      project's final report for the engine finding this uncovered:
 *      `writeConstrainedValue` (the only write path a mechanic's returned
 *      `IntendedChange` can reach, per hard rule 7) refuses to write a
 *      value onto a column that currently reads SQL NULL
 *      (`constrained.ts`'s `readLiveValue`), so a fact that must start
 *      *absent* can never receive its first value through `resolve()`.
 *      `cut`/`concealed` sidestep that because a defined false state
 *      ("intact", "in plain view") is exactly as truthful and exactly as
 *      positive as a defined true one -- there is no absence to render.
 *
 *   2. Two new tables, `plans` and `plan_steps` -- the attempt ledger
 *      (design §4.4, P3). Plan memory is this repository's, not the
 *      engine's and not the seam's (design §4.2-§4.3): it is not world
 *      truth, the engine has no principal model to scope it to, and its
 *      shape (sequence, per-step status, evidence per failure) is this
 *      game's alone. `evidence` holds the engine's own `Contradiction[]`
 *      or `ConstraintViolationError` fields, JSON-encoded, verbatim -- never
 *      redeclared, per root CLAUDE.md's 2026-09-05 lesson on mirrored
 *      constants (there is nothing to mirror here: the shape is stored as
 *      opaque JSON this repository already has typed at the call site).
 */
export const prisonerMigration: SchemaMigration = {
  name: "the-prisoner:cell-and-ledger",
  up(db) {
    try {
      db.exec(`ALTER TABLE items ADD COLUMN cut INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Column already exists.
    }
    try {
      db.exec(`ALTER TABLE items ADD COLUMN concealed INTEGER NOT NULL DEFAULT 0`);
    } catch {
      // Column already exists.
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        created_t INTEGER NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS plan_steps (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        move TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'active', 'done', 'failed', 'abandoned')),
        evidence TEXT,
        attempted_at_t INTEGER,
        expects TEXT,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
      )
    `);
    try {
      db.exec(`ALTER TABLE plan_steps ADD COLUMN expects TEXT`);
    } catch {
      // Column already exists.
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        step_id TEXT,
        game_id TEXT NOT NULL,
        move TEXT NOT NULL,
        on_plan INTEGER NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('done', 'active', 'failed')),
        evidence TEXT,
        opened_by_event_id TEXT,
        at_t INTEGER NOT NULL,
        round_n INTEGER,
        note TEXT,
        FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE,
        FOREIGN KEY (step_id) REFERENCES plan_steps(id) ON DELETE SET NULL
      )
    `);
    // round_n (item 8: ledger labels show round numbers 1-5, consistent
    // with the transcript, not the half-round clock t) and note (item 4:
    // an info move's own authored revelation, positive prose, verbatim).
    try {
      db.exec(`ALTER TABLE attempts ADD COLUMN round_n INTEGER`);
    } catch {
      // Column already exists.
    }
    try {
      db.exec(`ALTER TABLE attempts ADD COLUMN note TEXT`);
    } catch {
      // Column already exists.
    }

    // This repository's own round log -- never the engine's. Logged once
    // per SUCCESSFUL resolution by either principal, keyed on the half-round
    // `t` it landed at. `ledger.ts`'s `causeAtT` reads this to resolve
    // "which move caused this fact" for a contradiction's hop, because the
    // hop itself only ever names a low-level projection event, never a
    // `resolution.recorded` event (this project's correction 2; see
    // ledger.ts's header comment).
    db.exec(`
      CREATE TABLE IF NOT EXISTS round_log (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        t INTEGER NOT NULL,
        round_n INTEGER NOT NULL,
        principal TEXT NOT NULL CHECK (principal IN ('warden', 'prisoner')),
        mechanic TEXT NOT NULL,
        description TEXT,
        line TEXT,
        seen_by_other_as TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      )
    `);
    // line and seen_by_other_as (item 5: the two sides perceive each
    // other) -- the acting principal's own spoken line, and an authored,
    // positive "what this looked like from outside" sentence, NULL for a
    // covert mechanic (see world/mechanics.ts's SEEN_BY_OTHER_AS).
    try {
      db.exec(`ALTER TABLE round_log ADD COLUMN line TEXT`);
    } catch {
      // Column already exists.
    }
    try {
      db.exec(`ALTER TABLE round_log ADD COLUMN seen_by_other_as TEXT`);
    } catch {
      // Column already exists.
    }
  },
};
