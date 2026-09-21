# Pre-committed before Phase 1 batch 1 ran (OPUS-FIRST-DESIGN §4.1)

Written 2026-09-21, **before the first game**, against `1a66459`: Phase 0 landed (§3.1 reader
rebalancing and loud failure; §3.2 a noise needs no property; §3.4 refusal renders state the why) and
the model router committed (D2, `npm run model-router`). First world-completion batch of the Opus-first
program: the oracle is `claude-opus-4-6` in both chairs, pinned by id (D1); ten rounds (D3); voice ON,
because these transcripts are meant to be read; `PRISONER_PRESENCE=modelled`; referee `qwen3:14b` on
doris at thinking ON; wits thinking at its default; timeouts 300000ms; N = 10, two drivers side by side,
launched through the router from a worktree pinned at `1a66459`. The §5.0 thinking probe is running on
doris at the same time and shares the referee.

## What this batch is for

Not the gap: the world. Its output is the **refusal audit list** (`npm run measures`, §2) for the owner
to label genuine / unbuilt / unclear, and the count of **newly discovered** unbuilt classes, which is what
the lock rule counts. Two things it can already tell against §69's two-round batch: whether the Phase 0
fixes removed the refusals they were for, and what ten rounds add that two never gave time for.

## Predictions

- **Lost rulings: 0** (§3.1). Malformed replies will still occur on Opus-length intents, at roughly the
  same 6-7% of replies, and every one is recovered or printed as a failed call.
- **Noise refusals: 0** (§3.2). Any `noise` ruling resolves; at least **3 of 10** games have a noise
  reach the other chair's briefing by name.
- **Refusals overall: 20-35 of 200** rulings (§69 was 12 of 40 at two rounds; ten rounds give the
  warden the tray and the spoon to keep asking about). Of those, **at least half** land on the custody
  residue (`meal_tray`, `spoon`, `key_ring` with effect `none` or an impossible `reveal`/`open`), which
  is §4.2 item 1 and already queued; so the batch should discover **at most 2 new unbuilt classes**
  beyond custody and the §68.7 rendering gaps. My guess at the two: *waiting / doing nothing as an act*
  and *speech aimed at the other person as its own effect*.
- **The door: found in ≥ 5 of 10 games**, escapes through it **≥ 3** (it is unstated and free, and at
  ten rounds there is time). This is the batch that forces §4.2 item 3.
- **The warden reaches suspicion 40 in ≥ 4 of 10 games** and catches in **1-3**: the first cat-and-mouse
  evidence under Opus.
- **Refusal renders**: every refused actor's next briefing names the effect and a reason (§3.4); no
  "(none)" citation table appears in any transcript.

## What this cannot tell you

Anything about Qwen (no Qwen mind here); whether a mechanism should be built (that is D4's two-source
rule and the owner's labels, applied after); whether Opus 5 would differ (its framing probe is still
owed before batch 2). **No number above is changed after seeing results.** Every transcript is committed
unedited; a game that ran through a broken router or network is quarantined in `discarded/` with a README.
