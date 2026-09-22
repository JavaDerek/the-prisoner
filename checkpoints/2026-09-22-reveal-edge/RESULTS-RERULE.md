# Results: batch 1's 30 misruled rows, re-ruled through tonight's referee (2026-09-22, overnight)

Prediction: `PREDICTION-RERULE.md`, committed and pushed before any call. Instrument `rerule.mts`: each row's own
recorded request with `a108643`'s property sentence, every reply through the current gate (`52ae7de`), N = 3,
referee `qwen3:14b` thinking ON. Log `RERULE.log`, per-reply keys in `results-RERULE.json`.

**One change to the instrument, mid-run:** the first attempt (`rerule-attempt1-timeout300.out`) sat on row #4 --
the two-object examination -- through two 5-minute timeouts with doris's GPU at 98%, §39's thinking loop on a
two-act intent. Restarted with a 2-minute referee timeout. A timed-out call falls to every question's safe default,
which is refused -- the batch's own outcome for these rows -- so it cannot inflate the count; it can only cost a row
that would have ruled in time (#62, below, may be one).

## By hand: are the keys right?

`applicable` is not `correct`. Every applicable row's target/effect/property was read against its intent:

| bucket | rows | count |
|---|---|---|
| right and applicable | #6 #7 #14 #21 #23 #29 #32 #45 #46 #50 #60 #65 (examinations), #15 #19 #35 #43 (spoon edge), #25 (spoon swept under the tile -> loose_tile/conceal/concealment, the containment reading) | **17** |
| applicable, WRONG act | #8 hide the wire while showing the spoon -> spoon/reveal/concealment; #13 hide the wire under the tile -> wire/derive/integrity; #16, #27 blind her, open the door and go through -> door/open (the `leave` still dropped) | 4 |
| still refused | #4 (two objects, timed out), #24 (tuck the spoon in the blanket fold), #62 (lock + sweep for the spoon, timed out 3/3), #11 #17 #30 (hide a thing in/under something), #48 (feel the bolt -> door/integrity), #33 #64 (compound) | 9 |

## Scoreboard against the literal prediction

The prediction counted a row fixed at >= 2/3 applicable. Literally: **21 of 30**.

1. citation guard: predicted the 13 reveals fixed, #4/#24/#25 not. Got 13 of 16 -- but not those 13: #62 (a reveal)
   timed out, #25 (a conceal) passed. **Miss on composition, hit on count.**
2. wrong key: predicted 4 (the spoon rows). Got 6 applicable. **Miss** -- the extra two are #8 and #13, both the
   WRONG act.
3. compound: predicted 0. Got 2 applicable. **Miss** -- both are `door/open` with the leave dropped, i.e. the
   batch's own failure, now reaching the door instead of the blanket or key ring.
4. total: predicted 17, floor 14. Literally 21; **by hand, 17 right.**

The misses are the finding: every row that passed without being predicted passed with the wrong act, except #25.
The criterion was wrong, not the fixes -- an applicable-rate is not a correctness rate, and the design already says
so (§2: correctness is a human audit). Future re-rules report the by-hand buckets, never the applicable count.

## What is left, by kind

- **Hiding a thing in, under or on something** (#8 #11 #13 #17 #24 #30): the referee has no settled answer for
  which object an act of hiding targets -- the thing hidden or the place -- and the world's own containment
  (`heldIn`, §15) is not an act anyone can perform. A world-model question for the owner, not a referee bug.
- **Two-act intents** (#4 #16 #27 #33 #62 #64): open for the owner since §39.
- **#48** feel the bolt through the gap for play -> the door, not the lock. One row; left.

Doris left as found (`qwen3:14b` resident).
