#!/bin/bash
# Overnight 2026-09-17 batch driver. Runs N open-variant games one after another
# (one model on doris at a time), each with its own scratch DB. Stops the batch if
# doris shows a model at start that this batch did not load, or a game exits non-zero.
# Usage: run-batch.sh <label> <count> [extra env assignments...]
set -u
LABEL=$1; COUNT=$2; shift 2
cd "$(dirname "$0")/../.."
for i in $(seq 1 "$COUNT"); do
  PS=$(curl -s -m 10 http://doris:11434/api/ps)
  if ! echo "$PS" | grep -q '"models":\[\]'; then
    echo "[$LABEL] game $i: doris not empty at start: $PS -- stopping batch"; exit 3
  fi
  STAMP=$(date +%s)
  echo "[$LABEL] game $i start $(date)"
  env PRISONER_VARIANT=open PRISONER_MODEL_URL=http://doris:11434/v1 \
      PRISONER_WITS_MODEL=qwen3:14b PRISONER_VOICE_MODEL=ancient-awakening:12b \
      PRISONER_ROUNDS=30 PRISONER_OLLAMA_RESIDENT_MODELS= PRISONER_THINK_TIMEOUT_MS=180000 PRISONER_REFEREE_TIMEOUT_MS=180000 \
      PRISONER_CHECKPOINT_DB=/tmp/the-prisoner-$LABEL-game$i-$STAMP.db \
      "$@" npm run checkpoint > /tmp/the-prisoner-$LABEL-game$i-$STAMP.log 2>&1 < /dev/null
  RC=$?
  echo "[$LABEL] game $i exit $RC $(date) log /tmp/the-prisoner-$LABEL-game$i-$STAMP.log"
  grep -m3 -E "Transcript|written|checkpoints/20" /tmp/the-prisoner-$LABEL-game$i-$STAMP.log
  [ $RC -eq 0 ] || exit $RC
done
echo "[$LABEL] batch done $(date)"
