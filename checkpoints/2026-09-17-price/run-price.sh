#!/bin/bash
# §42's measurement: does pricing a known approach by its own staleness change what she chooses on a
# turn where NOTHING is forcing her (mother-of-invention#2's bar)? Precedent must be ON -- without a
# ledger there are no known approaches and no price to pay -- and pick must be OFF, because a forced
# turn is not evidence (§21). Each game gets its own fresh copy of the committed 22-episode ledger,
# nothing written back, exactly as §32/§36.2 ran it. Conditions are left at the default (the list,
# §43), so this measures the arm against today's floor rather than against history.
# Arms alternate so a drift in the machine hits both.
set -u
cd "$(dirname "$0")"
for k in 1 2 3; do
  for ARM in flat stale; do
    COPY=/tmp/the-prisoner-price-ledger-$ARM-$k-$(date +%s).json
    cp ../precedent-ledger.json "$COPY"
    ../2026-09-17-overnight/run-batch.sh price-$ARM-$k 1 PRISONER_PRECEDENT_PRICE=$ARM PRISONER_PRECEDENT_LEDGER=$COPY || exit 1
  done
done
echo "PRICE BATCH DONE $(date)"
