title: The world in engine terms — one location, two characters, constrained physical state, numeric mechanics only

## Scope

DESIGN Appendix A.1–A.4 and A.6, **numeric mechanics only**: `FILE`, `SHIM`, `HONE`, `INSPECT`,
`WAIT` for the prisoner; `REPLACE_BAR`, `SERVICE_LOCK`, `ROTATE_GUARD`, `OBSERVE`, `WAIT` for the
warden. Custody (`SEARCH`, `CONCEAL`, `CONFISCATE`) is P4 and waits on the engine.

- Schema through `initializeSchema({ migrations })` — this repo's tables live in the engine's
  database under the engine's rules; no second `schema.ts`.
- `declareTimeAxis` on a `counter` axis, unit `half-round`, before the first write.
- Every resource in A.2 declared `bounded` and `resolve_only`.
- The bar is **one entity for the life of the game**; `REPLACE_BAR` resets its integrity (DESIGN 1.5).
- `cut` is a fact on the bar opened when integrity reaches 0; declared irreversible by the referee
  after the outcome until E3.
- Every `adjudicate` reads only `input.constraint`. No database import anywhere under
  `src/mechanics/`.

## Tests first

- Conformance checks 3 and 6 go green: `pass` is implemented; a loud proposal with no `choice`
  moves nothing and records no resolution; `{ choice: "FILE" }` records exactly one.

- Each mechanic through `resolve()`: the outcome's transitions, the event, and `outcome.constraint`
  reflecting the write (resolution precedes narration, as a property of the API shape).
- A direct `writeConstrainedValue` to any A.2 resource outside a resolution is refused by the engine.
- `FILE` to 0 then `REPLACE_BAR`: refused, `ConstraintViolationError.contradictedFact` names the
  `cut` fact and the event that opened it.
- `REPLACE_BAR` before the cut: integrity is 100 and `valueHistory` shows both intervals.
- Half-round alternation: warden's writes at even `t`, prisoner's at odd, asserted on the clock.
- Against an existing database file as well as a fresh one (the engine's own gotcha).
