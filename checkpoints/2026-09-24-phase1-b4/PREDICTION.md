# Pre-committed before Phase 1 batch 4 ran (OPUS-FIRST-DESIGN §4.1)

Written 2026-09-24, **before the first game**, against `79386c7` — the commit the pinned worktree runs from, and
the commit that made this batch expressible at all (`PRISONER_WARDEN_MODEL`, `src/modelRoles.ts`).

Batch 3 put a local 30B in the **referee's** chair and the direction error went away. This batch puts the same
model, resident on the same card, in the **warden's** chair. One variable moves: the prisoner stays
`claude-opus-4-6`, the referee stays Muse-Glimmer, the scenario, the rounds, the arms and the driver are batch 3's.

**Why the warden's chair and not the prisoner's.** Across batch 3 the warden used **4 distinct effect kinds**
(`expose`, `give`, `reveal`, `take`) over **8 objects**, at 1.30 distinct effects per game. The prisoner used
**11 kinds** over **9 objects**, at 4.40 per game. The warden's is much the narrower space, and a narrow space is
where a small model has the best chance of being indistinguishable from a large one. If a 30B cannot hold this
seat, it cannot hold either.

## Arms

Everything is batch 3's except the warden's chair:

- **Prisoner: `claude-opus-4-6`**, pinned by id (D1), through the model router.
- **Warden: `muse-glimmer-30b-q4_k_m`**, the same llama-server on doris:11435 that serves the referee.
- **Referee: the same**, `PRISONER_REFEREE_THINKING=off`, temperature 0.
- Ten rounds (D3); voice ON; `PRISONER_PRESENCE=modelled`; one-act CHECKED; custody on; the door free and
  unstated; timeouts 300000 ms; N = 10, two drivers side by side, from a worktree pinned at `79386c7`.
- **The one-act change is NOT landed.** It is committed and parked (`../2026-09-23-oneact-lab/`, `2d10f33`)
  precisely so this batch moves one variable.

**Both chairs are single-call, as batch 3's both were.** A seat whose wits and voice models are equal collapses
to `createOpenMind`'s one call (`src/open/mind.ts`), so the Muse warden costs the card ten calls a game and not
twenty, and its structure is batch 3's structure. This batch adds roughly 27% to the GPU's work, not 100%.

### Three conditions this file states because a header will not

1. **The warden inherits the referee's thinking setting, and neither variable says so.**
   `reasoning_strength: "none"` is set on llama-server's command line (`../2026-09-23-phase1-b3/SETUP.md`), which
   is server-wide: every request to :11435 gets it, the warden's wits call included. The warden is therefore
   playing with reasoning off, and no `PRISONER_*` variable in the transcript header records that. It is also the
   only safe setting available — at `high` this model overruns the token cap and returns EMPTY, which a reader
   takes silently as the default.
2. **`PRISONER_WARDEN_MODEL` is one commit old.** Its byte-identity to batch 3 when unset is checked by
   `src/__tests__/modelRoles.test.ts` against recorded headers, and by a zero-round run whose line 9 came back
   identical to `O/2026-09-23T13-51-27-780Z.md`. The transcript header will print a line per chair. If it prints
   a single `Wits model:` line, **the batch did not run the arm it says it did** and must be discarded.
3. **doris's Ollama held `qwen3:4b`** (loaded 2026-09-23T16:58Z by something that is not this project, idle 6.5
   hours) and it was unloaded, with the owner's decision, before the first game — so `ollama_ps_before` reads
   `none`, as batch 3's did. The owner's `qwen3:14b` pin is restored when batch 5 finishes, not this one.

## The oddity, named before the fact: the referee is grading intents partly written by itself

Half of every round's intents now come out of the same weights that rule on them. This has no precedent in any
recorded batch and it cuts in a direction nothing here can measure:

- The warden's intents are now **in the referee's own distribution** — its phrasing, its vocabulary, its habits
  of construction. A referee keys an intent by finding a verbatim quote in it, so an intent written in the
  grader's own idiom is the easiest possible row to key.
- **So a high warden grounded rate in this batch is not evidence that the warden played well.** It is
  confounded by construction, and the confound flatters exactly the number a reader would reach for first.

The prisoner's chair is the control, and it is the only within-batch comparison worth anything here: the
prisoner is the same Opus model as batch 3, ruled by the same referee, so a move in **prisoner** grounded rate
is the batch's own noise and a move in **warden** grounded rate is the warden's chair plus this confound,
inseparably. Predictions 4 and 5 are written to be read that way and no other.

## Predictions

Baselines are batch 3's, `../2026-09-23-phase1-b3/RESULTS.md` and `MEASURES.md`, ten games under an Opus warden.

0. **The gate, on game 1 alone, before the other nine are trusted.** The Muse warden produces a usable
   proposal on **at least 7 of its 10 turns** in the first completed game — a parsed intent, not a decision
   silence. Batch 3's Opus warden was silent **0 times in 96**. **Fewer than 5 and the batch does not run**:
   that is a gate on the instrument, not a prediction about the world, and a warden that cannot speak is not
   a warden playing badly, it is no experiment at all.
1. **Warden decision silences: at most 10 of ~100** turns across the batch (batch 3: 0 of 96).
2. **The warden's space narrows, and this is the batch's central claim.** Pooled across ten games the Muse
   warden uses **at most 4 distinct effect kinds** and **at most 7 distinct objects** (batch 3: 4 and 8), and
   its distinct targets per game fall to **at most 4.5** (batch 3: 5.20). A smaller model in a narrow seat
   should repeat itself more, not less.
3. **Catches fall: 0 to 2 of 10** (batch 3: 2 — rounds 7 and 10). Condition 5 wants `edge >= 20` AND
   `suspicion >= 40`; suspicion is raised by a warden who watches the right thing, so a weaker warden should
   reach it less often. **Escapes rise or hold: 1 to 5** (batch 3: 1). The prisoner is unchanged, so an escape
   here is the warden's failure and not the prisoner's improvement.
4. **Warden refusals: at most 12 of ~100** rulings (batch 3: 5 of 96, 5.2%). Read against the confound above —
   at most 12 is a weak prediction on purpose, because the mechanism that would raise it (a worse warden
   attempting worse-specified things) and the mechanism that would lower it (a referee keying its own idiom)
   push opposite ways and this batch cannot separate them.
5. **The prisoner's own numbers do not move**, which is what makes 2, 3 and 4 readable: prisoner grounded rate
   within **5 points** of batch 3's 89% (81 of 91), prisoner distinct effect kinds **at least 9** pooled
   (batch 3: 11), prisoner decision silences at most 8 (batch 3: 3). **If this prediction fails, 2 through 4 are
   uninterpretable and the batch is a pilot, not a measurement.**
6. **Misruled, by the owner's labels, over the refusals of BOTH chairs: at most 1 in 3.** Batch 3 failed this at
   6 of 15 = 0.40, five of the six being one failure — an effect named and its property dropped or wrong. Nothing
   has been built to fix that, so this is a prediction that the warden's chair does not make it worse, not that
   anything cured it.
7. **Wall clock: median game under 60 minutes, no game over 150.** Batch 3's games ran ~37 minutes with two
   drivers and the referee alone on the card; ten warden calls a game is about 27% more work for the same
   llama-server, which serves one slot and queues.
8. **Newly discovered unbuilt classes: at most 2**, and **at most 1 of them found by the warden** (batch 3: at
   most 1 in total, found by the warden — "throw the blanket over her head to blind and tangle her").

**Scoreboard convention** (the owner's, 2026-09-22): every check-in prints so-far, **projected at N=10** by
linear extrapolation, and dead/open — and the moment a pre-committed number is mathematically impossible, it is
announced at that poll and the stopping rule applied, not at the end.

**Stopping rule.** A game whose referee, warden or router hangs past 30 minutes on a single call is quarantined,
as batch 1's O:4 was. **A game still running 150 minutes after it started is quarantined** — raised from batch
3's 90, because the card now serves the warden as well as the referee and 90 would fire on healthy games; the
driver's own watchdog kills a game silent for 30 minutes so a hang cannot take the rest of the run with it.
Prediction 0's gate is checked on the first completed game before the batch is allowed to continue.

## What this batch cannot settle, whatever it shows

- **Whether a small model can play the PRISONER.** The seats are not symmetric: 11 effect kinds against 4, and
  the prisoner is the seat that has to invent. This batch is evidence about the narrow chair only.
- **Whether the warden played well.** See the oddity above. The honest headline available from this batch is
  "the warden's chair was filled locally, and here is what changed", never "a 30B is as good a warden".
- **Model versus thinking.** The Opus warden ran with wits thinking off, the Muse warden runs with
  `reasoning_strength: "none"` — the nearest available match, not the same knob, and the two are not
  demonstrably equivalent (§68.1's finding that thinking moves rulings was measured on `qwen3:14b` and transfers
  nowhere on its own evidence).
- **Batch 5 answers the question this one does not ask.** Muse-Glimmer in both chairs and the referee, everything
  else identical, costs no Opus at all and says whether the game runs entirely on the 4090. It gets its own
  PREDICTION.md, written before its own first game.
