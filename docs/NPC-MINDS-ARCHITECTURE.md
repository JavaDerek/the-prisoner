# NPC minds — the architecture we arrived at, for any game (2026-10-16)

**Status:** agreed with Derek 2026-10-15/16 after a reset. Supersedes the "a 30B model cannot be an ambitious
NPC" verdict of 2026-09-25 (that was a design verdict, not a model verdict). Companion to
`brink-workshop/docs/OPEN-WORLD-RULINGS-DESIGN.md` (the rule and the four rulings, worked through Brink) and
`brink-workshop/docs/PLANNER-RIVAL-OVERNIGHT-2026-10-16.md` (the Brink build). Lives here because this repo is
the test bed for NPC-intelligence infrastructure, not because it is only about this game.

## 1. The rule (one paragraph)

Language models work at the **boundary** between the open world and a closed model; **code decides inside**
the closed model. The model's jobs: interpret what a player does and says, read who the player is (from words
as well as moves), read the outside world, propose candidate actions where the action space is open, and give
decided moves a voice. The player can do anything and everything has consequences: listed acts resolve by the
rules, unlisted acts get a bounded improvised ruling remembered as precedent, and the hard stakes move only by
the rules (detail: the Brink design doc, §4–§5).

## 2. Three kinds of world, three shapes of mind

| world | example | who proposes | who decides | measured |
|---|---|---|---|---|
| **Open** — no closed model of what an action does | improvising with objects (MacGyver-style puzzles) | the model | a **referee** judges whether it works; the model tries again with the observed consequence | Gemma-4-31B local: **22/24** by 4 tries (Opus 5: 24/24) |
| **Closed** — a small move set and an exact rule engine | Brink's rivals; the 20 strategy dilemmas | code enumerates legal moves | a **planner** searches the real rules under the model's belief about the opponent | Brink: planner **59 vs 45** for today's rivals (held out); dilemmas: optimum on 2 of 3 where the model alone failed |
| **Mixed** — an open physical world *and* an opponent | The Prisoner | the model proposes a few candidate acts (it is good at ideas) | the referee rules each one inside a rolled-back probe; a planner picks among the ruled candidates against the believed opponent | **not yet built or measured** — the obvious next test here |

The single failure behind the September work: one model call per turn was asked to sit on the boundary *and*
decide inside the model *and* act, with no loop.

## 3. Findings that should not have to be rediscovered

1. **Plan–act–observe with honest consequences is the mechanism** for open worlds. Feedback added 4–7 solves
   per model on 24 puzzles; the models changed approach rather than repeating (Gemma never repeated an idea).
   An observation that names only *what* was done, not *what happened*, makes the loop half-blind (the strategy
   screen's first dispatches did this).
2. **Knowing is not doing.** On strategy the model wrote a correct diagnosis ("a committed aggressor… not
   bluffing", belief 0.8) and ordered the losing move anyway. Consequence feedback, a written plan step, a
   separate decision call, listing every option, bounded thinking and full thinking all failed to fix it; a
   code planner acting on the model's *own* belief fixed it.
3. **Lookahead over the real rules is often the whole win.** In Brink a one-move planner always held (ground
   pays off later); 12 turns through the real settlement clocks beat today's rivals, and the read of the player
   then made no measurable difference — because the rival made ~3 decisions a game between two move kinds.
   A read of the player only pays when there are enough decisions and a wide enough move set for it to change.
4. **People are read from their words.** A dealmaker was indistinguishable from a quiet opportunist from moves
   alone. Beliefs must include what the player says and must allow "none of these".
5. **Never turn "unlisted" into "impossible".** (The heart-attack case, the-prisoner#16: the act never
   happened.) Improvise a bounded ruling instead (Brink design doc).
6. **A forward model can be free.** Brink's planner asks the real referee and rolls the database back (a
   SAVEPOINT) — it can never be wrong about the rules. (`resolve_only` in run-dmcp is a write permission, not
   a dry run; a generic try-then-undo verb would be new engine mechanism.)

## 4. Method — how to measure without fooling ourselves

- **The judge must be stronger than what it judges.** Referee/judge on a frontier model in the cloud; only the
  NPC is local. (A 14B referee was the ceiling for weeks in September.)
- **Calibrate the judge** against human labels, and expect the labels to be noisy too; compare models under
  one pinned judge rather than trusting absolute rates.
- **Audit every answer key before using it.** A 14K-task benchmark's keys were 40% unsound in a 30-task audit;
  its headline ("small beats frontier") was an artefact. LLM-authored answer keys (the strategy dilemmas) were
  brute-force verified before play — all 60 held.
- **Separate authors from judges and players:** scenarios written by a different vendor's model than the one
  judging, and not by the family of the model being tested.
- **Tune on one seed set; report on held-out sets** never used for anything else. Re-run on a fresh set after
  any change made in response to held-out results.
- **Scripted opponents are circular** if they are also the archetypes the mind believes in — always add
  opponents it does not believe in.
- **Many small bets, not one big one:** three games per hypothesis, then widen what works.
- **Check paired differences and noise** before reading a gap; most gaps between belief sources were noise.

## 5. Running minds on one 24 GB GPU (as measured 2026-10-15/16)

- **Gemma-4-31B (Q4_K_M) is the NPC model:** best local physical-puzzle solver; reads opponents reasonably.
- **Thinking off.** Thinking on costs ~8k tokens / ~200 s a turn on puzzles and overflowed the context into
  blank answers; on strategy it produced the same moves as thinking off. Gemma's thinking is an on/off switch
  natively; a budget needs two calls (capped think, then answer) or an engine with a thinking-budget control.
- **Context 8k** keeps the model entirely on the GPU; a larger context or another resident service spills it
  to the CPU and slows every token.
- Screen candidates cheaply in the cloud first, confirm the finalist locally (results matched).
- gpt-oss-20b gives up instead of retrying; Qwen thinking models loop at temperature 0.

## 6. Where the pieces live

| piece | home |
|---|---|
| the rule (short form) | proposed for root `~/rpg/CLAUDE.md` (decision D1 in the Brink design doc) |
| improvised rulings, soft levers, precedent, the "unlisted ≠ impossible" lesson | run-dmcp (neutral vocabulary) |
| Brink's planner rival and soak | brink-workshop `src/rivals/planner/`, `scripts/planner-soak.ts` |
| the mixed-world mind (propose → rule in a probe → choose) | here first; generalise when a second game uses it |
| mind-seam, mother-of-invention | nothing new needed |

## 7. Next tests, in the order they answer the most

1. **Mixed world:** the Prisoner prisoner as propose → rule-in-probe → choose, against the warden. Does it
   find and *execute* routes it previously only described (the blanket-cord-for-the-keys plan)?
2. **Belief from words** in Brink: feed the player's own turns (calls, offers, threats) to the belief; does a
   read start beating "no read"?
3. **Improvised rulings:** the crank-call and heart-attack cases, consistency across repeats, and a property
   test that no improvised ruling ever moves the hard stakes.
