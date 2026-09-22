#!/bin/bash
set -o pipefail
cd /Users/derekferguson/rpg/the-prisoner
export PRISONER_MODEL_URL=http://doris:11434/v1 PRISONER_REFEREE_TIMEOUT_MS=120000 PRISONER_OLLAMA_RESIDENT_MODELS=
npx tsx checkpoints/2026-09-22-one-act-s2/replay.mts S 3 2>&1 | grep --line-buffered -v " INFO " | tee checkpoints/2026-09-22-one-act-s2/S.log || exit 1
echo DONE
