import { describe, it, expect, afterEach } from "vitest";
import { scriptedMind } from "mind-seam";
import { PRISONER_PRONOUNS, WARDEN_PRONOUNS, PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";
import { OPEN_PERSONS } from "../scenarioObjects.js";
import { describeAttempt, runOpenHalfRound } from "../loop.js";
import { renderOwnOutcome } from "../perception.js";
import { createTestDb, destroyTestDb } from "../../world/testDb.js";
import { buildOpenWorld, declaredProperty, declaredPropertyKeys, derivedKindOf } from "../world.js";
import { computePerceivedObjects, buildOpenContext } from "../briefing.js";
import { buildOpenResolver } from "../mechanics.js";
import { createReferee } from "../referee.js";
import { scriptedReferee, type ScriptedRuling } from "./helpers/scriptedReferee.js";
import type { OpenPrincipalContext, OpenProposal } from "../mind.js";
import { buildNarratorFacts, buildNarratorPrompt } from "../narrator.js";
import { openConditions } from "../conditions.js";
import { renderOpenHalfRound } from "../checkpointTranscript.js";

/**
 * The-prisoner#34: discrepancy 8 (docs/ARCHITECTURE.md) -- two authors picked two different literal
 * pronouns for the same person. `scenario.ts` now declares one `Pronouns` set per principal
 * (`PRISONER_PRONOUNS`/`WARDEN_PRONOUNS`), and every generated sentence about a person is required to
 * build from it. This file is the pin: it renders every site the issue names -- descriptions, the
 * D4'/D12 reading bands, the custody perception outcomes and `describeAttempt`'s lines -- for BOTH
 * principals, and asserts each rendering contains only the pronoun tokens the scenario declared for
 * the principal that sentence is ABOUT, never the other principal's.
 *
 * The check is a closed list of English pronoun tokens against this repository's OWN generated
 * strings -- checking our own output, never reading a model's intent (CLAUDE.md's "never
 * pattern-match meaning" is about ruling on free text, not a unit test asserting on code we wrote
 * ourselves).
 */

const PRISONER_ONLY = ["he", "him", "his", "himself"];
const WARDEN_ONLY = ["she", "her", "hers", "herself"];

/** Every token in `forbidden` (case-insensitively, whole-word) that appears in `text`. */
function forbiddenTokensIn(text: string, forbidden: readonly string[]): string[] {
  return forbidden.filter((tok) => new RegExp(`\\b${tok}\\b`, "i").test(text));
}

function expectOnlyPronounsFor(principal: "prisoner" | "warden", text: string): void {
  const forbidden = principal === "prisoner" ? PRISONER_ONLY : WARDEN_ONLY;
  expect(forbiddenTokensIn(text, forbidden), `"${text}" carries a pronoun not declared for ${principal}`).toEqual([]);
}

describe("the-prisoner#34: every sentence about a principal uses only that principal's own declared pronoun", () => {
  afterEach(() => destroyTestDb());

  it("OPEN_PERSONS' own descriptions", () => {
    const prisoner = OPEN_PERSONS.find((p) => p.id === "prisoner")!;
    const warden = OPEN_PERSONS.find((p) => p.id === "warden")!;
    expect(prisoner.description).toContain(PRISONER_NAME);
    expect(warden.description).toContain(WARDEN_NAME);
    expectOnlyPronounsFor("prisoner", prisoner.description);
    expectOnlyPronounsFor("warden", warden.description);
    expect(prisoner.description).toMatch(/\bShe\b/);
    expect(warden.description).toMatch(/\bHe\b/);
  });

  it("the posture reading bands (D5, issue #22 gap 3), for both principals", () => {
    for (const person of OPEN_PERSONS) {
      const posture = person.properties.find((p) => p.key === "posture");
      for (const band of posture?.readRanges ?? []) {
        expectOnlyPronounsFor(person.id as "prisoner" | "warden", band.text);
      }
    }
    const wardenPosture = OPEN_PERSONS.find((p) => p.id === "warden")!.properties.find((p) => p.key === "posture");
    expect(wardenPosture?.readRanges?.some((r) => /\bHe\b/.test(r.text))).toBe(true);
  });

  it("the sight reading bands (D12), for both principals", () => {
    for (const person of OPEN_PERSONS) {
      const sight = person.properties.find((p) => p.key === "sight");
      for (const band of sight?.readRanges ?? []) {
        expectOnlyPronounsFor(person.id as "prisoner" | "warden", band.text);
      }
    }
    const wardenSight = OPEN_PERSONS.find((p) => p.id === "warden")!.properties.find((p) => p.key === "sight");
    expect(wardenSight?.readRanges?.some((r) => /\bhis\b/i.test(r.text))).toBe(true);
  });

  it("computePerceivedObjects renders each principal's description with only its own pronoun", () => {
    createTestDb();
    const world = buildOpenWorld({ presence: "modelled" });
    const seenByPrisoner = computePerceivedObjects(world, "prisoner", world.base.clock.prisonerT(1), "modelled");
    const warden = seenByPrisoner.find((o) => o.id === "warden")!;
    const prisonerSelf = seenByPrisoner.find((o) => o.id === "prisoner")!;
    expectOnlyPronounsFor("warden", warden.description);
    expectOnlyPronounsFor("prisoner", prisonerSelf.description);
  });

  it("describeAttempt's block case (D4'), for both principals", () => {
    const prisonerLine = describeAttempt("prisoner", { targetObjectId: "window", effectKind: "block" });
    const wardenLine = describeAttempt("warden", { targetObjectId: "window", effectKind: "block" });
    expect(prisonerLine).toContain(PRISONER_NAME);
    expect(wardenLine).toContain(WARDEN_NAME);
    expectOnlyPronounsFor("prisoner", prisonerLine);
    expectOnlyPronounsFor("warden", wardenLine);
    expect(prisonerLine).toContain(PRISONER_PRONOUNS.reflexive);
    expect(wardenLine).toContain(WARDEN_PRONOUNS.reflexive);
  });

  /**
   * The custody perception outcomes (docs/CUSTODY-DESIGN.md): a refused OPEN_TAKE names the HOLDER
   * ("but Warden Croft is on his feet and keeps it"), and a resolved OPEN_GIVE names the RECIPIENT
   * ("she holds it now" / "he holds it now"). Both used to hardcode "her"/"she" regardless of which
   * principal that was -- correct only because every recorded transcript's holder/recipient in that
   * spot happened to be the warden's OWN reach onto Voss, or Voss's gift TO Croft. Run both
   * directions through the real half-round pipeline (`runOpenHalfRound`, exactly as `custody.test.ts`
   * does) so the fix is proven dynamic, not just still hardcoded to the one direction every existing
   * test happened to exercise.
   */
  describe("custody perception outcomes, both directions", () => {
    const SNATCH_KEYS = "I snatch the key ring from Croft's belt.";
    const REACH_SPOON = "I reach for the spoon in Voss's hand.";
    const GIVE_KEYS = "I hand Voss the key ring.";
    const GIVE_SPOON = "I hand Croft the spoon.";
    const rulings: Record<string, ScriptedRuling> = {
      [SNATCH_KEYS]: { target: "key_ring", effect: "take", property: "none", magnitude: "moderate", perceptibility: "visible", intentQuote: "snatch the key ring", descQuote: "A heavy iron ring" },
      [REACH_SPOON]: { target: "spoon", effect: "take", property: "none", magnitude: "moderate", perceptibility: "visible", intentQuote: "reach for the spoon", descQuote: "A dented aluminium spoon" },
      [GIVE_KEYS]: { target: "key_ring", effect: "give", property: "none", magnitude: "slight", perceptibility: "visible", intentQuote: "hand Voss the key ring", descQuote: "A heavy iron ring" },
      [GIVE_SPOON]: { target: "spoon", effect: "give", property: "none", magnitude: "slight", perceptibility: "visible", intentQuote: "hand Croft the spoon", descQuote: "A dented aluminium spoon" },
    };

    function setup() {
      createTestDb();
      const openWorld = buildOpenWorld({ presence: "modelled" });
      const referee = createReferee([scriptedReferee(rulings)], {
        isDeclared: (objectId, key) => declaredProperty(openWorld, objectId, key) !== undefined,
        kindOf: (id) => derivedKindOf(openWorld, id),
        propertiesOf: (id) => declaredPropertyKeys(openWorld, id),
      });
      return { w: openWorld, referee };
    }
    async function half(s: ReturnType<typeof setup>, principal: "prisoner" | "warden", intent: string, roundN: number) {
      const t = principal === "prisoner" ? s.w.base.clock.prisonerT(roundN) : s.w.base.clock.wardenT(roundN);
      return runOpenHalfRound({
        openWorld: s.w,
        resolver: buildOpenResolver(),
        referee: s.referee,
        principal,
        roundN,
        t,
        context: buildOpenContext(s.w, principal, t, roundN, 12, {}, "modelled"),
        mind: scriptedMind<OpenPrincipalContext, OpenProposal>({ intent }),
        presenceMode: "modelled",
      });
    }

    it("refused take: the prisoner reaches for what the warden (the holder) keeps -- 'he is on his feet'", async () => {
      const s = setup();
      const result = await half(s, "prisoner", SNATCH_KEYS, 1);
      expect(result.outcome?.result.taken).toBe(false);
      const text = renderOwnOutcome(result)!;
      expect(text).toContain(WARDEN_NAME);
      expect(text).toContain(`${WARDEN_NAME} is on ${WARDEN_PRONOUNS.possessive} feet and keeps it`);
      expectOnlyPronounsFor("warden", text);
      // The transcript's own "kept:" line (checkpointTranscript.ts) names the same holder.
      expect(renderOpenHalfRound(result).join("\n")).toContain(`kept: the holder is on ${WARDEN_PRONOUNS.possessive} feet`);
    });

    it("refused take: the warden reaches for what the prisoner (the holder) keeps -- 'she is on her feet'", async () => {
      const s = setup();
      const result = await half(s, "warden", REACH_SPOON, 1);
      expect(result.outcome?.result.taken).toBe(false);
      const text = renderOwnOutcome(result)!;
      expect(text).toContain(PRISONER_NAME);
      expect(text).toContain(`${PRISONER_NAME} is on ${PRISONER_PRONOUNS.possessive} feet and keeps it`);
      expectOnlyPronounsFor("prisoner", text);
      expect(renderOpenHalfRound(result).join("\n")).toContain(`kept: the holder is on ${PRISONER_PRONOUNS.possessive} feet`);
    });

    it("resolved give: the warden hands the prisoner the keys -- 'she holds it now'", async () => {
      const s = setup();
      const given = await half(s, "warden", GIVE_KEYS, 1);
      expect(given.outcome?.result.given).toBe(true);
      const text = renderOwnOutcome(given)!;
      expect(text).toContain(PRISONER_NAME);
      expect(text).toContain(`${PRISONER_NAME}: ${PRISONER_PRONOUNS.subject} holds it now`);
      expectOnlyPronounsFor("prisoner", text);
    });

    it("resolved give: the prisoner hands the warden the spoon -- 'he holds it now'", async () => {
      const s = setup();
      const given = await half(s, "prisoner", GIVE_SPOON, 1);
      expect(given.outcome?.result.given).toBe(true);
      const text = renderOwnOutcome(given)!;
      expect(text).toContain(WARDEN_NAME);
      expect(text).toContain(`${WARDEN_NAME}: ${WARDEN_PRONOUNS.subject} holds it now`);
      expectOnlyPronounsFor("warden", text);
    });
  });

  it("the narrator's own instruction line (§61.1), for whichever chair it addresses", () => {
    const context: OpenPrincipalContext = { principalId: "p1", identity: "x", motive: "x", briefing: "x", perceivedObjects: [] };
    const wardenSelf = buildNarratorPrompt(WARDEN_NAME, PRISONER_NAME, buildNarratorFacts(WARDEN_NAME, PRISONER_NAME, context, []));
    const prisonerSelf = buildNarratorPrompt(PRISONER_NAME, WARDEN_NAME, buildNarratorFacts(PRISONER_NAME, WARDEN_NAME, context, []));
    const wardenLine = wardenSelf.split("\n").find((l) => l.includes("Write about"))!;
    const prisonerLine = prisonerSelf.split("\n").find((l) => l.includes("Write about"))!;
    expect(wardenLine).toContain(`${WARDEN_PRONOUNS.possessive} name`);
    expect(wardenLine).toContain(`"${WARDEN_PRONOUNS.subject}"`);
    expect(prisonerLine).toContain(`${PRISONER_PRONOUNS.possessive} name`);
    expect(prisonerLine).toContain(`"${PRISONER_PRONOUNS.subject}"`);
    // Every OTHER "Write about"/self-address instruction line in the whole prompt is about the
    // addressed chair only, so the pronoun check applies to the WHOLE prompt, not just this line.
    expectOnlyPronounsFor("warden", wardenSelf.split("\n").filter((l) => l.includes(WARDEN_NAME) && !l.includes(PRISONER_NAME)).join(" "));
  });

  it("the block condition (PLAYTEST-2026-09-27 D4', conditions.ts): always about the warden, who stands in the way out", () => {
    const conditions = openConditions({ block: "on" });
    const blockCondition = conditions.find((c) => c.when.some((w) => w.includes("stands in a way out")))!;
    expect(blockCondition.when.join(" ")).toContain(`${WARDEN_PRONOUNS.possessive} feet`);
    expectOnlyPronounsFor("warden", blockCondition.when.join(" "));
  });
});
