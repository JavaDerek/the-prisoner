# Pre-committed before Phase 1 batch 3 ran (OPUS-FIRST-DESIGN §4.1)

Written 2026-09-23, **before the first game**, against `e930425`. This is the first batch played under a referee other
than a 14B local model: `../2026-09-22-referee-capacity/RESULTS-SWEEP.md` found `meta-models/Muse-Glimmer-30B` scoring
**36 of 43** on the benchmark drawn from batches 1 and 2's misruled rows (Sonnet 42, Opus 41, `qwen3:14b` 21) at a size
that fits the owner's 4090, Apache-2.0, with an official GGUF. **Every number in that sweep is replay.** Nothing there
has played a game, and a benchmark built from rows a weaker referee got wrong is exactly the instrument most likely to
flatter the model that fixes them. This batch is the live test.

## Arms

`claude-opus-4-6` both chairs, pinned by id (D1); ten rounds (D3); voice ON (§4.1: these transcripts are meant to be
read); `PRISONER_PRESENCE=modelled`; one-act CHECKED; custody on; the door free; timeouts 300000 ms; N = 10, two drivers
side by side, through the model router, from a worktree pinned at the commit this file lands in.

**Referee: `hf.co/meta-models/Muse-Glimmer-30B-GGUF:Q4_K_M` on doris, `PRISONER_REFEREE_THINKING=off`, temperature 0.**

**Two things move at once, and this file says so before the fact.** Batch 2's referee was `qwen3:14b` with thinking ON;
this one changes the model *and* the thinking knob. That is not carelessness: OFF is the arm Muse-Glimmer was measured
in (36/43, ~780 tokens, ~6 s hosted), ON cost four times the tokens for the same score on the five-row set, and at
~35 tok/s on a 4090 the ON arm would put a ten-round game out of reach of a night. §68.1's finding that thinking changes
the referee's rulings was measured **on qwen3:14b** and does not transfer; that it might is a reason to report this
batch as "referee replaced", never as a controlled A/B on the model alone.

**A second difference from the sweep:** that sweep called Muse-Glimmer at BF16 through DeepInfra. This batch runs a
Q4_K_M quantisation on consumer hardware. Prediction 0 measures that gap before any game is played.

## Predictions

0. **The quantisation holds.** Q4_K_M on doris scores **33 to 39 of 43** main rows and **20 to 22 of 22** one-act rows
   on the identical instrument (hosted BF16: 36 and 22), N = 1, thinking off. **Below 30 and the batch does not run on
   it** -- that is a gate on the instrument, not a prediction about the world.
1. **Refusals: at most 18 of ~200** rulings (batch 2: 13 of 120, a pace of 22). A referee that keys more rows right
   should trip the applicability gate less often.
2. **Misruled, by the owner's labels: at most 1 refusal in 3** (batch 2: 9 of 13, 0.69). This is the batch's central
   claim: that the sweep's 36/43 is about the referee and not about the benchmark.
3. **Sharpening is ruled `restore` on `edge`** in at least half the games where the prisoner attempts it (batch 2: 0 of
   4 -- every sharpening was ruled `wear`, which *lowers* the edge it was meant to raise), and **the spoon's edge ends
   above 0 in at least 4 of 10 games** (batch 2: 0 of 6).
4. **Catches: at least 1 of 10** (batch 2: 0 of 6, batch 1: 2 of 10). Condition 5 wants edge >= 20 with suspicion >= 40;
   if 3 holds, it is reachable in play for the first time.
5. **Escapes: 1 to 5.** The door is still free and still unstated in her conditions (batch 2: 2 of 6).
6. **Referee latency: median main call under 45 s**, against ~6 s hosted. At most **2 games quarantined** for a hang
   (stopping rule below).
7. **Newly discovered unbuilt classes: at most 2.**

## The citation waiver, measured where it can bind

`../2026-09-22-citation-waiver/RESULTS.md` predicted 21 -> 25 for `qwen3:14b`, got 21 -> 21, and reverted the change. Its
own post-mortem named the reason and the condition for revisiting it: *"a gate that refuses CORRECT rulings can only help
a referee that produces correct keys"*. Muse-Glimmer is that referee, so the waiver is re-measured here, on two
instruments, and the change is re-implemented test-first exactly as before (objects only; §55's rule that a person's
property is still held to her own description is preserved).

8. **The benchmark is the wrong instrument and this predicts its ceiling.** On the 43 rows, extending the waiver moves
   Muse-Glimmer by **at most +2**. The sweep found exactly one row (`b1#13`) keyed right and refused by this gate, so
   there is almost nothing there for the change to win, whatever its merit.
9. **The live batch is the right one.** Every ruling this batch records is recomputed under both gates from the recorded
   replies -- a gate change cannot alter what the model said, so any movement is the gate's, and no model call is repeated.
   The waiver **converts at least 3 refusals** across the batch, and **at most 1 in 3 of the rulings it converts is one
   the owner labels wrong**.

**Ship rule for the waiver:** 9 holds and the suite stays green. 8 is a prediction about the instrument, not a gate: the
waiver does not ship or fail on the benchmark's number either way.

**Stopping rule:** a game whose referee or router hangs past 30 minutes on a single ruling is quarantined, as batch 1's
O:4 was. A game still running 90 minutes after it started is quarantined too -- new here, because a local 30B referee is
slower than a hosted one and the old rule cannot tell slow from stuck.

**doris:** `qwen3:14b` was found resident (the owner's pin) and is unloaded for this batch, which needs the whole card
for a 16.8 GB model, then restored at the end -- the standing procedure, recorded here so the transcripts' "no models
loaded" headers have somewhere to point.
