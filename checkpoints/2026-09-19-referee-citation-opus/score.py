# Score one capture: accuracy against the expected key in each label, and
# what the citation apparatus actually did at this rung.
import json, sys, collections
path = sys.argv[1]
rows = json.load(open(path))

right = wrong = 0
uncited_total = 0
discard_right = discard_wrong = 0   # a discarded (uncited) answer that WAS / WASN'T correct
misses = []
by_expected = collections.Counter()
right_by_expected = collections.Counter()

def expected_of(r):
    import re
    m = re.search(r"\[expect ([\w-]+)\]", r["label"])
    raw = m.group(1) if m else "?"
    # "none-of-open" is the corpus's way of saying "not an open-family key",
    # which the turn reader answers as `none`.
    return "none" if raw.startswith("none") else raw

for r in rows:
    exp, final = expected_of(r), r.get("finalEffect")
    by_expected[exp] += 1
    if final == exp:
        right += 1; right_by_expected[exp] += 1
    else:
        wrong += 1
        misses.append((r["label"], exp, final, r.get("offeredEffect")))

    oe = r.get("offeredEffect") or {}
    if oe and not oe.get("citation"):
        uncited_total += 1
        # The apparatus discarded this. Would it have been right?
        if oe.get("key") == exp: discard_right += 1
        else: discard_wrong += 1

n = len(rows)
print(f"corpus: {n} rulings")
print(f"CORRECT: {right}/{n}  ({100*right/n:.1f}%)")
print()
print("by expected key:")
for k in sorted(by_expected):
    print(f"  {k:10} {right_by_expected[k]}/{by_expected[k]}")
print()
print("--- what the citation apparatus did ---")
print(f"answers the model returned UNCITED (so discarded -> safe default): {uncited_total}/{n}")
if uncited_total:
    print(f"  of those, the discarded answer would have been CORRECT: {discard_right}")
    print(f"  of those, the discarded answer would have been WRONG:   {discard_wrong}")
    verdict = ("HURTING at this rung -- it is losing right answers"
               if discard_right > discard_wrong else
               "EARNING ITS KEEP -- it is catching wrong answers")
    print(f"  verdict: {verdict}")
else:
    print("  verdict: COSTS NOTHING AND PROTECTS NOTHING at this rung --")
    print("           every answer arrived with a citation, so the check never fired.")
if misses:
    print()
    print("misses:")
    for label, exp, final, oe in misses:
        print(f"  {label}\n      expected={exp} final={final} offered={oe}")
