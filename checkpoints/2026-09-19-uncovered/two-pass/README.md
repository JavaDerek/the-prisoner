# The two-pass coverage reading, by hand and by search (2026-09-19 night; OPEN-VARIANT.md §67.5)

Lab scratch copied beside V0's results so it is on the record. Nothing here is repository code.

- `coverage.html` -- the one-question separate call over 13 labelled intents, with tick boxes and a
  scoreboard (the owner's hand-futzing page).
- `coverage2.html` -- the owner's two-pass idea: pass 1 DESCRIBES the intent with no list of kinds in
  sight (acts_on / physical_result / stated_aim); pass 2 MAPS the description (aim is a kind? nearest
  kind, fit %, its own covered/uncovered answer). The answer stays the model's; the threshold box is a
  reading aid only.
- `search/` -- the driver (`twopass.py`), the 13 rows, every prompt pair a Sonnet agent tried
  (`p1-*.txt`/`p2-*.txt`), the full log of all 16 attempts with exact prompts (`results.jsonl`, incl.
  the holdout run), and the agent's `REPORT.md`. Budget 40, used 15; thinking OFF throughout after the
  owner's instruction (a thinking-on baseline scored one lower and took 8x longer).
- `holdout/` -- 15 intents labelled by Claude BEFORE the search and never shown to the agent: 7
  recorded (not on the page), 3 invented covered, 5 invented uncovered.

Result: the agent's best pair (`p1-tightaim1.txt`/`p2-tightaim1.txt`) scores 10/13 with 0 false
alarms on the search rows and **13/15 on the holdout** (found 4/5 uncovered, 1 false alarm on a
contestable label). The consistent hole on both sets is digging: read as reveal/expose/wear at fit 75
every time, while every other uncovered intent scored 30-60 and every covered one 75-100. Pass 1 never
sees the room, so it cannot tell digging under a tile from lifting it.
