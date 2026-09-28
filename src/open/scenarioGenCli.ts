// `npm run scenario-gen -- --dry-run` (the-prisoner#3, CODER-BRIEF: "Provide
// a --dry-run-style way to see the generation and review requests without
// sending"). This tool NEVER calls a model: `renderDryRun` below builds the
// exact generation prompt a real `PRISONER_MODE=enjoyable` run would send
// for every §4.1 object (`buildGenerationPrompt`, `scenarioTransport.ts`),
// and the honesty review's own question/sources shape (`buildHonestyQuestion`,
// `scenarioGen.ts`), and prints them. The real generation call happens only
// inside `npm run checkpoint` under `PRISONER_MODE=enjoyable`, through the
// same one-model-at-a-time swapper every other model role goes through
// (CLAUDE.md, "Real games use one model at a time") -- this CLI has no
// second copy of that wiring, on purpose: its only job is to let a person
// see the request shape before ever spending a call on it.
import { buildGenerationPrompt } from "./scenarioTransport.js";
import { buildHonestyQuestion, GENERATED_SOURCE_ID, FACTS_SOURCE_ID, scenarioObjectFacts, type ScenarioObjectFact } from "./scenarioGen.js";
import { resolveScenarioModel, readScenarioTemperature, DEFAULT_SCENARIO_TEMPERATURE } from "./scenarioMode.js";
import { resolveRefereeModel } from "../modelRoles.js";
import { fileURLToPath } from "node:url";

export function parseScenarioGenArgs(argv: readonly string[]): { dryRun: boolean } {
  return { dryRun: argv.includes("--dry-run") };
}

/** Every line a `--dry-run` invocation prints: the generation prompt for
 *  each object, then the honesty review's own question and the two sources
 *  it would be asked against, once (the same question and source SHAPE for
 *  every object; only the two texts inside `sources` vary per description,
 *  which no description exists yet to fill in). */
export function renderDryRun(objects: readonly ScenarioObjectFact[], options: { model: string; generationTemperature: number }): string[] {
  const lines: string[] = [];
  lines.push(`Scenario model: ${options.model}. Generation temperature: ${options.generationTemperature}. Review temperature: 0.`);
  lines.push("");
  lines.push(`${objects.length} object(s) in the fixed §4.1 list -- ids, properties, starting values and mechanics all unchanged; only the description below is regenerated per game.`);
  lines.push("");
  for (const object of objects) {
    lines.push(`=== GENERATION REQUEST: ${object.id} ===`);
    lines.push(buildGenerationPrompt(object.id, object.facts));
    lines.push("");
  }
  const question = buildHonestyQuestion();
  lines.push("=== HONESTY REVIEW REQUEST (same shape for every object; the generated text fills in once one exists) ===");
  lines.push(`Question id: ${question.id}. Answer keys: ${question.answerKeys.join(", ")}. Safe default: ${question.safeDefault}.`);
  lines.push(question.prompt);
  lines.push(`Source "${GENERATED_SOURCE_ID}": <the model's generated description would be reviewed here>`);
  lines.push(`Source "${FACTS_SOURCE_ID}": <the object's authored facts text, verbatim>`);
  return lines;
}

async function main(): Promise<void> {
  const args = parseScenarioGenArgs(process.argv.slice(2));
  const refereeModel = resolveRefereeModel(process.env.PRISONER_REFEREE_MODEL);
  const model = resolveScenarioModel(refereeModel, process.env.PRISONER_SCENARIO_MODEL);
  const generationTemperature = readScenarioTemperature(process.env.PRISONER_SCENARIO_TEMPERATURE);
  if (!args.dryRun) {
    process.stderr.write(
      "usage: scenario-gen -- --dry-run\n" +
        "This tool only shows the requests a real PRISONER_MODE=enjoyable run would send (never calls a model). " +
        `A real generation happens inside \`npm run checkpoint\` (default generation temperature ${DEFAULT_SCENARIO_TEMPERATURE}).\n`
    );
    process.exitCode = 2;
    return;
  }
  // eslint-disable-next-line no-console
  console.log(renderDryRun(scenarioObjectFacts(), { model, generationTemperature }).join("\n"));
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
