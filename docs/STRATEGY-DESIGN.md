# A strategy step for a model-driven NPC: the design, and tonight's attack plan

**Written 2026-09-24, 22:30 CDT (03:30Z on the 25th), answering `STRATEGY-DESIGN-BRIEF.md`.** Design and
decisions in §0–§5; the plan another agent executes unattended in §6; what it will not finish in §7.
Everything claimed about the tree was checked against `main` at `977dbb5` and the batch-6 worktree at
`/tmp/b6-worktree` (`dd5d635`, with `P/` and `S/` still untracked there — 7 games each, the last local
call at 02:10Z). No implementation code is written here.

Three things were **measured tonight, before designing**, and each one moves a decision (§1). Read that
section first if nothing else. **Revised 23:20 CDT after the owner's red team** (three points: the JSON
chatter trap, the positional-bias illusion, adherence versus progress); each revision is marked where it
lands and the probe that answered the first two is §1.3.

---

## 0. The decisions, up front

| | decision | recommended | one-line why |
|---|---|---|---|
| **D1** | where it lives | **`the-prisoner`, `src/open/strategy.ts`**, generic by intent (no game words in the module), with the moi shape named but not shipped | moi's admission test is "generic with one real caller", and tonight it would have zero *measured* callers. §20 and §40.3 are the precedent: drive it here, move it once it changes a free turn. |
| **D2** | what a strategy is | **three things at once**: a declared index into a *fixed* option list, one sentence in the mind's own words (≤200 chars), and 1–2 object ids drawn from the perceived-object list | The index makes selection countable as *given*; the ids make adherence checkable by the referee's own keys with no meaning judged by code; the sentence is the only part the mind ever reads back. |
| **D3** | when chosen, and revision | **once, before round 1**, in a separate two-call step (options at thinking OFF, commit at thinking ON). Revision **designed** (§3.5, one data trigger, at most once), **switched off tonight, and its trigger LOGGED in every game** as the round it would have fired | Commitment amplifies in both directions (the brief's own reading). Tonight measures whether a deliberate commitment beats an arbitrary one; a revision arm on top would be a second moved variable — but the batch must still say how often revision would have been reached for (red team, point 3). |
| **D4** | cross-game history | **not tonight**, and when it comes, a **frozen snapshot per batch**, never a ledger that grows mid-batch | Growing mid-batch turns ten samples into a sequence (§4). "How they fared" is not recordable at all today: moi's `Account` has no outcome, and adding one is moi's change with its own admission test (§3.6). |
| **D5** | how it reaches the turn | **one line the mind reads**, `Your strategy for this game: …`, in the briefing where the plan line already goes. The turn call produces **no new field** | The prose-seat result: fields the model must *fill* flatten it; a line it *reads* is the cheap direction. Run on the **prose seat**, whose only cross-turn memory this line will be. |
| **D6** | primary endpoint | **Adherence**: share of graded prisoner turns whose ruling `target` is one of the strategy's declared ids. Baseline computed from b6's P games before predicting. 91% first-listed is the right **falsifier** for the probe, not the batch endpoint | It is the owner's standing lesson made countable: *build it, measure whether anything reaches for it*. Distinct targets, depth, wasted games, refusals, re-try rate are secondaries with bands (§5). |
| **D7** | cheapest falsifier | **20 asks of the commit call at `high` against one fixed option list shown in shuffled orders**, tallied by option *identity*, plus 10 at `none` as a control. **The only kill is validity** (P0.a/b). Position-following is reported with two pre-named readings, never a kill (red team, point 2) | About 20 GPU-minutes, no game code. §1.3 already shows the instrument works and that choice follows content, not position, on a toy prompt; the real probe asks the same of the real situation. A #1 retention at `high` is not "thinking does not select" — it may be conviction, which is what the batch measures. |

**What I am choosing:** a narrow thing measured once. One seat (prose), one arm (strategy ON, fixed, no
ledger), N≈7, against b6's own P games as the baseline. Revision, history, the schema-seat arm and the
moi port are designed here and left unbuilt (§7).

---

## 1. Two facts measured tonight that the brief did not have

### 1.1 The per-request thinking override is `chat_template_kwargs`, and the repository's switch is a no-op here

Probed at 03:22Z against the live llama-server (pid 2213812, `--chat-template-kwargs
'{"reasoning_strength":"none"}'` on its command line), one trivial prompt, temperature 0:

| request field | completion tokens | reasoning chars |
|---|---|---|
| `chat_template_kwargs: {"reasoning_strength":"none"}` | 33 | 90 |
| `chat_template_kwargs: {"reasoning_strength":"low"}` | 51 | 183 |
| `chat_template_kwargs: {"reasoning_strength":"medium"}` | 60 | 220 |
| **`chat_template_kwargs: {"reasoning_strength":"high"}`** | **109** | **432** |
| `reasoning_effort: "high"` | 33 | 90 |

Two consequences. **First**, the strategy step must send `chat_template_kwargs`, and the router forwards
the body verbatim on the local route (`modelRouter.ts`, `upstreamCompletion(... bodyBuf ...)`), so no
router change is needed. **Second**, `src/open/thinking.ts`'s `withThinking` adds `reasoning_effort:
"none"` — which this server ignores. Every `Thinking (wits): OFF` header line in batches 3–6 is true
*because of the server flag*, not because of the variable that claims it. That is a finding for the b6
write-up and its own issue (§6, step 2), not for this design: tonight's calls are explicit about the
field they send, and the transcript header must print the field and the strength actually sent.

**Third, and it is a lever**: `low` and `medium` exist. The brief's overrun (`high` on an 8.5 kB prompt
blows the 16384 context) has a fallback that is not "restart the server": the commit call's prompt is
shorter than a turn's (it carries the situation and a numbered list, no eight-field instructions), and if
`high` still overruns, `medium` is the next arm, pre-registered as such (§6, step 1's negative path).

### 1.2 The 91% is a reading of meaning, not a byte fact

The brief's table (62 of 68 turns chose "#1 — its own first-written option") was checked against the seven
S transcripts by the only rule code may apply — byte identity, the same rule moi's ledger and §20.1's
duplicate collapse use:

| | prisoner (68 turns) | warden (70 turns) |
|---|---|---|
| intent byte-identical to candidate #1 | **12 (18%)** | 21 (30%) |
| identical to #2 | 0 | 0 |
| identical to #3+ | 1 | 0 |
| no byte match to any candidate | 55 | 49 |

So 91% is "the intent *refines* candidate #1" read by a person (or a model), which is exactly the
judgement constraint 4 forbids code to make. It is still the right number — the prompt says the intent
"may match one of your candidates above, or refine one", and refinement is what a reader sees — but
**it cannot be the machine-checked endpoint of anything**, and the batch-6 write-up must state how it was
obtained and put the 18% beside it as the code-checkable floor.

The design answers this by never asking code to match a text to a text (§3.4): selection is *declared*
(an index, counted as given, the way `replanned` is), and adherence is *keyed* (the referee's `target`,
which every ruling already carries).

### 1.3 The commit call, probed on a toy prompt: grammar survives reasoning, the content is naked JSON, and the choice follows content rather than position

The red team's first two points were testable in twelve calls, so they were tested (23:05 CDT,
`checkpoints/2026-09-24-strategy-commit-probe/`, **a toy stand-in for the situation, not a
`buildOpenWorld` request** — it says what the *instrument* does, nothing about what the real seat would
choose). Five fixed options, each carrying its own number, shown in three orders; `high` and `none`; with
and without `response_format: json_schema`; temperature 0.9.

| | asks | naked JSON in `content` | position-1 picks | reasoning chars | seconds per call |
|---|---|---|---|---|---|
| `high`, no grammar | 3 | 3 | 0 | 6.9k–10.0k | 33–47 |
| `high`, `json_schema` | 3 | 3 | 1 | 7.4k–11.5k | 36–54 |
| `none`, no grammar | 3 | 3 | 0 | 0.7k–0.9k | 5–6 |
| `none`, `json_schema` | 3 | 3 | 2 | 0.4k–1.5k | 3–8 |

- **The chatter trap does not fire on this server.** llama-server's reasoning parser puts the thinking in
  `reasoning_content` and `content` came back as a bare object in **12 of 12**, with or without a grammar.
  A grammar and `high` reasoning **coexist**: the grammar-enforced calls at `high` still produced 7–11k
  characters of reasoning. The step therefore reuses the seam's own wire discipline (§3.2): the same
  `response_format: json_schema` the schema seat has sent in every batch, and `firstJsonObject`'s
  balanced-brace fallback for a reply that wraps the object anyway. Neither is new code.
- **Choice follows content, not position.** Position 1 was picked in **3 of 12**; by identity the picks
  were water-and-key-ring 4, loose tile 4, door 3, bar 1, thread 0 — the same three favourites at `none`
  as at `high`. So on this prompt the model *selects* with no reasoning at all, and reasoning changes the
  cost (about 8× the tokens, 40 s against 5 s) more than the choice. That is the red team's point made
  measurable: **a #1 retention would be positional bias, and a change of choice under thinking was never
  the right kill** — the real probe (§5.0) shuffles, tallies by identity, and runs a `none` control.
- **Context headroom is better than the brief implied.** The largest `high` reply was 2662 completion
  tokens; the real situation is ~8.5 kB (~2.5k tokens) and the commit prompt is shorter than a turn's, so
  a `high` commit call sits near 5–6k of the 16384 context. `medium` stays the pre-registered fallback,
  but overrun is no longer the expected failure.

---

## 2. The claim, evaluated: thinking supersedes pick's *regenerate* half, not its *select* half

The prior analysis's premise is that the 91% figure comes from "a model that already deliberates", because
`thoughts` and `candidates` are required fields. **The premise is wrong in the way that matters.** Every
one of those 68 turns ran at 33 completion tokens of reasoning (§1.1, the server default). A `thoughts`
field is text the model *writes after* deciding, at zero reasoning; it is not deliberation in the sense
the owner's "turn on thinking" means. So the 91% shows that *listing* does not select — §20.2's finding
again, at N=68 — and says nothing yet about whether *reasoning* selects.

That makes the conclusion **plausible but unmeasured**, and it is precisely what D7's probe measures: the
same model, the same fixed list, reasoning at `high`, and the one number that decides it is how often the
declared index is still #1. Two outcomes, each pre-committed (§5.0):

- **Thinking selects** (index ≠ #1 in a real share of asks, and the chosen ids are route-relevant): the
  regenerate half *and* the select half are both superseded for the *strategy* decision, and pick stays
  what §40.2 called it — a force for turns, unrelated to this step.
- **Thinking does not select** (≥17 of 20 still #1): the claim is confirmed one level up. Then the select
  half is the remaining tool, and its right form is pick with a *keyed* recogniser (on-strategy /
  off-strategy / unavailable by referee `target`) instead of a seen/unseen one — a one-line generalisation
  of moi's existing API, *not* built tonight (§7).

One confound, named now so the probe is built around it: a reasoning model asked to list-then-choose in
**one** call can write its winner first, and "first-listed" then measures nothing. That is why the step is
two calls (§3.2): the list is fixed at thinking OFF before the commit call ever sees it.

---

## 3. The design

### 3.1 What a strategy is (D2)

```
Strategy = {
  chosen:   number        // 1-based index into the option list the commit call was shown; counted as given
  strategy: string        // one sentence, the mind's own words, ≤ 200 characters; the ONLY part read back
  targets:  string[]      // 1–2 ids from the perceived-object list; membership checked, meaning never
}
```

- **Free text alone** would leave adherence unmeasurable except by a person (constraint 4).
- **A named target alone** is the shape of the fixation the brief documents — but note what the evidence
  actually says: the two *deepest* results were fixations on the *right* object and the *wasted* game was a
  fixation on the wrong ones (posture, spoon). Fixation is not the disease; **arbitrary** fixation is. The
  ids make the commitment explicit and checkable; the thinking-ON commit call is what is supposed to make it
  non-arbitrary; the sentence is what carries it into each turn at "a high level", in the owner's words.
- **A ranked list** is rejected: it is a plan by another name, and §33.10–§33.12 spent thirty probes showing
  that no plan line moves the turn.

Ids are validated by closed-set membership against `context.perceivedObjects` (data the seat already
holds). An id not in the set is dropped, and a strategy with zero valid ids is recorded as *invalid* and the
game runs with **no line** — never with a code-invented one.

### 3.2 The step: two calls before round 1 (D3)

Runs once, after the precedent block is computed and before the loop's first half-round (the place in
`checkpoint.ts` immediately after `precedentLines`). Both calls go through the same swapper and the same
router as every wits call; the second sends the reasoning field explicitly.

1. **OPTIONS** — reasoning `none` (the same field, sent explicitly so the header can say so). The prisoner's
   round-1 seat situation (`renderSeatSituation`, byte-identical to what the turn sees) plus: *"List 5 to 8
   DIFFERENT concrete things you could try over this game to get out, each grounded only in what you can
   reach or perceive above. Number them. List only; choose nothing."* Answer: one JSON array of
   `{text, reason}`, the shape `coerceCandidates` already accepts. Exact-duplicate texts collapse to one, kept
   first (§20.1's rule).
2. **COMMIT** — reasoning **`high`** (`medium` is the pre-registered fallback, §6 step 1). The same
   situation, then the numbered list *as fixed by call 1*, then: *"Which ONE of these do you pursue this
   game? Answer with one JSON object: {"chosen": number, "strategy": string, "targets": [string]} — "chosen"
   is the option's number; "strategy" is one sentence, at most 200 characters, you will be shown every turn to
   remind you what you are trying to do; "targets" names 1 or 2 of the object ids above that this strategy
   works on."*

Both calls go over the seam's own wire discipline, not a new one: `response_format: json_schema` with the
call's schema (`coerceCandidates`'s array shape for OPTIONS; `{chosen, strategy, targets}` for COMMIT), and
`firstJsonObject` on the reply so a wrapped object is still found. §1.3 measured that a grammar and `high`
reasoning coexist on this server and that the content comes back naked either way. **The raw text of both
replies — `content` and `reasoning_content` — is written to the transcript** under the strategy block, so
a gate failure can be read as what it was (§6, step 5's negative path).

Cost per game: two calls, one of them at `high` — under a minute each on the toy prompt, budget five
minutes on the real one — against a 20-minute game. The turn call is **untouched** in shape, schema,
temperature and reasoning.

### 3.3 How it reaches the turn (D5)

One line in the prisoner's briefing, rendered by `briefing.ts` beside `Your plan, from your last turn`,
carried in `OpenNews` the way `plan` is (`game.ts`), every round, unchanged for the whole game:

```
Your strategy for this game: <strategy sentence>
```

Nothing else. No field is added to `Proposal`, the prose seat still asks one question, the schema seat (if
ever run under this) still asks eight. **Read cost, not fill cost**, stated explicitly per the brief: the
prose seat spent its compliance on not filling fields (2.9% refusals against 14.7%), and this design spends
none of it back. The secondary refusal band (§5) is what checks that claim.

**Why the prose seat and not the schema seat tonight.** Three reasons, each a measurement and not a
preference. (i) P has *no* cross-turn memory, so this line is the only thing crossing a turn; if adherence
moves, the line did it — on S the persistent `plan` would be a second candidate explanation. (ii) P's depth
floor is 92 across seven games, so "strategy makes P damage deeply" is a prediction with room to fail in
both directions; S already reaches 59. (iii) P's refusal rate leaves the refusal band room to detect a
cost. The schema seat is the natural second arm and is not run tonight (§7).

### 3.4 Adherence without judging meaning (constraint 4)

Every ruling already carries `target` (the transcript's referee table, `batchMeasures.ts`'s `Ruling`). A
prisoner turn is **on-strategy** iff its ruling is applicable and its `target` ∈ `targets`. Refused turns are
counted in the denominator and reported separately, exactly as prediction 7 of b6 treats them. No text is
compared to any text; no extra referee call is made; the measure is computable from transcripts alone by
`npm run measures` once the header prints the strategy block.

### 3.5 Revision — designed, switched off tonight (D3)

If revisable at all, it must be revisable on a **data** trigger and at most **once**, or it collapses into
the per-turn `plan` that §33 showed does nothing:

- **Trigger**: three consecutive prisoner turns that were *refused or produced no property change* — the
  re-try measure's own definition (b6 prediction 7), so "stalled" is not a new notion.
- **Action**: the COMMIT call again, at `high`, shown the **same** option list plus one line: *"Your
  strategy has stalled: the last three turns changed nothing."* Never a new options call — the options are
  the game's fixed hand.
- **Cap**: once per game. The second strategy replaces the line; the transcript records both, with the
  round.
- **Switch**: `PRISONER_STRATEGY=revise`, default off. Tonight runs `fixed`.
- **Logged even when off** (red team, point 3): under `fixed`, the trigger is still evaluated every
  prisoner turn and the transcript's summary prints `Revision would have fired: round N` (or `never`).
  `batchMeasures.ts` reports it per game. So batch 7 says, at no cost to the isolation, how often a
  committed strategy stalls and when — which is the number a decision to build revision needs. Adherence
  and progress are in tension by design under `fixed`; band 4 is that tension pre-registered, and band 1
  passing while band 4 fails is the case *for* revision, not a contradiction in the endpoint.

What separates this from the schema seat's `plan`: it is produced in a *separate* call the turn cannot
rewrite, at a reasoning strength the turn does not have, on a trigger code can see, at most twice a game.

### 3.6 History across games — designed, not built (D4)

The owner's middle beat — *"which of those have been tried in the past and how did they fare"* — needs two
things. The first exists: moi's precedent ledger, rendered by `precedentLines`, is "what has been tried"
in the warden's perception (111 accounts over 22 episodes in `checkpoints/precedent-ledger.json`). The
second does not: an `Account` records text, actor, observer and episode, **not an outcome**. "How it fared"
is a field on the ledger, which is moi's change, held to moi's admission test, and its first real caller
would be this step. It is filed, not built (§6 step 2 files the issue).

When it is built, the rule is: **a batch reads one frozen snapshot**, the same for every game, and
`recordGame` writes only *after* the batch (§32 did exactly this). A ledger that grows game by game makes
game 7 depend on games 1–6; every measurement here treats games as independent, and the projection column
and the DEAD rule both assume it. Cross-*batch* learning is fine — that is what a snapshot is.

The hook is cheap and lands tonight in shape only: the OPTIONS and COMMIT prompts take the same optional
`precedentLines(...).prisoner` block the turn prompt takes, under the same `PRISONER_PRECEDENT_LEDGER`
switch, so precedent ON/OFF is one variable across both. Batches 3–6 ran precedent OFF; so does tonight.

### 3.7 Interfaces (what to build, not the lines to type)

- `src/open/strategy.ts` — `buildOptionsPrompt`, `buildCommitPrompt`, `coerceStrategy` (index, sentence,
  ids by membership), `chooseStrategy({ ask, context, conditions, precedent? }) → Strategy | null`. Takes an
  injectable `ask(prompt, { reasoning })` so tests run offline; no game words in the module (the same
  discipline as `conditionList.ts`), so it can lift to moi unchanged if it earns it.
- The reasoning field: a small wrapper sending `chat_template_kwargs: { reasoning_strength }` — beside
  `withThinking`, not replacing it (that one's semantics are pinned by recorded headers).
- `checkpoint.ts` — `PRISONER_STRATEGY=fixed|revise`, unset = off, anything else throws (the
  `readPickCondition` pattern). Header lines: `Strategy: OFF (baseline).` or a block printing the option
  list, the chosen index, the sentence, the ids, the reasoning strength *and field* sent, and completion
  tokens of both calls. When on, the referee-replay JSON gains nothing (the referee is untouched).
- `game.ts` / `briefing.ts` — `strategy?: string` on the prisoner's `OpenNews`; one rendered line.
- `batchMeasures.ts` — `adherenceByGame`: per game, on-strategy / off-strategy / refused, from the header's
  ids and each ruling's `target`.
- **Byte-identity guard** (TDD, first test written): with `PRISONER_STRATEGY` unset, `buildProsePrompt`
  and `buildOpenSingleCallPrompt` output is byte-identical to today's, and the header prints the OFF line.
  Every recorded batch stays poolable by construction, as `thinking.ts` does it.

### 3.8 What this is not

Not a change to `run-dmcp`, the resolve protocol or the referee's questions; not a frontier model at run
time (Muse at `high` is the whole cost); not a moi release; not a claim that the prose seat is better. The
S seat's 91% stays the turn-level baseline, and the 18% byte floor beside it.

---

## 4. Why D4 costs what it costs, in one paragraph

Every band in §5 and every DEAD call in the scoreboard assumes game *k* tells you nothing about game
*k+1*. The moment the strategy call reads an account written by a previous game in the same batch, a
seven-game batch is one seven-step trajectory, and "4 of 7" is not a count of anything. A frozen snapshot
keeps the count; the price is that the ledger learns only between batches. That is the right price, because
between batches is where a person reads what happened.

---

## 5. Endpoints and pre-registration

Every band below is written into `PREDICTION.md` **before the first game** and committed. The baselines
marked *compute* are computed from b6's seven P games (and S where stated) before the bands are finalised,
so the numbers below are the *shape* of the prediction; the agent fills the baseline and keeps the margins.

### 5.0 The probe (step 1), pre-committed

One OPTIONS call fixes the list; each option carries its **own** number for the whole probe. Then **20
COMMIT asks at `high`**, the list shown in a **different random order each ask** (seeded, recorded), and
**10 at `none`** as the control, all at temperature 0.9, requests built from `buildOpenWorld` (never a
recorded request — `prisoner-measurement-fidelity`). Every ask records the order shown, the option
*identity* chosen, and its *position*.

| | band | if it fails |
|---|---|---|
| **P0.a** valid JSON with an in-range `chosen` and ≥1 valid id | ≥ 16 of 20 at `high` | rerun once at `medium`; still < 16 → **stop, do not build** (the one substantive kill) |
| **P0.b** empty or context-overrun replies | ≤ 2 of 20 | same fallback to `medium`; still > 2 → **stop** |
| **P0.c** position-1 share at `high` | reported, with **two readings pre-named**: **(i)** identity-concentrated *and* position-spread (one or two options take most picks whatever their position) = the call selects on content; **(ii)** position-1 ≥ 14 of 20 with identity following the shuffle = positional bias, no selection | **neither reading kills the build.** Under (ii) the strategy is "the list's top item carried as a line" and batch 7 becomes the *conviction* test — the results file leads with that, and band 3/4 are read as adherence-only |
| **P0.d** `high` vs `none`, by identity | reported: same favourites at both = thinking buys cost, not choice (§1.3's toy result); different favourites = thinking changes the choice | no kill either way; it decides whether `PRISONER_STRATEGY` gets a strength sub-arm later, and the header records the strength regardless |
| **P0.e** chosen ids are condition-listed objects (`bar`, `lock`, `spoon`, `door`, `window` — the objects whose thresholds `conditions.ts` states, all present as ids in the perceived list) | ≥ 12 of 20 | fewer → the step selects but not toward the game; **build anyway**, and say the batch will likely show adherence without depth |

### 5.1 The batch (step 5): arm T = prose seat + `PRISONER_STRATEGY=fixed`, N up to 7

| # | measure | band | reads |
|---|---|---|---|
| **1 (primary)** | **adherence**: on-strategy share of prisoner turns, refused turns in the denominator | **≥ 60%**, and **≥ 15 points above** P's *modal-target share* (*compute*: per b6 P game, the share of turns on that game's most-targeted object) | the line is read and acted on. Below 60%: nothing reached for it (§57 again, and the honest result) |
| 2 | distinct targets per game | between **2.0 and 3.5** (P: 4.29; S: 3.14) | commitment narrows reach; ≥ 4.29 means the line was not read; < 2.0 is fixation without selection |
| 3 | depth of damage | at least **2 of 7** games end `barIntegrity ≤ 84`, **among games whose strategy ids include the bar** (P's floor was 92 in 7) | deliberate commitment goes deep where arbitrary commitment on P did not. Reported per committed target, never pooled over strategies that never named the bar |
| 4 | wasted games (no property change on any condition-listed object all game) | **≤ 1 of 7** (S had 1 of 7; *compute* P) | the arbitrary-fixation failure is the one this step exists to remove |
| 5 | prisoner refusals | **≤ 8%** (P: 2.9%) | the read-cost claim (§3.3). Above 8% the line costs compliance and D5 was wrong |
| 6 | re-try rate | **< P's 41.4%**, band ≤ 30% | the strategy line is the memory the HANDOFF said P lacked |
| 7 | novel (object, effect) pairs, `CLOSED_EQUIVALENTS` | reported, **no band** | commitment is expected to *reduce* novelty; a design that promised both would be lying |
| 8 | strategy-call health | both calls succeed in **≥ 6 of 7** games; commit call under **5 minutes** | otherwise the gate fires (below) |
| 9 | wall clock | median game < 45 min; none > 90 | one arm, one driver; the card is the floor |

**Not predicted:** escapes and catches (the brief's rule, and b4's finding). Reported, weightless.

**Gate**: game 1's header must print the strategy block with a valid id; if the step returns null in game 1,
stop the batch and treat it as a pilot. **Stopping rules** carried from b6 verbatim: `Context size has been
exceeded` on any call stops the batch; a header that does not print `Strategy: ON` in arm T is discarded;
`ollama_ps_before` not `[none]` quarantines the game; **a prediction is announced DEAD the poll it becomes
arithmetically impossible**, with the scoreboard's so-far / projected-at-7 / dead-or-open columns.

**Power, stated**: N=7 per-game bands (3, 4) are suggestive at best; the per-intent bands (1, 5, 6) have
~70 rows and are where the batch can speak. The baseline is b6's P arm at `ebe9711`, and arm T runs at a
later pin whose only difference is an off-by-default module — poolable by §3.7's guard, and the results
file says it is a cross-batch comparison in those words.

---

## 6. The attack plan (unattended, ~6 h from T+0)

T+0 is when the agent starts; clock times assume **22:45 CDT** and the machine as found at 22:20 CDT:
llama-server serving Muse with `reasoning_strength: none` (16.6 GB of 24.5), Ollama holding nothing,
`comfyui.service` inactive, the router on 8799 up, no game running. Each step names its dependency and its
negative path. Steps 1 and 2 run **concurrently** (one on the GPU, one not).

| step | window | depends on | do | if negative |
|---|---|---|---|---|
| **0. Instrument check** | T+0 → T+0:10 | — | Verify the live llama-server flag on doris (`ps`), `/api/ps` empty through the router, and re-run §1.1's five-row probe; write `checkpoints/2026-09-25-strategy-probe/SETUP.md` with the rows. | Server down or a foreign model loaded: **do not restart anything**; skip to step 2 alone, and end at step 7. `chat_template_kwargs` no longer moves tokens: same. |
| **1. The falsifier probe** (GPU, ~20 min) | T+0:10 → T+0:40 | 0 | Commit `PREDICTION.md` with §5.0's five rows *first*. One OPTIONS call; 20 COMMIT calls at `high` in shuffled orders (seeded); 10 at `none`; all from `buildOpenWorld`. Tally by identity and by position. Commit the raw replies (content and reasoning) and `RESULTS.md`. | P0.a/b fail at `high` → once at `medium` (10 min); still failing → **no build**, write it up, GPU to **fallback F**. **A parse failure with a visible object in the raw text is a bug in the coercion, not a probe result**: fix it within 15 minutes and re-tally the same replies; do not re-ask the model. P0.c/d/e never stop the build; they change what §6 step 4 pre-registers. |
| **2. The owed batch-6 write-up** (no GPU) | T+0:10 → T+1:30 | — | Copy `P/`, `S/`, `logs/` from `/tmp/b6-worktree` into `main`'s `checkpoints/2026-09-24-phase1-b6/` unedited; `npm run measures`; `scoreboard.mts` (announce every DEAD, the batch stopped at 7 not 10 and says so); `../2026-09-23-phase1-b3/audit.mts` refusal audit; `../2026-09-24-phase1-b4/escalate.mts` on every refusal **plus** `escalate-grounded.mts` on 30 grounded rulings with a recorded seed, Opus via the router (no GPU); `RESULTS.md` including §1.2 (how the 91% was read; 18% byte floor) and §1.1 (the wits thinking switch is a no-op on this server — file it as an issue in `docs/issues/`, and file moi's "outcome on an Account" issue from §3.6). Commit. | Claude CLI auth fails for escalation: record the failure, skip that section, continue. Measures CLI chokes on a transcript: quarantine that file, say which, continue. **This step is never skipped.** |
| **3. Build, TDD, time-boxed 80 min** | T+0:40 → T+2:00 | 1 passed | In order, each red-then-green: (a) byte-identity guard for both prompts and the OFF header line; (b) `strategy.ts` coercion (index range, sentence cap, id membership, null on zero ids); (c) the reasoning wrapper sending `chat_template_kwargs`; (d) `chooseStrategy` with a scripted `ask`; (e) `OpenNews.strategy` + the briefing line; (f) checkpoint wiring, switch parsing, header block **with both raw replies**; (g) `adherenceByGame` and the would-have-fired revision round in `batchMeasures.ts`; (h) a coercion test fed the twelve recorded replies from `checkpoints/2026-09-24-strategy-commit-probe/replies.jsonl` *and* three wrapped variants (prose preamble, a fenced block, trailing chatter), so the chatter trap is a test that passes before game 1, not a discovery in it. `npm run typecheck`, `npm run lint`, `npx vitest run` green. **Never `npm run format`.** Commit on `main`. | Not green by **T+2:00**: stop building, commit the work-in-progress on a branch `strategy-wip` with a note, and switch the GPU to **fallback F**. Do not run a batch on red. |
| **4. Pre-register batch 7** | T+2:00 → T+2:15 | 3 | Compute the *compute* baselines from b6 P (modal-target share, wasted games). Write `checkpoints/2026-09-25-phase1-b7/PREDICTION.md` with §5.1's bands, the gate and stopping rules, the reasoning field and strength, and the pin. Driver = b6's `run-batch.sh` plus `PRISONER_STRATEGY` passed **and logged per game** (the driver names the arm). New worktree at that commit. Commit before game 1. | Baselines make a band impossible as written (e.g. P's modal share already ≥ 45%): keep the margin, move the number, say so in the file *before* the first game. |
| **5. Batch 7** (GPU, ~2.5 h) | T+2:15 → T+5:00 | 4 | One driver, sequential games, arm T only, up to 7 games. Poll every 20 min: scoreboard with so-far / projected-at-7 / dead-or-open; announce DEAD at the poll. **No game starts after T+4:40** (~03:25 CDT). If time remains after 7, one `PRISONER_STRATEGY` unset game as a live canary of the OFF path. | **Gate fails on game 1: read the raw replies in the transcript before doing anything else.** A *technical* failure (an object is there and the coercion missed it; a wrong field name; an id with different casing) gets a **15-minute repair budget** — fix, test, re-pin, restart game 1, once. Only a *substantive* failure (no strategy in the raw text, an overrun, a timeout) stops the batch, reports it as a pilot, and hands the GPU to **fallback F**. Context-exceeded: stop, check the server line, do not restart it. A prediction dies: keep running (the batch is for all nine rows), announce it. Fewer than 4 games by T+4:40: report as a pilot, not a batch. |
| **6. Write up batch 7 + morning report** | T+5:00 → T+5:40 | 5 (or its fallback) | `npm run measures`, scoreboard, `RESULTS.md`; then `docs/OVERNIGHT-2026-09-25.md` in the house shape: decisions first (build revision? run the S-seat arm? file the moi shape?), then what landed, then what went wrong or could not be explained. Report times in Chicago; keep UTC where quoting logs. Commit. | Nothing here is negative-path; a batch that died still gets its results file, and a probe that killed the build gets §2's write-up as the report's headline. |
| **7. Restore the machine** | T+5:40 → T+6:00 | — (always) | Reload the owner's `qwen3:14b` pin into Ollama (`keep_alive: -1`, as found before b6); `systemctl start comfyui.service` on doris; verify both (`/api/ps`, `is-active`); leave llama-server exactly as found (it was running before this session and is not the agent's to stop). Record the final state in the morning report. Delete nothing in `/tmp`. | ComfyUI fails to start for VRAM (Muse holds 16.6 GB): **do not stop Muse**; say so in the report's first lines. Ollama load fails: same. |

**Fallback F** (used by steps 1, 3 and 5 on their negative paths): **complete batch 6 to its pre-registered
N=10** — three P games and three S games from `/tmp/b6-worktree` at `dd5d635`, the same driver, interleaved
P/S per b6's launchers. Six games ≈ 2 h. It needs no new prediction (b6's stands, at N=10) and turns "7 of
10" into the batch that was promised. Whatever fallback F reaches is folded into step 2's results file as a
second section, clearly dated, and the scoreboard re-run at the new N.

**Timing sanity:** step 2 overlaps 1 and 3, so the GPU idles only during the build (~80 min). That idle is
accepted: the alternative — running fallback F's games *during* the build — would spend the card on a
baseline the night may not need, and would need the batch-6 worktree and the new pin sharing one server, one
router log and one `/tmp`. Six hours buys one clean measurement, not two.

---

## 7. What I am willing not to finish

- **Revision** (§3.5): designed with its trigger and cap; not built, not run.
- **History** (§3.6): the hook lands (the prompts accept the precedent block); no ledger read tonight; the
  outcome-on-account change is filed against moi, not made.
- **The schema-seat arm**: not run. It is the second arm, and the first question is whether the line is read
  at all.
- **The moi port**: §2 names the shape (pick with a keyed recogniser) if the probe says thinking does not
  select. Filed as an idea in the morning report; nothing is exported from moi tonight.
- **N=10**: arm T gets what the card gives, ~7, and the results file says N in its first line.
- **The 91% as a machine measure**: not attempted. It is a reading of meaning and stays one; the byte floor
  and the declared index are what code reports.

---

## 8. What would change my mind

- **D1 → moi**: a second caller (brink's rival minds) wanting a pre-episode commit step, or this step
  measured to change a free turn — then the module lifts as-is, and the pick-with-keyed-recogniser shape
  goes with it.
- **D2 → free text only**: if adherence by ids is high but a person reading the transcripts sees the sentence
  and the ids disagree (the mind wrote "work the window" and named the spoon), the ids are the wrong
  representation and the sentence should be keyed by the referee instead, at one ruling's cost per game.
- **D3 → revisable**: band 4 (wasted games) failing while band 1 (adherence) passes — a mind that faithfully
  follows a dead strategy for ten rounds is the case revision exists for.
- **D5 → the schema seat**: if arm T's refusals rise past 8%, the line is a fill cost in disguise and the S
  seat, which already pays that cost, is the fairer host.
- **D6 → a different primary**: if P's modal-target share turns out ≥ 60% already, adherence cannot separate
  the arms and band 3 (depth, per committed target) becomes primary — decided in step 4, in the file, before
  a game.
- **D7 → moot**: if step 0 finds `chat_template_kwargs` no longer moves tokens, thinking is not a lever
  tonight and the probe should run at `none` to ask the weaker question: does a *separate* commit call select
  at all? §1.3 suggests the answer is already yes on a toy prompt.
- **The strength itself**: if P0.d shows the same favourites at `none` and `high` on the *real* situation
  (as the toy did), `high` is buying conviction at 8× the tokens and the honest next arm is a strength
  comparison, not more strategy — pre-registered then, not run tonight.
