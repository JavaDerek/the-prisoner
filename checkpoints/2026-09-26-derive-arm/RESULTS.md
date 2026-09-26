# PRISONER_DERIVE_REPEAT: results against the pre-registered numbers

Run 2026-09-26 (UTC), on top of `b975cc5` (clean tree at the time `PREDICTION.md` was written; a
sibling checkpoint's own commits landed between then and this run -- see the drift note below for why
that matters). 14 calls, sequential, one process, `doris:11435`, `muse-glimmer-30b-q4_k_m`, thinking
OFF, temperature 0 (hardcoded). Raw output: `results.jsonl` (unedited), `logs/run.log`. Wall clock
565s (~9.4 min). Every request built fresh from `buildOpenWorld` plus the source game's own recorded
prior turns replayed mechanically, never a frozen/recorded request, per `prisoner-measurement-fidelity`.

**The GPU's llama-server was restarted earlier the same day** (`checkpoints/2026-09-26-arms/
logs/server-2.txt`), between last night's D11 run and this one. See the drift note below and
`docs/OPEN-VARIANT.md` §79.

## Per-row table, both arms

| id | kind | intent | OFF | ON |
|---|---|---|---|---|
| B7-P41 | fix | "tug the thread some more" | **blanket/derive/integrity** (moderate, T) | blanket/**wear**/integrity (slight, T) |
| B7-P44 | fix | "tug the thread again" | blanket/wear/integrity (slight, T) | blanket/**derive**/integrity (slight, T) |
| B7-P50 | fix | "tug the thread a little more" | blanket/wear/integrity (slight, T) | blanket/**derive**/integrity (slight, T) |
| B7-P11 | scope | "work the loose thread on the blanket hem" | blanket/derive/integrity (slight, T) | blanket/wear/integrity (slight, T) |
| B7-P47 | scope | "tug the loose thread quietly" | blanket/derive/integrity (slight, T) | blanket/wear/integrity (slight, T) |
| B7-P02 | trap-strict | "pull at the wool strip between my fingers" | strip/wear/integrity (slight, T) | strip/wear/integrity (slight, T) |
| B7-P15 | trap-soft | "pull a bit more thread from the blanket" | blanket/derive/integrity (slight, T) | blanket/derive/integrity (slight, **F**) |

Bold on OFF marks a row that reads differently from `RESULTS.md`'s own D11 recording of the identical
intent, last night, old server (the drift note, below). Bold on ON marks the row a criterion below
reads directly.

## Fix kill, against the pre-registered number

**Fix kill (need >= 2 of 3 fix rows read `target: blanket / effect: derive / property: integrity /
applicable: true` under ON): 2 of 3.**

`B7-P44` and `B7-P50` both moved from OFF's `wear` to ON's `derive`, exactly the fix this clause was
built for. `B7-P41` did not: it moved the OTHER way, from OFF's `derive` (already correct, no fix
needed) to ON's `wear` -- the clause's own precondition text ("wear only when the act works the piece
already taken, not the source it came from") is meant to protect exactly this kind of row from being
pulled the wrong way, and here it did the opposite. **2 of 3 clears the stated bar (fewer than 2 fails;
2 does not), but it lands exactly on the boundary the stopping rule names**, so it is worth stating
plainly rather than just posting the count.

**The boundary re-run, done in substance if not in name.** `determinism-sequence.jsonl` replays this
run's own exact call sequence (`B7-P41, B7-P44, B7-P50, B7-P11` x `OFF, ON`) a second time and
reproduces `B7-P41`, `B7-P44` and `B7-P50` identically in both arms -- `B7-P41` ON reads `wear` again,
not `derive`. That replay was built to check `B7-P11`'s stability (below), but it doubles as the
pre-registered boundary check: the 2-of-3 fix count is not a coin-flip artifact of one call: `B7-P41`'s
break is reproducible, not noise. **Fix kill: clears, on a reproducibly 2-of-3 count.**

## Strict precision kill, against the pre-registered number

**Confirmed clean.** `B7-P02` ("pull at the wool strip between my fingers") reads `target: strip,
effect: wear, property: integrity` in BOTH arms, byte for byte -- the clause does not pull a
correctly-targeted act on the already-taken piece onto the source. **PASS.**

## Scope rows, reported per the pre-registration, not scored

`B7-P11` and `B7-P47` are each their game's own first turn -- nothing derived yet, so the clause's
precondition cannot fire regardless of arm, confirmed at the prompt level by `--dry`
(`dry-run.jsonl`: `clause-present: false` in both arms, byte-identical requests). Both nonetheless
diverged live: `derive` under OFF, `wear` under ON, on identical wire content. Per the pre-registration
this is referee noise, not a clause effect, and is not scored against the fix or precision kill.

**`B7-P11`'s own stability, checked by hand beyond what the pre-registration asked for:**
`determinism-P11.jsonl` replays `B7-P11` alone, 3 times per arm (6 calls): 6 of 6 read `wear`. Added to
the scored run's own OFF and ON calls (2 more), that is 8 calls, of which exactly ONE -- the scored
run's own OFF call -- read `derive`; the other 7 read `wear`. `determinism-sequence.jsonl` then adds a
9th and 10th call (`B7-P11` OFF and ON, inside the full-sequence replay) and both read `wear` too,
consistent with the same picture. **This is a genuinely unstable row, 1 `derive` in 8 dedicated
stability calls** -- serial, temperature-0 calls are not fully deterministic for a close call,
extending `checkpoints/2026-09-25-*`'s own §75 finding (which showed non-determinism only under two
CONCURRENT drivers) to a single driver run alone. `docs/OPEN-VARIANT.md` §79 records this as a
standing lesson, not a finding scored against this clause.

## B7-P15, reported per the pre-registration, not scored

Flagged. D11's own corpus calls `wear` or `derive` on the blanket equally correct here ("the only
recorded case ruled wear instead of derive on materially identical wording ... the two are genuinely
close calls"), so the pre-registered rule only flags a landing on NEITHER. ON returned
`target: blanket, effect: derive, property: integrity` but `applicable: false` -- a third outcome the
rule anticipated exactly this row might produce. Recorded, not counted toward or against the clause.

## The drift note: `B7-P41`'s OFF answer moved since last night

`checkpoints/2026-09-26-human-intents/results.jsonl` (D11, last night, old server) recorded `B7-P41`
("tug the thread some more") as `blanket/wear/integrity`, applicable true -- the misread this whole
arm exists to fix. Today's OFF call for the identical intent, against the identical mechanical replay
of its prior turns, reads `blanket/derive/integrity` (`magnitude: moderate`), already correct without
the clause. The one thing that changed between the two calls is the serving process: the llama-server
was stopped and restarted earlier today (`checkpoints/2026-09-26-arms/logs/server-2.txt`), same model
file, same reasoning flag (confirmed by the trivial-probe token count), nothing else about its command
line preserved to compare. `checkpoints/2026-09-26-arms/RESULTS-2.md` found the same shape of drift
independently, on 7 of its own 39 rows, following the same restart. **This is not scored against
`PRISONER_DERIVE_REPEAT`** -- the fix-kill criterion is about the ON arm's own answer relative to
today's OWN OFF baseline, not last night's, and today's OFF/ON pair for `B7-P41` (`derive` -> `wear`)
is exactly what is scored above. It is recorded here because it is the same confound, on the same day,
against the same restarted server, and `docs/OPEN-VARIANT.md` §79 is where both findings are written
up together.

## Verdict

**Both pre-registered kills clear: the fix kill (2 of 3, reproducibly) and the strict precision kill
(clean).** Per `PREDICTION.md`'s own stated consequence, `PRISONER_DERIVE_REPEAT`'s default is a
**candidate to flip to `on`** -- a candidate, not a landing.

**The honest net, not just the pass/fail:** +2 fixed (`B7-P44`, `B7-P50`, both wear -> derive, correct
under ON), -1 broken reproducibly (`B7-P41`, already correct under OFF, pulled to the wrong answer
under ON, confirmed twice), for a net of +1 correct reading among the three fix rows the clause
targets. `B7-P15` landed on neither reading (`applicable: false` under ON) and is flagged, not counted
either way. This is a real, measured improvement on the population it was built for, with a real,
reproducible cost on a row precondition text was specifically written to avoid.

**`PRISONER_DERIVE_REPEAT` is NOT flipped. It stays `off` pending the owner's decision** on whether a
net +1 (out of 3, with one direction-reversal on an already-correct row) is worth landing, or whether
the clause's own wording needs a second pass to stop pulling `B7-P41`'s shape backward before it goes
in the game's own default path. This is a difference in kind from the D9 landing next door
(`checkpoints/2026-09-26-arms/RESULTS-2.md`): D9's kill cleared 3 of 3 with no reproducible regression
anywhere in its own item set; this arm's kill cleared 2 of 3 with one.

## What this run did not test

Only N=1 per row in the scored run itself (the determinism replays are separate, targeted checks, not
a resample of every row). `B7-P41`, `B7-P44` and `B7-P50` were each called exactly once more in the
sequence replay, matching every other row exactly; none of `B7-P47`, `B7-P02` or `B7-P15` was replayed
for stability, so whether their own single scored reading would hold up under a repeat call is unknown.
Nothing here measured a differently-worded clause that might keep `B7-P44`/`B7-P50`'s fix without
`B7-P41`'s regression -- that is the natural next step if the owner wants to keep pursuing this arm
rather than close it.
