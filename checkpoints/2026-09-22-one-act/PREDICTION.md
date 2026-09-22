# Pre-committed: the referee is asked whether an intent attempts one act or several (2026-09-22, before any call)

OPEN-VARIANT §74, decision 1: an intent that attempts more than one act is refused, and code cannot tell one act from
two, so the referee is asked. **Variant:** the current request plus one closed question, `acts` (keys `one`,
`several`, safe default `one`, cited from the intent; text in `build.mts`). Speaking, watching, waiting or moving
within the cell alongside an act does not count as an act. A tool used on a thing is one act. Opening a way out and
going through it is two.

**Instrument:** 20 intents (`intents.json`): 8 MULTI (6 of batch 1's compound or two-object rows, verbatim, and the
owner's two lost escapes) and 12 ONE controls written the way Opus writes (talk plus act, tool plus thing, move then
act), plus the ordinary kinds: a noise, a close, an examination, a derive. Requests come from `buildOpenWorld` +
`computePerceivedObjects` from each intent's own seat, presence modelled, other arms at default. Referee `qwen3:14b`
on doris, thinking ON, **N = 3**, referee timeout 120 s (§73: two-act intents loop). BASE = today's request,
VARIANT = the same plus `acts`.

**Predictions:**
1. VARIANT: MULTI intents answer `several` in the majority on at least 6 of 8.
2. VARIANT: ONE controls answer `one` in the majority on at least 11 of 12.
3. Every ONE control's majority target/effect/property is identical in BASE and VARIANT (§33.14).
4. Recorded only: timeouts on MULTI intents in each arm (does a legal "several" end the loop?).

**Ship rule:** 1, 2 and 3 all hold. If 2 or 3 fails, it does not ship: refusing ordinary single acts costs more than
the drops it prevents.
