# Batch measures: `checkpoints/2026-09-21-phase1-b1` (arms O)

## Per arm

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| O | `claude-opus-4-6` | 10 | 198 | 0 | 7.70 | 5 of 10 | 5.00 | 133 | 65 | 0 |

Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.

## Reach, per chair

Route finding: intents whose referee `property` answer is `passage`. Residue refusals: refusals on `meal_tray/none`, `spoon/none`, `key_ring/none`.

| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 100 | 0 | 5.80 | 11: bar, blanket, cot, door, lock, loose_tile, meal_tray, prisoner, spoon, window, wire | 4 | 1.40 | 3: close, derive, reveal | 70 | 30 | 5 | 1 |
| O | prisoner | 98 | 0 | 5.10 | 12: bar, blanket, cot, door, key_ring, loose_tile, meal_tray, spoon, warden, window, wire, wire_2 | 1 | 4.50 | 8: conceal, derive, expose, leave, noise, open, reveal, wear | 63 | 35 | 14 | 5 |

## First contact

For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.

| arm | chair | object | first round (mean) | games |
|---|---|---|---|---|
| O | warden | bar | 1.90 | 10 of 10 |
| O | warden | blanket | 6.00 | 2 of 10 |
| O | warden | cot | 6.00 | 6 of 10 |
| O | warden | door | 10.00 | 4 of 10 |
| O | warden | lock | 4.70 | 10 of 10 |
| O | warden | loose_tile | 4.43 | 7 of 10 |
| O | warden | meal_tray | 2.50 | 2 of 10 |
| O | warden | prisoner | 4.75 | 4 of 10 |
| O | warden | spoon | 2.56 | 9 of 10 |
| O | warden | window | 9.50 | 2 of 10 |
| O | warden | wire | 4.00 | 2 of 10 |
| O | prisoner | bar | 4.86 | 7 of 10 |
| O | prisoner | blanket | 8.00 | 3 of 10 |
| O | prisoner | cot | 2.56 | 9 of 10 |
| O | prisoner | door | 9.13 | 8 of 10 |
| O | prisoner | key_ring | 10.00 | 1 of 10 |
| O | prisoner | loose_tile | 2.50 | 6 of 10 |
| O | prisoner | meal_tray | 6.50 | 2 of 10 |
| O | prisoner | spoon | 2.25 | 8 of 10 |
| O | prisoner | warden | 2.00 | 1 of 10 |
| O | prisoner | window | 10.00 | 1 of 10 |
| O | prisoner | wire | 4.00 | 4 of 10 |
| O | prisoner | wire_2 | 7.00 | 1 of 10 |

## Competence, per chair

Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; "§22 line agrees" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.

| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |
|---|---|---|---|---|---|---|---|---|---|---|
| O | warden | 90 | 14 | 76 | n/a | 4 | 22 | 0 | 0 | 279/302 (92%) |
| O | prisoner | 88 | 45 | 43 | yes | 1 | 27 | 0 | 0 | 278/305 (91%) |

## Short citations (§3.3)

Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.

| arm | rulings with a short citation | of rulings | rows |
|---|---|---|---|
| O | 25 | 198 | 25 |

| arm | transcript | round | chair | question | answer | quote |
|---|---|---|---|---|---|---|
| O | `O/2026-09-21T22-08-25-546Z.md` | 6 | warden | target | `bar` | "bar" |
| O | `O/2026-09-21T22-08-25-546Z.md` | 9 | prisoner | property | `passage` | "A" |
| O | `O/2026-09-21T22-08-27-040Z.md` | 3 | warden | target | `bar` | "bar" |
| O | `O/2026-09-21T22-32-41-690Z.md` | 1 | warden | target | `bar` | "bar," |
| O | `O/2026-09-21T22-32-41-690Z.md` | 8 | prisoner | target | `spoon` | "the" |
| O | `O/2026-09-21T22-57-53-068Z.md` | 1 | prisoner | target | `cot` | "Sit" |
| O | `O/2026-09-21T22-57-53-068Z.md` | 8 | warden | target | `bar` | "bar" |
| O | `O/2026-09-21T22-57-53-068Z.md` | 10 | prisoner | product | `none` | "Say" |
| O | `O/2026-09-21T23-13-31-489Z.md` | 4 | warden | target | `cot` | "cot" |
| O | `O/2026-09-21T23-13-31-489Z.md` | 10 | prisoner | property | `passage` | "the" |
| O | `O/2026-09-21T23-19-29-089Z.md` | 4 | warden | target | `wire` | "the" |
| O | `O/2026-09-21T23-19-29-089Z.md` | 4 | prisoner | property | `integrity` | "A" |
| O | `O/2026-09-21T23-19-29-089Z.md` | 6 | warden | target | `bar` | "the" |
| O | `O/2026-09-21T23-19-29-089Z.md` | 7 | prisoner | property | `concealment` | "a" |
| O | `O/2026-09-21T23-25-19-962Z.md` | 7 | warden | target | `cot` | "cot" |
| O | `O/2026-09-21T23-40-03-470Z.md` | 5 | warden | target | `bar` | "bar" |
| O | `O/2026-09-21T23-40-03-470Z.md` | 6 | prisoner | target | `cot` | "cot" |
| O | `O/2026-09-21T23-40-03-470Z.md` | 9 | warden | target | `bar` | "bar" |
| O | `O/2026-09-21T23-52-46-457Z.md` | 1 | prisoner | property | `edge` | "One" |
| O | `O/2026-09-21T23-52-46-457Z.md` | 6 | warden | property | `concealment` | "by" |
| O | `O/2026-09-21T23-52-46-457Z.md` | 9 | prisoner | target | `spoon` | "the" |
| O | `O/2026-09-22T00-03-38-018Z.md` | 1 | warden | target | `bar` | "the" |
| O | `O/2026-09-22T00-03-38-018Z.md` | 6 | warden | product | `none` | "Run" |
| O | `O/2026-09-22T00-03-38-018Z.md` | 7 | warden | target | `spoon` | "the" |
| O | `O/2026-09-22T00-03-38-018Z.md` | 10 | prisoner | target | `window` | "the" |

## Refusal audit list (§2)

Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, unbuilt or unclear.

| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |
|---|---|---|---|---|---|---|---|---|---|
| O | `O/2026-09-21T22-08-25-546Z.md` | 1 | warden | none | reveal | none | slight | impossible |  |
| O | `O/2026-09-21T22-08-25-546Z.md` | 1 | prisoner | loose_tile | wear | none | slight | impossible |  |
| O | `O/2026-09-21T22-08-25-546Z.md` | 4 | prisoner | cot | wear | posture | moderate | impossible |  |
| O | `O/2026-09-21T22-08-25-546Z.md` | 7 | warden | spoon | reveal | concealment | moderate | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 1 | warden | none | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 3 | warden | bar | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 4 | warden | lock | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 4 | prisoner | spoon | conceal | concealment | slight | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 5 | prisoner | spoon | wear | none | moderate | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 6 | warden | prisoner | reveal | concealment | substantial | impossible |  |
| O | `O/2026-09-21T22-08-27-040Z.md` | 6 | prisoner | cot | conceal | concealment | moderate | impossible |  |
| O | `O/2026-09-21T22-32-41-690Z.md` | 2 | prisoner | spoon | reveal | none | slight | impossible |  |
| O | `O/2026-09-21T22-32-41-690Z.md` | 6 | prisoner | wire | derive | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-32-41-690Z.md` | 7 | warden | cot | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-32-41-690Z.md` | 9 | warden | spoon | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-32-41-690Z.md` | 10 | prisoner | blanket | open | passage | substantial | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 1 | prisoner | cot | none | none | slight | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 4 | prisoner | cot | none | none | moderate | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 6 | warden | spoon | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 8 | prisoner | loose_tile | derive | concealment | moderate | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 9 | warden | spoon | reveal | edge | moderate | impossible |  |
| O | `O/2026-09-21T22-57-53-068Z.md` | 10 | warden | window | none | none | moderate | impossible |  |
| O | `O/2026-09-21T23-13-31-489Z.md` | 2 | warden | spoon | reveal | edge | moderate | impossible |  |
| O | `O/2026-09-21T23-13-31-489Z.md` | 3 | prisoner | spoon | conceal | concealment | slight | impossible |  |
| O | `O/2026-09-21T23-13-31-489Z.md` | 6 | prisoner | spoon | conceal | concealment | moderate | impossible |  |
| O | `O/2026-09-21T23-13-31-489Z.md` | 10 | warden | bar | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-13-31-489Z.md` | 10 | prisoner | key_ring | open | passage | substantial | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 2 | prisoner | cot | none | none | moderate | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 3 | warden | spoon | reveal | edge | moderate | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 5 | prisoner | blanket | none | none | moderate | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 8 | prisoner | wire_2 | none | none | moderate | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 9 | warden | lock | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-19-29-089Z.md` | 9 | prisoner | meal_tray | leave | passage | substantial | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 1 | prisoner | cot | derive | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 3 | warden | spoon | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 4 | warden | wire | derive | integrity | slight | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 6 | warden | prisoner | none | none | moderate | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 6 | prisoner | wire | derive | integrity | slight | impossible |  |
| O | `O/2026-09-21T23-25-19-962Z.md` | 7 | prisoner | wire | derive | integrity | slight | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 1 | warden | none | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 2 | warden | meal_tray | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 2 | prisoner | cot | wear | edge | moderate | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 3 | warden | spoon | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 4 | prisoner | none | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 6 | warden | lock | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 7 | warden | spoon | reveal | edge | moderate | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 7 | prisoner | spoon | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-40-03-470Z.md` | 8 | prisoner | door | reveal | integrity | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 1 | prisoner | spoon | none | edge | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 2 | warden | lock | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 3 | warden | meal_tray | reveal | none | moderate | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 4 | prisoner | meal_tray | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 5 | prisoner | bar | none | integrity | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 6 | warden | prisoner | reveal | concealment | moderate | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 6 | prisoner | cot | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 7 | prisoner | spoon | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 9 | prisoner | spoon | none | none | slight | impossible |  |
| O | `O/2026-09-21T23-52-46-457Z.md` | 10 | warden | none | none | none | moderate | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 2 | prisoner | warden | reveal | none | slight | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 3 | warden | spoon | reveal | edge | moderate | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 3 | prisoner | cot | none | none | slight | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 5 | warden | lock | reveal | integrity | moderate | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 5 | prisoner | cot | none | none | moderate | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 9 | prisoner | blanket | wear | integrity | substantial | impossible |  |
| O | `O/2026-09-22T00-03-38-018Z.md` | 10 | warden | spoon | reveal | edge | moderate | impossible |  |

## Lost rulings

RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.

| arm | replies | strict JSON | read leniently | unreadable |
|---|---|---|---|---|
| O | 198 | 178 | 20 | 0 |

| arm | transcript | round | chair | question | referee answered | transcript recorded |
|---|---|---|---|---|---|---|
| O | `O/2026-09-21T23-13-31-489Z.md` | 10 | warden | effect | `reveal` | `none` |

Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.

| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |
|---|---|---|---|
| O | 0 | 0 | 0 |

