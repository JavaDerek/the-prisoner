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

export type Judged<C> = { readonly candidate: C; readonly verdict: Verdict };

/** Asked for fresh candidates when none of the mind's own is unseen, and told
 *  every verdict so far. The caller decides how to ask (it is usually the same
 *  mind, told what is already known); this module only chooses among answers. */
export type Regenerate<C> = (verdicts: readonly Judged<C>[]) => Promise<readonly C[]>;

export interface Picked<C> {
  readonly chosen: C;
  readonly forced: boolean;
  /** Whether `chosen` is not the mind's own choice. */
  readonly overridden: boolean;
  /** Every candidate's verdict, in order; empty on a free turn. */
  readonly verdicts: readonly Judged<C>[];
  /** Present only when fresh candidates were asked for: each new one's verdict, in order. */
  readonly regenerated?: readonly Judged<C>[];
}

async function judge<C>(texts: readonly C[], recognise: Recognise<C>, already: readonly Judged<C>[] = []): Promise<Judged<C>[]> {
  const judged: Judged<C>[] = [];
  // One at a time: a recogniser may be a model call that must never overlap another.
  for (const candidate of texts) {
    if (already.some((j) => j.candidate === candidate) || judged.some((j) => j.candidate === candidate)) continue;
    judged.push({ candidate, verdict: await recognise(candidate) });
  }
  return judged;
}

export async function pick<C>(
  own: C,
  candidates: readonly C[],
  options: { force: boolean; recognise: Recognise<C>; regenerate?: Regenerate<C> }
): Promise<Picked<C>> {
  if (!options.force) return { chosen: own, forced: false, overridden: false, verdicts: [] };

  const ownVerdict = await options.recognise(own);
  const verdicts: Judged<C>[] = [];
  for (const candidate of candidates) verdicts.push({ candidate, verdict: await options.recognise(candidate) });

  if (ownVerdict === "unseen") return { chosen: own, forced: true, overridden: false, verdicts };
  const unseen = verdicts.find((v) => v.verdict === "unseen");
  if (unseen) return { chosen: unseen.candidate, forced: true, overridden: unseen.candidate !== own, verdicts };
  if (!options.regenerate) return { chosen: own, forced: true, overridden: false, verdicts };

  // OPEN-VARIANT.md §36: nothing unseen to force to was the usual case (§32.1),
  // because the candidates were rewordings of one idea. Ask once more, told why.
  const known = [...(verdicts.some((v) => v.candidate === own) ? [] : [{ candidate: own, verdict: ownVerdict }]), ...verdicts];
  const regenerated = await judge(await options.regenerate(verdicts), options.recognise, known);
  const fresh = regenerated.find((v) => v.verdict === "unseen");
  if (!fresh) return { chosen: own, forced: true, overridden: false, verdicts, regenerated };
  return { chosen: fresh.candidate, forced: true, overridden: fresh.candidate !== own, verdicts, regenerated };
}
