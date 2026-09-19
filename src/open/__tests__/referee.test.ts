import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import type { ReadRequest, TransportAnswer, ReaderTransport } from "run-dmcp";
import { createReferee, readInstrumentMode, readDeriveWordingMode, type ObjectPerception } from "../referee.js";
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
    expect(property?.prompt).toContain(
      "For reveal, name the property being learned: integrity for damage, wear, rust or tampering, even when the intent calls it hidden."
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
    expect(fingerprint).toBe("6d0d6943dda923f349f4a91862e6105934c9948dd6bb821333f59c684214ebca");
  });
});
