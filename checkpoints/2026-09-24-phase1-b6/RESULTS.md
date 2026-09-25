# Batch 6 — the SEAT comparison. **N = 7 per arm against a pre-registered 10.**

Written 2026-09-25 (04:50Z / 23:50 CDT on the 24th) against `PREDICTION.md` beside this file, which was
committed before the first game. Fourteen games: seven in `P/` (the prose seat) and seven in `S/` (the
eight-field schema seat), one local Muse-Glimmer-30B in every chair of both arms, **no Opus anywhere in
either game**. Two games were abandoned and are in `abandoned/`, not counted.

**The batch stopped at seven a side, not ten, and every count below is therefore three games short of what
was promised.** It stopped because the card was wanted for the night's next piece of work, not because
anything went wrong in the games. The scoreboard's projection column extrapolates to N=10 where a
prediction is a count; where a prediction is a rate, seven games is what there is. `PREDICTION.md`'s own
power note already said that at this N a 4-vs-0 split is suggestive and nothing stronger, and that caveat
now applies to more of this file than it was written for.

## The headline is refuted, and refuted in the *opposite direction*

Prediction 5 existed to test one claim: the prose seat took `barIntegrity` to 85 in an unrecoverable
3-round probe where 19 of 20 schema games left it at 100. Final `barIntegrity`, per game:

| | game floors | damaged (<100) | mean |
|---|---|---|---|
| **P (prose)** | 100, 100, 100, **92, 92, 92, 92** | 4 of 7 | **95.43** |
| **S (schema)** | 100, 100, 100, **84, 76, 68, 59** | 4 of 7 | **83.86** |

Both arms damaged the bar in **four of seven games**. But **P never once got past a single wear step** —
every damaged P game ends at exactly 92, the first increment and no further — while S compounded, four
times, down to 59. The prose seat did not damage the bar more than the schema seat. It damaged it
*shallower*, and the arm that was supposed to be the flat baseline is the one that dug.

So the claim the batch was built to test is not merely unsupported; the comparison runs the other way, and
`PREDICTION.md` was right to warn that the 85 rested on an N of 1 that nobody can now inspect. **What the
prose seat buys is not depth.** It buys width (4.29 distinct targets a game against 3.14) and compliance
(2.9% refusals against 14.7%), and it pays for them with a floor it never breaks through.

This is the finding the strategy step designed in `../../docs/STRATEGY-DESIGN.md` is aimed at, and it is
why that design's band 3 is written as *depth, per committed target*: P's problem is not reach, it is that
nothing makes it stay on one object long enough to get past the first 8 points.

## Every pre-committed prediction, scored

`held` / `failed` are against the band as written. A band stated at N=10 and read at N=7 is marked.

| | prediction | result | verdict |
|---|---|---|---|
| **0** | gate: P's first game grades ≥ 7 of 10 prisoner turns | game 1 (`23-35-40-526Z`): 20 pooled intents, **0 silences** — all 10 prisoner turns graded | **held** |
| **1** | P silences ≤ 8 of ~100; S ≤ 3 | P **1** pooled over 7 games, S **2** (per chair: P prisoner 0, S prisoner 2) | **held**, both |
| **2** | P 1–25 intents at the 600-char cap; S exactly 0 | P **0**, S **0** | **failed** for P (0 is below the band), held for S |
| **3** | S ≤ 5 distinct effect kinds pooled, 2.5–4.5 targets/game; P ≥ S on both | S **8** effect kinds (band ≤5), 3.14 targets ✓; P 8 effects, 4.29 targets | **S's effect-kind band failed**; P ≥ S held |
| **4** | S grounded ≥ 92% of prisoner intents; P 80–95% **and below S** | S **85.3%** (58/68), P **92.9%** (65/70) | **failed both ways** — S missed its floor and P is *above* S, not below |
| **5** | P bar <100 in ≥4 of 10; S in ≤2 of 10; P mean ≤95, S mean ≥97 | P 4 of 7 ✓; S **4 of 7** (**DEAD**, announced at the 7-game poll); P mean **95.43** (band ≤95, missed by 0.43); S mean **83.86** (band ≥97) | **failed**, three of four parts |
| **6a** | P ≥ 6 distinct novel pairs, S ≤ 5, **and P ≥ S** | P **8**, S **9** (**DEAD**, announced) — so P < S | **failed** on S's ceiling and on P ≥ S |
| **6b** | P targets `blanket` in ≥3 of 10 games; S in ≤1 | P **0**, S **0** | **failed** for P, held for S. Novel pairs with the blanket dropped are **identical** (8 / 9), so 6a's outcome is not the exemplar talking — but it is not P's advantage either, because P has none |
| **7a** | P's re-try rate ≥ 1.5× S's | P **1.4%**, S **0.0%** | technically held and **uninterpretable**: 1.5 × 0 is 0, so any P value clears it. See below |
| **7b** | P distinct targets rounds 6–10 ≤ rounds 1–5 | **6 (r1–5) vs 9 (r6–10)** | **failed** — P *widens* in the second half; the memoryless seat does not narrow |
| **7c** | S's re-try rate ≤ 25% | **0.0%** | **held** |
| **8** | pooled refusals ≤ 12% of rulings; P's rate ≥ S's | pooled **22 of 277 = 7.9%** ✓; P **3.6%** vs S **12.3%** | ceiling held; **P ≥ S failed** |
| **9** | ≤ 3 new unbuilt mechanism classes pooled | **0** | **held** |
| **10** | median game < 45 min, none > 150; both arms inside 8 h | medians **P 20 / S 22 min**; first game 23:35Z, last ended ~02:10Z | **held** |

**Prediction 7 did not measure what it was for, and that is worth more than its verdict.** The owner's
hypothesis was that a seat with no plan and no notes re-tries what already failed. Both arms re-tried
almost nothing (1.4% and 0.0%), and P *widened* in rounds 6–10 rather than narrowing. The instrument that
did move is a different one the batch added mid-flight: the **repeat rate** — any re-use of an (object,
effect) pair, whether or not it failed first — which is **P 41.4% / S 50.0%**. Memory is not what separates
these seats, and 7a is retired rather than carried forward.

## The referee, not the seat, is the largest effect in this batch

All three chairs are one model, so **every intent was graded by the weights that wrote it** and no number
of games fixes that. `PREDICTION.md` §after step 4 required an outside opinion, and it is the most
consequential thing here.

**Refusals escalated to `claude-opus-4-6`, all 22 of them** (`refusal-escalation.csv`):

| | count |
|---|---|
| **RESOLVED by the stronger reader** — the local referee dropped a ruling a better one makes | **14 of 22 (64%)** |
| still refused — unbuilt, or correctly refused | 8 of 22 |

And the 14 are not scattered. They are **two repeating mistakes**:

- **`reveal` named with its property dropped** — `loose_tile/reveal/none` → `loose_tile/reveal/concealment`,
  six times, plus `spoon/conceal/none` → `spoon/conceal/concealment`. The referee names the effect and then
  answers `none` to the property question that makes it resolve.
- **the effect dropped on a bodily or object-less intent** — `none/none/none` → `none/noise/none`,
  `prisoner/none/none` → `prisoner/noise/none`, `cot/none/none` → `prisoner/wear/posture` (twice).

So roughly **half the refusals in this batch are the property question failing**, which joins the target
question already named as the bottleneck (`prisoner-night-2026-09-19-20`, four probes). A batch whose
refusal rate differs between arms — P 3.6%, S 12.3% — is partly measuring which arm's prose happens to
survive a reader with two known blind spots. **Prediction 4's disambiguation clause should be read in that
light**: it asked whether P's *excess* refusals were form or reach, and the answer is that P had no excess;
S did.

## Three instruments disagreed about the same number, and each disagreement is recorded

None of these changed a verdict in this batch. All three would, in a batch shaped slightly differently.

1. **"Distinct targets per game."** `SCOREBOARD.md` says P 4.29 / S 3.14; `MEASURES.md`'s per-chair table
   says the prisoner chair alone is P 3.71 / S 2.86. Two different quantities under one name. The
   pre-committed band (prediction 3) is the scoreboard's, and anything comparing to it must say so.
2. **"Prisoner silences."** The scoreboard reads each transcript's `Total intents: N. Silences: M.` line,
   which is **pooled over both chairs** (every game shows 20 intents = 10 rounds × 2 chairs), and labels
   the result "prisoner silences". `MEASURES.md` splits it properly: P's single silence is the **warden's**,
   not the prisoner's. Prediction 1 is stated about the prisoner and was scored on a pooled line. It holds
   under either reading here only because the numbers are 1 and 2.
3. **The thinking switch is a no-op on this server** (filed as `../../docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md`).
   Measured twice, 03:22Z and 04:00Z: `chat_template_kwargs: {"reasoning_strength": …}` moves completion
   tokens 33 → 51 → 60 → 109 across `none`/`low`/`medium`/`high`, while **`reasoning_effort: "high"` gives
   33 — the same as `none`**. `src/open/thinking.ts`'s `withThinking` sends `reasoning_effort`. Every
   `Thinking (wits): OFF` header line in batches 3 through 6 is **true because of llama-server's own
   command line**, not because of the variable that claims it. The batches are not wrong; the stated reason
   is. Given that thinking is already known to change the referee's rulings
   (`prisoner-thinking-changes-rulings`), a future run against a server started without that flag would
   print the identical header line while the model reasoned freely.

## The 91% is a reading of meaning, and the byte floor is 18%

`STRATEGY-DESIGN-BRIEF.md`'s table — 62 of 68 turns chose "#1, its own first-written option" — was checked
against the seven S transcripts by the only rule code may apply, byte identity (the same rule moi's ledger
and §20.1's duplicate collapse use):

| | prisoner (68 turns) | warden (70 turns) |
|---|---|---|
| intent **byte-identical** to candidate #1 | **12 (18%)** | 21 (30%) |
| identical to #2 | 0 | 0 |
| identical to #3 or later | 1 | 0 |
| no byte match to any candidate | 55 | 49 |

91% is "the intent **refines** candidate #1" as a person reads it, and the prompt invites exactly that
("may match one of your candidates above, or refine one"). It is the right number and **it cannot be the
machine-checked endpoint of anything**: no code can be asked to decide whether one text refines another
without judging meaning. The strategy design answers this by never comparing text to text — selection is
*declared* (an index, counted as given) and adherence is *keyed* (the referee's own `target`).

**18% is what code can report, and it belongs beside the 91% wherever the 91% appears.**

## Machine state, and what is not in git

Seven P and seven S transcripts plus their `.referee.json` sidecars are committed, byte-identical to
`/tmp/b6-worktree` (`diff -r` silent at copy time). The driver and router logs came across to `logs/` and
`abandoned/` but **are not tracked** — `*.log` is gitignored, as it was for batches 3 through 5 — so the
evidence git holds is the transcripts and the referee JSON.

## What this batch says to do next

1. **Depth is the open question, not reach.** P reaches wide and stops at the first wear step; S digs. A
   mechanism that makes a wide seat *stay* is the thing worth building, which is what the strategy step is.
2. **Fix the referee's property question before running another arm on refusal rates.** Two-thirds of this
   batch's refusals are the referee, not the game, and the pattern is narrow enough to be a prompt change
   rather than a model change.
3. **Retire prediction 7's re-try rate** and carry the repeat rate instead. The first measured 1.4% and
   0.0% and separated nothing; the second is 41.4% against 50.0%.
4. **Do not pool "distinct targets per game" across instruments** without naming which one.
