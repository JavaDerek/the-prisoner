# P6 -- results (run 2026-09-28 03:32-05:35 UTC, `c2118e8` clean, one driver, Shep quiet)

Pre-registered in `PREDICTION.md` (committed `c2118e8` before the first call, `--with-at-band`, `--omit=prisoner:2`).
204 rulings, 0 errors, median 31.8 s per ruling (with its one-act call). The card held `muse-glimmer:30b` alone
(Ollama 0.34.4+pr18687); the owner had given the session exclusive use of it, so no Shep traffic.
`probe.mts --score`, verbatim headline:

| id | prediction | result | verdict |
|---|---|---|---|
| 1 | rows whose target or effect changes: 0 | 1 of 22 | **DEAD** |
| 2 | rows whose property (only) changes: at most 2 | 2 of 22 | MET |
| KILL | 3 or more rows change target or effect | 1 of 22 | **not fired** |
| 1b | at the 40 band: 0 change target or effect | 1 of 12 | **DEAD** |
| 2b | at the 40 band: at most 2 change property only | 0 of 12 | MET |
| r2 | climb-outs ruled `leave` under D9 (reported) | 10 of 10 | -- |

## What moved

One item, both bands: **B7-P33** "work the spoon against the bar again" -- pre-D9 `bar/open/integrity` (2 of 3;
sample 1 was `wear`), D9 `bar/wear/integrity` (3 of 3, and 3 of 3 at the 40 band). The one change runs from the
wrong effect to the right one: "work the spoon against the bar" is wear, and D7a already made the `open` reading
wear the bar by the same amount. The two property-only changes are climb-outs (`D1-r9`, `G27-P10`) swapping
`passage`/`none` on a `leave`, which no mechanic reads.

## What it means, as PREDICTION.md said before the run

The kill did not fire: **D9's bands and window line are safe for the referee** and D9 stands. Prediction 1 is dead
by one row, so this is the "2 holds, 1 fails narrowly" case. That row went the right way, and its pre-D9 majority
was itself 2-1 (see below).

## The finding that was not asked: the first call of a request differs from its repeats

7 of the 68 (arm, item) cells gave different keys across their three serial, byte-identical samples, and **in all 7
it is sample 1 that differs while samples 2 and 3 agree** (`pre-D9` B7-P33, P31, P29; `D9` D1-r9, D3-r23, G27-P10,
B7-P29@40). Sample 1 of an item always follows a request for a *different* item. Samples 2 and 3 repeat a request sent
seconds earlier, with only that ruling's short one-act call in between; the runner has two slots (`-np 2`), so
its prompt is plausibly still cached. This is inferred from the pattern: the probe did not record cache hits. The simplest reading is that a cold prompt and a
prefix-cached prompt do not produce bit-identical logits on this runtime, and near a decision boundary the ruling
flips. OPEN-VARIANT §75's "the identical request run alone is bit-reproducible" was measured on llama-server. On
Ollama it holds only for an identical cache state.

Two consequences, both for method rather than for D9:
- **In a game every ruling is a "sample 1"** (a new intent, never an immediate repeat). A majority-of-3 on this
  runtime is weighted toward the cached condition a game never sees. Every N=3 probe since the move to Ollama
  (2026-09-26) shares this; the P1-P7 kit does too. Scoring sample 1 alone is the game-faithful reading.
- B7-P33's own pre-D9 "open" majority is 2 cached samples against 1 cold `wear`. Read cold, the item did not move.
  Prediction 1 is dead as scored, and would have been met on sample 1 alone. This is reported, not re-scored:
  the pre-registered rule is the majority.

This bears on the-prisoner#35 (P7 measures the same prefix cache for time) and on #33 (below).

## For the-prisoner#33 part (1)

#33's playtest saw "dig at the bars with the spoon" ruled wear, wear, then open on the round the bar's first
band appeared. P6 finds that the bands move 1 of 12 differing texts, from open to wear, not from wear to open. It
also finds wear/open flips on byte-identical requests with no text change at all, from the cache state alone.
The playtest's round-3 flip is therefore better explained as the known wear/open boundary instability (§78,
I25-6/I25-7) than as the band text. D7a makes it mechanically harmless: a refused `open` still wears the bar. The
merged #33 part (2) now makes the opening sentence name the way out, so the player is no longer told
"opening the bar".
