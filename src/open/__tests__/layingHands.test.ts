import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import type { Resolver } from "run-dmcp";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { readNumericFact } from "../../world/facts.js";
import { buildOpenWorld, type OpenWorld } from "../world.js";
import { buildOpenResolver } from "../mechanics.js";
import { buildOpenContext } from "../briefing.js";
import type { EffectKind } from "../effects.js";
import type { Referee, RefereeRuling } from "../referee.js";
import { runOpenHalfRound, suspicionEligibleFor, type OpenHalfRoundResult } from "../loop.js";
import { renderSeatSituation, type OpenPrincipalContext, type OpenProposal } from "../mind.js";
import { openConditions } from "../conditions.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import type { Principal } from "../../ledger/beliefs.js";
import { SEARCH_SUSPICION_THRESHOLD, FILE_SUSPICION_BUMP } from "../../world/mechanics.js";

/**
 * D13, the owner's decision of 2026-09-27 on OPEN-VARIANT.md §80 (the laying-on of hands): an act by the
 * prisoner on the WARDEN's own body gives grounds at once. In the same half-round, through audited resolutions
 * only, `warden_suspicion` rises to at least `SEARCH_SUSPICION_THRESHOLD` (40) when it is below it -- "The warden
 * has been laid hands on." -- and THEN by the act's ordinary magnitude bump on top. The §56 exemption stays for
 * the actor's OWN body (her collapse damages nothing), and the warden acting on hers never moves his own number.
 */

function ruling(targetObjectId: string, effectKind: EffectKind, property: RefereeRuling["property"], magnitude: RefereeRuling["magnitude"] = "moderate"): RefereeRuling {
  const cited = { citation: { sourceId: "intent", quote: "x" }, requiredSourceId: "intent", verified: true };
  return {
    targetObjectId,
    effectKind,
    property,
    magnitude,
    perceptibility: "visible",
    product: "none",
    applicable: true,
    citations: { target: cited, effect: cited, property: { citation: { sourceId: `desc:${targetObjectId}`, quote: "x" }, requiredSourceId: `desc:${targetObjectId}`, verified: true }, product: cited },
    raw: { answers: [], unmatched: [], rungs: [] },
    request: { questions: [], sources: [] },
  };
}

/** The real resolver, recording every resolution's description in order. */
function recordingResolver(descriptions: string[]): Resolver {
  const real = buildOpenResolver();
  return {
    mechanics: () => real.mechanics(),
    resolve: (req) => {
      const outcome = real.resolve(req);
      descriptions.push(String((req.parameters as { description?: unknown }).description));
      return outcome;
    },
  };
}

function suspicionAt(w: OpenWorld, t: number): number {
  return readNumericFact({ gameId: w.base.gameId, t, entityId: w.base.resources.wardenSuspicion, key: "value" }) ?? 0;
}

/** A starting suspicion laid down through the resolver (never a direct write). */
function raiseSuspicion(w: OpenWorld, amount: number): void {
  buildOpenResolver().resolve({ gameId: w.base.gameId, mechanic: "OPEN_RESTORE", parameters: { resourceId: w.base.resources.wardenSuspicion, amount, min: 0, max: 100, description: "set up" } });
}

async function act(w: OpenWorld, principal: Principal, r: RefereeRuling, descriptions: string[]): Promise<OpenHalfRoundResult> {
  const t = principal === "prisoner" ? w.base.clock.prisonerT(1) : w.base.clock.wardenT(1);
  const referee: Referee = { rule: async () => r };
  return runOpenHalfRound({
    openWorld: w,
    resolver: recordingResolver(descriptions),
    referee,
    principal,
    roundN: 1,
    t,
    context: buildOpenContext(w, principal, t, 1, 12, {}, "modelled"),
    mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent: "I do it." }),
    presenceMode: "modelled",
  });
}

describe("D13: an act on the other principal's body gives grounds, then the bump (owner, 2026-09-27, §80)", () => {
  afterEach(() => destroyTestDb());

  it("she covers his head (moderate wear on his sight) from suspicion 0: 40 for the grounds, then +10 -> 50", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const descriptions: string[] = [];
    const h = await act(w, "prisoner", ruling("warden", "wear", "sight"), descriptions);
    expect(h.outcome).not.toBeNull();
    expect(suspicionAt(w, h.t)).toBe(SEARCH_SUSPICION_THRESHOLD + FILE_SUSPICION_BUMP);
    expect(suspicionAt(w, h.t)).toBe(50);
    // Grounds first, then the ordinary bump, each its own audited resolution after the act itself.
    expect(descriptions.slice(-2)).toEqual(["The warden has been laid hands on.", "The warden grows more suspicious."]);
  });

  it("from suspicion 60 the floor does nothing: only the bump, -> 70", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    raiseSuspicion(w, 60);
    const descriptions: string[] = [];
    const h = await act(w, "prisoner", ruling("warden", "wear", "sight"), descriptions);
    expect(suspicionAt(w, h.t)).toBe(70);
    expect(descriptions).not.toContain("The warden has been laid hands on.");
  });

  it("tripping him (moderate wear on his posture) is the same act on his body: 0 -> 50", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const h = await act(w, "prisoner", ruling("warden", "wear", "posture"), []);
    expect(suspicionAt(w, h.t)).toBe(50);
  });

  it("her own collapse (a wear on her own posture) still raises nothing -- the §56 exemption for the actor's own body", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const h = await act(w, "prisoner", ruling("prisoner", "wear", "posture", "substantial"), []);
    expect(h.outcome).not.toBeNull();
    expect(suspicionAt(w, h.t)).toBe(0);
  });

  it("the warden searching her never moves his own number", async () => {
    createTestDb();
    const w = buildOpenWorld({ presence: "modelled" });
    const h = await act(w, "warden", ruling("prisoner", "expose", "none"), []);
    expect(h.outcome?.result.mechanic).toBe("OPEN_SEARCH");
    expect(suspicionAt(w, h.t)).toBe(0);
  });

  it("the ordinary bump's own eligibility is unchanged: a person target is not a thing damaged", () => {
    expect(suspicionEligibleFor("wear", "prisoner")).toBe(false);
    expect(suspicionEligibleFor("wear", "warden")).toBe(false);
  });
});

describe("D13 is stated to both chairs, beside the suspicion sentence", () => {
  const CONTEXT: OpenPrincipalContext = { principalId: "p1", identity: "x", motive: "x", briefing: "Round 1 of 12.", perceivedObjects: [] };
  const LINE = `An act on ${WARDEN_NAME}'s own body gives grounds at once: warden suspicion rises to at least ${SEARCH_SUSPICION_THRESHOLD}, then by the act's own amount.`;

  for (const [self, other] of [[PRISONER_NAME, WARDEN_NAME], [WARDEN_NAME, PRISONER_NAME]] as const) {
    for (const conditions of [undefined, openConditions({ door: "stated", doorPrice: "margin", block: "on" })]) {
      it(`${self}'s prompt carries the rule line right after the suspicion sentence (${conditions ? "with" : "without"} a condition list)`, () => {
        const lines = renderSeatSituation(self, other, CONTEXT, conditions).split("\n");
        const at = lines.findIndex((l) => l.startsWith(`Whenever ${PRISONER_NAME} audibly or visibly damages`));
        expect(at).toBeGreaterThanOrEqual(0);
        expect(lines[at + 1]).toBe(LINE);
      });
    }
  }
});
