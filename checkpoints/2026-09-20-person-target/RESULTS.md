# Live re-measurement after implementing a person as a target

Run 2026-09-20 (UTC) against the code at `1784d53`, through the **live** `createReferee` (not a
hand-edited recording): `build-live.mts` asks the real referee for its own questions with the
production-shaped `propertiesOf`/`isDeclared` and `instrumentMode: "checked"`, and `replay-live.mts`
replays each at N=5. `qwen3:14b`, thinking OFF. Same 10 items and the same labels as
`checkpoints/2026-09-19-selftarget/`; no label moved. Results committed unedited.

## The verdict first: still short of the number named in advance

**Self acts reading `target: prisoner`: 2 of 4.** The kill number, pre-committed before the first probe,
was **fewer than 3 of 4 → the reading is not established.** It is 2 of 4. **By its own number this is
still dead**, and the implementation did not rescue it.

What changed is nonetheless large: it was **0 of 4** with `prisoner` offered as a bare key and no prompt
saying a body can be acted on. Two acts now land perfectly end to end.

| intent | before (SELF arm) | now (live) |
|---|---|---|
| pretend to have a heart attack | `none`/`noise`/`none` | `none`/`noise`/`none` — unchanged |
| drop to the ground and clutch my chest | `none`/`none`/`none` | **`prisoner`/`wear`/`posture`** |
| collapse on the floor and lie still | `none`/`none`/`none` | **`prisoner`/`wear`/`posture`** |
| crouch down low | `window`/`open`/`passage` | `none`/`wear`/**`posture`** |
| push Croft to the floor | `warden`/`wear`/`none` | **`warden`/`wear`/`posture`** |
| shout for help | `window`/`noise`/`none` | `none`/`noise`/`none` |
| all four traps | unchanged | **unchanged — 0 moved** |

Every row at 100% agreement, N=5.

## Two soundness bugs closed as a side effect

The probe's worst finding was *"crouch down low"* reading `window`/`open`/`passage` 5/5 — a bodily act
captured by a way out and ruled to open it. **It is gone**: the same intent now reads `wear` on a
`posture`. *"shout for help"*, likewise captured by the window before, now reads `none`. Neither was
fixed by a guard; both were fixed by **giving the act somewhere to land**, which is `AUTHORING-GUIDE.md`'s
surfaces lesson applied to bodies rather than floors. That said, this was not a broad probe of unnamed
intents, so the general question — can any capture land on the door, which has no threshold under
`PRISONER_DOOR_PRICE=free` — remains open and should not be assumed closed by these two rows.

## Where the remaining failure actually is, from the citations

**The property question now reaches a person's posture reliably: 4 of 4** on every item involving a body
(drop, collapse, crouch, push), each citing *"She is on her feet."* from that person's own description.
The widened key set works.

**The whole remaining failure is at `target`.** The clearest evidence is *"crouch down low"*: it answers
`property: posture` **citing the prisoner's own description**, while answering `target: none`. The model
reads her body, names her property, grounds it in her text — and will not say it is her. The two
questions are answered independently, so nothing in the reader can catch that contradiction.

The two failures share one feature: **neither names a person, and neither has a stated subject.**
*"drop to the ground and clutch my chest"* has "my"; *"collapse on the floor and lie still"* is a whole-body
act; *"crouch down low"* and *"pretend to have a heart attack"* are bare imperatives about nobody. This is
the third probe tonight to land on the same conclusion: **the `target` question is the bottleneck, and it
is decided by the nouns in the intent** (`2026-09-19-floor/RESULTS.md`: an intent naming a declared id
always wins that id; `2026-09-19-selftarget/RESULTS.md`: an intent naming none can be captured by anything).

"pretend to have a heart attack" is also a real question, not only a wording gap: the referee rules it
`noise` 5/5 — *"a perceptible event with no state change"* — which is a coherent reading of a pretence.
Whether a faked collapse should change the faker's posture is an authoring decision nobody has made.

## What is NOT claimed

That a mind will attempt any of this; that the ruling then resolves correctly through `OPEN_WEAR` on a
person's resource (this probe reads the referee only, applies nothing, and opens no database); or that
2 of 4 is enough to build on. The pre-committed number says it is not.

## The one clause this suggests, not taken

A `target` clause saying an act with no stated subject is the actor's own — English's imperative — is one
edit and one replay at the same kill numbers. It is the owner's call, and it should be measured before it
is believed, exactly like the three readings that died today.
