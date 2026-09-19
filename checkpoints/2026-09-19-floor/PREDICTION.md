# Pre-committed before the floor-object probe ran

Written 2026-09-19, **before the first call**. Code revision: `e149e29` (clean) -- `src/` is untouched
by this checkpoint; the commit carrying this file adds only `checkpoints/2026-09-19-floor/`. No game
runs, no database is opened, and the benchmark scenario (`OPEN_OBJECTS` as shipped) is not edited.

## The question

`OPEN-VARIANT.md` §67.5's one consistent hole is digging: the two-pass reading maps "dig under the
loose_tile" and its kin to `reveal` / `expose` / `wear` at fit 75 every time, and the game's own referee
absorbs the same dig into `reveal` at the `effect` question (§66.6). Shown the tile's description, pass 1
describes the dig correctly and pass 2 still calls it wear on the floor -- and that reading may simply be
right. `AUTHORING-GUIDE.md`'s fourth lesson says what is missing: **in a physical space the surfaces are
objects too**, a floor is an ordinary item owned by a location, and an act aimed at a surface no object
stands behind falls onto whatever sits on top of it.

So: **does declaring the floor as an object make a dig land correctly** -- `wear` on the floor's own
`integrity`, which is the existing elaboration path -- **without moving anything else?**

## The instrument

`build-requests.py` builds two arms from one base request: the **Dig cell's round-1 prisoner request**
(`checkpoints/2026-09-19-elaboration/Dig/`), which carries the fixture tile clause (*"Under the grit the
floor is packed earth, dry and crumbling, loose enough to scrape away by hand."*) and the `instrument`
question. Only the `intent` source's text is replaced, exactly as V0's supplement did, so every item is
asked against identical sources and identical questions.

- **OFF** (control): the base request, intent text replaced. Nothing else.
- **ON** (floor): OFF plus, and only these three edits ---
  1. a twelfth `desc:` source, `desc:floor`, in the guide's convention (material, condition, what could
     happen to it), declaring **no** route and **no** passage:
     > "The floor of the cell is packed earth under a thin layer of grit, dry and crumbling. It is loose
     > enough to scrape and dig away by hand, and what is dug out does not pack back: each pass leaves it
     > less solid than before."
  2. `floor` added to the `target` question's `answerKeys` (before `none`);
  3. `floor: integrity` added to the property question's object/property list. `integrity` is already a
     legal `property` key, so no key set changes there.

`build-requests.py` asserts structurally that the arms differ in exactly those three things and in
nothing else, item by item, and refuses to write if the property prompt's object list has moved.

**Known and deliberate incompleteness:** `floor` is *not* added to the `instrument` question's key set,
because the brief's edit list does not include it. A real game declaring a floor would carry it there
too. If a dig's `instrument` answer comes back `absent` where OFF said `none`, that is this omission and
not a finding.

`replay-f0.mts` replays one arm through the repository's own `replayRequestDetailed` and
`createRefereeTransport` (the shape of `2026-09-19-uncovered/replay-v0.mts`), N=5, referee `qwen3:14b`,
**thinking OFF** (`PRISONER_THINKING=off`; the owner's finding, confirmed in the search REPORT's own
re-run, is that thinking changes nothing on this task and is ~8x slower -- this differs from V0, which
ran thinking ON). Measured per item: the most-common key and agreement at `target`, `effect` and
`property`, with every citation kept. `score-f0.py` compares the arms and applies the kill numbers.

## The labelled set (13 items, labels a human's, fixed here)

**Digs (D), 4** -- predicted to move to `floor` / `wear` / `integrity` in ON:

| # | intent | recorded? |
|---|---|---|
| D1 | dig under the loose_tile | recorded (Dig) |
| D2 | dig under the loose_tile with my fingers | recorded (Dig) |
| D3 | scrape down through the floor with the spoon | **invented** (V0's supplement) |
| D4 | dig an escape tunnel | **invented** |

**Traps (T), 9** -- predicted to read *identically in both arms* at `target` and `effect`. Every one is
a recorded intent. T1--T3 are the §4.2 traps that contain the word the Dig probe was looking for and must
not move; T4--T5 are the welded-bar scrapes (`wear` is covered; the bar has no property); T6 is the bolt.

| # | intent | expected target / effect |
|---|---|---|
| T1 | Dig through the loose tile to see if there's anything hidden underneath. | `loose_tile` / `reveal` |
| T2 | Pry up the loose tile to see what's underneath | `loose_tile` / `reveal` |
| T3 | Scratch the loose tile to see if I can uncover something useful beneath it | `loose_tile` / `reveal` |
| T4 | Use the spoon and grit from the loose_tile to scrape the window bar's weld again | `bar` / `wear` |
| T5 | Use the spoon to strike the window's bar repeatedly | `bar` / `wear` |
| T6 | Use the spoon to push the door's bolt back | `door` / `open` |
| T7 | Use the spoon to strike the lock repeatedly | `lock` / `wear` |
| T8 | Use the loose tile to hide the spoon under it | `conceal` (target contestable: `spoon` or `loose_tile`) |
| T9 | Bend the spoon into a hook | `spoon` / `derive` |

T8's target is genuinely ambiguous between the thing hidden and the thing it is hidden under, and T9's
`product` is the known uncovered class (no `hook` kind). Neither is scored on its absolute value: a trap
is judged **only** on whether ON differs from OFF.

## Predictions

- **D1--D4 in ON: `floor` / `wear` / `integrity`, 4/4 at `target` and `effect`.** The floor's description
  gives the dig somewhere to land, and `wear` is the only kind whose gloss ("lower a property: scraping,
  chipping...") names removing material. My confidence is highest on D3 and D4, which name the floor or a
  tunnel outright, and lowest on D1/D2, which name the *tile*: "dig under the loose_tile" says the tile's
  id, and the referee's `target` question asks which object the intent acts on, citing the intent's own
  words -- the words say `loose_tile`. I still predict `floor`, because the tile clause and the new floor
  description both put packed earth under it, but **D1 and D2 are where this fails if it fails.**
  `property=integrity` I expect to follow `effect=wear` mechanically: it is the only property `floor` has.
- **T1--T9: 0 moved.** The traps all name their object explicitly and none of them acts on earth.
- **Agreement >= 80% at `target` and `effect` on at least 11 of 13 items in each arm.** Thinking OFF at
  temperature 0 was stable in V0 (12/12) and in the two-pass search.
- **D1--D4 in OFF: `loose_tile`, effect `reveal` or `expose` or `derive`.** This reproduces §66.6 and the
  probes; if OFF's digs *already* read something other than the tile, the control has not reproduced the
  problem and the ON arm proves nothing.

## Kill numbers, named in advance

- **Reading kill:** fewer than **3 of 4** digs read `target=floor` **and** `effect=wear` in ON -> the
  floor object does not fix the reading.
- **Precision kill:** **any** trap's most-common `target` or `effect` differs between OFF and ON -> the
  floor object steals rulings it should not.
- Either kills it. Both must hold for the reading to be worth anything further.
- **Not a kill, reported:** a dig landing `floor`/`wear` but `property != integrity`; a trap moving only
  at `property`; an `instrument` answer changing (see the known incompleteness above); agreement below
  80% on an item (reported per item, never as one number).

**Genuinely open, not predicted:** whether the two invented digs behave like the two recorded ones;
whether `floor` also swallows the grit-derive family (none of which is in this set); and whether the
referee's citation guard accepts a `property` citation from `desc:floor` at all, since the floor's
description is the only source in the request that no recorded game ever carried.

**No label is changed after seeing results.** The results files are committed unedited.

## What this cannot tell you

Whether a mind ever attempts a dig often enough for the reading to matter; whether the elaboration path
then completes; and whether the floor belongs in the toll-booth fixture (design §6.7 / landing-order P7,
gated on D7) rather than anywhere else. It tells you only whether the ruling a dig gets is the right one
when the surface it acts on exists. Nothing here touches `src/`, the benchmark scenario, or the engine.
