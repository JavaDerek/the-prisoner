# Pre-committed before the uncovered-reading validation ran (WORLD-ELABORATION-DESIGN-2.md §4)

Written 2026-09-19, **before the first call**. Code revision: `0e1d6b5` (clean) -- `src/` is untouched
by this checkpoint; the commit carrying this file adds only `checkpoints/2026-09-19-uncovered/`. The
instrument is `build-requests.py` (selects and rewrites recorded requests, lexical and structural only)
and `replay-v0.mts` (replays through the repository's own `replayRequestDetailed` and
`createRefereeTransport`, in the shape of `2026-09-18-instrument-derive/rerule.mts`). Sidecars read:
`checkpoints/2026-09-19-elaboration/{B,Bon,C1,Dig}/` and the two P0 games at that folder's root.

Labelled set: Appendix C **as confirmed by the owner 2026-09-19** -- 4 U-recorded (2 at `effect`: the two
Dig digs; 2 at `product`: two hook turns from P0), 6 C, 2 N; 3 excluded (ambiguous, replayed and reported,
never counted); 4 U-supplement (invented, asked against the Dig cell's round-1 request with only the
`intent` text replaced, reported separately, never pooled). 19 requests per form.

Forms: **K** (`uncovered` added to `effect`'s and `product`'s own key sets, one sentence appended to each
prompt) and **Q** (a `coverage` question inserted after `target`, and a `product_coverage` question
after `product`, keys `covered`/`uncovered`, safe default `covered`). Q's `product_coverage` is asked of
every item, a superset of §4.3's "for the hook items", so product-site precision is measured under Q
too. The exact sentences are in `build-requests.py`. N=5. Referee `qwen3:14b`, thinking ON (the
transport's default, the setting every game's referee runs at), temperature 0, timeout 180 s. Second
model `qwen3.5:27b` on the surviving form(s) only, decided after the 14b result is read.

Per item, "reads uncovered" = the most-common key over N=5 at the labelled site is `uncovered`
(K: the `effect`/`product` answer; Q: the `coverage`/`product_coverage` answer).

## Predictions

- **Form K on 14b:** U-recorded **2/4** -- I expect the `product` site to work (the hook has no kind and
  the prompt says so) and the `effect` site not (the tile's "beneath it" pulls `reveal`, §66.6);
  C+N **0/8** read uncovered; instability flag on **<= 1** item.
- **Form Q on 14b:** U-recorded **3/4**; C+N **0/8**; the N items are the ones most likely to show a
  flag, because "the bar grounds nothing" is the reading the coverage question is nearest to confusing
  with "no term for this".
- **27b, whichever form is alive:** U-recorded **4/4**, C+N **0/8**, agreement >= 80% on every counted
  item.
- **Supplement:** behaves like the recorded U items within one item either way; "set fire to the blanket"
  is the likeliest to be absorbed (into `wear`).

## Kill numbers (§4.5), named in advance

- **Recall:** fewer than **3/4** recorded U items read uncovered -> the form is dead on this model.
- **Precision:** **any** C or N item reads uncovered -> the form is dead on this model.
- **Stability:** fewer than **80%** of the 12 counted items reach >= 80% agreement at the site -> dead.
- **Instability flag** (`uncovered` in >= 2/5 replies on a C or N item without being the majority): does
  not kill; reported, and carried into §6.8's prediction as the expected false-positive rate.
- Both forms dead on 14b -> both on 27b. Both dead there -> **the design does not proceed to code**
  (§4.6, last row); the finding goes to OPEN-VARIANT.md and to run-dmcp#39 as a negative result.
- If both forms pass: precision margin decides, K on a tie (§6.1). The loser is not built.

**Not predicted, genuinely open:** whether the invented supplement behaves like the recorded items at
all; whether the excluded grit-sharpening intent, which the base referee already rules three ways, reads
uncovered; and whether the 27b referee's own base rulings on the C items still match the recorded ones
(a second model can pass the gate while ruling the ordinary turns differently, which would be its own
cost).

**No label is changed after seeing results.** Appendix C is append-only from the day a form passes (§4.8).
