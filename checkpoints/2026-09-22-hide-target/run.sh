#!/bin/bash
set -o pipefail
cd /Users/derekferguson/rpg/the-prisoner
# Queued behind the one-act probe: doris runs one referee workload at a time.
until grep -q "DONE" checkpoints/2026-09-22-one-act/run.out || ! pgrep -f "one-act/run.sh" >/dev/null; do sleep 20; done
export PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=120000 PRISONER_OLLAMA_RESIDENT_MODELS=
for arm in BASE VARIANT; do
  npx tsx checkpoints/2026-09-22-hide-target/replay.mts $arm 3 2>&1 | grep --line-buffered -v " INFO " | tee checkpoints/2026-09-22-hide-target/$arm.log || exit 1
done
echo DONE
