import { renderSeatSituation, ONE_ACT_RULE, type OpenMind, type OpenPrincipalContext, type OpenProposal } from "./mind.js";
import { proseBlocks, type ProseBlock, type ProseBlockKind } from "./proseView.js";
import { createDeltaView } from "./deltaView.js";
import { findObject } from "./scenarioObjects.js";
import type { Narrator } from "./narrator.js";
import { renderConditionList, type Condition } from "./conditionList.js";
import type { ObjectPerception, RefereeRuling } from "./referee.js";
import type { EffectKind } from "./effects.js";

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
export type ViewMode = "raw" | "prose" | "narrated" | "play";

/**
 * `play` (2026-09-25): the same blocks `prose` composes, laid out for a
 * PERSON rather than for completeness.
 *
 * The owner played a real game under `prose` and the first turn was ~70
 * lines in which the only thing that had HAPPENED -- the warden examining
 * the bar and speaking -- sat fourth of eight blocks, beneath the full
 * condition list (the warden's own four win conditions among them, stated
 * as thresholds), the whole object catalogue and the mechanics paragraph.
 * `prose` was behaving exactly as the-prisoner#21 specifies; the ORDER is
 * what failed, and Infocom's is the other way round: what just happened,
 * then the room, and the standing rules only when asked for.
 *
 * WHY THIS IS A FOURTH VIEW AND NOT A FIX TO `prose`. #21's hard
 * constraint -- a view, never a different information set -- exists so a
 * human transcript stays comparable to a model one. CLAUDE.md already
 * forbids pooling a human transcript with a model batch ("a batch means
 * identical conditions"), so that comparability does not exist for a human
 * game in the first place; but `prose` is also what `narrated` falls back
 * to, and its completeness test is a real guard. So `prose` is left exactly
 * as it was and this view sits beside it.
 *
 * WHAT IT DOES NOT DO: remove anything from the player's reach. Every block
 * is either on screen or one no-turn command away -- `PLAY_BLOCK_POLICY`
 * below says which, for every block kind there is, and its test fails if a
 * future block kind is added without a decision being made about it.
 */

/** `PRISONER_VIEW=raw|prose|narrated` chooses HOW the human seat is shown,
 *  never WHAT it is shown. Anything else stops the run rather than guessing. */
export function readViewMode(raw: string | undefined): ViewMode {
  if (raw === undefined || raw === "") return "raw";
  if (raw === "raw" || raw === "prose" || raw === "narrated" || raw === "play") return raw;
  throw new Error(`PRISONER_VIEW: unrecognised value ${JSON.stringify(raw)} -- must be "raw", "prose", "narrated", "play" or unset`);
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

/** D3 (HUMAN-INTENTS-DESIGN.md §3.1, §11.5, the-prisoner#27): the bare
 *  gerund `reconsider` names the attempted effect with -- no object, because
 *  the whole point of the offer is that no object was read ("but not what"
 *  says that for it). A `Record` over every `EffectKind` but `none` (never
 *  reached: `targetUnreadWithEffectCited`, referee.ts, only fires when the
 *  effect's own citation verified, and a `none` effect never carries one),
 *  so a new effect kind fails to typecheck here until it has a phrase --
 *  the same exhaustiveness discipline `perception.ts`'s own D1 table keeps. */
const RECONSIDER_GERUND: Record<Exclude<EffectKind, "none">, string> = {
  wear: "wearing something down",
  restore: "restoring something",
  reveal: "looking closely at something",
  conceal: "hiding something",
  expose: "uncovering something",
  noise: "making a noise",
  open: "opening something",
  close: "shutting something",
  leave: "leaving",
  derive: "making something",
  take: "taking something",
  give: "handing something over",
};

/** §1.4's `help`: the command set itself, in the same voice as the prompt's
 *  own hint below -- computed once, since it depends on nothing per-turn. */
export const SEAT_COMMANDS = ["raw", "say", "plan", "holding", "desc", "conditions", "rules", "me", "help"] as const;

const HELP_TEXT = [
  "Commands (each costs no turn, and none of them reach the referee):",
  '  say <words>     speak the words aloud',
  "  plan <words>    set your plan for the next few turns",
  "  raw             show the raw view -- what the model in this chair would see",
  "  holding         what you are carrying",
  "  desc <id>       the description of one thing you perceive (free -- not the same as examining it)",
  "  conditions      reprint this chair's condition list",
  "  rules           the standing rules of this cell (how suspicion moves, what counts as escape)",
  "  me              who you are, and what you want",
  "  help            this list",
  "Anything else you type is your intent for this turn.",
].join("\n");

/**
 * Which blocks the `play` view puts ON SCREEN every turn, and which are one
 * no-turn command away. Exhaustive over `ProseBlockKind` by its type, so a
 * new block kind cannot be added to `proseView.ts` without someone deciding
 * here whether a player sees it -- the honest analogue, for this view, of
 * the completeness test that guards `prose`. Nothing maps to "dropped", and
 * there is deliberately no such value: a block a player cannot reach at all
 * would be the information-set change #21 forbids.
 *
 * The three that are NOT shown are the three that never change from turn to
 * turn and are long: the condition list (six conditions, four of them the
 * warden's own win conditions in thresholds), the mechanics paragraph, and
 * who you are. A model is given all three every turn because it has no
 * memory between turns; a person has one.
 */
export const PLAY_BLOCK_POLICY: Record<ProseBlockKind, "shown" | "conditions" | "rules" | "me"> = {
  news: "shown",
  notesAndPlan: "shown",
  knowledge: "shown",
  scene: "shown",
  conditions: "conditions",
  rules: "rules",
  identity: "me",
};

/** Reading order for the blocks `PLAY_BLOCK_POLICY` shows: what happened,
 *  what you had planned, what you know, then the room. Infocom's order, and
 *  the reverse of the one that buried the news. */
const PLAY_ORDER: readonly ProseBlockKind[] = ["news", "notesAndPlan", "knowledge", "scene"];

/** The play view's blocks, in `PLAY_ORDER` -- a stable sort over the kinds
 *  that are shown, so a block kind absent this turn simply does not appear
 *  and nothing has to know which ones are optional. */
export function orderForPlay(blocks: readonly ProseBlock[]): ProseBlock[] {
  return blocks
    .filter((block) => PLAY_BLOCK_POLICY[block.kind] === "shown")
    .sort((a, b) => PLAY_ORDER.indexOf(a.kind) - PLAY_ORDER.indexOf(b.kind));
}

/**
 * D4 (docs/HUMAN-INTENTS-DESIGN.md §3.2, the-prisoner#29): what
 * `createHumanSeatMind` returns is an `OpenMind` PLUS one more thing --
 * somewhere for `checkpoint.ts` to route a write that does not come from a
 * question this seat is itself asking (its own "(X has taken a turn.)"
 * line, today a bare `console.log` outside this file entirely).
 */
export interface HumanSeatMind extends OpenMind {
  /** A write from OUTSIDE `consider` -- see this interface's own doc
   *  comment. The loop is serial (§3.2, red team point 11.4): the OTHER
   *  principal's whole half-round finishes, its news lands in the next
   *  briefing, and only THEN does this seat's own `consider` open a
   *  question, so nothing legitimate is ever written while one is open. If
   *  something arrives anyway, that is a bug in the CALLER, not a case this
   *  seat designs for: written through the same `write` (never silently
   *  dropped) and counted (`midQuestionWrites` below), rather than
   *  corrupting or blocking whatever the player is in the middle of typing. */
  notify: (text: string) => void;
  /** How many times `notify` fired while a question was open. Surfaced so
   *  `checkpoint.ts` can print it in the transcript: a nonzero count says
   *  the serial-loop assumption this design leans on (§3.2, red team 11.4)
   *  was wrong on a real run and is worth reading, not something this seat
   *  should ever paper over. */
  midQuestionWrites: () => number;
}

export function createHumanSeatMind(options: CreateHumanSeatOptions): HumanSeatMind {
  const { selfName, otherName, ask: rawAsk, write: rawWrite } = options;
  // Every `write` call below goes through this wrapper -- the ONE place
  // wrapping happens, so `raw`, `prose` and `narrated` all get it for free
  // rather than each view composing its own wrapped text (§1.1).
  const write = (text: string): void => rawWrite(wrapText(text, wrapWidth(process.stdout.columns)));
  // D4: true for exactly as long as this seat is inside its OWN `ask` call
  // -- the player has an open prompt on screen and has not yet answered it.
  // Toggled at the one place this file ever calls the injected `ask`
  // (`askWithStatus` below), so every question this seat asks in a turn --
  // the main "what do you do?" and the `say`/`plan` follow-ups alike -- is
  // covered without each call site tracking it separately.
  let questionOpen = false;
  let midQuestionWriteCount = 0;
  const ask = async (prompt: string): Promise<string | undefined> => {
    questionOpen = true;
    try {
      return await rawAsk(prompt);
    } finally {
      questionOpen = false;
    }
  };
  /** D4's own `notify`: see `HumanSeatMind`'s doc comment. Written through
   *  the SAME `write` every view already uses (so it gets the same
   *  wrapping, and the player never silently misses it), never through
   *  `rawWrite` directly. No attempt is made to redraw the terminal's own
   *  input line from here -- this file only ever holds `ask`/`write`
   *  callbacks, never the `readline.Interface` itself, by design (this
   *  file's own header: "so the seat is testable without a terminal"), and
   *  this branch is a tripwire for a case the serial loop's own design says
   *  cannot occur (§3.2, red team point 11.4), not a feature worth building
   *  real terminal cursor control for. */
  const notify = (text: string): void => {
    if (questionOpen) midQuestionWriteCount += 1;
    write(text);
  };
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
  // The play view (2026-09-25): the SAME blocks, through the SAME delta, in
  // `PLAY_ORDER` and without the three `PLAY_BLOCK_POLICY` puts behind a
  // command. Composed here rather than in `proseView.ts` because it is a
  // seat decision about a reader, not a change to what the prose says.
  const playSituation = (context: OpenPrincipalContext): string =>
    delta.render(orderForPlay(proseBlocks(selfName, otherName, context, options.conditions)));
  // One block of the prose view by kind, for the commands that print a block
  // `play` holds back -- read from the same composer the view itself uses, so
  // `rules` and `me` can never drift into being a second rendering.
  const blockText = (context: OpenPrincipalContext, kind: ProseBlockKind): string =>
    proseBlocks(selfName, otherName, context, options.conditions).find((block) => block.kind === kind)?.text ?? "";
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
    notify,
    midQuestionWrites: () => midQuestionWriteCount,
    // D3 (HUMAN-INTENTS-DESIGN.md §3.1, §11.5, the-prisoner#27): called by
    // `loop.ts` at most once per turn, only when the referee's TARGET fell
    // to its safe default while its EFFECT was cited
    // (`targetUnreadWithEffectCited`, referee.ts) -- Infocom's "Hide what?"
    // moment. Composes nothing on the player's behalf (this file's own rule
    // 2): the wording states the READING, never that the player left
    // something out (a referee that missed a typed noun looks identical to
    // one that was never given one), and the retype -- if any -- is handed
    // back exactly as typed, never quoted, reworded, or combined with the
    // first attempt.
    async reconsider(ruling: RefereeRuling): Promise<string | undefined> {
      const gerund = RECONSIDER_GERUND[ruling.effectKind as Exclude<EffectKind, "none">];
      write("");
      return typed(await ask(`That was read as ${gerund}, but not what. Say it another way, or press Enter to let it stand.\n> `));
    },
    async consider(context: OpenPrincipalContext): Promise<OpenProposal | null> {
      write("");
      const isFirstTurn = firstTurn;
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
            : view === "play"
              ? playSituation(context)
              : renderSeatSituation(selfName, otherName, context, options.conditions);
      write(situation);
      write("");
      // The one line of the model's prompt that is about the game rather than about
      // answering in JSON, and the only thing a player needs told: there is no move list.
      //
      // Under `play` it is said on the FIRST turn only. It is an instruction to a
      // MIND about how to behave, repeated every turn because a model has no memory
      // between turns; a person read it once and then read it twenty-nine more times.
      // It stays reachable for the whole game under `help`, which lists both rules.
      if (view !== "play" || isFirstTurn) {
        write(
          "You may attempt ANYTHING you can plausibly do with what you perceive -- there is no fixed list of moves. " +
            "A referee decides what actually happens; you only decide what you TRY."
        );
        write(ONE_ACT_RULE);
        write("");
      }
      if (view === "play" && isFirstTurn) {
        write(
          'This view shows what has changed. The rest is a keystroke away and costs no turn: "me", "conditions", ' +
            '"rules", "desc <id>", "holding", "raw" for the full model view, or "help".'
        );
        write("");
      }

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
      const commandIn = (answer: string): { command: (typeof SEAT_COMMANDS)[number]; rest: string } | null => {
        const lowered = answer.toLowerCase();
        for (const command of SEAT_COMMANDS) {
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
        if (command.command === "rules") {
          // The prose view's own rules paragraph, which `play` holds back --
          // `blockText` reads it from `proseBlocks`, never a second rendering.
          const rules = blockText(context, "rules");
          write(rules.length > 0 ? rules : "This cell has no standing rules beyond what you can see.");
          continue;
        }
        if (command.command === "me") {
          const identity = blockText(context, "identity");
          write(identity.length > 0 ? identity : `You are ${selfName}.`);
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
