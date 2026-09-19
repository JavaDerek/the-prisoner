import { createTurnReader, type ReaderQuestion, type ReaderSource, type ReaderTransport, type ReaderResult } from "run-dmcp";
import { PROPERTY_ANSWER_KEYS } from "./effects.js";
import type { OpenPropertyKey } from "./scenarioObjects.js";
import {
  answerFor,
  citationCheck,
  descriptionSourceId,
  withRanges,
  INTENT_SOURCE_ID,
  type ObjectPerception,
  type CitationCheck,
  type RefereeExchangeRecord,
  type ExchangeKeeping,
} from "./referee.js";

/**
 * The play-time elaboration request (WORLD-ELABORATION-DESIGN.md §4.1, §4.2;
 * §9 row P1b). A SECOND, SEPARATE model call from the base referee
 * (`referee.ts`) -- never a question appended to it, per this task's own
 * load-bearing constraint: the base request must stay byte-identical to
 * every batch recorded before this file existed, because a request shape
 * change would make every earlier measurement incomparable (the-prisoner#17
 * made the identical point for the instrument question, §40.1's D3 lesson).
 * This module never runs unless a half-round's BASE ruling already failed
 * (`loop.ts`'s two null paths, §1.4) and the `PRISONER_ELABORATE` arm is on
 * (`readElaborateMode`, `checkpoint.ts`) -- when it is off, this file is
 * never imported into a running call at all.
 *
 * P1b BUILDS ONLY THE REQUEST AND ITS ARM. It fires, logs (via
 * `loop.ts`/`checkpointTranscript.ts`), and applies nothing: no mechanic,
 * no band lookup, no belief write. `elaborationBands.ts` (P1) already holds
 * the build-time price a later agent's `OPEN_ACQUIRE` (P2) will look up;
 * this module never reads it, because §4.2 is explicit that the price is
 * never asked here -- it is a lookup once P2 exists.
 *
 * ONE QUESTION, `need` -- §4.2's table verbatim: closed keys `integrity`,
 * `edge`, `concealment`, `passage`, `none` (reusing `PROPERTY_ANSWER_KEYS`
 * from `effects.ts`, the referee's own property vocabulary, so this file
 * cannot silently invent a fifth kind), safe default `none`, cited ONLY
 * from the target's own authored description (`desc:<target>`) -- never
 * from the actor's intent, which is a SOURCE here (so the model can see
 * what was attempted) but never a legal citation source (so the actor's own
 * eloquence can reach `need` and nothing else, §4.2's own "the worst a
 * loaded intent can do is make the world acquire a property at the price it
 * was always going to cost"). Temperature 0 is the transport's own concern
 * (`refereeTransport.ts`), exactly as it is for the base referee.
 */

const NEED_QUESTION_ID = "need";

export interface ElaborationRuling {
  targetObjectId: string;
  need: OpenPropertyKey | "none";
  /** The `need` answer's own citation -- required source is `desc:<target>`,
   *  never `intent` (§4.2: "cited from desc:<target> only"). */
  citation: CitationCheck;
  /** The raw reader result, kept for the transcript, exactly as
   *  `RefereeRuling.raw` is. */
  raw: ReaderResult;
  /** Per rung, what the model call came back with -- `RefereeRuling.exchanges`'s
   *  own shape, so `checkpointTranscript.ts`'s sidecar writer needs no second
   *  code path to carry it. */
  exchanges?: readonly (RefereeExchangeRecord | null)[];
  /** The exact request this ruling was asked against, kept for the SAME
   *  reason `RefereeRuling.request` is: `refereeRequestsFor`
   *  (`checkpointTranscript.ts`) logs it as a second sidecar entry, and
   *  `npm run referee-replay` re-asks it unchanged. */
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] };
}

export interface ElaborationReferee {
  /** `target` is the perceived object the BASE ruling already named
   *  (`RefereeRuling.targetObjectId`, resolved back to its perception by
   *  `loop.ts`) -- this module never re-derives a target of its own; §2
   *  ("never a person as the target") and §4.1's "a perceived object" are
   *  both `loop.ts`'s own gate, checked before this is ever called. */
  rule(intentText: string, target: ObjectPerception): Promise<ElaborationRuling>;
}

function buildElaborationQuestions(): ReaderQuestion[] {
  return [
    {
      id: NEED_QUESTION_ID,
      prompt:
        "The target has none of the properties this attempt needs. Which property kind, if the target had it, would " +
        "make the attempt PHYSICALLY POSSIBLE, grounded in the target's OWN description (the source labelled desc: " +
        "followed by its id) -- one of: integrity, edge, concealment, passage, or none if nothing in the description " +
        "supports any. Cite the exact words that make that property real for this object: a hollow of dry grit, or " +
        "the soundness of what fills it, for passage; a hinge or a fixing for integrity.",
      answerKeys: [...PROPERTY_ANSWER_KEYS],
      safeDefault: "none",
    },
  ];
}

/** `intent` first, so the model can see what was attempted, then the
 *  target's own description -- the same two-source shape as the base
 *  referee's `property` question, minus every other perceived object,
 *  because `need`'s only legal citation source is the target's own text
 *  (§4.2: "the one object whose text can ground the decision"). */
function buildElaborationSources(intentText: string, target: ObjectPerception): ReaderSource[] {
  return [
    { id: INTENT_SOURCE_ID, text: intentText },
    { id: descriptionSourceId(target.id), text: target.description },
  ];
}

/** Builds the ruling from a completed read -- pure, unit-testable against a
 *  hand-built `ReaderResult`, exactly mirroring `referee.ts`'s own
 *  `computeRuling`. */
export function computeElaborationRuling(
  result: ReaderResult,
  request: { questions: readonly ReaderQuestion[]; sources: readonly ReaderSource[] },
  targetObjectId: string
): ElaborationRuling {
  const needAnswer = answerFor(result, NEED_QUESTION_ID);
  const need = needAnswer.answerKey as OpenPropertyKey | "none";
  const citation = citationCheck(needAnswer, descriptionSourceId(targetObjectId));
  return { targetObjectId, need, citation, raw: result, request };
}

/** Builds one elaboration referee for the lifetime of a game -- `transports`
 *  is the fallback ladder `createTurnReader` runs, exactly as
 *  `createReferee`'s own parameter is. No cache: unlike the base referee's
 *  precedent-consistency cache (`referee.ts`'s own `cacheKeyFor` comment),
 *  each elaboration is asked once, on the one half-round that triggered it,
 *  so there is no repeat call to collapse. */
export function createElaborationReferee(transports: readonly ReaderTransport[]): ElaborationReferee {
  return {
    async rule(intentText: string, target: ObjectPerception): Promise<ElaborationRuling> {
      const questions = buildElaborationQuestions();
      const sources = buildElaborationSources(intentText, target);
      // OPEN-VARIANT.md §18.3, carried over from `referee.ts`: what each
      // rung offered, kept so `withRanges` can put the word range back
      // beside the accepted quote.
      const offered: unknown[] = [];
      const exchanges: (RefereeExchangeRecord | null)[] = transports.map(() => null);
      const recording = transports.map((transport, rung): ReaderTransport => async (request) => {
        const answers = await transport(request);
        offered[rung] = answers;
        exchanges[rung] = (transport as ExchangeKeeping).lastExchange?.() ?? null;
        return answers;
      });
      const reader = createTurnReader({ questions, transports: recording });
      const result = withRanges(await reader.read(sources), offered);
      return { ...computeElaborationRuling(result, { questions, sources }, target.id), exchanges };
    },
  };
}

/**
 * `PRISONER_ELABORATE=off | property` (WORLD-ELABORATION-DESIGN.md §4.7,
 * Appendix C; later `object` for Tier 2, not built here). `off` is
 * byte-identical to every batch recorded before this arm existed: no
 * second request, no mechanic reachable (P2, not built here either), no
 * header line -- the same D3 lesson every other arm in this repository
 * follows (`readInstrumentMode`, `readDoorMode`).
 */
export type ElaborateMode = "off" | "property";

export function readElaborateMode(raw: string | undefined): ElaborateMode {
  if (raw === undefined || raw === "") return "off";
  if (raw === "off" || raw === "property") return raw;
  throw new Error(`PRISONER_ELABORATE: unrecognised value ${JSON.stringify(raw)} -- must be "property" or "off" (the default)`);
}

/**
 * The transcript header line (§4.7: "The transcript header prints
 * `Elaboration: property` when on"), or `null` under `off` -- literally no
 * line at all, not a line saying so, because `off` must stay byte-identical
 * to every checkpoint transcript recorded before this arm existed. Factored
 * out of `checkpoint.ts` so it is unit-testable: `checkpoint.ts` runs its
 * game at module load (`(VARIANT === "open" ? mainOpen() : main()).catch(...)`
 * at its own end) and so cannot itself be imported by a test.
 */
export function elaborationHeaderLine(mode: ElaborateMode): string | null {
  if (mode === "off") return null;
  return (
    "Elaboration: property (`PRISONER_ELABORATE=property`): a second, separate referee question, `need`, is asked " +
    "on a half-round whose base ruling did not apply, naming which property kind (if any) the target's own " +
    "authored description could support (WORLD-ELABORATION-DESIGN.md §4.1, §4.2). Fires and logs only -- the " +
    "price was read at build time (`npm run price-world`, `elaborationBands.ts`) and nothing is acquired yet " +
    "(§9 row P1b)."
  );
}
