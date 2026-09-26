# Re-probe of the D6+D9 arm under the new containment mechanic (owner's decision, 2026-09-26)

Written before any model call, on top of `c195281` (D9's mechanic addendum: `OPEN_CONCEAL_CONTAINER`
now floors a container's raised concealment at `CONTAINMENT_HIDDEN_AT_OR_ABOVE` regardless of the ruled
magnitude -- OPEN-VARIANT.md §77.1, `src/open/mechanics.ts`). This is **not** a new measurement of
D6 (already landed, `PRISONER_ELISION` default `on`) and **not** a new clause on the target/effect
questions -- `PRISONER_CONTAINER_CLAUSE` itself is byte-identical to what `checkpoints/
2026-09-26-arms/probe.mts` already asked. Only the MECHANIC the D6+D9 arm's rulings resolve through has
changed. This file exists because `PREDICTION.md`'s own D9 kill number was built out of two things
bundled together -- the targeting answer and the magnitude-gated containment check -- and the owner's
decision (OPEN-VARIANT.md §77.1) removed the reason the second half was gated on magnitude at all. A
kill that failed under the OLD mechanic is not evidence about the NEW one; it has to be asked again,
under the same discipline as every other arm here (a `PREDICTION.md` before the first call).

**Do not run this until the GPU is free.** This file is committed with no model call made against it,
per this task's own instruction.

## What changed since `PREDICTION.md`, and what did not

**Changed:** `OPEN_CONCEAL_CONTAINER`'s own adjudication. Where `PREDICTION.md`'s run measured
`magnitude: slight` on every one of C1/C2/C3/P1 and therefore `contained: false` on all of them (the
raise of +20 never crossed 50), the identical referee ruling -- same target, same effect, same
property, same `magnitude: slight` -- now resolves to `contained: true` on every one of them, because
the mechanic itself floors the raise at 50 regardless of what the magnitude answer says. This is
mechanical, not a prediction about the referee: `probe.mts`'s own `containedCheck` block runs the real
`planEffect` + `buildOpenResolver().resolve()` path and reads `world.personHeldIn.prisoner` back, so
whatever the live referee answers, this run measures the REAL resolved outcome, not an inference from
the magnitude key.

**Not changed:** the 13-item set, the three arms (OFF, D6, D6D9), the fixed call order, N=1 per item per
arm, the re-run-once-on-a-boundary rule, thinking off, temperature 0 (hardcoded), `doris:11435`,
`muse-glimmer-30b-q4_k_m`, one process strictly serial. Every row's own text, group and purpose is
`PREDICTION.md`'s, verbatim -- reproduced below only so this file is runnable on its own, never
retyped with a different wording.

## The item set (identical to `PREDICTION.md`)

| id | group | intent |
|---|---|---|
| S1 | S | hide |
| S2 | S | hide myself |
| S3 | S | cover myself up |
| S4 | S | try to conceal myself |
| O1 | O | push Croft to the floor |
| T1 | T | hide the spoon under the tile |
| T2 | T | crouch by the window |
| C1 | C | hide under the blanket |
| C2 | C | get under the blanket |
| C3 | C | crawl under the cot to hide |
| P1 | P | pull the blanket over myself |
| N1 | N | hide the spoon under the blanket |
| F1 | F | hide the prisoner under the blanket |

S/O/T rows are carried along only so this run reproduces `RESULTS.md`'s own D6 numbers as a sanity
check that nothing about the mechanic change touched a request these items never reach (`buildQuestions`
prints byte-identical target/effect prompts for S/O/T/N/F either way -- the mechanic lives downstream of
the referee, in `resolve()`, never in the prompt) -- **not** because D6 is being re-litigated. If S1-S4
do not reproduce 4/4 `target: prisoner` under D6 and D6+D9 exactly as `RESULTS.md` recorded, that is an
instrument-fidelity finding (something else changed since `RESULTS.md`), not a D6 result to act on.

## Kill numbers, named in advance

**D6: not re-scored.** Landed at `687d913`; this run's S/O/T rows are a reproduction check only (see
above), not a re-vote. Nothing here can un-land D6.

**D9 kill (superseded from `PREDICTION.md`): fewer than 2 of 3 C items (C1, C2, C3) read
`target: <container>` / `effect: conceal` / `property: concealment` in the D6+D9 arm AND resolve
`contained: true` through the real `planEffect` + `resolve()` path -> D9 stays off.**

This replaces `PREDICTION.md`'s own "magnitude in {moderate, substantial}" clause with the direct
`contained` field `probe.mts` already computes (it was computed and reported in the first run too --
`RESULTS.md`'s own table shows `contained **F**` on all three -- just not used as the criterion, because
under the old mechanic `contained` and "magnitude cleared the line" were the same fact). Under the new
mechanic they are no longer the same fact: `contained` can now be true even at `magnitude: slight`. The
bar itself is unchanged (2 of 3, the same number `PREDICTION.md` pre-registered) -- what changed is
which field decides it, because the field the old criterion named stopped being the thing that
determines the outcome a player experiences.

**D9 precision kill (unchanged from `PREDICTION.md`):** N1 ("hide the spoon under the blanket") reads
`target: blanket` in the D6+D9 arm -> D9 stays off, whatever the C-set result. Either trap row (T1, T2)
moving in the D6+D9 arm from its own OFF answer -> D9 stays off. Both are read straight from the
referee's answers, not the mechanic, so this criterion is exactly what `PREDICTION.md` already asked and
needs no updating.

**What a pass now means for the switch itself:** if the D9 kill and precision kill both clear, D9's own
default (`readContainerClauseMode`, `src/open/referee.ts`) is a candidate to flip to `on` -- a
consequence this file states now, before the call, exactly as `PREDICTION.md` stated D6's landing
consequence in advance. If it fails again, the failure this time is about the referee's OWN targeting or
citation behaviour (the mechanic can no longer be blamed), which is a materially different, more
interesting failure than §77's own "the mechanic never even engaged."

**O1, T1, T2, P1, N1, F1: reported exactly as `PREDICTION.md`'s own text specifies for each**, not
re-derived here. P1 in particular is worth re-reading once the new mechanic is in: `RESULTS.md` already
found P1 hit `target: blanket, effect: conceal, property: concealment` under D6+D9 with `magnitude:
slight` -- under the new mechanic this row's own `contained` field is a second, free data point on
whether the clause generalises past its own "under or beneath" wording, without a fourth arm.

## Stopping rule

Identical to `PREDICTION.md`: every item, every arm, called exactly once (N=1), fixed order S, O, T, C,
P, N, F x OFF, D6, D6D9 -- 39 calls, sequential, one process, one `for` loop. No label changed after
seeing a result. A result landing exactly on the D9 kill's "2 of 3" boundary gets that item re-run once
before the arm is called dead or alive, both runs kept in the raw JSONL.

## Before running: do not overwrite the first run's raw evidence

`checkpoints/2026-09-26-arms/results.jsonl` already holds the first run's 39 rows (referenced by
`RESULTS.md`), and `probe.mts` appends to that same fixed path with no run identifier in each record.
Move it aside first so the two runs are never silently interleaved in one file:

```bash
mv checkpoints/2026-09-26-arms/results.jsonl checkpoints/2026-09-26-arms/results-1.jsonl
mv checkpoints/2026-09-26-arms/logs/run.log checkpoints/2026-09-26-arms/logs/run-1.log
```

`probe.mts` itself needs no code change -- confirmed by running `--dry` on top of `c195281` (prints the
same three arms' prompts as before this mechanic change; no network call). Then, once the GPU is free:

```bash
curl doris:11435/health   # {"status":"ok"} expected before anything else
npx tsx checkpoints/2026-09-26-arms/probe.mts --live 2>&1 | tee checkpoints/2026-09-26-arms/logs/run-2.log
```

Write `RESULTS-2.md` from `results.jsonl` (the fresh file, post-move) after the last call, exactly as
`RESULTS.md` was written from the first run's -- not from memory of the run, and not folded into
`RESULTS.md` itself, which stands as reported under the mechanic that was live when it ran.
