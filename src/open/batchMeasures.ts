// Batch measures for OPUS-FIRST-DESIGN.md §2, §3.3 and §5.2 -- pure functions
// over checkpoint transcript text, generalised from
// `checkpoints/2026-09-20-ambition/count.mts` (which stays as that batch's own
// committed record and is not imported here).
//
// Never reads prose. Every number comes from structural lines
// `checkpointTranscript.ts` writes: the half-round heading (`### Round N (t=T)
// -- the <chair>`), the referee table rows (`| target | \`x\` | <citation> |
// yes |`), the rejected-offer lines (`- <question>: rejected (...)`), the
// `**Ruled:**` line, the `**Silence.**` / `**Voice silence.**` markers, the
// `**Plan:**` / `**Replanned because:**` markers (their presence, never their
// text), the `## Result` line and the §22 plans line. The thoughts, intents,
// lines and notes between them are not looked at, which is the whole point:
// CLAUDE.md's "never pattern-match meaning" holds for a measurement tool
// exactly as it holds for the referee. A "way out" is an object whose
// referee `property` answer is `passage` -- the referee's own key -- never the
// word "door".
//
// A half-round with no referee table is a decision silence: reported on its
// own, never folded into "refused", as count.mts already did.

export type Chair = "warden" | "prisoner";
export const CHAIRS: readonly Chair[] = ["warden", "prisoner"];

/** count.mts's person set: the two principals as target keys. */
const PERSON = new Set<string>(["warden", "prisoner"]);

/** The referee's questions, in the order `checkpointTranscript.ts` renders them
 *  (`QUESTION_IDS` plus the optional `instrument` row). Used only to normalise a
 *  raw reply's `questionId` -- a malformed reply may say `id "target"`. */
const QUESTION_IDS = ["target", "effect", "product", "property", "magnitude", "perceptibility", "instrument"] as const;

export interface Citation {
  sourceId: string;
  from: number | null;
  to: number | null;
  quote: string;
}

export interface RulingRow {
  question: string;
  answer: string;
  citation: Citation | null; // null = the table printed `(none)`
  verified: "yes" | "no" | "n/a";
}

export interface Ruling {
  rows: RulingRow[];
  target: string;
  effect: string;
  property: string;
  magnitude: string;
  ruled: "possible" | "impossible" | null;
  /** Question ids the reader printed a `rejected (...)` offer line for. */
  rejected: string[];
}

export interface HalfRound {
  round: number;
  principal: Chair;
  silence: boolean; // `**Silence.**` -- no proposal, no table
  voiceSilence: boolean; // `**Voice silence.**` -- the turn resolved, only the line is missing
  hadPlan: boolean; // a `**Plan:**` line was printed
  replanned: boolean; // a `**Replanned because:**` line was printed
  ruling: Ruling | null;
}

export interface Transcript {
  file: string;
  wits: string;
  referee: string;
  escaped: boolean;
  halves: HalfRound[];
  /** The §22 line as printed, so the marker count below can be checked against it. */
  printedPlans: { replanned: number; withPlan: number; kept: number } | null;
}

export interface RepliedRuling {
  round: number;
  principal: Chair;
  answers: Record<string, string>;
  /** `strict`: JSON.parse succeeded; `lenient`: keys were pulled from a reply
   *  strict JSON rejected; `failed`: no answer key could be found at all. */
  parse: "strict" | "lenient" | "failed";
}

export interface Game {
  arm: string;
  transcript: Transcript;
  replies: RepliedRuling[];
}

export interface ResiduePair {
  target: string;
  effect: string;
}

const HEADING = /^### Round (\d+) \(t=\d+\) -- the (warden|prisoner)$/m;

/** One transcript's structural content. `file` is only carried into the
 *  report rows; nothing here reads the file system. */
export function parseTranscript(text: string, file = "?"): Transcript {
  const wits = /^Wits model: `([^`]+)`/m.exec(text)?.[1] ?? "?";
  const referee = /Referee model: `([^`]+)`/m.exec(text)?.[1] ?? "?";
  const escaped = /^\*\*The prisoner escaped, at round \d+\.\*\*/m.test(text);
  const plansM = /^Prisoner plans \(§22\): replanned (\d+) of (\d+) turns that had a plan, kept (\d+)\./m.exec(text);
  const printedPlans = plansM ? { replanned: Number(plansM[1]), withPlan: Number(plansM[2]), kept: Number(plansM[3]) } : null;

  const halves: HalfRound[] = [];
  const sections = text.split(new RegExp(HEADING.source, "gm"));
  // split yields [pre, round, principal, body, round, principal, body, ...]
  for (let i = 1; i + 2 < sections.length + 1; i += 3) {
    const round = Number(sections[i]);
    const principal = sections[i + 1] as Chair;
    // The last body runs on into `## Result` and the measurements section; cut
    // every body at the first `## ` heading so only the half-round is read.
    const body = (sections[i + 2] ?? "").split(/^## /m)[0];
    halves.push({
      round,
      principal,
      silence: /^\*\*Silence\.\*\*/m.test(body),
      voiceSilence: /^\*\*Voice silence\.\*\*/m.test(body),
      hadPlan: /^\*\*Plan:\*\* /m.test(body),
      replanned: /^\*\*Replanned because:\*\*/m.test(body),
      ruling: parseRuling(body),
    });
  }
  return { file, wits, referee, escaped, halves, printedPlans };
}

const ROW = /^\| (\w+) \| `([^`]*)` \| (.*) \| (yes|no|n\/a) \|$/gm;
// `citationCell` in checkpointTranscript.ts: `<sourceId>[, words a-b]: "<quote>"`
// or `(none)`. A source id (`intent`, `desc:bar`) never holds a space, so the
// lazy `\S+?` stops at the first `, words` or `: "` that follows it.
const CELL = /^(\S+?)(?:, words (\d+)-(\d+))?: "([\s\S]*)"$/;

function parseRuling(body: string): Ruling | null {
  const rows: RulingRow[] = [];
  for (const m of body.matchAll(ROW)) {
    const cell = m[3];
    let citation: Citation | null = null;
    if (cell !== "(none)") {
      const c = CELL.exec(cell);
      if (c) citation = { sourceId: c[1], from: c[2] === undefined ? null : Number(c[2]), to: c[3] === undefined ? null : Number(c[3]), quote: c[4] };
    }
    rows.push({ question: m[1], answer: m[2], citation, verified: m[4] as RulingRow["verified"] });
  }
  if (rows.length === 0) return null;
  const answer = (q: string): string => rows.find((r) => r.question === q)?.answer ?? "?";
  const ruledM = /^\*\*Ruled:\*\* (possible|impossible)/m.exec(body);
  const rejected = [...body.matchAll(/^- (\w+): rejected \(/gm)].map((m) => m[1]);
  return { rows, target: answer("target"), effect: answer("effect"), property: answer("property"), magnitude: answer("magnitude"), ruled: ruledM ? (ruledM[1] as Ruling["ruled"]) : null, rejected: [...new Set(rejected)] };
}

function grounded(h: HalfRound): boolean {
  return h.ruling !== null && h.ruling.ruled === "possible" && h.ruling.target !== "none";
}
function refused(h: HalfRound): boolean {
  return h.ruling !== null && (h.ruling.target === "none" || h.ruling.ruled === "impossible");
}

// ---------------------------------------------------------------------------
// The `.referee.json` sidecar (RESULTS.md bug 1): what the referee answered,
// read down to answer keys even when the reply is not JSON.

/** Parses a checkpoint's `.referee.json`. Only the ruling entries (`round N,
 *  <chair>: ...`) are read; `, elaboration:` entries and null rungs are
 *  skipped. Of several rungs the LAST reply with content is taken, because
 *  that is the one the reader ended on. */
export function parseRefereeReplies(json: string): RepliedRuling[] {
  const entries = JSON.parse(json) as { label?: unknown; replies?: unknown }[];
  const out: RepliedRuling[] = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    const label = typeof e.label === "string" ? e.label : "";
    const lm = /^round (\d+), (warden|prisoner): /.exec(label);
    if (!lm) continue;
    const replies = Array.isArray(e.replies) ? (e.replies as ({ content?: unknown } | null)[]) : [];
    const last = [...replies].reverse().find((r) => r && typeof r.content === "string") as { content: string } | undefined;
    const parsed = last ? parseReplyContent(last.content) : { answers: {}, parse: "failed" as const };
    out.push({ round: Number(lm[1]), principal: lm[2] as Chair, ...parsed });
  }
  return out;
}

function normaliseQuestionId(raw: string): string | null {
  for (const id of QUESTION_IDS) if (raw === id || new RegExp(`\\b${id}\\b`).test(raw)) return id;
  return null;
}

function parseReplyContent(content: string): { answers: Record<string, string>; parse: RepliedRuling["parse"] } {
  const answers: Record<string, string> = {};
  try {
    const arr = JSON.parse(content) as unknown;
    if (Array.isArray(arr)) {
      for (const a of arr as { questionId?: unknown; answerKey?: unknown }[]) {
        if (typeof a?.questionId !== "string" || typeof a?.answerKey !== "string") continue;
        const id = normaliseQuestionId(a.questionId);
        if (id && !(id in answers)) answers[id] = a.answerKey;
      }
      return { answers, parse: "strict" };
    }
  } catch {
    // fall through to the lenient read below
  }
  // The batch's eight malformed replies all keep `"questionId": "...", "answerKey": "..."` intact and
  // break only in a citation's closing braces, so the keys are read pair by pair.
  for (const m of content.matchAll(/"questionId"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answerKey"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    const id = normaliseQuestionId(m[1].replace(/\\"/g, '"'));
    if (id && !(id in answers)) answers[id] = m[2];
  }
  return { answers, parse: Object.keys(answers).length > 0 ? "lenient" : "failed" };
}

export interface LostRuling {
  file: string;
  round: number;
  principal: Chair;
  question: string;
  answered: string;
  recorded: string;
}

/** A ruling is LOST when the referee's reply answers `target` or `effect` with
 *  a key the transcript table does not show, and the transcript does not say
 *  the reader rejected that offer. A rejection (a non-verbatim citation, an
 *  empty quote) is the reader working as designed; a silent fall to the safe
 *  default is bug 1. */
export function lostRulings(t: Transcript, replies: readonly RepliedRuling[]): LostRuling[] {
  const out: LostRuling[] = [];
  for (const r of replies) {
    const half = t.halves.find((h) => h.round === r.round && h.principal === r.principal && h.ruling);
    if (!half?.ruling) continue;
    for (const question of ["target", "effect"] as const) {
      const answered = r.answers[question];
      if (answered === undefined) continue;
      const recorded = half.ruling[question];
      if (answered !== recorded && !half.ruling.rejected.includes(question)) out.push({ file: t.file, round: r.round, principal: r.principal, question, answered, recorded });
    }
  }
  return out;
}

/** RESULTS.md's "1 recorded (2 as the referee answered)": the escapes the
 *  transcripts record, plus the games that did NOT escape but lost a ruling
 *  whose answered `effect` was `leave`. Whether that leave would then have
 *  been ruled possible is not knowable from keys, so the two numbers are kept
 *  apart and never summed into the escapes column. */
export function escapesAsAnswered(games: readonly Game[]): { recorded: number; lostLeaves: number } {
  const recorded = games.filter((g) => g.transcript.escaped).length;
  const lostLeaves = games.filter((g) => !g.transcript.escaped && lostRulings(g.transcript, g.replies).some((l) => l.question === "effect" && l.answered === "leave")).length;
  return { recorded, lostLeaves };
}

// ---------------------------------------------------------------------------
// Reach family (§5.2): count.mts's five, then route finding, first contact and
// the frozen residue.

export interface ReachArm {
  games: number;
  intents: number;
  silences: number;
  meanDistinctTargets: number;
  personTargetGames: number; // count.mts's pooled column, kept ONLY so its table reproduces; §5.2 reports person targets by chair
  meanDistinctEffects: number;
  grounded: number;
  refused: number;
  escapes: number;
}

function rulingsOf(halves: readonly HalfRound[]): Ruling[] {
  return halves.flatMap((h) => (h.ruling ? [h.ruling] : []));
}
function distinctTargets(halves: readonly HalfRound[]): Set<string> {
  return new Set(rulingsOf(halves).filter((r) => r.target !== "none").map((r) => r.target));
}
function distinctEffects(halves: readonly HalfRound[]): Set<string> {
  return new Set(rulingsOf(halves).filter((r) => r.effect !== "none").map((r) => r.effect));
}
function mean(xs: readonly number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function reachByArm(games: readonly Game[]): ReachArm {
  const halves = games.flatMap((g) => g.transcript.halves);
  return {
    games: games.length,
    intents: halves.filter((h) => h.ruling).length,
    silences: halves.filter((h) => !h.ruling).length,
    meanDistinctTargets: mean(games.map((g) => distinctTargets(g.transcript.halves).size)),
    personTargetGames: games.filter((g) => g.transcript.halves.some((h) => h.ruling && PERSON.has(h.ruling.target))).length,
    meanDistinctEffects: mean(games.map((g) => distinctEffects(g.transcript.halves).size)),
    grounded: halves.filter(grounded).length,
    refused: halves.filter(refused).length,
    escapes: games.filter((g) => g.transcript.escaped).length,
  };
}

export interface FirstContact {
  meanRound: number; // over the games in which this chair targeted the object at all
  games: number;
}

export interface ReachChair {
  intents: number;
  silences: number;
  distinctTargets: string[]; // pooled over the arm's games, sorted
  meanDistinctTargets: number; // per game
  personTargets: number;
  distinctEffects: string[];
  meanDistinctEffects: number;
  grounded: number;
  refused: number;
  escapes: number;
  /** Intents whose referee `property` answer is `passage`: an act on a way out, whatever it is called. */
  routeFinding: number;
  firstContact: Record<string, FirstContact>;
  /** Refusals whose (target, effect) pair is on the frozen residue (§2). */
  residueRefusals: number;
}

export function reachByChair(games: readonly Game[], chair: Chair, residue: readonly ResiduePair[] = []): ReachChair {
  const perGame = games.map((g) => g.transcript.halves.filter((h) => h.principal === chair));
  const halves = perGame.flat();
  const rulings = rulingsOf(halves);
  const firstContact: Record<string, FirstContact> = {};
  const firstRounds = new Map<string, number[]>();
  for (const hs of perGame) {
    const seen = new Map<string, number>();
    for (const h of hs) {
      if (!h.ruling || h.ruling.target === "none") continue;
      const t = h.ruling.target;
      if (!seen.has(t) || h.round < (seen.get(t) as number)) seen.set(t, h.round);
    }
    for (const [t, r] of seen) firstRounds.set(t, [...(firstRounds.get(t) ?? []), r]);
  }
  for (const t of [...firstRounds.keys()].sort()) firstContact[t] = { meanRound: mean(firstRounds.get(t) as number[]), games: (firstRounds.get(t) as number[]).length };
  const onResidue = (h: HalfRound): boolean => residue.some((p) => p.target === h.ruling?.target && p.effect === h.ruling?.effect);
  return {
    intents: rulings.length,
    silences: halves.filter((h) => !h.ruling).length,
    distinctTargets: [...distinctTargets(halves)].sort(),
    meanDistinctTargets: mean(perGame.map((hs) => distinctTargets(hs).size)),
    personTargets: rulings.filter((r) => PERSON.has(r.target)).length,
    distinctEffects: [...distinctEffects(halves)].sort(),
    meanDistinctEffects: mean(perGame.map((hs) => distinctEffects(hs).size)),
    grounded: halves.filter(grounded).length,
    refused: halves.filter(refused).length,
    escapes: games.filter((g) => g.transcript.escaped).length,
    routeFinding: rulings.filter((r) => r.property === "passage").length,
    firstContact,
    residueRefusals: halves.filter((h) => refused(h) && onResidue(h)).length,
  };
}

// ---------------------------------------------------------------------------
// Competence family (§5.2), all structural.

export interface CompetenceChair {
  /** OPEN-VARIANT.md §22's rule applied to this chair from the `**Plan:**` and
   *  `**Replanned because:**` markers: of the turns after a plan existed, how
   *  many said they replanned. Never a judgement of whether two plans differ. */
  plans: { withPlan: number; replanned: number; kept: number };
  /** For the prisoner, whether that marker count matches the §22 line every
   *  transcript printed; null for a chair the transcript prints no line for. */
  printedPlansAgree: boolean | null;
  targetNone: number;
  rulingsWithUnverified: number; // rulings with at least one `verified: no`
  decisionSilences: number;
  voiceSilences: number;
  verified: { yes: number; total: number }; // over `yes`/`no` cells only; `n/a` cells are not citations the guard checks
}

function plansFor(halves: readonly HalfRound[]): { withPlan: number; replanned: number } {
  // The same walk `checkpointTranscript.ts` makes for the prisoner, on any chair.
  let hadPlan = false;
  let withPlan = 0;
  let replanned = 0;
  for (const h of halves.filter((x) => !x.silence)) {
    if (hadPlan) {
      withPlan += 1;
      if (h.replanned) replanned += 1;
    }
    if (h.hadPlan) hadPlan = true;
  }
  return { withPlan, replanned };
}

export function competenceByChair(games: readonly Game[], chair: Chair): CompetenceChair {
  let withPlan = 0;
  let replanned = 0;
  let printedPlansAgree: boolean | null = null;
  for (const g of games) {
    const hs = g.transcript.halves.filter((h) => h.principal === chair);
    const p = plansFor(hs);
    withPlan += p.withPlan;
    replanned += p.replanned;
    if (chair === "prisoner" && g.transcript.printedPlans) {
      const agrees = g.transcript.printedPlans.withPlan === p.withPlan && g.transcript.printedPlans.replanned === p.replanned;
      printedPlansAgree = printedPlansAgree === null ? agrees : printedPlansAgree && agrees;
    }
  }
  const halves = games.flatMap((g) => g.transcript.halves.filter((h) => h.principal === chair));
  const rulings = rulingsOf(halves);
  const cells = rulings.flatMap((r) => r.rows.filter((row) => row.verified !== "n/a"));
  return {
    plans: { withPlan, replanned, kept: withPlan - replanned },
    printedPlansAgree,
    targetNone: rulings.filter((r) => r.target === "none").length,
    rulingsWithUnverified: rulings.filter((r) => r.rows.some((row) => row.verified === "no")).length,
    decisionSilences: halves.filter((h) => h.silence).length,
    voiceSilences: halves.filter((h) => h.voiceSilence).length,
    verified: { yes: cells.filter((c) => c.verified === "yes").length, total: cells.length },
  };
}

// ---------------------------------------------------------------------------
// §3.3: the citation guard is satisfied by an article. Not fixed; sized.

export interface ShortCitation {
  arm: string;
  file: string;
  round: number;
  principal: Chair;
  question: string;
  answer: string;
  quote: string;
}

/** A quote that is one word of three letters or fewer (`"the"`, `"bar"`,
 *  `"Rub"`). Letters are counted after stripping punctuation, so `"the."`
 *  counts and `"open now."` does not. Whether the word is a function word is
 *  for the reader: `bar` is a legitimate one-word citation, `the` is not, and
 *  the design says a length rule cannot tell them apart. */
export function isShortCitation(quote: string): boolean {
  const trimmed = quote.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length > 0 && letters.length <= 3;
}

export function shortCitations(games: readonly Game[]): { rows: ShortCitation[]; rulings: number; totalRulings: number } {
  const rows: ShortCitation[] = [];
  let rulings = 0;
  let totalRulings = 0;
  for (const g of games) {
    for (const h of g.transcript.halves) {
      if (!h.ruling) continue;
      totalRulings += 1;
      let any = false;
      for (const row of h.ruling.rows) {
        if (row.citation && isShortCitation(row.citation.quote)) {
          any = true;
          rows.push({ arm: g.arm, file: g.transcript.file, round: h.round, principal: h.principal, question: row.question, answer: row.answer, quote: row.citation.quote });
        }
      }
      if (any) rulings += 1;
    }
  }
  return { rows, rulings, totalRulings };
}

// ---------------------------------------------------------------------------
// §2: the refusal audit list, keys only, with an empty label for the owner.

export interface RefusalRow {
  arm: string;
  file: string;
  round: number;
  principal: Chair;
  target: string;
  effect: string;
  property: string;
  magnitude: string;
  ruled: string;
  label: ""; // genuine / unbuilt / unclear, written by a person, never here
}

export function refusalAudit(games: readonly Game[]): RefusalRow[] {
  const out: RefusalRow[] = [];
  for (const g of games) {
    for (const h of g.transcript.halves) {
      if (!refused(h) || !h.ruling) continue;
      out.push({ arm: g.arm, file: g.transcript.file, round: h.round, principal: h.principal, target: h.ruling.target, effect: h.ruling.effect, property: h.ruling.property, magnitude: h.ruling.magnitude, ruled: h.ruling.ruled ?? "?", label: "" });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// CLI arguments and the markdown report.

export interface MeasuresArgs {
  dir: string;
  arms: string[] | null; // null = every subdirectory holding transcripts
  residue: ResiduePair[];
}

export function parseResidue(s: string): ResiduePair[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x !== "")
    .map((x) => {
      const parts = x.split("/");
      if (parts.length !== 2 || parts.some((p) => p === "")) throw new Error(`--residue: each entry is a target/effect pair, got "${x}"`);
      return { target: parts[0], effect: parts[1] };
    });
}

export function parseMeasuresArgs(argv: readonly string[]): MeasuresArgs {
  let dir: string | null = null;
  let arms: string[] | null = null;
  let residue: ResiduePair[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--arms") {
      arms = (argv[++i] ?? "").split(",").map((x) => x.trim()).filter((x) => x !== "");
    } else if (a === "--residue") {
      residue = parseResidue(argv[++i] ?? "");
    } else if (a.startsWith("--")) {
      throw new Error(`unknown option ${a}`);
    } else if (dir === null) {
      dir = a;
    } else {
      throw new Error(`unexpected argument ${a}`);
    }
  }
  if (dir === null) throw new Error("usage: npm run measures -- <batch dir> [--arms Q,O,D] [--residue target/effect,...]");
  return { dir, arms, residue };
}

function armsOf(games: readonly Game[]): string[] {
  return [...new Set(games.map((g) => g.arm))];
}

export function renderBatchMeasures(games: readonly Game[], opts: { residue?: readonly ResiduePair[] } = {}): string {
  const residue = opts.residue ?? [];
  const arms = armsOf(games);
  const out: string[] = [];
  const f2 = (x: number): string => x.toFixed(2);
  const pct = (yes: number, total: number): string => (total === 0 ? "n/a" : `${yes}/${total} (${((100 * yes) / total).toFixed(0)}%)`);

  out.push("## Per arm");
  out.push("");
  out.push("| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const arm of arms) {
    const gs = games.filter((g) => g.arm === arm);
    const r = reachByArm(gs);
    const wits = [...new Set(gs.map((g) => g.transcript.wits))].join(", ");
    out.push(`| ${arm} | \`${wits}\` | ${r.games} | ${r.intents} | ${r.silences} | ${f2(r.meanDistinctTargets)} | ${r.personTargetGames} of ${r.games} | ${f2(r.meanDistinctEffects)} | ${r.grounded} | ${r.refused} | ${r.escapes} |`);
  }
  out.push("");
  out.push("Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.");
  out.push("");

  out.push("## Reach, per chair");
  out.push("");
  out.push(`Route finding: intents whose referee \`property\` answer is \`passage\`. Residue refusals: refusals on ${residue.length === 0 ? "(no --residue given)" : residue.map((p) => `\`${p.target}/${p.effect}\``).join(", ")}.`);
  out.push("");
  out.push("| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const arm of arms) {
    const gs = games.filter((g) => g.arm === arm);
    for (const chair of CHAIRS) {
      const r = reachByChair(gs, chair, residue);
      out.push(`| ${arm} | ${chair} | ${r.intents} | ${r.silences} | ${f2(r.meanDistinctTargets)} | ${r.distinctTargets.length}: ${r.distinctTargets.join(", ")} | ${r.personTargets} | ${f2(r.meanDistinctEffects)} | ${r.distinctEffects.length}: ${r.distinctEffects.join(", ")} | ${r.grounded} | ${r.refused} | ${r.routeFinding} | ${r.residueRefusals} |`);
    }
  }
  out.push("");

  out.push("## First contact");
  out.push("");
  out.push("For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.");
  out.push("");
  out.push("| arm | chair | object | first round (mean) | games |");
  out.push("|---|---|---|---|---|");
  for (const arm of arms) {
    const gs = games.filter((g) => g.arm === arm);
    for (const chair of CHAIRS) {
      const r = reachByChair(gs, chair, residue);
      for (const [object, fc] of Object.entries(r.firstContact)) out.push(`| ${arm} | ${chair} | ${object} | ${f2(fc.meanRound)} | ${fc.games} of ${gs.length} |`);
    }
  }
  out.push("");

  out.push("## Competence, per chair");
  out.push("");
  out.push("Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; \"§22 line agrees\" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.");
  out.push("");
  out.push("| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const arm of arms) {
    const gs = games.filter((g) => g.arm === arm);
    for (const chair of CHAIRS) {
      const c = competenceByChair(gs, chair);
      const agrees = c.printedPlansAgree === null ? "n/a" : c.printedPlansAgree ? "yes" : "**no**";
      out.push(`| ${arm} | ${chair} | ${c.plans.withPlan} | ${c.plans.replanned} | ${c.plans.kept} | ${agrees} | ${c.targetNone} | ${c.rulingsWithUnverified} | ${c.decisionSilences} | ${c.voiceSilences} | ${pct(c.verified.yes, c.verified.total)} |`);
    }
  }
  out.push("");

  out.push("## Short citations (§3.3)");
  out.push("");
  out.push("Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.");
  out.push("");
  out.push("| arm | rulings with a short citation | of rulings | rows |");
  out.push("|---|---|---|---|");
  for (const arm of arms) {
    const s = shortCitations(games.filter((g) => g.arm === arm));
    out.push(`| ${arm} | ${s.rulings} | ${s.totalRulings} | ${s.rows.length} |`);
  }
  out.push("");
  out.push("| arm | transcript | round | chair | question | answer | quote |");
  out.push("|---|---|---|---|---|---|---|");
  for (const r of shortCitations(games).rows) out.push(`| ${r.arm} | \`${r.file}\` | ${r.round} | ${r.principal} | ${r.question} | \`${r.answer}\` | "${r.quote}" |`);
  out.push("");

  out.push("## Refusal audit list (§2)");
  out.push("");
  out.push("Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, unbuilt or unclear.");
  out.push("");
  out.push("| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |");
  out.push("|---|---|---|---|---|---|---|---|---|---|");
  for (const r of refusalAudit(games)) out.push(`| ${r.arm} | \`${r.file}\` | ${r.round} | ${r.principal} | ${r.target} | ${r.effect} | ${r.property} | ${r.magnitude} | ${r.ruled} | ${r.label} |`);
  out.push("");

  out.push("## Lost rulings");
  out.push("");
  out.push("RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.");
  out.push("");
  out.push("| arm | replies | strict JSON | read leniently | unreadable |");
  out.push("|---|---|---|---|---|");
  for (const arm of arms) {
    const rs = games.filter((g) => g.arm === arm).flatMap((g) => g.replies);
    out.push(`| ${arm} | ${rs.length} | ${rs.filter((r) => r.parse === "strict").length} | ${rs.filter((r) => r.parse === "lenient").length} | ${rs.filter((r) => r.parse === "failed").length} |`);
  }
  out.push("");
  const lost = games.flatMap((g) => lostRulings(g.transcript, g.replies).map((l) => ({ arm: g.arm, ...l })));
  if (lost.length === 0) {
    out.push("None.");
  } else {
    out.push("| arm | transcript | round | chair | question | referee answered | transcript recorded |");
    out.push("|---|---|---|---|---|---|---|");
    for (const l of lost) out.push(`| ${l.arm} | \`${l.file}\` | ${l.round} | ${l.principal} | ${l.question} | \`${l.answered}\` | \`${l.recorded}\` |`);
  }
  out.push("");
  out.push("Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.");
  out.push("");
  out.push("| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |");
  out.push("|---|---|---|---|");
  for (const arm of arms) {
    const e = escapesAsAnswered(games.filter((g) => g.arm === arm));
    out.push(`| ${arm} | ${e.recorded} | ${e.lostLeaves} | ${e.recorded + e.lostLeaves} |`);
  }
  out.push("");
  return out.join("\n");
}
