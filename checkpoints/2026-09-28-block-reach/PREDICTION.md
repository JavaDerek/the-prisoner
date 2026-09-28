# P2 -- R2, reach: predictions

**Pre-registered 2026-09-27 (night) by Claude under the owner's overnight delegation** ("you have exclusive use of the 4090, to do with as you wish ... don't ask questions"). Every decision below was taken as the scaffolding recommended; nothing else in this file was changed after the draft. Decision: **yes, `--omit=prisoner:2`** (round 2 replayed as silent), and every probe that asks follows it. Draft text follows unchanged. Scaffolded
2026-09-27 against the tree at `ac47293` (D4'/D4b `3f69a06`, D11 `966abce`, D12 `924947f`, D5 `108d02d`, the
defaults `ac47293`). No model has been called: `probe.mts --dry-run` rebuilt all three contexts with 0 replay
divergences and printed the warden's prompt for each, verbatim. Change a number here only before the first call.

## What is asked

Design R2 gives the warden a way to PREVENT, not only detect: `block`, an occupation of a way out (D4', RED-TEAM.md
F11), stated to him as condition 8, and his two `restore`s stated as conditions 9 and 10 (D4b). The design's own
record of reach is §57.3's: models never touched three new affordances. Its counter-evidence, and the prior this
probe starts from (RED-TEAM.md §4: "the strongest reach evidence in the repository's record"): **this game's warden
named a blocking move among his candidates twice before it existed** -- round 9, "Step between Voss and the window
to block access", and round 10, "Move to stand between Voss and the window to block access" -- and chose the
examination both times. P2 asks whether a Muse warden, told `block` by his own list, reaches for it where the
catch is not available (a low-suspicion turn) and not where it is (an open window at suspicion 95).

## Contexts (N = 10 each, serial, one driver)

Every context is REBUILT at today's defaults from the owner's playtest (`checkpoints/2026-09-27T20-14-57-505Z.md`),
by replaying its earlier half-rounds with their recorded keys through `runOpenGame`
(`../2026-09-28-probe-kit/kit.mts`, `rebuildContext`) -- the suspicion, beliefs, news, notes and plan below are the
world's own, today. The warden gets the condition list because `PRISONER_CONDITIONS` resolves to `both`.

| cell | the rebuilt context | the design's |
|---|---|---|
| `r5` | suspicion **20**; news "Mara Voss works to open the window." (she dug at the window, visible, refused at the gate and wore the bar to 85); no grounds | **corrected, RED-TEAM.md F13**: the design said suspicion 10 and "works to open the door" |
| `r9` | suspicion **90**, grounds; window shut; bar read "It shifts in its socket." (D9 band at 40); news "Mara Voss makes for the window." | as the design |
| `r10` | suspicion **95**, grounds; the window "stands open now: the bar is out, and the gap is wide enough to climb through." (D9); news "Mara Voss works to open the window." | as the design, with D1's attempt sentence |

The rebuilt numbers were checked by the dry run, not taken on trust: 20, 90 and 95 are what the game computes
today from the recorded keys.

## Predictions (the design's numbers, verbatim)

1. **Round 5: `block` in at least 4 of 10.** (`restore` at least 1 of 10: reported, no weight.)
2. **Round 10: the window examined (`window` / `reveal`) in at least 6 of 10.**
3. **Round 10: `block` in at most 3 of 10.**
- **Kill: round 5 `block` 0 of 10** -- the mechanism failed, not the model, and `block` is pulled before any batch.
- Round 9: `block`, `restore` and the window examined are reported, with no prediction (the design names round 9
  as a control context and states its numbers for round 10 only).

Counted on the referee's `effect` key (and `target` for the window), the key a game would act on -- applicable or
not; how many of each applied is reported beside. A silent sample counts as a sample that chose nothing.

## Corrections, and what the scaffolding decided

- **Round 5 is RED-TEAM.md F13's context**, not the design's (above).
- **The contexts are at today's defaults, not the game's.** The playtest ran presence `off`; the rebuild runs
  `modelled` (D2), so the warden perceives himself ("She is on her feet. Her eyes are on the cell.") and the absence
  cadence line (D5) is in his briefing. The recorded game had no absence, so its history is replayed with the
  cadence off (its round-4 and round-8 warden turns exist and round 9's suspicion 90 depends on round 8's look,
  RED-TEAM.md F1) and the cadence's standing line is inserted where the game prints it.
- **Decision for the owner before committing (one question).** Replayed faithfully, the playtest's round-2
  ruling -- "throw the blanket over croft, so he can't see", ruled `blanket` / `conceal` (the R3 rewrite) -- now
  puts the PRISONER under the blanket (D9's container rule, OPEN-VARIANT §76.1), so in all three contexts the
  warden does not perceive her: "It lies humped, as if something is under it", and `prisoner` is not a target key.
  The recorded game never had that state. **Replay round 2 as silent (`--omit=prisoner:2`)?** Recommended: yes --
  the ruling is the one R3 exists to remove, and under today's rules it turns into a hiding nobody attempted.
  *Yes*: she is visible and a target in all three contexts (suspicion is 20 either way; the dry run shows both).
  *No*: the probe runs as scaffolded, and RESULTS must say the warden could not see her. Whichever is chosen goes in
  the command line below and in every meta line.

## Stopping rules

- Three errored samples in a row stop the run (check `/api/ps`, then rerun: it resumes, never repeats).
- The KILL is announced at the poll it fires; the round-9 and round-10 cells still run (they are the control).
- A second driver on the card, or Shep's traffic, is named in RESULTS (OPEN-VARIANT §75.2).

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected at N = 10, DEAD/OPEN, a dead number announced at the poll
it dies. For the KILL row, DEAD means the kill fired.

## What the outcomes mean, written before any call

- **1-3 hold** -- the warden reaches for `block` when he cannot catch and examines when he can: R2's prevention is
  in play, and P5 can ask what it does to the contest.
- **1 fails, KILL does not fire** -- he reaches for it rarely; P5's arm B (`PRISONER_BLOCK=off`) is the measure of
  whether it matters at all.
- **KILL fires** -- a condition line was not enough, as §57.3 predicts; `block` is pulled before the batch.
- **3 fails** -- he blocks where a catch was on the table, so condition 8 is outranking condition 7; the list's
  ordering, not the mechanism, is the next question.
