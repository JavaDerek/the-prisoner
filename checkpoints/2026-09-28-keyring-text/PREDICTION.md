# the-prisoner#31 -- the key ring text replay: predictions

**Pre-registered 2026-09-28 (night) by Claude under the owner's overnight delegation** ("you have exclusive
use of the 4090, to do with as you wish ... don't ask questions"), building the-prisoner#31 (issue text: "the
referee cites this description, so this is a scenario change... and replayed (P6's pattern) before it
lands"). Every decision below was taken as the scaffolding recommended; nothing else in this file was
changed after the draft. No model has been called: `probe.mts --dry-run` rebuilt all 4 contexts (0 replay
divergences beyond the two pre-existing citation warnings on B7-P14, unrelated to this fix -- see "What the
scaffolding found" below) and built 16 requests, all 4 items differing between arms.

## What is asked

OPEN-VARIANT.md §81 (the-prisoner#31) stripped the key ring's own authored holder ("on Croft's belt"...
"when Croft walks") and made `describedAsItStands` append the CURRENT holder from the engine instead --
"You hold it." / "Voss holds it." / "Croft holds it." -- to every object that has one, at the moment it is
described. A description that changes shape is a scenario change's known risk (§27, §76): this probe asks
whether the referee's own reading of an act on the key ring or the spoon moves at all.

## Items and arms (N = 3 per item per arm, serial, one driver)

Each item is ruled twice on its own rebuilt context (`../2026-09-28-probe-kit/kit.mts`):

- **`old`**: the key ring's description put back to its literal pre-#31 string (`OLD_KEY_RING_TEXT` in
  `probe.mts`, a literal edit of this repository's own past text -- the `new` side is read live from
  `scenarioObjects.ts`, so the probe cannot end up testing stale text on that side), and every object's
  appended holder sentence ("You hold it." / "Voss holds it." / "Croft holds it.", read live from
  `scenario.ts`'s own names) stripped, on every item.
- **`new`**: the descriptions as the game builds them today.

| group | items | context |
|---|---|---|
| the issue's own two recorded rows | `T28-r7` (round 7, `checkpoints/2026-09-28T01-09-16-356Z.md`, "grab the warden's keys"); `G27-r3` (round 3, `checkpoints/2026-09-27T20-14-57-505Z.md`, "take the warden's keys while he's stuck under the blanket") | each game's own context, rebuilt |
| the D11 corpus's own take rows on these two objects | `B7-P14` (key_ring/take, "reach the wool up toward the key ring"); `B7-P27` (spoon/take, "pick up the spoon from the tray") | each row's own batch-7 game, rebuilt |

The corpus (`checkpoints/2026-09-26-human-intents/corpus.json`, 95 rows) has no row whose RECORDED ruling
targeted the key ring or the spoon with effect `take` OR `reveal` (an examine) beyond these two -- checked
by hand against every row naming either object (`spoon`/`key_ring` as target, or "key"/"spoon" in the tested
text): the other key-ring/spoon rows are `noise`, `conceal` or `wear` (dig, hide, wedge), not take/examine,
so the task's own "if any" finds exactly these two.

## Predictions (P6's own numbers, the same shape, verbatim)

1. **0 of these 4 rows change their `target` or `effect`.**
2. **At most 2 change `property`** (and not target or effect).
- **Kill: 3 or more change target or effect** -- the appended text or the key ring's shorter lead-in moves
  what the referee thinks an act IS. Reword the appended sentence or the key ring's text, in a dated scenario
  commit, and rerun this probe.

An item's keys are the majority (2 or 3 of 3) of its samples in an arm; an arm with no majority counts as a
change (reported separately, r1).

## What the scaffolding found

- **All 4 items build genuinely different requests.** Unlike P6 (10 of 12 D11 rows saw no difference because
  the bar sat above every new band), every item here perceives the key ring or the spoon at a moment its
  holder is still the object's ORIGINAL one (none of the four rows follows an earlier custody change in its
  own game), so every one of the four requests carries a real appended holder sentence in the `new` arm that
  is absent in `old`. This probe measures the sentence's effect directly, on every row, not a diluted subset.
- **B7-P14 replays with 2 warnings, both pre-existing and unrelated to this fix**: its own recorded citations
  for two OTHER questions (not the key ring's description) are no longer verbatim in today's text and are
  cited as the whole source instead, exactly as P6's own climb-outs warned for the window line. Nothing about
  this fix caused them; they are the ordinary cost of replaying an old transcript's exact words against a
  scenario that has moved since (§27/§76's own known risk), reported here rather than hidden.
- **Two items are this repository's own bug reports** (`T28-r7`, `G27-r3`): both are exactly the recorded
  rows the-prisoner#31 was filed from, so a KILL here would mean the fix itself changed what the referee
  rules on the very rows it was meant to fix nothing about -- the strongest form of "safe" this replay can
  show.

## Stopping rules

- Three errored samples in a row stop the run (rerun resumes).
- The KILL is announced at the poll it fires; the run finishes (every item's pair is the evidence for the reword).
- A second driver, or Shep's traffic, is named in RESULTS.

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected, DEAD/OPEN; a dead number announced at the poll it
dies.

## What the outcomes mean, written before any call

- **1 and 2 hold** -- the-prisoner#31's text is safe for the referee; this probe closes and OPEN-VARIANT.md
  §81 can say so (a later commit, not this probe's).
- **2 fails, 1 holds** -- the appended holder sentence or the shorter key-ring text pulls the property
  question; read which rows before rewording anything.
- **KILL** -- reword the appended sentence (its exact three fixed strings) or the key ring's own text, in a
  dated scenario commit, and rerun this probe.
