import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import type { ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredPropertyKeys, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { PRISONER_NAME } from "../../scenario.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { buildOpenContext } from "../briefing.js";
import { renderOwnOutcome, renderForOther } from "../perception.js";
import { setBelief } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import type { Principal } from "../../ledger/beliefs.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

/** A scripted referee transport: every question gets the answer named in
 *  `answers`, cited against the intent or the target's own description. */
function ruling(answers: { target: string; effect: string; property: string; magnitude?: string; perceptibility?: string; intentQuote: string; descQuote: string; propertySource?: string }): ReaderTransport {
  return async (request) =>
    request.questions.map((q) => {
      const key = { target: answers.target, effect: answers.effect, property: answers.property, magnitude: answers.magnitude ?? "moderate", perceptibility: answers.perceptibility ?? "audible" }[q.id] as string;
      // `propertySource` lets a fixture cite the property from ANOTHER
      // object's description, as the 2026-09-20 batch's referee did (a
      // real source, the wrong one): the reader keeps that answer with its
      // citation unverified, where a quote from nowhere is rejected outright.
      const citation = q.id === "property" ? { sourceId: answers.propertySource ?? `desc:${answers.target}`, quote: answers.descQuote } : { sourceId: "intent", quote: answers.intentQuote };
      return { questionId: q.id, answerKey: key, citation };
    });
}

async function half(openWorld: OpenWorld, principal: Principal, proposal: OpenProposal | null, transports: readonly ReaderTransport[]): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? openWorld.base.clock.wardenT(1) : openWorld.base.clock.prisonerT(1);
  return runOpenHalfRound({
    openWorld,
    resolver: buildOpenResolver(),
    referee: createReferee(transports),
    principal,
    roundN: 1,
    t,
    context: buildOpenContext(openWorld, principal, t, 1),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>(proposal),
  });
}

/** As `half`, but with presence modelled (OPEN-VARIANT.md §55) -- the arm
 *  under which the OTHER principal is a perceived object, and so the only
 *  one where a ruling can name a principal as its target. */
async function halfWithPresence(openWorld: OpenWorld, principal: Principal, proposal: OpenProposal | null, transports: readonly ReaderTransport[]): Promise<OpenHalfRoundResult> {
  const t = principal === "warden" ? openWorld.base.clock.wardenT(1) : openWorld.base.clock.prisonerT(1);
  return runOpenHalfRound({
    openWorld,
    resolver: buildOpenResolver(),
    referee: createReferee(transports),
    principal,
    roundN: 1,
    t,
    context: buildOpenContext(openWorld, principal, t, 1, undefined, undefined, "modelled"),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>(proposal),
  });
}

const BAR_WEAR = { target: "bar", effect: "wear", property: "integrity", intentQuote: "scrape the bar", descQuote: "Rust has pitted it near the bottom" };

// The same list invariants.test.ts scans describeAttempt with (§2 invariant 7).
const NEGATION_TOKENS = [" not ", " no ", "n't", "never", "nothing", "absence", "isn't", "doesn't", "cannot", "can't"];
function expectPositive(text: string): void {
  const lower = ` ${text.toLowerCase()} `;
  for (const token of NEGATION_TOKENS) expect(lower.includes(token), `"${text}" contains "${token}"`).toBe(false);
}

describe("renderOwnOutcome: what the actor learns from its own attempt, rendered by code", () => {
  afterEach(() => destroyTestDb());

  it("a resolved wear states the property's exact before and after", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", { intent: "I scrape the bar with my spoon." }, [ruling(BAR_WEAR)]);
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("bar");
    expect(text).toContain("100");
    expect(text).toContain("85");
    expectPositive(text);
  });

  it("a resolved reveal states the value revealed", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "warden", { intent: "I look the bar over." }, [
      ruling({ ...BAR_WEAR, effect: "reveal", intentQuote: "look the bar over", perceptibility: "silent" }),
    ]);
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("bar");
    expect(text).toContain("100");
    expectPositive(text);
  });

  it("an impossible ruling on a named object renders the object's own description as the positive reason", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    // The referee names the bar but cites nothing from its description.
    const result = await half(openWorld, "prisoner", { intent: "I bend the bar with my bare hands." }, [
      ruling({ ...BAR_WEAR, intentQuote: "bend the bar", descQuote: "made of butter" }),
    ]);
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("I bend the bar with my bare hands.");
    expect(text).toContain("Rust has pitted it near the bottom"); // the bar's authored description
    expectPositive(text);
  });

  it("an impossible ruling with no object named lists what the actor can reach", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", { intent: "I summon a locksmith." }, []);
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("I summon a locksmith.");
    expect(text).toContain("key ring");
    expectPositive(text);
  });

  // Issue #16: `perception.ts` used to tell EVERY `target: "none"` ruling
  // that the attempt "reached past what is here" -- wrong about the cause
  // whenever the intent named no object the world models at all (a person,
  // a belief), rather than a real one out of reach. The owner's own game
  // hit exactly this: "drop to the ground and pretend to be having a heart
  // attack" was ruled `target: none` (nothing about a person is in
  // `targetKeys`, referee.ts's own `buildQuestions`) and told him he had
  // "reached past what is here" -- read, correctly, as "stand closer".
  //
  // The referee's own `target` question (referee.ts, not touched by this
  // fix) already folds BOTH cases -- "names no object" and "names an object
  // this principal cannot reach or perceive" -- into the same closed key,
  // `"none"`, with the same kind of citation (a verbatim quote from the
  // actor's own intent, never the target's description, since there is no
  // target). Nothing in `RefereeRuling` distinguishes which of the two
  // happened -- `targetObjectId`, `citations.target` and `raw.answers`
  // carry a citation and a fromSafeDefault flag, but never a candidate
  // object that was named-but-unreachable, because `targetKeys` never
  // offers an id outside what THIS principal already perceives (an
  // unreachable object could not be named by id in the first place). So the
  // honest fix is one wording for every `target: "none"` ruling, that
  // claims only what the ruling actually shows -- nothing here was matched
  // -- and never a cause (distance, reach) the ruling cannot support.
  it("an impossible ruling with no object named does not blame the actor's reach (issue #16)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    // A referee that explicitly rules "none", with a real citation from the
    // actor's own intent -- not the empty-transports/safe-default path the
    // test above exercises, so this covers the OTHER way a "none" target
    // reaches renderOwnOutcome: a referee that looked and found no object.
    const result = await half(
      openWorld,
      "prisoner",
      { intent: "I drop to the ground and pretend to be having a heart attack." },
      [ruling({ target: "none", effect: "none", property: "none", intentQuote: "pretend to be having a heart attack", descQuote: "" })]
    );
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("drop to the ground and pretend to be having a heart attack");
    // The old wording read as "stand closer" -- wrong when nothing was
    // named at all. It must be gone, in both the safe-default case above
    // and this explicit-`none` case.
    expect(text).not.toMatch(/reached past/);
    expect(text).not.toMatch(/within your reach/);
    // What IS true, and all the ruling actually supports: nothing here
    // matched. Still lists what the actor can act on -- positive, useful
    // information the ruling does carry.
    expect(text).toContain("bar");
    expectPositive(text);
  });

  // OPEN-VARIANT.md §55 (issue #22 gap 2) made a principal a legal target and
  // fixed the `noise` branch, where "made the warden ring out" was nonsense.
  // The SAME nonsense survived one branch over, in the impossible path: a
  // human game (2026-09-18) bluffed the warden and was told its attempt "met
  // the warden as it is: She can be seen, heard, spoken to, or touched by
  // anyone who shares this room with her" -- the object wording ("met the bar
  // as it is") applied to a person, and the definite article and "as it is"
  // both read as though Croft were furniture. Once a principal can be a
  // target, EVERY outcome branch needs person-shaped wording, not only the
  // one that got caught first.
  it("an impossible ruling against a principal names them as a person, never as furniture (§55, issue #22 gap 2)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const result = await halfWithPresence(
      openWorld,
      "prisoner",
      { intent: "I tell the warden there is a riot going on outside and she should leave immediately.", line: "Look out behind you!" },
      [ruling({ target: "warden", effect: "none", property: "none", intentQuote: "tell the warden there is a riot", descQuote: "" })]
    );
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    // The person, by name -- not "the warden" as a definite-article object.
    expect(text).toContain("Warden Croft");
    // The wording this module CONTROLS: between the actor's own quoted
    // intent (which says "the warden" because the PLAYER typed it) and the
    // authored description (which says "Warden Croft, the warden" verbatim
    // and must survive untouched). Neither of those is this module's words.
    const wording = text.slice(text.lastIndexOf('")') + 2, text.indexOf(":", text.lastIndexOf('")')));
    expect(wording).not.toMatch(/the warden/i);
    expect(wording).not.toMatch(/as it is/);
    // Still the positive reason the object branch gives: what the actor
    // perceives of the target, verbatim from its own description.
    expect(text).toContain("on her feet");
    expectPositive(text);
  });

  it("a refusal states the value the world actually holds", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    setBelief(openWorld.base.gameId, "prisoner", "bar_integrity", 40, 0); // stale
    const result = await half(openWorld, "prisoner", { intent: "I scrape the bar with my spoon." }, [ruling(BAR_WEAR)]);
    expect(result.refusalError).toBeTruthy();
    const text = renderOwnOutcome(result) as string;
    expect(text).toContain("bar");
    expect(text).toContain("100");
    expectPositive(text);
  });

  it("silence renders nothing", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", null, []);
    expect(renderOwnOutcome(result)).toBeNull();
  });
});

describe("renderForOther: what the other principal perceives, and nothing more", () => {
  afterEach(() => destroyTestDb());

  it("relays the spoken line and a perceptible attempt, never a number or the intent text", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", { intent: "I scrape the bar with my spoon. SECRET_INTENT_MARKER", line: "Cold tonight." }, [
      ruling({ ...BAR_WEAR, intentQuote: "scrape the bar" }),
    ]);
    const lines = renderForOther(result);
    const joined = lines.join("\n");
    expect(joined).toContain("Cold tonight.");
    expect(joined).toContain("works at the bar");
    expect(joined).not.toContain("SECRET_INTENT_MARKER");
    expect(joined).not.toMatch(/\d/);
  });

  it("a silent attempt relays only the line; an empty line relays nothing", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", { intent: "I scrape the bar with my spoon.", line: "" }, [
      ruling({ ...BAR_WEAR, perceptibility: "silent" }),
    ]);
    expect(renderForOther(result)).toEqual([]);
  });
});

// OPEN-VARIANT.md §55 (issue #22 gap 2): a perceived principal is now a
// legal target, and `noise` at one is the routing the proposal describes --
// a full half-round, through the real referee, not a hand-built ruling.
describe("a principal as a target (OPEN-VARIANT.md §55, issue #22 gap 2)", () => {
  afterEach(() => destroyTestDb());

  it("a noise ruled at a perceived principal reads coherently in both the actor's own outcome and the target's own next briefing -- addressed by name, never a number or the intent's exact words", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const t = openWorld.base.clock.prisonerT(1);
    const context = buildOpenContext(openWorld, "prisoner", t, 1, 12, {}, "modelled");
    const target = context.perceivedObjects.find((o) => o.id === "warden");
    if (!target) throw new Error("presence did not make the warden perceivable");

    const result = await runOpenHalfRound({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([ruling({ target: "warden", effect: "noise", property: "none", intentQuote: "call out to the warden for help", descQuote: target.description })]),
      principal: "prisoner",
      roundN: 1,
      t,
      context,
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I call out to the warden for help." }),
      presenceMode: "modelled",
    });

    expect(result.outcome).toBeTruthy();
    expect(result.resourceName).toBeNull(); // no resource touched -- no belief possible

    const own = renderOwnOutcome(result) as string;
    expect(own).toContain("Warden Croft");
    expect(own).not.toContain("I call out to the warden for help."); // never the intent's own words
    expectPositive(own);

    const forOther = renderForOther(result).join("\n");
    expect(forOther).toContain("Warden Croft");
    expect(forOther).not.toMatch(/\d/);
    expectPositive(forOther);
  });
});

// OPUS-FIRST-DESIGN.md §3.2 (`checkpoints/2026-09-20-ambition/RESULTS.md`
// bug 3): the three deliberate sounds of that batch, each a warden's
// round-1/2 act under modelled presence, replayed as a full half-round through
// the real referee with the recorded keys scripted -- the property row cited
// from the INTENT, as every one of the three transcripts shows it. Each
// resolves `OPEN_NOISE` (a perceptible event with no state change, OPEN-
// VARIANT.md §4.2), touches no resource, and reaches the other chair through
// the SAME `perceptionForOther` routing §55 already built -- a noise ruled at
// a person reaches that person's next briefing by name, with nothing new
// added for it here.
describe("a noise needs no property, and its target may be none, an object, or a person (OPUS-FIRST-DESIGN.md §3.2)", () => {
  afterEach(() => destroyTestDb());

  /** The recorded ruling, keys as the transcript's referee table shows them:
   *  every citation from the intent, the property row included. */
  function recorded(keys: { target: string; effect: string; magnitude: string; perceptibility: string; quote: string }): ReaderTransport {
    return async (request) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey: ({ target: keys.target, effect: keys.effect, product: "none", property: "none", magnitude: keys.magnitude, perceptibility: keys.perceptibility } as Record<string, string>)[q.id] ?? q.safeDefault,
        citation: { sourceId: "intent", quote: keys.quote },
      }));
  }

  it("Q game: 'Speak to Voss to test her reactions' (prisoner/noise/none) resolves, and reaches Mara Voss's next briefing by name", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const intent = "Speak to Voss to test her reactions";
    const result = await halfWithPresence(openWorld, "warden", { intent }, [recorded({ target: "prisoner", effect: "noise", magnitude: "slight", perceptibility: "audible", quote: intent })]);

    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan?.mechanic).toBe("OPEN_NOISE");
    expect(result.outcome).toBeTruthy();
    expect(result.resourceName).toBeNull();
    expect(result.perceptionForOther).toContain(PRISONER_NAME);
    expect(renderForOther(result).join("\n")).toContain(PRISONER_NAME);
    const own = renderOwnOutcome(result) as string;
    expect(own).toContain(PRISONER_NAME);
    expectPositive(own);
  });

  it("D game: 'Rattle the key ring loudly ...' (key_ring/noise/none) resolves, and the prisoner perceives the sound from the key ring", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const intent = "Rattle the key ring loudly while standing by the door, watching Voss’s eyes and hands for any flicker toward tools or exits.";
    const result = await halfWithPresence(openWorld, "warden", { intent }, [recorded({ target: "key_ring", effect: "noise", magnitude: "moderate", perceptibility: "audible", quote: "Rattle the key ring loudly" })]);

    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan?.mechanic).toBe("OPEN_NOISE");
    expect(result.outcome).toBeTruthy();
    expect(result.resourceName).toBeNull();
    expect(result.perceptionForOther).toContain("key ring");
    expectPositive(result.perceptionForOther as string);
    expectPositive(renderOwnOutcome(result) as string);
  });

  it("O game: the slow circuit (none/noise/none) resolves as the warden's own sound -- no target, and nothing rendered as 'the none'", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const intent =
      "Walk a slow, deliberate circuit of the cell — pausing visibly at the window bars, the door, and the lock — while watching Voss's eyes to see what she tracks. Make pointed conversation to signal I'm paying close attention and to probe her composure.";
    const result = await halfWithPresence(openWorld, "warden", { intent }, [
      recorded({ target: "none", effect: "noise", magnitude: "moderate", perceptibility: "audible", quote: "Make pointed conversation to signal I'm paying close attention and to probe her composure." }),
    ]);

    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan?.mechanic).toBe("OPEN_NOISE");
    expect(result.outcome).toBeTruthy();
    expect(result.resourceName).toBeNull();
    const forOther = result.perceptionForOther as string;
    expect(forOther).toContain(WARDEN_NAME);
    expect(forOther).not.toMatch(/\bnone\b/);
    expectPositive(forOther);
    const own = renderOwnOutcome(result) as string;
    expect(own).not.toMatch(/\bnone\b/);
    expect(own).not.toContain(intent); // never the intent's own words
    expectPositive(own);
  });
});

describe("buildOpenContext with news: own outcome, the other's perceptible acts, beliefs", () => {
  afterEach(() => destroyTestDb());

  it("renders news and this principal's own beliefs into its briefing", () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    setBelief(openWorld.base.gameId, "prisoner", "bar_integrity", 85, 2);
    setBelief(openWorld.base.gameId, "warden", "bar_integrity", 55, 3);
    const context = buildOpenContext(openWorld, "prisoner", openWorld.base.clock.prisonerT(3), 3, 8, {
      ownOutcome: "OWN_OUTCOME_MARKER",
      fromOther: ["OTHER_ACT_MARKER"],
    });
    expect(context.briefing).toContain("OWN_OUTCOME_MARKER");
    expect(context.briefing).toContain("OTHER_ACT_MARKER");
    expect(context.briefing).toContain("bar integrity: 85 (as of round 2).");
    expect(context.briefing).not.toContain("55");
  });

  it("the warden sees its own live suspicion, and grounds once it reaches the threshold; the prisoner sees neither", () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const resolver = buildOpenResolver();
    resolver.resolve({
      gameId: openWorld.base.gameId,
      mechanic: "OPEN_RESTORE",
      parameters: { resourceId: openWorld.base.resources.wardenSuspicion, amount: 45, min: 0, max: 100, description: "x" },
    });
    const t = openWorld.base.clock.wardenT(2);
    const warden = buildOpenContext(openWorld, "warden", t, 2).briefing;
    const prisoner = buildOpenContext(openWorld, "prisoner", t, 2).briefing;
    expect(warden).toContain("warden suspicion: 45.");
    expect(warden).toContain("grounds");
    expect(prisoner).not.toContain("suspicion");
  });
});

// OPUS-FIRST-DESIGN.md §3.4 (third red team pass, §12): a refusal render
// must state the why. Measured on `checkpoints/2026-09-20-ambition/`, every
// sentence a refused actor was given was one of two shapes -- "met the X as
// it is: <its description>" or "matches none of what is here: <every
// object>" -- neither naming the effect that was attempted nor the reason the
// world said no. The renderer is code and holds the ruling's keys, so each
// refusal now states the target (as before), the effect attempted, and one
// of a small closed set of reasons derived from the keys alone. Fixtures:
// the batch's own refusal shapes (its target/effect/property rows), one test
// per shape, each asserting the exact sentence. Every sentence still passes
// `expectPositive` (§2 invariant 7), and never carries a number or a value
// the actor has not learned.
describe("a refusal states the why (OPUS-FIRST-DESIGN.md §3.4)", () => {
  afterEach(() => destroyTestDb());

  /** The perceived description the render is built from, so the assertion
   *  pins THIS module's frame exactly while the authored text stays free to
   *  change in `scenarioObjects.ts`. */
  function desc(result: OpenHalfRoundResult, id: string): string {
    return result.context.perceivedObjects.find((o) => o.id === id)?.description as string;
  }
  function reachable(result: OpenHalfRoundResult): string {
    return result.context.perceivedObjects.map((o) => o.id.replace(/_/g, " ")).join(", ");
  }
  /** A referee whose property question offers `posture` when a person is in
   *  view, exactly as `checkpoint.ts` wires the real one -- the batch's
   *  cot/wear/posture shape is unreachable through the default table. */
  async function halfWithPersonProperties(openWorld: OpenWorld, principal: Principal, proposal: OpenProposal, transports: readonly ReaderTransport[]): Promise<OpenHalfRoundResult> {
    const t = principal === "warden" ? openWorld.base.clock.wardenT(1) : openWorld.base.clock.prisonerT(1);
    return runOpenHalfRound({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee(transports, { propertiesOf: (id) => declaredPropertyKeys(openWorld, id) }),
      principal,
      roundN: 1,
      t,
      context: buildOpenContext(openWorld, principal, t, 1, undefined, undefined, "modelled"),
      mind: scriptedMind<OpenPrincipalContext, OpenProposal>(proposal),
    });
  }
  /** The batch's two `noise` refusals (key_ring/noise, prisoner/noise) were
   *  refused by the pre-§3.2 referee for a property citation that verified
   *  against nothing. §3.2 is another item's, and may make that ruling
   *  applicable; this renderer's contract is per RULING, so the shape is
   *  planted as the batch recorded it rather than re-derived. */
  function refusedAsRecorded(result: OpenHalfRoundResult): OpenHalfRoundResult {
    const ruling = result.ruling as NonNullable<OpenHalfRoundResult["ruling"]>;
    return { ...result, ruling: { ...ruling, applicable: false }, plan: null, outcome: null, perceptionForOther: null, refusalError: null };
  }

  it("meal_tray/none: the effect went unread", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "Collect the meal tray, spoon, tin cup, and bowl from the cell.";
    const result = await half(openWorld, "warden", { intent }, [ruling({ target: "meal_tray", effect: "none", property: "none", intentQuote: "Collect the meal", descQuote: "A shallow steel tray" })]);
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused, its effect on the meal tray left unread, and met the meal tray as it is: ${desc(result, "meal_tray")}`);
    expectPositive(text);
  });

  it("key_ring/none: the effect went unread", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "Lunge for the key ring on her belt and try to yank it free.";
    const result = await half(openWorld, "prisoner", { intent }, [ruling({ target: "key_ring", effect: "none", property: "none", intentQuote: "yank it free", descQuote: "A heavy iron ring" })]);
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused, its effect on the key ring left unread, and met the key ring as it is: ${desc(result, "key_ring")}`);
    expectPositive(text);
  });

  it("cot/none, door/none, bar/none, spoon/none: the effect went unread, for either chair", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    // Warden halves first: story time never runs backwards, and the
    // warden's first half-round sits before the prisoner's on the clock.
    const door = await half(openWorld, "warden", { intent: "Stand between Voss and the door, arms crossed, projecting authority." }, [ruling({ target: "door", effect: "none", property: "none", intentQuote: "and the door,", descQuote: "A heavy door" })]);
    expect(renderOwnOutcome(door)).toBe(`Your last attempt ("Stand between Voss and the door, arms crossed, projecting authority.") was refused, its effect on the door left unread, and met the door as it is: ${desc(door, "door")}`);
    const spoon = await half(openWorld, "warden", { intent: "Confiscate the spoon from the cell and pocket it." }, [ruling({ target: "spoon", effect: "none", property: "none", intentQuote: "Confiscate the spoon", descQuote: "A dented aluminium spoon" })]);
    expect(renderOwnOutcome(spoon)).toBe(`Your last attempt ("Confiscate the spoon from the cell and pocket it.") was refused, its effect on the spoon left unread, and met the spoon as it is: ${desc(spoon, "spoon")}`);
    const cot = await half(openWorld, "prisoner", { intent: "Sit on the cot and pull the blanket around you, appearing idle." }, [ruling({ target: "cot", effect: "none", property: "none", intentQuote: "Sit on the", descQuote: "A narrow cot" })]);
    expect(renderOwnOutcome(cot)).toBe(`Your last attempt ("Sit on the cot and pull the blanket around you, appearing idle.") was refused, its effect on the cot left unread, and met the cot as it is: ${desc(cot, "cot")}`);
    const bar = await half(openWorld, "prisoner", { intent: "Avoid drawing suspicion while preserving opportunity to damage the bar later; do nothing visible now." }, [ruling({ target: "bar", effect: "none", property: "none", intentQuote: "damage the bar", descQuote: "The iron bar" })]);
    expect(renderOwnOutcome(bar)).toBe(`Your last attempt ("Avoid drawing suspicion while preserving opportunity to damage the bar later; do nothing visible now.") was refused, its effect on the bar left unread, and met the bar as it is: ${desc(bar, "bar")}`);
    // The batch's bar/none intent contains "do nothing visible now" -- the
    // actor's own words, quoted verbatim; only this module's wording is held
    // to invariant 7, so strip the quote before scanning.
    for (const r of [cot, door, bar, spoon]) {
      const text = renderOwnOutcome(r) as string;
      expectPositive(text.slice(text.indexOf('")') + 2));
    }
  });

  it("prisoner/reveal with property none: the effect is named, the property went unread, and the person is met as a person", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const intent = "Watch Voss closely for any sign of what she is planning.";
    const result = await halfWithPresence(openWorld, "warden", { intent }, [ruling({ target: "prisoner", effect: "reveal", property: "none", intentQuote: "Watch Voss closely", descQuote: "" })]);
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to look closely at ${PRISONER_NAME}, which property it meant left unread, and met ${PRISONER_NAME}: ${desc(result, "prisoner")}`);
    expectPositive(text);
  });

  it("none/reveal and none/noise: the effect is named and the target went unread, still listing what is here", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const sweep = "Conduct a thorough pre-transfer security sweep of the cell.";
    const reveal = await half(openWorld, "warden", { intent: sweep }, [ruling({ target: "none", effect: "reveal", property: "integrity", intentQuote: "security sweep", descQuote: "" })]);
    expect(reveal.ruling?.applicable).toBe(false);
    expect(renderOwnOutcome(reveal)).toBe(`Your last attempt ("${sweep}") was refused as an attempt to look closely at something, its target left unread, and matches none of what is here: ${reachable(reveal)}.`);
    const circuit = "Walk a slow, deliberate circuit of the cell, making pointed conversation.";
    const noise = await half(openWorld, "warden", { intent: circuit }, [ruling({ target: "none", effect: "noise", property: "none", intentQuote: "pointed conversation", descQuote: "" })]);
    expect(renderOwnOutcome(noise)).toBe(`Your last attempt ("${circuit}") was refused as an attempt to make a noise, its target left unread, and matches none of what is here: ${reachable(noise)}.`);
    expectPositive(renderOwnOutcome(reveal) as string);
    expectPositive(renderOwnOutcome(noise) as string);
  });

  it("none/none (the referee offered nothing): both target and effect went unread", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "Explode into a dead sprint through the open cell door.";
    const result = await half(openWorld, "prisoner", { intent }, []);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused, both its target and its effect left unread, and matches none of what is here: ${reachable(result)}.`);
    expectPositive(text);
  });

  it("meal_tray/open and key_ring/open: the property the referee named is one the target lacks", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const tray = "Use the thin steel edge of the tray to push the bolt back through the gap.";
    const open1 = await half(openWorld, "prisoner", { intent: tray }, [ruling({ target: "meal_tray", effect: "open", property: "edge", intentQuote: "push the bolt back", descQuote: "A shallow steel tray" })]);
    expect(open1.ruling?.applicable).toBe(false);
    expect(renderOwnOutcome(open1)).toBe(`Your last attempt ("${tray}") was refused as an attempt to open the meal tray, edge being a property the meal tray lacks, and met the meal tray as it is: ${desc(open1, "meal_tray")}`);
    const keys = "Unhook the key ring from her belt and lever the bolt back out of the strike plate.";
    const open2 = await half(openWorld, "prisoner", { intent: keys }, [ruling({ target: "key_ring", effect: "open", property: "passage", intentQuote: "lever the bolt back", descQuote: "A heavy iron ring" })]);
    expect(renderOwnOutcome(open2)).toBe(`Your last attempt ("${keys}") was refused as an attempt to open the key ring, passage being a property the key ring lacks, and met the key ring as it is: ${desc(open2, "key_ring")}`);
    expectPositive(renderOwnOutcome(open1) as string);
    expectPositive(renderOwnOutcome(open2) as string);
  });

  it("spoon/reveal integrity, meal_tray/reveal integrity: a property the target lacks, whether or not the citation verified", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    // The warden's half first (story time never runs backwards), citing
    // `integrity` from the BAR's description on a ruling that targets the
    // tray, as the batch's referee did: a real source, the wrong one.
    const examine = "Collect the meal tray, then closely examine the window bar to verify its integrity.";
    const tray = await half(openWorld, "warden", { intent: examine }, [ruling({ target: "meal_tray", effect: "reveal", property: "integrity", intentQuote: "closely examine", descQuote: "Rust has pitted it", propertySource: "desc:bar" })]);
    expect(tray.ruling?.property).toBe("integrity");
    expect(tray.ruling?.citations.property.verified).toBe(false);
    expect(renderOwnOutcome(tray)).toBe(`Your last attempt ("${examine}") was refused as an attempt to look closely at the meal tray, integrity being a property the meal tray lacks, and met the meal tray as it is: ${desc(tray, "meal_tray")}`);
    // The batch's spoon/reveal/integrity cited the spoon's own words
    // verbatim ("worn flat from being scraped along the floor") and was
    // still refused: the spoon declares edge and concealment, never
    // integrity. A verified citation and an undeclared property together.
    const inspect = "Pick up the spoon and inspect its wear closely.";
    const spoon = await half(openWorld, "prisoner", { intent: inspect }, [ruling({ target: "spoon", effect: "reveal", property: "integrity", intentQuote: "inspect its wear closely", descQuote: "worn flat from being scraped along the floor" })]);
    expect(spoon.ruling?.applicable).toBe(false);
    expect(spoon.ruling?.citations.property.verified).toBe(true);
    expect(renderOwnOutcome(spoon)).toBe(`Your last attempt ("${inspect}") was refused as an attempt to look closely at the spoon, integrity being a property the spoon lacks, and met the spoon as it is: ${desc(spoon, "spoon")}`);
    expectPositive(renderOwnOutcome(spoon) as string);
    expectPositive(renderOwnOutcome(tray) as string);
  });

  it("cot/wear posture: a person's property named on furniture is one the cot lacks", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const intent = "Order Voss to sit on the cot to assert dominance.";
    // As the batch's referee did: `posture` cited from the PRISONER's own
    // description, on a ruling whose target is the cot.
    const result = await halfWithPersonProperties(openWorld, "warden", { intent }, [ruling({ target: "cot", effect: "wear", property: "posture", intentQuote: "sit on the", descQuote: "She is on her feet.", propertySource: "desc:prisoner" })]);
    expect(result.ruling?.property).toBe("posture");
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to wear at the cot, posture being a property the cot lacks, and met the cot as it is: ${desc(result, "cot")}`);
    expectPositive(text);
  });

  it("key_ring/noise and prisoner/noise, as the batch recorded them: the effect is named and the grounds went unverified", async () => {
    createTestDb();
    const openWorld = buildOpenWorld({ presence: "modelled" });
    const rattle = "Rattle the key ring loudly while standing by the door.";
    const ring = refusedAsRecorded(await halfWithPresence(openWorld, "warden", { intent: rattle }, [ruling({ target: "key_ring", effect: "noise", property: "none", intentQuote: "Rattle the key ring loudly", descQuote: "A heavy iron ring" })]));
    expect(renderOwnOutcome(ring)).toBe(`Your last attempt ("${rattle}") was refused as an attempt to make a noise with the key ring, its grounds in your words and in the key ring's description left unverified, and met the key ring as it is: ${desc(ring, "key_ring")}`);
    const speak = "Speak to Voss, asking how she is finding the food.";
    const person = refusedAsRecorded(await halfWithPresence(openWorld, "warden", { intent: speak }, [ruling({ target: "prisoner", effect: "noise", property: "none", intentQuote: "Speak to Voss", descQuote: "" })]));
    expect(renderOwnOutcome(person)).toBe(`Your last attempt ("${speak}") was refused as an attempt to call out to ${PRISONER_NAME}, its grounds in your words and in ${PRISONER_NAME}'s description left unverified, and met ${PRISONER_NAME}: ${desc(person, "prisoner")}`);
    expectPositive(renderOwnOutcome(ring) as string);
    expectPositive(renderOwnOutcome(person) as string);
  });

  it("a declared property cited from the wrong source: the grounds went unverified, never a claim the bar lacks integrity", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I bend the bar with my bare hands.";
    // `integrity` cited from the COT's description on a ruling that targets
    // the bar: the reader keeps the answer with its citation unverified (a
    // quote from nowhere, like "made of butter", is instead rejected outright
    // and the property falls to `none`, which is a different shape above).
    const result = await half(openWorld, "prisoner", { intent }, [ruling({ ...BAR_WEAR, intentQuote: "bend the bar", descQuote: "A narrow cot", propertySource: "desc:cot" })]);
    expect(result.ruling?.property).toBe("integrity");
    expect(result.ruling?.applicable).toBe(false);
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to wear at the bar, its grounds in your words and in the bar's description left unverified, and met the bar as it is: ${desc(result, "bar")}`);
    expectPositive(text);
  });

  it("a derive with no product read: what it would make went unread", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "Work something loose from the cot's frame.";
    const result = await half(openWorld, "prisoner", { intent }, [ruling({ target: "cot", effect: "derive", property: "none", intentQuote: "Work something loose", descQuote: "A narrow cot" })]);
    expect(result.ruling?.applicable).toBe(false);
    expect(result.ruling?.product).toBe("none");
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to make something from the cot, what it would make left unread, and met the cot as it is: ${desc(result, "cot")}`);
    expectPositive(text);
  });

  it("a tool the intent leans on that is missing (instrument absent, §51): stated as the reason", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I file the bar with the hacksaw.";
    const real = await half(openWorld, "prisoner", { intent }, [ruling({ ...BAR_WEAR, intentQuote: "file the bar" })]);
    const ruled = real.ruling as NonNullable<OpenHalfRoundResult["ruling"]>;
    const result: OpenHalfRoundResult = { ...real, ruling: { ...ruled, instrument: "absent", applicable: false }, plan: null, outcome: null, perceptionForOther: null, refusalError: null };
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to wear at the bar, a tool it leans on being missing from here, and met the bar as it is: ${desc(result, "bar")}`);
    expectPositive(text);
  });

  it("ruled applicable but the world has no leg for the pair (a conceal on integrity): an act outside what the world models", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I hide the rust on the bar with dirt.";
    const result = await half(openWorld, "prisoner", { intent }, [ruling({ target: "bar", effect: "conceal", property: "integrity", intentQuote: "hide the rust", descQuote: "Rust has pitted it near the bottom" })]);
    expect(result.ruling?.applicable).toBe(true);
    expect(result.plan).toBeNull();
    const text = renderOwnOutcome(result) as string;
    expect(text).toBe(`Your last attempt ("${intent}") was refused as an attempt to hide the bar, an act outside what this world models, and met the bar as it is: ${desc(result, "bar")}`);
    expectPositive(text);
  });

  it("never carries a number: a refusal on the bar states the property, never its integrity value", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const result = await half(openWorld, "prisoner", { intent: "I bend the bar with my bare hands." }, [ruling({ ...BAR_WEAR, intentQuote: "bend the bar", descQuote: "made of butter" })]);
    expect(renderOwnOutcome(result)).not.toMatch(/\d/);
  });
});
