# Pre-committed: is the misruling the referee model's ceiling? (2026-09-22, before any call)

The owner's question: can the referee's repeated misrulings be fixed on `qwen3:14b`, or is that model the ceiling? We
never measured a stronger referee (every recorded game used qwen2.5:14b or qwen3:14b; one unmeasured 2-round Opus smoke
test on 2026-09-19).

**Instrument.** Two sets, the same requests for every referee.
- `rows.json`: all 43 misruled rows of Phase 1 batches 1 and 2 (the owner's labels, plus batch 1's four sharpening rows
  corrected to misruled). Each is asked TODAY's main question set (custody, §74.3 hiding, the edge sentence), built by
  `createReferee` with the row's own recorded perception. The expected target/effect set is written in `rows.json`
  (`accept`) BEFORE any call: for a chain, any one of its acts keyed right counts; sharpening counts only as `restore`
  on the spoon. A row is **right** when the referee's target/effect is in `accept` AND `computeRuling` (today's gate)
  rules it applicable.
- `one-act.json`: the 22 HOLDOUT intents of `../2026-09-22-one-act-s2/`, as the separate one-act call.

**Referees.** `qwen3:14b` on doris (thinking ON, N = 3, majority); `claude-sonnet-5` and `claude-opus-4-6` through the
model router (N = 1). This is a capacity check, not a controlled comparison: the Claude models run through the CLI with
whatever reasoning it applies.

**Predictions:**
1. qwen3:14b: at most 25 of 43 right (tonight's re-rule found 17 of 30 right on the first 30).
2. At least one Claude referee: at least 36 of 43 right, AND at least 3 of the 4 sharpening-as-restore rows in batch 2
   right, AND one-act: chains 8/8 and single acts at least 13/14.
3. If 2 holds and 1 holds, the ceiling is the model, not the wording; the next question is cost and latency.
   If 2 fails, it is the question design.
