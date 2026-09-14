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

  it("both principals see the bar as intact, at t0", () => {
    fresh();
    const t0 = world.clock.t0;
    for (const characterId of [world.wardenId, world.prisonerId]) {
      const view = viewFor(world, characterId, t0);
      const cutNoun = view.nouns.find((n) => n.key === "cut");
      expect(cutNoun).toMatchObject({ entityId: world.barId, phrase: "intact bar" });
    }
  });

  it("the prisoner sees their own spoon as visible (not concealed), and EXACTLY those two vocabulary nouns", () => {
    fresh();
    const t0 = world.clock.t0;
    // Exact, not merely inclusive: schema.ts's migration adds BOTH `cut` and
    // `concealed` as plain columns on run-dmcp's `items` table, so EVERY
    // item carries both facts, defaulting to 0. A regression here
    // previously rendered a bogus "intact bar" noun for an irrelevant
    // `cut=0` on the wrong entity -- caught by reading a real transcript.
    // `relevantFactKeysFor` (viewFor.ts) is the fix: only the bar's own
    // `cut` and the SPOON's own `concealed` (design revision: CONCEAL now
    // hides the spoon, not the loose tile) are ever rendered.
    const view = viewFor(world, world.prisonerId, t0);
    const vocabularyNouns = view.nouns.filter((n) => n.key === "cut" || n.key === "concealed");
    expect(vocabularyNouns).toHaveLength(2);
    expect(vocabularyNouns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: world.barId, key: "cut", phrase: "intact bar" }),
        expect.objectContaining({ entityId: world.spoonId, key: "concealed", phrase: "visible spoon" }),
      ])
    );
  });

  it("the warden never sees a concealed vocabulary noun for the spoon -- it is the prisoner's own item, never selected", () => {
    fresh();
    const view = viewFor(world, world.wardenId, world.clock.t0);
    expect(view.nouns.some((n) => n.key === "concealed")).toBe(false);
  });

  it("once CONCEAL resolves, the prisoner's own view still shows the spoon, now with the concealed adjective (own items are always selected, concealed or not)", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });

    const view = viewFor(world, world.prisonerId, t);
    const spoonNoun = view.nouns.find((n) => n.entityId === world.spoonId && n.key === "concealed");
    expect(spoonNoun?.phrase).toBe("concealed spoon");
  });

  it("item 6: the prisoner's own spoon appears as a noun in its own view -- the positive view selects its own items", () => {
    fresh();
    const view = viewFor(world, world.prisonerId, world.clock.t0);
    const spoonNoun = view.nouns.find((n) => n.entityId === world.spoonId);
    expect(spoonNoun).toBeDefined();
    expect(spoonNoun?.phrase.toLowerCase()).toContain("spoon");
  });

  it("the spoon is never in the WARDEN's view -- it is the prisoner's own item, not the cell's", () => {
    fresh();
    const view = viewFor(world, world.wardenId, world.clock.t0);
    expect(view.nouns.some((n) => n.entityId === world.spoonId)).toBe(false);
  });

  it("the loose tile stays visible in either view regardless of CONCEAL -- it is never itself the concealed entity", () => {
    fresh();
    const t = world.clock.prisonerT(1);
    resolver.resolve({ gameId: world.gameId, mechanic: "CONCEAL" });

    const wardenView = viewFor(world, world.wardenId, t);
    expect(wardenView.nouns.some((n) => n.entityId === world.looseTileId)).toBe(true);
  });

  it("REVISION (belief, not truth, in briefings): a principal's view exposes ONLY its own resource -- the shared cell resources are no longer read as live truth here", () => {
    fresh();
    const t0 = world.clock.t0;

    const prisonerView = viewFor(world, world.prisonerId, t0);
    expect(prisonerView.resources).toHaveProperty("spoon_edge");
    expect(prisonerView.resources).not.toHaveProperty("bar_integrity");
    expect(prisonerView.resources).not.toHaveProperty("lock_integrity");
    expect(prisonerView.resources).not.toHaveProperty("guard_attention");
    expect(prisonerView.resources).not.toHaveProperty("warden_suspicion");

    const wardenView = viewFor(world, world.wardenId, t0);
    expect(wardenView.resources).toHaveProperty("warden_suspicion");
    expect(wardenView.resources).not.toHaveProperty("spoon_edge");
    expect(wardenView.resources).not.toHaveProperty("bar_integrity");
    expect(wardenView.resources).not.toHaveProperty("lock_integrity");
    expect(wardenView.resources).not.toHaveProperty("guard_attention");
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
