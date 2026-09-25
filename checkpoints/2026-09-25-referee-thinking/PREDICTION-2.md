# Pre-committed: reasoning strength, against a SERIAL baseline (2026-09-25, before any call of this design)

Supersedes `PREDICTION.md`, whose prediction 1 died: it used batch 6's recorded rulings as the baseline, and
`RESULTS.md` then showed batch 6 was run concurrently and is therefore a draw, not a reading. **Batch 6 is
no longer the reference.** It supplies only (a) the 22 recorded requests and (b) Opus's right/wrong label on
each, which is a judgement about the intent and is unaffected by the referee's flakiness.

## Design

All 22 recorded requests, replayed byte-identically, **one process, strictly sequential, nothing else
against the server**, direct to `doris:11435`. `muse-glimmer-30b-q4_k_m`, temperature 0, N=1 per row per arm.
Two arms, one variable: `chat_template_kwargs.reasoning_strength` = `none`, then `high`.

The `none` arm IS the baseline -- measured here, not read from b6. `RESULTS.md` established that a serial
replay is bit-reproducible across repeats, which is what makes N=1 defensible for this comparison and was
not true of the design this supersedes.

Rows are then classified by the serial baseline, not by b6:
- **ARM** = refused at serial `none` AND labelled `RESOLVED` by Opus (a real wrong refusal, serially).
- **CONTROL** = refused at serial `none` AND labelled still-refused by Opus (a correct refusal).
- **DROPPED** = resolves at serial `none`. Not a refusal of a serial referee at all. Counted and reported.

## Predictions, committed before the first call of this run

1. **DROP RATE.** Between 2 and 10 of the 22 drop out -- i.e. a serial referee refuses fewer of them than
   the concurrent batch did. (Directional: `RESULTS.md` saw 1 of 4 drop. A drop rate of 0 would mean
   concurrency did not inflate the refusal count and `RESULTS.md`'s reading is too strong.)

2. **PRIMARY.** At `high`, **at least half** of the ARM rows resolve. The "marked improvement" bar, phrased
   as a proportion because the denominator is not known until the baseline runs.

3. **CONTROL, and it is the kill.** At `high`, **at least 75%** of the CONTROL rows stay refused. If more
   than a quarter resolve, the arm is buying permissiveness, not accuracy, and does not ship whatever
   prediction 2 does.

4. **SHAPE.** Among ARM rows, the effect-question cluster (the referee answered `effect: none`) resolves at
   a rate >= the property-question cluster (`reveal` with the wrong property). §68.5's mechanism is about
   grabbing versus declining, which is the target and effect questions.

## Ship rule

Wire a referee strength into play (via P8 fix 2, which needs no server restart) only if **2 and 3 both
hold**. Report cost beside it regardless.

## Disclosed, again

Row #10 was run at both strengths as a timing pilot before any of this was written (`none` -> `property:
none`; `high` -> `concealment`). It stays in the run for completeness and is **excluded from the primary
count**, reported separately as one already-seen observation.

## Machine state at launch

`qwen3:14b` unloaded from Ollama at the owner's explicit offer; llama-server, router and comfyui untouched.
Nothing here writes game state.
