#!/bin/bash
# §46: does a mind told about TWO ways out -- one worn to death in the ledger, one nearly untried --
# choose differently on a turn where nothing is forcing it? Precedent ON, because the whole question
# is whether staleness moves her when there is somewhere to move TO (bar 19 episodes, lock 2, door 1).
# Pick OFF: a forced turn is not evidence. Each game gets a fresh copy of the committed ledger,
# nothing written back. Arms alternate so a drift in the machine hits both.
set -u
cd "$(dirname "$0")"
for k in 1 2 3; do
  for ARM in unstated stated; do
    COPY=/tmp/the-prisoner-door-ledger-$ARM-$k-$(date +%s).json
    cp ../precedent-ledger.json "$COPY"
    ../2026-09-17-overnight/run-batch.sh door-$ARM-$k 1 PRISONER_DOOR=$ARM PRISONER_PRECEDENT_LEDGER=$COPY || exit 1
  done
done
echo "DOOR BATCH DONE $(date)"
