# The one-act call: eight formulations, and the rule that beat all of them (2026-09-23 evening)

Follows `../2026-09-23-phase1-b3/`. That batch's refusal audit put the owner's finger on the
compound intent — *"sit on the cot, pull the blanket across my lap, and underneath it sharpen the
spoon"* — which §74.1's one-act call read as **one act**, 6 times out of 6, stably. This checkpoint is
the evening spent on it. Every number here is Muse-Glimmer-30B Q4_K_M on doris's 4090, temperature 0,
`reasoning_strength: none`, two tries per row unless stated.

## The finding: it was never a prompt problem

Four formulations were tried tonight, on top of the four recorded in `../2026-09-22-one-act-s2/` with
`qwen3:14b`. None beat the wording already shipped:

| formulation | flag rate | notes |
|---|---|---|
| the game's own question (§74.1) | 22% | misses the compound sharpening, 6/6 |
| "how many things is this person doing" | — | ranks them backwards: 5 for a plain examination, 3 for the compound one |
| effects as a single number | 55% | counts body movement the prompt told it to ignore |
| effects as a `<effect> -> <object>` list, policy applied in code | 65% | the code-side rule worked (dropped 31 of 73 entries); asking for a LIST inflates the inventory |

Eight attempts across two models. **The unlock was not a better prompt but a better rule**, and the
owner supplied it from interactive-fiction convention (`[[infocom-when-in-doubt]]`):

> Moving to another part of a room was never a turn in Infocom — if it mattered they made it a
> separate room ("Entry Hall — on the dais"). But sitting, kneeling, getting into a bed **was** a
> turn: it changes the player's state with respect to an object in the room.

**It holds because the engine already encodes exactly that split.** `posture` is a declared property
of both principals with three values (100 on her feet, 50 crouched, 0 on the floor); position within
the room is not a property at all. Batch 3 contains 18 posture rulings, 9 of them `wear`. The rule was
not imported — it was written down.

## What it costs, chosen knowingly

29% of batch 3's 187 intents contain a real posture change, 41 of them recorded `one`. So the flag
rate goes from 22% to about 44% **by construction**, and the prisoner's default move — sit on the cot,
blanket over the lap, work underneath — costs a turn every time. The owner chose that: *"I do want
that… when in doubt, do what Infocom did."*

## Measured

**v1** (posture rule, 1167 chars), random 50, seed 50505050:

- flag rate **52%**, **0 unstable in 100 calls** — the best stability of anything tested
- rows with a posture change: **15 of 15** flagged
- accuracy against adjudicated labels: **48 of 50 = 96%**, both errors over-flags

The 26 flagged rows were adjudicated by the owner. He marked all 26 `several`; two were then agreed
`one` after discussion, and both disagreements produced a sharper rule than the one being tested:

- **`take` is a change of WHO HOLDS the thing.** Picking a spoon up to examine it and setting it down
  is not a take; removing it from the cell is. (The engine's own test: `take` is what moves `owner_id`.)
  This also kept 24% of all intents — everything that picks something up — out of the flag.
- **A clause saying HOW an act is done is not an act.** *"with my hand hidden from her line of sight
  by my body"* is manner; *"use my body to shield the motion"* is an act. Passive versus active verb,
  same physical arrangement. The owner's distinction, and it separates two rows that no other rule did.

**v2** (both clauses added, 1555 chars), all 187:

- flag rate **47%** against the ~44% the rule implies — specified in advance, never fitted to these rows
- accuracy on the same 50: **47 of 50 = 94%** — *worse than v1*
- **10 unstable of 187 (5%)**, against v1's zero

The two clauses fixed the two rows they were written for (#93, #42) and broke three others. The `take`
clause did the damage: *"picking up and setting down again is not a take"* reads as licence to ignore
what happened in between, so #153 (*"pick up the spoon, scrape it once along the tray, then set it
back down"*) lost its scrape and fell to `one`.

**v3** (v1 plus the manner clause only, 1421 chars) — see `sample-posture-v3.log`.

## Two corrections to this checkpoint's own instrument, recorded because they were nearly missed

1. **"Every posture row should flag `several`" is wrong.** A posture change ALONE is one effect and
   correctly reads `one` — `#65` ("sit on the cot eating… responding to Croft's comment") is right at 1.
   The posture split quoted above overstates misses for that reason.
2. **The starter set is not a sample.** Its 18 rows were selected *because* formulations disagreed on
   them, so its flag rate measures the selection. The lab page now greys the baseline out when more
   than half the rows run are starter rows.

## What is still open

- **Flag or refuse.** Infocom did not warn you about a compound command, it executed the first part and
  stopped. §74.1 flags and resolves whichever act the referee picked, so under a flag the prisoner
  still sharpens on the turn she sits down and the rule changes nothing mechanically.
- **The balance consequence is unmeasured.** Charging a turn per sit-down pushes the spoon past
  `edge >= 20` from round ~3 to perhaps ~6. In a ten-round game that may put the catch condition out
  of reach — the mechanic batch 3 finally got working. One game would show it.
- **Nothing here has shipped.** `referee.ts` is untouched; this is all lab work against recorded intents.

## The pages

`lab-pages/` holds copies of the four prompt-lab pages this produced (they live in
`~/prisoner-prompt-lab`, served on :8765, and are in no repo):

- `lab.html` — all 187 intents, a checkbox each, scored against the owner's own marks rather than the
  recorded answers, which the batch 3 audit showed are unreliable
- `acts.html` — the four curated cases as a quick filter, with stability counted as part of passing
- `muse.html` — a bare harness onto Muse-Glimmer
- `oneact.html` — the first version, superseded by `lab.html`

**`reasoning_strength` is the knob for this model**, not `reasoning_effort` — see
`../2026-09-23-phase1-b3/SETUP.md`. At `high` the model burns 14,000 characters of reasoning, hits the
token cap and returns EMPTY content, which the turn reader would silently read as the question's safe
default. And on `qwen3` through Ollama, `reasoning_effort: "none"` does not reduce thinking at all — it
stops the think-tags, so 4,000 tokens of reasoning land in `content` instead. That may mean §68.1's
finding is about output-channel contamination rather than deliberation, and deserves its own probe.
