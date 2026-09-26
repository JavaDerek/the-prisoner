# D6 lands, D9 does not: results against the pre-committed numbers

Run 2026-09-26 (UTC), pinned to `030d348`. 39 calls, sequential, one process, `doris:11435`,
`muse-glimmer-30b-q4_k_m`, thinking OFF (`chat_template_kwargs.reasoning_strength: "none"`),
temperature 0 (hardcoded by `refereeTransport.ts`), N=1 per item per arm (no item landed exactly on a
kill threshold, so the re-run clause in `PREDICTION.md` never fired). Total wall clock 1293s (~21.5
min). Every world was built fresh from `buildOpenWorld({ presence: "modelled" })` +
`computePerceivedObjects` at the game's own default round-1 state -- never a recorded request. Raw
output: `results.jsonl` (unedited, one JSON object per call), `logs/run.log`.

## Per-item table, all three arms

`target/effect/property` (`magnitude`, `applicable`; `contained` where checked):

| id | group | intent | OFF | D6 | D6+D9 |
|---|---|---|---|---|---|
| S1 | S | hide | none/conceal/none (slight, F) | **prisoner**/conceal/none (slight, F) | prisoner/conceal/**posture** (slight, **T**) |
| S2 | S | hide myself | **prisoner**/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |
| S3 | S | cover myself up | **prisoner**/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/**none**/none (slight, F) |
| S4 | S | try to conceal myself | **prisoner**/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |
| O1 | O | push Croft to the floor | warden/wear/posture (moderate, T) | warden/wear/posture (moderate, T) | warden/wear/posture (moderate, T) |
| T1 | T | hide the spoon under the tile | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) |
| T2 | T | crouch by the window | prisoner/wear/posture (slight, T) | prisoner/wear/posture (slight, T) | prisoner/wear/posture (slight, T) |
| C1 | C | hide under the blanket | none/conceal/none (slight, F) | **prisoner**/conceal/none (slight, F) | **blanket**/**conceal**/**concealment** (slight, T; contained **F**) |
| C2 | C | get under the blanket | blanket/**none**/none (slight, F) | blanket/none/**concealment** (slight, F) | blanket/**conceal**/concealment (slight, T; contained **F**) |
| C3 | C | crawl under the cot to hide | prisoner/conceal/posture (slight, T) | prisoner/conceal/posture (slight, T) | **cot**/conceal/concealment (slight, T; contained **F**) |
| P1 | P | pull the blanket over myself | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | **blanket**/conceal/concealment (slight, T; contained **F**) |
| N1 | N | hide the spoon under the blanket | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) | spoon/conceal/concealment (slight, T) |
| F1 | F | hide the prisoner under the blanket | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) | prisoner/conceal/none (slight, F) |

Bold marks what moved from the row to its left, or what a criterion below reads directly.

## D6 against its pre-registered numbers

**D6 kill (need >= 3 of 4 S items reading `target: prisoner` in the D6 arm): 4 of 4.** S1-S4 all read
`target: prisoner` with the elision clause on. Note OFF already gets 3 of 4 (S2-S4, via the *existing*
"actor's OWN body" clause and the literal word "myself"); D6's own clause is what recovers S1 ("hide"
bare, no reflexive pronoun at all, nothing to date's clause could have caught) from `none` to
`prisoner`. **PASS, comfortably clear of the kill number.**

**D6 precision kill (neither trap row moves from OFF, in the D6 arm): confirmed.** T1 stays
`spoon/conceal/concealment` and T2 stays `prisoner/wear/posture`, byte-for-byte identical target,
effect and property in OFF and D6. **PASS.**

**O1 sanity (not a kill row):** identical across all three arms, `warden/wear/posture` at `moderate`.
No sign of §68.3's "offering an unchosen key degrades a neighbour" here.

**Verdict: D6 LANDS.** `PRISONER_ELISION`'s own default flips to `on` (commit `687d913`), the
env-reader/constructor split following `PRISONER_ONE_ACT`'s own precedent so every existing test and
replay stays byte-identical unless it opts in.

**One interaction worth recording, not a criterion violation:** D6 alone, without D9, pulls C1 ("hide
under the blanket") from OFF's `target: none` to `target: prisoner` -- the elision clause reads "the
blanket" as the PLACE the existing clause already excludes ("never the place it is hidden in, under or
behind"), so with no other noun surviving, it falls to D6's own "names the actor herself." Both are
refused (`applicable: false` either way -- a person still declares no `concealment`), so nothing a
player experiences changes, but the internal reason does. This is exactly the tension the two clauses
were predicted to have on this exact phrasing, and D9 (below) is what resolves it in the other
direction when it is also on.

## D9 against its pre-registered numbers

**D9 kill (need >= 2 of 3 core items reading `target: <container>` / `effect: conceal` /
`property: concealment` / `magnitude` in `{moderate, substantial}`, in D6+D9): 0 of 3.**

The targeting half is a clean sweep: C1, C2 and C3 all land on `target: blanket` (or `cot` for C3),
`effect: conceal`, `property: concealment` in the D6+D9 arm -- 3 of 3, up from 0 of 3 fully-grounded
readings in OFF (C1 found no target at all; C2 found the container but no effect; C3 found the actor,
not the container). **The clauses do exactly the redirection job §6.2 asked for.** But `magnitude`
came back `slight` on all three, and `slight` raises a container's concealment by 20
(`scenarioObjects.ts`'s own wear/restore table for both `blanket` and `cot`), not the 50
`CONTAINMENT_HIDDEN_AT_OR_ABOVE` the mechanic gates containment on. Applying each ruling through the
real `planEffect` + `resolver.resolve()` path and reading `world.personHeldIn.prisoner` back
(`currentT`/`readNumericFact`) confirms it directly: `containmentResourceValue: 0` in every case
(started at 0, `+20`, still `0` after clamping is not what happens -- the resource itself never gets
SET at all, because `OPEN_CONCEAL_CONTAINER` only writes the actor's containment when the raise
crosses the line, so it stays exactly where it started). **`contained: false` on C1, C2 and C3, all
three. This is the kill number, and it is dead: 0 of 3, against a bar of 2 of 3.**

**D9 precision kill (N1 must not read `target: blanket`; neither trap row moves, in D6+D9):
confirmed clean.** N1 ("hide the spoon under the blanket") stays `target: spoon` in every arm,
including D6+D9 -- the existing "the spoon declares its own concealment" pull (§76.1's own prediction)
held against both new clauses. T1 and T2 hold too (see the table). This half of D9 passed; it did not
need to, since the magnitude failure alone is decisive.

**P1, paraphrase, not a kill row:** "pull the blanket over myself" reached `target: blanket, effect:
conceal, property: concealment` in D6+D9 -- a hit, not predicted with confidence (the clause's own
words are "under or beneath," and "pull ... over" is a different preposition). Same magnitude problem
as the core three (`slight`, not contained). Worth recording as evidence the clause generalises
further than its literal wording, on the one axis it was ever going to help with.

**F1, flagged #25 row 2, not scored:** "hide the prisoner under the blanket" (chair: prisoner --
corpus confirms this is Mara narrating her own act in the third person, never the warden hiding her)
reads `target: prisoner` in ALL THREE arms, D6+D9 included. D9's clause does not win here: the literal
noun "prisoner," already a legal target key, dominates over "getting under a thing names that thing,"
consistent with §68.4's own standing finding that a literal noun match wins. §76.1's flagged
"narrower-than-worst-case overinclusion" (the mechanic marking the ACTOR contained even when she named
someone ELSE as what gets hidden) does not fire on this exact phrasing, because the referee never
reaches the container at all here. Recorded, not scored.

**Verdict: D9 DOES NOT LAND. `PRISONER_CONTAINER_CLAUSE` stays `off`.** Per the protocol this
checkpoint was run under, a pre-registered kill number that comes back dead keeps the switch off even
though a real, useful improvement (the targeting fix) shipped inside the same clause pair -- the
targeting improvement is not separable from the switch as built, and this task does not re-litigate
its own pre-committed criterion after seeing the result. See `docs/OPEN-VARIANT.md` §77 for the
write-up and what a follow-up would need to ask (a magnitude-wording addition, not another target or
effect clause -- those two are now proven to work).

## Consequence for D6's own dependency note

`PREDICTION.md` flagged that D9 was measured only in combination with D6, never alone, so a D9 pass
with D6 dead would not have been enough to land D9. That branch did not arise: D6 passed outright, and
D9 failed outright, on its own independent criterion (the magnitude gate), unrelated to whether D6 was
also on. Nothing here is a "D9 passed conditionally" case.

## What the run did not test

Only N=1 per item; no item landed on a kill threshold's exact boundary, so the pre-registered re-run
clause never triggered. The magnitude question's own wording was untouched by either arm and was never
itself an experimental variable here -- its `slight` answer on every "hide under a container" intent
is a finding about a THIRD prompt (the magnitude question), not about D6 or D9's own two clauses, and
nothing in this checkpoint measured whether a differently-worded magnitude question would read these
same intents as `moderate`.
