title: The attempt ledger — plan memory as the caller's, with the engine's one hop stored verbatim

## Scope

DESIGN §4.3. `plans` and `plan_steps` via the migration hook. An authored plan skeleton per scenario
(content). The referee records every prisoner attempt against the active step when the mind's
`choice` equals the step's `move` (literal equality on our own token), or as an off-plan attempt
otherwise. On `ResolveProtocolError("expectation-contradicted")`, `contradictions` are stored as
evidence and the step is `failed`; on `ConstraintViolationError`, its `{ constraintKind, resourceId,
contradictedFact }`; on an outcome, the mechanic's own `result` decides `done` or still `active`.
The ledger is rendered into `briefing` in positive form (round, move, what the world said).

## Tests first

- A step with `expects: [{ bar, "value", 40 }]` after the warden's `REPLACE_BAR`: refused, the step
  is `failed`, evidence is the `Contradiction[]` verbatim with a non-null `openedByEventId` naming the
  warden's resolution event.
- The same with a null hop (simulate by inserting the fact outside the projection path): evidence
  stored, `openedByEventId: null`, and the rendered prose says the fact and its `validFromT` and
  nothing it does not know.
- An off-plan `choice` is recorded and does not advance the step.
- The rendered ledger contains no "no longer", "not", "failed to" phrasing produced by a template —
  a literal check for tokens *we* would have written, on output *we* generated; never a scan of the
  model's words.
- "What was the plan at t" is reconstructible from `attempted_at_t`.

Depends on P1, P2. Tolerates #30 unlanded; becomes its adversarial caller when it lands.
