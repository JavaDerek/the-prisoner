// S.json: the separate one-act call (form S), second version -- the first version's text plus ONE clause for
// preparation, found in ../2026-09-22-one-act-s/RESULTS.md, with a guard so that opening a way out stays its own act.
// Fixed before any call. The HOLDOUT intents in intents.json were written after that result and before this run.
import { writeFileSync, readFileSync } from "node:fs";
export const ACTS_QUESTION = {
  id: "acts",
  prompt:
    "Does the intent attempt ONE act or SEVERAL? An act is one thing done to or with one thing in the room: working on it, " +
    "examining it, hiding it, taking or handing it over, opening or closing it, going out through it, or striking or moving a " +
    "person. Answer several when the intent does one such thing and then another -- examining two objects, blinding someone " +
    "and then opening a door, opening a way out and then going through it. Answer one when it does a single such thing, " +
    "however it is described: a tool used on something is one act; hiding a thing somewhere is one act on the thing, and the " +
    "place is only where it goes; and speaking, watching someone, waiting, or moving within the room alongside the act does " +
    "not count as another -- examining something while watching someone or talking to them is one act. Getting ready for the " +
    "act is part of it, not another act: going over to the thing, sitting, kneeling or bending down, reaching for it, picking " +
    "it up, or lifting what covers it. But opening a way out is always an act of its own, never a way of getting ready. " +
    "Cite the exact words in the actor's intent that show the second act, or, for one, the words that describe the act.",
  answerKeys: ["one", "several"],
  safeDefault: "one",
};
const here = new URL(".", import.meta.url).pathname;
const { items } = JSON.parse(readFileSync(`${here}intents.json`, "utf-8")) as { items: { group: string; set: string; expect: string; intent: string }[] };
const rows = items.map((i) => ({ kind: `${i.set}:${i.group}`, expect: i.expect, intent: i.intent, request: { questions: [ACTS_QUESTION], sources: [{ id: "intent", text: i.intent }] } }));
writeFileSync(`${here}S.json`, JSON.stringify(rows, null, 1));
console.log(`S.json: ${rows.length} requests`);
