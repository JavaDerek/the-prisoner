# Overnight 2026-09-17 → 2026-09-18: morning report

Written for: Derek, reading it first thing. The night began with him playing his own game for the first
time; everything below came out of that one four-round game. Evidence is in OPEN-VARIANT.md §47–§53,
`checkpoints/2026-09-18*`, and `checkpoints/2026-09-18-door-price/analyse.mts`.

## Status at a glance

| Item | State |
|---|---|
| **A human seat** (#11's terminal half) | **DONE, played.** `PRISONER_HUMAN=prisoner\|warden` seats a person at a terminal against the model in the other chair, through the same seam and the same referee. The player reads the model's own prompt opening byte for byte (`renderSeatSituation`, test-pinned). §47. The console was never needed for this. |
| **#15** every object described twice | **DONE, closed.** The briefing's copy is gone; `renderSeatSituation`'s stays, because it is the array the referee is handed. Verified no fact was briefing-only. **This changed every prompt.** §49 |
| **#16** "reached past what is here" | **DONE, closed**, and the issue's framing was wrong: `targetKeys` never offers an unperceived object, so "out of reach" and "named nothing the world models" are the same ruling and the old wording was wrong for every case it could be reached from. Now "matches none of what is here". §49 |
| **#17** an instrument that does not exist | **ARM BUILT, default off.** `PRISONER_INSTRUMENT=checked` adds a seventh referee question with three legal keys — a perceived object, `none`, or `absent` (the intent names a tool she does not have) — which blocks the ruling with a positive reason. First version detected it only when the model broke its own closed-key instruction; sent back and rebuilt. **Re-ruled live: the referee answered `instrument=none` 10/10 with the arm on, never `absent`** -- the mechanism is sound and this referee will not use it. §51.6. See D2 |
| **#18** "pull a wire out" ruled `wear` | **ARM BUILT, default off.** `PRISONER_DERIVE_WORDING=sharpened`. **Re-ruled live and it works: `wear` 10/10 under baseline, `derive`/`wire` 9/10 under `sharpened`.** The shared-cause theory in the issue is refuted -- the raw reply shows `product: none` carried an empty citation object, a moot answer's bookkeeping, not a missed one. §51.6. This also shuts the exploit Derek walked, since a real wire then exists a turn before it is cited |
| **#19** the door costs nothing | **TWO ARMS, default unchanged, and a measured result.** See D1 — this is the item that matters most. §50 |
| **#20** a voice fragment as dialogue | **DONE, closed.** One-character shape rule (a line ending in `,` `;` `:` is a voice silence), plus the finding that mattered more: `onVoiceSilence` was wired nowhere, so every voice failure was already invisible. §52 |
| **#21** a human-fiction view | **ROUTE 1 DONE, open for route 2.** `PRISONER_VIEW=prose`, default `raw`, human seat only. A completeness test pins every belief value, stamp, object and threshold through the prose path; a line-length test pins the wall-of-text regression the first version had. §53 |
| **#22** social intents | **PROPOSAL WRITTEN, nothing built.** `docs/issues/SOCIAL-INTENTS.md`. Its central move is to refuse the belief-writing effect outright and get the same play from a person's own physical property plus `noise` at a principal. See D5 |

## What the human game found, in one paragraph

Derek escaped at round 4 through the door, for 15 suspicion, with the door unstated in his conditions.
The door's passage had `openWhenPartAtMost: null` where the window's is 50, the lock was never damaged,
and every catch condition needs suspicion ≥ 40, so the route could not be punished at all. He also
picked the lock with a wire that did not exist, and his "pull a wire out of the cot" was ruled `wear`
against a world that declares `wire` derivable from the cot. On turn two he tried to fake a heart attack
and was told his attempt "reached past what is here". **Four defects and a retraction of §46 out of one
game, and thirty-odd model games had found none of them.**

## The door: what the arms measured (D1's evidence)

Eleven games so far, arms alternating, `PRISONER_DOOR=stated`, qwen3:14b wits, voice skipped, referee
qwen2.5:14b, 30 rounds available:

| arm | games | out the door | mean escape round | mean final suspicion | games that aimed at the door or lock at all |
|---|---|---|---|---|---|
| `free` | 6 | **4** | 3.7 | 35 | 4 |
| `threshold` (lock ≤ 30) | 5 | **0** | 6.4 | 71 | **0** |

`threshold` did not price the door. It **removed the door from consideration**: not one prisoner intent
in five games was ruled against the door or the lock. She is right to decline — the lock wears 20 at a
time (100, 80, 60, 40, 20) and `SEARCH_CATCH_LOCK_MAX` catches her at 40 or below, so reaching a gate of
30 means passing through the catch band, which the window never asks of her. The rule this yields, now a
test rather than an argument: **a route is only worth starting if some wear step leaves the way out
openable while its own part is still safe to be found at.** A gate of 50 fails identically (40 is the
first step under it), so "mirror the window's own 50" is wrong too — I proposed that to Derek and
withdrew it an hour later. §50.5.

Hence the third arm, `PRISONER_DOOR_PRICE=margin`, gating the lock at **60**: two wear turns, openable,
and still safe to be found at. **Not parity** — 3 turns and 30 suspicion against the window's 5 and 50 —
because claiming parity was the first arm's mistake. What it buys is the first room where both ways out
are worth starting, which is the precondition mother-of-invention's thesis has never had. §50.6. A
free-vs-margin batch is queued and will be reported here.

## Log

- 21:20 CDT. Built the human seat test-first (#11's terminal half), 673 tests. Smoke-tested it with
  piped keystrokes and found the failure worth keeping: with stdin not a terminal, `readline` closes
  before the first question, every turn silently became "do nothing", and the transcript read like a
  lost game. `assertSeatIsPlayable` now refuses that up front. **A misconfiguration that produces a
  plausible transcript is worse than a crash.** Retested through a pty.
- 22:40. Derek played and escaped at round 4 through the door. Eight issues filed (#15–#22), §48 written,
  transcript committed.
- 22:47–22:55. Five Sonnet agents, each in its own worktree, no agent permitted to call a model. Four
  branches merged after review; two were sent back — #17's first instrument arm fired only when the
  referee disobeyed its own instructions, and the prose view's first version recovered the rules by
  counting lines in another module's rendered output (fixed by exporting `seatSituationParts` as data).
- 23:00. Batch 1 (4 games) then batch 2 (10 games) on the door arms, strictly sequential, one model on
  the card at a time. A methodological error caught mid-batch: branches were being merged into `main`
  while a batch ran off it. The prompts had not moved (round-one briefings compared and identical), but
  that was luck, so `CLAUDE.md` gained the rule and `runRevision.ts` now prints `Code revision:` in every
  transcript, dirty tree named as such.
- 23:15. `margin` arm built from what `threshold` measured. Queued free-vs-margin from a worktree pinned
  at `6bf2189`, following the rule as written.

## Decisions for Derek

**D1. The door's price.** `free` is still the default and every recorded batch is comparable to it.
`threshold` (30) is measured and dead — keep it as the arm that proves the catch-band argument, or delete
it. `margin` (60) is built and being measured now. The question: **does the door become a real second
route at 60, and if it does, should `margin` become the default?** Making it default changes what every
future batch compares against, which is why I have not.

**D2. Promoting #17 and #18.** Both are arms with byte-identical requests when off, and the re-rule has
now separated them. **#18's `sharpened` wording works** -- `wear` 10/10 under baseline, `derive` with
`product=wire` 9/10 under the arm -- and is my recommendation as the next arm to measure in real games,
because it also shuts the exploit path of #17 in practice. **#17's question does not work with this
referee**: offered the legal, true key `absent`, it answered `instrument=none` in all ten trials for an
intent that says *using the wire*. The mechanism blocks correctly when that key is answered, so the
bottleneck is judgement, not contract -- and that distinction only exists because the first version of the
arm was sent back and rebuilt. Left off. If retried, test the question's own wording, not the plumbing.
One caution for both: the sharpened arm gave 9/10 rather than 10/10 at temperature 0, so there is a small
standing noise floor here (§46.5).

**D3. The prose view.** It is faithful and scannable, and it is still a briefing rather than a scene —
real fiction would not enumerate eleven objects, and the requirement that every fact survive is what
stops it. Worth taking to route 2 (a narrator model over the same data), or is route 1 enough for play?

**D4. #16's third target key.** Splitting "named something real but unperceived" from "named nothing the
world models" needs a new closed key on the `target` question. §51 has now added exactly that shape for
instruments (`absent`), so there is a pattern to copy. Worth it, or leave the honest single wording?

**D5. Social intents (#22).** The proposal needs one content decision from you: should a person's own
physical state (posture, distress) be a bounded numeric property like every object's — uniform and cheap,
but posture is arguably not gradual — or a flag kind the current vocabulary has no analogue for? And which
of the three gaps do you want built first? The proposal recommends presence, because the primitive already
exists and is merely never read.
