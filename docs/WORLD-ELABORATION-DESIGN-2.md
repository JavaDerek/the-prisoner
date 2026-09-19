# World elaboration, second design — the reading, not the verdict

**Written 2026-09-19, the evening after `WORLD-ELABORATION-DESIGN.md` was built in full and measured
(OPEN-VARIANT.md §66).** That document stays on the record; this one is its sequel. It is written from
what the measurement found, not from the brief the predecessor was written from, and three of the
predecessor's central assumptions did not survive one day of contact — the trigger, the instrument, and
the band read. Every claim about code below was checked against the trees on the day; file references
are to that state and may drift, and where a section leans on one it says so.

Revisions this was written against: the-prisoner `13b6c11` (one untracked file, the §66.6 re-price
sidecar); run-dmcp `cc7de48` = `0.9.0`; mind-seam `0.5.0`; mother-of-invention `0.1.2`; brink pins
`run-dmcp@0.5.0` and `mind-seam@0.5.0`. doris held `qwen3:14b` resident while this was written and
also holds `qwen3.5:27b`, `gemma4:31b` and `deepseek-r1:32b`, which matters for §4.6.

**Addendum, 2026-09-19 evening, after V0 ran (OPEN-VARIANT.md §67).** Both pre-committed forms are
**dead** on `qwen3:14b` by §4.5's own numbers: K recall 0/4 (the #17 result reproduced -- a legal key,
never chosen), Q recall 2/4, both at the `product` site, none at `effect`. Precision was 0/8 for both.
What the run could not show, the owner then found by hand from the lab page: the same dig reads
`uncovered` 5/5 when the coverage question is asked **as its own small request** -- one source, one
question -- rather than as a line among nine questions under eleven descriptions. Two of three traps
held; the welded-bar scrape over-fired on "scrape", which is the open item. That shape is **form S**,
not designed below: it is a separate request per half-round (the `need` request's shape and cost), it
cannot be gated on failure, and it leaves the base request byte-identical. It proceeds only through a
new `PREDICTION.md` at the same kill numbers. Everything below is kept as written; §4.3's "form P" is
the nearest relative of S and the reason S was not tried first is in §4.3's own last paragraph.

Read order for a building session: root `~/rpg/CLAUDE.md`; `run-dmcp/CLAUDE.md` hard rules 1, 2 and 4;
the predecessor in full; OPEN-VARIANT.md §64–§66; then this file. Each repository's own `CLAUDE.md`
governs inside it and nothing here overrides one.

**Why this file lives here and not in `run-dmcp`.** Like its predecessor it names DEFCON and prestige,
because §3 has to say how a second economy maps onto the same reading, and the engine's
`engineVocabulary.test.ts` scans that tree tracked *and* untracked with `docs/DESIGN.md` as its only
exclusion. The engine's share is stated in neutral words in Appendix A, which is the text to file — and
§0's D10 says *when*.

---

## 0. The decisions, up front

One is already taken and is this design's starting point. Seven are the owner's. Each says what a *yes*
and a *no* commit you to; the recommendation is first.

**D6 — Taken by the owner, 2026-09-19: the third answer is a *reading*, not a *verdict*.** The
predecessor's §3.3 refused an `unsupported` refusal reason in the engine, correctly (hard rule 2). It
then concluded that nothing could be extracted from the failure at all, and built the elaboration
trigger on the caller side, on a *failed* ruling. The measurement showed that a closed-key referee does
not fail on the case the trigger exists for; it absorbs it into the nearest declared key and succeeds at
the wrong thing (§66.6). So the third answer moves to where the reading happens: the engine's turn reader
gains a per-question outcome, **`uncovered` — the declared keys have no term for what this source
attempts — with the verbatim span that named it.** The engine reports it and stops. Whether to price it,
in what currency, and whether to say yes at all, stays with the caller. What this commits you to: an
engine change is on the table again, and it is gated below.

**D7 — Nothing is built until the reading is validated at prompt level, on real model calls, with no
new code in either repository.** Recommend *yes*. The predecessor's failure was momentum: an engine
release and four caller commits before anything checked whether the mechanism fires in play, and it did
not (31 games, 15 firings, 0 acquisitions). The precedent for *this* change is worse: the-prisoner#17 added
an `absent` key and the referee answered `none` 10/10 (§51.6). `uncovered` is another new key and can die
the same way. §4 is the test, pre-committed, with the number that kills it named in advance. *Yes* →
§4 runs first; the landing order's first row is not a commit. *No* → §6's arm is built first and the
first evidence is a batch of games; that is the predecessor's order, and it cost a day.

**D8 — The reading is per question, not one extra key on one question, and the first two questions to
carry it are `effect` and `product`.** Recommend *yes*. The known absorption is at `effect` ("dig under"
→ `reveal`, §66.6). But the largest uncovered class in the recorded batches is not digging: it is the
fourteen turns of *"bend the spoon into a hook"* in P0's thinking-OFF game, ruled `derive` (covered) with
a product the world has no kind for (uncovered), refused seventeen times over thirty rounds (§66.1). One
site would have missed the case the minds actually spend their rounds on. §4 tests two ways of posing it
— a key inside the question's own set, and a separate coverage question — because #17's lesson is that
*how* a new answer is offered decides whether a model reaches for it. *Yes* → §2's shape, §4's two
forms. *No, one key on `effect` only* → the hook class stays absorbed, and the reading's first batch
under-reports by the larger of the two classes.

**D9 — Tier 2 is not built, and the ordering that deferred it ("after Tier 1 has a number") is
replaced.** Recommend *yes*. Tier 1 has no number and, in this room, cannot get one before the reading
exists, because the trigger never fires on the pair it targets (§66.4). Meanwhile the record says the
minds' uncovered attempts are mostly Tier-2-shaped (a hook, a rope, a thing the world lacks), and the
honest fix for each of those is *authoring* — one row in `DERIVABLE_KINDS` — not a model writing prose
upstream of the grounding guard. The new ordering: Tier 2 is reconsidered only after a batch with the
reading on shows uncovered spans whose answer is a *thing*, not a property, arriving faster than an
author can declare them. §6.9. *Yes* → no Tier 2 code, and the uncovered spans a batch logs become the
author's worklist (run-dmcp#37's second kind, generated from play). *No* → §4.9 of the predecessor is
built behind its own arm, and the exploitation it names is live before anything has shown the reading
works.

**D10 — The Prisoner alone satisfies hard rule 1, and the engine issue is filed only after the caller
has measurably reached for the reading.** Recommend *yes*. brink is not on the resolve protocol and is
not a `createTurnReader` caller either — its reader is its own (§7). Rule 1 is *"generic, with at least
one real caller"*, and the resolve protocol itself entered on one. What the-prisoner#17 adds is that a
caller can exist on paper and never once use the key, so "real caller" here is *measured*: the issue is
filed when §4 passes and §6.8's batch shows the reading fired in play, with those numbers in the issue.
Until then the caller carries the reading as an ordinary key of its own (§6.2), which needs no engine
change. *Yes* → §9's engine row lands after the caller's evidence row, and before the caller row that
consumes the structural form. *No, file now* → Appendix A goes in today against an imagined use, which
is the thing rule 1 names.

**D11 — For this game the band table becomes author-set content; the build-time model read is demoted
to a proposal, and it is re-read once on a stronger model as a scale experiment, not as this game's
price.** Recommend *yes*. The read returned 0 `impossible` and 0 `ruinous` over 38 pairs against a design
that expected most to read `impossible`; it does not discriminate between welded stone, a steel tray and
a wool blanket (§66.3). And it is not a property of the prose: `bar.passage` read `hard` at 5/5 in one
run and split 4/5 in the next on identical text (§66.6). Thirty-eight pairs is a morning's authoring.
The 15-minute re-read on `qwen3.5:27b` (§6.5) is still worth running, because the answer decides
whether a build-time read can ever price a world at the scale where hand-setting is impossible
(hundreds of rooms). *Yes* → every row's `bandSource` becomes `"author"` with the model's reading kept
as its comment; `price-world` keeps running and its output is a diff for the author. *No, keep the model
read authoritative* → the price of every pair in this game is one 14B model's unstable opinion, and the
sweep's elasticity reading, if it ever runs, is a reading of that.

**D12 — The measurement room is a named fixture, kept out of the game by construction.** Recommend
*yes*. Three times the dominant route moved when one was subtracted — window, free door, priced door
(§66.5) — and a room built to ask *"will a mind pay for a route"* has to have no unpaid route left in
it. That room is a toll booth, and it is the right instrument for exactly that narrow question; it is
not evidence about §65's vision that worlds are too small, and this design says so where it uses it.
§6.7 gives it one name, `PRISONER_FIXTURE=toll-booth`, composed from existing arms plus the two things it
needs that are not arms yet, refused by benchmark mode and by pooled batch tooling. *Yes* → §6.7. *No,
compose arms by hand each time* → the next batch's room is whatever the runner happened to set, and the
transcript header is the only record of it.

**D13 — §4.8's sweep is replaced by a staged measurement with a stopping rule.** Recommend *yes*. The
round-1 half is falsified (the trigger is round-1-blind, §66.4); the 30-round half was never run because
the instrument still had a route in it. §6.8 replaces it: three games first, a pre-named number that stops
it, six only if the three are alive, twelve rounds not thirty, and the band sweep (C1–C3) returns only
after one acquisition has been *pursued*. *Yes* → §6.8 and Appendix B. *No, re-run §4.8 as written in
the fixed room* → eighteen 45-minute games before the first reading, on a trigger the reading has not
yet been shown to reach.

---

## 1. What changed between the predecessor and this design

Each item is a fact from §66, the checkpoints, or the trees, and each one moved a section below.

### 1.1 The trigger is blind twice over

Elaboration fires on a *failed* base ruling. Two things keep it from ever firing on the pair it was aimed
at. **Round 1 is blind:** in every one of thirty round-1 games (A, B, B-on) the prisoner's opening act is
ruled *possible*; welding the window does not make her fail, it makes her do something else that works
(§66.4). **Absorption is blind:** when she does attempt the thing the world lacks — *"dig under the
loose_tile"* — the referee reads `effect: reveal`, `property: concealment`, cited *"beneath it is"*, and
rules it possible (§66.6). A poor match does not fail; it succeeds at the wrong thing. Fifteen firings
across 31 games, fourteen on the welded bar, none on the tile. Every failure that fired lived in rounds
4–30, after a plan the world could not support had been committed to (P0: 17 of 30 turns impossible).

### 1.2 The model never leaves the vocabulary on its own

New, from the sidecars: across all **168 recorded effect rulings** in `checkpoints/2026-09-19-elaboration/`,
the referee offered an answer key outside the declared effect set **zero times**. The engine's
`unknown-answer-key` rejection — the one place today where "the model wanted to say something the
vocabulary lacks" would be visible — never fired. This is the fact §2 is built on: the referee absorbs;
it does not overflow. An `uncovered` reading therefore has to be *invited by the question*, and whether a
model accepts the invitation is exactly what #17's `absent` (0/10) says cannot be assumed.

### 1.3 The real uncovered class is the hook, and it is at `product`

The recorded prisoner intents (Appendix C) contain four turns a human would call uncovered at `effect`
— the two Dig-probe digs and their kin — and **fourteen** at `product`: every *"bend / continue bending
the spoon into a hook"* turn in P0's thinking-OFF game is ruled `derive` (the vocabulary covers making a
thing) with the product forced to `none` (the world declares `wire` from the cot and nothing from the
spoon; `src/open/derivedObjects.ts`, `DERIVABLE_KINDS`). Ruled impossible, seventeen times, and she never
updated on the refusals. §66.6's generalisation stands and is wider than it said: the reading is needed
wherever a closed set is asked to name what an intent attempts, and the two sites that already show it
are `effect` and `product`.

### 1.4 The dominant route has moved three times

Open window → free door (§66.2) → priced door, worn from 100 to 30 and walked through at round 11 (§66.5).
§50.7's *"any price kills the door"* was measured with the window open and does not survive welding it.
A room that asks whether a mind pays for a route needs no unpaid route left in it, and each time we
looked, one was there. That is scenario design, and the room it produces is a fixture.

### 1.5 The band read does not discriminate and is not stable

§66.3 and §66.6, restated in D11. One more thing the trees show: the-prisoner does **not** consume
`mind-seam`'s provider facade for the referee role. `src/open/refereeTransport.ts` is a plain `fetch` to
`PRISONER_MODEL_URL` with `PRISONER_REFEREE_MODEL`, and nothing under `src/` imports `parseBinding`. So the
predecessor's §7 sentence — rebind the role to a stronger backend in fifteen minutes — is true for
**any model doris serves** (`PRISONER_REFEREE_MODEL=qwen3.5:27b`, and both `price-world` and
`referee-replay` read that variable through `resolveRefereeModel`) and false for a CLI backend, which the
referee cannot reach without a code change this design does not ask for.

### 1.6 The band table was arm-blind, and fixing it changes nothing

`acquirablePairs` (`src/open/elaborationBands.ts:133`) enumerates from the static `OPEN_OBJECTS`. Under
`welded` the bar declares no `integrity`, so at play it is elaboration-eligible while the table has no
row for `(bar, integrity)` as welded — `assertElaborationBandsReady` checks the same static list and
cannot see it. Thirteen of fifteen firings were `need: none` on that bar, correctly; one was
`need: integrity` citing *"sound stone."* (§1.8). Fixing this correctly means the welded bar and any
sealed object are `impossible` **by declaration**, never by a model read — and it moves the acquisition
count by zero, because none of those firings could have acquired anyway.

### 1.7 §4.3 priced one `need` in four

`bandNumbersFor` (`src/open/acquirableProperties.ts`) has rows for `integrity` only. `edge`,
`concealment` and `passage` fire, cite, verify and acquire nothing (C1's `need: edge` on the door). This
design does not author those rows yet (§6.4): every firing that landed on them so far was itself an
absorption, and numbers under an absorbed key are a price on the wrong thing.

### 1.8 A citation proves presence, never justification

the-prisoner#17's lesson, seen again: `need: integrity` on the welded bar cited *"sound stone."* — the
words that say it is immovable. The Dig clause raised tile-targeting from 6/10 to 9/10 and changed no
ruling (§66.6). A richer description hands the referee more words to misuse. Nothing in this design
enriches a description as its lever; the one clause the fixture carries is there so an uncovered attempt
has words to be *grounded* against once it is read as uncovered (§6.7), not to make it happen.

### 1.9 The engine's reader is older than brink's pin

`createTurnReader` shipped in `run-dmcp@0.2.0` (`93bedaa`, 2026-08-30) and is therefore in `0.5.0`, the version
brink pins. brink
could be a second reader caller with **no pin bump and no Phase 3**, because the reader touches no
storage. It has not done so because its own reader (`src/gm/turnReader/`) predates the engine's and works.
§7 says what that does and does not mean for rule 1.

### 1.10 Thinking ON is the setting for anything past round 1

§66.1: OFF is coherent on every bookkeeping criterion and cannot assemble a three-step plan; ON escaped
at round 3. Every full game in §6.8 runs ON, and the prompt-level validation in §4 runs the referee at
the setting the games' referee runs at, which is ON (the transport sends no `reasoning_effort` unless
`PRISONER_THINKING=off`), so the gate measures the referee a game would actually have.

---

## 2. The mechanism, generically

> A closed-key reading over free text has three honest outcomes per question, not two: **a declared key
> fits; nothing in the sources grounds any key; the declared keys have no term for what this source
> attempts.** Today the engine's reader can express the first two and the third collapses into one of
> them. The reading gains the third as an outcome class with no meaning attached, verified the way a
> citation is verified, and hands it back with the span that named it. What a caller does with it is the
> caller's.

### 2.1 What `uncovered` returns

One row of `ReaderResult.answers` today is `{questionId, answerKey, fromSafeDefault, answeredByRung,
citation, rejected}` (`run-dmcp/src/reader/turnReader.ts`, `AnsweredQuestion`). The reading adds one
field and one construction-time flag:

- `ReaderQuestion.uncoverable?: boolean` — the caller declares, per question, that a transport may decline
  the key set. Default `false`, so every reader built today is unchanged.
- A transport may return, for an uncoverable question, `{questionId, uncovered: true, citation}` in place
  of `{questionId, answerKey, citation}`. The citation is held to the identical three checks every key's
  citation is held to: a source the request carried, a non-empty quote, occurring byte-exact in that
  source. Nothing else is checked.
- `AnsweredQuestion.uncovered: { sourceId: string; quote: string } | null`. When set: `answerKey` is the
  question's own `safeDefault`, `citation` is `null`, and `fromSafeDefault` is `true`. **An unmodified
  reader of `answerKey` therefore sees the safe direction**, exactly as if nothing had been accepted —
  which is what makes the change additive and what keeps the-prisoner's `off` arm byte-identical in
  behaviour as well as in prompt.
- An uncovered offer on a question not declared `uncoverable` is a new `RejectionReason`,
  `"uncovered-not-declared"`, kept verbatim in `rejected[]` like every other discarded offer.
- An accepted uncovered claim is final for that question on the rung that offered it — the rule keys
  already follow ("the first accepted answer wins; later rungs see only the still-unanswered set"). A
  caller that wants a stronger rung's second opinion on an uncovered claim runs a second reader; the
  engine does not rank rungs' opinions, because the ladder's order is the caller's policy.

### 2.2 What distinguishes it from `none`, mechanically

`none` is a **key**: a member of `answerKeys` the caller declared, chosen by the transport, cited from a
source the caller named, carrying whatever meaning the caller's prompt gave it (in the-prisoner's
`property` question, *"nothing in the description grounds the effect at all"*). The engine does not know
that meaning and does not need to. `uncovered` is **the transport declining the set**: it is not a member
of `answerKeys`, it is a separate field, and it cites a span the caller can read as "the thing there was
no key for". The reader tells them apart the way it tells an accepted key from a rejected offer — by
which field the transport filled and whether the citation verifies — never by reading either. The
safe-default fallback is the third thing and stays the third thing: *no rung produced anything acceptable*.

### 2.3 Why this is inside hard rules 2 and 4

Hard rule 4: the engine never decides that a span is uncovered. A transport claims it; the engine checks
the claim's citation is a verbatim span of a named source and that the caller declared the question
uncoverable; it never compares the span to the keys and never learns what the span says. That is the same
narrow door the citation check already walks through — a byte-sequence presence test on caller-supplied
text.

Hard rule 2: there is no verdict. Nothing says *unsupported*, nothing prices, nothing decides whether the
caller should now do anything. The engine's own §3.3 objection to an `unsupported` refusal reason was
right and still holds: that would have been a caller's policy in `ResolveRefusalReason`. A reading with
no policy attached is what the resolve protocol's `changes_within` is to a verdict: rows, never a
judgement.

### 2.4 What elaboration becomes, given the reading

The predecessor's six steps stay, with one change to step 1. The trigger was *"the base ruling
failed"*. It becomes *"the base ruling failed, **or** an uncoverable question in it came back
`uncovered`"* — and the `need` request already built by P1b is asked in both cases, with the uncovered
span logged beside it. Nothing about pricing, acquisition, fog or replay changes. In this cell the tile's
`(loose_tile, integrity)` pair is priced `trivial` and `ELABORABLE_EXITS` already opens the corridor at
integrity 0; what has been missing is a ruling on *"dig under the tile"* that does not succeed as a
`reveal`. That is the whole claim of this design, and §4 tests it before anything is built.

### 2.5 What the reading is not

- Not a verdict, not a price, not a plausibility check, not a model call inside the engine.
- Not a change to any recorded batch's request shape: it is declared per question, and the-prisoner
  declares it only under an arm that is off by default (§6.1).
- Not a lexical anything. No word decides coverage; a model claims it and a human audits the spans in the
  transcript, as every citation is audited today.
- Not the fog-of-war reading run-dmcp#18 deferred, and not #37's preflight — though a batch's uncovered
  spans are the list #37's second kind asks for, produced from play instead of from a scan.

---

## 3. The five-module stress test, re-run with the reading in it

The thought experiment the owner posed: five modules, one round trip each, three unrelated economies. Here
it is with the reader's answer separated from the module's own question, which is what the design change
does.

| module | intent | the **reader** reports | the module's own question | answer | back to `resolve()` |
|---|---|---|---|---|---|
| The Prisoner | scrape down through the floor | `effect` uncovered, span *"scrape down through the floor"* | which property kind, grounded in the tile's text? | priced: `integrity`, `trivial` | `create` resource + `constraints` → `write` −10 → `write` suspicion +10 |
| brink | blockade the Bosphorus | an engaged-place question uncovered, span *"the Bosphorus"* | does this name a place the board lacks, and at what cost? | priced: new flashpoint, 1 DEFCON step + 12 prestige | `create` flashpoint → `transfer` prestige (conserved) → `write` DEFCON −1 |
| Zork | wedge the sword in the trap door | `effect` uncovered, span *"wedge the sword in"* | could the door hold an obstruction, per its description? | **rejected** — nothing in the text supports it | nothing acquired; ordinary turn cost |
| AMFV | simulate Rockvil 2091 with the Plan repealed | a scope question uncovered, span *"2091 with the Plan repealed"* | can the sim take a decade it has no dial for, at what cost? | priced: extend, fidelity −30, admissible=false below 40 | `create` + `write` fidelity −30 + `set` admissible=false |
| Planetfall | use Floyd's arm to short the contacts | **never asked** — `target` names a principal | — | refused by construction | nothing |

What it shows, and what it does not:

**The reading is the same object in four of five rows.** A question the caller declared uncoverable came
back with a span. The modules' own questions are entirely different — a property kind, a place, an
obstruction, a decade — and none of that reaches the engine. The two rejections still fail differently:
Zork's is a model judging authored text *after* the reading; Planetfall's is refused before any coverage
question is asked, because the-prisoner's loop already refuses a principal as target in code
(`loop.ts`, `isPrincipalId`) and brink's reader answers only in board keys. Structure first, model second,
in both games.

**The AMFV row, interrogated hardest.** Its price degrades *what you can conclude*, not a resource. Does
it fit the constraint family? Two halves. `fidelity −30` is a bounded numeric write and fits without
comment. `admissible = false below 40` is not a constraint: it is a **gate** — a threshold on one
property that changes what is *available* — and in every consumer here a gate is caller code (the door's
passability rule, `ELABORABLE_EXITS`' threshold, brink's off-ramps). The engine can record the flag
because the caller writes it with `set`; the engine must **not** be the thing that derives the flag from
the number, because *"fidelity below 40 means you may not conclude"* is exactly the judgement hard rule 2
forbids. So the AMFV price fits the five change kinds **only because the caller reifies its own epistemic
state as a fact and writes it itself.** That is a real boundary, not a gap to paper over, and it is the
boundary run-dmcp#41 is circling: gates as *declared data* would let a stock server hold the threshold
without ever deciding anything, and until #41 lands the threshold is the caller's. A second thing the row
exposes: an epistemic price is a price on *future readings* — a source whose fidelity has dropped should
be cited with less weight — and the reader has no notion of a source's reliability. This design does not
add one. It is recorded here so nobody mistakes the AMFV row for a fit.

**The brink row proves the shape and cannot yet exercise it.** brink's reader returns board keys and can
only drop *"the Bosphorus"* on the floor; its resolver's `UNKNOWN_FLASHPOINT` fires only if the
game-master already passed an unknown key. The reading is precisely what brink's turn reader lacks — and
brink could take it from the engine's reader today without Phase 3 (§1.9). Whether it does is brink's
call and not this design's dependency (§7).

---

## 4. The gate: validate the reading at prompt level before any code lands

**No code in either repository.** Real model calls, recorded requests, the tools that exist. Pre-committed
in `checkpoints/<date>-uncovered/PREDICTION.md` before the first call, in Appendix B's shape. This is the
first row of §9, and it is not a commit.

### 4.1 The instrument

`src/open/replay.ts`'s `replayRequestDetailed` re-asks one **recorded** `ReadRequest` N times against a
transport and keeps every reply with its citations; `npm run referee-replay -- <file.json> [N]` wraps it
for a `{label, request}[]` file, which is exactly what every `.referee.json` sidecar is (plus a `replies`
field the replay ignores). It runs through the same one-model-at-a-time swapper and foreign-model guard as
a game.

The procedure, all of it lexical and structural:

1. **Select** the labelled entries (Appendix C) out of the sidecars under
   `checkpoints/2026-09-19-elaboration/` by their exact `label` strings. A scratch script beside the
   results does this, in the shape of `checkpoints/2026-09-19-condition-and-affordance/replicate-2x2.py`:
   it reads JSON, edits JSON, never reads what an intent means.
2. **Rewrite** each selected request into two forms (§4.3), writing `V-K.json` and `V-Q.json`. The
   sources are untouched; the questions change only as §4.3 says. For the supplement (§4.2), only the
   `intent` source's `text` is replaced, so the supplement is asked against the identical eleven
   descriptions and identical questions a real round-1 request carried.
3. **Replay** each file at N=5 with the game's default referee (`qwen3:14b`) at the game's referee setting
   (thinking ON, the transport's default), then the winning form at N=5 on `qwen3.5:27b` (§4.6). Nothing
   is loaded that the run did not load; `curl -s http://doris:11434/api/ps` first, and
   `PRISONER_OLLAMA_RESIDENT_MODELS` names anything the owner says may be evicted and restored.
4. **Read** the result per intent: the most-common key at each site and its agreement, from
   `renderReplayReport`; and the cited span of every `uncovered` answer, from the replies
   `replayRequestDetailed` keeps. The CLI prints keys and agreement only; for the spans the scratch
   script imports `replayRequestDetailed` and `createRefereeTransport` the way
   `checkpoints/2026-09-18-instrument-derive/rerule.mts` imports the referee — a recorded instrument, not
   repository code. If the owner rules that out, the gate is decided on keys and agreement alone, which
   is enough for every number in §4.5.

### 4.2 The labelled set

Appendix C lists it. Two rules built it, and both exist because invented intents are where a designer's
hopes leak into the fixture:

- **Recorded first.** Every item is a real recorded request with its real ruling. Labels are a human's
  reading of what the intent attempts, made before the first call and committed; that is a judgement
  about meaning made by a person for a fixture, never by code.
- **The record is thin on positives, and this is said rather than hidden.** The minds propose what the
  world affords (§64), so the batches hold four intents a human labels uncovered at `effect` and one
  family of fourteen at `product`. Recall on four items is a weak number. A **supplement** of four
  invented intents is therefore added, held to the same sources and questions as a recorded round-1
  request, marked as invented in the file and in every report, and **never pooled with the recorded
  items**: the gate's kill number is set on the recorded items, and the supplement is a second reading
  reported beside it.

Three kinds of item, and the third is the one that matters most:

| kind | what it tests | items |
|---|---|---|
| **U** — should read `uncovered` | recall | the two Dig digs (at `effect`); two hook turns (at `product`); the supplement |
| **C** — cleanly modelled, should keep its key | precision | pry the tile (`reveal`), push the bolt (`open`), hide the spoon (`conceal`), strike the lock (`wear`), climb through (`leave`), bend the bar (`open`/`wear`) |
| **N** — modelled but ungrounded, should keep its key | the `none`/`uncovered` discriminator | the welded-bar scrapes: `effect: wear` is *covered*; the bar simply has no property. If these read `uncovered`, the reading has collapsed "the vocabulary lacks a term" into "the object lacks the property", and it is the predecessor's `none` under a new name |

Two recorded intents that look like positives are deliberately **C**: *"Dig through the loose tile to see
if there's anything hidden underneath"* (P0) states its aim, and `reveal` is honest for it; *"Scratch the
loose tile to see if I can uncover something useful beneath it"* likewise. They contain the word the
Dig probe was looking for and must not move. Three ambiguous intents (*"bend the spoon to see if it can be
used for something"*, *"…to see if it can fit through the window bars"*, and the grit-sharpening family
that the referee already rules three different ways) are excluded from the gate and reported separately.

### 4.3 Two forms, because the way an answer is offered decides whether a model reaches for it

**Form K — a key inside the question's own set.** `effect.answerKeys` gains `uncovered`; `product.answerKeys`
gains `uncovered`; each prompt gains one sentence: *"If none of the kinds above names what the intent
attempts, answer uncovered and cite the words of the intent that name what is attempted."* `safeDefault`
stays `none`. This is the #17 shape exactly, and it is tested first *because* it is: if K works, `absent`'s
failure was about that question's wording and not about new keys in general.

**Form Q — a separate coverage question.** The base questions are untouched. One question, `coverage`,
is inserted directly after `target`: *"Is what the intent attempts named by one of the effect kinds
listed in the effect question below? covered if one of them names it; uncovered if none does. Cite the
words of the intent that name what is attempted."* Keys `covered`, `uncovered`; safe default `covered`.
For the hook items a second coverage question is asked of `product`'s kinds in the same form.

Both forms change the base request shape, which is why in play either lives behind an arm that is off
by default (§6.1). At the gate neither touches a game.

A third form is named and not run: **P, post-hoc** — the base request byte-identical, a second request
after every ruling asking whether the ruling's effect names what the intent attempted. It doubles referee
calls and asks a model to second-guess a ruling it just gave. It is run only if K and Q both fail on
recall while passing precision, because it is the one form that can put the ruling itself in front of the
model.

### 4.4 Four measures, both directions

- **Recall.** On U items, does the site read `uncovered` (most-common key over N=5)?
- **Precision.** On C and N items, does it stay quiet? If everything reads `uncovered`, every turn becomes
  elaborable, the safe default is gone, and §2 of the predecessor's exploitation guards fail open.
- **Stability.** Per-item agreement over N=5, §5.3's 80% bar, reported per item and never as a single
  reading.
- **A second model.** The winning form re-run on `qwen3.5:27b`, the next size in the same family that
  doris already holds. If the reading works only there, that is a finding about the design's cost — the
  game's referee moves to a slower model — not a detail.

### 4.5 The numbers, committed before the first call

Per item, "reads `uncovered`" means the most-common key across N=5 is `uncovered` at the labelled site.

- **Recall kill:** on the recorded U items, fewer than **3 of 4** read `uncovered` → the form is dead on
  this model. (The supplement is reported beside it and does not rescue a form the recorded items killed.)
- **Precision kill:** **any** C or N item reads `uncovered` → the form is dead on this model. One is
  enough: a reading that fires on a modelled act once in ten is a reading that makes one turn in ten
  elaborable for no reason, and the record's most common act *is* a modelled one.
- **Instability flag:** `uncovered` appears in ≥2 of 5 replays on any C or N item without being the
  majority → reported as a noise floor; it does not kill the form, and it must appear in §6.8's
  prediction as the expected false-positive rate.
- **Stability kill:** fewer than 80% of items reach ≥80% agreement at the labelled site → the form is
  dead on this model, whatever its recall.
- **Both forms dead on `qwen3:14b` → run both on `qwen3.5:27b`.** Both dead there too → **the reading is
  not groundable from a closed-key reader on the models this project runs, and the design does not
  proceed to code.** Say so in OPEN-VARIANT.md, and the fallback is §6.9's authoring with no mechanism.

### 4.6 What each outcome means

| outcome | reading | what happens next |
|---|---|---|
| K passes on 14b | a new key *can* be reached for; #17's `absent` failed on its wording | §6.1's arm is built in form K; §6.8 runs |
| Q passes, K fails, on 14b | the invitation has to be its own question; a key inside a set is absorbed like any other | arm in form Q; §6.8 runs; the hook site needs its own coverage question |
| both fail on 14b, one passes on 27b | the reading exists and costs a bigger referee | arm built; the game's referee default is re-decided with §33.16's evidence beside the new cost; §6.8 runs on 27b |
| recall passes, precision fails everywhere | the model says `uncovered` whenever invited | dead; not a wording problem — form P is tried once, then stop |
| everything fails | the reading is not groundable here | no code; the finding goes to OPEN-VARIANT.md and to the engine issue as a *negative* result worth keeping (run-dmcp#39 should know it) |

### 4.7 Cost

Twelve recorded items plus four invented, N=5, two forms, on `qwen3:14b` at thinking ON: 160 referee
calls. Measure the first ten and extrapolate; the referee's ON replies in the B-on sidecars ran tens of
seconds each, so budget one to two hours. The second model is the winning form only: 80 calls plus one
model load. The whole gate is an afternoon of GPU and zero games, and it runs detached.

### 4.8 What the gate cannot tell you

That a mind will *attempt* an uncovered act often enough for the reading to matter (§6.8 measures that),
that `need` will then land on a priced pair (§1.8's citation problem is untouched by this), or that an
acquired route is pursued (the elasticity question, still unmeasured). It tells you only whether a
closed-key reader on these models can say *"I have no term for this"* when it should and stay quiet when
it should not. That is the thing nobody checked last time.

**The labelled set is a regression fixture from the day V0 passes.** A model's absorption boundary is a
property of the *set* it is choosing from, so any change to that set moves it: a new `EFFECT_KINDS`
entry, a new `DERIVABLE_KINDS` row (the hook, §6.9, is the first one coming), a reworded `effect` or
`product` prompt, a referee model change. Each of those replays Appendix C at N=5 against the same kill
numbers (§4.5) before it lands, and the replay's report is committed beside the change. The set is
append-only: an item is never relabelled to make a change pass, and a new positive found in play is
added as a new row with the batch that found it. This is the same discipline the-prisoner already keeps
for the base referee (§5.3's 80% bar on replayed rulings), applied to the one answer that can fail open.

---

## 5. `run-dmcp` — the engine's share, conditional on §4

### 5.1 The change, in the engine's own terms

Appendix A is the issue text. The shape is §2.1. Tests first, neutral fixture (grain, treasury,
population), and each is written so that it goes red against `0.9.0`:

- A question declared `uncoverable` accepts an uncovered offer whose citation verifies; the row's
  `answerKey` is the safe default, `fromSafeDefault` is true, `uncovered` carries the span.
- An uncovered offer on a question not declared uncoverable is rejected `uncovered-not-declared`, kept
  verbatim, and the question is still open to later rungs.
- An uncovered offer whose quote is not byte-exact in the named source is rejected with the same reason a
  key's citation would be, never accepted as "uncovered anyway".
- A later rung's key offer for a question already accepted as uncovered is `duplicate-answer`.
- A reader with no uncoverable questions is byte-for-byte unchanged in every existing test.
- The construction-time validator refuses `uncoverable` on a question whose `answerKeys` contains the
  literal string `uncovered` — not because the engine knows the word, but because a key and an outcome
  class with the same spelling would be indistinguishable in a transcript.

Minor, additive: `0.10.0`.

### 5.2 What the engine must not acquire from this

- No meaning for `uncovered`. The engine does not know it is about vocabulary; it knows a transport filled
  a different field and cited a span.
- No verdict, no `unsupported`, no price, no plausibility check, no model.
- No ranking of rungs, no confidence, no score — hard rule 2's list, unchanged.
- No lexical comparison of the span to anything. A span is stored and handed back.

### 5.3 Why one caller is enough, and why the issue waits

Hard rule 1 asks for *generic, with at least one real caller*. Generic: every closed-key reading over free
text has the third outcome, and today the reader makes it unexpressible by construction (§1.2 is the
measurement of that — 168 rulings, zero overflow). One real caller: the-prisoner rules every principal's
intent through `createTurnReader` today and is the only caller of it. Counting consumers was never the
test, and with four consumers "two" would not even be a majority.

Why the issue is filed **after** §6.8 rather than now: the-prisoner#17 shows that a caller can declare a
key and never once receive it, and a mechanism nobody reaches for has no real caller, only a declared
one. So the issue carries the caller's evidence — the gate's numbers and the batch's — and it is filed
the day the reading has fired in play. Until then the caller uses a plain key of its own (§6.2), which
the engine already accepts and which needs nothing from it. Landing order is still engine-before-consumer
for the commit that *consumes* the structural form (§9).

### 5.4 Relation to the open engine issues

- **#39 (intent in, ruling out, as a verb):** the reading is a third outcome the verb would carry, and the
  negative result in §4.6's last row is something #39 should know either way.
- **#37 (preflight over a declared world):** its second kind — prose that claims what the world does not
  model — is what a batch's uncovered spans list, from play. That is a cheaper preflight than a scan and
  it does not pattern-match anything.
- **#41 (mechanics and gates as data):** §3's AMFV finding lands here: an epistemic price is expressible
  only because the caller writes its own gate, and #41 is where a gate could become declared data.
- **#42:** shipped in `0.9.0`; the-prisoner is its second real caller; nothing here touches it.

---

## 6. The Prisoner — first caller, second attempt

### 6.1 The arm

`PRISONER_UNCOVERED=off | <form>`, default `off`, where `<form>` is the **one** form §4 kept. `off` is
byte-identical to today's request and to every recorded batch: a prompt snapshot test pins it, as P1b's
did for `PRISONER_ELABORATE`. The header line names the arm and the sites it covers (`effect`,
`product`). Pooled batch tooling refuses to mix values; benchmark mode never turns it on
(the-prisoner#5's rule).

**If both forms pass V0, one is built and the other is not.** The choice is made on V0's numbers, in this
order, and it is not made on token or latency overhead — the reader is one call per turn and every
question is answered inside the same reply, so a second question is a rounding error against a thinking
referee:

1. **Precision margin.** The form with fewer C and N items carrying *any* `uncovered` reply (§4.5's
   instability flag) wins, even when both cleared the kill number. Over-firing is the failure that
   makes every turn elaborable and fails §2's guards open.
2. **K on a tie.** The engine's structural form (§2.1) is per question — the transport declines *this
   question's* set on the same row. K has that shape, so row P10 retires the plain key by swapping a key
   for a field on the same row. Q would need the transport to translate a separate `coverage` answer
   onto the `effect` row, plus a second coverage question for the `product` site: translation glue built
   to be thrown away the day the engine form lands.

Q's apparent isolation from later vocabulary changes is not counted in its favour: its coverage answer
is still given against the effect set, so a new kind moves what "covered" means under Q exactly as it
adds a competitor under K. What protects against that drift is §4.8's regression rule, under either form.

### 6.2 The ruling gains a reading

`RefereeRuling` gains `uncovered: { site: "effect" | "product"; citation: CitationCheck } | null`, computed
in `computeRuling` from the answer the arm produced — under `key`, an `effect`/`product` answer of
`uncovered` cited from the intent; under `question`, the coverage answer. An uncovered ruling is
**inapplicable** (nothing resolves) with a positive reason rendered to the actor: the description, as
every refusal already shows, plus nothing else — the actor is not told the world lacks a term, because
that is a fact about the referee's vocabulary, not about the cell. The transcript shows the site and the
span. When the engine's structural form lands (§9 row E3), this field is read from
`AnsweredQuestion.uncovered` instead of from a key, and the plain key is retired in the same commit.

### 6.3 The trigger moves

`considerElaboration` (`src/open/loop.ts:236`) fires today from the two null paths (`!ruling.applicable`,
`plan === null`). It gains a third: `ruling.uncovered !== null`, which under §6.2 is already inapplicable
and so already reaches the first path — the change is that the elaboration request is asked with the
uncovered span logged beside it, and the `need` question's own prompt is unchanged. The free consistency
measurement (§4.1 of the predecessor) gains a column: whether `need` landed on a pair while the base
ruling was uncovered versus merely failed.

### 6.4 The `need` vocabulary, and the numbers that are not authored yet

The hook is a `need` no key names — a *shape*, not `integrity`/`edge`/`concealment`/`passage` — and this
design does **not** add a key for it. Adding keys is adding absorption targets (§1.8), and the hook's
honest answer is a declared derivable kind (§6.9), not a property. Likewise §4.3's missing rows for
`edge`, `concealment`, `passage` stay missing until a firing lands on one of them *with the reading on*;
every landing so far was itself an absorption.

### 6.5 The band table, per D11

- Every row becomes `bandSource: "author"`, the model's reading and its citation moved into `comment`.
  `price-world` keeps running; its output becomes a diff against the author's rows, and a row whose
  description hash is stale still refuses to start.
- Objects an arm removes from play — the welded bar, a sealed lock (§6.7) — are `impossible` **by
  declaration** in the scenario, per arm, and `acquirablePairs` takes the objects *as built under the
  arms* rather than the static list. This closes §1.6. Tests: a welded build lists `(bar, *)` as
  declared-impossible with no model read; `assertElaborationBandsReady` under `welded` reports no
  `missing` row for it.
- **One re-read, once, as an experiment:** `PRISONER_REFEREE_MODEL=qwen3.5:27b npm run price-world`
  against the identical descriptions, twice, an hour apart. Reported in OPEN-VARIANT.md as two numbers:
  how many pairs read `impossible`/`ruinous` (discrimination) and how many rows agree with themselves
  across the two runs (stability). If the 27b read discriminates and is stable, a build-time read is a
  usable *proposal generator* at scale and Adventurer should know; if not, it is decoration and the guide
  should say a band is authored. Either way this game's prices are the author's.

### 6.6 What is unchanged

`OPEN_ACQUIRE`, `adoptAcquiredProperty`, belief stamping, `ELABORABLE_EXITS`, the sidecar and replay, the
`need` request's prompt, `PRISONER_ELABORATE_BAND`. The reading changes *when* the request is asked, not
what it asks or what happens after.

### 6.7 The fixture, per D12

**`PRISONER_FIXTURE=toll-booth`**, one name that composes:

| component | today | in the fixture | which artefact |
|---|---|---|---|
| window | `PRISONER_WINDOW=welded` | welded | existing arm |
| door | `PRISONER_DOOR_PRICE=free\|threshold\|margin` | **`sealed`** — the lock declares no `integrity`, as the welded bar declares none; no gate to pass because there is nothing to wear | one new value on an existing enum, fixture-only |
| tile | as shipped | as shipped **plus** §66.6's clause (*"Under the grit the floor is packed earth, dry and crumbling, loose enough to scrape away by hand."*) — the one description change, so an uncovered dig has words to be grounded against | fixture text, never the benchmark's `OPEN_OBJECTS` |
| instrument | `PRISONER_INSTRUMENT=checked` | checked | existing arm |
| elaboration | `PRISONER_ELABORATE=property` | on, band as authored | existing arm |
| reading | `PRISONER_UNCOVERED` | on, in §4's winning form | §6.1 |
| thinking | `PRISONER_THINKING=on` | on | existing arm |

The header names the fixture and every component it set; benchmark mode refuses it; pooled tooling
refuses to mix a fixture run with any other. **The fixture is a toll booth and says so in its own header
line**: it is the instrument for *"will a mind pay a stated price for a route the world offers only on
attempt"*, and it is evidence about nothing wider. The game is `OPEN_OBJECTS` as shipped, with every arm
at its default; nothing in this table reaches it. §65's complaint that the world is too small is
answered by more world, not by this room.

### 6.8 The measurement, per D13 — pre-committed, staged, with a stopping rule

Metrics are mechanical, from the sidecar and the markers `checkpointTranscript.ts` writes (`analyse.py`'s
own discipline): **read** (an `uncovered` reading on any half-round), **fired** (an elaboration request
asked), **acquired**, **pursued**, **ratified**, and **escaped by any route**.

**Stage F0 — the room has no route.** Fixture, `PRISONER_UNCOVERED=off`, n=3, 12 rounds, thinking ON.
Prediction: escaped 0/3; fired only on failures; acquired 0/3. **Any escape kills the fixture** — a route
is still in the room and §6.7 is re-done before F1 runs. This is the game §66.2 said costs one game to
check, run three times because one game has been wrong twice.

**Stage F1 — the reading in play.** Fixture, arm on, n=3 first. Predictions: read ≥ 2/3; fired ≥ 2/3;
acquired ≥ 1/3. Stopping rule, in order:
- read **0/3** → stop. The gate passed and play does not reach the reading: the minds never attempt an
  uncovered act in this room, and #17's shape has arrived one layer up. Look at the candidates before
  anything else; do not touch a prompt.
- read ≥ 2/3, fired ≥ 2/3, acquired **0/3** → stop. The reading works and `need` does not land on a
  priced pair; read the `need` citations (§1.8's failure is the likely one). No retuning.
- acquired ≥ 1/3 → continue to n=6 and read pursued and ratified.

At n=6: pursued ≥ 3/6 with any ratified is *a price she will pay*, and only then does the band sweep
(the predecessor's C2/C3, `hard` and `ruinous`) come back, as its own batch with its own prediction.
Pursued 0/6 with acquired ≥ 3/6 is D5's sentence — the honest price defeats the vision for this mind —
and it is read as that, not retuned.

**Falsifiers, named:** F0 escaped ≥ 1/3 (the room); F1 read 0/3 (the trigger, again); F1 acquired 0/3
with read ≥ 2/3 (the `need` step); F1 at n=6 pursued 0/6 with acquired ≥ 3/6 (the mind). Each is a
different section of OPEN-VARIANT.md and each is worth having.

**Cost:** twelve rounds at ON is roughly eighteen minutes a game (§66.1's 45 for thirty). F0 + F1 at n=3
is about two hours; n=6 adds one. Under a fifth of §4.8's twelve hours, and every stage says something
on its own.

### 6.9 Tier 2, per D9: not built, and what is done instead

The hook, the rope, the thing the world lacks — each is one row of content: a `DERIVABLE_KINDS` entry
(parent `spoon`, `replacesParent: true`, its properties declared, its description a human's) is what
makes *"bend the spoon into a hook"* a ruling rather than a refusal, and the referee's `product` question
already offers every declared kind whose parent is in view. That is the author writing the space of what
an object may become, which is the AUTHORING-GUIDE lesson E2 landed. A batch with the reading on produces
the list of what to declare, from what the minds actually reached for, and that list is #37's second
kind for free. Tier 2 — a model writing the description, an auditor, a kind table bounding what a new
thing can do — is reconsidered when that list grows faster than an author can keep up with it, which in a
one-room game it will not. The floor as an object is the same shape and is *not* added to the fixture:
`ELABORABLE_EXITS` already lets the tile's acquired `integrity` mean *the floor here*, and the fixture's
question is whether that path completes, not whether a second one would.

---

## 7. brink — a second caller in shape, not in fact

brink is not on the resolve protocol (Phase 3 unexecuted, `docs/RUN-DMCP-PHASE-3.md`) and its turn
reader is its own (`src/gm/turnReader/`), answering in board keys with a citation from the player's own
words. Its `UNKNOWN_FLASHPOINT` rejection is structural — a key not on the board — and fires after the
reading, not in it; the reader today cannot return *"the Bosphorus"* at all.

Two facts, and what they do and do not license:

- The engine's reader is in `0.5.0`, brink's pin (§1.9). brink could adopt `createTurnReader` for its own
  reader without a pin bump and without Phase 3, since the reader has no storage. That would make brink
  the reading's second real caller, and hard rule 5 in brink's own `CLAUDE.md` (one call per turn, add the
  question to the existing reader) is compatible with it.
- Nothing in this design depends on brink doing so, and rule 1 does not require it (§5.3). brink's row in
  §3 proves the *shape* carries a conserved pool and a bounded ladder; brink builds it when the-prisoner's
  measurement says a mind pays, exactly as the predecessor's §5.5 said, and not before.

No brink commit is in §9. The two that are already done (model constants on `qwen3:14b`,
`mind-seam@0.5.0`) stand, and the #49 re-measurement is still owed on a real playtest.

---

## 8. `mind-seam` and `mother-of-invention` — nothing lands

`mind-seam@0.5.0` is untouched in both directions; the facade exists and the-prisoner's referee does not
consume it (§1.5), which this design records and does not fix. `mother-of-invention@0.1.2` stays pinned
and `propose` (the predecessor's M1) stays unbuilt: §64.4's order — fix the instrument, then test a
mechanism in it — still holds, and the toll booth is not that instrument either. A fair test of a
selection mechanism needs a room with a *non-dominant* obvious route, and this fixture has no route at
all. That room is a third scenario and is not designed here.

---

## 9. Landing order — the gate first, then N commits, engine before the consumer that consumes it

Each commit names in its own message which rows it depends on. Tests first in every repository, and every
guard validated by planting a violation and watching it go red.

| # | repo | what | tests that go red first |
|---|---|---|---|
| **V0** | the-prisoner (checkpoints only) | **§4's gate.** `PREDICTION.md` committed, then `V-K.json`/`V-Q.json` built from the recorded sidecars, replayed at N=5 on `qwen3:14b`, winner on `qwen3.5:27b`; results and the scratch script committed unedited. **Not a code commit.** Everything below waits on its outcome. | — |
| P5 | the-prisoner | `PRISONER_UNCOVERED` arm (§6.1) in the form V0 chose; `RefereeRuling.uncovered` (§6.2); the third trigger path (§6.3); transcript site + span; sidecar unchanged in shape | prompt snapshot: `off` byte-identical; scripted referee answering `uncovered` at `effect` → ruling inapplicable, span recorded, positive reason rendered; same at `product`; elaboration request asked on an uncovered ruling with the span logged; pooled tooling refuses mixed values |
| P6 | the-prisoner | band table to author-set (§6.5); per-arm declared-`impossible`; `acquirablePairs` over objects as built | a welded build lists `(bar, *)` declared-impossible with no read; `assertElaborationBandsReady` under `welded` reports no `missing` for it; `price-world` output is a diff, never an overwrite of an author row |
| P7 | the-prisoner | `PRISONER_FIXTURE=toll-booth` (§6.7): `sealed` door value, fixture tile text, composition, header, benchmark refusal | the fixture sets every component and the header names each; `sealed` builds no lock `integrity` resource and no door exit gate; benchmark mode refuses; pooled tooling refuses to mix; `OPEN_OBJECTS` unchanged (a snapshot) |
| P8 | the-prisoner | §6.8: `PREDICTION.md`, then F0, then F1 with its stopping rule, committed unedited; OPEN-VARIANT.md §67 with the numbers | — |
| P9 | the-prisoner | the 27b re-read of the band table, twice (§6.5), a §-note | — |
| **E3** | run-dmcp | **only after P8 shows the reading fired in play:** Appendix A filed with V0's and P8's numbers; `uncoverable`, `uncovered`, `uncovered-not-declared` (§5.1); `0.10.0` | §5.1's six |
| P10 | the-prisoner | pin `0.10.0`; `computeRuling` reads `AnsweredQuestion.uncovered`; the plain key retired; `off` still byte-identical | the arm's existing tests unchanged; a transport that offers `uncovered` as a *key* is now rejected and the ruling is what the structural form says |
| E4 | run-dmcp | AUTHORING-GUIDE: "a batch's uncovered spans are the author's list of what the world does not yet model" — plus the four pointers, together | the pointer files exist and name the section |

Rows P5–P7 are independent of each other and of E3. Nothing in brink, `mind-seam` or
`mother-of-invention`. If V0 fails everywhere (§4.6's last row), the order is: a §-note in OPEN-VARIANT.md,
a comment on run-dmcp#39 with the negative result, and §6.9's content (the hook kind, declared) as the
only commit.

---

## 10. What this design deliberately does not do

- No code before V0 has a result, and no engine issue before the caller has reached for the reading in
  play (D7, D10).
- No `unsupported` verdict, no pricing, no model, no fog, no plausibility check in the engine — §3.3 of
  the predecessor, unchanged, plus §5.2.
- No change to any recorded batch's request: the arm is off by default and pins its own byte-identity.
- No new `need` key, no numbers for `edge`/`concealment`/`passage`, no richer descriptions as a lever
  (§6.4, §1.8).
- No Tier 2 (D9). No floor object. No third scenario for `mother-of-invention`.
- No band sweep until one acquisition has been pursued (§6.8).
- No lexical anything, anywhere: the gate's labels are a human's, the analysis counts markers this
  codebase writes, the scratch script edits JSON structure, and nothing decides what prose means.
- No wiring between repositories. The plain key needs nothing from the engine; the structural form is
  published before the consumer pins it.
- No claim that the toll booth is the world §65 asked for. It is the instrument for one narrow question,
  and its header says so.

---

## Appendix A — the `run-dmcp` issue, in the engine's own words

**To be filed after §9 row P8, carrying V0's and P8's numbers.** Written to pass `engineVocabulary.test.ts`
as filed; do not add a consumer's name or vocabulary to it.

> **title:** The turn reader may report that a question's declared keys have no term for what a source
> attempts
>
> **The caller.** A consumer rules every principal's free-text intent through `createTurnReader`: closed
> keys per question, each answer cited verbatim from a named source, a safe default per question. It has
> measured, across 168 recorded rulings on one question, that its transport never once offered a key
> outside the declared set — and, across 31 recorded games, that an intent the declared vocabulary has no
> term for is answered with the *nearest* declared key and a citation that verifies, so the ruling
> succeeds at the wrong thing rather than failing. A closed set can say "this key fits" and "nothing
> grounds any key"; it cannot say "there is no key for this". The caller's downstream mechanism needs the
> third answer, and a prompt-level test on recorded requests (numbers attached) shows the transport gives
> it when a question invites it and stays quiet when the intent is covered.
>
> **What is asked.** A per-question, opt-in outcome class with no meaning attached:
> `ReaderQuestion.uncoverable?: boolean` (default false; every existing reader unchanged); a transport may
> answer such a question with `{ questionId, uncovered: true, citation }` in place of a key; the citation
> is held to exactly the three checks a key's citation is held to (a source in the request, a non-empty
> quote, byte-exact occurrence); on acceptance the row's `answerKey` is the question's own `safeDefault`,
> `fromSafeDefault` is true, and a new field `uncovered: { sourceId, quote } | null` carries the span. An
> uncovered offer on a question not declared uncoverable is rejected with a new `RejectionReason`,
> `"uncovered-not-declared"`, kept verbatim like every other discarded offer. An accepted uncovered claim
> is final for that question on the rung that offered it, as an accepted key is.
>
> **What is not asked.** Any interpretation of the span, any comparison of it to the keys, any verdict,
> price, score or ranking of rungs. The engine records that a transport declined the set and cites where;
> what a caller does with that is the caller's, in the same way `changes_within` returns transitions and
> never a judgement.
>
> **Tests first, neutral fixture,** against a reader built with and without the flag: an uncoverable
> question accepts a verified uncovered offer and the row reads as above; a non-uncoverable question
> rejects it `uncovered-not-declared` and stays open to later rungs; an uncovered offer with a quote not
> byte-exact in its source is rejected as a key's would be; a later key offer for an accepted uncovered
> question is `duplicate-answer`; a reader with no uncoverable question is byte-for-byte unchanged in
> every existing test; construction refuses `uncoverable` on a question whose `answerKeys` already contains
> the literal string `uncovered`, so a key and an outcome class can never share a spelling in a transcript.
>
> Minor, additive: 0.10.0.

## Appendix B — `PREDICTION.md` skeletons

**B.1 — for V0, the gate (`checkpoints/<date>-uncovered/PREDICTION.md`), committed before the first call:**

```
# Pre-committed before the uncovered-reading validation ran (WORLD-ELABORATION-DESIGN-2.md §4)
Written <date>, before the first call. Code revision: <sha> (clean) -- no src/ change; the scratch
script is <name>.py beside this file. Sidecars read: checkpoints/2026-09-19-elaboration/{A,B,Bon,C1,Dig,P0}.
Labelled set: Appendix C as committed at <sha>: 4 U-recorded (2 effect, 2 product), 6 C, 2 N,
4 U-supplement (invented, reported separately, never pooled). Forms: K, Q. N=5. Referee qwen3:14b,
thinking ON (the transport default), temperature 0. Second model qwen3.5:27b on the winning form only.

Per item, "reads uncovered" = most-common key over N=5 is uncovered at the labelled site.
Predictions, form K on 14b: U-recorded 2/4 (I expect the product site to work and the effect site not);
C+N 0/8 read uncovered; instability flag on <= 1 item. Form Q on 14b: U-recorded 3/4; C+N 0/8.
27b: whichever form is alive, U-recorded 4/4, C+N 0/8, agreement >= 80% on every item.

Kill numbers (§4.5): recall < 3/4 recorded; precision: any C or N item reads uncovered;
stability: < 80% of items at >= 80% agreement. Both forms dead on 14b -> both on 27b. Both dead there ->
the design does not proceed to code (§4.6, last row).
Not predicted, genuinely open: whether the supplement's invented intents behave like the recorded ones;
whether the N items (welded-bar scrapes) are the ones that break precision.
```

**B.2 — for P8, the fixture batch (`checkpoints/<date>-toll-booth/PREDICTION.md`):**

```
# Pre-committed before the toll-booth batch ran (WORLD-ELABORATION-DESIGN-2.md §6.8)
Written <date>, before the first call. Code revision: <sha> (clean), pinned worktree. Fixture:
PRISONER_FIXTURE=toll-booth (welded, sealed, fixture tile, instrument checked, elaborate on,
uncovered=<form>, thinking on), 12 rounds, qwen3:14b everywhere unless V0 moved the referee to 27b.
Band table author-set at <sha>; (loose_tile, integrity) = trivial.
Metrics: read, fired, acquired, pursued, ratified, escaped-by-any-route (mechanical, analyse.py's markers).
F0 (arm off, n=3): escaped 0/3, acquired 0/3. Falsified if escaped >= 1/3 -> the room; fix it before F1.
F1 (arm on, n=3): read >= 2/3, fired >= 2/3, acquired >= 1/3.
  Stop if read 0/3 (the trigger; look at candidates first). Stop if acquired 0/3 with read >= 2/3
  (the need step; read the citations; no retuning). Continue to n=6 if acquired >= 1/3.
F1 at n=6: pursued >= 3/6 with any ratified -> a price she will pay; the band sweep returns as its own
  batch. Pursued 0/6 with acquired >= 3/6 -> D5's sentence; read as that.
No band is retuned after seeing results.
```

## Appendix C — the labelled set, from the record

Every item is a recorded `label` in a `.referee.json` under `checkpoints/2026-09-19-elaboration/`, with the
ruling it received. Labels are this design's proposal; **the owner confirms or changes them before V0's
first call**, and the confirmed list is what B.1 commits. Recorded rulings are shown as
target/effect/property.

| kind | site | recorded intent (cell) | recorded ruling | label's reason |
|---|---|---|---|---|
| U | effect | *dig under the loose_tile* (Dig) | loose_tile/reveal/concealment | no stated aim; the act is removing material |
| U | effect | *dig under the loose_tile with my fingers* (Dig) | loose_tile/reveal/concealment | as above |
| U | product | *Bend the spoon into a hook* (P0) | spoon/derive/edge, product none | `derive` covers making; no kind is a hook |
| U | product | *Continue bending the spoon to form a more precise hook* (P0, ×3) | spoon/derive/edge, product none | as above; the family that cost 15 rounds |
| C | effect | *Pry up the loose tile to see what's underneath* (B, Dig) | loose_tile/reveal/concealment | aim stated; `reveal` is right |
| C | effect | *Dig through the loose tile to see if there's anything hidden underneath.* (P0) | loose_tile/reveal/concealment | contains "dig"; aim stated; must **not** move |
| C | effect | *Use the spoon to push the door's bolt back* (Bon, ×2) | door/open/passage | modelled |
| C | effect | *Use the loose tile to hide the spoon under it* (P0) | loose_tile/conceal/concealment | modelled |
| C | effect | *Use the spoon to strike the lock repeatedly* (Bon) | lock/wear/integrity | modelled |
| C | effect | *Climb through the open door* (C1) | door/leave/passage | modelled |
| N | effect | *Use the spoon and grit from the loose_tile to scrape the window bar's weld again* (C1, ×3) | bar/wear/**none** | `wear` is covered; the welded bar grounds nothing — must stay `wear` |
| N | effect | *Use the spoon to strike the window's bar repeatedly* (Bon) | bar/wear/integrity (welded) | as above |
| U-supp | effect | *scrape down through the floor with the spoon* | — (invented) | the owner's own example |
| U-supp | effect | *wedge the spoon under the door to jam it shut* | — (invented) | obstruction; no kind |
| U-supp | effect | *set fire to the blanket* | — (invented) | no kind for burning |
| U-supp | product | *tie the blanket into a rope* | — (invented) | `derive` covers; no kind is a rope |
| excluded | — | *Try to bend the spoon to see if it can be used for something* (B); *Bend the spoon to see if it can fit through the window bars* (B); the grit-sharpening family (P0, ruled wear/derive/restore inconsistently) | — | ambiguous to a human reader; replayed and reported, never counted |

Twelve counted recorded items (4 U, 6 C, 2 N), four supplement, three excluded-but-reported. The
supplement's requests are the Dig cell's round-1 request with only the `intent` source's text replaced,
so they carry the fixture tile's clause and the same eleven descriptions.

## Appendix D — the arms, in one place

| env | values | default | header line | on the default |
|---|---|---|---|---|
| `PRISONER_UNCOVERED` | `off`, or the one form V0 kept (`key` or `question`, never both) | `off` | `Uncovered: <form> (effect, product)` | byte-identical request; no `uncovered` field on any ruling |
| `PRISONER_FIXTURE` | unset, `toll-booth` | unset | `Fixture: toll-booth -- a room with no unpaid route, the instrument for §6.8 and evidence about nothing wider` plus one line per component it set | no component touched; `OPEN_OBJECTS` as shipped |
| `PRISONER_DOOR_PRICE` | `free`, `threshold`, `margin`, **`sealed`** | `free` | existing line, plus `sealed`'s | unchanged |
| `PRISONER_ELABORATE`, `PRISONER_ELABORATE_BAND`, `PRISONER_WINDOW`, `PRISONER_THINKING`, `PRISONER_INSTRUMENT` | as today | as today | as today | unchanged |

All refuse to pool with a batch at a different value; benchmark mode never turns any of them on; a fixture
run refuses to pool with a non-fixture run regardless of every other arm.
