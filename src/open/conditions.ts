import { SEARCH_SUSPICION_THRESHOLD, SEARCH_CATCH_LOCK_MAX, SEARCH_CATCH_SPOON_MIN } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME } from "../scenario.js";
import { OPEN_CATCH_BAR_MAX, OPEN_WINDOW_BAR_MAX } from "./world.js";
import type { Condition } from "./conditionList.js";

/**
 * This game's thresholds as the generic condition list's data (OPEN-VARIANT.md
 * §34). Built from the same constants `mind.ts`'s rule sentences, `world.ts`'s
 * way-out gate and `gameEnd.ts`'s catch read, so the list cannot state a line
 * the game does not play by. The catch rule's four alternatives become four
 * flat conditions: the list has no "or".
 */
export function openConditions(): Condition[] {
  const grounds = `warden suspicion is at or above ${SEARCH_SUSPICION_THRESHOLD}`;
  const catches = `${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends`;
  const examines = (what: string) => `${WARDEN_NAME} closely examines ${what}`;
  const finds = (what: string) => `${WARDEN_NAME} finds ${what}`;
  return [
    { when: [`the bar's integrity is at or below ${OPEN_WINDOW_BAR_MAX}`], then: "the window can be opened", for: PRISONER_NAME },
    { when: [grounds, examines("the bar"), finds(`its integrity at or below ${OPEN_CATCH_BAR_MAX}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("the lock"), finds(`its integrity at or below ${SEARCH_CATCH_LOCK_MAX}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("the spoon"), "the spoon is out in the open", finds(`its edge at or above ${SEARCH_CATCH_SPOON_MIN}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("a way out"), finds("it standing open")], then: catches, for: WARDEN_NAME },
  ];
}

export type ConditionsMode = "list";

/** `PRISONER_CONDITIONS=list` gives the prisoner's mind the condition list in
 *  place of the threshold sentences (§34); unset is the baseline. Anything
 *  else stops the run rather than guessing. */
export function readConditionsMode(raw: string | undefined): ConditionsMode | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "list") return "list";
  throw new Error(`PRISONER_CONDITIONS: unrecognised value ${JSON.stringify(raw)} -- must be "list" or unset`);
}
