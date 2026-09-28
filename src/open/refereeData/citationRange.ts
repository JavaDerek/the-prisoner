import { sourceWords } from "run-dmcp";

/**
 * Resolves a hand-authored `quote` into the word range `run-dmcp`'s own
 * `sourceWords` would number it as -- used only at LABEL-AUTHORING time
 * (`seedS3316.ts`), so the checked-in labels file carries both a
 * human-legible quote AND the "source id + word range" the issue's own
 * schema asks for, without this module reimplementing `sourceWords`' own
 * word-splitting rule (a word is a maximal run of non-whitespace):
 * `sourceWords` IS that rule, called here, never copied.
 *
 * Returns `null` when `quote` is not a contiguous run of `sourceText`'s own
 * words (a typo, or a quote that crosses a word boundary `sourceWords`
 * would not draw) -- the caller decides what to do with that (this
 * repository's own labels never ship an unresolved range).
 */
export function quoteToRange(sourceText: string, quote: string): { from: number; to: number } | null {
  const sourceTokens = sourceWords(sourceText);
  const quoteTokens = sourceWords(quote);
  if (quoteTokens.length === 0) return null;
  for (let start = 0; start + quoteTokens.length <= sourceTokens.length; start++) {
    let matches = true;
    for (let i = 0; i < quoteTokens.length; i++) {
      if (sourceTokens[start + i].word !== quoteTokens[i].word) {
        matches = false;
        break;
      }
    }
    if (matches) return { from: sourceTokens[start].index, to: sourceTokens[start + quoteTokens.length - 1].index };
  }
  return null;
}
