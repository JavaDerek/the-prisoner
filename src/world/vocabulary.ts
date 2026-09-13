import type { RenderVocabulary } from "run-dmcp";

/**
 * This repository's `RenderVocabulary` (design §5.1, run-dmcp's `render.ts`)
 * -- one entry per (fact key, fact value) the mechanics of `mechanics.ts`
 * can ever write, so `createStateRenderer`'s `unnamed` list stays empty for
 * every world this repository builds (the renderer's own vocabulary-
 * richness contract).
 *
 * Every entry is positive, including the "false" state of a flag
 * (`cut`="0" -> "intact", `concealed`="0" -> "in plain view") -- "say what
 * is, never what is absent" (root CLAUDE.md hard rule 3) applies to a false
 * boolean exactly as it does to anything else: an intact bar is something
 * that IS true, not the absence of a cut one. See `mechanics.ts`'s header
 * for the one fact this repository could NOT give this treatment
 * (`knows_<key>`, which must start genuinely absent) and why it is kept out
 * of the fact store entirely instead.
 *
 * Values are the TEXT SQLite's own REAL-to-TEXT cast produces for a numeric
 * column (typically "1", "0" for the INTEGER flag columns this repository's
 * migration added -- INTEGER affinity casts to a bare digit string, unlike
 * the REAL-affinity `resources.value` column's "1.0"/"0.0"). Both forms are
 * asserted against a real database in `viewFor`'s tests, never guessed.
 */
export const PRISONER_VOCABULARY: RenderVocabulary = {
  cut: {
    "0": { noun: "bar", adjectives: ["intact"] },
    "1": { noun: "bar", adjectives: ["cut"] },
  },
  concealed: {
    "0": { noun: "loose tile", adjectives: ["in plain view"] },
    "1": { noun: "loose tile", adjectives: ["concealed"] },
  },
};
