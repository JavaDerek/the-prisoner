# How batch 3's referee is served, and the one thing `PREDICTION.md` could not know

Written after `PREDICTION.md` was committed and before the first game. It records the serving
arrangement, which is not a prediction and not a result: the numbers are still the ones pre-committed.

## doris's Ollama cannot load this model at all

`ollama pull hf.co/meta-models/Muse-Glimmer-30B-GGUF:Q4_K_M` succeeds (16.8 GB, the repository's own
`Muse-Glimmer-30B-KQuant-17GB-Q4_K_M.gguf`, Apache-2.0). Loading it does not:

```
error: Failed to load CLIP model ... unknown model architecture: 'muse-glimmer'
```

The GGUF's `general.architecture` is `muse-glimmer`; llama.cpp gained that architecture in build
**b10353** (PR #26841, 2026-08-10) and doris's Ollama 0.30.10 is older than that. Ollama's own library
has no `muse-glimmer` model, so there was nothing to pull instead.

**The Ollama install was not touched.** It serves this machine's other tenants, its binary has already
been removed from disk under the running process (`/proc/<pid>/exe` names a path that no longer
exists), and there is no systemd unit to bring it back if a restart went wrong. Upgrading it to run one
measurement is a bad trade and was not made.

**Instead a llama.cpp `llama-server` (build b11130) runs beside it**, in `~/llamacpp/` on doris,
serving the same GGUF (copied to `~/models/Muse-Glimmer-30B-Q4_K_M.gguf`) on port **11435**:

```bash
./llama-server -m ~/models/Muse-Glimmer-30B-Q4_K_M.gguf --host 0.0.0.0 --port 11435 \
  -c 16384 -ngl 999 --flash-attn on --jinja --no-webui -a muse-glimmer-30b-q4_k_m \
  --chat-template-kwargs '{"reasoning_strength":"none"}'
```

All layers on the GPU, 17.2 GB of the 4090's 24.5 GB resident. `qwen3:14b` -- the owner's pin -- was
unloaded from Ollama to make room and is restored when the batch ends.

The router learned a `local` route for exactly this (`ce55dca`, test first): `SHIM_LOCAL_MODELS` names
the ids that go to `SHIM_LOCAL_URL` instead of doris's Ollama. Only the chat call moves. `/api/ps`
still asks the real Ollama, so the swapper's foreign-model guard still sees a model somebody else
loaded, exactly as it would without any of this.

## "Thinking off" is set at the server here, not per request

This is the thing `PREDICTION.md` asserted without knowing, and it is worth being exact about.

`PRISONER_REFEREE_THINKING=off` sends `reasoning_effort: "none"` on the request body
(`src/open/thinking.ts`). DeepInfra honoured that; **llama-server does not, for this model**. Muse
Glimmer's chat template takes a `reasoning_strength` kwarg (default `high`) and renders it into the
system block as a line of English, and `reasoning_effort` never reaches it. Measured on the identical
prompt: the field changes nothing (133 vs 135 completion tokens), while
`chat_template_kwargs: {"reasoning_strength": "none"}` takes it to 82.

So the OFF arm is set once, on the server's command line, where every request gets it -- and the
per-request variable is inert rather than wrong. A transcript of this batch that says
`PRISONER_REFEREE_THINKING=off` is telling the truth about what the referee did; it is just not the
thing that made it true. **Anyone reading a future run's header against this one should check the
server's launch line too.**

Note also what "off" means for this model: not silence, but a short reasoning channel (82 tokens on a
trivial prompt, against 133 at `high`). It never emits none.
