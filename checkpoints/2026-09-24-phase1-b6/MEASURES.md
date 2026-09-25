# Batch measures: `checkpoints/2026-09-24-phase1-b6` (arms P, S)

## Per arm

| arm | wits model | games | intents | silences | distinct targets / game (mean) | person-target games | distinct effects / game (mean) | grounded | refused | escapes |
|---|---|---|---|---|---|---|---|---|---|---|
| P | `muse-glimmer-30b-q4_k_m` | 7 | 139 | 1 | 5.43 | 3 of 7 | 4.43 | 131 | 8 | 0 |
| S | `muse-glimmer-30b-q4_k_m` | 7 | 138 | 2 | 4.86 | 4 of 7 | 3.71 | 121 | 17 | 0 |

Person-target games is count.mts's pooled column, kept so this table reproduces it; §5.2 reports person targets by chair below and never pools them.

## Reach, per chair

Route finding: intents whose referee `property` answer is `passage`. Residue refusals: refusals on (no --residue given).

| arm | chair | intents | silences | distinct targets / game (mean) | distinct targets (pooled) | person targets | distinct effects / game (mean) | distinct effects (pooled) | grounded | refused | route finding | residue refusals |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P | warden | 69 | 1 | 3.71 | 6: bar, cot, lock, loose_tile, prisoner, spoon | 1 | 1.00 | 1: reveal | 66 | 3 | 0 | 0 |
| P | prisoner | 70 | 0 | 3.71 | 7: bar, grit, loose_tile, prisoner, spoon, warden, window | 4 | 4.29 | 7: conceal, derive, noise, open, reveal, take, wear | 65 | 5 | 11 | 0 |
| S | warden | 70 | 0 | 3.71 | 6: bar, blanket, lock, loose_tile, prisoner, spoon | 3 | 1.14 | 2: expose, reveal | 63 | 7 | 0 | 0 |
| S | prisoner | 68 | 2 | 2.86 | 9: bar, cot, door, key_ring, loose_tile, prisoner, spoon, warden, window | 6 | 3.00 | 7: conceal, derive, noise, open, reveal, take, wear | 58 | 10 | 2 | 0 |

## First contact

For each object a chair targeted: the mean, over the games in which that chair targeted it at all, of the first round it did; and how many of the arm's games that was.

| arm | chair | object | first round (mean) | games |
|---|---|---|---|---|
| P | warden | bar | 1.00 | 7 of 7 |
| P | warden | cot | 7.00 | 1 of 7 |
| P | warden | lock | 2.00 | 6 of 7 |
| P | warden | loose_tile | 4.40 | 5 of 7 |
| P | warden | prisoner | 4.00 | 1 of 7 |
| P | warden | spoon | 3.00 | 6 of 7 |
| P | prisoner | bar | 2.67 | 6 of 7 |
| P | prisoner | grit | 10.00 | 1 of 7 |
| P | prisoner | loose_tile | 3.00 | 3 of 7 |
| P | prisoner | prisoner | 7.00 | 1 of 7 |
| P | prisoner | spoon | 3.00 | 7 of 7 |
| P | prisoner | warden | 5.00 | 2 of 7 |
| P | prisoner | window | 2.83 | 6 of 7 |
| S | warden | bar | 1.00 | 7 of 7 |
| S | warden | blanket | 9.00 | 1 of 7 |
| S | warden | lock | 2.14 | 7 of 7 |
| S | warden | loose_tile | 4.33 | 3 of 7 |
| S | warden | prisoner | 4.00 | 1 of 7 |
| S | warden | spoon | 4.14 | 7 of 7 |
| S | prisoner | bar | 1.67 | 6 of 7 |
| S | prisoner | cot | 3.00 | 2 of 7 |
| S | prisoner | door | 10.00 | 1 of 7 |
| S | prisoner | key_ring | 10.00 | 1 of 7 |
| S | prisoner | loose_tile | 3.00 | 1 of 7 |
| S | prisoner | prisoner | 5.00 | 3 of 7 |
| S | prisoner | spoon | 2.75 | 4 of 7 |
| S | prisoner | warden | 6.00 | 1 of 7 |
| S | prisoner | window | 2.00 | 1 of 7 |

## Competence, per chair

Plans: §22's rule from the `**Plan:**`/`**Replanned because:**` markers, on both chairs; "§22 line agrees" checks the prisoner's count against the line each transcript printed. Verified rate is over the `yes`/`no` cells of the referee table.

| arm | chair | turns with a plan | replanned | kept | §22 line agrees | target none | rulings with an unverified citation | decision silences | voice silences | citations verified |
|---|---|---|---|---|---|---|---|---|---|---|
| P | warden | 62 | 1 | 61 | n/a | 0 | 0 | 1 | 0 | 207/207 (100%) |
| P | prisoner | 0 | 0 | 0 | yes | 4 | 4 | 0 | 0 | 207/211 (98%) |
| S | warden | 63 | 0 | 63 | n/a | 0 | 0 | 0 | 0 | 210/210 (100%) |
| S | prisoner | 61 | 8 | 53 | yes | 5 | 7 | 2 | 0 | 198/205 (97%) |

## Short citations (§3.3)

Rulings with at least one citation that is a single word of three letters or fewer. Whether the word is an article or the object's own name is for the reader; the design says a length rule cannot tell them apart.

| arm | rulings with a short citation | of rulings | rows |
|---|---|---|---|
| P | 14 | 139 | 14 |
| S | 8 | 138 | 10 |

| arm | transcript | round | chair | question | answer | quote |
|---|---|---|---|---|---|---|
| P | `P/2026-09-24T23-35-40-526Z.md` | 1 | prisoner | product | `none` | "I" |
| P | `P/2026-09-24T23-35-40-526Z.md` | 3 | prisoner | product | `none` | "I" |
| P | `P/2026-09-24T23-35-40-526Z.md` | 7 | prisoner | target | `prisoner` | "I" |
| P | `P/2026-09-24T23-35-40-526Z.md` | 9 | prisoner | product | `none` | "I" |
| P | `P/2026-09-24T23-35-41-856Z.md` | 8 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-33-51-967Z.md` | 1 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-33-51-967Z.md` | 5 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-33-51-967Z.md` | 7 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-54-08-570Z.md` | 4 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-54-08-570Z.md` | 7 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T00-54-08-570Z.md` | 10 | prisoner | effect | `noise` | "say" |
| P | `P/2026-09-25T01-50-35-434Z.md` | 1 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T01-50-35-434Z.md` | 3 | prisoner | product | `none` | "I" |
| P | `P/2026-09-25T01-50-35-434Z.md` | 10 | prisoner | property | `none` | "I" |
| S | `S/2026-09-25T00-01-11-724Z.md` | 4 | prisoner | product | `none` | "Use" |
| S | `S/2026-09-25T00-01-11-724Z.md` | 9 | prisoner | perceptibility | `audible` | "ask" |
| S | `S/2026-09-25T00-01-11-724Z.md` | 10 | prisoner | product | `none` | "Ask" |
| S | `S/2026-09-25T00-01-11-724Z.md` | 10 | prisoner | magnitude | `slight` | "now," |
| S | `S/2026-09-25T00-01-11-724Z.md` | 10 | prisoner | perceptibility | `audible` | "Ask" |
| S | `S/2026-09-25T00-23-42-507Z.md` | 2 | prisoner | target | `bar` | "bar" |
| S | `S/2026-09-25T00-23-42-507Z.md` | 4 | prisoner | product | `none` | "Use" |
| S | `S/2026-09-25T00-23-42-507Z.md` | 10 | prisoner | product | `none` | "Pry" |
| S | `S/2026-09-25T00-47-58-689Z.md` | 4 | prisoner | product | `none` | "Use" |
| S | `S/2026-09-25T01-40-02-976Z.md` | 2 | prisoner | product | `none` | "Use" |

## Refusal audit list (§2)

Every refused ruling (ruled impossible, or target `none`), keys only. The `label` column is for the owner: genuine, misruled, unbuilt or unclear (OPUS-FIRST-DESIGN §2).

| arm | transcript | round | chair | target | effect | property | magnitude | ruled | label |
|---|---|---|---|---|---|---|---|---|---|
| P | `P/2026-09-24T23-56-16-322Z.md` | 3 | warden | loose_tile | reveal | none | moderate | impossible |  |
| P | `P/2026-09-25T00-14-53-769Z.md` | 8 | prisoner | none | none | none | slight | impossible |  |
| P | `P/2026-09-25T00-14-53-769Z.md` | 9 | prisoner | bar | none | none | slight | impossible |  |
| P | `P/2026-09-25T00-33-51-967Z.md` | 5 | prisoner | none | noise | none | slight | possible |  |
| P | `P/2026-09-25T00-54-08-570Z.md` | 8 | warden | loose_tile | reveal | none | moderate | impossible |  |
| P | `P/2026-09-25T00-54-08-570Z.md` | 10 | prisoner | none | noise | none | slight | possible |  |
| P | `P/2026-09-25T01-50-35-434Z.md` | 4 | warden | loose_tile | reveal | none | moderate | impossible |  |
| P | `P/2026-09-25T01-50-35-434Z.md` | 10 | prisoner | none | noise | none | slight | possible |  |
| S | `S/2026-09-25T00-01-11-724Z.md` | 8 | prisoner | none | none | none | slight | impossible |  |
| S | `S/2026-09-25T00-23-42-507Z.md` | 6 | prisoner | none | none | none | slight | impossible |  |
| S | `S/2026-09-25T00-23-42-507Z.md` | 7 | prisoner | prisoner | none | none | slight | impossible |  |
| S | `S/2026-09-25T00-23-42-507Z.md` | 8 | prisoner | prisoner | none | none | slight | impossible |  |
| S | `S/2026-09-25T01-09-42-366Z.md` | 4 | prisoner | spoon | conceal | none | slight | impossible |  |
| S | `S/2026-09-25T01-09-42-366Z.md` | 5 | prisoner | cot | none | none | slight | impossible |  |
| S | `S/2026-09-25T01-09-42-366Z.md` | 8 | warden | prisoner | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-09-42-366Z.md` | 8 | prisoner | none | none | none | slight | impossible |  |
| S | `S/2026-09-25T01-09-42-366Z.md` | 9 | prisoner | none | none | none | substantial | impossible |  |
| S | `S/2026-09-25T01-15-38-878Z.md` | 9 | warden | blanket | reveal | none | substantial | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 1 | prisoner | cot | none | none | slight | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 5 | warden | loose_tile | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 6 | warden | loose_tile | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 7 | warden | loose_tile | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 9 | warden | loose_tile | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-31-25-639Z.md` | 10 | warden | loose_tile | reveal | none | moderate | impossible |  |
| S | `S/2026-09-25T01-40-02-976Z.md` | 7 | prisoner | none | none | none | substantial | impossible |  |

## Lost rulings

RESULTS.md bug 1: half-rounds whose `.referee.json` reply answers `target`/`effect` with a key the transcript table does not show, and no rejected offer is printed for it. An escape the referee answered and the reader lost appears here, never in the escapes column.

| arm | replies | strict JSON | read leniently | unreadable |
|---|---|---|---|---|
| P | 139 | 139 | 0 | 0 |
| S | 138 | 138 | 0 | 0 |

None.

Escapes as answered: the recorded escapes, plus games that did not escape but lost a ruling the referee answered `leave`. Whether that leave would have been ruled possible is not knowable from keys, so the sum is a ceiling, not a count.

| arm | escapes recorded | lost `leave` rulings | as answered (ceiling) |
|---|---|---|---|
| P | 0 | 0 | 0 |
| S | 0 | 0 | 0 |

