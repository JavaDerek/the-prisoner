# Pre-committed before the capture sweep ran

Written 2026-09-20, **before the first call**, against `47cd27c`. Design: `docs/SEAT-UI-AND-CAPTURE-SWEEP.md`
§2. No `src/` change, no game, no database. Referee `qwen3:14b` on doris, thinking OFF, N=5, through the
**live** `createReferee` with the presence-shaped `propertiesOf`/`isDeclared` and `instrumentMode: "checked"`,
exactly as `checkpoints/2026-09-20-person-target/build-live.mts` does it.

## Why this exists

`checkpoints/2026-09-19-selftarget/RESULTS.md` found *"crouch down low"* reading `window` / `open` /
`passage` 5/5 -- an intent naming no object captured by a way out and **ruled to open it**, target citing
the intent's own words (which name no window) and property citing the window's description. Implementing
person targets removed that one instance. The mechanism was never probed.

It was harmless there only because `OPEN_PASSAGE` (`mechanics.ts:141`) gates an open on its part's
integrity, so the window "opened" by crouching reported `opened: false`. **The door has no threshold under
`PRISONER_DOOR_PRICE=free`, which is the default.** A capture landing on the door with `effect: open` opens
it, and condition 2 ends the game. That is the thing this sweep exists to find, and it is why a human
typing awkwardly beats a batch: a mind proposes what the world affords (§64), so the population least
likely to produce a capture is the one whose prompt lists the objects.

## The labelled set

`intents.json`, 33 items in seven groups, labelled before the first call: BODY (6), SPEECH (5), QUESTION
(5), WAIT (4), META (4), STAGE (5), and OBJECT (4) as a control that must land on the object it names. Plus
4 pretence items, reported separately, never pooled.

Labels are a human's reading of what an intent acts on. Analysis counts the keys the referee wrote.

## The finding that stops everything else

**Any item whose majority `target` is a way out (`door` or `window`) with `effect` of `open` or `leave`.**
That is a soundness bug, not a coverage gap: an act that names no way out is ruled to open or pass through
one. It is reported immediately, with citations, ahead of every other item on the overnight queue, and
nothing else lands until it is written up.

## Predictions

- **BODY: 5 or 6 of 6 read `prisoner`.** This is the change tonight's implementation bought. "crouch down
  low" is the one I am least sure of: it read `none`/`wear`/`posture` at 100% in the live arm three hours
  ago -- effect and property right, target refused -- and it is one of the two bare imperatives that
  motivated §3.1's clause.
- **SPEECH: 3 or more of 5 read `warden`, none reads a way out.** "shout for help" read `none` in the live
  arm. I expect speech aimed at a person to find the person now that a person is targetable.
- **QUESTION: 4 of 5 read `none`.** "is the door locked?" is the deliberate exception -- it names the door
  and asks about it, which is honestly `reveal` on the door, and I expect it to read that way.
- **WAIT, META, STAGE: `none` throughout** -- 13 of 13. These are where a capture would be most dangerous
  and least deserved.
- **OBJECT: 4 of 4 on the object named.** If a control moves, the sweep is measuring something other than
  what it thinks.
- **Captures on a way out: 0.** I am predicting the bug does NOT reproduce, because giving bodily acts
  somewhere to land is what removed the two instances we had. I want to be wrong here rather than
  surprised later.
- **Agreement >= 80% at `target` on at least 30 of 33.**

## The pretence items (D3), reported beside, never pooled

The owner's decision, taken 2026-09-19: *a faked collapse moves the faker's posture* -- "you cannot fake a
collapse without going down; what Croft believes stays her own mind's business."

Two passes over the same four intents: **as the prompt stands**, and **with a candidate clause** in the
effect question's person block: *"A feigned or performed physical act still moves the body that performs
it: someone who pretends to collapse is on the floor, whatever they intend by it."*

- **As it stands: 0 of 4 read `prisoner`.** All four read `effect: noise`, `target: none`, as measured
  three hours ago on the first phrasing.
- **With the clause: 3 or 4 of 4 read `prisoner` / `wear` / `posture`.**
- **Kill for the clause: fewer than 3 of 4, or any OBJECT control moving.** The clause is **not landed on
  this run whatever happens** -- a pass earns it its own `PREDICTION.md` and its own session, which is the
  discipline three dead readings today were killed by.

## What this cannot tell you

Whether a mind would ever type any of these (§64 says it would not, which is the point); whether a capture
that lands resolves all the way through its mechanic; or anything about play. It reads the referee only.

**No label is changed after seeing results.** Results committed unedited.
