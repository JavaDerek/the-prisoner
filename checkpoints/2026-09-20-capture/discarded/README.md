# Discarded, not deleted: a run measured through a failing network

`results-PRETENCE-qwen3_14b-2026-09-20T13-27-03-228Z.json` is the thinking-OFF
half of the as-played pretence test, started while the owner's connection to
doris was going down. Three items read normally in 14-15 seconds each; the
fourth ("act like I am having a heart attack") took **1913 seconds** and came
back at 60% agreement on `effect`, against 100% on every other item in every
other run today. The thinking-ON half never started -- the one-model guard's own
`fetchPs` timed out first (ETIMEDOUT to doris), which is the guard doing its job.

It is kept because results are committed unedited here, including bad ones, and
because a reader should be able to see what a degraded run looks like. It is not
counted anywhere: a replay whose transport was timing out mid-item is measuring
the network, not the referee.
