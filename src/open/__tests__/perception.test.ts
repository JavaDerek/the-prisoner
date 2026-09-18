import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import type { ReaderTransport } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { runOpenHalfRound, type OpenHalfRoundResult } from "../loop.js";
import { buildOpenContext } from "../briefing.js";
import { renderOwnOutcome, renderForOther } from "../perception.js";
import { setBelief } from "../../ledger/beliefs.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import type { Principal } from "../../ledger/beliefs.js";

/** A scripted referee transport: every question gets the answer named in
 *  `answers`, cited against the intent or the target's own description. */
function ruling(answers: { target: string; effect: string; property: string; magnitude?: string; perceptibility?: string; intentQuote: string; descQuote: string }): ReaderTransport {
  return async (request) =>
    request.questions.map((q) => {
      const key = { target: answers.target, effect: answers.effect, property: answers.property, magnitude: answers.magnitude ?? "moderate", perceptibility: answers.perceptibility ?? "audible" }[q.id] as string;
      const citation = q.id === "property" ? { sourceId: `desc:${answers.target}`, quote: answers.descQuote } : { sourceId: "intent", quote: answers.intentQuote };
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
