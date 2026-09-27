# P1 -- R5, the first act: predictions

**DRAFT -- not pre-registered until committed unchanged before the first call, by the owner.** Scaffolded
2026-09-27 against the tree at `ac47293` (D7 landed: `acc0c2a`, `17d4fcd`, `0dc49a5`). No model has been called:
`probe.mts` has run in `--dry-run` only, which rebuilt all 14 contexts with 0 replay divergences and built 28
requests without sending one. If the owner changes a number below, change it here and commit before the first
`--live` call; a number edited after a call is not a prediction.

## What is asked

`docs/PLAYTEST-2026-09-27-DESIGN.md` R5 (decided as D7 in the build spec): when the one-act reading answers
`several` with a verified citation, that citation is the SECOND act's span; the intent is cut before it, the words
before it are ruled as a fresh intent, and when that ruling applies it is the one acted on. When it does not (the
"second act" was really the noun the act needed), the whole intent's ruling stands exactly as under `checked`, so
a false positive costs nothing but time. This probe asks whether that cut is where the design says it is, on the
three compounds the record has and on the rows that read as compound but are one act.

## Items (N = 3 each, serial, one driver)

| id | chair, round | text ruled | expected first act |
|---|---|---|---|
| `HB-r2` | prisoner, human-blind r2 | "open the door and leave" | `door` / `open` |
| `HB-r10` | prisoner, human-blind r10 | "hit the warden with the meal tray, steal the key ring, open the door and leave" | `warden` / `wear` / `posture` |
| `G27-P8` | prisoner, this game's r8 | "Pull the bar out of the window and leave" | `window` / `open` |
| controls | | `B7-P18`, `B7-P23`, `B7-P36`, `B7-P48`, `B7-P58`, `B7-P59`, `B7-P60`, `B7-P61`, `B7-W04`, `B7-W07` (the D11 corpus's `intentTested`), and `G27-W7`, this game's warden r7 (the false positive that flagged in play) | not flagged-and-changed |

Every request is built from its own recorded context, rebuilt at today's defaults (`../2026-09-28-probe-kit/kit.mts`,
`rebuildContext`: the transcript's earlier half-rounds replayed through `runOpenGame` with their recorded keys),
with the referee built as a game builds it -- `PRISONER_ONE_ACT` must resolve to `first` or the probe refuses to
start. Never a recorded request (OPEN-VARIANT §68.8).

## Predictions (the design's numbers, verbatim)

1. **3 of 3 compounds rule the first act after truncation** -- the acted-on ruling carries `oneAct.attempted` and
   its keys are the expected first act's.
2. **At most 1 of the controls is flagged `several` and changes its ruling** (the acted-on keys differ from the
   whole intent's).
- **Kill: 3 or more controls change.**
- **Stop: if the truncated ruling is inapplicable on 2 or more of the 3 compounds**, the citation is not reliably
  the second act's span and the rule needs a different cut, not a different threshold.

An item's verdict is the majority of its N = 3 samples (2 or 3 of 3), scored only once all three are in.

## Corrections, and what the scaffolding decided

- **The design says "12 controls" and names 11** (R5: "the eleven corpus rows that read as compound and are one
  act (`B7-P18`, `P23`, `P36`, `P48`, `P58`-`P61`, `W04`, `W07`, and this game's warden round 7)"; §6: "3
  compounds + 12 controls"). Ten corpus rows plus this game's warden r7 is 11. Nothing was invented to make 12:
  prediction 2 is scored as "at most 1 of 11". The owner may name a twelfth before committing.
- **There is no prior data for `HB-r2` or `HB-r10` under the one-act reading**: D11 ran them with `oneAct: off`
  (RED-TEAM.md §3, R5 row). Only this game's two rows (warden r7, prisoner r8) are known to cite the second act's
  span. The stop rule is the guard for that gap.
- **The cost is not free** (RED-TEAM.md F13): a cut is a third referee call, about 30 s on the local card. The
  log records every call's time; RESULTS should say how many samples paid it.
- **Which text**: the corpus rows use the D11 corpus's `intentTested` (the terse text that "reads as compound",
  and what D11 measured), not `originalIntent`.
- **Context**: `HB-r10`'s rebuilt context perceives `wire` and `grit` (derived in that game's earlier turns). This
  game's warden r7 context does not perceive the prisoner: replaying her round-2 `blanket` / `conceal` under
  today's container rule (D9, OPEN-VARIANT §76.1) puts her under the blanket. That is today's mechanics acting on
  the recorded keys, not a copied state, and it touches no one-act reading; P2's PREDICTION asks the owner once,
  for every probe, whether to replay that round as silent (`--omit=prisoner:2`, which applies to the playtest's
  history only). Whatever is chosen there, pass the same flag here; the meta line records it.

## Reported, no weight

- compounds with no split at all (the reader answered `one`, or cited the second act from word 1);
- controls flagged `several` whatever happened next (§74.1 measured about one in four).

## Stopping rules

- The STOP above is checked when the three compounds are in; if it fires, the controls are not run.
- A call that errors is recorded as an error row and the run continues; three consecutive errors stop the run
  (check `/api/ps` and the router before resuming -- a rerun resumes, it never repeats a sample already in
  `results.jsonl`).
- Anything else on the card (a second driver, Shep's traffic on the shared runner) is named in RESULTS: OPEN-VARIANT
  §75.2 measured the referee non-deterministic under two drivers.

## Scoreboard convention

Every check-in prints so-far, projected at N, and DEAD/OPEN (`probe.mts --score`). A prediction that can no longer
be met is announced at the poll it dies. For the KILL and STOP rows, DEAD means the kill or stop has fired.

## What the outcomes mean, written before any call

- **1 and 2 hold** -- D7 as built is the rule; nothing changes.
- **STOP fires** -- the one-act citation is not the second act's span often enough to cut on; the cut rule needs
  another source (a separate question for the first act's words), not a threshold.
- **KILL fires** -- the cut turns single acts into smaller ones often enough to cost players turns; `first` goes
  back to `checked` as the default until the reader's false-positive rate is lower.
