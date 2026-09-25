# Design brief: a strategy step for a model-driven NPC

You are producing **two things**: a design, and an attack plan for another agent to execute
overnight. You are not implementing either. Read the evidence, answer the decisions, then write the
plan. Assume no context from any prior conversation.

## The system

`~/rpg` holds seven independent git repositories, side by side, deliberately not a monorepo. Three
matter here:

- **`the-prisoner`** (TypeScript) — a two-principal game. A model-driven prisoner and a model-driven
  warden each propose a free-text intent per round; a third model, the **referee**, rules on each
  intent using closed answer keys with verbatim citations, through `run-dmcp`'s resolve protocol.
  Ten rounds. The prisoner tries to get out; the warden tries to catch her. `docs/OPEN-VARIANT.md`
  is the authority for this variant.
- **`mind-seam`** (TypeScript, zero-dependency) — the extracted mind/proposal contract that
  `the-prisoner` and `brink-workshop` both build minds against. `Mind` is a one-method interface.
  `Proposal` requires only `intent`; everything else is optional. Both consumers pin `0.5.0` exactly.
- **`mother-of-invention`** ("moi", TypeScript, zero-dependency) — a package of generic mechanisms
  for giving a model-driven agent a reason to try something un-obvious. It has two: `precedent` (a
  ledger of what has been witnessed before) and `pick` (regenerate-and-choose). Pinned at `0.1.2`.

Neither `mind-seam` nor `mother-of-invention` has any path to `run-dmcp`'s storage, and neither may
acquire one.

## The two seats, and what was measured last night

The prisoner's chair can be asked for its turn in two shapes. A batch ran both, **7 games each**,
with **one model in all three chairs** — `muse-glimmer-30b-q4_k_m` (a 30B, Q4_K_M, on llama-server,
one 4090). No frontier model anywhere. The only variable was the seat.

- **Arm S, the schema seat**: one JSON object with eight fields — `thoughts`, `candidates`,
  `intent`, `line`, `plan`, `replanned`, `replanBecause`, `notes`. `plan` and `notes` persist across
  turns within a game.
- **Arm P, the prose seat**: one question — *"What do you try this turn?"* — and the whole answer is
  taken as the intent. No plan, no notes, nothing crosses a turn but the briefing.

| | arm P (prose) | arm S (schema) |
|---|---|---|
| distinct targets **per game** | **4.29** | 3.14 |
| distinct targets **pooled over the arm** | **8** | **8** |
| distinct novel (object, effect) pairs | 8 | 9 |
| distinct effect kinds | 8 | 8 |
| repeat rate (re-use of a target+effect pair) | 41.4% | 50.0% |
| prisoner refusals | **2 of 70 (2.9%)** | **10 of 68 (14.7%)** |
| games where the escape route was damaged | 4 of 7 | 4 of 7 |
| **how deep that damage went** (100 = untouched) | **92, 92, 92, 92** | **59, 68, 76, 84** |

Read those last two rows together. Both seats damage the bar equally *often*. Only one seat ever
damages it *deeply*, and the two deepest games are the two where the prisoner targeted **exactly one
object for all ten rounds**.

### The finding this brief exists for

The schema seat is **required** to produce 2–5 different concrete candidate actions every turn, and
it does — genuinely diverse ones. In a game that spent all ten rounds scraping the bar, the same
model also proposed lifting the loose tile, picking a thread off the blanket, and two conversational
plays. It wrote them down. Then:

| which candidate it actually chose | turns | share |
|---|---|---|
| **#1 — its own first-written option** | **62** | **91%** |
| #2 | 3 | 4% |
| #3 | 3 | 4% |

**91% first-listed.** There is no selection step. The model enumerates its options and takes the top
of its own list. The only code in the repository that reads `candidates` is moi's `pick` — which has
been switched **off in all 50 recorded games across five batches**.

So: the variety is generated and discarded. The fixation is not a narrow mind. It is a mind that saw
four alternatives, wrote them down, and reached for the first one, ten times running. And which
object it fixates on is **arbitrary** — one game locked onto the prisoner's own posture and the
spoon, and spent ten rounds reaching an outcome of nothing at all.

### Thinking mode is available and is currently off

The model has a reasoning-strength control. Every game so far ran with it **off**, server-wide,
across all three chairs:

| | completion tokens on a trivial prompt |
|---|---|
| forced `none` | 32 |
| **server default — what every game got** | **33** |
| forced `high` | 103 |

It is off for a *practical* reason, not a principled one: at `high` the model overruns its 16384
context on the game's 8.5 kB prompts and returns empty. **A per-request override works** — the same
running server returns 103 tokens when a single request asks for `high`, while every other request
keeps getting 33. No restart, no second process.

One recorded caveat: turning thinking on has been observed to **change the referee's rulings** (a key
question flipped 1/4 vs 3/4). Every thinking-off measurement is provisional in that light.

## The proposal to design

From the repository's owner, in his words:

> I'm envisioning the game kicking off and an NPC saying to itself: "ok, here's the hand I'm
> playing, what are all my options? OK — which of those have been tried in the past and how did they
> fare? OK — then, in this game I'm going to pursue X." We don't have anything yet that causes NPCs
> to pause and explicitly think like that.

and, on how thinking mode fits:

> I could see something where you get all the options, turn on thinking, develop a strategy, turn it
> off and then prompt the NPC with that strategy in each prompt to remind it what it is supposed to
> be trying to do — at a high level.

Note the owner's own constraint: moi was conceived **before** he knew reasoning modes existed, so
wherever moi would have hand-rolled deliberation, it should use the real thing instead. A prior
analysis argued this splits in two — `pick`'s *regenerate* half is superseded by a thinking mode,
but its *select* half is not, because a thinking mode buys deliberation and not choice, and the 91%
figure is a model that already deliberates (`thoughts` and `candidates` are both required) and still
does not choose. Treat that argument as a claim to evaluate, not a conclusion to adopt.

## Constraints you must design within

1. **TDD is mandatory** in every repository here. Failing test first, confirmed failing for the right
   reason, then the implementation.
2. **Never run `npm run format`** on `the-prisoner`. The code is not prettier-formatted; match the
   surrounding style by hand.
3. **One model at a time on the card.** Every model call goes through a swapper; two models resident
   is not an option.
4. **Never pattern-match meaning.** Free text is ruled on only by the referee, through closed answer
   keys with verbatim citations — never a regex, never code deciding what prose means. This applies
   to anything you design that reads a model's output.
5. **The engine boundary.** Generic mechanism may live in `run-dmcp`; a specific game's content may
   not. `the-prisoner`'s vocabulary (warden, prisoner, cell, bar, spoon) must never appear in
   `run-dmcp`, `mind-seam` or `mother-of-invention` — a CI test enforces this.
6. **moi's admission test** is the engine's: *generic, with at least one real caller* — explicitly
   not "sounds general." moi currently has a caller that imports it and never enables it.
7. **The owner's standing lesson**: *build it, but measure whether anything reaches for it.* Three
   mechanisms were built and measured in a day; he reached for all three within four rounds and the
   models used none of them.

## Decisions to make

Answer these directly. Give a recommendation for each, with the reasoning, and say what would change
your mind.

1. **Where does this live** — `mother-of-invention`, `the-prisoner`, or `mind-seam`? Argue it against
   the admission test in constraint 6, not by where it would be convenient. If moi, say what its
   public API is; if `the-prisoner`, say why it is not generic.
2. **What exactly is a "strategy"?** A free-text sentence? A named target object? A ranked list? This
   decides everything downstream, including whether a machine can check adherence without
   pattern-matching meaning (constraint 4).
3. **When is it chosen, and can it be revised?** Once at game start is maximum commitment. The
   evidence says commitment amplifies in both directions — the two deepest results and the one wholly
   wasted game all came from fixation. If it can be revised, on what trigger, and how do you keep that
   from collapsing back into the per-turn `plan` the schema seat already has and which did not
   produce selection?
4. **Does the strategy call consult history across games?** The owner's phrasing — "which of those
   have been tried in the past and how did they fare" — implies a ledger that outlives a game, which
   is what moi's `precedent` already is. Note the cost: every measurement so far assumes ten games are
   ten independent samples. Cross-game memory makes them a sequence and breaks that. Decide whether
   the ledger persists across a batch or resets with it, and say why.
5. **How does the strategy reach the per-turn call?** The prose-seat result was that making a model
   *fill* more fields flattens its answer. A strategy line the model *reads* is a different cost from
   a field it must produce — but say so explicitly and design accordingly.
6. **What is the primary endpoint?** A baseline already exists and nothing was designed to produce it:
   **91% of turns choose the first-listed candidate.** Say whether that is the right endpoint, and
   what secondary measures you would pre-register. Outcomes (escapes, catches) are known to be unable
   to separate arms at N=10 and must not be the endpoint.
7. **The cheapest thing that could falsify this before any code is written.** What one probe, costing
   a handful of model calls, would tell us this is not worth building?

## Then: the attack plan

Having decided the above, write the plan another agent will execute **unattended overnight**, with
no human available to unblock it. Write it as an ordered list of steps, each with a rough duration, a
stated dependency, and — this matters most — **what the agent should do if that step's result comes
back negative.** A plan whose steps only have success paths is not a plan.

Facts it must fit:

- **About six hours**, starting immediately, no human in the loop until morning.
- **One consumer GPU** (a 4090, 24.5 GB), currently free. One model resident at a time. A ten-round
  game with all three chairs on the local 30B costs roughly 20 minutes of wall clock, and two
  concurrent games do not go faster — the server has one slot, so total GPU work is the floor.
- **One piece of work is owed regardless of your design** and the agent will do it whatever you
  decide: writing up the batch described above — its measures, a refusal audit, an escalation of its
  refusals and a sample of its grounded rulings to a frontier model for an outside opinion, and a
  results document. Roughly an hour, almost none of it on the GPU. Sequence around it; it is also the
  natural thing to fall back to if your mechanism dies early.
- **Pre-registration is this repository's discipline.** Any measurement run must have its predictions
  committed to git *before the first game*, with bands that can fail, and a stopping rule. A
  prediction that is mathematically impossible must be announced when it becomes so, not at the end.
  Do not let the agent measure something it has not first predicted.
- **Every new arm defaults to off**, so that every previously recorded batch stays byte-identical and
  poolable.
- **The machine must be restored at the end**: a model pin belonging to the owner is currently
  unloaded and a GPU service of his is stopped, both to free the card. The agent hands it back.
- The agent can run shell commands, edit code, run the test suite, launch games detached, and call a
  frontier model through a local router for audit work. It cannot ask anyone anything.

Be explicit about what you are willing to have the agent **not** finish. Six hours is enough to build
a narrow thing and measure it once, or a broad thing and measure it never. Say which you are choosing.

## What not to do

- Do not write implementation code. Design, decisions, and interfaces only — the plan says what to
  build, not the lines to type.
- Do not propose changes to `run-dmcp`'s resolve protocol or to the referee's question set.
- Do not propose anything that requires a frontier model at run time. This must work on one 30B on
  one consumer GPU.
- Do not assume the prose seat is better. It reaches wider per game and is refused five times less;
  it is also the seat that never damages anything deeply. Both seats are evidence, neither is a
  target.
