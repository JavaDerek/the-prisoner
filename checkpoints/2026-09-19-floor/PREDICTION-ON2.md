# Addendum: the encapsulation arm (ON2), pre-committed before its first call

Written 2026-09-19, **after the OFF arm landed and while the ON arm was still running**, and **before
any ON2 call**. It changes nothing in `PREDICTION.md`: the OFF and ON arms' kill numbers stand exactly
as committed at `4233302`, and no label is touched.

## What the first prediction missed

The owner, reading `PREDICTION.md`: *"you have likely missed an encapsulation relationship. Something
like 'the tile' -- is in --> 'the floor'."*

That is right, and it is not the same thing I wrote down. `PREDICTION.md` names D1/D2 as the fragile
digs because *"the words say `loose_tile`"* -- a fact about the citation. The real gap is a fact about
the world: **the ON arm declares `floor` and `loose_tile` as two siblings with no stated relation
between them.** The tile's description names the floor in words (*"Under the grit the floor is packed
earth"*), but nothing says the region *under the tile* is part of the object `floor`. So "dig under the
loose_tile" has no authored path from the tile to the floor, and the model's only grounded reading is
the one it has always given: the tile, `reveal`, `concealment`.

**The engine cannot supply the relation.** `run-dmcp/src/db/schema.ts` declares
`items.owner_type TEXT NOT NULL CHECK (owner_type IN ('character', 'location'))`: an item is owned by a
character or a location and never by another item. There is no item-in-item containment, so
encapsulation between a surface and a thing set into it is **authorable in prose or nowhere** -- which
means it can be tested today, with no engine change and nothing filed.

The OFF arm also showed a second failure mode `PREDICTION.md` did not separate, and it bears on this:
the two digs that name the *floor* (D3, D4) read `target: none` at 100% agreement -- they fall off the
world entirely rather than being absorbed. Absorption and non-existence are two different failures, and
only the first is what §66.6 described.

## ON2

`build-encaps.py` writes `F-ON2.json` = `F-ON.json` with **one source's text changed and nothing else**,
asserted structurally item by item: `desc:floor` gains the encapsulation.

> "The floor of the cell is packed earth under a thin layer of grit, dry and crumbling. **The loose clay
> tile is set into this floor beside the cot, and the shallow hollow beneath the tile is a dip in the same
> packed earth.** It is loose enough to scrape and dig away by hand, and what is dug out does not pack
> back: each pass leaves it less solid than before."

Still no route, still no `passage`; `integrity` remains the floor's only property. The tile's own
description is **not** touched, so the traps see byte-identical text to OFF and ON at every source but
the floor's. Same 13 items, same labels, same referee (`qwen3:14b`), thinking off, N=5.

## Predictions for ON2

- **D1, D2 ("dig under the loose_tile", "... with my fingers"): `floor` / `wear` / `integrity`.** This is
  the arm's whole point: with the hollow declared as a dip in the floor's own earth, "under the tile" now
  has an object. I hold this less confidently than I held ON's 4/4 -- the tile is still the noun the
  intent names, and the tile's own text still frames it as a lid.
- **D3, D4 ("scrape down through the floor...", "dig an escape tunnel"): `floor` / `wear` / `integrity`.**
  These need nothing from the encapsulation; they name the floor and a tunnel. If they do not land in ON
  either, the floor description itself is at fault and ON2 will not rescue them.
- **The traps: 0 moved against OFF**, and this is where ON2 is most exposed. T1--T3 ("dig through / pry up
  / scratch the loose tile **to see** what's underneath") aim at the hollow, and the floor's description
  now mentions that hollow. A trap that moves to `floor` here means the encapsulation clause has made the
  floor the owner of the thing the tile was hiding, and the reading has bought the digs by stealing the
  reveals. I predict they hold, because all three state an aim of looking and the aim is what the `effect`
  prompt says to judge by -- but I would not be surprised to be wrong, and it is the more useful failure.
- **Agreement >= 80% at `target` and `effect` on at least 11 of 13 items.** OFF was 13/13 at 100%.

## Kill numbers for ON2 -- the same numbers, unchanged

- **Reading kill:** fewer than **3 of 4** digs read `target=floor` **and** `effect=wear` -> authoring the
  encapsulation does not fix the reading either.
- **Precision kill:** **any** trap's most-common `target` or `effect` differs from the OFF arm -> the
  floor object steals rulings it should not.

## What each outcome means, named before the call

| ON | ON2 | reading |
|---|---|---|
| passes | -- | declaring the surface is enough; the encapsulation is not needed for this reading (ON2 is then a second confirmation, not a rescue) |
| fails | passes | **declaring the surface is necessary but not sufficient: the containment has to be authored too.** A stronger authoring lesson than the question asked, and the guide's fourth lesson is incomplete without it |
| fails | fails on recall | the reading does not come from authoring at this level; the dig stays absorbed, and nothing here proceeds |
| either | fails on precision | a declared surface cannibalises the rulings that were already right; the convention is not free and the guide must say so |

ON2 does not rescue ON. If ON fails its own numbers it failed them, and the report says so.
