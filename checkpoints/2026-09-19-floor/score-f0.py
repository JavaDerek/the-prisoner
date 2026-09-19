"""F0's step 4: score the two arms against the kill numbers in PREDICTION.md.

Counts keys the replay wrote. It never reads what an intent means: the D/T
labels come from build-requests.py, committed before the first call.

usage: python3 score-f0.py results-OFF-*.json results-ON-*.json   (or results-ON2-*.json for the encapsulation arm)
"""
import json, sys, glob

def load(pat):
    files = sorted(glob.glob(pat))
    if len(files) != 1:
        sys.exit(f"expected exactly one file matching {pat}, got {files}")
    return json.load(open(files[0]))

off = load(sys.argv[1] if len(sys.argv) > 1 else "results-OFF-*.json")
on = load(sys.argv[2] if len(sys.argv) > 2 else "results-ON-*.json")
O = {r["intent"]: r for r in off["results"]}
N = {r["intent"]: r for r in on["results"]}
assert set(O) == set(N), "arms do not cover the same items"

def key(r, site):
    return r[site]["key"]

print(f"OFF: {off['model']} thinking={off['thinking']} N={off['n']}   ON: {on['model']} thinking={on['thinking']} N={on['n']}")
print()
hdr = f"{'kind':4} {'OFF target/effect/property':34} {'ON target/effect/property':34} moved  intent"
print(hdr)
print("-" * len(hdr))
digs_landed, digs, moved_traps, traps = [], [], [], []
for r in on["results"]:
    i = r["intent"]
    o = O[i]
    trip_o = "/".join(str(key(o, s)) for s in ("target", "effect", "property"))
    trip_n = "/".join(str(key(r, s)) for s in ("target", "effect", "property"))
    same_te = key(o, "target") == key(r, "target") and key(o, "effect") == key(r, "effect")
    if r["kind"] == "D":
        digs.append(i)
        if key(r, "target") == "floor" and key(r, "effect") == "wear":
            digs_landed.append(i)
    else:
        traps.append(i)
        if not same_te:
            moved_traps.append(i)
    print(f"{r['kind']:4} {trip_o:34} {trip_n:34} {'MOVED' if not same_te else '     '}  {i[:60]}")

landed_int = [i for i in digs_landed if key(N[i], "property") == "integrity"]
print()
print(f"DIGS on floor/wear:            {len(digs_landed)}/{len(digs)}  [kill: < 3/4]")
print(f"  ... and property=integrity:  {len(landed_int)}/{len(digs)}  (the full predicted triple)")
print(f"TRAPS moved (target or effect): {len(moved_traps)}/{len(traps)}  [kill: any]"
      + ("  -> " + "; ".join(t[:50] for t in moved_traps) if moved_traps else ""))
dead = len(digs_landed) < 3 or len(moved_traps) > 0
print(f"VERDICT: the floor object is {'DEAD' if dead else 'ALIVE'} by the numbers named before the first call")
