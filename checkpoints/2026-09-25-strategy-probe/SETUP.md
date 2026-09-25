# Step 0 — instrument check, 2026-09-25 04:00Z (2026-09-24 23:00 CDT)

T+0 for `docs/STRATEGY-DESIGN.md` §6 is **23:00 CDT**, not the 22:45 the plan assumed. Every window in
§6 shifts by fifteen minutes and nothing else moves: T+2:00 build cutoff = 01:00 CDT, T+4:40 last-game
line = 03:40 CDT, T+6:00 = 05:00 CDT.

## The machine, as found (not restarted, not changed)

| | found | §6 expected |
|---|---|---|
| llama-server | pid 2213812, up since 09:39, `-m Muse-Glimmer-30B-Q4_K_M.gguf --host 0.0.0.0 --port 11435 -c 16384 -ngl 999 --flash-attn on --jinja --no-webui -a muse-glimmer-30b-q4_k_m --chat-template-kwargs '{"reasoning_strength":"none"}'` | same, reasoning off server-wide |
| model served | `muse-glimmer-30b-q4_k_m`, Q4_K_M, 16743567360 B, `n_ctx` 16384 (`n_ctx_train` 131072) | 16.6 GB of 24.5 |
| GPU | 16642 MiB of 24564 MiB used | same |
| Ollama | `/api/ps` → `{"models":[]}`, direct on 11434 and through the router | holding nothing |
| `comfyui.service` | `inactive` | inactive |
| router on 8799 | up (`npm run model-router`, pid 90435, since 18:25 CDT), `/api/ps` → `{"models":[]}` | up |
| game running | none | none |
| `main` | `b48f9af`, clean tree, 13 commits unpushed | `b48f9af`, unpushed |
| b6 games | `/tmp/b6-worktree` at `dd5d635`: `checkpoints/2026-09-24-phase1-b6/P/` and `S/` untracked, 7 games each (14 files per arm), 6 logs, 2 abandoned | untracked, owed to step 2 |

## §1.1's five-row probe, re-run at 04:00Z

Same script, same server, same trivial prompt at temperature 0
(`checkpoints/2026-09-24-strategy-commit-probe/thinking-field-probe.py`, output in
`step0-thinking-field.txt` as `(completion_tokens, content, reasoning_chars, seconds)`):

| request field | completion tokens | reasoning chars | §1.1 at 03:22Z |
|---|---|---|---|
| `chat_template_kwargs: {"reasoning_strength":"none"}` | 33 | 90 | 33 / 90 |
| `chat_template_kwargs: {"reasoning_strength":"low"}` | 51 | 183 | 51 / 183 |
| `chat_template_kwargs: {"reasoning_strength":"medium"}` | 60 | 220 | 60 / 220 |
| **`chat_template_kwargs: {"reasoning_strength":"high"}`** | **109** | **432** | 109 / 432 |
| `reasoning_effort: "high"` | 33 | 90 | 33 / 90 |

**Identical, row for row.** So §8's D7 escape ("if step 0 finds `chat_template_kwargs` no longer moves
tokens, thinking is not a lever tonight") does **not** fire: the field still moves tokens, `reasoning_effort`
is still a no-op on this server, and step 1 runs its `high` arm as written. The `low`/`medium` rungs exist
as §1.1's stated fallback.

**Step 0 verdict: proceed.** No restart, no foreign model, nothing on the card but Muse.
