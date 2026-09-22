# Overnight 2026-09-21 → 2026-09-22: morning report

Written for: Derek, first thing. Four decisions first, then what landed. Evidence is in
`checkpoints/2026-09-22-reveal-edge/` and OPEN-VARIANT §73.

## Your decisions

**D1. What is a turn that says it does several things?** (open since §39)
Batch 1's prisoner opened a way out 16 times in 9 games, almost always as *"blind Croft, open the door, go
through"*. The referee kept the *open* and dropped the *go through*: 0 escapes, and both catches were Croft
examining the door the prisoner had just opened. Your game lost two escapes the same way (r2, r10). These rulings
come back **possible**, so no refusal list ever shows them.
- **A (recommended): one act per turn, said up front.** Both minds' prompts and the seat say "one act per turn;
  write the one you mean." A generic rule on the mind side (it would help Brink too). No change to the world's
  balance, and the drop stops being silent. Measured by a probe before it ships.
- **B: resolve the chain in order within the turn.** Truer to what a person means, but the door is still
  **free** (§48): *open* and *leave* in one turn becomes a near-certain escape on round 1. B only makes sense
  decided together with door pricing.

**D2. Build custody and incapacitation?** Both now have two independent sources (Opus, and you, blind), so D4 is
met. Custody = confiscate, search, hand over, keep (12 unbuilt rows, plus your "steal the key ring").
Incapacitation = knocking someone down or blinding them should *matter* (3 Opus rows; your attack, stab and tray).
Recommend **custody first**: it's the-prisoner#5's step, the engine already supports it (`set` on an item's
owner), and it's the warden's missing half (she can only look).

**D3. Hiding a thing: does the act target the thing hidden or the place?** Six misruled rows are all hiding
(tuck the spoon in the blanket, the wire under the tile or back on the cot). The referee flips between the two,
and the world's containment (`heldIn`) isn't something anyone can *do*. Recommend **the thing hidden** (its
concealment is what rises, and the place is where it goes). This is a world-model call, which is why I didn't
make it.

**D4. Batch 2 now, or after D1–D3?** Recommend **after**. Otherwise batch 2 measures a referee we already
know drops leaves.

## What landed (all pushed, 1058 tests green)

| commit | what |
|---|---|
| `8983004` | OPUS-FIRST-DESIGN §2: your fourth label, `misruled`, and what each label means |
| `52ae7de` | referee: a **reveal's** property may be cited from the intent. 13 of the 16 citation-guard rows. The declared-property check stays, and conceal is deliberately not waived |
| `476180e` | seat: a way out that has changed **stays on screen** every round (your open door) |
| `a108643` | referee: the reveal sentence names **edge** (the spoon-sharpening examinations). Probe: controls identical; spoon integrity 3/20 → 0/20. **The request PIN changed**: batch 2 is not request-identical to batch 1 |
| `9a661ce` | re-rule of all 30 misruled rows |

**Re-rule result: 17 of 30 now right, 4 applicable but wrong, 9 still refused.** The 9 are D1, D3 and one
door-vs-lock row. The 4 wrong ones show an applicable rate is not a correctness rate, so re-rules are now
reported by hand.

## Things I got wrong, or couldn't explain

- **Correction:** I told you the misruled split was 16 / 14 / 4. It's **16 citation guard, 10 wrong key, 4
  compound** (= 30). The same wrong number is in the `c36470b` commit message.
- The earlier session's note had the order backwards (label first, then the blind game). You played blind,
  which is what counts.
- **Unexplained:** on byte-identical requests, the old prompt keyed the spoon to integrity 4 of 4 during the
  batch but only 3 of 20 in tonight's probe. The live batch ran two drivers plus a probe against the same model
  through the router; tonight ran alone and direct. So the edge fix's benefit is weak evidence.
- **Expect more catches in batch 2.** The warden's examinations of the bar and lock now go through (they were
  being refused), so conditions 3 and 4 can actually fire.

Doris left as found (`qwen3:14b` resident). Router stopped. Nothing ran against a real database.
