# Pre-committed before the thinking-ON probe ran (OPUS-FIRST-DESIGN §5.0)

Written 2026-09-21, **before the first game**, against `95ce98c` (whose `src/` is byte-identical to
`34b3eb9`, the ambition batch's revision; every commit between is docs and checkpoints). Design:
`docs/OPUS-FIRST-DESIGN.md` §5.0, as revised by the third red team pass: **ten rounds, N = 5 per arm,
one-sided.**

## Arms

| arm | minds | thinking |
|---|---|---|
| Q | `qwen3:14b` both chairs | wits OFF (the default; `reasoning_effort: "none"`) |
| Qt | `qwen3:14b` both chairs | wits ON (`PRISONER_WITS_THINKING=on`) |

Shared: open variant, `PRISONER_ROUNDS=10`, `PRISONER_PRESENCE=modelled`, `PRISONER_SKIP_VOICE=1`,
referee `qwen3:14b` at its default thinking ON, direct to doris (no shim; every role is the one resident
model, so no swap ever happens), timeouts 600000ms for both arms because a thinking wits call on a 14b
can run long and a silence would measure the timeout, not the mind. Interleaved Qt, Q. Run from a
worktree pinned at `95ce98c`. Scratch database per game. Counts by `checkpoints/2026-09-20-ambition/count.mts`
(copied here as `count.mts`, arms Q and Qt) and, once it lands, `npm run measures`.

## Why one-sided

Two rounds measure initiative and nothing else (§69, D3). Ten rounds on the **current, unlocked** world
can rule thinking ON *in* — if Qt reaches like §69's Opus arm, the 4090 can close the gap by paying
thinking's cost and Phase 3 shrinks now — but cannot rule it *out*: a negative here says nothing about
the locked world, and Qt stays the standing arm of Phase 2 under D5 regardless.

## Predictions

Reference, §69's two-round Opus arm by chair: prisoner distinct targets over all intents **7**, door
intents **4 in 3 games**, refusals **12 of 40**; Q at two rounds: prisoner distinct targets **1**, door
**0**, refusals **4 of 40**.

- **Q at ten rounds:** prisoner distinct targets over all intents **≤ 3** (bar, and the spoon or tile
  once the bar is worn); door intents **0 or 1**; escapes **0-2**, through the window after the bar
  reaches 50; the warden reaches suspicion 40 in **≥ 3 of 5** games and catches in **1-2**.
- **Qt at ten rounds:** prisoner distinct targets **≤ 4**; door intents **≤ 2**; refusals **higher
  than Q's** (§66's B-on cell: thinking makes her attack what cannot work); escapes **0-2**.
- **The positive result that shrinks Phase 3:** Qt's prisoner distinct targets **≥ 6** or door intents
  in **≥ 3 of 5** games. I predict it does **not** happen: thinking changes which instrument she uses on
  the bar (§64, §66) and not whether she leaves it.

## What this cannot tell you

Anything about the locked world; anything about Opus at ten rounds (no Opus arm here by design, the
oracle waits for Phase 0); whether Qt's extra cost is affordable in play. A negative is not evidence
against thinking ON. **No number above is changed after seeing results.** Every transcript is committed
unedited.
