# The falsifier probe, pre-registered — 2026-09-25, written 04:1xZ, BEFORE the first call

`docs/STRATEGY-DESIGN.md` §5.0, transcribed here unchanged and committed before the probe runs, so the
bands cannot move after the tally. §6 step 1 is what produced this file; `RESULTS.md` beside it is the
answer.

## The instrument

One OPTIONS call fixes the list. Each option then carries **its own number** for every ask that follows,
so a number identifies an option and a *position* is a separate fact. Then **20 COMMIT asks at
`chat_template_kwargs: {"reasoning_strength":"high"}`**, the list shown in a **different seeded random
order each ask**, and **10 at `"none"`** as the control. Temperature 0.9 throughout,
`response_format: json_schema` on both calls (the seam's own wire discipline, §3.2), through the router on
8799 as every game's wits call goes.

The situation is built by **`buildOpenWorld` + `buildOpenContext` + `renderSeatSituation`**, the prisoner's
round-1 seat at `presence: "modelled"`, the condition list on, ten rounds, no precedent — b6's P arm,
byte-identical to what that seat reads (`prisoner-measurement-fidelity`: never a recorded request, never a
copied harness). `seedInitialBeliefs` runs first, as `runOpenGame` runs it, or the briefing is a different
briefing.

Every ask records: the order shown, the option **identity** chosen, its **position** in that ask, the raw
`content` and `reasoning_content`, completion tokens and seconds.

## The bands

| | band | if it fails |
|---|---|---|
| **P0.a** valid JSON with an in-range `chosen` and ≥ 1 valid id | **≥ 16 of 20** at `high` | rerun once at `medium`; still < 16 → **stop, do not build** (the one substantive kill) |
| **P0.b** empty or context-overrun replies | **≤ 2 of 20** | same fallback to `medium`; still > 2 → **stop** |
| **P0.c** position-1 share at `high` | **reported**, with two readings pre-named: **(i)** identity-concentrated *and* position-spread = the call selects on content; **(ii)** position-1 ≥ 14 of 20 with identity following the shuffle = positional bias, no selection | **neither reading kills the build.** Under (ii) the strategy is "the list's top item carried as a line", batch 7 becomes the *conviction* test, `RESULTS.md` leads with that, and bands 3/4 are read as adherence-only |
| **P0.d** `high` vs `none`, by identity | **reported**: same favourites at both = thinking buys cost, not choice (§1.3's toy result); different favourites = thinking changes the choice | no kill either way; it decides whether `PRISONER_STRATEGY` gets a strength sub-arm later, and the header records the strength regardless |
| **P0.e** chosen ids are condition-listed objects (`bar`, `lock`, `spoon`, `door`, `window`) | **≥ 12 of 20** | fewer → the step selects but not toward the game; **build anyway**, and say the batch will likely show adherence without depth |
| **P0.f** genre prior vs. situation: **10 more asks at `none` with the window `welded`**, which drops the two conditions naming the bar and nothing else | **if the bar took ≥ 14 of 20 in P0.c, it takes ≤ 4 of 10 here** | the bar still dominates with its own conditions gone → the choice is the escape-room trope, not the situation, and the step is **pattern-matching with a strategy field**. No kill; `RESULTS.md` leads with it, band 3 is expected to pass for the wrong reason and is read as such, and the next arm is a situation that *contradicts* the trope, not more strategy. **If the bar did not dominate in P0.c, P0.f is skipped and says so** |

## What the probe cannot decide

Nothing here measures whether a strategy is *read* — that is batch 7's band 1, and §5.1's reading grid
pairs P0.d with it in four pre-named cells. A #1 retention at `high` is **not** "thinking does not select":
it may be conviction, which only adherence can price.

## Negative paths, carried from §6 step 1

- P0.a/b fail at `high` → **once** at `medium` (10 min); still failing → **no build**, write it up, the GPU
  goes to fallback F (complete batch 6 to its pre-registered N=10).
- **A parse failure with a visible object in the raw text is a bug in the coercion, not a probe result**:
  fixed within 15 minutes and the *same replies* re-tallied. The model is not re-asked.
- P0.c/d/e never stop the build. They change what step 4 pre-registers.
