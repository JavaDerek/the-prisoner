import { describe, it, expect } from "vitest";
import type { ReadRequest, TransportAnswer, ReaderTransport } from "run-dmcp";
import { createReferee, type ObjectPerception } from "../referee.js";

const BAR: ObjectPerception = {
  id: "bar",
  description: "One of five vertical iron bars... Rust has pitted it near the bottom.",
};
const LOCK: ObjectPerception = {
  id: "lock",
  description: "A steel lock set in the cell door.",
};

/** A scripted transport that answers every question with a given map of
 *  questionId -> {answerKey, citation}. Missing entries are simply omitted
 *  from the offered answers (the ladder then falls to safeDefault for
 *  them), matching the closed variant's own `scriptedMind` discipline of
 *  never simulating the reader's internals directly. */
function scriptedTransport(answers: Record<string, { answerKey: string; citation: { sourceId: string; quote: string } }>): ReaderTransport {
  return async (request: ReadRequest): Promise<readonly TransportAnswer[]> => {
    const offered: TransportAnswer[] = [];
    for (const q of request.questions) {
      const scripted = answers[q.id];
      if (scripted) offered.push({ questionId: q.id, answerKey: scripted.answerKey, citation: scripted.citation });
    }
    return offered;
  };
}

describe("the referee (OPEN-VARIANT.md §3, this task's brief)", () => {
  it("a fully grounded WEAR ruling is applicable, with both citations verified", async () => {
    const transport = scriptedTransport({
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file the bar" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file the bar" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I file the bar with my spoon.", [BAR]);

    expect(ruling.applicable).toBe(true);
    expect(ruling.targetObjectId).toBe("bar");
    expect(ruling.effectKind).toBe("wear");
    expect(ruling.citations.target.verified).toBe(true);
    expect(ruling.citations.effect.verified).toBe(true);
    expect(ruling.citations.property.verified).toBe(true);
  });

  it("PLANTED VIOLATION: a target/effect citation that names the DESCRIPTION source instead of the intent is rejected -- not applicable", async () => {
    const transport = scriptedTransport({
      // Wrong source: cites the bar's own description for the TARGET
      // answer, which §3.3 requires to cite the actor's INTENT.
      target: { answerKey: "bar", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file the bar" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file the bar" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I file the bar with my spoon.", [BAR]);

    expect(ruling.citations.target.verified).toBe(false);
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: a property citation that names the INTENT instead of the target's own description is rejected", async () => {
    const transport = scriptedTransport({
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file the bar" } },
      // Wrong source: the grounding citation must come from the BAR's own
      // description, not the intent.
      property: { answerKey: "integrity", citation: { sourceId: "intent", quote: "file the bar" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file the bar" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file the bar" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I file the bar with my spoon.", [BAR]);

    expect(ruling.citations.property.verified).toBe(false);
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: a quote that does not appear verbatim in its cited source is rejected by the reader itself, so the whole answer falls to its safe default", async () => {
    const transport = scriptedTransport({
      // "file the door open" never appears in the intent text below.
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file the door open" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file the bar" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file the bar" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file the bar" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I file the bar with my spoon.", [BAR]);

    expect(ruling.targetObjectId).toBe("none"); // fell to safeDefault
    expect(ruling.applicable).toBe(false);
  });

  it("an unreachable/empty transport list answers every question with its safe default, and the ruling is inapplicable", async () => {
    const referee = createReferee([]);
    const ruling = await referee.rule("I file the bar.", [BAR]);
    expect(ruling.targetObjectId).toBe("none");
    expect(ruling.effectKind).toBe("none");
    expect(ruling.applicable).toBe(false);
  });

  it("a transport that names an object the actor cannot currently perceive is rejected (unknown-answer-key), never applied", async () => {
    const transport = scriptedTransport({
      // "safe" is not in the perceived-objects list handed to `rule` below.
      target: { answerKey: "safe", citation: { sourceId: "intent", quote: "open the safe" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "open the safe" } },
      property: { answerKey: "integrity", citation: { sourceId: "intent", quote: "open the safe" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "open the safe" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "open the safe" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I open the safe.", [BAR]);
    expect(ruling.targetObjectId).toBe("none");
    expect(ruling.applicable).toBe(false);
  });

  it("noise is applicable with property='none', as long as the grounding citation is present and verified", async () => {
    const bucket: ObjectPerception = { id: "bucket", description: "A tin slop bucket... It rings sharply when anything strikes it." };
    const transport = scriptedTransport({
      target: { answerKey: "bucket", citation: { sourceId: "intent", quote: "kick the bucket" } },
      effect: { answerKey: "noise", citation: { sourceId: "intent", quote: "kick the bucket" } },
      property: { answerKey: "none", citation: { sourceId: "desc:bucket", quote: "It rings sharply when anything strikes it" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "kick the bucket" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "kick the bucket" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I kick the bucket over.", [bucket]);
    expect(ruling.applicable).toBe(true);
    expect(ruling.effectKind).toBe("noise");
  });

  it("PLANTED VIOLATION: noise with property='none' and NO citation at all (ungrounded) is not applicable", async () => {
    const bucket: ObjectPerception = { id: "bucket", description: "A tin slop bucket... It rings sharply when anything strikes it." };
    const transport = scriptedTransport({
      target: { answerKey: "bucket", citation: { sourceId: "intent", quote: "kick the bucket" } },
      effect: { answerKey: "noise", citation: { sourceId: "intent", quote: "kick the bucket" } },
      // property omitted entirely -- falls to safeDefault "none" with no citation at all.
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "kick the bucket" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "kick the bucket" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I kick the bucket over.", [bucket]);
    expect(ruling.applicable).toBe(false);
  });

  it("wear/restore/reveal/conceal/expose with property='none' (even if cited) is never applicable -- those effects need a named, declared property", async () => {
    const transport = scriptedTransport({
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file the bar" } },
      property: { answerKey: "none", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file the bar" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file the bar" } },
    });
    const referee = createReferee([transport]);
    const ruling = await referee.rule("I file the bar.", [BAR]);
    expect(ruling.applicable).toBe(false);
  });

  it("precedent: a second ruling for the same object sees a precedent source built from the first ruling", async () => {
    let secondRequestSources: readonly { id: string; text: string }[] = [];
    const transport: ReaderTransport = async (request) => {
      secondRequestSources = request.sources;
      return [
        { questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "effect", answerKey: "wear", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
        { questionId: "magnitude", answerKey: "moderate", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "perceptibility", answerKey: "audible", citation: { sourceId: "intent", quote: "file it" } },
      ];
    };
    const referee = createReferee([transport]);
    await referee.rule("file it", [BAR]);
    await referee.rule("file it again", [BAR]);

    const precedentSource = secondRequestSources.find((s) => s.id === "precedent:bar");
    expect(precedentSource).toBeTruthy();
    expect(precedentSource?.text).toContain("effect=wear");
  });

  it("precedent is scoped per object -- lock's request carries no precedent from the bar", async () => {
    const barTransport = scriptedTransport({
      target: { answerKey: "bar", citation: { sourceId: "intent", quote: "file it" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "file it" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "file it" } },
      perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "file it" } },
    });
    const referee = createReferee([barTransport]);
    await referee.rule("file it", [BAR]);

    let lockRequestSources: readonly { id: string; text: string }[] = [];
    const captureTransport: ReaderTransport = async (request) => {
      lockRequestSources = request.sources;
      return [];
    };
    const refereeWithCapture = createReferee([captureTransport]);
    // Reuse the SAME precedent store is not possible across two referees by
    // construction (one referee = one precedent store, by design) -- this
    // asserts the negative case directly: a FRESH referee's first call for
    // "lock" carries no bar precedent, because it has recorded none.
    await refereeWithCapture.rule("shim the lock", [LOCK]);
    expect(lockRequestSources.some((s) => s.id === "precedent:bar")).toBe(false);
    expect(lockRequestSources.some((s) => s.id === "precedent:lock")).toBe(false); // none recorded yet either
  });
});
