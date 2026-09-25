#!/usr/bin/env bash
# Driver b, RESTARTED 00:02Z with the arms in the OTHER order.
#
# The first launcher ran arm P then arm S on BOTH drivers, which its own comment
# claimed made the arms span the same wall-clock window. It did not: P would
# have owned the first half of the batch and S the second, so any time-
# correlated change -- the server's state, another tenant arriving, thermal
# throttling -- would be perfectly confounded with the arm. Batch 4's void run
# is the standing reminder that a server can differ without anything recording
# it. Driver a keeps P-then-S; driver b now runs S-then-P, so each arm has half
# its games in each half of the batch.
#
# P game 6 already finished under the old order and is kept. P game 7 was four
# half-rounds in when this restarted; its log is in `abandoned/` and it is
# re-run from the start here, never resumed.
set -uo pipefail
cd /tmp/b6-worktree
D=checkpoints/2026-09-24-phase1-b6
export PRISONER_PRISONER_MODEL=muse-glimmer-30b-q4_k_m
export PRISONER_WARDEN_MODEL=muse-glimmer-30b-q4_k_m
export PRISONER_REFEREE_MODEL=muse-glimmer-30b-q4_k_m

echo "== driver b: arm S (schema seat) games 6 7 8 9 10 at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
PRISONER_PROSE_SEAT= "$D/run-batch.sh" "$D/logs/S-b" 6 7 8 9 10

echo "== driver b: arm P (prose seat) games 7 8 9 10 at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
PRISONER_PROSE_SEAT=prisoner "$D/run-batch.sh" "$D/logs/P-b" 7 8 9 10

echo "== driver b done at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
