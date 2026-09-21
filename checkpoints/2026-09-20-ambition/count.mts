// Structural counts for the ambition comparison, from ruling keys the code wrote into each transcript.
// Reads every `<arm>/*.md` under this directory. Never reads prose: only the referee table rows the
// checkpoint transcript renders (`| target | \`x\` | ...`), the `**Ruled:**` line, the `## Result`
// section, and the half-round headings that say which principal acted.
//
//   npx tsx checkpoints/2026-09-20-ambition/count.mts            # markdown tables to stdout
//
// A half-round with no referee table (a silence) counts as no intent: it is reported separately, never
// folded into "refused".

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ARMS = ["Q", "O", "D"] as const;
const PERSON = new Set(["warden", "prisoner"]);

interface Half {
  round: number;
  principal: "warden" | "prisoner";
  target: string | null; // null = silence (no table)
  effect: string | null;
  ruled: "possible" | "impossible" | null;
}
interface Game {
  arm: string;
  file: string;
  wits: string;
  referee: string;
  halves: Half[];
  escaped: boolean;
  silences: number;
}

function parseGame(arm: string, file: string): Game {
  const text = readFileSync(file, "utf8");
  const wits = /^Wits model: `([^`]+)`/m.exec(text)?.[1] ?? "?";
  const referee = /Referee model: `([^`]+)`/m.exec(text)?.[1] ?? "?";
  const escaped = /^\*\*The prisoner escaped, at round \d+\.\*\*/m.test(text);
  const halves: Half[] = [];
  const sections = text.split(/^### Round (\d+) \(t=\d+\) -- the (warden|prisoner)$/m);
  // split yields [pre, round, principal, body, round, principal, body, ...]
  for (let i = 1; i + 2 < sections.length + 1; i += 3) {
    const round = Number(sections[i]);
    const principal = sections[i + 1] as Half["principal"];
    const body = sections[i + 2] ?? "";
    const target = /^\| target \| `([^`]+)` \|/m.exec(body)?.[1] ?? null;
    const effect = /^\| effect \| `([^`]+)` \|/m.exec(body)?.[1] ?? null;
    const ruledM = /^\*\*Ruled:\*\* (possible|impossible)/m.exec(body);
    const ruled = ruledM ? (ruledM[1] as Half["ruled"]) : null;
    halves.push({ round, principal, target, effect, ruled });
  }
  const silences = Number(/^Silences \(decision\): (\d+)\./m.exec(text)?.[1] ?? /^Total intents: \d+\. Silences: (\d+)\./m.exec(text)?.[1] ?? "0");
  return { arm, file, wits, referee, halves, escaped, silences };
}

function grounded(h: Half): boolean {
  return h.ruled === "possible" && h.target !== null && h.target !== "none";
}
function refused(h: Half): boolean {
  return h.target !== null && (h.target === "none" || h.ruled === "impossible");
}

const games: Game[] = [];
for (const arm of ARMS) {
  const dir = join(here, arm);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md") && statSync(join(dir, f)).isFile()).sort();
  } catch {
    continue;
  }
  for (const f of files) games.push(parseGame(arm, join(dir, f)));
}

const out: string[] = [];
out.push("## Per arm");
out.push("");
out.push("| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |");
out.push("|---|---|---|---|---|---|---|---|---|---|---|");
for (const arm of ARMS) {
  const gs = games.filter((g) => g.arm === arm);
  if (gs.length === 0) continue;
  const halves = gs.flatMap((g) => g.halves);
  const intents = halves.filter((h) => h.target !== null).length;
  const silences = halves.filter((h) => h.target === null).length;
  const meanTargets = gs.reduce((s, g) => s + new Set(g.halves.filter((h) => h.target !== null && h.target !== "none").map((h) => h.target)).size, 0) / gs.length;
  const personGames = gs.filter((g) => g.halves.some((h) => h.target !== null && PERSON.has(h.target))).length;
  const meanEffects = gs.reduce((s, g) => s + new Set(g.halves.filter((h) => h.effect !== null && h.effect !== "none").map((h) => h.effect)).size, 0) / gs.length;
  const g = halves.filter(grounded).length;
  const r = halves.filter(refused).length;
  const esc = gs.filter((x) => x.escaped).length;
  const wits = [...new Set(gs.map((x) => x.wits))].join(", ");
  out.push(`| ${arm} | \`${wits}\` | ${gs.length} | ${intents} | ${silences} | ${meanTargets.toFixed(2)} | ${personGames} of ${gs.length} | ${meanEffects.toFixed(2)} | ${g} | ${r} | ${esc} |`);
}
out.push("");
out.push("## Per chair");
out.push("");
out.push("| arm | chair | intents | distinct targets over all intents | person targets | distinct effects over all intents | grounded | refused |");
out.push("|---|---|---|---|---|---|---|---|");
for (const arm of ARMS) {
  const gs = games.filter((g) => g.arm === arm);
  if (gs.length === 0) continue;
  for (const chair of ["warden", "prisoner"] as const) {
    const hs = gs.flatMap((g) => g.halves).filter((h) => h.principal === chair && h.target !== null);
    const targets = [...new Set(hs.filter((h) => h.target !== "none").map((h) => h.target))].sort();
    const effects = [...new Set(hs.filter((h) => h.effect !== "none").map((h) => h.effect))].sort();
    const person = hs.filter((h) => PERSON.has(h.target as string)).length;
    out.push(`| ${arm} | ${chair} | ${hs.length} | ${targets.length}: ${targets.join(", ")} | ${person} | ${effects.length}: ${effects.join(", ")} | ${hs.filter(grounded).length} | ${hs.filter(refused).length} |`);
  }
}
out.push("");
out.push("## Per game");
out.push("");
out.push("| arm | transcript | r1 warden | r1 prisoner | r2 warden | r2 prisoner | distinct targets | person | distinct effects | grounded | refused | result |");
out.push("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const g of games) {
  const cell = (round: number, principal: Half["principal"]): string => {
    const h = g.halves.find((x) => x.round === round && x.principal === principal);
    if (!h || h.target === null) return "silent";
    return `${h.target}/${h.effect}${h.ruled === "impossible" ? " (impossible)" : ""}`;
  };
  const targets = new Set(g.halves.filter((h) => h.target !== null && h.target !== "none").map((h) => h.target)).size;
  const effects = new Set(g.halves.filter((h) => h.effect !== null && h.effect !== "none").map((h) => h.effect)).size;
  const person = g.halves.some((h) => h.target !== null && PERSON.has(h.target)) ? "yes" : "no";
  out.push(`| ${g.arm} | \`${g.file.split("/").slice(-2).join("/")}\` | ${cell(1, "warden")} | ${cell(1, "prisoner")} | ${cell(2, "warden")} | ${cell(2, "prisoner")} | ${targets} | ${person} | ${effects} | ${g.halves.filter(grounded).length} | ${g.halves.filter(refused).length} | ${g.escaped ? "**escaped**" : "timeout"} |`);
}
console.log(out.join("\n"));
