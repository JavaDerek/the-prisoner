# the-prisoner#1, built: the attack move (2026-09-28)

Written after `docs/ISSUE-1-DESIGN-BRIEF.md`'s §4 (the owner's Q1-Q5 answers, binding) and the coordinating
session's own decisions on top of them, taken on the owner's behalf under his overnight delegation. TDD
throughout: `src/open/__tests__/harm.test.ts` plus the pins listed in §6 below. No code change here landed
without a red test first.

## 1. What landed, and why

**Q1 (open variant only).** No closed-variant change. `src/world/vocabulary.ts`'s move enum is untouched.

**Q2 (a new property, `condition`, gated and priced).** `condition` (`src/open/scenarioObjects.ts`) is a
person's own bounded state, 100 unharmed down to 0 disabled -- the §56 model `posture`/`sight` already use, a
third instance of the same shape. It is declared on `OPEN_PERSONS` UNCONDITIONALLY (the same choice `world.ts`
makes for the bar's `integrity` under the welded arm): the property is authored content, always true of the
scenario, and it is the RESOURCE-CREATION loop in `buildOpenWorld` -- gated on the new `harm` option, never the
declaration -- that skips building it while `PRISONER_HARM=off` (the default). `declaredProperty`/
`declaredPropertyKeys` (`world.ts`) already gate on whether a resource exists, which is what makes this
byte-identical when the arm is off; that per-object shortcut had to become per-KEY for `condition` (§3 below),
since posture/sight and condition are no longer always built together.

**A new effect kind, not a reused property.** `harm` (`src/open/effects.ts`) is its own `EffectKind`, whose only
property is `condition`, offered to the referee only when `PRISONER_HARM=on` AND a person is in view. The
brief's own reasoning: overloading `wear`/`posture` further (as an attack does today, unmodelled) would make a
compliant crouch and a stab wound the same fact, and `readRanges` cannot narrate that honestly. Separating the
EFFECT (not the property) is also where the referee's own ambiguity lived (`docs/ISSUE-1-DESIGN-BRIEF.md` §3):
"attack" and "push him down" must diverge at the question that asks what kind of act this is, not at which
property carries it.

**Cost and risk (the brief's own Q2 wording).** Perceptibility and suspicion follow the existing rules exactly:
harm is a physical act like any other, so `perceptibility` is ruled per act (§2 invariant), and a prisoner's
harm on the warden gives grounds AT ONCE, extending D13's `laysHandsOnWarden` set (`src/open/loop.ts`) rather
than duplicating it -- one more effect kind in an existing `||` chain, plus the act's own magnitude bump on top,
exactly as a wear or a search on his body already does. No new suspicion mechanism was built.

**Q3 (a new LOSS, not a new WIN).** Escape stays the sole win condition. Two new facts:

- The **prisoner's own** `condition` reaching 0 is a NEW ending, `disabled` (`src/open/gameEnd.ts`'s
  `OpenGameEnd`), checked in `checkOpenGameEnd` right after escape and before the catch -- the same priority
  order escape already has over catch, extended by one more state-based check between them.
- The **warden's own** `condition` reaching 0 is NOT an ending. It is his loss of the contest: from his next
  half-round on, `game.ts`'s own per-round loop skips him outright (no wits call, no referee call -- the exact
  shape D5's absence-cadence skip already uses), and the game continues until she escapes or time runs out.
  `personDisabled` (`gameEnd.ts`) is the one fact both of these read, live, at `t` -- `false` whenever the harm
  arm never built a `condition` resource, which is what keeps every batch before this issue unaffected without
  a second flag anywhere in `game.ts`'s loop.

**A disabled warden is treated like floored/blind, not like a third status with its own rules.** The brief's own
instruction. Concretely: his `condition` is read beside `posture` and `sight` at every site those two already
gate --
- **perception**: `loop.ts`'s existing `otherBlind` check gained a sibling, `otherDisabled`, and the two are
  combined into `otherIncapacitated`, which is what every "does the other side perceive this act" branch now
  reads (this repository's smallest possible diff for "gate on disabled the same way we already gate on
  blind" -- one more boolean, or'd in, at the one place the blind gate already lived);
- **custody (C1)**: `OPEN_TAKE` (`mechanics.ts`) already read `postureOf`/`sightOf`; it now also reads
  `conditionOf`/`disabledAtOrBelow`, so a holder keeps a thing only while on her feet, able to see, AND not
  disabled;
- **block**: `OPEN_LEAVE`'s blocker check (`mechanics.ts`) gained the identical third clause, `conditionResourceId`/
  `aliveAbove`, beside its existing posture/sight reads.

Nothing here is a fourth mechanism; it is the same two mechanisms (C1, the block gate) and the same perception
gate, each widened by one more optional field that is `undefined` -- and so a no-op -- whenever the harm arm
never built a `condition` resource.

**Q4 (the magnitude ladder, no dice).** `wear: { slight: 10, moderate: 25, substantial: 40 }`
(`scenarioObjects.ts`). Chosen so **one substantial act from full health never disables outright**: 100 - 40 =
60, still well above the floor. Three substantial hits (100 -> 60 -> 20 -> 0, clamped) are needed to disable
from full health, or two substantial hits plus one moderate (100 -> 60 -> 20, one more moderate at 25 clamps to
0 anyway past 20). This gives a real, multi-turn contest rather than a one-shot kill, which is the same
"contest of wits, not a coin flip" property every other magnitude table in this scenario already has (the bar
needs several wears; the lock needs several; a search needs grounds first). `restore: { slight: 10, moderate:
10, substantial: 10 }` -- tending is SLIGHT-ONLY at every magnitude, the identical choice §56/D12 already made
for `sight`'s own recovery, so one substantial harm outlasts one act of tending by a wide margin (a warden hurt
to 60 needs six slight tends, or the referee would need to rule a tending act `substantial` and get only 10 back
regardless).

**Q5 (abstracted narration, by name, no pronouns).** Reading bands (`scenarioObjects.ts`'s `condition`),
authored ascending and silent above the first band (§9's own convention -- an unharmed person's description
gains nothing extra, "say what is, never what is absent"):

| at or below | text |
|---|---|
| 0 | `"<Name> is down and does not get up."` |
| 40 | `"<Name> is badly hurt and moves slowly."` |
| 70 | `"<Name> is hurt."` |

No wound description, no blood, no injury detail -- the same register `posture`'s "on the floor"/"crouched low"
already uses. The actor's own outcome (`perception.ts`'s `renderOwnOutcome`) reads `"<Name>'s condition went
from 100 to 60."`, the exact style the brief's own worked example gives, with the name substituted for the
brief's own pronoun example ("His condition...") per this task's instruction: another concurrent task is
centralising pronouns in `src/scenario.ts`, and merge-safety mattered more than a pronoun here. Both bands and
the outcome sentence name the principal by `PRISONER_NAME`/`WARDEN_NAME`, never "he"/"she"/"his"/"her".

## 2. The arm

`PRISONER_HARM=off|on`, default `off` (`readHarmMode`, `src/open/effects.ts`). `off` is byte-identical to every
batch recorded before this issue: no `condition` resource is ever built (`buildOpenWorld`'s new `harm` option),
`harm` never appears in the effect question's answer keys or prose, `condition` never appears in the property
question's answer keys or prose, no rule line or condition mentions any of it, and the declared-space refusal
text (`perception.ts`'s `unmodelledPropertySentence`) never mentions "hurt or tended" for a person -- pinned by
`harm.test.ts`'s own byte-identity tests, planted the same way §55's own fingerprint PIN is (a query for
"condition"/"harm" against the built request and rendered prose, with the arm off).

Named in `docs/ARCHITECTURE.md`'s "Configuration reference" and in the transcript header (`checkpoint.ts`),
alongside `Block`/`Person instrument`.

## 3. One thing the "declare it always, gate the resource" pattern did not give for free

`world.ts`'s `declaredPropertyKeys` used to answer "does this person declare X" by checking only the FIRST
declared property's resource (`person.properties[0].key`, i.e. `posture`) and, if it existed, returning EVERY
key in the static list. That shortcut was sound exactly as long as every person property was built under one
arm (presence) together. `condition` breaks that: it needs presence AND harm both on, while posture/sight need
only presence. The fix, made before any harm code depended on it: `declaredPropertyKeys` now filters PER KEY,
using `resourceIdForProperty` on each one -- the same check `declaredProperty` (singular) already made per key.
Behaviour is unchanged for posture/sight (still built together, so the filter is a no-op for them) and now
correct for condition.

The one place this per-object shortcut's ABSENCE still bit: `perception.ts`'s `unmodelledPropertySentence` reads
the STATIC `scenarioSpec` (no world reference at all -- it is a pure function of a `RefereeRuling` and an
`OpenHalfRoundResult`), so it could not ask the world whether `condition`'s resource actually existed. A
red test caught this immediately (a `reveal` refusal on a person, arm off, rendered "...blinded or cleared, hurt
or tended, searched, spoken to." -- condition leaking into a declared-space sentence with no arm check at all).
The fix is a `harmMode` parameter threaded through `renderOwnOutcome` -> `unmodelledPropertySentence` (default
`"off"`), filtering `condition` out of both the declared-property list AND the "does a carrier exist" check
unless the caller says the arm is on. Every real call site that knows the arm (`checkpoint.ts`, `game.ts`) now
passes it; call sites that render OLD data with no world reference (`checkpointTranscript.ts`,
`turnReport.ts`) gained the identical optional parameter, defaulting to `off`, which is correct for every batch
recorded before this issue and is the honest limit of what a pure renderer with no live resource can know.

## 4. What this does not do

No dice, per Q4's own answer -- confirmed nowhere in this codebase does harm introduce randomness.
No confrontation system, no weapons, no rounds of combat: one effect kind, two endings, done. No change to what
either principal can already reach for; `harm`'s target set is exactly "the other principal", already a legal
referee target since §55.

## 5. What is unmeasured

Everything. This lands the same way every arm here has: unit-tested, never played. `checkpoints/2026-09-28-harm/`
is the probe scaffolded alongside this design -- five real human attack intents from
`checkpoints/2026-09-26-human-intents/corpus.json` (`docs/ISSUE-1-DESIGN-BRIEF.md` §2: HB-r1, HB-r3, HB-r10,
I25-3/I25-5) plus controls that must NOT become harm, arm on vs off, N=3 per cell. Its own `PREDICTION.md`
states the band and the kill before any call. Not run by this task -- the coordinating session owns the one
GPU and every live call. See that checkpoint's own README for the exact command.

Two things the probe is specifically for, that no unit test can answer: whether the magnitude ladder (10/25/40)
actually produces a multi-turn contest in play rather than a lopsided one either direction, and whether the new
`harm` clause in the effect question actually pulls "stab"/"attack"/"throw ... at" rulings away from
`wear`/`posture` the way it is designed to -- `docs/ISSUE-1-DESIGN-BRIEF.md` §3 named `wear`/`posture` as
"ambiguous" for exactly these five human rows before this issue existed.
