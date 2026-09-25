# Pre-committed: the capture rate on Muse-Glimmer, serial (2026-09-25, before any call)

Stage 1 of filling the confusion matrix's BOTTOM ROW -- what the referee does with intents that should not
resolve. Every audit before this started from the refusals and so measured only the top row.

## The prior this is testing

OPEN-VARIANT.md §68.5, `checkpoints/2026-09-20-capture/`, on **`qwen3:14b`**: of 29 non-control intents that
name no object ("pray", "help", "what time is it?"), **19 were ruled `open` on the escape route** at thinking
OFF, and **1 of 29** at thinking ON. Controls held 4 of 4 in both arms. That is the only false-positive
measurement this project has, and it is on a model and a run-mode that no longer describe what ships.

## Instrument

The same 33 labelled intents (`checkpoints/2026-09-20-capture/intents.json`, 29 non-control + 4 OBJECT
controls), labels committed 2026-09-20 before any call of that probe.

**Requests are REBUILT, not reused.** `build-default.mts` runs `buildOpenWorld` + `computePerceivedObjects`
from the prisoner's seat, presence modelled, against a throwaway `/tmp` database. The scenario has changed
since 2026-09-20 (custody, the hiding clause, world elaboration), so the stale `D-SWEEP.json` would measure
an older game. **Consequence, stated before the numbers: a difference from §68.5 may be the model, the
serialisation, OR the prose, and this probe alone cannot separate them.** The perceived-object list and the
window's text are printed into the log so the drift is at least visible.

Replay: serial, one process, direct to `doris:11435`, `muse-glimmer-30b-q4_k_m`, temperature 0, no
per-request `chat_template_kwargs` (the server's own `none` flag -- what ships). N=1, plus a 6-row repeat.

## Two tiers, so nobody has to argue about `noise`

- **Tier 1, any resolution:** `applicable === true` on a non-control intent. Some of these are defensible --
  praying aloud really does make a sound -- so this is an upper bound, not an error count.
- **Tier 2, escape-route capture:** resolved with the way out or its part as the target (`window`, `bar`) --
  §68.5's own measure, and the unambiguously harmful one. A prayer ruled a noise is fine; a prayer ruled an
  attempt on the window is the game lying to the player.

## Predictions

1. **PRIMARY.** Tier-2 escape-route captures: **8 or fewer of 29**. Muse-Glimmer scored 36/43 against
   qwen3's 21/43 on the referee sweep, and this run is serial, so I expect it to at least halve qwen3's 19.
2. **TIER 1 CEILING.** Any-resolution on non-controls: **15 or fewer of 29**.
3. **CONTROL, and it is the kill.** The 4 OBJECT intents each land on the object they name: **at least 3 of
   4**. §68.5 held 4 of 4 in both arms. If the controls fail, the instrument is broken and 1 and 2 are void.
4. **DETERMINISM.** A 6-row repeat returns identical `target/effect/property` **6 of 6**, as the refusal run
   found serially.

## What the outcomes mean, written before the numbers exist

- **1 holds** -> §68.5's alarming number does not transfer; the bottom row is survivable and stage 2 is
  optional.
- **1 fails (>8 captures)** -> the shipped referee invents an escape attempt out of a non-action more than a
  quarter of the time, the matrix's bottom row is the worst thing in the project, and stage 2's A/B/C design
  should run before any further play measurement.
