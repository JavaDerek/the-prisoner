// the-prisoner#23's environment check, modelled on `2026-09-28-contest-batch/env-check.mts` and the same
// discipline ("THE DRIVER NAMES THE ARM", batch 6's lesson): reads the environment `run-batch.sh` hands a game
// through the GAME'S OWN readers -- the same `read*Mode` functions `src/checkpoint.ts` calls, each of which
// throws on a value it does not recognise -- and refuses to let a game start unless every arm is the one this
// batch's `PREDICTION.md` names. No network, no model, no world.
//
// Self-contained rather than built on `../2026-09-28-probe-kit/kit.mts`'s `GameArms`/`gameArms`: that shared
// interface predates `PRISONER_CONDITION_ORDER` and this batch varies only that one arm, holding every other one
// at today's default, so a narrower, local check is both sufficient and does not require editing infrastructure
// several other overnight probes depend on. `isMain`/`args` are borrowed from the kit because they carry no such
// dependency.
//
//   npx tsx checkpoints/2026-09-28-condition-order/env-check.mts --arm=A|B
import { readConditionsMode, readDoorMode, readConditionOrder } from "../../src/open/conditions.js";
import { readDoorPrice, readWindowMode } from "../../src/open/world.js";
import { readPresenceMode, readAbsenceMode } from "../../src/open/briefing.js";
import { readBlockMode } from "../../src/open/effects.js";
import { readOneActMode, readPersonInstrumentMode, readInstrumentMode, readDeriveWordingMode, readElisionMode, readContainerClauseMode, readDeriveRepeatMode } from "../../src/open/referee.js";
import { resolveRefereeThinking, resolveWitsThinking } from "../../src/open/thinking.js";
import { getVariant } from "../../src/variant.js";
import { DEFAULT_MIND_MODEL, resolveRefereeModel, resolveVoiceModel, readSkipVoice, resolveSeatModels } from "../../src/modelRoles.js";
import { isMain, args } from "../2026-09-28-probe-kit/kit.mts";

export type Arm = "A" | "B";

/** Arm A is `window-first` (control, byte-identical to today); arm B is `door-first`, the-prisoner#23's own
 *  test. Everything else stays at today's default, held fixed on purpose -- the issue's question is about
 *  ORDER alone, so this batch is not the place to also vary door price, block, or anything else. */
export function expectedArms(arm: Arm): Record<string, string> {
  return {
    presence: "modelled",
    absence: "cadence",
    conditions: "both",
    door: "stated",
    doorPrice: "margin",
    window: "open",
    block: "on",
    personInstrument: "off",
    oneAct: "first",
    instrument: "off",
    deriveWording: "baseline",
    elision: "on",
    containerClause: "on",
    deriveRepeat: "off",
    refereeThinking: "off",
    witsThinking: "off",
    conditionOrder: arm === "A" ? "window-first" : "door-first",
  };
}

/** Every arm this batch cares about, read through the game's own readers. */
export function actualArms(env: NodeJS.ProcessEnv): Record<string, string> {
  return {
    presence: readPresenceMode(env.PRISONER_PRESENCE),
    absence: readAbsenceMode(env.PRISONER_ABSENCE),
    conditions: readConditionsMode(env.PRISONER_CONDITIONS),
    door: readDoorMode(env.PRISONER_DOOR),
    doorPrice: readDoorPrice(env.PRISONER_DOOR_PRICE),
    window: readWindowMode(env.PRISONER_WINDOW),
    block: readBlockMode(env.PRISONER_BLOCK),
    personInstrument: readPersonInstrumentMode(env.PRISONER_PERSON_INSTRUMENT),
    oneAct: readOneActMode(env.PRISONER_ONE_ACT),
    instrument: readInstrumentMode(env.PRISONER_INSTRUMENT),
    deriveWording: readDeriveWordingMode(env.PRISONER_DERIVE_WORDING),
    elision: readElisionMode(env.PRISONER_ELISION),
    containerClause: readContainerClauseMode(env.PRISONER_CONTAINER_CLAUSE),
    deriveRepeat: readDeriveRepeatMode(env.PRISONER_DERIVE_REPEAT),
    refereeThinking: resolveRefereeThinking(env.PRISONER_REFEREE_THINKING, env.PRISONER_THINKING).mode,
    witsThinking: resolveWitsThinking(env.PRISONER_WITS_THINKING, env.PRISONER_THINKING).mode,
    conditionOrder: readConditionOrder(env.PRISONER_CONDITION_ORDER),
  };
}

export function checkEnv(env: NodeJS.ProcessEnv, arm: Arm): string[] {
  const problems: string[] = [];
  const actual = actualArms(env);
  for (const [k, v] of Object.entries(expectedArms(arm))) if (actual[k] !== v) problems.push(`${k} is ${actual[k]}, arm ${arm} needs ${v}`);
  const saved = process.env.PRISONER_VARIANT;
  process.env.PRISONER_VARIANT = env.PRISONER_VARIANT;
  if (getVariant() !== "open") problems.push(`PRISONER_VARIANT is ${JSON.stringify(env.PRISONER_VARIANT)}, the batch is the open variant`);
  process.env.PRISONER_VARIANT = saved;
  if (env.PRISONER_ROUNDS !== "10") problems.push(`PRISONER_ROUNDS is ${JSON.stringify(env.PRISONER_ROUNDS)}, the batch is ten rounds`);
  // #23's measures are process measures (rulings, plans), not outcomes -- reasoning-only work, so voice is
  // skipped (CLAUDE.md "Test runs skip the voice model for reasoning-only work").
  if (env.PRISONER_SKIP_VOICE !== "1") problems.push(`PRISONER_SKIP_VOICE is ${JSON.stringify(env.PRISONER_SKIP_VOICE)}, the batch needs "1"`);
  for (const off of ["PRISONER_STRATEGY", "PRISONER_PROSE_SEAT", "PRISONER_PICK", "PRISONER_PRECEDENT_LEDGER", "PRISONER_WARDEN", "PRISONER_HUMAN", "PRISONER_ELABORATE"]) {
    if (env[off] !== undefined && env[off] !== "" && !(off === "PRISONER_ELABORATE" && env[off] === "off")) problems.push(`${off} is set (${env[off]}); the batch has none of it`);
  }
  const wits = env.PRISONER_WITS_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL;
  const voice = resolveVoiceModel(wits, env.PRISONER_VOICE_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(env.PRISONER_SKIP_VOICE));
  const prisoner = resolveSeatModels(env.PRISONER_PRISONER_MODEL, { wits, voice });
  const warden = resolveSeatModels(env.PRISONER_WARDEN_MODEL, { wits, voice });
  const referee = resolveRefereeModel(env.PRISONER_REFEREE_MODEL);
  // All-Muse, all three chairs (CLAUDE.md "Local play is all-Muse"): #23's measures are process measures, which
  // vary locally even though all-Muse outcomes do not (b6's 14 all-Muse games were 14 timeouts, 0 escapes) --
  // there is no case here for a hosted outcome chair.
  if (prisoner.wits !== DEFAULT_MIND_MODEL || warden.wits !== DEFAULT_MIND_MODEL || referee !== DEFAULT_MIND_MODEL) {
    problems.push(`prisoner ${prisoner.wits} / warden ${warden.wits} / referee ${referee}: all three must be ${DEFAULT_MIND_MODEL}`);
  }
  return problems;
}

export function describeEnv(env: NodeJS.ProcessEnv): string {
  const wits = env.PRISONER_WITS_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL;
  const voice = resolveVoiceModel(wits, env.PRISONER_VOICE_MODEL ?? env.PRISONER_MODEL ?? DEFAULT_MIND_MODEL, readSkipVoice(env.PRISONER_SKIP_VOICE));
  const seat = (raw: string | undefined) => resolveSeatModels(raw, { wits, voice });
  const arms = Object.entries(actualArms(env))
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  return `prisoner=${seat(env.PRISONER_PRISONER_MODEL).wits} warden=${seat(env.PRISONER_WARDEN_MODEL).wits} referee=${resolveRefereeModel(env.PRISONER_REFEREE_MODEL)} rounds=${env.PRISONER_ROUNDS} skipVoice=${env.PRISONER_SKIP_VOICE} ${arms}`;
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
