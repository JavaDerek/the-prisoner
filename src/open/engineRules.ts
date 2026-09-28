import type { EffectKind, Magnitude } from "./effects.js";
import type { OpenPropertyKey } from "./scenarioObjects.js";

/**
 * the-prisoner#5, step 1 (CODER-BRIEF's coordinator decision): under
 * `PRISONER_OPEN_RULES=engine` (`openRulesMode.ts`), the referee's `effect`
 * question stops offering the eleven named effects (`effects.ts`'s
 * `EFFECT_KINDS`) and instead offers run-dmcp's own five change kinds --
 * `write` (a numeric fact, up or down), `set` (a non-numeric column -- who
 * holds a thing, or a character's own place), `transfer`, `create`,
 * `destroy` -- plus `reveal` and `none`. This module is the pure mapping
 * table from that engine-terms ruling back onto the SAME `EffectKind` this
 * repository's existing `planEffect` (`effects.ts`) and `mechanics.ts`
 * already resolve, so this landing changes NOTHING about how an effect
 * actually plays out -- every gate (a way out's passage through its own
 * open/close mechanic and part thresholds; custody's C1; D11/D12/D15) stays
 * exactly the code path it always was, because a translated ruling walks
 * through it unchanged. See docs/OPEN-VARIANT.md's new section (after §83)
 * for the full table and what is left unreachable, and why.
 *
 * WHY `reveal` IS NOT ONE OF THE FIVE: `OPEN_REVEAL` and `OPEN_NOISE`
 * (`mechanics.ts`) both resolve with `changes: []` -- an examination and a
 * deliberate sound make no engine-recorded change at all, so neither fits
 * any of write/set/transfer/create/destroy by construction. This is the
 * opposite of the issue's own table (docs/issues/5.md, written 2026-09-15,
 * before D4'/D9/D12/custody's current shape), which listed `reveal` under
 * `set` -- the code as it stands today does not agree, and the code is
 * ground truth here. Losing `reveal` would make the game unplayable (a
 * prisoner who can never examine the bar), so it stays a leaf answer key,
 * unchanged, in both modes -- this landing loosens the vocabulary of
 * CHANGES, not the vocabulary of reads. `noise` is the mirror case and is
 * left unreachable under `engine` rules for the identical reason (see the
 * `set`-on-a-person note below for the other unreachable case, and the docs
 * section for `block`, `destroy` and `transfer`).
 */
export type EngineChangeKind = "write" | "set" | "transfer" | "create" | "destroy" | "reveal" | "none";
export const ENGINE_CHANGE_KINDS: readonly EngineChangeKind[] = ["write", "set", "transfer", "create", "destroy", "reveal", "none"];

/** `write`'s own second closed key: which way the numeric fact moves. Every
 *  other engine kind answers `"none"` here (the question is asked once, in
 *  the same batch as `effect`, so it cannot be conditioned on `effect`'s own
 *  answer -- exactly why `magnitude`/`perceptibility` are always asked too). */
export type Direction = "up" | "down" | "none";
export const DIRECTIONS: readonly Direction[] = ["up", "down", "none"];

/** `set`'s own second closed key, for the custody case ONLY: who ends up
 *  holding the thing. Ignored when the target is a way out (`leave` reads no
 *  holder) or a person (unreachable, see below). */
export type HolderTarget = "actor" | "other" | "none";
export const HOLDER_TARGETS: readonly HolderTarget[] = ["actor", "other", "none"];

/**
 * The mapping table itself (CODER-BRIEF: "write-down -> wear, write-up ->
 * restore, set-holder -> take/give, create -> derive, and so on"), extended
 * here to the way-out gates the coordinator named as never-bypassable:
 *
 * | engine effect | condition                                   | -> EffectKind |
 * |---|---|---|
 * | write | direction=none (ungrounded)                       | none |
 * | write | property=passage, direction=up/down               | open / close |
 * | write | property=concealment, direction=up/down           | conceal / expose |
 * | write | any other declared property, direction=up/down    | restore / wear |
 * | set | target is a way out                                 | leave (whatever `to` answered) |
 * | set | target is a person                                  | none (unreachable -- see docs) |
 * | set | to=actor / to=other                                 | take / give |
 * | set | to=none                                              | none |
 * | create | --                                                | derive |
 * | destroy | --                                               | none (unreachable -- see docs) |
 * | transfer | --                                              | none (unreachable -- see docs) |
 * | reveal | --                                                | reveal (unchanged, see module header) |
 * | none | --                                                  | none |
 *
 * A `set` on a PERSON is left unreachable this landing: a search fans out
 * over every thing she holds (`OPEN_SEARCH`'s own `candidates` loop), which
 * is not "one column on the target's own row" the way `owner_id`/
 * `owner_type` (custody) or `location_id` (leave) are -- there is no single
 * engine primitive this table can point it at without inventing one, and
 * this landing maps only onto mechanics that already exist. `destroy` and
 * `transfer` are unreachable for the reasons docs/OPEN-VARIANT.md's new
 * section gives (no declared object may be removed outright without an
 * authored replacement, and this game has no conserved numeric quantity to
 * move). None of the three block anything else: an intent that would have
 * used them simply rules `none`, applying nothing, the same safe default
 * every other ungrounded path in this repository already falls to.
 */
export function translateEngineEffect(params: {
  engineEffect: EngineChangeKind;
  direction: Direction;
  to: HolderTarget;
  property: OpenPropertyKey | "none";
  targetIsExit: boolean;
  targetIsPerson: boolean;
}): EffectKind {
  const { engineEffect, direction, to, property, targetIsExit, targetIsPerson } = params;
  if (engineEffect === "reveal") return "reveal";
  if (engineEffect === "write") {
    if (direction === "none") return "none";
    if (property === "passage") return direction === "up" ? "open" : "close";
    // A person never declares `concealment` (only an object or a
    // person-container does) -- excluded here, not just left to the
    // declared-property check downstream, because `conceal`/`expose` on a
    // PERSON is exactly `effects.ts`'s own search-recognition shape
    // (`isPerson`), which would silently exempt this ruling from needing a
    // property citation at all (the custody bucket, `referee.ts`). Search
    // stays unreachable under engine rules this landing (see this module's
    // header); falling through to the generic write/restore bucket below
    // keeps it refused for the ordinary reason -- no declared property --
    // rather than by accident sailing through custody's exemption.
    if (property === "concealment" && !targetIsPerson) return direction === "up" ? "conceal" : "expose";
    return direction === "up" ? "restore" : "wear";
  }
  if (engineEffect === "set") {
    if (targetIsExit) return "leave";
    if (targetIsPerson) return "none";
    if (to === "actor") return "take";
    if (to === "other") return "give";
    return "none";
  }
  if (engineEffect === "create") return "derive";
  // destroy, transfer, none: no mapped mechanic in this landing.
  return "none";
}

/** CODER-BRIEF: "a held instrument's presence change[s] the magnitude by one
 *  step" -- one step up the SAME three-rung ladder (`effects.ts`'s
 *  `MAGNITUDES`) every wear/restore/conceal/expose/open/close resolution
 *  already reads its amount from, never a new table. Already at the
 *  ceiling: stays there (there is no fourth rung to reach for). */
export function stepUpMagnitude(magnitude: Magnitude): Magnitude {
  if (magnitude === "slight") return "moderate";
  if (magnitude === "moderate") return "substantial";
  return "substantial";
}
