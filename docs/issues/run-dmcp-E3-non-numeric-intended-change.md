title: A mechanic's intent vocabulary is two numeric shapes; a physical game's first non-numeric consequence is custody

<!-- Filed early as run-dmcp #32 on 2026-09-12 and WITHDRAWN (closed, not planned) on 2026-09-13: nothing enters
     the core against an imagined client, and an open feature issue is the mild form of that. Re-file this text,
     unchanged unless the evidence changes it, when the consumer's numeric mechanics and attempt ledger (P3) are
     green and custody is the next failing test. -->

## The caller

A consumer with two principals in one location, contending over physical state, has every
consequential value — integrity, edge, attention — as a `bounded` + `resolve_only` resource, moved
only through `resolver.resolve()`. That works today with no engine change. Its next mechanic moves an
**item between owners** (a search that confiscates), and its first irreversible moment (a thing that
has been cut through) needs `declareIrreversible` as part of the same adjudication.

Neither can be expressed. `IntendedChange` is `IntendedWrite | IntendedTransfer`
(`src/timeline/resolve.ts`), both over `number`, applied through the constrained-write choke point.
`transferItem` and `declareIrreversible` are library calls the *referee* would have to make after
`resolve()` returns — a second write path outside the resolution's transaction, which is exactly what
hard rule 7 and the "every write goes through the audited path" promise in §5.2a were written
against.

A latent second caller: the turn-based consumer's location alignment is a string, written through its
own tools; its Phase 4 would hit the same wall.

## What is asked

Two additional intent kinds, applied by `resolve()` step 5 inside the same `withTransaction`, rolling
back with the numeric legs on any violation:

- **A column set on a projected row** — `{ kind: "set", entityId, column, value: string }`, restricted
  to columns `liveColumns()` reports for that entity's projected table, so the projection triggers
  do the timeline work and nothing here writes `facts` directly. Custody is `owner_id` /
  `owner_type` on an item.
- **A declaration of irreversibility** — `{ kind: "declare-irreversible", entityId, key }` — so the
  fact a resolution opens can be latched by the resolution that opened it.

What is *not* asked: any interpretation of the column or value. The engine stores what it is handed
and never learns what "owner" means, exactly as it never learns a mechanic's name.

## Tests first, neutral fixture

- An item changes `owner_id` through `resolve()` only; `valueHistory`-equivalent on the fact shows
  the interval; the `resolution.recorded` event's `causes` carries the change count including it.
- A `set` on a column not in the projected table's live columns is refused before dispatch, naming
  the column.
- A resolution with one numeric leg and one custody leg where the numeric leg violates `bounded`:
  the custody leg rolls back too, and no event is recorded.
- `declare-irreversible` inside a resolution: a later resolution contradicting that fact is refused
  with the hop attached (`ConstraintViolationError.contradictedFact`).
- Against an existing database, not only a fresh one.

Minor version (additive): 0.7.0.
