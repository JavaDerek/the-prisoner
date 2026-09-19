import glob, re, sys, os
# Mechanical only: counts markers this codebase itself writes into its own
# transcript (checkpointTranscript.ts lines 277/286/292). Never a judgement
# about what any prose means.
FIRED   = "**Elaboration considered:**"
ACQ     = "- **acquired:**"
NOACQ   = "- nothing acquired."
HALF_RE = re.compile(r"^### (Round (\d+) \(t=\d+\) -- the (prisoner|warden))$", re.M)

def halves(t):
    parts = HALF_RE.split(t)
    out=[]
    for i in range(1, len(parts), 4):
        out.append(dict(round=int(parts[i+1]), who=parts[i+2], body=parts[i+3]))
    return out

def ref_answer(body, q):
    m = re.search(r"^\|\s*%s\s*\|\s*`([^`]*)`" % q, body, re.M)
    return m.group(1) if m else None

def game(f):
    t = open(f, encoding="utf-8").read()
    hs = halves(t)
    fired_p = sum(1 for h in hs if h["who"]=="prisoner" and FIRED in h["body"])
    fired_w = sum(1 for h in hs if h["who"]=="warden"   and FIRED in h["body"])
    acqs=[]
    for h in hs:
        for m in re.finditer(r"- \*\*acquired:\*\* `([^.`]+)\.([^`]+)`, band `([^`]+)` \(([^)]+)\), start value (\d+)", h["body"]):
            acqs.append(dict(obj=m.group(1), need=m.group(2), band=m.group(3), src=m.group(4), who=h["who"], round=h["round"]))
    pursued=[]
    for a in acqs:
        for h in hs:
            if h["who"]!=a["who"] or h["round"]<=a["round"]: continue
            if ref_answer(h["body"],"target")==a["obj"] and ref_answer(h["body"],"property")==a["need"]:
                pursued.append((a,h["round"])); break
    esc = re.search(r"\*\*The (prisoner|warden) escaped, at round (\d+)\.\*\*", t)
    ratified=False
    if esc and acqs:
        for h in hs:
            if ref_answer(h["body"],"effect")=="leave" and ref_answer(h["body"],"target") in {a["obj"] for a in acqs}:
                ratified=True
    return dict(file=os.path.basename(f), fired_p=fired_p, fired_w=fired_w,
                acq=acqs, pursued=pursued, ratified=ratified,
                result=("escaped r%s"%esc.group(2)) if esc else "no escape",
                noacq=t.count(NOACQ))

for cell in sys.argv[1:]:
    fs=sorted(glob.glob(f"/tmp/batch-out/{cell}/*.md"))
    if not fs: print(f"=== cell {cell}: no transcripts yet ==="); continue
    gs=[game(f) for f in fs]; n=len(gs)
    print(f"=== cell {cell} (n={n}) ===")
    print(f"  fired  prisoner {sum(1 for g in gs if g['fired_p']>0)}/{n}   either {sum(1 for g in gs if g['fired_p'] or g['fired_w'])}/{n}")
    print(f"  acquired {sum(1 for g in gs if g['acq'])}/{n}   (explicit 'nothing acquired' lines: {sum(g['noacq'] for g in gs)})")
    print(f"  pursued  {sum(1 for g in gs if g['pursued'])}/{n}")
    print(f"  ratified {sum(1 for g in gs if g['ratified'])}/{n}")
    for g in gs:
        bits=",".join(f"{a['obj']}.{a['need']}:{a['band']}" for a in g['acq']) or "-"
        print(f"    {g['file'][:26]} fP={g['fired_p']} fW={g['fired_w']} acq[{bits}] purs={len(g['pursued'])} rat={g['ratified']} {g['result']}")
