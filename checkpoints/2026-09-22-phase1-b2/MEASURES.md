

# Batch measures: `checkpoints/2026-09-22-phase1-b2` (arms O)

## Per arm

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| O | `claude-opus-4-6` | 6 | 120 | 0 | 7.17 | 6 of 6 | 6.33 | 107 | 13 | 2 |

Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.

## Reach, per chair

Route finding: intents whose referee `property` answer is `passage`. Residue refusals: refusals on (no --residue given).

| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 60 | 0 | 5.17 | 7: bar, cot, lock, loose_tile, prisoner, spoon, wire | 6 | 1.33 | 2: reveal, take | 55 | 5 | 0 | 0 |
| O | prisoner | 60 | 0 | 4.17 | 10: bar, blanket, cot, door, lock, loose_tile, meal_tray, prisoner, spoon, wire | 2 | 5.50 | 10: conceal, derive, give, leave, noise, open, restore, reveal, take, wear | 52 | 8 | 8 | 0 |

## First contact

For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.

| arm | chair | object | first round (mean) | games |
|---|---|---|---|---|
| O | warden | bar | 1.83 | 6 of 6 |
| O | warden | cot | 8.00 | 1 of 6 |
| O | warden | lock | 6.00 | 6 of 6 |
| O | warden | loose_tile | 4.67 | 6 of 6 |
| O | warden | prisoner | 2.80 | 5 of 6 |
| O | warden | spoon | 2.50 | 6 of 6 |
| O | warden | wire | 5.00 | 1 of 6 |
| O | prisoner | bar | 1.00 | 2 of 6 |
| O | prisoner | blanket | 9.00 | 1 of 6 |
| O | prisoner | cot | 3.00 | 4 of 6 |
| O | prisoner | door | 9.20 | 5 of 6 |
| O | prisoner | lock | 10.00 | 1 of 6 |
| O | prisoner | loose_tile | 7.50 | 2 of 6 |
| O | prisoner | meal_tray | 2.00 | 2 of 6 |
| O | prisoner | prisoner | 5.50 | 2 of 6 |
| O | prisoner | spoon | 2.00 | 5 of 6 |
| O | prisoner | wire | 5.00 | 1 of 6 |

## Competence, per chair

Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; "§22 line agrees" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.

| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |
|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 54 | 7 | 47 | n/a | 1 | 3 | 0 | 0 | 177/180 (98%) |
| O | prisoner | 54 | 30 | 24 | yes | 1 | 11 | 0 | 0 | 171/182 (94%) |

## Short citations (§3.3)

Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.

| arm | rulings with a short citation | of rulings | rows |
|---|---|---|---|
| O | 12 | 120 | 14 |

| arm | transcript | round | chair | question | answer | quote |
|---|---|---|---|---|---|---|
| O | `O/2026-09-22T14-04-02-498Z.md` | 7 | prisoner | property | `integrity` | "bar" |
| O | `O/2026-09-22T14-04-02-498Z.md` | 8 | prisoner | property | `passage` | "the" |
| O | `O/2026-09-22T14-04-02-498Z.md` | 9 | warden | target | `bar` | "the" |
| O | `O/2026-09-22T14-04-02-498Z.md` | 9 | prisoner | target | `bar` | "bar," |
| O | `O/2026-09-22T14-04-04-789Z.md` | 1 | prisoner | target | `bar` | "bar," |
| O | `O/2026-09-22T14-04-04-789Z.md` | 3 | warden | target | `spoon` | "the" |
| O | `O/2026-09-22T14-04-04-789Z.md` | 3 | prisoner | target | `spoon` | "the" |
| O | `O/2026-09-22T14-04-04-789Z.md` | 3 | prisoner | property | `concealment` | "A" |
| O | `O/2026-09-22T14-30-07-627Z.md` | 2 | warden | target | `spoon` | "the" |
| O | `O/2026-09-22T15-00-26-839Z.md` | 8 | warden | target | `bar` | "bar" |
| O | `O/2026-09-22T15-02-08-256Z.md` | 1 | prisoner | product | `none` | "Sit" |
| O | `O/2026-09-22T15-02-08-256Z.md` | 1 | prisoner | property | `none` | "Sit" |
| O | `O/2026-09-22T15-02-08-256Z.md` | 2 | warden | target | `spoon` | "the" |
| O | `O/2026-09-22T15-02-08-256Z.md` | 5 | prisoner | target | `spoon` | "the" |

## Refusal audit list (§2)

Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, misruled, unbuilt or unclear (OPUS-FIRST-DESIGN §2).

| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |
|---|---|---|---|---|---|---|---|---|---|
| O | `O/2026-09-22T14-04-02-498Z.md` | 2 | prisoner | cot | none | none | moderate | impossible || unbuilt |
| O | `O/2026-09-22T14-04-02-498Z.md` | 3 | warden | spoon | reveal | integrity | moderate | impossible || misruled |
| O | `O/2026-09-22T14-04-02-498Z.md` | 5 | prisoner | meal_tray | none | none | moderate | impossible || unbuilt |
| O | `O/2026-09-22T14-04-04-789Z.md` | 6 | prisoner | spoon | none | none | moderate | impossible || misruled |
| O | `O/2026-09-22T14-04-04-789Z.md` | 7 | prisoner | spoon | wear | edge | moderate | impossible || misruled |
| O | `O/2026-09-22T14-30-07-627Z.md` | 2 | prisoner | spoon | none | edge | slight | impossible || misruled |
| O | `O/2026-09-22T14-31-50-382Z.md` | 5 | warden | lock | reveal | none | moderate | impossible || misruled |
| O | `O/2026-09-22T15-00-26-839Z.md` | 1 | warden | prisoner | reveal | posture | moderate | impossible || misruled |
| O | `O/2026-09-22T15-00-26-839Z.md` | 5 | prisoner | spoon | wear | none | moderate | impossible || misruled |
| O | `O/2026-09-22T15-00-26-839Z.md` | 9 | warden | spoon | reveal | integrity | moderate | impossible || misruled |
| O | `O/2026-09-22T15-02-08-256Z.md` | 3 | prisoner | none | conceal | none | slight | impossible || unbuilt |
| O | `O/2026-09-22T15-02-08-256Z.md` | 8 | prisoner | spoon | wear | posture | substantial | impossible || misruled |
| O | `O/2026-09-22T15-02-08-256Z.md` | 10 | warden | none | none | none | slight | impossible || unbuilt |

## Lost rulings

RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.

| arm | replies | strict JSON | read leniently | unreadable |
|---|---|---|---|---|
| O | 120 | 110 | 10 | 0 |

None.

Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.

| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |
|---|---|---|---|
| O | 2 | 0 | 2 |

