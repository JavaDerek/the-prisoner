# Pre-committed before D6's and D9's first model call

Written 2026-09-26, **before any model call**. Code revision `030d348` (clean tree; `git status`
shows only this checkpoint directory untracked, plus `checkpoints/2026-09-26-human-intents/`, another
pending job's files this task does not touch). §9 step 5's two arms
(`checkpoints/../../src/open/referee.ts`'s `PRISONER_ELISION`/`PRISONER_CONTAINER_CLAUSE`) landed in
commit `030d348`, both `off` by default, TDD, 76/76 tests in `referee.test.ts` passing, full suite
1253/1253, `npm run lint`/`npm run typecheck` clean. No `src/` change happens after this file is
committed until `RESULTS.md` is written.

**Server check before any call** (CLAUDE.md's "one driver at a time"): `curl doris:11435/health` ->
`{"status":"ok"}`, `curl doris:11435/v1/models` -> `muse-glimmer-30b-q4_k_m` only. `ps aux` shows no
other `tsx`/`node checkpoint`/`probe.mts` process on this machine at 07:21 UTC. This probe is the only
thing that will call doris:11435 while it runs, one request at a time, one process, sequential
`await` in a `for` loop -- never `Promise.all`.

## What is being measured

HUMAN-INTENTS-DESIGN.md §5 (D6) and §6.2 (D9), landing-order item 5. Two clauses, each behind its own
switch, probed together because §6.2 says they fire on the same intents:

- **D6, `PRISONER_ELISION=on`**: the target question gains, verbatim, *"An act of hiding, sheltering
  or covering that names no thing hidden names the actor herself."* Conditional on a person in view.
- **D9, `PRISONER_CONTAINER_CLAUSE=on`**: the target question gains *"An act of getting under or
  beneath a thing names that thing"* and the effect question gains the conceal-on-container reading
  (`referee.ts`'s own `CONTAINER_EFFECT_CLAUSE`, written in the effect question's house style, not the
  design doc's exact prose). Conditional on a person in view.

**Three arms**, per the task: **OFF** (both switches off, today's live default), **D6** (elision on,
container off), **D6+D9** (both on) -- D9 is never measured alone, because §6.2 poses it as landing
beside D6 on the identical intents, and this task's brief says so explicitly ("Arms: OFF, D6 only,
D6+D9"). **Consequence for landing, stated now so it cannot be decided after the fact:** if D9 passes
its own criteria but D6 fails, D9's own default cannot flip to `on` from this evidence alone -- a
`D9-alone` configuration has never been asked of the model, and landing it would be shipping an
untested combination. That would be recorded as "D9 passes conditionally, not measured alone,"
distinct from a landed arm.

**Everything is built from `buildOpenWorld` + `computePerceivedObjects` at the game's own default
round-1 state, never a recorded request or a copied harness** (`prisoner-measurement-fidelity`):
`createTestDb()` (`:memory:`), `buildOpenWorld({ presence: "modelled" })`, actor `"prisoner"`, `t =
clock.t0`, `computePerceivedObjects(world, "prisoner", t, "modelled")`. `isDeclared`/`propertiesOf`/
`kindOf` are the same closures `checkpoint.ts` wires into its own `createReferee` call
(`declaredProperty`/`declaredPropertyKeys`/`derivedKindOf`), not a hand-typed property table. Every
item gets its **own fresh** `buildOpenWorld()` call (a fresh `gameId` in the same in-memory db), so no
item's resolved state leaks into another's, and D9's "contained after resolution" check
(`planEffect` + `buildOpenResolver().resolve()`, `currentT`/`readNumericFact` against
`world.personHeldIn.prisoner`) mutates only that item's own isolated world. `oneAct`/`instrumentMode`
are left at their bare `createReferee` defaults (`off`) -- irrelevant to what this probe reads
(target/effect/property/magnitude), and a second call per item would only slow it down.

Referee: `createRefereeTransport({ baseUrl: "http://doris:11435/v1", model: "muse-glimmer-30b-q4_k_m",
timeoutMs: 600000, ensureLoaded: async () => {}, thinking: "off" })` -- Muse is served on its own
dedicated llama-server (2026-09-25's own finding), so `ensureLoaded` is a no-op exactly as every
2026-09-25 probe against this same server used; `thinking: "off"` sends
`chat_template_kwargs.reasoning_strength: "none"`, per CLAUDE.md's "Local play is all-Muse, and
thinking is OFF everywhere." Temperature is not a parameter here: `refereeTransport.ts`'s own header
says 0 is hardcoded, never a caller's choice. **N=1 per item per arm** -- a deliberate deviation from
`checkpoints/2026-09-19-selftarget`'s N=5, made for wall-clock cost (39 calls at N=1 vs 195 at N=5 on a
slower 30B model than that probe's qwen3:14b) and temperature 0's own determinism; if a result lands
exactly on a kill threshold, it is re-run once more before being called dead or alive, and that re-run
is reported as such, never silently folded into the first number.

## The item set (13 intents, labelled here, before any call)

All items are the PRISONER's own turn (chair: prisoner), at the default round-1 world.

**S -- D6's own target set, bare self-hiding acts naming no container, no thing hidden, nobody else
(n=4), want `target: prisoner` under D6:**

| id | intent |
|---|---|
| S1 | hide |
| S2 | hide myself |
| S3 | cover myself up |
| S4 | try to conceal myself |

**O -- sanity, not a kill row (n=1):** "push Croft to the floor" -- an unambiguous act on the OTHER
person, `target: warden` today (`checkpoints/2026-09-19-selftarget/RESULTS.md`, reconfirmed live under
`checkpoints/2026-09-20-person-target`). §68.3 found that merely OFFERING an unchosen key degraded a
working neighbouring ruling twice out of three tries; this row exists to catch that shape if D6 or D9
causes it here too, since it was never confirmed absent for these two specific clauses.

**T -- traps, must not move from OFF in either arm (n=2):**

| id | intent | prediction |
|---|---|---|
| T1 | hide the spoon under the tile | stays `target: spoon` in all three arms -- the tile is a container the intent does not name, and the spoon is the one thing named, exactly the shape `checkpoints/2026-09-19-floor` and `-selftarget` both found: a literal noun match wins. |
| T2 | crouch by the window | **not predicted.** Measured OFF first; whatever OFF answers, D6 and D6+D9 must reproduce it exactly (target, effect, property all three). `checkpoints/2026-09-19-selftarget` found "crouch down low" captured by `window`/`open`/`passage` at thinking OFF with no clause at all (§68's own §68.1 table is a different, thinking-ON reading of a similar phrase, so this is not assumed to transfer); this exact phrasing has not been run against the live D5/D9-updated scenario or against Muse before. |

**C -- D9's own core set, "getting under a container" (n=3), each a kill row for D9, want
`target: <container>`, `effect: conceal`, `property: concealment`, `magnitude` in `{moderate,
substantial}` (so the same resolution marks the actor contained -- `CONTAINMENT_HIDDEN_AT_OR_ABOVE =
50`, and `conceal`'s `restore` proportions are 20/50/100 for slight/moderate/substantial, per
`scenarioObjects.ts`; `slight` alone does not cross the line):**

| id | intent | note |
|---|---|---|
| C1 | hide under the blanket | = the-prisoner#25 row 1, `checkpoints/2026-09-26-human-intents/corpus.json` id `I25-1`. Its own `expectedLabelPostD5D9` calls this row `misread` on the strength that "once the arm... is also on, this act becomes expressible" -- this probe is exactly what that label deferred to. |
| C2 | get under the blanket | paraphrase of C1, no container named other than the one already in the intent. |
| C3 | crawl under the cot to hide | the SECOND container (`PERSON_CONTAINERS[1]`), so a pass on the blanket alone would not show the clause generalises across both declared containers. |

**P -- D9 paraphrase, scored, not a kill row (n=1):** "pull the blanket over myself" -- semantically
the same act, phrased as "over" rather than "under or beneath," which is NOT what D9's clause names.
Predicted, tentatively, to fail to redirect to `target: blanket` even under D6+D9, since the clause's
own words are "under or beneath" and this repository's own standing lesson
(`checkpoints/2026-09-19-floor`, `OPEN-VARIANT.md` §68.4) is that the referee's target answer tracks
literal nouns and the literal phrasing a clause names, not a paraphrase's meaning. A miss here is not
scored against the kill number; a hit would be worth reporting as evidence the clause generalises
further than its own wording suggests.

**N -- D9's negative row, a kill row for D9's precision (n=1):** "hide the spoon under the blanket" --
must NOT read `target: blanket`. The existing target clause already sends "hide the spoon under X" to
`target: spoon` in the common case (§76.1's own text: "the spoon declares its own concealment, and it
is the more specific noun the target question's existing clauses reach for first"); this row checks
that D9's own new clause does not override that established behaviour and drag the ruling onto the
container instead.

**F -- flagged, exploratory, not a kill row (n=1):** "hide the prisoner under the blanket" =
the-prisoner#25 row 2, corpus id `I25-2`. **Read from the corpus directly: `chair: "prisoner"`** --
this is Mara's own turn, referring to herself in the third person by her role name ("the prisoner"),
never the warden hiding her (this task's own instructions posed that reading as a question; the
corpus resolves it). Built at the SAME round-1 default state as C1 (the corpus's own
`stateNote` for `I25-2`: none of the seven recorded prisoner turns changed a tracked property, so
round-1 defaults match round 2's actual state too, "as far as the prisoner's own turns are
concerned"). This is `OPEN-VARIANT.md` §76.1's own flagged, known limitation made concrete: "prisoner"
is a legal target key AND is literally named in the intent, so the base target clause's literal-noun
match (§68.4) may win over D9's clause regardless of arm, landing on `target: prisoner` rather than
`target: blanket` -- which would leave the SAME unmodelled gap #28 always had (a person's own
`concealment` does not exist). If D9's clause instead wins and redirects this to `target: blanket`,
that reproduces §76.1's own documented "narrower-than-worst-case overinclusion": the mechanic would
mark the ACTING principal (the prisoner) contained regardless, which happens to be correct here only
because the actor and the named "thing hidden" are the same person -- pure coincidence, not something
either clause reasons about. Recorded either way, not scored as a pass or fail of either arm.

## Kill numbers, named in advance

- **D6 kill:** fewer than **3 of 4** S items read `target: prisoner` in the **D6** arm -> D6 stays
  off, exactly `checkpoints/2026-09-19-selftarget`'s own shape and threshold.
- **D6 precision kill:** **either** trap row's `target`/`effect`/`property` answer differs from its
  own OFF answer in the **D6** arm -> D6 stays off, whatever the S-set result.
- **D9 kill:** fewer than **2 of 3** C items read `target: <container>` / `effect: conceal` /
  `property: concealment` / `magnitude` in `{moderate, substantial}` in the **D6+D9** arm -> D9 stays
  off.
- **D9 precision kill:** N1 ("hide the spoon under the blanket") reads `target: blanket` in the
  **D6+D9** arm -> D9 stays off, whatever the C-set result -- a clause that redirects a
  correctly-targeted intent onto the wrong object is worse than the gap it was built to close.
  Likewise, **either** trap row moving in the **D6+D9** arm -> D9 stays off.
- **D6+D9 interaction, recorded but not a separate kill:** whether the S-set's own pass rate holds,
  rises, or falls in the D6+D9 arm relative to the D6 arm alone (does D9's clause disturb D6's own
  reading on intents that name no container at all).

O1 and P1 and F1 are reported, never scored against a kill number, for the reasons stated beside each.

## The standing warning this probe is not exempt from

`OPEN-VARIANT.md` §68.2: a candidate clause built for a document decision was measured and scored 0 of
4, **worse than silence**, and was never landed. Nothing about this probe's own careful construction
makes that outcome less possible here. If either arm fails, it is written up in
`docs/OPEN-VARIANT.md` (a new §77, since §76 is D5/D9's own mechanics section and this is the clause
probe D9's own text at §76.1 predicted would be needed) exactly as failed, not softened, and the
switch stays `off`.

## Stopping rule

Every item, every arm, is called exactly once (N=1), in the fixed order S, O, T, C, P, F x OFF, D6,
D6+D9 -- 39 calls total, sequential, one process, one `for` loop. No label above is changed after
seeing a result. If a result lands exactly on a kill threshold (the D6 kill's "3 of 4" boundary, or
the D9 kill's "2 of 3"), that specific item is re-run once more before the arm is called dead or
alive, and both runs are kept in the raw JSONL. Results are written to
`checkpoints/2026-09-26-arms/results.jsonl` (append, unedited) as they arrive, and `RESULTS.md` is
written from that file after the last call, not from memory of the run.
