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
export type DoorMode = "unstated" | "stated";

/** §46: `stated` adds one true condition for the cell's OTHER way out. Her list
 *  has always named one way to win -- the window, gated on the bar -- while the
 *  door's part, the lock, appears only in a condition that catches her, so the
 *  second exit has never been stated as an exit. The claim it adds is exactly
 *  what `world.ts` declares: the door's exit has `openWhenPartAtMost: null`, no
 *  threshold, where the window's is 50. Its own test asserts that against the
 *  world, so the condition cannot outlive the fact.
 *
 *  `unstated` is the default and is byte-identical to every batch before it. */
export function openConditions(options: { door?: DoorMode } = {}): Condition[] {
  const grounds = `warden suspicion is at or above ${SEARCH_SUSPICION_THRESHOLD}`;
  const catches = `${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends`;
  const examines = (what: string) => `${WARDEN_NAME} closely examines ${what}`;
  const finds = (what: string) => `${WARDEN_NAME} finds ${what}`;
  return [
    { when: [`the bar's integrity is at or below ${OPEN_WINDOW_BAR_MAX}`], then: `${PRISONER_NAME} can open the window`, for: PRISONER_NAME },
    // Kept beside the window so everything the reader can do stays together at
    // the top of the list; under this arm the catch conditions are 4-7.
    ...(options.door === "stated"
      ? [{ when: ["the door is shut"], then: `${PRISONER_NAME} can open it, with no threshold to meet first`, for: PRISONER_NAME }]
      : []),
    { when: ["a way out stands open"], then: `${PRISONER_NAME} can leave the cell through it, and she has escaped`, for: PRISONER_NAME },
    { when: [grounds, examines("the bar"), finds(`its integrity at or below ${OPEN_CATCH_BAR_MAX}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("the lock"), finds(`its integrity at or below ${SEARCH_CATCH_LOCK_MAX}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("the spoon"), "the spoon is out in the open", finds(`its edge at or above ${SEARCH_CATCH_SPOON_MIN}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("a way out"), finds("it standing open")], then: catches, for: WARDEN_NAME },
  ];
}

export type ConditionsMode = "off" | "list" | "both";

/** The prisoner's mind gets the condition list in place of the threshold
 *  sentences (§34) unless told otherwise: `list` is the **default** by decision
 *  D3 (2026-09-17), because with it she escaped 6 of 6 against the rule
 *  sentences' 2 of 6 (§34.2, §34.5). `both` gives the list to the warden's mind
 *  too, read from its own side (§34.3); `off` is the old rule-sentence
 *  baseline, now an arm you ask for rather than the one you get by saying
 *  nothing. Anything else stops the run rather than guessing.
 *
 *  A batch from before this date is only comparable to an `off` run. */
export function readConditionsMode(raw: string | undefined): ConditionsMode {
  if (raw === undefined || raw === "") return "list";
  if (raw === "off" || raw === "list" || raw === "both") return raw;
  throw new Error(`PRISONER_CONDITIONS: unrecognised value ${JSON.stringify(raw)} -- must be "list" (the default), "both" or "off"`);
}

/** `unstated` unless asked: the door condition is §46's arm, and a default that
 *  changed silently would make every earlier batch incomparable -- the D3 lesson
 *  (§40.1), applied before the fact rather than after it. Anything else stops
 *  the run rather than guessing. */
export function readDoorMode(raw: string | undefined): DoorMode {
  if (raw === undefined || raw === "") return "unstated";
  if (raw === "unstated" || raw === "stated") return raw;
  throw new Error(`PRISONER_DOOR: unrecognised value ${JSON.stringify(raw)} -- must be "stated" or "unstated" (the default)`);
}
