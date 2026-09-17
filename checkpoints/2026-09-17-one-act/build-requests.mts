// §40: referee requests from the CURRENT code on §33.16's recorded perception, with a new first question,
// "acts", added to each request. Intents: §33.16's 26 controls, §39's two two-act intents, and acts controls.
import { readFileSync, writeFileSync } from "node:fs";
import { createReferee } from "/Users/derekferguson/rpg/the-prisoner/src/open/referee.ts";
const S16 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16";
const old = JSON.parse(readFileSync(`${S16}/requests-26-intents.json`, "utf-8"));
const perceived = old[0].request.sources.filter((s: any) => s.id.startsWith("desc:")).map((s: any) => ({ id: s.id.slice(5), description: s.text }));
export const EXPECTED_ACTS: Record<string, "one" | "several"> = {
  "Inspect the lock and examine the loose tile for hidden items or damage.": "several",
  "Use the grit and spoon to scrape the bar's rusted areas, then cover with the blanket to conceal scratches.": "several",
  "Use the spoon to pry the bar from the mortar and climb through the window.": "several",
  "Scrape the bar with the spoon and grit from the loose tile": "one",
  "Use the cot to stand on and climb through the window": "one",
  "Use the spoon to scrape grit from the loose tile and apply it to the bar's weakened areas": "one",
  "Wrap the blanket around the bar to absorb sound while scraping with the spoon and grit.": "one",
};
const intents: string[] = [...old.map((e: any) => e.request.sources.find((s: any) => s.id === "intent").text), ...Object.keys(EXPECTED_ACTS)];
const PROMPTS: Record<string, string> = {
  v1:
    "Does the intent attempt one act, or several separate acts? Tools, materials and helpers used in an act are part of that one act, " +
    "and so is a step done only to carry it out. Separate acts are things done one after another, each with its own aim: examining two " +
    "different things, or doing one thing and then another. Answer one or several. Cite the exact words in the actor's intent that show it.",
  v2:
    "Does the intent name one action, or several actions that could each be attempted on its own? Several: two different things examined, " +
    "or one thing done and then another thing done, such as working something loose and then going out through it. One: a single action, " +
    "even when it uses several tools or materials together, is repeated, or is done in a particular way, such as quietly or with something " +
    "held against it. Answer one or several. Cite the exact words in the actor's intent that show it.",
};
export const ACTS_QUESTION = { id: "acts", prompt: PROMPTS[process.env.ACTS_VARIANT ?? "v1"], answerKeys: ["one", "several"], safeDefault: "one" };
const out: any[] = [];
for (const intent of intents) {
  let captured: any = null;
  const referee = createReferee([async (req: any) => ((captured = req), [])]);
  await referee.rule(intent, perceived);
  out.push({ label: intent, request: { questions: [ACTS_QUESTION, ...captured.questions], sources: captured.sources } });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, "requests");
