# P3 -- R3, the person: predictions

**DRAFT -- not pre-registered until committed unchanged before the first call, by the owner.** Scaffolded
2026-09-27 against the tree at `ac47293` (D12 `924947f` is in: `sight` exists, the person effect and property
clauses name it, and `PRISONER_PERSON_INSTRUMENT` is the arm, default `off`). No model has been called:
`probe.mts --dry-run` rebuilt all 11 contexts (0 replay divergences) and built 44 requests; the target question
carries the person-instrument clause in the `on` arm and not in the `off` arm.

## What is asked

The owner's round 2 -- "throw the blanket over croft, so he can't see" -- was ruled `blanket` / `conceal`: the act he
meant (blind the warden) was silently rewritten into one he did not (R3). Two causes: presence `off` made no person
a key (removed by D2), and a reading question -- once both the person and the blanket are keys, does an act done to
a person WITH a thing land on the person? D12 adds the act (`wear` on a person's `sight`) and, behind an arm, a
target-question clause: "An act done to a person with a thing -- striking, covering, blinding, restraining, tying --
names the person; the thing is only what it is done with." P3 measures the clause, off then on.

## Items (N = 5 each, per arm; arm `off` first, then `on`)

| id | text | context | expected |
|---|---|---|---|
| `G27-P2` | "throw the blanket over croft, so he can't see" | this game, r2 | **`warden` / `wear` / `sight`** (scored) |
| `G27-P3` | "take the warden's keys while he's stuck under the blanket" | this game, r3 | reported (`key_ring` / `take`) |
| `I25-3`, `I25-5` | "throw the spoon at the warden" | issue-25 game (no transcript: silent history) | reported (recorded `warden` / `noise`, labelled unmodelled) |
| `HB-r1` | "attack warden croft" | human-blind r1 | reported (`warden` / `wear` / `posture`) |
| `HB-r3` | "stab the warden with the spoon" | human-blind r3 | reported (`warden` / `wear` / `posture`) |
| `G1-r1` | "drop to the ground and pretend to be having a heart attack" | game 1 r1 | reported (`prisoner` / `wear` / `posture`) |
| `C-take` | "take the blanket" | this game, r1 | control: stays on `blanket` |
| `C-hide-spoon` | "hide the spoon under the tile" | fresh world, r1 | control: stays on `spoon` |
| `I25-1` | "hide under the blanket" | issue-25 r1 | control: stays on `blanket` (D9) |
| `G1-r2` | "pull a wire out of the cot" | game 1 r2 | control: stays on `cot` |

Every request is rebuilt from `buildOpenWorld` at presence `modelled` (the probe refuses any other), on its own
context replayed through `runOpenGame` (`../2026-09-28-probe-kit/kit.mts`) -- never the recorded round-2 request,
which is the wrong arm (§68.8). The referee is built as a game builds it, with one override per arm
(`personInstrument`), printed in every meta line.

## Predictions (the design's numbers, with RED-TEAM.md F7's correction)

1. **Clause off: round 2 lands `warden` / `wear` / `sight` in at most 1 of 5.**
2. **Clause on: round 2 lands `warden` / `wear` / `sight` in at least 3 of 5.**
3. **Clause on: the controls move off their object in 0 of 20.**
- **Kill: clause on lands round 2 on `warden` / `wear` / `sight` in 1 or fewer of 5** (the clause failed), **or
  any one control moves in 2 or more of its 5** (the clause captures).

A sample is scored on the ruling the game would act on (under `oneAct: first`, the first act's when the intent was
cut). "Moves" means its `target` is not the control's object.

## Corrections, and what the scaffolding decided

- **F7: the design counted the target only.** "Lands on `warden`" as `warden` / `noise` is still a rewrite -- the
  D11 corpus's `I25-3`/`I25-5` did exactly that (a thrown spoon became a shout). Predictions 1, 2 and the kill need
  all three keys; "on `warden` with any effect" is reported beside, so a right-person-wrong-effect ruling is visible
  as what it is (F7's `rewritten` label).
- **F7's sequencing gap is closed**: `sight` landed (`924947f`) before this probe, so the best available ruling is
  not forced onto `posture`.
- **The design's controls are placed on contexts the record has**: "take the blanket" is this game's own round 1;
  "hide under the blanket" is `I25-1`; "pull a wire out of the cot" is `G1-r2`; "hide the spoon under the tile" has
  no recorded context and is ruled on a fresh round-1 world.
- **Prediction 3 is scored for the `on` arm**, where the kill applies; the `off` arm's control moves are reported.
- **Changed 2026-09-27, late, after the owner's answers to OPEN-VARIANT.md §80 (§80.7, D13-D16), before any call.**
  None of D13-D16 changes the referee's request (the fingerprint PIN held; no referee file moved), so this probe's
  requests, items and predictions are unchanged, and it may run from either tree. What moved is what a correct
  round-2 ruling COSTS in play: `warden` / `wear` / `sight` now gives him grounds at once (D13: 40, then the act's
  own bump), and while he is blind nothing else she does accrues (D14). `G27-P3`'s `key_ring` / `take`, if it lands,
  now opens the door for her (D15) -- the owner's own round-3 plan, which the game as it ran could not honour
  (RED-TEAM.md F12). Say both in RESULTS when the outcome section argues for making the clause the default.
- **This game's history**: `G27-P3` is ruled in a context built after the round-2 ruling. Replayed faithfully, that
  ruling puts the prisoner under the blanket (D9); P2's PREDICTION asks the owner once, for every probe, whether to
  replay it as silent (`--omit=prisoner:2`). Pass the same flag here; `G27-P2` itself is ruled before round 2 and
  is unaffected either way.

## Stopping rules

- Three errored samples in a row stop the run (rerun resumes).
- If prediction 1 is DEAD after arm `off` (round 2 already lands on sight without the clause), arm `on` still runs:
  it measures the capture of the controls, which is the clause's cost.
- A second driver, or Shep's traffic, is named in RESULTS.

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected at N, DEAD/OPEN; a dead number announced at the poll it
dies. For the KILL rows, DEAD means that kill fired.

## What the outcomes mean, written before any call

- **1-3 hold** -- the clause does what it says without capturing an object act; it becomes the default, as a
  separate change with its own date (`PRISONER_PERSON_INSTRUMENT=on`), and a person in the seat's blanket lands on
  the warden.
- **2 fails, 3 holds** -- the reading is the model's, not the clause's; the next lever is the blanket's own
  description (what a thrown blanket can do), not more target-question text.
- **KILL (b) fires** -- the clause pulls object acts onto people; it stays off.
- **1 fails** (round 2 already lands on sight with the clause off) -- D12's property clause did the work alone and
  the target clause is unnecessary.
