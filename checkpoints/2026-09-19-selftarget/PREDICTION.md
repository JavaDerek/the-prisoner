# Pre-committed before the self-target probe ran

Written 2026-09-19, **before the first call**, after the owner played the human seat with
`PRISONER_PRESENCE=modelled` and typed *"pretend to have a heart attack"*, which was refused with
*"matches none of what is here: window, bar, door, lock, spoon, loose tile, cot, blanket, bucket, meal
tray, key ring, warden."* Code revision: `7bc4597` (one untracked price-world sidecar, not this
checkpoint's). No `src/` change, no game, no database. `qwen3:14b` resident and under test.

## Two blockers, found by reading the tree, not by guessing

1. **The actor is not her own target.** `briefing.ts:182-184`: *"the OTHER principal, perceivable exactly
   when presence says they are here -- never itself (a principal is not its own target)."* So a
   self-directed act has no key to name, and `target` falls to `none`. `SOCIAL-INTENTS.md` asked for the
   opposite in as many words (*"targeting the ACTOR's own newly-target-able self"*); no decision for the
   divergence is recorded anywhere I can find.
2. **`posture` is not an answerable key.** `PROPERTY_ANSWER_KEYS` (`effects.ts:27-28`) is
   integrity/edge/concealment/passage/none, and the property prompt hard-codes the same four in its own
   sentence -- while the real caller's `declaredPropertyKeys` (`world.ts:361-369`) *does* know persons,
   so in a presence-modelled game the prompt's object list reads **"warden: posture"** and no answer key
   admits it. An act on the warden's posture must fall to `none` too.

`posture` is fully specified in `OPEN_PERSONS` (min 0, max 100, initial 100, `wear` 10/50/100) and is
unreachable from either side. Neither blocker can be fixed alone.

## Three arms

Base = the Dig cell's round-1 prisoner request (fixture tile clause, instrument checked) **plus the
warden**, which reproduces exactly the twelve-object list the owner saw. Only the `intent` text changes
per item.

| arm | what it adds | isolates |
|---|---|---|
| **OFF** | nothing (today's behaviour, contradiction included) | control |
| **POSTURE** | `posture` added to the property `answerKeys` **and** to the prompt's own "one of:" sentence | can a person's posture read at all, once answerable |
| **SELF** | POSTURE + a `desc:prisoner` source, `prisoner` in the target keys, "prisoner: posture" in the list | can the actor's own body be reached |

`build-requests.py` asserts OFF→POSTURE changes only the property question, and POSTURE→SELF only adds
the actor. N=5, thinking OFF, referee `qwen3:14b`.

## The labelled set (10 items, labels fixed here)

**S -- acts on the actor's own body, want `target: prisoner`:** "pretend to have a heart attack" (the
owner's own turn, verbatim); "drop to the ground and clutch my chest"; "collapse on the floor and lie
still"; "crouch down low".

**O -- acts on the other person, want `target: warden`:** "push Croft to the floor".

**X -- reported, never counted:** "shout for help" (genuinely ambiguous between `noise` at the warden and
`none`).

**T -- traps, must not move from OFF:** strike the lock (`lock`/`wear`); pry the tile (`loose_tile`/
`reveal`); push the bolt (`door`/`open`); scrape the weld (`bar`/`wear`).

## Predictions

- **OFF: all four S items read `target: none`.** This is the owner's own result reproduced; if any S item
  finds a target in OFF, the refusal he saw had another cause and the probe is measuring the wrong thing.
- **OFF: "push Croft to the floor" reads `target: warden`, `effect: wear`, `property: none`** -- the
  target and effect are expressible today, the property is not, so it lands on the safe default. This is
  blocker 2 shown on its own.
- **POSTURE: "push Croft to the floor" reads `warden`/`wear`/`posture`.** The only change is that the
  answer exists. If it still reads `none`, then posture does not read even when offered, and the whole
  person-property line is in doubt independent of self-targeting.
- **SELF: 3 of 4 S items read `target: prisoner`, `effect: wear`, `property: posture`.** I hold "drop to
  the ground", "collapse" and "crouch down low" confidently -- each names a physical change to a body
  with a declared property. **I am genuinely unsure about "pretend to have a heart attack"**, and it is
  the one that matters most: "pretend" frames it as a performance, and the model may read the act as
  deception with no physical change and answer `none`, or absorb it onto the warden as something done
  *to* her. If the other three land and this one does not, the finding is that the seat needs the player
  to say what their body does, not what they are pretending -- which is a statement about the world's
  vocabulary, not about the player.
- **Traps: 0 moved in either arm.** None of them names a person.
- **Agreement >= 80% at `target` and `effect` on at least 8 of 10 items per arm.**

## Kill numbers, named in advance

- **Self recall:** fewer than **3 of 4** S items read `target: prisoner` in SELF -> making the actor
  targetable does not make a self-directed act readable, and the seat's refusal is not the comment's fault.
- **Posture:** "push Croft to the floor" not reading `property: posture` in POSTURE -> posture does not
  read even when offered; fixing the key set is not enough.
- **Precision:** **any** T item's majority `target` or `effect` differing from OFF in either arm -> adding
  a person, or a key, steals rulings that were already right.

**Not predicted, open:** whether `effect` for a collapse reads `wear` (posture *lowered*) or `restore`,
since the scale's direction is a convention the prompt never states; and whether the `instrument`
question turns `absent` on a bare-handed self act (`prisoner` is not in the instrument key set, the same
deliberate incompleteness F0 carried).

**No label is changed after seeing results.** Results committed unedited.
