# Pre-committed before Phase 1 batch 6 ran — the SEAT comparison

Written 2026-09-24 (18:28 CDT / 23:28Z), **before the first game**, against `ebe9711` — the commit the
pinned worktree runs from. Designed from `../2026-09-24-phase1-b5/HANDOFF.md`, which supersedes
`../2026-09-24-phase1-b5/PREDICTION.md`; that file's arms are wrong and **it was not run**.

Batch 4 put a 30B in the **warden's** chair and could not be told from Opus. This batch takes Opus out
of the game entirely and moves the **prisoner's seat shape**: the same local Muse-Glimmer plays
prisoner in both arms, asked in one arm for one JSON object with eight fields and in the other for one
sentence of prose.

## Arms

| | arm **S** (schema) | arm **P** (prose) |
|---|---|---|
| prisoner's chair | `muse-glimmer-30b-q4_k_m` | `muse-glimmer-30b-q4_k_m` |
| prisoner's seat | `buildOpenSingleCallPrompt`, eight fields | `PRISONER_PROSE_SEAT=prisoner` (`src/open/proseMind.ts`) |
| warden's chair | `muse-glimmer-30b-q4_k_m` | the same |
| referee | `muse-glimmer-30b-q4_k_m`, thinking off, temp 0 | the same |

Everything else is batch 4's: ten rounds, voice ON, `PRISONER_PRESENCE=modelled`, condition list on,
one-act CHECKED, custody on, the door free and unstated, timeouts 300000 ms, N = 10 per arm, two
drivers, `run-batch.sh` unchanged, from a worktree pinned at `ebe9711`. **No Opus anywhere, in either
chair, in either arm.** Temperature is 0.9 in both seats (`mind-seam`'s `DEFAULT_TEMPERATURE`, and
`proseMind.ts`'s explicit default) — checked, not assumed.

**The one-act change is NOT landed** and `renderSeatSituation` is **NOT changed** on the third-person
finding, which is AA-only and moves Muse by noise (`../2026-09-24-prose-lab/RESULTS.md`).

## Three conditions measured against the live process, not read from a previous batch's notes

Batch 4's first launch was void because a condition was cited from `../2026-09-23-phase1-b3/SETUP.md`
instead of probed. All three below were probed at 23:20–23:26Z on 2026-09-24.

1. **`--chat-template-kwargs '{"reasoning_strength":"none"}'` is on llama-server's live command line
   AND behaves**: `ps` on doris shows the flag on pid 2213812, and the trivial probe ("Reply with the
   single word: yes") returns **33 completion tokens** direct to :11435 and **36** through the router.
   Batch 4's void launch returned 102 on the identical probe. The flag is server-wide, so all three
   chairs play with reasoning off and **no `PRISONER_*` variable in any transcript header records
   that**.
2. **The router's local route was exercised, not assumed.** `SHIM_LOCAL_URL=http://doris:11435`,
   `SHIM_LOCAL_MODELS=muse-glimmer-30b-q4_k_m`, and its own log line for the probe reads
   `"route":"local"`. `GET /api/ps` through it returns `[]`.
3. **doris's Ollama holds nothing.** Derek's `qwen3:14b` pin (6.0 GB resident, `expires_at` 2319) was
   unloaded for this batch and **must be restored after it**. `PRISONER_OLLAMA_RESIDENT_MODELS=`
   (empty) stops any game that finds a model loaded. **ComfyUI was stopped** — it is
   `comfyui.service` under systemd on doris and came back once on a bare `kill`, so it was stopped at
   the unit and **must be started again after the batch**. The card now holds Muse alone: 16.4 GB of
   24.5.

## The confound, named before the fact: every intent is graded by the weights that wrote it

Batch 4 named this for one chair. **In this batch it is true of all three, in both arms.** The
prisoner proposes, the warden proposes, and the referee that keys both is the same model at the same
temperature on the same server.

- **A grounded rate here is not evidence that anyone played well.** A referee keys an intent by
  finding a verbatim quote in it; an intent written in the grader's own idiom is the easiest possible
  row to key. The confound flatters exactly the number a reader reaches for first, and it flatters it
  in **both** arms.
- **It is symmetric in model but NOT in form.** The two arms hand the referee different *shapes* of
  text — a schema field is short and imperative, a prose answer is a sentence or several with the
  model's own preamble habits. So a grounded-rate gap between the arms is ambiguous between "she
  reached somewhere the rules do not cover" and "the referee could not key a paragraph". **Prediction
  4 below is written so that ambiguity is visible rather than resolved by assertion.**
- **There is no control chair.** The warden is not a control (`no-control-seat-in-a-two-player-game`,
  and batch 4's own §"Prediction 5 failed"). The warden's numbers are *expected* to move when the
  prisoner's seat changes, and a warden number that does not move is the surprise.

## The seat is not one variable, and this file will not pretend it is

The brief for this run says the seat is the only variable. That is true at the level of the switch and
false at the level of the prompt. `PRISONER_PROSE_SEAT=prisoner` bundles **three** changes, and only
the first is the one the seat is named for:

1. **Answer shape** — one question taken at its word, instead of eight fields pre-classified.
2. **The output-discipline block** — `CRITICAL RULES FOR YOUR OUTPUT`, a BAD example and a GOOD
   example. Arm S's prompt has none of it. It exists to replace by instruction the discipline the
   schema imposed structurally, so it cannot be removed from P without making P a different thing —
   but it is still a prompt difference and not only a shape difference.
3. **Memory** — P carries no `plan` and no `notes`, so nothing but the briefing crosses a turn. S
   carries both forward. This is the subject of prediction 7.

**And the GOOD example names the blanket's loose thread**, deliberately, because an exemplar pointing
at the escape route teaches the target along with the form. Arm S is never shown it. **So P's novel
(object, effect) pairs are partly TAUGHT**, and prediction 6b exists to measure how much.

## What is NOT predicted, and why

**Catches and escapes.** Batch 4 established they cannot separate arms at N=10: a catch fires only
when the warden's reveal lands on `spoon.edge` in a round where the edge is already ≥20, which is a
timing coincidence, and the best warden play in either batch is recorded as a plain timeout. They will
be reported. Nothing is pre-committed to them and no reading of this batch may rest on them.

**Anything against batch 3 or batch 4 absolutely.** Those batches had an Opus prisoner. This one does
not. Cross-batch numbers below are context for setting a band, never a comparison this batch can make.

**A power statement, because N=10 deserves one.** Per-*game* measures (prediction 5) have N=10 an arm
and cannot reach conventional significance below a 5-vs-0 split (Fisher exact, 4 vs 0 → p≈0.087; 5 vs
0 → p≈0.033). Per-*intent* measures have N≈100 an arm and are where this batch can actually say
something. That is why most of what follows is counted over intents.

## Predictions

### 0. Gate: arm P is playable at all

Muse has never played a full game in the prose seat — round-1 lab asks and one 3-round probe, nothing
more. **In P's first game, at least 7 of 10 prisoner turns produce a non-silent intent the referee
grades.** Below that, stop the batch and report it as a pilot. Lab evidence: Muse was 20/20 clean at
round 1 under the shipped block.

### 1. Decision silences

Muse went silent 0 times in 97 warden intents in batch 4 and 0 times in 20 lab asks.

- **S: at most 3 prisoner decision silences of ~100.**
- **P: at most 8 of ~100.** Higher band, because `coerceProposal` is the only thing standing between a
  prose reply and a silence, and no model has produced 100 of them in this seat.

### 2. The 600-character cap is a process difference, and it will show

`coerceProposal` hard-slices at 600 characters. The lab measured 5 of 20 overrunning before the
`STOP IMMEDIATELY` line existed and 2 of 20 after.

- **P: between 1 and 25 of ~100 intents reach the cap.**
- **S: 0 of ~100.** A schema field is short by construction. **If S produces any, that is a finding
  about the schema seat, not about P.**

### 3. Distinct targets and effect kinds

Muse in the warden's chair used **2** effect kinds pooled over 8 objects at 3.80 distinct targets a
game. That is the narrowest chair in any recorded batch, and it is the best available read on how wide
this model reaches anywhere.

- **S: at most 5 distinct effect kinds pooled; 2.5 to 4.5 distinct targets per game.**
- **P: at least as many distinct effect kinds pooled as S, and at least as many distinct targets per
  game.** Directional, because the seat exists to widen reach and a prose seat that reaches *less* is
  the cleanest possible refutation of the whole idea.

### 4. Grounded rate — a band for each arm, and the ambiguity kept visible

Batch 4's Muse warden was grounded on 95 of 97. The lab's Muse was 20/20 clean.

- **S: grounded on at least 92% of prisoner intents.**
- **P: grounded on 80% to 95%**, and **below S**.
- **The disambiguation, pre-committed:** if P is below S, the refusal audit (§after) must classify each
  P refusal as either *form* (the referee could not find a quote to key, the intent overran the cap, the
  reply carried preamble) or *reach* (the act is well-formed and the rules do not cover it). **If fewer
  than a third of P's excess refusals are *reach*, prediction 6's novel-pair count is reporting prose
  style, not innovation, and this file says so in advance.**

### 5. THE HEADLINE — does the prose seat damage the bar

The claim this batch exists to test, from the handoff: the prose seat took `barIntegrity` to 85 in a
3-round probe where 19 of 20 schema games left it at 100.

**Verified here before predicting on it:** across `../2026-09-23-phase1-b3/O` and
`../2026-09-24-phase1-b4/O`, final `barIntegrity` is **100 in 19 of 20 games and 92 in one** (b3's
`13-51-27-780Z`). The claim is accurate.

**What could not be verified:** the 3-round probe's transcript is **not in this repository**.
`../2026-09-24-prose-probe/` holds only a `router.log` (30 local calls, consistent with 3 rounds).
The 85 cannot be re-read, and the seat that produced it was driving an Opus-free game whose other
chairs are not recorded. **The headline rests on an N of 1 that no one can now inspect** — which is
the strongest argument for running this batch and the reason the bands below are wide.

- **P: final `barIntegrity` below 100 in at least 4 of 10 games.**
- **S: final `barIntegrity` below 100 in at most 2 of 10 games.**
- **P's mean final `barIntegrity` at most 95; S's at least 97.**
- **Stated in advance per the power note:** at 4-vs-0 this is suggestive and not significant. **Only a
  split of 5 or more against 0 is a result at this N.** A 4-vs-0 outcome will be reported as
  suggestive and nothing stronger, and the scoreboard will say so rather than discovering the caveat
  afterwards.

### 6. Novel (object, effect) pairs — the measure, pre-committed

Entropy counts distinct tool→target pairs and is diversification, not innovation (the owner,
2026-09-24). The measure is **(object, effect) pairs with no closed-variant equivalent**. The
closed-variant set is fixed **here, before the games**, from `PRISONER_MOVES` / `WARDEN_MOVES`
(`src/world/mechanics.ts`) so it cannot be drawn around whatever the games happen to produce:

| closed move | its pair(s) — NOT novel |
|---|---|
| `FILE` | (`bar`, `wear`) |
| `HONE` | (`spoon`, `wear`), (`spoon`, `restore`) |
| `SHIM` | (`lock`, `wear`), (`lock`, `restore`) |
| `CONCEAL` | (any object, `conceal`) |
| `INSPECT` | (any object, `reveal`) |
| `ESCAPE` | (`door`, `leave`), (`window`, `leave`) |
| `WAIT` | (`none`, `none`) |

**Every other (object, effect) pair the prisoner produces is novel.** Batch 4's Opus prisoner produced
`derive`, `take`, `noise`, `open` and person targets, so the measure is known to be non-empty for a
capable seat.

- **6a. P produces at least 6 distinct novel pairs pooled; S produces at most 5.** And **P ≥ S**.
- **6b. The teaching check, and it can kill 6a.** The GOOD exemplar names the blanket's loose thread
  and arm S never sees it. **P targets the `blanket` in at least 3 of 10 games; S in at most 1.**
  Novel pairs will be reported **twice — with and without every blanket-targeted intent.** **If P's
  novel-pair advantage over S does not survive dropping the blanket, 6a is the exemplar talking and
  the batch has measured a prompt, not a seat.**

### 7. Does the memoryless seat degrade over ten rounds

The owner's hypothesis: P carries no plan and no notes, so over ten rounds she may repeat herself or
re-try what already failed, because she cannot remember that it did. Over three rounds the cost is
invisible, which is why the probe could not see it.

**Re-try rate** = the share of a game's prisoner intents whose (target, effect) pair matches one that,
in an **earlier round of the same game**, was refused or produced no property change.

- **7a. P's re-try rate is at least 1.5× S's.**
- **7b. Within P alone, needing no cross-arm comparison: distinct targets in rounds 6–10 is at most
  distinct targets in rounds 1–5**, pooled across P's ten games. A seat that narrows in the second
  half is degrading; one that does not, is not.
- **7c. S's re-try rate is at most 25%.** Notes are the schema seat's whole advantage here, and if S
  re-tries as freely as P then memory is not what separates them and prediction 7a is uninterpretable
  whichever way it lands.

### 8. Refusals, pooled

Batch 4 ran 5 of 192 (2.6%) after batch 3's 8.0%. Both arms here are graded by their own weights.

- **Pooled refusals across both arms: at most 12% of rulings.**
- **P's refusal rate is at or above S's** (same reasoning as prediction 4).

### 9. New unbuilt mechanism classes

Batch 4 found **0**. A wider seat is the most likely thing yet to find one.

- **At most 3 new unbuilt classes pooled across both arms.** More than that and the scenario, not the
  seat, is what the batch measured.

### 10. Wall clock

Batch 4 ran 10 games on two drivers in ~2.1 h with an Opus prisoner costing the card nothing. Both
chairs are local here, adding the prisoner's ~10 wits calls a game to the GPU's work. llama-server
serves one slot, so total GPU work is the floor and more drivers do not help.

- **Median game under 45 minutes, none over 150.**
- **Both arms complete within 8 hours of the first game's start.**

## Stopping rules

1. **Gate (prediction 0) fails** → stop, report as a pilot, run nothing further.
2. **Any game's referee returns HTTP 500 `Context size has been exceeded`** → stop the batch and check
   the server's launch line before another game starts. This is batch 4's void-run signature and it is
   invisible in a transcript.
3. **A transcript header does not print the `PROSE SEAT (PRISONER_PROSE_SEAT=prisoner)` line in arm P,
   or does print it in arm S** → that arm did not run and is discarded. One glance at the header
   settles it; the runner's invocation does not.
4. **A driver's `ollama_ps_before` reads anything but `[none]`** → that game is quarantined. Derek's
   pin is unloaded for the batch and anything else on the card belongs to someone else.
5. **Announce any prediction the moment it is mathematically impossible**, at that check-in, with the
   scoreboard — do not wait for the batch to end.

## The scoreboard carries a projection column

Every check-in reports **so far**, **projected at N=10** (linear extrapolation from games completed),
and **dead / open**. A prediction that cannot be reached from the games remaining is announced dead at
that poll, not in the results file.

## After the batch

1. Transcripts copied unedited into `P/` and `S/`, including any killed by the watchdog.
2. `npm run measures -- checkpoints/2026-09-24-phase1-b6` — two arms, discovered by directory.
3. The refusal audit (`../2026-09-23-phase1-b3/audit.mts`).
4. **`../2026-09-24-phase1-b4/escalate.mts` on every refusal PLUS a random sample of ~30 GROUNDED
   rulings.** The grounded rulings are the ones that moved the world and **nothing has ever checked
   one**. An all-local game cannot validate its own rulings; only an outside opinion can, and it stays
   post-hoc and out of the loop permanently — a second opinion inline would need a tie-break rule,
   which is a new mechanic and not an audit. The sample is drawn with a recorded seed.
5. **Restore the machine**: Derek's `qwen3:14b` pin back into Ollama, `comfyui.service` started again.
