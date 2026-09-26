import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { currentT } from "../../world/clock.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect, type EffectPlan, type EffectKind } from "../effects.js";
import { computePerceivedObjects, buildOpenContext } from "../briefing.js";
import { PERSON_CONTAINERS, CONTAINMENT_HIDDEN_AT_OR_ABOVE, personContainerIndex } from "../scenarioObjects.js";
import { runOpenHalfRound } from "../loop.js";
import { createReferee } from "../referee.js";
import { scriptedReferee, RULINGS, SCRAPE } from "./helpers/scriptedReferee.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";

/**
 * HUMAN-INTENTS-DESIGN.md D9 (§6.2, decided 2026-09-26, "yes, the container
 * shape"), OPEN-VARIANT.md §76.1: a person's containment is dynamic, tracked
 * by her own resource (`world.ts`'s `personHeldIn`), never authored. A
 * `conceal` on a person-container (the blanket, the cot) that crosses
 * `CONTAINMENT_HIDDEN_AT_OR_ABOVE` also sets the ACTING principal's own
 * containment, in the same resolution; an `expose` that crosses back below
 * it clears whichever principal's containment names this container. Both
 * are the same resolve() call the custody rule requires -- one mechanic,
 * never two writes.
 */

function world(presence: "off" | "modelled" = "modelled"): OpenWorld {
  createTestDb();
  return buildOpenWorld({ presence });
}
const idOf = (w: OpenWorld, who: "prisoner" | "warden") => (who === "prisoner" ? w.base.prisonerId : w.base.wardenId);

function heldInOf(w: OpenWorld): Record<string, string> {
  return Object.fromEntries((["prisoner", "warden"] as const).flatMap((p) => (w.personHeldIn[p] ? [[idOf(w, p), w.personHeldIn[p] as string]] : [])));
}

function planContain(w: OpenWorld, effectKind: "conceal" | "expose", target: string, actor: "prisoner" | "warden", magnitude: "slight" | "moderate" | "substantial" = "substantial"): EffectPlan | null {
  const other = actor === "prisoner" ? "warden" : "prisoner";
  return planEffect({
    targetObjectId: target,
    effectKind,
    property: "concealment",
    magnitude,
    entityIdFor: { ...w.entityIdFor, prisoner: w.base.prisonerId, warden: w.base.wardenId },
    resourceIdFor: w.resourceIdFor,
    exits: w.exits,
    actorId: idOf(w, actor),
    custody: {
      otherId: idOf(w, other),
      perceived: computePerceivedObjects(w, actor, currentT(w.base.gameId), "modelled").map((o) => o.id),
      postureOf: {},
      heldInOf: heldInOf(w),
    },
    description: "x",
  });
}
function resolvePlan(w: OpenWorld, plan: EffectPlan | null) {
  if (!plan) throw new Error("no plan");
  return buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: plan.mechanic, parameters: plan.parameters });
}
function valueOf(w: OpenWorld, resourceId: string | undefined): number | null {
  if (!resourceId) return null;
  return readNumericFact({ gameId: w.base.gameId, t: currentT(w.base.gameId), entityId: resourceId, key: "value" });
}

describe("D9's mechanic: a person's containment is dynamic (HUMAN-INTENTS-DESIGN.md §6.2, OPEN-VARIANT.md §76.1)", () => {
  afterEach(() => destroyTestDb());

  it("declares PERSON_CONTAINERS as blanket then cot, and personContainerIndex/personContainerId round-trip", () => {
    expect(PERSON_CONTAINERS).toEqual(["blanket", "cot"]);
    expect(personContainerIndex("blanket")).toBe(1);
    expect(personContainerIndex("cot")).toBe(2);
    expect(personContainerIndex("bar")).toBe(0);
    expect(CONTAINMENT_HIDDEN_AT_OR_ABOVE).toBe(50);
  });

  it("with presence modelled, each principal gets her own bounded containment resource, starting at 0 (not contained)", () => {
    const w = world();
    expect(w.personHeldIn.prisoner).toBeTruthy();
    expect(w.personHeldIn.warden).toBeTruthy();
    expect(w.personHeldIn.prisoner).not.toBe(w.personHeldIn.warden);
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(0);
    expect(valueOf(w, w.personHeldIn.warden)).toBe(0);
  });

  it("with presence off, no containment resource exists at all -- every batch recorded before D9 is byte-identical", () => {
    const w = world("off");
    expect(w.personHeldIn.prisoner).toBeUndefined();
    expect(w.personHeldIn.warden).toBeUndefined();
  });

  it("a substantial conceal on the blanket resolves through OPEN_CONCEAL_CONTAINER, raises its concealment to 100, and marks the ACTOR's own containment as the blanket (index 1)", () => {
    const w = world();
    const plan = planContain(w, "conceal", "blanket", "prisoner", "substantial");
    expect(plan?.mechanic).toBe("OPEN_CONCEAL_CONTAINER");
    resolvePlan(w, plan);
    expect(valueOf(w, w.resourceIdFor["blanket.concealment"])).toBe(100);
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(1);
    expect(valueOf(w, w.personHeldIn.warden)).toBe(0); // untouched
  });

  it("concealing the cot marks containment as the cot's own index (2), independent of the blanket's resource", () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "cot", "warden", "substantial"));
    expect(valueOf(w, w.resourceIdFor["cot.concealment"])).toBe(100);
    expect(valueOf(w, w.personHeldIn.warden)).toBe(2);
    expect(valueOf(w, w.resourceIdFor["blanket.concealment"])).toBe(0); // untouched
  });

  it("a conceal that does not cross the hidden line raises concealment but sets no containment: heldIn stays a precise invariant", () => {
    const w = world();
    const plan = planContain(w, "conceal", "blanket", "prisoner", "slight"); // +20, from 0 -> 20
    resolvePlan(w, plan);
    expect(valueOf(w, w.resourceIdFor["blanket.concealment"])).toBe(20);
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(0);
  });

  it("PLANTED VIOLATION: without a containment resource to set (presence off), conceal on the blanket is exactly the ordinary OPEN_RESTORE it always was", () => {
    const w = world("off");
    const plan = planEffect({
      targetObjectId: "blanket",
      effectKind: "conceal",
      property: "concealment",
      magnitude: "substantial",
      entityIdFor: w.entityIdFor,
      resourceIdFor: w.resourceIdFor,
      exits: w.exits,
      actorId: w.base.prisonerId,
      custody: { otherId: w.base.wardenId, perceived: [], postureOf: {}, heldInOf: {} },
      description: "x",
    });
    expect(plan?.mechanic).toBe("OPEN_RESTORE");
  });

  it("an expose on the blanket lowers its concealment and, once it crosses back below the line, clears the containment it hid", () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial")); // 0 -> 100, heldIn = 1
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(1);

    const slight = planContain(w, "expose", "blanket", "warden", "slight"); // -20: 100 -> 80, still >= 50
    expect(slight?.mechanic).toBe("OPEN_EXPOSE_CONTAINER");
    resolvePlan(w, slight);
    expect(valueOf(w, w.resourceIdFor["blanket.concealment"])).toBe(80);
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(1); // still hidden: not below the line yet

    resolvePlan(w, planContain(w, "expose", "blanket", "warden", "moderate")); // -50: 80 -> 30, crosses below 50
    expect(valueOf(w, w.resourceIdFor["blanket.concealment"])).toBe(30);
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(0); // uncovered
  });

  it("an expose on one container never clears a principal's containment in the OTHER container", () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "cot", "warden", "substantial")); // warden hides under the cot
    resolvePlan(w, planContain(w, "expose", "blanket", "prisoner", "substantial")); // exposing the (untouched) blanket
    expect(valueOf(w, w.personHeldIn.warden)).toBe(2); // still hidden in the cot
  });

  it("an expose on a container the actor herself exposes still clears her own containment: no exemption for who exposes it", () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    resolvePlan(w, planContain(w, "expose", "blanket", "prisoner", "substantial"));
    expect(valueOf(w, w.personHeldIn.prisoner)).toBe(0);
  });

  it("the read: the OTHER principal's perceivedObjects drops a person held in a container at or above the line; the actor still perceives herself; the container itself is never dropped", () => {
    const w = world();
    const t = currentT(w.base.gameId);
    // Before hiding, both perceive each other.
    expect(computePerceivedObjects(w, "warden", t, "modelled").map((o) => o.id)).toContain("prisoner");

    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    const wardenView = computePerceivedObjects(w, "warden", t, "modelled").map((o) => o.id);
    expect(wardenView).not.toContain("prisoner");
    expect(wardenView).toContain("blanket"); // the container itself is never hidden by its own concealment (§15.1)

    const prisonerView = computePerceivedObjects(w, "prisoner", t, "modelled").map((o) => o.id);
    expect(prisonerView).toContain("prisoner"); // she still perceives herself: hidden is not absent (§55)
  });

  it("the container's own reads text changes for whoever perceives it, once concealment crosses into the covered band", () => {
    const w = world();
    const t = currentT(w.base.gameId);
    const before = computePerceivedObjects(w, "warden", t, "modelled").find((o) => o.id === "blanket")?.description;
    expect(before).not.toContain("humped");

    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    const after = computePerceivedObjects(w, "warden", t, "modelled").find((o) => o.id === "blanket")?.description;
    expect(after).toContain("humped");
  });

  it("once uncovered by an expose, the other principal perceives her again", () => {
    const w = world();
    const t = currentT(w.base.gameId);
    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    expect(computePerceivedObjects(w, "warden", t, "modelled").map((o) => o.id)).not.toContain("prisoner");

    resolvePlan(w, planContain(w, "expose", "blanket", "warden", "substantial")); // -100: 100 -> 0
    expect(computePerceivedObjects(w, "warden", t, "modelled").map((o) => o.id)).toContain("prisoner");
  });

  it("presence off: computePerceivedObjects never reads a containment resource, so the default rule (both perceive everything) is unaffected", () => {
    const w = world("off");
    const t = currentT(w.base.gameId);
    // Conceal the blanket directly through resolve() -- no referee needed for a unit check.
    buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: w.resourceIdFor["blanket.concealment"], amount: 100, min: 0, max: 100, description: "x" } });
    const ids = computePerceivedObjects(w, "prisoner", t).map((o) => o.id);
    expect(ids).toContain("blanket");
    // No principal is ever perceived at all with presence off (§55's own gate), so there is nothing D9 could drop.
    expect(ids).not.toContain("warden");
  });

  it("hiding does not hide acts: a visible wear at the bar still reaches the other principal's perception while the actor is hidden", async () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    const t = w.base.clock.prisonerT(1);
    const context = buildOpenContext(w, "prisoner", t, 1, 12, {}, "modelled");
    const result = await runOpenHalfRound({
      openWorld: w,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      principal: "prisoner",
      roundN: 1,
      t,
      context,
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: SCRAPE }),
      presenceMode: "modelled",
    });
    expect(result.plan?.mechanic).toBe("OPEN_WEAR");
    // Perceptibility is ruled per act, independent of whether she is contained.
    expect(result.perceptionForOther).toBeTruthy();
  });

  it("custody's C1 gate (posture) is unaffected by containment: a hidden prisoner still keeps what she holds while on her feet", () => {
    const w = world();
    resolvePlan(w, planContain(w, "conceal", "blanket", "prisoner", "substantial"));
    const plan = planEffect({
      targetObjectId: "spoon",
      effectKind: "take" as EffectKind,
      property: "none",
      magnitude: "slight",
      entityIdFor: { ...w.entityIdFor, prisoner: w.base.prisonerId, warden: w.base.wardenId },
      resourceIdFor: w.resourceIdFor,
      exits: w.exits,
      actorId: w.base.wardenId,
      custody: { otherId: w.base.prisonerId, perceived: ["spoon"], postureOf: {}, heldInOf: heldInOf(w) },
      description: "x",
    });
    expect(plan?.mechanic).toBe("OPEN_TAKE");
    const outcome = resolvePlan(w, plan);
    // No posture resource was ever raised/lowered here, so the default (on her feet) still applies.
    expect(outcome.result.taken).toBe(false);
    expect(outcome.result.refused).toBe("holder-on-her-feet");
  });
});
