#!/bin/bash
set -o pipefail
cd /Users/derekferguson/rpg/the-prisoner
export PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=120000 PRISONER_OLLAMA_RESIDENT_MODELS=
for arm in BASE VARIANT; do
  npx tsx checkpoints/2026-09-22-custody/replay.mts $arm 3 2>&1 | grep --line-buffered -v " INFO " | tee checkpoints/2026-09-22-custody/$arm.log || exit 1
done
echo DONE
