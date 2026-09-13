title: The loop — half-rounds, a closed command set for the warden, and silence that becomes loud

## Scope

DESIGN §6.1, §7.2, §7.3. `npm run play`. The warden acts from a closed command set (a command, not
fiction); the prisoner's half-round runs the mind, validates, resolves, records. The terminal shows
`viewFor(warden)` and each outcome's `description`. Two consecutive `null`s from the mind surface a
loud message naming the endpoint and the last `SilenceReason` the wire reported — the loudness brink gives its local GM, applied to the only model
here.

## Tests first

- The clock advances exactly one half-round per principal action; warden even, prisoner odd.
- A warden command outside the set is rejected without touching the resolver.
- With a `SILENT_MIND`, the second consecutive silent round produces the loud line; the first does
  not.
- The rendered terminal output for the warden never contains a fact from the prisoner's private
  view (reuses P2's fixtures).
- With no mind injected, a round is the warden's half only — default off, byte-identical.
