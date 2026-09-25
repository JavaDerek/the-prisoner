# Pre-committed: does referee reasoning strength fix batch 6's wrong refusals? (2026-09-25, before the scored calls)

## The claim under test

OPEN-VARIANT.md §68.1/§68.5, measured on `qwen3:14b`: **thinking OFF makes the referee grab at objects;
thinking ON lets it answer correctly or correctly decline.** Batch 6 ran its referee at OFF
(`PRISONER_REFEREE_THINKING=off`) on `muse-glimmer-30b-q4_k_m`, and 14 of its 22 refusals were overturned
by Opus. This asks whether reasoning strength alone recovers them, on the model that actually ran.

## The wire fact this probe rests on, measured before it was designed

`docs/issues/prisoner-P8-thinking-switch-is-a-no-op.md` established that `reasoning_effort` does nothing
on this llama-server. Measured here at 2026-09-25, on the trivial prompt, against the live server started
with `--chat-template-kwargs '{"reasoning_strength":"none"}'`:

| per-request `chat_template_kwargs.reasoning_strength` | completion tokens | reasoning chars | seconds |
|---|---|---|---|
| `none` | 44 | 149 | 0.9 |
| `low` | 48 | 166 | 1.0 |
| `high` | 87 | 356 | 1.8 |

**A per-request strength overrides the server's start flag.** No restart of llama-server, Ollama or the
router is performed by this probe, and none is needed.

## Instrument

The **recorded** `request` (questions + sources) of each of batch 6's 22 refusals, replayed byte-identically
-- this is a pure A/B on one wire field, so the recorded request is the correct fixture, not a rebuild from
`buildOpenWorld` (which would vary the arm). Requests go **direct to `doris:11435`**, bypassing the router,
whose 150s per-attempt cap is below a `high` call's measured 163.5s. Scored through the repository's own
`computeRuling` with the real `isDeclared`/`isPerson`, so "refused" means what it means in play.
`muse-glimmer-30b-q4_k_m`, temperature 0, **N = 1 per row per arm**.

**N=1 is a direction, not a proof**, and is chosen because a `high` call costs 163.5s: N=3 over 22 rows
would be three hours. Recorded here so the results file cannot claim more than the instrument can carry.

## DISCLOSED: one call was made before this file was written

Row **#10** (`spoon`/`conceal`/`none`, "slide the spoon into the shallow hollow") was run at both strengths
as a timing pilot, and I saw the result: `none` reproduced b6's `property: none`; `high` answered
`concealment`. **Row #10 is therefore excluded from the primary count below**, which is over the remaining
**13** overturned rows. It is reported separately as what it is: one already-seen observation.

## Predictions

1. **Instrument check.** At `none`, the harness reproduces b6's recorded keys (`target/effect/property`) on
   **at least 3 of 4** check rows (#4 reveal-tile, #8 effect-noise, #11 posture, #1 control). If this fails,
   every prediction below is void and the probe reports only that.

2. **PRIMARY.** At `high`, **at least 7 of the 13** remaining wrongly-refused rulings become `applicable`.
   (More than half = the "marked improvement" bar, not a 100% fix.)

3. **CONTROL, and it is the kill.** At `high`, **at least 6 of the 8** correctly-upheld refusals STAY
   refused. If 3 or more of the 8 resolve, the arm is making the referee permissive rather than accurate
   and **does not ship whatever prediction 2 does**.

4. **SHAPE.** The effect-question cluster (#2,#3,#7,#8,#9,#11,#16 -- seven rows where the referee answered
   `effect: none`) resolves at a rate **greater than or equal to** the property-question cluster
   (#4,#5,#12,#18,#19,#20 -- six rows on `reveal`). Rationale: §68.5's mechanism is about whether the
   referee grabs or declines, which is the target and effect questions; choosing between `integrity`,
   `edge` and `concealment` on a `reveal` is a different failure and thinking need not touch it.

## Ship rule

The arm is worth wiring into play (P8 fix 2) only if **2 and 3 both hold**. Cost is reported beside it
regardless: a `high` referee call at 163.5s against 56.5s is ~2.9x, and a 10-round two-chair game makes
~40 referee calls.

## Pre-registered run order

Instrument check first (#4, #8, #11, #1 at `none`). Then the `high` arm in this fixed order, interleaving
arm and control rows so a partial run is still interpretable:

2, 1, 3, 6, 4, 13, 7, 14, 5, 15, 8, 17, 9, 21, 11, 22, 12, 16, 18, 19, 20

Results stream to `results.jsonl` as each call returns. A run cut short reports what completed, in order.
