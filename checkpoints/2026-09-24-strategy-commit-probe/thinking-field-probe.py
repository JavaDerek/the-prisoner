import json, sys, urllib.request, time
def ask(extra, content="Reply with the single word: yes"):
    body = {"model":"muse-glimmer-30b-q4_k_m","messages":[{"role":"user","content":content}],"temperature":0, **extra}
    req = urllib.request.Request("http://doris:11435/v1/chat/completions", data=json.dumps(body).encode(), headers={"content-type":"application/json"})
    t=time.time(); raw = urllib.request.urlopen(req, timeout=300).read().decode(); dt=time.time()-t
    d = json.loads(raw, strict=False)
    m = d["choices"][0]["message"]
    return d["usage"]["completion_tokens"], repr(m.get("content",""))[:50], len(m.get("reasoning_content") or m.get("reasoning") or ""), round(dt,1)
for label, extra in [("ctk none", {"chat_template_kwargs":{"reasoning_strength":"none"}}), ("ctk high", {"chat_template_kwargs":{"reasoning_strength":"high"}}), ("reasoning_effort high", {"reasoning_effort":"high"}), ("ctk medium", {"chat_template_kwargs":{"reasoning_strength":"medium"}}), ("ctk low", {"chat_template_kwargs":{"reasoning_strength":"low"}})]:
    print(label, "->", ask(extra))
