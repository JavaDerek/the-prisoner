import { describe, it, expect, vi } from "vitest";
import { auditSentences, redact, createNarrationAuditor, buildAuditPrompt, type SentenceVerdict } from "../narrationAudit.js";
import { buildNarratorFacts, createNarrator } from "../narrator.js";
import type { OpenPrincipalContext } from "../mind.js";
import { PRISONER_NAME, WARDEN_NAME } from "../../scenario.js";

const CONTEXT: OpenPrincipalContext = {
  principalId: "p1",
  identity: "You are Mara Voss.",
  motive: "Get out.",
  briefing: ["Round 4 of 30.", "bar integrity: 80 (as of round 2)."].join("\n"),
  perceivedObjects: [{ id: "door", description: "A heavy door of iron-bound planks. It stands open now." }],
};

const FACTS = buildNarratorFacts(PRISONER_NAME, WARDEN_NAME, CONTEXT, []);

function fakeFetch(content: string): typeof fetch {
  return vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ choices: [{ message: { content } }] }) })) as unknown as typeof fetch;
}

const verdicts = (...v: [number, boolean, string][]) => JSON.stringify({ verdicts: v.map(([n, supported, why]) => ({ n, supported, why })) });

/**
 * §63. `verifyNarration` is mechanical and cannot catch a plausible sentence
 * that is simply false -- §54 wrote that down, and a human game on 2026-09-18
 * ran a whole escape under it with `Narrator rejections: 0` while being told
 * "the bar ... seems a little weaker than before" about a bar at 100 that it
 * had never touched.
 */
describe("the narration auditor: a second reader for what the checker cannot see", () => {
  it("cuts the sentences it finds unsupported and keeps the rest, in order", () => {
    const sentences = ["The door stands open.", "An ancient fan creaks in the corner.", "The planks are iron-bound."];
    const cut: SentenceVerdict[] = [{ sentence: "An ancient fan creaks in the corner.", supported: false, why: "no such object" }];
    expect(redact(sentences, cut)).toBe("The door stands open. The planks are iron-bound.");
  });

  it("splits a narration the same way the mechanical checker does", () => {
    expect(auditSentences("One. Two! Three?  ")).toEqual(["One.", "Two!", "Three?"]);
  });

  it("shows the prose that survived, and reports what it cut", async () => {
    const narration = "The door stands open. An ancient fan creaks in the corner.";
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch(verdicts([1, true, "ok"], [2, false, "mentions a fan"])) });
    const result = await auditor.audit(FACTS, narration);
    expect(result.audited).toBe(true);
    expect(result.kept).toBe("The door stands open.");
    expect(result.unsupported.map((u) => u.why)).toEqual(["mentions a fan"]);
  });

  // The failure mode this whole design is steering around: a checker so strict
  // that the mode it guards can never run (§58.1). An auditor that is merely
  // OPINIONATED must cost a sentence, never the turn.
  it("keeps a narration whose every sentence passes, untouched", async () => {
    const narration = "The door stands open. The planks are iron-bound.";
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch(verdicts([1, true, ""], [2, true, ""])) });
    expect((await auditor.audit(FACTS, narration)).kept).toBe(narration);
  });

  it("leaves the narration whole when the auditor is unreachable, rather than silently ending the narrated view", async () => {
    const narration = "The door stands open.";
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch("not json at all") });
    const result = await auditor.audit(FACTS, narration);
    expect(result.audited).toBe(false);
    expect(result.kept).toBe(narration);
  });

  it("ignores a verdict about a sentence that does not exist rather than guessing which one was meant", async () => {
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch(verdicts([1, true, ""], [9, false, "off the end"])) });
    const result = await auditor.audit(FACTS, "The door stands open.");
    expect(result.unsupported).toEqual([]);
  });

  it("gives the auditor the facts and every sentence, numbered", () => {
    const prompt = buildAuditPrompt(FACTS, ["First one.", "Second one."]);
    expect(prompt).toContain("A heavy door of iron-bound planks");
    expect(prompt).toContain("1. First one.");
    expect(prompt).toContain("2. Second one.");
  });
});

describe("the narrator with an auditor attached", () => {
  const narration = "The door stands open. An ancient fan creaks in the corner.";
  const narratorFetch = fakeFetch(JSON.stringify({ narration }));

  it("shows the audited remainder, never the sentence the auditor cut", async () => {
    const onRedacted = vi.fn();
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch(verdicts([1, true, ""], [2, false, "mentions a fan"])) });
    const result = await createNarrator({ baseUrl: "http://x", model: "narrator", fetchFn: narratorFetch, auditor, onRedacted }).narrate(PRISONER_NAME, WARDEN_NAME, CONTEXT, []);
    expect(result).toBe("The door stands open.");
    expect(onRedacted).toHaveBeenCalledTimes(1);
  });

  it("falls back to the prose view when the auditor leaves nothing standing", async () => {
    const auditor = createNarrationAuditor({ baseUrl: "http://x", model: "auditor", fetchFn: fakeFetch(verdicts([1, false, "invented"], [2, false, "invented"])) });
    expect(await createNarrator({ baseUrl: "http://x", model: "narrator", fetchFn: narratorFetch, auditor }).narrate(PRISONER_NAME, WARDEN_NAME, CONTEXT, [])).toBeNull();
  });

  it("behaves exactly as before §63 when no auditor is configured", async () => {
    expect(await createNarrator({ baseUrl: "http://x", model: "narrator", fetchFn: narratorFetch }).narrate(PRISONER_NAME, WARDEN_NAME, CONTEXT, [])).toBe(narration);
  });
});
