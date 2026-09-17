// Builds referee replay requests from the CURRENT code for a fixed intent set,
// on the recorded E3 r6 perception (§33.13), optionally swapping one sentence
// into the effect prompt. usage: build-requests.mts <out.json> [variant-name]
import { readFileSync, writeFileSync } from "node:fs";
import { createReferee } from "/Users/derekferguson/rpg/the-prisoner/src/open/referee.ts";
const OLD = "/private/tmp/claude-501/-Users-derekferguson-rpg/3eaf75b3-f4bd-423f-ac15-fe46726c2a27/scratchpad/referee-removal-no-restore-sentence.json";
const base = JSON.parse(readFileSync(OLD, "utf-8"))[0].request;
const perceived = base.sources.filter((s: any) => s.id.startsWith("desc:")).map((s: any) => ({ id: s.id.slice(5), description: s.text }));

// [expected, intent]
export const INTENTS: [string, string][] = [
  // the misrulings
  ["open", "Remove the bar"],
  ["open", "Use the spoon to remove the bar"],
  ["open", "Pull the bar out of the window"],
  ["open", "Take the bar out"],
  // open controls that already pass
  ["open", "Use the spoon to pry the bar out of the mortar"],
  ["open", "Use the spoon to lever the bar out of the mortar"],
  ["open", "Attempt to remove the bar from the window"],
  ["open", "Use the spoon to twist and remove the bar"],
  ["open", "Use the spoon to push back the bolt through the gap"],
  // wear controls: working the bar toward removable must stay wear
  ["wear", "Continue abrading the bar with the spoon to reduce its integrity"],
  ["wear", "Use the spoon to scrape at the rusted bottom of the bar"],
  ["wear", "Use the spoon to damage the bar further"],
  ["wear", "Use the spoon to strike the bar repeatedly"],
  ["wear", "Use the spoon to chip away the mortar around the bar"],
  // other nearby effects, and "remove" on things that are not a way out's part
  ["reveal", "Examine the bar for signs of damage or wear"],
  ["leave", "Climb out through the window"],
  ["leave", "Climb through the window and escape"],
  ["leave", "Squeeze through the gap in the window where the bar was"],
  ["leave", "Get out through the window"],
  ["leave", "Slip out of the open door"],
  ["wear", "Rub the spoon back and forth against the bar"],
  ["wear", "Grind at the bar with the spoon's edge to weaken it"],
  ["derive", "Pull a length of wire from the cot springs and keep it"],
  ["expose", "Remove the loose tile to get at the hollow beneath it"],
  ["none-of-open", "Remove the blanket from the cot"],
  ["conceal", "Rub grit from the hollow into the scratches on the bar to hide them"],
];

const variants: Record<string, [string, string]> = {
  base: ["", ""],
  // V1: removal named in the aim list, plus the rules-decide clause
  V1: [
    "a bar levered from its mortar -- is open, even when the method is scraping or prying; ",
    "a bar levered from its mortar or simply removed -- is open, even when the method is scraping or prying, " +
      "and even when the part may not be ready to come out: whether it gives is for the rules, not the ruling; ",
  ],
  // V2: a separate sentence about removing a part that keeps a way out shut
  V2: [
    "wear is for damage or dulling with no way out as its goal. ",
    "wear is for damage or dulling with no way out as its goal. " +
      "An attempt to remove, pull out or take out a part that keeps a way out shut is open, whether or not the part is ready to come out -- " +
      "whether it gives is decided by the rules, not by this ruling; working the part to weaken it first is still wear. ",
  ],
  // V3: V1, with the tool named in the removal example
  V3: [
    "a bar levered from its mortar -- is open, even when the method is scraping or prying; ",
    "a bar levered from its mortar or removed, with a tool or by hand -- is open, even when the method is scraping or prying, " +
      "and even when the part may not be ready to come out: whether it gives is for the rules, not the ruling; ",
  ],
  // V4: V2's sentence, placed after the leave sentence instead of before it
  V4: [
    "climbing through an open window is leave, not open. ",
    "climbing through an open window is leave, not open. " +
      "An attempt to remove, pull out or take out a part that keeps a way out shut is open, whether or not the part is ready to come out -- " +
      "whether it gives is decided by the rules, not by this ruling; working the part to weaken it first is still wear. ",
  ],
  // V5: V3, with the leave sentence strengthened for getting out after a part is removed
  V5: [
    "a bar levered from its mortar -- is open, even when the method is scraping or prying; ",
    "a bar levered from its mortar or removed, with a tool or by hand -- is open, even when the method is scraping or prying, " +
      "and even when the part may not be ready to come out: whether it gives is for the rules, not the ruling; ",
  ],
  // V6: V1, with the removal example tool-neutral and no mention of the way out
  V6: [
    "a bar levered from its mortar -- is open, even when the method is scraping or prying; ",
    "a bar levered from its mortar or removed, whatever it is removed with -- is open, even when the method is scraping or prying, " +
      "and even when the part may not be ready to come out: whether it gives is for the rules, not the ruling; ",
  ],
};

const [, , out, variant = "base"] = process.argv;
const [from, to] = variants[variant];
const entries = [];
for (const [expected, intent] of INTENTS) {
  let got: any = null;
  await createReferee([async (req) => { got = req; return []; }]).rule(intent, perceived);
  if (from) {
    const eff = got.questions.find((q: any) => q.id === "effect");
    if (!eff.prompt.includes(from)) throw new Error(`variant ${variant}: anchor not found`);
    eff.prompt = eff.prompt.replace(from, to);
    if (variant === "V5") {
      const leaveFrom = "climbing through an open window is leave, not open. ";
      if (!eff.prompt.includes(leaveFrom)) throw new Error("V5 leave anchor not found");
      eff.prompt = eff.prompt.replace(leaveFrom, "climbing through an open window is leave, not open, and so is getting out through the gap a removed part leaves. ");
    }
  }
  entries.push({ label: `[expect ${expected}] ${intent}`, request: got });
}
// sanity: the base build for the first recorded intent equals the recorded request
if (variant === "base") {
  let got: any = null;
  await createReferee([async (req) => { got = req; return []; }]).rule("Use the spoon to pry the bar out of the mortar", perceived);
  console.log("matches recorded §33.14 request:", JSON.stringify(got) === JSON.stringify(base));
}
writeFileSync(out, JSON.stringify(entries, null, 1));
console.log(`wrote ${entries.length} requests (${variant}) to ${out}`);
