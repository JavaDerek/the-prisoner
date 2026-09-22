# Results: is the misruling the referee model's ceiling? (2026-09-22)

Prediction `PREDICTION.md`, committed before any call (`07e09de`). Instrument `run.mts`: every referee is asked the
SAME requests -- today's question set built by `createReferee` from each row's own recorded perception -- and every
reply goes through today's `computeRuling`. A row is right when the target/effect is in that row's pre-written
`accept` set (in `rows.json`, written before any call) AND the ruling is applicable. The one-act set is the 22 HOLDOUT
intents of `../2026-09-22-one-act-s2/`, asked as the separate call.

| referee | 43 misruled rows | sharpening as `restore` (8) | one-act chains (8) | one-act single acts (14) | median s/call |
|---|---|---|---|---|---|
| `claude-sonnet-5` (N=1) | **42** | 8 | 8 | 14 | 28 |
| `claude-opus-4-6` (N=1) | **41** | 8 | 7 | 14 | 65 |
| `qwen3:14b` (N=3, majority) | 21 | **0** | 8 | 11 | 10 |

**Scoreboard.** 2 **held**, by Sonnet 5 on every clause (>= 36 rows; >= 3 of 4 batch-2 sharpening rows; chains 8/8 and
single acts >= 13/14). 1 **held**: qwen3:14b 21 of 43, under the 25 ceiling, and 0 of 8 sharpening rows.

**The three Claude misses.** Sonnet: `b2#12`, a feigned seizure read as `noise` rather than `wear` on her own posture
(applicable, so the game moves; the accept set wanted the posture change). Opus: `b1#27`, a four-act chain keyed on the
blanket rather than the keys or the door; `b2#8`, "watch Voss ... her posture" keyed `prisoner/reveal` with no property,
so inapplicable; and one chain (`act#2`, untwist a wire then pick the lock) read as one act.

**What this settles.** Every class this project fought all day -- the direction of a change (sharpening read as damage),
a preparatory step counted as a second act, the spoon examined for a property it lacks -- is answered correctly by a
stronger referee with NO wording change. The wording was not the problem; `qwen3:14b` is the ceiling. Four probes of
wording on the one-act reading moved it 7/10 at best on preparation; Sonnet is 14/14 on the same intents.

**What it costs.** 28 s per ruling against `qwen3:14b`'s 6-10 s (Opus 65 s), through the router and a subscription
rather than local hardware. A ten-round game gains roughly 7 minutes.

**The open question for the owner** (recorded, not decided here): Claude as the referee for measured batches; or keep
`qwen3:14b` and count its misrulings as part of the measured gap; or two-tier -- rule locally and escalate on a signal.
Which signal is measured below: NOT instability, as first supposed, but the local referee's own refusal.

## Can a cheap referee tell when it is wrong? (the two-tier question)

Measured on qwen3:14b's own three tries per row.

| trigger | catches | false fires |
|---|---|---|
| the three tries disagree | 7 of 22 wrong rows | 3 of 21 right rows |
| **qwen refused the ruling** | **12 of 22 wrong rows** | **0 of 21 right rows** |

**15 of the 22 wrong rows are confidently wrong, 3 of 3**, so re-asking cannot find them. But a refusal is a precise
trigger: every row qwen refused-and-got-wrong is escalatable, and no correct row was refused. In batch 2 refusals were
13 of 120 rulings, so "escalate a refusal to a stronger referee" costs about one extra call in ten turns and removes
about half the misrulings.

The other 10 wrong rows were ruled **possible** and wrong -- every sharpening as `wear` (dulling what the actor was
sharpening), hides keyed on the container. Nothing local sees them, and the transcript looks clean. That is precisely
the class run-dmcp#43's player flag exists for: only the actor knows the ruling missed what they meant.

**Design this suggests** (for the owner): rule locally; escalate every refusal to a strong referee; catch the silent
remainder through player flags. Generic enough for the engine, not this game.
