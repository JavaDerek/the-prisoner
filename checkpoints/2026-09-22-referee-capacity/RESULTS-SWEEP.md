# Which referee can do this job? A sweep across hosted models (2026-09-23)

Follows `RESULTS.md` (Sonnet 42/43, Opus 41/43, qwen3:14b 21/43). The owner's questions, in order: had we ever tried his
DeepInfra subscription for this role (no -- 11 games used `Qwen3-235B` as a MIND, never as referee); does scale fix it;
and what is there in a size his 4090 could run. Same instrument as `RESULTS.md`: today's question set, each row's own
recorded perception, the answer key written before any call, and a row counts right only when the keys are in `accept`
AND `computeRuling` rules it applicable.

## Five rows, every referee measured

Rows: `b2#5` sharpening, `b1#13` and `b1#25` hiding, `b1#16` a four-act chain, `b1#50` a lock examination (the control
qwen3 already gets right). One call each, except qwen3 (3).

| right | referee | median | sharpening | the chain | right keys our gate refused |
|---|---|---|---|---|---|
| 5/5 | `claude-sonnet-5` | 31s | spoon/restore | door/leave | 0 |
| 5/5 | `claude-opus-4-6` | 91s | spoon/restore | door/leave | 0 |
| 4/5 | `meta-models/Muse-Glimmer-30B` (thinking OFF) | 7s | spoon/restore | door/leave | 1 |
| 3/5 | `zai-org/GLM-4.6` | 113s | spoon/restore | door/open | 0 |
| 3/5 | `openai/gpt-oss-20b` (thinking ON; 2/5 with it OFF, the row below) | 55s | spoon/restore | -- | 1 |
| 2/5 | `openai/gpt-oss-20b` (thinking OFF) | 6s | spoon/restore | door/open | 1 |
| 2/5 | `google/gemma-4-31B-it` | 19s | spoon/wear | door/leave | 2 |
| 2/5 | `Qwen/Qwen3-235B-A22B-Instruct-2507` | 21s | spoon/wear | blanket/open | 1 |
| 1/5 | `qwen3:14b` (local, N=3) | 8s | spoon/wear | blanket/open | 2 |
| 1/5 | `nvidia/Nemotron-3-Nano-30B-A3B` | 43s | spoon/none | none/none | 1 |
| 1/5 | `mistralai/Mistral-Small-3.2-24B-Instruct-2506` | 17s | spoon/wear | blanket/open | 3 |
| 1/5 | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` | 7s | spoon/wear | door/none | 2 |
| 1/5 | `deepseek-ai/DeepSeek-V3.2` | 19s | spoon/wear | blanket/take | 2 |

Not measurable: `ibm-granite/granite-4.2-30b` timed out on every attempt at DeepInfra; `Qwen/Qwen3-30B-A3B` failed until
the router learned to send an output budget (below), and was dropped at the owner's call since Qwen's reading is known
at 14B and 235B.

## What it says

1. **Scale does not fix it, within a family.** `Qwen3-235B` is sixteen times `qwen3:14b` and reads sharpening the same
   way -- as damage. It fixes the hide and nothing else. **Nor is the direction error a Qwen quirk:** DeepSeek V3.2,
   Mistral Small, Llama 3.1 and Gemma 4 all read "sharpen the spoon's edge" as `wear`.
2. **Size is not the variable; the model is.** Two referees that fit a 24 GB card -- `Muse-Glimmer-30B` and
   `gpt-oss-20b` -- get the direction right, where 235B does not.
3. **Our own citation gate costs the better referees rows** (last column): rulings with the right object and act, refused
   because the property was not quoted from the target's description. Mistral loses 3 of 5 that way. The waiver was
   written and reverted the same evening (`../2026-09-22-citation-waiver/`) because it moved nothing for qwen3 -- which
   is exactly what that file predicted would change once a referee produced right keys often enough for the gate to bind.

## Slow rulings: writing, not waiting

The owner asked whether latency was DeepInfra contention. Measured by logging token counts from the reply (router change,
tested): one row, three calls each.

| model | latency | output tokens | throughput |
|---|---|---|---|
| Muse-Glimmer 30B | 28-33s | 5,000-6,200 | 172-188 tok/s |
| gpt-oss 20B | 13-19s | 1,500-2,200 | 115-121 tok/s |

**Not contention** -- the spread across repeats is small and Muse-Glimmer is the faster server of the two. It is slower
because it writes five times as much: thousands of tokens of reasoning before a few dozen tokens of JSON. That cost
would follow the model onto local hardware, where 180 tok/s becomes perhaps 30-40.

## The thinking knob changes everything for one of them

| model | thinking ON | thinking OFF |
|---|---|---|
| Muse-Glimmer 30B | 4/5, ~3,250 tok, 18s | **4/5, ~780 tok, 5s** |
| gpt-oss 20B | 3/5, ~1,380 tok, 12s | 2/5, ~670 tok, 6s |

gpt-oss's reasoning earns its keep; Muse-Glimmer's does not, for this task.

## Muse-Glimmer 30B on the full benchmark, thinking off

**36 of 43 rows right, 22 of 22 on the one-act set, median 6 s.** Against Sonnet's 42 and qwen3:14b's 21. Its seven
misses: two sharpenings still read as `wear`, hides keyed on the wrong object, two chains, and `b1#13` -- right keys,
refused by the citation gate. It answers the one-act reading perfectly, which four rounds of prompt work never achieved
on qwen3 (`../2026-09-22-one-act-s2/`).

**What it is:** `meta-models/Muse-Glimmer-30B`, Apache-2.0, open weights on Hugging Face with official GGUF and ExLlama
quantisations (312k downloads), described as a 30B agentic model distilled from a larger sibling, tagged for structured
output and tool use, and meant for consumer hardware. So it is servable on the owner's own 4090 through Ollama, with no
licence obstacle to commercial use.

**Caveats.** One call per row (qwen3 had three), thinking OFF for that run, and thinking changes rulings in general
(OPEN-VARIANT §68.1) -- so this arm is not directly comparable with the recorded batches, all of which ran thinking ON.
Nothing here has been tried in a live game.

## What this leaves for the owner

- The two research reports both concluded that nothing open could do this job. On this benchmark that is false, at a
  size that fits his card, under Apache-2.0.
- The LoRA question narrows: the residue is chains and hide-targets, not the direction error.
- The citation waiver deserves re-measuring against a referee that produces right keys.
