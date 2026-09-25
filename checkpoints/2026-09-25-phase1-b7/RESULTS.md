# Batch 7 — the STRATEGY step. **N = 7 of 7. The primary endpoint failed, and the batch found why.**

Written 2026-09-25 07:40Z (02:40 CDT). Arm T = b6's prose seat + `PRISONER_STRATEGY=fixed`, seven games,
one local `muse-glimmer-30b-q4_k_m` in every chair, run from the pinned worktree at `bf606c8`.
`PREDICTION.md` beside this file was committed before game 1; `SCOREBOARD.md` is the instrument that
announced each death at the poll it happened.

**This is a cross-batch comparison.** The baseline is b6's arm P at `ebe9711`; arm T runs at a later pin
whose only source difference is an off-by-default module, guarded by a byte-identity test.

## The result in one line

The step works mechanically and **does not do what it was built to do**. Every substantive band failed.
The two that held are the health bands — that the calls succeed, and that games finish on time.

| band | result | verdict |
|---|---|---|
| **1 (primary)** adherence ≥ 60.7% | **51.4%** (36 of 70) | **DEAD** |
| 2 distinct targets/game in 2.0–3.5 | **4.29** | **DEAD** |
| 3 depth: ≥ 2 of 7 bar-strategy games ≤ 84 | 0 of **1** | **unfalsifiable** — only one game named the bar |
| 4 wasted games *(retired pre-batch to a count)* | **4 of 7** | against b6's **0 of 7** on both arms |
| 5 refusals (turns with no keys) ≤ 8% | **12.9%** (9 of 70) | **DEAD** |
| 6a repeat rate ≤ 30% | **42.6%** | **DEAD** |
| 6b repeat rate < P's 41.4% | **42.6%** | **DEAD** |
| 7 novel (object, effect) pairs | 18 | reported, no band |
| **8** both calls succeed ≥ 6 of 7 | **7 of 7** | **held** |
| **9** median game < 45 min, none > 90 | median 19, max 20 | **held** |

Escapes 0 of 7, catches 0 of 7 — reported, weightless, as the brief requires.
**Revision would have fired: never, in all seven games.** The trigger (three consecutive stalled turns) was
evaluated on every prisoner turn and never once reached. That is the number a decision to build revision
needed, and it says: do not build it. Under this arm a committed strategy does not stall in the way §3.5
imagined; it wanders.

## The single most telling number

**Band 2 came out at 4.29 distinct targets per game. b6's arm P was 4.29.** Identical, to the digit.

The whole premise of D2 and D3 was that *commitment narrows reach* — §5.1 wrote the band as "commitment
narrows reach; ≥ 4.29 means the line was not read." Arm T landed exactly on the baseline. Whatever the
strategy line did, it did not change how widely the prisoner ranged over the cell.

## What the seven strategies actually were

| game | declared ids | sentence | adherence |
|---|---|---|---|
| 1 | `blanket` | "Unravel blanket thread into cordage to silently fish the warden's keys and unlock the door for escape." | 50% |
| 2 | `blanket`, `key_ring` | "Quietly use blanket thread to snag Croft's key ring for a silent chance at the door." | 40% |
| 3 | `door`, `lock` | "Assess the door gap and bolt edge to find a quiet way to manipulate the lock from inside." | 60% |
| 4 | `bar`, `spoon` | "Weaken the window bar with the spoon to drop integrity below 50 so the window can be opened for escape" | 70% |
| 5 | `blanket` | "Harvest loose fibers from blanket to craft muffling cordage for quieter future work." | 50% |
| 6 | `blanket` | "Quietly unravel the blanket's loose thread to create a cord for manipulating the bar without raising suspicion." | 80% |
| 7 | **`warden`** | "Observe Warden Croft closely to gauge current suspicion level and timing before making any noisy or visible changes." | **10%** |

**Five of seven strategies named the blanket or the key ring.** Neither is condition-listed. In b6, across
fourteen games and ~138 prisoner turns, the blanket was targeted **zero** times. The probe (P0.e, 10 of 20)
predicted this frequency; the batch priced it.

## Three concrete defects, in order of how fixable they are

### 1. A principal is a legal strategy target, and a strategy about a person is nearly unplayable

Game 7 declared `warden`. That passed `coerceStrategy` because membership is checked against
`context.perceivedObjects`, and under `PRISONER_PRESENCE=modelled` the principals **are** in that list
(the probe's own situation carried 13 ids, two of them `warden` and `prisoner`). The game that followed:

```
r1  warden/noise      possible      r6  prisoner/wear/posture  possible
r2  warden/reveal     IMPOSSIBLE    r7  prisoner/wear/posture  possible
r3  none              IMPOSSIBLE    r8  none                   IMPOSSIBLE
r4  loose_tile/reveal possible      r9  none                   IMPOSSIBLE
r5  none              IMPOSSIBLE    r10 bar/open/integrity     possible
```

**Five of ten turns carried no keys at all** — more than the other six games put together (4). One game
supplied 5 of the batch's 9 unkeyed turns and is most of why band 5 died.

**Fix**: `coerceStrategy` should reject principal ids, or the caller should pass only non-principal ids as
the membership set. This is a two-line change and the clearest action item in this file. It is a **caller**
fix, not a `strategy.ts` fix — the module is deliberately generic and must not learn what a "principal" is;
`checkpoint.ts` already knows.

### 2. Adherence is measured against the strategy's *materials*, not its *product*

Four of seven games derived an object — the cordage the blanket strategies exist to make. Game 1 made four
strips, game 5 five, game 6 seven. §3.4 keys adherence on the declared ids, and a derived object carries a
new id (`strip`, `strip_2`, …), so **every turn spent using the thing the strategy was for scores as
off-strategy.**

Re-keying a derived object to the parent it was made from, over the same committed transcripts:

| | adherence |
|---|---|
| **pre-registered (strict)** | **55.7%** |
| derived counts as its parent (post-hoc) | **77.1%** |

**The pre-registered number is the result and 51.4%/55.7% is what this batch reports.** The 77.1% is a
sensitivity analysis computed after seeing the data, it is labelled as such, and it does not change any
verdict above. But a 21-point artefact in the primary endpoint is not a rounding detail: **band 1 fails at
either number, and would have passed comfortably under the re-key.** The next arm must decide this
*before* it runs, not after.

### 3. Two instruments disagree about the primary endpoint, again

`SCOREBOARD.md` says **36 of 70 (51.4%)**; `batchMeasures.adherenceByGame` says **39 of 70 (55.7%)**. They
count "a graded prisoner turn" differently — the scoreboard from the transcript's ruled-possible /
ruled-impossible summary sections (b6's parser, copied byte for byte so band 5's baseline population would
match), `adherenceByGame` from the per-round ruling tables. **Both agree band 1 fails**, and the 21-point
re-key delta above is computed within one instrument so it is internally consistent. But this is the fourth
such disagreement in two batches (b6's results file lists three), and it is now a pattern worth a fix
rather than a footnote: **one function should own "the population of graded prisoner turns" and every
measure should call it.**

## What the reading grid says

§5.1 pre-named four cells. The probe put this batch in the "same favourites at `none` and `high`" row —
neither strength's choice departed from uniform. Band 1 failed. That is the bottom-left cell, and it reads:

> the step is fast-path *and* nothing reaches for the line: generation is cheap and unread. Nothing further
> to buy from thinking here; the question moves to the turn call, not the strategy call.

**With one qualification the grid could not anticipate.** Adherence was 51.4% against P's modal-target
share of 45.7% — **+5.7 points**. The line is not *unread*; it moved behaviour by about six points, far
short of the fifteen the band required. And game 6 reached 80%, so the mechanism is capable of much more
than its mean. The honest statement is not "nothing reaches for the line" but **"the line is read, and what
it says is usually not worth following"** — because five of seven strategies pointed at objects the world
does not price, and one pointed at a person.

That distinction matters for what happens next. "Unread" would send the work to the turn call, as the grid
says. "Read but badly aimed" sends it to **what the step is choosing between** — which is the options call,
the scenario, and the condition list, not the commit call and not thinking.

## Against `minds-decline-new-affordances`

The standing lesson is: build it, but measure whether anything reaches for it. This batch is the cleanest
instance yet, and it cuts both ways. **Something did reach for it** — 51.4% versus a 45.7% baseline, the
line rendered in all 70 prisoner briefings, both calls succeeding in 7 of 7 games. The affordance was not
declined. It was used, faithfully, to pursue things that could not be done.

## What to do next, in order

1. **Reject principal ids as strategy targets** (defect 1). Two lines in `checkpoint.ts`. Game 7 is the
   whole argument.
2. **Decide the derived-object re-key before the next arm runs** (defect 2), and pre-register whichever
   choice is made. It is worth 21 points on the primary endpoint.
3. **Give the step something worth committing to.** Five of seven strategies named unpriced objects. That
   is not a defect of the step; it is the world being thin where the step is asked to look. This is
   `world-elaboration-vision`'s thesis arriving from a new direction: the minds were not the problem.
4. **Do not build revision** (§3.5). Its trigger never fired in 70 turns.
5. **Do not buy a strength arm.** `high` cost 9.7× the tokens for a choice indistinguishable from uniform
   (step 1), and the batch it produced failed its primary band. If the step is run again, run it at `none`
   and spend the difference on games.
6. **One owner for "graded prisoner turns"** (defect 3).
