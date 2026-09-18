import { describe, it, expect, afterEach } from "vitest";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect } from "../effects.js";
import { computePerceivedObjects, buildOpenBriefing, buildOpenContext, readPresenceMode } from "../briefing.js";
import { OPEN_OBJECTS } from "../scenarioObjects.js";
import { setNotes } from "../../ledger/notes.js";
import { seedInitialBeliefs } from "../../ledger/beliefs.js";

describe("open-mode perception and briefing", () => {
  afterEach(() => destroyTestDb());

  it("both principals perceive every object when nothing is concealed", () => {
    createTestDb();
    const world = buildOpenWorld();
    const prisonerView = computePerceivedObjects(world, "prisoner", world.base.clock.t0);
    const wardenView = computePerceivedObjects(world, "warden", world.base.clock.t0);
    expect(prisonerView.map((o) => o.id).sort()).toEqual(wardenView.map((o) => o.id).sort());
    expect(prisonerView.some((o) => o.id === "spoon")).toBe(true);
  });

  // OPEN-VARIANT.md §33.8 (owner's decision): a way out that stands open says so
  // in the words every principal perceives it by -- which are also the words the
  // referee reads it by -- and a shut one reads exactly as authored.
  it("a way out standing open reads so in its description, for both principals; a shut one reads as authored (§33.8)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const authored = (id: string) => OPEN_OBJECTS.find((o) => o.id === id)?.description;
    const described = (principal: "prisoner" | "warden", id: string, t: number) =>
      computePerceivedObjects(world, principal, t).find((o) => o.id === id)?.description;

    expect(described("prisoner", "window", world.base.clock.t0)).toBe(authored("window"));
    expect(described("warden", "door", world.base.clock.t0)).toBe(authored("door"));

    const resolver = buildOpenResolver();
    for (const wayOut of ["window", "door"]) {
      const resourceId = resourceIdForProperty(world, wayOut, "passage") as string;
      resolver.resolve({ gameId: world.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId, amount: 1, min: 0, max: 1, description: "x" } });
    }
    const t = world.base.clock.wardenT(1);
    for (const principal of ["prisoner", "warden"] as const) {
      expect(described(principal, "window", t)).toBe(`${authored("window")} It stands open now: the bar is out of its widest gap.`);
      expect(described(principal, "door", t)).toBe(`${authored("door")} It stands open now.`);
      expect(described(principal, "bar", t)).toBe(authored("bar"));
    }
  });

  // OPEN-VARIANT.md §33.9 (owner's decision): nothing in the open variant reads
  // guard attention -- escape is leaving (§12) -- yet batch E's minds planned
  // around it 67 times. A number that decides nothing is not shown.
  it("neither principal's briefing mentions guard attention (§33.9)", () => {
    createTestDb();
    const world = buildOpenWorld();
    seedInitialBeliefs(world.base); // as runOpenGame does: both hold a guard_attention belief from round 0
    for (const principal of ["prisoner", "warden"] as const) {
      const briefing = buildOpenBriefing(world, principal, world.base.clock.t0, 1, 30);
      expect(briefing).toMatch(/bar integrity: 100/); // positive control: belief lines do render
      expect(briefing).not.toMatch(/guard[ _]attention/i);
    }
  });

  it("concealing the spoon hides it from the warden but not from the prisoner (its own owner)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const resolver = buildOpenResolver();
    const concealmentId = resourceIdForProperty(world, "spoon", "concealment") as string;

    resolver.resolve({
      gameId: world.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: concealmentId, amount: 100, min: 0, max: 100, description: "hidden" },
    });

    const t = world.base.clock.wardenT(1);
    const wardenView = computePerceivedObjects(world, "warden", t);
    const prisonerView = computePerceivedObjects(world, "prisoner", t);
    expect(wardenView.some((o) => o.id === "spoon")).toBe(false);
    expect(prisonerView.some((o) => o.id === "spoon")).toBe(true);
  });

  it("a principal's own persisted notes render into ITS OWN briefing, never the other's", () => {
    createTestDb();
    const world = buildOpenWorld();
    setNotes(world.base.gameId, "prisoner", "SECRET_PRISONER_PLAN_MARKER", 1);

    const prisonerBriefing = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 1);
    const wardenBriefing = buildOpenBriefing(world, "warden", world.base.clock.t0, 1);
    expect(prisonerBriefing).toContain("SECRET_PRISONER_PLAN_MARKER");
    expect(wardenBriefing).not.toContain("SECRET_PRISONER_PLAN_MARKER");
  });

  it("buildOpenContext assembles principalId/identity/motive/briefing/perceivedObjects", () => {
    createTestDb();
    const world = buildOpenWorld();
    const context = buildOpenContext(world, "prisoner", world.base.clock.t0, 1);
    expect(context.principalId).toBe(world.base.prisonerId);
    expect(context.identity).toContain("Voss");
    expect(context.perceivedObjects.length).toBeGreaterThan(0);
  });

  // Issue #15: `briefing.ts` used to render "You perceive the <id>: <description>"
  // for every perceived object, and `mind.ts`'s `objectLines` (inside
  // `renderSeatSituation`) rendered the SAME array as "- <id>: <description>"
  // right below it -- the same sentence, twice, in front of every decision.
  // The briefing keeps everything that is NOT a plain description repeat
  // (news, beliefs, notes, the plan) and drops only the per-object loop;
  // `perceivedObjects` -- the same array `renderSeatSituation` renders from
  // -- is still the one source of truth for what this principal can act on.
  it("the briefing does not itself list each object's description -- that is renderSeatSituation's job, once (issue #15)", () => {
    createTestDb();
    const world = buildOpenWorld();
    const briefing = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 1);
    expect(briefing).not.toMatch(/You perceive the/);
    // Everything else buildOpenBriefing has always said stays said.
    expect(briefing).toMatch(/^Round 1 of \d+\.$/m);
    // The information itself is not lost -- it is still the array the mind
    // and the human seat render from.
    const perceived = computePerceivedObjects(world, "prisoner", world.base.clock.t0);
    expect(perceived.length).toBeGreaterThan(0);
    expect(perceived.some((o) => o.id === "spoon")).toBe(true);
  });

  // OPEN-VARIANT.md §55 (issue #22 gap 1/2): `PRISONER_PRESENCE=modelled`,
  // default `off`, byte-identical to today.
  describe("presence (§55, PRISONER_PRESENCE, issue #22)", () => {
    it("readPresenceMode: off by default, modelled when asked, rejects anything else", () => {
      expect(readPresenceMode(undefined)).toBe("off");
      expect(readPresenceMode("")).toBe("off");
      expect(readPresenceMode("modelled")).toBe("modelled");
      expect(() => readPresenceMode("elsewhere")).toThrow(/PRISONER_PRESENCE/);
    });

    it("off (the default, and with no argument at all): computePerceivedObjects never includes the other principal, exactly as before this gap existed", () => {
      createTestDb();
      const world = buildOpenWorld();
      const t0 = world.base.clock.t0;
      expect(computePerceivedObjects(world, "prisoner", t0).some((o) => o.id === "warden")).toBe(false);
      expect(computePerceivedObjects(world, "prisoner", t0, "off")).toEqual(computePerceivedObjects(world, "prisoner", t0));
    });

    it("modelled: each principal perceives the OTHER principal, cited from an authored description, while they share the cell", () => {
      createTestDb();
      const world = buildOpenWorld();
      const t0 = world.base.clock.t0;
      const prisonerView = computePerceivedObjects(world, "prisoner", t0, "modelled");
      const wardenView = computePerceivedObjects(world, "warden", t0, "modelled");
      const warden = prisonerView.find((o) => o.id === "warden");
      const prisoner = wardenView.find((o) => o.id === "prisoner");
      expect(warden?.description).toBeTruthy();
      expect(prisoner?.description).toBeTruthy();
      // Never itself: a principal is not its own target.
      expect(prisonerView.some((o) => o.id === "prisoner")).toBe(false);
      expect(wardenView.some((o) => o.id === "warden")).toBe(false);
    });

    it("modelled: once the warden leaves through the door, the prisoner no longer perceives her, or her key ring, which travels with her -- and she still perceives the (cell-fixed) bar", () => {
      createTestDb();
      const world = buildOpenWorld();
      const resolver = buildOpenResolver();
      const open = planEffect({
        targetObjectId: "door",
        effectKind: "open",
        property: "passage",
        magnitude: "moderate",
        entityIdFor: world.entityIdFor,
        resourceIdFor: world.resourceIdFor,
        exits: world.exits,
        description: "opens the door",
      });
      if (!open) throw new Error("no plan");
      resolver.resolve({ gameId: world.base.gameId, mechanic: open.mechanic, parameters: open.parameters });
      const leave = planEffect({
        targetObjectId: "door",
        effectKind: "leave",
        property: "none",
        magnitude: "slight",
        entityIdFor: world.entityIdFor,
        resourceIdFor: world.resourceIdFor,
        exits: world.exits,
        actorId: world.base.wardenId,
        description: "leaves through the door",
      });
      if (!leave) throw new Error("no plan");
      resolver.resolve({ gameId: world.base.gameId, mechanic: leave.mechanic, parameters: leave.parameters });

      const t = world.base.clock.wardenT(2);
      const prisonerView = computePerceivedObjects(world, "prisoner", t, "modelled");
      expect(prisonerView.some((o) => o.id === "warden")).toBe(false);
      expect(prisonerView.some((o) => o.id === "key_ring")).toBe(false);
      expect(prisonerView.some((o) => o.id === "bar")).toBe(true);

      // The warden, from the corridor, no longer perceives the prisoner or
      // the (cell-fixed) bar -- but still perceives her own key ring, which
      // travels with her.
      const wardenView = computePerceivedObjects(world, "warden", t, "modelled");
      expect(wardenView.some((o) => o.id === "prisoner")).toBe(false);
      expect(wardenView.some((o) => o.id === "bar")).toBe(false);
      expect(wardenView.some((o) => o.id === "key_ring")).toBe(true);
    });

    it("modelled: the briefing states presence as a rule both know; off says nothing about it", () => {
      createTestDb();
      const world = buildOpenWorld();
      const off = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 1);
      expect(off).not.toMatch(/here with you|not here/i);

      const on = buildOpenBriefing(world, "prisoner", world.base.clock.t0, 1, 12, {}, "modelled");
      expect(on).toMatch(/here with you/i);
    });

    it("buildOpenContext threads presence through to both the briefing text and perceivedObjects", () => {
      createTestDb();
      const world = buildOpenWorld();
      const context = buildOpenContext(world, "prisoner", world.base.clock.t0, 1, 12, {}, "modelled");
      expect(context.briefing).toMatch(/here with you/i);
      expect(context.perceivedObjects.some((o) => o.id === "warden")).toBe(true);
    });
  });
});
