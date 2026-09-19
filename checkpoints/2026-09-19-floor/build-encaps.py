"""F0's third arm, added after the owner's reading of the prediction and after
the OFF arm landed, before the ON2 arm ran: author the ENCAPSULATION.

The owner's point: the prediction missed a relationship. The tile **is in** the
floor. F-ON.json declares `floor` and `loose_tile` as two siblings with no stated
relation between them, so "dig under the loose_tile" has no authored path from the
tile to the floor -- and the engine cannot supply one, because `items.owner_type`
is CHECK IN ('character','location') (run-dmcp `src/db/schema.ts`): an item is
never owned by another item, so containment between two items is authorable in
prose or nowhere.

ON2 = ON with ONE source's text changed and nothing else: `desc:floor` gains the
encapsulation -- the tile is set into the floor, and the hollow beneath the tile is
a dip in that same earth. Every other source, every question, and every answer key
is byte-identical to the ON arm, so ON2 - ON is the encapsulation clause alone.

Writes F-ON2.json. Lexical and structural only. The labels are unchanged from
build-requests.py; nothing is relabelled.
"""
import json, copy, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent

# ON's floor description (the sibling, no relation stated).
FLOOR_ON = (
    "The floor of the cell is packed earth under a thin layer of grit, dry and crumbling. "
    "It is loose enough to scrape and dig away by hand, and what is dug out does not pack "
    "back: each pass leaves it less solid than before."
)
# ON2's: the same floor, with the tile's place in it authored. Still no route and
# no passage -- `integrity` remains the only property the floor has.
FLOOR_ON2 = (
    "The floor of the cell is packed earth under a thin layer of grit, dry and crumbling. "
    "The loose clay tile is set into this floor beside the cot, and the shallow hollow beneath "
    "the tile is a dip in the same packed earth. "
    "It is loose enough to scrape and dig away by hand, and what is dug out does not pack "
    "back: each pass leaves it less solid than before."
)

on = json.load(open(HERE / "F-ON.json"))
out = []
for row in on:
    r = copy.deepcopy(row)
    floors = [s for s in r["request"]["sources"] if s["id"] == "desc:floor"]
    assert len(floors) == 1 and floors[0]["text"] == FLOOR_ON, "F-ON.json's floor source is not what ON ran"
    floors[0]["text"] = FLOOR_ON2
    out.append(r)
(HERE / "F-ON2.json").write_text(json.dumps(out, indent=1))
print("F-ON2.json", len(out), "requests")

# Structural proof that ON2 - ON is exactly the one source's text.
a, b = json.load(open(HERE / "F-ON.json")), json.load(open(HERE / "F-ON2.json"))
for x, y in zip(a, b):
    assert x["label"] == y["label"] and x["intent"] == y["intent"] and x["kind"] == y["kind"]
    assert x["request"]["questions"] == y["request"]["questions"], "a question changed"
    assert [s["id"] for s in x["request"]["sources"]] == [s["id"] for s in y["request"]["sources"]]
    diffs = [sx["id"] for sx, sy in zip(x["request"]["sources"], y["request"]["sources"]) if sx != sy]
    assert diffs == ["desc:floor"], f"changed sources: {diffs}"
print("ON2 - ON = the text of desc:floor, and nothing else")
