# P7 -- the request order (optional, last): predictions

**DRAFT -- not pre-registered until committed unchanged before the first call, by the owner.** Scaffolded
2026-09-27 against the tree at `ac47293`. Optional and last, as the design orders it: run it after P1-P6, or not
at all. No model has been called: `probe.mts --dry-run` rebuilt the playtest's twenty contexts (0 replay
divergences) and built 80 requests, showing the source order each arm would send.

## What is asked

A person in the seat waits about 33 s for a ruling (design R7, "Waiting"). The request lists the intent FIRST
among its sources (`referee.ts` `buildSources`), so a server's prefix cache can reuse only the one preamble line
from one ruling to the next (RED-TEAM.md §3, R7 row: confirmed). Listing the eleven-odd descriptions first and the
intent last would let consecutive rulings in the same room share most of the prompt. Does it take time off, and
does it leave every ruling exactly as it was?

## Items and arms (N = 1 per item per arm, serial, one driver)

The playtest's twenty half-rounds (rounds 1-10, warden then prisoner), each on its own context rebuilt at today's
defaults (`../2026-09-28-probe-kit/kit.mts`), ruled in game order:

- **`intent-first`**: the request as every game sends it.
- **`intent-last`**: the same request with the `intent` source moved to the end -- a transport wrapper in this
  probe, not a game arm (no `src/` change; the red team's §6 notes a game arm for this needs its own env name, which
  is the owner's to name if P7 passes).

One block per arm, `intent-first` then `intent-last`: a prefix cache helps consecutive calls, and interleaving the
arms would evict the prefix each arm is trying to reuse. Time is the six-question call's own `ms` as the transport
records it; the one-act call (intent-only, the same in both arms) is recorded but not counted.

## Predictions (the design's numbers, verbatim)

1. **`intent-last` takes at least 20% off the median ruling time.**
- **Kill: less than 10% off.**
- **Hold: the rulings must be identical in both orders on all 20** (target, effect, property, product, magnitude,
  perceptibility). One difference, and the order is a batch boundary: the arm is held, whatever the time.

The design says "20 identical rulings each way"; the scaffolding reads that as twenty different rulings (the
playtest's twenty), each asked once in each order and required to agree -- the same request asked twenty times
would be fully cached in either order and measure nothing. **If the owner meant twenty repeats of one ruling, say
so here before committing** and the probe's items change to one context repeated.

## What the scaffolding decided

- **Game order, both chairs**: the warden's and the prisoner's perceived lists differ (each perceives himself and,
  from round 3 of a faithful replay, not always the other -- see P2's decision on `--omit=prisoner:2`, which applies
  here too), so consecutive requests share a prefix only up to the first differing description. That is what a game
  sends, so it is what is measured.
- **Rounds 4 and 8's warden turns are included** although today's cadence would skip them: they are recorded
  rulings in the room, and this probe measures time, not the contest.
- **The median is not projected**: the time rows are OPEN until all twenty pairs are in, then MET or DEAD. The HOLD
  row dies at the first differing pair and is announced then.
- **Shep shares the runner**: his calls between two of ours evict the prefix. Run P7 only when Shep is quiet
  (`/api/ps` and the Shep bridge's own log), or the time rows measure Shep.

## Stopping rules

- HOLD fires -> finish the block (the differing rulings are the evidence), report, do not adopt the order.
- Three errored samples in a row stop the run (rerun resumes).

## Scoreboard convention

`probe.mts --score` at every check-in; a dead row announced at the poll it dies.

## What the outcomes mean, written before any call

- **1 holds, HOLD holds** -- the order is worth an arm behind a request fingerprint (a batch boundary by bytes,
  though not by rulings); the owner names its env variable, and the PIN test says "changed on purpose".
- **KILL** -- the server does not reuse the prefix (or Shep evicted it): the wait's floor is model choice (R7).
- **HOLD fires** -- the model reads a different request differently: the order is not free, and it is held.
