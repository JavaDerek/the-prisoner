# F0 results: the floor object is DEAD by the numbers named before the first call

Run 2026-09-19 evening, code revision `8361eb9`, `src/` untouched. Referee `qwen3:14b` on doris
(resident at the start, restored at the end), thinking OFF, N=5, temperature 0. No game ran, no database
was opened, and `OPEN_OBJECTS` was not edited. Three arms, 13 items each, 195 reads, ~12 min of GPU.
Every result file is committed unedited; no label was changed after the first call.

## The numbers against the predictions

| arm | digs on `floor`/`wear` | traps moved | verdict (kill: <3/4, or any trap) |
|---|---|---|---|
| OFF (control, no floor) | 0/4 | — | control |
| ON (floor declared) | **1/4** | **0/9** | **DEAD** |
| ON2 (+ encapsulation authored) | **1/4** | **0/9** | **DEAD** |

`PREDICTION.md` predicted 4/4 for ON. `PREDICTION-ON2.md` predicted D1/D2 would move once the tile's
place in the floor was authored. **Both were wrong, and ON2 is byte-for-byte identical to ON on all 13
rows** (two distinct runs four minutes apart; the ON2 requests were asserted to carry the clause).
Every row in every arm read at 100% agreement.

| intent | OFF | ON | ON2 |
|---|---|---|---|
| dig under the loose_tile | `loose_tile`/`reveal`/`concealment` | *unchanged* | *unchanged* |
| dig under the loose_tile with my fingers | `loose_tile`/`reveal`/`concealment` | *unchanged* | *unchanged* |
| scrape down through the floor with the spoon | `none`/`wear`/`edge` | `floor`/`wear`/`integrity` | `floor`/`wear`/`integrity` |
| dig an escape tunnel | `none`/`none`/`none` | `floor`/`none`/`integrity` | `floor`/`none`/`integrity` |

The nine recorded traps did not move a single key in any arm. Precision is perfect: a declared surface
cost nothing.

## Why, from the citations the code wrote

The `target` question is answered from **the intent's own words**, and its prompt says so: *"Cite the
exact words in the actor's intent that name it."*

| intent | target | cited |
|---|---|---|
| dig under the loose_tile | `loose_tile` | "under the loose_tile" |
| dig under the loose_tile with my fingers | `loose_tile` | "loose_tile" |
| scrape down through the floor with the spoon | `floor` | "the floor" |
| dig an escape tunnel | `floor` | "dig an escape tunnel" (no object named) |

**When the intent contains a declared object's id verbatim, that object wins, 5/5, whatever any
description says about what lies beneath it.** The floor only won where the intent said "floor" or named
no object at all. D1's `property` answer cites *"beneath it is"* -- from the **tile's** description -- so
the model is reading the tile's text and never needs the floor's. The encapsulation clause was in front
of the model in ON2 and was simply irrelevant to the question that decides the target.

This is not a claim that the model cannot reason about containment. It is that the question which picks
the object is posed against the intent text, so containment authored in any description cannot reach it.

## Two findings the kill numbers do not credit

1. **The floor fixed the two digs that were falling off the world entirely.** In OFF, "scrape down
   through the floor with the spoon" ruled `wear` on the **spoon's** `edge` with target `none`, and "dig
   an escape tunnel" ruled `none`/`none`/`none`. Declaring the floor moved both onto `floor`/`integrity`.
   That is a real improvement on 2 of 4 digs -- it is just not the 3-of-4 named in advance, and the
   absorbed-onto-the-tile case (which is the one §66.6 is about) did not move at all.
2. **`dig an escape tunnel` is the purest `uncovered` case yet recorded.** Object found (`floor`),
   property found (`integrity`), and **no effect kind names excavating** -- so it lands as `effect: none`
   with no citation. That is exactly §66.6's collapse: "nothing grounds this" and "the vocabulary has no
   term for this" are the same answer. Declaring the floor did not create that; it *exposed* it, because
   before, the intent had no object to be uncovered about.

## Engine facts checked while reading this, neither of them acted on

- `items.owner_type` is `CHECK (owner_type IN ('character','location'))` (`src/db/schema.ts`), and
  `createItem`/`transferItem` take `ownerType: "character" | "location"` in TypeScript. **An item is
  never owned by another item**, at the schema and at the library API. There is no container vocabulary
  anywhere in the engine tree.
- The `relationships` table *would* take an item-to-item edge: `source_type`/`target_type` are plain TEXT
  with no CHECK, and the MCP schema is `z.string().max(100)` with 'character'/'faction' only in the
  description. What is absent is any interpretation of such an edge -- no traversal, no cascade on
  transfer, no versioning. And it could not reach this reading regardless: the-prisoner's open variant
  never calls `createRelationship` (0 hits in `src/`), and the referee sees only `desc:<id>` prose.

Nothing is filed. Hard rule 1 wants a real caller, and the-prisoner is not one: it needs the tile's place
in the floor, not a bag.

## What is open, for the owner

Per the brief this stops here: no `src/` change, no `OPEN_OBJECTS` change, no fixture, no engine issue.
The one-run experiment this result suggests, and does not take, is whether authoring the relation on the
**tile's** side rather than the floor's moves D1/D2 -- but the citation evidence above predicts it will
not, because the target question never consults a description. If that reading is right, a dig aimed at a
surface can only be redirected by changing **how the target question is posed**, which is a change to the
question set and therefore replays Appendix C at §4.8's kill numbers first.
