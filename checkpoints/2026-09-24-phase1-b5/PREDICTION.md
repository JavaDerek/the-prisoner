# Pre-committed before Phase 1 batch 5 ran (OPUS-FIRST-DESIGN §4.1)

Written 2026-09-24, **before the first game**, against `1496183`. Not yet run: the owner's call, so that the
arrangement below and the one open measurement are settled before any game starts.

Batch 4 put a local 30B in the warden's chair and found it indistinguishable from Opus. This batch puts a local
model in the **prisoner's** chair -- the seat that has to invent -- and asks which of two very different local
models plays it better. **No Opus anywhere.** If it works, the game runs entirely on the owner's 4090.

## What changed since batch 4, and why this is not that batch's comparison

Two things, and the prediction must not be read as though only one moved:

1. **The seat.** The prisoner is a PROSE seat (`src/open/proseMind.ts`, `PRISONER_PROSE_SEAT=prisoner`): asked
   one question -- "What do you try this turn?" -- and taken at its word, with no plan, no notes and no spoken
   line. Every earlier batch asked for one JSON object with eight fields. `humanSeat.ts` made this change for a
   person and recorded why: a fixed field order "forced the player to pre-classify their own action before the
   referee ever saw any of it."
2. **The model.** Arm A is `ancient-awakening:12b-ctx4k`; arm M is `muse-glimmer-30b-q4_k_m`.

So **neither arm is comparable to batch 4 on plan or notes measures** (this seat produces none), and a
difference against batch 4's Opus prisoner is seat-plus-model, never model alone. The arms ARE comparable to
each other: same seat, same prompt, same warden, same referee, same scenario.

## Arms

| | arm A | arm M |
|---|---|---|
| prisoner | `ancient-awakening:12b-ctx4k`, prose seat | `muse-glimmer-30b-q4_k_m`, prose seat |
| warden | `muse-glimmer-30b-q4_k_m`, schema seat (batch 4's, unchanged) | same |
| referee | `muse-glimmer-30b-q4_k_m`, thinking off, temperature 0 | same |

Ten rounds, N = 10 per arm, presence modelled, one-act CHECKED, custody on, door free and unstated, timeouts
300000 ms, two drivers, from a worktree pinned at the commit this file lands in. The one-act change stays
parked.

**Serving:** Muse on llama-server (doris:11435) with `--chat-template-kwargs '{"reasoning_strength":"none"}'` --
**check the live process, not this file** (batch 4's `SETUP.md` records what that cost). Ancient Awakening in
Ollama as a `num_ctx 4096` variant, because the stock model's runtime footprint is 13.8 GB against Muse's 16.4
on a 24.5 GB card and the two cannot co-reside; the variant is 8.4 GB and spills ~2 GB to CPU. Both are hidden
from `/api/ps` via `SHIM_HIDE_MODELS`, because two servers each holding a model permanently is not what the
one-model-at-a-time swapper is for, and its unload is a no-op through the router anyway. ComfyUI is stopped.

## The asymmetry, named before the fact

**Arm M is the more confounded arm, not the less.** In arm M the prisoner, the warden and the referee are the
same weights, so every intent in the game is graded by the model that wrote it. In arm A the prisoner's intents
come from a different model, and only the warden's are self-graded. Batch 4 named this confound when it applied
to half the intents; in arm M it applies to all of them. **A higher grounded rate in arm M is therefore expected
for a reason that has nothing to do with playing better**, and must not be reported as arm M playing better.

## The one measurement that must happen BEFORE the batch

The lab numbers below for Muse were taken under the seat's OLD prompt, before the owner's output-discipline
block landed (`1496183`). Arm M's baseline is therefore not comparable to arm A's until Muse is re-measured
under the shipped prompt, 20 asks of the identical round-1 scene.

**Prediction -1: Muse under the shipped prompt scores 18-20 of 20 clean and 1 to 4 distinct approaches**, i.e.
the block does not change what Muse was already doing. If Muse's entropy rises above 1.6 bits under the new
block, the block itself is a novelty intervention and not merely an output-discipline one -- which would be a
larger finding than this batch, and the batch waits.

## What the lab already established (20 asks each, identical round-1 scene)

| | clean | distinct approaches | entropy | modal approach |
|---|---|---|---|---|
| AA, seat's old prompt | 9/20 (45%) | 8 | 2.60 bits | spoon->bar 7/20 |
| **AA, shipped prompt** | **16/20 (80%)** | **8** | **2.52 bits** | hands->bar 8/20 |
| AA, neutral exemplar | 17/20 (85%) | 8 | 2.52 bits | hands->bar 8/20 |
| Muse, seat's old prompt | 20/20 (100%) | **3** | **0.99 bits** | spoon->bar 15/20 |

The exemplar teaches FORM, not target: changing the good example's object moved neither the clean rate nor the
approach distribution by a single count.

## Predictions

0. **The gate, on the first completed game of arm A.** The AA prisoner produces a parsed intent on **at least 6
   of its 10 turns**. Below 4 and arm A does not run -- a prisoner that cannot propose is not a prisoner playing
   badly. (Lab: 80% clean; in-game briefings are longer and carry news, so some fall-off is expected.)
1. **Arm A reaches wider than arm M.** Pooled over ten games, arm A's prisoner shows **at least 6 distinct
   approaches** against arm M's **at most 4**, and arm A's approach entropy is **at least 0.8 bits higher**.
   This is the batch's central claim and it is the lab's finding carried into play.
2. **Arm M is the more reliable one.** Arm M's prisoner decision silences are **at most 3 of ~100**; arm A's are
   **8 to 30**. Arm A's refusals are **higher than arm M's**, by at least 4 rulings.
3. **Both damage the bar, and that is new.** `barIntegrity` ends below 100 in **at least 5 of 10 games in each
   arm**. Batch 3 and batch 4's schema-seat Opus prisoner left it at 100 in **19 of 20 games**; the 3-round prose
   probes took it to 85 in both models. If this fails in BOTH arms the prose seat's apparent advantage was a
   3-round artifact and should be reported as one.
4. **Arm A's intents are longer and hit the cap.** Median prisoner intent **over 250 characters in arm A**,
   **under 250 in arm M**, and arm A has **at least 3 intents sliced at the 600-character cap** against at most 1
   in arm M.
5. **Warden behaviour does not move between arms**, which is what makes 1 to 4 readable: warden distinct effect
   kinds within 1 of each other, warden `reveal spoon.edge` share within 8 points, warden decision silences 0 in
   both. **If the warden's own numbers differ between arms, the arms differ by more than the prisoner's chair and
   1 to 4 are uninterpretable.** (Batch 4's prediction 5 made this mistake about the PRISONER, who plays against
   the warden and must move; the warden here faces the same scenario and a differently-behaving opponent, so this
   is weaker than it looks and is stated as a diagnostic, not a gate.)
6. **Outcomes are reported and carry no weight.** Catches, escapes and timeouts are recorded per arm and **no
   prediction is made about them**. Batch 4 established why: a catch fires only when the warden's own reveal lands
   on `spoon.edge` in a round where the edge is already >= 20 -- a timing coincidence -- and escapes run through the
   free unstated door, which is prisoner-side route discovery no warden can prevent. At N = 10 with those base
   rates neither column can separate the arms.
7. **Wall clock: median game under 45 minutes, none over 150.** Arm A's calls are short; arm M's prisoner adds a
   second Muse call per round to a card already serving the warden and the referee.
8. **Newly discovered unbuilt classes: at most 3 across both arms**, and arm A finds at least as many as arm M.
   The lab showed AA reaching for the cot's wire, the blanket as an abrasive and a fingernail under the tile --
   props no recorded batch has targeted.

**Scoreboard convention** (the owner's): every check-in prints so-far, **projected at N = 10** by linear
extrapolation, and dead/open -- and the moment a pre-committed number is mathematically impossible it is
announced at that poll, not at the end. Note that a pooled distinct-approach count saturates and does not
extrapolate linearly; that row prints so-far and a floor, never a fake projection.

**Stopping rule.** A game whose referee, prisoner or router hangs past 30 minutes on a single call is
quarantined. A game still running 150 minutes after it started is quarantined. The driver's watchdog kills a game
silent for 30 minutes so a hang cannot take the rest of the run with it. Prediction 0's gate is checked on the
first completed game of arm A before the rest is allowed to continue.

## What this batch cannot settle

- **Seat versus model.** Arm M differs from batch 4's prisoner in both, so a prose-seat advantage cannot be
  separated from a model difference here. The arm that would separate it -- Muse in the SCHEMA seat as prisoner --
  is not run, because the question this batch asks is which local model plays the prose seat better.
- **Whether reaching wider is worth anything.** Entropy is not escape. If arm A reaches wider and still never
  gets out, that is a finding about the scenario's difficulty, not about the model.
- **Whether the referee is right.** Every ruling in arm M is self-graded and most of arm A's are. The refusal
  escalation to Opus (`../2026-09-24-phase1-b4/escalate.mts`) is the only outside check, and it sees only the
  refusals.
