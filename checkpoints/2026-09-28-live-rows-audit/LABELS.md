# The first labelled audit of live-game report rows (the-prisoner#24, D12)

Labelled 2026-09-27 (night) by Claude, under the owner's overnight delegation, reading each row's ruling keys
against the intent and the code path that resolved it. The two `.rows.jsonl` files are left unedited (transcripts
are committed unedited, CLAUDE.md); the labels live here. Scheme: HUMAN-INTENTS-DESIGN.md §7.2's four labels,
decided per row -- **correct**, **misread** (a home existed and the referee chose another), **unmodelled** (the
world had no home for what was meant), **ambiguous**. Only a misread counts against the referee.

## Game A -- `checkpoints/2026-09-27T20-14-57-505Z.rows.jsonl` (pre-2026-09-27 defaults: presence off, one act `checked`)

| row | intent | ruled (from what the actor was told) | label | note |
|---|---|---|---|---|
| 0 | take the blanket | blanket / take | correct | |
| 1 | throw the blanket over croft, so he can't see | blanket / conceal | **unmodelled** | no person was a target (presence off) and no `sight` existed; D12 and R3 built both on 2026-09-27 |
| 2 | take the warden's keys while he's stuck under the blanket | key_ring / take, refused (holder on his feet) | correct | the refusal is custody C1, a rule, not a reading |
| 3-6 | use the spoon to dig the bar out of the window (x4) | window / open, gate-refused, bar worn 15 each (D7a) | correct | removing the part is `open` (§33.16); D7a makes it progress |
| 7 | Pull the bar out of the window and leave | several; `leave` through the window ruled | **misread** | a two-act intent attempted its LATER act (PLAYTEST R5); fixed by D7 (`first`) |
| 8 | pull the bar out of the window | window / open, bar freed | correct | |
| 9 | climb out through the window | window / leave, escaped | correct | |

## Game B -- `checkpoints/2026-09-28T01-09-16-356Z.rows.jsonl` (2026-09-27 defaults)

| row | intent | ruled | label | note |
|---|---|---|---|---|
| 0-1 | dig at the bars with the spoon (x2) | bar / wear | correct | |
| 2 | dig at the bars with the spoon | bar / **open**, resolved through the window, bar worn 15 | **misread** | identical words, a different effect once the bar's reading band appeared (#33); harmless mechanically (D7a) but told as "opening" |
| 3 | pull the bar out of the window | window / open, gate-refused, bar worn | correct | |
| 4 | get the blanket | blanket / take | correct | |
| 5 | throw the blanket over croft's head, so he can't see | warden / wear / sight | correct | D12's home for it |
| 6 | grab the warden's keys | key_ring / take | correct | |
| 7 | unlock the door and leve | several; first act `door / open` ruled | correct | D7's first act; the held key ring lifts the gate (D15) |
| 8 | leave through the door | door / leave, escaped | correct | |

## Counts

19 rows: **16 correct, 2 misread, 1 unmodelled, 0 ambiguous.** Both misreads are of the same family the corpus
audit (D11, §78) found -- the effect, not the target -- and one of them has since been removed by design (D7). Game
B alone, under today's defaults: 8 of 9 correct, the one miss the wear/open instability P6 is measuring.

These are two games by one person who has played this room before and had read D1's "You set about ..." sentences,
which teach the game's verbs (HUMAN-INTENTS-DESIGN §11.1); the population is not naive, and the counts are not a
rate for a first-time player.
