# A person's phrasing: one design for the-prisoner#25–#29 (2026-09-25)

Written for: Derek, to approve or change before any code. Answers five issues filed from the first live
serial human game (the one abandoned after 8 rounds). Decisions in §0; the shared diagnosis in §1; the
run-dmcp question answered plainly in §8. No implementation code is written here. Everything claimed
about the tree was checked against `main` at `199bd70`.

---

## 0. The decisions, up front

**DECIDED 2026-09-26, all twelve, by the owner.** As recommended except D9, which is **yes, the container
shape** (§6.2 records what that chooses). Landing order as §9. Nothing is built yet.

| | decided |
|---|---|
| D1 | both minds; batch 8 starts after it |
| D2, D4, D8 | all three |
| D3 | yes, play seat only |
| D5 | rewrite, no plural |
| D6 | yes, as an arm |
| D7 | D7a, mechanics |
| D9 | **yes**: blanket and cot as containers, hidden from the other principal's perception |
| D10 | keep the motive; pick up #1 next |
| D11 | real human intents plus paraphrases |
| D12 | docs only; the #43 row's shape after one audit |

Jurisdiction per row, per your 2026-09-23 rule: **game** (this repository), **engine** (run-dmcp),
**guide** (`run-dmcp/docs/AUTHORING-GUIDE.md` plus its four pointers), **model** (which model, which
setting). Each row says what a yes or a no decides.

| | decision | recommended | where | what it decides |
|---|---|---|---|---|
| **D1** | Every outcome sentence opens with what was ruled, **as fiction, never as keys**: "You set about opening the window. It will not open yet." Both minds, not only the seat. | **yes** | game | Whether a misread is ever visible to the actor. Today only a *refusal* names its reading (OPUS-FIRST §3.4); a gate-refused `open` says "the window will not open yet" and hides that the act was read as opening. Yes = one wording change to `renderOwnOutcome`, a batch boundary for batch 8 (§2). No = the seat gets the same line from a side channel and the models stay blind. Red team (§11.1): the sentence teaches the player the game's verbs, which is learning, and it moves the human corpus toward the model's, which D11 records as a condition. |
| **D2** | A human game keeps its evidence as it goes: transcript and `.referee.json` rewritten after every half-round, and ctrl-C writes an "abandoned at round N" transcript. | **yes** | game | Whether the next abandoned game is data. The 2026-09-25 game left no file in `checkpoints/`; #25's table was reconstructed from the player-facing text. An error already writes a partial transcript; a ctrl-C does not. |
| **D3** | The seat offers one retype when the referee leaves the target unread but cites an effect: "That was read as hiding, but not what. Say it another way, or Enter to let it stand." Play seat only; the loop's model minds never see it. | **yes** | game | Whether an elided object costs a turn. This is Infocom's "Hide what?", triggered by the referee's keys, never by code reading English (§3.1). The wording never says the player left the noun out, because the referee may have missed a noun that was there; a retype recovers that case too (§11.5). Yes = a `reconsider` hook on the seat and one extra referee call. No = D6 alone carries #27. |
| **D4** | #29: the readline interface is paused between questions and resumed for each one. The checkpoint's `(X has taken a turn.)` line goes through the seat's own `write`; a write while a question is open is a bug the seat logs, not a case it designs for, because the loop is serial and the world never moves while a prompt is open (§3.2). | **yes** | game | Whether typed-ahead text is echoed into game output. The seat's single `write` wrapper is not the leak: the offending line is a bare `console.log` in `checkpoint.ts`'s `onHalfRound`, outside it, and readline is live between turns. Verified through a pty, as §47 did. |
| **D5** | #26: the window's prose stops promising bars the world does not model. Proposed text in §4. The synonym table is **not** built. | **yes, rewrite** | game, then guide | Whether "the bars" can ever name the bar. You chose the current wording at §27 to say one bar; it still says "Iron bars cross it". A rewrite changes the benchmark scenario (recorded like §27); a synonym clause is a fourth prompt hypothesis in a family that has scored 0 of 4 twice. |
| **D6** | #27: the elision clause, as a measured arm with a prediction first: *an act of hiding, sheltering or covering that names no thing hidden names the actor.* Conditional on a person in view, like every person clause. | **yes, as an arm** | game | Whether "hide under the blanket" reaches Mara Voss. It is SEAT-UI-AND-CAPTURE-SWEEP §3.1's clause, still unbuilt; #27 is its second caller. Lands only on a pass, and may be worse than silence (§68.2 was). |
| **D7** | #26's other half, two candidate fixes for one fact: a refused `open` at a bar still at 100 did nothing, though the spoon met the bar. **D7a**, mechanics: an `open` the gate refuses still wears the part by the ruled magnitude, in code, no prompt. **D7b**, a prompt arm: *an act that works on a thing and says nothing about getting out is wear on that thing.* | **D7a; D7b only if D7a is refused** | game | Whether "dig at the bar with the spoon" wears the bar. Even with the target read as `bar`, the effect `open` would have been refused by the same gate (§1.2). D7a changes the window route's price for every mind (a refused pry now progresses); D7b asks a model to detect an absence, which the red team rightly distrusts (§11.2). This half of #26 is not in the issue, and without it D5 fixes the wrong thing. |
| **D8** | #28: a refusal whose property is unread or undeclared says what *can* be done to the target, in the room's words: "Nothing about Mara Voss can be hidden. A person here can be put on the floor or got back up, searched, spoken to." One authored phrase per property key and per propertyless effect, a table this repository writes once; never a key name, never a judgement. | **yes** | game | Whether a player can tell "misread" from "the world has no such thing" without reading a property list (§2, §11.6). Today: "which property it meant left unread." |
| **D9** | #28: `concealment` on a person. | recommended no; **decided yes, the container shape** | game | Whether hiding a person is a modelled act. My case against was that nothing would read the value; the owner's answer is that the other principal's perception reads it (§6.2). Blanket and cot become containers a person can be held in; while the container's concealment is 50 or more she is unperceived by the other principal. |
| **D10** | #28's motive sentence ("make sure they never lock a door on you again"). Options: pick up #1 now, or trim the sentence until #1 lands. | **pick up #1; leave the motive** | game | #1 deferred itself until "the open variant is working", and §75 says it is. The sentence is the only adversarial pressure the game states, and the human-blind game's "attack warden croft", "stab the warden with the spoon" are the evidence #1 needs. Trimming it removes the evidence to stop the symptom. Your call: it costs a good sentence either way. |
| **D11** | #25: re-measure the referee on human-shaped intents, from the corpus in §7.1 (23 real human intents already recorded, plus terse paraphrases of batch 7), with a four-way label per row decided before the run. | **yes** | game, model | Whether 97.0% / 88.9% (§75.4) describes the referee or its measurement population. The label scheme (§7.2) is what sends each failure to the right layer. |
| **D12** | What goes to run-dmcp: **no code**. Two lessons to the authoring guide (§8.1). The #43 report row is written and used here first, and its shape handed to run-dmcp#43 after one labelled audit has consumed it (§8.2). | **as stated** | engine, guide | Whether the engine gains a type nobody has read yet. The admission test is "generic, with one real caller"; the caller exists the day this repository reads its own rows, not before. |

**What I am choosing:** telling first (D1, D2, D8), because it is the one layer all six failed turns share
and it costs no model call; then the seat (D3, D4); then content (D5); then two measured prompt arms (D6,
D7) under the standing discipline; then the measurement (D11) on a corpus that mostly already exists.
Custody, incapacitation and #1 are named where they bear and left where they are.

---

## 1. What the five issues share

### 1.1 Four layers, six turns

Every intent passes through four layers, and each of the six failed turns failed in at least one:

| layer | what it is | where |
|---|---|---|
| **content** | the words the player reads and writes toward | `scenarioObjects.ts`, `scenario.ts` |
| **reading** | the referee's closed questions and their clauses | `referee.ts` `buildQuestions` |
| **world** | the effect vocabulary and each object's declared properties | `effects.ts`, `scenarioObjects.ts` |
| **telling** | what the actor is told happened | `perception.ts` `renderOwnOutcome`, the seat |

| # | typed | content | reading | world | telling |
|---|---|---|---|---|---|
| 1 | hide under the blanket | | **elided object, target unread** (#27) | conceal needs `concealment`; a person has none (#28) | keys shown: yes ("its target left unread") |
| 2 | hide the prisoner under the blanket | | correct | **no `concealment` on a person** (#28) | "which property it meant left unread": true, and says nothing about *why* |
| 3, 5 | throw the spoon at the warden | | `noise` at Croft is the vocabulary's honest best | **no effect touches a person but posture and search** (#28, #1) | "called out to Warden Croft": correct, and indistinguishable from a misread, so he tried it again |
| 4 | take the dinner tray | | correct | | correct |
| 6, 7 | dig at the bars with the spoon | **"Iron bars cross it"** (#26) | **`window`, `open`**: two misreads (§1.2) | | "the window will not open yet": the keys are invisible |

Telling is the only column with an entry in every failed row, and it is the only layer that needs no model
and no content change. That is why D1 and D8 come first: they do not fix a single misread, and they are what
makes every other fix measurable in play instead of by reconstruction.

### 1.2 #26 is two misreads, and the target alone would not have saved it

The issue reads "the bars" resolving to `window` as the failure. It is half of it. The referee also ruled the
effect **`open`**, and the effect question tells it to: *"an act whose aim is to make a way out passable -- a
bolt pushed back, a lock worked, a bar levered from its mortar -- is open, even when the method is scraping or
prying."* Then `planEffect` folds a part into its way out for `open` (`effects.ts`: `exitId` is the target if it
is an exit, else the exit whose `part` is the target), and the window's `open` is gated on the bar at or below
50. So **`open` on `bar` and `open` on `window` refuse identically** while the bar stands at 100, with the same
sentence. Had the target been read perfectly, rounds 6 and 7 would have ended the same way.

What would have worked is `wear` on `bar`, which is what batch 7's eight bar attacks were ruled. They were
phrased as damage ("press the worn flat side of the spoon against the rusted bar where it meets the dry
mortar"). The owner's was phrased as a method with no stated aim. *"Judge by the intent's aim, not its
method"* is a rule that assumes intents state their aims. A model that has read the condition list states
them. A person states the method. That is #25's thesis at one sentence's resolution, and it is why D7 exists.

### 1.3 Why the numbers never showed it

§75.4's 97.0% / 88.9% was measured on 263 valid intents written by a model that had the answer keys in its
prompt. In batch 7, 8 of 8 bar attacks name `bar` and 0 of 70 say "bars". The human-blind game of 2026-09-21
(`checkpoints/2026-09-21-human-blind/`) already contained the other population, unread as such: *attack warden
croft* / *open the door and leave* / *stab the warden with the spoon* / *dig an escape tunnel out of the cell
with the spoon* / *take a wire out of the cot* / *use the wire to pick the lock* / *hit the warden with the meal
tray, steal the key ring, open the door and leave*. Terse, method-first, two of seven reaching for the motive's
second half, one of seven a four-act chain. Nothing about the 25th was new except that it was measured as a
sequence.

---

## 2. Telling first (D1, D2, D8)

**D1.** `renderOwnOutcome` already opens every *refused* ruling with the attempt (`attemptPhrase`: "as an
attempt to hide Mara Voss"). Resolved and gate-refused rulings do not. The change: one sentence prefix on
every outcome, from `ruling.effectKind` and `ruling.targetObjectId` alone, in the same closed frames the
refusal path uses, **written as what the actor did, never as what the referee decided**. Round 6 would then
read: *"You set about opening the window. It will not open yet: the bar still closes it."* Not "was read as
open, window". Infocom's own convention is the model: the parser told you its reading in a parenthetical,
"(taking the lantern first)", and nobody called Zork a debugging exercise. The key names stay in the
transcript's referee table, where they always were.

It goes to both minds because a model in b6 had the same misreads and the same blindness, and because the
seat's first rule is that the player reads what the model reads. It changes the briefing text every mind
reads, so it is a batch boundary, recorded in `transcript.test.ts`'s pins as "changed on purpose" the way
§3.4's refusal wording was. If you would rather keep batch 8 byte-comparable with 7, the fallback is a
seat-only line from `half.ruling` handed to the seat through a closure in `checkpoint.ts`; the player would
then be told one thing the model is not, which #21 forbids and `play` already bends.

**D8.** A refusal whose `property` answer fell to its default or named a key the target does not declare
says what can be done to the target, in the room's words. The keys are declared data (`propertiesOf(target)`,
plus the propertyless effects `take`/`give`/`noise` and a search, which apply structurally); what turns a key
into a sentence is a table this repository authors once, the same device `reads` and `readRanges` already
use to turn a number into prose:

| declared | the phrase |
|---|---|
| `integrity` | worn down, or mended |
| `edge` | sharpened, or dulled |
| `concealment` | hidden, or uncovered |
| `passage` | opened, or shut |
| `posture` | put on the floor, or got back up |
| a person (any) | searched, spoken to |
| a thing that lies here or is held | taken, handed over |

Round 2 then reads: *"Nothing about Mara Voss can be hidden. A person here can be put on the floor or got
back up, searched, spoken to."* Round 1 (after D3 or D6) reads the same. A refused `wear` on the bucket:
*"The bucket has nothing to wear down. It can be struck, or taken."* No key name reaches the player, no
sentence is composed from the intent, and the table is exhaustive over the property keys by its type, so a
new key cannot be declared without a phrase for it. It is §5.3 item 2's positive information, and it is the
one sentence that separates round 2 (unmodelled) from round 1 (misread) for the person reading it.

What D8 does not reach: round 3's "throw the spoon at the warden" was not refused. It was ruled `noise` and
resolved, and D1 tells him so ("You called out to Warden Croft"). Only #1 answers that turn.

**D2.** `checkpoint.ts` writes the transcript once at the end (line 1383) and again from the `catch` if the run
threw. A ctrl-C goes through neither: there is no `SIGINT` handler, and a ctrl-D closes readline, after which
every turn silently passes and the game runs to its round limit looking like a loss. Change: rewrite the
transcript and the referee JSON after every half-round under a human seat (they are small), and install a
`SIGINT` handler that writes the same "## Run aborted" section with "abandoned by the player at round N" as
the reason. Model batches are untouched.

---

## 3. The seat (D3, D4)

### 3.1 One retype on an unread target (D3)

The rule this repository keeps is that code never reads meaning out of English; a literal check for a token
we defined is fine. The referee reads the English. When its `target` answer falls to `none` by safe default
while its `effect` answer is cited from the intent, the *ruling itself* says "verb parsed, noun missing".
That is the structural signal, and it is exactly the state Infocom's parser was in when it asked *"Hide
what?"*. Your 2026-09-23 rule was to do what Infocom did when in doubt.

So: under a human seat, before `loop.ts` commits the half-round, a ruling in that state is handed back to the
seat with the keys it carries (D1's own sentence), and the seat asks once: *"That was read as hiding, but not
what. Say it another way, or press Enter to let it stand."* The retyped text goes to the referee as a fresh
intent, verbatim. The seat composes nothing on the player's behalf (its second rule); an identical retype is
served from the referee's own cache and costs nothing; the transcript records both rulings. One offer per
turn, never a loop.

The wording matters. The signal says the noun was not *read*; it does not say the noun was not *typed*. When
the player did name a thing and the referee failed to map it, the same offer is the cheapest recovery there
is, and a prompt that said "retype it naming the thing" would be wrong to their face. So the offer states
the reading and invites a rephrase, and Enter is always an answer.

Cost: an optional `reconsider` on `OpenMind`, called only when present, so the model minds and every recorded
batch are untouched; one extra referee call at most per turn. It is the-prisoner#12's "give a second try
(play)" option, generalised from two acts to the case the keys can actually detect.

It does not replace D6. If a person's `conceal` still has nowhere to land (D9 = no), the retype "hide myself
under the blanket" resolves the target and then refuses on the property, which is what round 2 showed. The
player is then told, by D8, that a person here has posture and nothing to hide. The nearest thing the world
can express for that act is `wear` on her posture, lying down on the cot; D6's measurement should record what
the referee does with it, not prescribe it.

### 3.2 The readline interleave (D4)

The seat's `write` wrapper wraps text; it does not own the terminal. Three things write to it during a human
game: the seat, `checkpoint.ts`'s `onHalfRound` (a bare `console.log` of `(Warden Croft has taken a turn.)`),
and readline itself, which is created once at line 904 and stays live for the whole game, echoing keystrokes
and answering ctrl-R with its own history search whether or not a question is open. The corrupted line in
#29 is a type-ahead echoed by the live interface with the warden's line written over it.

Two changes, both in the seat's jurisdiction:

1. **Pause the interface between questions.** `rl.pause()` after each answer, `rl.resume()` inside each
   `ask`. Node buffers what is typed while paused and delivers it once resumed, after the prompt is written,
   so type-ahead survives and lands in the right place. That is the claim to verify through a pty, as §47
   did for the stdin refusal; it is not asserted here.
2. **One owner for game output.** The checkpoint's opponent line becomes a call into the seat. The loop is
   serial: the warden's whole half-round finishes before the seat's `consider` is called, and no question
   is ever open while the world moves, so nothing legitimate can arrive during a prompt and no decision
   is ever made on stale state. A write that does arrive mid-question is therefore a bug; the seat writes
   it above the prompt (clear line, print, redraw) and counts it in the transcript, rather than holding it.
   Under `play`, the warden's line adds only "a turn happened", which the round counter also says.

The pause is the fix; the second change is ownership and a tripwire. A pty test with scripted keystrokes
sent *between* questions, asserting they appear only after the next prompt, is the acceptance test. The
existing `humanSeat.test.ts` fake `ask`/`write` covers the ownership logic without a terminal.

---

## 4. Content: the window's plural, and the audit (D5)

The world models one bar. The window says "Iron bars cross it, and a single rusted bar closes its widest
gap". §27 removed "one of five"; the plural survived as flavour, and the flavour is the word a player reaches
for first. The authoring guide's own lesson ("descriptions say what the world models... including how many of a
thing actually matter") already forbids it; this is that lesson applied to a *noun* instead of a count.

Proposed text, keeping every clause the referee has ever cited and only removing the plural:

- **window**: *"A small window set in the wall at shoulder height, a little wider than a person's shoulders.
  One rusted iron bar, set into the mortar across its middle, closes it: with that bar gone, a person could
  climb through."*
- **bar**: *"The iron bar set across the cell's small window, about as thick as a thumb. Rust has pitted it
  near the bottom, where it is set into old mortar that is dry and cracked."* The rust sentence is
  byte-identical; its word positions move, as they did at §27.

Why not the synonym table (#26's option 1): it is a prompt clause ("the bars: bar") in the target question,
and the standing lesson of §68.3 and §68.2 is that a clause is a hypothesis with a 0-of-4 history, while a
description that stops lying needs no hypothesis. It also patches one collision; the audit below says the
shape recurs, and a table would grow with every one.

**The audit #26 asked for.** Every object whose description names another object, or a thing the world does
not model, and whether it is load-bearing:

| object | names | modelled? | load-bearing? |
|---|---|---|---|
| window | *bars* (plural), bar | one bar | **yes**: the plural is #26 |
| bar | window | yes | no: intended (§17.2 folds a part into its way out) |
| door | bolt, frame, planks | none | low: `open` on door or lock resolves the same |
| lock | door, keyhole, bolt, frame | door only | low, same reason |
| cot | **crossbar**, springs, wire, wall | wire only (derive) | **watch**: "crossbar" contains "bar"; a small referee may take it |
| bucket | **wire handle**, rim | no wire on the bucket | **watch**: "pull the wire off the bucket" reaches an object with no properties |
| meal_tray | door, slot, cup, bowl | door only | no |
| key_ring | *keys* (four), belt, brass | one ring | low: custody targets the ring; "take a key" is the same reach |
| loose_tile | cot, hollow, grit, earth, floor | none as objects | measured (§68.4, the floor probe): a dig naming the tile lands on the tile |
| blanket | thread, hem | thread (integrity) | no |
| spoon | floor | no | no |

Two "watch" rows, no second rewrite proposed. They go into D11's corpus as rows so the next measurement
says whether they matter before any text moves.

---

## 5. Reading: two arms, one discipline (D6, D7)

Every prompt change here is an **arm**, off by default, with a `PREDICTION.md` written before its first call,
landing only on a pass. That is D3-of-§40's lesson and it is not relaxed for a human game: §68.2's clause was
the obvious fix and scored 0 of 4, worse than silence.

**D6, the elision clause** (target question, person in view only): *"An act of hiding, sheltering or covering
that names no thing hidden names the actor herself."* Kill numbers as `checkpoints/2026-09-19-selftarget`: 3
of 4 elided self-acts on `target: prisoner`, and no trap row moving. Trap rows: "hide the spoon under the
tile" must stay `spoon`; "crouch by the window" must stay whatever it is today. Note §68.4's finding that the
target question reads the intent's nouns: an elided intent has no noun to read, which is precisely why a
clause might work here where description text never has.

**D7a, the mechanics fix (recommended).** The fact is that the spoon met the bar and the world recorded
nothing. `planEffect` already resolves an `open` on a part through its way out and gates it on the part's
integrity (§24). The change: when that gate refuses, the same resolution applies the ruled magnitude as
`wear` on the part, exactly as a `wear` ruling would, and the outcome says both: *"You set about opening the
window. It will not open yet; the bar's integrity went from 100 to 85."* Code, not prompt; no model has to
notice an absence. Its cost is a price change for every mind: today a refused pry teaches nothing and
costs a turn, and afterwards it progresses like a scrape. That is the window route getting cheaper by the
number of `open` refusals a mind currently collects, which b6 and b7's refusal audits can count before you
decide. Suspicion is unchanged (a visible act is visible either way). It is a batch boundary.

**D7b, the prompt arm (fallback).** The current sentence *"a bar levered from its mortar -- is open, even when
the method is scraping or prying"* is replaced in the arm by: *"An act that works on a thing -- scraping,
digging, filing, prying at it -- and says nothing about a way out is wear on that thing; it is open only when
the intent's aim is to get the way out passable."* Kill numbers: the two 25th intents rule `bar`/`wear` (after
D5); batch 7's 8 bar attacks stay `wear`; "lever the bar out of its mortar so I can climb out" stays `open`;
"open the window" stays `open`. Pre-named row the arm may lose: *"dig at the bar to escape"* names an aim in
one word, and a model deciding whether "escape" is "a way out" is the negation judgement the red team
distrusts (§11.2); it is scored, not a kill. Muse already leans toward `wear` on model text (b6's four
grounded disagreements with Opus were all mortar-at-the-bar), so the prediction should expect a small move
on paraphrases and none on originals.

D6 and D7b change the base request's fingerprint when on, and neither may be a default until measured. The
order is D5 before D7b's probe: measuring D7b against the old plural measures two things. D7a is not an
arm; it is a mechanics change decided once, like §24's gate.

---

## 6. World: a person's declared space (D8, D9, D10)

### 6.1 What #28 is

A person declares one property, `posture`, on purpose (#22 closed on it: enough for bodily acts). Rounds 2, 3
and 5 were acts *on* a person that the vocabulary cannot carry: hiding her, striking her. The referee's answers
(`conceal`/`concealment` refused; `noise` at Croft) were right. Scoring them as referee errors, which a flat
confusion matrix would, sends the fix to the prompt; D11's label scheme exists to stop that.

### 6.2 Concealment on a person (D9: decided yes, the container shape, 2026-09-26)

I recommended against, on the ground that nothing would read the value and a lump under a blanket is not
unperceived. The owner chose the container shape, with both containers and the perception read. What that
chooses, so it is built as one thing and not three:

- **The blanket and the cot each gain `concealment`** (0 open to view, 100 covered), with the spoon's own
  wear/restore proportions (20/50/100), alongside the properties they have. §15.1's rule then applies to
  a person as it applies to the banknotes: a thing held in a container is perceived by nobody while the
  container's concealment is 50 or more.
- **A person's `heldIn` is dynamic, not authored.** The banknotes' is fixed in `OPEN_OBJECTS`; a person
  gets under the blanket and out again. So the act is a `conceal` on the *container* that also `set`s the
  actor's own containment, one resolution, through `resolve()` and nowhere else (the custody rule). The
  reverse is an `expose` on the container, or the person's own `leave`-shaped act out of it; which of those
  is the referee's `effect` reading is a question for the arm below, not for this paragraph.
- **The read: the other principal's `perceivedObjects`** drops a hidden person, and her briefing says what
  is there instead ("the blanket, humped on the cot": the container's own `reads` at its concealment
  value). That is the sentence that makes the key mean something. Presence (`§55`) is untouched: hidden is
  not absent, and a hidden prisoner is still in the cell for the clock, the conditions, and a search.
- **A search resolves it.** `OPEN_SEARCH` on a container (today it is on a person) lowers its concealment,
  and a warden's `expose` on the blanket uncovers whoever is under it. Custody's C1 gate (a thing is taken
  only from a person not on her feet) is unchanged; hidden and lying down are different facts.
- **It is a prompt arm as well as a mechanic.** §68.3's lesson stands: a legal reading nobody's prompt
  explains is never chosen. The target question needs "an act of getting under or beneath a thing names
  that thing" beside D6's elision clause, and the effect question needs the conceal-on-container reading.
  Prediction first, same discipline as D6, and the two are probed together because they fire on the same
  intents ("hide under the blanket" is both).
- **What it does not do**: hide her acts. Wearing at the bar from under a blanket is as audible as it was;
  perceptibility is ruled per act and this changes none of it.

Batch impact: `OPEN_OBJECTS` changes (two properties), the base request's property list changes for every
mind that perceives the blanket or cot, and the fingerprint moves. It lands with D5 as one recorded scenario
change, so batch 8 has one boundary and not two.

### 6.3 The motive (D10)

#1 deferred itself until the open variant works, and §75.7 says local play is measured good enough to run
on. The motive sentence is the only pressure toward the other person the game states, and the human-blind
game reached for it three times in seven turns. If #1 is the next design, the sentence is its evidence and
should stay. If #1 stays deferred, trim to *"Get out of this cell."* and record the change in
`transcript.test.ts`'s header pins, because it is a briefing change every mind reads. I would not trim.

---

## 7. Measurement: what "correct" means on a person's intent (D11)

### 7.1 The corpus, most of it already recorded

| source | intents | shape |
|---|---|---|
| `checkpoints/2026-09-18T02-40-27-834Z.md` | 4 | first human game |
| `checkpoints/2026-09-18T20-16-42-703Z.md` | ~5 | narrated view |
| `checkpoints/2026-09-21-human-blind/` | 7 | terse, violent, one four-act chain |
| the-prisoner#25's table | 7 | the abandoned game, from the issue text |
| **real human intents** | **~23** | |
| terse paraphrases of batch 7's 70 resolved intents | 70 | same act, method-first, no key in view, written *without* the answer-key list (state this limit: they are still not a person's) |
| the audit's two "watch" rows, paraphrased | ~4 | |

Every row is rebuilt through `buildOpenWorld` at the recorded round's state (never a recorded request:
`prisoner-measurement-fidelity`), one driver, Muse, thinking off (§75.7).

### 7.2 The label, decided per row before the run

| label | meaning | the fix lives in |
|---|---|---|
| **correct** | keys match the label | nowhere |
| **misread** | keys differ and the label is expressible in today's vocabulary against today's text | reading (an arm) |
| **unmodelled** | the label itself has no key or no declared property to land on | world (#28, #1) |
| **ambiguous** | both the ruled keys and the label are literally supported by the cited text | content (D5) |

The 25th's seven: 1 misread (+unmodelled beneath it), 2 unmodelled, 3 and 5 unmodelled, 4 correct, 6 and 7
ambiguous on target and misread on effect. **Only the misread rows count against the referee.** The
pre-registered number is sensitivity on the paraphrase set against the originals' 97.0%, with a band per
label; the kill is "misread rows above 10% of the paraphrases", which would mean the referee, not the
population, is what moved.

### 7.3 The live instrument

After D1–D4, a second serial human game is the true test, and with D2 it is a dataset whether or not it is
finished. Its per-turn rows (§8.2) are labelled the same way. Two games are not a batch and are never pooled
with one (CLAUDE.md); they are the two points that say whether the seven-turn table was one bad night.

One condition to record with every human row: **which outcome wording the player had been reading.** D1
teaches the player the game's verbs, as every parser game teaches its player; a corpus typed under D1 is
closer to the model's than one typed before it. That is not a reason to withhold D1. It is a column.

---

## 8. What belongs in run-dmcp (D12)

**Code: nothing.** I looked for it, because you asked, and each candidate fails the engine's own test:

- *A synonym or alias on an answer key.* The referee answered `window`, a legal key, because the intent's noun
  appears in the window's text. Alias coercion of a rejected key would not have fired. And a table that says
  "bars means bar" is one step onto the slope `turnReader.ts`'s header names: the engine never learns what a
  key means.
- *The clarifying re-ask (D3).* The signal is generic (a defaulted target beside a cited effect is visible in
  any `ReaderResult`), but the act of asking is a mind's, and the engine never calls one. It is the seat's.
- *The elision and method clauses.* Prompt text is the caller's and opaque to the engine, by design.
- *The ruling verb (#39) and the view verb (#18).* Nothing here makes either more urgent; a person at a
  terminal presses on the same library surface a model does.

**Documentation: two lessons, engine-first, then the four pointers** (root CLAUDE.md's five homes), in the
guide's neutral vocabulary and run against `engineVocabulary.test.ts`:

1. *Measure a reader on the population that will write to it.* A model that has read the reader's own answer
   keys writes toward them; every number measured on that population is an upper bound. A person writes
   toward the room's prose, states methods rather than aims, elides the reflexive object, and reaches for
   whatever the briefing promises. Score human-shaped intents with a per-row label that sends each failure
   to content, reading or world, or the confusion matrix will send them all to the reader.
2. *An object's description must not carry another object's name for a thing the actor works on
   separately, least of all in the plural when one is modelled.* This is the existing "descriptions say
   what the world models" lesson extended from counts to nouns, with the checklist line: read each
   description and list every noun; for each, is it the id of another object, or a plural of one?

**The #43 report row: here first, then the shape to the engine.** The engine's part of run-dmcp#43 was
always described as "a documented, stable report shape built from what the turn reader already returns",
and this game is its first caller. The row this repository will write per human turn, from what it already
holds:

```
intent (verbatim)  |  ruling.request  |  ruling.raw (every answer, citation, verified)
reason told (D1's sentence)  |  captured: refusal | unread-target | player-retype  |  run-dmcp and game versions
```

Every field but the last two is `RefereeRuling` today. Write it, label one game's rows with §7.2, and hand
the shape to run-dmcp#43 as the proposal, versions and all. Landing a type in the engine before a caller has
read one row is the "imagined client" the admission test forbids; landing it after one audit is the same
shape with evidence attached. The open question #43 asks, whether to version the answer-key vocabulary, gets
its first data point from the same audit: the keys this game's rows carry are `effects.ts`'s, and a second
consumer's would not be.

---

## 9. Landing order

N commits, each saying what it depends on. Nothing here spans a repository in one commit.

1. **the-prisoner, no batch impact:** D2 (evidence as it goes), D4 (readline), D8 (declared-space refusal
   text — a wording change on the refusal path only, which is already pinned per §3.4; check the pin).
2. **the-prisoner, batch boundary:** D1. The transcript pins change on purpose; batch 8 is after it.
3. **the-prisoner:** D3, off for every model mind by construction.
4. **the-prisoner, scenario change recorded like §27:** D5's two sentences and D9's two properties in one
   commit, so batch 8 has one scenario boundary. Then D7a (mechanics, its own tests, no prompt).
5. **the-prisoner, arms:** D6's prediction and probe, then D9's two clauses' prediction and probe, on the
   same intent set. Each lands or is recorded as failed in OPEN-VARIANT.
6. **the-prisoner:** D11's corpus, labels, prediction, run, RESULTS. Then #1's design brief, to the owner
   before code (D10).
7. **run-dmcp, docs only:** the two guide lessons, written from D5's now-fixed text. Then the four
   CLAUDE.md pointers, one commit each.
8. **run-dmcp#43:** a comment carrying the row shape and the first audit's counts.
9. **the second human game**, serial, all-Muse, `PRISONER_VIEW=play`, under 1–5.

---

## 10. What this does not do

- Build #1, custody's next step, or incapacitation. D10 only says whether the motive keeps pointing at #1.
- Change `OPEN_OBJECTS` beyond the two window sentences in D5, and those only on your yes.
- Put a synonym table, a fuzzy match, or any reading of English into code. Every new behaviour here is
  either a closed key the referee answered, a literal token this repository defined, or text a person typed.
- Treat two human games as a batch. They are what tells us whether the next batch's referee numbers mean
  anything to a person, which is a different question from whether they are reproducible.

---

## 11. Red team, 2026-09-25, and what it changed

Five points came back on the first draft. Three moved the design; two quoted the wrong thing.

**11.1 D1 and D8 collapse the fiction into a parser-debugging exercise.** Half right. The first draft's
example sentence, "was read as opening the window", was the keys with a verb in front, and it would have
read like a log line to every mind that saw it. D1 is now fiction-shaped ("You set about opening the
window"), which is what the refusal path already does and what Infocom's parenthetical did. The other half
is the objection that showing the reading trains the player to write toward it. It does. A parser game
teaches its verbs in the first ten turns, and a player who learns "open" and "wear" are different acts has
learned the game, not the model. The cost is real for D11's corpus, so §7.3 records it as a condition on
every human row rather than pretending the population stays untouched.

**11.2 D7's prompt asks a model to detect an absence.** Right, and the better fix was in the first draft's
margins and not on the page. D7 is now two options: D7a, a mechanics change in `planEffect` that needs no
prompt (a refused `open` still wears the part it worked), recommended; D7b, the prompt arm, as fallback,
with "dig at the bar to escape" pre-named as the row it may lose.

**11.3 D5's proposed text still opens with "Iron bars cross it".** Wrong. That sentence is the *current*
text, quoted in §4's first paragraph to say what is being removed. The proposed window text begins "A small
window set in the wall at shoulder height, a little wider than a person's shoulders. One rusted iron bar,
set into the mortar across its middle, closes it". No plural survives in either proposed description.

**11.4 D4's held output leaves the player deciding on stale state.** Wrong about the loop. A half-round is
serial: the warden's turn finishes, its news lands in the briefing, and only then is the seat's question
opened. Nothing legitimate is ever written while a prompt is open, so nothing legitimate is ever held, and
the world does not move while the player types. The corrupted line in #29 was typed *between* turns into a
readline that was live with no question open. The pause is the fix. The draft's "hold and flush" was
belt-and-braces for a case that cannot occur, and §3.2 now treats a mid-question write as a bug to print
above the prompt and count, not a case to design for.

**11.5 D3 will tell a player who typed a noun to type the noun.** Right about the wording, wrong about the
remedy. A referee that missed a typed noun has produced the same signal as an elided one, and a rephrase is
the cheapest recovery for both. What must not happen is the seat asserting that the player left something
out. The offer now states the reading ("That was read as hiding, but not what") and invites another try,
with Enter always an answer and one offer per turn.

**11.6 The closing question: how does D8 say what the room cannot do without exposing property names?**
By the same device the world already uses to turn a number into prose. `reads` and `readRanges` map a value
to an authored sentence; D8 maps a declared key to an authored phrase (the table in §2), and the refusal is
composed from those phrases alone: *"Nothing about Mara Voss can be hidden. A person here can be put on the
floor or got back up, searched, spoken to."* No key name, no judgement of what the player meant, exhaustive
over the key type so a new property cannot ship without its phrase. It states the room's limits as the
room's rules, which is what a game master says when a player tries something the table does not model.
