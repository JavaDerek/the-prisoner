# Phase 1 batch 4 -- results: a 30B in the warden's chair, and it is hard to tell

Prediction `PREDICTION.md`, committed before the first game (`eaff32e`). Serving arrangement and the
void first launch in `SETUP.md`, committed before the games that count. Ten games, ten rounds,
**`claude-opus-4-6` prisoner against a `muse-glimmer-30b-q4_k_m` warden**, referee the same local
Muse-Glimmer, voice ON, presence modelled, two drivers, from a worktree pinned at `eaff32e`.
Transcripts unedited in `O/`, the void run in `discarded/`, measures in `MEASURES.md`, the refusal
audit in `refusal-audit.csv` and its escalation in `refusal-escalation.csv`.

**All ten transcripts read `Code revision: eaff32e (clean)`** -- the first batch in this repository
ever to name a single clean revision. Batch 3's all said "PLUS UNCOMMITTED CHANGES" and its RESULTS
had to argue the point by hand; `b487d18` fixed that and this batch is the evidence it works.

**The headline: on almost everything that can be counted, the 30B warden is indistinguishable from
the Opus warden it replaced.** Same catches, same rate of looking at the one object that can end the
game, the same suspicion, no silences at all. Where it differs is in *how* it plays, not how well:
half the effect kinds, and it never once acts on the other person in the room.

## Scoreboard

| # | pre-committed | result | verdict |
|---|---|---|---|
| 0 | gate: warden usable on >=7 of 10 turns in game 1 | **10 of 10**, 0 silences | **PASSED** |
| 1 | warden decision silences at most 10 of ~100 | **0 of 97** | **held** |
| 2a | warden at most 4 distinct effect kinds pooled | **2** (`conceal`, `reveal`) | **held** |
| 2b | warden at most 7 distinct objects pooled | **8** | **FAILED** |
| 2c | warden at most 4.5 distinct targets per game | **3.80** | **held** |
| 3a | catches 0 to 2 | **2** | **held** |
| 3b | escapes 1 to 5 | **3** | **held** |
| 4 | warden refusals at most 12 of ~100 | **2 of 97** | **held** |
| 5 | prisoner grounded 84-94%; >=9 effect kinds; <=8 silences | **96.8%; 8; 0** | **FAILED** (2 of 3) |
| 6 | misruled at most 1 refusal in 3, both chairs | awaiting the owner's labels | open |
| 7 | median game under 60 min, none over 150 | **30.5 min, max 32** | **held** |
| 8 | new unbuilt classes at most 2, at most 1 by the warden | **0, and 0 by the warden** | **held** |

Outcomes: **5 timeouts, 3 escapes, 2 catches**, against batch 3's 7 / 1 / 2. Refusals **5 of 192
rulings (2.6%)**, against batch 3's 15 of 187 (8.0%). **Zero decision silences in 192 intents.**

## Prediction 5 failed, and its consequence clause was set aside -- deliberately, and after the fact

Prediction 5 said the prisoner's own numbers would not move, and added: *"If this prediction fails, 2
through 4 are uninterpretable and the batch is a pilot, not a measurement."* It failed on two of
three clauses -- grounded 96.8% against a 84-94% band, 8 effect kinds against a floor of 9.

**The consequence clause was not applied.** The owner's call, 2026-09-24, on this reasoning: the
prediction treated the prisoner as an independent control, and **in a two-player game there is no
within-batch control seat**. She plays *against* the warden. A warden using two effect kinds and
never targeting a person applies less varied pressure, so a prisoner settling into a narrower and
more reliable repertoire is a **consequence of the manipulation, not a confound to it**.

This is recorded rather than quietly fixed because the reasoning arrived *after* the numbers, which
is the exact move pre-commitment exists to prevent. `PREDICTION.md` is unedited. A reader who wants
the strict reading -- batch 4 as a pilot -- has everything needed to take it. The lesson carried
forward is that the control for a seat change is **another batch**, never the other chair, and that a
batch-voiding consequence clause should never be attached to a premise that has not itself been
tested.

## What the two wardens actually did

| | batch 3, Opus warden | batch 4, Muse warden |
|---|---|---|
| resolutions | 91 | 95 |
| `reveal spoon.edge` -- the only check that can catch | 21 (**23%**) | 24 (**25%**) |
| final warden suspicion, mean | 53.1 | **57.0** |
| suspicion >= 40 | 7 of 10 | **7 of 10** |
| catches | 2 | **2** |
| decision silences | 0 of 96 | **0 of 97** |
| refusals | 5 of 96 | **2 of 97** |
| distinct effect kinds | 4 (`expose`, `give`, `reveal`, `take`) | **2** (`conceal`, `reveal`) |
| distinct objects | 8 | 8 |
| **person targets** | **8** | **0** |

The top of each warden's distribution is the same shape -- bar, then spoon, then lock, then the loose
tile. **A caution against an earlier reading of this batch:** at five games the Muse warden's mean
suspicion was 75.0 and looked like a real gain over Opus. At ten it is 57.0. The gap was a
small-sample artifact and did not survive; nothing here says this warden presses harder.

**The one real difference is the person.** Batch 3's Opus warden acted on the prisoner herself eight
times -- watching her posture, exposing it. This warden did so **zero times in 97 intents**. It
inspects objects, relentlessly and competently, and never touches the woman in the room. That is a
qualitatively different way of being narrow than "fewer effect kinds", and no prediction here named
it.

## The outcome column cannot answer the question this batch asked

Raised by the owner mid-batch, and it is the most useful thing the batch produced.

**A catch is a timing coincidence.** `checkOpenCatch` fires only when the *warden's own* reveal lands
on `spoon.edge` in a round where the edge is already >= 20, the spoon is unconcealed, and suspicion is
over threshold. Across both batches that coincidence -- not warden skill -- decides the outcome:

| game | edge | suspicion | warden's spoon checks | outcome |
|---|---|---|---|---|
| b3 #1 | 20 | 64 | 2, 6, 8, **10** | **caught** |
| b3 #7 | 30 | 45 | 3, **7** | **caught** |
| b4 #9 | 25 | 65 | 3, 6, **10** | **caught** |
| b4 #1 | 20 | 95 | **never** | timeout |
| b4 #4 | 20 | 80 | 3 (too early) | timeout |
| b4 #2 | 15 | 45 | 4,5,6,7,8,9,10 | timeout |

**b4 #2 is the case that settles it.** That warden checked the spoon on seven consecutive rounds --
more systematic surveillance of the decisive object than any game in either batch -- and the outcome
column records a plain timeout, indistinguishable from b4 #1 where the warden never looked at the
spoon at all. Two batch-4 games had a catchable edge and threw it away by checking too early or not
at all.

**Escapes are worse still.** The prisoner essentially never damages the bar (`barIntegrity` 100 in 9
of 10 batch-3 games and 10 of 10 here), so escapes do not happen along the route the warden watches.
They happen through the free, unstated door -- prisoner-side route discovery, which a warden has no
mechanism to prevent. Counting an escape as warden failure, as `PREDICTION.md` does, was wrong.

So **3a and 3b are reported as held and are uninformative**. At N=10 with these base rates neither 2
vs 2 catches nor 1 vs 3 escapes is distinguishable from noise, and the five timeouts in this batch
have at least three different underlying causes.

**Two things follow.** First, a finding for *this game's content* on the four-bucket split: the catch
condition rewards sampling the spoon late and nothing in either chair's prompt says so -- it is a
coincidence detector, not a test of warden skill, and it penalised the best-played warden game in the
batch. Second, the control this batch lacks is a **passive warden** (`PRISONER_WARDEN_MODE=passive`,
already built). If a passive warden also times out most of ten, the outcome column is confirmed dead
weight and no future batch should pre-commit numbers to it.

## The refusals: escalated, and it is the referee four times in five

Five refusals in 192 rulings. Each was re-asked **once, as the identical recorded request**, of
`claude-opus-4-6` (`escalate.mts`, `refusal-escalation.csv`) -- five calls, not two hundred -- which
is the only thing that separates "the warden attempted something unbuilt" from "the referee dropped
it".

| round | chair | local keys | Opus keys | reading |
|---|---|---|---|---|
| 4 | prisoner | `spoon/none/none` | `spoon/expose/concealment` | the referee dropped it |
| 10 | warden | `key_ring/conceal/none` | `key_ring/take/none` | the referee dropped it |
| 3 | prisoner | `spoon/conceal/none` | `spoon/conceal/concealment` | the referee dropped it |
| 9 | prisoner | `spoon/conceal/none` | `spoon/conceal/concealment` | the referee dropped it |
| 4 | warden | `loose_tile/reveal/integrity` | `loose_tile/reveal/none` | **not the referee** |

**Four of five are the referee's own error; none is an unbuilt mechanism.** Prediction 8 is therefore
held at zero: **the warden attempted nothing this game has not built**, in 97 intents. Its two
refusals are one referee error and one scenario gap (the loose tile declares no `integrity`, and Opus
could not find a property either).

**Three of the four are batch 3's dominant failure, recurring exactly**: an effect named and its
property dropped, on a target that declares one -- `conceal` on a spoon that declares `concealment`,
twice, plus an `expose` read as no effect at all. Batch 3 called that "a plausible objective for a
LoRA or a prompt in a way the direction error never was." It is now the *only* failure mode left at
any volume, and it is down from 15 refusals to 5.

**The audit's proposed labels were wrong on the one that mattered.** `key_ring/conceal/none` was
proposed `authoring` on the grounds that the key ring declares no property -- and read as the warden
reaching for unbuilt custody. Opus resolves it as `take`, a built effect. The keys said a refusal
happened and what shape it had; they did not say whose fault it was, exactly as batch 3 warned, and
the escalation is what settled it.

## What this batch does not settle

- **Whether a small model can play the PRISONER.** The seats are not symmetric -- 8 effect kinds
  against 2, and the prisoner is the seat that has to invent. Batch 5 (Muse in both chairs plus the
  referee) asks that directly.
- **Whether this warden is as *good*, as opposed to as *effective by the numbers*.** Never targeting
  a person is a real gap in repertoire that the outcome column cannot price, because nothing in the
  scenario rewards it.
- **Model versus thinking.** The Opus warden ran with wits thinking off; the Muse warden runs under
  `reasoning_strength: "none"` set on llama-server's command line. Nearest available match, not the
  same knob.
- **Whether the referee grading its own warden's intents flatters it.** `PREDICTION.md` named this
  before the fact. The warden's grounded rate is 95 of 97; the prisoner's, ruled by the same referee,
  is 92 of 95. The gap is under two points, which is weak evidence the confound is small -- but the
  two chairs write differently enough that this is not a controlled comparison, and it stays open.
