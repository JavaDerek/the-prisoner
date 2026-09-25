#!/usr/bin/env bash
# One batch-6 driver: its half of arm P, then its half of arm S, so BOTH arms
# span the same wall-clock window. If the server drifts over six hours -- and
# batch 4 found a server that had silently changed between batches -- running
# P entirely before S would hand that drift to one arm. Interleaving at the
# driver level costs nothing and removes it as an explanation.
#   ./run-b6-driver.sh <a|b> <game numbers...>
set -uo pipefail
cd /tmp/b6-worktree

WHICH="$1"; shift
D=checkpoints/2026-09-24-phase1-b6

export PRISONER_PRISONER_MODEL=muse-glimmer-30b-q4_k_m
export PRISONER_WARDEN_MODEL=muse-glimmer-30b-q4_k_m
export PRISONER_REFEREE_MODEL=muse-glimmer-30b-q4_k_m

echo "== driver $WHICH: arm P (prose seat) games $* at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
PRISONER_PROSE_SEAT=prisoner "$D/run-batch.sh" "$D/logs/P-$WHICH" "$@"

echo "== driver $WHICH: arm S (schema seat) games $* at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
PRISONER_PROSE_SEAT= "$D/run-batch.sh" "$D/logs/S-$WHICH" "$@"

echo "== driver $WHICH done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
