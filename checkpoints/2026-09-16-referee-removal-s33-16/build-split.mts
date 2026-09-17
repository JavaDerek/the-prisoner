// Split variants: a separate goes_out yes/no question; leave removed from the effect question.
import { readFileSync, writeFileSync } from "node:fs";
const [, , S, variant, out] = process.argv;
const entries = JSON.parse(readFileSync(`${S}/req-base.json`, "utf-8"));

const LEAVE_LIST = "open (make a way out passable in one act -- a door, a window), close (shut a way out), leave (go out through a way out), or none. ";
const LEAVE_LIST_NEW = variant === "S0" || variant === "S1"
  ? "open (make a way out passable in one act -- a door, a window), close (shut a way out), or none. " +
    "Whether the actor goes out through a way out is asked separately: judge only what the act does to the thing it acts on. "
  : "open (make a way out passable in one act -- a door, a window), close (shut a way out), or none. ";
const LEAVE_SENT = "Going out through a way out is leave, even when it already stands open: climbing through an open window is leave, not open. ";
const FOR_OCL = "For open, close and leave, the target";
const OPEN_EX = "a bar levered from its mortar -- is open, even when the method is scraping or prying; ";
const OPEN_EX_V3 = "a bar levered from its mortar or removed, with a tool or by hand -- is open, even when the method is scraping or prying, " +
  "and even when the part may not be ready to come out: whether it gives is for the rules, not the ruling; ";

const GOES_OUT = {
  id: "goes_out",
  prompt:
    "Does the actor's intent attempt to go out through a way out -- to climb, squeeze, slip or step through it and out of the space the actor is in? " +
    "Answer yes or no. Getting a part out of a way out, or opening it, is not going out through it; going out through it is yes even when it already stands open. " +
    "Cite the exact words in the actor's intent that describe the movement, or for no, the words that describe the action.",
  answerKeys: ["yes", "no"],
  safeDefault: "no",
};

function swap(s: string, from: string, to: string): string {
  if (!s.includes(from)) throw new Error(`${variant}: anchor not found: ${from.slice(0, 50)}`);
  return s.replace(from, to);
}

const built = entries.map((e: any) => {
  const req = JSON.parse(JSON.stringify(e.request));
  const eff = req.questions.find((q: any) => q.id === "effect");
  eff.prompt = swap(eff.prompt, LEAVE_LIST, LEAVE_LIST_NEW);
  eff.prompt = swap(eff.prompt, LEAVE_SENT, "");
  eff.prompt = swap(eff.prompt, FOR_OCL, "For open and close, the target");
  if (variant === "S1" || variant === "S2") eff.prompt = swap(eff.prompt, OPEN_EX, OPEN_EX_V3);
  eff.answerKeys = eff.answerKeys.filter((k: string) => k !== "leave");
  const i = req.questions.findIndex((q: any) => q.id === "effect");
  req.questions.splice(i, 0, GOES_OUT);
  return { label: e.label, request: req };
});
writeFileSync(out, JSON.stringify(built, null, 1));
console.log(`wrote ${built.length} (${variant}); effect keys: ${built[0].request.questions.find((q: any) => q.id === "effect").answerKeys.join(",")}`);
