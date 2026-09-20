"""P0-self: can a person's own `posture` be reached by the referee at all?

The owner played the human seat with PRISONER_PRESENCE=modelled and typed
"pretend to have a heart attack". It was refused with "matches none of what is
here: window, bar, door, lock, spoon, loose tile, cot, blanket, bucket, meal
tray, key ring, warden" -- the warden present and targetable, her own body not.

Reading the tree found TWO independent blockers, not one:
  1. `briefing.ts:182-184` excludes the acting principal from her own
     `perceivedObjects` ("never itself (a principal is not its own target)"),
     so a self-directed act has no target key.
  2. `PROPERTY_ANSWER_KEYS` (`effects.ts:27-28`) is integrity/edge/concealment/
     passage/none -- `posture` is NOT a legal answer, and the property prompt
     hard-codes the same four in its own sentence. Meanwhile the real caller's
     `declaredPropertyKeys` (`world.ts:361-369`) DOES know persons, so the
     prompt's object list says "warden: posture" while no answer key admits it.
     Even an act on the WARDEN's posture must fall to `none`.

`posture` is fully specified in `OPEN_PERSONS` (min 0, max 100, initial 100,
wear 10/50/100) and is unreachable from either side.

Three arms off one base. Base = the Dig cell's round-1 prisoner request (fixture
tile clause, instrument checked) PLUS the warden, which reproduces exactly the
twelve-object list the owner saw. Only the `intent` source's text is replaced per
item, so every item sees identical sources and questions.

  OFF      = base + warden, property list says "warden: posture", answer keys
             UNCHANGED (no posture). This is today's behaviour, contradiction included.
  POSTURE  = OFF + `posture` made answerable (added to the property answerKeys AND
             to the prompt's own "one of:" sentence). Self still not targetable.
  SELF     = POSTURE + the actor herself: a `desc:prisoner` source, `prisoner` in
             the target keys, "prisoner: posture" in the property list.

Neither blocker can be fixed alone, which is why POSTURE sits between: it isolates
whether a person's posture reads at all when it is merely answerable.

Lexical and structural only. The S/O/T labels are a human's, fixed before the
first call in PREDICTION.md beside this file.
"""
import json, copy, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "2026-09-19-elaboration"

WARDEN_DESC = ("Warden Croft, the warden. She can be seen, heard, spoken to, or touched by anyone who "
               "shares this room with her. She is on her feet.")
PRISONER_DESC = ("Mara Voss, the prisoner. She can be seen, heard, spoken to, or touched by anyone who "
                 "shares this room with her. She is on her feet.")

PROP_ANCHOR = ". Name only a property the target has"
POSTURE_KEYS_ANCHOR = "passage (whether a way out is open, for open and close), or none "
POSTURE_KEYS_NEW = ("passage (whether a way out is open, for open and close), posture (a person's own bounded "
                    "physical state -- on her feet, crouched low, or lying on the floor), or none ")

# (kind, intent). S = acts on the actor's own body, want target `prisoner`.
# O = acts on the other person, want target `warden`. T = trap, must not move.
# X = reported, never counted (genuinely ambiguous).
ITEMS = [
    ("S", "pretend to have a heart attack"),                 # the owner's own turn, verbatim
    ("S", "drop to the ground and clutch my chest"),
    ("S", "collapse on the floor and lie still"),
    ("S", "crouch down low"),
    ("O", "push Croft to the floor"),
    ("X", "shout for help"),
    ("T", "Use the spoon to strike the lock repeatedly"),
    ("T", "Pry up the loose tile to see what's underneath"),
    ("T", "Use the spoon to push the door's bolt back"),
    ("T", "Use the spoon and grit from the loose_tile to scrape the window bar's weld again"),
]

BASE_CELL, BASE_INTENT = "Dig", "dig under the loose_tile"


def find(cell, intent):
    want = f", prisoner: {intent}"
    for f in sorted((SRC / cell).glob("*.referee.json")):
        for e in json.load(open(f)):
            if e["label"].endswith(want) and ", elaboration: " not in e["label"]:
                return f.relative_to(SRC.parent).as_posix(), e["request"]
    sys.exit(f"not found: {cell} / {intent}")


def add_person(r, pid, desc, before_none=True):
    """Add a person exactly as briefing/referee would: a desc source, a target
    key, and an entry in the property question's object list."""
    r["sources"].append({"id": f"desc:{pid}", "text": desc})
    tq = next(q for q in r["questions"] if q["id"] == "target")
    assert tq["answerKeys"][-1] == "none" and pid not in tq["answerKeys"]
    tq["answerKeys"] = [*tq["answerKeys"][:-1], pid, "none"]
    pq = next(q for q in r["questions"] if q["id"] == "property")
    assert pq["prompt"].count(PROP_ANCHOR) == 1, "the property prompt's object list moved"
    pq["prompt"] = pq["prompt"].replace(PROP_ANCHOR, f"; {pid}: posture. Name only a property the target has")
    return r


def off(base, intent):
    r = copy.deepcopy(base)
    assert r["sources"][0]["id"] == "intent"
    r["sources"][0]["text"] = intent
    return add_person(r, "warden", WARDEN_DESC)


def posture(base, intent):
    r = off(base, intent)
    pq = next(q for q in r["questions"] if q["id"] == "property")
    assert "posture" not in pq["answerKeys"]
    assert pq["prompt"].count(POSTURE_KEYS_ANCHOR) == 1, "the property prompt's key sentence moved"
    pq["prompt"] = pq["prompt"].replace(POSTURE_KEYS_ANCHOR, POSTURE_KEYS_NEW)
    pq["answerKeys"] = [*pq["answerKeys"][:-1], "posture", "none"]
    return r


def selfarm(base, intent):
    r = posture(base, intent)
    return add_person(r, "prisoner", PRISONER_DESC)


src, base = find(BASE_CELL, BASE_INTENT)
rows = [dict(label=f"{k}: {i}", kind=k, intent=i, source=src) for k, i in ITEMS]
for name, fn in (("P-OFF.json", off), ("P-POSTURE.json", posture), ("P-SELF.json", selfarm)):
    (HERE / name).write_text(json.dumps([dict(r, request=fn(base, r["intent"])) for r in rows], indent=1))
    print(name, len(rows), "requests")

a = json.load(open(HERE / "P-OFF.json"))
b = json.load(open(HERE / "P-POSTURE.json"))
c = json.load(open(HERE / "P-SELF.json"))
for x, y, z in zip(a, b, c):
    assert x["request"]["sources"] == y["request"]["sources"], "POSTURE must change no source"
    assert [s["id"] for s in z["request"]["sources"]] == [s["id"] for s in y["request"]["sources"]] + ["desc:prisoner"]
    for qx, qy in zip(x["request"]["questions"], y["request"]["questions"]):
        if qx["id"] == "property":
            assert qy["answerKeys"] == [*qx["answerKeys"][:-1], "posture", "none"]
            assert qy["prompt"] == qx["prompt"].replace(POSTURE_KEYS_ANCHOR, POSTURE_KEYS_NEW)
        else:
            assert qx == qy, qx["id"]
    tq_y = next(q for q in y["request"]["questions"] if q["id"] == "target")
    tq_z = next(q for q in z["request"]["questions"] if q["id"] == "target")
    assert tq_z["answerKeys"] == [*tq_y["answerKeys"][:-1], "prisoner", "none"]
print("OFF->POSTURE = the property question's keys+sentence only; POSTURE->SELF = the actor added")
for r in rows:
    print(f"  {r['kind']} {r['intent'][:70]}")
