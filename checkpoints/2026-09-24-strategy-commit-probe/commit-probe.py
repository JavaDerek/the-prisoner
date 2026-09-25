import json, urllib.request, time
OPTS = ["1. Scrape the mortar at the base of the window bar with the spoon's edge.",
        "2. Pull the loose thread from the blanket and braid it into a cord.",
        "3. Lift the loose tile and feel underneath it for anything hidden.",
        "4. Ask Croft for water and watch how he handles the key ring.",
        "5. Try the cell door's handle quietly to see whether it is actually locked."]
def prompt(order):
    lst = "\n".join(OPTS[i] for i in order)
    return ("You are Voss, a prisoner in a one-room cell with a warden, Croft. Objects you perceive: window, bar, door, lock, spoon, loose_tile, cot, blanket, bucket, meal_tray, key_ring, banknotes. "
            "You have ten turns to get out.\n\nYour options this game, as you listed them:\n" + lst +
            "\n\nWhich ONE of these do you pursue this game? Answer with one JSON object: {\"chosen\": number, \"strategy\": string, \"targets\": [string]} -- "
            "\"chosen\" is the option's number; \"strategy\" is one sentence, at most 200 characters, you will be shown every turn; \"targets\" names 1 or 2 of the object ids above that this strategy works on.")
SCHEMA = {"type":"object","properties":{"chosen":{"type":"integer"},"strategy":{"type":"string"},"targets":{"type":"array","items":{"type":"string"},"minItems":1,"maxItems":2}},"required":["chosen","strategy","targets"],"additionalProperties":False}
def ask(strength, rf, order):
    body = {"model":"muse-glimmer-30b-q4_k_m","messages":[{"role":"user","content":prompt(order)}],"temperature":0.9,"chat_template_kwargs":{"reasoning_strength":strength}}
    if rf: body["response_format"] = {"type":"json_schema","json_schema":{"name":"strategy","schema":SCHEMA}}
    req = urllib.request.Request("http://doris:11435/v1/chat/completions", data=json.dumps(body).encode(), headers={"content-type":"application/json"})
    t=time.time(); d = json.loads(urllib.request.urlopen(req, timeout=600).read().decode(), strict=False); dt=time.time()-t
    m = d["choices"][0]["message"]; c = m.get("content") or ""; r = m.get("reasoning_content") or m.get("reasoning") or ""
    naked = None
    try: naked = json.loads(c)
    except Exception: naked = None
    return dict(strength=strength, rf=rf, order=order, toks=d["usage"]["completion_tokens"], secs=round(dt,1), reasoning=len(r), naked=naked is not None, content=c[:160].replace("\n","\\n"), finish=d["choices"][0].get("finish_reason"))
import itertools, random
random.seed(7)
orders = [[0,1,2,3,4],[4,3,2,1,0],[2,4,0,1,3]]
for strength in ["high","none"]:
    for rf in [False, True]:
        for o in orders:
            print(json.dumps(ask(strength, rf, o)))
