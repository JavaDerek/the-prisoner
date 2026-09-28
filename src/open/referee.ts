import { createTurnReader, sourceWords, type ReaderQuestion, type ReaderSource, type ReaderTransport, type ReaderResult, type AnsweredQuestion, type AcceptedCitation } from "run-dmcp";
import { EFFECT_KINDS, MAGNITUDES, PERCEPTIBILITIES, PERSON_PROPERTY_KEYS, rulingPropertyAnswerKeys, effectRequiresProperty, type BlockMode, type HarmMode, type EffectKind, type Magnitude, type Perceptibility } from "./effects.js";
import { findObject, OPEN_PERSONS, type OpenObjectSpec, type OpenPropertyKey } from "./scenarioObjects.js";
import { DERIVABLE_KINDS, parentLabel } from "./derivedObjects.js";
import { ENGINE_CHANGE_KINDS, DIRECTIONS, HOLDER_TARGETS, translateEngineEffect, stepUpMagnitude, type EngineChangeKind, type Direction, type HolderTarget } from "./engineRules.js";
import type { OpenRulesMode } from "./openRulesMode.js";

/**
 * The referee (OPEN-VARIANT.md §3, this task's brief "The referee"). A
 * model call, separate from both minds, made once per intent -- built on
 * run-dmcp's `createTurnReader` (§3.1), which owns the closed-key/
 * verbatim-citation/safe-default/fallback-ladder machinery this module
 * never reimplements. This module is NOT a `Mind`: it has no principal, no
 * fog of its own (it is handed exactly one actor's intent by its caller,
 * `loop.ts`, and never reads the other principal's anything), and it does
 * not belong in `mind-seam` or `run-dmcp` (root `~/rpg/CLAUDE.md`: "a
 * specific game's content" stays out of the engine; a model that DECIDES,
 * as opposed to one that only proposes, is this game's own referee, not
 * generic mechanism with a caller anywhere else).
 *
 * FIVE QUESTIONS, closed keys, per this task's brief (reconciling
 * OPEN-VARIANT.md §3.2's five-question list with the brief's own naming):
 * `target`, `effect`, `property`, `magnitude`, `perceptibility`. Every
 * question's `safeDefault` names the key that means "this question
 * contributed nothing towards an effect actually happening" -- `target`
 * and `effect` default to `"none"`; `property` defaults to `"none"`;
 * `magnitude`/`perceptibility` have no "inert" key of their own (a
 * magnitude is still a magnitude), so their defaults (`"slight"`,
 * `"silent"`) are simply the least consequential member of each set --
 * they never make an inapplicable ruling applicable, because applicability
 * is decided entirely by `target`/`effect`/`property` and their citations
 * (`computeRuling`, below), never by which magnitude or perceptibility key
 * came back.
 *
 * RECONCILING §3.2's "grounding" WITH THE BRIEF'S "the property" (recorded
 * here because this task's brief asks that an ambiguity like this, and
 * what was decided, be reported): OPEN-VARIANT.md §3.2 names a THIRD
 * question, "grounding" -- the verbatim span of the target's description
 * that makes the effect possible, or `none`, which rules the intent
 * impossible. The brief's own list instead names "the property" as the
 * third question. This module treats them as the SAME question under one
 * name: the answer key is a property name (or `none`, for an effect like
 * `noise` that has no property, or for "no grounding exists"), and the
 * CITATION on that answer -- which must be a verbatim span of the TARGET
 * OBJECT'S OWN description -- is what actually carries §3.2's "grounding"
 * requirement, independent of which key was chosen. A `property` answer of
 * `"none"` with NO citation (the safe default, or an offer the ladder
 * rejected) is therefore ungrounded, exactly as §3.2 describes, for every
 * effect that has a property to ground -- with ONE exception, decided by
 * OPUS-FIRST-DESIGN.md §3.2 after `checkpoints/2026-09-20-ambition/` showed
 * it ruling every deliberate sound impossible, 3 of 3: `noise` has no
 * property at all (`effectRequiresProperty` excludes it), so its `property`
 * answer of `"none"` needs no description citation, and its target may be
 * `none`, an object, or a person. A noise is grounded by its EFFECT
 * citation alone, from the actor's intent (`computeRuling`, below). This
 * module's earlier position -- that a propertyless noise "still needs a
 * verified description citation to count as grounded" (OPEN-VARIANT.md
 * §9.2, §24.2) -- asked the target's description to say that the thing
 * makes a sound, which no person's description and no key ring's ever
 * grounded in play.
 */
/** Declared as a `type`, never an `interface` -- `mind-seam`'s own
 *  discipline (DESIGN §3.1): an object type literal carries an implicit
 *  index signature and an interface does not, so an `interface` here would
 *  fail to satisfy `InertRecord` the moment it appears inside
 *  `OpenPrincipalContext.perceivedObjects` (`mind.ts`). */
export type ObjectPerception = {
  id: string;
  description: string;
};

export interface RefereeRuling {
  targetObjectId: string;
  effectKind: EffectKind;
  property: OpenPropertyKey | "none";
  magnitude: Magnitude;
  perceptibility: Perceptibility;
  /** OPEN-VARIANT.md §13.1's sixth question: the declared derivable kind
   *  the new thing is, or `none`. Read only when the effect is `derive`. */
  product: string;
  /** OPEN-VARIANT.md §51's seventh question (the-prisoner#17), asked only
   *  under the `PRISONER_INSTRUMENT=checked` arm: THREE closed keys -- an
   *  object among what the actor perceives or holds (the act uses that
   *  tool), `"none"` (the act uses no tool at all), or `"absent"` (the
   *  intent names a tool that is none of those objects). `"none"` is also
   *  what this reads as when the question was not asked (the arm is off) or
   *  went unanswered. Gates applicability only via the `"absent"` case --
   *  see `missingInstrument`, which is the trustworthy half of it. Optional
   *  (rather than required and always `"none"`) so a `RefereeRuling`
   *  hand-built before this arm existed (`loop.test.ts`, `transcript.test.ts`
   *  -- other agents' files tonight) keeps typechecking without being
   *  touched; `computeRuling` always sets it. */
  instrument?: string;
  /** the-prisoner#5: present only under `PRISONER_OPEN_RULES=engine` --
   *  `write`'s own second closed key (`engineRules.ts`'s `Direction`),
   *  `"none"` when the question was not asked or the effect was not
   *  `write`. Kept on the ruling (rather than only inside `citations`) so a
   *  transcript can show it without reaching into `raw`. */
  direction?: Direction;
  /** the-prisoner#5: `set`'s own second closed key (`HolderTarget`),
   *  `"none"` when the question was not asked or the effect was not `set`. */
  to?: HolderTarget;
  /** the-prisoner#5, CODER-BRIEF's concrete test case: the held object named
   *  as a `write`'s material or tool, or `"none"` -- distinct from
   *  `instrument` (a different arm, #17's own question) even though both
   *  answer "what tool", because `with` is closed to what the actor
   *  currently HOLDS (`context.holding`, `loop.ts`), never every perceived
   *  object. `"none"` when the question was not asked. */
  withObjectId?: string;
  /** Set when `instrument` is the legal key `"absent"` AND its citation
   *  verified against the actor's own intent -- the referee's own closed-key
   *  judgment that the intent names a tool it does not have, cited verbatim
   *  exactly like every other answer (never a rejected, out-of-vocabulary
   *  offer: `"absent"` is a normal member of the question's `answerKeys`, so
   *  a referee that follows its instructions perfectly can still report
   *  this). `null`/absent when the arm is off, the answer is not
   *  `"absent"`, or its citation did not verify. Applicability is gated
   *  directly on `instrument === "absent"` (OPEN-VARIANT.md §51,
   *  the-prisoner#17), the same way `effectKind === "none"` already gates
   *  it unconditionally -- a badly-cited `"absent"` still blocks (fail-safe:
   *  blocking is always the safe direction here), but only a verified one is
   *  trustworthy enough to report as a specific reason, which is what this
   *  field is for. Optional for the same reason `instrument` is. */
  missingInstrument?: { citation: CitedSpan } | null;
  /** OPEN-VARIANT.md §74.1 (option B): the separate one-act reading. `flagged` only when the answer is `several`
   *  AND its citation names the actor's intent; it never touches `applicable`. Absent on a ruling built by
   *  `computeRuling` alone (tests), present on every ruling `createReferee` returns. */
  oneAct?: {
    answer: "one" | "several";
    flagged: boolean;
    request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] };
    exchanges: readonly (RefereeExchangeRecord | null)[];
    /** D7 (PLAYTEST-2026-09-27-DESIGN.md R5), `PRISONER_ONE_ACT=first` only: present exactly when the intent was cut
     *  at the cited second act and the first act's ruling became THIS ruling. `text` is the words before the cited
     *  `from`, `dropped` the words from it to the end -- both the actor's own words, rebuilt from word ranges by
     *  run-dmcp's `sourceWords` and joined with single spaces, never paraphrased. */
    attempted?: { text: string; dropped: string };
    /** D7: the ruling on the WHOLE intent, kept beside `attempted` so the transcript shows both rulings. */
    fullRuling?: RefereeRuling;
  };
  /** Whether this ruling passed every citation and "declared in the
   *  scenario" check (this module's own check; `planEffect`, `effects.ts`,
   *  does the scenario-declaration half) -- when `false`, the intent does
   *  nothing, unconditionally (OPEN-VARIANT.md §2 invariant 3). */
  applicable: boolean;
  /** Every citation this ruling actually carries, and whether each
   *  verified against its DECLARED required source -- for the transcript
   *  (this task's brief: "the referee's answers with both citations,
   *  whether each citation verified"). */
  citations: {
    target: CitationCheck;
    effect: CitationCheck;
    property: CitationCheck;
    product: CitationCheck;
    /** Optional for the same reason `instrument` (above) is. */
    instrument?: CitationCheck;
    /** the-prisoner#5: present only under `PRISONER_OPEN_RULES=engine`
     *  (`openRulesMode.ts`) -- `direction`/`to` are `write`/`set`'s own
     *  second closed keys, and `with` is the held-instrument answer
     *  CODER-BRIEF's concrete test case names (`engineRules.ts`). Absent
     *  under `fixed`, exactly like `instrument` under `PRISONER_INSTRUMENT=off`. */
    direction?: CitationCheck;
    to?: CitationCheck;
    with?: CitationCheck;
  };
  /** The raw reader result, kept for the transcript. */
  raw: ReaderResult;
  /** OPEN-VARIANT.md §38: per rung, what the model call came back with, when the transport keeps it
   *  (`lastExchange`); `null` for a rung that was not asked or keeps nothing. */
  exchanges?: readonly (RefereeExchangeRecord | null)[];
  /** The exact request (questions + sources) this ruling was asked against
   *  -- kept so the replay tool (`replay.ts`, this task's brief) can re-ask
   *  the IDENTICAL request N times for §5.2's consistency measurement,
   *  rather than rebuilding one that might drift from what was actually
   *  sent. */
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] };
}

/** A citation as this game records it: the engine's accepted quote, with the
 *  word range it was rebuilt from when the referee cited by range
 *  (OPEN-VARIANT.md §18.3). Since run-dmcp 0.10.0 (#35) the range is the
 *  engine's own `AcceptedCitation.range` -- clamped, as §30 needs -- so
 *  nothing here reconstructs it from what a rung offered any more. Flat
 *  `from`/`to` rather than the engine's nested `range`, because every
 *  transcript and sidecar written since §18 records it that way. */
export type CitedSpan = { sourceId: string; quote: string; from?: number; to?: number };

export function citedSpan(citation: AcceptedCitation | null): CitedSpan | null {
  if (!citation) return null;
  const { sourceId, quote, range } = citation;
  return range ? { sourceId, quote, from: range.from, to: range.to } : { sourceId, quote };
}

export interface CitationCheck {
  /** With the word range it was rebuilt from, when the referee cited by
   *  range (OPEN-VARIANT.md §18). */
  citation: CitedSpan | null;
  /** The sourceId this citation was REQUIRED to name (`"intent"` for
   *  target/effect; the target's own `desc:<id>` source for property) --
   *  `null` when there was no target to require one against yet (a `none`
   *  target makes the property question moot). */
  requiredSourceId: string | null;
  verified: boolean;
}

/**
 * OPEN-VARIANT.md §74.1, the owner's option B (2026-09-22): a turn does one thing. Whether an intent attempts more
 * than one act is asked as its OWN call -- this one question, the intent as its only source -- after the main
 * ruling. Asked inside the main request it moved unrelated rulings and traded catching chains against refusing
 * single acts (`checkpoints/2026-09-22-one-act/`, `-v2/`); asked alone it caught 16 of 16 chains with no loop, and
 * still counted a preparatory step as a second act about one time in four (`-s/`, `-s2/`). That is why a cited
 * `several` only FLAGS the ruling -- the actor is told a turn does one thing -- and never refuses it. Text word for
 * word as probed in `checkpoints/2026-09-22-one-act-s2/build.mts`.
 */
export const ONE_ACT_QUESTION: ReaderQuestion = {
  id: "acts",
  prompt:
    "Does the intent attempt ONE act or SEVERAL? An act is one thing done to or with one thing in the room: working on it, " +
    "examining it, hiding it, taking or handing it over, opening or closing it, going out through it, or striking or moving a " +
    "person. Answer several when the intent does one such thing and then another -- examining two objects, blinding someone " +
    "and then opening a door, opening a way out and then going through it. Answer one when it does a single such thing, " +
    "however it is described: a tool used on something is one act; hiding a thing somewhere is one act on the thing, and the " +
    "place is only where it goes; and speaking, watching someone, waiting, or moving within the room alongside the act does " +
    "not count as another -- examining something while watching someone or talking to them is one act. Getting ready for the " +
    "act is part of it, not another act: going over to the thing, sitting, kneeling or bending down, reaching for it, picking " +
    "it up, or lifting what covers it. But opening a way out is always an act of its own, never a way of getting ready. " +
    "Cite the exact words in the actor's intent that show the second act, or, for one, the words that describe the act.",
  answerKeys: ["one", "several"],
  safeDefault: "one",
};

/** Structural, so the referee needs no import of any one transport. */
export type RefereeExchangeRecord = { readonly ms: number; readonly status?: number; readonly content?: string; readonly error?: string };
/** Exported for `elaborationReferee.ts` (WORLD-ELABORATION-DESIGN.md §4.2,
 *  P1b): the second, separate referee this game asks needs the identical
 *  per-rung exchange-recording shape, never a second copy of it. */
export type ExchangeKeeping = { readonly lastExchange?: () => RefereeExchangeRecord | undefined };

/** Exported for `elaborationReferee.ts` (P1b): both referees cite the
 *  actor's intent under the identical source id, never a second name for
 *  the same thing. */
export const INTENT_SOURCE_ID = "intent";
/** Exported for `elaborationReferee.ts` (P1b): the elaboration request's
 *  `need` answer is required to cite the SAME `desc:<id>` source the base
 *  referee's own `property` question does -- reusing this naming function
 *  is what keeps the two in agreement rather than risking a second,
 *  differently-spelled convention. */
export function descriptionSourceId(objectId: string): string {
  return `desc:${objectId}`;
}

/**
 * OPEN-VARIANT.md §51, the-prisoner#17: whether the referee is asked a
 * seventh question naming the instrument an act uses. `off` is the
 * pre-existing request, unchanged byte for byte -- an arm, never a new
 * default (the D3 lesson, §40.1): a contract change that can shift a ruling
 * makes every earlier recorded batch incomparable until the owner measures
 * it and says otherwise.
 */
export type InstrumentMode = "off" | "checked";

export function readInstrumentMode(raw: string | undefined): InstrumentMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "checked") return raw;
  throw new Error(`PRISONER_INSTRUMENT: unrecognised value ${JSON.stringify(raw)} -- must be "checked" or "off" (the default)`);
}

/**
 * OPEN-VARIANT.md §51, the-prisoner#18: whether the effect question's
 * derive/wear wording carries the extra keep-the-piece sentence. `baseline`
 * is the pre-existing text, unchanged byte for byte -- the same D3 lesson:
 * a wording change that can shift a ruling ships switched off until a batch
 * justifies it.
 */
export type DeriveWordingMode = "baseline" | "sharpened";

export function readDeriveWordingMode(raw: string | undefined): DeriveWordingMode {
  if (raw === undefined || raw === "") return "baseline";
  if (raw === "baseline" || raw === "sharpened") return raw;
  throw new Error(`PRISONER_DERIVE_WORDING: unrecognised value ${JSON.stringify(raw)} -- must be "sharpened" or "baseline" (the default)`);
}

/**
 * HUMAN-INTENTS-DESIGN.md §5, D6, the-prisoner#27: whether the target
 * question carries the elision clause -- "An act of hiding, sheltering or
 * covering that names no thing hidden names the actor herself," verbatim,
 * the design's own quote, never reworded here. Conditional on a person
 * being in view, like every person clause (`PERSON_TARGET_CLAUSE`, above)
 * -- with the presence arm off no person is ever perceived, so this arm
 * cannot move the base request's fingerprint whichever way it is set.
 *
 * LANDED 2026-09-26 (`checkpoints/2026-09-26-arms/RESULTS.md`): measured
 * live against Muse, 4 of 4 bare self-hiding intents ("hide", "hide
 * myself", "cover myself up", "try to conceal myself") read
 * `target: prisoner` with the clause on, against a 3-of-4 kill number, and
 * neither trap row ("hide the spoon under the tile", "crouch by the
 * window") moved from its own OFF answer. **THE GAME's DEFAULT IS NOW
 * `on`** (`readElisionMode`'s own default, below) -- following
 * `PRISONER_ONE_ACT`'s own split (OPEN-VARIANT.md §74.1): the ENV READER's
 * default is what a real game gets, while `createReferee`'s own bare
 * constructor default stays `off` (unchanged, below), so every existing
 * unit test and replay of a recorded request stays byte-identical unless it
 * explicitly asks for the arm. `PRISONER_ELISION=off` restores the
 * pre-2026-09-26 behaviour for a batch that wants to stay comparable to one
 * recorded before this landed.
 */
export type ElisionMode = "off" | "on";

export function readElisionMode(raw: string | undefined): ElisionMode {
  if (raw === undefined || raw === "") return "on";
  if (raw === "off" || raw === "on") return raw;
  throw new Error(`PRISONER_ELISION: unrecognised value ${JSON.stringify(raw)} -- must be "on" (the default) or "off"`);
}

/**
 * HUMAN-INTENTS-DESIGN.md §6.2, D9, the-prisoner#28: whether the target and
 * effect questions carry D9's two container clauses -- the target question's
 * "an act of getting under or beneath a thing names that thing," and the
 * effect question's conceal-on-container reading, written in this module's
 * own house style rather than the design doc's prose. Probed together with
 * `ElisionMode` because §6.2 says the two clauses fire on the same intents
 * ("hide under the blanket" is both an elided hiding act and a getting-under
 * act); this is nonetheless its OWN switch, following `PRISONER_INSTRUMENT`/
 * `PRISONER_DERIVE_WORDING`'s convention of one arm per clause, so a
 * combination this task never measured (D9 alone, without D6) is not
 * something a later caller has to invent a new switch to try. `off` is the
 * pre-existing request, unchanged byte for byte. Conditional on a person
 * being in view: the container mechanism (`OPEN_CONCEAL_CONTAINER`,
 * `effects.ts`) only ever hides a PERSON, so there is nothing for this
 * clause to ground without one.
 *
 * MEASURED AND STILL OFF 2026-09-26, THEN LANDED 2026-09-26 once the mechanic
 * it was scored against was fixed (`checkpoints/2026-09-26-arms/RESULTS.md`,
 * OPEN-VARIANT.md §77): the clause pair does exactly what it was built for --
 * all 3 of 3 core "get under a container" intents read `target: <container>`
 * / `effect: conceal` / `property: concealment`, up from 0 of 3 with the
 * clause off -- but the referee's own `magnitude` answer came back `slight`
 * on every one of them, and `slight` raises a container's concealment by 20
 * (`scenarioObjects.ts`'s own wear/restore proportions), short of the 50
 * `CONTAINMENT_HIDDEN_AT_OR_ABOVE` line D9's own mechanic gated containment
 * on at the time. So the pre-registered "actor contained after resolution"
 * half of the kill number failed on every core item (0 of 3, against a
 * 2-of-3 bar) even though the targeting half the clauses actually govern
 * passed cleanly (3 of 3). The clauses were not the failure; a magnitude
 * gate on a fact ("is she under it or not") that does not actually vary by
 * magnitude was (§77.1's own owner decision). Once `OPEN_CONCEAL_CONTAINER`
 * floored a raised container's concealment at the hidden line regardless of
 * magnitude (`mechanics.ts`, `21e9479`), the SAME targeting answers were
 * re-probed under the fixed mechanic (`checkpoints/2026-09-26-arms/
 * PREDICTION-2.md`, `RESULTS-2.md`) and resolved `contained: true` on 3 of 3
 * core items, with the precision kill (N1 stays `target: spoon`; neither
 * trap row moves) confirmed clean a second time. **THE GAME's DEFAULT IS NOW
 * `on`** (`readContainerClauseMode`'s own default, below), following
 * `PRISONER_ELISION`'s own split between the env reader's default and
 * `createReferee`'s bare constructor default (unchanged, below), so every
 * existing unit test and replay of a recorded request stays byte-identical
 * unless it explicitly asks for the arm. `PRISONER_CONTAINER_CLAUSE=off`
 * restores the pre-2026-09-26 behaviour for a batch that wants to stay
 * comparable to one recorded before this landed.
 */
export type ContainerClauseMode = "off" | "on";

export function readContainerClauseMode(raw: string | undefined): ContainerClauseMode {
  if (raw === undefined || raw === "") return "on";
  if (raw === "off" || raw === "on") return raw;
  throw new Error(`PRISONER_CONTAINER_CLAUSE: unrecognised value ${JSON.stringify(raw)} -- must be "on" or "off" (the default)`);
}

/**
 * OPEN-VARIANT.md §78, docs/HUMAN-INTENTS-DESIGN.md D11 follow-up: whether
 * the effect question carries a clause distinguishing a REPEATED derive from
 * wear on the source, once at least one instance of that derived kind is
 * already in view. D11's own 95-row measurement (`checkpoints/2026-09-26-
 * human-intents/RESULTS.md`) found 5 of 11 misreads were one behaviour
 * repeated five times: "tug the thread again"/"some more"/"quietly"/"a
 * little more" all ruled `wear` on the blanket instead of a fresh `derive`
 * of another strip, once a strip already existed in the game
 * (`wool-derive` shape). This is NOT `PRISONER_DERIVE_WORDING=sharpened`
 * (§51.3-§51.6, the-prisoner#18) reworded: that arm's own "holding a
 * separate new thing" test was measured against a FIRST derive attempt
 * ("pull a wire out of the cot", nothing yet made) and is not repeated here.
 * This clause targets the opposite moment -- a piece already exists, and
 * the paraphrase working the source again names no product at all -- which
 * is exactly the shape `sharpened`'s own wording was never measured against.
 * `off` is the pre-existing request, unchanged byte for byte. Conditional
 * on a derivable kind ALREADY having an instance in view (never fires for a
 * first attempt, where the ambiguity this clause names does not exist), so
 * a game where nothing has been derived yet asks nothing new.
 *
 * SCOPE, CHECKED BY HAND AGAINST THE ACTUAL GAME STATE (not assumed from
 * §78's own prose): replaying each misread row's own prior turns
 * (`checkpoints/2026-09-26-derive-arm/PREDICTION.md`'s own diagnostic) found
 * only 3 of the 5 misread rows (`B7-P41`, `B7-P44`, `B7-P50`) actually have a
 * derived strip in view at the point the paraphrase is read; the other 2
 * (`B7-P11`, `B7-P47`) are each their game's OWN FIRST turn, with nothing yet
 * derived, so this clause's own precondition cannot fire for them -- they are
 * a first-attempt aim-elision failure (`sharpened`'s own territory, not
 * measured here) wearing the same surface wording ("tug"/"work the thread"),
 * not the repeat-derive shape this clause targets. `PREDICTION.md` reports
 * those two as an explicit scope boundary, not a third kind of kill row.
 *
 * NOT YET MEASURED. `checkpoints/2026-09-26-derive-arm/PREDICTION.md` (the 3
 * in-scope misread rows, the 2 out-of-scope rows reported as a scope check,
 * and the trap rows `B7-P02`/`B7-P15` that must stay `wear`) is the
 * pre-registered probe; this switch stays `off` until that probe runs and
 * lands it, per the D3 lesson (§40.1) and §68.2's own warning that a clause
 * can be worse than silence.
 */
export type DeriveRepeatMode = "off" | "on";

/**
 * PLAYTEST-2026-09-27 D12 (design R3, change 2): whether the target question, with a person in view, reads an act
 * done to a person WITH a thing as naming the person ("throw the blanket over Croft" lands on Croft, the blanket
 * only what it is done with). Generic -- the same sentence for any two people in any room, never a prisoner-only
 * hint. `off` (the default, and `createReferee`'s bare default) until probe P3 measures it; `on` is the arm.
 */
export type PersonInstrumentMode = "off" | "on";

export function readPersonInstrumentMode(raw: string | undefined): PersonInstrumentMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "on") return raw;
  throw new Error(`PRISONER_PERSON_INSTRUMENT: unrecognised value ${JSON.stringify(raw)} -- must be "on" or "off" (the default)`);
}

export function readDeriveRepeatMode(raw: string | undefined): DeriveRepeatMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "on") return raw;
  throw new Error(`PRISONER_DERIVE_REPEAT: unrecognised value ${JSON.stringify(raw)} -- must be "on" or "off" (the default)`);
}

/**
 * §3.5's actual requirement -- "the same intent in the same state should get
 * the same ruling" -- by construction, not by showing the referee its own
 * earlier work as a prompt example. OPEN-VARIANT.md §18.6/§18.7: a block of
 * "EARLIER RULINGS on the same object" was tried for this and made the
 * referee copy an earlier ruling onto a DIFFERENT intent on the same object
 * (the prisoner's scrape read as the warden's earlier reveal); prefixing
 * each line with the intent it was ruled on did not fix it (§18.7's
 * live re-rule: still 8 of 11 reveal). The owner's remaining option
 * (§18.7's "awaiting the owner: drop the block") is this: no block, no
 * prompt exposure -- an exact repeat is served from an in-memory cache
 * instead of asked again, so it cannot diverge, and anything that is not an
 * exact repeat is judged with no precedent text at all.
 */
function cacheKeyFor(intentText: string, perceivedObjects: readonly ObjectPerception[], heldObjectIds: readonly string[] = []): string {
  // the-prisoner#5: `heldObjectIds` joins the key so an exact repeat under
  // `engine` mode -- where `with`'s own answer set depends on what the actor
  // holds right now -- is only served from cache when that has not changed
  // either. Always present (defaulting to `[]`), so a `fixed`-mode key gains
  // one constant field and stays otherwise exactly what it always was.
  return JSON.stringify({ intentText, perceivedObjects, heldObjectIds });
}

/** The recorded kind of an object derived in this game, or `undefined` --
 *  `derivedKindOf` (`world.ts`) for a caller with a world. */
export type KindOf = (objectId: string) => string | undefined;
export const noKinds: KindOf = () => undefined;

/** The §4.1 objects AND the two principals, which are shaped exactly like
 *  objects (`OPEN_PERSONS`) and have been targetable since §55.
 *  `perception.ts` already falls back the same way, for the same reason.
 *
 *  `../../checkpoints/2026-09-22-citation-waiver/RESULTS.md` recorded the gap
 *  this closes: the defaults below knew the objects and not the persons, so a
 *  caller relying on them "cannot tell a person from a thing". Nothing in play
 *  was affected -- the game always passes its own `propertiesOf` from the
 *  world -- and that file named fixing this as the precondition for any change
 *  that turns person-ness on in the default path, §55's grounding rule first
 *  among them. */
function scenarioSpec(objectId: string): OpenObjectSpec | undefined {
  return findObject(objectId) ?? OPEN_PERSONS.find((p) => p.id === objectId);
}

/** The property keys an object declares -- the §4.1 objects and the two
 *  principals by default; a caller with a world hands in one that knows
 *  objects derived in this game. */
export type PropertiesOf = (objectId: string) => readonly string[];
export const scenarioProperties: PropertiesOf = (objectId) => scenarioSpec(objectId)?.properties.map((p) => p.key) ?? [];

export function buildQuestions(
  perceivedObjects: readonly ObjectPerception[],
  kindOf: KindOf,
  propertiesOf: PropertiesOf,
  instrumentMode: InstrumentMode,
  deriveWording: DeriveWordingMode,
  elisionMode: ElisionMode,
  containerClauseMode: ContainerClauseMode,
  repeatDeriveMode: DeriveRepeatMode,
  blockMode: BlockMode = "off",
  personInstrumentMode: PersonInstrumentMode = "off",
  harmMode: HarmMode = "off",
  // the-prisoner#5 (`openRulesMode.ts`, `engineRules.ts`): "fixed" (the
  // default) builds the exact eleven-effect question this function has
  // always built, byte for byte -- the branches below never touch that text.
  // "engine" swaps `effect`/`property` for the engine-terms versions and
  // appends `direction`/`to`/`with`, per docs/OPEN-VARIANT.md's new section.
  // the-prisoner#1's `harm`/`condition` stay unreachable under `engine`
  // mode this landing (OPEN-VARIANT.md §87): a `write` down on a person's
  // `condition` has no self-target check the way `harm`'s own plan does, so
  // rather than build that check twice this arm's vocabulary simply is not
  // offered when `openRulesMode` is `engine` (see below).
  openRulesMode: OpenRulesMode = "fixed",
  /** The closed set `with`'s answer keys offer -- the actor's own currently
   *  held objects (`context.holding`, `loop.ts`), never every perceived
   *  object: CODER-BRIEF's own wording, "the closed set of objects the actor
   *  holds". Unused outside `engine` mode. */
  heldObjectIds: readonly string[] = []
): ReaderQuestion[] {
  const engineMode = openRulesMode === "engine";
  // OPEN-VARIANT.md §24: the property keys are the same for every target, so
  // the question says which ones each object in view actually has.
  const propertyList = perceivedObjects.map((o) => `${o.id}: ${propertiesOf(o.id).join(", ") || "none"}`).join("; ");
  // Issue #22 gap 3. A person in view is an object that declares a key only a
  // person has (`PERSON_PROPERTY_KEYS`), so this module needs no scenario
  // import and no new parameter, and the clauses below appear exactly when
  // there is a body to act on. With the presence arm off none is ever
  // perceived and every question below is byte-identical to what every
  // recorded batch was asked -- the fingerprint PIN in `referee.test.ts`.
  const personsInView = perceivedObjects.filter((o) => propertiesOf(o.id).some((k) => (PERSON_PROPERTY_KEYS as readonly string[]).includes(k)));
  const personInView = personsInView.length > 0;
  const PERSON_TARGET_CLAUSE =
    " A person here is a thing that can be acted on like any other: an act on someone else's body -- pushing them down, hauling them up -- names that person, and an act on the actor's OWN body -- collapsing, dropping to the floor, crouching, going limp -- names the actor herself.";
  // HUMAN-INTENTS-DESIGN.md §5, D6, the-prisoner#27 (`readElisionMode`,
  // above): verbatim, the design's own quote. `PRISONER_ELISION=on`, off by
  // default, conditional on a person in view like every clause here.
  const ELISION_CLAUSE = " An act of hiding, sheltering or covering that names no thing hidden names the actor herself.";
  // HUMAN-INTENTS-DESIGN.md §6.2, D9, the-prisoner#28 (`readContainerClauseMode`,
  // above): the target half of D9's two clauses. `PRISONER_CONTAINER_CLAUSE=on`,
  // off by default, conditional on a person in view -- the container mechanism
  // (`OPEN_CONCEAL_CONTAINER`, `effects.ts`) only ever hides a person.
  const CONTAINER_TARGET_CLAUSE = " An act of getting under or beneath a thing names that thing.";
  const PERSON_EFFECT_CLAUSE =
    " An act that changes how a person's own body is held -- dropping to the floor, collapsing, crouching down, going limp -- is wear on that person; an act that gets a body back up off the floor is restore on that person. The body is the target, even when the act is a performance and nothing else in the room changes." +
    // docs/CUSTODY-DESIGN.md: a search is the one custody act done TO a person, so it targets her.
    " Searching a person -- patting them down, turning out what they carry -- is expose on that person." +
    // PLAYTEST-2026-09-27 D12 (design R3): a person's `sight`, worn and restored like her posture.
    " Covering someone's eyes or head so they cannot see is wear on that person; clearing one's own eyes or head is restore on the actor herself.";
  // PLAYTEST-2026-09-27 D12 (design R3 change 2), `PRISONER_PERSON_INSTRUMENT` (`readPersonInstrumentMode`), off
  // until P3 measures it: an act done to a person WITH a thing names the person.
  const PERSON_INSTRUMENT_CLAUSE = " An act done to a person with a thing -- striking, covering, blinding, restraining, tying -- names the person; the thing is only what it is done with.";
  // the-prisoner#1 (`docs/ISSUE-1-DESIGN.md` §4), `PRISONER_HARM` (`readHarmMode`): separates a stab from a
  // shove at THIS question, never at the property question -- both remain wear/posture-shaped acts on a body,
  // but only one is meant to hurt. Appended to `PERSON_EFFECT_CLAUSE` only under the arm, so `off` (the
  // default) leaves every earlier clause byte-identical.
  const PERSON_HARM_CLAUSE =
    " An act meant to hurt someone -- striking, stabbing, throwing something at them -- is harm on that person; pushing them down or hauling them up is not harm.";
  // HUMAN-INTENTS-DESIGN.md §6.2, D9, the-prisoner#28: the effect half of
  // D9's two clauses, in this question's own house style (a verb list, no
  // object id named -- `PERSON_EFFECT_CLAUSE`'s own shape). `OPEN_CONCEAL_
  // CONTAINER`/`OPEN_EXPOSE_CONTAINER` (`effects.ts`, `mechanics.ts`) are
  // what actually resolve conceal/expose on a container that can hide a
  // person; this clause is the prompt half that tells the referee such an
  // act is conceal/expose at all, which §76.1 states this task built no
  // clause for.
  const CONTAINER_EFFECT_CLAUSE =
    " Getting oneself under or beneath a thing that can conceal a person -- pulling it over the body, drawing it close so it covers her -- is conceal on that thing; coming out from under it again, or being uncovered, is expose on that thing.";
  // the-prisoner#5: the SAME two clauses above, in engine terms -- "wear"/"restore"/"conceal"/"expose" are not
  // legal `effect` answers under `PRISONER_OPEN_RULES=engine`, so a referee told "is expose on that person" would
  // be told to answer a key that does not exist. Search stays unreachable under engine rules (docs/OPEN-VARIANT.md's
  // new section, `engineRules.ts`'s own header): posture/sight still resolve through the SAME person mechanics
  // (OPEN_WEAR/OPEN_RESTORE) any other property uses, only reached here through `write`+`direction` instead.
  const PERSON_EFFECT_CLAUSE_ENGINE =
    " An act that changes how a person's own body is held -- dropping to the floor, collapsing, crouching down, going limp -- is a write lowering her posture (direction down); an act that gets a body back up off the floor is a write raising it (direction up). The body is the target, even when the act is a performance and nothing else in the room changes." +
    " Searching a person -- patting them down, turning out what they carry -- is not a change this vocabulary can express; answer none for it." +
    " Covering someone's eyes or head so they cannot see is a write lowering her sight (direction down); clearing one's own eyes or head is a write raising the actor's own sight (direction up).";
  const CONTAINER_EFFECT_CLAUSE_ENGINE =
    " Getting oneself under or beneath a thing that can conceal a person -- pulling it over the body, drawing it close so it covers her -- is a write raising that thing's concealment (direction up); coming out from under it again, or being uncovered, is a write lowering it (direction down).";
  const PERSON_PROPERTY_CLAUSE = "posture (a person's own bounded physical state -- on her feet, crouched low, or lying on the floor), sight (whether a person can see, 100 clear, 0 blind), ";
  // the-prisoner#1: a SEPARATE fragment, never folded into `PERSON_PROPERTY_CLAUSE` above -- that constant is
  // shared with `engine` mode's own property question (below), and `condition` must stay unreachable there
  // (see this function's own `openRulesMode` parameter comment: a `write` down on `condition` has no self-target
  // check). Appended only in the FIXED-mode property question, only under the harm arm.
  const PERSON_PROPERTY_CONDITION_CLAUSE = "condition (how hurt a person is, 100 unharmed, 0 disabled), ";
  const targetKeys = [...perceivedObjects.map((o) => o.id), "none"];
  // OPEN-VARIANT.md §13.1: the kinds derivable from a parent in view, named
  // in the effect question by example and offered as the product keys. A
  // parent that is a kind (§14.1) is in view when an object of that recorded
  // kind is.
  // A kind parent matches only a recorded kind, never an id that happens to
  // be spelled like one.
  const objectsInView = new Set(perceivedObjects.map((o) => o.id));
  const kindsInView = new Set(perceivedObjects.flatMap((o) => kindOf(o.id) ?? []));
  const derivable = DERIVABLE_KINDS.filter((k) => (DERIVABLE_KINDS.some((parent) => parent.id === k.parent) ? kindsInView.has(k.parent) : objectsInView.has(k.parent)));
  const deriveExamples = DERIVABLE_KINDS.map((k) => `a ${k.label} from the ${parentLabel(k)}`).join(", ");
  // OPEN-VARIANT.md §51, the-prisoner#18: the-prisoner#18's "pull a wire out
  // of the cot" was ruled `wear`, never reaching `derive` at all -- an
  // effect-question ambiguity, the same class of failure §18.5 fixed for
  // wear/reveal. Built from the SAME `deriveExamples` string the baseline
  // sentence already builds from `derivedObjects.ts`'s own table -- never a
  // fresh verb or noun list typed into this module -- so the sharpened text
  // names exactly the kinds the world declares, nothing this repository
  // invented. Off (`baseline`) is the pre-existing sentence, unchanged.
  const deriveClarification =
    deriveWording === "sharpened"
      ? `An act that ends with the actor holding a separate new thing -- ${deriveExamples} -- is ${engineMode ? "create" : "derive"}, whatever verb ` +
        "names how the piece comes free (pull, tear, cut, scrape, untwist, dig): the test is whether a piece is kept " +
        "afterward, not which verb describes taking it. "
      : "";
  // OPEN-VARIANT.md §78, docs/HUMAN-INTENTS-DESIGN.md D11 follow-up
  // (`readDeriveRepeatMode`, above): fires only once a derivable kind
  // already has an instance in view (`derivable` is already filtered to
  // kinds whose PARENT is in view; this narrows further to kinds that have
  // ALREADY yielded one). A game where nothing has been derived yet asks
  // nothing new -- the ambiguity this clause names does not exist before
  // then.
  const alreadyDerivedInView = derivable.some((k) => kindsInView.has(k.id));
  const REPEAT_DERIVE_CLAUSE =
    repeatDeriveMode === "on" && alreadyDerivedInView
      ? ` Working the target again for more of a kind of thing it has already yielded here -- tugging, pulling, cutting or scraping out another piece of the same material -- is ${engineMode ? "create" : "derive"} again, a further piece kept, not damage with nothing to show; it is ${engineMode ? "a write lowering the source's own property" : "wear"} only when the act works the piece already taken, not the source it came from.`
      : "";
  return [
    {
      id: "target",
      prompt:
        "Which object, if any, does the actor's intent act on? Answer with the object's id, or 'none' if the " +
        "intent names no object the actor can reach or perceive. " +
        // OPEN-VARIANT.md §30: §19's lesson a third time -- the effect question's own rule about ways
        // out never reached this question, and an intent that goes THROUGH something acts on nothing.
        "An intent that goes out through a way out acts on that way out: name it, never none. " +
        // OPEN-VARIANT.md §74.3, `checkpoints/2026-09-22-hide-target/`: hiding targeted the place as often as the thing.
        "An act of hiding names the thing hidden, never the place it is hidden in, under or behind. " +
        (personInView ? PERSON_TARGET_CLAUSE : "") +
        (personInView && elisionMode === "on" ? ELISION_CLAUSE : "") +
        (personInView && containerClauseMode === "on" ? CONTAINER_TARGET_CLAUSE : "") +
        (personInView && personInstrumentMode === "on" ? PERSON_INSTRUMENT_CLAUSE : "") +
        "Cite the exact words in the actor's intent that name it.",
      answerKeys: targetKeys,
      safeDefault: "none",
    },
    engineMode
      ? {
          // the-prisoner#5, docs/OPEN-VARIANT.md's new section: run-dmcp's own five
          // change kinds, named as such, plus `reveal` (no engine change at all --
          // `engineRules.ts`'s own header explains why it is not forced into one of
          // the five) and `none`. `direction`/`to`/`with` (below) carry what the old
          // eleven-name vocabulary packed into the effect key itself; `translateEngineEffect`
          // (`engineRules.ts`) maps the four answers back onto this repository's
          // existing mechanics, unchanged.
          id: "effect",
          prompt:
            "What kind of change, if any, does the intent attempt, in the engine's own terms? One of: " +
            "write (raise or lower a numeric property of the target -- say which way in the 'direction' answer below), " +
            "set (change who holds the target, or -- for a way out -- go out through it; say who ends up holding it, " +
            "or answer none for a way out, in the 'to' answer below), " +
            "transfer (move a conserved amount from one entity to another -- nothing in this game has one, so this " +
            "always resolves to no effect), " +
            `create (make a new thing from part of the target and keep it: ${deriveExamples}), ` +
            "destroy (remove the target from the world outright -- no mechanic here accepts a bare destroy, so this " +
            "always resolves to no effect), " +
            "reveal (learn a property's true value -- examining, inspecting, checking; this makes no change at all), " +
            "or none. " +
            "Judge by the intent's aim, not its method: an act whose aim is to make a way out passable -- a bolt pushed " +
            "back, a lock worked, a bar levered from its mortar -- is a write raising its passage (direction up), even " +
            "when the method is scraping or prying; going out through a way out, once it is passable, is a set, even " +
            "when it already stands open: climbing through an open window is set, not write. Shutting a way out is a " +
            "write lowering its passage (direction down). " +
            "An act whose aim is to learn -- to examine, inspect or check something -- is reveal, whatever it looks for: " +
            "examining a bar for signs of damage or wear is reveal, not write. " +
            "For a set, the target is the thing that changes hands, or the way out gone through, even when the method " +
            "works on a part of it such as its lock or a bar. " +
            "Wear-shaped damage or dulling with no way out as its goal, and no thing kept afterward, is a write lowering " +
            "the relevant property; restoring, patching, or raising concealment is a write raising it. " +
            deriveClarification +
            REPEAT_DERIVE_CLAUSE +
            (personInView ? PERSON_EFFECT_CLAUSE_ENGINE : "") +
            (personInView && containerClauseMode === "on" ? CONTAINER_EFFECT_CLAUSE_ENGINE : "") +
            "Cite the exact words in the actor's intent that describe the action.",
          answerKeys: [...ENGINE_CHANGE_KINDS],
          safeDefault: "none",
        }
      : {
          id: "effect",
          prompt:
            "What kind of effect, if any, does the intent attempt? One of: wear (lower a property), restore (raise " +
            "or reset a property), reveal (learn a property's true value), conceal (raise concealment), expose " +
            "(lower concealment), noise (a perceptible event with no state change), open (make a way out passable in " +
            "one act -- a door, a window), close (shut a way out), leave (go out through a way out), " +
            // docs/CUSTODY-DESIGN.md: one clause each, generic -- the target is the thing that changes hands.
            "take (come to hold a thing that lies here or that someone else holds; the target is the thing), " +
            "give (hand a thing the actor holds to someone else who is present; the target is the thing), " +
            // PLAYTEST-2026-09-27 D4': offered only under `PRISONER_BLOCK=on`; `off` is every earlier request, byte for byte.
            (blockMode === "on" ? "block (stand in a way out so nobody passes through it; the target is the way out), " : "") +
            // the-prisoner#1: offered only under `PRISONER_HARM=on` AND with a person in view -- `off` (the
            // default) is every request recorded before this issue, byte for byte. Unreachable under `engine`
            // mode this landing (see this function's `openRulesMode` parameter comment above).
            (harmMode === "on" && personInView ? "harm (hurt another person -- striking, stabbing, throwing something at them; the target is the person), " : "") +
            "or none. " +
            "Judge by the intent's aim, not its method: an act whose aim is to make a way out passable -- a bolt pushed " +
            "back, a lock worked, a bar levered from its mortar -- is open, even when the method is scraping or prying; " +
            "wear is for damage or dulling with no way out as its goal. " +
            // OPEN-VARIANT.md §18.5: an examination is not the damage it looks for.
            "An act whose aim is to learn -- to examine, inspect or check something -- is reveal, whatever it looks for: " +
            "examining a bar for signs of damage or wear is reveal, not wear. " +
            // OPEN-VARIANT.md §17.2, verbatim.
            "For open, close and leave, the target is the way out (the door, the window), even when the method works on a part of it such as its lock or a bar. " +
            // OPEN-VARIANT.md §30: every climb-out in a real game came back as `open`.
            "Going out through a way out is leave, even when it already stands open: climbing through an open window is leave, not open. " +
            `derive (make a new thing from part of the target and keep it: ${deriveExamples}) is for an act whose aim ` +
            "is to have the piece afterwards; wear is for damage that leaves nothing in hand. " +
            deriveClarification +
            REPEAT_DERIVE_CLAUSE +
            (personInView ? PERSON_EFFECT_CLAUSE : "") +
            (personInView && harmMode === "on" ? PERSON_HARM_CLAUSE : "") +
            (personInView && containerClauseMode === "on" ? CONTAINER_EFFECT_CLAUSE : "") +
            "Cite the exact words in the actor's intent that describe the action.",
          answerKeys: EFFECT_KINDS.filter((k) => (k !== "block" || blockMode === "on") && (k !== "harm" || (harmMode === "on" && personInView))),
          safeDefault: "none",
        },
    {
      id: "product",
      prompt:
        "If the effect is derive, which declared kind of thing does the actor make from the target? One of: " +
        (derivable.length > 0 ? derivable.map((k) => `${k.id} (a ${k.label}, from the ${parentLabel(k)})`).join(", ") + ", or none" : "none") +
        ". Answer none for every other effect. Cite the exact words in the actor's intent that name what is made.",
      answerKeys: [...derivable.map((k) => k.id), "none"],
      safeDefault: "none",
    },
    engineMode
      ? {
          id: "property",
          prompt:
            "Which property of the target object makes this effect PHYSICALLY POSSIBLE, per the target's own authored " +
            "description -- one of: integrity, edge, concealment, passage (whether a way out is open, moved by a write), " +
            (personInView ? PERSON_PROPERTY_CLAUSE : "") +
            "or none " +
            "(none if the effect needs no property, e.g. a set that names none, or if nothing in the description grounds the effect at all). " +
            "For a create, name the property of the target that the new thing is taken from (integrity for a part worked loose; none for loose material " +
            "that takes nothing from the target, or for a held thing reshaped whole into another), and cite the words naming the part that comes away. " +
            "For reveal, name the property being learned: edge for how sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the intent calls it hidden. " +
            "Or concealment for what may be hidden in, under or beneath it. " +
            `The properties each object has: ${propertyList}. Name only a property the target has; if it has none that fits, answer none. ` +
            "An answer of none still needs the words in the target's description that make the effect possible. " +
            "Cite the exact words in the TARGET " +
            "OBJECT'S OWN description (the source labelled desc: followed by that object's id) that make it possible.",
          answerKeys: [...rulingPropertyAnswerKeys(personInView)],
          safeDefault: "none",
        }
      : {
          id: "property",
          prompt:
            "Which property of the target object makes this effect PHYSICALLY POSSIBLE, per the target's own authored " +
            "description -- one of: integrity, edge, concealment, passage (whether a way out is open, for open and close), " +
            (personInView ? PERSON_PROPERTY_CLAUSE : "") +
            // the-prisoner#1: named only under the harm arm, so `off` leaves this clause byte-identical. Never
            // reached in `engine` mode's own branch above (see this function's `openRulesMode` param comment).
            (personInView && harmMode === "on" ? PERSON_PROPERTY_CONDITION_CLAUSE : "") +
            "or none " +
            "(none if the effect needs no property, e.g. noise or leave, or if nothing in the description grounds the effect at all). " +
            "For derive, name the property of the target that the new thing is taken from (integrity for a part worked loose; none for loose material " +
            "that takes nothing from the target, or for a held thing reshaped whole into another), and cite the words naming the part that comes away. " +
            // OPEN-VARIANT.md §18.5.
            // `checkpoints/2026-09-22-reveal-edge/`: integrity named alone pulled spoon-sharpening examinations to it.
            "For reveal, name the property being learned: edge for how sharp a thing is or whether it has been sharpened; integrity for damage, wear, rust or tampering, even when the intent calls it hidden. " +
            // OPEN-VARIANT.md §24.
            "Or concealment for what may be hidden in, under or beneath it. " +
            `The properties each object has: ${propertyList}. Name only a property the target has; if it has none that fits, answer none. ` +
            "An answer of none still needs the words in the target's description that make the effect possible (for noise, the words saying it makes a sound). " +
            "Cite the exact words in the TARGET " +
            "OBJECT'S OWN description (the source labelled desc: followed by that object's id) that make it possible.",
          answerKeys: [...rulingPropertyAnswerKeys(personInView, harmMode)],
          safeDefault: "none",
        },
    {
      id: "magnitude",
      prompt:
        "How large is the effect: slight, moderate, or substantial? Cite the exact words in the actor's intent " +
        "that show how much force, time or care goes into it.",
      answerKeys: [...MAGNITUDES],
      safeDefault: "slight",
    },
    {
      id: "perceptibility",
      prompt:
        "Is the effect silent, audible, or visible to someone else present? Cite the exact words in the actor's " +
        "intent that show how it would or would not be noticed.",
      answerKeys: [...PERCEPTIBILITIES],
      safeDefault: "silent",
    },
    // the-prisoner#5: `direction`/`to`/`with` exist only under `engine` mode, in the
    // SAME batch as `effect` (never conditioned on its answer -- a reader asks every
    // question at once, exactly why `magnitude`/`perceptibility` above are always
    // asked too). `translateEngineEffect`/`stepUpMagnitude` (`engineRules.ts`) are
    // the only readers of these three answers.
    ...(engineMode
      ? [
          {
            id: "direction",
            prompt:
              "For a write: does the property rise or fall? Answer up to raise it (restoring, patching, concealing, or " +
              "making a way out passable) or down to lower it (wearing, damaging, exposing, or shutting a way out). " +
              "Answer none for every other kind of change. Cite the exact words in the actor's intent that show which way.",
            answerKeys: [...DIRECTIONS],
            safeDefault: "none",
          },
          {
            id: "to",
            prompt:
              "For a set that moves a thing between hands: who ends up holding it -- actor (the intent's own actor " +
              "comes to hold it) or other (the actor hands it to the other principal present)? Answer none for a set " +
              "that goes out through a way out, or for any other kind of change. Cite the exact words in the actor's " +
              "intent that show who ends up holding it.",
            answerKeys: [...HOLDER_TARGETS],
            safeDefault: "none",
          },
          {
            id: "with",
            prompt:
              "Does the actor use another object she currently holds as material or a tool for a write -- something " +
              `worked WITH the target, not the target itself? What she holds right now: ${heldObjectIds.join(", ") || "nothing"}. ` +
              "Answer with its id if the intent applies it to the target, or none if the intent uses no such held " +
              "object. Cite the exact words in the actor's intent that name it.",
            answerKeys: [...heldObjectIds, "none"],
            safeDefault: "none",
          },
        ]
      : []),
    // OPEN-VARIANT.md §51, the-prisoner#17: asked only under the
    // `PRISONER_INSTRUMENT=checked` arm, so the request every earlier batch
    // recorded is unchanged when it is off. THREE closed keys, all legal:
    // `targetKeys` (this principal's own currently perceived/held objects,
    // plus `none`) for a real tool or no tool at all, and `absent` for the
    // one case those cannot express -- the intent names a tool that is none
    // of those objects. `absent` is answered and cited exactly like every
    // other key (never a rejected, out-of-vocabulary offer): a referee that
    // follows the closed-key instruction perfectly can still tell the truth
    // about a phantom tool, because the truth has a legal key to land on.
    ...(instrumentMode === "checked"
      ? [
          {
            id: "instrument",
            prompt:
              "Which object, if any, does the actor's intent use as a tool to carry out the effect -- something " +
              "worked WITH, not the thing worked on? Answer with its id if it is among what the actor currently " +
              "perceives or holds, 'none' if the intent uses no such tool, or 'absent' if it names a tool that is " +
              "not among those objects. Cite the exact words in the actor's intent that name it.",
            answerKeys: [...targetKeys, "absent"],
            safeDefault: "none",
          },
        ]
      : []),
  ];
}

export function buildSources(intentText: string, perceivedObjects: readonly ObjectPerception[]): ReaderSource[] {
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  for (const object of perceivedObjects) {
    sources.push({ id: descriptionSourceId(object.id), text: object.description });
  }
  return sources;
}

/** Exported for `elaborationReferee.ts` (P1b): the identical "a question
 *  this reader was built with has no answer" defensive lookup, generic in
 *  the question id, never reimplemented for the elaboration request's own
 *  single `need` question. */
export function answerFor(result: ReaderResult, questionId: string): AnsweredQuestion {
  const answer = result.answers.find((a) => a.questionId === questionId);
  if (!answer) throw new Error(`referee: no answer for question '${questionId}' -- the reader is misconfigured`);
  return answer;
}

/** Exported for `elaborationReferee.ts` (P1b): the identical verbatim-source
 *  check every one of this module's own answers is held to. */
export function citationCheck(answer: AnsweredQuestion, requiredSourceId: string | null): CitationCheck {
  const citation = citedSpan(answer.citation);
  const verified = citation !== null && requiredSourceId !== null && citation.sourceId === requiredSourceId;
  return { citation, requiredSourceId, verified };
}

const NO_INSTRUMENT_CITATION: CitationCheck = { citation: null, requiredSourceId: null, verified: false };

/** Whether `(objectId, property)` is declared in the scenario -- the check
 *  a property answer must pass. The default knows the §4.1 objects only; a
 *  caller with a world hands in `declaredProperty` (`world.ts`) so objects
 *  derived in this game (OPEN-VARIANT.md §13.3) count too. */
export type DeclaredPropertyCheck = (objectId: string, property: string) => boolean;
const declaredInScenario: DeclaredPropertyCheck = (objectId, property) => !!scenarioSpec(objectId)?.properties.some((p) => p.key === property);

/** Builds the ruling from a completed read -- pure, so it is unit-testable
 *  against a hand-built `ReaderResult` without ever constructing a reader. */
export function computeRuling(
  result: ReaderResult,
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] },
  isDeclared: DeclaredPropertyCheck = declaredInScenario,
  /** docs/CUSTODY-DESIGN.md: whether a target is a PERSON -- a search is
   *  `expose` on one. Nobody is, by default. */
  isPerson: (objectId: string) => boolean = () => false,
  /** the-prisoner#5 (`openRulesMode.ts`): "fixed" (the default) computes
   *  `effectKind` exactly as before, straight from the eleven-name
   *  vocabulary -- every check below (custody, noise, applicability) was
   *  written for that vocabulary and stays untouched. "engine" additionally
   *  reads `direction`/`to`/`with` and translates
   *  (`translateEngineEffect`, `engineRules.ts`) before any of those checks
   *  run, so they apply unchanged to the translated result -- this landing
   *  changes what `effect`/`property` are ASKED, never how a ruling turns
   *  into a resolution once it has one. */
  openRulesMode: OpenRulesMode = "fixed",
  /** Whether a target is a way out, or the part that makes one passable
   *  (`world.ts`'s own `exits` map) -- `translateEngineEffect`'s own
   *  `targetIsExit`. Nothing is, by default. */
  isExit: (objectId: string) => boolean = () => false
): RefereeRuling {
  const targetAnswer = answerFor(result, "target");
  const effectAnswer = answerFor(result, "effect");
  const productAnswer = answerFor(result, "product");
  const propertyAnswer = answerFor(result, "property");
  const magnitudeAnswer = answerFor(result, "magnitude");
  const perceptibilityAnswer = answerFor(result, "perceptibility");
  // OPEN-VARIANT.md §51, the-prisoner#17: present only under the
  // `PRISONER_INSTRUMENT=checked` arm (`buildQuestions`) -- `undefined` when
  // the question was never asked, never looked up with `answerFor`'s
  // "the reader is misconfigured" throw, which a genuinely absent
  // (off-arm) question is not.
  const instrumentAnswer = result.answers.find((a) => a.questionId === "instrument");
  // the-prisoner#5: present only under `PRISONER_OPEN_RULES=engine`
  // (`buildQuestions`) -- `undefined` under `fixed`, the identical
  // discipline `instrumentAnswer` above already follows for its own arm.
  const directionAnswer = result.answers.find((a) => a.questionId === "direction");
  const toAnswer = result.answers.find((a) => a.questionId === "to");
  const withAnswer = result.answers.find((a) => a.questionId === "with");

  const targetObjectId = targetAnswer.answerKey;
  const property = propertyAnswer.answerKey as OpenPropertyKey | "none";
  const product = productAnswer.answerKey;
  const instrument = instrumentAnswer?.answerKey ?? "none";
  // the-prisoner#5: under `fixed`, `effectAnswer` already names an `EffectKind`
  // directly, exactly as before. Under `engine`, it names one of run-dmcp's own
  // change kinds instead, and `translateEngineEffect` (`engineRules.ts`) maps it,
  // with `direction`/`to`/the target's own shape, onto the SAME `EffectKind`
  // vocabulary every check below was written against -- so nothing below this
  // line needs to know which mode produced it.
  const effectKind: EffectKind =
    openRulesMode === "engine"
      ? translateEngineEffect({
          engineEffect: effectAnswer.answerKey as EngineChangeKind,
          direction: (directionAnswer?.answerKey as Direction | undefined) ?? "none",
          to: (toAnswer?.answerKey as HolderTarget | undefined) ?? "none",
          property,
          targetIsExit: targetObjectId !== "none" && isExit(targetObjectId),
          targetIsPerson: targetObjectId !== "none" && isPerson(targetObjectId),
        })
      : (effectAnswer.answerKey as EffectKind);

  const targetCitation = citationCheck(targetAnswer, INTENT_SOURCE_ID);
  const effectCitation = citationCheck(effectAnswer, INTENT_SOURCE_ID);
  // Phase 1 batch 1 (OPUS-FIRST-DESIGN.md §2, `misruled`): a reveal changes
  // nothing, so what the description grounds -- what an act can DO to an
  // object -- is not in question; that the property exists is
  // `propertyNamedWhenRequired`'s declared-property check, below, never
  // waived. 13 of that batch's close examinations were refused only because
  // the property was quoted from the examiner's own words, so a reveal's
  // property citation may name the intent as well as the target's own
  // description. Every other effect is held to the description alone.
  const propertySourceId = targetObjectId !== "none" ? descriptionSourceId(targetObjectId) : null;
  const propertyCitation =
    effectKind === "reveal" && targetObjectId !== "none" && propertyAnswer.citation?.sourceId === INTENT_SOURCE_ID
      ? citationCheck(propertyAnswer, INTENT_SOURCE_ID)
      : citationCheck(propertyAnswer, propertySourceId);
  const productCitation = citationCheck(productAnswer, INTENT_SOURCE_ID);
  const instrumentCitation = instrumentAnswer ? citationCheck(instrumentAnswer, INTENT_SOURCE_ID) : NO_INSTRUMENT_CITATION;
  // OPEN-VARIANT.md §51, the-prisoner#17: `absent` is a normal, LEGAL member
  // of `instrument`'s own closed answerKeys (`buildQuestions`) -- the
  // referee's own judgment that the intent names a tool it does not have,
  // never a rejected offer this code reads meaning into. A verified citation
  // (from the actor's intent, like every other answer) makes it a
  // trustworthy, reportable reason; an unverified one still blocks below
  // (fail-safe), it just is not reported as one.
  const missingInstrument = instrument === "absent" && instrumentCitation.verified && instrumentCitation.citation !== null ? { citation: instrumentCitation.citation } : null;

  // docs/CUSTODY-DESIGN.md: custody moves who holds a thing, which is no
  // property of it -- `take`/`give` never name one -- and a search (`expose` on
  // a PERSON) uncovers what she carries, not a concealment she declares (a
  // person declares none). All three are grounded exactly as a noise is, by
  // their EFFECT citation from the intent, plus -- unlike a noise -- a named
  // target cited from the intent too: custody always acts on something named.
  const search = effectKind === "expose" && targetObjectId !== "none" && isPerson(targetObjectId);
  // PLAYTEST-2026-09-27 D4': a block stands in a way out, which is no property of it either -- grounded the same
  // way, by the effect and the named target, both cited from the actor's words.
  const custody = effectKind === "take" || effectKind === "give" || effectKind === "block" || search;
  const propertyNamedWhenRequired = custody || !effectRequiresProperty(effectKind) || (property !== "none" && isDeclared(targetObjectId, property));
  // OPEN-VARIANT.md §13.1: a derive names a declared product, cited from the
  // intent. Whether that product's parent is the target is `effects.ts`'s
  // check, as every "declared in the scenario" check is.
  const productNamedWhenRequired = effectKind !== "derive" || (product !== "none" && productCitation.verified);

  // OPUS-FIRST-DESIGN.md §3.2 (`checkpoints/2026-09-20-ambition/RESULTS.md`
  // bug 3): a noise needs no property, so it needs no property CITATION
  // either -- the referee answered `none` and cited the intent for it in all
  // three recorded cases, and holding that answer to the target's `desc:`
  // source (the line below, for every other effect) is exactly what ruled
  // every deliberate sound in that batch impossible. Its target may be
  // `none` too (the O game's slow circuit): a noise is a perceptible event
  // with no state change (OPEN-VARIANT.md §4.2), so no target contributes
  // anything to the effect, and a target answer that fell to its safe
  // default means the same as a cited `none`. What still grounds a noise is
  // its EFFECT citation, from the intent -- never waived -- and a target
  // that IS named is still held to its own citation like any other.
  const noise = effectKind === "noise";
  const applicable =
    (targetObjectId !== "none" || noise) &&
    effectKind !== "none" &&
    // OPEN-VARIANT.md §51, the-prisoner#17: the same unconditional pattern
    // `effectKind !== "none"` already uses -- the closed key itself is
    // trusted, regardless of its own citation quality (blocking is always
    // the safe direction; `missingInstrument`, above, is the separate,
    // citation-gated record of WHY, for reporting).
    instrument !== "absent" &&
    (targetCitation.verified || (noise && targetObjectId === "none")) &&
    effectCitation.verified &&
    (propertyCitation.verified || noise || custody) &&
    propertyNamedWhenRequired &&
    productNamedWhenRequired;

  // CODER-BRIEF (the-prisoner#5's own concrete test case, docs/issues/5.md's
  // comment: "rub the grit into the bar's mortar"): a `with` answer counts
  // only when it names a real held object AND its citation verifies against
  // the actor's own intent -- an unread or unverified one is treated exactly
  // like `"none"` (the safe direction, `missingInstrument`'s own discipline
  // above). Scoped to `write` alone: `stepUpMagnitude` (`engineRules.ts`)
  // only ever matters to a resolution that reads a magnitude table at all --
  // `open`/`close` always go to the end of their range regardless (§24),
  // so the bump would be inert there, never wrong, but this keeps the rule
  // to exactly the shape the brief describes.
  const withCitation = withAnswer ? citationCheck(withAnswer, INTENT_SOURCE_ID) : NO_INSTRUMENT_CITATION;
  const withHeld = withAnswer !== undefined && withAnswer.answerKey !== "none" && withCitation.verified;
  const baseMagnitude = magnitudeAnswer.answerKey as Magnitude;
  const magnitude = openRulesMode === "engine" && effectAnswer.answerKey === "write" && withHeld ? stepUpMagnitude(baseMagnitude) : baseMagnitude;

  return {
    targetObjectId,
    effectKind,
    property,
    magnitude,
    perceptibility: perceptibilityAnswer.answerKey as Perceptibility,
    product,
    instrument,
    direction: (directionAnswer?.answerKey as Direction | undefined) ?? "none",
    to: (toAnswer?.answerKey as HolderTarget | undefined) ?? "none",
    withObjectId: withAnswer?.answerKey ?? "none",
    missingInstrument,
    applicable,
    citations: {
      target: targetCitation,
      effect: effectCitation,
      property: propertyCitation,
      product: productCitation,
      instrument: instrumentCitation,
      // the-prisoner#5: present (non-placeholder) only under `engine` mode,
      // the same "asked or not" discipline `instrument` above follows.
      direction: directionAnswer ? citationCheck(directionAnswer, INTENT_SOURCE_ID) : NO_INSTRUMENT_CITATION,
      to: toAnswer ? citationCheck(toAnswer, INTENT_SOURCE_ID) : NO_INSTRUMENT_CITATION,
      with: withCitation,
    },
    raw: result,
    request,
  };
}

export interface Referee {
  /** `heldObjectIds` (the-prisoner#5): the actor's own currently held
   *  objects (`context.holding`, `loop.ts`), read only under
   *  `PRISONER_OPEN_RULES=engine` to build the `with` question's closed
   *  answer set. Optional, defaulting to none held, so every existing
   *  caller and every hand-built `Referee` in a test keeps typechecking
   *  unchanged. */
  rule(intentText: string, perceivedObjects: readonly ObjectPerception[], heldObjectIds?: readonly string[]): Promise<RefereeRuling>;
}

/** D3 (HUMAN-INTENTS-DESIGN.md §3.1, §11.5, the-prisoner#27): true exactly
 *  when the TARGET question fell to its safe default (`"none"`, unread)
 *  while the EFFECT question's answer is cited from the actor's own intent
 *  -- the structural signal Infocom's parser reads as "verb parsed, noun
 *  missing" ("Hide what?"). Read from the reader's own `fromSafeDefault`
 *  flag (`ruling.raw.answers`, run-dmcp's own bookkeeping -- a default was
 *  never cited against anything, `citation: null`) and `effect`'s own
 *  citation check, never from a ruling's prose or any English the referee
 *  wrote: root CLAUDE.md's "never pattern-match meaning" applies here
 *  exactly as it does to every other closed-key check in this module.
 *  `loop.ts` is the only caller, and only under a human seat -- see
 *  `OpenMind.reconsider` (`mind.ts`). */
export function targetUnreadWithEffectCited(ruling: RefereeRuling): boolean {
  const targetAnswer = ruling.raw.answers.find((a) => a.questionId === "target");
  return (targetAnswer?.fromSafeDefault ?? false) && ruling.citations.effect.verified;
}

/** Builds one referee for the lifetime of a game -- `transports` is the
 *  fallback ladder `createTurnReader` runs (this task's brief: "a plain
 *  async function in this repo that calls the configured referee model
 *  through the swapper"; see `refereeTransport.ts` for the real one, and
 *  every test in this module for a scripted one). Temperature 0 is the
 *  TRANSPORT's own concern (`refereeTransport.ts`), not this module's --
 *  this module never itself calls a model. */
/** OPEN-VARIANT.md §74.1: whether the separate one-act reading runs, and what a cited `several` does.
 *  `first` (D7, PLAYTEST-2026-09-27-DESIGN.md R5; the game's default since 2026-09-27): the intent is cut at the
 *  cited second act and its first act is attempted, and the actor is told which. `checked` is the arm for the
 *  behaviour of every batch from 2026-09-22 to 2026-09-27: a cited `several` flags the ruling and nothing else.
 *  `off` restores the one-call referee every batch before 2026-09-22 was ruled by. */
export type OneActMode = "first" | "checked" | "off";

export function readOneActMode(raw: string | undefined): OneActMode {
  if (raw === undefined || raw === "") return "first";
  if (raw === "first" || raw === "checked" || raw === "off") return raw;
  throw new Error(`PRISONER_ONE_ACT: unrecognised value ${JSON.stringify(raw)} -- must be "first" (the default), "checked" or "off"`);
}

/** The one-act reading (OPEN-VARIANT.md §74.1): its own reader, one question, the intent as its only source. */
async function readOneAct(intentText: string, transports: readonly ReaderTransport[]): Promise<{ oneAct: NonNullable<RefereeRuling["oneAct"]>; secondActFrom: number | null }> {
  const questions = [ONE_ACT_QUESTION];
  const sources: ReaderSource[] = [{ id: INTENT_SOURCE_ID, text: intentText }];
  const exchanges: (RefereeExchangeRecord | null)[] = transports.map(() => null);
  const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
    const answers = await transport(request);
    exchanges[rung] = (transport as ExchangeKeeping).lastExchange?.() ?? null;
    return answers;
  });
  const result = await createTurnReader({ questions, transports: recording }).read(sources);
  const answer = answerFor(result, "acts");
  const several = answer.answerKey === "several";
  const flagged = several && citationCheck(answer, INTENT_SOURCE_ID).verified;
  // D7: where the second act starts, when the flagged citation came by word range (a quoted one has no range, and
  // code never searches the intent for a quote's words, so it cannot be cut).
  const secondActFrom = flagged ? (citedSpan(answer.citation)?.from ?? null) : null;
  return { oneAct: { answer: several ? "several" : "one", flagged, request: { questions, sources }, exchanges }, secondActFrom };
}

/** D7 (PLAYTEST-2026-09-27-DESIGN.md R5): the words of the intent before word `from` (1-based, `sourceWords`'
 *  numbering) and the words from it to the end, each joined with single spaces -- or `null` when nothing precedes
 *  it. Word ranges only: the question asks for "the words that show the second act", and RED-TEAM.md §3's R5 row
 *  confirmed that span is the second act's on both rows this game has. */
export function splitAtSecondAct(intentText: string, from: number): { text: string; dropped: string } | null {
  const words = sourceWords(intentText).map((w) => w.word);
  if (from <= 1 || from > words.length) return null;
  return { text: words.slice(0, from - 1).join(" "), dropped: words.slice(from - 1).join(" ") };
}

export function createReferee(
  transports: readonly ReaderTransport[],
  options: {
    isDeclared?: DeclaredPropertyCheck;
    kindOf?: KindOf;
    propertiesOf?: PropertiesOf;
    /** OPEN-VARIANT.md §51, the-prisoner#17. Default `"off"`: byte-identical
     *  to every batch recorded before this arm existed. */
    instrumentMode?: InstrumentMode;
    /** OPEN-VARIANT.md §51, the-prisoner#18. Default `"baseline"`: the
     *  pre-existing effect-question wording, unchanged. */
    deriveWording?: DeriveWordingMode;
    /** HUMAN-INTENTS-DESIGN.md §5, D6, the-prisoner#27 (`readElisionMode`,
     *  above). Default `"off"`: byte-identical to every batch recorded
     *  before this arm existed. */
    elisionMode?: ElisionMode;
    /** HUMAN-INTENTS-DESIGN.md §6.2, D9, the-prisoner#28
     *  (`readContainerClauseMode`, above). Default `"off"`: byte-identical
     *  to every batch recorded before this arm existed. */
    containerClauseMode?: ContainerClauseMode;
    /** OPEN-VARIANT.md §78, docs/HUMAN-INTENTS-DESIGN.md D11 follow-up
     *  (`readDeriveRepeatMode`, above). Default `"off"`: byte-identical to
     *  every batch recorded before this arm existed. NOT YET MEASURED --
     *  see `checkpoints/2026-09-26-derive-arm/PREDICTION.md`. */
    repeatDeriveMode?: DeriveRepeatMode;
    /** OPEN-VARIANT.md §74.1 (option B), D7. The GAME's default is `"first"` (`readOneActMode`, wired in
     *  `checkpoint.ts`); this constructor's own default is `"off"`, so a referee built bare -- every unit test,
     *  every replay of a recorded request -- makes exactly one call, as before. */
    oneAct?: OneActMode;
    /** PLAYTEST-2026-09-27 D4'. The GAME's default is `"on"` (`readBlockMode`, wired in `checkpoint.ts`); this
     *  constructor's own default is `"off"`, so a bare referee's request is byte-identical to every recorded
     *  batch and the fingerprint PIN holds. */
    blockMode?: BlockMode;
    /** PLAYTEST-2026-09-27 D12 (`readPersonInstrumentMode`). Default `"off"`, like its env reader. */
    personInstrumentMode?: PersonInstrumentMode;
    /** the-prisoner#1 (`readHarmMode`, `effects.ts`). The GAME's default is `"off"` -- this constructor's own
     *  default is `"off"` too, so a bare referee's request is byte-identical to every recorded batch and the
     *  fingerprint PIN holds. */
    harmMode?: HarmMode;
    /** the-prisoner#5 (`openRulesMode.ts`). Default `"fixed"`: a referee
     *  built bare -- every unit test, every replay of a recorded request --
     *  asks the exact eleven-effect request it always has, and the
     *  fingerprint PIN holds. */
    openRulesMode?: OpenRulesMode;
    /** the-prisoner#5: whether a target is a way out, or the part that makes
     *  one passable (`world.ts`'s `exits` map) -- `translateEngineEffect`'s
     *  own `targetIsExit`, read only under `openRulesMode: "engine"`.
     *  Nothing is a way out by default. */
    isExit?: (objectId: string) => boolean;
  } = {}
): Referee {
  const isDeclared = options.isDeclared ?? declaredInScenario;
  const kindOf = options.kindOf ?? noKinds;
  const propertiesOf = options.propertiesOf ?? scenarioProperties;
  const instrumentMode = options.instrumentMode ?? "off";
  const deriveWording = options.deriveWording ?? "baseline";
  const elisionMode = options.elisionMode ?? "off";
  const containerClauseMode = options.containerClauseMode ?? "off";
  const repeatDeriveMode = options.repeatDeriveMode ?? "off";
  const openRulesMode = options.openRulesMode ?? "fixed";
  const isExit = options.isExit ?? (() => false);
  // docs/CUSTODY-DESIGN.md: a person is whatever declares a person's own key --
  // the same test `buildQuestions` uses, so no scenario import is needed here.
  const isPerson = (objectId: string): boolean => propertiesOf(objectId).some((k) => (PERSON_PROPERTY_KEYS as readonly string[]).includes(k));
  // Two caches under one key scheme: `mainCache` holds the six-question ruling alone, so D7's first act -- ruled
  // as a fresh intent -- is served from it on an exact repeat; `cache` holds what `rule()` returns. the-prisoner#5:
  // the key now also carries `heldObjectIds` -- under `engine` mode the SAME intent against the SAME perceived
  // objects can still mean something different once the actor holds a new thing (`with`'s own closed set), so an
  // exact repeat of only the first two is no longer exact.
  const mainCache = new Map<string, RefereeRuling>();
  const cache = new Map<string, RefereeRuling>();
  const ruleMain = async (intentText: string, perceivedObjects: readonly ObjectPerception[], heldObjectIds: readonly string[]): Promise<RefereeRuling> => {
    const key = cacheKeyFor(intentText, perceivedObjects, heldObjectIds);
    const cached = mainCache.get(key);
    if (cached) return cached;
    const questions = buildQuestions(
      perceivedObjects,
      kindOf,
      propertiesOf,
      instrumentMode,
      deriveWording,
      elisionMode,
      containerClauseMode,
      repeatDeriveMode,
      options.blockMode ?? "off",
      options.personInstrumentMode ?? "off",
      options.harmMode ?? "off",
      openRulesMode,
      heldObjectIds
    );
    const sources = buildSources(intentText, perceivedObjects);
    // OPEN-VARIANT.md §38: each rung's last exchange, for the sidecar. (What each rung OFFERED was
    // kept here too until run-dmcp 0.10.0 put the word range on the accepted citation itself.)
    const exchanges: (RefereeExchangeRecord | null)[] = transports.map(() => null);
    const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
      const answers = await transport(request);
      exchanges[rung] = (transport as ExchangeKeeping).lastExchange?.() ?? null;
      return answers;
    });
    const reader = createTurnReader({ questions, transports: recording });
    const result = await reader.read(sources);
    const ruling = { ...computeRuling(result, { questions, sources }, isDeclared, isPerson, openRulesMode, isExit), exchanges };
    mainCache.set(key, ruling);
    return ruling;
  };
  return {
    async rule(intentText: string, perceivedObjects: readonly ObjectPerception[], heldObjectIds: readonly string[] = []): Promise<RefereeRuling> {
      const key = cacheKeyFor(intentText, perceivedObjects, heldObjectIds);
      const cached = cache.get(key);
      if (cached) return cached;
      const full = await ruleMain(intentText, perceivedObjects, heldObjectIds);
      let ruling: RefereeRuling = full;
      if (options.oneAct === "checked" || options.oneAct === "first") {
        const { oneAct, secondActFrom } = await readOneAct(intentText, transports);
        ruling = { ...full, oneAct };
        // D7 (PLAYTEST-2026-09-27-DESIGN.md R5): a verified `several` cited by word range names where the second act
        // starts; the words before it are ruled as a fresh intent (the same cached path), and an applicable ruling
        // on them becomes THE ruling. From word 1, or an inapplicable first act, the full ruling stands exactly as
        // under `checked`: a false positive costs nothing. The cost is time: this is a third referee call on a
        // flagged turn, about 30 s on the local card (RED-TEAM.md F13), and §74.1 measured the detector flagging a
        // preparatory step about one time in four -- so a player waits longer on those turns.
        const split = options.oneAct === "first" && secondActFrom !== null ? splitAtSecondAct(intentText, secondActFrom) : null;
        if (split) {
          const attempted = await ruleMain(split.text, perceivedObjects, heldObjectIds);
          if (attempted.applicable) ruling = { ...attempted, oneAct: { ...oneAct, attempted: split, fullRuling: full } };
        }
      }
      cache.set(key, ruling);
      return ruling;
    },
  };
}
