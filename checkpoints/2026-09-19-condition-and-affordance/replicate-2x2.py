import json, re, time, urllib.request, pathlib, sys
LAB = "/Users/derekferguson/prisoner-prompt-lab"
HERE = pathlib.Path("/Users/derekferguson/rpg/the-prisoner/checkpoints/2026-09-19-condition-and-affordance")
N = int(sys.argv[1]) if len(sys.argv) > 1 else 10
CELLS = [("open+functional",   "prisoner-prompt-r1-susp-hidden.txt"),
         ("open+advertised",   "prisoner-prompt-r1-open-afford.txt"),
         ("welded+functional", "prisoner-prompt-r1-welded.txt"),
         ("welded+advertised", "prisoner-prompt-r1-welded-afford.txt")]
def is_derive(s):
    s = s or ""
    return bool(re.search(r"untwist", s, re.I) or
                (re.search(r"\bwire\b", s, re.I) and re.search(r"\bcot\b|\bspring", s, re.I)))
log = []
for cell, fname in CELLS:
    prompt = pathlib.Path(f"{LAB}/{fname}").read_text()
    for i in range(N):
        body = {"model":"qwen3:14b","messages":[{"role":"user","content":prompt}],
                "stream":False,"temperature":0.9}
        r = urllib.request.Request("http://doris:11434/v1/chat/completions",
                                   data=json.dumps(body).encode(),
                                   headers={"content-type":"application/json"})
        t0 = time.time()
        try:
            with urllib.request.urlopen(r, timeout=900) as resp: d = json.load(resp)
        except Exception as e:
            print(f"{cell:18} #{i+1} FAILED {e}", flush=True); continue
        m = d["choices"][0]["message"]; content = m.get("content") or ""
        try: obj = json.loads(content)
        except Exception:
            mm = re.search(r"\{.*\}", content, re.S)
            try: obj = json.loads(mm.group(0)) if mm else None
            except Exception: obj = None
        cands = [c.get("text","") for c in (obj or {}).get("candidates",[]) if isinstance(c,dict)]
        intent = (obj or {}).get("intent","")
        rec = dict(cell=cell, i=i, secs=round(time.time()-t0,1), parsed=obj is not None,
                   candidates=cands, intent=intent,
                   derive_cand=any(is_derive(c) for c in cands),
                   derive_intent=is_derive(intent),
                   reasoning=m.get("reasoning_content") or m.get("reasoning") or "")
        log.append(rec)
        print(f"{cell:18} #{i+1:2} parsed={rec['parsed']} cand={rec['derive_cand']:d} "
              f"intent={rec['derive_intent']:d} | {intent[:56]}", flush=True)
        (HERE/"replicate-2x2.json").write_text(json.dumps(log, indent=1))
print("done")
