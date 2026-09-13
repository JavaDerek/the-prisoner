title: The resolve protocol has never been called by two proposers — pin its behaviour under contention, in neutral vocabulary

## What this is

A test-only change. `src/timeline/__tests__/resolve.test.ts` has 18 cases, all one proposer against a
world only it writes. §5.2a says the protocol "should be scrutinised, and it has been" — but every
scrutiny so far has been a single caller, and the design's own turn-based consumer never executed
§11 Phase 4, so `createResolver` has no production caller at all. A consumer is now arriving whose
whole shape is two principals contending for the same constrained values, alternating on a `counter`
axis. Pin what the engine does before it gets there.

## Cases, neutral fixture (`grain`, `treasury`, `population`)

1. Two mechanics, alternating writes at `t`, `t+1`, `t+2` on a counter axis: `valueHistory` shows
   every transition in order; no interleaving loses a write.
2. Proposer A `expects { entity, "value", 40 }`; proposer B's resolution set it to 100 one `t`
   earlier. A is refused `expectation-contradicted`, and the contradiction's fact carries
   `openedByEventId` naming B's `resolution.recorded` event (non-null once #30 lands; assert the
   shape either way and mark which).
3. `resolve_only` under contention: a direct `writeConstrainedValue` from outside any resolution is
   refused while the other proposer's resolution is *not* open (no leaked window).
4. `irreversible`: A's resolution declares a fact irreversible; B's later `set` that contradicts it
   rolls back **every** change in B's resolution, including a numeric leg that would have succeeded
   alone, and records no event.
5. An expectation naming an entity/key with no fact at `t` (a destroyed entity, or a key never
   written) **dispatches** — pinned as the documented behaviour of `contradictions()` ("silence is
   not a verdict"), so a caller reading this test knows it cannot express "still exists".
6. Two proposals at the **same** `t` on a counter axis: both land; assert only what the engine
   promises about their order (nothing), so the test documents the reason a caller alternates
   half-steps rather than sharing a `t`.

## What must not happen

No engine code changes in this commit. If a case cannot pass without one, stop and file the finding
as its own issue with the failing test attached — that is the point of running it first.
