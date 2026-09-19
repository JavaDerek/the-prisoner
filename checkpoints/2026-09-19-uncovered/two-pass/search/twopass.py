"""Two-pass coverage driver for a prompt-wording search (2026-09-19 night).

  python3 twopass.py [--p1 FILE] [--p2 FILE] [--rows FILE] [--n 1] [--see-intent]
                     [--model qwen3:14b] [--no-think] [--tag NAME] [--only 1,2,7]

Pass 1 ("describe") gets {{INTENT}}. Pass 2 ("map") gets {{EXTRACTION}} (pass 1's
JSON) and {{INTENT_LINE}} (the intent, only with --see-intent). Both at temperature
0 with a strict JSON schema so fields always parse. The SCORE is the model's own
"answer" field against each row's human label -- never a threshold in code.

Every attempt is appended to results.jsonl with the exact prompts, so a winner can
be reproduced. Prints one line per row and a score line. Exit code 0 always; the
score line is the result.

This is lab scratch: no repository code, no database, one model on doris at a time.
"""
import argparse, json, pathlib, sys, time, urllib.request, hashlib

HERE = pathlib.Path(__file__).resolve().parent
ENDPOINT = "http://doris:11434/v1/chat/completions"
S1 = {"type": "json_schema", "json_schema": {"name": "describe", "strict": True, "schema": {"type": "object", "properties": {"acts_on": {"type": "string"}, "physical_result": {"type": "string"}, "stated_aim": {"type": "string"}}, "required": ["acts_on", "physical_result", "stated_aim"], "additionalProperties": False}}}
S2 = {"type": "json_schema", "json_schema": {"name": "map", "strict": True, "schema": {"type": "object", "properties": {"aim_is_a_kind": {"type": "string", "enum": ["yes", "no", "no aim"]}, "nearest_kind": {"type": "string"}, "fit_percent": {"type": "integer", "minimum": 0, "maximum": 100}, "why": {"type": "string"}, "answer": {"type": "string", "enum": ["covered", "uncovered"]}}, "required": ["aim_is_a_kind", "nearest_kind", "fit_percent", "why", "answer"], "additionalProperties": False}}}

ap = argparse.ArgumentParser()
ap.add_argument("--p1", default=str(HERE / "p1.txt"))
ap.add_argument("--p2", default=str(HERE / "p2.txt"))
ap.add_argument("--rows", default=str(HERE / "rows.json"))
ap.add_argument("--n", type=int, default=1)
ap.add_argument("--see-intent", action="store_true")
ap.add_argument("--model", default="qwen3:14b")
ap.add_argument("--no-think", action="store_true")
ap.add_argument("--tag", default="")
ap.add_argument("--only", default="", help="comma-separated 1-based row numbers")
args = ap.parse_args()

p1 = open(args.p1).read(); p2 = open(args.p2).read()
rows = json.load(open(args.rows))
only = {int(x) for x in args.only.split(",") if x.strip()} if args.only else set(range(1, len(rows) + 1))

def call(prompt, schema):
    body = {"model": args.model, "temperature": 0, "stream": False, "tools": [], "response_format": schema, "messages": [{"role": "user", "content": prompt}]}
    if args.no_think: body["reasoning_effort"] = "none"
    r = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(r, timeout=600) as resp:
        txt = json.load(resp)["choices"][0]["message"].get("content", "")
    try: return json.loads(txt)
    except Exception: return {"_raw": txt}

def two_pass(intent):
    ex = call(p1.replace("{{INTENT}}", intent), S1)
    line = f"Original intent: {intent}" if args.see_intent else ""
    mp = call(p2.replace("{{EXTRACTION}}", json.dumps(ex, indent=1)).replace("{{INTENT_LINE}}", line).replace("{{INTENT}}", intent if args.see_intent else ""), S2)
    return ex, mp

attempt = {"tag": args.tag, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "model": args.model, "think": not args.no_think, "see_intent": args.see_intent, "n": args.n,
           "p1": p1, "p2": p2, "p1_sha": hashlib.sha256(p1.encode()).hexdigest()[:10], "p2_sha": hashlib.sha256(p2.encode()).hexdigest()[:10], "rows": []}
right = 0; found = 0; want_u = 0; false_alarms = 0; want_c = 0; t0 = time.time()
for i, row in enumerate(rows, 1):
    if i not in only: continue
    runs = []
    for _ in range(args.n):
        try: ex, mp = two_pass(row["text"])
        except Exception as e: ex, mp = {"_error": str(e)}, {"answer": "error"}
        runs.append({"ex": ex, "map": mp})
    answers = [r["map"].get("answer", "error") for r in runs]
    unc = answers.count("uncovered"); cov = answers.count("covered")
    got = "uncovered" if unc * 2 > args.n else "covered" if cov * 2 > args.n else "/".join(answers)
    ok = got == row["want"]
    right += ok
    if row["want"] == "uncovered": want_u += 1; found += ok
    else: want_c += 1; false_alarms += (not ok)
    shown = next((r for r in runs if r["map"].get("answer") == got), runs[0])
    attempt["rows"].append({"i": i, "text": row["text"], "want": row["want"], "got": got, "ok": ok, "runs": runs})
    m = shown["map"]; e = shown["ex"]
    print(f"{'OK ' if ok else 'BAD'} {i:2} want {row['want']:9} got {got:9} | {row['text'][:58]:58} | aim={e.get('stated_aim','')[:40]!r} result={e.get('physical_result','')[:70]!r} | aim_kind={m.get('aim_is_a_kind')} nearest={m.get('nearest_kind')} fit={m.get('fit_percent')} why={m.get('why','')[:90]!r}", flush=True)
scored = len(attempt["rows"])
attempt.update(dict(right=right, scored=scored, found=found, want_u=want_u, false_alarms=false_alarms, want_c=want_c, secs=round(time.time() - t0)))
with open(HERE / "results.jsonl", "a") as f: f.write(json.dumps(attempt) + "\n")
print(f"SCORE {right}/{scored} right | found {found}/{want_u} uncovered | false alarms {false_alarms}/{want_c} | {attempt['secs']}s | p1 {attempt['p1_sha']} p2 {attempt['p2_sha']}{' | ' + args.tag if args.tag else ''}")
