# Night state — the running log of `docs/STRATEGY-DESIGN.md` §6, re-based to T+0 = 2026-09-25 04:00Z

**This file is the handoff to my own next wake-up.** The agent executing §6 runs on a self-paced loop and
does not carry a guaranteed memory between wake-ups, so what is true lives here and in git, never only in
a context window. Every wake-up: read this file, then `git log --oneline -8`, then the running jobs.

| window (re-based) | UTC | CDT | step |
|---|---|---|---|
| T+0 → T+0:10 | 04:00 → 04:10 | 23:00 → 23:10 | 0. instrument check |
| T+0:10 → T+0:45 | 04:10 → 04:45 | 23:10 → 23:45 | 1. falsifier probe (GPU) |
| T+0:10 → T+1:30 | 04:10 → 05:30 | 23:10 → 00:30 | 2. batch-6 write-up (no GPU) |
| T+0:45 → T+2:00 | 04:45 → 06:00 | 23:45 → 01:00 | 3. build, TDD, **hard cutoff 06:00Z** |
| T+2:00 → T+2:15 | 06:00 → 06:15 | 01:00 → 01:15 | 4. pre-register batch 7 |
| T+2:15 → T+5:00 | 06:15 → 09:00 | 01:15 → 04:00 | 5. batch 7, **no game starts after 08:40Z / 03:40 CDT** |
| T+5:00 → T+5:40 | 09:00 → 09:40 | 04:00 → 04:40 | 6. write-up + morning report |
| T+5:40 → T+6:00 | 09:40 → 10:00 | 04:40 → 05:00 | 7. restore the machine |

## Standing rules for every wake-up

- **Never ask the owner anything.** He is asleep. Every negative path in §6 is pre-registered; take it.
- Commit as each thing lands. A wake-up that finds uncommitted work commits it before starting anything.
- `npm run format` is forbidden (§6 step 3).
- A prediction is announced **DEAD the poll it becomes arithmetically impossible**, with the
  so-far / projected-at-7 / dead-or-open columns (the owner, 2026-09-21 and 2026-09-22).
- Report times in **Chicago** in prose; keep UTC in committed artifacts quoting machine logs.
- `DMCP_DB_PATH` must name a `/tmp` scratch in anything that builds a world. Root CLAUDE.md rule 2.
- Delete nothing in `/tmp`. Step 7 restores `qwen3:14b` (`keep_alive: -1`) and `comfyui.service`, and
  **leaves llama-server exactly as found** — it was running before this session and is not mine to stop.

## Log

- **04:00Z step 0 PASSED** (`SETUP.md`, commit `e3458c3`). §1.1's five rows re-ran identical; D7's escape
  does not fire. Machine as §6 describes it. Nothing restarted.
- **04:07Z step 2, the owed part, DONE** (`a04751e`): b6's 7 P + 7 S copied from `/tmp/b6-worktree`
  byte-identical (`diff -r` silent) and committed. Logs came across but `*.log` is gitignored, as for
  batches 3–5.
- **04:09Z step 1 LAUNCHED** detached: `probe.mts --tag=main --strong=20 --none=10`, log `/tmp/probe-main.log`,
  replies `replies-main.jsonl`. OPTIONS fixed 7 options; option 1 is the bar-and-mortar, so **P0.f is
  likely live**. `high` asks cost ~95 s and ~4500 completion tokens each — far more than §1.3's toy — so the
  probe lands ~04:45Z, not 04:40Z.
- **04:11Z step 2 measures + scoreboard + 22-refusal audit committed** (`e5ada16`), with issues P8
  (the wits thinking switch is a no-op on this server) and moi A1 (outcome on an `Account`).
- **04:12Z refusal escalation LAUNCHED** detached (Opus via the router, no GPU), log `/tmp/b6-escalate.log`.

## Baselines corrected, for step 4 (§6 step 4's own negative path: move the number, keep the margin, say so)

- **Band 2**: §5.1's "distinct targets per game (P 4.29, S 3.14)" is the **scoreboard's** pooled column.
  `npm run measures` calls the prisoner chair's own figure **3.71**. Step 4 must name the instrument.
- **Band 6**: §5.1 calls 41.4% the "re-try rate". It is the **repeat rate** (any re-use of a pair); b6 split
  the two mid-batch (`47e3514`) and the real re-try rate is **1.4%**. A "≤ 30%" band against 1.4% is
  unfalsifiable in the wrong direction, so band 6 is re-based onto the repeat rate.
- **Band 5** confirmed as written: prisoner refusals = turns with **no keys**, P 2 of 70 (2.9%), S 10 of 68 (14.7%).
- **Band 3** needs the per-game `barIntegrity` floor, not the mean (b6 mean: P 95.43, S 83.86). Compute in step 4.

## Near miss, recorded rather than hidden

The probe's first run created an empty `the-prisoner/data/games.db`: importing the world code directly does
not get `checkpoint.ts`'s `DMCP_DB_PATH`, and run-dmcp's own default is under the repo. The directory did not
exist before and the run died on a missing table, so nothing real was touched. `probe.mts` now names a `/tmp`
scratch itself and initialises the schema. Goes in `RESULTS.md`.

- **04:18Z the router's own cap, found the hard way and it is a DESIGN finding, not just a harness one.**
  The probe's third `high` ask came back empty at exactly 300.023 s with a 502: `local produced no reply in
  2 attempts of 150000ms each`. That is `modelRouter.ts`'s `DEFAULT_DORIS_ATTEMPT_TIMEOUT_MS` (150 s,
  overridable by `SHIM_DORIS_ATTEMPT_TIMEOUT_MS`, unset on the router Derek started at 18:25 CDT). A `high`
  COMMIT call on the **real** seat runs 92–111 s, so it sits just under a ceiling it will sometimes cross.
  - **For the probe**: an instrument ceiling must not be tallied as P0.b ("empty or context-overrun
    replies"). The asks were re-run **direct against doris:11435**, bypassing the router, which §1.1
    already established forwards the body verbatim on the local route — so this is the same request to the
    same server with the retry wrapper removed. The **same seven options were reused** (`--reuse-options`),
    not re-drawn, so §5.0's one-options-call rule holds and the restart moved nothing but the transport.
    The three router-era asks are kept as `replies-router-attempt.jsonl` and are **not** part of the tally.
  - **For batch 7**: the games go through the router (`run-batch.sh` sets
    `PRISONER_MODEL_URL=http://localhost:8799/v1`), so the cap would bite in play. §5.1's own band 8
    budgets **five minutes** for this call, so the cap, not the band, is the thing out of step. **Step 5
    must restart the router with `SHIM_DORIS_ATTEMPT_TIMEOUT_MS=400000` before game 1**, after the
    escalation finishes, and the morning report must say the router was restarted and why.
- **04:20Z step 1 RELAUNCHED** direct, same options, log `/tmp/probe-main.log`. Lands ~04:56Z.

- **05:04Z step 1 DONE and written up** (`RESULTS.md`). **P0.a 20/20, P0.b 0** — the build gate passed with
  no fallback to `medium`. **P0.c: neither pre-named reading applies** — identity χ²=8.70 (p=0.19) and
  position χ²=10.10 (p=0.12) over 7 options, i.e. **uniform**; the choice is indistinguishable from chance
  at N=20. **P0.d**: uniform at `none` too, and `high` costs 9.7× the tokens (6043 vs 626) and 9.8× the wall
  clock (125 s vs 12.8 s). **P0.e FAILED, 10 of 20** (band ≥12) → build anyway, batch 7 expects adherence
  **without** depth. **P0.f SKIPPED** — the bar took 2 of 20 by identity, so no trope to discriminate.
  Its modal pick is the **blanket**, which b6's fourteen games targeted **zero** times.
- **04:58Z step 3 BUILD GREEN and committed** (`9535d50`): 1190 tests / 74 files, typecheck clean, lint 0
  errors. `strategy.ts`, `withReasoningStrength` beside `withThinking`, `OpenNews.strategy` + one briefing
  line, `checkpoint.ts` wiring with the header block and both raw replies, `adherenceByGame`, and the
  revision trigger logged under `fixed`. `PRISONER_STRATEGY=revise` throws rather than running `fixed`.
- **05:04Z NEXT: step 4**, pre-register batch 7, with the three baseline corrections above AND band 3
  expected to fail on P0.e. Then restart the router at 400 s and launch.

- **05:08Z step 4 DONE** (`b4ee598`): `checkpoints/2026-09-25-phase1-b7/PREDICTION.md` + driver committed
  BEFORE any game. Baselines computed from b6 P: **modal-target share 45.7%** (so band 1 binds at 60.7%
  and D6's escape does NOT fire; S's is 64.4%), **wasted games 0 of 7 on BOTH arms** → **band 4 retired to
  a reported count**, because a ceiling of 1 against a baseline of 0 cannot fail informatively. Band 6
  re-based onto the repeat rate (41.4%), band 3 pre-registered EXPECTING to fail on P0.e.
- **05:08Z worktree** at `/tmp/b7-worktree`, pinned to `b4ee598`, `node_modules` symlinked, typecheck clean.
- **NEXT, in this order**: (1) wait for the grounded escalation to finish — it is using the router;
  (2) **restart the router with `SHIM_DORIS_ATTEMPT_TIMEOUT_MS=400000`**, preserving
  `SHIM_LOCAL_URL=http://doris:11435` and `SHIM_LOCAL_MODELS=muse-glimmer-30b-q4_k_m` (its only two set
  vars); (3) launch batch 7 from the worktree. **Running an hour ahead of §6's clock**, so the 08:40Z
  last-game line has room.

- **05:22Z grounded escalation DONE**: **26 of 30 AGREE**, 4 different keys (seed 20260925). All four
  differences are the SAME recurring ambiguity — scraping the mortar at the bar's base, keyed
  `bar/…/integrity` locally and `window/open/passage` by Opus — which `escalate-grounded.mts`'s own header
  predicted as the defensible-either-way case. It is consistent, so b6's P-vs-S comparison stands.
  **The referee fails asymmetrically**: 87% agreement when it RULES, 64% wrong when it REFUSES.
- **05:23Z router RESTARTED** with `SHIM_DORIS_ATTEMPT_TIMEOUT_MS=400000` (plus its original
  `SHIM_LOCAL_URL` and `SHIM_LOCAL_MODELS`; those were its only two set vars). Verified: `/api/ps` `[]`,
  and a trivial local call returns 33 tokens with reasoning off. Log at
  `checkpoints/2026-09-25-phase1-b7/router.log`. **The morning report must say the router was restarted.**
- **05:23Z BATCH 7 LAUNCHED** from `/tmp/b7-worktree` at `b4ee598`, 7 games, arm T only, driver log
  `/tmp/b7-driver.log`, game logs in the worktree's `checkpoints/2026-09-25-phase1-b7/logs/`.
  Header confirms `strategy=[fixed] strength=[high] ollama_ps_before=[none]`. The OPTIONS call fired at
  12.1 s, matching the probe. **Transcripts land in `/tmp/b7-worktree/checkpoints/*.md`** (checkpoint.ts
  writes to `cwd/checkpoints`) and must be moved into `T/` under the batch dir afterwards.
- **THE GATE is read from game 1's transcript, which is only written when that game ENDS** (~05:46Z):
  the header must print `Strategy: ON` with a valid id. Null → read the raw replies FIRST (they are in the
  header), then technical failure = 15-minute repair budget and one restart; substantive = stop, pilot.

- **05:23Z GATE: the strategy block PASSED, the game did not.** Game 1's header printed `Strategy: ON`,
  `Chosen: 5`, `Declared targets: blanket`, the sentence, the wire field and strength, and both raw replies
  in full — which is the only reason the failure was diagnosable. **Then the game died with rc=1 before
  round 1**, zero rounds: `timeline: cannot set story time to 3 ... its current t is 4`.
  **A TECHNICAL failure, so §6 step 5's 15-minute repair budget applied, and one restart.**
  - **Cause, and it is my bug**: `clock.prisonerT(1)` and `wardenT(n)` are **not getters** — each calls
    `setStoryTime` (`src/world/clock.ts`). The strategy step read the prisoner's round-1 time to build a
    context and thereby moved the clock to t0+3 before the loop started; `runOpenGame`'s own first call,
    the warden at t0+2, then hit run-dmcp's "t never runs backwards" rule.
  - **Fix** (`bf606c8`): read `clock.t0`, which moves nothing and is the right instant anyway — a
    pre-episode commitment sees the cell as authored. A test pins that the two renderings are
    **byte-identical on a fresh world**, so the batch reads the same situation the probe did and §5.1's
    cross-batch claim survives. A second test pins the trap itself. 1192 tests green, lint 0 errors.
  - Dead game and its log kept in `checkpoints/2026-09-25-phase1-b7/abandoned/`, not counted.
- **05:26Z BATCH 7 RELAUNCHED**, worktree re-pinned to `bf606c8`, 7 games. Repair took ~2 min of the 15.
  **The one restart the gate allows is now SPENT**: a second substantive failure stops the batch and it is
  reported as a pilot.
- Its modal choice was the **blanket** again — the same object the probe favoured and b6's fourteen games
  targeted zero times.

## Batch 7 poll log (§6 step 5: so far / projected at 7 / dead-or-open, every poll)

- **05:45Z game 1 of 7 complete, rc=0, 18.5 min.** 20 half-rounds, the strategy line in all 10 prisoner
  briefings, `Revision would have fired: never`. Chosen 3, declared target **blanket** (the third time that
  object has come up: the probe's modal pick, the crashed game, and this one).

| band | so far | projected at 7 | verdict |
|---|---|---|---|
| **1 (primary)** adherence ≥ 60.7% | **50.0%** (5 on / 5 off / 0 refused of 10) | 50.0% | **open** — needs 38 of the remaining 60 turns (63.3%) |
| 5 refusals ≤ 8% | 0 of 10 | 0% | open |
| 8 both calls succeed ≥ 6 of 7 | 1 of 1 | 7 of 7 | open |
| 9 median game < 45 min | 18.5 min | — | open |

**A DEFINITION PROBLEM, found in game 1 and NOT fixed mid-batch** (the band is pre-registered and moving it
now would be the exact thing pre-commitment prevents): the prisoner's targets were `blanket` 5, `bar` 5,
`lock` 4, **`strip` 2**, `spoon` 1. **`strip` is a DERIVED object** — the cordage it made by unravelling the
blanket, i.e. the strategy *working*. It has its own id, so §3.4's strict keying counts those two turns as
**off-strategy**. A strategy that succeeds by creating something scores as abandoning itself, and band 1 is
therefore biased DOWNWARD against exactly the strategies that work. Report it in the results file, propose
the fix (a derived object inherits its parent's id for adherence, via `openWorld.derived`'s own parent
link), and do not apply it to this batch's numbers.
