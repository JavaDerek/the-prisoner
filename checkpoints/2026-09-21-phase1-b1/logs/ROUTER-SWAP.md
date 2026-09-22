# Two routers served this batch

- `router.log`: the router at `1a66459` (the Phase 0 landing), on `127.0.0.1:8799`, started 22:08:22Z. Its
  doris path had no per-attempt timeout; two referee requests hung for ~301s (game `O:4`, quarantined).
- `router-1021cdb.log`: the router at `1021cdb` (per-attempt timeout 150s and one retry on the doris path),
  started on `::1:8799` at the time in `router-swap-at.txt`. Node's fetch prefers the IPv6 loopback for
  `localhost`, so every game process started after that time connects to the new router, while a game
  already running keeps its pooled connections to the old one until it ends. The old router was killed
  once it held no connections. Which router each game used is therefore decided by its start time in its
  own `O-<n>.log` against `router-swap-at.txt`, and `RESULTS.md` lists it per game.

Nothing the minds or the referee see differs between the two; the change is only what happens when doris
does not answer at all.
