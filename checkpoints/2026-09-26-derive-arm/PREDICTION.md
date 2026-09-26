# PRISONER_DERIVE_REPEAT: pre-registered probe (written before any model call)

Written 2026-09-26, on top of `b975cc5` (clean tree; `git status` shows only this checkpoint
directory untracked). `PRISONER_DERIVE_REPEAT` landed in `c290f79` (clause) and `b975cc5`
(doc-comment scope fix), off by default, TDD, `referee.test.ts`'s own describe block green, full
suite 1274/1274, `npm run lint`/`npm run typecheck` clean. No `src/` change happens after this file
is committed until `RESULTS.md` is written.

**This probe is written and `--dry`-verified only. It has not been run against a model.** Per this
task's own absolute rule, no network call to doris was made while producing this file --
`npx tsx checkpoints/2026-09-26-derive-arm/probe.mts --dry` was run to confirm the request-building
half works and makes no network call (`dry-run.jsonl`, `dry-run-warnings.json`, committed alongside
this file). `--live` is not invoked here.

## What is being measured

`OPEN-VARIANT.md` §78 (`checkpoints/2026-09-26-human-intents/RESULTS.md`) found 5 of 70 batch-7
paraphrase misreads were one behaviour repeated five times: a terse "tug the thread [again/some
more/quietly/a little more]"-shaped paraphrase read as `wear` on the blanket where the referee's OWN
recorded original ruling (on the fuller, un-paraphrased intent) was `derive`, product `strip`. This is
attacked first, per the owner's instruction, as a measured, off-by-default arm distinct from
`PRISONER_DERIVE_WORDING=sharpened` (§51.3-§51.6, the-prisoner#18): that arm's own live validation
(§51.6) moved a **first** derive attempt ("pull a wire out of the cot", nothing yet made) from `wear`
9/10 times to `derive`; it was never measured against a **repeat** attempt where a piece already
exists, which is the shape this arm targets, and is not repeated here (its own clause text is
untouched).

**The clause** (`referee.ts`'s `REPEAT_DERIVE_CLAUSE`, appended to the effect question, conditional on
`repeatDeriveMode === "on"` AND at least one derivable kind already having an instance among the
perceived objects):

> Working the target again for more of a kind of thing it has already yielded here -- tugging,
> pulling, cutting or scraping out another piece of the same material -- is derive again, a further
> piece kept, not damage with nothing to show; it is wear only when the act works the piece already
> taken, not the source it came from.

## The scope boundary, checked by hand before writing a single row

Replaying each of D11's 5 misread rows' own prior turns from their OWN source b7 transcript (never a
recorded/frozen request -- `buildOpenWorld` fresh, only the mechanical history replayed) found that
only **3 of 5** actually have a derived `strip` in view at the point the paraphrase is read:

| id | round | source game | strip already in view? |
|---|---|---|---|
| `B7-P41` | 5 | `2026-09-25T06-41-21-019Z.md` | yes (`strip`, `strip_2`) |
| `B7-P44` | 8 | `2026-09-25T06-41-21-019Z.md` | yes (`strip`, `strip_2`, `strip_3`) |
| `B7-P50` | 4 | `2026-09-25T06-58-52-807Z.md` | yes (`strip`, `strip_2`, `strip_3`) |
| `B7-P11` | 1 | `2026-09-25T05-45-03-050Z.md` | **no** -- this IS the game's own first turn |
| `B7-P47` | 1 | `2026-09-25T06-58-52-807Z.md` | **no** -- this IS the game's own first turn |

`B7-P11` and `B7-P47` are each their game's OWN FIRST recorded turn (round 1): nothing has been
derived yet, so this clause's own precondition cannot fire for them regardless of arm --
`dry-run.jsonl` confirms `clause-present: false` in BOTH arms for both rows, i.e. their two arms'
requests are byte-identical. They are a DIFFERENT failure shape (a first-attempt paraphrase eliding
the "keep the piece" aim language -- `sharpened`'s own territory, not measured by this arm) wearing
the same surface words ("tug"/"work the thread"). **This arm is scored only against the 3 rows where
its own precondition actually holds; `B7-P11`/`B7-P47` are reported as a scope check, never a third
kind of fix or kill row.** Overclaiming "fixes D11's wool-derive cluster" against all 5 would be the
exact `prisoner-measurement-fidelity` mistake this project's CLAUDE.md warns against -- measuring
against a request the clause cannot possibly touch and calling a null result a pass.

## The item set (7 rows, drawn from `checkpoints/2026-09-26-human-intents/corpus.json`)

**Fix rows (n=3, kill row): want `target: blanket`, `effect: derive`, `product: strip`,
`property: integrity`, `applicable: true` under ON.**

| id | intent tested | OFF (predicted, reproducing RESULTS.md) |
|---|---|---|
| `B7-P41` | "tug the thread some more" | `blanket/wear/integrity`, applicable true (RESULTS.md's own recorded live answer) |
| `B7-P44` | "tug the thread again" | `blanket/wear/integrity`, applicable true |
| `B7-P50` | "tug the thread a little more" | `blanket/wear/integrity`, applicable true |

**Scope rows (n=2, reported not scored): the clause's own precondition does not hold (no strip yet).
OFF and ON must read identically -- confirmed already at the PROMPT level by `--dry`
(`dry-run.jsonl`), so a live divergence here would be referee noise, not the clause, and is reported
as such rather than blamed on it.**

| id | intent tested | OFF (predicted, reproducing RESULTS.md) |
|---|---|---|
| `B7-P11` | "work the loose thread on the blanket hem" | `blanket/wear/integrity`, applicable true |
| `B7-P47` | "tug the loose thread quietly" | `blanket/wear/integrity`, applicable true |

**Trap rows (n=2): the clause's precondition DOES hold (a strip already exists), which is exactly
what makes these the precision test -- does the new sentence tempt the referee to over-apply `derive`
even to an act on the ALREADY-TAKEN piece, or to a row the corpus itself calls a genuine close call?**

| id | intent tested | kind | must / may read |
|---|---|---|---|
| `B7-P02` | "pull at the wool strip between my fingers" | trap-strict | MUST stay `target: strip, effect: wear, property: integrity` in both arms -- this is D11's own live-confirmed answer (`RESULTS.md`, `strip/wear/integrity`), and the clause's own last clause ("wear only when the act works the piece already taken, not the source it came from") exists specifically to protect this row. |
| `B7-P15` | "pull a bit more thread from the blanket" | trap-soft | Reported, not scored. D11's own corpus (`blanket-wear` shapeGroup) pre-registers EITHER `wear` or `derive` on the blanket as correct here ("the only recorded case ruled wear instead of derive on materially identical wording... the two are genuinely close calls"). Flagged only if it lands on neither (e.g. `applicable: false`, or a target other than `blanket`/`strip`). |

## Kill numbers, named in advance

- **Fix kill: fewer than 2 of 3 fix rows read `target: blanket / effect: derive / property: integrity
  / applicable: true` under ON -> the clause stays off.** (2 of 3, the same bar shape
  `checkpoints/2026-09-26-arms/PREDICTION.md` used for its own 3-item C-set.)
- **Strict precision kill: `B7-P02` moves off `target: strip` OR off `effect: wear` in the ON arm ->
  the clause stays off, whatever the fix rate.** A clause that redirects a correctly-targeted act
  onto the wrong object is worse than the gap it was built to close (§68.2's own standing warning,
  restated by `checkpoints/2026-09-26-arms/PREDICTION.md`'s own D9 precision kill in the identical
  shape).
- **Scope-boundary check (reported, not a kill number): `B7-P11`/`B7-P47`'s OFF and ON answers.** Any
  divergence here is recorded as referee noise (the requests are byte-identical between arms for
  these two, confirmed by `--dry`), not scored against the clause, and not grounds to keep the clause
  off if the fix and precision kills both clear.
- **`B7-P15`: reported exactly as described above, never scored.**
- **What passing means for the switch:** if the fix kill and the strict precision kill both clear,
  `PRISONER_DERIVE_REPEAT`'s own default (`readDeriveRepeatMode`, `src/open/referee.ts`) is a
  candidate to flip to `on` -- stated now, before the call, exactly as
  `checkpoints/2026-09-26-arms/PREDICTION.md` stated D6's landing consequence in advance. Landing it
  fixes 3 of D11's 5 wool-derive misreads (60%), not the whole cluster -- the remaining 2 need a
  first-attempt fix (`sharpened`, already built, never landed) or a new clause of its own; this file
  does not conflate the two.

## The standing warning this probe is not exempt from

`OPEN-VARIANT.md` §68.2: a candidate clause built for a document decision was measured and scored 0 of
4, worse than silence, and was never landed. `checkpoints/2026-09-26-arms/RESULTS.md`'s own D9 finding
is the adjacent case: a clause that does exactly its own job on the targeting half can still fail
because a DIFFERENT question (there, magnitude; nothing analogous is at stake here, since this clause
touches only the effect question the fix rows are scored on) gates the outcome. If either kill fires,
it is written up in `docs/OPEN-VARIANT.md` exactly as failed, not softened, and the switch stays off.

## Stopping rule

Every row, every arm, called exactly once (N=1), in the fixed order (fix rows first, then scope, then
trap) x OFF, ON -- 14 calls total, sequential, one process, one `for` loop (`probe.mts`'s own
`mainLive`), never `Promise.all`, never a second driver (CLAUDE.md "one driver at a time"). No label
above is changed after seeing a result. If a fix-row count lands exactly on the "2 of 3" boundary,
the remaining ambiguous row is re-run once more before the arm is called dead or alive, and both runs
are kept in the raw JSONL. Results are written to `checkpoints/2026-09-26-derive-arm/results.jsonl`
(append, unedited) as they arrive, and `RESULTS.md` is written from that file after the last call, not
from memory of the run.

## Exact commands to run once the GPU is free

```bash
curl doris:11435/health   # {"status":"ok"} expected before anything else
npx tsx checkpoints/2026-09-26-derive-arm/probe.mts --live 2>&1 | tee checkpoints/2026-09-26-derive-arm/logs/run.log
```

`probe.mts` resumes from `results.jsonl` if interrupted (skips any `arm:id` pair already recorded), so
a ctrl-C mid-run loses no completed calls; `mkdir -p checkpoints/2026-09-26-derive-arm/logs` first if
the directory does not already exist.
