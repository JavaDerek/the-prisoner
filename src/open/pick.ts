/**
 * mother-of-invention#1's "pick" half, driven here first (OPEN-VARIANT.md
 * §21), in that package's own words so it can move there as a file: nothing
 * in this module names this game.
 *
 * Listing alternatives changed nothing about what a mind chose (§20.2), and
 * a stated cost changed nothing either (§11.4). So on a forced turn a choice
 * the observer has already seen is replaced by the first candidate that is
 * neither seen nor unavailable, in the mind's own order. Free turns are left
 * exactly as the mind chose, and never consult the recogniser, so they stay
 * comparable to a game without pick.
 *
 * Whether a candidate is seen is a judgement about what its text means, so
 * this module never makes it: the caller injects `recognise`. The choice
 * itself is always one of the mind's own texts -- code picks among them,
 * never writes one.
 */

export type Verdict = "seen" | "unseen" | "unavailable";

export type Recognise<C> = (candidate: C) => Verdict | Promise<Verdict>;

export interface Picked<C> {
  readonly chosen: C;
  readonly forced: boolean;
  /** Whether `chosen` is not the mind's own choice. */
  readonly overridden: boolean;
  /** Every candidate's verdict, in order; empty on a free turn. */
  readonly verdicts: readonly { readonly candidate: C; readonly verdict: Verdict }[];
}

export async function pick<C>(own: C, candidates: readonly C[], options: { force: boolean; recognise: Recognise<C> }): Promise<Picked<C>> {
  if (!options.force) return { chosen: own, forced: false, overridden: false, verdicts: [] };

  const ownVerdict = await options.recognise(own);
  const verdicts: { candidate: C; verdict: Verdict }[] = [];
  // One at a time: a recogniser may be a model call that must never overlap another.
  for (const candidate of candidates) verdicts.push({ candidate, verdict: await options.recognise(candidate) });

  if (ownVerdict === "unseen") return { chosen: own, forced: true, overridden: false, verdicts };
  const unseen = verdicts.find((v) => v.verdict === "unseen");
  if (!unseen) return { chosen: own, forced: true, overridden: false, verdicts };
  return { chosen: unseen.candidate, forced: true, overridden: unseen.candidate !== own, verdicts };
}
