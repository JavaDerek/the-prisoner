# P-DE -- draft-then-extract vs one-pass: predictions

**Pre-registered 2026-09-28 by Claude under the owner's overnight delegation** ("you have exclusive use of the
4090, to do with as you wish ... don't ask questions"). Scaffolded against the tree at the commit this checkpoint
is committed alongside (see the commit's own `git log`). No model has been called: `probe.mts --dry-run` built all
190 requests (95 rows x 2 arms) and 0 draft calls were sent, confirmed below.

## What is being asked

`the-prisoner#9` SS1 could not verify the branded "Draft-Conditioned Constrained Decoding"/"KL-Projection Tax"
claim -- see `docs/OSS-AND-DCCD-VERDICTS.md`, which treats it as unverified. The underlying idea it leaned on is
real, though: Tam et al. 2024, *"Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance
of Large Language Models"* (arXiv:2408.02442), found that forcing a smaller model directly into a constrained,
structured answer measurably degrades its reasoning-heavy task performance relative to letting it reason in free
text first, and that the ordinary mitigation is two calls: an unconstrained draft, then a constrained call that
extracts the structure from that draft. #9 SS1 asked, verbatim: *"This bears directly on our referee:
`createTurnReader` asks the model for closed answer keys and verbatim citations in one constrained pass. If the
projection effect is real at 14B, that call is costing us ruling quality. Worth measuring against the existing
checkpoint corpus: same intents, one-pass vs draft-then-extract, compare rulings."* This probe is that measurement.

**A scoping note the probe's own header states, restated here:** this repository's referee (`src/open/refereeTransport.ts`)
does not actually use grammar-level constrained decoding at all -- no `response_format`/JSON schema is sent; the
constraint is a PROMPTED one ("Answer with exactly one of: ..."), with a syntax-repair pass on the reply. So this
measures whether an unconstrained reasoning pass, added ahead of the existing prompted-JSON call, changes the
ruling -- the mitigation Tam et al. describes, applied to the constraint this repository actually has, not to a
grammar-masked one no part of this stack uses. That distinction belongs in the verdicts doc and is not re-argued
here.

## Items and arms (N = 1 per item per arm, serial, one driver)

All 95 rows of the D11 corpus (`checkpoints/2026-09-26-human-intents/corpus.json`), each ruled twice on its own
rebuilt context (`../2026-09-28-probe-kit/kit.mts`, so the world, presence, conditions and every other arm are
built exactly as `src/checkpoint.ts` builds them -- never a copied harness):

- **`one-pass`**: the referee exactly as the game calls it -- one call, closed answer keys, verbatim citations.
- **`draft-extract`**: an UNCONSTRAINED call first (no answer-key list, no citation format, an explicit instruction
  not to give a verdict), over the SAME sources and questions, then the ordinary constrained call with that prose
  added as one more citable source (`id: "draft"`). Implemented entirely as a transport wrapper
  (`draftExtract` in `probe.mts`), the same shape as `checkpoints/2026-09-28-request-order/probe.mts`'s
  `intentLast` -- **no `src/` file changes**, so this is a probe-only arm, not a new `PRISONER_*` switch, and the
  game's shipped referee is byte-identical to before this checkpoint.

**Both arms run with `oneAct: "off"`**, a deliberate override of today's shipped default (`"first"`, since
2026-09-27): the one-act reading is its own separate single-question call over the intent alone
(`readOneAct`, `src/open/referee.ts`), orthogonal to what #9 SS1 asks about (the six-question closed-key call)
and already measured on its own terms by P1 (`checkpoints/2026-09-28-first-act/`). Matches
`checkpoints/2026-09-26-human-intents/probe.mts`'s and `checkpoints/2026-09-26-arms/probe.mts`'s own precedent
for a targeted referee probe. A combined draft-extract-under-`oneAct=first` measurement is a follow-on this probe
does not attempt.

## Scoring

Each row's `expectedKeys` (target/effect/property, pre-registered by D11, `corpus.json`) is matched against the
live ruling; an alternate reading such as `"wear-or-derive"` matches either value, exactly as
`checkpoints/2026-09-26-human-intents/RESULTS.md` scored those rows by hand. **7 of 95 rows carry
`expectedKeys: null`** (`I25-1`, `I25-2`, `I25-3`, `I25-4`, `I25-5`, `I25-6`, `I25-7` -- D11's own real-human-intent
band, which the D11 corpus itself scored descriptively, not against a baseline) and are reported, not scored, here
too: there is nothing pre-registered to call an improvement or a regression on them.

Over the remaining **88 scorable rows**:

- **improved** = one-pass did not match `expectedKeys`, draft-extract did.
- **regressed** = one-pass matched `expectedKeys`, draft-extract did not (a row draft-extract makes WORSE -- the
  harmful case).

This is a coarser instrument than D11's own four-way label (correct/misread/unmodelled/ambiguous): it asks only
whether draft-extract moves a row across the match/no-match line, not why. That is deliberate -- #9 SS1 asks
"compare rulings," and a full four-way relabelling of 190 new rulings by hand is its own, larger task this probe
does not take on. The `improved`/`regressed` lists in `--score`'s own output name every row by id, so a relabel is
possible later without rerunning anything.

## Predictions

| id | prediction | rationale |
|---|---|---|
| **1** (primary) | draft-extract improves **>= 5 of 88** scorable rows | Large enough to be worth the doubled call cost (below) on a corpus where D11 itself measured an 11-of-70 (15.7%) misread rate on the harder, terser population -- 5 rows recovered would be a meaningfully large fraction of that gap, not noise. |
| **2** (primary) | draft-extract regresses **at most 1** row | The mitigation is meant to help extraction, not add a second place for the referee to go wrong; D11's own primary kill line for the referee itself was "misreads above 10%" -- for an 88-row population that is 9, so a single tolerated regression here is a far tighter bar, deliberately, since this arm is optional and opt-in. |
| **KILL-improve** | fewer than 2 rows improve | Two calls' worth of latency and cost for less than 2 recovered rows is not worth adopting under any framing; the underlying idea would be confirmed real in general (Tam et al.) but not worth this repository's own overhead. |
| **KILL-regress** | 2 or more rows regress | More than the one regression the primary bar already tolerates means the draft is actively misleading the extraction step on more than one row -- a genuinely worse instrument, not a wash. |

**What the outcomes mean, written before any call:**

- **1 and 2 both hold, no kill fires** -- the mitigation measurably helps this referee's own reading, at the cost
  of roughly doubling the referee's call count and wall time (below). Worth prototyping as a real `PRISONER_*` arm
  (default off, per CLAUDE.md's arm discipline) in a follow-up issue -- **not** worth doing tonight under this
  task's own scope (a probe, not a game change).
- **1 fails, 2 holds, no kill** -- the mitigation is harmless but not doing enough to earn double the latency;
  reject for this referee, record as a negative result in the verdicts doc, and say so plainly rather than declare
  a spike needed with no evidence a spike would find anything.
- **KILL-regress fires** -- the draft text is itself misleading the extraction step (a fabricated or badly-hedged
  "citation-shaped" reasoning the model then treats as one more source) -- reject outright; a needs-a-spike verdict
  would be wrong here too, since the failure mode is now measured, not merely feared.

## Time cost (reported, not gated)

`checkpoints/2026-09-26-human-intents/RESULTS.md` measured 95 one-pass-shaped calls (its harness also ran
`oneAct: "off"`) at 3324s total, ~35s/call on average, serially against `muse-glimmer:30b`. On that basis:

- `one-pass` (95 calls): ~55 minutes, comparable to that run.
- `draft-extract` (95 draft calls + 95 extraction calls = 190 calls): roughly **2x** `one-pass`'s time, ~110
  minutes, since the draft call reads the same sources at similar length (a prose prompt, not a JSON one, so its
  own per-call time may differ from the extraction call's -- `probe.mts --score`'s own `secs` comparison, once run,
  reports the two separately rather than assuming they are equal).
- **Total for both arms, serially, one driver**: roughly **2.75-3 hours**. This is an estimate stated before any
  call, not a measured number; `--score` reports the real median per arm once `results.jsonl` has rows.

## Stopping rules

- Three errored samples in a row stop the run (`checkpoints/2026-09-28-probe-kit/kit.mts`'s own
  `MAX_ERRORS_IN_A_ROW`; rerun resumes from `results.jsonl`).
- A kill is announced at the poll it fires; the run finishes regardless (every row is still evidence).
- A second driver, or Shep's traffic, is named in RESULTS.md if it happens (CLAUDE.md "one driver at a time").

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected, DEAD/OPEN/MET, per `renderScoreboard`
(`checkpoints/2026-09-28-probe-kit/kit.mts`). A dead prediction is announced at the poll it dies, per the owner's
2026-09-21 stopping-rule convention.

## Confirmed before commit

`npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --dry-run` built 190 requests (95 items x 2 arms), none
sent. The probe's own trailer line reports "95 draft call(s) attempted (0 sent -- dry run)": the draft-extract
code path ran once per row (`draftCallsMade` counts the function call), and every one of those 95 calls returned
the labelled dry-run placeholder without `fetch` ever being invoked -- confirmed by the run completing at all,
since `forbidNetwork()` (`checkpoints/2026-09-28-probe-kit/kit.mts`) replaces `fetch` with a function that throws
for the whole process. `npx tsx checkpoints/2026-09-28-draft-extract/probe.mts --score` against an empty
`results.jsonl` prints every prediction OPEN with 0/0, no crash. `npm run typecheck`, `npm run lint` and
`npx vitest run` all pass unchanged (87 files / 1468 tests) -- this checkpoint changes no `src/` file.
