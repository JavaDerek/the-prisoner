# Commit-call probe, 2026-09-24 ~23:05 CDT (04:05Z on the 25th) — a TOY prompt, not a game request

Run by hand while designing `docs/STRATEGY-DESIGN.md`, against the live llama-server on doris:11435
(Muse-Glimmer-30B Q4_K_M, `--chat-template-kwargs '{"reasoning_strength":"none"}'` server-wide). Two
scripts, both committed as run:

- `thinking-field-probe.py` — which per-request field moves reasoning. `chat_template_kwargs:
  {"reasoning_strength": none|low|medium|high}` gives 33/51/60/109 completion tokens on a trivial prompt;
  `reasoning_effort: "high"` gives 33, i.e. nothing.
- `commit-probe.py` — twelve asks of a COMMIT-shaped question: five fixed options, each labelled with its
  own number, shown in three different orders; reasoning `high` and `none`; with and without
  `response_format: json_schema`. Temperature 0.9. `replies.jsonl` is the output, one ask per line.

**This is NOT a `buildOpenWorld` request** (`prisoner-measurement-fidelity`): the situation is a
one-paragraph stand-in with the object ids and no condition list, no briefing and no rules. It answers
questions about the *instrument* — does grammar survive reasoning, is the content naked JSON, does the
choice follow content or position — and nothing about what the real seat would choose. The real probe
is step 1 of the attack plan.

| | asks | naked JSON in `content` | position-1 picks | reasoning chars | seconds |
|---|---|---|---|---|---|
| `high`, no grammar | 3 | 3 | 0 | 6.9k–10.0k | 33–47 |
| `high`, `json_schema` | 3 | 3 | 1 | 7.4k–11.5k | 36–54 |
| `none`, no grammar | 3 | 3 | 0 | 0.7k–0.9k | 5–6 |
| `none`, `json_schema` | 3 | 3 | 2 | 0.4k–1.5k | 3–8 |

Chosen by option identity over all twelve: water-and-key-ring 4, loose tile 4, door handle 3, bar mortar 1,
blanket thread 0. The bar — the object the schema seat fixates on in play — was chosen once, but this
prompt carries no condition list naming the bar's threshold, so that says nothing about the game.
