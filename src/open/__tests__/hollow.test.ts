import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource, type ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee, type Referee } from "../referee.js";
import { runOpenHalfRound } from "../loop.js";
import { runOpenGame } from "../game.js";
import { buildOpenContext, computePerceivedObjects } from "../briefing.js";
import { renderOpenSummary } from "../checkpointTranscript.js";
import { PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE } from "../../scenario.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, WAIT, LIFT_TILE, EASE_TILE, HIDE_NOTES, TAKE_GRIT } from "./helpers/scriptedReferee.js";

/**
 * OPEN-VARIANT.md §15: what the hollow hides. An object `heldIn` another is
 * perceived by nobody while the container's concealment stands at 50 or
 * more -- in no briefing and no referee request -- and once the container is
 * open to view, §10.1's own rule applies to it as usual.
 */

function setup() {
  createTestDb();
  const openWorld = buildOpenWorld();
  const resolver = buildOpenResolver();
  const referee = createReferee([scriptedReferee(RULINGS)], { isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined });
  return { openWorld, resolver, referee };
}

async function half(w: OpenWorld, resolver: ReturnType<typeof buildOpenResolver>, referee: Referee, principal: "prisoner" | "warden", intent: string, roundN: number) {
  const t = principal === "prisoner" ? w.base.clock.prisonerT(roundN) : w.base.clock.wardenT(roundN);
  return runOpenHalfRound({
    openWorld: w,
    resolver,
    referee,
    principal,
    roundN,
    t,
    context: buildOpenContext(w, principal, t, roundN),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
  });
}

const ids = (w: OpenWorld, principal: "prisoner" | "warden", t: number) => computePerceivedObjects(w, principal, t).map((o) => o.id);

describe("the hollow's banknotes (OPEN-VARIANT.md §15)", () => {
  afterEach(() => destroyTestDb());

  it("at the start, with the tile at concealment 100, neither principal perceives the banknotes; both still perceive the tile itself", () => {
    const { openWorld: w } = setup();
    expect(getResource(w.resourceIdFor["loose_tile.concealment"])?.value).toBe(100);
    expect(w.entityIdFor.banknotes).toEqual(expect.any(String));
    const t = w.base.clock.wardenT(1);
    for (const principal of ["prisoner", "warden"] as const) {
      expect(ids(w, principal, t)).not.toContain("banknotes");
      expect(ids(w, principal, t)).toContain("loose_tile");
      const context = buildOpenContext(w, principal, t, 1);
      expect(context.perceivedObjects.map((o) => o.id)).not.toContain("banknotes");
      const serialized = JSON.stringify(context);
      expect(serialized).not.toContain("banknotes");
      expect(serialized).not.toContain("oilcloth");
    }
  });

  it("no identity, motive or stake mentions the money (§15.3)", () => {
    for (const text of [PRISONER_IDENTITY, PRISONER_MOTIVE, WARDEN_IDENTITY, WARDEN_MOTIVE]) {
      expect(text.toLowerCase()).not.toContain("banknote");
      expect(text.toLowerCase()).not.toContain("money");
    }
  });

  it("the referee is never offered the banknotes while the tile is down: not a target key, not a source", async () => {
    const { openWorld: w, resolver } = setup();
    let request: Parameters<ReaderTransport>[0] | undefined;
    const capturing: ReaderTransport = async (r) => {
      request = r;
      return [];
    };
    await half(w, resolver, createReferee([capturing]), "prisoner", "I look for money under the tile.", 1);
    expect(request?.questions.find((q) => q.id === "target")?.answerKeys).not.toContain("banknotes");
    expect(request?.sources.map((s) => s.id)).not.toContain("desc:banknotes");
    expect(request?.sources.map((s) => s.id)).toContain("desc:loose_tile");
  });

  it("an expose on the tile, grounded on its description, lowers its concealment by the spoon's table; at 50 the notes stay hidden, below 50 both principals perceive them", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const eased = await half(w, resolver, referee, "prisoner", EASE_TILE, 1);
    expect(eased.ruling?.applicable).toBe(true);
    expect(eased.outcome?.result).toEqual(expect.objectContaining({ before: 100, after: 50 }));
    const t2 = w.base.clock.wardenT(2);
    expect(ids(w, "prisoner", t2)).not.toContain("banknotes");
    expect(ids(w, "warden", t2)).not.toContain("banknotes");

    await half(w, resolver, referee, "prisoner", EASE_TILE, 2);
    expect(getResource(w.resourceIdFor["loose_tile.concealment"])?.value).toBe(0);
    const t3 = w.base.clock.wardenT(3);
    for (const principal of ["prisoner", "warden"] as const) {
      const seen = computePerceivedObjects(w, principal, t3).find((o) => o.id === "banknotes");
      expect(seen?.description).toBe("A fold of banknotes wrapped in a strip of oilcloth, ten notes of a hundred each, soft and grey with damp.");
    }
  });

  it("a prisoner's non-silent expose of the tile is uncovering, and bumps warden suspicion (§9.3 unchanged)", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const before = getResource(w.base.resources.wardenSuspicion)?.value as number;
    const lifted = await half(w, resolver, referee, "prisoner", LIFT_TILE, 1);
    expect(lifted.outcome?.result).toEqual(expect.objectContaining({ before: 100, after: 0 }));
    expect(lifted.perceptionForOther).toBe("Mara Voss brings the loose tile into view.");
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(before + 30); // substantial
  });

  it("once the hollow is open, §10.1's own rule applies to the notes: concealed at 50 or more, nobody holds them, so nobody perceives them", async () => {
    const { openWorld: w, resolver, referee } = setup();
    await half(w, resolver, referee, "prisoner", LIFT_TILE, 1);
    const hidden = await half(w, resolver, referee, "prisoner", HIDE_NOTES, 2);
    expect(hidden.ruling?.applicable).toBe(true);
    expect(hidden.outcome?.result).toEqual(expect.objectContaining({ before: 0, after: 100 }));
    const t3 = w.base.clock.wardenT(3);
    expect(ids(w, "prisoner", t3)).not.toContain("banknotes");
    expect(ids(w, "warden", t3)).not.toContain("banknotes");
  });

  it("grit still comes from the hollow with the tile down: consumes nothing, property none, the tile's concealment untouched", async () => {
    const { openWorld: w, resolver, referee } = setup();
    const made = await half(w, resolver, referee, "prisoner", TAKE_GRIT, 1);
    expect(made.derived?.id).toBe("grit");
    expect(made.outcome?.transitions).toEqual([]);
    expect(getResource(w.resourceIdFor["loose_tile.concealment"])?.value).toBe(100);
  });

  it("the summary reports the round each principal first perceived what the hollow holds (§15.4)", async () => {
    const { openWorld: w, resolver, referee } = setup();
    let turn = 0;
    const prisonerMind: OpenMind = {
      async consider() {
        turn += 1;
        return { intent: turn === 2 ? LIFT_TILE : WAIT };
      },
    };
    const game = await runOpenGame({
      openWorld: w,
      resolver,
      referee,
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind,
      rounds: 3,
    });
    const summary = renderOpenSummary(game, 3).join("\n");
    expect(summary).toContain("First perceived (OPEN-VARIANT.md §15.4): banknotes -- warden: round 3; prisoner: round 3.");

    const never = await runOpenGame({
      openWorld: (() => {
        destroyTestDb();
        return setup().openWorld;
      })(),
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WAIT }),
      rounds: 1,
    });
    expect(renderOpenSummary(never, 1).join("\n")).toContain("First perceived (OPEN-VARIANT.md §15.4): banknotes -- warden: never; prisoner: never.");
  });
});
