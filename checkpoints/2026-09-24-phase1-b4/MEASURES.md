
> the-prisoner@0.1.0 measures
> tsx src/open/batchMeasuresCli.ts checkpoints/2026-09-24-phase1-b4

# Batch measures: `checkpoints/2026-09-24-phase1-b4` (arms O)

## Per arm

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| O | `claude-opus-4-6 (prisoner) / muse-glimmer-30b-q4_k_m (warden)` | 10 | 192 | 0 | 6.00 | 2 of 10 | 4.80 | 187 | 5 | 3 |

Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.

## Reach, per chair

Route finding: intents whose referee `property` answer is `passage`. Residue refusals: refusals on (no --residue given).

| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 97 | 0 | 3.80 | 8: bar, blanket, cot, key_ring, lock, loose_tile, spoon, window | 0 | 1.10 | 2: conceal, reveal | 95 | 2 | 1 | 0 |
| O | prisoner | 95 | 0 | 4.10 | 9: bar, cot, door, key_ring, prisoner, spoon, warden, window, wire | 6 | 3.80 | 8: conceal, derive, leave, noise, open, restore, take, wear | 92 | 3 | 20 | 0 |

## First contact

For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.

| arm | chair | object | first round (mean) | games |
|---|---|---|---|---|
| O | warden | bar | 1.00 | 10 of 10 |
| O | warden | blanket | 4.00 | 1 of 10 |
| O | warden | cot | 5.50 | 2 of 10 |
| O | warden | key_ring | 10.00 | 1 of 10 |
| O | warden | lock | 2.00 | 10 of 10 |
| O | warden | loose_tile | 4.20 | 5 of 10 |
| O | warden | spoon | 3.13 | 8 of 10 |
| O | warden | window | 10.00 | 1 of 10 |
| O | prisoner | bar | 5.00 | 9 of 10 |
| O | prisoner | cot | 5.00 | 2 of 10 |
| O | prisoner | door | 9.43 | 7 of 10 |
| O | prisoner | key_ring | 9.00 | 2 of 10 |
| O | prisoner | prisoner | 7.00 | 2 of 10 |
| O | prisoner | spoon | 1.00 | 10 of 10 |
| O | prisoner | warden | 6.00 | 1 of 10 |
| O | prisoner | window | 6.71 | 7 of 10 |
| O | prisoner | wire | 8.00 | 1 of 10 |

## Competence, per chair

Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; "§22 line agrees" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.

| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |
|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 87 | 7 | 80 | n/a | 0 | 0 | 0 | 0 | 291/291 (100%) |
| O | prisoner | 85 | 30 | 55 | yes | 0 | 0 | 0 | 0 | 286/286 (100%) |

## Short citations (§3.3)

Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.

| arm | rulings with a short citation | of rulings | rows |
|---|---|---|---|
| O | 5 | 192 | 5 |

| arm | transcript | round | chair | question | answer | quote |
|---|---|---|---|---|---|---|
| O | `O/2026-09-24T14-43-27-944Z.md` | 9 | prisoner | product | `none` | "dig" |
| O | `O/2026-09-24T15-14-45-658Z.md` | 3 | prisoner | product | `none` | "I" |
| O | `O/2026-09-24T15-14-45-658Z.md` | 6 | prisoner | product | `none` | "Ask" |
| O | `O/2026-09-24T15-46-59-896Z.md` | 2 | prisoner | magnitude | `slight` | "and" |
| O | `O/2026-09-24T16-49-57-040Z.md` | 8 | prisoner | product | `none` | "Use" |

## Refusal audit list (§2)

Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, misruled, unbuilt or unclear (OPUS-FIRST-DESIGN §2).

| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |
|---|---|---|---|---|---|---|---|---|---|
| O | `O/2026-09-24T15-14-45-658Z.md` | 4 | prisoner | spoon | none | none | slight | impossible |  |
| O | `O/2026-09-24T15-14-45-658Z.md` | 10 | warden | key_ring | conceal | none | slight | impossible |  |
| O | `O/2026-09-24T15-15-36-678Z.md` | 4 | warden | loose_tile | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-24T15-46-06-915Z.md` | 3 | prisoner | spoon | conceal | none | slight | impossible |  |
| O | `O/2026-09-24T16-12-11-109Z.md` | 9 | prisoner | spoon | conceal | none | moderate | impossible |  |

## Lost rulings

RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.

| arm | replies | strict JSON | read leniently | unreadable |
|---|---|---|---|---|
| O | 192 | 192 | 0 | 0 |

None.

Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.

| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |
|---|---|---|---|
| O | 3 | 0 | 3 |

