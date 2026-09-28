// `npm run engine-rules-dry-run -- --dry-run` (the-prisoner#5, CODER-BRIEF:
// "Build a dry-run way to see the enjoyable-mode referee request"). Shows the
// EXACT referee request `PRISONER_OPEN_RULES=engine` builds for the issue's
// own concrete test case (docs/issues/5.md's comment: "rub the grit into the
// bar's mortar", when the actor HOLDS the grit) -- never calls a model, the
// same discipline `scenarioGenCli.ts --dry-run` already follows for
// generation requests. A real engine-rules game runs only inside
// `npm run checkpoint` under `PRISONER_MODE=enjoyable` (which defaults
// `PRISONER_OPEN_RULES` to `engine`, `openRulesMode.ts`).
import { buildQuestions, buildSources, scenarioProperties, noKinds, type ObjectPerception } from "./referee.js";
import { findObject } from "./scenarioObjects.js";
import { fileURLToPath } from "node:url";

export function parseEngineRulesDryRunArgs(argv: readonly string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

/** The issue's own concrete case: the bar's authored §4.1 description
 *  (`findObject`, never retyped here) and the grit's authored derived-object
 *  description (`derivedObjects.ts`'s own text, copied verbatim so this tool
 *  needs no world at all -- a dry run builds no `OpenWorld`, no database, no
 *  entity ids), with the grit named among what the actor holds. */
export function buildDryRunScenario(): { intent: string; perceivedObjects: readonly ObjectPerception[]; heldObjectIds: readonly string[] } {
  const bar = findObject("bar");
  if (!bar) throw new Error("engine-rules-dry-run: 'bar' is not declared in the scenario -- scenarioObjects.ts changed under this tool");
  return {
    intent: "I rub the grit into the bar's mortar.",
    perceivedObjects: [
      { id: "bar", description: bar.description },
      { id: "grit", description: "A handful of dry grit from the hollow beneath the tile, coarse and sharp-grained." },
    ],
    heldObjectIds: ["grit"],
  };
}

/** Every line a `--dry-run` invocation prints: the two sources (the actor's
 *  intent, and each perceived object's own description) and the full
 *  engine-mode question set (`buildQuestions(..., "engine", heldObjectIds)`)
 *  -- the request shape `createReferee({ openRulesMode: "engine" })` would
 *  build for this exact scenario. */
export function renderDryRun(): string[] {
  const { intent, perceivedObjects, heldObjectIds } = buildDryRunScenario();
  const questions = buildQuestions(perceivedObjects, noKinds, scenarioProperties, "off", "baseline", "off", "off", "off", "off", "off", "off", "engine", heldObjectIds);
  const sources = buildSources(intent, perceivedObjects);
  const lines: string[] = [];
  lines.push(`Intent: "${intent}"`);
  lines.push(`Held objects ('with''s own closed set): ${heldObjectIds.join(", ") || "none"}`);
  lines.push("");
  lines.push("=== SOURCES ===");
  for (const s of sources) {
    lines.push(`--- ${s.id} ---`);
    lines.push(s.text);
  }
  lines.push("");
  lines.push("=== QUESTIONS (PRISONER_OPEN_RULES=engine) ===");
  for (const q of questions) {
    lines.push(`--- ${q.id} ---`);
    lines.push(`Answer keys: ${q.answerKeys.join(", ")}`);
    lines.push(`Safe default: ${q.safeDefault}`);
    lines.push(q.prompt);
    lines.push("");
  }
  return lines;
}

async function main(): Promise<void> {
  const args = parseEngineRulesDryRunArgs(process.argv.slice(2));
  if (!args.dryRun) {
    process.stderr.write(
      "usage: engine-rules-dry-run -- --dry-run\n" +
        "Shows the exact referee request PRISONER_OPEN_RULES=engine builds for the issue's own concrete test case " +
        `("rub the grit into the bar's mortar") -- never calls a model. A real engine-rules game runs inside ` +
        "`npm run checkpoint` under PRISONER_MODE=enjoyable.\n"
    );
    process.exitCode = 2;
    return;
  }
  // eslint-disable-next-line no-console
  console.log(renderDryRun().join("\n"));
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
