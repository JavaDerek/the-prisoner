# D9 re-probe under the new containment mechanic: results

Run 2026-09-26 (UTC), same probe (`probe.mts`, unchanged), same 13-item set, same three arms (OFF,
D6, D6+D9), same fixed order, N=1 per item per arm, thinking OFF, temperature 0 (hardcoded),
`doris:11435`, `muse-glimmer-30b-q4_k_m` -- the mechanic under D6+D9 resolves through is the only
thing that changed since `RESULTS.md` (`c195281`, OPEN-VARIANT.md §77.1: `OPEN_CONCEAL_CONTAINER`
now floors a raised container's concealment at `CONTAINMENT_HIDDEN_AT_OR_ABOVE` regardless of the
ruled magnitude). Total wall clock 1373s (~22.9 min), against `RESULTS.md`'s own 1293s -- no item
landed exactly on a kill threshold, so the pre-registered re-run clause did not fire on its own terms
(see the drift finding below for why it fired anyway, informally, via the sequence check). Raw
output: `results.jsonl` (unedited, one JSON object per call, moved-aside original at `results-1.jsonl`),
`logs/run-2.log` (original at `logs/run-1.log`), server restart recorded at
`logs/server-2.txt`.

**The server was restarted between the two runs.** The owner freed the GPU and the orchestrator
restarted the Muse llama-server; its original full command line from last night was never recorded
anywhere, only the reasoning flag. `logs/server-2.txt` records the restart command and confirms the
trivial-probe check (33 completion tokens, matching the value `docs/issues/
prisoner-P8-thinking-switch-is-a-no-op.md` recorded) before this run started. See the drift finding
below and §79 for why this matters beyond a bookkeeping note.

## Per-item table, today's run (all three arms)

`target/effect/property` (`magnitude`, `applicable`; `contained` where checked). **Bold** marks a row
whose key (`target`/`effect`/`property`) differs from `RESULTS.md`'s own recorded answer for the
identical arm and item (last night, old server) -- the drift finding, below. A `contained` flag that
changed while the key stayed the same is the mechanic doing its pre-registered job, not drift, and is
not bolded.

| id | group | intent | OFF | D6 | D6+D9 |
|---|---|---|---|---|---|
| S1 | S | hide | none/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/**none** (slight, F) |
| S2 | S | hide myself | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |
| S3 | S | cover myself up | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/**conceal**/none (slight, F) |
| S4 | S | try to conceal myself | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |
| O1 | O | push Croft to the floor | warden/**none**/posture (moderate, **F**) | warden/wear/posture (moderate, T) | warden/wear/posture (moderate, T) |
| T1 | T | hide the spoon under the tile | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) |
| T2 | T | crouch by the window | prisoner/wear/posture (slight, T) | prisoner/wear/posture (slight, T) | prisoner/wear/posture (slight, T) |
| C1 | C | hide under the blanket | none/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | blanket/conceal/concealment (slight, T; contained T) |
| C2 | C | get under the blanket | **blanket/conceal/concealment** (slight, **T**; contained **T**) | **blanket/conceal/concealment** (slight, **T**; contained **T**) | blanket/conceal/concealment (slight, T; contained T) |
| C3 | C | crawl under the cot to hide | **none/conceal/none** (slight, **F**) | prisoner/conceal/posture (slight, T) | cot/conceal/concealment (slight, T; contained T) |
| P1 | P | pull the blanket over myself | prisoner/conceal/none (slight, F) | **prisoner/conceal/posture** (slight, **T**) | blanket/conceal/concealment (slight, T; contained T) |
| N1 | N | hide the spoon under the blanket | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) |
| F1 | F | hide the prisoner under the blanket | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |

(D6D9 S1 and S3 also drifted on `property`/`effect` respectively -- last night's `RESULTS.md` had S1
at `prisoner/conceal/posture` and S3 at `prisoner/none/none`; today both read `prisoner/conceal/none`.
Bolded in the table above.)

## D9 kill, under the new mechanic, against PREDICTION-2's own number

**D9 kill (need >= 2 of 3 C items reading `target: <container>` / `effect: conceal` /
`property: concealment` AND resolving `contained: true` through the real `planEffect` + `resolve()`
path, in D6+D9): 3 of 3.**

C1 (`blanket/conceal/concealment`), C2 (`blanket/conceal/concealment`) and C3
(`cot/conceal/concealment`) all read the fully-grounded targeting triple -- identical to
`RESULTS.md`'s own recorded targeting answers, byte for byte -- and all three now resolve
`contained: true` (`containmentResourceValue: 50` in each case, `hiddenAtOrAbove: 50`), where the
same three readings resolved `contained: false` under the old mechanic. This is exactly the change
§77.1 predicted: the referee's targeting behaviour is untouched, and only the resolution the referee's
own `magnitude: slight` answer feeds into moved. **PASS, comfortably clear of the 2-of-3 bar (3/3).**

## D9 precision kill, against PREDICTION-2's own number

**Confirmed clean.** N1 ("hide the spoon under the blanket") reads `target: spoon` in every arm,
including D6+D9 -- unmoved from `RESULTS.md`. T1 and T2, the two trap rows, are byte-identical across
OFF, D6 and D6+D9 in today's run (`spoon/conceal/concealment` and `prisoner/wear/posture`
respectively), so neither trap moved from its own OFF answer. **PASS.**

## Reproduction check (D6 sanity, not re-scored)

`PREDICTION-2.md` carried S1-S4 along only to confirm nothing about the mechanic change touched a
request D6's own clause governs. All four still read `target: prisoner` in D6 (4/4) and all four
still read `target: prisoner` in D6+D9 (4/4) -- the sanity check holds. Two of the four (S1, S3) drifted
on their `effect`/`property` answer in D6+D9 between the two runs (see below), but never on `target`,
so this is drift in the sense scored below, not a D6 result to act on. **D9 was measured and stays
scoped to the C-set and the precision rows, as pre-registered; nothing here reopens D6.**

## The 7-row drift: a server-restart confound, recorded honestly

7 of the 39 rows read a different `target`/`effect`/`property` key today than `RESULTS.md` recorded
last night, on the identical item, identical arm, identical prompt-building code
(`buildOpenWorld` + `computePerceivedObjects`, never a recorded request): **OFF O1, OFF C2, OFF C3, D6
C2, D6 P1, D6D9 S1, D6D9 S3**. None of the seven is a scored D9 row -- the three C-set items that
carry the D9 kill (C1, C2, C3 in the D6+D9 arm) and the precision rows (N1, T1, T2 in D6+D9) are all
identical to `RESULTS.md`'s own recorded answers. The drift lands entirely on rows this checkpoint
either does not score (O1 is a sanity row in every arm; the D6D9 S-group's `effect`/`property` answers
are read for `target` only) or scores under D6, which is not being re-litigated here.

The two runs differ in exactly one respect: the llama-server serving Muse was stopped and restarted
between them (`logs/server-2.txt`), with a `chat-template-kwargs` reasoning flag confirmed identical
by the trivial-probe token count (33) but no other part of its command line preserved anywhere to
compare against. Nothing in this checkpoint can rule in or out what changed on restart --
`-ngl`/`-c`/`-np`/quantisation are all candidates, and none of them was recorded before the restart to
check. **This is the honest state of the evidence: a reproducible referee answer, on a model believed
unchanged, moved when the serving process restarted, and this checkpoint cannot say why.** See
`docs/OPEN-VARIANT.md` §79 for the standing lesson this becomes.

## Verdict

**D9 kill and precision kill both clear under the new mechanic.** Per PREDICTION-2's own stated
consequence ("if the D9 kill and precision kill both clear, `PRISONER_CONTAINER_CLAUSE`'s own default
... is a candidate to flip to `on`"), D9 lands. This is a batch boundary: the mechanic fix (§77.1) and
this re-probe are what make the landing correct, not a re-scoring of §77's own dead run, which stands
exactly as reported.

## What this run did not test

Only N=1 per item per arm; no item landed exactly on the kill threshold under this run's own
criterion, so the pre-registered re-run-on-boundary clause did not fire by its letter. The 7-row drift
above was not itself a pre-registered trigger for a re-run (none of the drifted rows is a kill or
precision row), so none of the seven was re-run under this checkpoint's own protocol; they are
reported once, as recorded, per the "no label changed after seeing a result" rule. Whether the
server-restart drift reaches any OTHER checkpoint run against Muse today (`checkpoints/
2026-09-26-derive-arm/`) is addressed there, not here.
