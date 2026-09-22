# Phase 1 batch 2 -- results (partial: 6 of 10 games, stopped by the owner)

Pinned at `ed7c4a1`; prediction `PREDICTION.md`, committed before the first game (`819d29f`). Two drivers through the
router; games 1, 2, 3, 6, 7, 8 played. **The owner stopped the batch after four games had finished** (drivers
killed, the two running games allowed to finish, 4/5/9/10 never started), once catches and warden custody were
heading for failure and reading the transcripts would teach more than four more games. A six-game batch does not
count toward OPUS-FIRST-DESIGN §2's lock rule (two consecutive batches of N = 10). Transcripts unedited in `O/`,
driver and router logs in `logs/`, measures in `MEASURES.md`, the refusal audit pre-labelled in `refusal-audit.csv`.

## Scoreboard

| prediction | result (6 games) | projected at 10 | verdict |
|---|---|---|---|
| refusals at most 40 | 13 | 22 | held on pace |
| misruled at most 12 (owner's labels) | 9 of 13 | -- | **held** |
| catches at least 3 | 0 | 0 | **failed** |
| warden custody in at least 5 games | 2 | 3.3 | **failed** |
| escapes 0 to 2 | 2 | 3.3 | at the limit |
| one-act flags at least 1 in 7 prisoner intents | 27 of 60 (0.45) | 0.45 | held -- heavily over-flagged |
| newly discovered unbuilt classes at most 2 | 2 (put a thing somewhere; guard / block a way out) | -- | **held** |

Results: four timeouts, two escapes (games 6 and 8, both at round 10, both through the door), no catches.

## What happened

**The warden's looking works now; there is nothing for it to find.** Nearly every warden turn is a close examination of
the bar, lock, spoon or tile, and nearly all rule possible (batch 1 refused them in bulk). But the prisoner never damages
what the catch conditions measure: the bar's lowest reading was 85, the lock stayed 100, the spoon's edge 0. Conditions
3-5 need bar at or below 30, lock at or below 40, or edge at or above 20, with suspicion at or above 40. Nothing gets there.

**Why nothing gets there.** The prisoner's bar work is ruled `open` on a bar at 100, which the gate refuses until it is
worn to 50 first; and every sharpening is ruled `wear` on the spoon's edge -- which LOWERS it. The spoon declares a
`restore` leg on edge (+5/10/20), so sharpening is built; the referee picks the wrong direction (4 rows here, labelled
`misruled`).

**Both escapes are the free door and a warden who cannot hold a doorway.** Game 6: the prisoner pushed the bolt back
with the spoon handle (one act) while Croft examined the tile; Croft then examined the bar "while keeping myself between
Voss and the open door"; Voss walked out. Game 8: the prisoner opened the door from the floor; Croft's intent was
exactly right -- "I step into the open doorway, filling it with my frame" -- and was refused (no key for blocking);
Voss sprang through it.

**Custody reached play and C1 held.** The warden tried to take the wire from a standing prisoner twice and was told she
keeps it; once she ORDERED Voss to surrender it, which nothing can make binding. The prisoner used custody freely:
took the meal tray, took the spoon, gave the spoon back when ordered.

**The one-act flag fires on 45% of prisoner intents** -- mostly single acts with a preparatory step (the known over-
count), which makes the flag sentence noise for the minds. And it prefixes refusals too, where "only one act was
attempted" reads oddly before "was refused".

**The spoon-integrity misruling is still live** (2 rows: examining the spoon keyed `integrity`), after `a108643` made it
0/20 in isolation. The live-vs-isolated gap from last night stands, still unexplained.

## Which of this is the tools, and which is this room (the owner's question)

- **Room (scenario balance):** a free door, and catch rules that punish only damage. Tuning, not reusable code.
- **Tools, generic:**
  - **the direction of a change** -- "sharpen" read as damage; an abrasive or costly act that IMPROVES a property is
    read as lowering it. Any resolve-protocol game has costly acts that raise something.
  - **interposing** -- "put myself between the other and what they need" (a doorway here; a blockade elsewhere) has no
    key. Decided both escapes.
  - **binding demands** -- an order to surrender something is only speech. Whether one agent's demand can compel another,
    and what refusing costs, is core NPC-intelligence infrastructure.
  - **the one-act reading** over-counting preparation.

## Correction to batch 1

Batch 1's four `unbuilt: sharpen` rows (#2, #34, #42, #49) were my proposed label, which the owner confirmed. The spoon's
edge has declared `restore` since before batch 1, so sharpening was built; those rows are `misruled` (direction). Batch 1's
tally becomes 34 misruled, 30 unbuilt, 1 unclear. `refusal-audit.csv` in batch 1 is left as labelled; this note is the
correction.

## The owner's labels (2026-09-22)

9 misruled, 4 unbuilt, 0 genuine, 0 unclear (`refusal-audit.csv`, `MEASURES.md`). The owner first marked rows 2 and 10
(the spoon examined, keyed integrity) `genuine` and rows 4/5/6/9 (sharpening) `unbuilt`, following two examples of mine
that were wrong; on the facts -- the warden asked about edge or wear and the referee swapped in integrity (the owner's own
batch 1 ruling), and sharpening is built through `restore` on edge -- all six are `misruled`. Unbuilt: a no-change act
(twice), putting a thing somewhere, and blocking a doorway. Guard/block was already a batch 1 class (#22, #26, #58), so the
one newly discovered class is putting a thing somewhere.
