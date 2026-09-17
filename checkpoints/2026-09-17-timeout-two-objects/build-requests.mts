// §39: referee requests from the CURRENT code on §33.16's recorded perception, for §33.16's 26 control
// intents plus the two two-act intents that lost their ruling overnight. VARIANT=first swaps one sentence
// into the target question. usage: build-requests.mts <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import { createReferee } from "/Users/derekferguson/rpg/the-prisoner/src/open/referee.ts";
const S16 = "/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-16-referee-removal-s33-16";
const old = JSON.parse(readFileSync(`${S16}/requests-26-intents.json`, "utf-8"));
const perceived = old[0].request.sources.filter((s: any) => s.id.startsWith("desc:")).map((s: any) => ({ id: s.id.slice(5), description: s.text }));
const intents: string[] = [
  ...old.map((e: any) => e.request.sources.find((s: any) => s.id === "intent").text),
  "Inspect the lock and examine the loose tile for hidden items or damage.",
  "Use the grit and spoon to scrape the bar's rusted areas, then cover with the blanket to conceal scratches.",
];
const SENTENCE = "An intent that does more than one thing acts on the object of the first thing it does. ";
const ANCHOR = "Cite the exact words in the actor's intent that name it.";
const out: any[] = [];
for (const intent of intents) {
  let captured: any = null;
  const referee = createReferee([async (req: any) => ((captured = req), [])]);
  await referee.rule(intent, perceived);
  const request = JSON.parse(JSON.stringify({ questions: captured.questions, sources: captured.sources }));
  if (process.env.VARIANT === "first") {
    const q = request.questions.find((x: any) => x.id === "target");
    if (!q.prompt.includes(ANCHOR)) throw new Error("anchor missing");
    q.prompt = q.prompt.replace(ANCHOR, SENTENCE + ANCHOR);
  }
  out.push({ label: intent, request });
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(out.length, "requests");
