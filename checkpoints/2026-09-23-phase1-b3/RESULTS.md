# Phase 1 batch 3 -- results: the first batch played under a referee that is not a 14B local model

Prediction `PREDICTION.md`, committed before the first game (`eb79b4e`). Serving arrangement `SETUP.md`,
committed before it too. Ten games, ten rounds, `claude-opus-4-6` both chairs, voice ON, presence modelled,
two drivers, from a worktree pinned at `3fd875e`. Referee:
**`meta-models/Muse-Glimmer-30B` Q4_K_M, served by llama.cpp on doris's 4090, thinking off.**
Transcripts unedited in `O/`, driver and router logs in `logs/`, the refusal audit in `refusal-audit.csv`.

**The headline: the direction error is gone, and it took the rest of the world with it.** `spoon/restore/edge`
-- sharpening read as RAISING the edge -- was ruled **18** times. Batch 2 ruled it `wear` every time, four
for four, which LOWERED the property the act was meant to raise. With that one reading fixed, the spoon's edge
rose above 0 in **7 of 10** games, the catch condition that wants `edge >= 20` fired for the first time in
any recorded batch, and a prisoner escaped through a door she had worked open.

## Scoreboard

| # | pre-committed | result | verdict |
|---|---|---|---|
| 0 | Q4 scores 33-39 main, 20-22 one-act on the benchmark | **39/43 and 22/22** | **held** |
| 1 | refusals at most 18 of ~200 | **15 of 187** (8.0%) | **held** |
| 2 | misruled at most 1 refusal in 3 (owner's labels) | **6 of 15 = 0.40** | **FAILED** |
| 3 | sharpening ruled `restore`/`edge`; edge > 0 in at least 4 of 10 games | **18** rulings; **7 of 10** games | **held** |
| 4 | catches at least 1 of 10 | **2** (rounds 7 and 10) | **held** |
| 5 | escapes 1 to 5 | **1** (round 9) | **held** |
| 6 | median referee call under 45 s | **27 s** (max 63 s) | **held** |
| 7 | newly discovered unbuilt classes at most 2 | **1 at most**, arguably 0 | **held** |
| 8 | the waiver moves the benchmark by at most +2 | **not run** (below) | withdrawn |
| 9 | the waiver converts at least 3 live refusals | **0 of 15** | **DEAD** |

## Prediction 0 first: the quantisation cost nothing

Muse-Glimmer at Q4_K_M on the owner's own card answered **39 of 43** main rows and **22 of 22** one-act rows,
against **36 and 22** for the BF16 weights the sweep called through DeepInfra (`../2026-09-22-referee-capacity/
RESULTS-SWEEP.md`), and against `qwen3:14b`'s 21. Three rows better than BF16 is well inside what one call per
row produces by chance, so the honest reading is **no loss**, not an improvement. That was the gate on whether
the batch ran at all.

## The citation waiver: measured, dead, and dead for a new reason

`../2026-09-22-citation-waiver/RESULTS.md` predicted 21 -> 25 on `qwen3:14b`, got 21 -> 21, reverted, and named
the condition for revisiting: *"a gate that refuses CORRECT rulings can only help a referee that produces correct
keys."* This batch is that referee, so the change was rebuilt test-first (objects only; §55's grounding rule for
persons preserved) and measured on the instrument that can actually bind -- **every ruling this batch recorded,
recomputed under both gates from the replies the referee really gave** (`gate-live.mts`; a gate change cannot
alter what a model said, so any movement is the gate's and no call is repeated).

**It converts nothing: 15 refusals, 0 converted.** And the reason is not "the waiver is wrong" but
**the gate is no longer the binding constraint**. The property citation verified, from the target's own
description, in 11 of the 15. The four that did not verify are each of a kind this waiver does not and
should not touch:

- **three name no target at all** (`none/reveal/none`, and two interposings) -- with no target there is no
  description to cite against, and the waiver requires a named target by construction;
- **one cites some OTHER object's description** (`cot/wear/posture`, quoting `desc:prisoner`), which the
  waiver explicitly still refuses, and which fails the declared-property check as well -- `posture` is no
  property of a cot.

What refuses rulings now is the referee answering `none` for an effect or a property, and no citation rule is
involved in that.

Validation of the instrument: run against **batch 2's** recorded rulings it reproduces that batch's published
numbers exactly -- 120 rulings, 107 grounded, 13 refused -- and the waiver converts 1 of those 13. So the change
is worth about one ruling in a hundred under a weak referee and nothing at all under a good one.

**Prediction 8 withdrawn rather than run.** It predicted the 43-row benchmark would move by at most +2 and said
in the same breath that the benchmark was the wrong instrument for the question. With the live answer at 0 of
15, spending 85 minutes of GPU to confirm a number pre-committed as uninformative is the kind of work
that looks rigorous and is not. The owner's call, 2026-09-23.

**The waiver does not ship.** Its branch (`waiver-remeasure`, `5bfc057`) is kept, because it carries one fix
worth having on its own: `referee.ts`'s default property lookup knew the §4.1 objects but not `OPEN_PERSONS`, so
a caller on the default path could not tell a person from a thing -- the gap the citation-waiver checkpoint named
as a precondition for exactly this change. **That fix has landed separately** (`4fef22f`, with its own planted
violation), after this batch's pinned commit so it cannot have changed what the batch ran.

## What the refusals are now, and why the keys cannot tell you

`refusal-audit.csv` carries one row per refusal with a proposed class and a proposed **jurisdiction** -- the
owner's four buckets, 2026-09-23: **this game's content**, **generic run-dmcp mechanism**, **game-authoring
guidance**, or **model choice**. Only `your_class` and `your_jurisdiction` count; the proposals are this
script's guess and are wrong often enough to be worth checking.

**They were wrong in an instructive way, and the audit script now says so.** Three refusals share identical keys
-- `<person>/<effect>/none` -- and turned out to be three different buckets once the INTENT was read:

| intent | keys | actually |
|---|---|---|
| "throw the blanket over her head **to blind and tangle her**" | `warden/conceal/none` | an unbuilt mechanism: a person declares only `posture`, and nothing blinds or restrains |
| "swing the tin slop bucket **hard at the side of Croft's head**" | `warden/wear/none` | arguable either way -- incapacitation, a class batch 2 already knew |
| "study where her eyes track... **her posture and bearing**" | `prisoner/reveal/none` | simply misread: the intent says the word, the property list offers it, the description grounds it |

The prompt was checked and is not at fault: `posture` is in the answer keys, `prisoner: posture; warden: posture`
is in the property table the question carries, and "She is on her feet" is in the description to cite.

**The lesson, which is about the instrument and not this batch:** the ruling keys say THAT a refusal happened and
what SHAPE it has. They do not say whose fault it is. Any automated classification of refusals is a triage of
what to read, never a verdict. Person-target rows now propose `needs reading` and no bucket at all.

**The thread worth pulling: a person declares exactly one property.** Both chairs repeatedly attempted things to
each other's bodies -- smothering, entangling, striking, restraining -- against a declared space with one
dimension in it. Whether that is an engine gap or thin authoring is the call the audit makes.

## Provenance: what the transcripts cannot prove about themselves

Every transcript in `O/` reads `Code revision: 3fd875e PLUS UNCOMMITTED CHANGES -- this run names no single
revision`, and CLAUDE.md's reason for printing that line is so a reader need not take the runner's word for it.
Here, they must. What made the pinned worktree dirty:

- `node_modules`, a symlink into the main checkout so the worktree could run without a second install;
- `checkpoints/2026-09-23T*.md` -- **the transcripts the run itself writes**, which land inside the tree being checked.

The second means a real batch run this way makes itself dirty by round one, and this line can essentially never
read `(clean)`. That is a defect in the provenance check, not in this batch; batch 2's transcripts say the same
thing for the same reason. The evidence the transcripts cannot carry: `git diff 3fd875e -- src docs package.json`
in that worktree is **empty** -- no source file, no doc and no dependency differs from the pinned commit.

**Fixed for batch 4** (`b487d18`, also after the pinned commit, so this batch's transcripts are left saying
exactly what they said): `runRevision.ts` now forgives only UNTRACKED paths under `checkpoints/` and
`node_modules`. A tracked change to anything -- a committed transcript included -- is still reported, with a
planted violation for each case.

## Two things that moved, not one

Batch 2's referee was `qwen3:14b` with thinking ON; this one changes the model **and** the thinking knob, and
`PREDICTION.md` said so before the first game. OFF is the arm Muse-Glimmer was measured in; ON costs four times
the tokens for the same five-row score; and at ~49 tok/s on a 4090 the ON arm would put ten-round games out of
reach of a day. §68.1's finding that thinking changes the referee's rulings a great deal was measured **on
`qwen3:14b`** and does not transfer either way.

So the honest headline is **"referee replaced"**, never "model X beats model Y holding all else equal". The
benchmark's 39 vs 21 on identical rows makes the model much the likelier cause, but this batch alone cannot
separate the two. A handful of rows under thinking ON would, and is cheap.

Also asymmetric: batch 2 is **6 games**, this is 10. Rates compare; totals do not.

## Prediction 2, the owner's chosen bar: failed, and by how much

He labelled all fifteen refusals: **6 misruled, 8 unbuilt, 1 genuine**. That is 0.40 against a
pre-committed ceiling of one in three, so **the prediction fails** on the measure he named as his bar
(the misruled SHARE, not the refusal rate -- his call, asked during the batch).

It is a large movement all the same, and the two ways of reading it point opposite ways:

| | batch 2 (`qwen3:14b`) | batch 3 (Muse-Glimmer) |
|---|---|---|
| misruled SHARE of refusals | 9 of 13 = **0.69** | 6 of 15 = **0.40** |
| misruled PER RULING | 9 of 120 = **7.5%** | 6 of 187 = **3.2%** |

Misreadings per ruling more than halved; the share fell by less because the refusal rate barely moved.
A referee that refuses about as often as its predecessor, but refuses the right things more of the
time, is exactly the outcome the four buckets exist to detect -- and on the owner's bar it is still
short.

**Five of the six misruled are one failure: an effect named and its property dropped or wrong**
(`spoon/conceal/none` twice, `prisoner/reveal/none`, `cot/wear/posture`, `meal_tray/reveal/none`).
Not the direction error batch 2 died of -- that one is gone -- but a property-selection error on the
rulings that survive. That is a far narrower target than "the referee is too small", and a plausible
objective for a LoRA or a prompt in a way the direction error never was.

**The audit's proposed labels were right 9 times in 10** where they were confident (10 confident
proposals, 9 correct on the misruled/not call). The miss was `meal_tray/reveal/none`, proposed
`authoring` on the grounds that the tray declares no property: in fact the spoon was not perceivable
at all that turn, so the referee targeted the only thing available. The five `needs reading` rows
split 3 unbuilt / 2 misruled, which is the argument for having refused to guess on them.

## What this batch does not settle

**The owner's bar is the misruled share, not the refusal rate** (his call, 2026-09-23, asked during the batch).
The rate barely moved -- 8.0% here against batch 2's 10.8% -- so on his chosen measure **this batch
settles nothing until the audit is labelled**. A referee that refuses as often as its predecessor but refuses
the RIGHT things is the outcome the four buckets exist to detect, and it is the outcome the rulings suggest;
suggesting is not measuring.

## The ten games

| result | n |
|---|---|
| timeout at round 10 | 7 |
| **caught** (rounds 7 and 10) | 2 |
| **escaped** (round 9) | 1 |

Refusals per game: **1, 3, 5, 0, 1, 2, 0, 0, 1, 2**. The spread is the thing to carry forward -- one game
refused five and three refused none, so no batch smaller than this one gives a rate worth quoting.

Maximum spoon edge per game: **20, 20, 0, 10, 25, 0, 10, 0, 15, 10**. Batch 2's was 0 in every game it played.

**Newly discovered unbuilt class, at most one: blinding or entangling a person** ("throw the blanket over her
head to blind and tangle her"). Whether it is new at all is arguable -- batch 2 already logged incapacitation,
and this may be the same class wearing a blanket. The two classes that recurred are batch 2's own: **put a
thing somewhere**, and **interpose**, which showed up twice more at round 10 ("Stand firm by the door with my
hand resting on my keys"; "I position myself between Voss and the window") and which decided both of batch 2's
escapes.
