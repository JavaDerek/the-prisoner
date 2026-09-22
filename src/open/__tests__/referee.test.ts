import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import type { ReadRequest, TransportAnswer, ReaderTransport } from "run-dmcp";
import { createReferee, readInstrumentMode, readDeriveWordingMode, readOneActMode, ONE_ACT_QUESTION, type ObjectPerception } from "../referee.js";
import { suspicionEligible } from "../loop.js";

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

  // OPUS-FIRST-DESIGN.md §3.2, from `checkpoints/2026-09-20-ambition/RESULTS.md`
  // bug 3: every deliberate sound in that batch -- 3 of 3 -- was ruled
  // impossible, because the property question's citation was held to the
  // target's own `desc:` source for `noise` exactly as for `wear`, and a
  // noise has no property whose description could ground it. Each of the
  // three recorded rulings is rebuilt here by hand, keys and citations as
  // the transcript's referee table shows them (the property row cited from
  // the INTENT, verified `no`), with no model call. A noise needs no
  // property: its grounding is the effect citation, from the intent.
  describe("a noise needs no property (OPUS-FIRST-DESIGN.md §3.2)", () => {
    const MARA: ObjectPerception = {
      id: "prisoner",
      description: "Mara Voss, the prisoner. She can be seen, heard, spoken to, or touched by anyone who shares this room with her. She is on her feet.",
    };
    const KEY_RING: ObjectPerception = {
      id: "key_ring",
      description: "A heavy iron ring on Croft's belt holding four keys, one of them long-shanked and brass. The keys clink against each other when Croft walks.",
    };

    it("Q game, round 1 warden: 'Speak to Voss to test her reactions' -- prisoner/noise/none, property cited from the intent -- is applicable", async () => {
      const intent = "Speak to Voss to test her reactions";
      const transport = scriptedTransport({
        target: { answerKey: "prisoner", citation: { sourceId: "intent", quote: "Voss" } },
        effect: { answerKey: "noise", citation: { sourceId: "intent", quote: intent } },
        product: { answerKey: "none", citation: { sourceId: "intent", quote: intent } },
        property: { answerKey: "none", citation: { sourceId: "intent", quote: intent } },
        magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: intent } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: intent } },
      });
      const ruling = await createReferee([transport], { propertiesOf: (id) => (id === "prisoner" ? ["posture"] : []) }).rule(intent, [BAR, MARA]);
      expect(ruling.targetObjectId).toBe("prisoner");
      expect(ruling.effectKind).toBe("noise");
      expect(ruling.property).toBe("none");
      expect(ruling.citations.property.verified).toBe(false); // exactly as recorded
      expect(ruling.applicable).toBe(true);
    });

    it("D game, round 2 warden: 'Rattle the key ring loudly ...' -- key_ring/noise/none, property cited from the intent -- is applicable", async () => {
      const intent = "Rattle the key ring loudly while standing by the door, watching Voss’s eyes and hands for any flicker toward tools or exits.";
      const transport = scriptedTransport({
        target: { answerKey: "key_ring", citation: { sourceId: "intent", quote: "Rattle the key" } },
        effect: { answerKey: "noise", citation: { sourceId: "intent", quote: "Rattle the key ring loudly" } },
        product: { answerKey: "none", citation: { sourceId: "intent", quote: "Rattle the key ring loudly" } },
        property: { answerKey: "none", citation: { sourceId: "intent", quote: "Rattle the key ring loudly" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "loudly" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "loudly" } },
      });
      const ruling = await createReferee([transport]).rule(intent, [BAR, KEY_RING]);
      expect(ruling.targetObjectId).toBe("key_ring");
      expect(ruling.effectKind).toBe("noise");
      expect(ruling.citations.property.verified).toBe(false);
      expect(ruling.applicable).toBe(true);
    });

    it("O game, round 1 warden: the slow circuit -- none/noise/none, no target at all -- is applicable", async () => {
      const intent =
        "Walk a slow, deliberate circuit of the cell — pausing visibly at the window bars, the door, and the lock — while watching Voss's eyes to see what she tracks. Make pointed conversation to signal I'm paying close attention and to probe her composure.";
      const conversation = "Make pointed conversation to signal I'm paying close attention and to probe her composure.";
      const transport = scriptedTransport({
        target: { answerKey: "none", citation: { sourceId: "intent", quote: intent } },
        effect: { answerKey: "noise", citation: { sourceId: "intent", quote: conversation } },
        product: { answerKey: "none", citation: { sourceId: "intent", quote: conversation } },
        property: { answerKey: "none", citation: { sourceId: "intent", quote: conversation } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "slow, deliberate" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: conversation } },
      });
      const ruling = await createReferee([transport]).rule(intent, [BAR, MARA]);
      expect(ruling.targetObjectId).toBe("none");
      expect(ruling.effectKind).toBe("noise");
      expect(ruling.applicable).toBe(true);
    });

    it("a noise with no target whose target answer fell to the safe default is applicable too -- for a noise, the target contributes nothing to the effect either way", async () => {
      const transport = scriptedTransport({
        // target omitted -- falls to safeDefault "none" with no citation at all.
        effect: { answerKey: "noise", citation: { sourceId: "intent", quote: "hum to myself" } },
        magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "hum" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "hum" } },
      });
      const ruling = await createReferee([transport]).rule("I hum to myself.", [BAR]);
      expect(ruling.targetObjectId).toBe("none");
      expect(ruling.applicable).toBe(true);
    });

    it("PLANTED VIOLATION: a noise whose EFFECT citation is missing is not applicable -- the effect citation from the intent is the whole of a noise's grounding", async () => {
      const bucket: ObjectPerception = { id: "bucket", description: "A tin slop bucket... It rings sharply when anything strikes it." };
      const transport = scriptedTransport({
        target: { answerKey: "bucket", citation: { sourceId: "intent", quote: "kick the bucket" } },
        // Wrong source for the effect: the description, not the intent.
        effect: { answerKey: "noise", citation: { sourceId: "desc:bucket", quote: "It rings sharply when anything strikes it" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "kick the bucket" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "kick the bucket" } },
      });
      const ruling = await createReferee([transport]).rule("I kick the bucket over.", [bucket]);
      expect(ruling.applicable).toBe(false);
    });

    it("PLANTED VIOLATION: a noise ruled at a NAMED target whose target citation did not verify is not applicable -- the waiver is for no target, never for a badly-cited one", async () => {
      const transport = scriptedTransport({
        target: { answerKey: "bar", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
        effect: { answerKey: "noise", citation: { sourceId: "intent", quote: "rap on the bar" } },
        magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "rap" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "rap" } },
      });
      const ruling = await createReferee([transport]).rule("I rap on the bar.", [BAR]);
      expect(ruling.applicable).toBe(false);
    });
  });

  // OPEN-VARIANT.md §74.1, the owner's option B (2026-09-22): a turn does one thing. Whether an intent attempts
  // more than one act is asked as its OWN small call, one question and one source -- the only form that caught every
  // chain without moving any other ruling (`checkpoints/2026-09-22-one-act-s2/`, 16/16). It never changes whether
  // the act applies; a cited `several` only flags the ruling, so the actor is told a turn does one thing.
  describe("the one-act reading: a separate call that flags, never refuses (OPEN-VARIANT.md §74.1, option B)", () => {
    const checked = { oneAct: "checked" as const };
    it("the game's default is checked; `off` is the one-call referee of every earlier batch; anything else throws", () => {
      expect(readOneActMode(undefined)).toBe("checked");
      expect(readOneActMode("")).toBe("checked");
      expect(readOneActMode("off")).toBe("off");
      expect(() => readOneActMode("on")).toThrow(/PRISONER_ONE_ACT/);
    });

    it("a referee built with no option makes exactly one call, as before", async () => {
      const { transport, requests } = withActs(null);
      const ruling = await createReferee([transport]).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(requests.length).toBe(1);
      expect(ruling.oneAct).toBeUndefined();
    });

    const OPEN_AND_LEAVE = "open the door and leave";
    const DOOR: ObjectPerception = { id: "door", description: "A heavy door of iron-bound planks in a stone frame." };
    function withActs(acts: { answerKey: string; citation: { sourceId: string; quote: string } } | null): { transport: ReaderTransport; requests: ReadRequest[] } {
      const requests: ReadRequest[] = [];
      const main = scriptedTransport({
        target: { answerKey: "door", citation: { sourceId: "intent", quote: "door" } },
        effect: { answerKey: "open", citation: { sourceId: "intent", quote: "open the door" } },
        property: { answerKey: "passage", citation: { sourceId: "desc:door", quote: "A heavy door" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "open" } },
        perceptibility: { answerKey: "audible", citation: { sourceId: "intent", quote: "open" } },
        ...(acts ? { acts } : {}),
      });
      return { transport: async (request) => (requests.push(request), main(request)), requests };
    }

    it("asks the one-act question as its own request: one question, the intent as its only source, after the main ruling", async () => {
      const { transport, requests } = withActs(null);
      await createReferee([transport], checked).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(requests.length).toBe(2);
      expect(requests[0].questions.map((q) => q.id)).not.toContain("acts");
      expect(requests[1].questions).toEqual([ONE_ACT_QUESTION]);
      expect(requests[1].sources).toEqual([{ id: "intent", text: OPEN_AND_LEAVE }]);
    });

    it("the question's text is the probed one, word for word (checkpoints/2026-09-22-one-act-s2/build.mts)", () => {
      expect(ONE_ACT_QUESTION.answerKeys).toEqual(["one", "several"]);
      expect(ONE_ACT_QUESTION.safeDefault).toBe("one");
      expect(ONE_ACT_QUESTION.prompt).toContain("But opening a way out is always an act of its own, never a way of getting ready.");
      expect(ONE_ACT_QUESTION.prompt.startsWith("Does the intent attempt ONE act or SEVERAL?")).toBe(true);
    });

    it("a cited `several` flags the ruling and leaves it applicable exactly as it was", async () => {
      const { transport } = withActs({ answerKey: "several", citation: { sourceId: "intent", quote: "and leave" } });
      const ruling = await createReferee([transport], checked).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(ruling.applicable).toBe(true);
      expect(ruling.oneAct?.answer).toBe("several");
      expect(ruling.oneAct?.flagged).toBe(true);
    });

    it("`one` does not flag", async () => {
      const { transport } = withActs({ answerKey: "one", citation: { sourceId: "intent", quote: "open the door" } });
      const ruling = await createReferee([transport], checked).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(ruling.oneAct?.answer).toBe("one");
      expect(ruling.oneAct?.flagged).toBe(false);
    });

    it("PLANTED VIOLATION: a `several` whose citation does not come from the intent does not flag", async () => {
      const { transport } = withActs({ answerKey: "several", citation: { sourceId: "desc:door", quote: "A heavy door" } });
      const ruling = await createReferee([transport], checked).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(ruling.oneAct?.flagged).toBe(false);
    });

    it("an unanswered one-act question falls to `one` and flags nothing", async () => {
      const { transport } = withActs(null);
      const ruling = await createReferee([transport], checked).rule(OPEN_AND_LEAVE, [DOOR]);
      expect(ruling.oneAct?.answer).toBe("one");
      expect(ruling.oneAct?.flagged).toBe(false);
    });
  });

  // Phase 1 batch 1 (`checkpoints/2026-09-21-phase1-b1/`, the owner's audit
  // labels in `refusal-audit.csv`): 13 of the batch's close examinations were
  // refused with target, effect and a DECLARED property all right, because
  // the property citation quoted the examiner's own words ("baseline of 100
  // integrity", "edge,") rather than the target's description. The owner
  // labelled every one `misruled`. A reveal changes nothing in the world: the
  // description grounds what an act can DO to an object, and reading a
  // property the object declares needs no such grounding. So a reveal's
  // property citation verifies against the intent as well as the target's
  // own description (OPUS-FIRST-DESIGN.md §2, `misruled`). Each case below is
  // a recorded ruling rebuilt by hand from its transcript's referee table.
  describe("a reveal's property may be cited from the intent (Phase 1 batch 1, misruled)", () => {
    const SPOON: ObjectPerception = {
      id: "spoon",
      description: "A dented aluminium spoon, thin enough to bend by hand. One side of the bowl is worn flat from being scraped along the floor.",
    };

    it("row #6, 22-08-27 r3 warden: 'Closely examine the bar ... baseline of 100 integrity' -- bar/reveal/integrity, property cited from the intent -- is applicable", async () => {
      const intent =
        "Closely examine the bar in the window — run my hands along its full length, check the mortar at top and bottom, and look for any fresh scratches, filing marks, or weakening. I want to compare its current state against the round-0 baseline of 100 integrity.";
      const transport = scriptedTransport({
        target: { answerKey: "bar", citation: { sourceId: "intent", quote: "bar" } },
        effect: { answerKey: "reveal", citation: { sourceId: "intent", quote: "check the mortar at top and bottom, and look for any fresh scratches, filing marks, or weakening." } },
        property: { answerKey: "integrity", citation: { sourceId: "intent", quote: "100 integrity." } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "Closely examine" } },
        perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "run my hands along its full length" } },
      });
      const ruling = await createReferee([transport]).rule(intent, [BAR]);
      expect(ruling.effectKind).toBe("reveal");
      expect(ruling.citations.property.verified).toBe(true);
      expect(ruling.applicable).toBe(true);
    });

    it("row #21, 22-57-53 r9 warden: 'closely examine its entire edge' -- spoon/reveal/edge, property cited from the intent -- is applicable", async () => {
      const intent =
        "Pick up the spoon and closely examine its entire edge, the flat-worn side of the bowl, and the handle for any signs of deliberate sharpening, grinding, or filing — checking whether the edge value has changed from 0 since round 3.";
      const transport = scriptedTransport({
        target: { answerKey: "spoon", citation: { sourceId: "intent", quote: "spoon" } },
        effect: { answerKey: "reveal", citation: { sourceId: "intent", quote: "checking whether the edge value has changed from" } },
        property: { answerKey: "edge", citation: { sourceId: "intent", quote: "edge," } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "closely examine" } },
        perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "Pick up the spoon" } },
      });
      const ruling = await createReferee([transport]).rule(intent, [SPOON]);
      expect(ruling.property).toBe("edge");
      expect(ruling.applicable).toBe(true);
    });

    it("a reveal whose property is cited from the target's own description still verifies, exactly as before", async () => {
      const transport = scriptedTransport({
        target: { answerKey: "bar", citation: { sourceId: "intent", quote: "the bar" } },
        effect: { answerKey: "reveal", citation: { sourceId: "intent", quote: "examine" } },
        property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "examine" } },
        perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "examine" } },
      });
      const ruling = await createReferee([transport]).rule("I examine the bar.", [BAR]);
      expect(ruling.applicable).toBe(true);
    });

    it("PLANTED VIOLATION: a reveal of a property the target does NOT declare is still not applicable, however it is cited -- the waiver is for the citation's source, never for the property check", async () => {
      const transport = scriptedTransport({
        target: { answerKey: "spoon", citation: { sourceId: "intent", quote: "the spoon" } },
        effect: { answerKey: "reveal", citation: { sourceId: "intent", quote: "examine" } },
        property: { answerKey: "integrity", citation: { sourceId: "intent", quote: "wear" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "examine" } },
        perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "examine" } },
      });
      const ruling = await createReferee([transport]).rule("I examine the spoon for wear.", [SPOON]);
      expect(ruling.applicable).toBe(false);
    });

    it("PLANTED VIOLATION: a reveal whose property is cited from ANOTHER object's description is not applicable", async () => {
      const transport = scriptedTransport({
        target: { answerKey: "lock", citation: { sourceId: "intent", quote: "the lock" } },
        effect: { answerKey: "reveal", citation: { sourceId: "intent", quote: "examine" } },
        property: { answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
        magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "examine" } },
        perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "examine" } },
      });
      const ruling = await createReferee([transport]).rule("I examine the lock.", [BAR, LOCK]);
      expect(ruling.citations.property.verified).toBe(false);
      expect(ruling.applicable).toBe(false);
    });

    it("PLANTED VIOLATION: the waiver is for reveal only -- a CONCEAL whose property is cited from the intent is still not applicable", async () => {
      const transport = scriptedTransport({
        target: { answerKey: "spoon", citation: { sourceId: "intent", quote: "the spoon" } },
        effect: { answerKey: "conceal", citation: { sourceId: "intent", quote: "tuck" } },
        property: { answerKey: "concealment", citation: { sourceId: "intent", quote: "out of sight" } },
        magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "tuck" } },
        perceptibility: { answerKey: "silent", citation: { sourceId: "intent", quote: "tuck" } },
      });
      const ruling = await createReferee([transport]).rule("I tuck the spoon out of sight.", [SPOON]);
      expect(ruling.applicable).toBe(false);
    });
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

  it("OPEN-VARIANT.md §18.6/§18.7: a DIFFERENT intent on the same object is never shown an earlier ruling as precedent -- the confound that made the referee copy reveal onto the prisoner's wear", async () => {
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
    await referee.rule("file it again", [BAR]); // a DIFFERENT intent, same object

    expect(secondRequestSources.some((s) => s.id.startsWith("precedent:"))).toBe(false);
    expect(secondRequestSources.map((s) => s.id)).toEqual(["intent", "desc:bar"]);
  });

  it("the SAME intent in the SAME state is answered from cache: the transport is asked only once (OPEN-VARIANT.md §3.5's 'same intent, same state, same ruling', by construction rather than by prompt)", async () => {
    let calls = 0;
    const transport: ReaderTransport = async () => {
      calls += 1;
      return [
        { questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "effect", answerKey: "wear", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
        { questionId: "magnitude", answerKey: "moderate", citation: { sourceId: "intent", quote: "file it" } },
        { questionId: "perceptibility", answerKey: "audible", citation: { sourceId: "intent", quote: "file it" } },
      ];
    };
    const referee = createReferee([transport]);
    const first = await referee.rule("file it", [BAR]);
    const second = await referee.rule("file it", [BAR]); // same intent, same perceived state

    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });

  it("a repeated intent still asks again once the perceived state has changed -- the cache key is (intent, state), not intent alone", async () => {
    let calls = 0;
    const transport: ReaderTransport = async () => {
      calls += 1;
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
    await referee.rule("file it", [BAR, LOCK]); // same intent, a DIFFERENT perceived state

    expect(calls).toBe(2);
  });

  it("every question tells the referee which source to cite from -- magnitude and perceptibility included", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    const referee = createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]);
    await referee.rule("file it", [BAR]);
    for (const q of questions) expect(q.prompt, q.id).toMatch(/Cite the exact words in the (actor's intent|TARGET OBJECT'S OWN description)/);
  });

  it("the effect and property questions name the ways out: open, close, leave, and passage (OPEN-VARIANT.md §12)", async () => {
    let questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I slip out of the door.", [BAR]);
    const effect = questions.find((q) => q.id === "effect");
    const property = questions.find((q) => q.id === "property");
    for (const word of ["open (", "close (", "leave ("]) expect(effect?.prompt).toContain(word);
    expect(effect?.answerKeys).toEqual(expect.arrayContaining(["open", "close", "leave"]));
    expect(property?.prompt).toContain("passage");
  });

  it("the effect question says the aim decides open: making a way out passable is open even when the method is scraping or prying (issue #4, step 1)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I scrape at the bolt through the gap until it slides back.", [LOCK]);
    const effect = questions.find((q) => q.id === "effect");
    // The goal outweighs the method's verb: OPEN-VARIANT.md §12.5's game 1
    // was ruled `wear` on the lock for "push or scrape the visible bolt".
    expect(effect?.prompt).toMatch(/aim|goal/i);
    expect(effect?.prompt).toContain("scraping");
    expect(effect?.prompt).toContain("prying");
  });

  it("the effect question says open, close and leave target the way out itself, even when the method works on its part (OPEN-VARIANT.md §17.2)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I push the bolt back through the gap.", [LOCK]);
    const effect = questions.find((q) => q.id === "effect");
    expect(effect?.prompt).toContain(
      "open, close and leave, the target is the way out (the door, the window), even when the method works on a part of it such as its lock or a bar."
    );
  });

  it("an act whose aim is to learn is reveal whatever it looks for, and reveal names the property learned (OPEN-VARIANT.md §18.5)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("Examine the bar closely for signs of additional wear or tampering.", [LOCK]);
    const effect = questions.find((q) => q.id === "effect");
    const property = questions.find((q) => q.id === "property");
    // §18.4: "examine ... for signs of damage or wear" was ruled wear about half the time.
    expect(effect?.prompt).toContain(
      "An act whose aim is to learn -- to examine, inspect or check something -- is reveal, whatever it looks for: examining a bar for signs of damage or wear is reveal, not wear."
    );
    // §18.4: a reveal of the bar was paired with concealment, which the bar does not declare.
    // `checkpoints/2026-09-22-reveal-edge/`: naming integrity alone pulled examinations of the
    // spoon's sharpening to integrity (batch 1 rows #15/#19/#35/#43, misruled); edge is named first.
    expect(property?.prompt).toContain(
      "For reveal, name the property being learned: edge for how sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the intent calls it hidden."
    );
  });

  // OPEN-VARIANT.md §74.3 (the owner's decision), `checkpoints/2026-09-22-hide-target/`: an act of hiding
  // targeted the place (the tile, the blanket, the cot) as often as the thing; with this clause 7 of 9 hides
  // named the thing hidden and every control held.
  it("the target question says an act of hiding names the thing hidden, not the place (OPEN-VARIANT.md §74.3)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("Tuck the spoon under the loose tile.", [BAR]);
    expect(questions.find((q) => q.id === "target")?.prompt).toContain(
      "An intent that goes out through a way out acts on that way out: name it, never none. An act of hiding names the thing hidden, never the place it is hidden in, under or behind. "
    );
  });

  it("the target and effect questions both say that going out through a way out is leave, and names it (OPEN-VARIANT.md §30)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("Climb through the window.", [{ id: "window", description: "A small window set in the wall at shoulder height." }]);
    // §29.1: seven attempts to climb out were answered with no target at all and `open`, never `leave`.
    expect(questions.find((q) => q.id === "target")?.prompt).toContain(
      "An intent that goes out through a way out acts on that way out: name it, never none."
    );
    expect(questions.find((q) => q.id === "effect")?.prompt).toContain(
      "Going out through a way out is leave, even when it already stands open: climbing through an open window is leave, not open."
    );
  });

  it("the property question lists each object's own properties and asks for one the target has (OPEN-VARIANT.md §24)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    const TILE: ObjectPerception = { id: "loose_tile", description: "A square clay floor tile, cracked across one corner." };
    const BUCKET: ObjectPerception = { id: "bucket", description: "A tin slop bucket." };
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("Examine the loose tile closely.", [BAR, TILE, BUCKET]);
    const property = questions.find((q) => q.id === "property");
    // §23.1: 17 of 24 failed moves named integrity for the tile, which declares only concealment.
    expect(property?.prompt).toContain("The properties each object has: bar: integrity; loose_tile: concealment; bucket: none.");
    expect(property?.prompt).toContain("Name only a property the target has; if it has none that fits, answer none.");
    expect(property?.prompt).toContain("concealment for what may be hidden in, under or beneath it");
    // §24.2: the bucket's struck noise came back with no property answer at all, so no grounding.
    expect(property?.prompt).toContain("An answer of none still needs the words in the target's description that make the effect possible");
  });

  it("an object made in this game lists its own properties, from the caller's world (OPEN-VARIANT.md §24)", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee(
      [
        async (request) => {
          questions = request.questions;
          return [];
        },
      ],
      { propertiesOf: (id) => (id === "wire" ? ["integrity", "concealment"] : []) }
    ).rule("Bend the wire.", [{ id: "wire", description: "A length of wire." }]);
    expect(questions.find((q) => q.id === "property")?.prompt).toContain("The properties each object has: wire: integrity, concealment.");
  });

  it("a ruling's citations carry the word range they were rebuilt from, taken only from the offer the reader accepted (OPEN-VARIANT.md §18.3)", async () => {
    const intent = "I file the bar with my spoon.";
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") {
          // Rejected first (not a key), with a range; then accepted, as a plain quote.
          return [
            { questionId: "target", answerKey: "the bar", citation: { sourceId: "intent", quote: "file the bar", from: 2, to: 4 } as TransportAnswer["citation"] },
            { questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "file the bar" } },
          ];
        }
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "wear", citation: { sourceId: "intent", quote: "file", from: 2, to: 2 } as TransportAnswer["citation"] }];
        return [];
      });
    const ruling = await createReferee([transport]).rule(intent, [BAR]);
    expect(ruling.citations.target.citation).toEqual({ sourceId: "intent", quote: "file the bar" });
    expect(ruling.citations.effect.citation).toEqual({ sourceId: "intent", quote: "file", from: 2, to: 2 });
    expect(ruling.raw.answers.find((a) => a.questionId === "effect")?.citation).toEqual({ sourceId: "intent", quote: "file", from: 2, to: 2 });
  });
});

describe("PRISONER_INSTRUMENT (OPEN-VARIANT.md §51, the-prisoner#17)", () => {
  it("readInstrumentMode: unset is off, 'checked' is legal, anything else throws", () => {
    expect(readInstrumentMode(undefined)).toBe("off");
    expect(readInstrumentMode("")).toBe("off");
    expect(readInstrumentMode("checked")).toBe("checked");
    expect(readInstrumentMode("off")).toBe("off");
    expect(() => readInstrumentMode("wat")).toThrow(/PRISONER_INSTRUMENT/);
  });

  it("off (the default): no seventh question is asked at all -- the request is unchanged from before this arm existed", async () => {
    let questions: readonly { id: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("I pick the lock using the wire.", [LOCK]);
    expect(questions.map((q) => q.id)).toEqual(["target", "effect", "product", "property", "magnitude", "perceptibility"]);
  });

  it("checked: a seventh 'instrument' question is asked, with answer keys the actor's own perceived objects, none, and absent", async () => {
    let questions: readonly { id: string; answerKeys: readonly string[] }[] = [];
    await createReferee(
      [
        async (request) => {
          questions = request.questions;
          return [];
        },
      ],
      { instrumentMode: "checked" }
    ).rule("I pick the lock using the wire.", [LOCK]);
    const instrument = questions.find((q) => q.id === "instrument");
    expect(instrument?.answerKeys).toEqual(["lock", "none", "absent"]);
  });

  it("checked, and the referee legally answers 'absent' for a tool the actor does not have -- cited from the intent like every other answer, the ruling is not applicable, and the citation is kept as the reason", async () => {
    const intent = "I pick the lock using the wire.";
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") return [{ questionId: "target", answerKey: "lock", citation: { sourceId: "intent", quote: "pick the lock" } }];
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "open", citation: { sourceId: "intent", quote: "pick the lock" } }];
        if (q.id === "property") return [{ questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:lock", quote: "A steel lock" } }];
        // "wire" is not among what the actor perceives or holds (only "lock" is): `absent` is the
        // LEGAL key for this, not a rule-broken offer of "wire" itself -- the referee never has to
        // name the object at all, only cite the words in the intent that name it.
        if (q.id === "instrument") return [{ questionId: "instrument", answerKey: "absent", citation: { sourceId: "intent", quote: "using the wire" } }];
        return [];
      });
    const ruling = await createReferee([transport], { instrumentMode: "checked" }).rule(intent, [LOCK]);

    expect(ruling.instrument).toBe("absent");
    expect(ruling.missingInstrument).toEqual({ citation: { sourceId: "intent", quote: "using the wire" } });
    expect(ruling.applicable).toBe(false);
  });

  it("PLANTED VIOLATION: 'absent' cited from the wrong source (not the intent) still blocks the ruling, fail-safe, but is not reported as a trustworthy reason", async () => {
    const intent = "I pick the lock using the wire.";
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") return [{ questionId: "target", answerKey: "lock", citation: { sourceId: "intent", quote: "pick the lock" } }];
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "open", citation: { sourceId: "intent", quote: "pick the lock" } }];
        if (q.id === "property") return [{ questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:lock", quote: "A steel lock" } }];
        // Cites the LOCK's own description, not the intent -- a real quote (so run-dmcp's own
        // verbatim check passes it), but not from the source this question requires.
        if (q.id === "instrument") return [{ questionId: "instrument", answerKey: "absent", citation: { sourceId: "desc:lock", quote: "A steel lock" } }];
        return [];
      });
    const ruling = await createReferee([transport], { instrumentMode: "checked" }).rule(intent, [LOCK]);

    expect(ruling.instrument).toBe("absent");
    expect(ruling.citations.instrument?.verified).toBe(false);
    expect(ruling.missingInstrument).toBeNull(); // not a trustworthy reason to report
    expect(ruling.applicable).toBe(false); // but still blocked -- blocking is the safe direction
  });

  it("checked, and the named instrument is one the actor really has: no gate, the ruling stands on its other merits", async () => {
    const SPOON: ObjectPerception = { id: "spoon", description: "A dented aluminium spoon." };
    const intent = "I scrape the bar with my spoon.";
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") return [{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "scrape the bar" } }];
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "wear", citation: { sourceId: "intent", quote: "scrape the bar" } }];
        if (q.id === "property") return [{ questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } }];
        if (q.id === "instrument") return [{ questionId: "instrument", answerKey: "spoon", citation: { sourceId: "intent", quote: "my spoon" } }];
        return [];
      });
    const ruling = await createReferee([transport], { instrumentMode: "checked" }).rule(intent, [BAR, SPOON]);

    expect(ruling.missingInstrument).toBeNull();
    expect(ruling.instrument).toBe("spoon");
    expect(ruling.citations.instrument?.verified).toBe(true);
    expect(ruling.applicable).toBe(true);
  });

  it("checked, and no instrument offer arrives at all: falls to safe default 'none', no gate", async () => {
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") return [{ questionId: "target", answerKey: "bar", citation: { sourceId: "intent", quote: "scrape the bar" } }];
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "wear", citation: { sourceId: "intent", quote: "scrape the bar" } }];
        if (q.id === "property") return [{ questionId: "property", answerKey: "integrity", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } }];
        return [];
      });
    const ruling = await createReferee([transport], { instrumentMode: "checked" }).rule("I scrape the bar.", [BAR]);

    expect(ruling.instrument).toBe("none");
    expect(ruling.missingInstrument).toBeNull();
    expect(ruling.applicable).toBe(true);
  });

  it("checked, and the referee explicitly answers 'none' (an act that uses no tool at all): no gate, same as any other applicable ruling", async () => {
    const transport: ReaderTransport = async (request) =>
      request.questions.flatMap((q): TransportAnswer[] => {
        if (q.id === "target") return [{ questionId: "target", answerKey: "door", citation: { sourceId: "intent", quote: "kick the door" } }];
        if (q.id === "effect") return [{ questionId: "effect", answerKey: "noise", citation: { sourceId: "intent", quote: "kick the door" } }];
        if (q.id === "property") return [{ questionId: "property", answerKey: "none", citation: { sourceId: "desc:door", quote: "iron-bound planks" } }];
        if (q.id === "instrument") return [{ questionId: "instrument", answerKey: "none", citation: { sourceId: "intent", quote: "I kick the door" } }];
        return [];
      });
    const DOOR: ObjectPerception = { id: "door", description: "A heavy door of iron-bound planks in a stone frame." };
    const ruling = await createReferee([transport], { instrumentMode: "checked" }).rule("I kick the door.", [DOOR]);

    expect(ruling.instrument).toBe("none");
    expect(ruling.missingInstrument).toBeNull();
    expect(ruling.applicable).toBe(true);
  });
});

describe("PRISONER_DERIVE_WORDING (OPEN-VARIANT.md §51, the-prisoner#18)", () => {
  it("readDeriveWordingMode: unset is baseline, 'sharpened' is legal, anything else throws", () => {
    expect(readDeriveWordingMode(undefined)).toBe("baseline");
    expect(readDeriveWordingMode("")).toBe("baseline");
    expect(readDeriveWordingMode("sharpened")).toBe("sharpened");
    expect(readDeriveWordingMode("baseline")).toBe("baseline");
    expect(() => readDeriveWordingMode("wat")).toThrow(/PRISONER_DERIVE_WORDING/);
  });

  it("baseline (the default): the effect question's derive/wear wording is byte-identical to before this arm existed", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee([
      async (request) => {
        questions = request.questions;
        return [];
      },
    ]).rule("pull a wire out of the cot", [{ id: "cot", description: "twists of wire" }]);
    const effect = questions.find((q) => q.id === "effect");
    expect(effect?.prompt).toContain(
      "derive (make a new thing from part of the target and keep it: a length of wire from the cot, a strip of wool from the blanket, a handful of grit from the loose tile, a hook from the length of wire, a cord from the strip of wool) is for an act whose aim is to have the piece afterwards; wear is for damage that leaves nothing in hand."
    );
    expect(effect?.prompt).not.toContain("whatever verb");
  });

  it("sharpened: the effect question adds an explicit keep-the-piece test, naming the declared derivable kinds, not a keyword list this repository wrote", async () => {
    let questions: readonly { id: string; prompt: string }[] = [];
    await createReferee(
      [
        async (request) => {
          questions = request.questions;
          return [];
        },
      ],
      { deriveWording: "sharpened" }
    ).rule("pull a wire out of the cot", [{ id: "cot", description: "twists of wire" }]);
    const effect = questions.find((q) => q.id === "effect");
    // The example objects come from `derivedObjects.ts`'s own table (§13.3), the
    // same `deriveExamples` string the un-sharpened prompt already builds from it --
    // never a verb or noun list typed fresh into this test's expectation of the code.
    expect(effect?.prompt).toContain("a length of wire from the cot");
    expect(effect?.prompt).toContain("holding a separate new thing");
    expect(effect?.prompt).toContain("a piece is kept afterward");
    expect(effect?.prompt).toContain("whatever verb");
  });
});

// OPEN-VARIANT.md §55 (issue #22, the-prisoner's own SOCIAL-INTENTS.md
// proposal): THE GROUNDING RULE, and the owner's own reason for approving
// the proposal -- "a state change must be grounded in a citation describing
// the physical act, never in the claim about the act." A prisoner who can
// move the world by asserting things wins by assertion, which is what the
// referee exists to prevent. This is the SAME discipline every other test
// in this file already exercises for objects (`citationCheck`'s own
// `requiredSourceId`, always the TARGET's own `desc:<id>` source for the
// property question, never `intent`); this test plants it specifically
// against a PERCEIVED PRINCIPAL, so the discipline is pinned before gap 3
// (a person's own bounded numeric property) ever gives it something real to
// protect.
describe("THE GROUNDING RULE (OPEN-VARIANT.md §55, issue #22): a person-property change must cite the target's own description, never the spoken words", () => {
  const PRISONER: ObjectPerception = { id: "prisoner", description: "Mara Voss, the prisoner. She can be seen, heard, spoken to, or touched by anyone who shares this room with her." };

  it("PLANTED VIOLATION: a property citation sourced from the actor's own INTENT (the spoken claim), not the target's own description, is refused -- even when a person-property is (hypothetically) declared", async () => {
    // `isDeclared` is stubbed to ALWAYS say yes, isolating the citation-
    // SOURCE discipline from "no property is declared for a person at all"
    // (effects.test.ts's own, separate defence-in-depth test) -- this test
    // asks: if gap 3 ever declares one, does grounding still hold?
    const alwaysDeclared = () => true;
    const transport = scriptedTransport({
      target: { answerKey: "prisoner", citation: { sourceId: "intent", quote: "drop to the ground" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "drop to the ground" } },
      // THE VIOLATION: the grounding citation names the actor's own SPOKEN
      // intent ("I am having a heart attack") as if it were a description
      // of Voss's own body -- exactly the failure mode SOCIAL-INTENTS.md
      // warns against: winning by assertion, not by a physical act.
      property: { answerKey: "integrity", citation: { sourceId: "intent", quote: "drop to the ground" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "drop to the ground" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "drop to the ground" } },
    });
    const referee = createReferee([transport], { isDeclared: alwaysDeclared });
    const ruling = await referee.rule("I drop to the ground and clutch my chest.", [PRISONER]);

    expect(ruling.citations.property.verified).toBe(false);
    expect(ruling.applicable).toBe(false);
  });

  it("the identical ruling is applicable once the property citation is moved to the TARGET's own description", async () => {
    const alwaysDeclared = () => true;
    const transport = scriptedTransport({
      target: { answerKey: "prisoner", citation: { sourceId: "intent", quote: "drop to the ground" } },
      effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "drop to the ground" } },
      property: { answerKey: "integrity", citation: { sourceId: "desc:prisoner", quote: "She can be seen, heard, spoken to, or touched" } },
      magnitude: { answerKey: "moderate", citation: { sourceId: "intent", quote: "drop to the ground" } },
      perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "drop to the ground" } },
    });
    const referee = createReferee([transport], { isDeclared: alwaysDeclared });
    const ruling = await referee.rule("I drop to the ground and clutch my chest.", [PRISONER]);

    expect(ruling.citations.property.verified).toBe(true);
    expect(ruling.applicable).toBe(true);
  });

  it("a noise ruled at a perceived principal never bumps warden_suspicion by itself -- only a visible/audible WEAR-shaped effect, or the warden's own look, ever does (the asymmetry, unchanged by this gap)", () => {
    // `noise` is never in the suspicion-eligible set (`loop.ts`), the exact
    // rule that already keeps CONCEAL/REVEAL quiet -- unaffected by a
    // principal now being a legal `noise` target. Structural, not a mock:
    // if this ever flipped, THIS is the line that would need to change, and
    // it would need a one-sentence justification next to it, not a silent
    // edit.
    expect(suspicionEligible("noise")).toBe(false);
    expect(suspicionEligible("reveal")).toBe(false);
    expect(suspicionEligible("conceal")).toBe(false);
  });

  // WORLD-ELABORATION-DESIGN.md §4.1: "The base referee request is
  // byte-identical to today's" -- this task's own load-bearing constraint,
  // the-prisoner#17's own D3 lesson repeated: a request shape change would
  // make every batch recorded against the OLD shape incomparable with one
  // recorded after. The elaboration request (`elaborationReferee.ts`) is a
  // SECOND, separate reader that only ever fires on a failed half-round --
  // it adds no question here and reads no line of `buildQuestions` below,
  // so this pin exists to prove exactly that, mechanically, rather than by
  // review alone: a future edit that changes so much as one character of
  // this module's own six questions must change this hash ON PURPOSE.
  it("PIN: the base referee request's own six questions are byte-identical to what every recorded batch was asked -- unaffected by this task's elaboration request existing at all", async () => {
    const referee = createReferee([]);
    const ruling = await referee.rule("I file the bar with my spoon.", [BAR, LOCK]);
    expect(ruling.request.questions.map((q) => q.id)).toEqual(["target", "effect", "product", "property", "magnitude", "perceptibility"]);
    const fingerprint = createHash("sha256").update(JSON.stringify(ruling.request.questions), "utf8").digest("hex");
    // Changed ON PURPOSE 2026-09-22 (`checkpoints/2026-09-22-reveal-edge/`): the property question's
    // reveal sentence names edge. Every batch recorded before this -- Phase 1 batch 1 included -- was
    // asked the request whose hash was 6d0d6943dda923f349f4a91862e6105934c9948dd6bb821333f59c684214ebca.
    // Changed ON PURPOSE again 2026-09-22 (docs/CUSTODY-DESIGN.md, C1 = A): the effect question offers
    // `take` and `give`, one generic clause each, and its answer keys gain both. Every batch recorded
    // before custody was asked the request whose hash was
    // 0350c5485c25649f3bf3927b8ecdb04f3381fdd38a99cafeebbb149cf9d723a0.
    // And again 2026-09-22 (OPEN-VARIANT.md §74.3): the target question says an act of hiding names the thing
    // hidden. Custody's request, before this clause, hashed b265402a71da04c5f19eb576f9f7a9b0b0d01d7bb103b08acbf4908cc4d8524b.
    expect(fingerprint).toBe("486c801305674a9987d776eda61913796f3da2f944a656a9950a7f217d90aeef");
  });
});

/**
 * Issue #22 gap 3, and the measurement that motivated it
 * (`checkpoints/2026-09-19-selftarget/RESULTS.md`): a person's `posture` is
 * fully declared in `OPEN_PERSONS` (0-100, `wear` 10/50/100) and was
 * unreachable by the referee from BOTH sides -- the property question had no
 * `posture` answer key, and the acting principal was excluded from her own
 * perceived objects. The probe measured `warden`/`wear`/`none` 5/5 on "push
 * Croft to the floor" while the model cited exactly the right ground ("She is
 * on her feet."), and 0/4 on self-directed acts with `prisoner` offered as a
 * bare key and no prompt saying a body is a thing you can act on.
 *
 * Every addition here is conditional on a person actually being in view, so
 * the PIN above (the base request's fingerprint, with only objects perceived)
 * cannot move: with the presence arm off, no person is ever perceived, and the
 * request is byte-identical to every recorded batch.
 */
describe("a person as a target: the other, and the actor's own body (issue #22 gap 3)", () => {
  const MARA: ObjectPerception = {
    id: "prisoner",
    description: "Mara Voss, the prisoner. She can be seen, heard, spoken to, or touched by anyone who shares this room with her. She is on her feet.",
  };
  const CROFT: ObjectPerception = {
    id: "warden",
    description: "Warden Croft, the warden. She can be seen, heard, spoken to, or touched by anyone who shares this room with her. She is on her feet.",
  };
  /** What the real caller's `declaredPropertyKeys` returns under the presence
   *  arm: a person declares `posture`, an object declares its own keys. */
  const withPersons = (id: string): readonly string[] => (id === "prisoner" || id === "warden" ? ["posture"] : id === "bar" ? ["integrity"] : []);
  const personDeclared = (objectId: string, key: string): boolean => (objectId === "prisoner" || objectId === "warden" ? key === "posture" : key === "integrity");

  async function questionsFor(
    perceived: readonly ObjectPerception[],
    options: Parameters<typeof createReferee>[1] = {}
  ): Promise<readonly { id: string; prompt: string; answerKeys: readonly string[] }[]> {
    let questions: readonly { id: string; prompt: string; answerKeys: readonly string[] }[] = [];
    await createReferee(
      [
        async (request) => {
          questions = request.questions;
          return [];
        },
      ],
      options
    ).rule("drop to the ground and clutch my chest", perceived);
    return questions;
  }

  it("posture is a legal property answer exactly when a person is in view -- and the object-only key set is untouched otherwise", async () => {
    const withPerson = await questionsFor([BAR, MARA], { propertiesOf: withPersons });
    expect(withPerson.find((q) => q.id === "property")?.answerKeys).toContain("posture");

    const objectsOnly = await questionsFor([BAR, LOCK]);
    expect(objectsOnly.find((q) => q.id === "property")?.answerKeys).toEqual(["integrity", "edge", "concealment", "passage", "none"]);
  });

  it("the property, effect and target questions gain their person clauses only when a person is in view", async () => {
    const q = await questionsFor([BAR, MARA, CROFT], { propertiesOf: withPersons });
    expect(q.find((x) => x.id === "property")?.prompt).toContain("posture (a person's own bounded physical state");
    expect(q.find((x) => x.id === "effect")?.prompt).toContain("is wear on that person");
    expect(q.find((x) => x.id === "target")?.prompt).toContain("the actor's OWN body");

    const objectsOnly = await questionsFor([BAR, LOCK]);
    expect(objectsOnly.find((x) => x.id === "property")?.prompt).not.toContain("posture");
    expect(objectsOnly.find((x) => x.id === "effect")?.prompt).not.toContain("that person");
    expect(objectsOnly.find((x) => x.id === "target")?.prompt).not.toContain("OWN body");
  });

  it("a grounded wear ruling on the OTHER person's posture is applicable -- the probe's own 'push Croft to the floor', which read property=none 5/5 before this", async () => {
    const ruling = await createReferee(
      [
        scriptedTransport({
          target: { answerKey: "warden", citation: { sourceId: "intent", quote: "Croft" } },
          effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "push Croft to the floor" } },
          property: { answerKey: "posture", citation: { sourceId: "desc:warden", quote: "She is on her feet." } },
          magnitude: { answerKey: "substantial", citation: { sourceId: "intent", quote: "push" } },
          perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "push Croft to the floor" } },
        }),
      ],
      { propertiesOf: withPersons, isDeclared: personDeclared }
    ).rule("push Croft to the floor", [BAR, CROFT]);

    expect(ruling.applicable).toBe(true);
    expect(ruling.targetObjectId).toBe("warden");
    expect(ruling.effectKind).toBe("wear");
    expect(ruling.property).toBe("posture");
    expect(ruling.citations.property.verified).toBe(true);
  });

  it("a grounded wear ruling on the ACTOR'S OWN posture is applicable -- the owner's own faked heart attack, which had no target at all before this", async () => {
    const ruling = await createReferee(
      [
        scriptedTransport({
          target: { answerKey: "prisoner", citation: { sourceId: "intent", quote: "drop to the ground" } },
          effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "drop to the ground" } },
          property: { answerKey: "posture", citation: { sourceId: "desc:prisoner", quote: "She is on her feet." } },
          magnitude: { answerKey: "substantial", citation: { sourceId: "intent", quote: "drop to the ground" } },
          perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "clutch my chest" } },
        }),
      ],
      { propertiesOf: withPersons, isDeclared: personDeclared }
    ).rule("drop to the ground and clutch my chest", [BAR, MARA]);

    expect(ruling.applicable).toBe(true);
    expect(ruling.targetObjectId).toBe("prisoner");
    expect(ruling.property).toBe("posture");
  });

  it("PLANTED VIOLATION: posture claimed for an OBJECT is not declared, so the ruling is not applicable", async () => {
    const ruling = await createReferee(
      [
        scriptedTransport({
          target: { answerKey: "bar", citation: { sourceId: "intent", quote: "bar" } },
          effect: { answerKey: "wear", citation: { sourceId: "intent", quote: "push the bar over" } },
          property: { answerKey: "posture", citation: { sourceId: "desc:bar", quote: "Rust has pitted it near the bottom" } },
          magnitude: { answerKey: "slight", citation: { sourceId: "intent", quote: "push" } },
          perceptibility: { answerKey: "visible", citation: { sourceId: "intent", quote: "push the bar over" } },
        }),
      ],
      { propertiesOf: withPersons, isDeclared: personDeclared }
    ).rule("push the bar over", [BAR, MARA]);

    expect(ruling.applicable).toBe(false);
  });
});
