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
| **D1** | the oracle model | `claude-opus-4-6`, pinned by id, until Opus 5 answers the prompt | Opus 5's safeguards refuse the wits prompt with zero output tokens (§69). An oracle that answers 1 turn in 3 is not an oracle. Re-probe Opus 5 once per phase, never mid-batch. |
| **D2** | the routing shim | commit it, as `tools/model-router.mts` in this repository, with tests | It has been rebuilt from scratch twice (2026-09-19, 2026-09-21). Every Opus batch's reproducibility depends on it. It is TypeScript, it touches no storage, and it is this game's own harness, not engine or seam. |
| **D3** | game length for world completion | 10 rounds | Two rounds measured initiative and nothing else: no warden reached suspicion 40 (§69). Custody, catches and cat-and-mouse only exist past round 4. |
| **D4** | what earns a mechanism a build | Opus asks for it **and** a person at the terminal has asked for it, or would obviously | Guard against §4.4's failure mode: a world shaped to Opus 4.6's habits. The human games (§48, §58, §68.8) are the tie-break and already exist. |
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

**Finished world.** A stopping rule, not a feeling. The world is finished for this program when, over
two consecutive batches of N = 10 ten-round Opus games:

1. every refusal is a **genuine impossibility** (an act on a property the object does not have, a
   passage below its threshold) and none is an **unbuilt mechanism** (an act the world has no key for);
2. the referee loses **zero** rulings to reply parsing, rendering or citation failure;
3. no `describeAttempt`/`renderForOther` output is one the other principal cannot act on (§68.7).

The classification in (1) is structural: a refusal is "unbuilt" when the ruling's `effect` is `none` on
a target the intent plainly acts on, or when target and effect are legal keys and the mechanic has no
leg for the pair. It is applied to ruling keys, never to prose. Where a refusal cannot be classified
from keys alone, it is listed for the owner and not counted either way.

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

### 4.5 The tension the red team should press on

"Finished under Opus" could be unbounded: a mind that presses on edges will always find one more. The
stopping rule (§2) is a property of the refusals, not of Opus's imagination, and D4 caps it further. But
if after three batches the unbuilt-mechanism count is still not falling, the program is wrong about the
world and should say so rather than build a fourth mechanism.

---

## 5. Phase 2 — baseline the gap

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

`count.mts`'s five, by chair: distinct targets, person targets, distinct effects, grounded vs refused,
escapes. Plus:

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

- **Deterministic.** No model call inside the helper. It reads the mind's context and the world's
  declared structure through `mind-seam`'s inert records and changes what the mind is asked.
- **Game-agnostic.** Passes moi's vocabulary guard; is specified over "objects", "ways out",
  "principals", "properties", never this game's words. Brink is the second caller it must at least
  plausibly serve.
- **Reason, not answer.** It may enumerate, withhold, price or sequence; it may not name the act. A
  helper that puts "consider the door" into the prompt is a prisoner-only prompt hint with extra steps,
  and the harness rule forbids it.
- **A number to hit and a number that kills it**, pre-committed per helper, on the finished world, N =
  10: the named measure moves at least halfway from Q toward O, **and** beats Qt, **and** refusals do
  not rise faster than targets. Kill: the mind declines it (§57), or Qt does the same for free.

### 6.2 Candidates the §69 gap suggests, each to be predicted before it is built

1. **Untouched-object candidacy.** Every N turns, the wits call is required to include one candidate
   per object the actor has perceived and never targeted (the world knows both; `first contact` in
   §5.2 measures it). Generic: any world with objects. The un-obvious thing is the one you have not
   touched. This is `pick` with a different ledger.
2. **Way-out enumeration.** The world declares which objects carry a passage property; the helper
   requires one candidate per way out, stated or not, priced by the actor's own conditions where a
   price exists. Generic to any scenario with more than one exit. This is the door, found
   deterministically — and it is the candidate most likely to fail §6.1's third clause, which is why
   it is listed and not assumed.
3. **Refusal memory.** After a refusal, the helper carries the ruling's keys (not its prose) into the
   next turn's context as a closed fact: "wear on X: not possible." The mind is then reasoning over a
   smaller space. Generic; it is precedent's ledger extended from "what I tried" to "what the world
   said no to."
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

1. Phase 0, three items, this repository plus one engine issue; pin bump.
2. D2: the shim committed with tests, before the first Phase 1 batch.
3. Phase 1 batches, one a day, each with prediction and results, until the stopping rule holds twice.
4. Phase 2 baseline, four arms, pre-committed.
5. Phase 3, one helper at a time, each in `mother-of-invention` with its own number, pinned here.

Nothing in 3-5 starts before the step above it has a committed result.
