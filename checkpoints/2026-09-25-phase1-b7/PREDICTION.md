# Pre-committed before Phase 1 batch 7 ran — the STRATEGY step

Written 2026-09-25 (00:06 CDT / 05:06Z), **before the first game**, from `docs/STRATEGY-DESIGN.md` §5.1.
The baselines marked *compute* in that document are computed here, from b6's own seven P games, **before
the bands were finalised** — and two of them moved a band. Where a number here differs from §5.1's, this
file wins and says why, which is §6 step 4's own instruction: keep the margin, move the number, say so
before a game runs.

## The arm

**One arm, T** = b6's arm P (the prose seat) **plus `PRISONER_STRATEGY=fixed`**. Everything else is b6's
byte for byte: ten rounds, voice on, `PRISONER_PRESENCE=modelled`, the condition list on, custody on, the
door free and unstated, one local `muse-glimmer-30b-q4_k_m` in every chair, referee thinking off, 300000 ms
timeouts. **No Opus in either chair.** N up to 7, and the results file says N in its first line.

The baseline is **b6's arm P at `ebe9711`**; arm T runs at a later pin whose only source difference is an
**off-by-default module** (`9535d50`). That is a cross-batch comparison and this file says so in those
words. The byte-identity guard (`src/open/__tests__/strategy.test.ts`, first `describe`) is what makes the
pooling defensible rather than hopeful: with `PRISONER_STRATEGY` unset the briefing is byte-identical, not
merely missing a line.

**The strategy step, as it will run:** two calls before round 1, against the prisoner's round-1 seat.
OPTIONS at `chat_template_kwargs: {"reasoning_strength":"none"}`; COMMIT at `"high"`. The transcript header
prints the option list, the chosen index, the sentence, the declared ids, **the wire field and the
strength**, both calls' completion tokens, and **both raw replies in full**.

## What step 1's probe already established, and what it costs this batch

`../2026-09-25-strategy-probe/RESULTS.md`, 30 asks against the identical seat:

- **P0.a 20 of 20 valid, P0.b 0 empty.** The step is well-formed. This is why there is a batch at all.
- **The choice is indistinguishable from uniform** — identity χ²=8.70 (p=0.19), position χ²=10.10 (p=0.12)
  over seven options — at `high` *and* at `none`, while `high` costs 9.7× the tokens. So **this batch is
  purely a conviction test**: not "did deliberation choose well" but "does a line the mind committed to get
  followed". Band 1 is the whole batch.
- **P0.e failed (10 of 20).** Half the step's choices name no object whose threshold `conditions.ts` states.
  **Band 3 is therefore pre-registered expecting to fail**, and its denominator is expected to be small.

## The bands

| # | measure | band | baseline, computed here |
|---|---|---|---|
| **1 (primary)** | **adherence**: share of graded prisoner turns whose ruling `target` is one of the strategy's declared ids, refused turns in the denominator | **≥ 60%**, *and* **≥ 15 points above P's modal-target share** → the binding threshold is **≥ 60.7%** | **P's modal-target share = 45.7%** (per game: 50, 60, 40, 30, 40, 70, 30). **D6's escape does not fire** — it required ≥ 60%. For the record, **S's is 64.4%**, so on the schema seat this endpoint could not have separated anything |
| **2** | distinct targets per game | between **2.0 and 3.5**; ≥ 4.29 means the line was not read | **P 4.29 / S 3.14 — the SCOREBOARD's pooled column**, which is what §5.1 quoted. `npm run measures` calls the prisoner chair's own figure 3.71. Two quantities, one name; this band is the scoreboard's and every comparison must say so |
| **3** | depth of damage | **≥ 2 of 7** games end `barIntegrity` ≤ 84, **among games whose strategy ids include the bar** | **P's floor is 92 in all four of its damaged games** (100, 92, 92, 100, 100, 92, 92) — one wear step, never a second. **Expected to FAIL** on P0.e. The denominator is reported per game and never pooled over strategies that never named the bar; if it is 0 or 1 the band is reported as unfalsifiable at this N rather than as passed |
| **4** | wasted games (no property change on any condition-listed object all game) | ~~≤ 1 of 7~~ **RETIRED — reported as a count, no band** | §5.1 assumed "S had 1 of 7". **It is 0 of 7 on BOTH arms.** P touches a condition-listed object's property in every one of its seven games. The failure this band exists to detect does not occur in the baseline, so a ceiling of 1 cannot fail informatively — reporting it as a band would manufacture a pass. The count is still reported |
| **5** | prisoner refusals | **≤ 8%** | **P 2.9%** — "turns with no keys", 2 of 70, the scoreboard's own definition and the one §3.3 was reading. Above 8% means the line costs compliance and D5 was wrong |
| **6** | **repeat rate** (any re-use of an (object, effect) pair) | **< 41.4%**, band **≤ 30%** | §5.1 called 41.4% the "re-try rate". **It is the REPEAT rate**; b6 separated the two mid-batch (`47e3514`) and P's actual **re-try rate is 1.4%**, S's 0.0%. A "≤ 30%" band against 1.4% would have been unfalsifiable in the wrong direction, so the band is re-based onto the measure that has range. The re-try rate is still reported, with no band |
| **7** | novel (object, effect) pairs, `CLOSED_EQUIVALENTS` | **reported, no band** | P 8 / S 9 in b6. Commitment is expected to *reduce* novelty; a design promising both would be lying |
| **8** | strategy-call health | both calls succeed in **≥ 6 of 7** games; commit call **under 5 minutes** | probe mean 125 s, max ~150 s at `high`. **The router's own per-attempt cap is 150 s by default and is raised to 400 s for this batch** (`SHIM_DORIS_ATTEMPT_TIMEOUT_MS`), because otherwise the instrument, not the band, decides this row |
| **9** | wall clock | median game < 45 min; none > 90 | b6 P median 20 min. The step adds ~140 s a game |

**Not predicted:** escapes and catches. Reported, weightless (b4's finding, and the brief's rule).

## The reading grid, carried from §5.1 with the probe's answer filled in

The probe landed in the **"same favourites at `none` and `high`"** row — not because the favourites were
shown identical, but because **neither strength's choice departs from uniform** while `high` costs 9.7×.

| | band 1 passes (≥ 60.7%) | band 1 fails |
|---|---|---|
| **where this batch sits** | **conviction is cheap**: the line is read, and `high` bought nothing the choice shows. **Next arm: strategy at `none`** — if it adheres as well, the step is a fast-path operation and should cost 13 s, not 125 s | the step is fast-path *and* nothing reaches for the line. Nothing further to buy from thinking here; the question moves to the turn call, not the strategy call. This would be §57 and `minds-decline-new-affordances` again, and it is the honest result |

## Gate, and stopping rules

**Gate**: game 1's header must print the strategy block with a valid id. If the step returns null in game 1,
**stop the batch and treat it as a pilot** — and **read the raw replies in the transcript before doing
anything else**, which is why the header prints both of them in full. A *technical* failure (an object is
there and the coercion missed it, a wrong field name, an id with different casing) gets a **15-minute
repair budget**: fix, test, re-pin, restart game 1, **once**. A *substantive* failure (no strategy in the
raw text, an overrun, a timeout) stops the batch.

**Carried from b6 verbatim:**

1. `Context size has been exceeded` on any call **stops the batch** and the server's launch line is checked
   before another game starts. Do not restart the server.
2. A header that does not print `Strategy: ON` in arm T → **that game is discarded**.
3. `ollama_ps_before` reading anything but `[none]` → **that game is quarantined**.
4. **A prediction is announced DEAD the poll it becomes arithmetically impossible**, with the scoreboard's
   so-far / projected-at-7 / dead-or-open columns — at that poll, never in the results file.
5. No game starts after **08:40Z (03:40 CDT)**. Fewer than 4 games by then → reported as a **pilot**, not a
   batch.

## Power, stated in advance

The per-game bands (2, 3, 9) at N=7 are **suggestive at best**. The per-intent bands (1, 5, 6) have ~70
rows and are where this batch can actually speak. Band 1 is the primary and is the only row this batch is
really for.
