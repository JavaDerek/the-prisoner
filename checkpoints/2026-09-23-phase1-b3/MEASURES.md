# Batch measures: `checkpoints/2026-09-23-phase1-b3` (arms O)

## Per arm

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| O | `claude-opus-4-6` | 10 | 187 | 3 | 7.80 | 9 of 10 | 5.30 | 172 | 15 | 1 |

Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.

## Reach, per chair

Route finding: intents whose referee `property` answer is `passage`. Residue refusals: refusals on (no --residue given).

| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 96 | 0 | 5.20 | 8: bar, blanket, lock, loose_tile, meal_tray, prisoner, spoon, window | 8 | 1.30 | 4: expose, give, reveal, take | 91 | 5 | 3 | 0 |
| O | prisoner | 91 | 3 | 4.70 | 9: bar, cot, door, key_ring, meal_tray, prisoner, spoon, warden, window | 15 | 4.40 | 11: conceal, derive, expose, give, leave, noise, open, restore, reveal, take, wear | 81 | 10 | 12 | 0 |

## First contact

For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.

| arm | chair | object | first round (mean) | games |
|---|---|---|---|---|
| O | warden | bar | 2.00 | 10 of 10 |
| O | warden | blanket | 6.00 | 1 of 10 |
| O | warden | lock | 5.40 | 10 of 10 |
| O | warden | loose_tile | 4.11 | 9 of 10 |
| O | warden | meal_tray | 6.00 | 2 of 10 |
| O | warden | prisoner | 1.00 | 7 of 10 |
| O | warden | spoon | 2.40 | 10 of 10 |
| O | warden | window | 9.33 | 3 of 10 |
| O | prisoner | bar | 5.33 | 6 of 10 |
| O | prisoner | cot | 6.20 | 5 of 10 |
| O | prisoner | door | 9.67 | 6 of 10 |
| O | prisoner | key_ring | 10.00 | 1 of 10 |
| O | prisoner | meal_tray | 4.33 | 3 of 10 |
| O | prisoner | prisoner | 3.83 | 6 of 10 |
| O | prisoner | spoon | 1.80 | 10 of 10 |
| O | prisoner | warden | 6.17 | 6 of 10 |
| O | prisoner | window | 6.50 | 4 of 10 |

## Competence, per chair

Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; "§22 line agrees" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.

| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |
|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 86 | 15 | 71 | n/a | 3 | 3 | 0 | 0 | 285/288 (99%) |
| O | prisoner | 81 | 29 | 52 | yes | 0 | 1 | 3 | 0 | 273/274 (100%) |

## Short citations (§3.3)

Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.

| arm | rulings with a short citation | of rulings | rows |
|---|---|---|---|
| O | 9 | 187 | 10 |

| arm | transcript | round | chair | question | answer | quote |
|---|---|---|---|---|---|---|
| O | `O/2026-09-23T13-51-27-780Z.md` | 8 | prisoner | product | `none` | "I" |
| O | `O/2026-09-23T13-51-30-194Z.md` | 6 | prisoner | product | `none` | "Sit" |
| O | `O/2026-09-23T13-51-30-194Z.md` | 8 | prisoner | target | `bar` | "bar" |
| O | `O/2026-09-23T13-51-30-194Z.md` | 8 | prisoner | product | `none` | "The" |
| O | `O/2026-09-23T13-51-30-194Z.md` | 10 | warden | product | `none` | "I" |
| O | `O/2026-09-23T14-29-15-980Z.md` | 7 | prisoner | target | `prisoner` | "I" |
| O | `O/2026-09-23T14-29-33-111Z.md` | 2 | prisoner | product | `none` | "Sit" |
| O | `O/2026-09-23T14-29-33-111Z.md` | 3 | prisoner | product | `none` | "Sit" |
| O | `O/2026-09-23T15-43-51-076Z.md` | 3 | prisoner | product | `none` | "Ask" |
| O | `O/2026-09-23T16-01-54-610Z.md` | 10 | warden | property | `none` | "I" |

## Refusal audit list (§2)

Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, misruled, unbuilt or unclear (OPUS-FIRST-DESIGN §2).

| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |
|---|---|---|---|---|---|---|---|---|---|
| O | `O/2026-09-23T13-51-27-780Z.md` | 3 | prisoner | spoon | none | edge | moderate | impossible |  |
| O | `O/2026-09-23T13-51-30-194Z.md` | 6 | prisoner | cot | none | none | slight | impossible |  |
| O | `O/2026-09-23T13-51-30-194Z.md` | 7 | prisoner | spoon | none | none | slight | impossible |  |
| O | `O/2026-09-23T13-51-30-194Z.md` | 9 | prisoner | warden | conceal | none | moderate | impossible |  |
| O | `O/2026-09-23T14-29-15-980Z.md` | 3 | prisoner | spoon | conceal | none | slight | impossible |  |
| O | `O/2026-09-23T14-29-15-980Z.md` | 5 | warden | none | reveal | none | moderate | impossible |  |
| O | `O/2026-09-23T14-29-15-980Z.md` | 5 | prisoner | cot | none | none | slight | impossible |  |
| O | `O/2026-09-23T14-29-15-980Z.md` | 8 | warden | meal_tray | reveal | none | moderate | impossible |  |
| O | `O/2026-09-23T14-29-15-980Z.md` | 10 | warden | none | none | none | slight | impossible |  |
| O | `O/2026-09-23T15-06-38-645Z.md` | 9 | prisoner | warden | wear | none | substantial | impossible |  |
| O | `O/2026-09-23T15-07-15-758Z.md` | 1 | warden | prisoner | reveal | none | moderate | impossible |  |
| O | `O/2026-09-23T15-07-15-758Z.md` | 4 | prisoner | spoon | conceal | none | slight | impossible |  |
| O | `O/2026-09-23T16-01-54-610Z.md` | 10 | warden | none | none | none | slight | impossible |  |
| O | `O/2026-09-23T16-20-51-342Z.md` | 1 | prisoner | warden | reveal | none | slight | impossible |  |
| O | `O/2026-09-23T16-20-51-342Z.md` | 6 | prisoner | cot | wear | posture | slight | impossible |  |

## Lost rulings

RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.

| arm | replies | strict JSON | read leniently | unreadable |
|---|---|---|---|---|
| O | 187 | 187 | 0 | 0 |

None.

Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.

| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |
|---|---|---|---|
| O | 1 | 0 | 1 |

