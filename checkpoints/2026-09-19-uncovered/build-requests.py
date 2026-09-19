"""V0's instrument, step 1 and 2 (WORLD-ELABORATION-DESIGN-2.md §4.1): select the
labelled recorded requests (Appendix C, labels as confirmed by the owner
2026-09-19) out of the 2026-09-19-elaboration sidecars by their exact label
strings, and rewrite each into Form K and Form Q. Lexical and structural only:
this reads JSON, edits JSON, and never reads what an intent means. The labels
(U/C/N) are a human's, made before the first call and committed here.

Writes V-K.json and V-Q.json beside this file: `{label, kind, site, request}[]`,
which is `npm run referee-replay`'s own `{label, request}[]` shape plus two
fields replay-v0.mts reads and the CLI ignores.
"""
import json, glob, copy, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "2026-09-19-elaboration"

# (kind, site, cell-dir-or-P0, intent text exactly as recorded). One request
# per row: the first recorded prisoner half-round in that cell whose label ends
# with the intent. Kinds: U = should read uncovered; C = cleanly modelled, must
# keep its key; N = modelled but ungrounded, must keep its key; X = excluded
# (ambiguous), replayed and reported, never counted; S = supplement, invented,
# reported separately, never pooled with the recorded items.
ITEMS = [
    ("U", "effect",  "Dig", "dig under the loose_tile"),
    ("U", "effect",  "Dig", "dig under the loose_tile with my fingers"),
    ("U", "product", "P0",  "Bend the spoon into a hook"),
    ("U", "product", "P0",  "Continue bending the spoon to form a more precise hook"),
    ("C", "effect",  "B",   "Pry up the loose tile to see what's underneath"),
    ("C", "effect",  "P0",  "Dig through the loose tile to see if there's anything hidden underneath."),
    ("C", "effect",  "Bon", "Use the spoon to push the door's bolt back"),
    ("C", "effect",  "P0",  "Use the loose tile to hide the spoon under it"),
    ("C", "effect",  "Bon", "Use the spoon to strike the lock repeatedly"),
    ("C", "effect",  "C1",  "Climb through the open door"),
    ("N", "effect",  "C1",  "Use the spoon and grit from the loose_tile to scrape the window bar's weld again"),
    ("N", "effect",  "Bon", "Use the spoon to strike the window's bar repeatedly"),
    ("X", "effect",  "B",   "Try to bend the spoon to see if it can be used for something"),
    ("X", "effect",  "B",   "Bend the spoon to see if it can fit through the window bars"),
    ("X", "effect",  "P0",  "Use the grit from the loose tile to refine the spoon's edge in secret"),
]
# Invented, asked against the Dig cell's round-1 request (fixture tile clause,
# instrument checked) with only the `intent` source's text replaced.
SUPPLEMENT_BASE = ("Dig", "dig under the loose_tile")
SUPPLEMENT = [
    ("S", "effect",  "scrape down through the floor with the spoon"),
    ("S", "effect",  "wedge the spoon under the door to jam it shut"),
    ("S", "effect",  "set fire to the blanket"),
    ("S", "product", "tie the blanket into a rope"),
]

K_EFFECT = (" If none of the kinds above names what the intent attempts, answer uncovered and cite the words "
            "of the intent that name what is attempted.")
K_PRODUCT = (" If the effect is derive and none of the kinds above names what is made, answer uncovered and "
             "cite the words of the intent that name what is made.")
Q_COVERAGE = {
    "id": "coverage",
    "prompt": ("Is what the intent attempts named by one of the effect kinds listed in the effect question "
               "below? covered if one of them names it; uncovered if none does. Cite the words of the intent "
               "that name what is attempted."),
    "answerKeys": ["covered", "uncovered"],
    "safeDefault": "covered",
}
Q_PRODUCT_COVERAGE = {
    "id": "product_coverage",
    "prompt": ("If the effect is derive: is the thing the actor makes one of the kinds listed in the product "
               "question above? covered if one of them names it, or if the effect is not derive; uncovered if "
               "the actor makes a thing none of them names. Cite the words of the intent that name what is made."),
    "answerKeys": ["covered", "uncovered"],
    "safeDefault": "covered",
}


def sidecars(cell):
    if cell == "P0":
        return sorted(SRC.glob("2026-09-19T14-*.referee.json"))
    return sorted((SRC / cell).glob("*.referee.json"))


def find(cell, intent):
    want = f", prisoner: {intent}"
    for f in sidecars(cell):
        for e in json.load(open(f)):
            if e["label"].endswith(want) and ", elaboration: " not in e["label"]:
                return f.relative_to(SRC.parent).as_posix(), e["label"], e["request"]
    sys.exit(f"not found: {cell} / {intent}")


def form_k(req):
    r = copy.deepcopy(req)
    for q in r["questions"]:
        if q["id"] == "effect":
            q["answerKeys"] = [*q["answerKeys"], "uncovered"]
            q["prompt"] = q["prompt"] + K_EFFECT
        if q["id"] == "product":
            q["answerKeys"] = [*q["answerKeys"], "uncovered"]
            q["prompt"] = q["prompt"] + K_PRODUCT
    return r


def form_q(req):
    r = copy.deepcopy(req)
    out = []
    for q in r["questions"]:
        out.append(q)
        if q["id"] == "target":
            out.append(copy.deepcopy(Q_COVERAGE))
        if q["id"] == "product":
            out.append(copy.deepcopy(Q_PRODUCT_COVERAGE))
    r["questions"] = out
    return r


rows = []
for kind, site, cell, intent in ITEMS:
    src, label, req = find(cell, intent)
    tag = "[excluded] " if kind == "X" else ""
    rows.append(dict(label=f"{tag}{label}", kind=kind, site=site, source=src, request=req))

src, base_label, base = find(*SUPPLEMENT_BASE)
for kind, site, text in SUPPLEMENT:
    req = copy.deepcopy(base)
    assert req["sources"][0]["id"] == "intent"
    req["sources"][0]["text"] = text
    rows.append(dict(label=f"[supplement] round 1, prisoner: {text}", kind=kind, site=site,
                     source=f"{src} (intent text replaced)", request=req))

for name, fn in (("V-K.json", form_k), ("V-Q.json", form_q)):
    out = [dict(r, request=fn(r["request"])) for r in rows]
    (HERE / name).write_text(json.dumps(out, indent=1))
    print(name, len(out), "requests")
for r in rows:
    print(f"  {r['kind']} {r['site']:7} {r['label'][:70]}")
