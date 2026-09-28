import { SEARCH_SUSPICION_THRESHOLD, SEARCH_CATCH_LOCK_MAX, SEARCH_CATCH_SPOON_MIN } from "../world/mechanics.js";
import { PRISONER_NAME, WARDEN_NAME, WARDEN_PRONOUNS } from "../scenario.js";
import { OPEN_CATCH_BAR_MAX, OPEN_WINDOW_BAR_MAX, OPEN_DOOR_LOCK_MAX, OPEN_DOOR_LOCK_MARGIN, type DoorPriceMode, type WindowMode } from "./world.js";
import { findProperty } from "./scenarioObjects.js";
import type { BlockMode } from "./effects.js";
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
 *  `stated` is the env default since 2026-09-27 (PLAYTEST-2026-09-27 D6'); `unstated` is the arm, and it is
 *  byte-identical to every batch before that date. `openConditions`' own bare default stays `unstated`.
 *
 *  `doorPrice` (§50, issue #19) decides what the STATED clause claims, so it
 *  can never say more or less than `world.ts` enforces: `threshold` names the
 *  lock's own gate the way the window's own condition names the bar's;
 *  `free` (the default) keeps saying there is none.
 *
 *  `window` (§64.3, WORLD-ELABORATION-DESIGN.md §4.8): `"welded"` drops the
 *  two conditions naming the bar -- the window-unlock condition and the
 *  bar's own catch condition -- matching what `world.ts` no longer enforces
 *  under this arm (no `bar.integrity` resource at all). `"open"` (the
 *  default) is every batch recorded before this arm existed. */
export function openConditions(options: { door?: DoorMode; doorPrice?: DoorPriceMode; window?: WindowMode; block?: BlockMode } = {}): Condition[] {
  const grounds = `warden suspicion is at or above ${SEARCH_SUSPICION_THRESHOLD}`;
  const catches = `${WARDEN_NAME} catches ${PRISONER_NAME} and the game ends`;
  const examines = (what: string) => `${WARDEN_NAME} closely examines ${what}`;
  const finds = (what: string) => `${WARDEN_NAME} finds ${what}`;
  const weldedWindow = options.window === "welded";
  // §50: the stated clause can never claim more or less than `world.ts`
  // enforces, so it names whichever gate this arm actually applies.
  const doorGate = options.doorPrice === "threshold" ? OPEN_DOOR_LOCK_MAX : options.doorPrice === "margin" ? OPEN_DOOR_LOCK_MARGIN : null;
  const doorCondition: Condition =
    doorGate !== null
      ? { when: [`the lock's integrity is at or below ${doorGate}`], then: `${PRISONER_NAME} can open the door`, for: PRISONER_NAME }
      : { when: ["the door is shut"], then: `${PRISONER_NAME} can open it, with no threshold to meet first`, for: PRISONER_NAME };
  return [
    // §64.3: welded, the bar can never be worn loose, so this unlock is
    // never true and stating it would be a claim `world.ts` cannot honour.
    ...(weldedWindow ? [] : [{ when: [`the bar's integrity is at or below ${OPEN_WINDOW_BAR_MAX}`], then: `${PRISONER_NAME} can open the window`, for: PRISONER_NAME }]),
    // Kept beside the window so everything the reader can do stays together at
    // the top of the list; under this arm the catch conditions are 4-7.
    ...(options.door === "stated" ? [doorCondition] : []),
    { when: ["a way out stands open"], then: `${PRISONER_NAME} can leave the cell through it, and she has escaped`, for: PRISONER_NAME },
    // §64.3: welded, the bar has no integrity to be found worn at all.
    ...(weldedWindow ? [] : [{ when: [grounds, examines("the bar"), finds(`its integrity at or below ${OPEN_CATCH_BAR_MAX}`)], then: catches, for: WARDEN_NAME }]),
    { when: [grounds, examines("the lock"), finds(`its integrity at or below ${SEARCH_CATCH_LOCK_MAX}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("the spoon"), "the spoon is out in the open", finds(`its edge at or above ${SEARCH_CATCH_SPOON_MIN}`)], then: catches, for: WARDEN_NAME },
    { when: [grounds, examines("a way out"), finds("it standing open")], then: catches, for: WARDEN_NAME },
    ...(options.block === "on" ? blockConditions(weldedWindow) : []),
    // D15, the owner's answer to §80.4 question 2 (2026-09-27): the key ring lifts the door's gate for whoever
    // holds it (`OPEN_PASSAGE`, `world.ts`'s `keyOf`). Both are true rules of the world, so both chairs read both,
    // whoever holds it now; appended last so every earlier condition keeps its number. The door unstated, neither.
    ...(options.door === "stated" ? keyConditions() : []),
  ];
}

/** D15: who holds the key ring can open the door. Asserted against the world in `keyRing.test.ts` (the ring
 *  exists, it is the door's key, the door's part is the lock). */
function keyConditions(): Condition[] {
  return [WARDEN_NAME, PRISONER_NAME].map((holder) => ({ when: [`${holder} holds the key ring`], then: `${holder} can open the door`, for: holder }));
}

/**
 * PLAYTEST-2026-09-27 D4' and D4b, under `PRISONER_BLOCK=on` only: the warden's prevention moves, stated to
 * both chairs. Appended after every existing condition so the catch numbering the header and earlier batches
 * name is unchanged. Each claim is one `world.ts`/`mechanics.ts` enforces, asserted by `block.test.ts`: a
 * blocker holds a way out while her posture is above `POSTURE_ON_HER_FEET_ABOVE` and her sight above
 * `SIGHT_BLIND_AT_OR_BELOW` (`OPEN_LEAVE`); the bar and the lock each declare a restore table up to their max,
 * which `restore` has always used, and which was never stated to him (design R2).
 */
function blockConditions(weldedWindow: boolean): Condition[] {
  const mend = (part: "bar" | "lock"): Condition[] => {
    const declared = findProperty(part, "integrity");
    return declared ? [{ when: [`the ${part}'s integrity is below ${declared.max}`], then: `${WARDEN_NAME} can mend it`, for: WARDEN_NAME }] : [];
  };
  return [
    // The-prisoner#34: this condition is always about the WARDEN doing the blocking -- built from
    // `WARDEN_PRONOUNS` now, never the literal "her" it hardcoded before (discrepancy 8).
    { when: [`${WARDEN_NAME} stands in a way out`, `${WARDEN_NAME} is on ${WARDEN_PRONOUNS.possessive} feet`, `${WARDEN_NAME} can see`], then: `${PRISONER_NAME} cannot leave through it`, for: WARDEN_NAME },
    ...(weldedWindow ? [] : mend("bar")),
    ...mend("lock"),
  ];
}

export type ConditionsMode = "off" | "list" | "both";

/** Both minds get the condition list in place of the threshold sentences
 *  (§34), each read from its own side (§34.3), unless told otherwise: `both`
 *  is the **default** since 2026-09-27 (PLAYTEST-2026-09-27 D3, design R4: the
 *  warden could not see his own win conditions). `list` -- the prisoner's
 *  list only, the default by decision D3 of 2026-09-17 (she escaped 6 of 6
 *  against the rule sentences' 2 of 6, §34.2, §34.5) -- is now an arm, and a
 *  batch from 2026-09-17 to 2026-09-27 is comparable to a `list` run; `off` is
 *  the old rule-sentence baseline, and a batch from before 2026-09-17 is only
 *  comparable to an `off` run. Anything else stops the run rather than
 *  guessing. */
export function readConditionsMode(raw: string | undefined): ConditionsMode {
  if (raw === undefined || raw === "") return "both";
  if (raw === "off" || raw === "list" || raw === "both") return raw;
  throw new Error(`PRISONER_CONDITIONS: unrecognised value ${JSON.stringify(raw)} -- must be "both" (the default), "list" or "off"`);
}

/** `stated` unless asked, the default since 2026-09-27 (PLAYTEST-2026-09-27
 *  D6', RED-TEAM.md F5: under `margin` the door is priced, and a price she is
 *  never told is no line for her). `unstated` is the arm, byte-identical to
 *  every batch before that date -- the D3 lesson (§40.1): the change is named,
 *  never silent. Anything else stops the run rather than guessing. */
export function readDoorMode(raw: string | undefined): DoorMode {
  if (raw === undefined || raw === "") return "stated";
  if (raw === "unstated" || raw === "stated") return raw;
  throw new Error(`PRISONER_DOOR: unrecognised value ${JSON.stringify(raw)} -- must be "stated" (the default) or "unstated"`);
}
