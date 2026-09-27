// P5's environment check (PLAYTEST-2026-09-27-DESIGN.md §6 P5): reads the environment `run-batch.sh` hands a game
// through the GAME'S OWN readers -- the same `read*Mode` functions `src/checkpoint.ts` calls, each of which throws
// on a value it does not recognise -- and refuses to let a game start unless every arm is the one the batch's
// PREDICTION.md names. No network, no model, no world: this is the driver naming the arm (batch 6's lesson, "THE
// DRIVER NAMES THE ARM, in the log, per game"), checked by code rather than trusted.
//
//   npx tsx checkpoints/2026-09-28-contest-batch/env-check.mts --arm=A|B
import { gameArms, args, isMain } from "../2026-09-28-probe-kit/kit.mts";
import { getVariant } from "../../src/variant.js";
import { DEFAULT_MIND_MODEL, resolveRefereeModel, resolveVoiceModel, readSkipVoice, resolveSeatModels } from "../../src/modelRoles.js";

/** What every game of this batch must read, per arm. Arm B differs in `block` alone. */
export function expectedArms(arm: "A" | "B"): Record<string, string> {
  return {
    presence: "modelled",
    absence: "cadence",
    conditions: "both",
    door: "stated",
    doorPrice: "margin",
    window: "open",
    block: arm === "A" ? "on" : "off",
    personInstrument: "off",
    oneAct: "first",
    instrument: "off",
    deriveWording: "baseline",
    elision: "on",
    containerClause: "on",
    deriveRepeat: "off",
    refereeThinking: "off",
    witsThinking: "off",
  };
}

export function checkEnv(env: NodeJS.ProcessEnv, arm: "A" | "B"): string[] {
  const problems: string[] = [];
  const arms = gameArms(env) as unknown as Record<string, string>;
  for (const [k, v] of Object.entries(expectedArms(arm))) if (arms[k] !== v) problems.push(`${k} is ${arms[k]}, arm ${arm} needs ${v}`);
  const saved = process.env.PRISONER_VARIANT;
  process.env.PRISONER_VARIANT = env.PRISONER_VARIANT;
  if (getVariant() !== "open") problems.push(`PRISONER_VARIANT is ${JSON.stringify(env.PRISONER_VARIANT)}, the batch is the open variant`);
  process.env.PRISONER_VARIANT = saved;
  if (env.PRISONER_ROUNDS !== "10") problems.push(`PRISONER_ROUNDS is ${JSON.stringify(env.PRISONER_ROUNDS)}, the batch is ten rounds`);
  if (env.PRISONER_SKIP_VOICE !== undefined) problems.push("PRISONER_SKIP_VOICE is set; the batch runs with voice (unset it)");
  if (readSkipVoice(env.PRISONER_SKIP_VOICE)) problems.push("voice is skipped");
  for (const off of ["PRISONER_STRATEGY", "PRISONER_PROSE_SEAT", "PRISONER_PICK", "PRISONER_PRECEDENT_LEDGER", "PRISONER_WARDEN", "PRISONER_HUMAN", "PRISONER_ELABORATE"]) {
    if (env[off] !== undefined && env[off] !== "" && !(off === "PRISONER_ELABORATE" && env[off] === "off")) problems.push(`${off} is set (${env[off]}); the batch has none of it`);
  }
  const wits = env.PRISONER_WITS_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL;
  const voice = resolveVoiceModel(wits, env.PRISONER_VOICE_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(env.PRISONER_SKIP_VOICE));
  const warden = resolveSeatModels(env.PRISONER_WARDEN_MODEL, { wits, voice });
  const referee = resolveRefereeModel(env.PRISONER_REFEREE_MODEL);
  if (warden.wits !== DEFAULT_MIND_MODEL || referee !== DEFAULT_MIND_MODEL) problems.push(`warden ${warden.wits} / referee ${referee}: both must be ${DEFAULT_MIND_MODEL} (CLAUDE.md, local play is all-Muse)`);
  return problems;
}

export function describeEnv(env: NodeJS.ProcessEnv): string {
  const wits = env.PRISONER_WITS_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL;
  const voice = resolveVoiceModel(wits, env.PRISONER_VOICE_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(env.PRISONER_SKIP_VOICE));
  const seat = (raw: string | undefined) => resolveSeatModels(raw, { wits, voice });
  const arms = Object.entries(gameArms(env)).map(([k, v]) => `${k}=${v}`).join(" ");
  return `prisoner=${seat(env.PRISONER_PRISONER_MODEL).wits} warden=${seat(env.PRISONER_WARDEN_MODEL).wits} referee=${resolveRefereeModel(env.PRISONER_REFEREE_MODEL)} rounds=${env.PRISONER_ROUNDS} ${arms}`;
}

if (isMain(import.meta.url)) {
  const arm = args(process.argv.slice(2)).get("arm");
  if (arm !== "A" && arm !== "B") throw new Error("env-check: --arm=A or --arm=B");
  console.log(`env-check arm ${arm}: ${describeEnv(process.env)}`);
  const problems = checkEnv(process.env, arm);
  if (problems.length > 0) {
    for (const p of problems) console.error(`env-check: ${p}`);
    process.exit(1);
  }
  console.log(`env-check arm ${arm}: every arm is the one PREDICTION.md names.`);
}
