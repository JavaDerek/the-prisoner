import { targetUnreadWithEffectCited, type RefereeRuling } from "./referee.js";
import { renderOwnOutcome } from "./perception.js";
import type { OpenHalfRoundResult } from "./loop.js";
import type { Principal } from "../ledger/beliefs.js";

/**
 * The-prisoner#43 (`docs/HUMAN-INTENTS-DESIGN.md` §8.2, §9 step 9): one
 * report row per human half-round, under a human seat only -- a model batch
 * never builds one of these, and this module is never imported by
 * `checkpoint.ts`'s closed-variant path. Exported from THIS game module,
 * never `run-dmcp`: root `CLAUDE.md`'s D12 ("the caller exists the day this
 * repository reads its own rows, not before") -- the shape goes to the
 * engine as a PROPOSAL after one labelled audit, not as code landed here
 * first.
 *
 * Every field but `captured`, `outcomeWordingRead`, `versions` and `label`
 * is already sitting on `RefereeRuling`/`OpenHalfRoundResult` today; this
 * module's whole job is picking those fields out and adding the four that
 * are not.
 */

/** §7.2's own label scheme, reused verbatim as the field the OWNER fills in
 *  after playing (never written by this module -- see `label` below). */
export type TurnRowLabel = "correct" | "misread" | "unmodelled" | "ambiguous";

/**
 * §8.2's "captured" column: what structurally intercepted the player's own
 * words before -- or instead of -- an ordinary resolution, derived from the
 * ruling's own closed keys and D3's `reconsidered` record alone, never from
 * any English the referee or the seat produced (root CLAUDE.md's "never
 * pattern-match meaning", applied to this repository's own report the same
 * way it applies to a ruling).
 *
 * Priority, since a turn can only report one: a RETYPE is the most specific
 * true story about what happened this turn (D3's offer was taken up) and
 * outranks whatever the retyped intent went on to rule as, even a further
 * refusal -- the retype is the event worth surfacing. Absent a retype, an
 * unread target with its effect cited is Infocom's "Hide what?" moment,
 * whether or not the seat happened to offer a reconsider (a model mind, or
 * an offer already spent this turn, still leaves the signal in the ruling's
 * own keys). Absent either, any half-round that never resolved -- the
 * referee found nothing applicable, `planEffect` found no real
 * (object, property) pair (D8), or `resolve()` itself refused -- is a
 * `refusal`. Everything else is `none`: an ordinary turn, resolved or a
 * deliberate no-op.
 */
export type CapturedKind = "refusal" | "unread-target" | "player-retype" | "none";

export function classifyCapture(half: OpenHalfRoundResult): CapturedKind {
  if (half.reconsidered !== null) return "player-retype";
  if (half.ruling !== null && targetUnreadWithEffectCited(half.ruling)) return "unread-target";
  if (half.ruling !== null && half.outcome === null) return "refusal";
  return "none";
}

/** §7.3's own condition, recorded on every row this code writes: which
 *  outcome wording the player had been reading. D1 landed before this
 *  module did, so every row built here is `"post-D1"` -- a literal constant,
 *  never a guess at which wording an OLDER, unlabelled transcript used. */
export type OutcomeWordingRead = "post-D1";

/** Which package versions and code revision this row's turn ran under
 *  (§8.2: "run-dmcp and game versions"). Computed once per run by the
 *  caller (`checkpoint.ts`, from `packageInfo.ts`/`runRevision.ts`) and
 *  handed to every row -- never recomputed per turn, and never read from
 *  this module, which has no business shelling out to `git` or reading
 *  `package.json` on its own. */
export interface TurnReportVersions {
  runDmcp: string;
  game: string;
  codeRevision: string;
}

/**
 * §8.2's row shape. `ruling.raw` is `RefereeRuling.raw` (`run-dmcp`'s own
 * `ReaderResult`, untouched) -- every question's final answer key and its
 * citation, exactly as the turn reader returns them. `ruling.citations` is
 * this repository's OWN check (`referee.ts`'s `computeRuling`): whether each
 * citation verified against the SOURCE that question required, which
 * `ReaderResult` alone cannot say (it knows a citation matched some
 * declared source; only the caller knows which source was required). Both
 * are kept, under one `ruling` field, because §8.2 asks for "every answer,
 * citation, verified" and that is where each half of it actually lives.
 */
export interface HumanTurnRow {
  /** The player's own words, exactly as typed. Empty when the player did
   *  nothing this turn (Enter, or the terminal closing mid-question). */
  intent: string;
  /** `null` on a did-nothing turn (no ruling was ever asked for). */
  ruling: {
    request: RefereeRuling["request"];
    raw: RefereeRuling["raw"];
    citations: RefereeRuling["citations"];
  } | null;
  /** D1's own sentence (`renderOwnOutcome`) -- the actual outcome text the
   *  actor was shown, verbatim, not a second rendering of the ruling's keys.
   *  `null` exactly when `renderOwnOutcome` itself returns `null` (no
   *  proposal, or no ruling -- a did-nothing turn). */
  reasonTold: string | null;
  captured: CapturedKind;
  outcomeWordingRead: OutcomeWordingRead;
  versions: TurnReportVersions;
  /** Left `null` by this module always -- §7.2's label is filled in by the
   *  owner after playing, from reading the transcript against what the
   *  player meant, never guessed at here. */
  label: TurnRowLabel | null;
}

function rulingForRow(ruling: RefereeRuling | null): HumanTurnRow["ruling"] {
  if (ruling === null) return null;
  return { request: ruling.request, raw: ruling.raw, citations: ruling.citations };
}

export function buildHumanTurnRow(half: OpenHalfRoundResult, versions: TurnReportVersions): HumanTurnRow {
  return {
    intent: half.proposal?.intent ?? "",
    ruling: rulingForRow(half.ruling),
    reasonTold: renderOwnOutcome(half),
    captured: classifyCapture(half),
    outcomeWordingRead: "post-D1",
    versions,
    label: null,
  };
}

/** Every row for the SEATED principal's own half-rounds, in play order --
 *  the other principal's halves (a model, byte-untouched) never reach this
 *  function's caller in the first place, but filtering here too means a
 *  caller handing in the whole game's `halves` (as `checkpoint.ts` does for
 *  `refereeRequestsFor`) still gets only the human's own rows. */
export function humanTurnRowsFor(halves: readonly OpenHalfRoundResult[], seat: Principal, versions: TurnReportVersions): HumanTurnRow[] {
  return halves.filter((h) => h.principal === seat).map((h) => buildHumanTurnRow(h, versions));
}

/** One JSON object per line, in order -- JSONL, so a reader (or the owner's
 *  own labelling pass) can process it a row at a time without parsing the
 *  whole file, and so `checkpoint.ts` can rewrite it whole after every
 *  half-round (D2's own "rewritten whole, not appended" discipline, commit
 *  3131939) without ever leaving a half-written JSON array behind. Empty
 *  input renders the empty string, not a stray newline. */
export function renderHumanTurnRows(rows: readonly HumanTurnRow[]): string {
  if (rows.length === 0) return "";
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}
