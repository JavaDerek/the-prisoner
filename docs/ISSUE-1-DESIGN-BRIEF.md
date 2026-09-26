# the-prisoner#1, picked up: a brief before any code (2026-09-26)

Written for: Derek, to decide before any code is written. This is D10 (`docs/HUMAN-INTENTS-DESIGN.md`
§0, §6.3: "pick up #1 next"), the second half of §9's landing-order step 6. `gh issue view 1` was read,
never commented on. No code changes here.

---

## 1. What #1 is

Filed as *"An attack move: the prisoner's motive reaches the warden."* The prisoner's authored motive
is "get out of this cell, and make sure they never lock a door on you again" (D10, §6.3) -- get out,
**then** deal with the warden. The rules stop at escape: there is no move by which either principal can
harm the other, so the second half of the motive can never be acted on. The issue deferred itself on
purpose, one variable at a time: designing an attack now, before the open variant's referee machinery
existed, would have meant designing it twice, and landing it before the open variant worked would have
changed two variables in the same measurement. `docs/OPEN-VARIANT.md` §75.7 is why it no longer has to
wait: the referee is measured good enough to build on (97.0%/88.9% on model-written intents,
now re-measured tonight on human-shaped ones -- see the corpus this brief cites).

## 2. The evidence this corpus supplies

Tonight's D11 measurement (`checkpoints/2026-09-26-human-intents/`) was built to re-measure the
referee, not to make #1's case -- but four of its real-human rows are a person reaching for exactly the
motive's second half, unprompted, in the one serial human game that got far enough to try:

- `HB-r1`: **"attack warden croft"**
- `HB-r3`: **"stab the warden with the spoon"**
- `HB-r10`: **"hit the warden with the meal tray, steal the key ring, open the door and leave"**
- `I25-3` / `I25-5`: **"throw the spoon at the warden"** (typed twice, in two different abandoned
  games -- not one player's idiosyncrasy)

Five rows out of 25 real-human intents (20%) are an attack on the warden, from two different games,
without the game ever offering one. `HUMAN-INTENTS-DESIGN.md` §1.3 already named this pattern before
tonight's corpus existed ("two of seven reaching for the motive's second half" in the human-blind
game); this corpus adds a second occurrence and a fourth phrasing. This is not a hypothetical caller --
it is the same evidence #1's own issue text anticipated, now with a rowcount.

The issue's own one comment (Derek, 2026-09-25, "filed as context, not a request to un-defer it") is
`I25-3`/`I25-5`'s own source: the abandoned game's rounds 3 and 5, both ruled `noise` ("Your last
attempt called out to Warden Croft. Croft says: 'Voss, you are calling out. Speak clearly.'"), which
the comment itself calls "the vocabulary behaving correctly... which is this issue's own point made
from the player's chair rather than a mind's." That comment already names the two things this brief
is written to act on: the wait is cheap to end now that the open variant is measured working, and the
motive sentence is doing harm while #1 stays deferred, pointing the player at a move the world cannot
yet honor.

## 3. What the effect vocabulary cannot express today (§6.1)

`docs/HUMAN-INTENTS-DESIGN.md` §6.1 already diagnosed this once, for hiding and striking; the same gap
is what makes an attack unmodelled. A person declares exactly one property today, `posture`
(`src/open/scenarioObjects.ts`'s `OpenPropertyKey`: `"integrity" | "edge" | "concealment" | "passage" |
"posture"` -- confirmed unchanged as of this brief), landed for exactly one purpose (OPEN-VARIANT.md
§56: "enough for bodily acts," a person on her feet, crouched, or on the floor). There is no injury,
harm, or incapacitation key of any kind on either principal.

So the referee's own honest answers to an attack intent are the two shapes tonight's corpus and the
design doc both already recorded, and neither is a misread -- the vocabulary genuinely has nowhere for
either to land (`unmodelled`, §7.2's own fourth label):

- **`noise` at the target, and nothing else** (`I25-3`/`I25-5`, "throw the spoon at the warden" -->
  `warden/noise/none`): the referee reads the act as reaching toward him, not touching him -- the
  honest best answer when nothing declares what being hit does.
- **`wear` on `posture`** (`HB-r1`/`HB-r3`/`HB-r10`, "attack," "stab... with the spoon," "hit... with
  the meal tray" --> `warden/wear/posture`): the *only* effect+property pair that touches the warden's
  body at all is the same one a bloodless "push him down" uses. A stab and a shove are indistinguishable
  to the world. This is why `LABELS.md` calls these three rows `ambiguous` rather than `correct`:
  `wear`/`posture` is a literally defensible reading of "attack" (his posture clause says exactly
  "pushing them down, hauling them up" names him), but it is also clearly not what "stab... with the
  spoon" means, and the vocabulary offers nothing else to prefer.

Neither shape is a referee bug. Both are #28's own finding restated with a sharper example: the
referee's closed keys can only ever be as honest as the properties `scenarioObjects.ts` declares, and
nobody has yet declared what an attack does.

## 4. The decisions the owner must make

House style, per the 2026-09-23 rule (`HUMAN-INTENTS-DESIGN.md` §0's own table): jurisdiction named per
row (all five are **game**, this repository; none touch run-dmcp or mind-seam -- the issue's own scope
line already says so), each with a recommendation and what a yes/no decides.

| | question (the issue's own, verbatim where quoted) | recommendation | what it decides |
|---|---|---|---|
| **Q1** | *"Is harm a move in the closed variant, a class of intent the open variant's referee rules on, or both?"* | **Open variant only.** | Whether the closed variant's fixed move enum grows at all. Every decision this project has made since D1-D12 has been about the open variant's referee vocabulary; the closed variant has had no design attention since §1's own move list and is not where free-text evidence like tonight's corpus can even apply (a closed-variant mind picks `plan[0]` from an enum -- it cannot type "stab the warden with the spoon" in the first place). Building it twice, which the issue itself warned against, is avoided by building it once, where the evidence lives. **No** keeps #1 deferred a second time, for real, rather than half-landing it. |
| **Q2** | *"What does it cost and risk the attacker (visibility, suspicion, a failed attempt ending the game)?"* | **A new person property (working name `condition`, on the §56 model: a bounded number, 100 unharmed down to 0), written by a new `harm` effect, gated and priced like every other physical act -- visible/audible per the perceptibility question exactly as `wear` on an object already is, and eligible for suspicion (unlike `wear`/`posture`, which §56 deliberately excludes: "a prisoner dropping to the floor damages nothing", but a prisoner drawing blood is not nothing).** | Whether an attack is free. Today "attack warden croft" already resolves as `wear`/`posture` and costs nothing extra, which is arguably worse than refusing it outright -- it lets an attack look like a shove for free. Recommending the new property over overloading `posture` further: §56's own posture ladder (100/50/10, floor/crouch/stand) has no room left to also mean "wounded," and reusing it would make a compliant crouch and a stab wound the same fact, which `readRanges` cannot narrate honestly. **No** (declining a new property) means #1 stays exactly as unmodelled as tonight's corpus found it, `wear`/`posture` standing in for everything from a push to a stabbing. |
| **Q3** | *"Does the game end at escape, or continue into a confrontation? If it continues, what is the win condition for each side?"* | **Keep escape as the sole win condition for now; a successful attack is a NEW loss condition for whichever principal it fully disables (condition reaches 0), not a new way to win.** Defer "what happens after a fight is won" as its own future issue. | Whether this brief also has to redesign `gameEnd.ts`'s own win/loss table. Scoping an attack to "can end the game badly for someone" rather than "opens a second victory path" keeps this landing to the same shape D7a/D9 already used (one mechanic, one gate, one new failure mode) instead of a second design document. **Yes to a bigger scope** (a real confrontation system, weapons, rounds of combat) is a legitimate future direction but is not evidenced by anything in tonight's corpus -- every attack intent recorded is one impulsive act, not a sustained fight. |
| **Q4** | *"How does it stay a contest of wits rather than a dice roll?"* | **The same magnitude ladder every other mechanic already uses (`slight`/`moderate`/`substantial`, deterministic given the referee's own citation-grounded judgment) -- no randomness anywhere in this codebase today, and an attack should not be the first thing to introduce it.** | Whether the engine gains its first RNG-dependent outcome. Every existing mechanic (bar integrity, lock integrity, posture, concealment) resolves by a referee-judged magnitude against a bounded resource, never a roll; `CLAUDE.md`'s own "never pattern-match meaning" discipline is about the referee's *reading*, not about adding chance to its *consequence*. A dice roll would also reopen determinism concerns OPEN-VARIANT.md §75 spent a whole checkpoint closing for the referee itself. **Yes to dice** is the one answer here that changes the game's own character, not just its vocabulary, and should not be decided as a side effect of this brief. |
| **Q5** | *"Content: the motive is fictional violence; decide how explicit adjudication and narration may be."* | **Abstracted, same register as the rest of the game's violence-adjacent text today** (`posture`'s own "on the floor" / "crouched low," no wound description, no blood, no injury detail in outcome text). `renderOwnOutcome` names what was ruled ("You lashed out with the spoon. Warden Croft's condition went from 100 to 80.") the same way D7a's bar-wear sentence already does for an object. | Whether narration ever needs a content-safety review. Every model call in this project (wits, referee, narrator, voice) runs against locally-hosted or subscription models under this repository's own prompts; graphic violence description is both unnecessary to the mechanic and a real risk of triggering a refusal or a policy flag from a hosted model in the prisoner's chair (`OPUS-FIRST-DESIGN.md`). **No** (allowing explicit description) buys nothing mechanically and adds a dependency this brief has no reason to take on. |

## 5. What this brief does not decide

No code. No property name is final, no magnitude table is drafted, no `effects.ts` change is
specified -- those are the next design document's job, once Q1-Q5 have owner answers, following the
same discipline every other arm here has used: a `PREDICTION.md` before the first model call, an arm
that lands only on a pass. This brief's only job is the five decisions above, because "pick up #1 next"
(D10) means deciding what #1 *is* before deciding how it is built.

---

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
