// The measure mother-of-invention#2 needs: does a FREE turn build on what a forced turn found?
//
// moi#2's named first idea is "carry a forced turn's find into the free turn's plan" -- after a
// forced turn does something unseen, put what it produced in front of the mind so an unforced turn
// has a reason to build on it. Before building that, this asks whether the transcripts already on
// disk show the mind failing to build on such a find, and what it does with the ones it takes up.
//
// Reading only, and like `analyze.mts` it classifies by the referee's recorded ruling and the
// resolution's own transitions -- never by what an intent's words seem to mean. The one thing it
// takes from the words is the pick line the transcript itself prints, which is the loop's record of
// its own decision, not an interpretation.
//
// Two signals, because neither alone is honest. The referee's own target cannot say whether a find
// was taken up: using a new tool ON the bar is ruled against the BAR, so "scrape the bar with the
// hook" records target `bar` and the hook vanishes from the record. So this also asks whether the
// next free turn NAMES the thing the world says the actor now holds -- a mention test against the
// world's own label for that object, not a reading of what the intent means. Both are printed.
//
// Per prisoner turn it records what the turn PRODUCED, in four kinds:
//   object      a derive made a new thing the actor now holds        (the strongest find)
//   property    a resolution moved a property's value                (old != new)
//   information a reveal told the actor a value it did not have
//   nothing     ruled impossible, or resolved to the value it already stood at
// A find on an OVERRIDDEN turn is the mechanism's subject: the turn did something the mind did not
// choose. It then looks at the next FREE prisoner turn, reports both signals above, and where the
// find was taken up says what it was aimed at -- which is how "the find changed the instrument, not
// the intention" becomes visible as data rather than an impression from reading.
import { readFileSync } from "node:fs";

type Turn = {
  round: string;
  kind: "override" | "forced-kept" | "free";
  effect: string;
  target: string;
  ruled: string;
  made: string | null;
  moved: string[];
  intent: string;
  learns: string;
};

const ESCAPE_ROUTE = new Set(["bar", "window"]); // this game's obvious approach, named only for reporting

function turnsOf(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const h of text.split(/^### Round /m).slice(1)) {
    const head = h.split("\n")[0];
    if (!head.includes("-- the prisoner")) continue;
    const resolved = h.split("Resolved")[1] ?? "";
    turns.push({
      round: head.match(/^(\d+)/)?.[1] ?? "?",
      kind: /\*\*Forced pick:\*\* overrode/.test(h) ? "override" : /\*\*Forced pick:\*\*/.test(h) ? "forced-kept" : "free",
      effect: h.match(/\| effect \| `([a-z]+)`/)?.[1] ?? "(none)",
      target: h.match(/\| target \| `([a-z_0-9]+)`/)?.[1] ?? "",
      ruled: h.match(/\*\*Ruled:\*\* ([a-z]+)/)?.[1] ?? "(none)",
      made: resolved.match(/^ {2}- made \w+ \(([a-z_0-9]+)\)/m)?.[1] ?? null,
      moved: [...resolved.matchAll(/^ {2}- ([a-z_0-9]+): (-?\d+) -> (-?\d+)$/gm)].filter((m) => m[2] !== m[3]).map((m) => m[1]),
      intent: h.match(/\*\*Intent:\*\* (.*)/)?.[1] ?? "(silent)",
      learns: h.match(/\*\*Actor learns:\*\* (.*)/)?.[1] ?? "",
    });
  }
  return turns;
}

function produced(t: Turn): { kind: "object" | "property" | "information" | "nothing"; of: string } {
  if (t.made) return { kind: "object", of: t.made };
  if (t.moved.length > 0) return { kind: "property", of: t.target };
  if (t.effect === "reveal" && t.ruled === "possible") return { kind: "information", of: t.target };
  return { kind: "nothing", of: t.target };
}

/** The world's own label for an object id, as an intent would write it. */
const labelOf = (id: string) => id.replace(/_/g, " ");

let finds = 0;
let named = 0;
let ruledAgainst = 0;
let ontoRoute = 0;
for (const file of process.argv.slice(2)) {
  const turns = turnsOf(readFileSync(file, "utf-8"));
  console.log(`\n== ${file.split("/").pop()}`);
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.kind !== "override") continue;
    const find = produced(t);
    const next = turns.slice(i + 1).find((n) => n.kind === "free");
    const against = next !== undefined && find.of !== "" && next.target === find.of;
    const mentions = next !== undefined && find.of !== "" && next.intent.toLowerCase().includes(labelOf(find.of));
    console.log(`  r${t.round} forced off its own choice -> ${t.intent}`);
    console.log(`     produced: ${find.kind}${find.of ? ` (${find.of})` : ""} -- ${t.learns || "(nothing resolved)"}`);
    if (find.kind === "object" || find.kind === "property") {
      finds++;
      if (mentions) named++;
      if (against) ruledAgainst++;
      if (next === undefined) {
        console.log("     next free turn: none (game ended)");
      } else {
        const took = mentions ? "NAMES IT" : "does not name it";
        console.log(`     next free turn r${next.round}: ${took}, ruled ${next.effect} on ${next.target} -- ${next.intent}`);
        // What it was used FOR: a new instrument leaves the goal exactly where it was.
        if (mentions && ESCAPE_ROUTE.has(next.target) && !ESCAPE_ROUTE.has(find.of)) {
          console.log("     used for: the escape route -- a new instrument, the same intention");
          ontoRoute++;
        }
      }
    }
  }
}
console.log(`\n-- totals: ${finds} durable finds on overridden turns; the next free turn named the find ${named} times (ruled against it ${ruledAgainst}); of those, ${ontoRoute} went at the escape route -- a new instrument, the same intention.`);
