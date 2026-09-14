import type { ReaderTransport } from "run-dmcp";

/**
 * A scripted referee transport for tests: rules on an intent by looking it up
 * verbatim in a table the TEST wrote, the way a real referee model would read
 * it. Test content only -- production code never keys anything off prose.
 * An intent missing from the table gets no answers, so every question falls
 * to its safe default and the attempt does nothing.
 */
export type ScriptedRuling = {
  target: string;
  effect: string;
  property: string;
  magnitude: string;
  perceptibility: string;
  intentQuote: string;
  descQuote: string;
};

export function scriptedReferee(byIntent: Record<string, ScriptedRuling>): ReaderTransport {
  return async (request) => {
    const intent = request.sources.find((s) => s.id === "intent")?.text ?? "";
    const script = byIntent[intent];
    if (!script) return [];
    return request.questions.map((q) => ({
      questionId: q.id,
      answerKey: (script as Record<string, string>)[q.id],
      citation: q.id === "property" ? { sourceId: `desc:${script.target}`, quote: script.descQuote } : { sourceId: "intent", quote: script.intentQuote },
    }));
  };
}

export const SCRAPE = "I scrape at the rusted base of the bar with my spoon.";
export const EXAMINE = "I examine the bar closely.";
export const WAIT = "I sit on the cot and wait.";

export const RULINGS: Record<string, ScriptedRuling> = {
  [SCRAPE]: {
    target: "bar",
    effect: "wear",
    property: "integrity",
    magnitude: "substantial",
    perceptibility: "audible",
    intentQuote: "scrape at the rusted base of the bar",
    descQuote: "Rust has pitted it near the bottom",
  },
  [EXAMINE]: {
    target: "bar",
    effect: "reveal",
    property: "integrity",
    magnitude: "slight",
    perceptibility: "visible",
    intentQuote: "examine the bar closely",
    descQuote: "Rust has pitted it near the bottom",
  },
};
