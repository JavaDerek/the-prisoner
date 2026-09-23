#!/usr/bin/env bash
# Phase 1 batch 3's driver, committed so the batch's conditions are readable rather than
# remembered (batch 2's driver was a shell one-liner and only its logs survive).
#
#   ./run-batch.sh <logdir> <game numbers...>
#
# One driver per invocation, games run in sequence; two drivers side by side make the batch.
# Run it from a worktree pinned at the batch's commit, never from live main (CLAUDE.md, "Run a
# batch from a pinned commit"). The model router must already be listening on 8799 with its
# local route configured (SETUP.md), and doris's Ollama must hold nothing -- the referee is
# served by llama-server, and `PRISONER_OLLAMA_RESIDENT_MODELS=` (empty) means any model found
# loaded in Ollama stops the run, which is exactly the guard we want on a shared card.
set -uo pipefail

LOGDIR="$1"; shift
mkdir -p "$LOGDIR"

for n in "$@"; do
  log="$LOGDIR/O-$n.log"
  before=$(curl -s --max-time 10 http://localhost:8799/api/ps | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable")
  echo "== O#$n model=claude-opus-4-6 referee=muse-glimmer-30b-q4_k_m start=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_before=[$before]" > "$log"
  PRISONER_VARIANT=open \
  PRISONER_MODEL_URL=http://localhost:8799/v1 \
  PRISONER_WITS_MODEL=claude-opus-4-6 \
  PRISONER_VOICE_MODEL=claude-opus-4-6 \
  PRISONER_REFEREE_MODEL=muse-glimmer-30b-q4_k_m \
  PRISONER_REFEREE_THINKING=off \
  PRISONER_PRESENCE=modelled \
  PRISONER_ROUNDS=10 \
  PRISONER_THINK_TIMEOUT_MS=300000 \
  PRISONER_REFEREE_TIMEOUT_MS=300000 \
  PRISONER_OLLAMA_RESIDENT_MODELS= \
  PRISONER_CHECKPOINT_DB="/tmp/phase1-b3-O-$n-$$.db" \
    npm run checkpoint >> "$log" 2>&1
  rc=$?
  after=$(curl -s --max-time 10 http://localhost:8799/api/ps | python3 -c 'import json,sys;print(",".join(m["name"] for m in json.load(sys.stdin).get("models",[])) or "none")' 2>/dev/null || echo "unreadable")
  echo "== O#$n rc=$rc end=$(date -u +%Y-%m-%dT%H:%M:%SZ) ollama_ps_after=[$after]" >> "$log"
done
