# The falsifier probe — answered. **The build survives; the design's claim about deliberation does not.**

2026-09-25, asks run 04:20–05:04Z (23:20–00:04 CDT). Pre-registered in `PREDICTION.md` beside this file
and committed before the first call; `probe.mts` is the script as run, `replies-main.jsonl` every ask with
its raw `content` and `reasoning_content`, `situation-main.txt` the 4557 characters the model read.

**One OPTIONS call fixed seven options.** Then 20 COMMIT asks at
`chat_template_kwargs: {"reasoning_strength":"high"}` and 10 at `"none"`, each showing the list in a
different seeded order (mulberry32, seed 20260925) with every option keeping its own number. The situation
is the prisoner's **round-1 seat built from `buildOpenWorld` + `seedInitialBeliefs` + `buildOpenContext` +
`renderSeatSituation`** — b6's P arm byte for byte, never a recorded request.

## The headline: at N=20, the choice is indistinguishable from chance

| | counts (options 1–7) | χ² vs uniform | df | p |
|---|---|---|---|---|
| **identity chosen, `high`** | 2, 4, 6, 1, 0, 4, 3 | 8.70 | 6 | **0.19** |
| **position chosen, `high`** | 6, 1, 4, 4, 4, 1, 0 | 10.10 | 6 | **0.12** |
| identity chosen, `none` | 2, 3, 1, 3, 0, 0, 1 | 6.80 | 6 | 0.34 |
| position chosen, `none` | 1, 0, 2, 2, 2, 1, 2 | 2.60 | 6 | 0.86 |

**Neither pre-named reading of P0.c fits.** Reading (i) wanted identity-concentrated *and* position-spread;
reading (ii) wanted position-1 ≥ 14 of 20. What happened is neither: the modal option takes 6 of 20 (30%,
against 14% for a coin), position 1 takes 6 of 20, and **nothing departs from uniform at any conventional
threshold**. The probe cannot distinguish this commit call from a model picking at random among the seven
things it had just written down.

That is a finding the prediction did not have a box for, and it is stated here rather than rounded into the
nearest box. It also does **not** kill the build, exactly as `PREDICTION.md` said: the only kill was
validity, and validity is perfect.

## The bands, scored

| | band | result | verdict |
|---|---|---|---|
| **P0.a** | valid JSON, in-range `chosen`, ≥1 valid id: **≥16 of 20** at `high` | **20 of 20** | **passed** — no `medium` fallback needed, no kill |
| **P0.b** | empty or context-overrun replies: **≤2 of 20** | **0** (after the transport fix below) | **passed** |
| **P0.c** | position-1 share, two readings pre-named | **6 of 20**, and uniform on both axes (above) | **reported; neither reading applies.** Batch 7 becomes the conviction test, which is reading (ii)'s consequence arriving by a different route |
| **P0.d** | `high` vs `none` by identity | modal option 3 at `high` (6/20) against 2 and 4 at `none` (3/10 each) — but **both distributions are uniform**, so the question has no answer at this N. Cost: **6043 tokens / 125 s** at `high` against **626 / 12.8 s** at `none` — **9.7× the tokens, 9.8× the wall clock** | **reported.** Effectively §1.3's toy result again: thinking buys cost, and nothing in the choice shows what it bought |
| **P0.e** | chosen ids are condition-listed (`bar`, `lock`, `spoon`, `door`, `window`): **≥12 of 20** | **10 of 20** | **failed.** Per §5.0: the step selects but **not toward the game** — build anyway, and say in advance that the batch will likely show **adherence without depth** |
| **P0.f** | if the bar took ≥14 of 20, it takes ≤4 of 10 with the window welded | the bar option took **2 of 20** by identity and the bar was a declared target in **5 of 20** | **skipped, and says so.** The trope did not dominate, so there is no genre prior to discriminate against. Ten GPU-minutes not spent |

Sentences over the 200-character cap: **0 of 30**. Every reply's object was naked JSON in `content`; the
chatter trap did not fire once, as §1.3 measured.

## What it chose, and the thing worth noticing

The seven options, numbered by the one OPTIONS call:

| n | option | picked (`high`) | picked (`none`) |
|---|---|---|---|
| 1 | scrape and pry at the rusted bar where it is set into the mortar | 2 | 2 |
| 2 | lift and remove the loose tile to reach the hollow beneath | 4 | 3 |
| 3 | unravel the loose thread on the blanket's frayed hem | **6** | 1 |
| 4 | bend the spoon by hand into a makeshift pick | 1 | 3 |
| 5 | use the wire holding the cot springs as a lock pick | **0** | **0** |
| 6 | strike the tin slop bucket to make a distraction | 4 | 0 |
| 7 | scrape earth from beneath the tile to loosen the mortar around the bar | 3 | 1 |

Declared targets, pooled over the 20 `high` asks: `loose_tile` 7, `spoon` 6, `blanket` 6, `bar` 5,
`bucket` 4.

**Its modal choice is the blanket, and b6's fourteen games targeted the blanket exactly zero times.** That
is the same object b6's prediction 6b was built around — the GOOD exemplar names the blanket's loose
thread, and the batch found P targeting it in 0 of 7 games and S in 0 of 7. So this step, asked once
before the game with nothing in front of it but the same situation, reaches for the one thing ten rounds of
play never reach for. Whatever else is true, **the commit call is not reproducing what the seat does
unprompted** — which is the first reason to think a strategy line could move a game at all, and it arrived
from the direction the design did not expect.

The other half of it is P0.e failing: 10 of 20 asks named no object whose threshold `conditions.ts` states.
The step is choosing things that are *sayable* about the room rather than things the room can be *opened*
by. Band 3 of batch 7 (depth) is pre-registered expecting exactly that, in `../2026-09-25-phase1-b7/PREDICTION.md`.

## One transport fix, and it is a design finding too

The first three asks went through the router on 8799. The third came back empty at 300.023 s with a 502:
`local produced no reply in 2 attempts of 150000ms each` — `modelRouter.ts`'s
`DEFAULT_DORIS_ATTEMPT_TIMEOUT_MS`, 150 s, overridable by `SHIM_DORIS_ATTEMPT_TIMEOUT_MS` and unset on the
router in use. A `high` commit call on the real seat averages **125 s** and reached **150 s** on this
sample, so it sits astride that ceiling.

An instrument ceiling counted as P0.b would have been a "context overrun" that was nothing of the kind, so
the asks were re-run **direct against doris:11435**, which §1.1 and b6's own `PREDICTION.md` both measured
as byte-identical on the local route (33 tokens direct, 36 through the router on the trivial probe). **The
same seven options were reused, not re-drawn** (`--reuse-options`), so §5.0's one-options-call rule holds
and only the transport moved. The three router-era asks are kept as `replies-router-attempt.jsonl` and are
not in any tally above.

**This also affects play, not just probing**: batch 7's games go through the router, and §5.1's band 8
budgets five minutes for this call. The 150 s default is the thing out of step with the design, so the
router is restarted with `SHIM_DORIS_ATTEMPT_TIMEOUT_MS=400000` before game 1, and the morning report says
so.

## What this does to the design

1. **Build: yes, and it is built** (`9535d50`). The only pre-registered kill was validity and it passed 20
   of 20.
2. **The reading grid's top-left cell is the live one.** §5.1 named four cells; the one this probe lands in
   is "same favourites at `none` and `high`" — not because the favourites were shown to be the same, but
   because neither strength's choice is distinguishable from uniform while `high` costs 9.7× the tokens. If
   batch 7's band 1 passes, **the next arm is strategy at `none`**, and the step should cost 13 s rather
   than 125 s.
3. **`high` may be indefensible per-game cost.** Two calls a game, one of them 125 s, against a ~20-minute
   game is affordable; 125 s buying nothing measurable in the *choice* is a different claim, and the only
   thing left that `high` could be buying is conviction. Batch 7 measures conviction and nothing else.
4. **D7's "cheapest falsifier" was answered, and it answered a narrower question than it looked.** 20 asks
   and about 45 GPU-minutes established that the call is *well-formed* and that its choice carries no
   detectable signal. It could never have established that the line gets read, and that was always band 1's
   job.
