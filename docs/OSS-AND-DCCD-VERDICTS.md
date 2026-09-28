# OSS coverage and the DCCD claim: verdicts (`the-prisoner#9`)

`the-prisoner#9` asked for a short written verdict per candidate -- adopt / reject / needs a spike -- with the
reason, negative results recorded rather than discarded. This is that verdict sheet. It answers only the questions
#9 asked; it does not re-litigate anything already decided elsewhere in this repository's docs.

## 1. The DCCD claim

**Verdict: the underlying paper is real; the deployment claim is false. Do not rely on "vLLM ships this."**

#9's own suspicion was that "Draft-Conditioned Constrained Decoding," the "KL-Projection Tax," and the "+24
percentage points" number were "exactly the shape of a fabricated citation." Checked directly:

- **The paper exists and the numbers are accurate.** arXiv:2603.03305, "The Hidden Cost of Structured Generation in
  LLMs: Draft-Conditioned Constrained Decoding," Avinash Reddy and Amrit Singh Bedi (University of Central
  Florida), Thayne T. Walker and James S. Ide (Lockheed Martin AI Center); v1 8 February 2026, v2 27 June 2026; an
  ICML 2026 poster (icml.cc/virtual/2026/poster/62339). Its own abstract, quoted verbatim from
  `arxiv.org/abs/2603.03305`, gives the +24-point figure and the 15.2%-to-39.0%-on-GSM8K example exactly as the
  2026-09-16 research report stated them, and frames the mechanism exactly as "KL-projection": "draft conditioning
  increases feasible mass and reduces the cumulative 'projection tax' induced by hard constraints." None of that is
  invented. The coined name and the coined tax are the paper's own, not a hallucination layered on top of it.
- **"Currently integrated into the vLLM serving engine" is the false part.** The paper's own methods section says
  only that the authors "employ grammar-based constrained decoding using XGrammar integrated with vLLM" --
  meaning they used vLLM's existing XGrammar backend as their experimental infrastructure to build and benchmark
  DCCD, not that DCCD shipped into vLLM as a feature. Checked directly, as #9 asked:
  - vLLM's own structured-output docs (`docs.vllm.ai/en/latest/features/structured_outputs.html`) list `xgrammar`
    and `guidance` as the two backends and five output types (choice/regex/JSON/grammar/structural tag). No
    draft-then-constrain, two-step, or DCCD-named mode anywhere.
  - `vllm-project/vllm`'s own GitHub issue search for "DCCD" or "draft-conditioned" returns zero results.
  - No vLLM changelog or release-notes entry names it.
  - The paper's own code, per its text, is released separately for reproducibility -- not as a vLLM PR or a vLLM
    subproject.
- **What this means for the referee (#9's own follow-on question).** The paper's mechanism does not depend on
  whether vLLM ships it: the two-call draft-then-extract SHAPE is implementable by any caller, against any
  OpenAI-compatible endpoint, exactly as this repository's own referee transport already is. That measurement is
  built as a probe, not adopted into the game -- see "The measured half," below.

## 2. Tam et al. 2024, the real underlying literature

**Verdict: real, and accurately characterized by the research report.**

Zhi Rui Tam, Cheng-Kuang Wu, Yi-Lin Tsai, Chieh-Yen Lin, Hung-yi Lee, Yun-Nung Chen, *"Let Me Speak Freely? A Study
on the Impact of Format Restrictions on Performance of Large Language Models"*, EMNLP 2024 Industry Track
(arXiv:2408.02442, `aclanthology.org/2024.emnlp-industry.91`). Its own abstract: structured generation (JSON, XML)
is widely used to extract information from LLM output, and the paper's finding, in its own words, is that
"stricter format constraints generally lead to greater performance degradation in reasoning tasks" -- a real,
peer-reviewed, pre-2026 result, well before DCCD's own 2026 paper, which cites the same problem from the decoding
side. The ordinary mitigation the field takes from this -- let the model reason in free text first, then extract
structure from that draft in a second, separate call -- is the shape this checkpoint measures (below), independent
of whether DCCD-the-paper or DCCD-the-vLLM-feature is real.

## 3. `eventsourcing` (John Bywater, Python)

**Verdict: an engine question, filed here only as a pointer -- no `run-dmcp` issue opened tonight.**

Checked against `eventsourcing.readthedocs.io` and `github.com/pyeventsourcing/eventsourcing`: an append-only
event-sourced-aggregate library (`@event`-decorated aggregate methods, an `Application` layer over pluggable
persistence -- SQLite, PostgreSQL, with compression/encryption/transcoding, and a "dynamic consistency boundary"
feature for cross-aggregate invariants). The overlap #9 named is real: this is the same shape as `run-dmcp`'s
timeline core (facts with validity intervals, one audited write path, state derived by replay), and Bywater's
project is mature and well-documented.

Two things stop this from being an adoption question this repository can answer:

- **It is Python.** `run-dmcp` and this repository are TypeScript at an exact pin (root `CLAUDE.md`, this
  repository's own `CLAUDE.md` "TypeScript only"); there is no live TS port to evaluate against.
- **It is `run-dmcp`'s question, not this repository's.** This repository imports `run-dmcp`'s mechanism and never
  reaches into its timeline core; whether `run-dmcp` should replace or rebase any of its own event-sourcing
  machinery on ideas from a mature Python library is an engine-level design question, and per this repository's own
  vocabulary rule ("an engine or seam issue filed from here describes the game structurally... never in this
  game's own terms"), it is not this checkpoint's place to open that issue. Recorded here as the pointer #9 asked
  for: `run-dmcp` maintainers should look at `eventsourcing`'s aggregate/event/application split and its DCB
  feature before extending the timeline core further, described structurally (two principals, one location,
  contended physical state, facts with validity intervals) rather than in this game's own words.

## 4. Evennia

**Verdict: reject, as a substitute for anything in this repository's own referee/belief stack -- confirmed by its own docs, not just by prior judgement.**

Checked against `evennia.com/docs/latest/`: a mature, real, actively documented Python MUD/`MU*` framework
(rooms, characters, objects, a command system, and a "Locks" system for permissions). Its own documentation
describes locks as answering a **present-tense** access question -- can this character do/see this THING NOW --
with no concept, anywhere in its docs, of a character's own belief state, staleness, or "what did this character
last perceive" as distinct from current world state. #9's own framing was exactly right: a lock system answers
"can this character see this now," never "what did this character last believe, and how stale is it" -- and that
second question is this repository's own belief ledger (channel 2, `docs/DESIGN.md`), which stays this
repository's to maintain. Evennia is not a rejected-for-cause "not invented here": it is a real framework solving
a real, adjacent, but different problem (spatial/permission modeling, not belief staleness), and would be worth a
second look only if this repository ever needed a full spatial node graph it does not currently have (there is one
room).

## 5. `pyribs` / MAP-Elites

**Verdict: reject, unchanged from #9's own assessment -- confirmed against its own docs.**

Checked against `docs.pyribs.org/en/stable/`: a real, mature quality-diversity (QD) optimization library --
an archive of solutions indexed by behavioral-characteristic cells, emitters that propose and refine candidates,
and a scheduler coordinating them, aimed at "fixed-dimensional continuous domains" (robotics, level generation,
evolutionary search over a POPULATION of candidate solutions evaluated by an objective plus a behavior
descriptor). It has no mechanism aimed at a single conversational agent's own repeated outputs over time, which is
what an anti-looping measure for a mind would need. #9's own prior finding stands and is not re-litigated here:
this repository's own A/B work already found that detecting repetition is not the bottleneck for the minds in this
game -- generating good alternative candidates is -- and pyribs answers a "which of many candidates is best,
along which axes" question, not a "generate a better candidate" question. Recorded as considered and rejected.

## The measured half: draft-then-extract vs one-pass

The one candidate in #9 that IS this repository's own question -- whether the Tam-et-al. mitigation (reason freely,
then extract structure) improves this referee's own closed-key ruling -- is built as a probe, not adopted:
`checkpoints/2026-09-28-draft-extract/` (`probe.mts`, `PREDICTION.md`, `README.md`). It rules all 95 rows of the
D11 corpus (`checkpoints/2026-09-26-human-intents/corpus.json`) twice -- once as the game calls the referee today
(`one-pass`), once with an unconstrained prose draft call added ahead of the ordinary constrained call
(`draft-extract`, a transport wrapper, no `src/` change) -- and scores both against the corpus's own pre-registered
`expectedKeys`. Pre-registered bar: draft-extract improves at least 5 of 88 scorable rows with at most 1
regression; kill if fewer than 2 improve or 2 or more regress. `probe.mts --dry-run` builds all 190 requests with
zero network calls (verified); no model has been called, per this task's own scope (a probe, not a live measurement
or a game change) -- see the checkpoint's own README for the exact live command and its ~2.75-3 hour estimate.

## Summary table

| candidate | verdict | reason |
|---|---|---|
| DCCD (the paper) | confirmed real | arXiv:2603.03305, ICML 2026; numbers and framing accurately quoted |
| DCCD ("integrated into vLLM") | **false, do not rely on it** | vLLM's own docs, changelog and issue tracker: zero mentions; the paper itself only uses vLLM's XGrammar backend as its own experiment infrastructure |
| Tam et al. 2024 | confirmed real | arXiv:2408.02442, EMNLP 2024 Industry Track; format restriction measurably degrades reasoning |
| draft-then-extract mitigation, on THIS referee | needs a spike -- probe built, not run | `checkpoints/2026-09-28-draft-extract/`; pre-registered, dry-run verified, live run and scoring are the open spike |
| `eventsourcing` (Bywater) | adopt-as-a-pointer, engine question | real overlap with `run-dmcp`'s timeline core; Python, and not this repository's issue to file |
| Evennia | reject (for this repository's belief stack) | real framework, wrong problem: present-tense locks, no belief staleness concept |
| `pyribs`/MAP-Elites | reject | real QD optimizer over a population; this repository's bottleneck is candidate generation, not diversity selection, per its own prior A/B finding |
