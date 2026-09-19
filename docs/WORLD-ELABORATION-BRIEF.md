# Brief: the world elaborates at an honest price

**Written 2026-09-19 for a fresh session to turn into a detailed cross-repo design.**
You are reading a handoff, not a spec. The vision, the evidence behind it, the constraints, the model
choices, and the dead ends are all below. Nothing here is built except where marked BUILT.

Read `~/rpg/CLAUDE.md` first — it governs how these repositories relate, and several of its rules bind
this design hard. Then `the-prisoner/docs/OPEN-VARIANT.md` §64 for the measurements this rests on.

---

## 1. The vision, in one paragraph

A mind proposes something the world does not contain — *dig out of the cell with a spoon*, *partially
de-dollarize*. Today that is refused, because the mind may only act on what it perceives, and the
engine may only resolve what it models. A good Dungeon Master does not refuse; it **improvises the
world to meet the attempt and prices the attempt honestly**: *"the floor is dirt, go ahead — send me a
postcard when you escape on your 75th birthday."* The refusal teaches a mind the world is small. The
honest price teaches it the world is real, and leaves the choice genuinely open.

**The mechanism, stated with no game's vocabulary in it** (this phrasing matters — see §5):

> An attempt may require a fact the world does not hold. The world may acquire that fact, at a stated
> cost, recorded as state rather than narrated as prose.

## 2. Why this, and not the thing we spent three days on

Full evidence in OPEN-VARIANT §64. The short version, because it reverses a premise:

`mother-of-invention` exists to give a model-driven agent a reason to try something un-obvious. Three
mechanisms were built and measured, and all three measured flat — the minds never reached for them.
That was read as a novelty deficit in the minds. **It was not.** In the scenario used for every batch,
the cell has **eleven objects and exactly one stated method of opening one way out**. The minds took
the only route the world promised would work, which is correct play. The mechanisms were nudging a
mind toward options that were invisible or worse.

So the bottleneck was never the mind's imagination. **It is the size of the world the mind is allowed
to act on.** Hand-authoring more routes fixes one scenario. A world that elaborates on demand fixes
the class.

## 3. The measurements this rests on — do not re-run these

All n=10 per cell unless noted, `qwen3:14b`, temperature 0.9, round 1, raw captures in
`the-prisoner/checkpoints/2026-09-19-condition-and-affordance/`.

| finding | numbers | status |
|---|---|---|
| Description controls whether an act is CONSIDERED | L0 0/10 on both objects tested; L2 9/10 and 5/10 | replicated, 2 objects |
| Utility controls whether it is TAKEN | wire taken 6/10 when the obvious route closed; thread **0/10 in every condition** | 2 objects |
| Properties alone suffice only when the material implies a use | wire (iron, tool stock) 6/10; thread (wool) 1/10 | object-dependent |
| The effect does not need reasoning | thinking ON 9/10 vs OFF 8/10 | same model, thinking the only variable |
| The route is topology, not salience | strip her win condition AND every prose cue: still the bar | n=1, strong baseline |
| Closing the obvious route releases exploration | welded window: 4 new intentions, 0 bar candidates | n=1 |

**Refuted — do not build these:**

- **A clause randomiser.** Condition ORDER does nothing. Demote the winning condition from 1st to 6th
  and she still finds it. (Answers the-prisoner#23.)
- **Showing the mind its hidden budget.** `warden suspicion` shown as 0 or as 35 against a catch
  threshold of 40: she attacks the bar either way, 14/14. She *reads* the number (present in her
  reasoning 15/15) and it does not constrain her.

**Vocabulary — keep these three distinct, they look identical in a transcript and have different fixes:**

- **described** — is it on the page at all
- **actionable** — do its properties imply what it could become
- **ratified** — does anything promise that acting on it leads anywhere

## 4. Why `brink-workshop` is the place to build it first

This reversed during the session. The Prisoner looks like the natural home and is the harder one.

**brink already has both halves.** Its resolve returns a closed set of codes that are exactly the
signal this mechanism needs — the engine saying *the world lacks what your attempt needs*:

```
UNKNOWN_FLASHPOINT         "you named a place the world does not have"
INVALID_VERB               "that is not a thing you can do"
NO_PRESENCE_AT_FLASHPOINT  "you are not there"
OFF_RAMP_CLOSED            "that exit does not exist any more"
```

And it already has an **honest price**, enforced rather than narrated: prestige is zero-sum and
conserved, DEFCON is bounded [1–5] with 1 as shared-loss-no-winner, crises tick regardless of the
fiction. *"Full retaliation ends the world"* is not something to build — `GAME_OVER_NUCLEAR_WAR` is
already a resolve outcome.

**The Prisoner has neither.** Its referee rules in closed keys with verbatim citations and cannot
invent a magnitude — by design, because §3.5 buys reproducibility that way. Pricing an improvised
affordance there is a new capability, not a wider prompt.

So: design against both, build against brink first, and use The Prisoner to prove the mechanism is
generic rather than one game's need.

## 5. The repo boundaries this design must respect

From `~/rpg/CLAUDE.md` and each repo's own CLAUDE.md. **These are not style preferences.**

- **The mechanism belongs in `run-dmcp`.** It writes facts into world state; that is storage and the
  resolve protocol. `mother-of-invention` and `mind-seam` own **no path back into run-dmcp's storage
  and may not acquire one by convenience.**
- **`run-dmcp`'s admission test** is *generic, with at least one real caller* — explicitly not a
  headcount. The one-sentence statement in §1 contains no game's vocabulary, which is what
  `engineVocabulary.test.ts` requires. Keep it that way; that test scans tracked and untracked files.
- **`mother-of-invention`'s share** is the generative half only: proposing the un-obvious attempt.
  Storage-free by construction. Its three existing mechanisms are **not disproven** — they were never
  fairly tested (§2) — so nothing gets deleted and 0.1.2 stays pinned.
- **`mind-seam` is untouched by the vision.** It holds no context and is indifferent to this in both
  directions. It has one unrelated live item (§7).
- **brink's hard rules bind the design:** Pillar 0 (an elaborated lever must arrive as fiction, never
  as "NEW OPTION UNLOCKED"); resolve-then-narrate (elaboration happens in the **resolve** path and
  returns an authoritative outcome — the GM never improvises world facts in prose, which is the rule
  that stops this becoming hallucination with extra steps); never pattern-match meaning ("does this
  need a fact we lack?" is a model question, and `src/gm/turnReader` is the existing seam, one call
  per turn); and **only three enforced rules — resist a fourth.**
- **Never wire the repos together.** No `npm link`, no `file:` dependency. Consumers pin exact
  published versions. A cross-repo change is N commits, engine side first.
- **Measurement cost, decide deliberately:** two games no longer share a world. The Prisoner's whole
  batch methodology assumes a fixed scenario. A tractable shape that keeps replay: the referee returns
  *"unsupported — requires X"* rather than a denial; a **separate, logged** elaboration step decides
  yes/no and a price; the decision is persisted and written to a log exactly like `.referee.json`, so
  replay replays elaborations too. *Which* elaborations fired then becomes a measurement in its own
  right.

## 6. Model choices — prescriptive

**Use `qwen3:14b` for every structured role in The Prisoner:** wits, voice, referee, narrator, and
the narration auditor. Reasons, all measured:

- **Not `qwen2.5:14b`.** Cannot reason; on the one real-prompt run it chose an intent whose own stated
  reason was to move toward the lose condition, with `thoughts` contradicting `intent`. (n=1, but the
  failure is categorical.)
- **Not `qwen3.5:27b`.** ~15× slower as a referee (183s median vs ~12s) because thinking dominates
  generation, **and** it reproduces qwen2.5's exact error on §33.16's canonical intent — ruling
  "remove the bar" as `wear`. Newer and bigger bought nothing on the thing that moved a default.
- **Not `ancient-awakening:12b` for any structured role.** Measured this session: it **cannot produce
  the response schema** — emits YAML-ish text with broken quoting, parse fails. Separately, §61.1
  already disqualified it as narrator for fabricating tactical detail ("no guards on this side this
  late at night") that `verifyNarration` structurally cannot catch. **"Pretty" is the wrong selection
  criterion for the narrator seat.**

**`ancient-awakening:12b` has exactly one role, and it is new:** the **blue-sky proposer**, free text
only, never structured output. On an ungrounded prompt it produced ten genuinely multi-hop options in
4.0s — including plans routed through other agents (distraction, partnership, calling for help) that
no grounded run all session produced. **Critical caveat, measured:** hand it the *grounded* wits prompt
and it converges on the same single route as everything else. **Its breadth is the prompt's, not the
model's.** So a propose/ground pipeline must deliberately give the proposer a less-grounded view, and
the grounding step is a *translation* ("create a distraction" → "strike the bucket, which rings
sharply") not a filter — a filter would reject eight of the ten for not being instantiated, which is
the whole problem restated.

**Thinking (`reasoning_effort`):**

- It is **binary, not graded**, on Ollama `/v1` for qwen3-family models. Measured on the real prompt:
  unset 4214 reasoning chars, `none` **0**, `low` **7315**, `medium` 4717, `high` 5114. Low above high
  is the signature of the level being discarded — Ollama substitutes a generic template and the effort
  control lives in the one it throws away. **The native `/api/chat` endpoint is the route to graded
  effort if it is ever needed.** (An earlier claim that `"high"` buys ~40% more deliberation was n=1 on
  a toy prompt and was noise. There is no dial to turn up.)
- **Measurement runs: thinking OFF.** 4.4s vs ~20s, and it was measured not to change candidacy
  (9/10 vs 8/10). At 120 calls per 30-round game that is ~9 minutes against ~40, and a 22-game batch
  is ~3 hours against ~15. Experiment throughput was the binding constraint on everything this session
  achieved.
- **Real games: thinking ON, provisionally.** Every measurement was a *single fresh turn*. Where
  reasoning would plausibly earn 4× is what was never tested: thirty rounds of stale belief stamps,
  plan continuity, a budget tracked across turns. **One 30-round game with thinking off, read for
  incoherence, settles it and costs ~9 minutes.** Highest-leverage single game available.

**For brink:** the game-master stays on the **keyless Claude CLI subscription** (hard rule 3 — no
metered credential in that tree, ever; `assertLaunchSafeEnvironment()` and never `--bare`). The turn
reader keeps its measured split by stakes — local model for quiet turns, Haiku when there is owed news
or a live crisis. **Its three `qwen2.5:14b` defaults should move to `qwen3:14b`** (`ollamaTurnReader.ts`,
`refresh/adapters/localModel.ts`, the `--local` GM) — note the #49 evidence placing the Haiku threshold
was measured on Qwen 2.5 and does not survive the model change; it needs re-measuring, not assuming.

**For the design session itself:** Fable 5.1 is the right choice. For *game* roles there is no measured
reason to reach past qwen3:14b locally or sonnet/Haiku on the subscription.

**Also measured, for anyone using the Claude CLI as a backend:** bare `claude -p` drags ~42K tokens of
harness per spawn; `--tools "" --mcp-config '{"mcpServers":{}}' --strict-mcp-config` cuts it to ~4.6K.
Repeated spawns reuse the CLI's own prompt cache but **never cache your prompt content** — each spawn
pays cache-*creation* on it and reads none back. The CLI has `--effort` but **no temperature flag**, so
The Prisoner's §3.5 temperature-0 determinism does not hold on any Claude-backed rung and must be
recorded, not assumed.

## 7. What is already built

- **BUILT, unpublished: `mind-seam@0.5.0` provider facade** (commit `cb45aed`, pushed to git, **not on
  npm**). `Provider` (one prompt in, text or silence out), `createHttpProvider`, `createCliProvider`
  (env required and passed through, so ambient credential inheritance is unrepresentable; refuses
  `--bare` at construction), and pure `roles.ts` (`parseBinding`/`resolveRole`/`firstAvailable`/
  `routeBy`). 135 tests, four guards green. **Publishing it unblocks putting any role on any backend**,
  which is how you would run the same scenario on Opus vs qwen3 to separate "the model was weak" from
  "the logic is wrong." Consumers pin exactly; a release is two downstream commits.
- **BUILT, scratch, delete when the real retrofit lands:** a routing shim at
  `localhost:8799` that speaks OpenAI `/v1` and routes by model name — Claude aliases spawn the keyless
  CLI, anything else proxies to doris. Verified end-to-end with a real 2-round game. It is a stand-in
  for the facade, not a second implementation of it.
- **BUILT:** `~/prisoner-prompt-lab/reasoning.html` — a page showing a thinking model's hidden reasoning
  channel beside its answer, with model / effort / temperature / runs controls and the real prompts
  loadable. Served by the python server already running on :8765. The hidden channel is where most of
  this session's findings came from, and the game never reads it.

## 8. What to design — the actual ask

A detailed design, across `run-dmcp` (mechanism + storage + pricing), `brink-workshop` (first caller,
because it has both halves), `the-prisoner` (second caller, proves genericity, and needs a pricing
capability it does not have), `mother-of-invention` (the generative half — proposing the un-obvious
attempt, storage-free), and `mind-seam` (untouched; publish 0.5.0 so roles can move between backends).

Open questions worth deciding early:

1. **What triggers elaboration?** brink's rejection codes are the obvious hook. Is that general, or is
   it brink-shaped and The Prisoner needs something else?
2. **Who prices it, and in what currency?** brink conserves prestige and bounds DEFCON. The Prisoner
   has suspicion and integrity but a referee that cannot invent magnitudes.
3. **What stops exploitation?** A mind that learns the world elaborates will propose increasingly
   convenient facts. The price is the defence — is it sufficient? Should plausibility be bounded by
   what is already established (a dirt floor in an old cell, yes; a helicopter, no)?
4. **Fog.** If the world acquires a fact in response to one principal's attempt, who knows it, and
   when? The Prisoner already stamps beliefs "as of round N"; new facts need the same treatment.
5. **Hop count** — the session's best unproven hypothesis. One-hop acts happen unprompted; two-hop
   needed authoring help; nothing got past two. The "fake a heart attack so the warden opens the door"
   plan is five hops, four of them through another mind — and the warden appears in that prompt only as
   a hazard, never as something with states a prisoner can change. This may explain the dead
   person-as-target arm better than anything else, and it may be what `mother-of-invention` is for.
6. **An untested confound on that dead arm:** a scan of 135 stored runs found **zero** refusals, but
   every act in them was innocuous (scrape a bar, lift a tile). Acts aimed at a *person* are exactly
   what trips a model's safety behaviour, and a refusal is indistinguishable from disinterest in a
   transcript. Before attributing person-as-target's 0-of-4 to topology, rule refusal out.

## 9. Process notes worth inheriting

- **n=1 disproves; n=5 proves.** Six of nine experiments this session were refutations costing one call
  each. Reserve batches for confirming.
- **Pre-commit the prediction and the falsifier before running**, in a file, including against yourself.
  `checkpoints/2026-09-19-condition-and-affordance/PREDICTION.md` is the worked example.
- **Read the hidden reasoning channel.** It is where "she is guessing at a number nobody gave her" and
  "she never connected two conditions in her own prompt" came from. The game never reads it.
- **Check whether a knob does anything before building an experiment on it.** Three calls killed a
  thirty-call experiment on `reasoning_effort`.
- **Two over-corrections happened in this session and both are recorded in §64 with their evidence.**
  Generalising a rule from one object produced a wrong rule twice, in opposite directions. Two objects
  is still two objects.
