import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { createRefereeTransport } from "../refereeTransport.js";
import { runOpenGame, type OpenGameResult } from "../game.js";
import { renderOpenHalfRound, renderOpenSummary, refereeRequestsFor, fogAudit } from "../checkpointTranscript.js";
import { replayTranscript } from "../replay.js";
import type { OpenHalfRoundResult } from "../loop.js";
import type { ElaborationRuling } from "../elaborationReferee.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { scriptedReferee, RULINGS, SCRAPE, EXAMINE, OPEN_DOOR, LEAVE_DOOR, WORK_LOCK } from "./helpers/scriptedReferee.js";

const IMPOSSIBLE = "I pray for the walls to fall.";

async function playCatchGame(): Promise<OpenGameResult> {
  createTestDb();
  const openWorld = buildOpenWorld();
  let prisonerTurn = 0;
  // Turn 1 is ruled impossible (not in RULINGS); later turns scrape the bar.
  const prisonerMind = {
    async consider(): Promise<OpenProposal> {
      prisonerTurn += 1;
      return prisonerTurn === 1
        ? { intent: IMPOSSIBLE, thoughts: "PRISONER_THOUGHTS_MARKER", notes: "PRISONER_NOTES_MARKER" }
        : { intent: SCRAPE, line: "Cold tonight." };
    },
  };
  return runOpenGame({
    openWorld,
    resolver: buildOpenResolver(),
    referee: createReferee([scriptedReferee(RULINGS)]),
    wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: EXAMINE, thoughts: "WARDEN_THOUGHTS_MARKER" }),
    prisonerMind,
    rounds: 8,
  });
}

function find(game: OpenGameResult, roundN: number, principal: "warden" | "prisoner"): OpenHalfRoundResult {
  const half = game.halves.find((h) => h.roundN === roundN && h.principal === principal);
  if (!half) throw new Error(`no half-round ${roundN} ${principal}`);
  return half;
}

/** A half-round whose ruling was applicable but produced no plan -- the
 *  branch #8 is about. Built directly, since reaching it through a real game
 *  needs a referee that rules an incoherent combination on purpose. */
function halfWithRuling(over: { targetObjectId: string; property: string; effectKind: string; product: string }): OpenHalfRoundResult {
  return {
    principal: "prisoner",
    t: 1,
    roundN: 1,
    context: { principalId: "p", identity: "", motive: "", briefing: "B", perceivedObjects: [] },
    proposal: { intent: "x" },
    ruling: {
      applicable: true,
      targetObjectId: over.targetObjectId,
      effectKind: over.effectKind,
      property: over.property,
      product: over.product,
      magnitude: "slight",
      perceptibility: "silent",
      citations: {
        target: { verified: true, citation: null },
        effect: { verified: true, citation: null },
        property: { verified: true, citation: null },
        product: { verified: true, citation: null },
      },
      raw: { answers: [], unmatched: [] },
      request: { questions: [], sources: [] },
    } as unknown as OpenHalfRoundResult["ruling"],
    plan: null,
    outcome: null,
    refusalError: null,
    perceptionForOther: null,
    revealFor: null,
    derived: null,
    reshaped: null,
    pick: null,
    resourceName: null, elaboration: null, acquired: null,
  };
}

describe("open checkpoint transcript", () => {
  afterEach(() => destroyTestDb());

  it("a ruled half-round shows the briefing, the intent, every referee answer with its citation and whether it verified, and the outcome", async () => {
    const game = await playCatchGame();
    const text = renderOpenHalfRound(find(game, 2, "prisoner")).join("\n");
    expect(text).toContain("the prisoner");
    expect(text).toContain("**Briefing given, verbatim:**");
    expect(text).toContain(`**Intent:** ${SCRAPE}`);
    expect(text).toContain("| target | `bar` | intent: \"scrape at the rusted base of the bar\" | yes |");
    expect(text).toContain("| property | `integrity` | desc:bar: \"Rust has pitted it near the bottom\" | yes |");
    expect(text).toContain("**Ruled:** possible");
    expect(text).toContain("bar_integrity: 100 -> 75");
    expect(text).toContain("**Actor learns:**");
    expect(text).toContain("**Other perceives:**");
  });

  it("an open ruled on a part labels the transition by the resource the plan wrote, not the part's own property (#6, OPEN-VARIANT.md §19)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: WORK_LOCK }),
      rounds: 1,
    });
    const half = find(game, 1, "prisoner");
    // The referee named the lock and its integrity; what the plan wrote is
    // the DOOR's passage, and that is the only thing the reader may be told
    // changed -- the lock's integrity still stands at 100.
    expect(half.ruling?.targetObjectId).toBe("lock");
    expect(half.plan?.parameters.wayOut).toBe("door");
    const text = renderOpenHalfRound(half).join("\n");
    expect(text).toContain("door_passage: 0 -> 1");
    expect(text).not.toContain("lock_integrity");
  });

  it("a ruling the scenario cannot ground says WHY, and never asserts a declared pair is undeclared (#8)", () => {
    // The real 2026-09-16 game-3 case: derive `wire` from the `bar`. `wire`
    // comes from the cot, so `planDerive` refuses -- but `bar.integrity` IS
    // declared, and the old line said it was not.
    const text = renderOpenHalfRound(halfWithRuling({ targetObjectId: "bar", property: "integrity", effectKind: "derive", product: "wire" })).join("\n");
    expect(text).not.toContain("is not declared in the scenario");
    expect(text).toContain("wire");
    expect(text).toContain("bar");
    expect(text).toMatch(/did nothing/);

    // A pair that genuinely is not declared still says so.
    const undeclared = renderOpenHalfRound(halfWithRuling({ targetObjectId: "cot", property: "edge", effectKind: "wear", product: "none" })).join("\n");
    expect(undeclared).toContain("did nothing");
  });

  it("an impossible ruling shows the safe defaults and the positive reason the actor is given", async () => {
    const game = await playCatchGame();
    const text = renderOpenHalfRound(find(game, 1, "prisoner")).join("\n");
    expect(text).toContain("**Ruled:** impossible");
    expect(text).toContain("| target | `none` | (none) | no |");
    // issue #16: "within your reach are:" implied a distance/reach failure
    // that the ruling never established; the honest wording says only what
    // the ruling shows -- nothing here was matched -- and still names what
    // is here.
    expect(text).toContain("matches none of what is here:");
  });

  it("offers the reader rejected are shown with their reason, and questions the referee offered nothing for are named", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I scrape the bar with my spoon.";
    // Property is offered with a paraphrased quote; perceptibility is never offered at all.
    const transport = async (request: { questions: readonly { id: string }[] }) =>
      request.questions
        .filter((q) => q.id !== "perceptibility")
        .map((q) => ({
          questionId: q.id,
          answerKey: { target: "bar", effect: "wear", property: "integrity", magnitude: "slight" }[q.id] as string,
          citation: q.id === "property" ? { sourceId: "desc:bar", quote: "PARAPHRASED_RUST_QUOTE" } : { sourceId: "intent", quote: "scrape the bar" },
        }));
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([transport]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
      rounds: 1,
    });
    const text = renderOpenHalfRound(find(game, 1, "prisoner")).join("\n");
    expect(text).toMatch(/property: rejected \(\S+\) `integrity`, desc:bar: "PARAPHRASED_RUST_QUOTE"/);
    expect(text).toContain("No offer from the referee for: perceptibility.");
  });

  it("a referee reply the transport could not read is named in the ruling, not shown as a clean all-`none` table (OPUS-FIRST-DESIGN.md §3.1)", async () => {
    // §3.1, RESULTS.md bug 1 of checkpoints/2026-09-20-ambition: the lost ruling rendered as six
    // safe defaults and "No offer from the referee for: ..." -- the same line a referee that
    // answered nothing would get -- with the only evidence in the sidecar's raw content.
    createTestDb();
    const openWorld = buildOpenWorld();
    const transport = createRefereeTransport({
      baseUrl: "http://x",
      model: "m",
      fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '[{"questionId": "target", "answerKey": "bar",}]' } }] }) })) as unknown as typeof fetch,
    });
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([transport]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I scrape the bar with my spoon." }),
      rounds: 1,
    });
    const text = renderOpenHalfRound(find(game, 1, "prisoner")).join("\n");
    expect(text).toMatch(/Referee call failed \(rung 0\): referee reply unparseable/);
    expect(text).toContain("No offer from the referee for: target, effect, product, property, magnitude, perceptibility.");
  });

  it("OPEN-VARIANT.md §51, the-prisoner#17: PRISONER_INSTRUMENT=checked shows the referee's seventh question, with its own citation and verified flag", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I pick the lock using the wire.";
    const transport = async (request: { questions: readonly { id: string }[] }) =>
      request.questions.map((q) => ({
        questionId: q.id,
        answerKey: ({ target: "lock", effect: "open", property: "integrity", magnitude: "moderate", perceptibility: "silent", instrument: "absent" } as Record<string, string>)[q.id] ?? "none",
        citation: q.id === "property" ? { sourceId: "desc:lock", quote: "A steel lock" } : { sourceId: "intent", quote: q.id === "instrument" ? "using the wire" : "pick the lock" },
      }));
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([transport], { instrumentMode: "checked" }),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
      rounds: 1,
    });
    const half = find(game, 1, "prisoner");
    const text = renderOpenHalfRound(half).join("\n");
    expect(text).toContain('| instrument | `absent` | intent: "using the wire" | yes |');
    expect(half.ruling?.applicable).toBe(false);
    expect(half.ruling?.missingInstrument).toEqual({ citation: { sourceId: "intent", quote: "using the wire" } });
  });

  it("off (the default): no instrument row is shown at all -- the arm never asked the question", async () => {
    const game = await playCatchGame();
    const text = renderOpenHalfRound(find(game, 2, "prisoner")).join("\n");
    expect(text).not.toContain("| instrument |");
  });

  it("a citation given as a word range shows the range and the quote rebuilt from it, accepted or rejected (OPEN-VARIANT.md §18.3)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const intent = "I scrape the bar with my spoon.";
    const words = (from: number, to: number, sourceId = "intent") => ({ sourceId, from, to });
    const content = JSON.stringify([
      { questionId: "target", answerKey: "bar", citation: words(2, 4) },
      { questionId: "effect", answerKey: "wear", citation: words(2, 2) },
      { questionId: "product", answerKey: "none", citation: words(2, 4) },
      { questionId: "property", answerKey: "integrity", citation: words(20, 26, "desc:bar") },
      { questionId: "magnitude", answerKey: "enormous", citation: words(5, 7) },
      { questionId: "perceptibility", answerKey: "audible", citation: { sourceId: "intent", quote: "scrape the bar" } },
    ]);
    const fetchFn = (async () => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) })) as unknown as typeof fetch;
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([createRefereeTransport({ baseUrl: "http://x", model: "m", fetchFn })]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(null),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
      rounds: 1,
    });
    const half = find(game, 1, "prisoner");
    const text = renderOpenHalfRound(half).join("\n");
    expect(text).toContain('| target | `bar` | intent, words 2-4: "scrape the bar" | yes |');
    expect(text).toContain('| property | `integrity` | desc:bar, words 20-26: "Rust has pitted it near the bottom," | yes |');
    // A quote given instead is shown as a quote, as before.
    expect(text).toContain('| perceptibility | `audible` | intent: "scrape the bar" | n/a |');
    expect(text).toContain('magnitude: rejected (unknown-answer-key) `enormous`, intent, words 5-7: "with my spoon."');
    expect(half.ruling?.citations.property.citation).toEqual({ sourceId: "desc:bar", quote: "Rust has pitted it near the bottom,", from: 20, to: 26 });
    expect(renderOpenSummary(game).join("\n")).toContain('grounding desc:bar, words 20-26: "Rust has pitted it near the bottom,"');
  });

  it("a forced pick shows the mind's own intent and every candidate's verdict, so an override is never silent (§21)", () => {
    const text = renderOpenHalfRound({
      principal: "prisoner",
      t: 3,
      roundN: 2,
      context: { principalId: "p", identity: "", motive: "", briefing: "B", perceivedObjects: [] },
      proposal: { intent: "Lift the tile." },
      pick: { own: "Scrape the bar.", forced: true, overridden: true, verdicts: [{ candidate: "Scrape the bar.", verdict: "seen" }, { candidate: "Lift the tile.", verdict: "unseen" }] },
      ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, resourceName: null, elaboration: null, acquired: null,
    }).join("\n");
    expect(text).toContain("**Forced pick:** overrode the mind's own intent: Scrape the bar.");
    expect(text).toContain("- seen: Scrape the bar.");
    expect(text).toContain("- unseen: Lift the tile.");
  });

  it("candidates the mind considered are shown for audit, never silently dropped (mother-of-invention#1, 'iterate' half)", () => {
    const text = renderOpenHalfRound({
      principal: "warden",
      t: 2,
      roundN: 1,
      context: { principalId: "w", identity: "", motive: "", briefing: "B", perceivedObjects: [] },
      proposal: {
        intent: "Examine the lock closely.",
        candidates: [
          { text: "Examine the bar closely.", reason: "check for damage" },
          { text: "Examine the lock closely.", reason: "check the other exit" },
        ],
      },
      ruling: null,
      plan: null,
      outcome: null,
      refusalError: null,
      perceptionForOther: null,
      revealFor: null,
      derived: null,
      reshaped: null, pick: null, resourceName: null, elaboration: null, acquired: null,
    }).join("\n");
    expect(text).toContain("**Candidates:**");
    expect(text).toContain("Examine the bar closely. (check for damage)");
    expect(text).toContain("Examine the lock closely. (check the other exit)");
  });

  it("a silent half-round shows its reason and raw text", () => {
    const text = renderOpenHalfRound(
      { principal: "warden", t: 2, roundN: 1, context: { principalId: "w", identity: "", motive: "", briefing: "B", perceivedObjects: [] }, proposal: null, ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null, revealFor: null, derived: null, reshaped: null, pick: null, resourceName: null, elaboration: null, acquired: null },
      { reason: "unparseable", text: "RAW_MODEL_TEXT" }
    ).join("\n");
    expect(text).toContain("**Silence.** SilenceReason: `unparseable`");
    expect(text).toContain("RAW_MODEL_TEXT");
  });

  // the-prisoner#20's own finding: a voice call that fails degrades to an empty
  // line, and nothing in the open variant's transcript ever said so -- the
  // fragment rule added under §52 would have been invisible in the evidence it
  // exists to produce.
  it("a half-round that acted but whose VOICE failed says so, without claiming the half-round was silent", () => {
    const text = renderOpenHalfRound(
      {
        principal: "warden", t: 2, roundN: 1,
        context: { principalId: "w", identity: "", motive: "", briefing: "B", perceivedObjects: [] },
        proposal: { intent: "I examine the bar closely." },
        ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null,
        revealFor: null, derived: null, reshaped: null, pick: null, resourceName: null, elaboration: null, acquired: null,
      },
      undefined,
      { reason: "rejected", text: "Voss," }
    ).join("\n");
    expect(text).toContain("**Voice silence.** SilenceReason: `rejected`");
    expect(text).toContain("Voss,");
    expect(text).not.toContain("**Silence.**");
  });

  // Regression from tonight's own #15 fix: the transcript records
  // `half.context.briefing`, and the briefing used to carry each object's
  // description, so a transcript happened to show what a mind was shown about
  // the cell. With that duplication removed (§49) the object list lives only in
  // the prompt, which the transcript never recorded -- so the channel a mind
  // actually learns through (an authored description plus its state readings,
  // e.g. "It stands open now") stopped appearing in the evidence. #6 and #7
  // both turn on exactly that channel.
  it("records what the mind perceived: the ids, and in full any description that has changed from the authored one", () => {
    const text = renderOpenHalfRound({
      principal: "warden", t: 2, roundN: 1,
      context: {
        principalId: "w", identity: "", motive: "", briefing: "B",
        perceivedObjects: [
          { id: "bar", description: "The iron bar that closes the widest gap in the cell's small window, about as thick as a thumb. Rust has pitted it near the bottom, where it is set into old mortar that is dry and cracked." },
          { id: "window", description: "A small window set in the wall at shoulder height. It stands open now: the bar is out of its widest gap." },
        ],
      },
      proposal: { intent: "I look around." },
      ruling: null, plan: null, outcome: null, refusalError: null, perceptionForOther: null,
      revealFor: null, derived: null, reshaped: null, pick: null, resourceName: null, elaboration: null, acquired: null,
    }).join("\n");
    // Every id it could act on, so the target answer key set is recoverable.
    expect(text).toContain("**Perceived:** bar, window");
    // The changed description in full -- this is the sentence a mind reasons from.
    expect(text).toContain("It stands open now: the bar is out of its widest gap.");
    // The unchanged one is not repeated: it is in the header, once.
    expect(text).not.toContain("dry and cracked");
  });

  it("referee requests: one entry per ruled half-round, labelled, carrying the exact request for replay", async () => {
    const game = await playCatchGame();
    const requests = refereeRequestsFor(game.halves);
    expect(requests.length).toBe(game.halves.length);
    expect(requests[1].label).toBe(`round 1, prisoner: ${IMPOSSIBLE}`);
    expect(requests[1].request.sources.find((s) => s.id === "intent")?.text).toBe(IMPOSSIBLE);
    expect(requests[1].request.questions.map((q) => q.id)).toEqual(["target", "effect", "product", "property", "magnitude", "perceptibility"]);
  });

  it("elaboration: a SECOND sidecar entry per half-round it fired on, labelled distinctly, and `npm run referee-replay` reads it unchanged (WORLD-ELABORATION-DESIGN.md §4.2, §9 row P1b)", async () => {
    const elaboration: ElaborationRuling = {
      targetObjectId: "loose_tile",
      need: "passage",
      citation: { citation: { sourceId: "desc:loose_tile", quote: "a hollow of dry grit" }, requiredSourceId: "desc:loose_tile", verified: true },
      raw: { answers: [], unmatched: [] },
      request: {
        questions: [{ id: "need", prompt: "which property?", answerKeys: ["integrity", "edge", "concealment", "passage", "none"], safeDefault: "none" }],
        sources: [
          { id: "intent", text: "I lift the loose tile." },
          { id: "desc:loose_tile", text: "a hollow of dry grit" },
        ],
      },
    };
    const half: OpenHalfRoundResult = { ...halfWithRuling({ targetObjectId: "loose_tile", property: "concealment", effectKind: "wear", product: "none" }), elaboration };

    const requests = refereeRequestsFor([half]);
    // One base entry, one elaboration entry -- the base request's own shape
    // (the-prisoner's own load-bearing constraint) is untouched by this.
    expect(requests.length).toBe(2);
    expect(requests[0].label).toBe("round 1, prisoner: x");
    expect(requests[1].label).toBe("round 1, prisoner, elaboration: x");
    expect(requests[1].request.questions.map((q) => q.id)).toEqual(["need"]);

    // "npm run referee-replay must replay it with no change" (§9 row P1b) --
    // proved by feeding the exact sidecar shape `refereeRequestsFor` writes
    // into the real replay tool (`replay.ts`) with a scripted transport.
    const replayed = await replayTranscript(
      requests,
      [async (request) => request.questions.map((q) => ({ questionId: q.id, answerKey: "passage", citation: { sourceId: "desc:loose_tile", quote: "a hollow of dry grit" } }))],
      3
    );
    expect(replayed.length).toBe(2);
    expect(replayed[1].label).toBe(requests[1].label);
    expect(replayed[1].agreements).toEqual([{ questionId: "need", mostCommonKey: "passage", agreementRate: 1, sampleSize: 3 }]);
  });

  it("referee requests carry each rung's raw exchange beside the request, when the transport kept one (OPEN-VARIANT.md §38)", async () => {
    createTestDb();
    const inner = scriptedReferee(RULINGS);
    const transport = Object.assign((request: Parameters<typeof inner>[0]) => inner(request), {
      lastExchange: () => ({ content: "RAW_REPLY_MARKER", status: 200, ms: 7 }),
    });
    const game = await runOpenGame({
      openWorld: buildOpenWorld(),
      resolver: buildOpenResolver(),
      referee: createReferee([transport]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: EXAMINE }),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: SCRAPE }),
      rounds: 1,
    });
    const requests = refereeRequestsFor(game.halves);
    expect(requests[0].replies).toEqual([{ content: "RAW_REPLY_MARKER", status: 200, ms: 7 }]);
    // A transport that keeps nothing records nothing, and the entry stays replayable.
    expect(refereeRequestsFor((await playCatchGame()).halves)[0].replies).toEqual([null]);
  });

  it("fog audit: no context holds the other principal's private text -- and a planted leak is caught", async () => {
    const game = await playCatchGame();
    expect(fogAudit(game.halves)).toEqual({ checked: game.halves.length, leaks: [] });

    const planted = game.halves.map((h) =>
      h.roundN === 2 && h.principal === "warden" ? { ...h, context: { ...h.context, briefing: `${h.context.briefing} PRISONER_NOTES_MARKER` } } : h
    );
    expect(fogAudit(planted).leaks).toEqual([{ roundN: 2, principal: "warden", field: "notes" }]);
  });

  it("fog audit: a candidate the mind considered but did not act on still counts as private text, and a leak of one is caught", async () => {
    const game = await playCatchGame();
    const withCandidate = game.halves.map((h) =>
      h.roundN === 2 && h.principal === "prisoner" && h.proposal
        ? { ...h, proposal: { ...h.proposal, candidates: [{ text: "PRISONER_CANDIDATE_MARKER_NOT_CHOSEN", reason: "considered, not picked" }] } }
        : h
    );
    expect(fogAudit(withCandidate).leaks).toEqual([]);

    const planted = withCandidate.map((h) =>
      h.roundN === 3 && h.principal === "warden" ? { ...h, context: { ...h.context, briefing: `${h.context.briefing} PRISONER_CANDIDATE_MARKER_NOT_CHOSEN` } } : h
    );
    expect(fogAudit(planted).leaks).toEqual([{ roundN: 3, principal: "warden", field: "candidates" }]);
  });

  it("fog audit: the other's text found only inside this principal's OWN longer text is not a leak (§34.4, batch K game 4)", async () => {
    const game = await playCatchGame();
    const OWN_PLAN = "Check the loose tile for hidden items or escape routes, then the bar.";
    const THEIR_CANDIDATE = "Check the loose tile for hidden items";
    const edited = game.halves.map((h) => {
      if (h.roundN === 1 && h.principal === "warden" && h.proposal) return { ...h, proposal: { ...h.proposal, plan: OWN_PLAN } };
      if (h.roundN === 2 && h.principal === "prisoner" && h.proposal) return { ...h, proposal: { ...h.proposal, candidates: [{ text: THEIR_CANDIDATE, reason: "r" }] } };
      if (h.roundN === 2 && h.principal === "warden") return { ...h, context: { ...h.context, briefing: `${h.context.briefing}\nYour plan, from your last turn: ${OWN_PLAN}` } };
      return h;
    });
    expect(fogAudit(edited).leaks).toEqual([]);

    // The same text standing on its own in the briefing is still caught.
    const planted = edited.map((h) => (h.roundN === 3 && h.principal === "warden" ? { ...h, context: { ...h.context, briefing: `${h.context.briefing}\n${THEIR_CANDIDATE}.` } } : h));
    expect(fogAudit(planted).leaks).toEqual([{ roundN: 3, principal: "warden", field: "candidates" }]);
  });

  it("fog audit: text BOTH principals wrote themselves is theirs to see, never a leak", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    const same = { intent: "I sit on the cot and wait.", notes: "IDENTICAL_NOTES_BOTH_SIDES" };
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>(same),
      prisonerMind: scriptedMind<OpenPrincipalContext, OpenProposal>(same),
      rounds: 2,
    });
    expect(fogAudit(game.halves).leaks).toEqual([]);
  });

  it("summary: the measurements, every impossible and novel intent listed, the result and the fog audit", async () => {
    const game = await playCatchGame();
    const text = renderOpenSummary(game).join("\n");
    expect(text).toContain("**The warden caught the prisoner, at round 5.**"); // §33.5: the bar is caught at 30, not 50
    expect(text).toContain("Ruled impossible: 1.");
    expect(text).toContain(`round 1, prisoner: ${IMPOSSIBLE}`);
    expect(text).toContain("Novel (object, effect) pairs with no closed-variant equivalent: 0.");
    expect(text).toContain("Fog audit: 9 contexts checked, 0 leaks.");
  });

  it("a half-round that leaves the cell shows the move, not '(no state changed)' (OPEN-VARIANT.md §12)", async () => {
    createTestDb();
    const openWorld = buildOpenWorld();
    let turn = 0;
    const game = await runOpenGame({
      openWorld,
      resolver: buildOpenResolver(),
      referee: createReferee([scriptedReferee(RULINGS)]),
      wardenMind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I wait." }),
      prisonerMind: { async consider() { turn += 1; return { intent: turn === 1 ? OPEN_DOOR : LEAVE_DOOR }; } },
      rounds: 3,
    });
    const text = renderOpenHalfRound(find(game, 2, "prisoner")).join("\n");
    expect(text).toContain("went out through the door");
    expect(text).toContain(`location_id: ${openWorld.base.cellId} -> ${openWorld.exits.door.destinationId}`);
    expect(text).not.toContain("(no state changed)");
    expect(renderOpenSummary(game).join("\n")).toContain("**The prisoner escaped, at round 2.**");
  });
});

