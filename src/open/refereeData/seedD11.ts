import type { RefereeLabel } from "./types.js";

/**
 * The-prisoner#10's second seed corpus: D11's 95-row human-intents corpus
 * (`checkpoints/2026-09-26-human-intents/corpus.json`,
 * `docs/HUMAN-INTENTS-DESIGN.md` §7.2). That corpus is pre-registered
 * before any run against `expectedKeys` (target/effect/property only -- no
 * magnitude, perceptibility, product or citations were ever recorded) and a
 * four-way `expectedLabelPostD5D9` class per its own `LABELS.md`:
 *
 * | label | what it means for scoring |
 * |---|---|
 * | `correct` | `expectedKeys` is the single best reading; a divergence is the referee's own miss |
 * | `misread` | same -- keys differ from what was recorded, but a correct answer has a home in today's vocabulary |
 * | `ambiguous` | BOTH the recorded keys and `expectedKeys` are defensible -- a divergence is not evidence of anything |
 * | `unmodelled` | the label itself has no legal key or declared property to land on |
 *
 * This module keeps `expectedKeys` as ground truth ONLY for `correct` and
 * `misread` rows -- exactly `docs/HUMAN-INTENTS-DESIGN.md`'s own "only a
 * misread counts against the referee" -- and drops it (all three fields
 * `null`) for `ambiguous`/`unmodelled` rows and the two mixed-label rows
 * (`I25-6`, `I25-7`, "ambiguous on target and misread on effect"), which
 * `corpus.json` itself already records with `expectedKeys: null`. A field
 * whose own value is compound (`"wear-or-derive"`, `"none-or-refused"`) is
 * ALSO dropped, per-field, even on an otherwise-scoreable row: a compound
 * value is not a single label to score against, and inventing one would
 * break this issue's own "never invent a label" rule.
 *
 * Nothing else is recorded: `product`, `magnitude`, `perceptibility` and
 * every citation are `null` for every row here -- D11 never measured them
 * (`LABELS.md`'s own words: "what target/effect/property... a correct
 * ruling would answer"), so the scorer skips them rather than this module
 * inventing an answer nobody wrote down.
 *
 * The SCENE is a `replay` reference (`scene.ts`'s own `replayScene`),
 * exactly as `checkpoints/2026-09-26-human-intents/probe.mts` already
 * rebuilds it -- never a copy of a perceived description, which is the
 * issue's own "through the real code" requirement and the only way a
 * derived object (`strip_5`, only real once its own game has made it) can
 * be a legal target at all.
 *
 * `refereeArms` is the game's CURRENT default (elision on, container clause
 * on, instrument off, derive wording baseline) -- `probe.mts`'s own
 * `refereeOptionsFor`, read from the SAME env readers `checkpoint.ts` uses,
 * because `expectedLabelPostD5D9` is itself a claim about what the referee
 * SHOULD do under those arms (`LABELS.md`'s own header: "post-D5/D9" means
 * the text changes, and assumes the arm that reaches for the property is on
 * where the corpus says so).
 */

const SCOREABLE_LABELS = new Set(["correct", "misread"]);

export interface D11CorpusRow {
  id: string;
  sourceFile: string | null;
  round: number;
  chair: "prisoner" | "warden";
  intentTested: string;
  expectedKeys: { target?: string; effect?: string; property?: string } | null;
  expectedLabelPostD5D9: string;
}

export interface D11Corpus {
  rows: readonly D11CorpusRow[];
}

/** `null` unless this row's own top-level label is `correct`/`misread` AND
 *  the field's own value is a single, non-compound key. */
function keyFor(row: D11CorpusRow, field: "target" | "effect" | "property"): string | null {
  if (!SCOREABLE_LABELS.has(row.expectedLabelPostD5D9)) return null;
  const value = row.expectedKeys?.[field];
  if (!value || value.includes("-or-")) return null;
  return value;
}

export function buildD11Labels(corpus: D11Corpus): RefereeLabel[] {
  return corpus.rows.map((row) => ({
    id: row.id,
    split: "test",
    scene: { kind: "replay", sourceFile: row.sourceFile, round: row.round, chair: row.chair },
    refereeArms: { elisionMode: "on", containerClauseMode: "on", instrumentMode: "off", deriveWording: "baseline" },
    intentText: row.intentTested,
    expected: {
      target: keyFor(row, "target"),
      effect: keyFor(row, "effect"),
      product: null,
      property: keyFor(row, "property"),
      magnitude: null,
      perceptibility: null,
      acts: null,
    },
    citations: { target: null, effect: null, product: null, property: null, magnitude: null, perceptibility: null, acts: null },
    provenance: {
      labeller: "the-prisoner project (docs/HUMAN-INTENTS-DESIGN.md D11)",
      audited: true,
      source: `checkpoints/2026-09-26-human-intents/corpus.json#${row.id}`,
      note: `expectedLabelPostD5D9="${row.expectedLabelPostD5D9}" (see LABELS.md); only "correct"/"misread" rows carry a scoreable key, per-field, and a compound expectedKeys value ("...-or-...") is dropped even on those.`,
    },
  }));
}
