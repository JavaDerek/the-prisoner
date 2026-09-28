# the-prisoner#35 warden wits time -- results (2026-09-28 06:31-06:43 UTC)

Run from `842241b` (clean), one driver, `muse-glimmer:30b` on doris's patched Ollama, card to this session alone.
28 wits calls, 0 errors. `PREDICTION.md` committed in `842241b` before the first call.

| arm | n | median ms | median prompt_tokens | median completion_tokens | median visible chars |
|---|---|---|---|---|---|
| new (2026-09-27 defaults) | 14 | 31 905 | 2 189 | 1 520 | 1 685 |
| old (pre-2026-09-27 arms) | 14 | 14 087 | 1 635 | 672 | 1 592 |
| new / old | | **x2.26** | x1.34 | **x2.26** | x1.06 |

**PREDICTION: MET as hidden reasoning.** Completion tokens grew 2.26x while the visible output grew 1.06x, and time
tracks completion tokens exactly (~48 tokens/s either arm). The prompt grew only 1.34x, and a 550-token prompt
increase costs about a second at most to process on this card. So the warden's ~20 s is **tokens Muse writes and
Ollama's parser discards**: its `to=self` reasoning, which `reasoning_effort: "none"` hides but does not stop
(CLAUDE.md, the 2026-09-27 correction).

Per round, the growth is uneven. Rounds 5-7 (new arm: the block, a blinding and its restores, the absence cadence)
run 1 900-2 600 completion tokens. The same rounds under the old arms run 650-1 050. The richer the state he has
to weigh (twelve conditions, two persons' posture and sight), the longer he thinks, invisibly.

The two savings the issue named are already the game's behaviour: the voice line comes from the same single call
when wits and voice are one model (`mind.ts:500`), and an absent round makes no wits call (D5).

The same log confirms P6's cache reading directly. On every repeat of a request Ollama reports 1 483-2 200
`cached_tokens`, against 52 on each first call (the probe's own `usage` capture).

## What this leaves (no change made)

There is no field on this runtime that stops Muse's hidden reasoning (P8, §75.6; `none` is advice in the system
prompt). The candidates are therefore the issue's own "needs a probe" pair: shorter condition wording, and person
readings shown only when they changed. Each shortens what the warden weighs rather than what he types, and each
changes the request, so each is a batch boundary to be measured before use. The floor is model choice, as the
issue's jurisdiction line says. P7 (running next) measures the referee side, where prefix caching can help.
