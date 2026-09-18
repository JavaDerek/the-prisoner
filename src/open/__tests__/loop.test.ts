import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { getResource } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, resourceIdForProperty, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { planEffect } from "../effects.js";
import { createReferee, type Referee, type RefereeRuling } from "../referee.js";
import { runOpenHalfRound, precedentTextFor, KNOWN_APPROACH_SUSPICION_BUMP } from "../loop.js";
import { getBelief, setBelief } from "../../ledger/beliefs.js";
import { getNotes } from "../../ledger/notes.js";
import type { OpenMind, OpenPrincipalContext, OpenProposal } from "../mind.js";
import { WARDEN_NAME } from "../../scenario.js";

/** Moves the warden out through the door, the way real play does it: open,
 *  then leave (`leaving.test.ts`'s own pattern). Used only by §55's presence
 *  tests below. */
function moveWardenOut(openWorld: OpenWorld, resolver: ReturnType<typeof buildOpenResolver>) {
  const open = planEffect({
    targetObjectId: "door",
    effectKind: "open",
    property: "passage",
    magnitude: "moderate",
    entityIdFor: openWorld.entityIdFor,
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    description: "opens the door",
  });
  if (!open) throw new Error("no plan");
  resolver.resolve({ gameId: openWorld.base.gameId, mechanic: open.mechanic, parameters: open.parameters });
  const leave = planEffect({
    targetObjectId: "door",
    effectKind: "leave",
    property: "none",
    magnitude: "slight",
    entityIdFor: openWorld.entityIdFor,
    resourceIdFor: openWorld.resourceIdFor,
    exits: openWorld.exits,
    actorId: openWorld.base.wardenId,
    description: "leaves through the door",
  });
  if (!leave) throw new Error("no plan");
  resolver.resolve({ gameId: openWorld.base.gameId, mechanic: leave.mechanic, parameters: leave.parameters });
}

const BAR_PERCEPTION = { id: "bar", description: "One of five vertical iron bars... Rust has pitted it near the bottom." };

function context(openWorld: OpenWorld): OpenPrincipalContext {
  return {
    principalId: openWorld.base.prisonerId,
    identity: "id",
    motive: "motive",
    briefing: "briefing",
    perceivedObjects: [BAR_PERCEPTION],
  };
}

function grounderReferee(): Referee {
  const applicable = {
    target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file at the bar" } },
    effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file at the bar" } },
    property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
    magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file at the bar" } },
    perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file at the bar" } },
  };
  // Any question this fixture does not script (the product question,
  // OPEN-VARIANT.md §13.1) gets its own safe default, cited from the intent.
  const transport = async (request: { questions: readonly { id: string; safeDefault: string }[] }) =>
    request.questions.map((q) => {
      const scripted = (applicable as Record<string, { answerKey: string; citation: { sourceId: string; quote: string } } | undefined>)[q.id];
      return { questionId: q.id, answerKey: scripted?.answerKey ?? q.safeDefault, citation: scripted?.citation ?? { sourceId: "intent", quote: "file at the bar" } };
    });
  return createReferee([transport]);
}

function inapplicableReferee(): Referee {
  return createReferee([]); // no transports -- every answer falls to its safe default, "none"
}

describe("runOpenHalfRound (this task's brief: mind -> referee -> resolve())", () => {
  afterEach(() => destroyTestDb());

  it("silence: the mind proposes nothing -- everything else is null", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>(null);

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: grounderReferee(),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.proposal).toBeNull();
    expect(result.ruling).toBeNull();
    expect(result.outcome).toBeNull();
    expect(result.perceptionForOther).toBeNull();
  });

  it("a proposal's notes persist for this principal alone, even when its attempt is ruled impossible", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I will the bars apart.", notes: "Try the lock next." });

    await runOpenHalfRound({
      openWorld,
      resolver: buildOpenResolver(),
      referee: inapplicableReferee(),
      principal: "prisoner",
      roundN: 2,
      t: openWorld.base.clock.prisonerT(2),
      context: context(openWorld),
      mind,
    });

    expect(getNotes(openWorld.base.gameId, "prisoner")).toBe("Try the lock next.");
    expect(getNotes(openWorld.base.gameId, "warden")).toBeNull();
  });

  it("an inapplicable ruling (no grounds) does nothing -- invariant 3", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: inapplicableReferee(),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.ruling?.applicable).toBe(false);
    expect(result.outcome).toBeNull();
    expect(result.perceptionForOther).toBeNull();
  });

  it("a grounded WEAR ruling resolves, updates the actor's own belief, and is perceptible when not ruled silent", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: grounderReferee(),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.outcome).toBeTruthy();
    expect(result.outcome?.transitions[0].newValue).toBe(85); // 100 - moderate(15), carried over from FILE_AMOUNT
    expect(result.perceptionForOther).toContain("bar"); // "audible" ruling -- perceptible
    expect(result.perceptionForOther).not.toMatch(/\d/); // never leaks the numeric value

    const belief = getBelief(openWorld.base.gameId, "prisoner", "bar_integrity");
    expect(belief?.value).toBe(85);

    const resourceId = resourceIdForProperty(openWorld, "bar", "integrity") as string;
    expect(getResource(resourceId)?.value).toBe(85);
  });

  it("perceptibility 'silent' relays nothing to the other principal", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    const silentApplicable = {
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file at the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file at the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file at the bar" } },
      perceptibility: { answerKey: "silent", citation: { sourceId: "intent", quote: "file at the bar" } },
    };
    const referee = createReferee([
      async (request: { questions: readonly { id: string; safeDefault: string }[] }) =>
        request.questions.map((q) => {
          const scripted = (silentApplicable as Record<string, { answerKey: string; citation: { sourceId: string; quote: string } } | undefined>)[q.id];
          return { questionId: q.id, answerKey: scripted?.answerKey ?? q.safeDefault, citation: scripted?.citation ?? { sourceId: "intent", quote: "file at the bar" } };
        }),
    ]);

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee,
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.outcome).toBeTruthy(); // still happened, physically
    expect(result.perceptionForOther).toBeNull(); // but nobody else perceives it
  });

  it("a stale belief-based expectation on a wear-type effect is refused, exactly like the closed variant's FILE/SHIM", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    // The prisoner WRONGLY believes the bar is already at 40 (e.g. the
    // warden covertly replaced it without the prisoner knowing) -- the live
    // value is still 100.
    setBelief(openWorld.base.gameId, "prisoner", "bar_integrity", 40, 0);

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: grounderReferee(),
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.outcome).toBeNull();
    expect(result.refusalError).toBeTruthy();
    expect(result.perceptionForOther).toBeNull();

    // The refusal reveals the true value into the acting principal's own belief.
    const belief = getBelief(openWorld.base.gameId, "prisoner", "bar_integrity");
    expect(belief?.value).toBe(100);
  });

  it("a ruling the referee marks applicable but whose (object, property) is not declared in the scenario does nothing", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do something to the meal tray." });

    // Hand-built ruling bypassing the referee's own declared-property check,
    // to exercise `loop.ts`'s OWN defence-in-depth branch directly.
    const manualRuling: RefereeRuling = {
      targetObjectId: "meal_tray",
      effectKind: "wear",
      property: "integrity", // meal_tray has no declared "integrity" property
      magnitude: "moderate",
      perceptibility: "audible",
      product: "none",
      applicable: true,
      citations: {
        target: { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true },
        effect: { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true },
        property: { citation: { sourceId: "desc:meal_tray", quote: "x" }, requiredSourceId: "desc:meal_tray", verified: true },
        product: { citation: null, requiredSourceId: "intent", verified: false },
      },
      raw: { answers: [], unmatched: [] },
      request: { questions: [], sources: [] },
    };
    const referee: Referee = { rule: async () => manualRuling };

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee,
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.plan).toBeNull();
    expect(result.outcome).toBeNull();
  });

  it("a prisoner's non-silent WEAR bumps warden_suspicion (OPEN-VARIANT.md §9.3, grounds accrue)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    await runOpenHalfRound({
      openWorld,
      resolver,
      referee: grounderReferee(), // magnitude "moderate" -> FILE_SUSPICION_BUMP (10)
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(10);
  });

  describe("known approaches (the precedent condition's consequence)", () => {
    const silentWear = {
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file at the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file at the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file at the bar" } },
      perceptibility: { answerKey: "silent", citation: { sourceId: "intent", quote: "file at the bar" } },
    };
    const silentReferee = () =>
      createReferee([
        async (request: { questions: readonly { id: string }[] }) =>
          request.questions.map((q) => ({ questionId: q.id, ...(silentWear as Record<string, { answerKey: string; citation: { sourceId: string; quote: string } }>)[q.id] })),
      ]);

    async function prisonerHalf(openWorld: OpenWorld, referee: Referee, knownApproaches: readonly string[]) {
      return runOpenHalfRound({
        openWorld,
        resolver: buildOpenResolver(),
        referee,
        principal: "prisoner",
        roundN: 1,
        t: openWorld.base.clock.prisonerT(1),
        context: context(openWorld),
        mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." }),
        knownApproaches: knownApproaches.map((text) => ({ text, suspicionBump: KNOWN_APPROACH_SUSPICION_BUMP })),
      });
    }

    it("a known approach is noticed however quietly it is done, and suspicion jumps by KNOWN_APPROACH_SUSPICION_BUMP", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const result = await prisonerHalf(openWorld, silentReferee(), ["A prisoner works at the bar."]);
      expect(result.perceptionForOther).toContain("works at the bar");
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(KNOWN_APPROACH_SUSPICION_BUMP);
    });

    it("stacks on the ordinary bump when the act was perceptible anyway", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      await prisonerHalf(openWorld, grounderReferee(), ["A prisoner works at the bar."]); // moderate, audible: 10
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(10 + KNOWN_APPROACH_SUSPICION_BUMP);
    });

    it("an approach outside the known list costs only what it always did", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const result = await prisonerHalf(openWorld, silentReferee(), ["A prisoner works at the lock."]);
      expect(result.perceptionForOther).toBeNull();
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(0);
    });

    it("the known text is the role-neutral sentence the warden perceives", () => {
      expect(precedentTextFor({ targetObjectId: "bar", effectKind: "wear" })).toBe("A prisoner works at the bar.");
    });
  });

  it("a prisoner's SILENT effect does not bump warden_suspicion", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

    const silentApplicable = {
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file at the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file at the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file at the bar" } },
      perceptibility: { answerKey: "silent", citation: { sourceId: "intent", quote: "file at the bar" } },
    };
    const referee = createReferee([
      async (request: { questions: readonly { id: string }[] }) =>
        request.questions.map((q) => ({
          questionId: q.id,
          answerKey: (silentApplicable as Record<string, { answerKey: string }>)[q.id].answerKey,
          citation: (silentApplicable as Record<string, { citation: { sourceId: string; quote: string } }>)[q.id].citation,
        })),
    ]);

    await runOpenHalfRound({
      openWorld,
      resolver,
      referee,
      principal: "prisoner",
      roundN: 1,
      t: openWorld.base.clock.prisonerT(1),
      context: context(openWorld),
      mind,
    });

    expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(0);
  });

  it("a warden REVEAL sets revealFor, and a value lower than the warden's prior belief bumps suspicion (evidence becomes grounds)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I inspect the bar closely." });
    setBelief(openWorld.base.gameId, "warden", "bar_integrity", 100, 0);

    // Wear the bar down first (as the prisoner would have, off-camera for this test).
    const barResource = resourceIdForProperty(openWorld, "bar", "integrity") as string;
    resolver.resolve({ gameId: openWorld.base.gameId, mechanic: "OPEN_WEAR", parameters: { resourceId: barResource, amount: 20, min: 0, max: 100, description: "x" } });

    const revealTransport = async (request: { questions: readonly { id: string }[] }) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey: q.id === "target" ? "bar" : q.id === "effect" ? "reveal" : q.id === "property" ? "integrity" : q.id === "magnitude" ? "slight" : "silent",
        citation: {
          sourceId: q.id === "property" ? "desc:bar" : "intent",
          quote: q.id === "property" ? "Rust has pitted it near the bottom" : "inspect the bar closely",
        },
      }));

    const result = await runOpenHalfRound({
      openWorld,
      resolver,
      referee: createReferee([revealTransport]),
      principal: "warden",
      roundN: 1,
      t: openWorld.base.clock.wardenT(1),
      context: context(openWorld),
      mind,
    });

    expect(result.revealFor).toEqual({ objectId: "bar", property: "integrity", value: 80 });
    // 100 (prior belief) - 80 (revealed) = 20 drop / EVIDENCE_SUSPICION_DIVISOR (2) = 10.
    expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(10);
  });

  // OPEN-VARIANT.md §55 (issue #22, gap 1): "what a principal can perceive
  // of the other's acts ... becomes conditioned on presence." `presenceMode`
  // defaults to "off", byte-identical to every test above this one.
  describe("presence (§55, issue #22 gap 1)", () => {
    it("off (the default, and with no argument at all): a wear the warden cannot possibly have seen -- she already left -- still bumps suspicion and still reaches her, unaffected by this gap unless the arm is on", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const resolver = buildOpenResolver();
      moveWardenOut(openWorld, resolver);
      const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

      const result = await runOpenHalfRound({
        openWorld,
        resolver,
        referee: grounderReferee(),
        principal: "prisoner",
        roundN: 2,
        t: openWorld.base.clock.prisonerT(2),
        context: context(openWorld),
        mind,
        // presenceMode omitted entirely.
      });

      expect(result.perceptionForOther).not.toBeNull();
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBeGreaterThan(0);
    });

    it("modelled: once the warden has left through the door, the SAME audible wear still happens (a physical fact) but raises no suspicion and reaches no one", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const resolver = buildOpenResolver();
      moveWardenOut(openWorld, resolver);
      const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

      const result = await runOpenHalfRound({
        openWorld,
        resolver,
        referee: grounderReferee(),
        principal: "prisoner",
        roundN: 2,
        t: openWorld.base.clock.prisonerT(2),
        context: context(openWorld),
        mind,
        presenceMode: "modelled",
      });

      expect(result.outcome).toBeTruthy(); // the bar still wears -- a physical fact
      expect(result.perceptionForOther).toBeNull(); // nobody was there to notice
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(0);
    });

    it("modelled: while they still share the cell, an audible wear behaves exactly as under 'off'", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const resolver = buildOpenResolver();
      const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I file at the bar with my spoon." });

      const result = await runOpenHalfRound({
        openWorld,
        resolver,
        referee: grounderReferee(),
        principal: "prisoner",
        roundN: 1,
        t: openWorld.base.clock.prisonerT(1),
        context: context(openWorld),
        mind,
        presenceMode: "modelled",
      });

      expect(result.perceptionForOther).not.toBeNull();
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBeGreaterThan(0);
    });
  });

  // OPEN-VARIANT.md §55 (issue #22, gap 2): "a noise ruled at a perceived
  // principal carries the spoken claim into that principal's own next
  // briefing as reported speech ... the same perceptionForOther string,
  // addressed rather than ambient, landing in OpenNews.fromOther." Built
  // from a hand-built `RefereeRuling`, exactly like the "not declared in
  // the scenario" test above -- this exercises loop.ts's OWN routing
  // directly, independent of what any real referee transport would answer.
  describe("a principal as a target (§55, issue #22 gap 2)", () => {
    function noiseAtWarden(): RefereeRuling {
      return {
        targetObjectId: "warden",
        effectKind: "noise",
        property: "none",
        magnitude: "moderate",
        perceptibility: "audible",
        product: "none",
        applicable: true,
        citations: {
          target: { citation: { sourceId: "intent", quote: "call out to the warden" }, requiredSourceId: "intent", verified: true },
          effect: { citation: { sourceId: "intent", quote: "call out to the warden" }, requiredSourceId: "intent", verified: true },
          property: { citation: { sourceId: "desc:warden", quote: "can be seen, heard, spoken to" }, requiredSourceId: "desc:warden", verified: true },
          product: { citation: null, requiredSourceId: "intent", verified: false },
        },
        raw: { answers: [], unmatched: [] },
        request: { questions: [], sources: [] },
      };
    }

    it("a noise ruled at a perceived principal resolves, reaches that principal's own next briefing by name, and touches no resource at all -- no belief can ever be written from it", async () => {
      createTestDb();
      const openWorld = buildOpenWorld();
      const resolver = buildOpenResolver();
      const mind: OpenMind = scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I call out to the warden for help." });
      const referee: Referee = { rule: async () => noiseAtWarden() };

      const result = await runOpenHalfRound({
        openWorld,
        resolver,
        referee,
        principal: "prisoner",
        roundN: 1,
        t: openWorld.base.clock.prisonerT(1),
        context: context(openWorld),
        mind,
        presenceMode: "modelled",
      });

      expect(result.outcome).toBeTruthy();
      expect(result.perceptionForOther).toContain(WARDEN_NAME);
      expect(result.resourceName).toBeNull();
      expect(getResource(openWorld.base.resources.wardenSuspicion)?.value).toBe(0);
    });
  });
});
