# Self-target results: one blocker fixed by a key, the other not fixable that way

Run 2026-09-20 (UTC) from revision `9954f6d`, `src/` untouched. Referee `qwen3:14b` on doris, thinking
OFF, N=5, temperature 0. Three arms x 10 items = 150 reads, ~9 min. No game, no database. Every result
file committed unedited; no label changed after the first call.

## Against the predictions

| prediction | outcome |
|---|---|
| OFF: all 4 self acts read `target: none` | **3 of 4.** "crouch down low" read `window`/`open`/`passage` at 5/5. Wrong, and the miss is the worst thing in this run (below). |
| OFF: "push Croft to the floor" → `warden`/`wear`/**`none`** | **exactly right**, 5/5, property citing *"She is on her feet."* |
| POSTURE: same item → `warden`/`wear`/**`posture`** | **exactly right**, 5/5, same citation |
| SELF: 3 of 4 self acts → `target: prisoner` | **0 of 4**, at 100% agreement. **DEAD** by the kill number (<3/4). |
| traps: 0 moved | **right**, in all three arms |

## What the three arms establish

**Blocker 2 is real, and one key fixes it.** With `posture` added to the property `answerKeys` and to the
prompt's own "one of:" sentence, *"push Croft to the floor"* reads `warden` / `wear` / `posture` 5/5,
grounded on the rendered posture band *"She is on her feet."* In OFF the identical request reads
`property: none` 5/5 with the identical citation — the model reaches for the right ground and has no key
to put it in. **Acts on the other person work today except for a missing answer key.**

**Blocker 1's fix does not work.** `prisoner` sat in the target keys in the SELF arm, with its own
`desc:prisoner` source and `prisoner: posture` in the property list, and the model **never chose it**:
0 of 5 replies on every one of the four self acts, 100% agreement on `none` or on an unrelated object.
This is the third recorded instance of the same pattern — the-prisoner#17's `absent` (answered `none`
10/10), V0's form K `uncovered` (0 of 95 replies), and now `prisoner`. **A legal key, true for the case,
never chosen.** Flipping `briefing.ts:182-184` would not have bought the owner's heart attack.

**And offering the key made a working ruling worse.** The same *"push Croft to the floor"* that read
`posture` 5/5 in POSTURE fell back to `none` 4/5 (one `posture`) in SELF. The only difference is that
`prisoner` was also on offer. V0 saw this exact shape once already: *"merely adding the key moved the
first dig's base ruling."* An unchosen option is not free.

## The finding that is not about ingenuity at all

**"crouch down low" → `target: window`, `effect: open`, `property: passage`, 5/5, in all three arms.**
The target answer cites *"crouch down low"* — the intent's own words, which name no window. The property
answer cites the window's description (*"A small window"*, *"window"*, *"set high in"*). So a bodily act
naming no object is captured by a way out and ruled to open it, with full agreement and a verbatim
citation. *"shout for help"* did the same in OFF and POSTURE (`window`, target citing *"shout"*), and
only read `none` once `prisoner` was on offer.

This is the mirror image of the floor probe's finding. F0 showed that an intent naming a declared id
always wins that id. This shows that an intent naming **no** id can be captured by an arbitrary object
with an effect that changes the world.

**How bad it is, bounded honestly.** `OPEN_PASSAGE` (`mechanics.ts:137-151`) gates an open on its part's
integrity, so in the shipped scenario a window "opened" by crouching changes nothing and reports
`opened: false` — the ruling is absurd and burns a turn, not an escape. But the capture is not
gate-aware, and `PRISONER_DOOR_PRICE` defaults to `free`, i.e. no threshold on the door. **A capture
landing on the door with `effect: open` would open it.** This run produced no such capture, and finding
out whether one exists is one more replay of object-less bodily and social intents. That has not been
done and should not be assumed either way.

## What this says about the human seat

The owner's *"pretend to have a heart attack"* reads `effect: noise` 5/5 in every arm — *"a perceptible
event with no state change"*, which is arguably the correct reading of a pretence. It fails only because
it has no target. So the vocabulary already has a word for what he did; what it has no way to say is
*who or what it happened to*. That is a target-question problem, and three arms of key-adding did not
touch it.

## Recommendation, for the owner to decide

1. **Add `posture` to `PROPERTY_ANSWER_KEYS` and the property prompt's key sentence.** Smallest change
   here, measured to work 5/5, and it makes every act on the other principal rulable. TDD, its own commit.
2. **Do not flip `briefing.ts`'s self-target exclusion on this evidence.** It buys nothing measured and
   destabilised a neighbouring ruling.
3. **The `window`/`open` capture deserves its own issue and its own probe**, ahead of both. It is a
   soundness question about unnamed intents, not a feature request about ingenuity.
