title: Muse on Ollama loses the first JSON field when thinking is off and a schema is sent

**Status: worked around 2026-09-27 (`src/open/thinking.ts`, `withholdsSchemaWhenThinkingOff`). An
upstream fix is prepared as a pull request against ollama/ollama (branch
`parsers-glimmer-thinking-close-off`, commit a4380a5 in a local clone at `~/oss/ollama`); see the end.**

**Correction to the table below:** "reasoning 0" means none RETURNED. With thinking off Ollama discards
Muse's `to=self` message, and logprobs show Muse writes one anyway (4 of 4 unconstrained calls). The
unconstrained arm's higher token counts are probably that hidden message. The schema arm's zero was the
bug itself: the grammar forced JSON from the first token, leaving no room to think.

## Symptom

All-Muse games on doris's Ollama (`muse-glimmer:30b`, Ollama 0.34.4, container `shep-ollama`) lost
wits turns as `SilenceReason: unparseable`, every one shaped the same: the reply begins
`{","candidates":...}` or `{", "candidates": ...}`, the `thoughts` field gone. 3 of 10 wits calls in
the first two smoke games after the move to Ollama (`checkpoints/2026-09-27T13-36-55-026Z.md`,
`checkpoints/2026-09-27T14-03-13-779Z.md`).

## Cause (read from Ollama v0.34.4 source)

- The glimmer renderer ends every prompt with `<|start|>assistant`; the model writes its own header
  (` to=user<|message|>`, or ` to=self<|message|>` to think) before any content.
- `GlimmerParser.ThinkingClose()` returns the header markers **only when thinking is emitted**. With
  `reasoning_effort: "none"` (mapped to `think: false`) it returns nothing.
- The server applies a request's `format` grammar from the first token whenever `ThinkingClose` is empty
  -- `llm/server.go`: "none when the response starts in content". A glimmer response never does.
- So the JSON-schema grammar forces `{"thoughts":"` before the header is written. Muse sometimes writes
  the header inside that string, then restarts its object: the raw output is
  `{"thoughts":"… to=user<|message|>{","candidates":…`. The parser, still in its header state, takes
  everything before `<|message|>` as the header and drops it. What is left is `{","candidates":…`.

The referee is unaffected: it sends no schema, so no grammar binds and the header is written normally.

## Measured (exact dumped game requests, replayed direct to Ollama, sequentially)

| arm | complete replies | median tokens | median s | reasoning |
|---|---|---|---|---|
| thinking off + schema (as it was) | 2 of 6 on the two worst requests; 16 of 18 across the game's six | 972 | 20 | 0 |
| thinking off, **no schema** | 6 of 6, and 6 of 6 more across all six | 1814 on the worst two, ~900 overall | 37 | 0 |
| thinking `low` + schema | 6 of 6 | 825 | 17 | ~1800 chars |

`low` was rejected as a default because the owner's decision is thinking OFF for every role.

Withholding the schema changes the output, not only its reliability: median `thoughts` 485 characters
against 1028 for complete constrained replies, and 4 candidates against 5 (n=6 against n=16). Every
unconstrained reply was bare JSON with every required key and no fence. **A batch after this change is
not the same instrument as one before it** -- the transcript header says `Schema withheld:` when it applies.

Verified live: a 4-round all-Muse game after the change, 8 of 8 half-rounds ruled, no silences
(`checkpoints/2026-09-27T14-26-09-632Z.md`).

One unexplained HTTP 500 (2.3 s, no ERROR line in Ollama's log) interrupted the replay; the transport's
ordinary error path covers it and it did not recur.

## Remove the workaround when

Ollama's `GlimmerParser.ThinkingClose()` returns its header markers whether or not thinking is emitted.
Re-run the replay (`reasoning_effort: "none"` + the proposal schema, ~20 calls) before removing it.

## Draft upstream report (superseded by the prepared pull request)

> **glimmer: JSON `format` with `think: false` drops the start of the output**
>
> Ollama 0.34.4, `muse-glimmer:30b`. With `think: false` (or `reasoning_effort: "none"` on `/v1`) and a
> JSON-schema `format`, roughly 10-30% of replies lose their first field: the content comes back as
> `{","next_field":...}`.
>
> `GlimmerParser.ThinkingClose()` returns nil when `emitThinking` is false, so the grammar applies from
> the first token. But the glimmer renderer ends the prompt at `<|start|>assistant`, so the response never
> starts in content: the model must still write ` to=user<|message|>`. Constrained to JSON, it sometimes
> writes that header inside the first string value, then restarts the object; the parser drops everything
> before `<|message|>` as the header.
>
> Suggested fix: return the header markers from `ThinkingClose()` regardless of `emitThinking` (the
> parser already discards a `to=self` body when thinking is off), or have the renderer end with
> `<|start|>assistant to=user<|message|>` when thinking is off.
>
> Repro: any schema whose first property is a free string, `think: false`, temperature 0.9, ~20 calls.
