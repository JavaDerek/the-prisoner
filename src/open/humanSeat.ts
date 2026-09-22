import { renderSeatSituation, type OpenMind, type OpenPrincipalContext, type OpenProposal } from "./mind.js";
import { proseBlocks, type ProseBlockKind } from "./proseView.js";
import { createDeltaView } from "./deltaView.js";
import { findObject } from "./scenarioObjects.js";
import type { Narrator } from "./narrator.js";
import { renderConditionList, type Condition } from "./conditionList.js";
import type { ObjectPerception } from "./referee.js";

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

/**
 * §1.1: the terminal's own columns, capped at 100 -- prose past ~100
 * columns is unreadable regardless of how wide the terminal actually is,
 * and `undefined` (no terminal, e.g. under `vitest`) falls back to 80
 * rather than wrapping at `Infinity`.
 */
export function wrapWidth(columns: number | undefined): number {
  return Math.min(columns ?? 80, 100);
}

/** One line, wrapped to `width` on word boundaries. Tokenised into words
 *  AND the whitespace runs between them (not just words split on `" "`),
 *  so more than one space survives a line that fits -- the same "never
 *  collapse what was there" discipline `wrapText` applies to line breaks,
 *  applied here to spaces. A word opens a fresh line even when it alone is
 *  longer than `width`: unbroken is the rule, not "fits" (§1.1: never
 *  hyphenate or split a word). */
function wrapLine(line: string, width: number): string[] {
  if (line.length === 0) return [""]; // a blank line stays blank
  const tokens = line.match(/\S+|\s+/g) ?? [];
  const lines: string[] = [];
  let current = "";
  for (const token of tokens) {
    const isSpace = /^\s+$/.test(token);
    if (current.length === 0) {
      if (isSpace) continue; // a fresh line never opens with whitespace
      current = token;
      continue;
    }
    if (current.length + token.length <= width) {
      current += token;
      continue;
    }
    // Doesn't fit: close the line (a trailing space at the wrap point is
    // dropped -- it would only be invisible padding) and start the next one
    // with this token, unless the token itself is the whitespace that ran
    // out of room, which simply does not open a new line.
    lines.push(current.replace(/\s+$/, ""));
    current = isSpace ? "" : token;
  }
  if (current.length > 0) lines.push(current.replace(/\s+$/, ""));
  return lines;
}

/** §1.1: wraps `text` on word boundaries to `width` columns. Every line
 *  break already in `text` is preserved exactly -- this only ever ADDS a
 *  break inside an over-long line, never removes or moves one that was
 *  already there, so a blank line stays a paragraph break. Applied by the
 *  seat's own `write` below, so `raw`, `prose` and `narrated` all get it
 *  without each view reimplementing it. */
export function wrapText(text: string, width: number): string {
  return text
    .split("\n")
    .flatMap((line) => wrapLine(line, width))
    .join("\n");
}

/** §1.2's corollary and §1.4's `holding`: what THIS principal holds at t --
 *  `context.holding`, which `buildOpenContext` reads from the engine's own
 *  item owners (docs/CUSTODY-DESIGN.md), so a thing taken from her leaves
 *  this list and a thing she took or made joins it. It used to read the
 *  authored starting map (`OWNER_OF`), which custody made wrong the moment
 *  anything changed hands. Restricted to what she currently PERCEIVES
 *  (every holder perceives her own things, concealed or not), and read from
 *  a field no prompt renders, so the model-visible `PRISONER_HOLDING` arm
 *  (D1's corollary) is still a separate piece of work. No name-to-principal
 *  inverse is needed any more: the context is already this principal's own. */
function heldObjects(context: OpenPrincipalContext): readonly ObjectPerception[] {
  const holding = new Set(context.holding ?? []);
  return context.perceivedObjects.filter((object) => holding.has(object.id));
}

/**
 * §1.2: Infocom's own -- a stable status line, drawn once per turn,
 * immediately above the prompt. CRITICAL CONSTRAINT: it may carry ONLY what
 * THIS principal knows. Warden suspicion is fog the prisoner is never
 * shown, and a status bar is exactly the kind of convenience that could
 * leak it by accident, so every field here is either read back from a
 * specific sentence already sitting in THIS SAME principal's own
 * `context.briefing` (never copied wholesale -- copying the whole briefing
 * would drag the warden's own live suspicion reading along with it), or is
 * scenario-fixed content she has already been told elsewhere in this exact
 * view (the cell -- see below).
 */
function seatStatusLine(otherName: string, context: OpenPrincipalContext): string {
  const parts: string[] = [];
  const round = /^Round (\d+) of (\d+)\./.exec(context.briefing);
  if (round) parts.push(`Round ${round[1]} of ${round[2]}`);
  // The whole game is one room (root `~/rpg/CLAUDE.md`: "two principals,
  // one location"), and every view already opens by telling her so ("The
  // other person in the cell is ..." -- `identityLines`, mind.ts). Restating
  // it here costs nothing she was not already told in this same context.
  parts.push("the cell");
  const held = heldObjects(context);
  parts.push(`holding: ${held.length > 0 ? held.map((object) => object.id).join(", ") : "nothing"}`);
  // OPEN-VARIANT.md §55: presence is only ever STATED at all when it is
  // modelled, in one of exactly these two sentences (`buildOpenBriefing`).
  // Read back verbatim rather than re-derived, so this is never a second
  // source of truth about where the other principal is. Neither sentence
  // appears when presence is "off" (the default), and both principals share
  // the cell by construction in that mode, so "is here" is simply true.
  parts.push(context.briefing.includes(`${otherName} is not here right now.`) ? `${otherName} is not here` : `${otherName} is here`);
  return parts.join(" | ");
}

/** §1.4's `holding`: the SAME objects the status line's own "holding: ..."
 *  field lists (`heldObjects` above), each with its full description in the
 *  style `objectLines` (mind.ts) already uses for the perceived-objects
 *  catalogue -- never a second rendering of what an object is. */
function holdingAnswer(context: OpenPrincipalContext): string {
  const held = heldObjects(context);
  if (held.length === 0) return "You are not holding anything.";
  return ["You are holding:", ...held.map((object) => `- ${object.id}: ${object.description}`)].join("\n");
}

/**
 * §1.4's info command for an object's description -- named `desc`, NOT
 * `look`. `look` was tried first and rejected: `reveal` (one of the
 * referee's own ten effect kinds, `effects.ts`) is a real, ruled,
 * turn-costing action -- "learn a property's true value: examine, inspect,
 * check, look under or into" -- and "look" is its most natural English
 * verb. Recorded intents from real games include "Look closely at the bar
 * to assess its current state." A command keyed on that word would swallow
 * such an intent into a free re-print of the description she was already
 * shown this turn, instead of a ruling, and silently cost her the ability
 * to examine anything. `desc` cannot collide with an action verb, which is
 * the whole point of renaming it -- so it is answered whenever the token
 * itself is typed, INCLUDING with an id that matches nothing (§1.4's own
 * point: `desc` is unambiguously meta either way, unlike `look`).
 *
 * The id itself is matched by exact, case-insensitive membership against
 * `context.perceivedObjects` -- the SAME description text the referee
 * itself is handed, byte-identical, never a second look-up -- the same
 * discipline the closed variant's own `coerce` uses for a move: literal
 * membership in a list this repository wrote, never a guess at meaning. An
 * id that does not match exactly is refused, naming what IS here, rather
 * than fuzzily resolved.
 */
function descAnswer(context: OpenPrincipalContext, rawId: string): string {
  const id = rawId.trim().toLowerCase();
  const here = context.perceivedObjects.map((object) => object.id).join(", ") || "nothing";
  if (id.length === 0) return `What you can see: ${here}.`;
  const found = context.perceivedObjects.find((object) => object.id.toLowerCase() === id);
  return found ? `${found.id}: ${found.description}` : `Nothing here is called that. What you can see: ${here}.`;
}

/** §1.4's `conditions`: the exact lines `renderConditionList` produces for
 *  this reader -- the same call `seatSituationParts` (mind.ts) makes when
 *  opening the turn -- reprinted on demand rather than only once at the
 *  top. A chair the game gave no condition list to is told so plainly
 *  rather than shown an empty answer. */
function conditionsAnswer(selfName: string, conditions: readonly Condition[] | undefined): string {
  const lines = conditions ? renderConditionList(conditions, { reader: selfName }) : [];
  return lines.length > 0 ? lines.join("\n") : "This chair has no condition list.";
}

/** §1.4's `help`: the command set itself, in the same voice as the prompt's
 *  own hint below -- computed once, since it depends on nothing per-turn. */
const HELP_TEXT = [
  "Commands (each costs no turn, and none of them reach the referee):",
  '  say <words>     speak the words aloud',
  "  plan <words>    set your plan for the next few turns",
  "  raw             show the raw view -- what the model in this chair would see",
  "  holding         what you are carrying",
  "  desc <id>       the description of one thing you perceive (free -- not the same as examining it)",
  "  conditions      reprint this chair's condition list",
  "  help            this list",
  "Anything else you type is your intent for this turn.",
].join("\n");

export function createHumanSeatMind(options: CreateHumanSeatOptions): OpenMind {
  const { selfName, otherName, ask, write: rawWrite } = options;
  // Every `write` call below goes through this wrapper -- the ONE place
  // wrapping happens, so `raw`, `prose` and `narrated` all get it for free
  // rather than each view composing its own wrapped text (§1.1).
  const write = (text: string): void => rawWrite(wrapText(text, wrapWidth(process.stdout.columns)));
  const view = options.view ?? "raw";
  // Fail fast, same as every other misconfiguration in this file: a narrator
  // is REQUIRED for "narrated", checked once at construction rather than on
  // every turn, and held in a variable `tsc` can narrow to non-optional so
  // `consider` below never needs a non-null assertion to call it.
  if (view === "narrated" && !options.narrator) {
    throw new Error('PRISONER_VIEW=narrated needs a narrator: createHumanSeatMind was not given one (options.narrator). Configure PRISONER_NARRATOR_MODEL and wire narrator.ts\'s createNarrator, or use "raw"/"prose" instead.');
  }
  const narrator = options.narrator;
  // One delta per seat, for the life of the game (`deltaView.ts`, 2026-09-18):
  // the prose view shows the standing world once and then only when it moves,
  // because the first real `narrated` game re-printed all of it every round
  // and the news drowned in it. The RAW view never goes through this -- it is
  // byte-identical to the model's own prompt and stays that way, including
  // when the player asks for it on demand below.
  // A way out is an object that declares `passage`; while it differs from how
  // the player first saw it, it stays on screen (the owner's blind game, where
  // a door stood open four rounds and was shown once). `deltaView.ts` compares
  // strings it has already shown -- it never reads what they say.
  const delta = createDeltaView({ keepShownWhileChanged: (key) => findObject(key)?.properties.some((p) => p.key === "passage") ?? false });
  const proseSituation = (context: OpenPrincipalContext): string => delta.render(proseBlocks(selfName, otherName, context, options.conditions));
  // OPEN-VARIANT.md §61: CODE RENDERS STATE, THE MODEL RENDERS THE ROOM.
  //
  // Everything except the scene -- the conditions, the identity, the clock and
  // the news, notes and plan, and every belief WITH its "as of round N" stamp
  // -- goes through the same delta a prose turn uses, so a narrated turn shows
  // it exactly as precisely, and shows the standing parts once. The narration
  // replaces the SCENE block alone, which is the one part of the view a model
  // is better at than a `${label}: ${description}` catalogue.
  //
  // This is why `narrator.ts`'s rejecting class could shrink to the lying
  // kinds without the player losing a number: a narrator that says nothing
  // about the bar's integrity costs them nothing, because the line above the
  // narration already said 100, as of round 0. Asking a model to recite what
  // code prints perfectly is how §60's first attempt threw away good prose
  // over a missing "round 1 of 30".
  const stateBlocks = (context: OpenPrincipalContext): string =>
    delta.render(proseBlocks(selfName, otherName, context, options.conditions).filter((b) => b.kind !== ("scene" as ProseBlockKind)));
  const narratedSituation = async (context: OpenPrincipalContext): Promise<string> => {
    const narration = narrator ? await narrator.narrate(selfName, otherName, context, options.conditions) : null;
    if (narration === null) return proseSituation(context);
    return [stateBlocks(context), narration].filter((part) => part.length > 0).join("\n\n");
  };
  // §1.3: the raw view reprints the whole world every turn by design (the
  // guard below pins that it never holds anything back), so the FIRST real
  // human game under it read the same objects, rules and conditions again
  // and again with no way to know there was an alternative -- "the owner
  // was simply never told it was there". Told once, here, on the very first
  // turn only, and left unsaid once the player is already on a view that
  // holds the standing world back for her (`prose`/`narrated`): she does
  // not need telling about a feature she is already using.
  let firstTurn = true;
  return {
    async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
      write("");
      if (firstTurn) {
        firstTurn = false;
        if (view === "raw") {
          write(
            "(One-time tip: set PRISONER_VIEW=prose to hold the standing world back once you have read it, " +
              "so a later turn shows only what changed instead of reprinting everything.)"
          );
          write("");
        }
      }
      const situation =
        view === "narrated" && narrator
          ? await narratedSituation(context)
          : view === "prose"
            ? proseSituation(context)
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

      // §1.2/§1.3: a stable band, the LAST thing written before EVERY
      // prompt this turn -- not only the first. A no-turn command
      // (`holding`, `desc`, `raw`, a bare `say`/`plan`) answers and asks
      // again without spending the turn, and the status line used to be
      // written once before the loop began, so it scrolled away the moment
      // any of those was used: a player who leaned on `holding`/`desc`
      // repeatedly (exactly the players §1.2 exists for) lost the band for
      // every prompt after the first. Redrawn here instead of once, so the
      // pair always sits at the bottom together. Nothing in it can change
      // mid-turn -- no info command touches state -- so this is purely
      // about WHERE it is written, never a second computation of different
      // content.
      const askWithStatus = (prompt: string): Promise<string | undefined> => {
        write(seatStatusLine(otherName, context));
        return ask(prompt);
      };

      // ONE question, because that is how interactive fiction works. The
      // model's own proposal schema has three fields (`intent`, `line`,
      // `plan`), and this seat used to ask a person for all three in a fixed
      // order every single turn -- which forced the player to pre-classify
      // their own action before the referee ever saw any of it. The owner
      // played it and typed "pretend to have a heart attack" at the first
      // question; the speech field, asked afterwards, was left blank, and the
      // act reached the referee decomposed in a way nobody chose.
      //
      // So: the intent is the one thing asked. Speech and plan are
      // AFFORDANCES the player reaches for, on the exact pattern
      // the-prisoner#21's `raw` already set -- a literal command token this
      // repository defined, compared literally, never a guess at what the
      // typed words mean (the repo's "never pattern-match meaning" rule: a
      // literal check for a token WE defined is fine; understanding English is
      // not). `say` and `plan` spend no turn and ask again, so a turn costs one
      // question unless the player wants more.
      //
      // `say <words>` and `plan <words>` take the rest of the line inline;
      // bare `say`/`plan` ask for it. The words are carried verbatim either
      // way and nothing infers them.
      //
      // §1.4 (D4) adds four more literal tokens on the exact same pattern:
      // `holding`, `desc <id>`, `conditions`, `help` -- answered by the seat
      // from what it already has, costing no turn, never reaching the
      // referee. Round 3 of the owner's own game was spent on "what am I
      // holding now?", typed as an intent and refused; these exist so that
      // question never has to leave the terminal.
      //
      // NOT `look`: `reveal` (`effects.ts`) is a real, ruled, turn-costing
      // action whose most natural English verb IS "look" ("Look closely at
      // the bar to assess its current state." is a recorded real intent).
      // `say`/`plan` do not have this problem (speech-as-intent rules a
      // near-useless `noise`) and `raw` is not an action verb at all --
      // `desc` was chosen exactly because it cannot collide with anything a
      // player would type as an action.
      const COMMANDS = ["raw", "say", "plan", "holding", "desc", "conditions", "help"] as const;
      const commandIn = (answer: string): { command: (typeof COMMANDS)[number]; rest: string } | null => {
        const lowered = answer.toLowerCase();
        for (const command of COMMANDS) {
          if (lowered === command) return { command, rest: "" };
          if (lowered.startsWith(`${command} `)) return { command, rest: answer.slice(command.length + 1) };
        }
        return null;
      };

      let intent: string | undefined;
      let line: string | undefined;
      let plan: string | undefined;
      for (;;) {
        const answer = typed(await askWithStatus('What do you do? (Enter to do nothing; "say", "plan", "raw", or "help" for more commands)\n> '));
        const command = answer === undefined ? null : commandIn(answer);
        if (command === null) {
          intent = answer;
          break;
        }
        if (command.command === "raw") {
          write("");
          write(renderSeatSituation(selfName, otherName, context, options.conditions));
          write("");
          continue;
        }
        if (command.command === "holding") {
          write(holdingAnswer(context));
          continue;
        }
        if (command.command === "desc") {
          write(descAnswer(context, command.rest));
          continue;
        }
        if (command.command === "conditions") {
          write(conditionsAnswer(selfName, options.conditions));
          continue;
        }
        if (command.command === "help") {
          write(HELP_TEXT);
          continue;
        }
        if (command.command === "say") {
          line = typed(command.rest) ?? typed(await askWithStatus(`What do you say aloud to ${otherName}? (Enter to stay silent)\n> `));
          continue;
        }
        plan = typed(command.rest) ?? typed(await askWithStatus("Your plan for the next few turns, shown back to you next turn (Enter to keep what you had)\n> "));
      }
      if (intent === undefined) {
        write("You do nothing this turn.");
        return null;
      }

      write("(Your turn goes to the referee -- it takes a moment.)");

      return {
        intent,
        ...(line !== undefined ? { line } : {}),
        ...(plan !== undefined ? { plan } : {}),
      };
    },
  };
}
