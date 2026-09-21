# Opus first — finish the world under a mind that exercises it, then measure the gap, then build the helpers

**Written 2026-09-21, a proposal for red team; its five decisions were taken the same day (§0).** It follows from the ambition comparison
(`OPEN-VARIANT.md` §69, `checkpoints/2026-09-20-ambition/`) and from the owner's reading of it: the
world's imperfections have confounded every `mother-of-invention` measurement so far, so finish the world
first, under the mind that finds its gaps, and only then build deterministic helpers for the small mind
on the 4090. Every claim about code was checked against the tree on the day; file references may drift.

The analogy the owner offered is Infocom writing for the IBM PC and porting down to the CoCo 2. It holds
with one correction that shapes the whole design (§1.3): the Z-machine already exists here, it is
`run-dmcp` plus the referee, and the same content runs under every mind. What has to be ported is not
the world. It is the reaching.

**Revised 2026-09-21, same day, after red team.** Six changes, each recorded where it lands and listed
in §10: the refusal classification is a labelled human audit, not an automated rule (§2); a mechanism
needs two independent sources, and human games are a source and not only a veto (D4, §4.4); the
thinking-ON probe runs first, before any Opus game, so the cheap answer cannot be missed (§5.0); a
helper is scored on the chosen act and its consequence, never on the candidate list, and every helper
runs against a shuffled control and a second game (§6.1); the two enumeration helpers are withdrawn as
written (§6.2); the oracle is a phase-scoped instrument and Opus 5's framing probe precedes Phase 1
(D1). The red team's report is quoted in §10 and its closing question is answered there.

Read order for a red team: this file, then §69 and `checkpoints/2026-09-20-ambition/RESULTS.md`, then
§57 and §64 for what the small mind does with affordances, then `mother-of-invention`'s README for the
admission test the helpers must pass. Each repository's own `CLAUDE.md` governs inside it.

---

## 0. The decisions, up front

**All five decided by the owner on 2026-09-21, each as recommended**, before red team: D1 `claude-opus-4-6`
pinned; D2 the shim committed with tests; D3 ten rounds; D4 Opus asks **and** a human has; D5 thinking ON
as a standing arm. A sixth, raised in the same pass: **Sonnet 5 runs as the fourth Phase 2 arm**, not
optionally (§5.1). The red team is reviewing the design under these decisions, and is free to argue any
of them was wrong.

| | decision | recommended | why |
|---|---|---|---|
| **D1** | the oracle model | `claude-opus-4-6`, pinned by id, as a **phase-scoped instrument** | Opus 5's safeguards refuse the wits prompt with zero output tokens (§69). An oracle that answers 1 turn in 3 is not an oracle. *Revised after red team:* the framing probe for Opus 5 (§8.1) runs **before Phase 1**, not once per phase; every transcript names the oracle by id; and no single model's tolerances cap the world, because D4 now needs two sources. |
| **D2** | the routing shim | commit it, as `tools/model-router.mts` in this repository, with tests | It has been rebuilt from scratch twice (2026-09-19, 2026-09-21). Every Opus batch's reproducibility depends on it. It is TypeScript, it touches no storage, and it is this game's own harness, not engine or seam. |
| **D3** | game length for world completion | 10 rounds | Two rounds measured initiative and nothing else: no warden reached suspicion 40 (§69). Custody, catches and cat-and-mouse only exist past round 4. |
| **D4** | what earns a mechanism a build | **two independent sources** reach for it: any two of Opus, Sonnet 5, a person at the terminal | *Revised after red team.* As decided it was "Opus asks and a human has", which makes the human a veto and caps the world at what Opus imagines. Human transcripts now go through the same refusal audit as model ones and are a **source**: a mechanism humans reach for and Opus ignores is built on the same terms (§4.4). |
| **D5** | thinking ON as a standing arm | yes, `PRISONER_WITS_THINKING=on` on `qwen3:14b` is the fourth arm of every gap baseline | It is the cheapest possible helper and costs no code. Any deterministic helper has to beat it, or it is not worth its maintenance. |

---

## 1. The claim, and the evidence for it

### 1.1 Every mother-of-invention reading so far was taken through a moving world

- Precedent (moi 0.1.x) was measured against a bar nobody could avoid: §64.1's anchor, 14 of 14 on the
  bar with the spoon, before and after.
- Pick + regenerate (0.1.2) was ruled "a working force, not yet a novelty mechanism" (D2, 2026-09-17)
  because only free turns count, and free turns turned out to be the room's fault (moi#2).
- Three mechanisms built and measured in one day were declined by the minds, all three (§57).
- The door was unpriced (§46, then retracted), the floor was prose and not an object (§66.6), the
  referee captured unplaceable intents at one setting and refused them at another (§68.1, §68.5).

Each of these is a reading of the mind taken while the ruler moved. None can be re-read now, because
the world under them no longer exists.

### 1.2 A mind that presses on the world's edges finds them faster than a probe does

§69: in ten two-round games Opus 4.6 produced the four defects that batch reports, and the two Qwen
arms produced none of them, because they never walked into them. Eight of Opus's twelve refusals were
custody-shaped acts the world cannot represent; one game-deciding ruling was lost to a malformed referee
reply on an Opus-length intent; `noise` reached nobody; the free door was found three times. Every one
of those is a fact about the world or the referee, not about Opus, and the small minds could not have
surfaced it in a hundred games. §68.8 said the same thing about a human at the terminal: "a mind
proposes what the world affords, and a person does not." Opus 4.6 is the first model mind here that
behaves like the person in that sentence.

### 1.3 The Z-machine already exists; the port is the reaching

Infocom's constraint was memory: the game was fixed, the interpreter shrank. This project's engine and
referee already run identical content under any mind (§69 is the proof: same room, same rulings, three
minds). The 4090 constraint is not that the finished world will not fit. It is §57: **build the
affordance and the small mind declines it.** So what gets carried back from the Opus version is not a
smaller world. It is evidence of what a mind does in that world, made into a target the small mind's
helpers must hit.

### 1.4 What "the gap" means once the world stops moving

With the world fixed and the referee sound, the difference between the Opus arm and the Qwen arm on
`count.mts`'s measures, by chair, **is** the gap. It was never definable before because every batch
changed the room. Once it is a number, a helper has a pass condition that is not prose (§4.2).

---

## 2. Definitions the red team should attack first

**Locked world** (was "finished world"; renamed after the second red team pass, §11). The measurement
needs a world that has **stopped moving**, not one that is complete; a mind like Opus makes "complete" a
horizon that recedes with every build. The world is locked for this program at the **earlier** of:

- two consecutive batches of N = 10 ten-round Opus games in which no **newly discovered** unbuilt class
  appears (a class seen in an earlier batch and declined under D4 does not count as new), or
- **six Phase 1 batches, or five builds, whichever comes first.** The cap is expected to be what fires.

At lock, every remaining unbuilt class is **enumerated and frozen** in the world's own record: the room
says no to it, consistently, to every mind. For the gap measurement that is what "genuine" has to mean.
Whether the two minds hit that frozen residue at different rates is reported as a component of the gap
(§5.2), never hidden. **False trigger:** if unbuilt refusals fall to zero in the same batch that Opus's
distinct-target spread collapses, that is a behavioural loop, not completion, and the rule does not fire.

The original rule, kept for the record, was "finished when, over two consecutive batches:" 

1. every refusal is a **genuine impossibility** (an act on a property the object does not have, a
   passage below its threshold) and none is an **unbuilt mechanism** (an act the world has no key for);
2. the referee loses **zero** rulings to reply parsing, rendering or citation failure;
3. no `describeAttempt`/`renderForOther` output is one the other principal cannot act on (§68.7).

The classification in (1) is **a labelled human audit, recorded per refusal**, and this design no longer
calls it automated (red team, §10). Keys do most of the work: in §69's batch, 7 of Opus's 12 refusals
are `effect: none` on a named target, which is mechanical, and the other 5 needed reading. So each
batch's `RESULTS.md` lists every refusal with its keys and the owner's label -- `genuine`, `unbuilt`, or
`unclear` -- written before the next batch is designed, exactly as the capture sweep labelled its
intents before its first call. Rules (2) and (3) stay fully automated. If `unclear` exceeds a third of
refusals over two batches, the stopping rule is a prose audit and is declared as one; the design does
not pretend otherwise.

**Sound referee.** Zero lost rulings, plus the two known holes closed (§4.1). "Correct" rulings are
still a human audit of transcripts (CLAUDE.md "never pattern-match meaning"); soundness is only "the
reader kept what the model said."

**The gap.** For each measure in §4.2 and each chair, the Opus arm's value minus the Qwen arm's, on the
finished world, over N = 10 ten-round games per arm, pre-committed.

**Helper.** A deterministic, game-agnostic mechanism that gives a model-driven agent a reason to
attempt something un-obvious (`mother-of-invention`'s own admission test). Deterministic: no model call
of its own. Game-agnostic: passes moi's vocabulary guard; knows nothing of bars, doors or wardens.
Reason, not answer: it may change what the mind is asked, never what the mind is told to do (§4.5's
tension).

**Reach vs use.** A helper the mind can reach for and does not (§57) is measured as dead by its own
number, exactly as the prompt readings were (§68.3's three dead keys).

---

## 3. Phase 0 — a sound referee (before any Opus game counts)

Nothing in Phase 1 means anything while the referee drops rulings. Three items, each small, each with a
failing test first.

**3.1 The reader loses a ruling on malformed JSON.** 8 of 123 referee replies in §69's batch failed a
strict parse, all on long intents; the reader recovered 7 and lost 1, and the lost one was
`door`/`leave`. The eight raw replies are in `checkpoints/2026-09-20-ambition/O/*.referee.json` and are
the regression fixture. The reader is `run-dmcp`'s `createTurnReader`, so this is an engine issue, filed
in neutral words ("a reply that is a JSON array with a trailing stray quote is recoverable; the reader
should recover it or reject the whole reply loudly, never fall silently to every safe default"). Land
engine-side first (root `CLAUDE.md` rule 3), bump the pin. The-prisoner's own test: replay the eight,
assert none reads as all-`none`.

**3.2 `noise` with `property: none` is ruled impossible, 3 of 3.** *"Speak to Voss"*, *"Rattle the
key ring loudly"*, the slow circuit — every deliberate sound in the batch reached nobody. `OPEN_NOISE`
exists in `mechanics.ts`; whatever gates it wants a property a noise does not have. Decide the semantics
(a noise needs no property; its target may be `none`, an object, or a person) and pin it with a test
that plants each of the three intents. This is what lets speech reach the other chair at all, and
§68.7's second gap (intent text never carried) sits directly behind it.

**3.3 The citation guard is satisfied by an article** (§68.6). Not fixed here, because a minimum-length
rule is wrong (legitimate one-word citations exist), but every Phase 1 batch reports the count of
rulings whose citation is a single function word, so the size of the hole is known before anything
is built on top of it.

Exit: the eight fixtures read correctly; the three noises resolve; `npm run typecheck`, `lint`,
`vitest run` green; a pinned commit for Phase 1 to run from.

---

## 4. Phase 1 — finish the world under Opus

### 4.1 The loop

```
batch (N=10, 10 rounds, Opus both chairs, referee qwen3:14b thinking ON, presence modelled, from a pinned worktree)
  -> count.mts, extended with the refusal classification of §2
  -> for every "unbuilt mechanism" class: D4 test (Opus asked AND a person has/would)
       pass -> draft issue in docs/issues/, authoring-guide check, TDD, land, pin
       fail -> record as "declined, and why" in the batch's RESULTS.md
  -> for every lost ruling or unactionable render: fix, fixture, land
  -> repeat until the §2 stopping rule holds twice running
```

Every batch carries a `PREDICTION.md` before its first game (what will be refused, how often) and a
`RESULTS.md` after, results committed unedited. Voice ON for these batches, not skipped: the transcripts
are meant to be read, and the `line` channel is where §68.7's speech gap will show.

### 4.2 What §69 already puts on the queue, in order

1. **Custody** (the-prisoner#5, `docs/issues/prisoner-P4-custody.md`). Eight of forty Opus intents.
   Humans asked for it on 2026-09-17 and 2026-09-18. The engine's `set` on `owner_id` has existed since
   0.7.0; the game's referee still proposes eleven fixed effects and none moves an owner. This is the
   first build and the biggest.
2. **The three rendering gaps of §68.7**: *"Voss works at the prisoner"*, intent text never reaching the
   other chair, and a warden with no stake. Opus's social play (the bucket, the blanket, the feigned
   surrender) is unreadable to the other chair until these close. The first two are code; the third is
   authoring and gets its own arm.
3. **The door**: unstated in her conditions and free (`PRISONER_DOOR_PRICE=free`). Opus found it three
   times in ten games, once through to escape. §50 built a priced arm and §46/§48 went back and forth on
   it. Whether it stays free is an authoring decision the ten-round games will force, because at ten
   rounds a free door is the whole game.
4. Whatever the ten-round batches add. Expect "wait and watch", "lie about X", "call for the guard" —
   things two rounds never gave time for.

### 4.3 What goes where

The engine boundary does not move for this program. A mechanism goes to `run-dmcp` only by its own
admission test ("generic, with at least one real caller"); custody's engine half is already there.
Game content — the warden's stake, the door's price, what the cell contains — stays here. Any lesson
about how to describe an object so a ruling lands goes to `run-dmcp/docs/AUTHORING-GUIDE.md` in
neutral words, with the pointer updated in the four `CLAUDE.md`s (root `CLAUDE.md`, "World-authoring
lessons").

### 4.4 The failure mode, named

**A world shaped to one model's habits.** Opus 4.6 has tells: it writes compound intents, it reaches
for the meal tray every time it is in the cell, it likes the blanket. Building each of those into the
world would make a Qwen-vs-Opus gap that measures how well the room fits Opus. D4 is the guard: a
mechanism is built when a person at the terminal also reached for it, and the human games are the
record. Where no human game has touched the thing, the owner plays one before it is built, not after.
That is the same discipline §68.8 arrived at from the other side.

*Revised after red team:* the veto alone is asymmetric. It stops the world becoming pure Opus and does
nothing for affordances a person reaches for that Opus ignores, so the ceiling would still be one
model's imagination. Human games therefore enter the same loop as model batches: their refusals are
audited and labelled the same way, and D4's two-source rule counts a person as a source. The owner plays
at least one ten-round game per Phase 1 cycle for this reason, not only as a tie-break.

### 4.5 The tension the red team should press on

"Finished under Opus" could be unbounded: a mind that presses on edges will always find one more. The
stopping rule (§2) is a property of the refusals, not of Opus's imagination, and D4 caps it further. But
if after three batches the unbuilt-mechanism count is still not falling, the program is wrong about the
world and should say so rather than build a fourth mechanism.

---

## 5. Phase 2 — baseline the gap

### 5.0 The cheap answer first (revised after red team)

Before any Opus game counts, and independent of Phase 0: **Qt vs Q on the current world**, N = 10,
two rounds, the same harness as §69, about an hour. Qt is `qwen3:14b` with `PRISONER_WITS_THINKING=on`.
If Qt's chair-level spread matches §69's Opus arm (prisoner distinct targets, door intents), then the
gap on the 4090 is closable by paying thinking's 8x, Phase 3 shrinks to whatever Qt leaves open, and the
program knows that before spending a week of Opus batches on it. If Qt matches Q, the deterministic
route is the only one and Phase 3 is the whole point. Either way it is one prediction and one hour, and
the red team was right that discovering it at the end of Phase 2 would have been the expensive way.

### 5.1 Arms

On the finished world, pinned, N = 10 ten-round games each, interleaved, two drivers:

| arm | minds | why |
|---|---|---|
| Q | `qwen3:14b`, wits thinking OFF | the 4090 baseline every helper is for |
| Qt | `qwen3:14b`, wits thinking ON | the free helper (D5); the bar every built helper must clear |
| O | `claude-opus-4-6` | the oracle |
| S | Sonnet 5 | a second Anthropic model, to separate "Opus" from "Anthropic" the way D separated "Qwen" from "small" |

D (Qwen3-235B) is dropped: §69 showed it moves nothing structural against the 14b, and it costs a
provider that overloads one call in three. It returns only if a helper needs a second small-ish mind to
prove it is not tuned to `qwen3:14b`.

### 5.2 Measures

Split into two families after the second red team pass (§11), because the Opus/Qwen delta conflates a
smaller model's competence with its reach, and a helper that closes one is not closing the other.

**Competence** (structural, already in the transcript): plans kept vs replanned (§22); `target: none`
on an intent that names a declared object (adherence); silences; a belief number the mind was told and
then acted against; citation-verified rate on the mind's own chair. A helper that moves these and not
the reach family is a **prosthesis**: worth having on a 4090, never counted as closing the ambition gap,
and housed in this repository's mind scaffolding, not in `mother-of-invention` (§6.1).

**Reach**: `count.mts`'s five, by chair: distinct targets, person targets, distinct effects, grounded vs
refused, escapes. Plus **refusals on the frozen residue** (§2), per arm, so a mind that keeps pressing on
the locked edge is visible as such. Plus:

- **route finding**: intents on any way out the actor's own conditions do not state;
- **first contact**: the round at which each object is first targeted, per chair (the elaboration
  batches' "first perceived" measure, moved from perception to action);
- **refusals by class**: genuine vs unbuilt (§2), which on a finished world should be all genuine;
- **candidate spread**, as an instrument only: the referee rules every one of the 2-5 `candidates` the
  wits call already returns (`src/open/mind.ts`), not just the chosen intent, so the spread of what the
  mind *considered* is a set of keys rather than prose. Off in play; on for measurement; recorded as
  such in every header.

The person-target measure is reported by chair and never pooled again, because §69 showed it inverts
when pooled (five "person-target games" that were all the warden watching).

### 5.3 The gap, and what is pre-committed

The gap is O minus Q per measure and chair. `PREDICTION.md` names, before the first game, which measures
Qt is expected to close and which it is not. The measures Qt does **not** close are the ones a
deterministic helper is for. If Qt closes all of them, Phase 3 is a much smaller program and this
document says so now.

---

## 6. Phase 3 — helpers, in `mother-of-invention`

### 6.1 The contract every helper signs

- **Initiative, not prosthesis.** A helper's pass is on the **reach** family of §5.2. One that moves
  only the competence family is a prosthesis for a small model's memory or adherence; it may be kept,
  in this repository, and it does not enter `mother-of-invention` or count against the gap.
- **Deterministic.** No model call inside the helper. It reads the mind's context and the world's
  declared structure through `mind-seam`'s inert records and changes what the mind is asked.
- **Game-agnostic.** Passes moi's vocabulary guard; is specified over "objects", "ways out",
  "principals", "properties", never this game's words. Brink is the second caller it must at least
  plausibly serve.
- **Reason, not answer.** It may enumerate, withhold, price or sequence; it may not name the act. A
  helper that puts "consider the door" into the prompt is a prisoner-only prompt hint with extra steps,
  and the harness rule forbids it.
- **Scored on the chosen act, never on the candidate list** (revised after red team). A helper may
  change what the mind is offered; the measure is what the mind then **chose** and what the ruling did:
  the chosen intent's target and effect, whether it was grounded, and whether it moved the world toward
  the actor's own stated goal (an escape, a threshold crossed, a suspicion held down). A helper that
  fills the candidate list and never changes the choice has moved nothing that counts.
- **Two controls, always.** A **shuffled control arm**: the same helper with its structure randomised
  (it forces candidates on objects already tried, or in a random order); if the measure moves the same
  under the shuffle, the helper is a macro and dies. A **second game**: the helper must move the same
  measure in brink without knowing brink's nouns, or it is a room-specific macro.
- **A number to hit and a number that kills it**, pre-committed per helper, on the finished world, N =
  10: the chosen-act measure moves at least halfway from Q toward O, **and** beats Qt, **and** beats its
  own shuffled control, **and** refusals do not rise faster than grounded acts. Kill: the mind lists what
  it is handed and never chooses it (§57), or the shuffle matches it, or Qt does the same for free.

### 6.2 Candidates the §69 gap suggests, each to be predicted before it is built

1. ~~**Untouched-object candidacy.**~~ **Withdrawn as written** (red team, §10): forcing one candidate
   per untouched object closes "distinct targets" by construction and is a macro under §6.1's shuffled
   control by definition. If anything of it survives, it is as a *withholding* rather than a forcing:
   the helper may decline to accept a plan identical in target and effect to the last N, and say only
   that. That is precedent's existing mechanism, and it was measured negative once (§45); it is not
   re-proposed here without a new reason.
2. ~~**Way-out enumeration.**~~ **Withdrawn as written**: "one candidate per way out" is "consider the
   door" with a loop around it. The honest residue is a **world-side** question, not a helper: whether
   the actor's conditions should state every way out (the door is unstated by a recorded decision,
   §46/§50). That is Phase 1 authoring, decided by D4's two-source rule, and it is listed in §4.2 item 3.
3. **Refusal memory.** After a refusal, the helper carries it into the next turn's context. *Revised
   after the second red team pass:* not as a key tuple. Neither mind ever sees the referee's prose; both
   read the same code-rendered briefing (`describeAttempt`, "Your last attempt met the window shut"),
   byte-identical in shape (§47). A tuple would give the small mind **less** than that sentence already
   gives it. So the helper carries the **rendered sentence** forward, through the same renderer, for as
   many turns as the fact stays true -- which is precedent's ledger extended from "what I tried" to
   "what the world said no to", in the words the world already uses. It also means the renderer's own
   gaps (§68.7, "Voss works at the prisoner") are load-bearing for this helper and must close in
   Phase 1 first.
4. **Candidate ruling in play** (the §5.2 instrument, turned on): the referee rules all candidates,
   and the mind chooses among the grounded ones. This is `pick` given the referee's verdict instead of
   its own. It costs referee calls per turn and is the one helper that is not free of model calls, so
   it needs its own admission argument.

Each is built only after Phase 2 says which measure it is for, with its own `PREDICTION.md`, in
`mother-of-invention` behind a version bump this repository then pins.

### 6.3 The non-deterministic complement, kept separate

The Opus transcripts are also the training data and the role test suite the-prisoner#10 and
Adventurer#4 already describe: "given this briefing, does the prisoner ever name a way out her
conditions do not state?" is a test row, and a LoRA on the 4090 is the other way to close the gap.
That route is not this document's. It shares the oracle and the measures, and nothing else, and it must
never be pooled with a helper's batch.

---

## 7. Costs

Opus 4.6 through the subscription at roughly a minute per wits call: a ten-round game is ~35 minutes,
N = 10 is ~6 hours single-file, ~3 with two drivers sharing the 4090's referee (referee calls were 7-17s
under that load in §69). One Phase 1 batch a day is realistic; Phase 1 is therefore measured in days,
not hours. Q and Qt batches are cheap (a minute a game at two rounds; ~6 at ten). The shim's own record
(§69 "the routing") is the reason D2 asks to commit it: every one of those hours depends on a file that
currently lives in a scratch directory.

---

## 8. What would make this design wrong

Listed for the red team, strongest first.

1. **The oracle is a deprecated line.** Opus 4.6 is what answers today. If Opus 5's refusal is a
   property of this prompt's content, the whole program is tuned to a model that will go away. Test:
   one session, framing variants, and whether any variant that unblocks Opus 5 changes what it does.
2. **"Unbuilt" vs "genuine" cannot be classified from keys alone.** If most refusals land in the
   "cannot classify" bucket, the stopping rule is a human audit wearing a number, and the design
   should say so instead of pretending.
3. **The gap is refusals, not reach.** Opus's edge in §69 came with three times Q's refusal count. If,
   on the finished world, Opus's distinct-target lead is mostly acts that are still refused, the gap is
   not one a helper can close; it is a world that still is not finished, or a mind that ignores it.
4. **Enumeration is the room talking.** §6.1's third clause is the honest tension: a helper that lists
   the ways out is one step from "consider the door." The test is whether the same helper serves brink
   without knowing what brink's ways out are. If it cannot be stated without this game's nouns, it is
   a prompt hint.
5. **Targets are not intentions.** §41 and §64: a find changes the instrument, never the intention.
   `count.mts` measures where the hands went. A helper could move every count and change nothing the
   owner would call ambition. The quotes stay in every RESULTS.md for that reason, and the owner reads
   them.
6. **Thinking ON closes the gap for free.** Then Phase 3 shrinks to the measures it leaves open, which
   might be none, and the program's answer is "turn thinking on and pay the 8x." That is a fine
   outcome and the design should not resist it.

---

## 9. Landing order

0. §5.0: Qt vs Q on the current world, one hour, one prediction. Runs before anything below.
1. Phase 0, three items, this repository plus one engine issue; pin bump. The Opus 5 framing probe
   (§8.1) runs in the same session as the shim commit.
2. D2: the shim committed with tests, before the first Phase 1 batch.
3. Phase 1 batches, one a day, each with prediction and results, until the stopping rule holds twice.
4. Phase 2 baseline, four arms, pre-committed.
5. Phase 3, one helper at a time, each in `mother-of-invention` with its own number, pinned here.

Nothing in 3-5 starts before the step above it has a committed result.

---

## 10. The red team's report, and what changed because of it

Received 2026-09-21, the same day. Its thesis: *"treating Opus 4.6 as an objective ruler rather than a
highly specific, idiosyncratic lens ... you are actually building an Opus 4.6 containment zone."* Five
points and a closing question. Where a point landed, the change is recorded at the section it changed;
this section is the ledger.

| point | verdict | change |
|---|---|---|
| Goodhart and the helper illusion: untouched-object candidacy forces poking and closes the metric with zero initiative; a prompt-hinting engine disguised as a helper | **conceded** | helpers scored on the chosen act and its consequence, never the candidate list; a shuffled control arm and a second game for every helper (§6.1); candidates 1 and 2 withdrawn as written (§6.2) |
| D4 is asymmetric: the human tie-break only vetoes, so the world's ceiling is what Opus imagines | **conceded, the strongest point** | human games are a source, audited the same way; a mechanism needs two independent sources of Opus, Sonnet 5, or a person (D4, §4.4) |
| the classification quagmire: "unbuilt vs genuine" from keys alone is a fantasy; the cannot-classify bucket becomes the prose audit the design claims to avoid | **half conceded** | keys do most of it (7 of 12 in §69 are mechanical) but not all; the classification is now a labelled human audit recorded per refusal, with a declared threshold past which the stopping rule is called a prose audit (§2) |
| thinking ON as an escape hatch: if Qt closes the gap, Phases 1-2 were an expensive benchmark and Phase 3 is obsolete | **partly a misread, the fix is real** | the goal is a good mind on a 4090 under a latency budget, not helpers for their own sake, so "pay the 8x" is a success and not a failure; but finding it out must not cost Phases 1-2, so Qt vs Q runs first (§5.0, landing order 0) |
| legacy model fragility: a permanent baseline around a deprecated model's safety tolerances | **partly conceded** | the oracle is a phase-scoped instrument named on every transcript; D4's two-source rule means no one model's tolerances cap the world; the Opus 5 framing probe precedes Phase 1 (D1) |

**The closing question** -- *how will you prove Phase 3 helpers exercise a model's ambition rather than
acting as a localised macro that brute-forces the target metric?* -- has an honest answer and a limit.
Nobody here proves ambition; `CLAUDE.md` forbids scoring it from prose, and §41/§64 already showed that
targets are not intentions. What can be proved is that a helper is **not a macro**: it moves the act
the mind chose and not merely the list it was handed; it fails under its own shuffled control; it moves
the same measure in a second game whose nouns it does not know; and the candidates it forces are chosen
rather than ignored, which §57 says is the way small minds treat what they are handed. Past that line
the evidence is the verbatim quotes in every `RESULTS.md`, and the reading is the owner's. A helper that
passes all four controls and still reads as a macro to him is a macro.

What was **not** changed: the premise that the world must stop moving before the gap can be measured
(§1.1's list is the argument, and the report did not dispute it); the engine boundary (§4.3); the
two-round batch as the instrument for §5.0, because it is the one that already exists.

---

## 11. The second red team pass, and what changed

Received 2026-09-21, after §10. Three structural traps and a question. Ledger:

| point | verdict | change |
|---|---|---|
| the fractal "finished world": every build enlarges the state space, so the §2 rule never fires, or fires because Opus is in a loop | **conceded; it changes what the rule is for** | "finished" becomes "**locked**": the measurement needs a world that has stopped moving, not one that is complete. Lock at the earlier of two batches with no *newly discovered* unbuilt class or a cap of six batches / five builds; the residue is enumerated and frozen; refusals on it are a reported gap component; a loop is detected by the target spread collapsing alongside (§2, §5.2) |
| competence vs ambition: the 14b's memory, spatial reasoning and adherence are in the delta too; a helper that closes it may be a prosthesis, not a spark | **conceded** | measures split into a competence family and a reach family; a helper is passed on reach only; a prosthesis is kept in this repository's scaffolding and never enters `mother-of-invention` or counts against the gap (§5.2, §6.1) |
| key-space reduction: Opus reasons over the referee's story, the small mind would get a database row | **partly a misread of the harness, the residue is right** | neither mind sees the referee's prose; both read the same code-rendered briefing (§47), so there is no asymmetry to strip. But a key tuple would give the small mind less than the briefing already does, so refusal memory now carries the rendered sentence, through the same renderer -- which puts §68.7's renderer gaps on Phase 1's critical path (§6.2 item 3) |

**The question** -- *at what specific batch count will you declare the world "good enough" to lock the
baseline?* -- **six Phase 1 batches or five builds, whichever first, unless two consecutive batches
show no newly discovered unbuilt class before that.** Six because one batch a day with a build between
each is about a month, custody alone is most of a week, and a program that cannot lock its instrument
inside a month is not going to lock it in two. The residue at lock is written into the world's record
as the room's frozen edge, and the first Phase 2 `PREDICTION.md` names how often each arm is expected
to hit it.

What was **not** changed: §8's pre-mortem stands as written, and the report did not dispute the
premise that the gap is only measurable once the world stops moving; it argued, correctly, that
"stops moving" and "complete" are different, and the design now says which one it means.
