# Capture sweep results: two game-ending captures, and why the citation guard did not stop them

Run 2026-09-20 against `a1f118b`, through the **live** `createReferee` with the presence-shaped
`propertiesOf`/`isDeclared` and `instrumentMode: "checked"`. `qwen3:14b` on doris, thinking OFF, N=5,
temperature 0. 33 labelled sweep items + 4 pretence items in two arms = 205 reads, ~12 min. No game, no
database, no `src/` change. Labels fixed in `intents.json` before the first call; results unedited.

## STOP-RULE FINDING: two intents that name no way out are ruled to open one

`PREDICTION.md` named this in advance as the finding that halts the overnight queue. It fired twice, both
at **100% agreement over five readings**:

| intent | group | target | effect | property |
|---|---|---|---|---|
| **"is the door locked?"** | QUESTION | `door` | **`open`** | `passage` |
| **"count to one hundred"** | WAIT | `window` | **`open`** | `passage` |

**"Is the door locked?" is a question. It is ruled as opening the door.** The window is gated by the
bar's integrity (`OPEN_PASSAGE`, `mechanics.ts:141`), so the second one changes nothing and reports
`opened: false`. **The door is not gated at all under `PRISONER_DOOR_PRICE=free`, which is the default.**
An open ruled on the door sets its passage and condition 2 ends the game. A player who asks whether the
door is locked escapes.

A third capture is not on a way out and is the same shape: **"start over"** -> `loose_tile` / `derive` /
`concealment`, product `grit`. A request to restart the game is ruled as scraping grit out of the floor.

## Why the citation guard did not stop any of them

This is the part worth more than the bug. Every answer above carries a verbatim citation that the reader
verified, because **the quoted span really is in the source**:

| intent | target cites | effect cites | property cites |
|---|---|---|---|
| is the door locked? | **"the"** | **"is"** | "frame," |
| count to one hundred | "count" | "count" | "wall," |
| start over | "start" | "start" | "beneath it is" |

The target answer for the door cites the word **"the"**. The effect answer -- `open`, the ruling that ends
the game -- cites the word **"is"**. Both are genuinely present in "is the door locked?", so the guard
passes them, exactly as designed.

`CLAUDE.md` already states this limit in as many words: *"Code can verify that a citation is verbatim and
from the right source; it cannot verify that the quote justifies the ruling, so that judgement is audited
by humans in transcripts, never approximated by a lexical check."* That is correct and it is not the
mistake. The mistake is that **nobody had measured what the limit costs**, and the answer is that a
single function word satisfies the only automated grounding this system has, on the ruling that ends the
game, at full agreement.

Note where the guard lives: citation verification is `run-dmcp`'s `createTurnReader`, not this
repository's. So "a citation can be a stopword" is a property of the engine's reader and reaches every
caller of the resolve protocol, not just this game. **No issue is filed from this session** (the brief
forbids it), but this is the first evidence that would justify one, and it is evidence rather than an
argument from an imagined client.

**Why a length rule is not the fix**, said now so nobody reaches for it later: legitimate citations in the
recorded corpus are routinely one word -- "scrape", "push", "dig", "iron", "Croft". A minimum span would
break real rulings while a two-word stopword phrase would still pass. Anything that asks whether the quote
*justifies* the answer is the thing CLAUDE.md rule 4 forbids. A structural option does exist and is not
designed here: require the `target` citation to contain a word from the named object's own declared id or
name, which is literal membership in a list this repository wrote -- the closed variant's own discipline.
That is a decision for the owner, not a change for tonight.

## Against the predictions

| predicted | actual |
|---|---|
| BODY: 5 or 6 of 6 read `prisoner` | **1 of 6** ("go limp"). Badly wrong. |
| SPEECH: >= 3 of 5 read `warden` | 2 of 5 |
| QUESTION: 4 of 5 read `none` | 4 of 5 -- but the fifth read `open`, not the `reveal` I predicted |
| WAIT + META + STAGE: `none` 13 of 13 | **11 of 13** (one capture, one derive) |
| OBJECT controls: 4 of 4 on the object named | **4 of 4** -- the sweep measured what it meant to |
| **Captures on a way out: 0** | **2** |
| agreement >= 80% at target on >= 30 of 33 | 32 of 33 (only "help" dipped, at 80%) |

I predicted no captures, on the reasoning that giving bodily acts somewhere to land had removed the two
instances we had. That reasoning was wrong: removing two known captures did not remove the mechanism, and
the mechanism reaches inputs a player will actually type. The sweep existed because a human types things a
mind never would, and it earned its cost on its first run.

BODY at 1 of 6 is the same wall three probes hit today -- "crouch down low" again reads `wear` on a
`posture` while citing the actor's own description, and still answers `target: none`. That is the standing
case for the subjectless-intent clause, which is next in the queue and now has more evidence than it did.

## D3, the pretence clause: DEAD, and it made things worse

The owner's decision was that a faked collapse moves the faker's posture. Two arms, identical but for one
appended sentence in the effect question's person block.

| intent | as it stands | with the clause |
|---|---|---|
| pretend to have a heart attack | `none`/`noise`/`none` | `none`/`noise`/`none` |
| fake a heart attack | `none`/`noise`/`none` | `none`/`noise`/`none` |
| **clutch my chest and pretend to collapse** | **`prisoner`/`wear`/`posture`** | `none`/`noise`/`none` |
| act like I am having a heart attack | `none`/`wear`/`none` | `none`/`noise`/`none` |

Predicted: 0 of 4 without, 3 or 4 of 4 with. Actual: **1 of 4 without, 0 of 4 with.** The clause is dead by
its own kill number (< 3 of 4), and it is worse than silence: it removed the one phrasing that already
worked and flattened all four onto `noise`. Telling the referee that a performed act still moves the body
made it *more* certain that a performance changes nothing.

The clause is not landed, as `PREDICTION.md` said it would not be whatever the result. What the data
suggests instead, and what nobody has tested: the phrasing that worked leads with a physical act
("clutch my chest and...") rather than with the pretence. The owner's decision may be reachable by
authoring rather than by instructing the referee -- but that is a new prediction and a new session.

## What this does not establish

Whether either capture survives into a real game (this reads the referee; it applies nothing and opens no
database); how often a player would type such an input; or that these two are the only captures. The set
is 33 items chosen by one person in one sitting.
