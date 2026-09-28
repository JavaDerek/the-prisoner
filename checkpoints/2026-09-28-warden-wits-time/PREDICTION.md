# the-prisoner#35 -- warden wits call timing: predictions

**Pre-registered 2026-09-28 (night) by Claude under the owner's overnight delegation** ("you have exclusive use
of the 4090, to do with as you wish ... don't ask questions"). Written before any model has been called for this
probe. Scaffolded against a clean tree; `probe.mts --dry-run` builds all 28 requests with the network forbidden
(no socket opens) and is the only thing that has run so far.

## What is asked

Issue #35: the warden's half-round grew from ~50s (old defaults, `checkpoints/2026-09-27T20-14-57-505Z.md`) to
56-91s (new defaults, `checkpoints/2026-09-28T01-09-16-356Z.md`). The coordinator's own per-call measurement from
those two transcripts found:

- the referee's own call: unchanged, median 27.9s -> 28.5s
- the one-act call: unchanged, median 5.4s -> 6.2s
- the remainder -- the warden's WITS call: **14.6s -> 35.0s**, while the warden's VISIBLE wits output
  (thoughts+candidates+intent+line+plan+notes) stayed the same length, median 1684 -> 1749 chars.

So the growth is either prompt processing (the new prompt is longer before the model writes anything) or hidden
reasoning tokens Ollama's glimmer parser discards (CLAUDE.md's 2026-09-27 correction: `reasoning_effort: "none"`
HIDES Muse's reasoning on Ollama, it does not stop it -- 101 hidden tokens measured at `none` against 70 at `low`
and 373 at `high` on one prompt). This probe isolates which, on the warden's own seven half-rounds (rounds 1, 2,
3, 5, 6, 7, 9 -- rounds 4 and 8 are the absence cadence's silent turns and are not among them), each rebuilt from
`checkpoints/2026-09-28T01-09-16-356Z.md` by replaying its earlier half-rounds through `runOpenGame`
(`../2026-09-28-probe-kit/kit.mts`, `rebuildContext`), under two arms:

- **`new`**: today's defaults, unchanged -- exactly what the recorded transcript ran, so this arm has zero replay
  divergence by construction (confirmed by the dry run: 0 divergences, 0 warnings, all seven contexts).
- **`old`**: the pre-2026-09-27 values of the seven arms CLAUDE.md's "Defaults changed on 2026-09-27" names,
  restricted to the ones that reach the warden's own wits prompt: `PRISONER_PRESENCE=off`,
  `PRISONER_ABSENCE=off`, `PRISONER_CONDITIONS=list`, `PRISONER_DOOR=unstated`, `PRISONER_DOOR_PRICE=free`,
  `PRISONER_BLOCK=off`, `PRISONER_ONE_ACT=checked`.

Only the warden's `createOpenWardenMind().consider()` call is timed. No referee ruling is made on the mind's
live proposal here -- the referee's own call is already measured unchanged, and a proposal from this probe is
never acted on, so nothing here needs to be correct, only the prompt and the response need to be real.

## `oneAct` is in the old-arm overrides for fidelity, and is not expected to move anything

`ONE_ACT_RULE` (`mind.ts`) is an unconditional constant string in both `buildOpenWitsPrompt` and
`buildOpenSingleCallPrompt` -- it is said to every mind regardless of `PRISONER_ONE_ACT`. The arm only changes
whether the referee makes a SEPARATE call to check for a second act, and `rebuildContext`'s own referee always
replays history at `oneAct: "off"` (`kit.mts` line ~328) regardless of what this probe's `arms.oneAct` says, so it
cannot move the rebuilt context's briefing either. It is set to the old value here only so the arm as printed in
the meta line matches CLAUDE.md's list byte for byte; PREDICTION does not depend on it doing anything, and the
coordinator's own measurement already found the one-act call unchanged (5.4s -> 6.2s).

## What the dry run already found, before any call

The dry run (`--dry-run`, no network) rebuilds all fourteen contexts (7 rounds x 2 arms) and reports the prompt
each one would send, plus `rebuildContext`'s own divergence/warning counts:

| round | new prompt chars | old prompt chars | old-arm divergences |
|---|---|---|---|
| 1 | 8049 | 6027 | 0 |
| 2 | 8648 | 6626 | 0 |
| 3 | 8723 | 6701 | 0 |
| 5 | 8516 | 6494 | 0 |
| 6 | 8681 | 7040 | 1 |
| 7 | 8692 | 6622 | 2 |
| 9 | 8518 | 6513 | 3 |

**Rounds 1, 2, 3, 5 are a faithful old-arm replay (0 divergences): the `old` context at these rounds is the exact
belief state a pre-2026-09-27 game would have reached from this same history.** Rounds 6, 7, 9 diverge starting
at round 5's replay: the recorded game's round-5 warden turn was ruled `window`/`block` (D4'), an effect that does
not exist under `PRISONER_BLOCK=off`, so replayed under the old arm it comes back `impossible` where the record
says `possible`; round 6's prisoner turn similarly cites the warden's own `sight`, which does not exist without
`PRISONER_PRESENCE=modelled`. **This is not a bug in the probe -- it is the honest fact that the recorded game
genuinely used mechanics (`block`, D13's laying-hands-on-warden, D12's sight) that the old arms do not have a
place for**, so an old-arm rebuild past that point is a plausible ALTERNATE history from the same earlier turns,
not a reconstruction of the recorded game's own belief state. Per this issue's own instruction ("record the
divergence rather than hiding it, or fall back to measuring the `new` arm's contexts with only the prompt-shaping
arms flipped"): **the divergence is recorded, not hidden** -- every live sample's row carries
`replay.divergences`/`replay.warnings`, and this file states plainly that rounds 6/7/9's `old` cell is an
alternate-history context, not the recorded one. It is still a coherent, buildable warden context (real
suspicion, real beliefs, a real world state that a genuine old-arm game could reach), so it is kept rather than
substituted, on the view that the actual question here -- does THIS SHAPE of prompt cost more wall time and more
completion tokens for the same visible output -- does not depend on the exact numbers in it.

Every prompt is 1500-2500 characters shorter under the old arms across all seven rounds, before either arm's
model has written a token -- consistent with the growth CLAUDE.md's issue names (the condition list, D2/D12's two
posture/sight readings, D5's absence line, D13's laying-hands line).

## Predictions (written before any call)

1. **Hidden reasoning**: if completion tokens grow >=1.5x (new vs old, medians) while visible chars (as defined
   in `probe.mts`'s `visibleChars`: the length sum of thoughts+candidates(JSON)+intent+line+plan+notes) grow
   <1.2x, the cause is hidden reasoning tokens Ollama's parser discards.
2. **Prompt size**: if prompt tokens grow >=1.5x and completion tokens do not (by the same bound), the cause is
   prompt size (more tokens to read before the first output token, at whatever prefill rate the card gives Muse).
3. Both could fire in the same run (the effects are not exclusive); neither firing means the ratios must be read
   by hand rather than filed under either label, which `--score` prints regardless of which band matched.

No band is asked to explain 100% of the wall-time growth on its own -- `--score` reports the raw ratios (ms,
prompt_tokens, completion_tokens, visible chars) so a reader can see how much of the 14.6s -> 35.0s each accounts
for, not only which crossed 1.5x.

## Candidate savings (named in the issue; NOT run by this probe)

- **Skip the warden's separate voice call when wits and voice models are equal.** Already true today: `mind.ts`
  line 500 (`if (witsModel === voiceModel)`) takes the single-call path whenever the two names agree, which they
  do by default (`DEFAULT_MIND_MODEL` for both), confirmed against `checkpoints/2026-09-28T01-09-16-356Z.md`'s own
  header ("Wits model: `muse-glimmer:30b`. Voice model: `muse-glimmer:30b`.", the one-line form
  `openModelHeaderLines` prints only when the two agree). No second call happens in either recorded transcript;
  this candidate needs no probe, only the confirmation this file's own final report gives.
- **Drop the absent-round wits call.** Already true: D5's cadence (`briefing.ts`) skips the warden's whole
  half-round on rounds 4 and 8 (`Half-round timings`: "round 4, warden: 23ms (silent)"), so no wits call happens
  on an absent round in either arm already.

Neither candidate is exercised by this probe (they are already the game's behaviour, not a change to test); they
are named here only because the issue asked for them to be reported alongside the timing measurement.

## Stopping rule

Three errored samples in a row stop the run (`MAX_ERRORS_IN_A_ROW`, `kit.mts`); `results.jsonl` resumes rather
than repeats. A second driver on the card, or Shep's traffic, is named in RESULTS if it happens
(OPEN-VARIANT §75.2).
