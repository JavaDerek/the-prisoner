# Discarded, not deleted: a game with two half-rounds lost to a hung connection

`2026-09-21T22-38-19-957Z.md` (game `O:4`, `logs/O-4.log`) lost its round-2 and round-7 prisoner rulings
to the transport, not to the referee: the router's log (`logs/router.log`) records `"route":"error"`,
`"TypeError: fetch failed"` after 300927ms and 301099ms for those two requests, and doris never answered
them, while every one of the other 99 referee calls in the batch so far returned in under 53 seconds.
The mind's 300s timeout then fired and each half-round was ruled impossible with the transcript printing
`Referee call failed (rung 0): TimeoutError` -- the loud path §3.1 built, doing its job. The other
eighteen half-rounds are ordinary.

It is kept because results are committed unedited here, including bad ones. It is not counted anywhere:
a game with a tenth of its rulings never made is measuring the wire. Its replacement is `O:11`, launched
at 18:26 CDT. The router's doris path had no per-attempt timeout (only its DeepInfra path did, after
yesterday's D#1); that is being fixed with tests and the fix's commit is named in `RESULTS.md`.
