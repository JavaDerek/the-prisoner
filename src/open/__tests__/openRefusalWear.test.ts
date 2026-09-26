import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, OPEN_WINDOW_BAR_MAX, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect } from "../effects.js";
import { createReferee } from "../referee.js";
import { runOpenHalfRound } from "../loop.js";
import { buildOpenContext } from "../briefing.js";
import { renderOwnOutcome } from "../perception.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, type ScriptedRuling } from "./helpers/scriptedReferee.js";

/**
 * HUMAN-INTENTS-DESIGN.md D7a (§5), OPEN-VARIANT.md §76.2, the-prisoner#26:
 * an `open` on a way out's part, refused by §24's own gate (the part's
 * integrity still above the threshold), now applies the ruled magnitude as
 * `wear` on the part in the SAME resolution -- a refused pry progresses the
 * window route instead of teaching the actor nothing.
 */

function plan(openWorld: OpenWorld, target: "window" | "bar", magnitude: "slight" | "moderate" | "substantial" = "moderate") {
  return planEffect({
    targetObjectId: target,
    effectKind: "open",
    property: "passage",
    magnitude,
    entityIdFor: openWorld.entityIdFor,
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    actorId: openWorld.base.prisonerId,
    description: "x",
  });
}
function resolvePlan(openWorld: OpenWorld, p: ReturnType<typeof plan>) {
  if (!p) throw new Error("no plan");
  return buildOpenResolver().resolve({ gameId: openWorld.base.gameId, mechanic: p.mechanic, parameters: p.parameters });
}

describe("D7a: a refused open also wears the part it works through (OPEN-VARIANT.md §76.2)", () => {
  afterEach(() => destroyTestDb());

  it("planEffect builds wearOnRefusal from the part's own declared integrity table, only when a gate exists", () => {
    createTestDb();
    const w = buildOpenWorld();
    const opening = plan(w, "window", "moderate");
    expect(opening?.parameters.wearOnRefusal).toEqual({ resourceId: w.base.resources.barIntegrity, amount: 15, min: 0, max: 100 }); // bar wear moderate = 15
    // The door has no gate under the default (free) door price -- nothing for D7a to wear.
    const door = planEffect({
      targetObjectId: "door", effectKind: "open", property: "passage", magnitude: "moderate",
      entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.prisonerId, description: "x",
    });
    expect(door?.parameters.wearOnRefusal).toBeUndefined();
    // close never gates on a threshold at all -- D7a only ever applies to open.
    const closing = planEffect({
      targetObjectId: "window", effectKind: "close", property: "passage", magnitude: "moderate",
      entityIdFor: w.entityIdFor, resourceIdFor: w.resourceIdFor, exits: w.exits, actorId: w.base.prisonerId, description: "x",
    });
    expect(closing?.parameters.wearOnRefusal).toBeUndefined();
  });

  it("a refused open (bar still above the threshold) wears the bar by the ruled magnitude, in the same resolution, and reports both", () => {
    createTestDb();
    const w = buildOpenWorld();
    expect(getResource(w.base.resources.barIntegrity)?.value).toBe(100);
    const outcome = resolvePlan(w, plan(w, "window", "moderate"));
    expect(outcome.result).toEqual(expect.objectContaining({ opened: false, partId: "bar", partBefore: 100, partAfter: 85 }));
    expect(getResource(w.base.resources.barIntegrity)?.value).toBe(85);
    // The passage itself did not move: the resolution's OWN gated resource is untouched.
    expect(getResource(resourceIdForProperty(w, "window", "passage") as string)?.value).toBe(0);
  });

  it("once the wear crosses the gate's own threshold, the open that caused it still reports refused this turn -- the NEXT open succeeds", () => {
    createTestDb();
    const w = buildOpenWorld();
    // Four moderate wears (15 each: 100, 85, 70, 55) still refuse; the bar sits above OPEN_WINDOW_BAR_MAX (50).
    for (let i = 0; i < 4; i++) {
      const outcome = resolvePlan(w, plan(w, "window", "moderate"));
      expect(outcome.result.opened).toBe(false);
    }
    expect(getResource(w.base.resources.barIntegrity)?.value).toBe(40);
    expect(40).toBeLessThanOrEqual(OPEN_WINDOW_BAR_MAX);
    const fifth = resolvePlan(w, plan(w, "window", "moderate"));
    expect(fifth.result.opened).toBe(true);
    // A successful open wears nothing further -- it only sets the passage.
    expect(getResource(w.base.resources.barIntegrity)?.value).toBe(40);
  });

  it("suspicion is unchanged: a refused open is exactly as visible as it always was", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const t = w.base.clock.prisonerT(1);
    const rulings: Record<string, ScriptedRuling> = {
      "I pry at the bar to force the window.": { target: "window", effect: "open", property: "passage", magnitude: "moderate", perceptibility: "visible", intentQuote: "pry at the bar", descQuote: "One rusted iron bar, set into the mortar across its middle, closes it" },
    };
    const result = await runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(rulings)]),
      principal: "prisoner",
      roundN: 1,
      t,
      context: buildOpenContext(w, "prisoner", t, 1),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I pry at the bar to force the window." }),
    });
    expect(result.plan?.mechanic).toBe("OPEN_PASSAGE");
    expect(result.outcome?.result).toEqual(expect.objectContaining({ opened: false, partId: "bar", partBefore: 100, partAfter: 85 }));
    // D1 + D7a: the outcome states the attempt, the refusal, AND the wear -- in the house style
    // every other wear outcome already uses ("its integrity went from X to Y").
    expect(renderOwnOutcome(result)).toBe("You set about opening the window. Your last attempt met the window shut: it will not open yet; the bar's integrity went from 100 to 85.");
    expect(getResource(w.base.resources.wardenSuspicion)?.value).toBe(10); // moderate, unchanged from any other visible moderate act
    // The transcript labels the transition by what actually changed (the bar's own
    // integrity), never by the plan's own primary resource (the window's passage).
    expect(renderOpenHalfRound(result).join("\n")).toContain("  - bar_integrity: 100 -> 85");
  });

  it("a warden's refused open at the bar names her, not the prisoner, and the same wear rule applies to whichever principal acts", async () => {
    createTestDb();
    const w = buildOpenWorld();
    const t = w.base.clock.wardenT(1);
    const rulings: Record<string, ScriptedRuling> = {
      // §19: a target named as the PART cites the part's OWN declared property (integrity), never
      // "passage" (which the part does not declare) -- effects.ts's open/close resolves through the
      // way out regardless of which property the referee separately answered.
      "I examine and pry at the bar.": { target: "bar", effect: "open", property: "integrity", magnitude: "slight", perceptibility: "visible", intentQuote: "pry at the bar", descQuote: "about as thick as a thumb" },
    };
    const result = await runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(rulings)]),
      principal: "warden",
      roundN: 1,
      t,
      context: buildOpenContext(w, "warden", t, 1),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I examine and pry at the bar." }),
    });
    expect(result.outcome?.result).toEqual(expect.objectContaining({ opened: false, partId: "bar", partBefore: 100, partAfter: 92 })); // slight = 8
  });
});
