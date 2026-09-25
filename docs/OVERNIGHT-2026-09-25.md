# Overnight 2026-09-25 — the strategy step, built and measured

Ran unattended from **23:00 CDT** (04:00Z) to **02:45 CDT** (07:45Z), executing `STRATEGY-DESIGN.md` §6.
All seven steps done, about an hour ahead of the plan's own clock. Times below are Chicago; committed
artifacts quote UTC where they quote machine logs.

---

## Decisions for you, first

**1. Reject principal ids as strategy targets.** Game 7's strategy declared `warden` — a person — because
`coerceStrategy` checks membership against the perceived-objects list and, under `PRISONER_PRESENCE=modelled`,
the principals are in it. Five of that game's ten turns carried no keys at all, more than the other six
games combined, and it is most of why band 5 died. Two lines in `checkpoint.ts` (not in `strategy.ts`,
which must stay generic). **Recommend: yes, before any further strategy arm.**

**2. Decide the derived-object re-key — it is worth 21 points on the primary endpoint.** Four of seven
games *made* something (cordage from the blanket; one game made seven strips). Adherence keys on the
declared ids, and a derived object gets a new id, so every turn spent using the thing the strategy existed
to produce scored as off-strategy. Strict: **55.7%**. Counting a derived object as its parent: **77.1%**.
The strict number is what batch 7 reports and band 1 fails either way — but the next arm has to pre-register
one of them. **Recommend: count the parent, and pre-register it before running.**

**3. Do not build revision.** Its trigger was evaluated on all 70 prisoner turns under `fixed` and fired
**never**, in every one of seven games. §3.5 designed it for a mind that fixates on a dead strategy; this
arm's minds do not fixate, they wander. **Recommend: close it.**

**4. Do not buy a thinking-strength arm.** The commit call at `high` cost **9.7× the tokens and 9.8× the
wall clock** of `none`, and its choice was statistically indistinguishable from uniform at both strengths
(χ² p=0.19 identity, p=0.12 position, over 20 asks). If the step runs again, run it at `none`.
**Recommend: yes, and spend the difference on games.**

**5. File the moi "outcome on an `Account`" issue?** Written as `docs/issues/moi-A1-outcome-on-an-account.md`
in that package's own neutral vocabulary, and deliberately *not* filed: its only caller would be this step,
and this step just failed its primary band. **Recommend: hold it until a strategy arm passes something.**

---

## What landed

| | |
|---|---|
| **run-dmcp** | untouched |
| **the-prisoner** | 20 commits, all on `main`, **unpushed** |
| **mother-of-invention** | untouched (A1 written, not filed) |

- **Batch 6 is fully written up and committed** — it was owed from before this session and is done:
  fourteen transcripts copied from `/tmp/b6-worktree` byte-identically, `MEASURES.md`, `SCOREBOARD.md`, a
  22-row refusal audit, both escalations, and `RESULTS.md`.
- **The strategy step is built** (`src/open/strategy.ts` + wiring), off by default, 1192 tests green,
  typecheck clean, lint 0 errors.
- **Batch 7 ran 7 of 7 games** and is written up in `checkpoints/2026-09-25-phase1-b7/RESULTS.md`.
- Two issues drafted: `prisoner-P8` (the wits thinking switch is a no-op on this server) and `moi-A1`.

## The three findings worth your time

**1. Batch 6's headline is refuted, in the opposite direction.** The prose seat was supposed to damage the
bar more than the schema seat. Both damaged it in 4 of 7 games — but **every damaged prose game ends at
exactly 92**, one wear step and never a second, while the schema seat compounded to 84, 76, 68 and **59**.
The prose seat buys width (4.29 distinct targets vs 3.14) and compliance (2.9% refusals vs 14.7%). It does
not buy depth. The claim rested on an N of 1 whose transcript no longer exists, and b6 says so.

**2. The referee fails asymmetrically, and that is bigger than either seat.** Escalating b6's rulings to
Opus on the identical recorded requests: **26 of 30 grounded rulings agree**, but **14 of 22 refusals are
overturned**. When it rules, it rules well; when it refuses, it is usually wrong. The 14 are two repeating
shapes — the property dropped on `reveal` (six times), and the effect dropped on bodily or object-less
intents. All four grounded disagreements are the *same* arguable case (mortar at the bar's base keyed to
the bar's integrity locally, the window's passage by Opus), which that tool's own header predicted.

**3. The strategy step is read, and what it says is usually not worth following.** Adherence 51.4% against
a 45.7% baseline — the line moved behaviour by ~6 points, far short of the 15 required, and one game hit
80%. But **five of seven strategies named the blanket or the key ring**, neither of which the condition
list prices, and which b6's fourteen games targeted **zero** times. And **distinct targets per game came out
at 4.29 — identical to b6's 4.29.** Commitment changed reach by nothing.

This is not "the mind declined the affordance" (`minds-decline-new-affordances`). The affordance was used,
faithfully, to pursue things the world cannot price. It points the next work at **what the step chooses
between** — the options call, the scenario, the condition list — not at the commit call and not at thinking.
That is `world-elaboration-vision`'s thesis arriving from a new direction.

## What went wrong, or could not be explained

- **Batch 7 game 1 died before round 1** and was restarted once, inside §6's 15-minute repair budget (it
  took two minutes). Cause: `clock.prisonerT(1)` and `wardenT(n)` **are not getters** — each calls
  `setStoryTime`. The strategy step read the prisoner's round-1 time and thereby moved the clock past the
  warden's first half-round. Fixed to read `clock.t0`, with two regression tests. **The one restart the
  gate allows is now spent.**
- **The router's per-attempt cap is 150 s by default** (`SHIM_DORIS_ATTEMPT_TIMEOUT_MS`) and a `high`
  commit call on the real seat averages 125 s. One probe ask died at exactly 300 s with a 502. The probe
  was re-run direct against doris; **the router was restarted at 400 s for batch 7** — see machine state
  below. §5.1's own band 8 budgets five minutes for that call, so the default was the thing out of step.
- **I retired band 4 before the batch on a mistaken argument** — that a ceiling of 1 against a baseline of
  0 could not fail informatively. Backwards: a ceiling fails when the arm is *worse*. Arm T wasted **4 of 7**
  games against **0 of 7** in both b6 arms. Reported against the original threshold in the results file.
- **I overstated a pattern at poll 4** — a "20-point gap, four for four" between condition-listed and other
  strategies. Game 6 then scored the batch's best adherence (80%) on a blanket strategy. The gap is 10
  points on n=2 vs n=4. Corrected at poll 6 and in the results file.
- **Band 5's first three polls used the wrong refusal population** (the adherence measure's, not the
  pre-registered "turns with no keys"). Corrected at poll 5; the conclusion held, the numbers did not.
- **Four instrument disagreements in two batches** about the same quantities. b6's results file lists
  three; b7 adds a fourth (the scoreboard says 51.4% adherence, `adherenceByGame` says 55.7%; both fail the
  band). **One function should own "the population of graded prisoner turns."**
- **Not explained**: why the commit call's choice is indistinguishable from uniform yet game-to-game
  adherence ranges 10%–80%. Conviction varies a lot for a choice that looks random.

## Machine state, as left

| | |
|---|---|
| llama-server (Muse, doris:11435) | **exactly as found** — untouched all night, still `--chat-template-kwargs '{"reasoning_strength":"none"}'`, up since 09:39 the previous morning |
| **model router (8799)** | **RESTARTED by me at 00:23 CDT** with `SHIM_DORIS_ATTEMPT_TIMEOUT_MS=400000` added to its original `SHIM_LOCAL_URL` / `SHIM_LOCAL_MODELS`. It logs to `checkpoints/2026-09-25-phase1-b7/router.log`. **This is a change from how you left it** — restart it your way if you want the 150 s default back |
| Ollama `qwen3:14b` | restored, `keep_alive: -1` — see verification below |
| `comfyui.service` | restarted — see verification below |
| `/tmp` | nothing deleted. `/tmp/b7-worktree` still pinned at `bf606c8`; `/tmp/b6-worktree` untouched |

**20 commits are unpushed on `main`.**

### Restore verified at 02:40 CDT (07:40Z)

```
llama-server   pid 2213812, started Thu Sep 24 09:39:55 — the SAME process, never touched
comfyui.service  active
ollama /api/ps   qwen3:14b, 6.0 GB, expires_at 2319-01-05  (= keep_alive -1, as found before b6)
router :8799     up, /api/ps [] — qwen3:14b is hidden by SHIM_HIDE_MODELS, which is the documented
                 behaviour (CLAUDE.md), not an empty card
GPU              23223 MiB of 24564 — Muse 16.6 + qwen3 6.0 + ComfyUI. Tight, and all three are up.
```

The only thing on the machine that differs from how you left it is **the router's per-attempt timeout**,
raised from its 150 s default to 400 s and restarted at 00:23 CDT. Everything else is as found.
