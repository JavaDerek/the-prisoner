# the-prisoner#1 -- the attack move: predictions

**Pre-registered 2026-09-28 by the coordinating session, under the owner's overnight delegation.** Scaffolded
against the tree that lands `docs/ISSUE-1-DESIGN.md` (harm's own arm, effect and property; D13 extended;
both endings; custody/block/perception treating a disabled principal like floored/blind). No model has been
called: `probe.mts --dry-run` must build every context with 0 replay divergences and print the `harm`/`condition`
keys in the `on` arm's answer sets and neither in the `off` arm's, before this file is committed unchanged.

## What is asked

`docs/ISSUE-1-DESIGN-BRIEF.md` §3 found that today's vocabulary reads a real attack two ways, neither honest:
"throw the spoon at the warden" (`I25-3`/`I25-5`) comes back `noise` (the referee reads the act as reaching
toward him, not touching him), and "attack"/"stab ... with the spoon"/"hit ... with the meal tray" (`HB-r1`,
`HB-r3`, `HB-r10`) all come back `wear`/`posture` -- the same key a bloodless push already uses, so a stab and
a shove are indistinguishable. This probe asks whether the new `harm` effect on `condition` actually separates
the five real attack rows from the ordinary vocabulary, in both directions: does it pull the attacks IN, and
does it leave the shoves, covers, searches, examinations, calls and digs OUT.

## Items (N = 3 each, per arm; arm `off` first, then `on`)

| id | text | context | expected under `harm=on` |
|---|---|---|---|
| `HB-r1` | "attack warden croft" | human-blind game, r1 | **`warden` / `harm` / `condition`** |
| `HB-r3` | "stab the warden with the spoon" | human-blind game, r3 | **`warden` / `harm` / `condition`** |
| `HB-r10` | "hit the warden with the meal tray, steal the key ring, open the door and leave" | human-blind game, r10 (one-act: the first act is the hit) | **`warden` / `harm` / `condition`** |
| `I25-3`, `I25-5` | "throw the spoon at the warden" | issue-25 game (no transcript: fresh, silent history) | **`warden` / `harm` / `condition`** |
| `G1-r1` | "drop to the ground and pretend to be having a heart attack" | game 1, r1 | control: stays `prisoner` / `wear` / `posture` |
| `I25-7` | "dig at the bars with the spoon" | issue-25 game (fresh) | control: stays `bar` / `wear` / `integrity` |
| `C-push-down` | "push the warden down" | fresh, r1 | control: stays `warden` / `wear` / `posture` |
| `C-cover-head` | "pull the blanket over the warden's head so he can't see" | fresh, r1 | control: stays `warden` / `wear` / `sight` |
| `C-take-keys` | "take the key ring off the warden's belt" | fresh, r1 | control: stays `key_ring` / `take` |
| `C-search` | "search the warden, pat him down" | fresh, r1 | control: stays `warden` / `expose` |
| `C-examine` | "examine the warden closely, looking for a way to get past him" | fresh, r1 | control: stays `warden` / `reveal` |
| `C-call-out` | "call out to the warden, ask him for water" | fresh, r1 | control: stays `warden` / `noise` |

Every request is rebuilt from `buildOpenWorld` at presence `modelled` (the probe refuses any other), the same
`../2026-09-28-probe-kit/kit.mts` machinery every 2026-09-28 probe uses -- never a recorded request, and never a
hand-built fixture. `HB-r1`/`HB-r3`/`HB-r10`/`G1-r1` replay that game's own earlier half-rounds through
`runOpenGame` first (0, 2, 9 and 0 replay steps respectively); `I25-3`/`I25-5`/`I25-7` and the five synthetic
controls have no transcript and are ruled on a fresh round-1 world. The referee is built exactly as a real game
builds it, with one override per arm (`harm`), printed in every meta line.

## Predictions

1. **Arm ON: at least 4 of 5 real attack intents rule `warden`/`harm`/`condition`** (majority of N=3 each).
2. **At most 1 of the 8 controls changes its `target`/`effect` pair between the `off` and `on` arms** (majority
   of N=3 each arm).
- **KILL-a: arm ON lands 2 or fewer of the 5 attacks** -- `harm` fails to separate itself from the existing
  vocabulary; the effect question's new clause needs rewording before this arm is worth defaulting on.
- **KILL-b: 2 or more of the 8 controls change between arms** -- `harm` captures ordinary physical acts on the
  warden's body; the same failure mode `docs/HUMAN-INTENTS-DESIGN.md` §6.1/§8 D12 already measured away once
  for the person-instrument clause (P3), now checked for this clause instead.

A sample is scored on the ruling the game would act on (`oneAct: first`'s own reading, if a first act is cited).
"Changes" for a control means its majority `target/effect` pair differs between arms -- not whether it happens
to change property, since `wear`/`posture` and `wear`/`sight` are both legitimate non-harm rulings a control
might land on regardless of the arm, and the property is already reported per item in the score output.

## Corrections and choices made scaffolding this

- **Controls without a corpus row are this task's own words**, chosen to be unambiguous about which EXISTING
  effect they should keep landing on -- `docs/HUMAN-INTENTS-DESIGN.md` §8/D12's own lesson (measure the referee
  on the population that will write to it) argues for real rows over invented ones wherever they exist; six of
  eight controls here have none, because the corpus this game has recorded so far is a HUMAN-INTENTS measurement
  built before this issue existed, not built to exercise it. `docs/ISSUE-1-DESIGN-BRIEF.md` §2's own five attack
  rows ARE all real, unedited corpus text.
- **`HB-r10` is a compound intent** ("hit ... steal ... open ... leave"); under `PRISONER_ONE_ACT=first` (the
  default since 2026-09-27) only its first act is ruled, and this probe scores that first-act reading, the same
  way `docs/ISSUE-1-DESIGN-BRIEF.md` itself reads it (the attack is the first act; the rest waits).
- **The `off` arm's rulings are reported, not predicted on** (`r1`): they are what `docs/ISSUE-1-DESIGN-BRIEF.md`
  §3 already measured once (`wear`/`posture`, the "ambiguous" label) and this probe's own job is to check that
  measurement still holds today, not to re-predict it.

## Stopping rules

- Three errored samples in a row stop the run (rerun resumes; `results.jsonl` is append-only).
- If prediction 1 is DEAD after the `on` arm alone, the run still finishes both arms: the controls are the
  clause's cost, and that number is owed regardless of whether the benefit showed up.
- A second driver, or Shep's traffic, is named in RESULTS.

## Scoreboard convention

`probe.mts --score` at every check-in: so-far, projected at N, DEAD/OPEN/MET, per `../2026-09-28-probe-kit/kit.mts`'s
`renderScoreboard`. A dead prediction is announced at the poll it dies, per the owner's stopping-rule convention
(2026-09-21).

## What the outcomes mean, written before any call

- **1 and 2 both hold** -- `harm` does what it says without capturing ordinary acts; `PRISONER_HARM=on` becomes
  the default in a separate commit, and the design's magnitude ladder (10/25/40) is worth playing a real game
  against next (a probe over rulings only, never a play-length game).
- **1 fails, 2 holds** -- the effect question's clause needs stronger or more example-rich wording (more verbs,
  or a sharper aim/method split the way `PRISONER_DERIVE_WORDING=sharpened` did for derive/wear); the arm stays
  off.
- **KILL-b fires** -- `harm`'s clause pulls object-directed or bodily acts onto itself; the property question's
  own gate (harm requires `condition`, offered only with a person in view) was meant to prevent this, and a
  failure here means the effect question's enumeration text, not the property gate, is where it leaks. Read the
  per-item table for which control moved and toward what.
- **KILL-a fires** -- the five real rows this issue was built to explain stay unmodelled or ambiguous even with
  the mechanism built; `docs/ISSUE-1-DESIGN-BRIEF.md` §3's own diagnosis (the vocabulary has nowhere for an
  attack to land) was right that a gap exists, but this clause is not what closes it.
