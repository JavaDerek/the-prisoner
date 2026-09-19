"""F0's instrument, steps 1 and 2: build the two arms of the floor-object probe.

The question (OPEN-VARIANT.md §67.5's one hole, AUTHORING-GUIDE.md's fourth
lesson): does declaring the floor as an object make a dig land on
`floor`/`wear`/`integrity` -- reaching the existing elaboration path -- without
moving any ruling that is already right?

One base request for every item: the Dig cell's round-1 prisoner request, which
carries the fixture tile clause and the instrument question (checked arm). Only
the `intent` source's text is replaced, exactly as V0's supplement did, so every
item is asked against identical sources and identical questions and the two arms
differ in one thing only.

  OFF  (control): the base request, intent text replaced. Nothing else.
  ON   (floor):   OFF plus, and only:
                    - a twelfth `desc:` source, `desc:floor`
                    - `floor` added to the `target` question's answerKeys
                    - `floor: integrity` added to the property question's
                      object/property list

Lexical and structural only: this reads JSON, edits JSON, and never reads what
an intent means. The labels (D/T) are a human's, made before the first call and
committed in PREDICTION.md beside this file.

Writes F-OFF.json and F-ON.json: `{label, kind, intent, request}[]`, which is
`npm run referee-replay`'s own `{label, request}[]` shape plus two fields the
replay script reads and the CLI ignores.
"""
import json, copy, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "2026-09-19-elaboration"

# The floor's own description, in AUTHORING-GUIDE.md's convention for a surface:
# material, condition, and what could happen to it. It declares no route and no
# passage -- `integrity` is the only property the arm gives it -- so it cannot
# imply more than the world models (that guide's second lesson).
FLOOR_DESC = (
    "The floor of the cell is packed earth under a thin layer of grit, dry and crumbling. "
    "It is loose enough to scrape and dig away by hand, and what is dug out does not pack "
    "back: each pass leaves it less solid than before."
)

# (kind, intent text). D = a dig, predicted to move to floor/wear/integrity in
# the ON arm; T = a trap, predicted to read identically in both arms.
# "rec" in the comment marks an intent recorded in a real game; the two invented
# ones are marked and named as invented in every report.
ITEMS = [
    ("D", "dig under the loose_tile"),                                                    # rec, Dig
    ("D", "dig under the loose_tile with my fingers"),                                    # rec, Dig
    ("D", "scrape down through the floor with the spoon"),                                # INVENTED (V0 supplement)
    ("D", "dig an escape tunnel"),                                                        # INVENTED
    ("T", "Dig through the loose tile to see if there's anything hidden underneath."),     # rec, P0
    ("T", "Pry up the loose tile to see what's underneath"),                              # rec, B
    ("T", "Scratch the loose tile to see if I can uncover something useful beneath it"),   # rec
    ("T", "Use the spoon and grit from the loose_tile to scrape the window bar's weld again"),  # rec, C1
    ("T", "Use the spoon to strike the window's bar repeatedly"),                          # rec, Bon
    ("T", "Use the spoon to push the door's bolt back"),                                   # rec, Bon
    ("T", "Use the spoon to strike the lock repeatedly"),                                  # rec, Bon
    ("T", "Use the loose tile to hide the spoon under it"),                                # rec, P0
    ("T", "Bend the spoon into a hook"),                                                   # rec, P0
]
INVENTED = {"scrape down through the floor with the spoon", "dig an escape tunnel"}

BASE_CELL, BASE_INTENT = "Dig", "dig under the loose_tile"

PROP_ANCHOR = "key_ring: none. Name only"
PROP_WITH_FLOOR = "key_ring: none; floor: integrity. Name only"


def find(cell, intent):
    want = f", prisoner: {intent}"
    for f in sorted((SRC / cell).glob("*.referee.json")):
        for e in json.load(open(f)):
            if e["label"].endswith(want) and ", elaboration: " not in e["label"]:
                return f.relative_to(SRC.parent).as_posix(), e["request"]
    sys.exit(f"not found: {cell} / {intent}")


def off(base, intent):
    r = copy.deepcopy(base)
    assert r["sources"][0]["id"] == "intent"
    r["sources"][0]["text"] = intent
    return r


def on(base, intent):
    r = off(base, intent)
    assert [s["id"] for s in r["sources"]].count("desc:floor") == 0
    r["sources"].append({"id": "desc:floor", "text": FLOOR_DESC})
    tq = next(q for q in r["questions"] if q["id"] == "target")
    assert tq["answerKeys"][-1] == "none" and "floor" not in tq["answerKeys"]
    tq["answerKeys"] = [*tq["answerKeys"][:-1], "floor", "none"]
    pq = next(q for q in r["questions"] if q["id"] == "property")
    assert pq["prompt"].count(PROP_ANCHOR) == 1, "property prompt's object list moved"
    pq["prompt"] = pq["prompt"].replace(PROP_ANCHOR, PROP_WITH_FLOOR)
    assert "integrity" in pq["answerKeys"], "integrity is already a legal key; no key change needed"
    return r


src, base = find(BASE_CELL, BASE_INTENT)
rows = []
for kind, intent in ITEMS:
    tag = "[invented] " if intent in INVENTED else ""
    rows.append(dict(label=f"{tag}{kind}: {intent}", kind=kind, intent=intent, source=src))

for name, fn in (("F-OFF.json", off), ("F-ON.json", on)):
    out = [dict(r, request=fn(base, r["intent"])) for r in rows]
    (HERE / name).write_text(json.dumps(out, indent=1))
    print(name, len(out), "requests")

# Structural proof that the two arms differ in exactly the three edits above.
a = json.load(open(HERE / "F-OFF.json"))
b = json.load(open(HERE / "F-ON.json"))
for x, y in zip(a, b):
    assert x["label"] == y["label"]
    assert [s["id"] for s in y["request"]["sources"]] == [s["id"] for s in x["request"]["sources"]] + ["desc:floor"]
    for sx, sy in zip(x["request"]["sources"], y["request"]["sources"]):
        assert sx == sy, sx["id"]
    assert [q["id"] for q in x["request"]["questions"]] == [q["id"] for q in y["request"]["questions"]]
    for qx, qy in zip(x["request"]["questions"], y["request"]["questions"]):
        if qx["id"] == "target":
            assert qx["prompt"] == qy["prompt"]
            assert qy["answerKeys"] == [*qx["answerKeys"][:-1], "floor", "none"]
        elif qx["id"] == "property":
            assert qx["answerKeys"] == qy["answerKeys"]
            assert qy["prompt"] == qx["prompt"].replace(PROP_ANCHOR, PROP_WITH_FLOOR)
        else:
            assert qx == qy, qx["id"]
print("arms differ in exactly: +desc:floor source, +floor target key, +'floor: integrity' in the property list")
for r in rows:
    print(f"  {r['kind']} {r['label'][:80]}")
