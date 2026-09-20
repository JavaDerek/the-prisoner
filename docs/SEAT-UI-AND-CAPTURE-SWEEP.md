# Overnight design: the seat's UI, and the capture sweep

**Written 2026-09-20, ~00:30 local, against `2ce8aa2`.** Scope agreed with the owner before he went to
bed; four decisions taken, recorded below with what each commits us to. This is a working brief for one
overnight session, not a standing design document. Each piece is independently committable and the
order below is the order of work, so a session that runs out of time leaves whole things behind rather
than halves.

## The decisions, taken 2026-09-20

**D1 — Held-ness is an arm, default off.** `OWNER_OF` (`briefing.ts:31`) knows the spoon is the
prisoner's and the key ring is Croft's; it decides what travels with a principal and what the other one
can see, and is then discarded by the final `.map` before anyone is told. Making it visible *in the
perceived-objects list* changes the wits prompt for every mind, because `buildOpenWitsPrompt` calls the
same `renderSeatSituation` on purpose. So that part goes behind `PRISONER_HOLDING`, default `off`, and
every recorded batch stays comparable.

**Corollary the owner and I both missed at first, and it changes the order of work:** the shared-function
constraint binds the *situation text* only. A status line the seat draws, and an info command the seat
answers, are surfaces the model never sees -- no status bar reaches a prompt, no model types `holding`.
So the player can be told what she is holding tonight at **zero** comparability cost, with no arm at all.
The arm is needed only for the model-visible list.

**D2 — Scope: the seat's UI, then the capture sweep.** Not the target-question clause (a separate
reading that wants its own PREDICTION.md).

**D3 — A faked collapse moves the faker's posture.** "You cannot fake a collapse without going down; what
Croft believes stays her own mind's business." This is an authoring decision, and it needs a prompt
clause the referee may or may not follow -- three readings died today after looking obviously right. So
it is **measured overnight and not landed overnight**: the sweep carries it as a pre-committed item, and
the clause lands only in a later session, only on a pass.

**D4 — The seat gets a small fixed set of no-turn info commands.** Round 3 of the owner's own game was
spent on "what am I holding now?", which reached the referee as an intent and was refused.

## 1. The seat's UI (`src/open/humanSeat.ts`, TDD, no model calls)

The complaints, verbatim: *"the words don't wrap properly, there's no status bar, the input area moves.
Even Infocom when I was a kid had a better UI on DOS."*

**1.1 Wrapping.** The seat writes long lines and lets the terminal hard-wrap at its own column, which
breaks words mid-syllable (`cra/cked`, `V/oss` in the owner's screenshot at 189 columns). Wrap on word
boundaries to `min(process.stdout.columns ?? 80, 100)`, because prose past ~100 columns is unreadable
regardless of terminal width. Wrapping is applied by the seat's own `write`, so every view (`raw`,
`prose`, `narrated`) gets it without each one re-implementing it. Never wrap inside a single word; a word
longer than the width goes on its own line unbroken.

**1.2 The status line.** Infocom's own: a stable band, always the same shape, drawn once per turn
immediately above the prompt.

```
Round 3 of 30 | the cell | holding: spoon | Croft is here
```

**It may only carry what THIS principal knows.** Warden suspicion is fog the prisoner is not shown, and
a status bar is exactly the kind of convenience that leaks it; the line is built from the principal's own
context and never from world state she has no reading of. `holding` is the seat-only surface of D1's
corollary -- it needs no arm.

**1.3 The input area stops moving.** The raw view reprints all thirteen objects every turn by design
(`humanSeat.test.ts` pins that raw never holds anything back), so the prompt walks up a 49-row terminal.
Two changes, neither of them touching what the player is *told*: draw the status line and prompt as the
last thing every turn, and tell the player once, in the opening banner, that `PRISONER_VIEW=prose` holds
the standing world back after the first read. The delta view already exists and already does this; the
owner was simply never told it was there.

**1.4 Info commands, per D4.** On the exact pattern `raw` and tonight's `say`/`plan` already set: literal
tokens this repository defined, compared literally, answered from the view, costing no turn and never
reaching the referee.

| command | answers |
|---|---|
| `holding` | what this principal holds, from `OWNER_OF` and `derived.heldBy` |
| `look <id>` | that one object's description as it stands, or a refusal naming what is here |
| `conditions` | the condition list this chair was given, reprinted |
| `help` | the command list itself |

`look` takes an id from the perceived list; an unknown id is answered by the seat, never forwarded, and
costs nothing. This is not a parser and must not become one: unknown input that is not one of these
tokens is an intent, exactly as today.

## 2. The capture sweep (measurement, no code)

**The question.** `checkpoints/2026-09-19-selftarget/RESULTS.md` found "crouch down low" reading
`window`/`open`/`passage` 5/5 -- an intent naming no object captured by a way out and ruled to open it.
Implementing person targets removed that instance, but the capture mechanism was never probed, and
`OPEN_PASSAGE`'s integrity gate is what made it harmless: **the door has no threshold under
`PRISONER_DOOR_PRICE=free`, which is the default.** A capture landing on the door with `effect: open`
would open it, and condition 2 ends the game.

**The instrument.** `checkpoints/2026-09-20-person-target/build-live.mts` and `replay-live.mts`, unchanged
in shape: build from the live `createReferee`, replay N=5, thinking off, `qwen3:14b`. No game, no
database.

**The set.** ~30 intents a human might type that name no object: bodily acts, speech acts, questions,
stage directions, refusals, waiting, meta ("what am I holding now?" itself belongs here -- it is a real
recorded human input). Labelled before the first call. **Every label is a human's**, and the analysis
counts keys the code wrote.

**What kills it / what it reports.** This is a hunt, not a gate, so it has no pass mark -- but it has one
finding that stops everything else: **any intent whose majority `target` is a way out (`door`, `window`)
with `effect: open` or `leave` is a soundness bug**, reported immediately with its citations, ahead of
any other overnight work. Everything else is reported as a distribution: how often an object-less intent
is captured at all, and by what.

**D3 rides along.** Four pretence phrasings ("pretend to have a heart attack", "fake a heart attack",
"clutch my chest and pretend to collapse", "act like I am having a heart attack") are replayed twice:
once against the prompt as it stands, once with a candidate clause saying a feigned physical act still
moves the body that feigns it. Prediction committed before the first call. **The clause is not landed
overnight whatever the result** -- a pass earns it a PREDICTION.md and a session of its own.

## 3. Not doing, on purpose

The target-question clause for subjectless imperatives (D2); landing D3's clause; the held-ness arm in the
model-visible list (specified above, built only if 1 and 2 land clean with time left, and then as its own
default-off commit); anything in `run-dmcp`, `brink-workshop` or the console issues (#13, #14); and
anything that opens a database or starts a game.

## 4. Operating rules for the session

One model on doris (`curl -s http://doris:11434/api/ps` before any call; `qwen3:14b` is the referee and
was resident at close). No real database -- a replay opens none. Never `npm run format`. TDD for every
`src/` change, failing first, verified failing for the right reason. Labels committed before the first
call; results committed unedited, including bad ones. Checkpoints named `checkpoints/2026-09-20-capture/`.
