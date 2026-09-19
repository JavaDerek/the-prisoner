# Overnight 2026-09-18 → 2026-09-19: morning report

Written for: Derek, reading it first thing. The night's work list was
`docs/WORLD-ELABORATION-DESIGN.md` §9's landing order, with all five §0 decisions already made.
**Every buildable step landed. The measurement then ran too** -- see the addendum at the end: the GPU was released mid-morning, P0 and cells A, B and one C1 game ran, and the sweep was stopped early on the owner's decision. The body below is as written before that, and is left unedited.

Read §9 beside this file; the row names below are its row names.

## Status at a glance

| Row | State |
|---|---|
| **E1** engine `IntendedCreate.constraints` | **DONE, published as `run-dmcp@0.9.0`.** Issue #42's four tests plus an existing-database variant. |
| **E2** AUTHORING-GUIDE lesson + four pointers | **DONE.** One lesson, and all five homes moved together. |
| **S1** pin `mind-seam@0.5.0` | **DONE.** |
| **P1** `npm run price-world` | **DONE, but never run.** The machinery exists; the band table is honestly empty. |
| **P1b** play-time `need` request + arm | **DONE.** Fires, logs, applies nothing. Base referee request proven byte-identical. |
| **P2** `OPEN_ACQUIRE` | **DONE, using 0.9.0's `constraints`** — not the post-resolve wart. |
| **B0** brink model constants → `qwen3:14b` | **DONE.** #49 re-measurement left alone, with a note. |
| **B1** brink pin `mind-seam@0.5.0` | **DONE.** 0.2.0 → 0.5.0; no brink code needed to adapt. |
| **P0** the one thinking-OFF/ON game | **BLOCKED — GPU.** No verdict on thinking. |
| **P3** build run + cells A, B, C1–C3, D, E | **BLOCKED — GPU.** No `PREDICTION.md`, no games, no numbers. |
| **P4** OPEN-VARIANT §66 + D5's verdict | **BLOCKED** — nothing to write it from. |
| **B2**, **M1** | **SKIPPED** by the brief: both are "after P4", and P4 did not happen. |

## The blocker, and the one decision that clears it

`ancient-awakening:12b` has been resident on doris all night, and I did not load it. The brief's rule
is unconditional — *if a model you did not load is resident, STOP the measurement and report; it
belongs to someone else* — so I stopped, and did every non-GPU row instead.

I checked whether the residency was informative before accepting it, and it is not:
`docs/DESIGN.md`'s own swapper section records that doris reports a multi-century `expires_at` for
**every** model it loads, so a deliberate pin and the leftover residue of your last run look
identical from here. That is exactly why `isFarFuturePin`/`detectPin` were deleted and replaced with
an explicit allowlist. Nothing was running locally; the last checkpoint transcript is from 20:01 on
the 18th, which is consistent with residue from your own session, but "consistent with" is not
evidence and the guard exists so nobody has to guess.

`assertNoForeignModel` would also have refused to start every one of these runs on its own, so
overriding my stop would have meant overriding the guard too.

**The decision is yours and it is one line.** If that model is yours to evict:

```bash
PRISONER_OLLAMA_RESIDENT_MODELS=ancient-awakening:12b
```

on the batch, which lets the run unload it and restores it afterwards. If it belongs to something
still running, it needs to finish first. Either way P0 must run before P3, because P0 decides whether
the eighteen full games cost an evening (thinking OFF, ≈2.7h) or a week (thinking ON, ≈12h).

## What landed

| repo | sha | what |
|---|---|---|
| run-dmcp | `59ddcd1` | a `create` leg may declare constraints on the entity it makes (#42) |
| run-dmcp | `53cd17e` | 0.9.0 |
| run-dmcp | `cc7de48` | AUTHORING-GUIDE: declare the space of what an object may come to be; describe what it is |
| the-prisoner | `c239997` | pin `mind-seam` 0.4.0 → 0.5.0 (S1) |
| the-prisoner | `d08120e` | the custody paragraph was stale — `set`/`create`/`destroy` already shipped (#5) |
| the-prisoner | `ac91ea9` | P1: `npm run price-world`, build-time band pricing (§4.2a) |
| the-prisoner | `fdcc888` | P1b: the play-time elaboration request — fires, logs, applies nothing (§4.1/§4.2) |
| the-prisoner | `7f58699` | pin `run-dmcp` 0.8.0 → 0.9.0 (P2) |
| the-prisoner | `df48ae5` | P2: `OPEN_ACQUIRE` — the elaborated fact is applied, not just logged (§4.3/§4.4) |
| the-prisoner | `c3eb2c8` | CLAUDE: point at the guide's new declared-space lesson |
| brink-workshop | `5c54f0d` | local model constants `qwen2.5:14b` → `qwen3:14b` |
| brink-workshop | `ca544d8` | `mind-seam` 0.2.0 → 0.5.0 (published, exact pin) |
| brink-workshop | `a13603b` | CLAUDE: point turnReader guidance at the new lesson |
| Adventurer | `9690b9c` | CLAUDE: point at the new lesson |

All pushed. `run-dmcp@0.9.0` is on npm, tag `v0.9.0`, trusted-publisher release green, provenance
signed. The Prisoner is pinned to it and is **the second real caller of what #42 added** —
`OPEN_ACQUIRE`'s `create` leg carries `constraints: [bounded, resolve_only]` inside the resolution,
so the new path never declares anything after `resolve()` returns. `adoptDerivedObject`'s original
wart is untouched; migrating the existing derive path off it was not tonight's job, and is now a
cheap follow-up that would close D2 completely.

## What is red

**Nothing is red.** Every repo is green on its own checks, run by me and not taken on an agent's word:

| repo | lint | typecheck | tests | build |
|---|---|---|---|---|
| run-dmcp | clean | clean | 54 files / 913 | clean |
| the-prisoner | 0 errors (2 pre-existing warnings) | clean | 68 files / 867 | — |
| brink-workshop | 0 errors (247 pre-existing warnings) | clean | 257 files / 4717 | clean |

run-dmcp's CI was green on `main` before I tagged. The engine vocabulary guard passes all 14 checks
including its untracked-file scan, which matters because the new AUTHORING-GUIDE lesson was written
in the engine's tree.

## The measurement that did not happen

For completeness, so the shape is here when the GPU frees up. **Every "actual" column is empty
because no call was made** — these are §4.8's pre-committed predictions and nothing else. The real
`PREDICTION.md` must still be written and committed *before* the first call, per §4.8's discipline;
do not let this table stand in for it.

| cell | n | band | prediction | actual |
|---|---|---|---|---|
| A. open window, round 1 | 10 | as built | fired ≤ 2/10 | — |
| B. welded window, round 1 | 10 | as built | fired ≥ 6/10; acquired ≥ 3/10 | — |
| C1. welded, 30 rounds | 5 | `trivial` | pursued ≥ 3/5; ratified 1–3/5 | — |
| C2. welded, 30 rounds | 5 | `hard` | pursued 1–3/5; ratified 0–1/5 | — |
| C3. welded, 30 rounds | 5 | `ruinous` | pursued ≤ 1/5; ratified 0/5 | — |
| D. open, 30 rounds | 3 | as built | pursued 0/3 | — |
| E. replay of B and C requests | N=5 | — | agreement on `need` ≥ 80% | — |

**The build run's numbers: none.** `price-world` has never been executed, so `ELABORATION_BANDS` is
an empty array and no `(object, kind)` pair has a band — including the one the welded scenario is
meant to open, which §4.8 says is the number that decides whether cells B–D can run at all.

**The elasticity reading, in one sentence: unreadable tonight** — it is the ordering across C1/C2/C3,
and no cell ran.

## The three things to look at first

1. **The GPU, and the one-line decision above.** It gates P0, P3 and P4 — the entire measurement half
   of the design, and the only half that can tell you whether Tier 1 changes what a mind does.
2. **A judgment call I let stand in P1.** §4.2a says the arm refuses to start on a `review` row or a
   stale hash; the agent generalised that to also refuse on a **missing** row, which is what makes
   today's empty table refuse correctly. I think it is the same failure under a third name, but it is
   a policy you did not write, and it is the gate every `PRISONER_ELABORATE=property` game must pass.
   Confirm or reject it before the first batch.
3. **`ELABORABLE_EXITS`' threshold is not general yet.** `openWhenIntegrityAtMost` is honoured only at
   `0`, because `OPEN_LEAVE`'s passability rule is hardcoded to `integrity === 0` exactly as the
   door's and window's already are. Faithful to the one content row §4.3 gives (`loose_tile` at `0`),
   but a future non-zero threshold is a trap until `OPEN_LEAVE` is generalised. Flagged, not hidden.

## Process notes you should have

- **P2 did not do literal test-first**, and said so. It wrote `OPEN_ACQUIRE`, then the tests, then
  validated the three load-bearing guards by planting violations and watching each go red — this
  repository's own stated discipline for guards, but not the order the night's rules required. I
  accepted it rather than spend hours regenerating identical code, and then **verified the suite has
  teeth myself**: I disabled the never-twice guard at `loop.ts:294` and exactly one test failed, the
  right one, showing a real second acquisition instead of `null`. Restored, 867 green. Every other
  row was genuinely red-first and each agent reported the failure it saw.
- **E1 made an engine schema decision worth your eye**, since it is shipped in a published minor:
  `resource_constraints.caused_by_event_id` carries no SQL `REFERENCES events(id)`. An immediate FK
  refuses every such insert, because the constraint row is written *during* the resolution loop while
  the `resolution.recorded` event is written after every change lands. `facts.opened_by_event_id`
  dodges this with a write-NULL-then-UPDATE pass; E1 left the column unenforced instead, matching how
  `events.causes` already references events. Documented in `schema.ts`.
- **B0 left the #49 re-measurement alone** as instructed — it needs a real playtest. The note is in
  `docs/reference/turn-reader.md`: the threshold was measured on `qwen2.5:14b` and has not been re-run.
- No agent made a model call, no game or checkpoint ran, and nothing touched a real database.
  `brink-workshop/data/games.db` was never opened.

## Log

- 03:15 CDT. Read the design, the four repo CLAUDE.mds, §64/§65 and run-dmcp#42. First `/api/ps`
  returned `ancient-awakening:12b`. Confirmed against DESIGN.md that `expires_at` proves nothing,
  confirmed nothing was running locally, and stopped the measurement track there.
- 03:20. Three agents in parallel: run-dmcp E1, brink B0/B1, the-prisoner S1. Caught my own mistake
  a few minutes later — I spawned P1 into the-prisoner off a partial `git log` reading while S1 was
  still finishing its second commit, and sent both agents explicit no-`git add -A` instructions
  rather than let them race. No collision resulted.
- 03:30–03:45. S1, B0/B1 verified and pushed. E1 verified: 913 tests, CI green on `main`, tagged
  `v0.9.0`. The release workflow reported success while `npm view` still said 0.8.0; rather than call
  it propagation lag I read the publish log — provenance signed to the sigstore transparency log —
  and confirmed the version document directly on the registry. It propagated a few minutes later.
- 03:45–04:20. P1, E2, P1b, P2 in sequence, each verified before the next built on it. The
  byte-identity claim for P1b I checked independently by diffing `referee.ts` across the commit:
  visibility modifiers and comments only, `buildQuestions` untouched.
- 04:20. The fourth AUTHORING-GUIDE pointer added by hand, which E2 could not do while P2 held the
  tree. All five homes now move together.

---

# Addendum, 2026-09-19 mid-morning: the measurement ran

The blocker above cleared: the owner confirmed `ancient-awakening:12b` could be evicted. Everything
below happened after that, with the owner awake and deciding at each fork. Full write-up is
`OPEN-VARIANT.md` §66; transcripts are `checkpoints/2026-09-19-elaboration/`.

## What changed against the report above

| Item above | Now |
|---|---|
| P0 blocked | **Done.** §66.1. Thinking OFF is coherent but cannot assemble a three-step plan; ON escaped at round 3. |
| Build run: none | **Done, committed.** 38 pairs. §66.3. |
| §4.8 table: no actuals | **A and B have actuals; C1 has one game; C2/C3/D/E never ran.** §66.4. |
| Elasticity reading: unreadable | **Still unreadable, and now for a better reason.** §66.5. |

## Two instruments had to be built first

§4.8's instrument did not exist in the game: §64.3's welded window was a static prompt file fed
straight to the model, and §64.7's thinking-off cells were raw-endpoint calls. Neither was a runnable
arm, so no real 30-round game could use either. Both were built test-first, defaulting to today's
behaviour: `PRISONER_WINDOW=open|welded` and `PRISONER_THINKING=on|off`. The welded arm reproduces the
prompt lab's ground truth verbatim, diffed against its own open control.

## Three defects found by reading output, not by testing

1. **A welded run's transcript header described the open room.** `## Objects as authored` printed
   `OPEN_OBJECTS` straight, so the header carried the window's *"with that bar gone, a person could
   climb through"* -- the one promise welding exists to remove -- while all 120 perception lines below
   it correctly described the welded room. The section a reader checks citations against was the wrong
   one. Fixed before the batch.
2. **The batch runner deleted committed transcripts.** Its first version cleared `checkpoints/*.md`
   between games so each run would name a single revision; that directory also holds the repository's
   own history. Caught on a smoke run by the dirty-tree line in the header, fixed to touch only
   untracked files, and re-verified (`dirty=0`, `Code revision: (clean)`).
3. **The `acquired` metric was blind.** `analyse.py` counted acquisitions by grepping for
   `OPEN_ACQUIRE`, which the transcript renderer never emits. It would have reported `acquired 0/10`
   on evidence incapable of showing anything else. Found by going looking for a positive case and
   failing to find one; fixed to read the markers `checkpointTranscript.ts` actually writes, so B's
   zero is now backed by its two explicit "nothing acquired" lines.

## The result, in one paragraph

Cell A held. Cell B was falsified, and §4.8's pre-named diagnosis for it was wrong -- the request never
fired, because welding does not make her fail, it makes her do something else that works. One C1 game
showed the trigger firing seven times over thirty rounds, acquisition reachable for only one `need` key
in four (§4.3 authored numbers for `integrity` alone -- a content gap in the design), and the prisoner
wearing the priced lock from 100 to 30 and walking out at round 11. The room still contains a route
that works without elaboration, so the remaining seventeen games would have measured *"she had a route
that worked"* rather than what an elaborated route costs. The owner stopped the sweep there.

## The three things to look at now

1. **§66.5's closing point: the dominant route has moved twice** -- window, then free door, then priced
   door -- and each time we checked, a cheaper route was still there. A room that asks whether a mind
   will pay for a route needs no unpaid route left in it, and that is scenario design, not band tuning.
2. **§4.3's band table prices one `need` key of four.** Until `edge`, `concealment` and `passage` have
   numbers, three quarters of what the referee can ground can never be acquired. Content, and yours.
3. **The build run read zero pairs as `impossible` and zero as `ruinous`.** The `difficulty` read is
   not discriminating between welded stone, a steel tray and a wool blanket. §7's provider facade was
   built for exactly this test -- rebind that one role to a stronger backend and re-read, fifteen
   minutes, no game.

## Still true from the report above

E1/E2, S1, P1, P1b, P2, B0 and B1 all landed and are pushed; `run-dmcp@0.9.0` is published and The
Prisoner is its second real caller. The process notes above stand, including that P2 did not do literal
test-first and that I verified its guards by hand.
