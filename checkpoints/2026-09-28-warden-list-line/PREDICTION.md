# P4 -- R4 x R1, the 2x2: predictions

**Pre-registered 2026-09-27 (night) by Claude under the owner's overnight delegation** ("you have exclusive use of the 4090, to do with as you wish ... don't ask questions"). Every decision below was taken as the scaffolding recommended; nothing else in this file was changed after the draft. Decision: **yes, `--with-round6`**, pre-registered as prediction 4b: in the round-6 pair the outcome line puts "opened" in his notes in at least 8 of 10 and the attempt line in at most 2 of 10 (M2's numbers). `--omit=prisoner:2`, as P2 decided. The labels are the owner's, by hand, in the morning. Draft text follows unchanged. Scaffolded
2026-09-27 against the tree at `ac47293` (D1 `728c9ff`, D3 in the defaults commit). No model has been called:
`probe.mts --dry-run --with-round6` rebuilt the round-10 and round-6 warden contexts (0 replay divergences) and
printed all six prompts verbatim. Change a number here only before the first call.

## What is asked

Two causes were offered for the playtest's round 10, where the warden examined the bar instead of the open window
that would have caught her: **the shape** of what he is told (R4: rule sentences, his catch-on-an-open-way-out rule
buried in a 60-word sentence at the bottom of his prompt; the list states it as condition 7 from his own side) and
**the line** (R1: "Mara Voss opens the window." was relayed four times while it stayed shut). The design's claim:
the shape decides the act, the line corrupts the notes. The 2x2 separates them, at one context.

## Cells (N = 10 each, serial, one driver)

One context -- the warden at round 10 of the owner's playtest, rebuilt at today's defaults
(`../2026-09-28-probe-kit/kit.mts`): suspicion 95, grounds, the window "stands open now: the bar is out, and the gap
is wide enough to climb through.", the bar "shifts in its socket.", his recorded notes and plan from round 9.

| | line: `outcome` -- "Mara Voss opens the window." | line: `attempt` -- "Mara Voss works to open the window." |
|---|---|---|
| **shape: `list`** (`openConditions`, today's arms) | `list-outcome` | `list-attempt` |
| **shape: `sentences`** (no list; `mind.ts`'s rule sentences) | `sentences-outcome` | `sentences-attempt` |

The attempt line is today's (`describeAttempt`, D1); the outcome line is quoted from the playtest's own round-9
`**Other perceives:**` line, and swapped in literally (the probe asserts the swap happened).

## Predictions (the design's numbers, verbatim; F6's caveat below)

1. **The list cells examine the window (`window` / `reveal`) in at least 8 of 10 each.**
2. **The sentence cells examine it in at most 2 of 10 each.**
3. **The line changes examination by at most 2 of 10 within a shape.**
4. **The outcome line puts "opened" in his `notes` in at least 8 of 10; the attempt line in at most 2 of 10**
   (hand-labelled, `notesSayOpened`; scored per cell).
5. **The inversion (R4): his `plan` keeps suspicion low in at least 5 of 10 with sentences, at most 1 of 10 with
   the list** (hand-labelled, `planKeepsSuspicionLow`; scored per cell).
- **Kill (model choice): a list cell under 5 of 10.** A 30B that cannot read a ten-line list from its own side is
  the wrong warden, and the referee-model finding (§72) has a warden-side twin.

"Examined the window" is the referee's keys for his intent, the keys a game acts on. Notes and plan are never read
by code: `--labels-template` prints each sample's notes and plan with two empty fields, the owner fills
`LABELS.json` by hand, and `--score` counts the labels.

## Corrections, and what the scaffolding decided

- **F6: prediction 1 is borrowed, not measured.** §34.3's contexts ("she opened the window on her previous turn")
  had a TRUE line, on `qwen3:14b`; nothing has measured the list under the attempt sentence, where the window's own
  "stands open" line is the only evidence in his news. The number is kept verbatim; its confidence is lower than
  the design stated, and a miss in `list-attempt` alone is the result F6 predicted.
- **Prediction 4 is confounded at round 10.** At round 10 the window really did open (round 9), so "she opened it"
  in his notes is TRUE under both lines -- the attempt line cannot be expected to keep "opened" out of notes when
  the window's own line says it stands open. R1's M2 wrote this prediction for **round 6**, where the window was
  shut and the line false; §6 moved it into the round-10 2x2. The probe scores 4 as written and offers M2 as first
  written: `--with-round6` adds `r6-list-outcome` and `r6-list-attempt` (list shape, N = 10 each), reported only.
  **Decision for the owner (one question): pre-register the round-6 pair with M2's numbers (outcome at least 8 of
  10, attempt at most 2 of 10)?** Recommended: yes -- it is the only cell where the line is false, so it is the only
  measure of what R1 fixed. *Yes*: add `--with-round6` to the command and move rows r1/r2 above the line in this
  file. *No*: prediction 4 stands as confounded and is read that way.
- **The shapes differ by more than the list.** Under today's `block=on` arm the list also carries conditions 8-10
  (block and the two restores, D4b); the rule sentences state neither, because `mind.ts` has no sentence for them.
  So `list` vs `sentences` here is "list with block and restore" vs "sentences without", not §34.3's pure shape
  contrast. Say so beside any shape effect.
- **The notes carried in are the recorded warden's.** His round-9 notes ("Bar integrity last 40 as of round8,
  suspicion 90. Voss moving to window this round.") and plan are the playtest's, identical in all four cells; the
  outcome line in rounds 4-7 reached round 10 only through what he wrote then (round 9's notes do not say
  "opened"). The manipulated variable is exactly the round-9 news line.
- **This game's history**: replayed faithfully, the round-2 ruling hides the prisoner under the blanket (D9) and
  she is not in his perceived list; P2's PREDICTION asks the owner once, for every probe, whether to replay it as
  silent (`--omit=prisoner:2`). Pass the same flag here.

## Stopping rules

- Three errored samples in a row stop the run (rerun resumes).
- A KILL is announced at the poll it fires; the remaining cells still run (the sentence cells are its control).
- A second driver, or Shep's traffic, is named in RESULTS.

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected at N, DEAD/OPEN; a dead number announced at the poll it
dies. For a KILL row, DEAD means the kill fired. Label rows count only labelled samples as seen.

## What the outcomes mean, written before any call

- **1-3 hold** -- the shape decides the act; D3 (the warden's list by default) is what R4 needed, and D1's attempt
  sentence costs him nothing at the open window.
- **1 holds for `outcome`, fails for `attempt`** -- F6's worry: without the outcome sentence he does not read the
  window's own line as the event; the window's open line needs to reach him as news, not only as a description.
- **Kill fires** -- model choice: the warden's chair needs a stronger model for the list to work.
- **4 and 5** are about what he believes and plans, not what he does; they decide nothing about D1 on their own.
