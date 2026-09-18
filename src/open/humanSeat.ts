import { renderSeatSituation, type OpenMind, type OpenPrincipalContext, type OpenProposal } from "./mind.js";
import { renderProseSituation } from "./proseView.js";
import type { Narrator } from "./narrator.js";
import type { Condition } from "./conditionList.js";

/**
 * A PERSON in one of the two chairs (the-prisoner#11, its terminal half).
 *
 * The seat is a mind and nothing more: `consider(context)` shows the player what that
 * principal is told, asks what they try, and hands back their own words as `intent`.
 * Every other piece of the game is untouched -- the referee rules a typed intent exactly
 * as it rules a model's, the opponent is the same model mind through the same seam, the
 * transcript is the same transcript. That is what the seam buys: a human is not a special
 * case of the loop, only a different implementation of `OpenMind`.
 *
 * Two rules this file exists to keep:
 *
 * 1. **The player reads what the model in that chair would read**, via
 *    `renderSeatSituation` -- never a friendlier summary of it. A person plays under the
 *    same fog, sees the same beliefs with the same "as of" stamps, and is told no truth
 *    the model is not told. Otherwise a human game says nothing about the game the models
 *    play, which is the only reason to seat a human at all.
 * 2. **Nothing is invented on the player's behalf.** A blank answer is a real answer
 *    (do nothing, say nothing, no new plan), never a guess; `replanned` is left unsaid,
 *    because OPEN-VARIANT.md §22 counts it as GIVEN and a person typing a plan has not
 *    said whether it is a different one.
 *
 * I/O is injected (`ask`/`write`) rather than read from `process.stdin` here, so the seat
 * is testable without a terminal; `checkpoint.ts` supplies the real readline.
 */
export type SeatMode = "off" | "prisoner" | "warden";

/** the-prisoner#21: a human-fiction view of a turn, for the player only,
 *  that changes nothing about what the player knows. `raw` (unset, the
 *  default) is exactly today's view -- byte-identical to the model's own
 *  prompt opening (`renderSeatSituation`, mind.ts). `prose` is deterministic
 *  prose composed by code from the SAME `OpenPrincipalContext` and the SAME
 *  conditions (`proseView.ts`) -- no model call, nothing invented, nothing
 *  the raw view does not also say. `narrated` (D3, route 2, `narrator.ts`)
 *  asks a model for prose over the SAME data and shows it only once
 *  `verifyNarration` finds nothing wrong with it -- a narration that fails
 *  that check is discarded and this falls back to `prose`, silently to the
 *  player (the failure is still counted, by `checkpoint.ts`, where a
 *  transcript will show it). */
export type ViewMode = "raw" | "prose" | "narrated";

/** `PRISONER_VIEW=raw|prose|narrated` chooses HOW the human seat is shown,
 *  never WHAT it is shown. Anything else stops the run rather than guessing. */
export function readViewMode(raw: string | undefined): ViewMode {
  if (raw === undefined || raw === "") return "raw";
  if (raw === "raw" || raw === "prose" || raw === "narrated") return raw;
  throw new Error(`PRISONER_VIEW: unrecognised value ${JSON.stringify(raw)} -- must be "raw", "prose", "narrated" or unset`);
}

/** `PRISONER_HUMAN=prisoner|warden` seats a person in that chair; unset (the default) is
 *  two models, exactly as every batch so far. Anything else stops the run rather than
 *  guessing which chair was meant. */
export function readSeatMode(raw: string | undefined): SeatMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "prisoner" || raw === "warden") return raw;
  throw new Error(`PRISONER_HUMAN: unrecognised value ${JSON.stringify(raw)} -- must be "prisoner", "warden" or unset`);
}

/** A seat needs somewhere to type. Learned from the first real run: with stdin redirected
 *  from a file or a pipe, `readline` closes before the first question is asked, every turn
 *  becomes "do nothing", and the run finishes looking like a game the player lost rather
 *  than a misconfiguration. So refuse up front instead, with the reason. */
export function assertSeatIsPlayable(seat: SeatMode, stdin: { isTty: boolean }): void {
  if (seat === "off" || stdin.isTty) return;
  throw new Error(
    `PRISONER_HUMAN=${seat} needs a terminal: standard input is a pipe or a redirect, so there is nowhere to type and every turn would silently pass. ` +
      "Run it in a terminal (and not detached with nohup -- a human seat is the one run you have to watch)."
  );
}

export interface CreateHumanSeatOptions {
  selfName: string;
  otherName: string;
  /** Asks the player one question and returns the line they typed. `undefined` is end of
   *  input (ctrl-D), which ends the turn rather than hanging or inventing an intent. */
  ask: (prompt: string) => Promise<string | undefined>;
  write: (text: string) => void;
  /** The condition list, when the game gives this principal one (OPEN-VARIANT.md §34) --
   *  the same list the model in this chair would be shown, never a different one. */
  conditions?: readonly Condition[];
  /** the-prisoner#21. Unset (or `"raw"`): today's view. `"prose"`: the
   *  fiction view, `proseView.ts`'s `renderProseSituation` over the same
   *  data. `"narrated"`: `narrator.ts`'s model narrator over the same data,
   *  verified before being shown (see `narrator` below); a rejected or
   *  absent narration falls back to `"prose"`. Either way, typing `"raw"` at
   *  the intent prompt shows the raw NPC view on demand -- see `consider`
   *  below. */
  view?: ViewMode;
  /** REQUIRED when `view` is `"narrated"` -- the constructed narrator role
   *  (`narrator.ts`'s `createNarrator`), so this file never builds a model
   *  call itself. Checked at construction time (fail fast, same as every
   *  other misconfiguration in this file), never guessed past. */
  narrator?: Narrator;
}

function typed(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

export function createHumanSeatMind(options: CreateHumanSeatOptions): OpenMind {
  const { selfName, otherName, ask, write } = options;
  const view = options.view ?? "raw";
  // Fail fast, same as every other misconfiguration in this file: a narrator
  // is REQUIRED for "narrated", checked once at construction rather than on
  // every turn, and held in a variable `tsc` can narrow to non-optional so
  // `consider` below never needs a non-null assertion to call it.
  if (view === "narrated" && !options.narrator) {
    throw new Error('PRISONER_VIEW=narrated needs a narrator: createHumanSeatMind was not given one (options.narrator). Configure PRISONER_NARRATOR_MODEL and wire narrator.ts\'s createNarrator, or use "raw"/"prose" instead.');
  }
  const narrator = options.narrator;
  return {
    async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
      write("");
      const situation =
        view === "narrated" && narrator
          ? ((await narrator.narrate(selfName, otherName, context, options.conditions)) ?? renderProseSituation(selfName, otherName, context, options.conditions))
          : view === "prose"
            ? renderProseSituation(selfName, otherName, context, options.conditions)
            : renderSeatSituation(selfName, otherName, context, options.conditions);
      write(situation);
      write("");
      // The one line of the model's prompt that is about the game rather than about
      // answering in JSON, and the only thing a player needs told: there is no move list.
      write(
        "You may attempt ANYTHING you can plausibly do with what you perceive -- there is no fixed list of moves. " +
          "A referee decides what actually happens; you only decide what you TRY."
      );
      write("");

      // the-prisoner#21's raw-view escape hatch: whatever this seat is shown
      // by, typing "raw" reprints the model's own NPC view -- the simplest
      // honest way to check the fiction view is not hiding or reshaping
      // anything -- and asks again, spending no turn.
      let intent: string | undefined;
      for (;;) {
        const answer = typed(await ask('What do you try this turn? (Enter to do nothing; type "raw" to see the raw NPC view)\n> '));
        if (answer !== undefined && answer.toLowerCase() === "raw") {
          write("");
          write(renderSeatSituation(selfName, otherName, context, options.conditions));
          write("");
          continue;
        }
        intent = answer;
        break;
      }
      if (intent === undefined) {
        write("You do nothing this turn.");
        return null;
      }

      const line = typed(await ask(`What do you say aloud to ${otherName}? (Enter to stay silent)\n> `));
      const plan = typed(await ask("Your plan for the next few turns, shown back to you next turn (Enter to keep what you had)\n> "));
      write("(Your turn goes to the referee -- it takes a moment.)");

      return {
        intent,
        ...(line !== undefined ? { line } : {}),
        ...(plan !== undefined ? { plan } : {}),
      };
    },
  };
}
