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
import { numericFactFrom } from "./facts.js";

/**
 * The registered mechanics of design Appendix A.4, minus custody. Every
 * mechanic here reads only `input.constraint` (the read surface `resolve()`
 * hands it -- there is no database handle anywhere in `AdjudicationInput`,
 * so a mechanic cannot write outside the `changes` it returns) and returns
 * `IntendedWrite`s over the five bounded/resolve_only resources of
 * Appendix A.2, plus the two plain flag columns `schema.ts` added
 * (`cut`, `concealed`) -- all numeric, per this checkpoint's correction 3
 * (custody, and therefore SEARCH/CONFISCATE, is out; `IntendedChange` is
 * numeric-only until engine issue E3).
 *
 * WHAT IS DELIBERATELY NOT HERE, AND WHY: Appendix A.3's `knows_<key>` facts
 * ("a character that does not know has no fact" -- root CLAUDE.md hard rule
 * 3) cannot be written through this checkpoint's only write path.
 * `writeConstrainedValue` (`run-dmcp`'s `constrained.ts`, `readLiveValue`)
 * throws when the column it is about to write currently reads SQL NULL --
 * "the caller asked for a NUMBER, and an absent one is a caller error to
 * report, not a caller error to guess past." A fact that must start absent
 * and later receive its first value can therefore never be written by a
 * mechanic's `IntendedChange`: there is no first write. This is a genuine
 * engine finding (reported in this project's final report, not filed as a
 * run-dmcp issue per this task's hard stop on editing that tracker) rather
 * than something to route around with a second write path (hard rule 7).
 * `INSPECT`/`OBSERVE` below are still real, audited resolutions --
 * `resolve()` still records a `resolution.recorded` event for each -- but
 * what was learned travels as the mechanic's own `result`, which this
 * repository's attempt ledger (`src/ledger/`) already exists to keep and
 * render into a principal's `briefing`. No unaudited path was added; the
 * ledger is reused for a job the fact store cannot do here.
 */

const CUT_KEY = "cut";
const CONCEALED_KEY = "concealed";

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

/** An unbounded flag write (0/1) -- `cut`/`concealed` carry no declared
 *  `resolve_only`/`bounded` constraint (Appendix A's constraint family
 *  applies to A.2's five resources only; a plain item column has none), so
 *  no `bounds` object is passed -- there is nothing to clamp against. */
function writeFlag(entityId: string, key: string, value: 0 | 1): IntendedWrite {
  return { kind: "write", entityId, key, mode: "set", value };
}

/**
 * Every mechanic's `description` optionally carries a caller-supplied note
 * (`Proposal.parameters.note`) appended verbatim. `parameters` is opaque to
 * the engine (`resolve.ts`'s own doc comment: "handed to the named mechanic
 * verbatim, never inspected here"), so this is ordinary use of that field,
 * not a second channel around it. It exists for one reason: the round log
 * this repository renders a contradiction's cause from
 * (`src/ledger/ledger.ts`, correction 2) carries a resolution's
 * `description`, and the conformance suite's check 4 (the fog property's
 * positive control) needs a plantable, per-test marker to prove a
 * contradiction's attribution reaches one principal's briefing and not the
 * other's -- see `src/mind/__tests__/seamConformance.*.test.ts`.
 */
function withNote(base: string, input: AdjudicationInput): string {
  const note = input.parameters?.note;
  return typeof note === "string" && note.length > 0 ? `${base} (${note})` : base;
}

/** Amount FILE removes from `bar_integrity` per attempt. */
export const FILE_AMOUNT = 15;
/** Amount SHIM removes from `lock_integrity` per attempt. */
export const SHIM_AMOUNT = 20;
/** Amount HONE adds to `spoon_edge` per attempt. */
export const HONE_AMOUNT = 10;
/** Amount most prisoner moves-with-consequence raise `warden_suspicion`. */
export const SUSPICION_BUMP = 5;
/** Amount OBSERVE raises `warden_suspicion`. */
export const OBSERVE_SUSPICION_BUMP = 10;
/** Amount WAIT lowers `warden_suspicion` and `guard_attention`. */
export const WAIT_DECAY = 5;
/** The level ROTATE_GUARD sets `guard_attention` to. */
export const ROTATE_GUARD_LEVEL = 80;

export function buildMechanics(world: World): Mechanic[] {
  const { resources, barId, looseTileId } = world;

  function suspicionBump(input: AdjudicationInput, amount: number): IntendedWrite {
    const current = valueOf(input, resources.wardenSuspicion, "value");
    return setResource(resources.wardenSuspicion, "value", current + amount);
  }

  const FILE: Mechanic = {
    name: "FILE",
    adjudicate(input: AdjudicationInput): Adjudication {
      const current = valueOf(input, resources.barIntegrity, "value");
      const intended = current - FILE_AMOUNT;
      const changes = [setResource(resources.barIntegrity, "value", intended), suspicionBump(input, SUSPICION_BUMP)];
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
        changes: [setResource(resources.lockIntegrity, "value", current - SHIM_AMOUNT), suspicionBump(input, SUSPICION_BUMP)],
        result: { mechanic: "SHIM", lockIntegrityBefore: current },
        description: withNote("The prisoner works a shim into the lock.", input),
      };
    },
  };

  const HONE: Mechanic = {
    name: "HONE",
    adjudicate(input: AdjudicationInput): Adjudication {
      const current = valueOf(input, resources.spoonEdge, "value");
      return {
        changes: [setResource(resources.spoonEdge, "value", current + HONE_AMOUNT), suspicionBump(input, SUSPICION_BUMP)],
        result: { mechanic: "HONE", spoonEdgeBefore: current },
        description: withNote("The prisoner hones the spoon's edge.", input),
      };
    },
  };

  const CONCEAL: Mechanic = {
    name: "CONCEAL",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [writeFlag(looseTileId, CONCEALED_KEY, 1)],
        result: { mechanic: "CONCEAL", target: "the loose tile" },
        description: withNote("The prisoner hides something under the loose tile.", input),
      };
    },
  };

  const INSPECT: Mechanic = {
    name: "INSPECT",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [],
        result: {
          mechanic: "INSPECT",
          barIntegrity: valueOf(input, resources.barIntegrity, "value"),
          lockIntegrity: valueOf(input, resources.lockIntegrity, "value"),
          guardAttention: valueOf(input, resources.guardAttention, "value"),
        },
        description: withNote("The prisoner inspects the cell closely.", input),
      };
    },
  };

  const REPLACE_BAR: Mechanic = {
    name: "REPLACE_BAR",
    adjudicate(input: AdjudicationInput): Adjudication {
      return {
        changes: [setResource(resources.barIntegrity, "value", 100), writeFlag(barId, CUT_KEY, 0)],
        result: { mechanic: "REPLACE_BAR" },
        description: withNote("The warden replaces the bar.", input),
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
      return {
        changes: [suspicionBump(input, OBSERVE_SUSPICION_BUMP)],
        result: {
          mechanic: "OBSERVE",
          spoonEdge: valueOf(input, resources.spoonEdge, "value"),
          bar: valueOf(input, resources.barIntegrity, "value"),
        },
        description: withNote("The warden observes the prisoner.", input),
      };
    },
  };

  // Shared by both principals -- the engine dispatches by name and has no
  // notion of who proposed a mechanic (design §6.1; the same reasoning
  // run-dmcp's own resolveAdversarial.test.ts uses for its two proposers).
  const WAIT: Mechanic = {
    name: "WAIT",
    adjudicate(input: AdjudicationInput): Adjudication {
      const guard = valueOf(input, resources.guardAttention, "value");
      const suspicion = valueOf(input, resources.wardenSuspicion, "value");
      return {
        changes: [
          setResource(resources.guardAttention, "value", guard - WAIT_DECAY),
          setResource(resources.wardenSuspicion, "value", suspicion - WAIT_DECAY),
        ],
        result: { mechanic: "WAIT" },
        description: withNote("Time passes.", input),
      };
    },
  };

  return [FILE, SHIM, HONE, CONCEAL, INSPECT, REPLACE_BAR, SERVICE_LOCK, ROTATE_GUARD, OBSERVE, WAIT];
}

export const PRISONER_MOVES = ["FILE", "SHIM", "HONE", "CONCEAL", "INSPECT", "WAIT"] as const;
export const WARDEN_MOVES = ["REPLACE_BAR", "SERVICE_LOCK", "ROTATE_GUARD", "OBSERVE", "WAIT"] as const;

/**
 * One plain sentence per registered mechanic, saying what it does and what
 * it needs (item 2, over the owner's transcript finding: "bare move
 * names"). ONE source: `buildPrisonerPrompt`/`buildWardenPrompt`
 * (`src/mind/*Mind.ts`) render the prompt's move list from this table, and
 * `moveDescriptions.test.ts` asserts every entry in `PRISONER_MOVES`/
 * `WARDEN_MOVES` has one. Every sentence is checked against what the
 * mechanic above ACTUALLY does -- there is no bonus for an honed edge on
 * `FILE` today, so none is claimed here; if this ever drifts from the
 * mechanic's real behaviour, the fix is to the text, never the mechanic.
 */
export const MOVE_DESCRIPTIONS: Record<string, string> = {
  FILE: "Files at the bar, wearing down its integrity by a fixed amount each time; also raises the warden's suspicion a little.",
  SHIM: "Works a shim into the lock, wearing down its integrity by a fixed amount each time; also raises the warden's suspicion a little.",
  HONE: "Hones the spoon's edge, raising it by a fixed amount each time; also raises the warden's suspicion a little.",
  CONCEAL: "Hides something under the loose tile so it is no longer visible to the warden.",
  INSPECT:
    "Looks closely at the cell; reveals whether the warden has rotated the guard or serviced the lock since your last inspection.",
  WAIT: "Lets time pass, lowering the guard's attention and the warden's suspicion a little.",
  REPLACE_BAR: "Replaces the bar, resetting its integrity to full; refused if the bar has already been cut.",
  SERVICE_LOCK: "Services the lock, resetting its integrity to full.",
  ROTATE_GUARD: "Rotates the guard, setting the guard's attention to a fixed high level.",
  OBSERVE:
    "Watches the prisoner closely; reveals the prisoner's current spoon edge and whether anything is concealed near the loose tile; also raises your own suspicion a little.",
};

/**
 * A positive sentence for what each mechanic looks like FROM THE OUTSIDE,
 * authored per mechanic (item 5) -- never the content of what was learned
 * (that stays private, in the acting principal's own ledger prose), only
 * that something visible happened. `null` marks a covert move: it
 * contributes NOTHING to the other principal's perception (`loop.ts`'s
 * cross-perception step skips a `null` entry entirely) -- "say what is,
 * never what is absent" applies here too, so there is no "you did not see
 * anything" sentence for a covert act, there is simply no sentence.
 * CONCEAL is the one covert move in this game.
 */
export const SEEN_BY_OTHER_AS: Record<string, string | null> = {
  FILE: "The warden hears a rhythmic scraping sound from the prisoner's side of the cell.",
  SHIM: "The warden hears the prisoner fiddling with the lock.",
  HONE: "The warden sees the prisoner rubbing something against a hard surface.",
  CONCEAL: null,
  INSPECT: "The warden sees the prisoner looking closely around the cell.",
  WAIT: "A quiet moment passes.",
  REPLACE_BAR: "The prisoner watches the warden replace the bar.",
  SERVICE_LOCK: "The prisoner watches the warden service the lock.",
  ROTATE_GUARD: "The prisoner notices a different guard on watch.",
  OBSERVE: "The prisoner notices the warden watching closely.",
};

/**
 * The referee's own hand on irreversibility (design Appendix A.2, §6.3
 * point 3): "a mechanic cannot declare irreversibility... folded into E3's
 * scope for the engine to decide." Until E3, this is a library call made
 * AFTER a resolution's outcome, outside the transaction `resolve()` already
 * committed -- `declareIrreversible` needs a database handle, which a
 * mechanic's `adjudicate` is never given (run-dmcp's `resolve.ts` header).
 *
 * Called by the loop after every resolution, for every registered mechanic
 * -- not only `FILE` -- so this stays correct if a future mechanic ever
 * also drives `bar_integrity` to 0. It inspects the outcome's OWN
 * `transitions` (never re-reads live state), and only ever declares
 * irreversibility for `(barId, "cut")` reaching exactly `"1"` -- the one
 * island Appendix A names.
 */
export function declareCutIfJustCut(world: World, outcome: Outcome): void {
  const justCut = outcome.transitions.some(
    (t) => t.entityId === world.barId && t.key === CUT_KEY && t.newValue === 1
  );
  if (justCut) {
    declareIrreversible({ entityId: world.barId, key: CUT_KEY });
  }
}

export function buildResolver(world: World): Resolver {
  return createResolver({ mechanics: buildMechanics(world) });
}
