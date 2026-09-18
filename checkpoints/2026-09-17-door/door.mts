// §46's measure: told about TWO ways out, which does she work on, and does her PLAN go there?
//
// The cell has two exits. The window is gated on the bar, the most-repeated act in the ledger's
// history (19 of 22 episodes). The door is gated on nothing at all and has been opened once. Until
// this arm, only the window was ever stated as something she could open.
//
// Reading only, by the referee's own recorded target -- never by what an intent's words seem to mean.
// Targets map to a route: bar and window are the window route; door and lock are the door route.
// The plan is scored separately and by mention, because a plan is prose the referee never rules on,
// and because §45 showed an intent can leave the obvious route while the plan still ends there.
import { readFileSync } from "node:fs";

const WINDOW_ROUTE = new Set(["bar", "window"]);
const DOOR_ROUTE = new Set(["door", "lock"]);

type Turn = { round: string; target: string; effect: string; ruled: string; intent: string; plan: string };

function prisonerTurns(text: string): Turn[] {
  const turns: Turn[] = [];
  for (const h of text.split(/^### Round /m).slice(1)) {
    const head = h.split("\n")[0];
    if (!head.includes("-- the prisoner")) continue;
    turns.push({
      round: head.match(/^(\d+)/)?.[1] ?? "?",
      target: h.match(/\| target \| `([a-z_0-9]+)`/)?.[1] ?? "",
      effect: h.match(/\| effect \| `([a-z]+)`/)?.[1] ?? "",
      ruled: h.match(/\*\*Ruled:\*\* ([a-z]+)/)?.[1] ?? "(none)",
      intent: h.match(/\*\*Intent:\*\* (.*)/)?.[1] ?? "(silent)",
      plan: h.match(/\*\*Plan:\*\* (.*)/)?.[1] ?? "",
    });
  }
  return turns;
}

const totals = new Map<string, { games: number; turns: number; window: number; door: number; plansNamingDoor: number; tried: number; escapedByDoor: number }>();

for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf-8");
  const arm = text.match(/^Door: ([A-Z]+)/m)?.[1] ?? "(no arm named)";
  const result = text.match(/## Result\n\n\*\*(.*?)\*\*/)?.[1] ?? "(no result)";
  const turns = prisonerTurns(text);
  const leftByDoor = /door_passage: 0 -> 1/.test(text) && /out of the cell, through the door/.test(text);

  console.log(`\n== ${file.split("/").pop()}  door ${arm}\n   ${result}${leftByDoor ? "  — THROUGH THE DOOR" : ""}`);
  for (const t of turns) {
    const route = WINDOW_ROUTE.has(t.target) ? "window route" : DOOR_ROUTE.has(t.target) ? "DOOR ROUTE" : t.target === "" ? "—" : `other (${t.target})`;
    const planDoor = /\bdoor\b|\block\b|\bbolt\b/i.test(t.plan);
    console.log(`   r${t.round.padStart(2)} [${route}${t.ruled === "impossible" ? ", impossible" : ""}] ${t.intent}`);
    if (planDoor) console.log(`        plan names the door: ${t.plan}`);
  }

  const s = totals.get(arm) ?? { games: 0, turns: 0, window: 0, door: 0, plansNamingDoor: 0, tried: 0, escapedByDoor: 0 };
  s.games++;
  s.turns += turns.length;
  s.window += turns.filter((t) => WINDOW_ROUTE.has(t.target)).length;
  s.door += turns.filter((t) => DOOR_ROUTE.has(t.target)).length;
  s.plansNamingDoor += turns.filter((t) => /\bdoor\b|\block\b|\bbolt\b/i.test(t.plan)).length;
  if (turns.some((t) => DOOR_ROUTE.has(t.target))) s.tried++;
  if (leftByDoor) s.escapedByDoor++;
  totals.set(arm, s);
}

console.log("\n-- which way out she worked on, free turns only (pick was off)");
for (const [arm, s] of totals) {
  console.log(
    `   door ${arm}: ${s.games} games, ${s.turns} turns — window route ${s.window}, door route ${s.door}; ` +
      `${s.tried}/${s.games} games touched the door route at all; ${s.plansNamingDoor} turns whose PLAN named it; ${s.escapedByDoor} left through it`
  );
}
