#!/bin/bash
# Pick arms with precedent ON, as §32 measured them: each game gets its own fresh copy of the committed
# 22-episode ledger (nothing written back to it). Alternates pick=even and pick=even-regenerate.
set -u
cd "$(dirname "$0")"
for k in 1 2 3; do
  for ARM in even even-regenerate; do
    COPY=/tmp/the-prisoner-ledger-$ARM-$k-$(date +%s).json
    cp ../precedent-ledger.json "$COPY"
    ./run-batch.sh batchJ-$ARM-$k 1 PRISONER_PICK=$ARM PRISONER_PRECEDENT_LEDGER=$COPY || exit 1
  done
done
echo "PICK LEDGER DONE $(date)"
