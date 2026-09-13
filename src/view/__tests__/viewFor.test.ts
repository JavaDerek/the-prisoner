import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildWorld, type World } from "../../world/setup.js";
import { buildResolver } from "../../world/mechanics.js";
import { PRISONER_VOCABULARY } from "../../world/vocabulary.js";
import { viewFor } from "../viewFor.js";
import type { Resolver } from "run-dmcp";

describe("viewFor() -- each principal's view, built positively (design §5.1)", () => {
  let world: World;
  let resolver: Resolver;

  function fresh(): void {
    createTestDb();
    world = buildWorld();
    resolver = buildResolver(world);
  }

  afterEach(() => {
    destroyTestDb();
  });

  it("both principals see the bar as intact and the loose tile in plain view, at t0, and EXACTLY those two nouns", () => {
    fresh();
    const t0 = world.clock.t0;

    for (const characterId of [world.wardenId, world.prisonerId]) {
      const view = viewFor(world, characterId, t0);
      // Exact, not merely inclusive: schema.ts's migration adds BOTH `cut`
      // and `concealed` as plain columns on run-dmcp's `items` table, so
      // EVERY item (including the prisoner's own spoon) carries both facts,
      // defaulting to 0. A regression here previously rendered a bogus
      // "intact bar" noun for the loose tile's own irrelevant `cut=0` and a
      // bogus "in plain view loose tile" for the bar's own irrelevant
      // `concealed=0` (and a third bogus pair for the spoon in the
      // prisoner's own view) -- caught by running the real checkpoint
      // script and reading its transcript by eye. `arrayContaining` alone
      // would never have caught it, so this test checks the exact set.
      expect(view.nouns).toHaveLength(2);
      expect(view.nouns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ entityId: world.barId, key: "cut", phrase: "intact bar" }),
          expect.objectContaining({ entityId: world.looseTileId, key: "concealed", phrase: "in plain view loose tile" }),
        ])
      );
    }
  });

  it("the prisoner's own spoon contributes no bogus cut/concealed noun, even though the column exists on every item", () => {
    fresh();
    const view = viewFor(world, world.prisonerId, world.clock.t0);
    expect(view.nouns.some((n) => n.entityId === world.spoonId)).toBe(false);
  });

  it("a concealed item is absent from view once CONCEAL resolves", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });

    const wardenView = viewFor(world, world.wardenId, t);
    expect(wardenView.nouns.some((n) => n.entityId === world.looseTileId)).toBe(false);
  });

  it("an unconcealed item stays visible after an unrelated resolution", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "WAIT" });

    const view = viewFor(world, world.wardenId, t);
    expect(view.nouns.some((n) => n.entityId === world.looseTileId)).toBe(true);
  });

  it("each principal sees their own resource and the cell's shared resources, never the other principal's own", () => {
    fresh();
    const t0 = world.clock.t0;

    const prisonerView = viewFor(world, world.prisonerId, t0);
    expect(prisonerView.resources).toHaveProperty("spoon_edge");
    expect(prisonerView.resources).toHaveProperty("bar_integrity");
    expect(prisonerView.resources).toHaveProperty("lock_integrity");
    expect(prisonerView.resources).toHaveProperty("guard_attention");
    expect(prisonerView.resources).not.toHaveProperty("warden_suspicion");

    const wardenView = viewFor(world, world.wardenId, t0);
    expect(wardenView.resources).toHaveProperty("warden_suspicion");
    expect(wardenView.resources).not.toHaveProperty("spoon_edge");
  });

  it("names the other principal by presence only -- no vocabulary noun is ever produced for a character entity", () => {
    fresh();
    const t0 = world.clock.t0;

    const prisonerView = viewFor(world, world.prisonerId, t0);
    expect(prisonerView.otherPrincipal).toMatchObject({ id: world.wardenId });
    expect(prisonerView.nouns.every((n) => n.entityId !== world.wardenId)).toBe(true);
  });

  it("throws for a characterId that is neither principal in this world", () => {
    fresh();
    expect(() => viewFor(world, "not-a-real-character", world.clock.t0)).toThrow();
  });

  it("the vocabulary names both values of every fact key the mechanics can write (cut, concealed) -- the richness contract, scoped to this repository's own writable keys", () => {
    expect(Object.keys(PRISONER_VOCABULARY.cut)).toEqual(expect.arrayContaining(["0", "1"]));
    expect(Object.keys(PRISONER_VOCABULARY.concealed)).toEqual(expect.arrayContaining(["0", "1"]));
  });
});
