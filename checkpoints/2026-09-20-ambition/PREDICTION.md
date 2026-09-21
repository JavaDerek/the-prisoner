# Pre-committed before the ambition comparison ran

Written 2026-09-21, **before the first counted game**, against `34b3eb9`. Question: when qwen3 minds only
propose what the world affords (§64) and one Opus game (`checkpoints/2026-09-19T00-56-38-193Z.md`) lied,
hid, muffled and stopped short of a threshold, is that the **model** or the **world**? Controlled
comparison: same room, same referee, only the minds change.

## The design, fixed before the first game

Three arms, interleaved O, D, Q per cycle, N = 10 per arm, launches stop at 3h15m of wall clock:

| arm | both minds | where |
|---|---|---|
| **Q** | `qwen3:14b` (Q4_K_M) | doris, through the shim unchanged |
| **O** | `opus` | keyless `claude` CLI in print mode, through the shim |
| **D** | `Qwen/Qwen3-235B-A22B-Instruct-2507` | DeepInfra, through the shim |

D is the owner's addition (2026-09-21) to the two-arm design: the same family as Q at roughly sixteen
times the parameters, so that a Q/O difference can be read as *scale* or as *something about Opus*.

Shared by every arm: open variant; `PRISONER_ROUNDS=2`; `PRISONER_PRESENCE=modelled` (a person is a
legal target); `PRISONER_SKIP_VOICE=1`; condition list default; door unstated and free; window
default (not welded); referee `qwen3:14b` on doris at its default thinking ON; wits thinking at its
default OFF (`reasoning_effort: "none"` on the wits call -- ignored by the Claude CLI, accepted by
DeepInfra); think and referee timeouts 300000ms; every game from the worktree pinned at `34b3eb9`;
scratch database per game. The referee is never Opus.

**Known and accepted:** at two rounds warden suspicion cannot realistically reach the 40 a catch needs.
This is a test of initiative, not of cat-and-mouse.

**Known differences that are the routing, not the design:** the Claude path cannot set `temperature`
(the mind sends 0.9; qwen and DeepInfra honour it); the Claude path passes an empty `--system-prompt`
and the whole wits prompt as the user turn, which is what the other two paths send as well; the shim
hides `qwen3:14b` from `/api/ps` so the swapper never unloads the resident referee, which means every
transcript header reads "(no models loaded)" and doris's real `/api/ps` is recorded in
`logs/<arm>-<n>.log` before and after each game instead.

## Measures -- structural only, counted from ruling keys the code writes

Per game, from each half-round's referee table (`target`, `effect`), its `**Ruled:**` line and the
`## Result` line. Four intents per game (2 rounds × 2 principals). Never from prose.

1. **distinct target ids attempted** per game (0-4);
2. **games where any intent targets a person** (`warden` or `prisoner`);
3. **distinct effect kinds** per game (0-4);
4. **rulings grounded** (ruled possible, target not `none`) vs **refused** (`target: none`, or ruled
   impossible);
5. **escapes**.

Reported per arm as a mean (1, 3) or a count (2, 4, 5), and per game in a table. Prisoner-only and
warden-only splits are given as well, because the two chairs have different affordances.

## Predictions

- **Q (baseline, per §64):** distinct targets **≤ 2.0** per game on average; person-target games
  **≤ 1 of 10**; distinct effects **≤ 2.0**; grounded **≥ 32 of 40** rulings; escapes **0**. The room
  says bar and spoon, and she says bar and spoon.
- **O:** distinct targets **≥ 2.5**; person-target games **≥ 4 of 10** -- the recorded Opus game had a
  blanket over the warden's head before presence was modelled, and now the warden is a legal target;
  distinct effects **≥ 2.5**; grounded **≥ 30 of 40** (I expect Opus to produce compound intents the
  referee has to pick one act from, and a few to be refused for that); escapes **0-2**, and any escape
  is through the free door, not the window (the bar needs two substantial wears before the window
  opens, and a leave after that -- three acts in two turns).
- **D:** **between the two, and nearer Q**: distinct targets **2.0-2.5**; person-target games
  **1-3 of 10**; distinct effects **2.0-2.5**; escapes **0-1**.

## What would falsify each reading

- **"It is the model":** supported if O clears both its numbers (targets ≥ 2.5 AND person-target games
  ≥ 4) while Q stays under both of its. **Falsified** if O's person-target games ≤ 1 of 10 and its mean
  distinct targets is within 0.5 of Q's -- then the one Opus game was a fluke of a two-game sample and
  the world is the limit for Opus too.
- **"It is scale within one family":** supported if D lands within 0.5 targets of O and ≥ 3
  person-target games. **Falsified** if D is within 0.5 of Q on targets and ≤ 1 person-target game
  -- then sixteen times the parameters of the same family buy nothing here, and whatever O has is not
  scale.
- **"The measures cannot see it":** if all three arms are within 0.5 targets and 1 person-target game
  of each other, the structural measures are too coarse for this question, and the quotes in
  `RESULTS.md` are all there is. That is a legitimate outcome and it is written down so it cannot be
  reframed as one of the others.

## What this cannot tell you

Whether any of it is "ambition" or "creativity": that is the owner's reading of the verbatim quotes,
never a count. Whether the same held at ten rounds. Whether a person's presence as a target changed Q
against its own 170-game history (this batch has presence modelled; most of that history did not).
Whether the referee, itself `qwen3:14b`, is ruling a large model's compound intents the way a person
would -- the referee is held fixed precisely so that this is the same distortion in every arm.

**No number above is changed after seeing results.** Every transcript is committed unedited, and a game
that ran through a broken shim or a failing network is quarantined in `discarded/` with a README, never
counted and never deleted.
