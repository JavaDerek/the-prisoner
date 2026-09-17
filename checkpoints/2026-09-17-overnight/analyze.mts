// Reads open-variant transcripts and prints, per game, the §5.3 lines the summary already carries and
// the §34 measure: prisoner turns where the bar was at or below the window's line (her own belief) and
// no way out stood open yet, and what she attempted on each. Reading only -- it classifies by the
// referee's recorded effect key, never by the intent's words.
import { readFileSync } from "node:fs";

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf-8");
  const result = text.match(/## Result\n\n\*\*(.*?)\*\*/)?.[1] ?? "(no result)";
  const pick = (re: RegExp) => text.match(re)?.[1] ?? "?";
  const halves = text.split(/^### Round /m).slice(1);
  let opened = false;
  const removable: string[] = [];
  for (const h of halves) {
    const head = h.split("\n")[0];
    const round = head.match(/^(\d+)/)?.[1];
    const isPrisoner = head.includes("-- the prisoner");
    const effect = h.match(/\| effect \| `([a-z]+)`/)?.[1] ?? "(none)";
    const target = h.match(/\| target \| `([a-z_0-9]+)`/)?.[1] ?? "";
    const ruled = h.match(/\*\*Ruled:\*\* ([a-z]+)/)?.[1] ?? "";
    if (isPrisoner) {
      const bar = Number(h.match(/^bar integrity: (\d+)/m)?.[1] ?? "100");
      const intent = h.match(/\*\*Intent:\*\* (.*)/)?.[1] ?? "(silent)";
      if (bar <= 50 && !opened) removable.push(`r${round} bar ${bar}: ${effect} ${target} (${ruled}) -- ${intent}`);
    }
    if (/_passage: 0 -> 1/.test(h)) opened = true;
  }
  console.log(`\n== ${file.split("/").pop()}\n${result}`);
  console.log(`  intents ${pick(/Total intents: (\d+)/)}, silences ${pick(/Silences: (\d+)/)}, impossible ${pick(/Ruled impossible: (\d+)/)}, novel ${pick(/no closed-variant equivalent: (\d+)/)}`);
  console.log(`  cited ${pick(/With every required citation verified: (\d+)/)} of ${pick(/Applied effects: (\d+)/)}; fog: ${pick(/Fog audit: (.*)/)}`);
  console.log(`  ${pick(/(Conditions: [A-Z]+)/)}; ${pick(/(Pick condition: [A-Z]+)/)}; ${pick(/(Warden: [^\n]*)/)}`);
  const forced = text.match(/Forced prisoner turns: .*/)?.[0]; if (forced) console.log("  " + forced);
  const regen = text.match(/Regenerated \(§36\).*/)?.[0]; if (regen) console.log("  " + regen);
  const free = text.match(/Free prisoner turns: .*/)?.[0]; if (free) console.log("  " + free);
  console.log(`  removable turns (bar <= 50, nothing open yet): ${removable.length}; open/leave attempts: ${removable.filter((r) => / (open|leave) /.test(r)).length}`);
  for (const r of removable) console.log("    " + r);
}
