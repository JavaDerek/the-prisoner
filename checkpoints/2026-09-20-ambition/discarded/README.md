# Discarded, not deleted: a game measured through a hung provider connection

`2026-09-21T19-32-10-804Z.md` (and its `.referee.json`) is the first arm-D game launched, on
`Qwen/Qwen3-235B-A22B-Instruct-2507` through DeepInfra. Its round-2 prisoner half-round is a
**silence, reason `timeout`, 300038ms**: the shim's log shows DeepInfra answered that wits call with
429 `engine_overloaded`, and the shim's retry then sat on a connection that never returned until the
mind's own 300s timeout closed it (`"error":"TypeError: fetch failed","ms":303859`). The other three
half-rounds are ordinary.

It is kept because results are committed unedited here, including bad ones. It is not counted
anywhere: a game with a quarter of its intents lost to the transport is measuring the network, not
the mind. Arm D's tenth counted game is `D:11`, launched at 19:53Z as its replacement, after the shim
gained a 120s per-attempt timeout on the DeepInfra path (the fix that a later game,
`D:11` itself, then exercised: one attempt abandoned at 129s, the next succeeded, no silence).

`logs/D-1.log` is the launcher's record of the discarded game; `logs/D-11.log` is the replacement's.
