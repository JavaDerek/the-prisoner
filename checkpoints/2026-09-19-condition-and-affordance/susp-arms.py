# Three arms, identical prompts but for one line: does showing her the suspicion
# balance change how bold she is? Hits doris directly -- the shim has
# reasoning_effort=none injected and would suppress the thinking channel.
import json, re, sys, time, urllib.request, pathlib

LAB = "/Users/derekferguson/prisoner-prompt-lab"
OUT = pathlib.Path("/private/tmp/claude-501/-Users-derekferguson-rpg/ef7486ad-4b26-4d7f-8e97-927aac813f66/scratchpad")
MODEL = "qwen3:14b"
EFFORT = sys.argv[1] if len(sys.argv) > 1 else ""   # "" = unset, the real game condition
N = int(sys.argv[2]) if len(sys.argv) > 2 else 5

ARMS = [("hidden", "prisoner-prompt-r1-susp-hidden.txt"),
        ("susp=0", "prisoner-prompt-r1-susp-0.txt"),
        ("susp=35", "prisoner-prompt-r1-susp-35.txt")]

# "works a piece loose from the cot" is derive -- the act 0 of 14 games attempted.
DERIVE = re.compile(r"\b(cot|spring|wire|frame|crossbar)\b", re.I)
BAR    = re.compile(r"\bbar\b", re.I)
BUDGET = re.compile(r"suspicion", re.I)

def ask(prompt):
    body = {"model": MODEL, "messages": [{"role": "user", "content": prompt}],
            "stream": False, "temperature": 0.9}
    if EFFORT: body["reasoning_effort"] = EFFORT
    r = urllib.request.Request("http://doris:11434/v1/chat/completions",
                               data=json.dumps(body).encode(),
                               headers={"content-type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(r, timeout=900) as resp: d = json.load(resp)
    m = d["choices"][0]["message"]
    return (time.time()-t0, m.get("reasoning_content") or m.get("reasoning") or "",
            m.get("content") or "")

def parse(text):
    try: return json.loads(text)
    except Exception: pass
    mm = re.search(r"\{.*\}", text, re.S)
    if mm:
        try: return json.loads(mm.group(0))
        except Exception: return None
    return None

log = []
tag = EFFORT or "unset"
for arm, fname in ARMS:
    prompt = pathlib.Path(f"{LAB}/{fname}").read_text()
    for i in range(N):
        try:
            el, think, content = ask(prompt)
        except Exception as e:
            print(f"{arm:8} #{i+1} FAILED {e}", flush=True); continue
        obj = parse(content)
        cands = [c.get("text","") for c in (obj or {}).get("candidates", []) if isinstance(c, dict)]
        intent = (obj or {}).get("intent", "")
        thoughts = (obj or {}).get("thoughts", "")
        rec = dict(arm=arm, i=i, secs=round(el,1), think_chars=len(think),
                   parsed=obj is not None, candidates=cands, intent=intent,
                   thoughts=thoughts, reasoning=think,
                   derive_cand=any(DERIVE.search(c) for c in cands),
                   derive_intent=bool(DERIVE.search(intent)),
                   bar_intent=bool(BAR.search(intent)),
                   susp_in_thoughts=bool(BUDGET.search(thoughts)),
                   susp_in_reasoning=bool(BUDGET.search(think)))
        log.append(rec)
        print(f"{arm:8} #{i+1} {el:5.1f}s think={len(think):>5} parsed={rec['parsed']} "
              f"derive_cand={rec['derive_cand']} derive_intent={rec['derive_intent']} "
              f"| {intent[:70]}", flush=True)
        (OUT / f"susp-arms-{tag}.json").write_text(json.dumps(log, indent=1))
print("done")
