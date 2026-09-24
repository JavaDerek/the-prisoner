# How batch 4's referee and warden are served, and the void run that found the difference

Written after `PREDICTION.md` was committed. It records the serving arrangement, which is not a
prediction and not a result — the numbers in `PREDICTION.md` are still the ones pre-committed, and
nothing here changes them.

## The chairs

Two models, one game, for the first time in any recorded batch (`PRISONER_PRISONER_MODEL` /
`PRISONER_WARDEN_MODEL`, `e071194`):

- **Prisoner** `claude-opus-4-6`, through the model router's `claude` route.
- **Warden** `muse-glimmer-30b-q4_k_m`, through the router's `local` route to doris:11435.
- **Referee** the same local model, same server, same port.

The router is batch 3's, unchanged, started with `SHIM_LOCAL_URL=http://doris:11435` and
`SHIM_LOCAL_MODELS=muse-glimmer-30b-q4_k_m`, and it logs a line per request naming the route taken —
which is how the arm is checked while a game is running rather than after it.

## The first launch was void, and why

**Ten games were launched at 13:29Z on 2026-09-24 and stopped after the first one completed.** That
game is kept unedited in `void-run-1/`, with its driver and router logs, because it is the evidence
for what follows and this repository commits bad runs.

Game 1 looked like a total collapse of the prisoner's side: **all ten of her intents ruled
impossible**, `spoonEdge 0`, `barIntegrity 100`, `wardenSuspicion 0`, nothing moved in ten rounds.
It was not a ruling failure. **Twelve of that game's forty referee calls returned HTTP 500,
`"Context size has been exceeded."`** — every prisoner ruling and two of the warden's. The shortest
intent in the game, "Scrape the bar with the spoon.", ran **143 seconds** before overrunning.

What it was not: the referee's input is **byte-identical to batch 3's**. Compared directly against
`../2026-09-23-phase1-b3/O/`'s recorded requests — the same six questions, each prompt equal
character for character, request size 8.4–8.7 kB against batch 3's 8.5–8.9 kB. No commit between
batch 3's pin (`3fd875e`) and this batch's (`eaff32e`) changed what the referee is asked.

**What it was: the server was not the one `../2026-09-23-phase1-b3/SETUP.md` describes.** The running
`llama-server` had been started **without** `--chat-template-kwargs '{"reasoning_strength":"none"}'`:

```
./llama-server -m .../Muse-Glimmer-30B-Q4_K_M.gguf --host 0.0.0.0 --port 11435 \
  -c 16384 -ngl 999 --flash-attn on --jinja --no-webui -a muse-glimmer-30b-q4_k_m
```

Measured on the identical trivial prompt ("Reply with the single word: yes"), against that process:

| request | completion tokens |
|---|---|
| server default, as it was running | **102** |
| `chat_template_kwargs: {"reasoning_strength": "none"}` forced per request | **33** |
| `"high"` forced per request | 109 |

The default was `high` in all but name — about **three times** the generation on every call. Batch 3's
`SETUP.md` records the same measurement from the other side (133 at high, 82 at none) and records the
mechanism: `reasoning_effort` never reaches this model's template, `reasoning_strength` is its knob,
and the arm is therefore set **on the command line**, where it is invisible to every transcript header.

That process had been up 19h49m when it was found, so it started about **18:16Z on 2026-09-23** —
after batch 3's last game ended at 17:00Z. **Batch 3 ran under the documented server; this batch's
first launch inherited a different one.** Nothing in a transcript would have shown it. Batch 3's
`SETUP.md` closes with exactly this instruction, and it is the reason the cause was found in one game
rather than in ten:

> Anyone reading a future run's header against this one should check the server's launch line too.

## The fix, and why only one thing was changed

The server was stopped and relaunched with batch 3's documented line, verbatim, and the same probe now
returns **33** tokens by default. `-c 16384` was deliberately **left alone** despite the temptation to
raise it now that the warden shares the server: restoring batch 3's line restores batch 3's conditions,
and batch 3 proved 16384 sufficient. Raising the context at the same time would have moved two things
and left it unclear which one mattered.

**`PREDICTION.md` was not edited.** It was committed before the first game and stays as written,
including the condition it states as an assertion — that the warden inherits `reasoning_strength:
"none"` from the command line. That assertion was **read from batch 3's SETUP.md rather than checked
against the live process**, and it was false at the moment it was written. It is left standing, with
this file as its correction, because a prediction that is quietly repaired after the fact is not a
prediction. The lesson for the next batch is in `PREDICTION.md`'s own terms: a condition no header
records must be **measured** before the first game, not cited from the last batch's notes.

## Ollama

doris's Ollama held `qwen3:4b`, loaded 2026-09-23T16:58Z by something that is not this project and
idle for 6.5 hours. It was unloaded on the owner's decision before the first game, so
`ollama_ps_before` reads `none` as batch 3's did. The owner's `qwen3:14b` pin is restored when batch 5
finishes, not this one.
