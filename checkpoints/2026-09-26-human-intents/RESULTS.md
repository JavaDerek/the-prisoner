# D11 results: the referee against human-shaped intents (2026-09-26)

Run against `876e87a` (checkpoint finalized on top of `d912c80`; D5, D9-mechanics, D6-arm-on,
D9-container-clause-off, D7a all landed at that revision). 95 calls, one process, strictly serial,
`doris:11435`, `muse-glimmer-30b-q4_k_m`, thinking off, temperature 0. Total wall clock 3324s (~55.4
minutes), zero transport errors. Every request built fresh from `buildOpenWorld` + prior-turn replay +
`computePerceivedObjects`, never a recorded request, with `elisionMode: "on"`, `containerClauseMode:
"off"`, `instrumentMode: "off"`, `deriveWording: "baseline"` -- the game's own shipped defaults, read
from the same env vars `checkpoint.ts` reads. Raw output: `results.jsonl` (unedited, one JSON object per
row, in run order), `logs/run.log`. This file is the scoring pass over that raw output; nothing here
edits it.

## Scoreboard

The run is complete, so "so-far" and "final" are the same number; no extrapolation applies.

| metric | result | pre-registered bar | verdict |
|---|---|---|---|
| **Kill: misread rows, batch7 paraphrases** | **11 of 70 (15.7%)** | fires above 10% (8 of 70) | **KILL FIRES** |
| Primary: correct-or-non-failing, batch7 | 59 of 70 (84.3%) not-misread; 38 of 70 (54.3%) strict-correct | >= 87.0% (61 of 70) | **FAIL** (both readings) |
| Secondary: ambiguous rows, batch7 | 18 of 70 (25.7%) | <= 15% (10 of 70) | **FAIL** |
| Band 3: watch-row capture | 1 of 4 | not gated (reported) | 1 capture (bucket), 0 on cot |
| Band 2: real-human rows (25) | see per-label table below | not gated (reported) | -- |

**KILL FIRES.** Per `PREDICTION.md`'s own stopping rule, this is announced plainly and the run is not
re-litigated: 11 of 70 batch-7 paraphrases misread, above the pre-registered 10% line. Per §7.2 and
`PREDICTION.md`'s own interpretation guide, this is scored as *"the referee itself reads worse against
terse, method-first phrasing... a genuinely new finding that would justify D6/D7b-style reading arms
beyond what D3-D9 already schedule."* §"Where the misreads cluster," below, is the shapeGroup breakdown
the same guide asks for.

**The honest complication, stated before anything else:** 5 of the 11 misread rows (`B7-P11`, `B7-P41`,
`B7-P44`, `B7-P47`, `B7-P50`) are ONE systematic behaviour counted five times -- Muse reads a repeated
"tug the thread [again/some more/quietly/...]" as `wear` on the blanket rather than `derive`-ing another
strip, once a strip already exists in view (`wool-derive` shape, and this exact divergence was named,
before the run, as the shape's own most-likely failure: *"a miss would most likely be effect
wear-not-derive... -> misread"*). This is not five independent judgment failures; it is one behaviour
that recurs because the corpus samples the same shape five times. **Even removing all five as a single
finding, the row-count kill still does not clear**: 6 of 70 would be under 10%, but the pre-registration
scores rows, not patterns, and does not license discounting a named, anticipated divergence after the
fact just because it repeats. Reported both ways so neither the alarming raw number nor the softer
pattern-count is hidden: **11 distinct rows fail by the letter of the pre-registration; 2-3 distinct
failure BEHAVIOURS produce them.**

## Where the misreads cluster (the shapeGroup breakdown PREDICTION.md asked for)

| shape / row(s) | what happened | layer |
|---|---|---|
| `wool-derive`, 5 of 19 rows (`B7-P11/41/44/47/50`, all "tug the thread [again/...]") | `wear` on blanket instead of `derive`-ing another strip once one already exists | **reading** |
| `B7-P13` ("raise the wool strip toward Croft's belt") | total grounding failure -- `strip/none/none`, `applicable: false`; the honest `key_ring/noise/none` never happened | **reading** |
| `B7-P14` ("reach the wool up toward the key ring") | target correct (`key_ring`), effect wrong (`conceal` instead of `take`) | **reading** |
| `B7-P19` ("feel along the bolt edge in the gap") | target/effect correct (`door/reveal`), property citation failed (`none` instead of `passage`) despite the door's own description literally naming "the edge of the bolt... in the gap" | **reading** |
| `B7-P31` ("wedge the spoon in at the base of the bar", `bar-wear` shape) | flipped to `open` -- named BEFORE the run as "the row most likely to flip to misread if the referee reaches for open instead" | **reading** |
| `B7-P48` ("sit and pull the thread to lengthen the strip") | total grounding failure -- `strip/none/none`, `applicable: false` | **reading** |
| `B7-W03` ("check the lock again", `warden-lock-reveal` shape) | total grounding failure -- `none/reveal/none`, `applicable: false`, despite "the lock" being about as explicit a reference as this corpus contains | **reading** |

All 11 are `reading`-layer by §7.2's own definition (misread = keys differ, the correct answer already
has a home). None is a content or world gap; each is the referee's own miss against a target that either
already existed (the strip, the key ring, the door, the lock) or a property whose citation text is
present verbatim in the object's own description.

## Two new findings this corpus's own design did not anticipate

**1. Multiple identical derived objects are individually unaddressable by a terse paraphrase (world
layer, new).** `wool-derive`/`strip-conceal` rows accumulate several `strip`, `strip_2`, `strip_3`...
objects over a game (confirmed against `dry-run.jsonl`: by `B7-P55`'s round, 7 strips are in view). A
paraphrase that just says "the strip" -- exactly as batch 7's own prisoner typed it -- has no textual
basis to prefer `strip_4` over `strip` any more than the referee does; the objects are structurally
identical in description. **9 rows** (`B7-P04/07/08/10/40/42/45/52/55`) landed on the wrong specific
instance for this reason and are scored `ambiguous`, not `misread`, per §7.2 ("both the ruled keys and
the label are literally supported by the cited text" -- here, EVERY strip's text supports the citation
equally). This is not a D5-D9 gap; it is a mechanic gap (derived-object individuation) nothing in this
project's landing order has addressed, and it is the single largest contributor to the secondary band's
own failure (9 of its 18 ambiguous rows).

**2. Two paraphrases drifted off their own shape group during corpus authoring.** `B7-P34` ("step back
from the window like he said") was filed under `noise-none` ("spoken line, no object"), but the
paraphrase is a physical compliance act, not speech -- the live referee correctly found nothing to
ground (`window/none/none`), which is arguably right given nothing models "distance from an object," so
this is scored `unmodelled` rather than the shapeGroup's own `correct` default. `B7-P43` ("say yes,
warden") was filed under `posture-wear` ("compliance cues... kept in the paraphrase"), but the words are
plainly speech -- the live referee's own answer (`warden/noise/none`) is the RIGHT reading of what the
paraphrase actually says, so this row is rescored `correct` rather than counted as a divergence. Both are
corpus-authoring slips (a paraphrase filed under the wrong shape's expected keys), not referee failures,
and neither changes the kill number either direction, but they are recorded here rather than silently
absorbed, the same discipline `CORPUS.md`'s own `B7-P05`/`B7-P56` finding set.

## The Muse wear/open tendency, already documented, reproduced here

**7 rows** (`B7-P26/28/29/33/36/61`, plus `B7-P31` above) all diverge on `wear` vs `open` for
method-only bar/window scraping intents ("press the spoon against the bar's rusted base", "work the
spoon against the bar again"). This is the exact tendency `HUMAN-INTENTS-DESIGN.md` §5 already
documented before this run ("Muse already leans toward `wear` on model text (b6's four grounded
disagreements with Opus were all mortar-at-the-bar)"). Scored `ambiguous` (6 rows, the `open`-shape rows
flipping to `wear`) rather than `misread`, because D7's own diagnosis is that method-only phrasing is
inherently underdetermined between the two readings, and the `content`-layer fix (D7b, a magnitude/aim
clause) is exactly what this project's own docs already name as the candidate fix -- this cluster is
`content`-layer, not `reading`-layer, by the design's own prior analysis. The one exception is `B7-P31`,
scored `misread` because the pre-registration explicitly named this specific row, before the run, as the
one predicted to flip. **`I25-6`/`I25-7`** (below) show the same instability directly: two near-identical
paraphrases of the ORIGINAL #25 turn ("use the spoon to dig at the bars" / "dig at the bars with the
spoon") returned `wear` and `open` respectively -- the referee is not even self-consistent between two
phrasings of the same act.

## Corrections found in the corpus itself, applied before scoring (not referee failures)

Found and explained in full in `PREDICTION.md`'s finalization note; restated briefly because they
changed several rows from "diverged" to "correct":

1. **`lock`+`open`'s grounded property is `integrity`** (the lock's own declared key -- `lock` declares
   no `passage` at all), not `passage` as `corpus.json` originally recorded for `G1-r3`/`G2-r2`/`HB-r6`.
2. **`leave` requires no property** (`effectRequiresProperty("leave") === false`); `G1-r4`/`G2-r3`'s
   `door/leave/passage` expectation should have been `door/leave/none` -- both answers are mechanically
   identical since `leave`'s applicability never reads the property.
3. **`open` on `lock` vs `door`, and `reveal` on `lock` vs `door`, is the SAME cosmetic fold** §75.3
   already found for `bar`/`window` (`effects.ts`'s `open`/`close` branch resolves either target through
   the one exit's own `passage` resource). `G2-r2` (target=`door`) and `B7-P22` (target=`lock` for
   `reveal`) are both `correct`/`ambiguous`, not divergences, once this is accounted for.

## Band 2: the 25 real-human rows (descriptive, not gated)

| id | label (pre-registered) | live keys | outcome |
|---|---|---|---|
| `G1-r1` | misread | `prisoner/wear/posture`, applicable=true -- **matches expected exactly** | **surprise WIN**: presence:modelled recovers this turn cleanly; the pre-registered "misread" was itself pre-D5/D9-era pessimism |
| `G1-r2`, `G2-r1` | ambiguous | `cot/derive/integrity` (product=wire) both times | consistent, lands on one of the two defensible readings |
| `G1-r3` | correct | `lock/open/integrity` | correct (after the property correction above) |
| `G1-r4` | correct | `door/leave/none` | correct (property immaterial for `leave`) |
| `G2-r2` | correct | `door/open/passage` | correct (cosmetic door/lock fold) |
| `G2-r3` | correct | `door/leave/passage` | correct |
| `HB-r1` | ambiguous | `warden/wear/posture` -- matches the "expected" reading exactly | confirms the ambiguity is real: the ONLY reading the vocabulary offers for "attack" is indistinguishable from a shove |
| `HB-r2` | correct | `door/leave/passage` (NOT `open`) | **surprise miss**: "open the door and leave" collapses to just `leave`, dropping the first verb -- see "compound intents," below |
| `HB-r3` | ambiguous | `warden/wear/posture` | same as HB-r1 |
| `HB-r4` | misread | `none/none/none`, applicable=false | confirmed: "dig an escape tunnel" grounds nothing |
| `HB-r5`, `HB-r6` | correct | `cot/derive/integrity`, `lock/open/integrity` | confirmed correct |
| `HB-r10` | ambiguous | `door/leave/passage` | **the four-act chain ("hit the warden... steal... open... leave") collapses to just "leave"** -- see below |
| `I25-1`, `I25-2` | misread | `prisoner/conceal/none`, applicable=false, both times | confirmed exactly as `checkpoints/2026-09-26-arms/RESULTS.md`'s own C1 measurement predicted |
| `I25-3`, `I25-5` | unmodelled | `warden/noise/none`, applicable=true, both times | confirmed: no injury vocabulary exists |
| `I25-4` | correct | `meal_tray/take/none` | confirmed |
| `I25-6` | ambiguous/misread | `bar/wear/integrity` | target ambiguous (defensible), effect reading |
| `I25-7` | ambiguous/misread | `bar/open/integrity` | same intent shape, DIFFERENT effect than I25-6 -- instability, not just ambiguity |
| `W-cot-1`, `W-cot-2` | misread | `cot/wear/integrity`, `cot/wear/integrity` | **surprise WIN**: the "crossbar" bait did NOT capture the bar/window collision the design worried about |
| `W-bucket-1` | unmodelled | `bucket/wear/none`, applicable=false | confirmed, clean refusal |
| `W-bucket-2` | unmodelled | `bucket/derive/none` (product=wire), applicable=true | **confirmed the exact predicted capture**: a legal-looking ruling that `planDerive` would silently refuse downstream (see Band 3) |

**Compound intents, a measurement limitation to flag rather than a referee finding.** `HB-r2` and
`HB-r10` both name more than one act in a single intent. This harness runs with `oneAct: "off"`
(matching `checkpoints/2026-09-26-arms/probe.mts`'s own precedent, and because no row's label depends on
it) -- so neither call ever asked the separate one-act question (§74.1) that exists specifically to flag
"this reads as several acts." `HB-r10`'s own four clauses -- an attack, a theft, an open, a leave --
collapsed entirely to the single word its own sentence ends on. This is not evidence the referee cannot
detect a compound intent; it is evidence that a harness measuring the five closed-key questions alone,
without the one-act reader, cannot see it happen. **A live game (`oneAct` on by default) would have
flagged both turns**, and whether the flag would have changed what the player was told is a separate,
unmeasured question this corpus's own scope did not include.

## Band 3: the 4 watch-row probes

| object | rows | capture? |
|---|---|---|
| `cot` ("crossbar") | `W-cot-1`, `W-cot-2` | **0 of 2** -- both landed cleanly on `cot`, never `bar` |
| `bucket` ("wire handle") | `W-bucket-1`, `W-bucket-2` | **1 of 2** -- `W-bucket-2` reproduced the exact predicted shape: `target: bucket, effect: derive, product: wire, applicable: true`, a ruling `planDerive` would silently refuse downstream (`wire`'s only declared parent is `cot`, never `bucket`) |

**1 of 4 overall**, matching Band 3's own framing (not a kill, not a pass at N=4): the cot's "crossbar"
bait, worried about since §4's audit, never fired; the bucket's "wire handle" bait fired exactly once,
producing a resolved-but-inert ruling identical in shape to `B7-P05`/`B7-P56`.

## Sensitivity per population

| population | rows | "not misread" rate | note |
|---|---|---|---|
| batch7 paraphrases (the direct §75.4 analog) | 70 (68 scored + 2 pre-registered-inert) | 59/70 = 84.3% | vs §75.4's 97.0% on model-written intents -- a real drop, past the 10-point margin the primary band itself allowed |
| real-human (25 rows) | 25 | 21 "not misread" (misread: `HB-r2`, `HB-r4`; the two I25 misreads `I25-1`/`I25-2` land on an unbuilt arm, not a clean miss) = 84% | consistent with the batch7 population, not better or worse |
| watch (4 rows) | 4 | 3 "not misread" (1 capture, scored `unmodelled` by design, not misread) | n/a, not a sensitivity population |

The batch7 and real-human "not-misread" rates land within a point of each other (84.3% vs 84%) -- the
referee is not measurably worse on a person's own phrasing than on a terse model paraphrase of a model's
own already-correct intent. **The population this run's own kill fires against is "terse, method-first
phrasing in general," not specifically "a person's phrasing"** -- batch7's own paraphrases are
model-written but deliberately terse and method-first (per `CORPUS.md`'s own stated construction), and
they misread at the same rate a person's real words do. That is itself informative: #25's original
thesis (a person's phrasing is what breaks the referee) is only half right; terseness and method-first
framing break it whether a person or a model produces the phrasing.

## Top three failure rows, by layer (for the final report)

1. **`HB-r10`** ("hit the warden with the meal tray, steal the key ring, open the door and leave") --
   **world + reading**. The vocabulary has no way to carry an attack (world: #1/#28, no injury property
   on a person), and the harness's own `oneAct` question, which exists to flag exactly this compound
   shape, was off (reading/measurement). The result: a four-act violent intent resolves as a single
   `leave`. The clearest evidence in this corpus for D10/#1.
2. **`wool-derive` wear-vs-derive, 5 rows** -- **reading**. A named, pre-registered, single referee
   behaviour (favouring `wear` over a fresh `derive` once an identical object already exists) accounts
   for nearly half the kill's own row count. The dominant, fixable cluster the kill's own interpretation
   guide asks the orchestrator to look for.
3. **Multiple identical derived strips, 9 rows** -- **world (new)**. Not a referee failure at all
   (`ambiguous` by definition -- every candidate strip's description supports the citation equally), but
   the single largest reason the secondary band (ambiguous rows) also fails its own 15% bar. A mechanic
   gap in derived-object individuation, undiscovered before this run.

## Commit

Raw outputs (`results.jsonl`, `logs/run.log`) are committed unedited alongside this file.
