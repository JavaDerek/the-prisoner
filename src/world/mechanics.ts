import {
  createResolver,
  declareIrreversible,
  type Mechanic,
  type AdjudicationInput,
  type Adjudication,
  type IntendedWrite,
  type Resolver,
  type Outcome,
} from "run-dmcp";
import type { World } from "./setup.js";
import { numericFactFrom, readNumericFact } from "./facts.js";

/**
 * The registered mechanics of design Appendix A.4, minus custody. Every
 * mechanic here reads only `input.constraint` (the read surface `resolve()`
 * hands it -- there is no database handle anywhere in `AdjudicationInput`,
 * so a mechanic cannot write outside the `changes` it returns) and returns
 * `IntendedWrite`s over the five bounded/resolve_only resources of
 * Appendix A.2, plus the plain flag columns `schema.ts` added (`cut`,
 * `concealed`, and the cell's `escaped`/`caught`) -- all numeric, per this
 * checkpoint's correction 3 (custody, and therefore CONFISCATE, is out).
 *
 * REVISION (this task's brief, "a battle of wits, not two scripts"): the
 * numbers below were retuned so both endings are reachable and neither is
 * trivial (see `src/__tests__/balance.test.ts`), and two new mechanics
 * (ESCAPE, SEARCH) and one internal one (TIME_DECAY) were added. Every
 * numeric intent still goes through `resolve()`; adjudication still reads
 * only `input.constraint`.
 */

const CUT_KEY = "cut";
const CONCEALED_KEY = "concealed";
const ESCAPED_KEY = "escaped";
const CAUGHT_KEY = "caught";

function valueOf(input: AdjudicationInput, entityId: string, key: string): number {
  const value = numericFactFrom(input.constraint.mustHonor, entityId, key);
  if (value === null) {
    throw new Error(`mechanics: no numeric fact for entity '${entityId}' key '${key}' at t=${input.constraint.t}`);
  }
  return value;
}

/**
 * A.2's `bounded` constraint REJECTS an out-of-range write rather than
 * clamping it (run-dmcp's `constrained.ts`, `assertConstraintsAllow`'s
 * `bounded` branch: "rejected value ... instead of clamping"). Clamping is
 * therefore this repository's own job, done here before a mechanic ever
 * proposes a value, using `mode: "set"` against a value already computed
 * from the current one -- never `mode: "delta"` against a fixed amount,
 * which would overshoot the bound and be refused instead of settling at it.
 */
function clampToResource(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** A clamped `mode: "set"` write against one of Appendix A.2's five
 *  bounded/resolve_only resources. */
function setResource(entityId: string, key: string, value: number): IntendedWrite {
  return { kind: "write", entityId, key, mode: "set", value: clampToResource(value), bounds: { minValue: 0, maxValue: 100 } };
}

/** An unbounded flag write (0/1) -- `cut`/`concealed`/`escaped`/`caught`
 *  carry no declared `resolve_only`/`bounded` constraint (Appendix A's
 *  constraint family applies to A.2's five resources only; a plain flag
 *  column has none), so no `bounds` object is passed. */
function writeFlag(entityId: string, key: string, value: 0 | 1): IntendedWrite {
  return { kind: "write", entityId, key, mode: "set", value };
}

/**
 * Every mechanic's `description` optionally carries a caller-supplied note
 * (`Proposal.parameters.note`) appended verbatim. `parameters` is opaque to
 * the engine, so this is ordinary use of that field, not a second channel
 * around it -- see `src/mind/__tests__/seamConformance.*.test.ts`.
 */
function withNote(base: string, input: AdjudicationInput): string {
  const note = input.parameters?.note;
  return typeof note === "string" && note.length > 0 ? `${base} (${note})` : base;
}

/** Amount FILE removes from `bar_integrity` per ordinary attempt. */
export const FILE_AMOUNT = 15;
/** Amount FILE removes when `spoon_edge` is sharp enough to help (design:
 *  "-25 if spoon_edge >= 30"). */
export const FILE_AMOUNT_SHARP = 25;
/** `spoon_edge` at or above which FILE uses the sharper amount. */
export const FILE_SHARP_THRESHOLD = 30;
/** Amount SHIM removes from `lock_integrity` per attempt. */
export const SHIM_AMOUNT = 20;
/** Amount HONE adds to `spoon_edge` per attempt. */
export const HONE_AMOUNT = 10;
/** Amount FILE raises `warden_suspicion` by. */
export const FILE_SUSPICION_BUMP = 10;
/** Amount HONE raises `warden_suspicion` by. */
export const HONE_SUSPICION_BUMP = 5;
/** The level ROTATE_GUARD sets `guard_attention` to. */
export const ROTATE_GUARD_LEVEL = 80;
/** Amount time decay lowers `guard_attention` by, once per full round. */
export const TIME_DECAY_AMOUNT = 10;
/** Amount a failed ESCAPE raises `warden_suspicion` by. */
export const FAILED_ESCAPE_SUSPICION_BUMP = 30;
/** `warden_suspicion` at or above which SEARCH is permitted at all. */
export const SEARCH_SUSPICION_THRESHOLD = 40;
/** SEARCH catches the prisoner when `bar_integrity` is at or below this. */
export const SEARCH_CATCH_BAR_MAX = 50;
/** SEARCH catches the prisoner when `lock_integrity` is at or below this. */
export const SEARCH_CATCH_LOCK_MAX = 40;
/** SEARCH catches the prisoner when `spoon_edge` is at or above this AND the
 *  spoon is not concealed. */
export const SEARCH_CATCH_SPOON_MIN = 20;
/** ESCAPE succeeds only when `guard_attention` is below this. */
export const ESCAPE_GUARD_MAX = 50;

/** A positive, three-band description of `bar_integrity` -- what OBSERVE
 *  reveals about the bar (design: "the bar's integrity as a band"), never
 *  the exact number, because OBSERVE cannot give the warden the precision a
 *  belief-worthy `expects` would need. */
export function barBand(barIntegrity: number): "intact" | "worn" | "badly worn" {
  if (barIntegrity >= 90) return "intact";
  if (barIntegrity >= 50) return "worn";
  return "badly worn";
}

export function buildMechanics(world: World): Mechanic[] {
  const { resources, barId, spoonId, cellId } = world;

  function suspicionBump(input: AdjudicationInput, amount: number): IntendedWrite {
    const current = valueOf(input, resources.wardenSuspicion, "value");
    return setResource(resources.wardenSuspicion, "value", current + amount);
  }

  /**
   * Warden presence (coordinator's fix, item 2): `loop.ts` computes this
   * caller-side, from the warden's own most recent `round_log` mechanic and
   * `WARDEN_PRESENCE` (below), and passes it as an opaque
   * `Proposal.parameters` entry -- never inspected or interpreted by the
   * engine, exactly the way `withNote`'s own `parameters.note` already
   * isn't. Defaults to `true` (present) when the caller omits it entirely,
   * so every existing call site and test that never mentions presence keeps
   * its original behaviour unchanged.
   */
  function wardenPresent(input: AdjudicationInput): boolean {
    const value = input.parameters?.wardenPresent;
    return typeof value === "boolean" ? value : true;
  }

  const FILE: Mechanic = {
    name: "FILE",
    adjudicate(input: AdjudicationInput): Adjudication {
      const current = valueOf(input, resources.barIntegrity, "value");
      const spoonEdge = valueOf(input, resources.spoonEdge, "value");
      const amount = spoonEdge >= FILE_SHARP_THRESHOLD ? FILE_AMOUNT_SHARP : FILE_AMOUNT;
      const intended = current - amount;
      const changes = [setResource(resources.barIntegrity, "value", intended)];
      // Unheard while the warden is away (coordinator's fix, item 2): the
      // bar still wears down -- that is a physical fact -- but nothing
      // raises warden_suspicion when there is nobody in the cell to notice.
      if (wardenPresent(input)) {
        changes.push(suspicionBump(input, FILE_SUSPICION_BUMP));
      }
      if (intended <= 0) {
        changes.push(writeFlag(barId, CUT_KEY, 1));
      }
      return {
        changes,
        result: { mechanic: "FILE", barIntegrityBefore: current },
        description: withNote(
          intended <= 0
            ? "The prisoner files at the bar -- it gives way. The bar is cut."
            : "The prisoner files at the bar.",
          input
        ),
      };
    },
  };

  const SHIM: Mechanic = {
    name: "SHIM",
    adjudicate(input: AdjudicationInput): Adjudication {
      const current = valueOf(input, resources.lockIntegrity, "value");
      return {
        // Quiet: SHIM raises no suspicion (design: "warden_suspicion +0
        // (quiet)").
        changes: [setResource(resources.lockIntegrity, "value", current - SHIM_AMOUNT)],
        result: { mechanic: "SHIM", lockIntegrityBefore: current },
        description: withNote("The prisoner works a shim into the lock.", input),
      };
    },
  };

  const HONE: Mechanic = {
    name: "HONE",
    adjudicate(input: AdjudicationInput): Adjudication {
      const current = valueOf(input, resources.spoonEdge, "value");
      // HONE un-conceals the spoon (design: "un-conceals the spoon") -- you
      // cannot hone what you cannot reach.
      const changes: IntendedWrite[] = [
        setResource(resources.spoonEdge, "value", current + HONE_AMOUNT),
        writeFlag(spoonId, CONCEALED_KEY, 0),
      ];
      // Unheard while the warden is away (coordinator's fix, item 2).
      if (wardenPresent(input)) {
        changes.push(suspicionBump(input, HONE_SUSPICION_BUMP));
      }
      return {
        changes,
        result: { mechanic: "HONE", spoonEdgeBefore: current },
        description: withNote("The prisoner hones the spoon's edge.", input),
      };
    },
  };

  const CONCEAL: Mechanic = {
    name: "CONCEAL",
    adjudicate(input: AdjudicationInput): Adjudication {
      // Conceals the SPOON under the loose tile (design: "conceals the
      // spoon under the loose tile") -- the loose tile is where it is
      // hidden, but the fact that matters to OBSERVE/SEARCH is the spoon's
      // own `concealed` state.
      return {
        changes: [writeFlag(spoonId, CONCEALED_KEY, 1)],
        result: { mechanic: "CONCEAL" },
        description: withNote("The prisoner hides the spoon under the loose tile.", input),
      };
    },
  };

  const INSPECT: Mechanic = {
    name: "INSPECT",
    adjudicate(input: AdjudicationInput): Adjudication {
      // Reveals true lock_integrity and guard_attention (design Appendix A.4)
      // -- never bar_integrity, which the prisoner already knows directly
      // after its own FILE.
      return {
        changes: [],
        result: {
          mechanic: "INSPECT",
          lockIntegrity: valueOf(input, resources.lockIntegrity, "value"),
          guardAttention: valueOf(input, resources.guardAttention, "value"),
        },
        description: withNote("The prisoner inspects the cell closely.", input),
      };
    },
  };

  const ESCAPE: Mechanic = {
    name: "ESCAPE",
    adjudicate(input: AdjudicationInput): Adjudication {
      const cut = valueOf(input, barId, CUT_KEY) === 1;
      const lockIntegrity = valueOf(input, resources.lockIntegrity, "value");
      const guardAttention = valueOf(input, resources.guardAttention, "value");
      // Coordinator's fix, item 2: "the guard still governs success" --
      // guard_attention is the physical security staff, never the warden's
      // own personal presence, so the SUCCESS condition is entirely
      // unaffected by whether the warden itself is in the cell right now.
      const opening = cut || lockIntegrity <= 0;
      const success = opening && guardAttention < ESCAPE_GUARD_MAX;

      if (success) {
        return {
          changes: [writeFlag(cellId, ESCAPED_KEY, 1)],
          result: { mechanic: "ESCAPE", success: 1 },
          description: withNote("The prisoner slips free of the cell. Escaped.", input),
        };
      }
      // A FAILED attempt is unheard while the warden is away, like every
      // other presence-gated move ("keep it simple: it's unheard too").
      const changes = wardenPresent(input) ? [suspicionBump(input, FAILED_ESCAPE_SUSPICION_BUMP)] : [];
      return {
        changes,
        result: { mechanic: "ESCAPE", success: 0 },
        description: withNote("The prisoner tries to escape and is caught short -- still inside the cell.", input),
      };
    },
  };

  const REPLACE_BAR: Mechanic = {
    name: "REPLACE_BAR",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [setResource(resources.barIntegrity, "value", 100), writeFlag(barId, CUT_KEY, 0)],
        result: { mechanic: "REPLACE_BAR" },
        // REVISION (coordinator's fix, finding (a)): covert now -- done
        // while the prisoner is in the yard, so it never reaches the
        // prisoner's own perception (`SEEN_BY_OTHER_AS.REPLACE_BAR` below is
        // `null`; `loop.ts` no longer updates the prisoner's bar belief on
        // it either).
        description: withNote("The warden replaces the bar while the prisoner is in the yard.", input),
      };
    },
  };

  const SERVICE_LOCK: Mechanic = {
    name: "SERVICE_LOCK",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [setResource(resources.lockIntegrity, "value", 100)],
        result: { mechanic: "SERVICE_LOCK" },
        description: withNote("The warden services the lock.", input),
      };
    },
  };

  // New (coordinator's fix, finding 2 -- "covert irony can't arise"):
  // without a way to learn the lock's true integrity WITHOUT grounds, the
  // warden never has a reason to SERVICE_LOCK covertly, so no covert warden
  // act could ever make the prisoner's own belief stale. CHECK_LOCK closes
  // that gap: covert (`SEEN_BY_OTHER_AS.CHECK_LOCK` is null), no suspicion
  // change, no grounds required -- it only reads, through the mechanic's
  // own `result`, exactly the way INSPECT/OBSERVE already do.
  const CHECK_LOCK: Mechanic = {
    name: "CHECK_LOCK",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [],
        result: { mechanic: "CHECK_LOCK", lockIntegrity: valueOf(input, resources.lockIntegrity, "value") },
        description: withNote("The warden checks the lock's condition from outside the cell.", input),
      };
    },
  };

  const ROTATE_GUARD: Mechanic = {
    name: "ROTATE_GUARD",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [setResource(resources.guardAttention, "value", ROTATE_GUARD_LEVEL)],
        result: { mechanic: "ROTATE_GUARD" },
        description: withNote("The warden rotates the guard.", input),
      };
    },
  };

  const OBSERVE: Mechanic = {
    name: "OBSERVE",
    adjudicate(input: AdjudicationInput): Adjudication {
      // No suspicion change (design: "No suspicion change"). Reveals true
      // spoon_edge only if the spoon is not concealed; always reveals the
      // bar as a band, never an exact number.
      const concealed = valueOf(input, spoonId, CONCEALED_KEY) === 1;
      const bar = valueOf(input, resources.barIntegrity, "value");
      const result: Record<string, unknown> = { mechanic: "OBSERVE", barBand: barBand(bar) };
      if (!concealed) {
        result.spoonEdge = valueOf(input, resources.spoonEdge, "value");
      }
      return {
        changes: [],
        result,
        description: withNote("The warden observes the prisoner.", input),
      };
    },
  };

  const SEARCH: Mechanic = {
    name: "SEARCH",
    adjudicate(input: AdjudicationInput): Adjudication {
      const suspicion = valueOf(input, resources.wardenSuspicion, "value");
      if (suspicion < SEARCH_SUSPICION_THRESHOLD) {
        return {
          changes: [],
          result: { mechanic: "SEARCH", grounds: false },
          description: withNote("The warden has no grounds to search yet.", input),
        };
      }

      const bar = valueOf(input, resources.barIntegrity, "value");
      const lock = valueOf(input, resources.lockIntegrity, "value");
      const spoonEdge = valueOf(input, resources.spoonEdge, "value");
      const concealed = valueOf(input, spoonId, CONCEALED_KEY) === 1;

      const caught = bar <= SEARCH_CATCH_BAR_MAX || lock <= SEARCH_CATCH_LOCK_MAX || (spoonEdge >= SEARCH_CATCH_SPOON_MIN && !concealed);

      if (caught) {
        return {
          changes: [writeFlag(cellId, CAUGHT_KEY, 1)],
          result: { mechanic: "SEARCH", grounds: true, caught: 1, barIntegrity: bar, lockIntegrity: lock, spoonEdge },
          description: withNote("The warden searches the cell and finds the evidence. Caught.", input),
        };
      }
      return {
        changes: [setResource(resources.wardenSuspicion, "value", 0)],
        result: { mechanic: "SEARCH", grounds: true, caught: 0, barIntegrity: bar, lockIntegrity: lock, spoonEdge },
        description: withNote("The warden searches the cell and finds nothing. A false alarm.", input),
      };
    },
  };

  // Shared by both principals -- the engine dispatches by name and has no
  // notion of who proposed a mechanic (design §6.1).
  const WAIT: Mechanic = {
    name: "WAIT",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [],
        result: { mechanic: "WAIT" },
        description: withNote("Time passes.", input),
      };
    },
  };

  // Never offered to either mind (absent from PRISONER_MOVES/WARDEN_MOVES),
  // but still a REGISTERED, resolve()-dispatched mechanic -- design: "an
  // audited referee resolution, not a direct write." The loop calls this
  // once per full round, regardless of what either principal did that
  // round.
  const TIME_DECAY: Mechanic = {
    name: "TIME_DECAY",
    adjudicate(input: AdjudicationInput): Adjudication {
      const guard = valueOf(input, resources.guardAttention, "value");
      return {
        changes: [setResource(resources.guardAttention, "value", guard - TIME_DECAY_AMOUNT)],
        result: { mechanic: "TIME_DECAY" },
        description: "Time passes; the guard's attention wanes.",
      };
    },
  };

  return [FILE, SHIM, HONE, CONCEAL, INSPECT, ESCAPE, REPLACE_BAR, SERVICE_LOCK, CHECK_LOCK, ROTATE_GUARD, OBSERVE, SEARCH, WAIT, TIME_DECAY];
}

export const PRISONER_MOVES = ["FILE", "SHIM", "HONE", "CONCEAL", "INSPECT", "ESCAPE", "WAIT"] as const;
export const WARDEN_MOVES = ["REPLACE_BAR", "SERVICE_LOCK", "CHECK_LOCK", "SEARCH", "ROTATE_GUARD", "OBSERVE", "WAIT"] as const;

/**
 * One plain sentence per registered mechanic, saying what it does and what
 * it needs. ONE source: `buildPrisonerPrompt`/`buildWardenPrompt`
 * (`src/mind/*Mind.ts`) render the prompt's move list from this table, and
 * `moveDescriptions.test.ts` asserts every entry in `PRISONER_MOVES`/
 * `WARDEN_MOVES` has one.
 *
 * Coordinator's fix, item 4: "both sides know the rules; they don't know
 * the state" -- every threshold and exact amount a mechanic depends on is
 * stated here, interpolated straight from the same exported constants the
 * mechanic itself reads, so the prose can never drift from what the code
 * actually does (the existing `moveDescriptions.test.ts` assertions --
 * e.g. `FILE` mentions "bar" -- keep holding; this only adds precision).
 */
export const MOVE_DESCRIPTIONS: Record<string, string> = {
  FILE: `Files at the bar, lowering bar_integrity by ${FILE_AMOUNT} (by ${FILE_AMOUNT_SHARP} if spoon_edge is at or above ${FILE_SHARP_THRESHOLD}); raises warden_suspicion by ${FILE_SUSPICION_BUMP}.`,
  SHIM: `Works a shim into the lock, lowering lock_integrity by ${SHIM_AMOUNT} -- quiet; raises no suspicion.`,
  HONE: `Hones the spoon's edge, raising spoon_edge by ${HONE_AMOUNT}; un-conceals the spoon; raises warden_suspicion by ${HONE_SUSPICION_BUMP}.`,
  CONCEAL: "Hides the spoon under the loose tile so it is no longer visible to the warden -- quiet; raises no suspicion.",
  INSPECT: "Looks closely at the cell; reveals the lock's true integrity and the guard's true attention -- quiet; raises no suspicion.",
  ESCAPE: `Attempts to leave the cell -- succeeds only if the bar is cut or lock_integrity is at 0, AND guard_attention is below ${ESCAPE_GUARD_MAX}; otherwise raises warden_suspicion by ${FAILED_ESCAPE_SUSPICION_BUMP} and is visible either way.`,
  WAIT: "Lets time pass, doing nothing else.",
  REPLACE_BAR: "Replaces the bar, setting bar_integrity to 100 -- done while the prisoner is in the yard; the prisoner does not see it. Refused if the bar has already been cut.",
  SERVICE_LOCK: "Services the lock, setting lock_integrity to 100 -- done outside the cell, unseen by the prisoner.",
  CHECK_LOCK: "Checks the lock's true integrity from outside the cell -- covert, unseen by the prisoner; no suspicion change; needs no grounds.",
  SEARCH: `Searches the cell for evidence -- only possible once warden_suspicion is at or above ${SEARCH_SUSPICION_THRESHOLD}. Catches the prisoner (the game ends) if bar_integrity is at or below ${SEARCH_CATCH_BAR_MAX}, or lock_integrity is at or below ${SEARCH_CATCH_LOCK_MAX}, or spoon_edge is at or above ${SEARCH_CATCH_SPOON_MIN} while the spoon is not concealed; otherwise resets warden_suspicion to 0 as a false alarm.`,
  ROTATE_GUARD: `Rotates the guard, setting guard_attention to ${ROTATE_GUARD_LEVEL}.`,
  OBSERVE: "Watches the prisoner closely; reveals the spoon's true edge if it is not hidden, and the bar's integrity as a rough band (intact/worn/badly worn). No suspicion change.",
};

/**
 * Coordinator's fix, item 3 ("rules known to both, including drift"):
 * `TIME_DECAY` (above) is never offered to either mind, so it has no entry
 * in `MOVE_DESCRIPTIONS` -- but its EFFECT is a rule both principals must
 * know regardless (a belief about `guard_attention` from three rounds ago
 * is only interpretable if the mind knows it decays). Rendered directly
 * into both prompts (`buildPrisonerPrompt`/`buildWardenPrompt`), outside the
 * per-move list, interpolated from the SAME constant `TIME_DECAY` itself
 * reads, so a retune can never desync the rule from the text.
 */
export const TIME_DECAY_RULE = `At the end of every round, after both of you have acted, guard_attention falls by ${TIME_DECAY_AMOUNT}, regardless of what either of you does.`;

/**
 * A positive sentence for what each mechanic looks like FROM THE OUTSIDE,
 * authored per mechanic -- never the content of what was learned (that
 * stays private, in the acting principal's own ledger prose), only that
 * something visible happened. `null` marks a covert move: it contributes
 * NOTHING to the other principal's perception. SHIM, CONCEAL, INSPECT, WAIT,
 * SERVICE_LOCK, CHECK_LOCK and REPLACE_BAR are covert (design: "done outside
 * the cell" for SERVICE_LOCK/CHECK_LOCK; REPLACE_BAR -- coordinator's fix,
 * finding (a) -- "done while the prisoner is in the yard").
 */
export const SEEN_BY_OTHER_AS: Record<string, string | null> = {
  FILE: "The warden hears a rhythmic scraping sound from the prisoner's side of the cell.",
  SHIM: null,
  HONE: "The warden sees the prisoner rubbing something against a hard surface.",
  CONCEAL: null,
  INSPECT: null,
  ESCAPE: "The prisoner makes a break for it.",
  WAIT: null,
  REPLACE_BAR: null,
  SERVICE_LOCK: null,
  CHECK_LOCK: null,
  SEARCH: "The prisoner watches the warden tear the cell apart, searching.",
  ROTATE_GUARD: "The prisoner notices a different guard on watch.",
  OBSERVE: "The prisoner notices the warden watching closely.",
};

/**
 * Warden presence (coordinator's fix, item 2): "watching and checking can't
 * happen at once." OBSERVE being free and always-on made every prisoner
 * briefing say "the warden is watching closely," every turn, with no cost to
 * the warden and no way for the prisoner to ever act unwatched -- a
 * standoff neither side could break. Every warden move now declares WHERE
 * it physically happens: `"cell"` (present, watching -- OBSERVE, SEARCH,
 * ROTATE_GUARD, WAIT) or away (`"corridor"` for CHECK_LOCK/SERVICE_LOCK,
 * `"yard"` for REPLACE_BAR). `awayLine` is the POSITIVE perception a
 * prisoner gets while the warden's most recent move was an away one --
 * never "the warden isn't watching" (root CLAUDE.md hard rule 3) --
 * present only for away entries, since a cell move needs no line at all
 * (the prisoner already sees the warden right there).
 *
 * `loop.ts` derives PRESENCE from this table plus the warden's own most
 * recent `round_log` row (`ledger.ts`'s `mostRecentWardenMechanic`) --
 * never from prose, never guessed. `briefing.ts` renders `awayLine` into
 * the prisoner's OWN next briefing when it applies; `loop.ts` passes
 * `wardenPresent` to the resolver as an opaque `Proposal.parameters` entry
 * so FILE/HONE/ESCAPE's own adjudication can gate their suspicion bump on
 * it (`world/mechanics.ts`'s own mechanics, below).
 */
export type WardenLocation = "cell" | "corridor" | "yard";

export interface WardenPresenceEntry {
  location: WardenLocation;
  /** Only ever set for a non-"cell" location. */
  awayLine?: string;
}

export const WARDEN_PRESENCE: Record<string, WardenPresenceEntry> = {
  OBSERVE: { location: "cell" },
  SEARCH: { location: "cell" },
  ROTATE_GUARD: { location: "cell" },
  WAIT: { location: "cell" },
  CHECK_LOCK: { location: "corridor", awayLine: "The warden's footsteps fade down the corridor." },
  SERVICE_LOCK: { location: "corridor", awayLine: "The warden's footsteps fade down the corridor." },
  REPLACE_BAR: { location: "yard", awayLine: "The warden's footsteps fade toward the yard." },
};

/** `true` when `move`'s own entry (if any) is somewhere other than the
 *  cell. A move this table has no opinion about (a prisoner move, or an
 *  unrecognised name) is never away -- absence of an entry is never read as
 *  "away" by default, only an explicit non-"cell" location is. */
export function isWardenAway(move: string): boolean {
  const entry = WARDEN_PRESENCE[move];
  return entry !== undefined && entry.location !== "cell";
}

/** The positive line for the prisoner's briefing while the warden is away
 *  on `move` -- `undefined` for a cell move or an unrecognised name (never
 *  a guessed line). */
export function wardenAwayLine(move: string): string | undefined {
  return WARDEN_PRESENCE[move]?.awayLine;
}

/**
 * Rules known to both (coordinator's fix, item 2): built FROM
 * `WARDEN_PRESENCE` itself, interpolating its own move names and locations,
 * so a retune of the table can never desync the rule text (the same
 * discipline `TIME_DECAY_RULE` already has against its own constant).
 * Rendered into both prompts (`buildPrisonerPrompt`/`buildWardenPrompt`):
 * the prisoner knows the warden's corridor and yard work leaves the cell
 * unwatched; the warden knows leaving the cell means not hearing what
 * happens in it.
 */
const cellMoves = Object.entries(WARDEN_PRESENCE)
  .filter(([, e]) => e.location === "cell")
  .map(([move]) => move);
const corridorMoves = Object.entries(WARDEN_PRESENCE)
  .filter(([, e]) => e.location === "corridor")
  .map(([move]) => move);
const yardMoves = Object.entries(WARDEN_PRESENCE)
  .filter(([, e]) => e.location === "yard")
  .map(([move]) => move);

export const WARDEN_PRESENCE_RULE =
  `Also, a rule that never changes: the warden is IN THE CELL, present and watching, during ${cellMoves.join(", ")}. ` +
  `The warden is AWAY from the cell during ${corridorMoves.join(" and ")} (the corridor) and ${yardMoves.join(", ")} (the yard). ` +
  "While the warden is away, the warden hears nothing the prisoner does and sees none of it, and the prisoner is not watched.";

/**
 * The referee's own hand on irreversibility (design Appendix A.2, §6.3
 * point 3): a mechanic cannot declare irreversibility itself; done here,
 * after the outcome, outside the transaction. Only ever declares
 * irreversibility for `(barId, "cut")` reaching exactly `"1"`.
 */
export function declareCutIfJustCut(world: World, outcome: Outcome): void {
  const justCut = outcome.transitions.some(
    (t) => t.entityId === world.barId && t.key === CUT_KEY && t.newValue === 1
  );
  if (justCut) {
    declareIrreversible({ entityId: world.barId, key: CUT_KEY });
  }
}

/** Whether the game has ended, and how -- read directly off the cell's own
 *  flags (never inferred, never guessed): `escaped`/`caught` are written by
 *  ESCAPE/SEARCH through `resolve()` exactly like `cut`/`concealed`. Runs
 *  OUTSIDE a resolution (the checkpoint loop calls this between
 *  half-rounds), so it reads the live timeline directly, the same way
 *  `facts.ts`'s `readNumericFact` already does for every other
 *  post-resolution read in this repository -- never through
 *  `AdjudicationInput`, which only exists inside one.
 */
export type GameEnd = { kind: "escaped" | "caught" } | null;

export function checkGameEnd(world: World, atT: number): GameEnd {
  const escaped = readNumericFact({ gameId: world.gameId, t: atT, entityId: world.cellId, key: ESCAPED_KEY });
  if (escaped === 1) return { kind: "escaped" };
  const caught = readNumericFact({ gameId: world.gameId, t: atT, entityId: world.cellId, key: CAUGHT_KEY });
  if (caught === 1) return { kind: "caught" };
  return null;
}

export function buildResolver(world: World): Resolver {
  return createResolver({ mechanics: buildMechanics(world) });
}
